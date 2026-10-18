import mongoose from 'mongoose';

export const FRANCHISE_STATUSES = ['active', 'grace', 'suspended', 'terminated'];
export const FRANCHISE_REVENUE_MODELS = ['COMMISSION', 'SUBSCRIPTION'];
export const FRANCHISE_SUBSCRIPTION_PLANS = ['MONTHLY', 'YEARLY'];

const franchiseSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, uppercase: true, unique: true },
        /** One franchise operates exactly one zone (e.g. "Indore"). */
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', required: true },
        owner: {
            name: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true },
            email: { type: String, trim: true, lowercase: true, default: '' }
        },
        business: {
            legalName: { type: String, trim: true, default: '' },
            gstNumber: { type: String, trim: true, uppercase: true, default: '' },
            panNumber: { type: String, trim: true, uppercase: true, default: '' },
            address: { type: String, trim: true, default: '' }
        },
        bank: {
            accountHolderName: { type: String, trim: true, default: '' },
            accountNumber: { type: String, trim: true, default: '' },
            ifscCode: { type: String, trim: true, uppercase: true, default: '' },
            bankName: { type: String, trim: true, default: '' },
            upiId: { type: String, trim: true, default: '' }
        },
        revenueModel: { type: String, enum: FRANCHISE_REVENUE_MODELS, required: true },
        /** COMMISSION model: HQ takes this % of the franchise's earning on every delivered order. */
        commissionPercent: { type: Number, min: 0, max: 100, default: 0 },
        /** SUBSCRIPTION model: fixed fee, HQ takes 0% per order. */
        subscription: {
            plan: { type: String, enum: FRANCHISE_SUBSCRIPTION_PLANS, default: 'MONTHLY' },
            amount: { type: Number, min: 0, default: 0 },
            /** Current paid-for period. The renewal job charges the next period when endDate passes. */
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null },
            autoRenew: { type: Boolean, default: true }
        },
        /**
         * Franchise-set pricing for its zone. null = use the HQ value from fee settings.
         * Applied to new orders only; each order keeps the fees it was placed with.
         */
        pricing: {
            deliveryFee: { type: Number, min: 0, default: null },
            deliveryFeeRanges: {
                type: [{ _id: false, min: { type: Number, min: 0 }, max: { type: Number, min: 0 }, fee: { type: Number, min: 0 } }],
                default: undefined
            },
            freeDeliveryUpTo: { type: Number, min: 0, default: null },
            platformFee: { type: Number, min: 0, default: null },
            packagingFee: { type: Number, min: 0, default: null },
            /** Default restaurant commission % for restaurants without their own commission rule. */
            restaurantCommissionPercent: { type: Number, min: 0, max: 100, default: null }
        },
        finance: {
            /** Days the franchise has to pay a restaurant / rider withdrawal before HQ is alerted. */
            payoutSlaDays: { type: Number, min: 1, default: 3 },
            /** How much the franchise may owe HQ before it moves to grace. */
            creditLimit: { type: Number, min: 0, default: 10000 },
            /** Orders are settled only after this many days, so refunds land first. */
            holdbackDays: { type: Number, min: 0, default: 7 },
            graceDays: { type: Number, min: 1, default: 7 }
        },
        status: { type: String, enum: FRANCHISE_STATUSES, default: 'active', index: true },
        /** Who set the current status. Automation only reverses statuses it set itself. */
        statusSource: { type: String, enum: ['HQ', 'SYSTEM'], default: 'HQ' },
        graceStartedAt: { type: Date, default: null },
        /** Mirrors status === 'terminated'; lets a zone be re-assigned after termination (see partial unique index). */
        isTerminated: { type: Boolean, default: false },
        statusReason: { type: String, trim: true, default: '' },
        startDate: { type: Date, default: Date.now },
        terminatedAt: { type: Date, default: null },
        notes: { type: String, trim: true, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', default: null }
    },
    {
        collection: 'food_franchises',
        timestamps: true
    }
);

// A zone can belong to only one non-terminated franchise.
franchiseSchema.index(
    { zoneId: 1 },
    { unique: true, partialFilterExpression: { isTerminated: false }, name: 'uniq_live_franchise_per_zone' }
);

franchiseSchema.pre('save', function (next) {
    this.isTerminated = this.status === 'terminated';
    if (this.isTerminated && !this.terminatedAt) this.terminatedAt = new Date();
    next();
});

export const FoodFranchise = mongoose.model('FoodFranchise', franchiseSchema);
