// Finance, dashboard, withdrawals. Web: restaurantAPI.getFinance/getDashboardStats/
// createWithdrawalRequest/getWithdrawalHistory. Bank details: updateBankDetails in ./profile.
// restaurantAPI.getRestaurantByOwner is a hard-coded web stub and is not ported: use
// getFinance().data.restaurant ({name, restaurantId, address}) instead.
import { api } from "./client";

/**
 * GET /food/restaurant/finance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (optional; enables pastCycles)
 * data: {restaurant:{name, restaurantId, address}, currentCycle:{start, end, totalOrders, totalEarnings,
 * orders[]}, invoiceSummary, pastCycles:{orders[], totalOrders}}
 */
export function getFinance(params = {}) {
  return api.get("/food/restaurant/finance", { params: params || {} });
}

// GET /food/restaurant/dashboard-stats?period (default month) -> data {period, restaurant, kpis,
// orderStatusBreakdown, paymentMethodBreakdown, revenueTrend, monthlyTrend, topItems, recentOrders}
export function getDashboardStats(params = {}) {
  return api.get("/food/restaurant/dashboard-stats", { params: params || {} });
}

// Same request id inside one 10 s window, so a double tap returns the original withdrawal.
export const withdrawalRequestId = (amount) => `restaurant-${Number(amount) || 0}-${Math.floor(Date.now() / 10000)}`;

// POST /food/restaurant/withdraw {amount, requestId} -> 201 withdrawal (200 for a duplicate).
// 400 "Insufficient balance. Available: ₹X". Limited to 20 per 10 min.
export function createWithdrawalRequest(amount) {
  return api.post("/food/restaurant/withdraw", { amount: Number(amount), requestId: withdrawalRequestId(amount) });
}

// GET /food/restaurant/withdrawals -> data: withdrawal[] (the array is `data` itself)
export function getWithdrawalHistory() {
  return api.get("/food/restaurant/withdrawals");
}
