// PocketV2 "Deposit Cash": createDepositOrder -> Razorpay Checkout (react-native-razorpay, the web's
// initRazorpayPayment options) -> verifyDepositPayment. Same flow as mobile-user/src/lib/razorpay.js.
import { Platform } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { createDepositOrder, getBusinessSettings, getProfile, verifyDepositPayment } from "../../api";
import { ASSET_ORIGIN } from "../../config";

// @food/utils/businessSettings getCompanyNameAsync
async function getCompanyNameAsync() {
  try {
    const res = await getBusinessSettings();
    return res?.data?.companyName || "CityFood";
  } catch {
    return "CityFood";
  }
}

function isCancel(raw) {
  let reason = "";
  if (typeof raw?.description === "string") {
    try {
      reason = String(JSON.parse(raw.description)?.error?.reason || "");
    } catch {
      reason = raw.description;
    }
  }
  // Android Checkout.PAYMENT_CANCELED = 0; iOS cancel = 2.
  return raw?.code === (Platform.OS === "android" ? 0 : 2) || /cancel/i.test(reason);
}

/**
 * Resolves:
 *  {status:"invalid"}            no razorpay.orderId -> web toast "Payment initialization failed"
 *  {status:"closed"|"failed"}    Checkout dismissed / errored (web onClose/onError: no toast)
 *  {status:"paid", verify}       verifyDepositPayment resolved (verify.success checked by the caller)
 * Throws "start" errors (createDepositOrder) as {stage:"start"} and verify errors as {stage:"verify"}.
 */
export async function payCashDeposit(amount) {
  let order;
  try {
    order = await createDepositOrder(amount);
  } catch (err) {
    err.stage = "start";
    throw err;
  }
  const rp = order?.data?.razorpay;
  if (!rp?.orderId) return { status: "invalid" };

  let profile = {};
  let companyName = "CityFood";
  try {
    const profileRes = await getProfile();
    profile = profileRes?.data?.profile || {};
    companyName = await getCompanyNameAsync();
  } catch (err) {
    err.stage = "start";
    throw err;
  }

  let res;
  try {
    res = await RazorpayCheckout.open({
      key: rp.key,
      amount: rp.amount,
      currency: rp.currency || "INR",
      order_id: rp.orderId,
      name: companyName || "CityFood",
      description: `Cash limit deposit - ₹${amount}`,
      image: `${ASSET_ORIGIN}/logo.png`,
      prefill: { name: profile.name || "", email: profile.email || "", contact: profile.phone || "" },
      notes: {},
      theme: { color: "#E23744" },
      retry: { enabled: true, max_count: 3 },
    });
  } catch (raw) {
    return { status: isCancel(raw) ? "closed" : "failed" };
  }

  try {
    const verify = await verifyDepositPayment({
      razorpay_order_id: res?.razorpay_order_id,
      razorpay_payment_id: res?.razorpay_payment_id,
      razorpay_signature: res?.razorpay_signature,
      amount,
    });
    return { status: "paid", verify };
  } catch (err) {
    err.stage = "verify";
    throw err;
  }
}
