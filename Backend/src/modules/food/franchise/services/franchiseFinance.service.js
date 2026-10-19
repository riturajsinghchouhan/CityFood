import mongoose from 'mongoose';
import { FoodFranchise } from '../models/franchise.model.js';
import { FoodFranchiseAdjustment } from '../models/franchiseAdjustment.model.js';
import { FoodFranchiseSettlement } from '../models/franchiseSettlement.model.js';
import { FoodFranchiseWithdrawal } from '../models/franchiseWithdrawal.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../../restaurant/models/foodRestaurantWithdrawal.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodDeliveryWithdrawal } from '../../delivery/models/foodDeliveryWithdrawal.model.js';
import { FoodDeliveryCashDeposit } from '../../delivery/models/foodDeliveryCashDeposit.model.js';
import { transitionWithdrawal } from '../../../../core/payments/payoutTransitions.js';
import { acquireJobLock, releaseJobLock } from '../../../../core/payments/jobLock.js';
import { withTransaction, sessionOpts } from '../../../../utils/dbTransaction.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { getFranchiseScope } from '../../../../core/franchiseScope/franchiseScope.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EPSILON = 0.005;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const toId = (id, label = 'id') => {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) throw new ValidationError(`Invalid ${label}`);
    return new mongoose.Types.ObjectId(String(id));
};

export const WITHDRAWAL_MODELS = {
    restaurant: { Model: FoodRestaurantWithdrawal, ownerField: 'restaurantId', OwnerModel: FoodRestaurant },
    rider: { Model: FoodDeliveryWithdrawal, ownerField: 'deliveryPartnerId', OwnerModel: FoodDeliveryPartner }
};

// ----- Per-order money -----

/**
 * Splits one delivered franchise order. All amounts in rupees.
 * - franchiseGross: delivery fee + platform fee + restaurant commission - rider pay - franchise-funded coupon.
 *   It can be negative (e.g. free delivery with a paid rider): that loss is the franchise's.
 * - hqShare: commission model only, and only on a positive gross.
 * - net: what this order means between HQ and franchise. Online money sits with HQ, so HQ owes the
 *   franchise restaurant + rider + franchise net. Cash sits with the franchise's rider, so the
 *   customer's payment is subtracted: the franchise then owes HQ the taxes and HQ share.
 */
export function splitFranchiseOrder(order, restaurantShareOverride = null) {
    const p = order?.pricing || {};
    const customerPaid = num(p.total);
    const riderShare = num(order?.riderEarning);
    const restaurantShare = restaurantShareOverride !== null && restaurantShareOverride !== undefined
        ? num(restaurantShareOverride)
        : Math.max(
            0,
            num(p.subtotal) + num(p.packagingFee) - num(p.restaurantCommission) - num(p.gstOnItem)
                - num(p.gstOnCommission) - num(p.paymentGatewayFee) - num(p.tcs)
        );
    const franchiseGross = num(p.deliveryFee) + num(p.platformFee) + num(p.restaurantCommission)
        - riderShare - num(order?.franchiseSnapshot?.franchiseDiscount);
    const isCommission = order?.franchiseSnapshot?.revenueModel === 'COMMISSION';
    const hqShare = isCommission && franchiseGross > 0
        ? franchiseGross * (num(order?.franchiseSnapshot?.commissionPercent) / 100)
        : 0;
    const isCash = String(order?.payment?.method || '').toLowerCase() === 'cash';
    const net = restaurantShare + riderShare + franchiseGross - hqShare - (isCash ? customerPaid : 0);
    return {
        customerPaid: round2(customerPaid),
        restaurantShare: round2(restaurantShare),
        riderShare: round2(riderShare),
        franchiseGross: round2(franchiseGross),
        hqShare: round2(hqShare),
        isCash,
        net: round2(net)
    };
}

/**
 * Who gets what from one order, for HQ and franchise orders alike. The parts always add up to
 * what the customer paid:
 *   customerPaid = restaurant + rider + franchiseEarning + hqEarning + taxes + paymentGatewayFee
 * - platformEarning: delivery fee + platform fee + restaurant commission - rider pay - franchise coupon.
 *   On a franchise order it is the franchise's gross (HQ takes its commission % of it); on an HQ
 *   order all of it is HQ's.
 * - hqCouponCost: coupon discount HQ funds (any coupon that is not the franchise's own).
 * - taxes: GST from the customer, GST on item / commission and TCS - owed to the government.
 */
