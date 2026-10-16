import crypto from 'crypto';
import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { withTransaction, sessionOpts } from '../../../../utils/dbTransaction.js';
import { toPaise, fromPaise, gtMoney, isPositiveMoney } from '../../../../utils/money.js';
import { initiateRazorpayRefund, getRazorpayInstance } from '../helpers/razorpay.helper.js';
import { refundWalletBalance } from '../../user/services/userWallet.service.js';

/**
 * FINANCE SERVICE — the ONLY module allowed to change payment state.
 *
 * Source of truth: FoodTransaction (status, payment.*, refund.*, settlement.*).
 * FoodOrder.payment is a mirrored snapshot kept in step by this service, in the same
 * database transaction, purely for UI compatibility.
 *
 * Rules enforced here
 *  - Allowed status transitions only (see TRANSITIONS).
 *  - Every change is a conditional update ("only if currently X"), so concurrent or replayed
 *    requests / webhooks can never apply twice.
 *  - Transaction + order snapshot are written in ONE Mongo transaction (all or nothing).
 *  - Refunds are a three-phase state machine: claim -> move money -> finalize. Money
 *    movement is idempotent (wallet ledger key / Razorpay claim), so a crash anywhere can be
 *    safely retried or repaired by reconciliation.
 */

export const TX_STATUS = Object.freeze({
    PENDING: 'pending',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    FAILED: 'failed',
    REFUNDED: 'refunded'
});

/**
 * pending -> authorized -> captured -> refunded, and pending -> failed.
 * failed -> captured is allowed ONLY for a late gateway capture (customer paid after we gave up);
 * reconciliation flags such payments on cancelled orders for refund.
 */
const TRANSITIONS = Object.freeze({
    pending: ['authorized', 'captured', 'failed'],
    authorized: ['captured', 'failed'],
    captured: ['refunded'],
    failed: ['captured'],
    refunded: []
});

export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

const GATEWAY_METHODS = new Set(['razorpay', 'razorpay_qr']);
const CAPTURABLE_FROM = ['pending', 'authorized', 'failed'];

const toObjectId = (value) => {
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (value?._id) return toObjectId(value._id);
    return new mongoose.Types.ObjectId(String(value));
};

const historyEntry = (kind, amount, { note = '', actor = null, ref = '', at = new Date() } = {}) => ({
    kind,
    amount: Number(amount) || 0,
    at,
    note,
    ref,
    recordedBy: { role: actor?.role || 'SYSTEM', id: actor?.id || undefined }
});

const loadTransaction = (orderId, session = null) =>
    FoodTransaction.findOne({ orderId: toObjectId(orderId) }).session(session || null);

/** Keep the FoodOrder.payment snapshot in step. Never decides anything itself. */
const mirrorToOrder = (orderId, set, session) =>
    FoodOrder.updateOne({ _id: toObjectId(orderId) }, { $set: set }, sessionOpts(session));

// ---------------------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------------------

/**
 * Record that the customer's money is in (online payment verified, QR paid, or COD collected).
 * Idempotent: returns { applied:false } if the payment was already captured/refunded.
 *
 * @param {string|ObjectId} orderId
 * @param {Object} opts
 * @param {string} [opts.method] razorpay | razorpay_qr | cash | wallet
 * @param {string} opts.source  who/what reported it (verify_api, webhook, qr_poll, rider_cod, admin ...)
 * @param {{role:string,id?:any}} [opts.actor]
 * @param {string} [opts.gatewayPaymentId]
 * @param {string} [opts.gatewayOrderId] must match the order's Razorpay order when both exist
 * @param {string} [opts.signature]
 * @param {number} [opts.amountPaise] amount the gateway says was captured (must cover the amount due)
 * @param {Date}   [opts.paidAt]
 * @param {string} [opts.note]
 * @param {string} [opts.ref] dedupe reference stored on the history entry (e.g. webhook event id)
 */
