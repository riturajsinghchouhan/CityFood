export const adminSidebarMenu = [
  {
    type: "link",
    label: "Dashboard",
    path: "/admin/food",
    icon: "LayoutDashboard",
  },
  {
    type: "link",
    label: "Point of Sale",
    path: "/admin/food/point-of-sale",
    icon: "CreditCard",
  },
  {
    type: "link",
    label: "Real Time Status",
    path: "/admin/food/status-monitor",
    icon: "Activity",
  },
  {
    type: "link",
    label: "Daily Report",
    path: "/admin/food/daily-sales",
    icon: "Receipt",
  },
  {
    type: "section",
    label: "FRANCHISE MANAGEMENT",
    // Owner-level: the backend rejects sub-admins on these routes, so they are never offered as sub-admin permissions.
    superAdminOnly: true,
    items: [
      {
        type: "link",
        label: "Manage Franchise",
        path: "/admin/food/franchises",
        icon: "Building2",
      },
      {
        type: "link",
        label: "Franchise Withdrawals",
        path: "/admin/food/franchise-withdrawals",
        icon: "Wallet",
      },
    ],
  },
  {
    type: "section",
    label: "MY FRANCHISE",
    // Shown only to franchise owners (who use this same admin panel for their own zone).
    franchiseOnly: true,
    items: [
      { type: "link", label: "Wallet & Withdraw", path: "/admin/food/my-franchise/wallet", icon: "Wallet" },
      { type: "link", label: "Fees & Commission", path: "/admin/food/my-franchise/fees", icon: "IndianRupee" },
      { type: "link", label: "Franchise Settings", path: "/admin/food/my-franchise/settings", icon: "Settings" },
    ],
  },
  {
    type: "section",
    label: "ORDER MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Orders",
        icon: "FileText",
        subItems: [
          { label: "All", path: "/admin/food/orders/all" },
          { label: "Scheduled", path: "/admin/food/orders/scheduled" },
          { label: "Pending", path: "/admin/food/orders/pending" },
          { label: "Accepted", path: "/admin/food/orders/accepted" },
          { label: "Processing", path: "/admin/food/orders/processing" },
          { label: "Food On The Way", path: "/admin/food/orders/food-on-the-way" },
          { label: "Delivered", path: "/admin/food/orders/delivered" },
          { label: "Cancelled", path: "/admin/food/orders/canceled" },
          { label: "Restaurant cancelled", path: "/admin/food/orders/restaurant-cancelled" },
          { label: "Payment Failed", path: "/admin/food/orders/payment-failed" },
          { label: "Refunded", path: "/admin/food/orders/refunded" },
          { label: "Offline Payments", path: "/admin/food/orders/offline-payments" },
        ],
      },
      {
        type: "link",
        label: "Order Detect Delivery",
        path: "/admin/food/order-detect-delivery",
        icon: "Truck",
      },
    ],
  },
  {
    type: "section",
    label: "FOOD MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Food Approval",
        path: "/admin/food/food-approval",
        icon: "CheckCircle2",
      },
      {
        type: "expandable",
        label: "Foods",
        icon: "Utensils",
        subItems: [
          { label: "Restaurant Foods List", path: "/admin/food/foods" },
          { label: "Restaurant Addons List", path: "/admin/food/addons" },
        ],
      },
      {
        type: "expandable",
        label: "Categories",
        icon: "FolderTree",
        subItems: [{ label: "Category", path: "/admin/food/categories" }],
      },
    ],
  },
  {
    type: "section",
    label: "RESTAURANT MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Zone Setup",
        path: "/admin/food/zone-setup",
        icon: "MapPin",
      },
      {
        type: "link",
        label: "Zone Ranking",
        path: "/admin/food/zone-ranking",
        icon: "MapPin",
      },
      {
        type: "expandable",
        label: "Restaurants",
        icon: "UtensilsCrossed",
        subItems: [
          { label: "Restaurants List", path: "/admin/food/restaurants" },
          { label: "Menu Bulk Upload", path: "/admin/food/restaurants/menu-bulk-upload" },
          { label: "New Joining Request", path: "/admin/food/restaurants/joining-request" },
          { label: "Restaurant Commission", path: "/admin/food/restaurants/commission" },
          { label: "Restaurant Discount", path: "/admin/food/restaurants/discount" },
          { label: "Restaurant Reviews", path: "/admin/food/restaurants/reviews" },
          { label: "Restaurant Complaints", path: "/admin/food/restaurants/complaints" },
          { label: "Restaurant Payouts", path: "/admin/food/restaurant-payouts" },
        ],
      },
      {
        type: "link",
        label: "Restaurant Payouts",
        path: "/admin/food/restaurant-payouts",
        icon: "DollarSign",
      },
    ],
  },
  {
    type: "section",
    label: "PROMOTIONS MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Restaurant Coupons & Offers",
        path: "/admin/food/coupons",
        icon: "Gift",
      },
    ],
  },
  {
    type: "section",
    label: "REFERRAL & REWARDS",
    items: [
      { type: "link", label: "Referral Settings", path: "/admin/food/referral-settings", icon: "Gift" },
    ],
  },
  {
    type: "section",
    label: "CUSTOMER MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Customers",
        path: "/admin/food/customers",
        icon: "Users",
      },
      {
        type: "link",
        label: "Support Tickets (User & Restaurant)",
        path: "/admin/food/support-tickets",
        icon: "MessageSquare",
      },
    ],
  },
  {
    type: "section",
    label: "DELIVERYMAN MANAGEMENT",
    items: [
      { type: "link", label: "Delivery Cash Limit", path: "/admin/food/delivery-cash-limit", icon: "IndianRupee" },
      { type: "link", label: "Multiple Orders", path: "/admin/food/delivery-multiple-orders", icon: "ListChecks" },
      { type: "link", label: "Delivery & Platform Fee", path: "/admin/food/fee-settings", icon: "DollarSign" },
      { type: "link", label: "Cash limit settlement", path: "/admin/food/cash-limit-settlement", icon: "Receipt" },
      { type: "link", label: "Delivery Withdrawal", path: "/admin/food/delivery-withdrawal", icon: "Wallet" },
      { type: "link", label: "Delivery boy Wallet", path: "/admin/food/delivery-boy-wallet", icon: "PiggyBank" },
      { type: "link", label: "Delivery Boy Commission", path: "/admin/food/delivery-boy-commission", icon: "DollarSign" },
      { type: "link", label: "Delivery Emergency Help", path: "/admin/food/delivery-emergency-help", icon: "Phone" },
      { type: "link", label: "Delivery Support Tickets", path: "/admin/food/delivery-support-tickets", icon: "MessageSquare" },
      {
        type: "expandable",
        label: "Deliveryman",
        icon: "Package",
        subItems: [
          { label: "New Join Request", path: "/admin/food/delivery-partners/join-request" },
          { label: "Deliveryman List", path: "/admin/food/delivery-partners" },
          { label: "Deliveryman Reviews", path: "/admin/food/delivery-partners/reviews" },
          { label: "Bonus", path: "/admin/food/delivery-partners/bonus" },
          { label: "Earning Addon", path: "/admin/food/delivery-partners/earning-addon" },
          { label: "Earning Addon History", path: "/admin/food/delivery-partners/earning-addon-history" },
          { label: "Delivery Earning", path: "/admin/food/delivery-partners/earnings" },
        ],
      },
    ],
  },
  {
    type: "section",
    label: "HELP & SUPPORT",
    items: [
      { type: "link", label: "User Feedback", path: "/admin/food/contact-messages", icon: "Mail" },
      { type: "link", label: "Safety Emergency Reports", path: "/admin/food/safety-emergency-reports", icon: "AlertTriangle" },
    ],
  },
  {
    type: "section",
    label: "REPORT MANAGEMENT",
    items: [
      { type: "link", label: "Daily Sales & Cash Audit", path: "/admin/food/daily-sales", icon: "Receipt" },
      { type: "link", label: "Transaction Report", path: "/admin/food/transaction-report", icon: "FileText" },
      { type: "link", label: "Order Report", path: "/admin/food/order-report/regular", icon: "FileText" },
      { type: "link", label: "Tax Report", path: "/admin/food/tax-report", icon: "Receipt" },
      {
        type: "expandable",
        label: "Restaurant Report",
        icon: "FileText",
        subItems: [{ label: "Restaurant Report", path: "/admin/food/restaurant-report" }],
      },
      {
        type: "expandable",
        label: "Customer Report",
        icon: "FileText",
        subItems: [{ label: "Feedback Experience", path: "/admin/food/customer-report/feedback-experience" }],
      },
    ],
  },
  {
    type: "section",
    label: "TRANSACTION MANAGEMENT",
    items: [
      { type: "link", label: "Restaurant Payouts", path: "/admin/food/restaurant-payouts", icon: "DollarSign" },
      { type: "link", label: "Restaurant Withdraws", path: "/admin/food/restaurant-withdraws", icon: "CreditCard" },
    ],
  },
  {
    type: "section",
    label: "BANNER SETTINGS",
    items: [
      { type: "link", label: "App Intro & Ads", path: "/admin/food/app-intro-ads", icon: "Image" },
      { type: "link", label: "Landing Page Management", path: "/admin/food/hero-banner-management", icon: "Image" },
    ],
  },
  /* {
    type: "section",
    label: "DINING MANAGEMENT",
    items: [
      { type: "link", label: "Dining Banners", path: "/admin/food/dining-management", icon: "UtensilsCrossed" },
      { type: "link", label: "Dining List", path: "/admin/food/dining-list", icon: "FileText" },
      { type: "link", label: "Dining Category Request", path: "/admin/food/dining-requests", icon: "CheckCircle" },
    ],
  }, */
  {
    type: "section",
    label: "EMPLOYEE MANAGEMENT",
    items: [
      { type: "link", label: "Sub Admins", path: "/admin/food/sub-admins", icon: "Users" },
    ],
  },
  {
    type: "section",
    label: "SYSTEM SETTINGS",
    items: [
      { type: "link", label: "Broadcast Notification", path: "/admin/food/broadcast-notification", icon: "Bell" },
      { type: "link", label: "Restaurant Delay Alerts", path: "/admin/food/restaurant-delay-alerts", icon: "Bell" },
      { type: "link", label: "Toggle Management", path: "/admin/food/toggle-management", icon: "ToggleLeft" },
      { type: "link", label: "Business Setup", path: "/admin/food/business-setup", icon: "Settings" },
      { type: "link", label: "Theme Settings", path: "/admin/food/theme-settings", icon: "Palette" },
    ],
  },
  {
    type: "section",
    label: "PAGES & SOCIAL MEDIA",
    items: [
      { type: "link", label: "About Us", path: "/admin/food/pages-social-media/about", icon: "Globe" },
      { type: "link", label: "Terms & Conditions", path: "/admin/food/pages-social-media/terms", icon: "FileText" },
      { type: "link", label: "Privacy Policy", path: "/admin/food/pages-social-media/privacy", icon: "Lock" },
      { type: "link", label: "Refund Policy", path: "/admin/food/pages-social-media/refund", icon: "Receipt" },
      { type: "link", label: "Shipping Policy", path: "/admin/food/pages-social-media/shipping", icon: "Truck" },
      { type: "link", label: "Cancellation Policy", path: "/admin/food/pages-social-media/cancellation", icon: "X" },
    ],
  },
  {
    type: "section",
    label: "DEVELOPER",
    items: [
      { type: "link", label: "Env Managements", path: "/admin/food/env-managements", icon: "Database" },
      { type: "link", label: "Image Setting", path: "/admin/food/image-setting", icon: "ImageIcon" },
      { type: "link", label: "Developer Settings", path: "/admin/food/developer-settings", icon: "Code" },
      { type: "link", label: "Payment Reconciliation", path: "/admin/food/payment-reconciliation", icon: "ListChecks" },
    ],
  },
];

