// Rider auth + registration + profile source. Web: deliveryAPI.sendOTP/verifyOTP/getMe/getProfile/
// logout/register/completeProfile (services/api/index.js:1461+) and services/api/auth.js
// (requestDeliveryOtp, verifyDeliveryOtp, logout). Prefer useAuth() in screens; these are the raw calls.
// Audit api-and-auth #1-#7.
import { UPLOAD_TIMEOUT_MS } from "../config";
import { createSingleFlight } from "./cache";
import { api } from "./client";
import { buildFormData, toUploadFile } from "./upload";

// services/api/auth.js normalizePhone: digits only, last 15. "+91 98765 43210" -> "919876543210".
export function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "").slice(-15);
}

// SignIn.jsx sends "+91 <10 digits>" (normalized to "91XXXXXXXXXX"). The OTP record is keyed by
// that exact string, so request-otp and verify-otp must send the same value (audit §0 "Phone string").
export function toDeliveryOtpPhone(tenDigits) {
  const last10 = String(tenDigits || "").replace(/\D/g, "").slice(-10);
  return last10 ? `+91 ${last10}` : "";
}

// POST /food/auth/delivery/request-otp {phone} (#1). data: {phone, otp?} (otp only outside production).
export function sendOTP(phone) {
  if (!phone) return Promise.reject(new Error("Phone is required"));
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) return Promise.reject(new Error("Phone must be at least 8 digits"));
  return api.post("/food/auth/delivery/request-otp", { phone: normalized }, { skipAuthRefresh: true });
}

/**
 * POST /food/auth/delivery/verify-otp {phone, otp, fcmToken?, platform?} (#2). data is one of:
 *  {token, accessToken, refreshToken, needsRegistration:false, user:{id,_id,name,phone,email,status,
 *    profileImage,walletAmount,refCode,createdAt}}
 *  | {needsRegistration:true, phone}
 *  | {pendingApproval:true, isRejected, rejectionReason, message}   (no tokens, no status/phone)
 * fcmToken + platform are sent only when a token exists (as on web).
 */
export function verifyOTP(phone, otp, fcmToken = null, platform = "mobile") {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp ?? "").replace(/\D/g, "").slice(0, 6);
  if (!normalized || otpStr.length < 6) {
    return Promise.reject(new Error("Phone and 6-digit OTP are required"));
  }
  return api.post(
    "/food/auth/delivery/verify-otp",
    { phone: normalized, otp: otpStr, ...(fcmToken ? { fcmToken, platform } : {}) },
    { skipAuthRefresh: true },
  );
}

// GET /food/auth/me (#3), single in-flight + 3 s cache like getDeliveryMeOnce. data.user is the whole
// rider document + deliveryId, documents, vehicle, location; status "rejected" is reported as "blocked".
export const getMe = createSingleFlight(() => api.get("/food/auth/me"), 3000);

export function invalidateMe() {
  getMe.invalidate();
}

// deliveryAPI.getProfile: same call, web shape {data:{profile}} (res.data.data.profile on web).
export function getProfile() {
  return getMe().then((res) => ({
    ...res,
    data: { ...(res?.data || {}), profile: res?.data?.user ?? res?.data ?? null },
  }));
}

// POST /food/auth/logout {refreshToken?, fcmToken?, platform?} (#5). Needs at least one token.
export function logout(refreshToken, fcmToken = null, platform = "mobile") {
  invalidateMe();
  if (!refreshToken && !fcmToken) return Promise.resolve({ success: true });
  const payload = {};
  if (refreshToken) payload.refreshToken = refreshToken;
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }
  return api.post("/food/auth/logout", payload, { skipAuthRefresh: true });
}