export async function capturePayment(orderId, opts = {}) {
    const {
        method, source = 'unknown', actor = null,
        gatewayPaymentId = '', gatewayOrderId = '', signature = '',
        amountPaise = null, paidAt = new Date(), note = '', ref = ''
    } = opts;

    try {
        return await withTransaction(async (session) => {
            const tx = await loadTransaction(orderId, session);
            if (!tx) throw new NotFoundError('Order payment record not found');

            if (tx.status === TX_STATUS.CAPTURED || tx.status === TX_STATUS.REFUNDED) {
                return { applied: false, reason: `already_${tx.status}`, transaction: tx.toObject() };
            }
            if (!canTransition(tx.status, TX_STATUS.CAPTURED)) {
                throw new ValidationError(`Payment cannot be captured from status '${tx.status}'`);
            }

            // Gateway sanity checks: right Razorpay order, and enough money
            const knownGatewayOrderId = String(tx.payment?.razorpay?.orderId || '');
            if (gatewayOrderId && knownGatewayOrderId && gatewayOrderId !== knownGatewayOrderId) {
                logger.warn(`Capture rejected: gateway order mismatch for order ${orderId}`);
                return { applied: false, reason: 'gateway_order_mismatch', transaction: tx.toObject() };
            }
            if (amountPaise !== null) {
                const duePaise = toPaise(tx.payment?.amountDue ?? tx.pricing?.total ?? 0);
                if (duePaise < 1 || !Number.isFinite(Number(amountPaise)) || Number(amountPaise) < duePaise) {
                    logger.warn(`Capture rejected: underpaid ${amountPaise} < ${duePaise} paise (order ${orderId})`);
                    return { applied: false, reason: 'underpaid', transaction: tx.toObject() };
                }
            }

            const set = { status: TX_STATUS.CAPTURED, 'payment.status': 'paid' };
            if (method) {
                set.paymentMethod = method;
                set['payment.method'] = method;
            }
            if (gatewayPaymentId) {
                set['payment.razorpay.paymentId'] = gatewayPaymentId;
                set['gateway.razorpayPaymentId'] = gatewayPaymentId;
            }
            if (signature) {
                set['payment.razorpay.signature'] = signature;
                set['gateway.razorpaySignature'] = signature;
            }
            if (method === 'razorpay_qr') set['payment.qr.status'] = 'paid';

            // Conditional update: only one caller can win the transition to 'captured'
            const updated = await FoodTransaction.findOneAndUpdate(
                { _id: tx._id, status: { $in: CAPTURABLE_FROM } },
                {
                    $set: set,
                    $push: {
                        history: historyEntry('captured', amountPaise !== null ? fromPaise(amountPaise) : tx.amounts?.totalCustomerPaid, {
                            note: note || `Payment captured via ${source}`, actor, ref, at: paidAt
                        })
                    }
                },
                { new: true, ...sessionOpts(session) }
            );
            if (!updated) {
                return { applied: false, reason: 'concurrent_update', transaction: (await loadTransaction(orderId, session))?.toObject() };
            }

            const orderSet = { 'payment.status': 'paid' };
            if (method) orderSet['payment.method'] = method;
            if (gatewayPaymentId) orderSet['payment.razorpay.paymentId'] = gatewayPaymentId;
            if (signature) orderSet['payment.razorpay.signature'] = signature;
            if (method === 'razorpay_qr') orderSet['payment.qr.status'] = 'paid';
            await mirrorToOrder(tx.orderId, orderSet, session);

            return { applied: true, transaction: updated.toObject() };
        });
    } catch (err) {
        // The unique gateway-payment index: this Razorpay payment already paid for another order
        if (err?.code === 11000) {
            throw new ValidationError('This payment is already linked to another order');
        }
        throw err;
    }
}

/**
 * A QR code ended without payment (expired/closed). The order stays payable (e.g. cash at the
 * door or a fresh QR), so only the QR/payment sub-state changes — the transaction status does not.
 */
export async function markQrTerminal(orderId, qrStatus) {
    return withTransaction(async (session) => {
        const set = { 'payment.qr.status': qrStatus, 'payment.status': 'failed' };
        const res = await FoodTransaction.updateOne(
            { orderId: toObjectId(orderId), 'payment.status': { $ne: 'paid' } },
            { $set: set },
            sessionOpts(session)
        );
        if (res.modifiedCount > 0) {
            await FoodOrder.updateOne(
                { _id: toObjectId(orderId), 'payment.status': { $ne: 'paid' } },
                { $set: set },
                sessionOpts(session)
            );
        }
        return { applied: res.modifiedCount > 0 };
    });
}

/**
 * A single gateway attempt failed (payment.failed webhook). The customer can retry on the same
 * Razorpay order, so this only records the attempt — it never fails the transaction.
 * Deduplicated by `ref` (gateway payment id).
 */
export async function recordPaymentAttemptFailure(orderId, { gatewayPaymentId = '', reason = '', source = 'webhook' } = {}) {
    const ref = gatewayPaymentId ? `attempt_failed:${gatewayPaymentId}` : '';
    const filter = { orderId: toObjectId(orderId), status: { $in: ['pending', 'authorized'] } };
    if (ref) filter['history.ref'] = { $ne: ref };

    const res = await FoodTransaction.updateOne(filter, {
        $push: { history: historyEntry('payment_attempt_failed', 0, { note: reason || 'Payment attempt failed', ref, actor: { role: 'SYSTEM' } }) }
    });
    return { applied: res.modifiedCount > 0, source };
}

/** History-only audit entry (no state change). */
export async function recordHistory(orderId, kind, { note = '', actor = null, amount, ref = '' } = {}) {
    const tx = await FoodTransaction.findOne({ orderId: toObjectId(orderId) }).select('amounts.totalCustomerPaid').lean();
    if (!tx) return { applied: false };
    const filter = { orderId: toObjectId(orderId) };
    if (ref) filter['history.ref'] = { $ne: ref };
    const res = await FoodTransaction.updateOne(filter, {
        $push: { history: historyEntry(kind, amount ?? tx.amounts?.totalCustomerPaid, { note, actor, ref }) }
    });
    return { applied: res.modifiedCount > 0 };
}

/**
 * An online payment was never completed and the order has been timed out.
 * Closes the transaction as failed and shows the failure on the order snapshot. If the customer
 * pays later anyway, capturePayment() accepts it (failed -> captured) and the order flow refunds it.
 */
