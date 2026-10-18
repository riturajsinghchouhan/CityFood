import mongoose from 'mongoose';
import { FoodFranchise } from '../models/franchise.model.js';
import { FoodFranchiseUser } from '../models/franchiseUser.model.js';
import { FoodFranchiseWithdrawal } from '../models/franchiseWithdrawal.model.js';
import { addPeriod, chargeSubscriptionPeriod, runSettlement } from './franchiseFinance.service.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';

const ACTIVE_ORDER_STATUSES = ['created', 'confirmed', 'preparing', 'ready_for_pickup', 'reached_pickup', 'picked_up', 'reached_drop'];
const CANCELLED_ORDER_STATUSES = ['cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin', 'dead'];

const ORDER_STATUS_FILTERS = {
    all: null,
    active: ACTIVE_ORDER_STATUSES,
    delivered: ['delivered'],
    cancelled: CANCELLED_ORDER_STATUSES
};

/** Allowed manual status moves (grace is meant for subscription reminders; terminated is final). */
const STATUS_TRANSITIONS = {
    active: ['grace', 'suspended', 'terminated'],
    grace: ['active', 'suspended', 'terminated'],
    suspended: ['active', 'terminated'],
    terminated: []
};

const IST_OFFSET_MS = 330 * 60 * 1000;

const startOfTodayIst = (now = new Date()) => {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    ist.setUTCHours(0, 0, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MS);
};

