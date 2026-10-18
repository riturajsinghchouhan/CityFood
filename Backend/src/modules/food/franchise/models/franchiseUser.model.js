import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../../../../config/env.js';

/**
 * Login for a franchise owner. Kept apart from FoodAdmin so franchise owners never show up
 * in HQ admin lists, HQ notifications or sub-admin permissions.
 */
const franchiseUserSchema = new mongoose.Schema(
    {
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodFranchise', required: true, index: true },
        name: { type: String, trim: true, default: '' },
        phone: { type: String, required: true, trim: true, unique: true },
        email: { type: String, trim: true, lowercase: true, default: undefined },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ['FRANCHISE_OWNER'], default: 'FRANCHISE_OWNER' },
        isActive: { type: Boolean, default: true },
        lastLoginAt: { type: Date, default: null }
    },
    { collection: 'food_franchise_users', timestamps: true }
);

franchiseUserSchema.index(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);

franchiseUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(config.bcryptSaltRounds || 10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

franchiseUserSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(String(candidate || ''), this.password);
};

export const FoodFranchiseUser = mongoose.model('FoodFranchiseUser', franchiseUserSchema);
