import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FRANCHISE_REVENUE_MODELS, FRANCHISE_STATUSES, FRANCHISE_SUBSCRIPTION_PLANS } from '../models/franchise.model.js';

const objectId = (label) => z.string().trim().regex(/^[a-f0-9]{24}$/i, `Please select a valid ${label}`);
const optionalText = (max = 200) => z.string().trim().max(max).optional();
const optionalDate = z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
        if (v === undefined) return undefined;
        if (v === null || v === '') return null;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date' });
            return z.NEVER;
        }
        return d;
    });

const ownerSchema = z.object({
    name: z.string().trim().min(1, 'Owner name is required').max(100),
    phone: z.string().trim().regex(/^\d{10}$/, 'Owner phone must be 10 digits'),
    email: z.string().trim().email('Invalid owner email').optional().or(z.literal(''))
});

const businessSchema = z.object({
    legalName: optionalText(),
    gstNumber: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GST number').optional().or(z.literal('')),
    panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN number').optional().or(z.literal('')),
    address: optionalText(500)
});

const bankSchema = z.object({
    accountHolderName: optionalText(),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9-18 digits').optional().or(z.literal('')),
    ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').optional().or(z.literal('')),
    bankName: optionalText(),
    upiId: optionalText(100)
});

const subscriptionSchema = z.object({
    plan: z.enum(FRANCHISE_SUBSCRIPTION_PLANS).optional(),
    amount: z.coerce.number().min(0, 'Subscription amount cannot be negative').optional(),
    startDate: optionalDate,
    endDate: optionalDate
});

const baseFields = {
    name: z.string().trim().min(2, 'Franchise name is required').max(120),
    zoneId: objectId('zone'),
    owner: ownerSchema,
    business: businessSchema.optional(),
    bank: bankSchema.optional(),
    revenueModel: z.enum(FRANCHISE_REVENUE_MODELS, { errorMap: () => ({ message: 'Choose commission or subscription' }) }),
    commissionPercent: z.coerce.number().min(0).max(100, 'Commission % cannot be more than 100').optional(),
    subscription: subscriptionSchema.optional(),
    startDate: optionalDate,
    notes: optionalText(1000)
};

const createSchema = z.object(baseFields);

const updateSchema = z.object({
    ...baseFields,
    owner: ownerSchema.partial()
}).partial();

const statusSchema = z.object({
    status: z.enum(FRANCHISE_STATUSES, { errorMap: () => ({ message: 'Invalid status' }) }),
    reason: optionalText(500)
});