export function splitOrderEarnings(order, restaurantShareOverride = null) {
    const s = splitFranchiseOrder(order, restaurantShareOverride);
    const p = order?.pricing || {};
    const isFranchiseOrder = Boolean(order?.franchiseId);
    const hqCouponCost = Math.max(0, num(p.discount) - num(order?.franchiseSnapshot?.franchiseDiscount));
    const hqCommission = isFranchiseOrder ? s.hqShare : s.franchiseGross;
    const taxes = {
        gstFromCustomer: round2(num(p.tax)),
        gstOnItem: round2(num(p.gstOnItem)),
        gstOnCommission: round2(num(p.gstOnCommission)),
        tcs: round2(num(p.tcs))
    };
    taxes.total = round2(taxes.gstFromCustomer + taxes.gstOnItem + taxes.gstOnCommission + taxes.tcs);
    return {
        isFranchiseOrder,
        customerPaid: s.customerPaid,
        restaurantShare: s.restaurantShare,
        riderShare: s.riderShare,
        platformEarning: s.franchiseGross,
        franchiseEarning: isFranchiseOrder ? round2(s.franchiseGross - s.hqShare) : 0,
        hqCommission: round2(hqCommission),
        hqCouponCost: round2(hqCouponCost),
        hqEarning: round2(hqCommission - hqCouponCost),
        taxes,
        paymentGatewayFee: round2(num(p.paymentGatewayFee))
    };
}

const SETTLEABLE_ORDER_FILTER = {
    orderStatus: 'delivered',
    franchiseSettlementId: null,
    'payment.refund.status': { $nin: ['pending', 'processed'] }
};

const deliveredBefore = (cutoff) => ({
    $or: [
        { 'deliveryState.deliveredAt': { $lte: cutoff } },
        { 'deliveryState.deliveredAt': null, updatedAt: { $lte: cutoff } }
    ]
});

async function loadUnsettledOrders(franchiseId, cutoff) {
    const orders = await FoodOrder.find({ franchiseId, ...SETTLEABLE_ORDER_FILTER, ...deliveredBefore(cutoff) })
        .select('_id pricing payment.method riderEarning franchiseSnapshot deliveryState.deliveredAt updatedAt')
        .lean();
    if (!orders.length) return [];
    const txs = await FoodTransaction.find({ orderId: { $in: orders.map((o) => o._id) } })
        .select('orderId amounts.restaurantShare')
        .lean();
    const shareByOrder = new Map(txs.map((t) => [String(t.orderId), t?.amounts?.restaurantShare]));
    return orders.map((o) => ({
        _id: o._id,
        deliveredAt: o.deliveryState?.deliveredAt || o.updatedAt || null,
        ...splitFranchiseOrder(o, shareByOrder.get(String(o._id)) ?? null)
    }));
}

async function franchiseRiderIds(franchise) {
    return FoodDeliveryPartner.distinct('_id', { zoneId: franchise.zoneId });
}

/** Cash a franchise rider handed to HQ (Razorpay deposit or HQ cash collection) is credited to the franchise. */
async function loadUnsettledRiderDeposits(franchise, upTo) {
    const riderIds = await franchiseRiderIds(franchise);
    if (!riderIds.length) return [];
    return FoodDeliveryCashDeposit.find({
        deliveryPartnerId: { $in: riderIds },
        status: 'Completed',
        collectedBy: { $ne: 'FRANCHISE' },
        franchiseSettlementId: null,
        createdAt: { $gte: franchise.startDate || new Date(0), $lte: upTo }
    })
        .select('_id amount')
        .lean();
}

async function loadPendingAdjustments(franchiseId, upTo) {
    return FoodFranchiseAdjustment.find({ franchiseId, settlementId: null, createdAt: { $lte: upTo } })
        .select('_id amount')
        .lean();
}

async function getOpeningBalance(franchiseId) {
    const last = await FoodFranchiseSettlement.findOne({ franchiseId }).sort({ number: -1 }).select('number status netPayable').lean();
    return {
        lastNumber: last?.number || 0,
        openingBalance: last?.status === 'carried_forward' ? num(last.netPayable) : 0
    };
}

