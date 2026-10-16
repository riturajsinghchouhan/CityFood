import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodRestaurantCommission } from '../../admin/models/restaurantCommission.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import mongoose from 'mongoose';
import { round2 } from '../../../../utils/money.js';
import { sessionOpts } from '../../../../utils/dbTransaction.js';
import * as financeService from './finance.service.js';

const RESTAURANT_COMMISSION_CACHE_MS = 60 * 1000;
let restaurantCommissionRulesCache = null;
let restaurantCommissionRulesLoadedAt = 0;

async function getActiveRestaurantCommissionRules() {
    const now = Date.now();
    if (
        restaurantCommissionRulesCache &&
        now - restaurantCommissionRulesLoadedAt < RESTAURANT_COMMISSION_CACHE_MS
    ) {
        return restaurantCommissionRulesCache;
    }

    const list = await FoodRestaurantCommission.find({
        status: { $ne: false },
    }).lean();
    restaurantCommissionRulesCache = list || [];
    restaurantCommissionRulesLoadedAt = now;
    return restaurantCommissionRulesCache;
}

export function computeRestaurantCommissionAmount(baseAmount, rule) {
    const safeBase = Math.max(0, Number(baseAmount) || 0);
    if (!Number.isFinite(safeBase) || safeBase < 0) return 0;

    const commissionType = rule?.defaultCommission?.type || 'percentage';
    const commissionValue = Math.max(
        0,
        Number(rule?.defaultCommission?.value ?? 0) || 0
    );

    let commissionAmount = 0;
    if (commissionType === 'percentage') {
        commissionAmount = safeBase * (commissionValue / 100);
    } else if (commissionType === 'amount') {
        commissionAmount = commissionValue;
    }

    // Round to 2 decimals and clamp to [0, base]
    commissionAmount = round2(commissionAmount || 0);
    commissionAmount = Math.max(0, Math.min(commissionAmount, safeBase));

    return { commissionAmount, commissionType, commissionValue, baseAmount: safeBase };
}

export async function getRestaurantCommissionSnapshot(orderDoc) {
    const baseAmount = Number(orderDoc?.pricing?.subtotal ?? 0) || 0;
    const restaurantIdRaw =
        orderDoc?.restaurantId?._id ?? orderDoc?.restaurantId ?? null;

    if (!restaurantIdRaw) {
        return {
            commissionAmount: 0,
            commissionType: 'percentage',
            commissionValue: 0,
            baseAmount,
            gstOnItem: 0,
            gstOnCommission: 0,
            paymentGatewayFee: 0,
            tcs: 0,
        };
    }

    const rules = await getActiveRestaurantCommissionRules();
    let rule =
        rules.find((r) => String(r.restaurantId) === String(restaurantIdRaw)) ||
        // Fallback: accept legacy docs where restaurantId may be stored under `restaurant` / `restaurant_id`
        rules.find((r) => String(r.restaurant || r.restaurant_id || '') === String(restaurantIdRaw)) ||
        null;

    if (!rule) {
        // If no specific rule, try to use global default
        const globalSettings = await FoodFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean() || {};
        if (globalSettings.globalRestaurantCommission > 0) {
            rule = {
                defaultCommission: {
                    type: 'percentage',
                    value: globalSettings.globalRestaurantCommission
                }
            };
        }
    }

    const result = rule ? computeRestaurantCommissionAmount(baseAmount, rule) : {
        commissionAmount: 0,
        commissionType: 'percentage',
        commissionValue: 0,
        baseAmount,
    };

    const globalSettings = await FoodFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean() || {};

    const applyTaxes = globalSettings.applyGlobalTaxes !== false;

    const gstOnItemRate = applyTaxes ? (Number(globalSettings.globalGstOnItem) || 0) : 0;
    const gstOnCommission = applyTaxes ? (Number(globalSettings.globalGstOnCommission) || 0) : 0;
    const pgFee = applyTaxes ? (Number(globalSettings.globalPaymentGatewayFee) || 0) : 0;
    const tcs = applyTaxes ? (Number(globalSettings.globalTcs) || 0) : 0;

    const totalPaid = Number(orderDoc?.pricing?.total) || 0;

    result.gstOnItem = round2(baseAmount * (gstOnItemRate / 100));
    result.gstOnCommission = round2(result.commissionAmount * (gstOnCommission / 100));
    result.paymentGatewayFee = round2(totalPaid * (pgFee / 100));
    result.tcs = round2(baseAmount * (tcs / 100));

    return result;
}

/**
 * Creates the initial transaction when an order is created.
 * Idempotent per order (unique orderId): calling it twice returns the existing row.
 * Pass { session } to make it part of the order-creation transaction.
 */