const startOfMonthIst = (now = new Date()) => {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    ist.setUTCDate(1);
    ist.setUTCHours(0, 0, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MS);
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toObjectId = (id, label = 'id') => {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError(`Invalid ${label}`);
    }
    return new mongoose.Types.ObjectId(String(id));
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ----- Earnings expressions (per delivered order) -----
// Franchise earning = what the platform keeps from the order: delivery fee + platform fee
// + restaurant commission - rider pay - franchise-funded coupon. Taxes and gateway fees are
// pass-through, not earning. Same formula as splitFranchiseOrder() used by settlements.
export const FRANCHISE_GROSS_EXPR = {
    $subtract: [
        {
            $add: [
                { $ifNull: ['$pricing.deliveryFee', 0] },
                { $ifNull: ['$pricing.platformFee', 0] },
                { $ifNull: ['$pricing.restaurantCommission', 0] }
            ]
        },
        { $add: [{ $ifNull: ['$riderEarning', 0] }, { $ifNull: ['$franchiseSnapshot.franchiseDiscount', 0] }] }
    ]
};

export const HQ_SHARE_EXPR = {
    $cond: [
        { $and: [{ $eq: ['$franchiseSnapshot.revenueModel', 'COMMISSION'] }, { $gt: [FRANCHISE_GROSS_EXPR, 0] }] },
        {
            $multiply: [
                FRANCHISE_GROSS_EXPR,
                { $divide: [{ $ifNull: ['$franchiseSnapshot.commissionPercent', 0] }, 100] }
            ]
        },
        0
    ]
};

const IS_DELIVERED = { $eq: ['$orderStatus', 'delivered'] };
const sumIf = (cond, value = 1) => ({ $sum: { $cond: [cond, value, 0] } });

const emptyStats = () => ({
    restaurants: { total: 0, approved: 0, pending: 0, rejected: 0, acceptingOrders: 0 },
    deliveryPartners: { total: 0, approved: 0, pending: 0, rejected: 0, online: 0 },
    orders: { total: 0, delivered: 0, cancelled: 0, active: 0, today: 0, todayDelivered: 0, monthDelivered: 0 },
    earnings: {
        gmv: 0,
        franchiseGross: 0,
        hqShare: 0,
        franchiseNet: 0,
        today: { franchiseGross: 0, hqShare: 0 },
        month: { gmv: 0, franchiseGross: 0, hqShare: 0 }
    }
});

/**
 * Computes stats for many franchises at once: 3 aggregations total, regardless of franchise count.
 * Restaurants and riders are counted by the franchise's zone; orders by the franchiseId stamped at order time.
 */
async function computeStatsForFranchises(franchises) {
    const statsById = new Map(franchises.map((f) => [String(f._id), emptyStats()]));
    if (!franchises.length) return statsById;

    const zoneToFranchise = new Map(franchises.map((f) => [String(f.zoneId?._id || f.zoneId), String(f._id)]));
    const zoneIds = [...zoneToFranchise.keys()].map((z) => new mongoose.Types.ObjectId(z));
    const franchiseIds = franchises.map((f) => new mongoose.Types.ObjectId(String(f._id)));
    const todayStart = startOfTodayIst();
    const monthStart = startOfMonthIst();

    const [restaurantRows, riderRows, orderRows] = await Promise.all([
        FoodRestaurant.aggregate([
            { $match: { zoneId: { $in: zoneIds } } },
            {
                $group: {
                    _id: '$zoneId',
                    total: { $sum: 1 },
                    approved: sumIf({ $eq: ['$status', 'approved'] }),
                    pending: sumIf({ $eq: ['$status', 'pending'] }),
                    rejected: sumIf({ $eq: ['$status', 'rejected'] }),
                    acceptingOrders: sumIf({ $and: [{ $eq: ['$status', 'approved'] }, { $ne: ['$isAcceptingOrders', false] }] })
                }
            }
        ]),
        FoodDeliveryPartner.aggregate([
            { $match: { zoneId: { $in: zoneIds } } },
            {
                $group: {
                    _id: '$zoneId',
                    total: { $sum: 1 },
                    approved: sumIf({ $eq: ['$status', 'approved'] }),
                    pending: sumIf({ $eq: ['$status', 'pending'] }),
                    rejected: sumIf({ $eq: ['$status', 'rejected'] }),
                    online: sumIf({ $and: [{ $eq: ['$status', 'approved'] }, { $eq: ['$availabilityStatus', 'online'] }] })
                }
            }
        ]),
        FoodOrder.aggregate([
            { $match: { franchiseId: { $in: franchiseIds } } },
            {
                $group: {
                    _id: '$franchiseId',
                    total: { $sum: 1 },
                    delivered: sumIf(IS_DELIVERED),
                    cancelled: sumIf({ $in: ['$orderStatus', CANCELLED_ORDER_STATUSES] }),
                    active: sumIf({ $in: ['$orderStatus', ACTIVE_ORDER_STATUSES] }),
                    today: sumIf({ $gte: ['$createdAt', todayStart] }),
                    todayDelivered: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', todayStart] }] }),
                    monthDelivered: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', monthStart] }] }),
                    gmv: sumIf(IS_DELIVERED, { $ifNull: ['$pricing.total', 0] }),
                    franchiseGross: sumIf(IS_DELIVERED, FRANCHISE_GROSS_EXPR),
                    hqShare: sumIf(IS_DELIVERED, HQ_SHARE_EXPR),
                    todayGross: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', todayStart] }] }, FRANCHISE_GROSS_EXPR),
                    todayHqShare: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', todayStart] }] }, HQ_SHARE_EXPR),
                    monthGmv: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', monthStart] }] }, { $ifNull: ['$pricing.total', 0] }),
                    monthGross: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', monthStart] }] }, FRANCHISE_GROSS_EXPR),
                    monthHqShare: sumIf({ $and: [IS_DELIVERED, { $gte: ['$createdAt', monthStart] }] }, HQ_SHARE_EXPR)
                }
            }
        ])
    ]);

    for (const row of restaurantRows) {
        const stats = statsById.get(zoneToFranchise.get(String(row._id)));
        if (!stats) continue;
        const { _id, ...counts } = row;
        stats.restaurants = { ...stats.restaurants, ...counts };
    }
    for (const row of riderRows) {
        const stats = statsById.get(zoneToFranchise.get(String(row._id)));
        if (!stats) continue;
        const { _id, ...counts } = row;
        stats.deliveryPartners = { ...stats.deliveryPartners, ...counts };
    }
    for (const row of orderRows) {
        const stats = statsById.get(String(row._id));
        if (!stats) continue;
        stats.orders = {
            total: row.total,
            delivered: row.delivered,
            cancelled: row.cancelled,
            active: row.active,
            today: row.today,
            todayDelivered: row.todayDelivered,
            monthDelivered: row.monthDelivered
        };
        stats.earnings = {
            gmv: round2(row.gmv),
            franchiseGross: round2(row.franchiseGross),
            hqShare: round2(row.hqShare),
            franchiseNet: round2(row.franchiseGross - row.hqShare),
            today: { franchiseGross: round2(row.todayGross), hqShare: round2(row.todayHqShare) },
            month: { gmv: round2(row.monthGmv), franchiseGross: round2(row.monthGross), hqShare: round2(row.monthHqShare) }
        };
    }
    return statsById;
}

const serializeFranchise = (doc, stats) => {
    const zone = doc.zoneId && typeof doc.zoneId === 'object' && doc.zoneId.name !== undefined ? doc.zoneId : null;
    return {
        ...doc,
        zoneId: zone ? String(zone._id) : String(doc.zoneId),
        zone: zone ? { _id: String(zone._id), name: zone.name, isActive: zone.isActive } : null,
        stats: stats || emptyStats()
    };
};

const generateCode = async (zoneName) => {
    const base = String(zoneName || 'FR').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    for (let i = 1; i < 1000; i += 1) {
        const code = `FR-${base}-${String(i).padStart(3, '0')}`;
        // eslint-disable-next-line no-await-in-loop
        const exists = await FoodFranchise.exists({ code });
        if (!exists) return code;
    }
    throw new ValidationError('Could not generate a franchise code. Please try again.');
};

const assertZoneAssignable = async (zoneId, exceptFranchiseId = null) => {
    const zone = await FoodZone.findById(zoneId).select('_id name isActive').lean();
    if (!zone) throw new ValidationError('Selected zone does not exist');
    const taken = await FoodFranchise.findOne({
        zoneId,
        isTerminated: false,
        ...(exceptFranchiseId ? { _id: { $ne: exceptFranchiseId } } : {})
    })
        .select('name')
        .lean();
    if (taken) throw new ValidationError(`Zone "${zone.name}" already belongs to franchise "${taken.name}"`);
    return zone;
};

/** Nested schema paths are not subdocuments, so merge partial updates through the doc's plain copy. */
const mergeNested = (doc, key, patch) => {
    doc.set(key, { ...(doc.toObject()[key] || {}), ...patch });
};

const applyRevenueTerms = (target, dto) => {
    if (dto.revenueModel !== undefined) target.revenueModel = dto.revenueModel;
    if (dto.commissionPercent !== undefined) target.commissionPercent = dto.commissionPercent;
    if (dto.subscription !== undefined) mergeNested(target, 'subscription', dto.subscription);
    if (target.revenueModel === 'SUBSCRIPTION') {
        target.commissionPercent = 0;
        if (!(Number(target.subscription?.amount) > 0)) {
            throw new ValidationError('Subscription amount is required for the subscription model');
        }
    }
    if (target.revenueModel === 'COMMISSION' && !(Number(target.commissionPercent) > 0)) {
        throw new ValidationError('Commission % is required for the commission model');
    }
};

const handleDuplicateKey = (err) => {
    if (err?.code === 11000) {
        throw new ValidationError('This zone already has a franchise, or the franchise code is already used');
    }
    throw err;
};

// ----- Public service API -----

export async function listFranchises(query = {}) {
    const filter = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.search) {
        const rx = new RegExp(escapeRegex(String(query.search).trim()), 'i');
        filter.$or = [{ name: rx }, { code: rx }, { 'owner.name': rx }, { 'owner.phone': rx }];
    }
    const docs = await FoodFranchise.find(filter).populate('zoneId', 'name isActive').sort({ createdAt: -1 }).lean();
    const statsById = await computeStatsForFranchises(docs);
    const franchises = docs.map((d) => serializeFranchise(d, statsById.get(String(d._id))));

    const summary = franchises.reduce(
        (acc, f) => {
            if (f.status !== 'terminated') acc.liveFranchises += 1;
            acc.restaurants += f.stats.restaurants.total;
            acc.deliveryPartners += f.stats.deliveryPartners.total;
            acc.activeOrders += f.stats.orders.active;
            acc.deliveredOrders += f.stats.orders.delivered;
            acc.gmv = round2(acc.gmv + f.stats.earnings.gmv);
            acc.hqCommission = round2(acc.hqCommission + f.stats.earnings.hqShare);
            return acc;
        },
        { totalFranchises: franchises.length, liveFranchises: 0, restaurants: 0, deliveryPartners: 0, activeOrders: 0, deliveredOrders: 0, gmv: 0, hqCommission: 0 }
    );

    return { franchises, summary };
}

