import mongoose from 'mongoose';
import { fromPaise } from '../../../../utils/money.js';

const integerPaise = {
    validator: Number.isInteger,
    message: '{PATH} must be a whole number of paise'
};

/**
 * FoodUserWallet — balance summary ONLY, stored as INTEGER PAISE.
 *
 * Integers never drift: adding or subtracting whole paise is exact, so a balance cannot pick up
 * 0.30000000000000004-style errors however many transactions touch it. The rupee values are exposed
 * as the virtuals `balance` / `referralEarnings` (not available on lean reads — use fromPaise()).
 *
 * Transaction history lives in the payment_transactions ledger (single source of truth).
 * Never change the balance directly — use transaction.service.recordTransaction().
 */
const userWalletSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
        balancePaise: { type: Number, default: 0, min: 0, validate: integerPaise },
        referralEarningsPaise: { type: Number, default: 0, min: 0, validate: integerPaise }
    },
    {
        collection: 'payment_user_wallets',
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

userWalletSchema.virtual('balance').get(function balanceRupees() {
    return fromPaise(this.balancePaise);
});
userWalletSchema.virtual('referralEarnings').get(function referralRupees() {
    return fromPaise(this.referralEarningsPaise);
});

export const FoodUserWallet = mongoose.model('FoodUserWallet', userWalletSchema);
