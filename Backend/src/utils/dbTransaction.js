import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * withTransaction — run payment-critical writes all-or-nothing.
 *
 *   await withTransaction(async (session) => {
 *       await Model.updateOne(filter, update, sessionOpts(session));
 *       ...
 *   });
 *
 * - Pass an existing `session` to join an outer transaction instead of opening a new one.
 * - Uses mongoose's connection.transaction(): retries on transient errors and rolls back
 *   document state when the transaction aborts.
 * - Transactions need a replica set / Atlas. On a standalone mongod (some local dev setups)
 *   it falls back to running without one and logs a warning — but in production this is an
 *   error unless FINANCE_REQUIRE_TRANSACTIONS=false, so money can never silently run unsafe.
 */

let unsupportedLogged = false;
let transactionsUnsupported = false;

const isTransactionUnsupported = (err) => {
    const message = String(err?.message || '');
    return (
        err?.code === 20 ||
        /Transaction numbers are only allowed on a replica set member or mongos/i.test(message) ||
        /transactions are not supported/i.test(message)
    );
};

const mustUseTransactions = () =>
    process.env.NODE_ENV === 'production' && process.env.FINANCE_REQUIRE_TRANSACTIONS !== 'false';

/** Mongoose options object for a (possibly absent) session. */
export const sessionOpts = (session) => (session ? { session } : {});

export async function withTransaction(fn, { session } = {}) {
    if (session) return fn(session);
    if (transactionsUnsupported) return fn(null);

    try {
        return await mongoose.connection.transaction(async (s) => fn(s));
    } catch (err) {
        if (!isTransactionUnsupported(err)) throw err;
        if (mustUseTransactions()) {
            throw new Error('MongoDB transactions are required in production but this deployment does not support them (needs a replica set / Atlas).');
        }
        transactionsUnsupported = true;
        if (!unsupportedLogged) {
            unsupportedLogged = true;
            logger.warn('MongoDB transactions are not supported by this deployment — running payment writes WITHOUT a transaction (development only).');
        }
        return fn(null);
    }
}
