import mongoose from 'mongoose';
import { roundMoneyPaths } from '../../../../utils/moneySchema.js';

const foodRestaurantWithdrawalSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodRestaurant',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Minimum withdrawal amount is ₹1']
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    paymentMethod: {
        type: String,
        default: 'bank_transfer'
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        accountHolderName: String
    },
    adminNote: String,
    rejectionReason: String,
    transactionId: String, // Final bank transaction reference from admin
    /** Client-supplied request id: replaying the same request returns the same withdrawal */
    idempotencyKey: { type: String, default: undefined, trim: true },
    processedAt: Date
}, { 
    collection: 'payment_restaurant_withdrawals', 
    timestamps: true 
});

foodRestaurantWithdrawalSchema.index({ createdAt: -1 });
foodRestaurantWithdrawalSchema.index(
    { restaurantId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

roundMoneyPaths(foodRestaurantWithdrawalSchema, ["amount"]);

export const FoodRestaurantWithdrawal = mongoose.model('FoodRestaurantWithdrawal', foodRestaurantWithdrawalSchema);
