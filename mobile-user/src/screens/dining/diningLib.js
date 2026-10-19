// Shared helpers for the dining (table booking) screens.
import { router } from "expo-router";

// Web passes objects between dining pages through location.state. Native route params
// must be strings, so the state object is kept here under a per-screen key.
const navState = new Map();

export function setNavState(key, state) {
  if (state === undefined || state === null) navState.delete(key);
  else navState.set(key, state);
}

export function getNavState(key) {
  return navState.get(key) || null;
}

// web navigate(path, { state }); `href` is an expo-router href, `key` the state slot.
export function navigateWithState(href, key, state, { replace = false } = {}) {
  setNavState(key, state);
  if (replace) router.replace(href);
  else router.push(href);
}

export const NAV_KEYS = {
  details: (slug) => `dining:details:${slug}`,
  book: (slug) => `dining:book:${slug}`,
  confirmation: "dining:book-confirmation",
  success: "dining:book-success",
  editUser: "dining:edit-user",
};

// sessionStorage "food_dining_booking_draft_v1": lives for the app session.
let bookingDraft = null;

export function saveBookingDraft(draft) {
  bookingDraft = draft ? JSON.parse(JSON.stringify(draft)) : null;
}

export function readBookingDraft() {
  return bookingDraft;
}

export function clearBookingDraft() {
  bookingDraft = null;
}

export const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const pad2 = (n) => String(n).padStart(2, "0");

// toLocaleTimeString("en-IN", {hour: "numeric", minute: "2-digit", hour12: true}) -> "12:30 pm".
export const formatTimeValue = (value) => {
  if (!value) return null;
  if (/[ap]m/i.test(value)) return String(value).toUpperCase();
  const match = String(value).padStart(5, "0").match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${pad2(minutes)} ${hours < 12 ? "am" : "pm"}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// toLocaleDateString("en-GB" | "en-IN", {day: "2-digit", month: "short"}) -> "05 Mar".
export const formatDayMonth = (date) => `${pad2(date.getDate())} ${MONTHS[date.getMonth()]}`;

// {day: "2-digit", month: "short", year: "numeric"} -> "05 Mar 2026".
export const formatDayMonthYear = (date) => `${formatDayMonth(date)} ${date.getFullYear()}`;

export const getWeekdayName = (date) => WEEKDAYS[date.getDay()];

// The address line shown on the confirmation, success and bookings screens.
export const formatBookingLocation = (location) =>
  typeof location === "string"
    ? location
    : location?.formattedAddress ||
      location?.address ||
      `${location?.city || ""}${location?.area ? ", " + location.area : ""}`;

// Tailwind colors used by the booking screens that are not in theme/tokens.js.
export const pal = {
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cad5e2",
  slate400: "#90a1b9",
  slate500: "#62748e",
  slate600: "#45556c",
  slate700: "#314158",
  slate800: "#1d293d",
  slate900: "#0f172b",
  slate950: "#020618",
  amber50: "#fffbeb",
  amber100: "#fef3c6",
  amber200: "#fee685",
  amber300: "#ffd230",
  amber400: "#ffb900",
  amber500: "#fe9a00",
  amber600: "#e17100",
  amber700: "#bb4d00",
  amber800: "#973c00",
  amber900: "#7b3306",
  emerald500: "#00bc7d",
  red50: "#fef2f2",
  red100: "#ffe2e2",
  red200: "#ffc9c9",
  red400: "#ff6467",
  red500: "#fb2c36",
  red600: "#e7000b",
  red700: "#c10007",
  blue100: "#dbeafe",
  blue700: "#1447e6",
  purple50: "#faf5ff",
  purple400: "#c27aff",
  yellow400: "#fdc700",
  green100: "#dcfce7",
  green700: "#008236",
};
