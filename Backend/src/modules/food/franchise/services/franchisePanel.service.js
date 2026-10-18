import mongoose from 'mongoose';
import { FoodFranchise } from '../models/franchise.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodRestaurantCommission } from '../../admin/models/restaurantCommission.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import * as adminService from '../../admin/services/admin.service.js';
import { invalidateCache } from '../../../../middleware/cache.js';
import { invalidateRestaurantCommissionRulesCache } from '../../orders/services/foodTransaction.service.js';
import { getFranchiseById, listFranchiseRestaurants, listFranchiseDeliveryPartners, listFranchiseOrders } from './franchise.service.js';
import { getFranchiseBalance } from './franchiseFinance.service.js';
import { logger } from '../../../../utils/logger.js';

const toId = (id, label) => {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) throw new ValidationError(`Invalid ${label}`);
    return new mongoose.Types.ObjectId(String(id));
};

/** Loads a record only if it belongs to the franchise's zone. Anything else is "not found", never "forbidden". */
async function restaurantInZone(franchise, restaurantId) {
    const restaurant = await FoodRestaurant.findOne({ _id: toId(restaurantId, 'restaurant id'), zoneId: franchise.zoneId })
        .select('_id restaurantName status zoneId')
        .lean();
    if (!restaurant) throw new NotFoundError('Restaurant not found');
    return restaurant;
}

async function riderInZone(franchise, riderId) {
    const rider = await FoodDeliveryPartner.findOne({ _id: toId(riderId, 'delivery partner id'), zoneId: franchise.zoneId })
        .select('_id name status zoneId')
        .lean();
    if (!rider) throw new NotFoundError('Delivery partner not found');
    return rider;
}

const clearRestaurantCaches = async () => {
    try {
        await Promise.all(['restaurants:*', 'restaurant_detail:*', 'restaurant_menu:*', 'restaurant:*'].map((k) => invalidateCache(k)));
    } catch (err) {
        logger.warn(`[Franchise] cache invalidation failed: ${err.message}`);
    }
};

// ----- Dashboard -----

export async function getDashboard(franchise) {
    const [details, balance] = await Promise.all([getFranchiseById(franchise._id), getFranchiseBalance(franchise._id)]);
    // The owner sees their own terms but not HQ-internal notes.
    const { notes, createdBy, ...visible } = details;
    return { franchise: visible, balance };
}

// ----- Restaurants -----

export async function listRestaurants(franchise, query) {
    const result = await listFranchiseRestaurants(franchise._id, query);
    const ids = result.data.map((r) => r._id);
    const rules = ids.length
        ? await FoodRestaurantCommission.find({ restaurantId: { $in: ids }, status: { $ne: false } }).select('restaurantId defaultCommission').lean()
        : [];
    const byRestaurant = new Map(rules.map((r) => [String(r.restaurantId), r.defaultCommission]));
    const fallback = franchise.pricing?.restaurantCommissionPercent;
    result.data = result.data.map((r) => ({
        ...r,
        commission: byRestaurant.get(String(r._id)) || null,
        commissionSource: byRestaurant.has(String(r._id)) ? 'restaurant' : fallback !== null && fallback !== undefined ? 'franchise' : 'hq'
    }));
    return result;
}

export async function approveRestaurant(franchise, restaurantId) {
    await restaurantInZone(franchise, restaurantId);
    const updated = await adminService.approveRestaurant(String(restaurantId));
    await clearRestaurantCaches();
    return updated;
}

export async function rejectRestaurant(franchise, restaurantId, reason) {
    await restaurantInZone(franchise, restaurantId);
    if (!String(reason || '').trim()) throw new ValidationError('Enter a reason for rejecting');
    return adminService.rejectRestaurant(String(restaurantId), String(reason).trim());
}

/** Sets a restaurant's own commission. Pass null value to remove it (falls back to the franchise default). */
export async function setRestaurantCommission(franchise, restaurantId, { type = 'percentage', value }) {
    const restaurant = await restaurantInZone(franchise, restaurantId);
    if (value === null || value === undefined || value === '') {
        await FoodRestaurantCommission.deleteOne({ restaurantId: restaurant._id });
    } else {
        const v = Number(value);
        if (!Number.isFinite(v) || v < 0) throw new ValidationError('Commission must be zero or more');
        if (type === 'percentage' && v > 100) throw new ValidationError('Commission % cannot be more than 100');
        await FoodRestaurantCommission.updateOne(
            { restaurantId: restaurant._id },
            { $set: { defaultCommission: { type, value: v }, status: true, notes: `Set by franchise ${franchise.code}` } },
            { upsert: true }
        );
    }
    invalidateRestaurantCommissionRulesCache();
    return FoodRestaurantCommission.findOne({ restaurantId: restaurant._id }).lean();
}