const parse = (schema, body) => {
    const result = schema.safeParse(body ?? {});
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

export const validateCreateFranchiseDto = (body) => parse(createSchema, body);
export const validateUpdateFranchiseDto = (body) => parse(updateSchema, body);
export const validateFranchiseStatusDto = (body) => parse(statusSchema, body);

// ----- Shared money settings (HQ form and franchise panel) -----

const nullableMoney = (label) =>
    z.union([z.null(), z.coerce.number().min(0, `${label} cannot be negative`)]).optional();

export const pricingSchema = z.object({
    deliveryFee: nullableMoney('Delivery fee'),
    deliveryFeeRanges: z
        .array(z.object({
            min: z.coerce.number().min(0, 'Distance cannot be negative'),
            max: z.coerce.number().min(0, 'Distance cannot be negative'),
            fee: z.coerce.number().min(0, 'Fee cannot be negative')
        }))
        .max(20, 'At most 20 distance slabs')
        .optional(),
    freeDeliveryUpTo: nullableMoney('Free delivery amount'),
    platformFee: nullableMoney('Platform fee'),
    packagingFee: nullableMoney('Packaging fee'),
    restaurantCommissionPercent: z
        .union([z.null(), z.coerce.number().min(0).max(100, 'Commission % cannot be more than 100')])
        .optional()
});

const financeSchema = z.object({
    payoutSlaDays: z.coerce.number().int().min(1, 'Payout time must be at least 1 day').max(30).optional(),
    creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').optional(),
    holdbackDays: z.coerce.number().int().min(0).max(30).optional(),
    graceDays: z.coerce.number().int().min(1).max(60).optional()
});

const ownerPasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(100);

const createExtraSchema = z.object({
    pricing: pricingSchema.optional(),
    finance: financeSchema.optional(),
    ownerPassword: ownerPasswordSchema.optional().or(z.literal(''))
});

export const validateCreateFranchiseExtras = (body) => parse(createExtraSchema, body);
export const validateOwnerLoginDto = (body) => parse(z.object({ password: ownerPasswordSchema }), body);

const adjustmentSchema = z.object({
    type: z.enum(['PAYMENT_RECEIVED', 'MANUAL'], { errorMap: () => ({ message: 'Choose payment received or manual adjustment' }) }),
    amount: z.coerce.number().refine((v) => Math.abs(v) >= 0.01, 'Amount is required'),
    note: optionalText(500),
    utr: optionalText(100)
});
export const validateAdjustmentDto = (body) => parse(adjustmentSchema, body);

const utrSchema = z.object({
    utr: z.string().trim().min(3, 'Enter the UTR / transaction reference').max(100),
    note: optionalText(300),
    force: z.boolean().optional()
});
export const validateUtrDto = (body) => parse(utrSchema, body);

const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Enter a reason').max(500) });
export const validateReasonDto = (body) => parse(reasonSchema, body);

export const validateRiderZoneDto = (body) => parse(z.object({ zoneId: objectId('zone') }), body);

// ----- Franchise panel -----

export const validateFranchiseLoginDto = (body) =>
    parse(z.object({ login: z.string().trim().min(3, 'Enter your phone or email'), password: z.string().min(1, 'Enter your password') }), body);

export const validateChangePasswordDto = (body) =>
    parse(z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: ownerPasswordSchema }), body);

export const validatePricingDto = (body) => parse(pricingSchema, body);

export const validateCommissionDto = (body) =>
    parse(z.object({
        type: z.enum(['percentage', 'amount']).optional().default('percentage'),
        value: z.union([z.null(), z.coerce.number().min(0, 'Commission cannot be negative')])
    }), body);

export const validateCollectCashDto = (body) =>
    parse(z.object({ amount: z.coerce.number().positive('Amount must be more than zero'), note: optionalText(300) }), body);

const couponBase = {
    couponCode: z.string().trim().min(3, 'Coupon code must be at least 3 characters').max(20).regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, - and _'),
    discountType: z.enum(['percentage', 'flat-price']),
    discountValue: z.coerce.number().positive('Discount must be more than zero'),
    customerScope: z.enum(['all', 'first-time']).optional().default('all'),
    restaurantScope: z.enum(['all', 'selected']).optional().default('all'),
    restaurantId: objectId('restaurant').optional(),
    minOrderValue: z.coerce.number().min(0).optional().default(0),
    maxDiscount: z.union([z.null(), z.coerce.number().min(0)]).optional(),
    usageLimit: z.union([z.null(), z.coerce.number().int().min(0)]).optional(),
    perUserLimit: z.union([z.null(), z.coerce.number().int().min(0)]).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(['active', 'paused', 'inactive']).optional().default('active'),
    showInCart: z.boolean().optional().default(true)
};

const couponSchema = z.object(couponBase).superRefine((v, ctx) => {
    if (v.discountType === 'percentage' && v.discountValue > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Percentage discount cannot be more than 100' });
    }
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be after start date' });
    }
});

export const validateCouponDto = (body) => parse(couponSchema, body);
export const validateCouponUpdateDto = (body) => parse(z.object(couponBase).partial(), body);

export const validateWithdrawalRequestDto = (body) =>
    parse(z.object({ amount: z.coerce.number().min(1, 'Enter an amount of at least ₹1'), note: optionalText(300) }), body);
