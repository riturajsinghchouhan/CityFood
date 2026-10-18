import mongoose from 'mongoose';

/**
 * A franchise asks HQ to pay out its money (online-order earnings HQ is holding).
 * HQ approves with the bank / UPI reference, which records a WITHDRAWAL_PAID adjustment, or rejects.
 */
const franchiseWithdrawalSchema = new mongoose.Schema(
    {
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodFranchise', required: true, index: true },
        amount: { type: Number, required: true, min: [1, 'Minimum withdrawal is ₹1'] },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
        note: { type: String, trim: true, default: '' },
        /** Bank details at request time, so HQ pays where the franchise expects. */
        bank: {
            accountHolderName: { type: String, default: '' },
            accountNumber: { type: String, default: '' },
            ifscCode: { type: String, default: '' },
            bankName: { type: String, default: '' },
            upiId: { type: String, default: '' }
        },
        utr: { type: String, trim: true, default: '' },
        rejectionReason: { type: String, trim: true, default: '' },
        processedAt: { type: Date, default: null },
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null }
    },
    { collection: 'food_franchise_withdrawals', timestamps: true }
);

franchiseWithdrawalSchema.index({ status: 1, createdAt: -1 });

export const FoodFranchiseWithdrawal = mongoose.model('FoodFranchiseWithdrawal', franchiseWithdrawalSchema);
