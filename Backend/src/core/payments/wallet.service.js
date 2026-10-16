import mongoose from 'mongoose';
import { recordTransaction, getBalance, getTransactionsByEntity } from './transaction.service.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { fromPaise } from '../../utils/money.js';

/**
 * Customer wallet facade. Every balance change goes through the ledger
 * (payment_transactions) — it is the single source of truth for wallet money.
 */

const toPayload = (type, {
    entityId, amount, description,
    category = 'other', orderId, metadata,
    idempotencyKey, gatewayOrderId, gatewayPaymentId, session
}) => ({
    entityId: String(entityId),
    type,
    amount: Number(amount),
    description,
    category,
    orderId: orderId ? String(orderId) : null,
    idempotencyKey,
    gatewayOrderId,
    gatewayPaymentId,
    session,
    metadata
});

/** Credit a user's wallet. Pass `idempotencyKey` so a retry can never credit twice. */
export async function creditWallet(params) {
    return recordTransaction(toPayload('credit', params));
}

/** Debit a user's wallet. Pass `idempotencyKey` so a retry can never debit twice. */
export async function debitWallet(params) {
    return recordTransaction(toPayload('debit', params));
}

export async function getWalletBalance(userId) {
    return getBalance(userId);
}

const TYPE_FOR_FRONTEND = (t) => {
    if (t.category === 'order_refund') return 'refund';
    return t.type === 'credit' ? 'addition' : 'deduction';
};

/**
 * Wallet + transactions in the shape the frontend expects.
 * Balance comes from the wallet; history comes ONLY from the ledger.
 */
export async function getUserWalletForFrontend(userId, { limit = 100 } = {}) {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return { balance: 0, referralEarnings: 0, transactions: [] };
    }

    const [wallet, ledger] = await Promise.all([
        FoodUserWallet.findOne({ userId: new mongoose.Types.ObjectId(id) }).lean(),
        getTransactionsByEntity(id, { page: 1, limit })
    ]);

    const transactions = (ledger.transactions || []).map((t) => ({
        id: String(t._id),
        _id: t._id,
        type: TYPE_FOR_FRONTEND(t),
        amount: Number(t.amount) || 0,
        status: t.status === 'completed' ? 'Completed' : t.status,
        description: t.description || '',
        date: t.createdAt,
        createdAt: t.createdAt,
        category: t.category,
        balanceAfter: t.balanceAfter,
        razorpayOrderId: t.gatewayOrderId || null,
        razorpayPaymentId: t.gatewayPaymentId || null,
        metadata: { source: t.category, ...(t.metadata || {}) }
    }));

    return {
        balance: fromPaise(wallet?.balancePaise),
        referralEarnings: fromPaise(wallet?.referralEarningsPaise),
        transactions
    };
}
