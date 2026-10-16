import mongoose from 'mongoose';
import { Transaction } from './models/transaction.model.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { logger } from '../../utils/logger.js';
import { toPaise, fromPaise } from '../../utils/money.js';
import { sessionOpts } from '../../utils/dbTransaction.js';

/**
 * LEDGER — the customer wallet is the only stored-value account in the system, so it is the
 * only thing with a wallet + ledger. Restaurant and rider money is NOT stored as a balance:
 * it is always derived from payment_food_transactions / orders / withdrawals (one source of
 * truth, nothing to drift).
 *
 * Wallet and ledger amounts are stored as INTEGER PAISE. Callers and API responses speak rupees;
 * conversion happens only in this file and the wallet facade.
 */

const toUserFilter = (entityId) => ({ userId: new mongoose.Types.ObjectId(entityId) });

export class InsufficientBalanceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InsufficientBalanceError';
    }
}

/** A ledger row in the shape the rest of the app expects (rupees). */
export const toLedgerView = (row) => ({
    ...row,
    amount: fromPaise(row.amountPaise),
    balanceAfter: fromPaise(row.balanceAfterPaise)
});

/**
 * Ensure the user's wallet exists (race-safe). Returns the wallet document.
 */
export async function ensureWallet(entityId, session = null) {
    const filter = toUserFilter(entityId);
    try {
        await FoodUserWallet.updateOne(filter, { $setOnInsert: { balancePaise: 0, referralEarningsPaise: 0 } }, { upsert: true, ...sessionOpts(session) });
    } catch (err) {
        // Without a session another request may have created it first; inside a transaction
        // a duplicate key aborts the whole transaction, so let that surface.
        if (err?.code !== 11000 || session) throw err;
    }
    return FoodUserWallet.findOne(filter).session(session || null);
}

/** Wallet balance (rupees) for a user. */
export async function getBalance(entityId) {
    const wallet = await ensureWallet(entityId);
    return { balance: fromPaise(wallet.balancePaise) };
}

/** Find a ledger row by its idempotency key. */
export async function findTransactionByKey(idempotencyKey, session = null) {
    if (!idempotencyKey) return null;
    return Transaction.findOne({ idempotencyKey: String(idempotencyKey) }).session(session || null).lean();
}

const duplicateResult = (existing) => ({
    transaction: toLedgerView(existing),
    wallet: { balance: fromPaise(existing.balanceAfterPaise) },
    duplicate: true
});

/**
 * CORE OPERATION: record a ledger row AND move the customer's wallet balance.
 * This is the ONLY way the wallet balance may change.
 *
 * Guarantees
 *  - Exact: amounts are whole paise, so there is no floating-point drift.
 *  - Atomic balance change: one findOneAndUpdate with $inc (no read-modify-write), and a
 *    debit can never take a wallet below zero (guarded inside the same operation).
 *  - Idempotent: pass `idempotencyKey` (a deterministic id for the real-world event).
 *    Replaying the same key returns the original row and moves no money. A unique index
 *    on the key keeps this safe under concurrent requests as well.
 *  - If the ledger insert fails after the balance moved, the balance change is reversed.
 *  - Pass `session` to join a surrounding database transaction (all-or-nothing).
 *
 * @param {Object} payload
 * @param {string} payload.entityId - the user id
 * @param {'credit'|'debit'} payload.type
 * @param {number} payload.amount - positive amount in RUPEES (converted to whole paise)
 * @param {string} [payload.description]
 * @param {string} [payload.category]
 * @param {string} [payload.orderId]
 * @param {string} [payload.idempotencyKey]
 * @param {string} [payload.gatewayOrderId]
 * @param {string} [payload.gatewayPaymentId]
 * @param {import('mongoose').ClientSession} [payload.session]
 * @param {Object} [payload.metadata]
 * @returns {Object} { transaction, wallet, duplicate? }  (rupees)
 */