export async function getFranchiseById(id) {
    const doc = await FoodFranchise.findById(toObjectId(id, 'franchise id')).populate('zoneId', 'name isActive').lean();
    if (!doc) throw new NotFoundError('Franchise not found');
    const [statsById, login] = await Promise.all([
        computeStatsForFranchises([doc]),
        FoodFranchiseUser.findOne({ franchiseId: doc._id }).select('phone email isActive lastLoginAt').lean()
    ]);
    return {
        ...serializeFranchise(doc, statsById.get(String(doc._id))),
        ownerLogin: login
            ? { exists: true, phone: login.phone, email: login.email || '', isActive: login.isActive, lastLoginAt: login.lastLoginAt }
            : { exists: false }
    };
}

const MIN_PASSWORD_LENGTH = 8;

/** Creates or resets the franchise owner's panel login (owner phone + this password). */
export async function setOwnerLogin(id, { password }) {
    const franchise = await FoodFranchise.findById(toObjectId(id, 'franchise id')).lean();
    if (!franchise) throw new NotFoundError('Franchise not found');
    if (franchise.status === 'terminated') throw new ValidationError('A terminated franchise cannot get a login');
    if (String(password || '').length < MIN_PASSWORD_LENGTH) {
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const phoneTaken = await FoodFranchiseUser.findOne({ phone: franchise.owner.phone, franchiseId: { $ne: franchise._id } }).select('_id').lean();
    if (phoneTaken) throw new ValidationError('This owner phone is already used for another franchise login');

    let user = await FoodFranchiseUser.findOne({ franchiseId: franchise._id }).select('+password');
    if (!user) user = new FoodFranchiseUser({ franchiseId: franchise._id });
    user.name = franchise.owner.name;
    user.phone = franchise.owner.phone;
    user.email = franchise.owner.email || undefined;
    user.password = String(password);
    user.isActive = true;
    try {
        await user.save();
    } catch (err) {
        if (err?.code === 11000) throw new ValidationError('This owner phone or email is already used for another franchise login');
        throw err;
    }
    return getFranchiseById(franchise._id);
}

/** Keeps the login's phone / email in step with the franchise owner details. */
async function syncOwnerLogin(franchise) {
    try {
        await FoodFranchiseUser.updateOne(
            { franchiseId: franchise._id },
            { $set: { name: franchise.owner?.name || '', phone: franchise.owner?.phone, email: franchise.owner?.email || undefined } }
        );
    } catch (err) {
        if (err?.code === 11000) throw new ValidationError('This owner phone or email is already used for another franchise login');
        throw err;
    }
}

const applyPricingAndFinance = (franchise, dto) => {
    if (dto.pricing !== undefined) mergeNested(franchise, 'pricing', dto.pricing);
    if (dto.finance !== undefined) mergeNested(franchise, 'finance', dto.finance);
};

export async function listAvailableZones(exceptFranchiseId = null) {
    const takenFilter = { isTerminated: false };
    if (exceptFranchiseId && mongoose.Types.ObjectId.isValid(String(exceptFranchiseId))) {
        takenFilter._id = { $ne: new mongoose.Types.ObjectId(String(exceptFranchiseId)) };
    }
    const takenZoneIds = await FoodFranchise.distinct('zoneId', takenFilter);
    const zones = await FoodZone.find({ _id: { $nin: takenZoneIds } })
        .select('name serviceLocation isActive')
        .sort({ name: 1 })
        .lean();
    return zones.map((z) => ({ ...z, _id: String(z._id) }));
}

export async function createFranchise(dto, adminId) {
    const zoneId = toObjectId(dto.zoneId, 'zone');
    const zone = await assertZoneAssignable(zoneId);

    const franchise = new FoodFranchise({
        name: dto.name,
        code: await generateCode(zone.name),
        zoneId,
        owner: dto.owner,
        business: dto.business,
        bank: dto.bank,
        startDate: dto.startDate || new Date(),
        notes: dto.notes,
        status: 'active',
        createdBy: adminId && mongoose.Types.ObjectId.isValid(String(adminId)) ? adminId : null
    });
    applyRevenueTerms(franchise, dto);
    applyPricingAndFinance(franchise, dto);
    if (franchise.revenueModel === 'SUBSCRIPTION') {
        const start = franchise.subscription.startDate || franchise.startDate || new Date();
        franchise.subscription.startDate = start;
        if (!franchise.subscription.endDate) franchise.subscription.endDate = addPeriod(start, franchise.subscription.plan);
    }
    if (dto.ownerPassword) {
        // Check the login up front so a franchise is never created with a login that then fails.
        if (String(dto.ownerPassword).length < MIN_PASSWORD_LENGTH) {
            throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        }
        const loginTaken = await FoodFranchiseUser.exists({
            $or: [{ phone: dto.owner.phone }, ...(dto.owner.email ? [{ email: String(dto.owner.email).toLowerCase() }] : [])]
        });
        if (loginTaken) throw new ValidationError('This owner phone or email is already used for another franchise login');
    }

    try {
        await franchise.save();
    } catch (err) {
        handleDuplicateKey(err);
    }
    // The first subscription period is billed right away; later ones by the renewal job.
    if (franchise.revenueModel === 'SUBSCRIPTION') {
        await chargeSubscriptionPeriod(franchise, franchise.subscription.startDate, franchise.subscription.endDate);
    }
    if (dto.ownerPassword) {
        await setOwnerLogin(franchise._id, { password: dto.ownerPassword });
    }
    return getFranchiseById(franchise._id);
}

export async function updateFranchise(id, dto) {
    const franchise = await FoodFranchise.findById(toObjectId(id, 'franchise id'));
    if (!franchise) throw new NotFoundError('Franchise not found');
    if (franchise.status === 'terminated') throw new ValidationError('A terminated franchise cannot be edited');

    if (dto.zoneId !== undefined && String(dto.zoneId) !== String(franchise.zoneId)) {
        const zoneId = toObjectId(dto.zoneId, 'zone');
        await assertZoneAssignable(zoneId, franchise._id);
        franchise.zoneId = zoneId;
    }
    if (dto.name !== undefined) franchise.name = dto.name;
    if (dto.owner !== undefined) mergeNested(franchise, 'owner', dto.owner);
    if (dto.business !== undefined) mergeNested(franchise, 'business', dto.business);
    if (dto.bank !== undefined) mergeNested(franchise, 'bank', dto.bank);
    if (dto.startDate !== undefined) franchise.startDate = dto.startDate;
    if (dto.notes !== undefined) franchise.notes = dto.notes;
    const wasSubscription = franchise.revenueModel === 'SUBSCRIPTION';
    applyRevenueTerms(franchise, dto);
    applyPricingAndFinance(franchise, dto);
    // Switching to subscription starts a fresh period that is billed now.
    const startsSubscription = !wasSubscription && franchise.revenueModel === 'SUBSCRIPTION';
    if (startsSubscription) {
        const start = dto.subscription?.startDate || new Date();
        franchise.subscription.startDate = start;
        franchise.subscription.endDate = dto.subscription?.endDate || addPeriod(start, franchise.subscription.plan);
    }

    try {
        await franchise.save();
    } catch (err) {
        handleDuplicateKey(err);
    }
    if (startsSubscription) {
        await chargeSubscriptionPeriod(franchise, franchise.subscription.startDate, franchise.subscription.endDate);
    }
    if (dto.owner !== undefined) await syncOwnerLogin(franchise);
    return getFranchiseById(franchise._id);
}

export async function updateFranchiseStatus(id, { status, reason = '' }) {
    const franchise = await FoodFranchise.findById(toObjectId(id, 'franchise id'));
    if (!franchise) throw new NotFoundError('Franchise not found');
    if (franchise.status === status) return getFranchiseById(franchise._id);

    const allowed = STATUS_TRANSITIONS[franchise.status] || [];
    if (!allowed.includes(status)) {
        throw new ValidationError(`Cannot change status from ${franchise.status} to ${status}`);
    }
    if (status === 'terminated') {
        const activeOrders = await FoodOrder.countDocuments({ franchiseId: franchise._id, orderStatus: { $in: ACTIVE_ORDER_STATUSES } });
        if (activeOrders > 0) {
            throw new ValidationError(`${activeOrders} order(s) are still in progress. Suspend the franchise first and terminate after they finish.`);
        }
    }
    franchise.status = status;
    franchise.statusReason = reason;
    franchise.statusSource = 'HQ';
    franchise.graceStartedAt = status === 'grace' ? new Date() : null;
    await franchise.save();
    if (status === 'terminated') {
        // Final settlement with no holdback; the zone, its restaurants and riders go back to HQ.
        // Open withdrawal requests are closed: the final settlement covers what is owed.
        await FoodFranchiseWithdrawal.updateMany(
            { franchiseId: franchise._id, status: 'pending' },
            { $set: { status: 'rejected', rejectionReason: 'Franchise terminated; included in the final settlement', processedAt: new Date() } }
        );
        await runSettlement(franchise._id, { final: true, actor: { role: 'HQ' } });
        await FoodFranchiseUser.updateMany({ franchiseId: franchise._id }, { $set: { isActive: false } });
    }
    return getFranchiseById(franchise._id);
}

// ----- Riders registered before zones existed -----

export async function listRidersWithoutZone(query = {}) {
    const { page, limit, skip } = buildPaginationOptions(query);
    const filter = { $or: [{ zoneId: null }, { zoneId: { $exists: false } }] };
    if (query.search) {
        const rx = new RegExp(escapeRegex(String(query.search).trim()), 'i');
        filter.$and = [{ $or: [{ name: rx }, { phone: rx }, { city: rx }] }];
    }
    const [docs, total] = await Promise.all([
        FoodDeliveryPartner.find(filter)
            .select('name phone city status availabilityStatus vehicleType vehicleNumber createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodDeliveryPartner.countDocuments(filter)
    ]);
    return buildPaginatedResult({ docs, total, page, limit });
}

export async function setRiderZone(riderId, zoneIdRaw) {
    const rider = await FoodDeliveryPartner.findById(toObjectId(riderId, 'delivery partner id')).select('_id zoneId');
    if (!rider) throw new NotFoundError('Delivery partner not found');
    const zoneId = toObjectId(zoneIdRaw, 'zone');
    const zone = await FoodZone.findById(zoneId).select('_id name').lean();
    if (!zone) throw new ValidationError('Selected zone does not exist');
    const busy = await FoodOrder.countDocuments({ 'dispatch.deliveryPartnerId': rider._id, orderStatus: { $in: ACTIVE_ORDER_STATUSES } });
    if (busy > 0) throw new ValidationError('This delivery boy has an order in progress. Change the zone after it is delivered.');
    rider.zoneId = zoneId;
    await rider.save();
    return { _id: String(rider._id), zoneId: String(zoneId), zoneName: zone.name };
}

const getFranchiseZoneId = async (id) => {
    const franchise = await FoodFranchise.findById(toObjectId(id, 'franchise id')).select('_id zoneId').lean();
    if (!franchise) throw new NotFoundError('Franchise not found');
    return franchise;
};

export async function listFranchiseRestaurants(id, query = {}) {
    const { zoneId } = await getFranchiseZoneId(id);
    const { page, limit, skip } = buildPaginationOptions(query);
    const filter = { zoneId };
    if (['approved', 'pending', 'rejected'].includes(query.status)) filter.status = query.status;
    if (query.search) {
        const rx = new RegExp(escapeRegex(String(query.search).trim()), 'i');
        filter.$or = [{ restaurantName: rx }, { ownerName: rx }, { ownerPhone: rx }];
    }
    const [docs, total] = await Promise.all([
        FoodRestaurant.find(filter)
            .select('restaurantName ownerName ownerPhone status isAcceptingOrders profileImage location.area location.city rating createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodRestaurant.countDocuments(filter)
    ]);
    return buildPaginatedResult({ docs, total, page, limit });
}

export async function listFranchiseDeliveryPartners(id, query = {}) {
    const { zoneId } = await getFranchiseZoneId(id);
    const { page, limit, skip } = buildPaginationOptions(query);
    const filter = { zoneId };
    if (['approved', 'pending', 'rejected'].includes(query.status)) filter.status = query.status;
    if (query.search) {
        const rx = new RegExp(escapeRegex(String(query.search).trim()), 'i');
        filter.$or = [{ name: rx }, { phone: rx }, { vehicleNumber: rx }];
    }
    const [docs, total] = await Promise.all([
        FoodDeliveryPartner.find(filter)
            .select('name phone status availabilityStatus vehicleType vehicleNumber profilePhoto rating createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodDeliveryPartner.countDocuments(filter)
    ]);
    return buildPaginatedResult({ docs, total, page, limit });
}

export async function listFranchiseOrders(id, query = {}) {
    const franchise = await getFranchiseZoneId(id);
    const { page, limit, skip } = buildPaginationOptions(query);
    const statuses = ORDER_STATUS_FILTERS[query.status] ?? null;
    const filter = { franchiseId: franchise._id };
    if (statuses) filter.orderStatus = { $in: statuses };
    const [docs, total] = await Promise.all([
        FoodOrder.find(filter)
            .select('order_id orderStatus pricing.total payment.method customerName createdAt restaurantId dispatch.deliveryPartnerId riderEarning')
            .populate('restaurantId', 'restaurantName')
            .populate('dispatch.deliveryPartnerId', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FoodOrder.countDocuments(filter)
    ]);
    return buildPaginatedResult({ docs, total, page, limit });
}
