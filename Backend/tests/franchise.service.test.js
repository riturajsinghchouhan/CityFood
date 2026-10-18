/**
 * Integration tests for the franchise module. They run against an IN-MEMORY MongoDB
 * (needs `npm i -D mongodb-memory-server`) and never touch a real database.
 * Without that package the whole file is skipped.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';

let mongod = null;
let skipReason = '';
try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
} catch {
    skipReason = 'mongodb-memory-server is not installed — run: npm i -D mongodb-memory-server';
}

const opts = { skip: skipReason || false };

let FoodFranchise;
let FoodZone;
let FoodOrder;
let FoodRestaurant;
let FoodDeliveryPartner;
let franchiseService;
let resolveFranchiseForZone;

const oid = () => new mongoose.Types.ObjectId();
const toId = (id) => new mongoose.Types.ObjectId(String(id));
const square = [
    { latitude: 22.7, longitude: 75.8 },
    { latitude: 22.8, longitude: 75.8 },
    { latitude: 22.8, longitude: 75.9 }
];

const commissionDto = (zoneId, extra = {}) => ({
    name: 'CityFood Indore',
    zoneId: String(zoneId),
    owner: { name: 'Ramesh', phone: '9876543210' },
    revenueModel: 'COMMISSION',
    commissionPercent: 20,
    ...extra
});

/** Raw insert: aggregation tests only need the fields the stats read. */
const insertOrder = (fields) =>
    FoodOrder.collection.insertOne({
        restaurantId: oid(),
        userId: oid(),
        createdAt: new Date(),
        pricing: { subtotal: 500, total: 575, deliveryFee: 40, platformFee: 10, restaurantCommission: 100 },
        riderEarning: 35,
        ...fields
    });

