/**
 * HQ "filter by franchise" for the admin panel.
 *
 * The selected franchise is kept in localStorage. While HQ is on one of the pages below, the admin
 * API client sends it as the X-Franchise-Filter header on GET requests, and the backend runs those
 * reads inside that franchise's scope (only its zone's restaurants, orders, riders, reports ...).
 * Writes never carry the header.
 */

const STORAGE_KEY = "admin_franchise_filter"
export const FRANCHISE_FILTER_EVENT = "adminFranchiseFilterChanged"
export const ALL_FRANCHISES = "all"
export const OWN_FRANCHISE = "own"

/** Admin pages (under /admin/food/) that show the franchise filter. */
const FILTER_PAGE_PREFIXES = [
  // Order management
  "orders/", "order-detect-delivery",
  // Food management
  "food-approval", "foods", "food/list", "addons", "categories",
  // Restaurant management
  "restaurants", "restaurant-payouts",
  // Deliveryman management
  "delivery-partners", "cash-limit-settlement", "delivery-withdrawal", "delivery-boy-wallet",
  "delivery-emergency-help", "delivery-support-tickets",
  // Report management
  "daily-sales", "transaction-report", "order-report/", "tax-report", "restaurant-report",
  "customer-report/", "admin-earning-report", "expense-report", "disbursement-report/", "restaurant-vat-report",
  // Transaction management
  "restaurant-withdraws",
]

export function isFranchiseFilterPage(pathname = "") {
  const match = String(pathname).match(/^\/admin\/food\/(.+?)\/?$/)
  if (!match) return false
  const rest = match[1]
  return FILTER_PAGE_PREFIXES.some((p) => (p.endsWith("/") ? rest.startsWith(p) : rest === p || rest.startsWith(`${p}/`)))
}

export function getFranchiseFilter() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ALL_FRANCHISES
  } catch {
    return ALL_FRANCHISES
  }
}

export function setFranchiseFilter(franchiseId) {
  const value = franchiseId || ALL_FRANCHISES
  try {
    if (value === ALL_FRANCHISES) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {}
  window.dispatchEvent(new CustomEvent(FRANCHISE_FILTER_EVENT, { detail: { franchiseId: value } }))
}

/** Header value for the current page, or null when no filter applies. */
export function activeFranchiseFilter() {
  if (typeof window === "undefined" || !isFranchiseFilterPage(window.location.pathname)) return null
  const value = getFranchiseFilter()
  return value === ALL_FRANCHISES ? null : value
}
