import { FoodFranchiseUser } from '../models/franchiseUser.model.js';
import { FoodFranchise } from '../models/franchise.model.js';
import { sendError } from '../../../../utils/response.js';
import { runInFranchiseScope } from '../../../../core/franchiseScope/franchiseScope.js';
import { FRANCHISE_ROLE } from '../services/franchiseAuth.service.js';

/**
 * Lets a franchise owner use the HQ admin APIs (/v1/food/admin/*) for its own zone only.
 *
 * - Reads are allowed except a few HQ-only areas; the data itself is limited to the zone by the
 *   franchise scope plugin, so lists, details, reports and dashboards show only the zone.
 * - Writes are allowed only for operational actions (approve, edit restaurants / food / riders,
 *   orders, payouts, coupons ...). App-wide settings (categories, zones, fees, banners, referral,
 *   sub-admins, payments) stay with HQ.
 * - A suspended franchise can only read.
 * HQ admins pass straight through.
 */

const HQ_ONLY = [
    /^\/sub-admins/, /^\/payments\//, /^\/operational-data/, /^\/upload-settings/, /^\/pages-social-media/,
    /^\/app-intro-ads/, /^\/referral-settings/, /^\/notifications\/broadcast/, /^\/dining\//,
    /^\/safety-emergency-reports/, /^\/contact-messages/, /^\/restaurant-commissions\/global/
];

const ID = '[^/]+';
const re = (s) => new RegExp(`^${s.replace(/:id/g, ID)}/?$`);

const ALLOWED_WRITES = [
    ['POST', '/restaurants'],
    ['PATCH', '/restaurants/:id'],
    ['PATCH', '/restaurants/:id/(status|location|outlet-timings|menu|approve|reject|zone-rank)'],
    ['DELETE', '/restaurants/:id'],
    ['PATCH', '/restaurants/complaints/:id'],
    ['POST', '/restaurant-commissions'],
    ['PATCH', '/restaurant-commissions/:id(/toggle)?'],
    ['DELETE', '/restaurant-commissions/:id'],
    ['PATCH', '/categories/:id/(approve|reject)'],
    ['PATCH', '/addons/:id(/approve|/reject)?'],
    ['PATCH', '/foods/bulk-approve'],
    ['PATCH', '/foods/:id/(approve|reject)'],
    ['POST', '/foods'],
    ['PATCH', '/foods/:id'],
    ['DELETE', '/foods/:id'],
    ['POST', '/menu/.*'],
    ['POST', '/offers'],
    ['PATCH', '/offers/:id/cart-visibility'],
    ['DELETE', '/offers/:id'],
    ['PATCH', '/withdrawals/:id'],
    ['PATCH', '/delivery/withdrawals/:id'],
    ['POST', '/payouts/mark-as-paid'],
    ['POST', '/delivery/payouts/mark-as-paid'],
    ['POST', '/delivery/:id/cash-limit/settle'],
    ['PATCH', '/delivery/:id/(approve|reject|availability)'],
    ['DELETE', '/delivery/:id'],
    ['POST', '/delivery/bonus'],
    ['PATCH', '/support-tickets/:id'],
    ['PATCH', '/delivery/support-tickets/:id'],
    ['PATCH', '/orders/:id/status'],
    ['POST', '/orders/:id/(assign-delivery|resend-notification)']
].map(([method, path]) => ({ method, pattern: re(path) }));

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isAllowedForFranchise(method, path) {
    if (HQ_ONLY.some((p) => p.test(path))) return false;
    if (READ_METHODS.has(method)) return true;
    return ALLOWED_WRITES.some((w) => w.method === method && w.pattern.test(path));
}

export const franchiseAdminGate = async (req, res, next) => {
    if (String(req.user?.role || '').toUpperCase() !== FRANCHISE_ROLE) return next();
    try {
        const user = await FoodFranchiseUser.findById(req.user.userId).select('franchiseId isActive').lean();
        if (!user || !user.isActive) return sendError(res, 401, 'This franchise login is disabled');
        const franchise = await FoodFranchise.findById(user.franchiseId).lean();
        if (!franchise || franchise.status === 'terminated') return sendError(res, 401, 'This franchise is no longer active');

        if (!isAllowedForFranchise(req.method, req.path)) {
            return sendError(res, 403, 'This section is managed by HQ');
        }
        if (franchise.status === 'suspended' && !READ_METHODS.has(req.method)) {
            return sendError(res, 403, 'Your franchise is suspended. Clear your dues with HQ to make changes.');
        }

        // Existing admin services read the zone from the query; pin it to the franchise zone.
        const zoneId = String(franchise.zoneId);
        req.query.zoneId = zoneId;
        req.zoneId = zoneId;
        if (req.method === 'POST' && req.path === '/restaurants' && req.body) req.body.zoneId = zoneId;
        req.franchise = franchise;
        req.franchiseUserId = user._id;

        return runInFranchiseScope({ franchiseId: franchise._id, zoneId: franchise.zoneId }, () => next());
    } catch (error) {
        return next(error);
    }
};
