import os from 'os';
import mongoose from 'mongoose';

/**
 * Cross-instance job lock. If the scheduler is ever started twice (or a run overlaps the next
 * tick), only one instance runs a given job at a time. The lock expires on its own, so a crashed
 * run can never block the job forever.
 */
const jobLockSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        lockedUntil: { type: Date, default: null },
        owner: { type: String, default: '' }
    },
    { collection: 'payment_job_locks', timestamps: true }
);

export const PaymentJobLock = mongoose.models.PaymentJobLock || mongoose.model('PaymentJobLock', jobLockSchema);

const OWNER = `${os.hostname()}:${process.pid}`;

/** Try to take the lock. Returns true if THIS caller now holds it. */
export async function acquireJobLock(name, ttlMs) {
    const now = new Date();
    try {
        const doc = await PaymentJobLock.findOneAndUpdate(
            { name, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
            { $set: { lockedUntil: new Date(now.getTime() + ttlMs), owner: OWNER } },
            { upsert: true, new: true }
        );
        return doc?.owner === OWNER;
    } catch (err) {
        // Upsert collided with a lock that is still held by someone else
        if (err?.code === 11000) return false;
        throw err;
    }
}

export async function releaseJobLock(name) {
    await PaymentJobLock.updateOne({ name, owner: OWNER }, { $set: { lockedUntil: null } });
}
