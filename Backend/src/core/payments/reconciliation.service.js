import { Transaction } from './models/transaction.model.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { FoodOrder } from '../../modules/food/orders/models/order.model.js';
import { FoodTransaction } from '../../modules/food/orders/models/foodTransaction.model.js';
import * as financeService from '../../modules/food/orders/services/finance.service.js';
import { getRazorpayInstance, isRazorpayConfigured } from '../../modules/food/orders/helpers/razorpay.helper.js';
import { round2, fromPaise, toPaise } from '../../utils/money.js';

/**
 * Reconciliation — proves wallets and the ledger agree.
 * For each wallet: balance must equal (sum of completed credits) - (sum of completed debits)
 * in payment_transactions. Anything else means money moved outside the ledger (or a crash
 * happened between the balance update and the ledger write).
 */

const EPSILON = 0.005;

const WALLETS = [
    { entityType: 'user', Model: FoodUserWallet, idOf: (w) => String(w.userId) }
];

/** Net ledger balance per entity: { entityId -> { net, count } } */
async function ledgerTotals(entityType) {
    const rows = await Transaction.aggregate([
        { $match: { entityType, status: 'completed' } },
        {
            $group: {
                _id: '$entityId',
                net: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amountPaise', { $multiply: ['$amountPaise', -1] }] } },
                count: { $sum: 1 }
            }
        }
    ]);
    return new Map(rows.map((r) => [String(r._id), { net: fromPaise(r.net), count: r.count }]));
}

export function compareWalletToLedger({ entityType, entityId, walletBalance = 0, ledgerBalance = 0, ledgerTransactionCount = 0 }) {
    const wallet = round2(walletBalance);
    const ledger = round2(ledgerBalance);
    const delta = round2(wallet - ledger);
    return {
        entityType,
        entityId: String(entityId || ''),
        walletBalance: wallet,
        ledgerBalance: ledger,
        delta,
        ledgerTransactionCount: Number(ledgerTransactionCount) || 0,
        hasMismatch: Math.abs(delta) > EPSILON
    };
}

/**
 * Compare every wallet with the ledger.
 * @param {Object} [opts]
 * @param {string} [opts.entityType] limit to one entity type
 * @param {number} [opts.maxMismatches=200] cap on mismatches returned
 */
export async function reconcileWallets({ entityType, maxMismatches = 200 } = {}) {
    const targets = WALLETS.filter((w) => !entityType || w.entityType === entityType);
    const mismatches = [];
    const byType = {};
    let checked = 0;
    let mismatched = 0;

    for (const { entityType: type, Model, idOf } of targets) {
        const [wallets, totals] = await Promise.all([Model.find().select('-__v').lean(), ledgerTotals(type)]);
        const seen = new Set();
        byType[type] = { wallets: wallets.length, mismatched: 0 };

        for (const wallet of wallets) {
            const entityId = idOf(wallet);
            seen.add(entityId);
            const ledger = totals.get(entityId) || { net: 0, count: 0 };
            const result = compareWalletToLedger({
                entityType: type,
                entityId,
                walletBalance: fromPaise(wallet.balancePaise),
                ledgerBalance: ledger.net,
                ledgerTransactionCount: ledger.count
            });
            checked += 1;
            if (result.hasMismatch) {
                mismatched += 1;
                byType[type].mismatched += 1;
                if (mismatches.length < maxMismatches) mismatches.push(result);
            }
        }

        // Ledger activity for an entity that has no wallet document at all
        for (const [entityId, ledger] of totals) {
            if (seen.has(entityId) || Math.abs(ledger.net) <= EPSILON) continue;
            checked += 1;
            mismatched += 1;
            byType[type].mismatched += 1;
            if (mismatches.length < maxMismatches) {
                mismatches.push(
                    compareWalletToLedger({
                        entityType: type,
                        entityId,
                        walletBalance: 0,
                        ledgerBalance: ledger.net,
                        ledgerTransactionCount: ledger.count
                    })
                );
            }
        }
    }

    return { checkedAt: new Date().toISOString(), checked, mismatched, byType, mismatches };
}

// =======================================================================================
// Order <-> transaction <-> ledger <-> gateway reconciliation
// =======================================================================================

const CANCELLED = ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin', 'dead'];
const STUCK_REFUND_MINUTES = 15;
const GATEWAY_PENDING_MINUTES = 10;

const issue = (type, severity, orderId, detail, extra = {}) => ({ type, severity, orderId: String(orderId || ''), detail, ...extra });

/**
 * Finds payment inconsistencies. Read-only except for the optional gateway check, which only
 * READS from Razorpay. Use repairOrder() to fix what it reports.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=500] max rows examined per check
 * @param {boolean} [opts.checkGateway=false] also ask Razorpay about old unpaid online orders
 * @param {number} [opts.minAgeMinutes=0] ignore records touched more recently than this (in-flight payments)
 */
