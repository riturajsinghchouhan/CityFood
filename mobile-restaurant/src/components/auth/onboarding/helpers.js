// Pure helpers from Onboarding.jsx: input normalizers, time/date conversions, the zone polygon
// check and the three step validators (same messages, same order; the first one is toasted).
// A "local file" is an expo-image-picker asset ({uri, ...}); a persisted image is a URL string or {url}.

export const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const FSSAI_NUMBER_REGEX = /^\d{14}$/;
const BANK_ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
const IFSC_CODE_REGEX = /^[A-Z0-9]{11}$/;
const OWNER_NAME_REGEX = /^[A-Za-z ]+$/;
const ACCOUNT_HOLDER_NAME_REGEX = /^[A-Za-z ]+$/;
const GST_LEGAL_NAME_REGEX = /^[A-Za-z ]+$/;
// shared/utils/emailValidation.js EMAIL_REGEX
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|mil|biz|info|name|museum|co\.in|in|co|us|me|io|uk)$/i;

export const isLocalFile = (value) =>
  Boolean(value && typeof value === "object" && typeof value.uri === "string" && value.uri);

const isPersistedImage = (value) =>
  !isLocalFile(value) &&
  Boolean((typeof value === "string" && value.trim()) || (value?.url && typeof value.url === "string"));

export const isValidImageValue = (value) => isLocalFile(value) || isPersistedImage(value);

export function previewUri(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (isLocalFile(value)) return value.uri;
  if (value?.url && typeof value.url === "string") return value.url;
  return null;
}

// Picker asset -> the slim serializable shape kept in the draft.
export function toLocalFile(asset) {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || asset.name || asset.uri.split("/").pop() || "image.jpg",
    mimeType: asset.mimeType || "image/jpeg",
    fileSize: asset.fileSize ?? asset.size ?? null,
  };
}

export const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(-10);
export const normalizePincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

export const normalizeEmail = (val) => {
  let email = String(val || "").toLowerCase().trim();
  // Auto-correct common Gmail typos
  email = email.replace(/@(gnail|gamil|gimail|gnil)\.com$/i, "@gmail.com");
  return email;
};