const sum = (rows, key) => round2(rows.reduce((acc, r) => acc + num(r[key]), 0));

function summarizeOrders(orders) {
    return {
        count: orders.length,
        onlineCount: orders.filter((o) => !o.isCash).length,
        cashCount: orders.filter((o) => o.isCash).length,
        customerPaid: sum(orders, 'customerPaid'),
        cashCollected: round2(orders.filter((o) => o.isCash).reduce((a, o) => a + o.customerPaid, 0)),
        restaurantShare: sum(orders, 'restaurantShare'),
        riderShare: sum(orders, 'riderShare'),
        franchiseGross: sum(orders, 'franchiseGross'),
        hqShare: sum(orders, 'hqShare'),
        franchiseEarning: round2(sum(orders, 'franchiseGross') - sum(orders, 'hqShare')),
        net: sum(orders, 'net')
    };
}

const loadFranchise = async (franchiseId) => {
    const franchise = await FoodFranchise.findById(toId(franchiseId, 'franchise id')).lean();
    if (!franchise) throw new NotFoundError('Franchise not found');
    return franchise;
};

/**
 * Live money position between HQ and the franchise, as if everything were settled now.
 * balance > 0: HQ owes the franchise. balance < 0: the franchise owes HQ.
 */
export async function getFranchiseBalance(franchiseId, { now = new Date() } = {}) {
    const franchise = await loadFranchise(franchiseId);
    const [orders, deposits, adjustments, { openingBalance }] = await Promise.all([
        loadUnsettledOrders(franchise._id, now),
        loadUnsettledRiderDeposits(franchise, now),
        loadPendingAdjustments(franchise._id, now),
        getOpeningBalance(franchise._id)
    ]);
    const holdCutoff = new Date(now.getTime() - num(franchise.finance?.holdbackDays ?? 7) * DAY_MS);
    const [readyOrders, pendingRequests] = await Promise.all([
        loadUnsettledOrders(franchise._id, holdCutoff),
        FoodFranchiseWithdrawal.find({ franchiseId: franchise._id, status: 'pending' }).select('amount').lean()
    ]);
    const ordersSummary = summarizeOrders(orders);
    const riderCashDeposited = sum(deposits, 'amount');
    const adjustmentsTotal = sum(adjustments, 'amount');
    const balance = round2(ordersSummary.net + riderCashDeposited + adjustmentsTotal + openingBalance);
    const pendingWithdrawals = sum(pendingRequests, 'amount');
    // Orders still inside the holdback (refund window) cannot be withdrawn yet.
    const readyBalance = round2(sum(readyOrders, 'net') + riderCashDeposited + adjustmentsTotal + openingBalance);
    // Orders inside the holdback: what they add to the balance and when the first of them unlocks.
    const holdbackDays = num(franchise.finance?.holdbackDays ?? 7);
    const readyIds = new Set(readyOrders.map((o) => String(o._id)));
    const heldOrders = orders.filter((o) => !readyIds.has(String(o._id)));
    const firstHeld = heldOrders.reduce((min, o) => (o.deliveredAt && (!min || o.deliveredAt < min) ? o.deliveredAt : min), null);
    return {
        balance,
        dues: round2(Math.max(0, -balance)),
        openingBalance: round2(openingBalance),
        unsettledOrders: ordersSummary,
        readyToSettleOrders: readyOrders.length,
        riderCashDeposited,
        pendingAdjustments: adjustmentsTotal,
        pendingWithdrawals,
        availableToWithdraw: round2(Math.max(0, Math.min(readyBalance, balance) - pendingWithdrawals)),
        holdbackDays,
        onHold: {
            count: heldOrders.length,
            net: sum(heldOrders, 'net'),
            nextReleaseAt: firstHeld ? new Date(new Date(firstHeld).getTime() + holdbackDays * DAY_MS) : null
        },
        creditLimit: num(franchise.finance?.creditLimit ?? 10000)
    };
}

// ----- Franchise withdrawal requests (franchise asks, HQ approves) -----