// ----- Delivery boys -----

export const listRiders = (franchise, query) => listFranchiseDeliveryPartners(franchise._id, query);

export async function approveRider(franchise, riderId) {
    await riderInZone(franchise, riderId);
    return adminService.approveDeliveryPartner(String(riderId));
}

export async function rejectRider(franchise, riderId, reason) {
    await riderInZone(franchise, riderId);
    if (!String(reason || '').trim()) throw new ValidationError('Enter a reason for rejecting');
    return adminService.rejectDeliveryPartner(String(riderId), String(reason).trim());
}

/** The franchise collected COD cash from its rider. Frees the rider's cash limit; not credited by HQ. */
export async function collectRiderCash(franchise, riderId, { amount, note = '' }) {
    await riderInZone(franchise, riderId);
    return adminService.settleDeliveryCashLimit(
        String(riderId),
        { amount, adminNote: note || `Cash collected by franchise ${franchise.code}` },
        null,
        { collectedBy: 'FRANCHISE' }
    );
}

// ----- Orders -----

export const listOrders = (franchise, query) => listFranchiseOrders(franchise._id, query);

// ----- Pricing -----

export function getPricing(franchise) {
    return { pricing: franchise.pricing || {}, revenueModel: franchise.revenueModel, commissionPercent: franchise.commissionPercent };
}

export async function updatePricing(franchise, pricing) {
    const ranges = pricing.deliveryFeeRanges;
    if (Array.isArray(ranges)) {
        const sorted = [...ranges].sort((a, b) => a.min - b.min);
        for (let i = 0; i < sorted.length; i += 1) {
            if (sorted[i].max <= sorted[i].min) throw new ValidationError('Each distance slab needs "to km" greater than "from km"');
            if (i > 0 && sorted[i].min < sorted[i - 1].max) throw new ValidationError('Distance slabs must not overlap');
        }
        pricing.deliveryFeeRanges = sorted;
    }
    const doc = await FoodFranchise.findById(franchise._id);
    doc.set('pricing', { ...(doc.toObject().pricing || {}), ...pricing });
    await doc.save();
    return { pricing: doc.toObject().pricing };
}

// ----- Coupons (franchise-funded, valid only in its zone) -----

export async function listCoupons(franchise) {
    return FoodOffer.find({ franchiseId: franchise._id }).populate('restaurantId', 'restaurantName').sort({ createdAt: -1 }).lean();
}

async function normalizeCouponScope(franchise, dto) {
    if (dto.restaurantScope === 'selected') {
        if (!dto.restaurantId) throw new ValidationError('Pick the restaurant for this coupon');
        await restaurantInZone(franchise, dto.restaurantId);
    } else if (dto.restaurantScope === 'all') {
        dto.restaurantId = undefined;
    }
    return dto;
}

export async function createCoupon(franchise, dto) {
    await normalizeCouponScope(franchise, dto);
    try {
        return await FoodOffer.create({ ...dto, couponCode: dto.couponCode.toUpperCase(), franchiseId: franchise._id, usedCount: 0 });
    } catch (err) {
        if (err?.code === 11000) throw new ValidationError('This coupon code is already taken. Try another code.');
        throw err;
    }
}

async function couponOfFranchise(franchise, couponId) {
    const offer = await FoodOffer.findOne({ _id: toId(couponId, 'coupon id'), franchiseId: franchise._id });
    if (!offer) throw new NotFoundError('Coupon not found');
    return offer;
}

export async function updateCoupon(franchise, couponId, dto) {
    const offer = await couponOfFranchise(franchise, couponId);
    if (dto.restaurantScope !== undefined) await normalizeCouponScope(franchise, dto);
    const { couponCode, ...rest } = dto; // the code is fixed once customers may have it
    offer.set(rest);
    if (dto.restaurantScope === 'all') offer.restaurantId = undefined;
    await offer.save();
    return offer.toObject();
}

export async function deleteCoupon(franchise, couponId) {
    const offer = await couponOfFranchise(franchise, couponId);
    if (offer.usedCount > 0) {
        // Keep used coupons for order history; just switch them off.
        offer.status = 'inactive';
        await offer.save();
        return { deleted: false, deactivated: true };
    }
    await offer.deleteOne();
    return { deleted: true };
}
