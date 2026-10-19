// Port of components/restaurant/RestaurantLayout.jsx at phone width: the navbar on top of every
// protected screen, the hamburger drawer, the floating bottom nav (the (tabs) tabBar on the four
// tab screens, StackBottomNav elsewhere) and the global overlays (new-order popup). The children
// are the protected Stack. The pickup-OTP modal is mounted by the (app) layout outside the guard.
import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useRestaurantEvents } from "../../context/RestaurantNotificationsContext";
import { tw } from "../../theme/tokens";
import { StackBottomNav } from "./BottomNavOrders";
import { headerOptionsFor } from "./layoutConfig";
import NewOrderPopup from "./NewOrderPopup";
import RestaurantDrawer from "./RestaurantDrawer";
import RestaurantNavbar from "./RestaurantNavbar";
import { refreshInboxUnread, resetShellStores, useInboxUnreadPolling } from "./stores";

const DrawerContext = createContext({ open: () => {}, close: () => {}, isOpen: false });

/** {open, close, isOpen} for the hamburger drawer. The navbar already opens it. */
export function useRestaurantDrawer() {
  return useContext(DrawerContext);
}

export default function RestaurantLayout({ children }) {
  const pathname = usePathname();
  const { onLogout } = useAuth();
  // The drawer is open only on the path it was opened on: RestaurantLayout closes it on every
  // pathname change.
  const [openOn, setOpenOn] = useState(null);
  if (openOn !== null && openOn !== pathname) setOpenOn(null);
  const drawerOpen = openOn === pathname;
  const open = useCallback(() => setOpenOn(pathname), [pathname]);
  const close = useCallback(() => setOpenOn(null), []);
  const drawer = useMemo(() => ({ open, close, isOpen: drawerOpen }), [open, close, drawerOpen]);

  useEffect(() => onLogout(resetShellStores), [onLogout]);

  // Inbox unread dot (navbar bell + Feedback tab); admin_notification refreshes it like the web's
  // notification-inbox-refresh event.
  useInboxUnreadPolling(true);
  useRestaurantEvents((e) => {
    if (e.type === "admin_notification") refreshInboxUnread();
  });

  const headerOptions = headerOptionsFor(pathname);

  return (
    <DrawerContext.Provider value={drawer}>
      <View style={styles.root}>
        <RestaurantNavbar {...headerOptions} onMobileMenuOpen={open} />
        <View style={styles.main}>{children}</View>
        <StackBottomNav />
        <RestaurantDrawer open={drawerOpen} onClose={close} />
        <NewOrderPopup />
      </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tw.gray100 },
  main: { flex: 1, minHeight: 0 },
});
