import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { withPayoutLock } from '../../../../core/payments/payoutLock.js';
import { getRestaurantBalances } from '../../../../core/payments/payoutBalances.service.js';
import { sessionOpts } from '../../../../utils/dbTransaction.js';
import { round2, gtMoney, isPositiveMoney } from '../../../../utils/money.js';

/**
 * A restaurant asks to withdraw money.
 *
 * - The balance check and the insert happen while holding the restaurant's payout lock, so two
 *   simultaneous requests can never both pass the check and jointly over-withdraw.
 * - Send the same `idempotencyKey` (header Idempotency-Key / body.requestId) when retrying and you
 *   get the original request back instead of a second one.
 */
export async function requestRestaurantWithdrawal(restaurantId, { amount, bankDetails, idempotencyKey } = {}) {
    const value = round2(amount);
    if (!isPositiveMoney(value)) throw new ValidationError('Invalid withdrawal amount');

    const key = idempotencyKey ? String(idempotencyKey).slice(0, 100) : undefined;
    if (key) {
        const existing = await FoodRestaurantWithdrawal.findOne({ restaurantId, idempotencyKey: key }).lean();
        if (existing) return { withdrawal: existing, duplicate: true };
    }

    try {
        const withdrawal = await withPayoutLock('restaurant', restaurantId, async (session) => {
            const { available } = await getRestaurantBalances(restaurantId);
            if (gtMoney(value, available)) {
                throw new ValidationError(`Insufficient balance. Available: ₹${available}`);
            }
            const [created] = await FoodRestaurantWithdrawal.create(
                [{ restaurantId, amount: value, bankDetails, status: 'pending', idempotencyKey: key }],
                sessionOpts(session)
            );
            return created;
        });
        return { withdrawal, duplicate: false };
    } catch (err) {
        // The same request id arrived twice at the same moment
        if (err?.code === 11000 && key) {
            const existing = await FoodRestaurantWithdrawal.findOne({ restaurantId, idempotencyKey: key }).lean();
            if (existing) return { withdrawal: existing, duplicate: true };
        }
        throw err;
    }
}