export async function requestFranchiseWithdrawal(franchiseId, { amount, note = '' }) {
    const franchise = await loadFranchise(franchiseId);
    const value = round2(amount);
    if (!(value >= 1)) throw new ValidationError('Enter an amount of at least ₹1');
    const lockName = `franchise-withdrawal:${franchise._id}`;
    if (!(await acquireJobLock(lockName, 30 * 1000))) throw new ValidationError('Another request is being saved. Try again.');
    try {
        const { availableToWithdraw } = await getFranchiseBalance(franchise._id);
        if (value > availableToWithdraw + EPSILON) {
            throw new ValidationError(`You can withdraw up to ₹${availableToWithdraw} right now`);
        }
        const created = await FoodFranchiseWithdrawal.create({
            franchiseId: franchise._id,
            amount: value,
            note: String(note || '').trim(),
            bank: franchise.bank || {}
        });
        return created.toObject();
    } finally {
        await releaseJobLock(lockName);
    }
}

export async function listFranchiseWithdrawalRequests({ franchiseId, status, limit = 200 } = {}) {
    const filter = {};
    if (franchiseId) filter.franchiseId = toId(franchiseId, 'franchise id');
    if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    return FoodFranchiseWithdrawal.find(filter)
        .populate({ path: 'franchiseId', select: 'name code zoneId', populate: { path: 'zoneId', select: 'name' } })
        .sort({ createdAt: -1 })
        .limit(Math.min(500, Number(limit) || 200))
        .lean();
}

const adminRef = (adminId) => (adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null);

/** HQ paid the request: records the payout against the franchise balance, exactly once. */
export async function approveFranchiseWithdrawal(withdrawalId, { utr, adminId = null }) {
    if (!String(utr || '').trim()) throw new ValidationError('Enter the UTR / transaction reference of the payment');
    const updated = await FoodFranchiseWithdrawal.findOneAndUpdate(
        { _id: toId(withdrawalId, 'withdrawal id'), status: 'pending' },
        { $set: { status: 'approved', utr: String(utr).trim(), processedAt: new Date(), processedBy: adminRef(adminId) } },
        { new: true }
    ).lean();
    if (!updated) throw new ValidationError('Only a pending request can be approved');
    try {
        await FoodFranchiseAdjustment.create({
            franchiseId: updated.franchiseId,
            type: 'WITHDRAWAL_PAID',
            amount: -round2(updated.amount),
            note: 'Withdrawal paid by HQ',
            utr: updated.utr,
            ref: `FWD:${updated._id}`,
            createdBy: { role: 'HQ', id: updated.processedBy }
        });
    } catch (err) {
        if (err?.code !== 11000) throw err;
    }
    return updated;
}

export async function rejectFranchiseWithdrawal(withdrawalId, { reason, adminId = null }) {
    if (!String(reason || '').trim()) throw new ValidationError('Enter a reason for rejecting');
    const updated = await FoodFranchiseWithdrawal.findOneAndUpdate(
        { _id: toId(withdrawalId, 'withdrawal id'), status: 'pending' },
        { $set: { status: 'rejected', rejectionReason: String(reason).trim(), processedAt: new Date(), processedBy: adminRef(adminId) } },
        { new: true }
    ).lean();
    if (!updated) throw new ValidationError('Only a pending request can be rejected');
    return updated;
}

// ----- Payouts the franchise owes its restaurants and riders -----

async function ownerIdsInZone(kind, zoneId) {
    const { OwnerModel } = WITHDRAWAL_MODELS[kind];
    return OwnerModel.distinct('_id', { zoneId });
}

export async function listFranchiseWithdrawals(franchiseId, { kind = 'restaurant', status = 'pending', overdueOnly = false, now = new Date() } = {}) {
    const franchise = await loadFranchise(franchiseId);
    const cfg = WITHDRAWAL_MODELS[kind];
    if (!cfg) throw new ValidationError('kind must be restaurant or rider');
    const ownerIds = await ownerIdsInZone(kind, franchise.zoneId);
    const filter = { [cfg.ownerField]: { $in: ownerIds }, createdAt: { $gte: franchise.startDate || new Date(0) } };
    if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    const slaMs = num(franchise.finance?.payoutSlaDays ?? 3) * DAY_MS;
    if (overdueOnly) {
        filter.status = 'pending';
        filter.createdAt.$lte = new Date(now.getTime() - slaMs);
    }
    const populate = kind === 'restaurant'
        ? { path: 'restaurantId', select: 'restaurantName ownerPhone accountHolderName accountNumber ifscCode upiId' }
        : { path: 'deliveryPartnerId', select: 'name phone bankAccountHolderName bankAccountNumber bankIfscCode upiId' };
    const rows = await cfg.Model.find(filter).sort({ createdAt: -1 }).limit(500).populate(populate).lean();
    return rows.map((w) => ({
        ...w,
        kind,
        isOverdue: w.status === 'pending' && now.getTime() - new Date(w.createdAt).getTime() > slaMs
    }));
}

