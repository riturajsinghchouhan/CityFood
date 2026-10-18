import mongoose from 'mongoose';

export const ADJUSTMENT_TYPES = [
    'SUBSCRIPTION_FEE', // HQ charges the subscription for a period (negative)
    'PAYMENT_RECEIVED', // franchise paid what it owed HQ (positive)
    'HQ_PAID_PAYOUT', // HQ paid a restaurant / rider on the franchise's behalf (negative)
    'WITHDRAWAL_PAID', // HQ paid the franchise's withdrawal request (negative)
    'MANUAL' // anything else HQ records: penalty, refund share, bonus (either sign)
];

/**
 * One money movement between HQ and a franchise that is not an order.
 * Sign convention: positive = HQ owes the franchise more, negative = franchise owes HQ more.
 * It is picked up by the next settlement (settlementId set) and never edited after that.
 */
const franchiseAdjustmentSchema = new mongoose.Schema(
    {
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodFranchise', required: true, index: true },
        type: { type: String, enum: ADJUSTMENT_TYPES, required: true },
        amount: { type: Number, required: true },
        note: { type: String, trim: true, default: '' },
        /** Natural key for automatic entries (e.g. "SUB:2026-11-01", "WD:<withdrawalId>") so they are created once. */
        ref: { type: String, trim: true, default: undefined },
        utr: { type: String, trim: true, default: '' },
        settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodFranchiseSettlement', default: null, index: true },
        createdBy: {
            role: { type: String, default: 'SYSTEM' },
            id: { type: mongoose.Schema.Types.ObjectId, default: null }
        }
    },
    { collection: 'food_franchise_adjustments', timestamps: true }
);

franchiseAdjustmentSchema.index(
    { franchiseId: 1, ref: 1 },
    { unique: true, partialFilterExpression: { ref: { $type: 'string' } } }
);

export const FoodFranchiseAdjustment = mongoose.model('FoodFranchiseAdjustment', franchiseAdjustmentSchema);
