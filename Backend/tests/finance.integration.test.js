/**
 * Integration tests for the finance layer. They run against an IN-MEMORY MongoDB replica set
 * (needs `npm i -D mongodb-memory-server`) and never touch a real database.
 * Without that package the whole file is skipped.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';

let replSet = null;
let skipReason = '';
try {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
} catch {
    skipReason = 'mongodb-memory-server is not installed — run: npm i -D mongodb-memory-server';
}

const opts = { skip: skipReason || false };

let FoodTransaction;
let FoodOrder;
let Transaction;
let PaymentWebhookEvent;
let finance;
let ledger;
let userWallet;
let reconciliation;
let withTransaction;
let sessionOpts;
let restaurantWithdrawals;
let payoutTransitions;
let payoutBalances;
let jobLock;
let FoodRestaurantWithdrawal;
let FoodDeliveryCashDeposit;
let FoodUserWallet;
let PaymentIntent;
let deliveryFinance;
let dbConfig;

before(async () => {
    if (!replSet) return;
    await mongoose.connect(replSet.getUri(), { dbName: 'finance_test' });
    // Hard stop: never run these against anything but the in-memory server
    assert.match(String(mongoose.connection.host), /127\.0\.0\.1|localhost/);

    ({ FoodTransaction } = await import('../src/modules/food/orders/models/foodTransaction.model.js'));
    ({ FoodOrder } = await import('../src/modules/food/orders/models/order.model.js'));
    ({ Transaction } = await import('../src/core/payments/models/transaction.model.js'));
    ({ PaymentWebhookEvent } = await import('../src/core/payments/models/webhookEvent.model.js'));
    finance = await import('../src/modules/food/orders/services/finance.service.js');
    ledger = await import('../src/core/payments/transaction.service.js');
    userWallet = await import('../src/modules/food/user/services/userWallet.service.js');
    reconciliation = await import('../src/core/payments/reconciliation.service.js');
    ({ withTransaction, sessionOpts } = await import('../src/utils/dbTransaction.js'));
    restaurantWithdrawals = await import('../src/modules/food/restaurant/services/restaurantWithdrawal.service.js');
    payoutTransitions = await import('../src/core/payments/payoutTransitions.js');
    payoutBalances = await import('../src/core/payments/payoutBalances.service.js');
    jobLock = await import('../src/core/payments/jobLock.js');
    ({ FoodRestaurantWithdrawal } = await import('../src/modules/food/restaurant/models/foodRestaurantWithdrawal.model.js'));
    ({ FoodDeliveryCashDeposit } = await import('../src/modules/food/delivery/models/foodDeliveryCashDeposit.model.js'));
    ({ FoodUserWallet } = await import('../src/modules/food/user/models/userWallet.model.js'));
    ({ PaymentIntent } = await import('../src/core/payments/models/paymentIntent.model.js'));
    deliveryFinance = await import('../src/modules/food/delivery/services/deliveryFinance.service.js');
    dbConfig = await import('../src/config/db.js');

    // Build all indexes (unique keys are part of what we are testing)
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

after(async () => {
    if (!replSet) return;
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    if (!replSet) return;
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
});

const oid = () => new mongoose.Types.ObjectId();

/** An order + finance record, created with raw inserts so we do not need every order field. */
async function makeOrder({ method = 'razorpay', paid = false, total = 250, orderStatus = 'created', userId = oid(), restaurantId = oid() } = {}) {
    const orderId = oid();
    await FoodOrder.collection.insertOne({
        _id: orderId,
        userId,
        restaurantId,
        orderStatus,
        payment: { method, status: paid ? 'paid' : method === 'cash' ? 'cod_pending' : 'created', razorpay: { orderId: `order_${orderId}` } },
        pricing: { total },
        createdAt: new Date(),
        updatedAt: new Date()
    });
    await FoodTransaction.create({
        orderId,
        userId,
        restaurantId,
        paymentMethod: method,
        status: paid ? 'captured' : 'pending',
        payment: { method, status: paid ? 'paid' : 'created', amountDue: total, razorpay: { orderId: `order_${orderId}`, paymentId: paid ? `pay_${orderId}` : '' } },
        pricing: { total },
        gateway: { razorpayPaymentId: paid ? `pay_${orderId}` : undefined },
        amounts: { totalCustomerPaid: total, restaurantShare: 200, restaurantCommission: 30, riderShare: 20, platformNetProfit: 0 }
    });
    return { orderId, userId };
}

const tx = (orderId) => FoodTransaction.findOne({ orderId }).lean();
const order = (orderId) => FoodOrder.findById(orderId).lean();
const balance = async (userId) => (await userWallet.getUserWallet(String(userId))).balance;