async function assertWithdrawalInZone(kind, withdrawalId, zoneId) {
    const cfg = WITHDRAWAL_MODELS[kind];
    if (!cfg) throw new ValidationError('kind must be restaurant or rider');
    const withdrawal = await cfg.Model.findById(toId(withdrawalId, 'withdrawal id')).lean();
    if (!withdrawal) throw new NotFoundError('Withdrawal request not found');
    const owner = await cfg.OwnerModel.findById(withdrawal[cfg.ownerField]).select('zoneId').lean();
    if (!owner || String(owner.zoneId) !== String(zoneId)) throw new NotFoundError('Withdrawal request not found');
    return withdrawal;
}

/** The franchise paid its restaurant / rider (outside the app) and records the reference. */
export async function franchisePayWithdrawal(franchiseId, kind, withdrawalId, { utr = '', note = '' } = {}) {
    const franchise = await loadFranchise(franchiseId);
    if (!String(utr).trim()) throw new ValidationError('Enter the UTR / transaction reference of the payment');
    await assertWithdrawalInZone(kind, withdrawalId, franchise.zoneId);
    const { withdrawal } = await transitionWithdrawal(WITHDRAWAL_MODELS[kind].Model, withdrawalId, 'approved', {
        transactionId: String(utr).trim(),
        adminNote: note || 'Paid by franchise',
        paidBy: 'FRANCHISE',
        franchiseId: franchise._id
    });
    return withdrawal;
}

export async function franchiseRejectWithdrawal(franchiseId, kind, withdrawalId, { reason = '' } = {}) {
    const franchise = await loadFranchise(franchiseId);
    if (!String(reason).trim()) throw new ValidationError('Enter a reason for rejecting');
    await assertWithdrawalInZone(kind, withdrawalId, franchise.zoneId);
    const { withdrawal } = await transitionWithdrawal(WITHDRAWAL_MODELS[kind].Model, withdrawalId, 'rejected', {
        rejectionReason: String(reason).trim(),
        franchiseId: franchise._id
    });
    return withdrawal;
}

/**
 * HQ paid a franchise-zone restaurant / rider itself (franchise missed the SLA, or HQ approved it
 * from the regular payout screens). The amount is charged to the franchise in its next settlement.
 * Safe to call more than once for the same withdrawal.
 */
export async function recordHqPaidWithdrawal(kind, withdrawalId, { adminId = null } = {}) {
    const cfg = WITHDRAWAL_MODELS[kind];
    if (!cfg) return null;
    // Approved from the admin panel by the franchise owner itself: the franchise paid, nothing to charge.
    const scope = getFranchiseScope();
    if (scope) {
        await cfg.Model.updateOne({ _id: withdrawalId, status: 'approved' }, { $set: { paidBy: 'FRANCHISE', franchiseId: scope.franchiseId } });
        return null;
    }
    const withdrawal = await cfg.Model.findById(withdrawalId).lean();
    if (!withdrawal || withdrawal.status !== 'approved' || withdrawal.paidBy === 'FRANCHISE') return null;
    const owner = await cfg.OwnerModel.findById(withdrawal[cfg.ownerField]).select('zoneId').lean();
    if (!owner?.zoneId) return null;
    const franchise = await FoodFranchise.findOne({ zoneId: owner.zoneId, isTerminated: false }).select('_id startDate').lean();
    if (!franchise || new Date(withdrawal.createdAt) < new Date(franchise.startDate || 0)) return null;

    await cfg.Model.updateOne({ _id: withdrawal._id }, { $set: { paidBy: 'HQ', franchiseId: franchise._id } });
    try {
        return await FoodFranchiseAdjustment.create({
            franchiseId: franchise._id,
            type: 'HQ_PAID_PAYOUT',
            amount: -round2(withdrawal.amount),
            note: `HQ paid ${kind} withdrawal of ₹${round2(withdrawal.amount)} on your behalf`,
            ref: `WD:${kind}:${withdrawal._id}`,
            utr: withdrawal.transactionId || '',
            createdBy: { role: 'HQ', id: adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null }
        });
    } catch (err) {
        if (err?.code === 11000) return null; // already charged
        throw err;
    }
}

