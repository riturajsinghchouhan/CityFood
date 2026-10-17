import mongoose from 'mongoose';

/**
 * PaymentWebhookEvent — audit + idempotency record for every gateway webhook.
 * A unique (provider, fingerprint) index guarantees one event is processed once,
 * even if the gateway retries delivery or two servers receive it at the same time.
 */
const webhookEventSchema = new mongoose.Schema(
    {
        provider: { type: String, required: true, trim: true, index: true },
        eventType: { type: String, required: true, trim: true, index: true },
        /** Razorpay event id (x-razorpay-event-id) or, if absent, sha256 of the raw body */
        fingerprint: { type: String, required: true, trim: true },
        /** Gateway resource this event is about (payment id, refund id, ...) */
        resourceId: { type: String, default: '', trim: true, index: true },
        status: {
            type: String,
            enum: ['processing', 'processed', 'failed'],
            default: 'processing',
            index: true
        },
        /** sha256 of the raw body (audit; the fingerprint may be the gateway's own event id) */
        payloadHash: { type: String, default: '', trim: true },
        /** Order / transaction this event ended up touching (for support & reconciliation) */
        orderId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        attempts: { type: Number, default: 1 },
        processedAt: { type: Date, default: null },
        error: { type: String, default: '' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    { collection: 'payment_webhook_events', timestamps: true }
);

webhookEventSchema.index({ provider: 1, fingerprint: 1 }, { unique: true });

export const PaymentWebhookEvent = mongoose.model('PaymentWebhookEvent', webhookEventSchema);