// ---------------------------------------------------------------- ledger ---------------

test('ledger: same idempotency key applied concurrently moves money exactly once', opts, async () => {
    const userId = String(oid());
    const results = await Promise.all(
        Array.from({ length: 10 }, () =>
            ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'credit', amount: 100, category: 'wallet_topup', idempotencyKey: 'topup:abc' })
        )
    );
    assert.equal(results.filter((r) => !r.duplicate).length, 1, 'only one call may apply the credit');
    assert.equal(await balance(userId), 100);
    assert.equal(await Transaction.countDocuments({ entityId: new mongoose.Types.ObjectId(userId) }), 1);
});

test('ledger: a debit can never overdraw a wallet', opts, async () => {
    const userId = String(oid());
    await ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'credit', amount: 50, category: 'wallet_topup' });
    await assert.rejects(
        ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'debit', amount: 80, category: 'order_payment' }),
        ledger.InsufficientBalanceError
    );
    assert.equal(await balance(userId), 50);
});

test('ledger: parallel debits cannot jointly overdraw', opts, async () => {
    const userId = String(oid());
    await ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'credit', amount: 100, category: 'wallet_topup' });
    const settled = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
            ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'debit', amount: 60, category: 'order_payment', idempotencyKey: `order_payment:${i}` })
        )
    );
    assert.equal(settled.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await balance(userId), 40);
});

test('ledger: wallet and ledger agree after a mix of operations (reconciliation is clean)', opts, async () => {
    const userId = String(oid());
    await ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'credit', amount: 300, category: 'wallet_topup', idempotencyKey: 'k1' });
    await ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'debit', amount: 120.5, category: 'order_payment', idempotencyKey: 'k2' });
    await ledger.recordTransaction({ entityType: 'user', entityId: userId, type: 'credit', amount: 20.25, category: 'order_refund', idempotencyKey: 'k3' });
    const report = await reconciliation.reconcileWallets({ entityType: 'user' });
    assert.equal(report.mismatched, 0);
    assert.equal(await balance(userId), 199.75);
});

// ---------------------------------------------------------------- capture ---------------

test('capture: a payment is applied exactly once, even under concurrency', opts, async () => {
    const { orderId } = await makeOrder();
    const results = await Promise.all(
        Array.from({ length: 6 }, () =>
            finance.capturePayment(orderId, { method: 'razorpay', source: 'test', gatewayPaymentId: `pay_${orderId}`, gatewayOrderId: `order_${orderId}`, amountPaise: 25000 })
        )
    );
    assert.equal(results.filter((r) => r.applied).length, 1);
    const t = await tx(orderId);
    assert.equal(t.status, 'captured');
    assert.equal(t.payment.status, 'paid');
    assert.equal(t.history.filter((h) => h.kind === 'captured').length, 1);
    assert.equal((await order(orderId)).payment.status, 'paid', 'order snapshot mirrors the transaction');
});

test('capture: underpaid and wrong-order payments are rejected', opts, async () => {
    const { orderId } = await makeOrder({ total: 250 });
    const under = await finance.capturePayment(orderId, { method: 'razorpay', source: 'test', gatewayPaymentId: 'pay_x', amountPaise: 24999 });
    assert.equal(under.applied, false);
    assert.equal(under.reason, 'underpaid');
    const wrong = await finance.capturePayment(orderId, { method: 'razorpay', source: 'test', gatewayPaymentId: 'pay_y', gatewayOrderId: 'order_someone_else', amountPaise: 25000 });
    assert.equal(wrong.reason, 'gateway_order_mismatch');
    assert.equal((await tx(orderId)).status, 'pending');
});

test('capture: one gateway payment id can never pay two orders', opts, async () => {
    const a = await makeOrder();
    const b = await makeOrder();
    await finance.capturePayment(a.orderId, { method: 'razorpay', source: 'test', gatewayPaymentId: 'pay_shared', amountPaise: 25000 });
    await assert.rejects(finance.capturePayment(b.orderId, { method: 'razorpay', source: 'test', gatewayPaymentId: 'pay_shared', amountPaise: 25000 }));
    assert.equal((await tx(b.orderId)).status, 'pending');
});

test('capture: COD cash collected by the rider is recorded once', opts, async () => {
    const { orderId } = await makeOrder({ method: 'cash' });
    const first = await finance.capturePayment(orderId, { method: 'cash', source: 'rider_cod', actor: { role: 'DELIVERY_PARTNER' } });
    const second = await finance.capturePayment(orderId, { method: 'cash', source: 'rider_cod' });
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    assert.equal((await order(orderId)).payment.status, 'paid');
});