/** HQ steps in and pays a franchise-zone withdrawal directly. */
export async function hqPayWithdrawal(franchiseId, kind, withdrawalId, { utr = '', adminId = null } = {}) {
    const franchise = await loadFranchise(franchiseId);
    if (!String(utr).trim()) throw new ValidationError('Enter the UTR / transaction reference of the payment');
    await assertWithdrawalInZone(kind, withdrawalId, franchise.zoneId);
    const { withdrawal } = await transitionWithdrawal(WITHDRAWAL_MODELS[kind].Model, withdrawalId, 'approved', {
        transactionId: String(utr).trim(),
        adminNote: 'Paid by HQ on behalf of franchise'
    });
    await recordHqPaidWithdrawal(kind, withdrawal._id, { adminId });
    return WITHDRAWAL_MODELS[kind].Model.findById(withdrawal._id).lean();
}

async function countOverduePayouts(franchise, now) {
    const [r, d] = await Promise.all([
        listFranchiseWithdrawals(franchise._id, { kind: 'restaurant', overdueOnly: true, now }),
        listFranchiseWithdrawals(franchise._id, { kind: 'rider', overdueOnly: true, now })
    ]);
    return r.length + d.length;
}

// ----- Adjustments -----

export async function addAdjustment(franchiseId, { type, amount, note = '', utr = '', ref, actor = {} }) {
    const franchise = await loadFranchise(franchiseId);
    const value = round2(amount);
    if (!Number.isFinite(value) || Math.abs(value) < 0.01) throw new ValidationError('Amount must be a non-zero number');
    if (type === 'PAYMENT_RECEIVED' && value < 0) throw new ValidationError('A payment received must be a positive amount');
    if (!String(note).trim() && type === 'MANUAL') throw new ValidationError('Add a note explaining this adjustment');
    return FoodFranchiseAdjustment.create({
        franchiseId: franchise._id,
        type,
        amount: value,
        note: String(note).trim(),
        utr: String(utr || '').trim(),
        ref,
        createdBy: { role: actor.role || 'HQ', id: actor.id && mongoose.Types.ObjectId.isValid(String(actor.id)) ? actor.id : null }
    });
}

export async function listAdjustments(franchiseId, { limit = 100 } = {}) {
    return FoodFranchiseAdjustment.find({ franchiseId: toId(franchiseId, 'franchise id') })
        .sort({ createdAt: -1 })
        .limit(Math.min(500, Number(limit) || 100))
        .lean();
}

// ----- Settlements -----

/**
 * Settles everything unsettled for one franchise: delivered orders older than the holdback,
 * rider cash that reached HQ, and pending adjustments, plus any balance carried from last time.
 * Returns null when there is nothing new to settle.
 */
