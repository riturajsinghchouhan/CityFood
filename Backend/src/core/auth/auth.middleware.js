import { verifyAccessToken } from './token.util.js';
import { sendError } from '../../utils/response.js';
import { FoodUser } from '../users/user.model.js';
import { apiRateLimiter } from '../../middleware/rateLimit.js';

export const requireAdmin = (req, res, next) => {
    // A franchise owner reaches admin routes only through franchiseAdminGate, which sets req.franchise.
    const franchiseOwner = req.user?.role === 'FRANCHISE_OWNER' && Boolean(req.franchise);
    if (!franchiseOwner && !['ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(req.user?.role)) {
        return sendError(res, 403, 'Admin access required');
    }
    next();
};

export const requireSuperAdmin = (req, res, next) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
        return sendError(res, 403, 'Super Admin access required');
    }
    next();
};

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        console.log("authMiddleware: Authentication token missing");
        return sendError(res, 401, 'Authentication token missing');
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };
        if (decoded.role === 'USER') {
            // Enforce active status in real-time - deactivated users are logged out on next request.
            FoodUser.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    console.log("authMiddleware: User account is deactivated");
                    return sendError(res, 401, 'User account is deactivated');
                }
                apiRateLimiter(req, res, next);
            }).catch(() => {
                console.log("authMiddleware: Authentication failed (DB error)");
                return sendError(res, 401, 'Authentication failed');
            });
            return;
        }
        apiRateLimiter(req, res, next);
    } catch (error) {
        console.log("authMiddleware: Invalid or expired token", error.message);
        return sendError(res, 401, 'Invalid or expired token');
    }
};
