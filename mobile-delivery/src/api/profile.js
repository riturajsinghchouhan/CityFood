// Profile, bank, referral, account, emergency numbers. Web: deliveryAPI.updateProfileDetails/
// updateProfile/updateBankDetailsMultipart/updateProfilePhotoBase64/getReferralStats/deleteAccount/
// getEmergencyHelp. Audit #9-#13 (+ photo-base64 from §2.11, unused by the web but working).
import { UPLOAD_TIMEOUT_MS } from "../config";
import { invalidateMe } from "./auth";
import { api } from "./client";
import { buildFormData, toUploadFile } from "./upload";

/**
 * PATCH /food/delivery/profile/details (JSON) (#9). ONLY these keys are read:
 * {vehicle:{number, type, brand, model}} and/or {profilePhoto:"<url>"|""} (""=remove). data: {partner}.
 * (Web ProfileBankV2 sends bank details here and they are silently ignored — use updateBankDetails.)
 */
export function updateProfileDetails(payload) {
  invalidateMe();
  return api.patch("/food/delivery/profile/details", payload ?? {});
}

/**
 * PATCH /food/delivery/profile/bank-details (#10). JSON {documents:{bankDetails:{accountHolderName,
 * accountNumber, ifscCode, bankName, upiId}, pan:{number}}} (web: updateProfile), or multipart when a
 * `upiQrCode` file is given (web: updateBankDetailsMultipart). data: {bankDetails, panNumber}.
 */
export function updateBankDetails({ bankDetails = {}, panNumber, upiQrCode } = {}) {
  invalidateMe();
  if (upiQrCode && typeof upiQrCode !== "string") {
    const fields = {};
    Object.entries(bankDetails || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fields[`documents[bankDetails][${k}]`] = String(v);
    });
    if (panNumber) fields["documents[pan][number]"] = String(panNumber);
    fields.upiQrCode = toUploadFile(upiQrCode.name || upiQrCode.fileName ? upiQrCode : { ...upiQrCode, name: "upiQrCode.jpg" });
    return api.patch("/food/delivery/profile/bank-details", buildFormData(fields), { timeout: UPLOAD_TIMEOUT_MS });
  }
  const documents = { bankDetails: { ...(bankDetails || {}) } };
  if (typeof upiQrCode === "string") documents.bankDetails.upiQrCode = upiQrCode;
  if (panNumber) documents.pan = { number: panNumber };
  return api.patch("/food/delivery/profile/bank-details", { documents });
}
// Web name (deliveryAPI.updateProfile posts raw JSON to bank-details).
export function updateProfile(payload) {
  invalidateMe();
  return api.patch("/food/delivery/profile/bank-details", payload ?? {});
}

// POST /food/delivery/profile/photo-base64 {base64, mimeType} (≤8 MB) -> {partner}. Unused by web.
export function updateProfilePhotoBase64(payload) {
  invalidateMe();
  return api.post("/food/delivery/profile/photo-base64", payload ?? {}, { timeout: UPLOAD_TIMEOUT_MS });
}

// GET /food/delivery/referrals/stats (#11) -> {stats:{referralCount, totalReferralEarnings, rewardAmount}}
export function getReferralStats() {
  return api.get("/food/delivery/referrals/stats");
}

// DELETE /food/delivery/account (#12) -> null. No backend guard for an active trip or cash in hand.
export function deleteAccount() {
  return api.delete("/food/delivery/account");
}

// GET /food/delivery/emergency-help (#13) -> {medicalEmergency, accidentHelpline, contactPolice,
// insurance, teamLeader} (phone strings, used as tel: links).
export function getEmergencyHelp() {
  return api.get("/food/delivery/emergency-help");
}
