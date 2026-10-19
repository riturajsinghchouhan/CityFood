// Out-of-stock timers from Inventory.jsx. A rule is stored per item id (AsyncStorage, the web's
// localStorage "restaurant_inventory_stock_rules_v1"); while it is active the item shows as out of
// stock, and once resumeAt passes the Inventory screen puts it back in stock (15 s check).

const normalizeDayName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");

const parseRestaurantTimeToParts = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { hours: 9, minutes: 0 };

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    return {
      hours: Math.max(0, Math.min(23, Number(hhmmMatch[1]))),
      minutes: Math.max(0, Math.min(59, Number(hhmmMatch[2]))),
    };
  }

  const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2] || 0);
    const period = meridiemMatch[3].toLowerCase();
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return {
      hours: Math.max(0, Math.min(23, hours)),
      minutes: Math.max(0, Math.min(59, minutes)),
    };
  }

  return { hours: 9, minutes: 0 };
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const buildSpecificTimeResumeAt = (hours) => {
  const totalHours = Math.max(1, Number(hours) || 1);
  const date = new Date();
  date.setHours(date.getHours() + totalHours);
  return date.toISOString();
};

const buildCustomResumeAt = (selectedDate, selectedTime) => {
  if (!selectedDate || !selectedTime) return null;

  const date = new Date(selectedDate);
  if (Number.isNaN(date.getTime())) return null;

  let hours = Number(selectedTime.hour || 0);
  const minutes = Number(selectedTime.minute || 0);
  const period = String(selectedTime.period || "am").toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const buildNextBusinessDayResumeAt = (restaurantProfile) => {
  const now = new Date();
  const openDays = Array.isArray(restaurantProfile?.openDays)
    ? restaurantProfile.openDays.map(normalizeDayName).filter(Boolean)
    : [];
  const openingTime = parseRestaurantTimeToParts(restaurantProfile?.openingTime || "09:00");

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const dayName = WEEKDAYS[candidate.getDay()];

    if (openDays.length > 0 && !openDays.includes(dayName)) continue;

    candidate.setHours(openingTime.hours, openingTime.minutes, 0, 0);
    return candidate.toISOString();
  }

  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(openingTime.hours, openingTime.minutes, 0, 0);
  return fallback.toISOString();
};

export function buildStockRule({ selectedOption, hours, selectedDate, selectedTime, restaurantProfile }) {
  const createdAt = new Date().toISOString();

  if (selectedOption === "manual") {
    return { mode: "manual", createdAt, resumeAt: null };
  }

  if (selectedOption === "next-business-day") {
    return {
      mode: "next-business-day",
      createdAt,
      resumeAt: buildNextBusinessDayResumeAt(restaurantProfile),
    };
  }

  if (selectedOption === "custom-date-time") {
    return {
      mode: "custom-date-time",
      createdAt,
      resumeAt: buildCustomResumeAt(selectedDate, selectedTime),
    };
  }

  return {
    mode: "specific-time",
    createdAt,
    durationHours: Math.max(1, Number(hours) || 1),
    resumeAt: buildSpecificTimeResumeAt(hours),
  };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// toLocaleString("en-IN", {day:"2-digit", month:"short", hour:"numeric", minute:"2-digit", hour12:true})
// -> "05 Dec, 2:30 pm" (Hermes has no full Intl data, so it is formatted by hand).
function formatEnIn(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const h = date.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${MONTHS_SHORT[date.getMonth()]}, ${hour12}:${minute} ${h >= 12 ? "pm" : "am"}`;
}

export function getRuleStatusLabel(rule) {
  if (!rule) return "No time set. Turn item in stock manually.";
  if (rule.mode === "manual") return "Manual off. Turn item in stock manually.";

  const resumeAt = new Date(rule.resumeAt || "");
  if (Number.isNaN(resumeAt.getTime())) return "Out of stock";

  const formatted = formatEnIn(resumeAt);
  if (rule.mode === "specific-time") return `Out of stock until ${formatted}`;
  if (rule.mode === "next-business-day") return `Back next business day at ${formatted}`;
  if (rule.mode === "custom-date-time") return `Out of stock until ${formatted}`;
  return "Out of stock";
}

export function isRuleActive(rule, nowMs = Date.now()) {
  return Boolean(
    rule && (rule.mode === "manual" || (rule.resumeAt && new Date(rule.resumeAt).getTime() > nowMs)),
  );
}

export function expiredRuleIds(stockRules, nowMs = Date.now()) {
  return Object.entries(stockRules || {})
    .filter(([, rule]) => rule?.mode !== "manual")
    .filter(([, rule]) => {
      const resumeAtMs = new Date(rule?.resumeAt || "").getTime();
      return Number.isFinite(resumeAtMs) && resumeAtMs <= nowMs;
    })
    .map(([itemId]) => itemId);
}

// "15 Dec 2025" (Inventory formatDate)
export function formatPickerDate(date) {
  if (!date) return "";
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

// "2:30 PM" (Inventory formatTime)
export function formatPickerTime(time) {
  if (!time) return "";
  return `${time.hour}:${String(time.minute).padStart(2, "0")} ${String(time.period).toUpperCase()}`;
}