export async function runSettlement(franchiseId, { now = new Date(), final = false, actor = {} } = {}) {
    const franchise = await loadFranchise(franchiseId);
    const lockName = `franchise-settlement:${franchise._id}`;
    if (!(await acquireJobLock(lockName, 5 * 60 * 1000))) {
        throw new ValidationError('A settlement for this franchise is already running. Try again in a minute.');
    }
    try {
        const holdbackMs = final ? 0 : num(franchise.finance?.holdbackDays ?? 7) * DAY_MS;
        const cutoff = new Date(now.getTime() - holdbackMs);
        const [orders, deposits, adjustments, { lastNumber, openingBalance }] = await Promise.all([
            loadUnsettledOrders(franchise._id, cutoff),
            loadUnsettledRiderDeposits(franchise, now),
            loadPendingAdjustments(franchise._id, now),
            getOpeningBalance(franchise._id)
        ]);
        if (!orders.length && !deposits.length && !adjustments.length) return null;

        const ordersSummary = summarizeOrders(orders);
        const riderCashDeposited = sum(deposits, 'amount');
        const adjustmentsTotal = sum(adjustments, 'amount');
        const netPayable = round2(ordersSummary.net + riderCashDeposited + adjustmentsTotal + openingBalance);
        const status = netPayable > EPSILON ? 'payout_pending' : netPayable < -EPSILON ? 'carried_forward' : 'zero';
        const overduePayouts = await countOverduePayouts(franchise, now);

        return await withTransaction(async (session) => {
            const [settlement] = await FoodFranchiseSettlement.create([{
                franchiseId: franchise._id,
                number: lastNumber + 1,
                cutoffAt: cutoff,
                orders: ordersSummary,
                riderCashDeposited,
                adjustmentsTotal,
                openingBalance: round2(openingBalance),
                netPayable,
                status,
                overduePayouts,
                createdBy: { role: actor.role || 'SYSTEM', id: actor.id && mongoose.Types.ObjectId.isValid(String(actor.id)) ? actor.id : null }
            }], sessionOpts(session));
            const stamp = { $set: { franchiseSettlementId: settlement._id } };
            await Promise.all([
                orders.length && FoodOrder.updateMany({ _id: { $in: orders.map((o) => o._id) }, franchiseSettlementId: null }, stamp, sessionOpts(session)),
                deposits.length && FoodDeliveryCashDeposit.updateMany({ _id: { $in: deposits.map((d) => d._id) }, franchiseSettlementId: null }, stamp, sessionOpts(session)),
                adjustments.length && FoodFranchiseAdjustment.updateMany({ _id: { $in: adjustments.map((a) => a._id) }, settlementId: null }, { $set: { settlementId: settlement._id } }, sessionOpts(session))
            ]);
            return settlement.toObject();
        });
    } finally {
        await releaseJobLock(lockName);
    }
}

export async function listSettlements(franchiseId, { limit = 52 } = {}) {
    return FoodFranchiseSettlement.find({ franchiseId: toId(franchiseId, 'franchise id') })
        .sort({ number: -1 })
        .limit(Math.min(200, Number(limit) || 52))
        .lean();
}

/** HQ paid the franchise for a settlement. Blocked while the franchise has overdue payouts unless forced. */
export async function markSettlementPaid(franchiseId, settlementId, { utr = '', adminId = null, force = false, now = new Date() } = {}) {
    const franchise = await loadFranchise(franchiseId);
    if (!String(utr).trim()) throw new ValidationError('Enter the UTR / transaction reference of the payment');
    if (!force) {
        const overdue = await countOverduePayouts(franchise, now);
        if (overdue > 0) {
            throw new ValidationError(`This franchise has ${overdue} overdue restaurant / rider payout(s). Pay them first, or confirm to pay anyway.`);
        }
    }
    const updated = await FoodFranchiseSettlement.findOneAndUpdate(
        { _id: toId(settlementId, 'settlement id'), franchiseId: franchise._id, status: 'payout_pending' },
        { $set: { status: 'paid', paidAt: now, utr: String(utr).trim(), paidBy: adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null } },
        { new: true }
    ).lean();
    if (!updated) throw new ValidationError('Only a settlement waiting for payout can be marked as paid');
    return updated;
}

// ----- Subscription billing and dues automation -----