test('payment failure webhook only records the attempt (customer can retry)', opts, async () => {
    const { orderId } = await makeOrder();
    await finance.recordPaymentAttemptFailure(orderId, { gatewayPaymentId: 'pay_fail1', reason: 'card declined' });
    await finance.recordPaymentAttemptFailure(orderId, { gatewayPaymentId: 'pay_fail1', reason: 'card declined' }); // replay
    const t = await tx(orderId);
    assert.equal(t.status, 'pending', 'transaction is NOT failed by one bad attempt');
    assert.equal(t.history.filter((h) => h.kind === 'payment_attempt_failed').length, 1, 'replay is deduplicated');
});

// ---------------------------------------------------------------- refunds ---------------

test('refund: wallet-paid order cancelled twice refunds exactly once', opts, async () => {
    const userId = oid();
    await ledger.recordTransaction({ entityType: 'user', entityId: String(userId), type: 'credit', amount: 500, category: 'wallet_topup' });
    const { orderId } = await makeOrder({ method: 'wallet', paid: true, total: 250, userId });
    await ledger.recordTransaction({ entityType: 'user', entityId: String(userId), type: 'debit', amount: 250, category: 'order_payment', orderId: String(orderId), idempotencyKey: `order_payment:${orderId}` });
    assert.equal(await balance(userId), 250);

    const runs = await Promise.all([
        finance.settleCancellation(orderId, { reason: 'test', refundDestination: 'wallet' }),
        finance.settleCancellation(orderId, { reason: 'test', refundDestination: 'wallet' }),
        finance.settleCancellation(orderId, { reason: 'test', refundDestination: 'wallet' })
    ]);
    assert.ok(runs.every((r) => r.action === 'refund' || r.action === 'none'));
    assert.equal(await balance(userId), 500, 'refunded once, not three times');
    const t = await tx(orderId);
    assert.equal(t.status, 'refunded');
    assert.equal(t.refund.status, 'processed');
    assert.equal((await order(orderId)).payment.status, 'refunded');
    assert.equal(await Transaction.countDocuments({ idempotencyKey: `order_refund:${orderId}` }), 1);
});

test('refund: both refund entry points share one key (no double refund between them)', opts, async () => {
    const userId = oid();
    const { orderId } = await makeOrder({ method: 'wallet', paid: true, total: 100, userId });
    await userWallet.refundWalletBalance(userId, 100, 'order service refund', { orderId });
    await finance.refundOrder(orderId, { destination: 'wallet', reason: 'finance refund' });
    assert.equal(await balance(userId), 100);
});

test('cancel: unpaid order is closed as failed and no money moves', opts, async () => {
    const { orderId, userId } = await makeOrder({ method: 'razorpay', paid: false });
    const res = await finance.settleCancellation(orderId, { reason: 'changed mind' });
    assert.equal(res.action, 'closed_unpaid');
    assert.equal((await tx(orderId)).status, 'failed');
    assert.equal(await balance(userId), 0);
});

test('cancel: cash order that was already collected is flagged for manual refund', opts, async () => {
    const { orderId } = await makeOrder({ method: 'cash', paid: true });
    const res = await finance.settleCancellation(orderId, { reason: 'test' });
    assert.equal(res.refund.status, 'manual_required');
    assert.equal((await tx(orderId)).status, 'captured');
});

test('refund: gateway confirmation webhook finalises a refund exactly once', opts, async () => {
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true, total: 250 });
    const event = { gatewayPaymentId: `pay_${orderId}`, gatewayRefundId: 'rfnd_1', amountPaise: 25000, eventRef: 'evt_1' };
    const first = await finance.confirmGatewayRefund(event);
    const second = await finance.confirmGatewayRefund(event);
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    const t = await tx(orderId);
    assert.equal(t.status, 'refunded');
    assert.equal(t.history.filter((h) => h.kind === 'refund_processed').length, 1);
});

test('refund: a stuck refund is recovered (wallet path)', opts, async () => {
    const userId = oid();
    const { orderId } = await makeOrder({ method: 'wallet', paid: true, total: 80, userId });
    await FoodTransaction.updateOne({ orderId }, {
        $set: { 'refund.status': 'initiated', 'refund.destination': 'wallet', 'refund.amount': 80 },
        $push: { refunds: { key: 'full', amount: 80, destination: 'wallet', status: 'initiated', ledgerKey: `order_refund:${orderId}` } }
    });
    const recovered = await finance.recoverStuckRefund(orderId);
    assert.equal(recovered.action, 'completed_wallet_refund');
    assert.equal((await tx(orderId)).status, 'refunded');
    assert.equal(await balance(userId), 80);
    await finance.recoverStuckRefund(orderId); // second run is a no-op
    assert.equal(await balance(userId), 80);
});

