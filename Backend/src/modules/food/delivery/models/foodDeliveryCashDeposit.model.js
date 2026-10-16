import mongoose from 'mongoose';
import { roundMoneyPaths } from '../../../../utils/moneySchema.js';

const foodDeliveryCashDepositSchema = new mongoose.Schema({
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodDeliveryPartner',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'razorpay', 'upi', 'bank_transfer'],
        default: 'cash'
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending',
        index: true
    },
    razorpayOrderId: {
        type: String,
        default: ''
    },
    razorpayPaymentId: String,
    /** Set for admin-recorded deposits so a repeated submit cannot record the cash twice */
    idempotencyKey: { type: String, default: undefined, trim: true },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminNote: String
}, { 
    collection: 'payment_delivery_cash_deposits', 
    timestamps: true 
});

foodDeliveryCashDepositSchema.index({ createdAt: -1 });
// One Razorpay payment can be recorded as exactly one cash deposit
foodDeliveryCashDepositSchema.index(
    { razorpayPaymentId: 1 },
    { unique: true, partialFilterExpression: { razorpayPaymentId: { $gt: '' } } }
);
foodDeliveryCashDepositSchema.index(
    { deliveryPartnerId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

roundMoneyPaths(foodDeliveryCashDepositSchema, ["amount"]);

export const FoodDeliveryCashDeposit = mongoose.model('FoodDeliveryCashDeposit', foodDeliveryCashDepositSchema);
