// Restaurant auth + registration. Web: restaurantAPI.sendOTP/verifyOTP/getMe/logout/register
// (services/api/index.js) and services/api/auth.js (requestRestaurantOtp, verifyRestaurantOtp, logout).
// Prefer useAuth() in screens; these are the raw calls it uses.
import { UPLOAD_TIMEOUT_MS } from "../config";
import { api } from "./client";
import { buildFormData, toUploadFile } from "./upload";

// services/api/auth.js normalizePhone: digits only, last 15.
export function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "").slice(-15);
}

// POST /food/auth/restaurant/request-otp {phone}. data: {phone, otp?} (otp only outside production).
export function sendOTP(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) return Promise.reject(new Error("Phone must be at least 8 digits"));
  return api.post("/food/auth/restaurant/request-otp", { phone: normalized }, { skipAuthRefresh: true });
}

/**
 * POST /food/auth/restaurant/verify-otp {phone, otp, fcmToken?, platform?}.
 * data is one of: {accessToken, token, refreshToken, user, needsRegistration:false}
 * | {needsRegistration:true, phone} | {pendingApproval:true, status, isRejected, rejectionReason, phone}.
 * fcmToken + platform are sent only when a token exists (as on web).
 */
export function verifyOTP(phone, otp, fcmToken = null, platform = "mobile") {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp ?? "").replace(/\D/g, "").slice(0, 6);
  if (!normalized || otpStr.length < 6) {
    return Promise.reject(new Error("Phone and 6-digit OTP are required"));
  }
  return api.post(
    "/food/auth/restaurant/verify-otp",
    { phone: normalized, otp: otpStr, ...(fcmToken ? { fcmToken, platform } : {}) },
    { skipAuthRefresh: true },
  );
}

// POST /food/auth/logout {refreshToken?, fcmToken?, platform?}. Needs at least one of the two tokens.
export function logout(refreshToken, fcmToken = null, platform = "mobile") {
  if (!refreshToken && !fcmToken) return Promise.resolve({ success: true });
  const payload = {};
  if (refreshToken) payload.refreshToken = refreshToken;
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }
  return api.post("/food/auth/logout", payload, { skipAuthRefresh: true });
}

// GET /food/auth/me -> data.user (slim; prefer getCurrentRestaurant). Used by checkOnboardingStatus.
export function getMe() {
  return api.get("/food/auth/me");
}

// Multipart file fields accepted by POST /food/restaurant/register (restaurant.routes.js:75-82).
export const REGISTER_FILE_FIELDS = ["profileImage", "panImage", "gstImage", "fssaiImage", "menuImages", "menuPdf"];

/**
 * POST /food/restaurant/register (multipart, NO auth). 201 data: the full restaurant document
 * (status "pending"). `fields` is a plain object: text fields as strings/booleans/numbers
 * (cuisines/openDays may be arrays; they are joined with ","), file fields as picker assets
 * or {uri,name,type} (menuImages: array, max 10). A ready FormData is also accepted.
 * The web never sends menuImages/menuPdf (audit §6 #4); RN may.
 */
export function register(fields) {
  if (!fields) return Promise.reject(new Error("Registration data is required"));
  let body = fields;
  if (!(typeof FormData !== "undefined" && fields instanceof FormData)) {
    const prepared = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (REGISTER_FILE_FIELDS.includes(key)) {
        if (typeof value === "string") prepared[key] = value; // URL fallback (payload.<field>)
        else if (Array.isArray(value)) prepared[key] = value.filter(Boolean).map((v) => (typeof v === "string" ? v : toUploadFile(v)));
        else prepared[key] = toUploadFile(value);
        return;
      }
      prepared[key] = Array.isArray(value) ? value.join(",") : value;
    });
    body = buildFormData(prepared);
  }
  return api.post("/food/restaurant/register", body, { timeout: UPLOAD_TIMEOUT_MS, skipAuthRefresh: true });
}
