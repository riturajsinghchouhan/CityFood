// Port of utils/restaurantAvailability.js: open/closed state and the "Closes in ..." label
// from a restaurant's outlet timings (any of the three backend shapes).
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const normalizeDay = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  const match = DAY_NAMES.find((day) => day.toLowerCase() === trimmed);
  if (match) return match;
  return DAY_NAMES.find((day) => day.toLowerCase().startsWith(trimmed.slice(0, 3))) || null;
};

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== "string") return null;
  const raw = timeValue.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const meridiemMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)$/);
  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2]);
    const period = meridiemMatch[3];
    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null;
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    if (hour < 0 || hour > 23) return null;
    return hour * 60 + minute;
  }
  const m = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const getTodayTiming = (restaurant, dayName) => {
  // { outletTimings: { timings: [...] } } from the outlet-timings endpoint
  const nested = restaurant?.outletTimings?.timings;
  if (Array.isArray(nested)) {
    const exact = nested.find((entry) => normalizeDay(entry?.day) === dayName);
    if (exact) return exact;
  }
  // flat array from the restaurants list
  if (Array.isArray(restaurant?.outletTimings)) {
    const exact = restaurant.outletTimings.find((entry) => normalizeDay(entry?.day) === dayName);
    if (exact) return exact;
  }
  // object keyed by day name
  const obj = restaurant?.outletTimings;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const direct = obj[dayName];
    if (direct && typeof direct === "object") return direct;
  }
  return null;
};

const isWithinTimeWindow = (now, open, close) => {
  if (open === null || close === null) return true;
  if (open === close) return true;
  if (close > open) return now >= open && now <= close;
  return now >= open || now <= close;
};

const getMinutesUntilClosing = (now, open, close) => {
  if (open === null || close === null) return null;
  if (!isWithinTimeWindow(now, open, close)) return null;
  if (close > open) return close - now;
  if (now <= close) return close - now;
  return 24 * 60 - now + close;
};

const formatTimeLabel = (timeValue) => {
  const total = parseTimeToMinutes(timeValue);
  if (total === null) return timeValue || null;
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatClosingCountdown = (minutesUntilClose, closingTime) => {
  if (minutesUntilClose === null || minutesUntilClose === undefined) return null;
  if (minutesUntilClose > 120) return null;
  if (minutesUntilClose <= 0) {
    const label = formatTimeLabel(closingTime);
    return label ? `Closes at ${label}` : null;
  }
  if (minutesUntilClose < 60) return `Closes in ${minutesUntilClose} min`;
  const hours = Math.floor(minutesUntilClose / 60);
  const minutes = minutesUntilClose % 60;
  if (minutes === 0) return `Closes in ${hours}h`;
  return `Closes in ${hours}h ${minutes}m`;
};

/**
 * When a closed restaurant opens next, from its weekly outlet timings.
 * Returns { at: Date, label: "Opens today at 10:00 AM" } or null when it can't be known
 * (switched off by the restaurant/admin, or no timings set).
 */
export const getNextOpeningInfo = (restaurant, now = new Date()) => {
  if (!restaurant || restaurant.isActive === false || restaurant.isAcceptingOrders === false) return null;

  const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : [];
  const normalizedOpenDays = new Set(openDays.map((day) => normalizeDay(day)).filter(Boolean));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayName = DAY_NAMES[date.getDay()];
    const timing = getTodayTiming(restaurant, dayName);
    if (timing?.isOpen === false) continue;
    if (!timing && normalizedOpenDays.size > 0 && !normalizedOpenDays.has(dayName)) continue;

    const openingTime = timing?.openingTime || restaurant?.deliveryTimings?.openingTime || restaurant?.openingTime || null;
    const openingMinutes = parseTimeToMinutes(openingTime);
    if (openingMinutes === null) continue;
    // Today only counts if the opening time is still ahead.
    if (offset === 0 && openingMinutes <= nowMinutes) continue;

    const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(openingMinutes / 60), openingMinutes % 60);
    const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : dayName;
    return { at, label: `Opens ${when} at ${formatTimeLabel(openingTime)}` };
  }
  return null;
};

export const getRestaurantAvailabilityStatus = (restaurant, now = new Date(), options = {}) => {
  if (!restaurant) {
    return { isOpen: false, isActive: false, isAcceptingOrders: false, isWithinTimings: false, reason: "missing-restaurant" };
  }
  const ignoreOperationalStatus = options?.ignoreOperationalStatus === true;
  const isActive = restaurant.isActive !== false;
  const isAcceptingOrders = restaurant.isAcceptingOrders !== false;
  if (!ignoreOperationalStatus && !isActive) {
    return { isOpen: false, isActive, isAcceptingOrders, isWithinTimings: false, reason: "inactive" };
  }
  if (!ignoreOperationalStatus && !isAcceptingOrders) {
    return { isOpen: false, isActive, isAcceptingOrders, isWithinTimings: false, reason: "not-accepting-orders" };
  }

  const dayName = DAY_NAMES[now.getDay()];
  const todayTiming = getTodayTiming(restaurant, dayName);

  // Legacy openDays can be stale; enforce only when no explicit timing exists for today.
  const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : [];
  if (!todayTiming && openDays.length > 0) {
    const normalized = new Set(openDays.map((day) => normalizeDay(day)).filter(Boolean));
    if (normalized.size > 0 && !normalized.has(dayName)) {
      return { isOpen: false, isActive, isAcceptingOrders, isWithinTimings: false, reason: "closed-day" };
    }
  }
  if (todayTiming?.isOpen === false) {
    return { isOpen: false, isActive, isAcceptingOrders, isWithinTimings: false, reason: "day-closed" };
  }

  const openingTime =
    todayTiming?.openingTime || restaurant?.deliveryTimings?.openingTime || restaurant?.openingTime || null;
  const closingTime =
    todayTiming?.closingTime || restaurant?.deliveryTimings?.closingTime || restaurant?.closingTime || null;
  const openingMinutes = parseTimeToMinutes(openingTime);
  const closingMinutes = parseTimeToMinutes(closingTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const hasExplicitWindow = Boolean(openingTime || closingTime);
  // Only one side of the window given: timings are not enforced.
  const isWithinTimings = hasExplicitWindow
    ? openingMinutes !== null && closingMinutes !== null
      ? isWithinTimeWindow(nowMinutes, openingMinutes, closingMinutes)
      : true
    : true;
  const minutesUntilClose = isWithinTimings ? getMinutesUntilClosing(nowMinutes, openingMinutes, closingMinutes) : null;

  return {
    isOpen: isWithinTimings,
    isActive,
    isAcceptingOrders,
    isWithinTimings,
    openingTime,
    closingTime,
    minutesUntilClose,
    closingCountdownLabel: isWithinTimings ? formatClosingCountdown(minutesUntilClose, closingTime) : null,
    reason: isWithinTimings
      ? isAcceptingOrders
        ? "open"
        : "open-by-timings"
      : hasExplicitWindow
        ? "outside-hours"
        : "no-timings",
  };
};
