import { sendResponse } from '../../../../utils/response.js';
import * as panel from '../services/franchisePanel.service.js';
import * as financeService from '../services/franchiseFinance.service.js';
import { loginFranchiseOwner, changeFranchisePassword } from '../services/franchiseAuth.service.js';
import {
    validateFranchiseLoginDto,
    validateChangePasswordDto,
    validatePricingDto,
    validateCommissionDto,
    validateCollectCashDto,
    validateCouponDto,
    validateCouponUpdateDto,
    validateUtrDto,
    validateReasonDto,
    validateWithdrawalRequestDto
} from '../validators/franchise.validator.js';

// Every handler below runs after requireFranchise, so req.franchise is the caller's own franchise.
const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

export const loginController = handle(async (req, res) => {
    const result = await loginFranchiseOwner(validateFranchiseLoginDto(req.body));
    sendResponse(res, 200, 'Login successful', result);
});

export const changePasswordController = handle(async (req, res) => {
    const result = await changeFranchisePassword(req.franchiseUserId, validateChangePasswordDto(req.body));
    sendResponse(res, 200, 'Password changed', result);
});

export const dashboardController = handle(async (req, res) => {
    sendResponse(res, 200, 'Dashboard', await panel.getDashboard(req.franchise));
});

export const listRestaurantsController = handle(async (req, res) => {
    sendResponse(res, 200, 'Restaurants', await panel.listRestaurants(req.franchise, req.query));
});

export const approveRestaurantController = handle(async (req, res) => {
    sendResponse(res, 200, 'Restaurant approved', await panel.approveRestaurant(req.franchise, req.params.id));
});

export const rejectRestaurantController = handle(async (req, res) => {
    const { reason } = validateReasonDto(req.body);
    sendResponse(res, 200, 'Restaurant rejected', await panel.rejectRestaurant(req.franchise, req.params.id, reason));
});

export const setCommissionController = handle(async (req, res) => {
    const dto = validateCommissionDto(req.body);
    sendResponse(res, 200, 'Commission saved', { commission: await panel.setRestaurantCommission(req.franchise, req.params.id, dto) });
});

export const listRidersController = handle(async (req, res) => {
    sendResponse(res, 200, 'Delivery boys', await panel.listRiders(req.franchise, req.query));
});

export const approveRiderController = handle(async (req, res) => {
    sendResponse(res, 200, 'Delivery boy approved', await panel.approveRider(req.franchise, req.params.id));
});

export const rejectRiderController = handle(async (req, res) => {
    const { reason } = validateReasonDto(req.body);
    sendResponse(res, 200, 'Delivery boy rejected', await panel.rejectRider(req.franchise, req.params.id, reason));
});

export const collectRiderCashController = handle(async (req, res) => {
    const dto = validateCollectCashDto(req.body);
    sendResponse(res, 200, 'Cash collection recorded', { deposit: await panel.collectRiderCash(req.franchise, req.params.id, dto) });
});

export const listOrdersController = handle(async (req, res) => {
    sendResponse(res, 200, 'Orders', await panel.listOrders(req.franchise, req.query));
});

export const getPricingController = handle(async (req, res) => {
    sendResponse(res, 200, 'Pricing', panel.getPricing(req.franchise));
});

export const updatePricingController = handle(async (req, res) => {
    sendResponse(res, 200, 'Pricing saved', await panel.updatePricing(req.franchise, validatePricingDto(req.body)));
});

export const listCouponsController = handle(async (req, res) => {
    sendResponse(res, 200, 'Coupons', { coupons: await panel.listCoupons(req.franchise) });
});

export const createCouponController = handle(async (req, res) => {
    sendResponse(res, 201, 'Coupon created', { coupon: await panel.createCoupon(req.franchise, validateCouponDto(req.body)) });
});

export const updateCouponController = handle(async (req, res) => {
    sendResponse(res, 200, 'Coupon updated', { coupon: await panel.updateCoupon(req.franchise, req.params.id, validateCouponUpdateDto(req.body)) });
});

export const deleteCouponController = handle(async (req, res) => {
    sendResponse(res, 200, 'Coupon removed', await panel.deleteCoupon(req.franchise, req.params.id));
});

export const listPayoutsController = handle(async (req, res) => {
    const kind = req.query.kind === 'rider' ? 'rider' : 'restaurant';
    const status = req.query.status || 'pending';
    const payouts = await financeService.listFranchiseWithdrawals(req.franchise._id, { kind, status });
    sendResponse(res, 200, 'Payouts', { payouts });
});

export const payPayoutController = handle(async (req, res) => {
    const { utr, note } = validateUtrDto(req.body);
    const withdrawal = await financeService.franchisePayWithdrawal(req.franchise._id, req.params.kind, req.params.id, { utr, note });
    sendResponse(res, 200, 'Payout marked as paid', { withdrawal });
});

export const rejectPayoutController = handle(async (req, res) => {
    const { reason } = validateReasonDto(req.body);
    const withdrawal = await financeService.franchiseRejectWithdrawal(req.franchise._id, req.params.kind, req.params.id, { reason });
    sendResponse(res, 200, 'Payout rejected', { withdrawal });
});

export const financeController = handle(async (req, res) => {
    const id = req.franchise._id;
    const [balance, settlements, adjustments] = await Promise.all([
        financeService.getFranchiseBalance(id),
        financeService.listSettlements(id),
        financeService.listAdjustments(id)
    ]);
    sendResponse(res, 200, 'Finance', { balance, settlements, adjustments });
});

export const walletController = handle(async (req, res) => {
    const id = req.franchise._id;
    const [balance, withdrawals, adjustments] = await Promise.all([
        financeService.getFranchiseBalance(id),
        financeService.listFranchiseWithdrawalRequests({ franchiseId: id }),
        financeService.listAdjustments(id)
    ]);
    sendResponse(res, 200, 'Wallet', { balance, withdrawals, adjustments, bank: req.franchise.bank || {} });
});

export const requestWithdrawalController = handle(async (req, res) => {
    const dto = validateWithdrawalRequestDto(req.body);
    const withdrawal = await financeService.requestFranchiseWithdrawal(req.franchise._id, dto);
    sendResponse(res, 201, 'Withdrawal request sent to HQ', { withdrawal });
});
