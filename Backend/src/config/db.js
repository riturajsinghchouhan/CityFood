import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * The idempotency guarantees (one ledger row per key, one payment per order, one withdrawal per request
 * id, one webhook per event...) are enforced by UNIQUE INDEXES. If one failed to build — e.g. because
 * duplicate rows already exist — those guarantees are silently gone. So wait for every payment index to
 * be built and shout if not. In production this stops the server from starting (set
 * PAYMENT_STRICT_INDEXES=false to only log).
 */
export const ensurePaymentIndexes = async () => {
    await Promise.all([
        import('../core/payments/models/transaction.model.js'),
        import('../core/payments/models/webhookEvent.model.js'),
        import('../core/payments/models/paymentIntent.model.js'),
        import('../core/payments/models/reconciliationReport.model.js'),
        import('../core/payments/payoutLock.js'),
        import('../core/payments/jobLock.js'),
        import('../modules/food/orders/models/foodTransaction.model.js'),
        import('../modules/food/user/models/userWallet.model.js'),
        import('../modules/food/restaurant/models/foodRestaurantWithdrawal.model.js'),
        import('../modules/food/delivery/models/foodDeliveryWithdrawal.model.js'),
        import('../modules/food/delivery/models/foodDeliveryCashDeposit.model.js'),
        import('../modules/food/admin/models/deliveryBonusTransaction.model.js')
    ]);

    const models = [
        'Transaction', 'PaymentWebhookEvent', 'PaymentIntent', 'PaymentReconciliationReport', 'PayoutAccount',
        'PaymentJobLock', 'FoodTransaction', 'FoodUserWallet', 'FoodRestaurantWithdrawal',
        'FoodDeliveryWithdrawal', 'FoodDeliveryCashDeposit', 'DeliveryBonusTransaction'
    ];
    const failures = [];
    for (const name of models) {
        try {
            await mongoose.model(name).init(); // resolves once every declared index has been built
        } catch (err) {
            failures.push(`${name}: ${err.message}`);
        }
    }

    if (failures.length) {
        const message = `Payment index build FAILED — idempotency guards are not active:\n  ${failures.join('\n  ')}`;
        logger.error(message);
        if (process.env.NODE_ENV === 'production' && process.env.PAYMENT_STRICT_INDEXES !== 'false') {
            throw new Error(message);
        }
    }
};

export const connectDB = async () => {
    try {
        const isLocal = config.mongodbUri.includes('127.0.0.1') || config.mongodbUri.includes('localhost');
        const conn = await mongoose.connect(config.mongodbUri, {
            maxPoolSize: 100,       // Handle up to 100 concurrent DB operations (default is ~5-10)
            minPoolSize: 5,         // Keep 5 connections warm for instant response
            socketTimeoutMS: 45000, // Timeout idle sockets after 45s
        });
        if (isLocal) {
            logger.info(`✅ MongoDB Connected to [LOCAL]: ${conn.connection.host}/${conn.connection.name}`);
        } else {
            logger.warn(`⚠️  MongoDB Connected to [PRODUCTION / ATLAS]: ${conn.connection.host}/${conn.connection.name}`);
        }
        await ensurePaymentIndexes();
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