/**
 * A franchise owner sees the same admin panel for its own zone, without app-wide settings
 * (the backend refuses those for franchises anyway).
 */
const FRANCHISE_HIDDEN_SECTIONS = new Set([
  "FRANCHISE MANAGEMENT", "REFERRAL & REWARDS", "HELP & SUPPORT", "BANNER SETTINGS", "DINING MANAGEMENT",
  "EMPLOYEE MANAGEMENT", "SYSTEM SETTINGS", "PAGES & SOCIAL MEDIA", "DEVELOPER",
])
const FRANCHISE_HIDDEN_LABELS = new Set([
  "Categories", "Zone Setup", "Delivery Cash Limit", "Multiple Orders", "Delivery & Platform Fee",
  "Delivery Boy Commission", "Delivery Emergency Help", "Earning Addon", "Earning Addon History",
])

export const isFranchiseRole = (role) => String(role || "").toUpperCase() === "FRANCHISE_OWNER"

/** True when the signed-in admin panel user is a franchise owner (reads the stored admin user). */
export function isFranchiseSession() {
  try {
    return isFranchiseRole(JSON.parse(localStorage.getItem("admin_user") || "null")?.role)
  } catch {
    return false
  }
}

/** Franchise owners open the panel under /franchise, HQ under /admin. Both render the same pages. */
export const FRANCHISE_BASE = "/franchise"
export const panelBaseForRole = (role) => (isFranchiseRole(role) ? FRANCHISE_BASE : "/admin")

