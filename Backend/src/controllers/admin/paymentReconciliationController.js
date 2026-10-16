import mongoose from 'mongoose';
import { reconcileWallets, reconcileOrders, repairOrder } from '../../core/payments/reconciliation.service.js';
import { getLatestReport, getReportHistory, runFullReconciliation } from '../../core/payments/reconciliation.job.js';

// GET /food/admin/payments/reconciliation?entityType=user|restaurant|deliveryBoy|admin
export const getWalletReconciliation = async (req, res, next) => {
    try {
        const allowed = ['user', 'restaurant', 'deliveryBoy', 'admin'];
        const entityType = allowed.includes(req.query.entityType) ? req.query.entityType : undefined;
        const data = await reconcileWallets({ entityType });
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// GET /food/admin/payments/reconciliation/orders?checkGateway=true
// Finds order / finance-record / ledger / gateway inconsistencies (read-only).
export const getOrderReconciliation = async (req, res, next) => {
    try {
        const data = await reconcileOrders({
            checkGateway: String(req.query.checkGateway || '') === 'true',
            limit: Math.min(Number(req.query.limit) || 500, 2000)
        });
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// POST /food/admin/payments/reconciliation/orders/:orderId/repair
// Applies every safe, idempotent repair for one order and reports what it did.
export const repairOrderFinance = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order id' });
        }
        const data = await repairOrder(new mongoose.Types.ObjectId(orderId));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// GET /food/admin/payments/reconciliation/report/latest?kind=full|self_heal
// The latest scheduled run: what it found, what it repaired, and what still needs a human.
export const getLatestReconciliationReport = async (req, res, next) => {
    try {
        const kind = ['full', 'self_heal', 'manual'].includes(req.query.kind) ? req.query.kind : undefined;
        res.json({ success: true, data: await getLatestReport(kind) });
    } catch (error) {
        next(error);
    }
};

// POST /food/admin/payments/reconciliation/run
// Run the full reconciliation now (same job the scheduler runs hourly).
export const runReconciliationNow = async (req, res, next) => {
    try {
        const report = await runFullReconciliation('manual');
        if (!report) return res.status(409).json({ success: false, message: 'A reconciliation run is already in progress' });
        res.json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// GET /food/admin/payments/reconciliation/reports?limit=20
export const listReconciliationReports = async (req, res, next) => {
    try {
        res.json({ success: true, data: await getReportHistory(req.query.limit) });
    } catch (error) {
        next(error);
    }
};
