import { ValidationError } from '../auth/errors.js';

/**
 * Withdrawal requests move pending -> approved | rejected, once. Approved and rejected are final.
 * The change is one conditional update, so approving or rejecting twice (double click, two admins)
 * can never apply twice.
 */
const ALLOWED_FROM = Object.freeze({
    approved: ['pending'],
    rejected: ['pending']
});

export async function transitionWithdrawal(Model, id, nextStatus, fields = {}) {
    const next = String(nextStatus || '').toLowerCase();
    const allowedFrom = ALLOWED_FROM[next];
    if (!allowedFrom) throw new ValidationError(`Invalid withdrawal status '${nextStatus}'`);

    const updated = await Model.findOneAndUpdate(
        { _id: id, status: { $in: allowedFrom } },
        { $set: { ...fields, status: next, processedAt: new Date() } },
        { new: true }
    );
    if (updated) return { withdrawal: updated, applied: true };

    const current = await Model.findById(id).select('status').lean();
    if (!current) throw new ValidationError('Withdrawal request not found');
    if (current.status === next) return { withdrawal: current, applied: false };
    throw new ValidationError(`A '${current.status}' withdrawal cannot be changed to '${next}'`);
}