// Multipart file fields of POST /food/delivery/register (delivery.routes.js:34-44, audit §1.4).
// Web sends the first seven; aadharPhoto is accepted too; upiQrCode is accepted and ignored.
export const REGISTER_FILE_FIELDS = [
  "profilePhoto",
  "aadharFrontPhoto",
  "aadharBackPhoto",
  "panPhoto",
  "drivingLicenseFrontPhoto",
  "drivingLicenseBackPhoto",
  "rcPhoto",
  "aadharPhoto",
];
// Required by the web UI (SignupStep2): selfie, Aadhaar front/back, PAN, RC.
export const REGISTER_REQUIRED_FILES = ["profilePhoto", "aadharFrontPhoto", "aadharBackPhoto", "panPhoto", "rcPhoto"];

/**
 * Build the SignupStep2 FormData from step-1 details + photo assets, in the web's order:
 * name, phone (digits, ≤15; web sends the 10-digit number), email, ref, countryCode, address, city,
 * state, zoneId (required), vehicleType, vehicleName, vehicleNumber, drivingLicenseNumber (+ the ignored
 * documents[drivingLicense][number]), panNumber, aadharNumber, files, fcmToken + platform.
 * files: {profilePhoto: asset|{uri,name,type}|url string, ...}.
 */
export function buildRegisterFormData(details = {}, files = {}, { fcmToken = null, platform = "mobile" } = {}) {
  const fields = {
    name: details.name || "",
    phone: String(details.phone || "").replace(/\D/g, "").slice(0, 15),
  };
  if (details.email) fields.email = String(details.email).trim();
  if (details.ref) fields.ref = String(details.ref).trim();
  if (details.countryCode) fields.countryCode = details.countryCode;
  ["address", "city", "state", "zoneId", "vehicleType", "vehicleName", "vehicleNumber"].forEach((k) => {
    if (details[k]) fields[k] = details[k];
  });
  if (details.drivingLicenseNumber) {
    fields.drivingLicenseNumber = details.drivingLicenseNumber;
    fields["documents[drivingLicense][number]"] = details.drivingLicenseNumber;
  }
  if (details.panNumber) fields.panNumber = details.panNumber;
  if (details.aadharNumber) fields.aadharNumber = details.aadharNumber;
  REGISTER_FILE_FIELDS.forEach((key) => {
    const value = files?.[key];
    if (!value) return;
    if (typeof value === "string") fields[key] = value; // URL fallback (payload.<field>)
    else fields[key] = toUploadFile(value.name || value.fileName ? value : { ...value, name: `${key}.jpg` });
  });
  if (fcmToken) {
    fields.fcmToken = fcmToken;
    fields.platform = platform;
  }
  return buildFormData(fields);
}

/**
 * POST /food/delivery/register (#6) — multipart, NO auth. Accepts a FormData (see
 * buildRegisterFormData). 201 data: the full rider document with status "pending".
 * Errors: 400 "Delivery partner with this phone already exists", 400 zone not available, E11000 dupes.
 */
export function register(formData) {
  if (!(typeof FormData !== "undefined" && formData instanceof FormData)) {
    return Promise.reject(new Error("FormData with details and document files is required"));
  }
  return api.post("/food/delivery/register", formData, { timeout: UPLOAD_TIMEOUT_MS, skipAuthRefresh: true });
}

/**
 * PATCH /food/delivery/profile (#7) — multipart, Bearer. Only name, countryCode, address, city, state,
 * vehicleType, vehicleName, vehicleNumber, drivingLicenseNumber, fcmToken/platform and the
 * profilePhoto FILE are applied; other files are accepted and discarded (audit §2.2). data:
 * {partner, requiresReapproval:false}. Web names: completeProfile / updateProfileMultipart.
 */
export function completeProfile(formData) {
  if (!(typeof FormData !== "undefined" && formData instanceof FormData)) {
    return Promise.reject(new Error("FormData is required"));
  }
  invalidateMe();
  return api.patch("/food/delivery/profile", formData, { timeout: UPLOAD_TIMEOUT_MS });
}
export const updateProfileMultipart = completeProfile;
