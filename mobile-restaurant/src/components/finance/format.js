// Number and date formats the finance screens copy from the web's toLocaleString calls. Written
// out by hand so the output does not depend on the device's Intl data.
import dayjs from "dayjs";

// Indian digit grouping: 1234567.5 -> "12,34,567.50" (toLocaleString("en-IN", {min/max digits})).
export function formatINR(value, { minimumFractionDigits = 0, maximumFractionDigits = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  let fixed = Math.abs(n).toFixed(maximumFractionDigits);
  let [int, frac = ""] = fixed.split(".");
  frac = frac.replace(/0+$/, "");
  while (frac.length < minimumFractionDigits) frac += "0";
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  int = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${neg ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

// toLocaleString("en-IN", {day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"})
// -> "19 Oct 2026, 03:45 pm"
export const fmtDateTimeIN = (v) => dayjs(v).format("D MMM YYYY, hh:mm a");

// Same with day:"2-digit" and hour12 -> "09 Oct 2026, 03:45 pm"
export const fmtDateTimeIN2 = (v) => dayjs(v).format("DD MMM YYYY, hh:mm a");
