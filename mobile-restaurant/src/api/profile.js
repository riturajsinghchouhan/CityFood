// Profile, outlet, availability and media. Web: restaurantAPI.getCurrentRestaurant/updateProfile/
// updateAcceptingOrders/uploadProfileImage/uploadMenuImage/uploadCoverImages/uploadMenuImages/
// updateDiningSettings/requestDiningUpdate/deleteAccount.
// WARNING (audit §1.5): every non-empty PATCH /profile and every profile/cover image upload resets
// an approved restaurant to status "pending" (hidden from customers, cannot log in again until an
// admin approves). Warn the owner before calling them.
import { UPLOAD_TIMEOUT_MS } from "../config";
import { api } from "./client";
import { buildFormData, toUploadFile } from "./upload";

// GET /food/restaurant/current, deduped with a 3 s cache like getRestaurantCurrentOnce.
// Mutations below refresh the cache with their response (same {data:{restaurant}} shape).
const CURRENT_CACHE_MS = 3000;
let currentInFlight = null;
let currentCached = null;
let currentCachedAt = 0;

function cacheCurrent(res) {
  if (res?.data?.restaurant) {
    currentCached = res;
    currentCachedAt = Date.now();
  }
  return res;
}

export function invalidateCurrentRestaurant() {
  currentInFlight = null;
  currentCached = null;
  currentCachedAt = 0;
}

/**
 * data.restaurant: {id, _id, restaurantId, name, restaurantName, zoneId, cuisines[], location, owner*,
 * pan/gst/fssai/bank fields, upiId, upiQrImage, pureVegRestaurant, profileImage:{url}, coverImages[],
 * menuImages[], openingTime, closingTime, openDays[], estimatedDeliveryTime(Minutes), diningSettings,
 * isAcceptingOrders, status, approvedAt, pendingUpdateReason, createdAt, updatedAt, rating, totalRatings}.
 * rejectionReason and isBanned are NOT returned. options.noCache forces a network read.
 */
export function getCurrentRestaurant(options = {}) {
  if (options?.noCache) {
    return api.get("/food/restaurant/current").then(cacheCurrent);
  }
  if (currentCached && Date.now() - currentCachedAt < CURRENT_CACHE_MS) {
    return Promise.resolve(currentCached);
  }
  if (!currentInFlight) {
    currentInFlight = api
      .get("/food/restaurant/current")
      .then(cacheCurrent)
      .finally(() => {
        currentInFlight = null;
      });
  }
  return currentInFlight;
}

/**
 * PATCH /food/restaurant/profile (partial JSON) -> data.restaurant. Status becomes "pending".
 * Keys: restaurantName|name, cuisines[], zoneId, location{formattedAddress, addressLine1..landmark,
 * latitude, longitude, coordinates}, ownerName, ownerEmail, ownerPhone, primaryContactNumber,
 * pureVegRestaurant, profileImage, coverImages, menuImages, menuPdf (URLs or {url}), openingTime,
 * closingTime, openDays, estimatedDeliveryTime, panNumber, nameOnPan, panImage, gstRegistered,
 * gstNumber, gstLegalName, gstAddress, gstImage, fssaiNumber, fssaiExpiry, fssaiImage,
 * accountNumber, ifscCode, accountHolderName, accountType, upiId, upiQrImage|upiQrCode.
 */
export function updateProfile(body) {
  return api.patch("/food/restaurant/profile", body ?? {}, { timeout: UPLOAD_TIMEOUT_MS }).then(cacheCurrent);
}

// UpdateBankDetails.jsx: bank fields go through PATCH /profile (re-approval applies).
// Body: {accountHolderName, accountNumber, ifscCode, accountType?, upiId?, upiQrImage?}
export function updateBankDetails(body) {
  return updateProfile(body);
}

// PATCH /food/restaurant/availability {isAcceptingOrders} -> data.restaurant (online/offline toggle).
export function updateAcceptingOrders(isAcceptingOrders) {
  return api
    .patch("/food/restaurant/availability", { isAcceptingOrders: Boolean(isAcceptingOrders) })
    .then(cacheCurrent);
}

// POST /food/restaurant/profile/profile-image, multipart "file" -> data.profileImage.url. Status becomes "pending".
export function uploadProfileImage(file) {
  if (!file) return Promise.reject(new Error("File is required"));
  return api.post("/food/restaurant/profile/profile-image", buildFormData({ file: toUploadFile(file) }), {
    timeout: UPLOAD_TIMEOUT_MS,
  });
}

// POST /food/restaurant/profile/menu-image, multipart "file" -> data.menuImage.url (not attached). Unused by web.
export function uploadMenuImage(file) {
  if (!file) return Promise.reject(new Error("File is required"));
  return api.post("/food/restaurant/profile/menu-image", buildFormData({ file: toUploadFile(file) }), {
    timeout: UPLOAD_TIMEOUT_MS,
  });
}

function multiUpload(url, files) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return Promise.reject(new Error("At least one file is required"));
  return api.post(url, buildFormData({ files: list.map(toUploadFile) }), { timeout: UPLOAD_TIMEOUT_MS });
}

// POST /food/restaurant/profile/cover-images, multipart "files" (<=20) -> data.coverImages[]. Status becomes "pending". Unused by web.
export function uploadCoverImages(files = []) {
  return multiUpload("/food/restaurant/profile/cover-images", files);
}

// POST /food/restaurant/profile/menu-images, multipart "files" (<=20) -> data.menuImages[]. Unused by web.
export function uploadMenuImages(files = []) {
  return multiUpload("/food/restaurant/profile/menu-images", files);
}

// PATCH /food/restaurant/dining-settings. Unused by web screens.
export function updateDiningSettings(body) {
  return api.patch("/food/restaurant/dining-settings", body ?? {}).then(cacheCurrent);
}

// POST /food/restaurant/dining-settings/request. Unused by web screens.
export function requestDiningUpdate(body) {
  return api.post("/food/restaurant/dining-settings/request", body ?? {});
}

// GET /food/restaurant/dining-settings/pending -> the pending dining request (OrdersMain).
export function getPendingDiningRequest() {
  return api.get("/food/restaurant/dining-settings/pending");
}

// DELETE /food/restaurant/account -> data null. Follow with useAuth().logout().
export function deleteAccount() {
  return api.delete("/food/restaurant/account").then((res) => {
    invalidateCurrentRestaurant();
    return res;
  });
}