export async function expireUnpaidOnlineOrder(orderId, { reason = 'Payment not completed in time' } = {}) {
  return withTransaction(async (session) => {
    const res = await FoodTransaction.updateOne(
      { orderId: toObjectId(orderId), status: { $in: ['pending', 'authorized'] }, 'payment.status': { $ne: 'paid' } },
      {
        $set: { status: TX_STATUS.FAILED, 'payment.status': 'failed' },
        $push: { history: historyEntry('payment_timeout', 0, { note: reason, actor: { role: 'SYSTEM' } }) },
      },
      sessionOpts(session),
    );
    if (res.modifiedCount > 0) {
      await mirrorToOrder(orderId, { 'payment.status': 'failed' }, session);
    }
    return { applied: res.modifiedCount > 0 };
  });
}

// ---------------------------------------------------------------------------------------
// COD QR collection state (the rider shows the customer a one-time UPI QR)
// ---------------------------------------------------------------------------------------

/** Atomically claim the right to create a QR (stops two button taps creating two QRs). */
export async function claimQrCreation(transactionId, { now = new Date(), lockUntil }) {
  const res = await FoodTransaction.updateOne(
    {
      _id: transactionId,
      'payment.status': { $ne: 'paid' },
      $or: [
        { 'payment.qr.status': { $nin: ['active', 'created', 'pending', 'creating'] } },
        { 'payment.qr.expiresAt': { $lte: now } },
      ],
    },
    { $set: { 'payment.qr.status': 'creating', 'payment.qr.expiresAt': lockUntil } },
  );
  return res.modifiedCount > 0;
}

/** The gateway call failed: release the claim and restore the previous method. */
export async function releaseQrCreation(transactionId, { previousMethod, now = new Date() }) {
  await FoodTransaction.updateOne(
    { _id: transactionId, 'payment.qr.status': 'creating' },
    {
      $set: {
        paymentMethod: previousMethod,
        'payment.method': previousMethod,
        'payment.qr.status': 'failed',
        'payment.qr.expiresAt': now,
      },
    },
  );
}

/** The gateway answered with something unusable. */
export async function failQrCreation(transactionId, { now = new Date() } = {}) {
  await FoodTransaction.updateOne(
    { _id: transactionId },
    { $set: { 'payment.qr.status': 'failed', 'payment.qr.expiresAt': now } },
  );
}

/** Save the created QR on the transaction and mirror it to the order, atomically. */
export async function saveCreatedQr(transactionId, orderId, qr, { actor = null } = {}) {
  return withTransaction(async (session) => {
    const res = await FoodTransaction.updateOne(
      { _id: transactionId, 'payment.status': { $ne: 'paid' } },
      {
        $set: {
          paymentMethod: 'razorpay_qr',
          'payment.method': 'razorpay_qr',
          'payment.status': 'pending_qr',
          'payment.qr': qr,
          'gateway.qrUrl': qr.imageUrl,
          'gateway.qrExpiresAt': qr.expiresAt,
        },
        $push: {
          history: historyEntry('cod_collect_qr_created', qr.amount, {
            note: 'Single-use Razorpay UPI QR created for COD collection',
            actor,
            ref: `qr:${qr.qrId}`,
          }),
        },
      },
      sessionOpts(session),
    );
    if (res.modifiedCount === 0) return { applied: false };

    await FoodOrder.updateOne(
      { _id: toObjectId(orderId), 'payment.status': { $ne: 'paid' } },
      { $set: { 'payment.method': 'razorpay_qr', 'payment.status': 'pending_qr', 'payment.qr': qr } },
      sessionOpts(session),
    );
    return { applied: true };
  });
}

// ---------------------------------------------------------------------------------------
// Refunds (full and partial) and chargebacks
// ---------------------------------------------------------------------------------------

const FULL_KEY = 'full';
const IN_FLIGHT = ['initiated', 'pending'];

function resolveRefundDestination(tx, requested) {
    const method = String(tx.payment?.method || tx.paymentMethod || '').toLowerCase();
    if (method === 'wallet') return 'wallet';
    if (String(requested || '').toLowerCase() === 'wallet') return 'wallet';
    const paymentId = String(tx.payment?.razorpay?.paymentId || tx.gateway?.razorpayPaymentId || '');
    if (GATEWAY_METHODS.has(method) && paymentId) return 'source';
    if (GATEWAY_METHODS.has(method)) return 'wallet'; // no gateway payment id to refund against
    return 'manual'; // cash: nothing digital to give back
}

const totalPaise = (tx) => toPaise(tx.amounts?.totalCustomerPaid ?? tx.pricing?.total ?? 0);
const remainingPaise = (tx) => Math.max(0, totalPaise(tx) - (Number(tx.refundedPaise) || 0));

/** Ledger key for the wallet credit of one refund. 'full' keeps the plain per-order key. */
const ledgerKeyFor = (orderId, key) => (key === FULL_KEY ? `order_refund:${orderId}` : `order_refund:${orderId}:${key}`);

/** What the order snapshot shows: the running total once refunds are done, the attempt while in flight. */
const orderRefundSnapshot = (tx) => ({
    status: tx.refund?.status || 'none',
    destination: tx.refund?.destination || '',
    amount: tx.refund?.status === 'processed' ? fromPaise(tx.refundedPaise || 0) : (tx.refund?.amount || 0),
    refundId: tx.refund?.gatewayRefundId || '',
    processedAt: tx.refund?.processedAt || undefined
});

