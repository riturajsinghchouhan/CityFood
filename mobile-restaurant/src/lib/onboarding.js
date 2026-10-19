// Port of Frontend/src/modules/Food/utils/onboardingUtils.js (isRestaurantOnboardingComplete,
// determineStepToShow, checkOnboardingStatus). The web's GET /restaurant/onboarding is a 404
// (audit §6 #3), so checkOnboardingStatus falls back to the local draft step, as the web's catch does.
import { getMe } from "../api/auth";
import { KEYS, store } from "../storage";

const LEGACY_CUTOFF = new Date("2026-05-26T00:00:00Z").getTime();
const hasImage = (img) => Boolean(img && (img.url || typeof img === "string"));

function isStepComplete(step, n) {
  if (!step) return false;
  if (n === 1) {
    return Boolean(
      step.restaurantName &&
        typeof step.pureVegRestaurant === "boolean" &&
        step.ownerName &&
        step.ownerEmail &&
        step.ownerPhone &&
        step.primaryContactNumber &&
        step.location?.area &&
        step.location?.city,
    );
  }
  if (n === 2) {
    return Boolean(
      Array.isArray(step.cuisines) &&
        step.cuisines.length > 0 &&
        step.deliveryTimings?.openingTime &&
        step.deliveryTimings?.closingTime &&
        Array.isArray(step.openDays) &&
        step.openDays.length > 0 &&
        Array.isArray(step.menuImageUrls) &&
        step.menuImageUrls.length > 0 &&
        hasImage(step.profileImageUrl),
    );
  }
  if (n === 3) {
    const hasGstImage = !step.gst?.isRegistered || hasImage(step.gst?.image);
    return Boolean(
      step.pan?.panNumber &&
        step.pan?.nameOnPan &&
        hasImage(step.pan?.image) &&
        step.fssai?.registrationNumber &&
        hasImage(step.fssai?.image) &&
        hasGstImage &&
        step.bank?.accountNumber &&
        step.bank?.ifscCode &&
        step.bank?.accountHolderName &&
        step.bank?.accountType,
    );
  }
  return false;
}

function onboardingLikeData(r) {
  const ob = r?.onboarding || {};
  const openingTime = r?.openingTime || r?.deliveryTimings?.openingTime || ob?.step2?.deliveryTimings?.openingTime;
  const closingTime = r?.closingTime || r?.deliveryTimings?.closingTime || ob?.step2?.deliveryTimings?.closingTime;
  return {
    completedSteps: ob.completedSteps,
    step1: ob.step1 || {
      restaurantName: r?.restaurantName || r?.name,
      pureVegRestaurant: typeof r?.pureVegRestaurant === "boolean" ? r.pureVegRestaurant : null,
      ownerName: r?.ownerName,
      ownerEmail: r?.ownerEmail || r?.email,
      ownerPhone: r?.ownerPhone || r?.phone,
      primaryContactNumber: r?.primaryContactNumber,
      location:
        r?.location ||
        (r?.area || r?.city || r?.addressLine1
          ? { addressLine1: r?.addressLine1, addressLine2: r?.addressLine2, area: r?.area, city: r?.city, landmark: r?.landmark }
          : null),
    },
    step2: ob.step2 || {
      cuisines: r?.cuisines,
      deliveryTimings: r?.deliveryTimings || (openingTime || closingTime ? { openingTime, closingTime } : null),
      openDays: r?.openDays,
      menuImageUrls: r?.menuImages,
      profileImageUrl: r?.profileImage,
    },
    step3:
      ob.step3 ||
      (r?.panNumber || r?.fssaiNumber || r?.accountNumber || r?.ifscCode
        ? {
            pan: { panNumber: r?.panNumber, nameOnPan: r?.nameOnPan, image: r?.panImage },
            gst: { isRegistered: Boolean(r?.gstRegistered), gstNumber: r?.gstNumber, legalName: r?.gstLegalName, address: r?.gstAddress, image: r?.gstImage },
            fssai: { registrationNumber: r?.fssaiNumber, expiryDate: r?.fssaiExpiry, image: r?.fssaiImage },
            bank: { accountNumber: r?.accountNumber, ifscCode: r?.ifscCode, accountHolderName: r?.accountHolderName, accountType: r?.accountType },
          }
        : null),
  };
}

export function isRestaurantOnboardingComplete(r) {
  if (!r) return false;
  if (r.createdAt && new Date(r.createdAt).getTime() < LEGACY_CUTOFF) return true;
  if (r.status === "approved") return true;
  if (r.status === "pending" && (r.approvedAt || (r.pendingUpdateReason && r.pendingUpdateReason !== "New Registration"))) {
    return true;
  }
  if (r.isActive === true) return true;
  const d = onboardingLikeData(r);
  if (d.completedSteps === 4) return true;
  const s1 = isStepComplete(d.step1, 1);
  const s2 = isStepComplete(d.step2, 2);
  const s3 = isStepComplete(d.step3, 3);
  if (s1 && s2 && s3) return true;
  const hasOperationalProfile =
    Boolean(String(r.name || "").trim()) &&
    Boolean(String(r.restaurantId || "").trim()) &&
    Boolean(String(r.slug || "").trim()) &&
    s1 &&
    s2 &&
    Boolean(r.approvedAt || r.rejectedAt || r.rejectionReason || r.isActive === false);
  return hasOperationalProfile;
}

// 1..3, or null when complete.
export function determineStepToShow(data) {
  if (!data) return 1;
  if (data.completedSteps === 4) return null;
  if (!isStepComplete(data.step1, 1)) return 1;
  if (!isStepComplete(data.step2, 2)) return 2;
  if (!isStepComplete(data.step3, 3)) return 3;
  return null;
}

// Step to resume onboarding at, or null when complete. GET /food/auth/me, then the local draft.
export async function checkOnboardingStatus() {
  try {
    const res = await getMe();
    const r = res?.data?.user || res?.data?.restaurant || null;
    if (r && isRestaurantOnboardingComplete(r)) return null;
  } catch {
    // fall through to the local draft, like the web's catch
  }
  const draft = await store.get(KEYS.onboardingData);
  return Number(draft?.currentStep) || 1;
}