// ------------------------------------------------------- transactions / rollback ---------

test('database transaction: a failure mid-flow rolls EVERYTHING back', opts, async () => {
    const orderId = oid();
    await assert.rejects(
        withTransaction(async (session) => {
            await FoodOrder.collection.insertOne({ _id: orderId, orderStatus: 'created', payment: { method: 'wallet', status: 'paid' } }, sessionOpts(session));
            await ledger.recordTransaction({ entityType: 'user', entityId: String(oid()), type: 'credit', amount: 10, category: 'wallet_topup', session });
            throw new Error('boom half way through');
        }),
        /boom/
    );
    assert.equal(await FoodOrder.countDocuments({ _id: orderId }), 0, 'order insert rolled back');
    assert.equal(await Transaction.countDocuments({}), 0, 'ledger row rolled back');
});

test('database transaction: wallet payment + order are atomic (insufficient funds leaves nothing behind)', opts, async () => {
    const userId = oid();
    const orderId = oid();
    await assert.rejects(
        withTransaction(async (session) => {
            await FoodOrder.collection.insertOne({ _id: orderId, orderStatus: 'created' }, sessionOpts(session));
            await userWallet.deductWalletBalance(userId, 100, 'order', { orderId }, { session }); // empty wallet -> rejects
        })
    );
    assert.equal(await FoodOrder.countDocuments({ _id: orderId }), 0);
});

// ------------------------------------------------------------ webhooks / recon ----------

test('webhook event log: the unique fingerprint blocks duplicate processing', opts, async () => {
    await PaymentWebhookEvent.create({ provider: 'razorpay', eventType: 'payment.captured', fingerprint: 'evt_same', status: 'processing' });
    await assert.rejects(
        PaymentWebhookEvent.create({ provider: 'razorpay', eventType: 'payment.captured', fingerprint: 'evt_same', status: 'processing' }),
        (err) => err.code === 11000
    );
});

test('reconciliation: finds a captured payment on a cancelled order and the repair refunds it', opts, async () => {
    const userId = oid();
    const { orderId } = await makeOrder({ method: 'wallet', paid: true, total: 60, userId, orderStatus: 'cancelled_by_user' });
    const report = await reconciliation.reconcileOrders({});
    assert.ok(report.issues.some((i) => i.type === 'captured_payment_on_cancelled_order' && i.orderId === String(orderId)));

    const repaired = await reconciliation.repairOrder(orderId);
    assert.ok(repaired.actions.some((a) => a.action === 'refund_cancelled_order'));
    assert.equal((await tx(orderId)).status, 'refunded');
    assert.equal(await balance(userId), 60);

    const after = await reconciliation.reconcileOrders({});
    assert.ok(!after.issues.some((i) => i.type === 'captured_payment_on_cancelled_order'));
});

test('reconciliation: detects an order snapshot that disagrees with its transaction, and resyncs it', opts, async () => {
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true });
    await FoodOrder.collection.updateOne({ _id: orderId }, { $set: { 'payment.status': 'created' } }); // simulate drift
    const report = await reconciliation.reconcileOrders({});
    assert.ok(report.issues.some((i) => i.type === 'order_transaction_status_mismatch'));
    await finance.resyncOrderSnapshot(orderId);
    assert.equal((await order(orderId)).payment.status, 'paid');
});

// ------------------------------------------------------------ payouts ----------------------

test('payout: a restaurant balance is derived from delivered, captured orders minus withdrawals', opts, async () => {
    const restaurantId = oid();
    await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId });
    await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'created', restaurantId }); // not delivered: not earned yet
    const before = await payoutBalances.getRestaurantBalances(restaurantId);
    assert.equal(before.earned, 200);
    assert.equal(before.available, 200);
    await restaurantWithdrawals.requestRestaurantWithdrawal(restaurantId, { amount: 50 });
    const after = await payoutBalances.getRestaurantBalances(restaurantId);
    assert.equal(after.available, 150);
    assert.equal(after.pendingWithdrawals, 50);
});

test('payout: simultaneous withdrawal requests can never over-withdraw', opts, async () => {
    const restaurantId = oid();
    await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId }); // earns 200
    const results = await Promise.allSettled(
        Array.from({ length: 6 }, () => restaurantWithdrawals.requestRestaurantWithdrawal(restaurantId, { amount: 120 }))
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'only one 120 fits in a 200 balance');
    const total = (await FoodRestaurantWithdrawal.find({ restaurantId }).lean()).reduce((sum, w) => sum + w.amount, 0);
    assert.ok(total <= 200);
});