/** Closes the transaction as refunded once the refunded total reaches what was paid. */
async function closeIfFullyRefunded(updated, session) {
    if (updated.status === TX_STATUS.CAPTURED && (Number(updated.refundedPaise) || 0) >= totalPaise(updated)) {
        return (
            await FoodTransaction.findOneAndUpdate(
                { _id: updated._id, status: TX_STATUS.CAPTURED },
                { $set: { status: TX_STATUS.REFUNDED, 'payment.status': 'refunded' } },
                { new: true, ...sessionOpts(session) }
            )
        ) || updated;
    }
    return updated;
}

/**
 * Move ONE refund (identified by its request key) to processed / pending / failed.
 * A processed refund adds to refundedPaise; when everything has been refunded the transaction
 * becomes 'refunded'. The order snapshot is updated in the same database transaction.
 */
async function finalizeRefund(orderId, key, outcome, { gatewayRefundId = '', error = '', actor = null, note = '' } = {}) {
    return withTransaction(async (session) => {
        const now = new Date();
        const current = await loadTransaction(orderId, session);
        const entry = current?.refunds?.find((r) => r.key === key);
        if (!entry) return { applied: false };

        let set;
        let inc = null;
        let kind;
        if (outcome === 'processed') {
            set = {
                'refunds.$.status': 'processed',
                'refunds.$.gatewayRefundId': gatewayRefundId || entry.gatewayRefundId || '',
                'refunds.$.processedAt': now,
                'refunds.$.error': '',
                'refund.status': 'processed',
                'refund.destination': entry.destination,
                'refund.amount': entry.amount,
                'refund.gatewayRefundId': gatewayRefundId || entry.gatewayRefundId || '',
                'refund.processedAt': now,
                'refund.error': ''
            };
            inc = { refundedPaise: toPaise(entry.amount) };
            kind = 'refund_processed';
        } else if (outcome === 'pending') {
            set = { 'refunds.$.status': 'pending', 'refunds.$.gatewayRefundId': gatewayRefundId, 'refund.status': 'pending', 'refund.gatewayRefundId': gatewayRefundId };
            kind = 'refund_pending';
        } else {
            set = { 'refunds.$.status': 'failed', 'refunds.$.error': String(error).slice(0, 500), 'refund.status': 'failed', 'refund.error': String(error).slice(0, 500) };
            kind = 'refund_failed';
        }

        const update = {
            $set: set,
            $push: { history: historyEntry(kind, entry.amount, { note: note || error || kind, actor, ref: gatewayRefundId ? `${kind}:${gatewayRefundId}` : `${kind}:${key}` }) }
        };
        if (inc) update.$inc = inc;

        const updated = await FoodTransaction.findOneAndUpdate(
            { orderId: toObjectId(orderId), refunds: { $elemMatch: { key, status: { $in: IN_FLIGHT } } } },
            update,
            { new: true, ...sessionOpts(session) }
        );
        if (!updated) return { applied: false };

        const finalDoc = outcome === 'processed' ? await closeIfFullyRefunded(updated, session) : updated;

        const orderSet = { 'payment.refund': orderRefundSnapshot(finalDoc) };
        if (finalDoc.status === TX_STATUS.REFUNDED) orderSet['payment.status'] = 'refunded';
        await mirrorToOrder(orderId, orderSet, session);

        return { applied: true, transaction: finalDoc.toObject(), fullyRefunded: finalDoc.status === TX_STATUS.REFUNDED };
    });
}

/**
 * Record a refund that already happened OUTSIDE this system (a refund made in the Razorpay
 * dashboard, or a chargeback the bank took). Counts toward refundedPaise, exactly once per `key`.
 */
async function recordExternalRefund(txId, { key, amountPaise, destination, gatewayRefundId = '', reason, actor = { role: 'SYSTEM' } }) {
    return withTransaction(async (session) => {
        const now = new Date();
        const updated = await FoodTransaction.findOneAndUpdate(
            { _id: txId, status: TX_STATUS.CAPTURED, 'refunds.key': { $ne: key } },
            {
                $set: {
                    'refund.status': 'processed',
                    'refund.destination': destination,
                    'refund.amount': fromPaise(amountPaise),
                    'refund.reason': reason,
                    'refund.gatewayRefundId': gatewayRefundId,
                    'refund.requestedAt': now,
                    'refund.processedAt': now,
                    'refund.error': ''
                },
                $inc: { refundedPaise: amountPaise },
                $push: {
                    refunds: { key, amount: fromPaise(amountPaise), destination, status: 'processed', reason, gatewayRefundId, requestedAt: now, processedAt: now },
                    history: historyEntry('refund_processed', fromPaise(amountPaise), { note: reason, actor, ref: `external:${key}` })
                }
            },
            { new: true, ...sessionOpts(session) }
        );
        if (!updated) return { applied: false };

        const finalDoc = await closeIfFullyRefunded(updated, session);
        const orderSet = { 'payment.refund': orderRefundSnapshot(finalDoc) };
        if (finalDoc.status === TX_STATUS.REFUNDED) orderSet['payment.status'] = 'refunded';
        await mirrorToOrder(finalDoc.orderId, orderSet, session);
        return { applied: true, transaction: finalDoc.toObject(), fullyRefunded: finalDoc.status === TX_STATUS.REFUNDED };
    });
}

