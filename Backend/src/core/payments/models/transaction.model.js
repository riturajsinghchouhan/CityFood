import mongoose from 'mongoose';

/**
 * Transaction — universal financial ledger.
 * Every credit/debit across all entity types (user, restaurant, deliveryBoy, admin)
 * gets a row here. This is the single source of truth for money movement.
 *
 * RULE: Never update Wallet.balance directly — always go through
 *       transaction.service.recordTransaction() which atomically creates
 *       a Transaction row + updates the matching Wallet.
 */
const integerPaise = {
    validator: Number.isInteger,
    message: '{PATH} must be a whole number of paise'
};

const transactionSchema = new mongoose.Schema(
    {
        /** Link to the order (optional — wallet top-ups / adjustments may not have an order) */
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodOrder',
            default: null,
            index: true
        },

        /** Which type of entity this transaction belongs to */
        entityType: {
            type: String,
            enum: ['user'],
            required: true,
            index: true
        },
        /** ObjectId of the entity (userId, restaurantId, deliveryPartnerId, or admin id) */
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },

        /** Amount in INTEGER PAISE (1 rupee = 100). Integers never drift. */
        amountPaise: { type: Number, required: true, min: 1, validate: integerPaise },
        /** Wallet balance AFTER this transaction was applied, in integer paise — set atomically */
        balanceAfterPaise: { type: Number, required: true, min: 0, validate: integerPaise },

        currency: { type: String, default: 'INR', trim: true },

        status: {
            type: String,
            enum: ['completed', 'pending', 'failed', 'reversed'],
            default: 'completed',
            index: true
        },

        /** Human-readable description shown in wallet history */
        description: { type: String, default: '', trim: true },

        /** Category for easier filtering / reporting */
        category: {
            type: String,
            enum: [
                'order_payment',
                'order_refund',
                'wallet_topup',
                'wallet_debit',
                'referral_reward',
                'admin_topup',
                'adjustment',
                'other'
            ],
            default: 'other'
        },

        module: { type: String, default: 'food', trim: true },

        /**
         * Idempotency key — a unique, deterministic id for the real-world event behind this row
         * (e.g. "order_refund:<orderId>"). Replaying the same event can never create a second row
         * or move money twice. Enforced by a unique index below.
         */
        idempotencyKey: { type: String, default: undefined, trim: true },

        /** Gateway references (wallet top-ups) for support and reconciliation */
        gatewayOrderId: { type: String, default: undefined, trim: true },
        gatewayPaymentId: { type: String, default: undefined, trim: true },

        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    { collection: 'payment_transactions', timestamps: true }
);

transactionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
transactionSchema.index({ orderId: 1, entityType: 1 });
// Unique only when a key is present (rows without one stay allowed)
transactionSchema.index(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
transactionSchema.index({ gatewayPaymentId: 1 }, { sparse: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);