export async function reconcileOrders({ limit = 500, checkGateway = false, minAgeMinutes = 0 } = {}) {
  const issues = [];
  const settledBefore = new Date(Date.now() - minAgeMinutes * 60 * 1000);
  const txCollection = FoodTransaction.collection.name;
  const orderCollection = FoodOrder.collection.name;

  // 1. Paid / refunded order with no transaction
  const noTx = await FoodOrder.aggregate([
    { $match: { 'payment.status': { $in: ['paid', 'refunded'] } } },
    { $limit: limit },
    { $lookup: { from: txCollection, localField: '_id', foreignField: 'orderId', as: 'tx' } },
    { $match: { tx: { $size: 0 } } },
    { $project: { _id: 1, 'payment.status': 1 } },
  ]);
  for (const o of noTx) issues.push(issue('paid_order_without_transaction', 'critical', o._id, `Order is ${o.payment?.status} but has no finance record`));

  // 2. Transaction with no order
  const noOrder = await FoodTransaction.aggregate([
    { $limit: limit },
    { $lookup: { from: orderCollection, localField: 'orderId', foreignField: '_id', as: 'order' } },
    { $match: { order: { $size: 0 } } },
    { $project: { orderId: 1, status: 1 } },
  ]);
  for (const t of noOrder) issues.push(issue('transaction_without_order', 'warning', t.orderId, `Finance record (${t.status}) points at a missing order`));

  // 3 & 5. Order snapshot disagrees with the transaction / captured money on a cancelled order
  const txs = await FoodTransaction.aggregate([
    { $match: { updatedAt: { $lt: settledBefore } } },
    { $sort: { updatedAt: -1 } },
    { $limit: limit },
    { $lookup: { from: orderCollection, localField: 'orderId', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    {
      $project: {
        orderId: 1, status: 1, paymentMethod: 1, settlement: 1, refund: 1, refundedPaise: 1, dispute: 1, 'amounts.totalCustomerPaid': 1, 'payment.status': 1, 'payment.method': 1,
        orderStatus: '$order.orderStatus', orderPayStatus: '$order.payment.status', orderPayMethod: '$order.payment.method',
      },
    },
  ]);
  for (const t of txs) {
    const txPay = t.payment?.status;
    if (t.orderPayStatus && txPay && t.orderPayStatus !== txPay) {
      issues.push(issue('order_transaction_status_mismatch', 'critical', t.orderId, `Order says '${t.orderPayStatus}', finance record says '${txPay}'`, { repairable: 'resync' }));
    }
    if (t.orderPayStatus === 'refunded' && t.status !== 'refunded') {
      issues.push(issue('order_refunded_transaction_not', 'critical', t.orderId, 'Order shows refunded but the finance record is not refunded'));
    }
    if (t.status === 'refunded' && t.orderPayStatus !== 'refunded') {
      issues.push(issue('transaction_refunded_order_not', 'warning', t.orderId, 'Finance record is refunded but the order snapshot is not', { repairable: 'resync' }));
    }
    if (CANCELLED.includes(t.orderStatus) && t.status === 'captured' && (Number(t.refundedPaise) || 0) < toPaise(t.amounts?.totalCustomerPaid) && String(t.paymentMethod || '').toLowerCase() !== 'cash') {
      issues.push(issue('captured_payment_on_cancelled_order', 'critical', t.orderId, 'Customer paid but the cancelled order was not refunded', { repairable: 'refund' }));
    }
    if (['open', 'under_review'].includes(t.dispute?.status)) {
      issues.push(issue('dispute_open', 'warning', t.orderId, `Chargeback ${t.dispute.disputeId} is ${t.dispute.status}${t.dispute.respondBy ? ' — respond by ' + new Date(t.dispute.respondBy).toISOString().slice(0, 10) : ''}`));
    }
    if (t.dispute?.status === 'lost' && t.dispute.resolvedAt && Date.now() - new Date(t.dispute.resolvedAt).getTime() < 30 * 24 * 3600 * 1000) {
      issues.push(issue('chargeback_lost', 'warning', t.orderId, 'Chargeback lost in the last 30 days — check whether the restaurant was already paid for this order'));
    }
    if (t.settlement?.isRestaurantSettled && t.status !== 'captured') {
      issues.push(issue('restaurant_settled_not_captured', 'warning', t.orderId, `Restaurant payout marked settled but payment status is '${t.status}'`));
    }
  }

  // 4. Refunds stuck mid-way
  const stuckBefore = new Date(Date.now() - STUCK_REFUND_MINUTES * 60 * 1000);
  const stuck = await FoodTransaction.find({ 'refund.status': { $in: ['initiated', 'pending'] }, updatedAt: { $lt: stuckBefore } })
    .select('orderId refund').limit(limit).lean();
  for (const t of stuck) issues.push(issue('refund_stuck', 'critical', t.orderId, `Refund has been '${t.refund.status}' for over ${STUCK_REFUND_MINUTES} minutes`, { repairable: 'recover_refund' }));

  // 6. Wallet payments / refunds must have a matching ledger row
  const walletTxs = await FoodTransaction.find({ paymentMethod: 'wallet', status: { $in: ['captured', 'refunded'] } })
    .select('orderId status refund').sort({ updatedAt: -1 }).limit(limit).lean();
  if (walletTxs.length) {
    const keys = [];
    for (const t of walletTxs) {
      keys.push(`order_payment:${t.orderId}`);
      if (t.status === 'refunded' && t.refund?.destination === 'wallet') keys.push(`order_refund:${t.orderId}`);
    }
    const found = new Set((await Transaction.find({ idempotencyKey: { $in: keys } }).select('idempotencyKey').lean()).map((r) => r.idempotencyKey));
    for (const t of walletTxs) {
      if (!found.has(`order_payment:${t.orderId}`)) issues.push(issue('wallet_payment_missing_ledger_row', 'critical', t.orderId, 'Wallet-paid order has no ledger debit'));
      if (t.status === 'refunded' && t.refund?.destination === 'wallet' && !found.has(`order_refund:${t.orderId}`)) {
        issues.push(issue('wallet_refund_missing_ledger_row', 'critical', t.orderId, 'Refund marked as sent to wallet but there is no ledger credit'));
      }
    }
  }

  // 7. Gateway says paid, database still pending (optional — calls Razorpay read-only)
  if (checkGateway && isRazorpayConfigured()) {
    const instance = getRazorpayInstance();
    const cutoff = new Date(Date.now() - GATEWAY_PENDING_MINUTES * 60 * 1000);
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pending = await FoodTransaction.find({
      paymentMethod: 'razorpay',
      status: { $in: ['pending', 'authorized', 'failed'] },
      'payment.razorpay.orderId': { $gt: '' },
      createdAt: { $lt: cutoff, $gt: since },
    }).select('orderId payment.razorpay.orderId').limit(100).lean();
    for (const t of pending) {
      try {
        const list = await instance.orders.fetchPayments(t.payment.razorpay.orderId);
        const captured = (list?.items || []).find((p) => p.status === 'captured');
        if (captured) {
          issues.push(issue('gateway_paid_database_pending', 'critical', t.orderId, `Razorpay captured ${captured.id} but the order is unpaid here`, { repairable: 'capture', gatewayPaymentId: captured.id }));
        }
      } catch (err) {
        issues.push(issue('gateway_check_failed', 'warning', t.orderId, err?.message || 'Gateway lookup failed'));
      }
    }
  }

  const counts = issues.reduce((acc, i) => ({ ...acc, [i.type]: (acc[i.type] || 0) + 1 }), {});
  return { checkedAt: new Date().toISOString(), total: issues.length, counts, issues };
}

/**
 * Safely repair ONE order. Every action is idempotent, so running it twice is harmless.
 * Returns what was done.
 */
export async function repairOrder(orderId) {
  const actions = [];
  const tx = await FoodTransaction.findOne({ orderId }).lean();
  if (!tx) return { orderId: String(orderId), actions: [{ action: 'skipped', reason: 'no_transaction' }] };

  // a. refund stuck mid-way
  if (['initiated', 'pending'].includes(tx.refund?.status)) {
    actions.push({ action: 'recover_refund', ...(await financeService.recoverStuckRefund(orderId)) });
  }

  // b. gateway captured but we still say unpaid
  if (tx.paymentMethod === 'razorpay' && ['pending', 'authorized', 'failed'].includes(tx.status) && isRazorpayConfigured() && tx.payment?.razorpay?.orderId) {
    const list = await getRazorpayInstance().orders.fetchPayments(tx.payment.razorpay.orderId);
    const captured = (list?.items || []).find((p) => p.status === 'captured');
    if (captured) {
      const result = await financeService.capturePayment(orderId, {
        method: 'razorpay',
        source: 'reconciliation_repair',
        actor: { role: 'SYSTEM' },
        gatewayPaymentId: captured.id,
        gatewayOrderId: captured.order_id,
        amountPaise: Number(captured.amount),
        note: 'Recovered by reconciliation: gateway had captured this payment',
      });
      actions.push({ action: 'capture_from_gateway', applied: result.applied, reason: result.reason });
      if (result.applied) {
        const { afterOnlinePaymentCaptured } = await import('../../modules/food/orders/services/order.service.js');
        await afterOnlinePaymentCaptured(orderId);
      }
    }
  }

  // c. paid money on a cancelled order -> refund
  const fresh = await FoodTransaction.findOne({ orderId }).lean();
  const order = await FoodOrder.findById(orderId).select('orderStatus').lean();
  if (fresh?.status === 'captured' && order && CANCELLED.includes(order.orderStatus) && String(fresh.paymentMethod).toLowerCase() !== 'cash') {
    const settlement = await financeService.settleCancellation(orderId, { reason: 'Reconciliation: paid cancelled order', actor: { role: 'SYSTEM' }, source: 'reconciliation_repair' });
    actions.push({ action: 'refund_cancelled_order', status: settlement.refund?.status || settlement.action });
  }

  // d. order snapshot out of step
  actions.push({ action: 'resync_snapshot', ...(await financeService.resyncOrderSnapshot(orderId)) });

  return { orderId: String(orderId), actions };
}