/**
 * THE refund flow — full or partial. Used by user cancel, restaurant cancel, auto-cancel,
 * admin cancel / admin refunds and repair.
 *
 *  - No `amount`  -> refund everything still refundable (key "full").
 *  - With `amount` -> a PARTIAL refund; `idempotencyKey` is then required so a repeated request
 *                    (double click, retry) can never refund twice.
 *  - The refunded total can never exceed what the customer paid.
 *
 * Phase 1  claim     one refund in flight at a time (conditional update, one winner)
 * Phase 2  move money wallet credit (idempotent ledger key) or Razorpay refund
 * Phase 3  finalize  processed | pending (wait for webhook) | failed (retryable with the same key)
 */
export async function refundOrder(orderId, { destination, amount, reason = '', actor = null, source = 'system', idempotencyKey } = {}) {
    const existing = await loadTransaction(orderId);
    if (!existing) throw new NotFoundError('Order payment record not found');

    const summary = (tx, extra = {}) => ({
        refundedTotal: fromPaise(tx.refundedPaise || 0),
        remaining: fromPaise(remainingPaise(tx)),
        ...extra
    });

    if (existing.status === TX_STATUS.REFUNDED) {
        return { status: 'processed', duplicate: true, destination: existing.refund?.destination || '', amount: existing.refund?.amount || 0, ...summary(existing) };
    }
    if (existing.status !== TX_STATUS.CAPTURED) {
        throw new ValidationError(`Only captured payments can be refunded (status is '${existing.status}')`);
    }

    const dest = resolveRefundDestination(existing, destination);
    if (dest === 'manual') {
        await recordHistory(orderId, 'refund_manual_required', { note: 'Cash payment — refund must be handled manually', actor });
        return { status: 'manual_required', destination: 'manual', amount: 0, ...summary(existing) };
    }

    const remaining = remainingPaise(existing);
    let amountPaise;
    let key;
    if (amount === undefined || amount === null) {
        amountPaise = remaining;
        key = idempotencyKey ? String(idempotencyKey).slice(0, 60) : FULL_KEY;
    } else {
        amountPaise = toPaise(amount);
        if (amountPaise !== remaining && !idempotencyKey) {
            throw new ValidationError('idempotencyKey is required for a partial refund');
        }
        key = idempotencyKey ? String(idempotencyKey).slice(0, 60) : FULL_KEY;
    }
    if (!Number.isInteger(amountPaise) || amountPaise < 1 || amountPaise > remaining) {
        throw new ValidationError(`Invalid refund amount (refundable: ₹${fromPaise(remaining)})`);
    }

    // A refund with this key already exists: replay, in flight, or a failed one we can retry
    const prior = existing.refunds?.find((r) => r.key === key);
    if (prior?.status === 'processed') {
        return { status: 'processed', duplicate: true, destination: prior.destination, amount: prior.amount, ...summary(existing) };
    }
    if (prior && IN_FLIGHT.includes(prior.status)) {
        return { status: prior.status, inProgress: true, destination: prior.destination, amount: prior.amount, ...summary(existing) };
    }
    if (prior && toPaise(prior.amount) !== amountPaise) {
        throw new ValidationError('This refund request key was already used for a different amount');
    }

    const ledgerKey = ledgerKeyFor(String(existing.orderId), key);
    const claimNow = new Date();
    const pointer = {
        'refund.status': 'initiated',
        'refund.destination': dest,
        'refund.amount': fromPaise(amountPaise),
        'refund.reason': String(reason).slice(0, 300),
        'refund.requestedAt': claimNow,
        'refund.error': ''
    };
    const notInFlight = [{ 'refund.status': { $in: ['none', 'failed', 'processed'] } }, { 'refund.status': { $exists: false } }];
    const claimHistory = historyEntry('refund_initiated', fromPaise(amountPaise), { note: `Refund to ${dest}: ${reason || source}`, actor, ref: `refund_initiated:${key}` });

    // Phase 1 — claim
    const claimed = prior
        ? await FoodTransaction.findOneAndUpdate(
            { orderId: toObjectId(orderId), status: TX_STATUS.CAPTURED, refunds: { $elemMatch: { key, status: 'failed' } }, $or: notInFlight },
            {
                $set: { ...pointer, 'refunds.$.status': 'initiated', 'refunds.$.error': '', 'refunds.$.requestedAt': claimNow },
                $inc: { 'refund.attempts': 1 },
                $push: { history: claimHistory }
            },
            { new: true }
        )
        : await FoodTransaction.findOneAndUpdate(
            {
                orderId: toObjectId(orderId),
                status: TX_STATUS.CAPTURED,
                'refunds.key': { $ne: key },
                $or: notInFlight,
                // never refund more than was paid (paise-exact, checked atomically with the claim)
                $expr: {
                    $lte: [
                        { $add: [{ $ifNull: ['$refundedPaise', 0] }, amountPaise] },
                        { $round: [{ $multiply: ['$amounts.totalCustomerPaid', 100] }, 0] }
                    ]
                }
            },
            {
                $set: pointer,
                $inc: { 'refund.attempts': 1 },
                $push: {
                    refunds: { key, amount: fromPaise(amountPaise), destination: dest, status: 'initiated', reason: String(reason).slice(0, 300), ledgerKey, requestedAt: claimNow },
                    history: claimHistory
                }
            },
            { new: true }
        );

    if (!claimed) {
        const latest = await loadTransaction(orderId);
        if (latest?.status === TX_STATUS.REFUNDED) return { status: 'processed', duplicate: true, destination: latest.refund?.destination || dest, amount: latest.refund?.amount || 0, ...summary(latest) };
        return { status: latest?.refund?.status || 'initiated', inProgress: true, destination: dest, amount: fromPaise(amountPaise), ...summary(latest || existing) };
    }

    // Phase 2 — move the money
    const orderRef = String(existing.orderId);
    const amountRupees = fromPaise(amountPaise);
    const done = async (outcome, extra = {}, opts = {}) => {
        const result = await finalizeRefund(orderId, key, outcome, { actor, ...opts });
        const latest = await loadTransaction(orderId);
        return { status: outcome, destination: dest, amount: amountRupees, key, ...summary(latest || claimed), ...extra, fullyRefunded: Boolean(result.fullyRefunded) };
    };
    try {
        if (dest === 'wallet') {
            await refundWalletBalance(
                existing.userId,
                amountRupees,
                `Refund for cancelled order #${orderRef.slice(-6).toUpperCase()}`,
                { orderId: orderRef, source: 'order_refund_wallet' },
                { idempotencyKey: ledgerKey }
            );
            return await done('processed', {}, { note: 'Refunded to wallet' });
        }

        const paymentId = String(existing.payment?.razorpay?.paymentId || existing.gateway?.razorpayPaymentId || '');
        const receipt = key === FULL_KEY ? `refund_${orderRef}` : `rf_${orderRef.slice(-12)}_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 10)}`;
        const result = await initiateRazorpayRefund(paymentId, amountRupees, { receipt, reason: reason || 'Order cancelled' });
        if (!result.success) {
            return await done('failed', { error: result.error }, { error: result.error || 'Gateway refund failed' });
        }
        const processed = String(result.status || 'processed').toLowerCase() === 'processed';
        return await done(processed ? 'processed' : 'pending', { gatewayRefundId: result.refundId }, {
            gatewayRefundId: result.refundId || '',
            note: processed ? 'Refunded to original payment method' : 'Gateway accepted the refund; waiting for confirmation'
        });
    } catch (err) {
        logger.error(`Refund failed for order ${orderRef}: ${err?.message || err}`);
        await finalizeRefund(orderId, key, 'failed', { error: err?.message || String(err), actor }).catch(() => {});
        return { status: 'failed', destination: dest, amount: amountRupees, key, error: err?.message, ...summary(claimed) };
    }
}

