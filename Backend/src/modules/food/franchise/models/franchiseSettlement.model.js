import mongoose from 'mongoose';

export const SETTLEMENT_STATUSES = [
    'payout_pending', // HQ owes the franchise; waiting for HQ to pay
    'paid', // HQ paid the franchise
    'carried_forward', // franchise owes HQ; carried into the next settlement
    'zero' // nothing to pay either way
];

/**
 * One settlement run for a franchise. Orders, cash deposits and adjustments included here are
 * stamped with this id, so nothing is ever settled twice.
 */
const franchiseSettlementSchema = new mongoose.Schema(
    {
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodFranchise', required: true, index: true },
        number: { type: Number, required: true },
        /** Orders delivered up to this time were included. */
        cutoffAt: { type: Date, required: true },
        orders: {
            count: { type: Number, default: 0 },
            onlineCount: { type: Number, default: 0 },
            cashCount: { type: Number, default: 0 },
            customerPaid: { type: Number, default: 0 },
            cashCollected: { type: Number, default: 0 },
            restaurantShare: { type: Number, default: 0 },
            riderShare: { type: Number, default: 0 },
            franchiseGross: { type: Number, default: 0 },
            hqShare: { type: Number, default: 0 },
            /** What the orders alone mean: + HQ owes franchise, - franchise owes HQ. */
            net: { type: Number, default: 0 }
        },
        riderCashDeposited: { type: Number, default: 0 },
        adjustmentsTotal: { type: Number, default: 0 },
        openingBalance: { type: Number, default: 0 },
        netPayable: { type: Number, required: true },
        status: { type: String, enum: SETTLEMENT_STATUSES, required: true, index: true },
        /** Set when the franchise had overdue restaurant / rider payouts at run time. */
        overduePayouts: { type: Number, default: 0 },
        paidAt: { type: Date, default: null },
        utr: { type: String, trim: true, default: '' },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null },
        createdBy: {
            role: { type: String, default: 'SYSTEM' },
            id: { type: mongoose.Schema.Types.ObjectId, default: null }
        }
    },
    { collection: 'food_franchise_settlements', timestamps: true }
);

franchiseSettlementSchema.index({ franchiseId: 1, number: 1 }, { unique: true });

export const FoodFranchiseSettlement = mongoose.model('FoodFranchiseSettlement', franchiseSettlementSchema);