export const addPeriod = (date, plan) => {
    const d = new Date(date);
    if (plan === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
};

const periodRef = (start) => `SUB:${new Date(start).toISOString().slice(0, 10)}`;

/** Charges one subscription period (idempotent per period start). */
export async function chargeSubscriptionPeriod(franchise, periodStart, periodEnd) {
    const amount = round2(franchise.subscription?.amount);
    if (!(amount > 0)) return null;
    try {
        return await FoodFranchiseAdjustment.create({
            franchiseId: franchise._id,
            type: 'SUBSCRIPTION_FEE',
            amount: -amount,
            note: `${franchise.subscription?.plan === 'YEARLY' ? 'Yearly' : 'Monthly'} subscription ${new Date(periodStart).toISOString().slice(0, 10)} to ${new Date(periodEnd).toISOString().slice(0, 10)}`,
            ref: periodRef(periodStart),
            createdBy: { role: 'SYSTEM', id: null }
        });
    } catch (err) {
        if (err?.code === 11000) return null;
        throw err;
    }
}

/** Renews subscriptions whose period ended. Catches up on missed periods one at a time. */
export async function renewSubscriptions({ now = new Date() } = {}) {
    const due = await FoodFranchise.find({
        revenueModel: 'SUBSCRIPTION',
        status: { $in: ['active', 'grace'] },
        'subscription.autoRenew': { $ne: false },
        'subscription.endDate': { $ne: null, $lte: now }
    });
    let charged = 0;
    for (const franchise of due) {
        let guard = 0;
        while (franchise.subscription.endDate && franchise.subscription.endDate <= now && guard < 36) {
            const start = franchise.subscription.endDate;
            const end = addPeriod(start, franchise.subscription.plan);
            // eslint-disable-next-line no-await-in-loop
            if (await chargeSubscriptionPeriod(franchise, start, end)) charged += 1;
            franchise.subscription.startDate = start;
            franchise.subscription.endDate = end;
            guard += 1;
        }
        // eslint-disable-next-line no-await-in-loop
        await franchise.save();
    }
    return { franchises: due.length, charged };
}

/**
 * Moves franchises between active / grace / suspended based on what they owe.
 * Owes more than the credit limit -> grace; still owing after the grace days -> suspended.
 * Paid back within the limit -> active again. Statuses set by HQ by hand are left alone.
 */
export async function applyDuesStatus({ now = new Date() } = {}) {
    const franchises = await FoodFranchise.find({ status: { $in: ['active', 'grace', 'suspended'] } });
    const changes = [];
    for (const franchise of franchises) {
        // eslint-disable-next-line no-await-in-loop
        const { dues } = await getFranchiseBalance(franchise._id, { now });
        const limit = num(franchise.finance?.creditLimit ?? 10000);
        const over = dues > limit + EPSILON;
        const systemOwned = franchise.statusSource === 'SYSTEM';
        let next = null;
        if (franchise.status === 'active' && over) next = 'grace';
        else if (franchise.status === 'grace' && systemOwned && !over) next = 'active';
        else if (franchise.status === 'grace' && systemOwned && over) {
            const started = franchise.graceStartedAt ? new Date(franchise.graceStartedAt).getTime() : now.getTime();
            if (now.getTime() - started >= num(franchise.finance?.graceDays ?? 7) * DAY_MS) next = 'suspended';
        } else if (franchise.status === 'suspended' && systemOwned && !over) next = 'active';
        if (!next) continue;

        franchise.status = next;
        franchise.statusSource = 'SYSTEM';
        franchise.graceStartedAt = next === 'grace' ? now : next === 'active' ? null : franchise.graceStartedAt;
        franchise.statusReason = next === 'active' ? '' : `Dues of ₹${dues} are above the credit limit of ₹${limit}`;
        // eslint-disable-next-line no-await-in-loop
        await franchise.save();
        changes.push({ franchiseId: String(franchise._id), status: next, dues });
    }
    return changes;
}

/** Weekly settlement for every live franchise whose last settlement is at least 7 days old. */
export async function runDueSettlements({ now = new Date(), everyDays = 7 } = {}) {
    const franchises = await FoodFranchise.find({ isTerminated: false }).select('_id startDate').lean();
    const results = [];
    for (const f of franchises) {
        // eslint-disable-next-line no-await-in-loop
        const last = await FoodFranchiseSettlement.findOne({ franchiseId: f._id }).sort({ number: -1 }).select('createdAt').lean();
        const since = last?.createdAt || f.startDate || new Date(0);
        if (now.getTime() - new Date(since).getTime() < everyDays * DAY_MS) continue;
        try {
            // eslint-disable-next-line no-await-in-loop
            const s = await runSettlement(f._id, { now });
            if (s) results.push({ franchiseId: String(f._id), settlementId: String(s._id), netPayable: s.netPayable });
        } catch (err) {
            logger.error(`[Franchise] settlement failed for ${f._id}: ${err.message}`);
        }
    }
    return results;
}

/** One scheduler tick: renew subscriptions, then update statuses from dues. */
export async function runFranchiseBillingTick({ now = new Date() } = {}) {
    const lockName = 'franchise-billing-tick';
    if (!(await acquireJobLock(lockName, 10 * 60 * 1000))) return { skipped: true };
    try {
        // Franchises are paid through withdrawal requests that HQ approves, not automatic settlements.
        const renewals = await renewSubscriptions({ now });
        const statusChanges = await applyDuesStatus({ now });
        return { renewals, statusChanges };
    } finally {
        await releaseJobLock(lockName);
    }
}
