import { sendResponse } from '../../../../utils/response.js';
import * as franchiseService from '../services/franchise.service.js';
import * as financeService from '../services/franchiseFinance.service.js';
import {
    validateCreateFranchiseDto,
    validateUpdateFranchiseDto,
    validateFranchiseStatusDto,
    validateCreateFranchiseExtras,
    validateOwnerLoginDto,
    validateAdjustmentDto,
    validateUtrDto,
    validateRiderZoneDto,
    validateReasonDto
} from '../validators/franchise.validator.js';

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

const actor = (req) => ({ role: 'HQ', id: req.user?.userId });

export const listFranchisesController = async (req, res, next) => {
    try {
        const data = await franchiseService.listFranchises(req.query);
        return sendResponse(res, 200, 'Franchises fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const listFranchiseOptionsController = handle(async (req, res) => {
    const franchises = await franchiseService.listFranchiseOptions();
    return sendResponse(res, 200, 'Franchises fetched successfully', { franchises });
});

export const listAvailableZonesController = async (req, res, next) => {
    try {
        const zones = await franchiseService.listAvailableZones(req.query.franchiseId);
        return sendResponse(res, 200, 'Available zones fetched successfully', { zones });
    } catch (error) {
        next(error);
    }
};

export const getFranchiseController = async (req, res, next) => {
    try {
        const franchise = await franchiseService.getFranchiseById(req.params.id);
        return sendResponse(res, 200, 'Franchise fetched successfully', { franchise });
    } catch (error) {
        next(error);
    }
};

export const createFranchiseController = async (req, res, next) => {
    try {
        const { ownerPassword, ...extras } = validateCreateFranchiseExtras(req.body);
        const dto = { ...validateCreateFranchiseDto(req.body), ...extras, ownerPassword: ownerPassword || undefined };
        const franchise = await franchiseService.createFranchise(dto, req.user?.userId);
        return sendResponse(res, 201, 'Franchise created successfully', { franchise });
    } catch (error) {
        next(error);
    }
};

export const updateFranchiseController = async (req, res, next) => {
    try {
        const { ownerPassword, ...extras } = validateCreateFranchiseExtras(req.body);
        const dto = { ...validateUpdateFranchiseDto(req.body), ...extras };
        const franchise = await franchiseService.updateFranchise(req.params.id, dto);
        return sendResponse(res, 200, 'Franchise updated successfully', { franchise });
    } catch (error) {
        next(error);
    }
};

export const updateFranchiseStatusController = async (req, res, next) => {
    try {
        const dto = validateFranchiseStatusDto(req.body);
        const franchise = await franchiseService.updateFranchiseStatus(req.params.id, dto);
        return sendResponse(res, 200, 'Franchise status updated successfully', { franchise });
    } catch (error) {
        next(error);
    }
};

export const listFranchiseRestaurantsController = async (req, res, next) => {
    try {
        const data = await franchiseService.listFranchiseRestaurants(req.params.id, req.query);
        return sendResponse(res, 200, 'Franchise restaurants fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const listFranchiseDeliveryPartnersController = async (req, res, next) => {
    try {
        const data = await franchiseService.listFranchiseDeliveryPartners(req.params.id, req.query);
        return sendResponse(res, 200, 'Franchise delivery partners fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const listFranchiseOrdersController = async (req, res, next) => {
    try {
        const data = await franchiseService.listFranchiseOrders(req.params.id, req.query);
        return sendResponse(res, 200, 'Franchise orders fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const setOwnerLoginController = handle(async (req, res) => {
    const { password } = validateOwnerLoginDto(req.body);
    const franchise = await franchiseService.setOwnerLogin(req.params.id, { password });
    sendResponse(res, 200, 'Owner login saved', { franchise });
});

export const getFinanceController = handle(async (req, res) => {
    const id = req.params.id;
    const [balance, settlements, adjustments, restaurantPayouts, riderPayouts] = await Promise.all([
        financeService.getFranchiseBalance(id),
        financeService.listSettlements(id, { limit: 20 }),
        financeService.listAdjustments(id, { limit: 50 }),
        financeService.listFranchiseWithdrawals(id, { kind: 'restaurant', status: 'pending' }),
        financeService.listFranchiseWithdrawals(id, { kind: 'rider', status: 'pending' })
    ]);
    sendResponse(res, 200, 'Franchise finance fetched', {
        balance,
        settlements,
        adjustments,
        pendingPayouts: [...restaurantPayouts, ...riderPayouts].sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue))
    });
});

export const runSettlementController = handle(async (req, res) => {
    const settlement = await financeService.runSettlement(req.params.id, { actor: actor(req) });
    sendResponse(res, 200, settlement ? 'Settlement created' : 'Nothing to settle yet', { settlement });
});

export const markSettlementPaidController = handle(async (req, res) => {
    const { utr, force } = validateUtrDto(req.body);
    const settlement = await financeService.markSettlementPaid(req.params.id, req.params.settlementId, { utr, force, adminId: req.user?.userId });
    sendResponse(res, 200, 'Settlement marked as paid', { settlement });
});

export const addAdjustmentController = handle(async (req, res) => {
    const dto = validateAdjustmentDto(req.body);
    const adjustment = await financeService.addAdjustment(req.params.id, { ...dto, actor: actor(req) });
    sendResponse(res, 201, 'Adjustment recorded', { adjustment });
});

export const hqPayWithdrawalController = handle(async (req, res) => {
    const { utr } = validateUtrDto(req.body);
    const withdrawal = await financeService.hqPayWithdrawal(req.params.id, req.params.kind, req.params.withdrawalId, { utr, adminId: req.user?.userId });
    sendResponse(res, 200, 'Paid by HQ and charged to the franchise', { withdrawal });
});

export const listRidersWithoutZoneController = handle(async (req, res) => {
    const data = await franchiseService.listRidersWithoutZone(req.query);
    sendResponse(res, 200, 'Delivery boys without a zone', data);
});

export const setRiderZoneController = handle(async (req, res) => {
    const { zoneId } = validateRiderZoneDto(req.body);
    const rider = await franchiseService.setRiderZone(req.params.riderId, zoneId);
    sendResponse(res, 200, 'Zone updated', { rider });
});

export const listFranchiseWithdrawalsController = handle(async (req, res) => {
    const withdrawals = await financeService.listFranchiseWithdrawalRequests({ franchiseId: req.query.franchiseId, status: req.query.status });
    sendResponse(res, 200, 'Franchise withdrawal requests', { withdrawals });
});

export const approveFranchiseWithdrawalController = handle(async (req, res) => {
    const { utr } = validateUtrDto(req.body);
    const withdrawal = await financeService.approveFranchiseWithdrawal(req.params.withdrawalId, { utr, adminId: req.user?.userId });
    sendResponse(res, 200, 'Withdrawal approved', { withdrawal });
});

export const rejectFranchiseWithdrawalController = handle(async (req, res) => {
    const { reason } = validateReasonDto(req.body);
    const withdrawal = await financeService.rejectFranchiseWithdrawal(req.params.withdrawalId, { reason, adminId: req.user?.userId });
    sendResponse(res, 200, 'Withdrawal rejected', { withdrawal });
});
