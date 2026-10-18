import { randomUUID } from 'crypto';
import ms from 'ms';
import { FoodFranchiseUser } from '../models/franchiseUser.model.js';
import { FoodFranchise } from '../models/franchise.model.js';
import { FoodRefreshToken } from '../../../../core/refreshTokens/refreshToken.model.js';
import { signAccessToken, signRefreshToken } from '../../../../core/auth/token.util.js';
import { AuthError, ValidationError } from '../../../../core/auth/errors.js';
import { config } from '../../../../config/env.js';

export const FRANCHISE_ROLE = 'FRANCHISE_OWNER';

const publicUser = (user, franchise) => ({
    _id: String(user._id),
    name: user.name,
    phone: user.phone,
    email: user.email || '',
    role: FRANCHISE_ROLE,
    franchise: franchise
        ? {
            _id: String(franchise._id),
            name: franchise.name,
            code: franchise.code,
            status: franchise.status,
            zone: franchise.zoneId?.name ? { _id: String(franchise.zoneId._id), name: franchise.zoneId.name } : null
        }
        : null
});

/** Owner logs in with the phone (or email) HQ registered and the password HQ set. */
export async function loginFranchiseOwner({ login, password }) {
    const raw = String(login || '').trim();
    if (!raw || !password) throw new ValidationError('Phone / email and password are required');
    const digits = raw.replace(/\D/g, '');
    const query = raw.includes('@') ? { email: raw.toLowerCase() } : { phone: digits.slice(-10) };
    const user = await FoodFranchiseUser.findOne(query).select('+password');
    // Same message for unknown login and wrong password, so logins cannot be probed.
    if (!user || !(await user.comparePassword(password))) throw new AuthError('Invalid login or password');
    if (!user.isActive) throw new AuthError('This franchise login is disabled. Contact HQ.');

    const franchise = await FoodFranchise.findById(user.franchiseId).populate('zoneId', 'name').lean();
    if (!franchise || franchise.status === 'terminated') throw new AuthError('This franchise is no longer active. Contact HQ.');

    const payload = { userId: String(user._id), role: FRANCHISE_ROLE };
    const accessToken = signAccessToken(payload);
    // jti keeps two logins within the same second from producing the same (unique-indexed) refresh token.
    const refreshToken = signRefreshToken({ ...payload, jti: randomUUID() });
    await FoodRefreshToken.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + ms(config.jwtRefreshExpiresIn || '365d'))
    });
    user.lastLoginAt = new Date();
    await user.save();
    return { accessToken, refreshToken, user: publicUser(user, franchise) };
}

export async function changeFranchisePassword(userId, { currentPassword, newPassword }) {
    if (String(newPassword || '').length < 8) throw new ValidationError('New password must be at least 8 characters');
    const user = await FoodFranchiseUser.findById(userId).select('+password');
    if (!user) throw new AuthError('Login not found');
    if (!(await user.comparePassword(currentPassword))) throw new ValidationError('Current password is wrong');
    user.password = String(newPassword);
    await user.save();
    return { changed: true };
}