before(async () => {
    if (!mongod) return;
    await mongoose.connect(mongod.getUri(), { dbName: 'franchise_test' });
    assert.match(String(mongoose.connection.host), /127\.0\.0\.1|localhost/);

    ({ FoodFranchise } = await import('../src/modules/food/franchise/models/franchise.model.js'));
    ({ FoodZone } = await import('../src/modules/food/admin/models/zone.model.js'));
    ({ FoodOrder } = await import('../src/modules/food/orders/models/order.model.js'));
    ({ FoodRestaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js'));
    ({ FoodDeliveryPartner } = await import('../src/modules/food/delivery/models/deliveryPartner.model.js'));
    franchiseService = await import('../src/modules/food/franchise/services/franchise.service.js');
    ({ resolveFranchiseForZone } = await import('../src/modules/food/franchise/services/franchiseResolver.service.js'));
    await FoodFranchise.syncIndexes();
});

after(async () => {
    if (!mongod) return;
    await mongoose.disconnect();
    await mongod.stop();
});

beforeEach(async () => {
    if (!mongod) return;
    await Promise.all([
        FoodFranchise.deleteMany({}),
        FoodZone.deleteMany({}),
        FoodOrder.collection.deleteMany({}),
        FoodRestaurant.collection.deleteMany({}),
        FoodDeliveryPartner.collection.deleteMany({})
    ]);
});

test('a zone can have only one live franchise, and is free again after termination', opts, async () => {
    const zone = await FoodZone.create({ name: 'Indore', coordinates: square });
    const first = await franchiseService.createFranchise(commissionDto(zone._id));
    assert.match(first.code, /^FR-IND-\d{3}$/);
    assert.equal(first.zone.name, 'Indore');

    await assert.rejects(
        franchiseService.createFranchise(commissionDto(zone._id, { name: 'Second Indore' })),
        /already belongs to franchise "CityFood Indore"/
    );
    assert.equal((await franchiseService.listAvailableZones()).length, 0);
    // While editing, the franchise's own zone stays selectable.
    assert.equal((await franchiseService.listAvailableZones(first._id)).length, 1);

    await franchiseService.updateFranchiseStatus(first._id, { status: 'terminated' });
    assert.equal(await resolveFranchiseForZone(zone._id), null);
    const second = await franchiseService.createFranchise(commissionDto(zone._id, { name: 'New Indore' }));
    assert.equal(second.status, 'active');
});

test('stats count restaurants and riders by zone, orders and earnings by franchise', opts, async () => {
    const indore = await FoodZone.create({ name: 'Indore', coordinates: square });
    const bhopal = await FoodZone.create({ name: 'Bhopal', coordinates: square });
    const fIndore = await franchiseService.createFranchise(commissionDto(indore._id));
    const fBhopal = await franchiseService.createFranchise(commissionDto(bhopal._id, { name: 'CityFood Bhopal' }));

    await FoodRestaurant.collection.insertMany([
        { zoneId: indore._id, status: 'approved', isAcceptingOrders: true },
        { zoneId: indore._id, status: 'approved', isAcceptingOrders: false },
        { zoneId: indore._id, status: 'pending' },
        { zoneId: bhopal._id, status: 'approved' }
    ]);
    await FoodDeliveryPartner.collection.insertMany([
        { zoneId: indore._id, phone: '9000000011', status: 'approved', availabilityStatus: 'online' },
        { zoneId: indore._id, phone: '9000000012', status: 'pending', availabilityStatus: 'offline' },
        { zoneId: bhopal._id, phone: '9000000013', status: 'approved', availabilityStatus: 'online' }
    ]);

    const indoreSnap = { revenueModel: 'COMMISSION', commissionPercent: 20 };
    await insertOrder({ franchiseId: toId(fIndore._id), franchiseSnapshot: indoreSnap, orderStatus: 'delivered' });
    await insertOrder({ franchiseId: toId(fIndore._id), franchiseSnapshot: indoreSnap, orderStatus: 'preparing' });
    await insertOrder({ franchiseId: toId(fIndore._id), franchiseSnapshot: indoreSnap, orderStatus: 'cancelled_by_user' });
    await insertOrder({ franchiseId: toId(fBhopal._id), franchiseSnapshot: indoreSnap, orderStatus: 'delivered' });
    await insertOrder({ franchiseId: null, orderStatus: 'delivered' }); // HQ-operated order

    const { stats } = await franchiseService.getFranchiseById(fIndore._id);
    assert.deepEqual(stats.restaurants, { total: 3, approved: 2, pending: 1, rejected: 0, acceptingOrders: 1 });
    assert.deepEqual(stats.deliveryPartners, { total: 2, approved: 1, pending: 1, rejected: 0, online: 1 });
    assert.equal(stats.orders.total, 3);
    assert.equal(stats.orders.delivered, 1);
    assert.equal(stats.orders.active, 1);
    assert.equal(stats.orders.cancelled, 1);
    // Earning = delivery 40 + platform 10 + commission 100 - rider 35 = 115; HQ 20% = 23.
    assert.equal(stats.earnings.gmv, 575);
    assert.equal(stats.earnings.franchiseGross, 115);
    assert.equal(stats.earnings.hqShare, 23);
    assert.equal(stats.earnings.franchiseNet, 92);

    const { summary } = await franchiseService.listFranchises();
    assert.equal(summary.totalFranchises, 2);
    assert.equal(summary.restaurants, 4);
    assert.equal(summary.deliveredOrders, 2);
    assert.equal(summary.hqCommission, 46);
});

test('HQ share uses the terms frozen on the order, not the current franchise terms', opts, async () => {
    const zone = await FoodZone.create({ name: 'Indore', coordinates: square });
    const f = await franchiseService.createFranchise(commissionDto(zone._id));
    await insertOrder({ franchiseId: toId(f._id), franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20 }, orderStatus: 'delivered' });

    await franchiseService.updateFranchise(f._id, { revenueModel: 'SUBSCRIPTION', subscription: { plan: 'MONTHLY', amount: 5000 } });
    await insertOrder({ franchiseId: toId(f._id), franchiseSnapshot: { revenueModel: 'SUBSCRIPTION', commissionPercent: 0 }, orderStatus: 'delivered' });

    const { stats, commissionPercent, subscription } = await franchiseService.getFranchiseById(f._id);
    assert.equal(commissionPercent, 0);
    assert.equal(subscription.amount, 5000);
    assert.equal(stats.earnings.franchiseGross, 230);
    assert.equal(stats.earnings.hqShare, 23);
});

test('revenue terms are validated per model', opts, async () => {
    const zone = await FoodZone.create({ name: 'Indore', coordinates: square });
    await assert.rejects(
        franchiseService.createFranchise(commissionDto(zone._id, { commissionPercent: 0 })),
        /Commission % is required/
    );
    await assert.rejects(
        franchiseService.createFranchise(commissionDto(zone._id, { revenueModel: 'SUBSCRIPTION', subscription: { plan: 'YEARLY' } })),
        /Subscription amount is required/
    );
});

test('status changes: terminate waits for live orders, terminated is final', opts, async () => {
    const zone = await FoodZone.create({ name: 'Indore', coordinates: square });
    const f = await franchiseService.createFranchise(commissionDto(zone._id));
    await insertOrder({ franchiseId: toId(f._id), orderStatus: 'picked_up' });

    await assert.rejects(franchiseService.updateFranchiseStatus(f._id, { status: 'terminated' }), /still in progress/);

    const suspended = await franchiseService.updateFranchiseStatus(f._id, { status: 'suspended', reason: 'Dues pending' });
    assert.equal(suspended.status, 'suspended');
    assert.equal((await resolveFranchiseForZone(zone._id)).status, 'suspended');

    await FoodOrder.collection.updateMany({}, { $set: { orderStatus: 'delivered' } });
    await franchiseService.updateFranchiseStatus(f._id, { status: 'terminated' });
    await assert.rejects(franchiseService.updateFranchiseStatus(f._id, { status: 'active' }), /Cannot change status/);
    await assert.rejects(franchiseService.updateFranchise(f._id, { name: 'Again' }), /cannot be edited/);
});

test('lists are scoped to the franchise zone', opts, async () => {
    const indore = await FoodZone.create({ name: 'Indore', coordinates: square });
    const bhopal = await FoodZone.create({ name: 'Bhopal', coordinates: square });
    const f = await franchiseService.createFranchise(commissionDto(indore._id));
    await FoodRestaurant.collection.insertMany([
        { zoneId: indore._id, status: 'approved', restaurantName: 'Indori Poha', createdAt: new Date() },
        { zoneId: bhopal._id, status: 'approved', restaurantName: 'Bhopali Gosht', createdAt: new Date() }
    ]);
    await FoodDeliveryPartner.collection.insertMany([
        { zoneId: indore._id, status: 'pending', name: 'Raju', phone: '9000000001', createdAt: new Date() },
        { zoneId: bhopal._id, status: 'approved', name: 'Shyam', phone: '9000000002', createdAt: new Date() }
    ]);
    await insertOrder({ franchiseId: toId(f._id), orderStatus: 'preparing' });
    await insertOrder({ franchiseId: toId(f._id), orderStatus: 'delivered' });

    const restaurants = await franchiseService.listFranchiseRestaurants(f._id, {});
    assert.deepEqual(restaurants.data.map((r) => r.restaurantName), ['Indori Poha']);
    const riders = await franchiseService.listFranchiseDeliveryPartners(f._id, { status: 'pending' });
    assert.deepEqual(riders.data.map((r) => r.name), ['Raju']);
    const active = await franchiseService.listFranchiseOrders(f._id, { status: 'active' });
    assert.equal(active.meta.total, 1);
    assert.equal(active.data[0].orderStatus, 'preparing');
});
