import mongoose from 'mongoose';

/**
 * One row per scheduled reconciliation run — the paper trail that proves the money side was checked,
 * what was found, and what was repaired automatically.
 */
const reconciliationReportSchema = new mongoose.Schema(
    {
        kind: { type: String, enum: ['self_heal', 'full', 'manual'], required: true, index: true },
        startedAt: { type: Date, required: true },
        finishedAt: { type: Date, default: null },
        durationMs: { type: Number, default: 0 },
        ok: { type: Boolean, default: true },
        error: { type: String, default: '' },

        /** Issues found BEFORE auto-repair */
        issueTotal: { type: Number, default: 0 },
        criticalTotal: { type: Number, default: 0 },
        counts: { type: mongoose.Schema.Types.Mixed, default: {} },
        walletMismatches: { type: Number, default: 0 },

        /** What auto-repair did (one entry per order) */
        repairs: { type: [mongoose.Schema.Types.Mixed], default: [] },
        /** Issues still unresolved after the repair pass (capped sample) */
        remaining: { type: [mongoose.Schema.Types.Mixed], default: [] },
        remainingCritical: { type: Number, default: 0 }
    },
    { collection: 'payment_reconciliation_reports', timestamps: true }
);

reconciliationReportSchema.index({ kind: 1, createdAt: -1 });

export const PaymentReconciliationReport =
    mongoose.models.PaymentReconciliationReport || mongoose.model('PaymentReconciliationReport', reconciliationReportSchema);