/**
 * An order was cancelled — settle the money side exactly once.
 *  - not paid yet            -> transaction closed as failed (no money moved)
 *  - paid online / wallet    -> refund of everything not yet refunded, through refundOrder()
 *  - paid cash               -> flagged for manual handling
 */
export async function settleCancellation(orderId, { reason = '', actor = null, refundDestination = 'source', source = 'cancel' } = {}) {
    const tx = await loadTransaction(orderId);
    if (!tx) return { action: 'none' };

    if (tx.status === TX_STATUS.PENDING || tx.status === TX_STATUS.AUTHORIZED) {
        const res = await FoodTransaction.updateOne(
            { _id: tx._id, status: { $in: ['pending', 'authorized'] } },
            {
                $set: { status: TX_STATUS.FAILED },
                $push: { history: historyEntry('order_cancelled_unpaid', 0, { note: `Order cancelled before payment: ${reason || source}`, actor }) }
            }
        );
        return { action: 'closed_unpaid', applied: res.modifiedCount > 0 };
    }

    if (tx.status === TX_STATUS.CAPTURED) {
        const refund = await refundOrder(orderId, { destination: refundDestination, reason, actor, source });
        return { action: 'refund', refund };
    }

    return { action: 'none', status: tx.status };
}

const findByGatewayPayment = (gatewayPaymentId) =>
    FoodTransaction.findOne({
        $or: [{ 'gateway.razorpayPaymentId': gatewayPaymentId }, { 'payment.razorpay.paymentId': gatewayPaymentId }]
    });

