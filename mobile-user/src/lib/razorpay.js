// Razorpay Checkout via react-native-razorpay, with the same options and flows as the web
// (utils/razorpay.js, Cart.jsx order payment, AddMoneyModal.jsx wallet top-up).
import { Platform } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { getProfile } from "../api/profile";
import { cancelOrder, verifyPayment } from "../api/orders";
import { verifyWalletTopupPayment } from "../api/wallet";
import { getCompanyNameAsync } from "../context/AppSettingsContext";
import { ASSET_ORIGIN } from "../config";

export const PAYMENT_CANCELLED = "PAYMENT_CANCELLED";
export const PAYMENT_FAILED = "PAYMENT_FAILED";

export class PaymentError extends Error {
  constructor(message, { code, cancelled = false, raw } = {}) {
    super(message);
    this.code = code;
    this.cancelled = cancelled;
    this.raw = raw;
  }
}

export const isPaymentCancelled = (err) => Boolean(err?.cancelled || err?.code === PAYMENT_CANCELLED);

// The SDK's description is sometimes a JSON string: {"error":{"description","reason",...}}.
function parseSdkError(raw) {
  let detail = null;
  if (typeof raw?.description === "string") {
    try {
      detail = JSON.parse(raw.description)?.error || null;
    } catch {
      detail = null;
    }
  }
  const description =
    detail?.description || (typeof raw?.description === "string" ? raw.description : "") || "Payment failed. Please try again.";
  const reason = String(detail?.reason || "");
  // Android Checkout.PAYMENT_CANCELED = 0; iOS cancel = 2.
  const cancelCode = Platform.OS === "android" ? 0 : 2;
  const cancelled =
    raw?.code === cancelCode || /cancel/i.test(reason) || /cancel/i.test(description);
  return new PaymentError(cancelled ? "Payment was cancelled" : description, {
    code: cancelled ? PAYMENT_CANCELLED : PAYMENT_FAILED,
    cancelled,
    raw,
  });
}

/**
 * Open Checkout for a server-created Razorpay order.
 * razorpay: the server's {key, orderId, amount (paise), currency}.
 * Resolves {razorpayOrderId, razorpayPaymentId, razorpaySignature};
 * rejects with PaymentError (err.cancelled === true when the user dismissed it).
 */
export async function openRazorpayCheckout({ razorpay, name, description, image, prefill = {}, notes = {} }) {
  if (!razorpay?.key || !razorpay?.orderId) {
    throw new PaymentError("Failed to initialize payment gateway", { code: PAYMENT_FAILED });
  }
  const options = {
    key: razorpay.key,
    amount: razorpay.amount,
    currency: razorpay.currency || "INR",
    order_id: razorpay.orderId,
    name: name || "CityFood",
    description: description || "Order Payment",
    image: image || `${ASSET_ORIGIN}/logo.png`,
    prefill: {
      name: prefill.name || "",
      email: prefill.email || "",
      contact: prefill.contact || "",
    },
    notes: notes || {},
    theme: { color: "#E23744" },
    retry: { enabled: true, max_count: 3 },
  };
  let data;
  try {
    data = await RazorpayCheckout.open(options);
  } catch (raw) {
    throw parseSdkError(raw);
  }
  return {
    razorpayOrderId: data?.razorpay_order_id,
    razorpayPaymentId: data?.razorpay_payment_id,
    razorpaySignature: data?.razorpay_signature,
  };
}

const lastTenDigits = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

/**
 * Cart.jsx online payment after POST /food/orders returned {order, razorpay}.
 * prefill: {name, email, phone} (Cart uses recipient name/phone, else profile).
 * Resolves {status: "paid", order, verify} or {status: "cancelled"|"failed", message, cancelled}
 * after auto-cancelling the unpaid order with the web's reasons. Verification errors throw.
 */
export async function payForOrder({ order, razorpay, restaurantId, userId, prefill = {} }) {
  const orderRef = order?._id || order?.id || order?.orderMongoId;
  const companyName = await getCompanyNameAsync();
  let result;
  try {
    result = await openRazorpayCheckout({
      razorpay,
      name: companyName,
      description: `Order ${order?._id || order?.orderId} - ₹${(Number(razorpay?.amount || 0) / 100).toFixed(2)}`,
      prefill: { name: prefill.name || "", email: prefill.email || "", contact: lastTenDigits(prefill.phone) },
      notes: { orderId: order?._id || order?.orderId, userId: userId || "", restaurantId: restaurantId || "unknown" },
    });
  } catch (err) {
    const cancelled = isPaymentCancelled(err);
    let cancelFailed = false;
    if (orderRef) {
      try {
        await cancelOrder(orderRef, {
          reason: cancelled ? "User closed payment gateway without paying" : "Payment failed or was not completed",
        });
      } catch {
        cancelFailed = true;
      }
    }
    return {
      status: cancelled ? "cancelled" : "failed",
      cancelled,
      cancelFailed,
      message: cancelled
        ? cancelFailed
          ? "Payment was not completed. If you see a pending order, please cancel it manually."
          : "Payment was not completed. No order has been placed."
        : err.message,
    };
  }
  if (!orderRef) throw new Error("Unable to verify payment: missing order id from create-order response");
  const verify = await verifyPayment({ orderId: orderRef, ...result });
  if (!verify?.success) throw new Error(verify?.message || "Payment verification failed");
  return { status: "paid", order, verify };
}

/**
 * AddMoneyModal.jsx: amount in rupees, razorpay from POST /food/user/wallet/topup/order.
 * Resolves {status: "paid", wallet} or {status: "cancelled"|"failed", message}. Verification errors throw.
 */
export async function payForWalletTopup({ amount, razorpay }) {
  const amountNum = Number(amount);
  let user = {};
  try {
    const res = await getProfile();
    user = res?.data?.user || {};
  } catch {
    user = {};
  }
  const companyName = await getCompanyNameAsync();
  let result;
  try {
    result = await openRazorpayCheckout({
      razorpay,
      name: companyName,
      description: `Wallet Top-up - ₹${amountNum.toFixed(2)}`,
      prefill: { name: user.name || "", email: user.email || "", contact: lastTenDigits(user.phone) },
      notes: { type: "wallet_topup", amount: amountNum.toString() },
    });
  } catch (err) {
    const cancelled = isPaymentCancelled(err);
    return { status: cancelled ? "cancelled" : "failed", cancelled, message: err.message };
  }
  const verify = await verifyWalletTopupPayment({ ...result, amount: amountNum });
  return { status: "paid", wallet: verify?.data?.wallet, verify };
}
