import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import { ForbiddenError } from '../auth/errors.js';

/**
 * Franchise data scoping.
 *
 * A franchise owner uses the same admin panel and the same admin APIs as HQ. Instead of adding a
 * zone filter to every admin service by hand, the request runs inside a franchise scope
 * (AsyncLocalStorage) and a global mongoose plugin adds the scope filter to every query on the
 * models below. Records of other zones are simply invisible: reads skip them and writes match nothing.
 *
 * The plugin is registered in register.js, which app.js imports before any model is compiled.
 */
const storage = new AsyncLocalStorage();

export const getFranchiseScope = () => storage.getStore() || null;

/** Runs fn inside a franchise scope: { franchiseId, zoneId } (ObjectIds). */
export const runInFranchiseScope = (scope, fn) => storage.run({ ...scope, cache: {} }, fn);

const SKIP = 'skipFranchiseScope';

async function cached(scope, key, load) {
    if (!scope.cache[key]) scope.cache[key] = load();
    return scope.cache[key];
}

const restaurantIds = (scope) =>
    cached(scope, 'restaurantIds', async () => {
        if (scope.isOwn) {
            return mongoose.model('FoodRestaurant').find({ zoneId: { $in: scope.ownZoneIds } }).setOptions({ [SKIP]: true }).distinct('_id').exec();
        }
        if (scope.isAllFranchises) {
            return mongoose.model('FoodRestaurant').find({ zoneId: { $in: scope.franchiseZoneIds } }).setOptions({ [SKIP]: true }).distinct('_id').exec();
        }
        return mongoose.model('FoodRestaurant').find({ zoneId: scope.zoneId }).setOptions({ [SKIP]: true }).distinct('_id').exec();
    });

const riderIds = (scope) =>
    cached(scope, 'riderIds', async () => {
        if (scope.isOwn) {
            return mongoose.model('FoodDeliveryPartner').find({
                $or: [{ zoneId: { $in: scope.ownZoneIds } }, { zoneId: null }, { zoneId: { $exists: false } }]
            }).setOptions({ [SKIP]: true }).distinct('_id').exec();
        }
        if (scope.isAllFranchises) {
            return mongoose.model('FoodDeliveryPartner').find({ zoneId: { $in: scope.franchiseZoneIds } }).setOptions({ [SKIP]: true }).distinct('_id').exec();
        }
        return mongoose.model('FoodDeliveryPartner').find({ zoneId: scope.zoneId }).setOptions({ [SKIP]: true }).distinct('_id').exec();
    });

const customerIds = (scope) =>
    cached(scope, 'customerIds', () => {
        if (scope.isOwn) {
            return mongoose.model('FoodOrder').find({
                $or: [{ franchiseId: null }, { franchiseId: { $exists: false } }]
            }).setOptions({ [SKIP]: true }).distinct('userId').exec();
        }
        if (scope.isAllFranchises) {
            return mongoose.model('FoodOrder').find({
                franchiseId: { $ne: null, $exists: true }
            }).setOptions({ [SKIP]: true }).distinct('userId').exec();
        }
        return mongoose.model('FoodOrder').find({ franchiseId: scope.franchiseId }).setOptions({ [SKIP]: true }).distinct('userId').exec();
    });

const byRestaurant = async (s) => ({ restaurantId: { $in: await restaurantIds(s) } });
const byRider = async (s) => ({ deliveryPartnerId: { $in: await riderIds(s) } });

/** Filter per model. `write` is true for updates / deletes. */
const RULES = {
    FoodRestaurant: (s) => {
        if (s.isOwn) return { zoneId: { $in: s.ownZoneIds } };
        if (s.isAllFranchises) return { zoneId: { $in: s.franchiseZoneIds } };
        return { zoneId: s.zoneId };
    },
    FoodDeliveryPartner: (s) => {
        if (s.isOwn) return { $or: [{ zoneId: { $in: s.ownZoneIds } }, { zoneId: null }, { zoneId: { $exists: false } }] };
        if (s.isAllFranchises) return { zoneId: { $in: s.franchiseZoneIds } };
        return { zoneId: s.zoneId };
    },
    FoodZone: (s) => {
        if (s.isOwn) return { _id: { $in: s.ownZoneIds } };
        if (s.isAllFranchises) return { _id: { $in: s.franchiseZoneIds } };
        return { _id: s.zoneId };
    },
    FoodOrder: (s) => {
        if (s.isOwn) return { $or: [{ franchiseId: null }, { franchiseId: { $exists: false } }] };
        if (s.isAllFranchises) return { franchiseId: { $ne: null, $exists: true } };
        return { franchiseId: s.franchiseId };
    },
    FoodOffer: (s) => {
        if (s.isOwn) return { $or: [{ franchiseId: null }, { franchiseId: { $exists: false } }] };
        if (s.isAllFranchises) return { franchiseId: { $ne: null, $exists: true } };
        return { franchiseId: s.franchiseId };
    },
    FoodFranchise: (s) => (s.isOwn ? { _id: null } : (s.isAllFranchises ? {} : { _id: s.franchiseId })),
    FoodFranchiseUser: (s) => (s.isOwn ? { _id: null } : (s.isAllFranchises ? {} : { franchiseId: s.franchiseId })),
    FoodFranchiseAdjustment: (s) => (s.isOwn ? { _id: null } : (s.isAllFranchises ? {} : { franchiseId: s.franchiseId })),
    FoodFranchiseSettlement: (s) => (s.isOwn ? { _id: null } : (s.isAllFranchises ? {} : { franchiseId: s.franchiseId })),
    FoodFranchiseWithdrawal: (s) => (s.isOwn ? { _id: null } : (s.isAllFranchises ? {} : { franchiseId: s.franchiseId })),
    FoodUser: async (s) => ({ _id: { $in: await customerIds(s) } }),
    // Global categories stay readable (restaurants pick them); only own restaurants' categories can change.
    FoodCategory: async (s, write) => {
        const ids = await restaurantIds(s);
        return write
            ? { restaurantId: { $in: ids } }
            : { $or: [{ restaurantId: { $in: ids } }, { restaurantId: null }, { restaurantId: { $exists: false } }] };
    },
    FoodTransaction: byRestaurant,
    FoodItem: byRestaurant,
    FoodAddon: byRestaurant,
    FoodRestaurantMenu: byRestaurant,
    FoodRestaurantOutletTimings: byRestaurant,
    FoodRestaurantCommission: byRestaurant,
    FoodRestaurantWithdrawal: byRestaurant,
    FoodRestaurantAdjustment: byRestaurant,
    FoodRestaurantSupportTicket: byRestaurant,
    FoodSupportTicket: byRestaurant,
    FeedbackExperience: byRestaurant,
    FoodDeliveryWithdrawal: byRider,
    FoodDeliveryCashDeposit: byRider,
    DeliveryBonusTransaction: byRider,
    FoodEarningAddonHistory: byRider,
    DeliveryLocationLog: byRider,
    DeliverySupportTicket: byRider
};