/** Gateway told us a refund finished (refund.processed webhook, or a refund made from the Razorpay dashboard). */
export async function confirmGatewayRefund({ gatewayPaymentId, gatewayRefundId = '', amountPaise = 0, eventRef = '' }) {
    if (!gatewayPaymentId) return { applied: false, reason: 'no_payment_id' };
    const tx = await findByGatewayPayment(gatewayPaymentId);
    if (!tx) return { applied: false, reason: 'transaction_not_found' };

    // Is this refund one we started?
    const tracked =
        (gatewayRefundId && tx.refunds?.find((r) => r.gatewayRefundId === gatewayRefundId)) ||
        tx.refunds?.find((r) => r.destination === 'source' && IN_FLIGHT.includes(r.status) && toPaise(r.amount) === Number(amountPaise));

    if (tracked) {
        if (tracked.status === 'processed') return { applied: false, reason: 'already_processed' };
        const done = await finalizeRefund(tx.orderId, tracked.key, 'processed', {
            gatewayRefundId, actor: { role: 'SYSTEM' }, note: 'Refund confirmed by gateway webhook'
        });
        return { applied: done.applied };
    }

    // Started outside this system (Razorpay dashboard): record it, once per gateway refund id
    if (tx.status !== TX_STATUS.CAPTURED) return { applied: false, reason: `not_captured_${tx.status}` };
    const key = `gw:${gatewayRefundId || eventRef}`;
    if (key === 'gw:') return { applied: false, reason: 'no_refund_reference' };
    const room = remainingPaise(tx);
    const paise = Math.min(Number(amountPaise) || 0, room);
    if (paise < 1) return { applied: false, reason: 'nothing_to_refund' };
    const recorded = await recordExternalRefund(tx._id, {
        key, amountPaise: paise, destination: 'source', gatewayRefundId, reason: 'Refund confirmed by gateway'
    });
    return { applied: recorded.applied, fullyRefunded: recorded.fullyRefunded };
}

/** Gateway told us a refund failed. */
export async function failGatewayRefund({ gatewayPaymentId, gatewayRefundId = '', reason = 'Gateway reported refund failure' }) {
    const tx = await findByGatewayPayment(gatewayPaymentId);
    if (!tx || tx.status !== TX_STATUS.CAPTURED) return { applied: false };
    const entry =
        (gatewayRefundId && tx.refunds?.find((r) => r.gatewayRefundId === gatewayRefundId)) ||
        tx.refunds?.find((r) => r.destination === 'source' && IN_FLIGHT.includes(r.status));
    if (!entry || !IN_FLIGHT.includes(entry.status)) return { applied: false };
    const done = await finalizeRefund(tx.orderId, entry.key, 'failed', { gatewayRefundId, error: reason, actor: { role: 'SYSTEM' } });
    return { applied: done.applied };
}

// ---------------------------------------------------------------------------------------
// Disputes (chargebacks)
// ---------------------------------------------------------------------------------------

const DISPUTE_TERMINAL = ['won', 'lost', 'closed'];

/**
 * Razorpay dispute events (payment.dispute.created / under_review / action_required / won / lost / closed).
 *
 *  open / under_review -> the money is at risk: the order's earnings are held back from the restaurant
 *  won                 -> the customer's claim was rejected: earnings are released again
 *  lost                -> the bank took the money back: recorded as a refund to 'chargeback'
 *
 * Idempotent per (dispute, status); an old event can never move a finished dispute backwards.
 */
export async function recordDispute({ gatewayPaymentId, disputeId, status, amountPaise = 0, reasonCode = '', phase = '', respondBy = null, eventRef = '' }) {
    if (!gatewayPaymentId || !disputeId) return { applied: false, reason: 'missing_reference' };
    const tx = await findByGatewayPayment(gatewayPaymentId);
    if (!tx) return { applied: false, reason: 'transaction_not_found' };

    const current = tx.dispute?.status || 'none';
    const ref = `dispute:${disputeId}:${status}`;
    if (DISPUTE_TERMINAL.includes(current) && !DISPUTE_TERMINAL.includes(status) && tx.dispute?.disputeId === disputeId) {
        return { applied: false, reason: 'stale_event' };
    }

    const result = await withTransaction(async (session) => {
        const now = new Date();
        const set = {
            'dispute.status': status,
            'dispute.disputeId': disputeId,
            'dispute.amount': fromPaise(amountPaise),
            'dispute.reasonCode': reasonCode,
            'dispute.phase': phase
        };
        if (respondBy) set['dispute.respondBy'] = respondBy;
        if (!tx.dispute?.openedAt) set['dispute.openedAt'] = now;
        if (DISPUTE_TERMINAL.includes(status)) set['dispute.resolvedAt'] = now;

        const updated = await FoodTransaction.findOneAndUpdate(
            { _id: tx._id, 'history.ref': { $ne: ref } },
            {
                $set: set,
                $push: { history: historyEntry(`dispute_${status}`, fromPaise(amountPaise), { note: `Dispute ${disputeId}: ${status}${reasonCode ? ` (${reasonCode})` : ''}`, actor: { role: 'SYSTEM' }, ref }) }
            },
            { new: true, ...sessionOpts(session) }
        );
        return updated ? { applied: true } : { applied: false, reason: 'duplicate' };
    });
    if (!result.applied) return result;

    // Lost: the bank has taken the money back. Count it as refunded (nothing for us to pay out).
    if (status === 'lost') {
        const fresh = await loadTransaction(tx.orderId);
        if (fresh?.status === TX_STATUS.CAPTURED) {
            const room = remainingPaise(fresh);
            const paise = Math.min(Number(amountPaise) || room, room);
            if (paise > 0) {
                await recordExternalRefund(fresh._id, {
                    key: `chargeback:${disputeId}`,
                    amountPaise: paise,
                    destination: 'chargeback',
                    reason: `Chargeback lost (${reasonCode || 'no reason code'})`
                });
            }
        }
    }
    return { applied: true };
}

