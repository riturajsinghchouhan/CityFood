/**
 * "HQ pays restaurants & delivery partners" toggle. Runs against an IN-MEMORY MongoDB
 * (needs `npm i -D mongodb-memory-server`); without that package the whole file is skipped.
 *
 * Every order below: subtotal 400, commission 60, delivery 50, platform 8, rider 30, total 458.
 *   restaurant share 340, franchise gross 88, HQ share 20% = 17.6, franchise earning 70.4
 *   net when the franchise pays the partners: 340 + 30 + 70.4 = 440.4 (online)
 *   net when HQ pays the partners:            70.4
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

const M = {};
let finance;
let transitionWithdrawal;
const ctx = {};
const oid = () => new mongoose.Types.ObjectId();

const order = (fields = {}) => ({
    userId: oid(),
    restaurantId: ctx.restaurant,
    franchiseId: ctx.franchise,
    orderStatus: 'delivered',
    pricing: { subtotal: 400, total: 458, deliveryFee: 50, platformFee: 8, restaurantCommission: 60 },
    riderEarning: 30,
    dispatch: { deliveryPartnerId: ctx.rider },
    payment: { method: 'razorpay', status: 'paid' },
    franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, franchiseDiscount: 0, hqPaysPartners: false },
    franchiseSettlementId: null,
    deliveryState: { deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields
});
const hqOrder = (fields = {}) => order({
    franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, franchiseDiscount: 0, hqPaysPartners: true },
    ...fields
});

const setToggle = (value) => M.Settings.updateOne({}, { $set: { hqPaysPartners: value } }, { upsert: true });

async function withdrawal(kind, amount) {
    const Model = kind === 'restaurant' ? M.RestaurantWithdrawal : M.RiderWithdrawal;
    const owner = kind === 'restaurant' ? { restaurantId: ctx.restaurant } : { deliveryPartnerId: ctx.rider };
    const { insertedId } = await Model.collection.insertOne({ ...owner, amount, status: 'pending', createdAt: new Date(), updatedAt: new Date() });
    return insertedId;
}

async function hqApproves(kind, id) {
    const Model = kind === 'restaurant' ? M.RestaurantWithdrawal : M.RiderWithdrawal;
    await transitionWithdrawal(Model, id, 'approved', { transactionId: 'UTR1' });
    await finance.recordHqPaidWithdrawal(kind, id);
    return Model.findById(id).lean();
}

before(async () => {
    if (!mongod) return;
    await mongoose.connect(mongod.getUri(), { dbName: 'franchise_hq_pays_partners' });
    assert.match(String(mongoose.connection.host), /127\.0\.0\.1|localhost/);
    ({ FoodFranchise: M.Franchise } = await import('../src/modules/food/franchise/models/franchise.model.js'));
    ({ FoodFranchiseAdjustment: M.Adjustment } = await import('../src/modules/food/franchise/models/franchiseAdjustment.model.js'));
    ({ FoodOrder: M.Order } = await import('../src/modules/food/orders/models/order.model.js'));
    ({ FoodRestaurant: M.Restaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js'));
    ({ FoodDeliveryPartner: M.Rider } = await import('../src/modules/food/delivery/models/deliveryPartner.model.js'));
    ({ FoodRestaurantWithdrawal: M.RestaurantWithdrawal } = await import('../src/modules/food/restaurant/models/foodRestaurantWithdrawal.model.js'));
    ({ FoodDeliveryWithdrawal: M.RiderWithdrawal } = await import('../src/modules/food/delivery/models/foodDeliveryWithdrawal.model.js'));
    ({ FoodDeliveryCashDeposit: M.Deposit } = await import('../src/modules/food/delivery/models/foodDeliveryCashDeposit.model.js'));
    ({ FoodBusinessSettings: M.Settings } = await import('../src/modules/food/admin/models/businessSettings.model.js'));
    finance = await import('../src/modules/food/franchise/services/franchiseFinance.service.js');
    ({ transitionWithdrawal } = await import('../src/core/payments/payoutTransitions.js'));
    await M.Adjustment.syncIndexes();
});

after(async () => {
    if (!mongod) return;
    await mongoose.disconnect();
    await mongod.stop();
});

beforeEach(async () => {
    if (!mongod) return;
    await Promise.all(Object.values(M).map((m) => m.deleteMany({})));
    const zone = oid();
    ctx.restaurant = (await M.Restaurant.collection.insertOne({ restaurantName: 'Indori Poha', zoneId: zone, status: 'approved' })).insertedId;
    ctx.rider = (await M.Rider.collection.insertOne({ name: 'Raju', phone: '9200000001', zoneId: zone, status: 'approved' })).insertedId;
    const franchise = await M.Franchise.create({
        name: 'CityFood Indore',
        code: 'IND',
        zoneId: zone,
        owner: { name: 'Ramesh', phone: '9876543210' },
        revenueModel: 'COMMISSION',
        commissionPercent: 20,
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    });
    ctx.franchise = franchise._id;
    await setToggle(false);
});

test('an order placed while HQ pays the partners gives the franchise only its own earning', opts, () => {
    const online = finance.splitFranchiseOrder({ ...order(), franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, hqPaysPartners: true } });
    assert.equal(online.net, 70.4);
    const cash = finance.splitFranchiseOrder({
        ...order(),
        payment: { method: 'cash' },
        franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, hqPaysPartners: true }
    });
    assert.equal(cash.net, 70.4);
    assert.equal(finance.splitFranchiseOrder(order()).net, 440.4);
});

test('the toggle is read from business settings', opts, async () => {
    assert.equal(await finance.isHqPayingPartners(), false);
    await setToggle(true);
    assert.equal(await finance.isHqPayingPartners(), true);
});

test('HQ paying a restaurant charges the franchise only the money it held', opts, async () => {
    await M.Order.collection.insertMany([order(), hqOrder()]);
    await setToggle(true);

    const w1 = await hqApproves('restaurant', await withdrawal('restaurant', 500));
    assert.equal(w1.paidBy, 'HQ');
    assert.equal(w1.franchiseCharge, 340);
    const charge = await M.Adjustment.findOne({ franchiseId: ctx.franchise, type: 'HQ_PAID_PAYOUT' }).lean();
    assert.equal(charge.amount, -340);

    // Everything the franchise held is used up: the next payout is all HQ's money.
    const w2 = await hqApproves('restaurant', await withdrawal('restaurant', 180));
    assert.equal(w2.franchiseCharge, 0);
    assert.equal(await M.Adjustment.countDocuments({ type: 'HQ_PAID_PAYOUT' }), 1);

    // Calling it again changes nothing.
    assert.equal(await finance.recordHqPaidWithdrawal('restaurant', w1._id), null);
    assert.equal(await M.Adjustment.countDocuments({ type: 'HQ_PAID_PAYOUT' }), 1);

    // 440.4 + 70.4 from the two orders, minus the 340 the franchise held for the restaurant.
    const { balance } = await finance.getFranchiseBalance(ctx.franchise);
    assert.equal(balance, 170.8);
});

test('partners without orders under the toggle keep the old full charge', opts, async () => {
    await M.Order.collection.insertOne(order());
    await setToggle(true);
    const w = await hqApproves('restaurant', await withdrawal('restaurant', 200));
    assert.equal(w.franchiseCharge, 200);
});

test('a franchise cannot pay or reject partner payouts while HQ pays them', opts, async () => {
    await setToggle(true);
    const id = await withdrawal('rider', 30);
    await assert.rejects(() => finance.franchisePayWithdrawal(ctx.franchise, 'rider', id, { utr: 'UTR9' }), /HQ pays/);
    await assert.rejects(() => finance.franchiseRejectWithdrawal(ctx.franchise, 'rider', id, { reason: 'no' }), /HQ pays/);
});

test('after the toggle is off, a franchise paying money HQ held gets it credited back', opts, async () => {
    await M.Order.collection.insertMany([order(), hqOrder()]);
    await setToggle(false);
    const paid = await finance.franchisePayWithdrawal(ctx.franchise, 'rider', await withdrawal('rider', 60), { utr: 'UTR2' });
    assert.equal(paid.paidBy, 'FRANCHISE');
    assert.equal(paid.franchiseCredit, 30);
    const credit = await M.Adjustment.findOne({ franchiseId: ctx.franchise, type: 'HQ_HELD_PAYOUT' }).lean();
    assert.equal(credit.amount, 30);
});

test('rider cash deposits count for the franchise only up to the cash of its own orders', opts, async () => {
    await M.Order.collection.insertMany([order({ payment: { method: 'cash' } }), hqOrder({ payment: { method: 'cash' } })]);
    await M.Deposit.collection.insertOne({
        deliveryPartnerId: ctx.rider, amount: 916, status: 'Completed', collectedBy: 'HQ', franchiseSettlementId: null, createdAt: new Date()
    });
    const { balance, riderCashDeposited } = await finance.getFranchiseBalance(ctx.franchise);
    // Only the 458 of the older cash order is the franchise's; the rest is HQ's money.
    assert.equal(riderCashDeposited, 458);
    // Same as two online orders: 440.4 + 70.4.
    assert.equal(balance, 510.8);
});
