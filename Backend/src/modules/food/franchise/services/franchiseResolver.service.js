import mongoose from 'mongoose';
import { FoodFranchise } from '../models/franchise.model.js';

const isId = (v) => Boolean(v) && mongoose.Types.ObjectId.isValid(String(v));

/**
 * Returns the live (non-terminated) franchise operating a zone, or null when the zone is HQ-operated.
 * Used at order creation to stamp ownership and freeze revenue terms.
 */
export async function resolveFranchiseForZone(zoneId) {
    if (!isId(zoneId)) return null;
    return FoodFranchise.findOne({ zoneId, isTerminated: false })
        .select('_id zoneId status revenueModel commissionPercent pricing')
        .lean();
}

/**
 * Which delivery partners may serve orders of a restaurant in `zoneId`.
 * - Franchise zone: only riders registered in that zone (the franchise pays them).
 * - HQ zone: every rider except those belonging to a franchise zone (riders with no zone are HQ riders).
 */
export async function getRiderScopeFilterForZone(zoneId) {
    if (isId(zoneId)) {
        const franchise = await FoodFranchise.exists({ zoneId, isTerminated: false });
        if (franchise) return { zoneId: new mongoose.Types.ObjectId(String(zoneId)) };
    }
    const franchiseZoneIds = await FoodFranchise.distinct('zoneId', { isTerminated: false });
    return franchiseZoneIds.length ? { zoneId: { $nin: franchiseZoneIds } } : {};
}

/**
 * True when the rider is allowed to take an order of `orderFranchiseId`.
 * Franchise orders need a rider of that franchise's zone. HQ orders (null) are not checked here:
 * dispatch already picks the right riders, and orders placed just before a zone got its
 * franchise must still be deliverable by that zone's riders.
 */
export async function riderMayServeFranchise(riderZoneId, orderFranchiseId) {
    if (!orderFranchiseId) return true;
    const franchise = await FoodFranchise.findById(orderFranchiseId).select('zoneId').lean();
    return Boolean(franchise && String(franchise.zoneId) === String(riderZoneId || ''));
}

const hasValue = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

/**
 * Overlays a franchise's own pricing on the HQ fee settings. Anything the franchise left empty
 * keeps the HQ value, so a franchise can change just its delivery fee and nothing else.
 */
export function applyFranchisePricing(feeSettings, franchise) {
    const p = franchise?.pricing;
    if (!feeSettings || !p) return feeSettings;
    const merged = { ...feeSettings };
    if (hasValue(p.platformFee)) merged.platformFee = Number(p.platformFee);
    if (hasValue(p.packagingFee)) merged.packagingFee = Number(p.packagingFee);
    if (hasValue(p.freeDeliveryUpTo)) merged.freeDeliveryUpTo = Number(p.freeDeliveryUpTo);
    if (Array.isArray(p.deliveryFeeRanges) && p.deliveryFeeRanges.length > 0) {
        merged.deliveryFeeRanges = p.deliveryFeeRanges;
        if (hasValue(p.deliveryFee)) merged.deliveryFee = Number(p.deliveryFee);
    } else if (hasValue(p.deliveryFee)) {
        // A flat franchise fee replaces HQ's distance slabs too.
        merged.deliveryFee = Number(p.deliveryFee);
        merged.deliveryFeeRanges = [];
    }
    if (hasValue(p.restaurantCommissionPercent)) {
        merged.globalRestaurantCommission = Number(p.restaurantCommissionPercent);
    }
    return merged;
}