test('payout: the same request id returns the same withdrawal (no duplicate)', opts, async () => {
    const restaurantId = oid();
    await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId });
    const first = await restaurantWithdrawals.requestRestaurantWithdrawal(restaurantId, { amount: 40, idempotencyKey: 'req-1' });
    const second = await restaurantWithdrawals.requestRestaurantWithdrawal(restaurantId, { amount: 40, idempotencyKey: 'req-1' });
    assert.equal(second.duplicate, true);
    assert.equal(String(first.withdrawal._id), String(second.withdrawal._id));
    assert.equal(await FoodRestaurantWithdrawal.countDocuments({ restaurantId }), 1);
});

test('payout: a withdrawal is approved or rejected exactly once', opts, async () => {
    const restaurantId = oid();
    await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId });
    const { withdrawal } = await restaurantWithdrawals.requestRestaurantWithdrawal(restaurantId, { amount: 60 });

    const results = await Promise.allSettled([
        payoutTransitions.transitionWithdrawal(FoodRestaurantWithdrawal, withdrawal._id, 'approved', {}),
        payoutTransitions.transitionWithdrawal(FoodRestaurantWithdrawal, withdrawal._id, 'approved', {}),
        payoutTransitions.transitionWithdrawal(FoodRestaurantWithdrawal, withdrawal._id, 'rejected', {})
    ]);
    const applied = results.filter((r) => r.status === 'fulfilled' && r.value.applied);
    assert.equal(applied.length, 1, 'exactly one transition wins');

    const final = await FoodRestaurantWithdrawal.findById(withdrawal._id).lean();
    assert.ok(['approved', 'rejected'].includes(final.status));
    const opposite = final.status === 'approved' ? 'rejected' : 'approved';
    await assert.rejects(payoutTransitions.transitionWithdrawal(FoodRestaurantWithdrawal, withdrawal._id, opposite, {}), 'final states cannot be changed');
    await assert.rejects(payoutTransitions.transitionWithdrawal(FoodRestaurantWithdrawal, withdrawal._id, 'processed', {}), 'unknown statuses are refused');
});

test('payout: one Razorpay payment can only ever be one cash deposit', opts, async () => {
    const deliveryPartnerId = oid();
    await FoodDeliveryCashDeposit.create({ deliveryPartnerId, amount: 100, status: 'Completed', razorpayPaymentId: 'pay_dep1', razorpayOrderId: 'order_dep1' });
    await assert.rejects(
        FoodDeliveryCashDeposit.create({ deliveryPartnerId, amount: 100, status: 'Completed', razorpayPaymentId: 'pay_dep1', razorpayOrderId: 'order_dep1' }),
        (err) => err.code === 11000
    );
    // admin-recorded deposits (no gateway id) are not affected by that index
    await FoodDeliveryCashDeposit.create({ deliveryPartnerId, amount: 10, status: 'Completed' });
    await FoodDeliveryCashDeposit.create({ deliveryPartnerId, amount: 10, status: 'Completed' });
    assert.equal(await FoodDeliveryCashDeposit.countDocuments({ deliveryPartnerId }), 3);
});

// ------------------------------------------------------------ scheduled jobs ----------------

