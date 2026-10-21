// Earnings, pocket, wallet, payouts, cash limit and deposits. Web: deliveryAPI.getWallet/
// getWalletTransactions/getEarnings/getActiveEarningAddons/getTripHistory/getPocketDetails/getCashLimit/
// createWithdrawalRequest/createDepositOrder/verifyDepositPayment. Audit #29-#37.
import { api } from "./client";

/**
 * GET /food/delivery/wallet (#29) ?type=bonus|deposit|deduction|withdrawal&limit≤200 ->
 * {wallet:{totalBalance, pocketBalance, cashInHand, totalWithdrawn, pendingWithdrawals, totalEarned,
 * totalBonus, totalCashLimit, availableCashLimit, deliveryWithdrawalLimit, transactions[]}}
 */
export function getWallet(params) {
  return api.get("/food/delivery/wallet", params ? { params } : undefined);
}

// Same endpoint, unwrapped like the web: data.transactions = wallet.transactions.
// (type "deduction" is never produced, so DeductionStatement is always empty — audit §6 F7.)
export function getWalletTransactions(params) {
  return getWallet(params ?? {}).then((res) => ({
    ...res,
    data: { transactions: res?.data?.wallet?.transactions ?? [] },
  }));
}

// GET /food/delivery/earnings (#30) ?period=today|week|month|all&date&page&limit -> {summary, period, ...}
export function getEarnings(params) {
  return api.get("/food/delivery/earnings", { params: params ?? {} });
}

// GET /food/delivery/earning-addons/active (#31) -> {activeOffer, offers[]}
export function getActiveEarningAddons() {
  return api.get("/food/delivery/earning-addons/active");
}

// GET /food/delivery/trip-history (#32) ?period=daily|weekly|monthly&date&status&startDate&endDate&limit
export function getTripHistory(params) {
  return api.get("/food/delivery/trip-history", { params: params ?? {} });
}

// GET /food/delivery/pocket-details (#33) ?startDate&endDate&limit -> {week, summary, trips, transactions}
export function getPocketDetails(params) {
  return api.get("/food/delivery/pocket-details", { params: params ?? {} });
}

// GET /food/delivery/cash-limit (#34) -> {deliveryCashLimit, deliveryWithdrawalLimit}
export function getCashLimit() {
  return api.get("/food/delivery/cash-limit");
}

// Web withdrawalRequestId: "<kind>-<amount>-<10 s bucket>" (idempotency key for double taps).
export function withdrawalRequestId(kind, amount) {
  return `${kind}-${Number(amount) || 0}-${Math.floor(Date.now() / 10000)}`;
}

// POST /food/delivery/wallet/withdraw (#35) {amount, paymentMethod:'bank_transfer', bankDetails?} + requestId.
// 201 {withdrawal}. Errors: "Minimum withdrawal amount is ₹N", "Insufficient balance…". 20 / 10 min.
export function createWithdrawalRequest(body) {
  return api.post("/food/delivery/wallet/withdraw", {
    ...(body ?? {}),
    requestId: withdrawalRequestId("delivery", body?.amount),
  });
}

// POST /food/delivery/wallet/deposit/order {amount} (#36) -> 201 {razorpay:{key, orderId, amount(paise),
// currency}}. Open react-native-razorpay with these, then verifyDepositPayment.
export function createDepositOrder(amount) {
  return api.post("/food/delivery/wallet/deposit/order", { amount });
}

// POST /food/delivery/wallet/deposit/verify (#37) {razorpay_order_id, razorpay_payment_id,
// razorpay_signature, amount} -> {deposit, wallet}
export function verifyDepositPayment(body) {
  return api.post("/food/delivery/wallet/deposit/verify", body ?? {});
}
