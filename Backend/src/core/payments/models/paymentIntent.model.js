import mongoose from 'mongoose';

/**
 * PaymentIntent — "we asked Razorpay to collect X for this purpose".
 *
 * Wallet top-ups and rider cash deposits are paid in the app, then the app calls a verify endpoint.
 * If the app dies in between, the money is at Razorpay but nothing here knows about it. The intent
 * is written when the Razorpay order is created, so:
 *   1. the payment.captured webhook can finish the job on its own, and
 *   2. verify can refuse payments for orders we never created (an attacker cannot replay a payment
 *      made for something else as a top-up).
 * Crediting is idempotent (ledger key / unique payment id), so verify and the webhook can both run.
 */
const paymentIntentSchema = new mongoose.Schema(
    {
        kind: { type: String, enum: ['wallet_topup', 'rider_cash_deposit'], required: true },
        /** The user (wallet top-up) or delivery partner (cash deposit) who is paying */
        ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        gatewayOrderId: { type: String, required: true, trim: true },
        /** Amount the Razorpay order was created for, in whole paise */
        amountPaise: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'amountPaise must be whole paise' } },
        status: { type: String, enum: ['created', 'completed'], default: 'created', index: true },
        gatewayPaymentId: { type: String, default: '' },
        completedAt: { type: Date, default: null },
        completedVia: { type: String, enum: ['', 'verify_api', 'webhook', 'reconciliation'], default: '' }
    },
    { collection: 'payment_intents', timestamps: true }
);

paymentIntentSchema.index({ gatewayOrderId: 1 }, { unique: true });
paymentIntentSchema.index({ status: 1, createdAt: 1 });

export const PaymentIntent = mongoose.models.PaymentIntent || mongoose.model('PaymentIntent', paymentIntentSchema);