test('job lock: only one holder at a time, and stale locks can be taken over', opts, async () => {
    assert.equal(await jobLock.acquireJobLock('unit-test-job', 60_000), true);
    await jobLock.PaymentJobLock.updateOne({ name: 'unit-test-job' }, { $set: { owner: 'someone-else', lockedUntil: new Date(Date.now() + 60_000) } });
    assert.equal(await jobLock.acquireJobLock('unit-test-job', 60_000), false, 'held by another owner');
    await jobLock.PaymentJobLock.updateOne({ name: 'unit-test-job' }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    assert.equal(await jobLock.acquireJobLock('unit-test-job', 60_000), true, 'expired locks can be taken over');
});

// ------------------------------------------------------------ integer paise ------------------

test('paise: wallet and ledger are stored as whole paise, so 0.1 + 0.2 is exactly 0.3', opts, async () => {
    const userId = String(oid());
    await ledger.recordTransaction({ entityId: userId, type: 'credit', amount: 0.1, category: 'wallet_topup' });
    await ledger.recordTransaction({ entityId: userId, type: 'credit', amount: 0.2, category: 'wallet_topup' });
    const wallet = await FoodUserWallet.findOne({ userId }).lean();
    assert.equal(wallet.balancePaise, 30);
    assert.ok(Number.isInteger(wallet.balancePaise));
    assert.equal(await balance(userId), 0.3);
    const rows = await Transaction.find({ entityId: new mongoose.Types.ObjectId(userId) }).lean();
    assert.ok(rows.every((r) => Number.isInteger(r.amountPaise) && Number.isInteger(r.balanceAfterPaise)));
});

test('paise: many small transactions accumulate with zero drift', opts, async () => {
    const userId = String(oid());
    for (let i = 0; i < 50; i += 1) {
        await ledger.recordTransaction({ entityId: userId, type: 'credit', amount: 0.07, category: 'wallet_topup', idempotencyKey: `drift:${i}` });
    }
    assert.equal((await FoodUserWallet.findOne({ userId }).lean()).balancePaise, 350);
    assert.equal(await balance(userId), 3.5);
    assert.equal((await reconciliation.reconcileWallets({ entityType: 'user' })).mismatched, 0);
});

test('paise: a fractional-paise amount is rounded, never stored raw', opts, async () => {
    const userId = String(oid());
    await ledger.recordTransaction({ entityId: userId, type: 'credit', amount: 33.330000000000005, category: 'wallet_topup' });
    assert.equal((await FoodUserWallet.findOne({ userId }).lean()).balancePaise, 3333);
});

test('paise: finance records round every rupee amount to exact 2 decimals on write', opts, async () => {
    const { orderId } = await makeOrder({ total: 250 });
    await FoodTransaction.updateOne({ orderId }, { $set: { 'amounts.riderShare': 12.340000000000002, 'refund.amount': 7.005 } });
    const t = await tx(orderId);
    assert.equal(t.amounts.riderShare, 12.34);
    assert.equal(t.refund.amount, 7.01);
});

// ------------------------------------------------------------ partial refunds ---------------

async function walletPaidOrder(total = 100) {
    const userId = oid();
    const { orderId } = await makeOrder({ method: 'wallet', paid: true, total, userId });
    return { orderId, userId };
}

test('partial refund: several partial refunds add up, the last one closes the payment', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);

    const first = await finance.refundOrder(orderId, { destination: 'wallet', amount: 30, idempotencyKey: 'a' });
    assert.equal(first.status, 'processed');
    assert.equal(first.refundedTotal, 30);
    assert.equal(first.remaining, 70);
    assert.equal((await tx(orderId)).status, 'captured', 'still captured while part of it is unrefunded');
    assert.equal(await balance(userId), 30);

    const second = await finance.refundOrder(orderId, { destination: 'wallet', amount: 50, idempotencyKey: 'b' });
    assert.equal(second.refundedTotal, 80);
    assert.equal(await balance(userId), 80);

    const rest = await finance.refundOrder(orderId, { destination: 'wallet' }); // everything still refundable
    assert.equal(rest.amount, 20);
    assert.equal(rest.fullyRefunded, true);
    const t = await tx(orderId);
    assert.equal(t.status, 'refunded');
    assert.equal(t.refundedPaise, 10000);
    assert.equal(t.refunds.length, 3);
    assert.equal((await order(orderId)).payment.status, 'refunded');
    assert.equal(await balance(userId), 100);
});

test('partial refund: the same request key never refunds twice', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);
    const runs = await Promise.all(
        Array.from({ length: 5 }, () => finance.refundOrder(orderId, { destination: 'wallet', amount: 40, idempotencyKey: 'dbl-click' }))
    );
    assert.ok(runs.every((r) => ['processed', 'initiated'].includes(r.status)));
    assert.equal(await balance(userId), 40, 'refunded exactly once');
    const again = await finance.refundOrder(orderId, { destination: 'wallet', amount: 40, idempotencyKey: 'dbl-click' });
    assert.equal(again.duplicate, true);
    assert.equal(await balance(userId), 40);
});

test('partial refund: can never refund more than was paid, in total', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);
    await finance.refundOrder(orderId, { destination: 'wallet', amount: 70, idempotencyKey: 'p1' });
    await assert.rejects(finance.refundOrder(orderId, { destination: 'wallet', amount: 40, idempotencyKey: 'p2' }), /Invalid refund amount/);
    await assert.rejects(finance.refundOrder(orderId, { destination: 'wallet', amount: 0, idempotencyKey: 'p3' }));
    assert.equal(await balance(userId), 70);
});

test('partial refund: a partial amount needs a request key', opts, async () => {
    const { orderId } = await walletPaidOrder(100);
    await assert.rejects(finance.refundOrder(orderId, { destination: 'wallet', amount: 25 }), /idempotencyKey is required/);
});

test('partial refund: concurrent different partial refunds cannot jointly exceed the payment', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);
    const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => finance.refundOrder(orderId, { destination: 'wallet', amount: 60, idempotencyKey: `race-${i}` }))
    );
    const refunded = settled.filter((r) => r.status === 'fulfilled' && r.value.status === 'processed' && !r.value.duplicate);
    assert.equal(refunded.length, 1, 'only one 60 fits in a 100 payment');
    assert.ok((await balance(userId)) <= 100);
    assert.equal((await tx(orderId)).refundedPaise, 6000);
});