/** "/admin/food/x" -> "/franchise/food/x" for franchise owners. */
export function toPanelPath(path, role) {
  if (!isFranchiseRole(role) || typeof path !== "string") return path
  return path.replace(/^\/admin(?=\/|$)/, FRANCHISE_BASE)
}

/** "/franchise/food/x" -> "/admin/food/x", so route checks can use the menu's /admin paths. */
export const toAdminPath = (pathname = "") => String(pathname).replace(/^\/franchise(?=\/|$)/, "/admin")

const mapMenuPaths = (menu, map) => menu.map((item) => {
  if (item.type === "section") return { ...item, items: mapMenuPaths(item.items, map) }
  if (item.type === "expandable") return { ...item, subItems: item.subItems.map((s) => ({ ...s, path: map(s.path) })) }
  return item.path ? { ...item, path: map(item.path) } : item
})

/** The sidebar menu for a role, with paths under that role's panel base. */
export function menuForRole(role) {
  const menu = filterMenuForRole(role)
  return isFranchiseRole(role) ? mapMenuPaths(menu, (p) => toPanelPath(p, role)) : menu
}

/** Franchise owners lose HQ-only areas, everyone else loses MY FRANCHISE. Paths stay /admin. */
function filterMenuForRole(role) {
  const franchise = isFranchiseRole(role)
  return adminSidebarMenu
    .filter((item) => (franchise ? !item.superAdminOnly && !FRANCHISE_HIDDEN_SECTIONS.has(item.label) : !item.franchiseOnly))
    .map((item) => {
      if (!franchise) return item
      if (item.type === "section") {
        return { ...item, items: item.items.filter((it) => !FRANCHISE_HIDDEN_LABELS.has(it.label)).map((it) => (
          it.type === "expandable" ? { ...it, subItems: it.subItems.filter((sub) => !FRANCHISE_HIDDEN_LABELS.has(sub.label)) } : it
        )) }
      }
      return item
    })
    .filter((item) => item.type !== "section" || item.items.length > 0)
}

const collectPaths = (menu) => menu.flatMap((item) => {
  if (item.type === "section") return collectPaths(item.items)
  if (item.type === "expandable") return item.subItems.map((s) => s.path)
  return item.path ? [item.path] : []
})

/** Paths a role must not open (used by the route guard). */
export function blockedPathsForRole(role) {
  const allowed = new Set(collectPaths(filterMenuForRole(role)))
  return collectPaths(adminSidebarMenu).filter((p) => !allowed.has(p))
}
