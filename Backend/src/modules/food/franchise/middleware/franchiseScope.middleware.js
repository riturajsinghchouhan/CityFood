import { FoodFranchiseUser } from '../models/franchiseUser.model.js';
import { FoodFranchise } from '../models/franchise.model.js';
import { sendError } from '../../../../utils/response.js';
import { FRANCHISE_ROLE } from '../services/franchiseAuth.service.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Runs after authMiddleware on every franchise panel route. Loads the owner's franchise from the
 * database (never from the token or a header) and puts it on req.franchise, so every query below
 * is scoped to that franchise's zone.
 * A suspended or grace franchise can still read (to see its dues); a suspended one cannot change anything.
 */
export const requireFranchise = async (req, res, next) => {
    try {
        if (String(req.user?.role || '').toUpperCase() !== FRANCHISE_ROLE) {
            return sendError(res, 403, 'Franchise access required');
        }
        const user = await FoodFranchiseUser.findById(req.user.userId).select('franchiseId isActive').lean();
        if (!user || !user.isActive) return sendError(res, 401, 'This franchise login is disabled');

        const franchise = await FoodFranchise.findById(user.franchiseId).lean();
        if (!franchise || franchise.status === 'terminated') {
            return sendError(res, 401, 'This franchise is no longer active');
        }
        if (franchise.status === 'suspended' && !READ_METHODS.has(req.method)) {
            return sendError(res, 403, 'Your franchise is suspended. Clear your dues with HQ to make changes.');
        }
        req.franchise = franchise;
        req.franchiseUserId = user._id;
        next();
    } catch (error) {
        next(error);
    }
};
