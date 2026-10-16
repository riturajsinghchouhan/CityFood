import mongoose from 'mongoose';
import { withTransaction } from '../../utils/dbTransaction.js';

/**
 * Payout lock — makes "check the balance, then record a payout" race-free.
 *
 * Restaurant and rider balances are DERIVED (from orders, transactions, withdrawals), so there is
 * no wallet document to guard with an atomic $inc. Instead every payout write for one party first
 * touches that party's row in payment_payout_accounts inside a database transaction. Two
 * concurrent payouts for the same party then conflict on that row: one retries until the other
 * has committed, and so always sees the other's withdrawal when it re-checks the balance.
 *
 * Without database transactions (local dev only) there is no lock — production requires them.
 */
const payoutAccountSchema = new mongoose.Schema(
    {
        partyType: { type: String, enum: ['restaurant', 'deliveryBoy'], required: true },
        partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
        seq: { type: Number, default: 0 }
    },
    { collection: 'payment_payout_accounts', timestamps: true }
);
payoutAccountSchema.index({ partyType: 1, partyId: 1 }, { unique: true });

export const PayoutAccount = mongoose.models.PayoutAccount || mongoose.model('PayoutAccount', payoutAccountSchema);

async function ensureAccount(partyType, partyId) {
    try {
        await PayoutAccount.updateOne({ partyType, partyId }, { $setOnInsert: { seq: 0 } }, { upsert: true });
    } catch (err) {
        if (err?.code !== 11000) throw err; // another request created it first
    }
}

/**
 * Run `fn(session)` while holding the payout lock for one restaurant / rider.
 * Everything fn writes with `session` commits or rolls back together.
 */
export async function withPayoutLock(partyType, partyId, fn) {
    const id = new mongoose.Types.ObjectId(String(partyId));
    await ensureAccount(partyType, id);
    return withTransaction(async (session) => {
        if (session) {
            // The write conflict on this row is what serialises concurrent payouts
            await PayoutAccount.updateOne({ partyType, partyId: id }, { $inc: { seq: 1 } }, { session });
        }
        return fn(session);
    });
}