export async function createInitialTransaction(order, { session = null } = {}) {
    const alreadyThere = await FoodTransaction.findOne({ orderId: order._id }).session(session || null);
    if (alreadyThere) return alreadyThere;

    const commissionSnapshot = await getRestaurantCommissionSnapshot(order);

    // Split logic
    const totalCustomerPaid = order.pricing?.total || 0;
    const riderShare = order.riderEarning || 0;

    const restaurantCommissionFromOrder = Number(order.pricing?.restaurantCommission);
    const restaurantCommission =
        Number.isFinite(restaurantCommissionFromOrder) && restaurantCommissionFromOrder > 0
            ? restaurantCommissionFromOrder
            : (commissionSnapshot.commissionAmount || 0);

    const gstOnItemFromOrder = Number(order.pricing?.gstOnItem);
    const gstOnItem = Number.isFinite(gstOnItemFromOrder)
        ? gstOnItemFromOrder
        : (commissionSnapshot.gstOnItem || 0);

    const gstOnCommission = commissionSnapshot.gstOnCommission || 0;
    const paymentGatewayFee = commissionSnapshot.paymentGatewayFee || 0;
    const tcs = commissionSnapshot.tcs || 0;

    const restaurantNet = (order.pricing?.subtotal || 0) + (order.pricing?.packagingFee || 0) - restaurantCommission - gstOnItem - gstOnCommission - paymentGatewayFee - tcs;

    const calculatedPlatformNetProfit = (order.pricing?.platformFee || 0) + (order.pricing?.deliveryFee || 0) + restaurantCommission + gstOnItem + paymentGatewayFee + tcs - riderShare;
    const platformNetProfit = order.platformProfit !== undefined
        ? order.platformProfit
        : Math.max(0, calculatedPlatformNetProfit);

    const transaction = new FoodTransaction({
        orderId: order._id,

        userId: order.userId,
        restaurantId: order.restaurantId,
        deliveryPartnerId: order.dispatch?.deliveryPartnerId,
        paymentMethod: order.payment?.method || 'cash',
        status: order.payment?.status === 'paid' ? 'captured' : 'pending',
        payment: {
            method: String(order.payment?.method || 'cash'),
            status: String(order.payment?.status || 'cod_pending'),
            amountDue: Number(order.payment?.amountDue ?? order.pricing?.total ?? 0) || 0,
            razorpay: {
                orderId: String(order.payment?.razorpay?.orderId || ''),
                paymentId: String(order.payment?.razorpay?.paymentId || ''),
                signature: String(order.payment?.razorpay?.signature || ''),
            },
            qr: {
                qrId: String(order.payment?.qr?.qrId || ''),
                imageUrl: String(order.payment?.qr?.imageUrl || ''),
                amount: Number(order.payment?.qr?.amount || 0),
                paymentLinkId: String(order.payment?.qr?.paymentLinkId || ''),
                shortUrl: String(order.payment?.qr?.shortUrl || ''),
                status: String(order.payment?.qr?.status || ''),
                expiresAt: order.payment?.qr?.expiresAt || null,
            }
        },
        pricing: {
            subtotal: Number(order.pricing?.subtotal || 0) || 0,
            tax: Number(order.pricing?.tax || 0) || 0,
            packagingFee: Number(order.pricing?.packagingFee || 0) || 0,
            deliveryFee: Number(order.pricing?.deliveryFee || 0) || 0,
            platformFee: Number(order.pricing?.platformFee || 0) || 0,
            restaurantCommission,
            discount: Number(order.pricing?.discount || 0) || 0,
            total: Number(order.pricing?.total || 0) || 0,
            currency: String(order.pricing?.currency || order.currency || 'INR'),
        },
        amounts: {
            totalCustomerPaid,
            restaurantShare: Math.max(0, restaurantNet),
            restaurantCommission,
            gstOnItem,
            gstOnCommission,
            paymentGatewayFee,
            tcs,
            riderShare,
            platformNetProfit,
            taxAmount: order.pricing?.tax || 0
        },
        gateway: {
            razorpayOrderId: order.payment?.razorpay?.orderId,
            qrUrl: order.payment?.qr?.imageUrl
        },
        history: [{
            kind: 'created',
            amount: totalCustomerPaid,
            note: 'Initial transaction created with order'
        }]
    });

    try {
        await transaction.save(sessionOpts(session));
    } catch (err) {
        // Concurrent creation lost the race on the unique orderId index
        if (err?.code === 11000 && !session) {
            const winner = await FoodTransaction.findOne({ orderId: order._id });
            if (winner) return winner;
        }
        throw err;
    }

    // Link back to the order (same transaction when one is open, so both exist or neither does)
    await mongoose.model('FoodOrder').updateOne(
        { _id: order._id },
        { $set: { transactionId: transaction._id } },
        sessionOpts(session)
    );

    return transaction;
}

/**
 * Appends an audit entry to a transaction's history. HISTORY ONLY.
 *
 * Payment state (status, payment.status, method, refund) is owned by finance.service.js —
 * passing `status` or `paymentMethod` here is a programming error and throws.
 */
export async function updateTransactionStatus(orderId, kind, details = {}) {
    if (details.status || details.paymentMethod || details.razorpayPaymentId || details.razorpaySignature) {
        throw new Error('updateTransactionStatus is history-only. Use finance.service (capturePayment / refundOrder / settleCancellation) to change payment state.');
    }
    const res = await financeService.recordHistory(orderId, kind, {
        note: details.note || `Transaction updated: ${kind}`,
        actor: { role: details.recordedByRole || 'SYSTEM', id: details.recordedById }
    });
    return res.applied ? FoodTransaction.findOne({ orderId }) : null;
}

/**
 * Updates the rider in the transaction when an order is accepted.
 */
export async function updateTransactionRider(orderId, riderId) {
    const query = { orderId };
    return await FoodTransaction.findOneAndUpdate(
        query,
        { $set: { deliveryPartnerId: riderId } },
        { new: true }
    );
}

/**
 * Marks restaurant as settled in the finance record (captured payments only, idempotent).
 */
export async function settleRestaurant(orderId, adminId) {
    return financeService.markRestaurantSettled(orderId, adminId);
}