test('partial refund: cancelling after a partial refund only refunds the rest', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);
    await finance.refundOrder(orderId, { destination: 'wallet', amount: 40, idempotencyKey: 'early' });
    const res = await finance.settleCancellation(orderId, { reason: 'cancelled later', refundDestination: 'wallet' });
    assert.equal(res.refund.amount, 60);
    assert.equal(await balance(userId), 100);
    assert.equal((await tx(orderId)).status, 'refunded');
});

test('partial refund: a refund made in the Razorpay dashboard is recorded exactly once', opts, async () => {
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true, total: 250 });
    const partial = { gatewayPaymentId: `pay_${orderId}`, gatewayRefundId: 'rfnd_dash1', amountPaise: 10000, eventRef: 'evt_a' };
    assert.equal((await finance.confirmGatewayRefund(partial)).applied, true);
    assert.equal((await finance.confirmGatewayRefund(partial)).applied, false, 'webhook replay is ignored');
    let t = await tx(orderId);
    assert.equal(t.status, 'captured');
    assert.equal(t.refundedPaise, 10000);

    const rest = { gatewayPaymentId: `pay_${orderId}`, gatewayRefundId: 'rfnd_dash2', amountPaise: 15000, eventRef: 'evt_b' };
    const done = await finance.confirmGatewayRefund(rest);
    assert.equal(done.fullyRefunded, true);
    t = await tx(orderId);
    assert.equal(t.status, 'refunded');
    assert.equal(t.refundedPaise, 25000);
    assert.equal((await order(orderId)).payment.status, 'refunded');
});

test('partial refund: reconciliation still flags a cancelled order that was only partly refunded', opts, async () => {
    const { orderId, userId } = await walletPaidOrder(100);
    await FoodOrder.collection.updateOne({ _id: orderId }, { $set: { orderStatus: 'cancelled_by_user' } });
    await finance.refundOrder(orderId, { destination: 'wallet', amount: 30, idempotencyKey: 'half' });
    const report = await reconciliation.reconcileOrders({});
    assert.ok(report.issues.some((i) => i.type === 'captured_payment_on_cancelled_order' && i.orderId === String(orderId)));
    await reconciliation.repairOrder(orderId);
    assert.equal(await balance(userId), 100);
    assert.equal((await tx(orderId)).status, 'refunded');
});

// ------------------------------------------------------------ disputes ----------------------

const dispute = (orderId, status, extra = {}) => ({
    gatewayPaymentId: `pay_${orderId}`, disputeId: 'disp_1', status, amountPaise: 25000, reasonCode: 'fraudulent', ...extra
});

test('dispute: an open chargeback holds the restaurant earnings back, winning releases them', opts, async () => {
    const restaurantId = oid();
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId });
    assert.equal((await payoutBalances.getRestaurantBalances(restaurantId)).available, 200);

    assert.equal((await finance.recordDispute(dispute(orderId, 'open'))).applied, true);
    assert.equal((await finance.recordDispute(dispute(orderId, 'open'))).applied, false, 'replay ignored');
    assert.equal((await tx(orderId)).dispute.status, 'open');
    assert.equal((await payoutBalances.getRestaurantBalances(restaurantId)).available, 0, 'disputed money is held');

    await finance.recordDispute(dispute(orderId, 'won'));
    assert.equal((await payoutBalances.getRestaurantBalances(restaurantId)).available, 200, 'released after winning');
    assert.equal((await tx(orderId)).status, 'captured');

    const stale = await finance.recordDispute(dispute(orderId, 'under_review'));
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, 'stale_event');
    assert.equal((await tx(orderId)).dispute.status, 'won', 'an old event cannot reopen a finished dispute');
});

test('dispute: losing a chargeback is recorded as a refund to the bank, once', opts, async () => {
    const restaurantId = oid();
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered', restaurantId });
    await finance.recordDispute(dispute(orderId, 'open'));
    await finance.recordDispute(dispute(orderId, 'lost'));
    await finance.recordDispute(dispute(orderId, 'lost')); // replay

    const t = await tx(orderId);
    assert.equal(t.status, 'refunded');
    assert.equal(t.dispute.status, 'lost');
    assert.equal(t.refundedPaise, 25000);
    assert.equal(t.refunds.length, 1);
    assert.equal(t.refunds[0].destination, 'chargeback');
    assert.equal((await order(orderId)).payment.status, 'refunded');
    assert.equal((await payoutBalances.getRestaurantBalances(restaurantId)).available, 0);
});

