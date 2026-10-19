// Port of utils/restaurantLayoutConfig.js with native paths (web path minus /food/restaurant).
import { Compass, FileText, LayoutDashboard, MessageSquare, Package } from "lucide-react-native";

// BottomNavOrders tabs. `name` is the Expo Router tab route inside src/app/(app)/(tabs)/.
export const ORDERS_TABS = [
  { id: "orders", name: "index", label: "Orders", icon: FileText, route: "/" },
  { id: "inventory", name: "inventory", label: "Inventory", icon: Package, route: "/inventory" },
  { id: "feedback", name: "feedback", label: "Feedback", icon: MessageSquare, route: "/feedback" },
  { id: "explore", name: "explore", label: "Explore", icon: Compass, route: "/explore" },
];

export const TAB_ROUTES = new Set(ORDERS_TABS.map((t) => t.route));

// RestaurantLayout hides the bottom nav when the path contains one of these. Because of "/orders/"
// it is hidden on /orders/all and /orders/:id too.
const HIDE_BOTTOM_NAV_PATTERNS = ["/create-offers", "/hub-menu/item", "/outlet-timings/", "/orders/"];

export function showBottomNavFor(pathname) {
  return !HIDE_BOTTOM_NAV_PATTERNS.some((p) => pathname.includes(p));
}

// getRestaurantHeaderOptions: search only on Orders and Inventory.
export function headerOptionsFor(pathname) {
  return {
    showSearch: pathname === "/" || pathname === "/inventory",
    showOfflineOnlineTag: true,
    showNotifications: true,
  };
}

// BottomNavOrders findActiveTab: longest matching route; every other restaurant path matches the
// Orders route ("/food/restaurant" is a prefix of all of them), so Orders is active elsewhere.
export function activeTabFor(pathname) {
  const match = ORDERS_TABS.filter((t) => t.route !== "/").find(
    (t) => pathname === t.route || pathname.startsWith(`${t.route}/`),
  );
  return match?.id || "orders";
}

const SIDEBAR_ICONS = {
  dashboard: LayoutDashboard,
  orders: FileText,
  inventory: Package,
  feedback: MessageSquare,
};

// RESTAURANT_SIDEBAR_SECTIONS (18 items). Only the Main items have icons on web.
export const RESTAURANT_SIDEBAR_SECTIONS = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", route: "/dashboard", icon: SIDEBAR_ICONS.dashboard },
      { label: "Orders", route: "/", icon: SIDEBAR_ICONS.orders },
      { label: "Inventory", route: "/inventory", icon: SIDEBAR_ICONS.inventory },
      { label: "Feedback", route: "/feedback", icon: SIDEBAR_ICONS.feedback },
    ],
  },
  {
    title: "Outlet",
    items: [
      { label: "Outlet info", route: "/outlet-info" },
      { label: "Outlet timings", route: "/outlet-timings" },
      { label: "Menu categories", route: "/menu-categories" },
      { label: "Promo codes", route: "/promocodes" },
      { label: "Delivery settings", route: "/delivery-settings" },
      { label: "Zone setup", route: "/zone-setup" },
    ],
  },
  {
    title: "Orders & reviews",
    items: [
      { label: "Order history", route: "/orders/all" },
      { label: "Ratings & reviews", route: "/ratings-reviews" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payout", route: "/hub-finance" },
      { label: "Bank details", route: "/update-bank-details" },
      { label: "Withdrawal history", route: "/withdrawal-history" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Notifications", route: "/notifications" },
      { label: "Help centre", route: "/help-centre/support" },
      { label: "Share feedback", route: "/share-feedback" },
    ],
  },
];

// RestaurantSidebar isActive.
export function isSidebarItemActive(route, pathname) {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

// Web main: pb-[calc(5.5rem+safe-area)] when the bottom nav is shown.
export const BOTTOM_NAV_SPACE = 88;