export const formatNameToCapital = (str) => {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const normalizeIFSC = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
export const normalizePAN = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
export const normalizeGST = (val) => String(val || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
export const normalizeBankAcc = (val) => String(val || "").replace(/\D/g, "").slice(0, 18);
export const lettersOnly = (val) => String(val || "").replace(/[^A-Za-z ]/g, "");

export const timeToString = (date) => {
  if (!date) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export function normalizeTimeValue(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const to24Hour = (h, m, period) => {
    let hours = Number(h);
    const minutes = Number(m);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
    if (minutes < 0 || minutes > 59) return "";
    const p = String(period || "").toUpperCase();
    if (p === "AM") {
      if (hours === 12) hours = 0;
    } else if (p === "PM") {
      if (hours !== 12) hours += 12;
    }
    if (hours < 0 || hours > 23) return "";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  if (/^\d{2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (/^\d{1}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return to24Hour(h, m, "");
  }
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampm) return to24Hour(ampm[1], ampm[2], ampm[3]);

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return timeToString(parsed);
  return "";
}

export function timeStringToMinutes(value) {
  const normalized = normalizeTimeValue(value);
  if (!normalized || !/^\d{2}:\d{2}$/.test(normalized)) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatDateToLocalYMD(date) {
  if (!date || Number.isNaN(date.getTime?.())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalYMDDate(value) {
  if (!value || typeof value !== "string") return undefined;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

export const getTodayLocalYMD = () => formatDateToLocalYMD(new Date());

// Point-in-polygon over zone.coordinates [{latitude, longitude}] (zones with >= 3 points).
export function findZoneForLocation(lat, lng, zonesList) {
  if (!lat || !lng || !zonesList || !zonesList.length) return null;
  const isPointInPolygon = (latitude, longitude, polygon) => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;
      const intersect = yi > longitude !== yj > longitude && latitude < ((xj - xi) * (longitude - yi)) / (yj - yi) + xi;
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };
  for (const zone of zonesList) {
    if (zone.coordinates && zone.coordinates.length >= 3) {
      if (isPointInPolygon(lat, lng, zone.coordinates)) return String(zone._id || zone.id);
    }
  }
  return null;
}

export function validateStep1(step1) {
  const errors = [];
  if (!step1.restaurantName?.trim()) errors.push("Restaurant name is required");
  if (typeof step1.pureVegRestaurant !== "boolean") errors.push("Please select whether your restaurant is pure veg");
  if (!step1.ownerName?.trim()) {
    errors.push("Owner name is required");
  } else if (!OWNER_NAME_REGEX.test(step1.ownerName.trim())) {
    errors.push("Owner name must contain only letters");
  }
  if (!step1.ownerEmail?.trim()) {
    errors.push("Owner email is required");
  } else if (!EMAIL_REGEX.test(step1.ownerEmail.trim())) {
    errors.push("Please enter a valid email address");
  } else if (step1.ownerEmail.toLowerCase().includes("@gnail.com") || step1.ownerEmail.toLowerCase().includes("@gnil.com")) {
    errors.push("Invalid email domain. Did you mean '@gmail.com'?");
  }
  if (!step1.ownerPhone?.trim()) {
    errors.push("Owner phone number is required");
  } else if (!/^\d{10}$/.test(normalizePhoneDigits(step1.ownerPhone))) {
    errors.push("Owner phone number must be exactly 10 digits");
  }
  if (!step1.primaryContactNumber?.trim()) {
    errors.push("Primary contact number is required");
  } else if (!/^\d{10}$/.test(normalizePhoneDigits(step1.primaryContactNumber))) {
    errors.push("Primary contact number must be exactly 10 digits");
  }
  if (!step1.zoneId?.trim()) errors.push("Service zone is required");
  if (!step1.location?.area?.trim()) errors.push("Area/Sector/Locality is required");
  if (!step1.location?.city?.trim()) errors.push("City is required");
  if (!step1.location?.pincode?.trim()) {
    errors.push("Pincode is required");
  } else if (!/^\d{6}$/.test(normalizePincode(step1.location.pincode))) {
    errors.push("Pincode must be exactly 6 digits");
  }
  return errors;
}

export function validateStep2(step2) {
  const errors = [];
  if (!step2.profileImage) {
    errors.push("Restaurant profile image is required");
  } else if (!isValidImageValue(step2.profileImage)) {
    errors.push("Please upload a valid restaurant profile image");
  }
  if (!step2.openingTime?.trim()) errors.push("Opening time is required");
  if (!step2.closingTime?.trim()) errors.push("Closing time is required");
  const openingMinutes = timeStringToMinutes(step2.openingTime);
  const closingMinutes = timeStringToMinutes(step2.closingTime);
  if (openingMinutes !== null && closingMinutes !== null) {
    if (openingMinutes === closingMinutes) {
      errors.push("Opening time and closing time cannot be same");
    } else if (closingMinutes < openingMinutes) {
      errors.push("Closing time cannot be less than opening time");
    }
  }
  if (!step2.openDays || step2.openDays.length === 0) errors.push("Please select at least one open day");
  if (!step2.estimatedDeliveryTime?.trim()) errors.push("Estimated delivery time is required");
  return errors;
}

export function validateStep3(step3) {
  const errors = [];
  if (!step3.panNumber?.trim()) {
    errors.push("PAN number is required");
  } else if (!PAN_NUMBER_REGEX.test(step3.panNumber.trim().toUpperCase())) {
    errors.push("PAN number must be valid (e.g., ABCDE1234F)");
  }
  if (!step3.nameOnPan?.trim()) errors.push("Name on PAN is required");
  if (!step3.panImage) {
    errors.push("PAN image is required");
  } else if (!isValidImageValue(step3.panImage)) {
    errors.push("Please upload a valid PAN image");
  }

  if (!step3.fssaiNumber?.trim()) {
    errors.push("FSSAI number is required");
  } else if (!FSSAI_NUMBER_REGEX.test(step3.fssaiNumber.trim())) {
    errors.push("FSSAI number must contain exactly 14 digits");
  }
  if (!step3.fssaiExpiry?.trim()) {
    errors.push("FSSAI expiry date is required");
  } else if (step3.fssaiExpiry < getTodayLocalYMD()) {
    errors.push("FSSAI expiry date cannot be in the past");
  }
  if (!step3.fssaiImage) {
    errors.push("FSSAI image is required");
  } else if (!isValidImageValue(step3.fssaiImage)) {
    errors.push("Please upload a valid FSSAI image");
  }

  if (step3.gstRegistered) {
    if (!step3.gstNumber?.trim()) {
      errors.push("GST number is required when GST registered");
    } else if (!GST_NUMBER_REGEX.test(step3.gstNumber.trim().toUpperCase())) {
      errors.push("GST number must be a valid 15-character GSTIN");
    }
    if (!step3.gstLegalName?.trim()) {
      errors.push("GST legal name is required when GST registered");
    } else if (!GST_LEGAL_NAME_REGEX.test(step3.gstLegalName.trim())) {
      errors.push("GST legal name must contain only letters");
    }
    if (!step3.gstAddress?.trim()) errors.push("GST registered address is required when GST registered");
    if (!step3.gstImage) {
      errors.push("GST image is required when GST registered");
    } else if (!isValidImageValue(step3.gstImage)) {
      errors.push("Please upload a valid GST image");
    }
  }

  if (!step3.accountNumber?.trim()) {
    errors.push("Account number is required");
  } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
    errors.push("Account number must contain 9 to 18 digits only");
  }
  if (!step3.confirmAccountNumber?.trim()) {
    errors.push("Please confirm your account number");
  } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.confirmAccountNumber.trim())) {
    errors.push("Confirm account number must contain 9 to 18 digits only");
  }
  if (step3.accountNumber && step3.confirmAccountNumber && step3.accountNumber !== step3.confirmAccountNumber) {
    errors.push("Account number and confirmation do not match");
  }
  if (!step3.ifscCode?.trim()) {
    errors.push("IFSC code is required");
  } else if (!IFSC_CODE_REGEX.test(step3.ifscCode.trim().toUpperCase())) {
    errors.push("IFSC code must contain exactly 11 alphanumeric characters");
  }
  if (!step3.accountHolderName?.trim()) {
    errors.push("Account holder name is required");
  } else if (!ACCOUNT_HOLDER_NAME_REGEX.test(step3.accountHolderName.trim())) {
    errors.push("Account holder name must contain only letters");
  }
  if (!step3.accountType?.trim()) {
    errors.push("Account type is required");
  } else if (!["Saving", "Current"].includes(step3.accountType.trim())) {
    errors.push("Account type must be either Saving or Current");
  }
  return errors;
}