// ---------------------------------------------------------------------------------------
// Settlement flags
// ---------------------------------------------------------------------------------------

/** Mark the restaurant payout for an order as settled. Only for captured payments; idempotent. */
export async function markRestaurantSettled(orderId, adminId) {
    const res = await FoodTransaction.updateOne(
        { orderId: toObjectId(orderId), status: TX_STATUS.CAPTURED, 'settlement.isRestaurantSettled': { $ne: true } },
        {
            $set: { 'settlement.isRestaurantSettled': true, 'settlement.restaurantSettledAt': new Date() },
            $push: { history: historyEntry('settled', undefined, { note: 'Restaurant payout settled by admin', actor: { role: 'ADMIN', id: adminId } }) }
        }
    );
    if (res.modifiedCount === 0) {
        const tx = await FoodTransaction.findOne({ orderId: toObjectId(orderId) }).select('status settlement').lean();
        if (!tx) throw new NotFoundError('Order payment record not found');
        if (tx.settlement?.isRestaurantSettled) return { applied: false, reason: 'already_settled' };
        throw new ValidationError(`Cannot settle a payment in status '${tx.status}'`);
    }
    return { applied: true };
}

// ---------------------------------------------------------------------------------------
// Repair primitives (used by reconciliation; every one is safe to run repeatedly)
// ---------------------------------------------------------------------------------------

/**
 * A refund was claimed ('initiated'/'pending') but never finished — e.g. the server restarted
 * between moving the money and recording it. Works out what really happened and finishes it.
 */
export async function recoverStuckRefund(orderId, { actor = { role: 'SYSTEM' } } = {}) {
    const tx = await loadTransaction(orderId);
    if (!tx) throw new NotFoundError('Order payment record not found');
    if (tx.status === TX_STATUS.REFUNDED) return { action: 'none', reason: 'already_refunded' };

    const entry = tx.refunds?.find((r) => IN_FLIGHT.includes(r.status));
    if (!entry) return { action: 'none', reason: 'no_stuck_refund' };

    if (entry.destination === 'wallet') {
        // The wallet credit is idempotent: replaying it either credits once or is a no-op
        await refundWalletBalance(tx.userId, entry.amount, `Refund for cancelled order #${String(tx.orderId).slice(-6).toUpperCase()}`, {
            orderId: String(tx.orderId),
            source: 'order_refund_wallet'
        }, { idempotencyKey: entry.ledgerKey || ledgerKeyFor(String(tx.orderId), entry.key) });
        await finalizeRefund(orderId, entry.key, 'processed', { actor, note: 'Recovered: wallet refund completed' });
        return { action: 'completed_wallet_refund', key: entry.key };
    }

    // Gateway refund: ask Razorpay what exists for this payment
    const paymentId = String(tx.payment?.razorpay?.paymentId || tx.gateway?.razorpayPaymentId || '');
    const instance = getRazorpayInstance();
    if (!instance || !paymentId) {
        await finalizeRefund(orderId, entry.key, 'failed', { error: 'Gateway unavailable during recovery', actor });
        return { action: 'marked_failed', reason: 'gateway_unavailable', key: entry.key };
    }
    const list = await instance.payments.fetchMultipleRefund(paymentId);
    const items = Array.isArray(list?.items) ? list.items : [];
    const known = new Set((tx.refunds || []).filter((r) => r.status === 'processed' && r.gatewayRefundId).map((r) => r.gatewayRefundId));
    const match = items.find((r) => !known.has(r.id) && Number(r.amount) === toPaise(entry.amount) && r.status !== 'failed');
    if (match) {
        await finalizeRefund(orderId, entry.key, match.status === 'processed' ? 'processed' : 'pending', {
            gatewayRefundId: match.id,
            actor,
            note: 'Recovered: refund found at gateway'
        });
        return { action: 'completed_gateway_refund', gatewayRefundId: match.id, key: entry.key };
    }
    // The gateway never got the request — release the claim so the refund can be retried
    await finalizeRefund(orderId, entry.key, 'failed', { error: 'No gateway refund found during recovery; safe to retry', actor });
    return { action: 'marked_failed', reason: 'no_gateway_refund', key: entry.key };
}

/** Rebuild the FoodOrder.payment snapshot from the transaction (the transaction is the truth). */
export async function resyncOrderSnapshot(orderId) {
  const tx = await FoodTransaction.findOne({ orderId: toObjectId(orderId) }).lean();
  if (!tx) throw new NotFoundError('Order payment record not found');

  const set = {
    'payment.status': tx.payment?.status || 'created',
    'payment.method': tx.payment?.method || tx.paymentMethod,
  };
  if (tx.payment?.razorpay?.paymentId) set['payment.razorpay.paymentId'] = tx.payment.razorpay.paymentId;
  if (tx.refund && tx.refund.status && tx.refund.status !== 'none') {
    set['payment.refund'] = orderRefundSnapshot(tx);
  }
  await mirrorToOrder(orderId, set, null);
  return { applied: true, set };
}