export const SCOPED_MODELS = Object.keys(RULES);

const READ_OPS = ['find', 'findOne', 'countDocuments', 'distinct'];
const WRITE_OPS = ['findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'];

/** Which owner fields a newly saved document must point at (checked on create). */
const OWNER_CHECKS = {
    restaurantId: { ids: restaurantIds, models: ['FoodItem', 'FoodAddon', 'FoodRestaurantMenu', 'FoodRestaurantOutletTimings', 'FoodRestaurantCommission', 'FoodRestaurantWithdrawal', 'FoodRestaurantAdjustment', 'FoodCategory'] },
    deliveryPartnerId: { ids: riderIds, models: ['FoodDeliveryWithdrawal', 'FoodDeliveryCashDeposit', 'DeliveryBonusTransaction', 'FoodEarningAddonHistory'] }
};

async function assertOwned(modelName, doc, scope) {
    for (const [field, { ids, models }] of Object.entries(OWNER_CHECKS)) {
        if (!models.includes(modelName)) continue;
        const value = doc[field];
        if (!value) {
            if (modelName === 'FoodCategory') throw new ForbiddenError('A franchise cannot create global categories');
            continue;
        }
        const allowed = await ids(scope);
        if (!allowed.some((id) => String(id) === String(value))) {
            throw new ForbiddenError('This record belongs to another zone');
        }
    }
}

function franchiseScopePlugin(schema) {
    // Model name is only known once compiled, so each hook looks it up and exits early for global models.
    schema.pre(READ_OPS, async function scopeRead() {
        const scope = getFranchiseScope();
        const rule = scope && RULES[this.model?.modelName];
        if (!rule || this.getOptions()[SKIP]) return;
        this.where(await rule(scope, false));
    });

    schema.pre(WRITE_OPS, async function scopeWrite() {
        const scope = getFranchiseScope();
        const rule = scope && RULES[this.model?.modelName];
        if (!rule || this.getOptions()[SKIP]) return;
        this.where(await rule(scope, true));
    });

    schema.pre('aggregate', async function scopeAggregate() {
        const scope = getFranchiseScope();
        const rule = scope && RULES[this._model?.modelName];
        if (!rule || this.options?.[SKIP]) return;
        const match = { $match: await rule(scope, false) };
        const pipeline = this.pipeline();
        // $geoNear / $search must stay first.
        const first = pipeline[0] ? Object.keys(pipeline[0])[0] : '';
        pipeline.splice(['$geoNear', '$search', '$vectorSearch'].includes(first) ? 1 : 0, 0, match);
    });

    schema.pre('save', async function scopeSave() {
        const scope = getFranchiseScope();
        const modelName = this.constructor?.modelName;
        if (!scope || !RULES[modelName]) return;
        if (modelName === 'FoodRestaurant' || modelName === 'FoodDeliveryPartner') {
            // Anything a franchise creates or moves stays in its own zone.
            if (this.isNew || this.isModified('zoneId')) this.zoneId = scope.zoneId;
            return;
        }
        if (modelName === 'FoodOffer') {
            if (this.isNew) this.franchiseId = scope.franchiseId;
            return;
        }
        if (this.isNew || this.isModified('restaurantId') || this.isModified('deliveryPartnerId')) {
            await assertOwned(modelName, this, scope);
        }
    });

    schema.pre('insertMany', function scopeInsertMany(next, docs) {
        const scope = getFranchiseScope();
        const modelName = this.modelName;
        if (!scope || !RULES[modelName]) return next();
        const list = Array.isArray(docs) ? docs : [docs];
        return Promise.all(list.map((doc) => assertOwned(modelName, doc, scope))).then(() => next(), next);
    });
}

let registered = false;
export function registerFranchiseScopePlugin() {
    if (registered) return;
    registered = true;
    mongoose.plugin(franchiseScopePlugin);
}
