import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { creditWallet, debitWallet, getUserWalletForFrontend } from '../../../../core/payments/wallet.service.js';
import { InsufficientBalanceError } from '../../../../core/payments/transaction.service.js';
import { PaymentIntent } from '../../../../core/payments/models/paymentIntent.model.js';
import { fromPaise } from '../../../../utils/money.js';
import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature
} from '../../orders/helpers/razorpay.helper.js';

/**
 * User wallet operations.
 * The balance lives in payment_user_wallets; every change is a row in the
 * payment_transactions ledger (the single source of truth). Each operation that has a
 * natural unique id (order, referral, gateway order) passes an idempotency key, so a
 * retry or double-click can never move money twice.
 */

const assertUserId = (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    return id;
};

const idOf = (value) => (value ? String(value) : '');

export const getUserWallet = async (userId) => {
    const id = assertUserId(userId);
    return getUserWalletForFrontend(id);
};

export const creditReferralReward = async (userId, amountInr, metadata = {}) => {
    const id = assertUserId(userId);
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(id) };
    }

    const referralLogId = idOf(metadata?.referralLogId);
    await creditWallet({
        entityId: id,
        amount,
        description: 'Referral reward',
        category: 'referral_reward',
        // One reward per user per referral
        idempotencyKey: referralLogId ? `referral_reward:${referralLogId}:${id}` : undefined,
        metadata: metadata || {}
    });
    return { wallet: await getUserWallet(id) };
};

export const createWalletTopupOrder = async (userId, amountInr) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
    }
    if (amount > 50000) {
        throw new ValidationError('Maximum amount is 50,000');
    }

    const amountPaise = Math.round(amount * 100);

    if (!isRazorpayConfigured()) {
        // Dev fallback: return a compatible shape without writing to DB.
        const orderId = `order_dev_${Date.now()}`;
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId,
                amount: amountPaise,
                currency: 'INR'
            }
        };
    }

    const receipt = `wallet_topup_${String(userId).slice(-8)}_${Date.now()}`;
    const order = await createRazorpayOrder(amountPaise, 'INR', receipt);

    // Remember it: if the app dies after the customer pays, the webhook can still credit the wallet
    await PaymentIntent.create({
        kind: 'wallet_topup',
        ownerId: new mongoose.Types.ObjectId(String(userId)),
        gatewayOrderId: String(order.id),
        amountPaise: Number(order.amount) || amountPaise
    });

    return {
        razorpay: {
            key: getRazorpayKeyId(),
            orderId: String(order.id),
            amount: Number(order.amount) || amountPaise,
            currency: order.currency || 'INR'
        }
    };
};

/**
 * Credit a wallet top-up that Razorpay has captured. Shared by the verify endpoint and the
 * payment.captured webhook — whichever arrives first credits, the other is a harmless no-op
 * (ledger key wallet_topup:<gatewayOrderId>).
 */
export const creditTopupIntent = async (intent, { gatewayPaymentId, amountPaise, source }) => {
    await creditWallet({
        entityId: String(intent.ownerId),
        amount: fromPaise(amountPaise),
        description: 'Wallet top-up',
        category: 'wallet_topup',
        idempotencyKey: `wallet_topup:${intent.gatewayOrderId}`,
        gatewayOrderId: intent.gatewayOrderId,
        gatewayPaymentId,
        metadata: { mode: 'razorpay', via: source, userId: String(intent.ownerId) }
    });
    await PaymentIntent.updateOne(
        { _id: intent._id, status: 'created' },
        { $set: { status: 'completed', gatewayPaymentId, completedAt: new Date(), completedVia: source } }
    );
};

export const verifyWalletTopupPayment = async (userId, payload) => {
    const id = assertUserId(userId);
    const orderId = String(payload?.razorpayOrderId || '').trim();
    const paymentId = String(payload?.razorpayPaymentId || '').trim();
    const signature = String(payload?.razorpaySignature || '').trim();
    let amount = Number(payload?.amount);

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');
    if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('amount is required');

    const configured = isRazorpayConfigured();

    if (configured) {
        if (!verifyPaymentSignature(orderId, paymentId, signature)) {
            throw new ValidationError('Payment verification failed');
        }

        // Never trust the amount sent by the client: read it from the gateway.
        let gatewayPayment;
        try {
            gatewayPayment = await fetchRazorpayPayment(paymentId);
        } catch {
            throw new ValidationError('Could not verify payment with the gateway. Please try again.');
        }
        if (String(gatewayPayment?.order_id || '') !== orderId) {
            throw new ValidationError('Payment does not belong to this order');
        }
        if (String(gatewayPayment?.status || '').toLowerCase() !== 'captured') {
            throw new ValidationError('Payment is not captured yet. Please try again in a moment.');
        }
        amount = Number(gatewayPayment.amount) / 100;

        // Only top-up orders WE created for THIS user can be credited. (Otherwise a payment made
        // for something else on our Razorpay account could be replayed here as a top-up.)
        const intent = await PaymentIntent.findOne({ gatewayOrderId: orderId, kind: 'wallet_topup' }).lean();
        if (!intent || String(intent.ownerId) !== id) {
            throw new ValidationError('Unknown top-up order');
        }
        if (Number(gatewayPayment.amount) !== intent.amountPaise) {
            throw new ValidationError('Payment amount does not match the top-up order');
        }
        await creditTopupIntent(intent, {
            gatewayPaymentId: paymentId,
            amountPaise: Number(gatewayPayment.amount),
            source: 'verify_api'
        });
        return { wallet: await getUserWallet(id) };
    }

    // Dev mode (Razorpay not configured): credit once per dev order id
    await creditWallet({
        entityId: id,
        amount,
        description: configured ? 'Wallet top-up' : 'Wallet top-up (dev)',
        category: 'wallet_topup',
        idempotencyKey: `wallet_topup:${orderId}`,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        metadata: { mode: configured ? 'razorpay' : 'dev', userId: id }
    });

    return { wallet: await getUserWallet(id) };
};

export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}, { session = null } = {}) => {
    const id = assertUserId(userId);
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const orderId = idOf(metadata?.orderId);
    try {
        await debitWallet({
                entityId: id,
            amount,
            description,
            category: 'order_payment',
            orderId: orderId || undefined,
            // One wallet payment per order
            idempotencyKey: orderId ? `order_payment:${orderId}` : undefined,
            session,
            metadata: metadata || {}
        });
    } catch (err) {
        if (err instanceof InsufficientBalanceError) {
            throw new ValidationError('Insufficient wallet balance');
        }
        throw err;
    }

    return { wallet: await getUserWallet(id) };
};

export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}, { session = null, idempotencyKey } = {}) => {
    const id = assertUserId(userId);
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(id) };
    }

    const orderId = idOf(metadata?.orderId);
    await creditWallet({
        entityId: id,
        amount,
        description,
        category: 'order_refund',
        orderId: orderId || undefined,
        // One wallet refund per order
        idempotencyKey: idempotencyKey || (orderId ? `order_refund:${orderId}` : undefined),
        session,
        metadata: metadata || {}
    });

    return { wallet: await getUserWallet(id) };
};

export const topupUserWalletByAdmin = async (userId, amountInr, adminId, description = 'Admin Top-up') => {
    const id = assertUserId(userId);
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid top-up amount');
    }

    await creditWallet({
        entityId: id,
        amount,
        description,
        category: 'admin_topup',
        metadata: { adminId: idOf(adminId) }
    });

    return { wallet: await getUserWallet(id) };
};
