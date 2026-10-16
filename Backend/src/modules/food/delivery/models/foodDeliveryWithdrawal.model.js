import mongoose from 'mongoose';
import { roundMoneyPaths } from '../../../../utils/moneySchema.js';

const foodDeliveryWithdrawalSchema = new mongoose.Schema({
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodDeliveryPartner',
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
    upiId: String,
    upiQrCode: String,
    adminNote: String,
    rejectionReason: String,
    transactionId: String, // Final bank transaction reference from admin
    /** Client-supplied request id: replaying the same request returns the same withdrawal */
    idempotencyKey: { type: String, default: undefined, trim: true },
    processedAt: Date
}, { 
    collection: 'payment_delivery_withdrawals', 
    timestamps: true 
});

foodDeliveryWithdrawalSchema.index({ createdAt: -1 });
foodDeliveryWithdrawalSchema.index(
    { deliveryPartnerId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

roundMoneyPaths(foodDeliveryWithdrawalSchema, ["amount"]);

export const FoodDeliveryWithdrawal = mongoose.model('FoodDeliveryWithdrawal', foodDeliveryWithdrawalSchema);