export async function recordTransaction(payload) {
    const {
        entityId, type,
        description = '', category = 'other',
        orderId = null,
        idempotencyKey = undefined,
        gatewayOrderId = undefined, gatewayPaymentId = undefined,
        session = null,
        metadata = undefined, module = 'food'
    } = payload;
    const amountPaise = toPaise(payload.amount);

    if (!['credit', 'debit'].includes(type)) throw new Error('type must be credit or debit');
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new Error('amount must be positive');

    const key = idempotencyKey ? String(idempotencyKey) : undefined;
    if (key) {
        const existing = await findTransactionByKey(key, session);
        if (existing) return duplicateResult(existing);
    }

    const filter = toUserFilter(entityId);
    const isCredit = type === 'credit';

    // 1. Make sure the wallet exists
    await ensureWallet(entityId, session);

    // 2. Build the single atomic balance change (whole paise)
    const inc = { balancePaise: isCredit ? amountPaise : -amountPaise };
    if (isCredit && category === 'referral_reward') inc.referralEarningsPaise = amountPaise;

    const guard = { ...filter };
    if (!isCredit) guard.balancePaise = { $gte: amountPaise };

    const updated = await FoodUserWallet.findOneAndUpdate(guard, { $inc: inc }, { new: true, ...sessionOpts(session) });
    if (!updated) {
        // A debit can also "fail" simply because an identical request already succeeded
        if (key) {
            const existing = await findTransactionByKey(key, session);
            if (existing) return duplicateResult(existing);
        }
        const current = await FoodUserWallet.findOne(filter).session(session || null).select('balancePaise').lean();
        throw new InsufficientBalanceError(
            `Insufficient balance. Current: ${fromPaise(current?.balancePaise)}, Debit: ${fromPaise(amountPaise)}`
        );
    }

    // 3. Write the ledger row; undo the balance move if that fails
    let txn;
    try {
        [txn] = await Transaction.create([{
            orderId: orderId ? new mongoose.Types.ObjectId(orderId) : null,
            entityType: 'user',
            entityId: new mongoose.Types.ObjectId(entityId),
            type,
            amountPaise,
            balanceAfterPaise: updated.balancePaise,
            currency: 'INR',
            status: 'completed',
            description,
            category,
            module,
            idempotencyKey: key,
            gatewayOrderId: gatewayOrderId || undefined,
            gatewayPaymentId: gatewayPaymentId || undefined,
            metadata
        }], sessionOpts(session));
    } catch (err) {
        // Inside a transaction everything (including the balance move) is rolled back for us
        if (session) throw err;

        const reverse = Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, -v]));
        await FoodUserWallet.updateOne(filter, { $inc: reverse });

        if (err?.code === 11000 && key) {
            const existing = await findTransactionByKey(key);
            if (existing) return duplicateResult(existing);
        }
        logger.error(`recordTransaction failed: ${err.message}`);
        throw err;
    }

    logger.info(`Wallet ${type} ${fromPaise(amountPaise)} INR for user ${entityId} -> balance ${fromPaise(updated.balancePaise)}`);

    return {
        transaction: toLedgerView(txn.toObject()),
        wallet: { balance: fromPaise(updated.balancePaise) }
    };
}

/**
 * List a user's ledger rows with pagination (amounts in rupees).
 */
export async function getTransactionsByEntity(entityId, { page = 1, limit = 20 } = {}) {
    const skip = (Math.max(1, page) - 1) * limit;
    const filter = { entityType: 'user', entityId: new mongoose.Types.ObjectId(entityId) };

    const [docs, total] = await Promise.all([
        Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.countDocuments(filter)
    ]);

    return { transactions: docs.map(toLedgerView), total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Ledger rows linked to an order (amounts in rupees).
 */
export async function getTransactionsByOrder(orderId) {
    const rows = await Transaction.find({ orderId: new mongoose.Types.ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .lean();
    return rows.map(toLedgerView);
}
