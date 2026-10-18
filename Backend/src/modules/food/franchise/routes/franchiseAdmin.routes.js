import express from 'express';
import * as controller from '../controllers/franchiseAdmin.controller.js';

// Mounted at /v1/food/admin/franchises behind authMiddleware + super-admin role check (see routes/index.js).
const router = express.Router();

router.get('/', controller.listFranchisesController);
router.get('/available-zones', controller.listAvailableZonesController);
router.get('/riders/without-zone', controller.listRidersWithoutZoneController);
router.get('/withdrawals', controller.listFranchiseWithdrawalsController);
router.patch('/withdrawals/:withdrawalId/approve', controller.approveFranchiseWithdrawalController);
router.patch('/withdrawals/:withdrawalId/reject', controller.rejectFranchiseWithdrawalController);
router.patch('/riders/:riderId/zone', controller.setRiderZoneController);
router.post('/', controller.createFranchiseController);
router.get('/:id', controller.getFranchiseController);
router.patch('/:id', controller.updateFranchiseController);
router.patch('/:id/status', controller.updateFranchiseStatusController);
router.get('/:id/restaurants', controller.listFranchiseRestaurantsController);
router.get('/:id/delivery-partners', controller.listFranchiseDeliveryPartnersController);
router.get('/:id/orders', controller.listFranchiseOrdersController);
router.post('/:id/owner-login', controller.setOwnerLoginController);
router.get('/:id/finance', controller.getFinanceController);
router.post('/:id/settlements/run', controller.runSettlementController);
router.patch('/:id/settlements/:settlementId/paid', controller.markSettlementPaidController);
router.post('/:id/adjustments', controller.addAdjustmentController);
router.post('/:id/payouts/:kind/:withdrawalId/pay', controller.hqPayWithdrawalController);

export default router;
