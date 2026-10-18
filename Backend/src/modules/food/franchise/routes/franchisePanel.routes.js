import express from 'express';
import * as controller from '../controllers/franchisePanel.controller.js';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { authRateLimiter } from '../../../../middleware/rateLimit.js';
import { requireFranchise } from '../middleware/franchiseScope.middleware.js';

// Mounted at /v1/food/franchise. Everything except login needs a franchise owner token.
const router = express.Router();

router.post('/auth/login', authRateLimiter, controller.loginController);

router.use(authMiddleware, requireFranchise);

router.post('/auth/change-password', controller.changePasswordController);
router.get('/dashboard', controller.dashboardController);

router.get('/restaurants', controller.listRestaurantsController);
router.patch('/restaurants/:id/approve', controller.approveRestaurantController);
router.patch('/restaurants/:id/reject', controller.rejectRestaurantController);
router.put('/restaurants/:id/commission', controller.setCommissionController);

router.get('/riders', controller.listRidersController);
router.patch('/riders/:id/approve', controller.approveRiderController);
router.patch('/riders/:id/reject', controller.rejectRiderController);
router.post('/riders/:id/collect-cash', controller.collectRiderCashController);

router.get('/orders', controller.listOrdersController);

router.get('/pricing', controller.getPricingController);
router.put('/pricing', controller.updatePricingController);

router.get('/coupons', controller.listCouponsController);
router.post('/coupons', controller.createCouponController);
router.patch('/coupons/:id', controller.updateCouponController);
router.delete('/coupons/:id', controller.deleteCouponController);

router.get('/payouts', controller.listPayoutsController);
router.patch('/payouts/:kind/:id/pay', controller.payPayoutController);
router.patch('/payouts/:kind/:id/reject', controller.rejectPayoutController);

router.get('/finance', controller.financeController);
router.get('/wallet', controller.walletController);
router.post('/withdrawals', controller.requestWithdrawalController);

export default router;