test('dispute: reconciliation reports an open chargeback', opts, async () => {
    const { orderId } = await makeOrder({ method: 'razorpay', paid: true, total: 250, orderStatus: 'delivered' });
    await finance.recordDispute(dispute(orderId, 'open', { respondBy: new Date(Date.now() + 5 * 86400000) }));
    const report = await reconciliation.reconcileOrders({});
    assert.ok(report.issues.some((i) => i.type === 'dispute_open' && i.orderId === String(orderId)));
});

// ------------------------------------------------------------ payment intents ---------------

test('top-up intent: the webhook and verify can both credit, the customer is credited exactly once', opts, async () => {
    const userId = oid();
    const intent = await PaymentIntent.create({ kind: 'wallet_topup', ownerId: userId, gatewayOrderId: 'order_topup_1', amountPaise: 50000 });
    const userWallet2 = await import('../src/modules/food/user/services/userWallet.service.js');

    await Promise.all([
        userWallet2.creditTopupIntent(intent.toObject(), { gatewayPaymentId: 'pay_top1', amountPaise: 50000, source: 'webhook' }),
        userWallet2.creditTopupIntent(intent.toObject(), { gatewayPaymentId: 'pay_top1', amountPaise: 50000, source: 'verify_api' }),
        userWallet2.creditTopupIntent(intent.toObject(), { gatewayPaymentId: 'pay_top1', amountPaise: 50000, source: 'webhook' })
    ]);

    assert.equal(await balance(userId), 500, 'credited once, not three times');
    assert.equal(await Transaction.countDocuments({ idempotencyKey: 'wallet_topup:order_topup_1' }), 1);
    const done = await PaymentIntent.findById(intent._id).lean();
    assert.equal(done.status, 'completed');
    assert.equal(done.gatewayPaymentId, 'pay_top1');
});

test('top-up intent: an order we never created has no intent (so it cannot be replayed as a top-up)', opts, async () => {
    assert.equal(await PaymentIntent.countDocuments({ gatewayOrderId: 'order_for_a_food_order' }), 0);
    await PaymentIntent.create({ kind: 'wallet_topup', ownerId: oid(), gatewayOrderId: 'order_dup', amountPaise: 100 });
    await assert.rejects(
        PaymentIntent.create({ kind: 'wallet_topup', ownerId: oid(), gatewayOrderId: 'order_dup', amountPaise: 100 }),
        (err) => err.code === 11000
    );
});

test('rider deposit intent: recorded exactly once, even when verify and the webhook race', opts, async () => {
    const deliveryPartnerId = oid();
    await PaymentIntent.create({ kind: 'rider_cash_deposit', ownerId: deliveryPartnerId, gatewayOrderId: 'order_dep_77', amountPaise: 20000 });
    const args = { deliveryPartnerId, amount: 200, orderId: 'order_dep_77', paymentId: 'pay_dep77', enforceCashLimit: false };

    const results = await Promise.all([
        deliveryFinance.recordRiderCashDeposit({ ...args, via: 'webhook' }),
        deliveryFinance.recordRiderCashDeposit({ ...args, via: 'verify_api' }),
        deliveryFinance.recordRiderCashDeposit({ ...args, via: 'webhook' })
    ]);
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(await FoodDeliveryCashDeposit.countDocuments({ razorpayPaymentId: 'pay_dep77' }), 1);
    assert.equal((await PaymentIntent.findOne({ gatewayOrderId: 'order_dep_77' }).lean()).status, 'completed');
});

test('rider deposit: the app-side check refuses more than the cash in hand', opts, async () => {
    const deliveryPartnerId = oid(); // holds no cash
    await assert.rejects(
        deliveryFinance.recordRiderCashDeposit({ deliveryPartnerId, amount: 100, orderId: 'order_x', paymentId: 'pay_x', enforceCashLimit: true }),
        /cannot exceed cash in hand/
    );
    assert.equal(await FoodDeliveryCashDeposit.countDocuments({ deliveryPartnerId }), 0);
});

// ------------------------------------------------------------ startup safety ----------------

test('startup: every payment unique index builds (the idempotency guards are really active)', opts, async () => {
    await dbConfig.ensurePaymentIndexes(); // rejects in production / logs loudly if any index failed
    const indexes = await Transaction.collection.indexes();
    assert.ok(indexes.some((i) => i.unique && i.key.idempotencyKey === 1), 'ledger idempotency key is unique');
    const txIdx = await FoodTransaction.collection.indexes();
    assert.ok(txIdx.some((i) => i.unique && i.key.orderId === 1), 'one finance record per order');
    assert.ok(txIdx.some((i) => i.unique && i.key['gateway.razorpayPaymentId'] === 1), 'one Razorpay payment pays one order');
});
