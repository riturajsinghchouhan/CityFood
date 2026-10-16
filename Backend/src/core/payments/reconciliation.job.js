import { FoodTransaction } from '../../modules/food/orders/models/foodTransaction.model.js';
import * as financeService from '../../modules/food/orders/services/finance.service.js';
import { PaymentReconciliationReport } from './models/reconciliationReport.model.js';
import { acquireJobLock, releaseJobLock } from './jobLock.js';
import { reconcileOrders, reconcileWallets, repairOrder } from './reconciliation.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Scheduled payment reconciliation.
 *
 *  - runSelfHealing()        every few minutes: finish stuck refunds, fix order snapshots,
 *                            refund money taken for cancelled orders. Local checks only.
 *  - runFullReconciliation() hourly: everything above PLUS asks Razorpay whether any "unpaid"
 *                            online order was actually paid, PLUS wallet-vs-ledger.
 *
 * Every repair is idempotent. Each run writes a PaymentReconciliationReport; anything that could
 * not be repaired automatically is logged as an error (and POSTed to PAYMENT_ALERT_WEBHOOK_URL if set).
 */

const MIN_AGE_MINUTES = 3; // never touch something a request may still be working on
const MAX_REPAIRS_PER_RUN = 100;
const STUCK_REFUND_MINUTES = 15;

async function alert(text) {
    logger.error(`[PaymentReconciliation] ${text}`);
    const url = process.env.PAYMENT_ALERT_WEBHOOK_URL;
    if (!url || typeof fetch !== 'function') return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: `[CityFood payments] ${text}` })
        });
    } catch (err) {
        logger.warn(`[PaymentReconciliation] alert webhook failed: ${err?.message || err}`);
    }
}

/** Finish refunds that were claimed but never completed. */
async function recoverStuckRefunds(limit = 50) {
    const before = new Date(Date.now() - STUCK_REFUND_MINUTES * 60 * 1000);
    const stuck = await FoodTransaction.find({ 'refund.status': { $in: ['initiated', 'pending'] }, updatedAt: { $lt: before } })
        .select('orderId')
        .limit(limit)
        .lean();

    const results = [];
    for (const t of stuck) {
        try {
            results.push({ orderId: String(t.orderId), actions: [{ action: 'recover_refund', ...(await financeService.recoverStuckRefund(t.orderId)) }] });
        } catch (err) {
            results.push({ orderId: String(t.orderId), error: err?.message || String(err) });
        }
    }
    return results;
}

/** Repair every auto-repairable order issue (one repairOrder per order). */
async function repairIssues(issues, max = MAX_REPAIRS_PER_RUN, alreadyHandled = new Set()) {
    const orderIds = [...new Set(issues.filter((i) => i.repairable && !alreadyHandled.has(i.orderId)).map((i) => i.orderId))].slice(0, max);
    const results = [];
    for (const orderId of orderIds) {
        try {
            results.push(await repairOrder(orderId));
        } catch (err) {
            results.push({ orderId, error: err?.message || String(err) });
        }
    }
    return results;
}

async function execute(kind, lockName, lockTtlMs, work) {
    if (!(await acquireJobLock(lockName, lockTtlMs))) {
        logger.info(`[PaymentReconciliation] ${kind} skipped: another run holds the lock`);
        return null;
    }

    const startedAt = new Date();
    const report = { kind, startedAt, ok: true };
    try {
        Object.assign(report, await work());
    } catch (err) {
        report.ok = false;
        report.error = String(err?.message || err).slice(0, 500);
        await alert(`${kind} run FAILED: ${report.error}`);
    } finally {
        report.finishedAt = new Date();
        report.durationMs = report.finishedAt - startedAt;
        try {
            await PaymentReconciliationReport.create(report);
        } catch (err) {
            logger.warn(`[PaymentReconciliation] could not save report: ${err?.message || err}`);
        }
        await releaseJobLock(lockName).catch(() => {});
    }

    if (report.remainingCritical > 0) {
        await alert(`${report.remainingCritical} critical payment issue(s) remain after auto-repair (${kind}). Check /food/admin/payments/reconciliation/report/latest`);
    }
    return report;
}

/** Local-only, frequent. */
export const runSelfHealing = () =>
    execute('self_heal', 'payment-self-heal', 9 * 60 * 1000, async () => {
        const stuck = await recoverStuckRefunds();
        const found = await reconcileOrders({ limit: 300, minAgeMinutes: MIN_AGE_MINUTES });
        const handled = new Set(stuck.map((r) => r.orderId));
        const repairs = [...stuck, ...(await repairIssues(found.issues, MAX_REPAIRS_PER_RUN, handled))];

        // Re-check to see what repair could not fix
        const after = repairs.length ? await reconcileOrders({ limit: 300, minAgeMinutes: MIN_AGE_MINUTES }) : found;
        return {
            issueTotal: found.total,
            criticalTotal: found.issues.filter((i) => i.severity === 'critical').length,
            counts: found.counts,
            repairs,
            remaining: after.issues.slice(0, 100),
            remainingCritical: after.issues.filter((i) => i.severity === 'critical').length
        };
    });

/** Everything, including the gateway and the wallet ledger. */
export const runFullReconciliation = (kind = 'full') =>
    execute(kind, 'payment-full-reconcile', 25 * 60 * 1000, async () => {
        const wallets = await reconcileWallets();
        const stuck = await recoverStuckRefunds(100);
        const found = await reconcileOrders({ limit: 1000, checkGateway: true, minAgeMinutes: MIN_AGE_MINUTES });
        const handled = new Set(stuck.map((r) => r.orderId));
        const repairs = [...stuck, ...(await repairIssues(found.issues, MAX_REPAIRS_PER_RUN, handled))];
        const after = await reconcileOrders({ limit: 1000, checkGateway: true, minAgeMinutes: MIN_AGE_MINUTES });

        // Wallet mismatches cannot be auto-repaired (they mean money moved outside the ledger): always alert
        const remainingCritical = after.issues.filter((i) => i.severity === 'critical').length + wallets.mismatched;
        return {
            issueTotal: found.total,
            criticalTotal: found.issues.filter((i) => i.severity === 'critical').length,
            counts: found.counts,
            walletMismatches: wallets.mismatched,
            repairs,
            remaining: [...wallets.mismatches.map((m) => ({ type: 'wallet_ledger_mismatch', severity: 'critical', ...m })), ...after.issues].slice(0, 100),
            remainingCritical
        };
    });

export const getLatestReport = (kind) =>
    PaymentReconciliationReport.findOne(kind ? { kind } : {}).sort({ createdAt: -1 }).lean();

/** Recent runs, newest first (for the admin screen's history tab). */
export const getReportHistory = (limit = 20) =>
    PaymentReconciliationReport.find({})
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(Number(limit) || 20, 1), 100))
        .select('kind startedAt finishedAt durationMs ok error issueTotal criticalTotal counts walletMismatches repairs remainingCritical')
        .lean();
