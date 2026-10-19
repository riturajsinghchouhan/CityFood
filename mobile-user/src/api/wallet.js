// Wallet and referrals. Web: userAPI.getWallet/createWalletTopupOrder/verifyWalletTopupPayment/
// getReferralStats/getReferralDetails.
import { api } from "./client";
import { createSingleFlight } from "./cache";

// data.wallet: {balance, referralEarnings, transactions}. 3 s single-flight cache like web.
export const getWallet = createSingleFlight(() => api.get("/food/user/wallet"), 3000);

// amount in rupees (> 0, <= 50000). data.razorpay: {key, orderId, amount (paise), currency}
export function createWalletTopupOrder(amount) {
  return api.post("/food/user/wallet/topup/order", { amount: Number(amount) });
}

// Body: {razorpayOrderId, razorpayPaymentId, razorpaySignature, amount (rupees, required)} -> data.wallet
export async function verifyWalletTopupPayment(body) {
  const res = await api.post("/food/user/wallet/topup/verify", body ?? {});
  getWallet.invalidate();
  return res;
}

// data.stats: {referralCount, totalReferralEarnings, rewardAmount}
export function getReferralStats() {
  return api.get("/food/user/referrals/stats");
}

// data: {stats, invitedFriends}
export function getReferralDetails() {
  return api.get("/food/user/referrals/details");
}
