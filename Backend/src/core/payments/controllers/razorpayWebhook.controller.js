import crypto from 'crypto';
import mongoose from 'mongoose';
import { FoodOrder } from '../../../modules/food/orders/models/order.model.js';
import { FoodTransaction } from '../../../modules/food/orders/models/foodTransaction.model.js';
import * as financeService from '../../../modules/food/orders/services/finance.service.js';
import { markCapturedQrPayment } from '../../../modules/food/orders/services/order-payment.service.js';
import { afterOnlinePaymentCaptured } from '../../../modules/food/orders/services/order.service.js';
import { creditTopupIntent } from '../../../modules/food/user/services/userWallet.service.js';
import { recordRiderCashDeposit } from '../../../modules/food/delivery/services/deliveryFinance.service.js';
import { PaymentIntent } from '../models/paymentIntent.model.js';
import { PaymentWebhookEvent } from '../models/webhookEvent.model.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

function hasValidWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(String(signature), 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

/** COD QR payments: find the transaction by QR id, falling back to the order note we attached. */
async function findQrTransaction(payment) {
  const qrId = String(payment?.qr_code_id || '');
  if (qrId) {
    const byQr = await FoodTransaction.findOne({ 'payment.qr.qrId': qrId }).lean();
    if (byQr) return byQr;
  }

  const notes = payment?.notes || {};
  const orderReference = String(notes.order_id || notes.order_reference || '');
  if (!orderReference) return null;
  const orderFilter = mongoose.Types.ObjectId.isValid(orderReference)
    ? { $or: [{ _id: orderReference }, { orderId: orderReference }, { order_id: orderReference }] }
    : { $or: [{ orderId: orderReference }, { order_id: orderReference }] };
  const order = await FoodOrder.findOne(orderFilter).select('_id').lean();
  if (!order) return null;
  return FoodTransaction.findOne({ orderId: order._id }).lean();
}

/** Online checkout payments: the transaction that owns this Razorpay order. */
const findTransactionByGatewayOrder = (razorpayOrderId) =>
  razorpayOrderId
    ? FoodTransaction.findOne({ 'payment.razorpay.orderId': String(razorpayOrderId) }).lean()
    : null;

/**
 * A captured payment that is not for an order: a wallet top-up or a rider cash deposit.
 * This is what saves the customer's money when the app dies before it can call verify.
 */
async function handleIntentCapture(payment) {
  const intent = payment?.order_id ? await PaymentIntent.findOne({ gatewayOrderId: String(payment.order_id) }).lean() : null;
  if (!intent) return null;
  if (intent.status === 'completed') return null;

  if (Number(payment.amount) !== intent.amountPaise) {
    logger.warn(`Webhook: payment ${payment.id} amount ${payment.amount} does not match intent ${intent.gatewayOrderId} (${intent.amountPaise}) — not credited`);
    return null;
  }

  if (intent.kind === 'wallet_topup') {
    await creditTopupIntent(intent, { gatewayPaymentId: String(payment.id), amountPaise: Number(payment.amount), source: 'webhook' });
    logger.info(`Webhook [payment.captured]: credited wallet top-up ${intent.gatewayOrderId}`);
  } else if (intent.kind === 'rider_cash_deposit') {
    await recordRiderCashDeposit({
      deliveryPartnerId: intent.ownerId,
      amount: Number(payment.amount) / 100,
      orderId: intent.gatewayOrderId,
      paymentId: String(payment.id),
      enforceCashLimit: false,
      via: 'webhook',
    });
    logger.info(`Webhook [payment.captured]: recorded rider cash deposit ${intent.gatewayOrderId}`);
  }
  return null;
}

async function handleCapturedPayment(payment, eventRef) {
  if (String(payment?.status || '').toLowerCase() !== 'captured') return null;

  const qrTransaction = await findQrTransaction(payment);
  if (qrTransaction?.payment?.method === 'razorpay_qr') {
    const markedPaid = await markCapturedQrPayment(qrTransaction, payment, 'webhook');
    if (markedPaid) {
      logger.info(`Webhook [payment.captured]: verified QR payment ${payment.id} for order ${qrTransaction.orderId}`);
    }
    return qrTransaction.orderId;
  }

  // Regular checkout flow
  const transaction = await findTransactionByGatewayOrder(payment?.order_id);
  if (!transaction) return handleIntentCapture(payment);

  const result = await financeService.capturePayment(transaction.orderId, {
    method: 'razorpay',
    source: 'webhook',
    actor: { role: 'SYSTEM' },
    gatewayPaymentId: String(payment.id || ''),
    gatewayOrderId: String(payment.order_id || ''),
    amountPaise: Number(payment.amount || 0),
    note: 'Captured payment verified through Razorpay webhook',
    ref: eventRef,
  });

  // Whoever wins the capture (this webhook or the verify API) does the follow-up, once
  if (result.applied) await afterOnlinePaymentCaptured(transaction.orderId);
  return transaction.orderId;
}

async function handleFailedPayment(payment) {
  const transaction = await findTransactionByGatewayOrder(payment?.order_id);
  if (!transaction) return null;
  await financeService.recordPaymentAttemptFailure(transaction.orderId, {
    gatewayPaymentId: String(payment.id || ''),
    reason: String(payment.error_description || payment.error_reason || 'Payment attempt failed'),
    source: 'webhook',
  });
  return transaction.orderId;
}

async function handleProcessedRefund(refund, eventRef) {
  const gatewayPaymentId = String(refund?.payment_id || '');
  if (!gatewayPaymentId) return null;
  const result = await financeService.confirmGatewayRefund({
    gatewayPaymentId,
    gatewayRefundId: String(refund.id || ''),
    amountPaise: Number(refund.amount || 0),
    eventRef,
  });
  if (result.applied) logger.info(`Webhook [refund.processed]: refund ${refund.id} confirmed`);
  const tx = await FoodTransaction.findOne({
    $or: [{ 'gateway.razorpayPaymentId': gatewayPaymentId }, { 'payment.razorpay.paymentId': gatewayPaymentId }],
  }).select('orderId').lean();
  return tx?.orderId || null;
}

async function handleFailedRefund(refund) {
  const gatewayPaymentId = String(refund?.payment_id || '');
  if (!gatewayPaymentId) return null;
  await financeService.failGatewayRefund({
    gatewayPaymentId,
    gatewayRefundId: String(refund.id || ''),
  });
  return null;
}

// Razorpay dispute (chargeback) events -> our dispute status
const DISPUTE_EVENT_STATUS = {
  'payment.dispute.created': 'open',
  'payment.dispute.action_required': 'open',
  'payment.dispute.under_review': 'under_review',
  'payment.dispute.won': 'won',
  'payment.dispute.lost': 'lost',
  'payment.dispute.closed': 'closed',
};

async function handleDispute(event, dispute) {
  const gatewayPaymentId = String(dispute?.payment_id || '');
  if (!gatewayPaymentId || !dispute?.id) return null;
  const result = await financeService.recordDispute({
    gatewayPaymentId,
    disputeId: String(dispute.id),
    status: DISPUTE_EVENT_STATUS[event],
    amountPaise: Number(dispute.amount || 0),
    reasonCode: String(dispute.reason_code || ''),
    phase: String(dispute.phase || ''),
    respondBy: Number(dispute.respond_by) > 0 ? new Date(Number(dispute.respond_by) * 1000) : null,
  });
  if (result.applied) logger.warn(`Webhook [${event}]: dispute ${dispute.id} on payment ${gatewayPaymentId} -> ${DISPUTE_EVENT_STATUS[event]}`);
  const tx = await FoodTransaction.findOne({
    $or: [{ 'gateway.razorpayPaymentId': gatewayPaymentId }, { 'payment.razorpay.paymentId': gatewayPaymentId }],
  }).select('orderId').lean();
  return tx?.orderId || null;
}

const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Register this webhook delivery. Returns true when THIS request should process it,
 * false when it is a duplicate (already processed / being processed elsewhere).
 * The unique (provider, fingerprint) index makes this safe across retries and servers.
 */
async function claimWebhookEvent({ event, fingerprint, payloadHash, resourceId }) {
  try {
    await PaymentWebhookEvent.create({
      provider: 'razorpay',
      eventType: String(event || 'unknown'),
      fingerprint,
      payloadHash,
      resourceId,
      status: 'processing',
    });
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  // Seen before: re-run only if the earlier attempt failed or got stuck mid-processing
  const reclaimed = await PaymentWebhookEvent.findOneAndUpdate(
    {
      provider: 'razorpay',
      fingerprint,
      $or: [
        { status: 'failed' },
        { status: 'processing', updatedAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      ],
    },
    { $set: { status: 'processing', error: '' }, $inc: { attempts: 1 } },
    { new: true },
  );
  return Boolean(reclaimed);
}

export const handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!hasValidWebhookSignature(req.rawBody, signature, config.razorpayWebhookSecret)) {
    logger.warn('Razorpay webhook signature verification failed.');
    return res.status(400).send('Invalid signature');
  }

  const { event, payload } = req.body || {};
  const payloadHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
  // Razorpay's own event id is unique per event; fall back to the body hash if it is missing
  const fingerprint = String(req.headers['x-razorpay-event-id'] || '') || payloadHash;
  const resourceId = String(payload?.payment?.entity?.id || payload?.refund?.entity?.id || payload?.dispute?.entity?.id || '');

  try {
    const shouldProcess = await claimWebhookEvent({ event, fingerprint, payloadHash, resourceId });
    if (!shouldProcess) {
      logger.info(`Razorpay webhook duplicate ignored: ${event} ${resourceId || fingerprint}`);
      return res.status(200).json({ status: 'duplicate' });
    }

    let orderId = null;
    if (event === 'payment.captured') {
      orderId = await handleCapturedPayment(payload?.payment?.entity, `webhook:${fingerprint}`);
    } else if (event === 'payment.failed') {
      orderId = await handleFailedPayment(payload?.payment?.entity);
    } else if (event === 'refund.processed') {
      orderId = await handleProcessedRefund(payload?.refund?.entity, `webhook:${fingerprint}`);
    } else if (event === 'refund.failed') {
      orderId = await handleFailedRefund(payload?.refund?.entity);
    } else if (DISPUTE_EVENT_STATUS[event]) {
      orderId = await handleDispute(event, payload?.dispute?.entity);
    }

    await PaymentWebhookEvent.updateOne(
      { provider: 'razorpay', fingerprint },
      { $set: { status: 'processed', processedAt: new Date(), orderId: orderId || null } },
    );
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error(`Razorpay webhook processing failed: ${error?.message || error}`);
    await PaymentWebhookEvent.updateOne(
      { provider: 'razorpay', fingerprint },
      { $set: { status: 'failed', error: String(error?.message || error).slice(0, 500) } },
    ).catch(() => {});
    // 500 makes Razorpay retry; the retry is allowed because the event is marked failed
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
