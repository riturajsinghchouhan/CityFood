import mongoose from 'mongoose';
import { roundMoneyPaths } from '../../../../utils/moneySchema.js';

const foodTransactionSchema = new mongoose.Schema({
    // Identifiers
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true, unique: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', index: true },

    // Core Payment Info
    paymentMethod: { 
        type: String, 
        enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'], 
        default: 'pending',
        index: true 
    },
    currency: { type: String, default: 'INR' },

    // Snapshot of order pricing at the time transaction was created
    pricing: {
        subtotal: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        packagingFee: { type: Number, default: 0 },
        deliveryFee: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        restaurantCommission: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        currency: { type: String, default: 'INR', trim: true },
    },

    // Snapshot of payment state at the time of transaction (source of truth for UI)
    payment: {
        method: { type: String, default: 'cash', trim: true },
        status: { type: String, default: 'cod_pending', trim: true },
        amountDue: { type: Number, default: 0 },
        razorpay: {
            orderId: { type: String, default: '' },
            paymentId: { type: String, default: '' },
            signature: { type: String, default: '' }
        },
        qr: {
            qrId: { type: String, default: '' },
            imageUrl: { type: String, default: '' },
            amount: { type: Number, default: 0 },
            paymentLinkId: { type: String, default: '' },
            shortUrl: { type: String, default: '' },
            status: { type: String, default: '' },
            expiresAt: { type: Date, default: null }
        }
    },

    // Financial Breakdown (The Split)
    amounts: {
        totalCustomerPaid: { type: Number, required: true },
        restaurantShare: { type: Number, required: true },
        restaurantCommission: { type: Number, required: true },
        gstOnItem: { type: Number, default: 0 },
        gstOnCommission: { type: Number, default: 0 },
        paymentGatewayFee: { type: Number, default: 0 },
        tcs: { type: Number, default: 0 },
        riderShare: { type: Number, required: true },
        platformNetProfit: { type: Number, required: true },
        taxAmount: { type: Number, default: 0 }
    },

    // Gateway / Provider Metadata
    gateway: {
        provider: { type: String, default: 'razorpay' },
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        qrUrl: String,
        qrExpiresAt: Date
    },

    /**
     * Refund state — single place that describes where a refund stands.
     * none -> initiated -> (pending ->) processed, or failed (retryable).
     * Only finance.service.js writes this.
     */
    refund: {
        status: { type: String, enum: ['none', 'initiated', 'pending', 'processed', 'failed'], default: 'none' },
        destination: { type: String, enum: ['', 'wallet', 'source', 'manual', 'chargeback'], default: '' },
        amount: { type: Number, default: 0 },
        reason: { type: String, default: '' },
        gatewayRefundId: { type: String, default: '' },
        attempts: { type: Number, default: 0 },
        error: { type: String, default: '' },
        requestedAt: { type: Date, default: null },
        processedAt: { type: Date, default: null }
    },

    /**
     * Total refunded so far, in INTEGER PAISE. A payment may be refunded in several partial
     * refunds; when this reaches the amount paid, the transaction becomes 'refunded'.
     */
    refundedPaise: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'refundedPaise must be whole paise' } },

    /**
     * Every refund attempt, oldest first. `key` is the request id that makes a refund
     * idempotent ("full" for a full refund). Written only by finance.service.js.
     */
    refunds: [{
        key: { type: String, required: true },
        amount: { type: Number, required: true },
        destination: { type: String, enum: ['wallet', 'source', 'chargeback'], required: true },
        status: { type: String, enum: ['initiated', 'pending', 'processed', 'failed'], required: true },
        reason: { type: String, default: '' },
        ledgerKey: { type: String, default: '' },
        gatewayRefundId: { type: String, default: '' },
        error: { type: String, default: '' },
        requestedAt: { type: Date, default: Date.now },
        processedAt: { type: Date, default: null }
    }],

    /** Card-network chargeback state (Razorpay payment.dispute.* events). */
    dispute: {
        status: { type: String, enum: ['none', 'open', 'under_review', 'won', 'lost', 'closed'], default: 'none' },
        disputeId: { type: String, default: '' },
        amount: { type: Number, default: 0 },
        reasonCode: { type: String, default: '' },
        phase: { type: String, default: '' },
        respondBy: { type: Date, default: null },
        openedAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null }
    },

    // Settlement Tracking
    settlement: {
        isRestaurantSettled: { type: Boolean, default: false },
        restaurantSettledAt: Date,
        isRiderSettled: { type: Boolean, default: false },
        riderSettledAt: Date
    },

    // Audit History (Replacing FoodOrderPayment ledger)
    history: [{
        kind: { type: String, required: true }, // 'created', 'authorized', 'captured', 'refunded', 'settled'
        amount: Number,
        at: { type: Date, default: Date.now },
        note: String,
        /** Dedupe reference (webhook event id, gateway payment/refund id) */
        ref: { type: String, default: '' },
        recordedBy: { 
            role: { type: String }, 
            id: { type: mongoose.Schema.Types.ObjectId }
        }
    }]
}, { 
    collection: 'payment_food_transactions', 
    timestamps: true 
});

// Powerful indexes for Finance & Analytics
foodTransactionSchema.index({ createdAt: -1 });
foodTransactionSchema.index({ 'settlement.isRestaurantSettled': 1, restaurantId: 1 });
foodTransactionSchema.index({ 'status': 1, paymentMethod: 1 });
// Gateway lookups used by webhooks and reconciliation
foodTransactionSchema.index({ 'payment.razorpay.orderId': 1 }, { sparse: true });
foodTransactionSchema.index({ 'payment.qr.qrId': 1 }, { sparse: true });
foodTransactionSchema.index({ 'refund.status': 1, updatedAt: 1 });
// One Razorpay payment can pay for exactly one order
foodTransactionSchema.index(
    { 'gateway.razorpayPaymentId': 1 },
    { unique: true, partialFilterExpression: { 'gateway.razorpayPaymentId': { $gt: '' } } }
);

roundMoneyPaths(foodTransactionSchema, [
    'pricing.subtotal', 'pricing.tax', 'pricing.packagingFee', 'pricing.deliveryFee', 'pricing.platformFee',
    'pricing.restaurantCommission', 'pricing.discount', 'pricing.total',
    'amounts.totalCustomerPaid', 'amounts.restaurantShare', 'amounts.restaurantCommission', 'amounts.gstOnItem',
    'amounts.gstOnCommission', 'amounts.paymentGatewayFee', 'amounts.tcs', 'amounts.riderShare',
    'amounts.platformNetProfit', 'amounts.taxAmount',
    'payment.amountDue', 'payment.qr.amount', 'refund.amount', 'dispute.amount',
    'refunds.amount', 'history.amount'
]);

export const FoodTransaction = mongoose.model('FoodTransaction', foodTransactionSchema);
