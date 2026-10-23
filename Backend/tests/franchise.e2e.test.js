/**
 * End-to-end tests for the franchise module over real HTTP (the Express app on a random port)
 * against an IN-MEMORY MongoDB. External services are switched off before the app is imported:
 * no Firebase, no Redis, no Google Maps. Without mongodb-memory-server the file is skipped.
 *
 * The steps share state and run in order, following the product flows:
 * HQ gives a franchise -> owner logs in -> onboards restaurants / riders -> sets pricing and coupons
 * -> orders are priced, dispatched and settled -> payouts, dues, grace / suspend -> termination.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    REDIS_ENABLED: 'false',
    BULLMQ_ENABLED: 'false',
    FIREBASE_SERVICE_ACCOUNT: '',
    FIREBASE_SERVICE_ACCOUNT_PATH: '',
    GOOGLE_MAPS_API_KEY: '',
    VITE_GOOGLE_MAPS_API_KEY: '',
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000'
});

let mongod = null;
let skipReason = '';
try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
} catch {
    skipReason = 'mongodb-memory-server is not installed — run: npm i -D mongodb-memory-server';
}
const opts = { skip: skipReason || false };

const DAY = 24 * 60 * 60 * 1000;
const oid = (id) => new mongoose.Types.ObjectId(id ? String(id) : undefined);
const square = (lat, lng) => [
    { latitude: lat, longitude: lng },
    { latitude: lat + 0.1, longitude: lng },
    { latitude: lat + 0.1, longitude: lng + 0.1 }
];

let server;
let base;
const M = {};
const S = {}; // services
const ctx = {}; // ids and tokens shared between steps

async function api(method, path, { token, body, headers = {} } = {}) {
    const res = await fetch(`${base}/api/v1${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json, data: json?.data };
}

const deliveredOrder = (fields) => ({
    userId: oid(),
    restaurantId: ctx.r1,
    orderStatus: 'delivered',
    pricing: { subtotal: 400, total: 458, deliveryFee: 50, platformFee: 8, restaurantCommission: 60 },
    riderEarning: 30,
    payment: { method: 'razorpay', status: 'paid' },
    franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, franchiseDiscount: 0 },
    franchiseSettlementId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields
});

before(async () => {
    if (!mongod) return;
    await mongoose.connect(mongod.getUri(), { dbName: 'franchise_e2e' });
    assert.match(String(mongoose.connection.host), /127\.0\.0\.1|localhost/);

    const { default: app } = await import('../src/app.js');
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;

    ({ FoodFranchise: M.Franchise } = await import('../src/modules/food/franchise/models/franchise.model.js'));
    ({ FoodFranchiseAdjustment: M.Adjustment } = await import('../src/modules/food/franchise/models/franchiseAdjustment.model.js'));
    ({ FoodFranchiseSettlement: M.Settlement } = await import('../src/modules/food/franchise/models/franchiseSettlement.model.js'));
    ({ FoodFranchiseUser: M.FranchiseUser } = await import('../src/modules/food/franchise/models/franchiseUser.model.js'));
    ({ FoodZone: M.Zone } = await import('../src/modules/food/admin/models/zone.model.js'));
    ({ FoodAdmin: M.Admin } = await import('../src/core/admin/admin.model.js'));
    ({ FoodFeeSettings: M.Fee } = await import('../src/modules/food/admin/models/feeSettings.model.js'));
    ({ FoodRestaurant: M.Restaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js'));
    ({ FoodDeliveryPartner: M.Rider } = await import('../src/modules/food/delivery/models/deliveryPartner.model.js'));
    ({ FoodOrder: M.Order } = await import('../src/modules/food/orders/models/order.model.js'));
    ({ FoodRestaurantWithdrawal: M.RestaurantWithdrawal } = await import('../src/modules/food/restaurant/models/foodRestaurantWithdrawal.model.js'));
    ({ FoodDeliveryWithdrawal: M.RiderWithdrawal } = await import('../src/modules/food/delivery/models/foodDeliveryWithdrawal.model.js'));
    ({ FoodDeliveryCashDeposit: M.Deposit } = await import('../src/modules/food/delivery/models/foodDeliveryCashDeposit.model.js'));
    ({ FoodOffer: M.Offer } = await import('../src/modules/food/admin/models/offer.model.js'));
    S.pricing = await import('../src/modules/food/orders/services/order-pricing.service.js');
    S.tx = await import('../src/modules/food/orders/services/foodTransaction.service.js');
    S.dispatch = await import('../src/modules/food/orders/services/order-dispatch.service.js');
    S.resolver = await import('../src/modules/food/franchise/services/franchiseResolver.service.js');
    S.finance = await import('../src/modules/food/franchise/services/franchiseFinance.service.js');
    await Promise.all(Object.values(M).map((m) => m.syncIndexes().catch(() => {})));

    // ----- Seed: two zones, HQ fees, HQ admins, restaurants and riders -----
    const [indore, bhopal, ujjain] = await M.Zone.create([
        { name: 'Indore', coordinates: square(22.7, 75.8) },
        { name: 'Bhopal', coordinates: square(23.2, 77.4) },
        { name: 'Ujjain', coordinates: square(23.1, 75.7) }
    ]);
    Object.assign(ctx, { indore: indore._id, bhopal: bhopal._id, ujjain: ujjain._id });
    await M.Fee.create({ deliveryFee: 30, platformFee: 5, packagingFee: 0, globalRestaurantCommission: 10, applyGlobalTaxes: false, gstRate: 0, isActive: true });
    await M.Admin.create([
        { email: 'owner@cityfood.test', password: 'HqPassword#1', role: 'SUPER_ADMIN' },
        { email: 'sub@cityfood.test', password: 'SubPassword#1', role: 'SUB_ADMIN' }
    ]);
    const restaurants = await M.Restaurant.collection.insertMany([
        { restaurantName: 'Indori Poha', ownerPhone: '9100000001', status: 'approved', zoneId: indore._id, isAcceptingOrders: true, createdAt: new Date() },
        { restaurantName: 'Sarafa Chaat', ownerPhone: '9100000002', status: 'pending', zoneId: indore._id, createdAt: new Date() },
        { restaurantName: 'Bhopali Gosht', ownerPhone: '9100000003', status: 'approved', zoneId: bhopal._id, isAcceptingOrders: true, createdAt: new Date() },
        { restaurantName: 'Mahakal Thali', ownerPhone: '9100000004', status: 'approved', zoneId: ujjain._id, isAcceptingOrders: true, createdAt: new Date() }
    ]);
    [ctx.r1, ctx.r2, ctx.r3, ctx.r4] = Object.values(restaurants.insertedIds);
    const riders = await M.Rider.collection.insertMany([
        { name: 'Raju', phone: '9200000001', status: 'pending', zoneId: indore._id, availabilityStatus: 'offline', createdAt: new Date() },
        { name: 'Shyam', phone: '9200000002', status: 'approved', zoneId: bhopal._id, availabilityStatus: 'online', createdAt: new Date() },
        { name: 'Old Rider', phone: '9200000003', status: 'approved', availabilityStatus: 'online', createdAt: new Date() }
    ]);
    [ctx.d1, ctx.d2, ctx.d0] = Object.values(riders.insertedIds);

    ctx.hq = (await api('POST', '/food/auth/admin/login', { body: { email: 'owner@cityfood.test', password: 'HqPassword#1' } })).data?.accessToken;
    ctx.sub = (await api('POST', '/food/auth/admin/login', { body: { email: 'sub@cityfood.test', password: 'SubPassword#1' } })).data?.accessToken;
    assert.ok(ctx.hq && ctx.sub, 'HQ admins could log in');
});

after(async () => {
    if (!mongod) return;
    server?.close();
    await mongoose.disconnect();
    await mongod.stop();
});

test('1. HQ gives the Indore franchise with an owner login; sub-admins cannot', opts, async () => {
    const denied = await api('GET', '/food/admin/franchises', { token: ctx.sub });
    assert.equal(denied.status, 403);

    const created = await api('POST', '/food/admin/franchises', {
        token: ctx.hq,
        body: {
            name: 'CityFood Indore',
            zoneId: String(ctx.indore),
            owner: { name: 'Ramesh', phone: '9876543210', email: 'ramesh@indore.test' },
            revenueModel: 'COMMISSION',
            commissionPercent: 20,
            ownerPassword: 'Indore@123',
            finance: { creditLimit: 5000, payoutSlaDays: 3, holdbackDays: 7 }
        }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ctx.fi = created.data.franchise._id;
    assert.equal(created.data.franchise.ownerLogin.exists, true);
    assert.equal(created.data.franchise.finance.creditLimit, 5000);

    const duplicate = await api('POST', '/food/admin/franchises', {
        token: ctx.hq,
        body: { name: 'Indore Two', zoneId: String(ctx.indore), owner: { name: 'X', phone: '9876500000' }, revenueModel: 'COMMISSION', commissionPercent: 10 }
    });
    assert.equal(duplicate.status, 400);
});

test('2. Owner logs in; the token reaches only franchise-allowed APIs', opts, async () => {
    const wrong = await api('POST', '/food/franchise/auth/login', { body: { login: '9876543210', password: 'nope-nope' } });
    assert.equal(wrong.status, 401);

    const login = await api('POST', '/food/franchise/auth/login', { body: { login: '9876543210', password: 'Indore@123' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    ctx.owner = login.data.accessToken;
    ctx.ownerRefresh = login.data.refreshToken;
    assert.equal(login.data.user.franchise.zone.name, 'Indore');

    const me = await api('GET', '/food/auth/me', { token: ctx.owner });
    assert.equal(me.data.user.role, 'FRANCHISE_OWNER');
    assert.equal(me.data.user.franchise.name, 'CityFood Indore');

    const refreshed = await api('POST', '/food/auth/refresh-token', { body: { refreshToken: ctx.ownerRefresh } });
    assert.equal(refreshed.status, 200);

    assert.equal((await api('GET', '/food/admin/franchises', { token: ctx.owner })).status, 403);
    // The admin panel APIs work for the owner, limited to its own zone.
    const zones = await api('GET', '/food/admin/zones', { token: ctx.owner });
    assert.equal(zones.status, 200);
    assert.deepEqual(zones.data.zones.map((z) => z.name), ['Indore']);
    assert.equal((await api('GET', '/food/franchise/dashboard', { token: ctx.hq })).status, 403);
});

test('3. Owner onboards only restaurants and riders of their own zone', opts, async () => {
    const list = await api('GET', '/food/franchise/restaurants', { token: ctx.owner });
    assert.deepEqual(list.data.data.map((r) => r.restaurantName).sort(), ['Indori Poha', 'Sarafa Chaat']);

    assert.equal((await api('PATCH', `/food/franchise/restaurants/${ctx.r2}/approve`, { token: ctx.owner })).status, 200);
    assert.equal((await M.Restaurant.findById(ctx.r2).lean()).status, 'approved');
    // Bhopal restaurant: not found for the Indore franchise.
    assert.equal((await api('PATCH', `/food/franchise/restaurants/${ctx.r3}/approve`, { token: ctx.owner })).status, 404);

    assert.equal((await api('PATCH', `/food/franchise/riders/${ctx.d1}/approve`, { token: ctx.owner })).status, 200);
    assert.equal((await api('PATCH', `/food/franchise/riders/${ctx.d2}/approve`, { token: ctx.owner })).status, 404);
    assert.equal((await api('PATCH', `/food/franchise/riders/${ctx.d1}/reject`, { token: ctx.owner, body: {} })).status, 400);

    const riders = await api('GET', '/food/franchise/riders', { token: ctx.owner });
    assert.deepEqual(riders.data.data.map((r) => r.name), ['Raju']);
});

test('4. HQ assigns a zone to a rider who registered before zones existed', opts, async () => {
    const without = await api('GET', '/food/admin/franchises/riders/without-zone', { token: ctx.hq });
    assert.deepEqual(without.data.data.map((r) => r.name), ['Old Rider']);
    const set = await api('PATCH', `/food/admin/franchises/riders/${ctx.d0}/zone`, { token: ctx.hq, body: { zoneId: String(ctx.bhopal) } });
    assert.equal(set.status, 200);
    assert.equal(set.data.rider.zoneName, 'Bhopal');
});

test('5. Franchise pricing, commission and coupons apply only in its zone', opts, async () => {
    const pricing = await api('PUT', '/food/franchise/pricing', { token: ctx.owner, body: { deliveryFee: 50, platformFee: 8, restaurantCommissionPercent: 12 } });
    assert.equal(pricing.status, 200, JSON.stringify(pricing.body));
    assert.equal((await api('PUT', `/food/franchise/restaurants/${ctx.r1}/commission`, { token: ctx.owner, body: { value: 15 } })).status, 200);
    assert.equal((await api('PUT', `/food/franchise/restaurants/${ctx.r3}/commission`, { token: ctx.owner, body: { value: 15 } })).status, 404);

    const coupon = await api('POST', '/food/franchise/coupons', { token: ctx.owner, body: { couponCode: 'indore10', discountType: 'percentage', discountValue: 10 } });
    assert.equal(coupon.status, 201, JSON.stringify(coupon.body));
    assert.equal(coupon.data.coupon.couponCode, 'INDORE10');

    const items = [{ price: 200, quantity: 2 }];
    const indore = (await S.pricing.calculateOrderPricing(String(oid()), { restaurantId: String(ctx.r1), items, couponCode: 'INDORE10' })).pricing;
    assert.equal(indore.deliveryFee, 50);
    assert.equal(indore.platformFee, 8);
    assert.equal(indore.discount, 40);
    assert.equal(indore.appliedCoupon.fundedBy, 'FRANCHISE');

    const bhopal = (await S.pricing.calculateOrderPricing(String(oid()), { restaurantId: String(ctx.r3), items, couponCode: 'INDORE10' })).pricing;
    assert.equal(bhopal.deliveryFee, 30, 'HQ zone keeps HQ fees');
    assert.equal(bhopal.platformFee, 5);
    assert.equal(bhopal.discount, 0);
    assert.match(bhopal.couponError, /not valid for this restaurant/);

    const f = await M.Franchise.findById(ctx.fi).lean();
    const ownRule = await S.tx.getRestaurantCommissionSnapshot({ pricing: { subtotal: 400, total: 418 }, restaurantId: ctx.r1, franchiseId: f._id });
    assert.equal(ownRule.commissionAmount, 60, 'restaurant rule 15%');
    const franchiseDefault = await S.tx.getRestaurantCommissionSnapshot({ pricing: { subtotal: 400, total: 418 }, restaurantId: ctx.r2, franchiseId: f._id });
    assert.equal(franchiseDefault.commissionAmount, 48, 'franchise default 12%');
    const hqDefault = await S.tx.getRestaurantCommissionSnapshot({ pricing: { subtotal: 400, total: 418 }, restaurantId: ctx.r3 });
    assert.equal(hqDefault.commissionAmount, 40, 'HQ global 10%');

    // Gateway fee only when the customer paid through the gateway.
    const fee = await M.Fee.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    await M.Fee.updateOne({ _id: fee._id }, { $set: { globalPaymentGatewayFee: 2, applyGlobalTaxes: true } });
    const online = await S.tx.getRestaurantCommissionSnapshot({ pricing: { subtotal: 400, total: 418 }, restaurantId: ctx.r3, payment: { method: 'razorpay' } });
    assert.equal(online.paymentGatewayFee, 8.36);
    const cash = await S.tx.getRestaurantCommissionSnapshot({ pricing: { subtotal: 400, total: 418 }, restaurantId: ctx.r3, paymentMethod: 'cash' });
    assert.equal(cash.paymentGatewayFee, 0, 'no gateway fee on cash');
    await M.Fee.updateOne({ _id: fee._id }, { $set: { globalPaymentGatewayFee: fee.globalPaymentGatewayFee ?? 0, applyGlobalTaxes: fee.applyGlobalTaxes ?? true } });

    // Who gets what: the parts always add up to what the customer paid (order FOD-1374823's numbers).
    const sample = { subtotal: 120, tax: 14, packagingFee: 10, deliveryFee: 30, platformFee: 5, restaurantCommission: 12, gstOnCommission: 2.16, paymentGatewayFee: 3.58, tcs: 1.2, discount: 0, total: 179 };
    const fr = S.finance.splitOrderEarnings({ franchiseId: ctx.fi, franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20 }, riderEarning: 0, pricing: sample }, 111.06);
    assert.deepEqual([fr.franchiseEarning, fr.hqEarning, fr.taxes.total], [37.6, 9.4, 17.36]);
    const parts = (x) => Math.round((x.restaurantShare + x.riderShare + x.franchiseEarning + x.hqEarning + x.taxes.total + x.paymentGatewayFee) * 100) / 100;
    assert.equal(parts(fr), 179);
    // HQ order with an HQ coupon: HQ keeps the platform earning minus the coupon.
    const hq = S.finance.splitOrderEarnings({ riderEarning: 25, pricing: { ...sample, discount: 20, total: 159, paymentGatewayFee: 0 } }, 114.64);
    assert.deepEqual([hq.franchiseEarning, hq.hqCommission, hq.hqEarning], [0, 22, 2]);
    assert.equal(parts(hq), 159);
});

test('6. Dispatch: franchise orders go only to franchise riders, HQ orders never do', opts, async () => {
    await M.Rider.updateOne({ _id: ctx.d1 }, { $set: { availabilityStatus: 'online' } });
    const indore = await S.dispatch.checkRidersAvailabilityInZone({ restaurantId: String(ctx.r1) });
    assert.equal(indore.count, 1, 'only Raju (Indore)');
    const bhopal = await S.dispatch.checkRidersAvailabilityInZone({ restaurantId: String(ctx.r3) });
    assert.equal(bhopal.count, 2, 'Shyam and Old Rider (both Bhopal, HQ zone); not Raju');

    assert.equal(await S.resolver.riderMayServeFranchise(ctx.bhopal, ctx.fi), false);
    assert.equal(await S.resolver.riderMayServeFranchise(ctx.indore, ctx.fi), true);
});

test('7. Payouts: franchise pays its riders, HQ steps in when the SLA is missed', opts, async () => {
    // Withdrawals from before the franchise started are HQ's to pay, so start the franchise a month ago.
    await M.Franchise.updateOne({ _id: ctx.fi }, { $set: { startDate: new Date(Date.now() - 30 * DAY) } });
    const [older] = await M.RestaurantWithdrawal.create([{ restaurantId: ctx.r1, amount: 999, status: 'pending' }]);
    await M.RestaurantWithdrawal.collection.updateOne({ _id: older._id }, { $set: { createdAt: new Date(Date.now() - 40 * DAY) } });
    const [rw] = await M.RestaurantWithdrawal.create([{ restaurantId: ctx.r1, amount: 200, status: 'pending' }]);
    await M.RestaurantWithdrawal.collection.updateOne({ _id: rw._id }, { $set: { createdAt: new Date(Date.now() - 5 * DAY) } });
    const [dw] = await M.RiderWithdrawal.create([{ deliveryPartnerId: ctx.d1, amount: 50, status: 'pending' }]);
    ctx.rw = rw._id;

    const pending = await api('GET', '/food/franchise/payouts?kind=restaurant', { token: ctx.owner });
    assert.equal(pending.data.payouts.length, 1);
    assert.equal(pending.data.payouts[0].isOverdue, true);

    assert.equal((await api('PATCH', `/food/franchise/payouts/rider/${dw._id}/pay`, { token: ctx.owner, body: {} })).status, 400, 'UTR required');
    const paid = await api('PATCH', `/food/franchise/payouts/rider/${dw._id}/pay`, { token: ctx.owner, body: { utr: 'UPI-RAJU-1' } });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.data.withdrawal.paidBy, 'FRANCHISE');

    const finance = await api('GET', `/food/admin/franchises/${ctx.fi}/finance`, { token: ctx.hq });
    assert.equal(finance.data.pendingPayouts.filter((p) => p.isOverdue).length, 1);
    const hqPaid = await api('POST', `/food/admin/franchises/${ctx.fi}/payouts/restaurant/${rw._id}/pay`, { token: ctx.hq, body: { utr: 'HQ-NEFT-77' } });
    assert.equal(hqPaid.status, 200, JSON.stringify(hqPaid.body));
    assert.equal(hqPaid.data.withdrawal.paidBy, 'HQ');
    const charge = await M.Adjustment.findOne({ franchiseId: ctx.fi, type: 'HQ_PAID_PAYOUT' }).lean();
    assert.equal(charge.amount, -200);
    // Charged only once even if recorded again.
    assert.equal(await S.finance.recordHqPaidWithdrawal('restaurant', rw._id), null);
});

test('8. Weekly settlement: online, cash, coupons, rider cash, holdback and HQ payouts', opts, async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY);
    await M.Order.collection.insertMany([
        // online: net 340 + 30 + (50+8+60-30=88) - 17.6 = 440.4
        deliveredOrder({ franchiseId: oid(ctx.fi), deliveryState: { deliveredAt: tenDaysAgo } }),
        // cash: same, minus the 458 the rider collected = -17.6
        deliveredOrder({ franchiseId: oid(ctx.fi), payment: { method: 'cash' }, deliveryState: { deliveredAt: tenDaysAgo } }),
        // franchise coupon of 40: gross 48, HQ 9.6, net 340 + 30 + 48 - 9.6 = 408.4
        deliveredOrder({ franchiseId: oid(ctx.fi), pricing: { subtotal: 400, total: 418, deliveryFee: 50, platformFee: 8, restaurantCommission: 60, discount: 40 }, franchiseSnapshot: { revenueModel: 'COMMISSION', commissionPercent: 20, franchiseDiscount: 40 }, deliveryState: { deliveredAt: tenDaysAgo } }),
        // delivered today: inside the 7-day holdback, not settled yet
        deliveredOrder({ franchiseId: oid(ctx.fi), deliveryState: { deliveredAt: new Date() } }),
        // refund pending: held back
        deliveredOrder({ franchiseId: oid(ctx.fi), payment: { method: 'razorpay', refund: { status: 'pending' } }, deliveryState: { deliveredAt: tenDaysAgo } })
    ]);
    // Rider handed ₹100 of COD cash to HQ: credited. Cash the franchise collected itself: not credited.
    await M.Deposit.create([
        { deliveryPartnerId: ctx.d1, amount: 100, status: 'Completed', paymentMethod: 'razorpay' },
        { deliveryPartnerId: ctx.d1, amount: 70, status: 'Completed', paymentMethod: 'cash', collectedBy: 'FRANCHISE' }
    ]);

    const run = await api('POST', `/food/admin/franchises/${ctx.fi}/settlements/run`, { token: ctx.hq });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    const s = run.data.settlement;
    assert.equal(s.orders.count, 3);
    assert.equal(s.orders.cashCount, 1);
    assert.equal(s.orders.net, 831.2);
    assert.equal(s.riderCashDeposited, 100);
    assert.equal(s.adjustmentsTotal, -200);
    assert.equal(s.netPayable, 731.2);
    assert.equal(s.status, 'payout_pending');
    ctx.settlement = s._id;

    const again = await api('POST', `/food/admin/franchises/${ctx.fi}/settlements/run`, { token: ctx.hq });
    assert.equal(again.data.settlement, null, 'nothing is settled twice');

    assert.equal((await api('PATCH', `/food/admin/franchises/${ctx.fi}/settlements/${s._id}/paid`, { token: ctx.hq, body: {} })).status, 400);
    const paid = await api('PATCH', `/food/admin/franchises/${ctx.fi}/settlements/${s._id}/paid`, { token: ctx.hq, body: { utr: 'NEFT-SETTLE-1' } });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.data.settlement.status, 'paid');

    // Owner sees the same numbers.
    const finance = await api('GET', '/food/franchise/finance', { token: ctx.owner });
    assert.equal(finance.data.settlements[0].netPayable, 731.2);
    assert.equal(finance.data.balance.unsettledOrders.count, 1, 'only the order inside the holdback');

    const dash = await api('GET', '/food/franchise/dashboard', { token: ctx.owner });
    assert.equal(dash.status, 200);
    assert.equal(dash.data.franchise.stats.orders.delivered, 5);
    assert.equal(dash.data.franchise.notes, undefined, 'HQ notes stay hidden');
});

test('8b. Franchise uses the admin panel for its zone; HQ sees only its commission; withdrawals', opts, async () => {
    // Owner signs in on the normal admin login page with the owner email.
    const adminLogin = await api('POST', '/food/auth/admin/login', { body: { email: 'ramesh@indore.test', password: 'Indore@123' } });
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
    assert.equal(adminLogin.data.user.role, 'FRANCHISE_OWNER');
    const owner = adminLogin.data.accessToken;

    // Same admin APIs, only Indore data.
    const restaurants = await api('GET', '/food/admin/restaurants', { token: owner });
    assert.equal(restaurants.status, 200, JSON.stringify(restaurants.body));
    const names = JSON.stringify(restaurants.data);
    assert.ok(names.includes('Indori Poha') && !names.includes('Bhopali Gosht'), 'only Indore restaurants');
    assert.equal((await api('GET', `/food/admin/restaurants/${ctx.r3}`, { token: owner })).status, 404);
    assert.equal((await api('PATCH', `/food/admin/restaurants/${ctx.r3}/reject`, { token: owner, body: { reason: 'nope' } })).status, 404);
    assert.equal((await M.Restaurant.findById(ctx.r3).lean()).status, 'approved', 'Bhopal restaurant untouched');
    const riders = await api('GET', '/food/admin/delivery/partners', { token: owner });
    assert.equal(riders.status, 200);
    assert.ok(!JSON.stringify(riders.data).includes('Shyam'), 'no Bhopal riders');

    // App-wide settings stay with HQ.
    assert.equal((await api('POST', '/food/admin/categories', { token: owner, body: { name: 'X' } })).status, 403);
    assert.equal((await api('PUT', '/food/admin/fee-settings', { token: owner, body: {} })).status, 403);
    assert.equal((await api('GET', '/food/admin/sub-admins', { token: owner })).status, 403);
    assert.equal((await api('GET', '/food/admin/franchises', { token: owner })).status, 403);

    // HQ dashboard: franchise orders add only HQ commission (4 x 17.6 + 9.6 coupon order = 80), not the 2,250 paid.
    const hqDash = await api('GET', '/food/admin/dashboard-stats', { token: ctx.hq });
    assert.equal(hqDash.status, 200, JSON.stringify(hqDash.body));
    assert.equal(Math.round(hqDash.data.revenue.total * 100) / 100, 80);
    assert.equal(Math.round(hqDash.data.franchiseOrders.hqCommission * 100) / 100, 80);
    // The franchise's own dashboard shows its full sales.
    const frDash = await api('GET', '/food/admin/dashboard-stats', { token: owner });
    assert.equal(frDash.status, 200, JSON.stringify(frDash.body));
    assert.equal(frDash.data.revenue.total, 2250);

    // Orders list tells HQ which franchise an order belongs to and what HQ earns from it.
    const hqOrders = await api('GET', '/food/admin/orders?franchise=any', { token: ctx.hq });
    assert.ok(hqOrders.data.orders.length > 0);
    assert.ok(hqOrders.data.orders.every((o) => o.franchise?.name === 'CityFood Indore'));
    assert.ok(hqOrders.data.orders.some((o) => o.hqEarning === 17.6));
    const hqOnly = await api('GET', '/food/admin/orders?franchise=hq', { token: ctx.hq });
    assert.equal(hqOnly.data.orders.length, 0);

    // HQ "filter by franchise": reads with the header show only that franchise's zone.
    const options = await api('GET', '/food/admin/franchise-options', { token: ctx.hq });
    assert.equal(options.status, 200, JSON.stringify(options.body));
    assert.ok(options.data.franchises.some((f) => f.id === String(ctx.fi) && f.zoneName === 'Indore'));
    const asIndore = { 'X-Franchise-Filter': String(ctx.fi) };
    const allRestaurants = JSON.stringify((await api('GET', '/food/admin/restaurants', { token: ctx.hq })).data);
    assert.ok(allRestaurants.includes('Indori Poha') && allRestaurants.includes('Bhopali Gosht'), 'HQ sees every zone');
    const filtered = await api('GET', '/food/admin/restaurants', { token: ctx.hq, headers: asIndore });
    assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
    const filteredNames = JSON.stringify(filtered.data);
    assert.ok(filteredNames.includes('Indori Poha') && !filteredNames.includes('Bhopali Gosht'), 'filter shows only Indore');
    assert.equal((await api('GET', `/food/admin/restaurants/${ctx.r3}`, { token: ctx.hq, headers: asIndore })).status, 404);
    assert.equal((await api('GET', '/food/admin/restaurants', { token: ctx.hq, headers: { 'X-Franchise-Filter': 'bad' } })).status, 400);

    // Franchise pays its rider from the admin "Delivery Withdrawal" page: no charge to the franchise.
    const [dw] = await M.RiderWithdrawal.create([{ deliveryPartnerId: ctx.d1, amount: 80, status: 'pending' }]);
    const before = await M.Adjustment.countDocuments({ franchiseId: ctx.fi });
    const paid = await api('PATCH', `/food/admin/delivery/withdrawals/${dw._id}`, { token: owner, body: { status: 'approved', transactionId: 'UPI-OWN-1' } });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal((await M.RiderWithdrawal.findById(dw._id).lean()).paidBy, 'FRANCHISE');
    assert.equal(await M.Adjustment.countDocuments({ franchiseId: ctx.fi }), before);

    // Withdrawal request: franchise asks, HQ approves.
    await M.Order.collection.insertOne(deliveredOrder({ franchiseId: oid(ctx.fi), deliveryState: { deliveredAt: new Date(Date.now() - 9 * DAY) } }));
    const wallet = await api('GET', '/food/franchise/wallet', { token: owner });
    assert.equal(wallet.status, 200);
    assert.equal(wallet.data.balance.availableToWithdraw, 440.4, 'only orders past the holdback');
    // Recent orders are on hold and the wallet says when they unlock.
    const { onHold, unsettledOrders, holdbackDays } = wallet.data.balance;
    assert.ok(onHold.count > 0 && onHold.nextReleaseAt, JSON.stringify(onHold));
    assert.ok(new Date(onHold.nextReleaseAt) > new Date(Date.now() + (holdbackDays - 1) * DAY));
    assert.equal(unsettledOrders.franchiseEarning, Math.round((unsettledOrders.franchiseGross - unsettledOrders.hqShare) * 100) / 100);
    assert.equal((await api('POST', '/food/franchise/withdrawals', { token: owner, body: { amount: 500 } })).status, 400);
    const req1 = await api('POST', '/food/franchise/withdrawals', { token: owner, body: { amount: 400, note: 'Weekly' } });
    assert.equal(req1.status, 201, JSON.stringify(req1.body));
    assert.equal((await api('GET', '/food/franchise/wallet', { token: owner })).data.balance.availableToWithdraw, 40.4);

    const list = await api('GET', '/food/admin/franchises/withdrawals?status=pending', { token: ctx.hq });
    assert.equal(list.data.withdrawals.length, 1);
    assert.equal(list.data.withdrawals[0].franchiseId.name, 'CityFood Indore');
    assert.equal((await api('PATCH', `/food/admin/franchises/withdrawals/${req1.data.withdrawal._id}/approve`, { token: owner, body: { utr: 'X-1' } })).status, 403);
    const approved = await api('PATCH', `/food/admin/franchises/withdrawals/${req1.data.withdrawal._id}/approve`, { token: ctx.hq, body: { utr: 'NEFT-FR-1' } });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const after = (await api('GET', '/food/franchise/wallet', { token: owner })).data;
    assert.equal(after.balance.availableToWithdraw, 40.4);
    assert.equal(after.adjustments.find((a) => a.type === 'WITHDRAWAL_PAID').amount, -400);
    assert.equal((await api('PATCH', `/food/admin/franchises/withdrawals/${req1.data.withdrawal._id}/approve`, { token: ctx.hq, body: { utr: 'again' } })).status, 400, 'paid once');

    // A small request left open is closed when the franchise is terminated (test 10).
    ctx.openRequest = (await api('POST', '/food/franchise/withdrawals', { token: owner, body: { amount: 20 } })).data.withdrawal._id;
});

test('8c. "HQ pays partners" toggle: only HQ sets it, and the franchise loses partner payouts', opts, async () => {
    const someId = String(oid());
    assert.equal((await api('PATCH', '/food/admin/business-settings/toggles', { token: ctx.owner, body: { hqPaysPartners: true } })).status, 403);
    const on = await api('PATCH', '/food/admin/business-settings/toggles', { token: ctx.hq, body: { hqPaysPartners: true } });
    assert.equal(on.status, 200);
    assert.equal(on.data.hqPaysPartners, true);
    assert.ok(on.data.hqPaysPartnersChangedAt);

    for (const [method, path] of [
        ['PATCH', `/food/admin/withdrawals/${someId}`],
        ['PATCH', `/food/admin/delivery/withdrawals/${someId}`],
        ['POST', '/food/admin/payouts/mark-as-paid'],
        ['POST', '/food/admin/delivery/payouts/mark-as-paid'],
        ['POST', `/food/admin/delivery/${ctx.d1}/cash-limit/settle`]
    ]) {
        assert.equal((await api(method, path, { token: ctx.owner, body: {} })).status, 403, `${method} ${path}`);
    }
    assert.equal((await api('POST', `/food/franchise/riders/${ctx.d1}/collect-cash`, { token: ctx.owner, body: { amount: 10 } })).status, 400);
    // Reads still work, and HQ itself is not blocked.
    assert.equal((await api('GET', '/food/admin/withdrawals', { token: ctx.owner })).status, 200);
    assert.notEqual((await api('PATCH', `/food/admin/withdrawals/${someId}`, { token: ctx.hq, body: { status: 'approved' } })).status, 403);

    assert.equal((await api('PATCH', '/food/admin/business-settings/toggles', { token: ctx.hq, body: { hqPaysPartners: false } })).status, 200);
    assert.notEqual((await api('PATCH', `/food/admin/withdrawals/${someId}`, { token: ctx.owner, body: { status: 'approved' } })).status, 403);
});

test('9. Subscription franchise: billed, goes to grace, then suspended, then active after paying', opts, async () => {
    const created = await api('POST', '/food/admin/franchises', {
        token: ctx.hq,
        body: {
            name: 'CityFood Ujjain',
            zoneId: String(ctx.ujjain),
            owner: { name: 'Suresh', phone: '9876500011' },
            revenueModel: 'SUBSCRIPTION',
            subscription: { plan: 'MONTHLY', amount: 5000 },
            ownerPassword: 'Ujjain@123',
            finance: { creditLimit: 1000, graceDays: 7 }
        }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const fu = created.data.franchise._id;
    const fee = await M.Adjustment.findOne({ franchiseId: fu, type: 'SUBSCRIPTION_FEE' }).lean();
    assert.equal(fee.amount, -5000, 'first month billed at once');

    const now = Date.now();
    let changes = await S.finance.applyDuesStatus({ now: new Date(now) });
    assert.deepEqual(changes.map((c) => c.status), ['grace']);
    changes = await S.finance.applyDuesStatus({ now: new Date(now + 8 * DAY) });
    assert.deepEqual(changes.map((c) => c.status), ['suspended']);

    await assert.rejects(
        S.pricing.calculateOrderPricing(String(oid()), { restaurantId: String(ctx.r4), items: [{ price: 100, quantity: 1 }] }),
        /temporarily unavailable in this area/
    );
    const ownerU = (await api('POST', '/food/franchise/auth/login', { body: { login: '9876500011', password: 'Ujjain@123' } })).data.accessToken;
    assert.equal((await api('GET', '/food/franchise/dashboard', { token: ownerU })).status, 200, 'can still read');
    assert.equal((await api('PUT', '/food/franchise/pricing', { token: ownerU, body: { deliveryFee: 10 } })).status, 403, 'cannot change while suspended');

    const payment = await api('POST', `/food/admin/franchises/${fu}/adjustments`, { token: ctx.hq, body: { type: 'PAYMENT_RECEIVED', amount: 5000, utr: 'UPI-SURESH-1' } });
    assert.equal(payment.status, 201);
    changes = await S.finance.applyDuesStatus({ now: new Date(now + 9 * DAY) });
    assert.deepEqual(changes.map((c) => c.status), ['active']);

    // Next month is billed by the renewal job once the period ends (and only once).
    const renewal = await S.finance.renewSubscriptions({ now: new Date(now + 32 * DAY) });
    assert.equal(renewal.charged, 1);
    assert.equal((await S.finance.renewSubscriptions({ now: new Date(now + 32 * DAY) })).charged, 0);
    assert.equal(await M.Adjustment.countDocuments({ franchiseId: fu, type: 'SUBSCRIPTION_FEE' }), 2);

    // HQ-set statuses are not undone by automation.
    await api('PATCH', `/food/admin/franchises/${fu}/status`, { token: ctx.hq, body: { status: 'suspended', reason: 'Agreement review' } });
    await api('POST', `/food/admin/franchises/${fu}/adjustments`, { token: ctx.hq, body: { type: 'PAYMENT_RECEIVED', amount: 5000 } });
    assert.deepEqual(await S.finance.applyDuesStatus({ now: new Date(now + 33 * DAY) }), []);
});

test('10. Terminating Indore: waits for live orders, settles the rest, returns the zone to HQ', opts, async () => {
    await M.Order.collection.insertOne(deliveredOrder({ franchiseId: oid(ctx.fi), orderStatus: 'picked_up' }));
    const blocked = await api('PATCH', `/food/admin/franchises/${ctx.fi}/status`, { token: ctx.hq, body: { status: 'terminated' } });
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.error, /still in progress/);

    await M.Order.updateMany({ franchiseId: ctx.fi, orderStatus: 'picked_up' }, { $set: { orderStatus: 'delivered', 'deliveryState.deliveredAt': new Date() } });
    const done = await api('PATCH', `/food/admin/franchises/${ctx.fi}/status`, { token: ctx.hq, body: { status: 'terminated' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));

    const finalSettlement = await M.Settlement.findOne({ franchiseId: ctx.fi }).sort({ number: -1 }).lean();
    assert.equal(finalSettlement.number, 2);
    assert.equal(finalSettlement.orders.count, 3, 'holdback skipped on the final settlement');
    const closed = await mongoose.connection.db.collection('food_franchise_withdrawals').findOne({ _id: oid(ctx.openRequest) });
    assert.equal(closed.status, 'rejected');

    assert.equal((await api('POST', '/food/franchise/auth/login', { body: { login: '9876543210', password: 'Indore@123' } })).status, 401);
    assert.equal((await api('GET', '/food/franchise/dashboard', { token: ctx.owner })).status, 401);
    assert.equal(await S.resolver.resolveFranchiseForZone(ctx.indore), null);
    const zones = await api('GET', '/food/admin/franchises/available-zones', { token: ctx.hq });
    assert.ok(zones.data.zones.some((z) => z.name === 'Indore'));
    // Indore riders now serve HQ orders.
    const scope = await S.resolver.getRiderScopeFilterForZone(ctx.indore);
    assert.equal(Boolean(scope.zoneId?.$nin?.some((z) => String(z) === String(ctx.indore))), false);
});
