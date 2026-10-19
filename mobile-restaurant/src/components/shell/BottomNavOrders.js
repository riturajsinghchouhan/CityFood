// Port of components/restaurant/BottomNavOrders.jsx: the floating primary pill with Orders,
// Inventory, Feedback and Explore. Used two ways:
//   - OrdersTabBar: the custom tabBar of src/app/(app)/(tabs)/_layout.js (the four tab screens);
//   - StackBottomNav: rendered by the shell over the other protected screens where the web shows
//     the bar (every path except /orders/*, /hub-menu/item/*, /outlet-timings/*, /create-offers).
// Hidden while the keyboard is open, as on web.
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRestaurantNotifications } from "../../context/RestaurantNotificationsContext";
import { useTheme } from "../../theme/ThemeContext";
import Text from "../ui/Text";
import { activeTabFor, BOTTOM_NAV_SPACE, ORDERS_TABS, showBottomNavFor, TAB_ROUTES } from "./layoutConfig";
import { openShellRoute } from "./navigate";
import { useInboxUnreadCount } from "./stores";

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Bottom padding a protected screen's scroll content needs: the web's
 * pb-[calc(5.5rem+safe-area)] where the bottom nav shows, else the safe-area inset alone.
 */
export function useShellBottomInset() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return showBottomNavFor(pathname) ? BOTTOM_NAV_SPACE + insets.bottom : insets.bottom;
}

// animate-ping behind the red dot.
function PingDot() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={styles.dotWrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.ping,
          {
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

function TabButton({ tab, active, showDot, onPress }) {
  const Icon = tab.icon;
  const [press] = useState(() => new Animated.Value(1));
  const [wiggle] = useState(() => new Animated.Value(active ? 1 : 0));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    // animate scale [1, 1.2, 1], rotate [0, -10, 10, 0] over 0.4 s
    wiggle.setValue(0);
    Animated.timing(wiggle, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [active, wiggle]);
  const scale = wiggle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] });
  const rotate = wiggle.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: ["0deg", "-10deg", "10deg", "0deg"] });
  const color = active ? "#ffffff" : "rgba(255,255,255,0.7)";
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(press, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      style={styles.tabPressable}
    >
      <Animated.View style={[styles.tab, { transform: [{ scale: press }] }]}>
        <Animated.View style={active ? { transform: [{ scale }, { rotate }] } : null}>
          <Icon size={20} color={color} />
        </Animated.View>
        {showDot ? <PingDot /> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color, fontWeight: active ? "800" : "500", transform: [{ scale: active ? 1.1 : 1 }] },
          ]}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Presentational bar. activeId: "orders" | "inventory" | "feedback" | "explore". */
export function BottomNavOrdersBar({ activeId, onTabPress, bottomInset = 0 }) {
  const { colors } = useTheme();
  const { newOrder } = useRestaurantNotifications();
  const unreadCount = useInboxUnreadCount();
  const keyboardVisible = useKeyboardVisible();
  const [rowWidth, setRowWidth] = useState(0);
  const activeIndex = Math.max(0, ORDERS_TABS.findIndex((t) => t.id === activeId));
  const [slide] = useState(() => new Animated.Value(activeIndex));
  useEffect(() => {
    // layoutId spring (stiffness 500, damping 30)
    Animated.spring(slide, { toValue: activeIndex, stiffness: 500, damping: 30, mass: 1, useNativeDriver: true }).start();
  }, [activeIndex, slide]);

  if (keyboardVisible) return null;

  const gap = 4;
  const count = ORDERS_TABS.length;
  const tabWidth = rowWidth ? (rowWidth - gap * (count - 1)) / count : 0;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(6.4, bottomInset) }]}>
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.primary, boxShadow: `0px 25px 50px -12px ${colors.primary}59` },
        ]}
      >
        <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
          {tabWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.highlight,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: slide.interpolate({
                        inputRange: [0, count - 1],
                        outputRange: [0, (tabWidth + gap) * (count - 1)],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
          {ORDERS_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              showDot={(tab.id === "orders" && Boolean(newOrder)) || (tab.id === "feedback" && unreadCount > 0)}
              onPress={() => onTabPress(tab)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Custom tabBar for the (tabs) navigator. Expo Router SDK 58 passes
 * {state, descriptors, emitter, navigateToTab, insets} (no `navigation`).
 */
export function OrdersTabBar({ state, emitter, navigateToTab, insets }) {
  const focused = state.routes[state.index];
  const activeId = ORDERS_TABS.find((t) => t.name === focused?.name)?.id || "orders";
  const onTabPress = (tab) => {
    const route = state.routes.find((r) => r.name === tab.name);
    if (!route) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (route.key !== focused?.key && !event.defaultPrevented) navigateToTab(route.key);
  };
  return <BottomNavOrdersBar activeId={activeId} onTabPress={onTabPress} bottomInset={insets?.bottom || 0} />;
}

/** The same bar over non-tab protected screens (Orders is the active tab there, as on web). */
export function StackBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (TAB_ROUTES.has(pathname) || !showBottomNavFor(pathname)) return null;
  return (
    <BottomNavOrdersBar
      activeId={activeTabFor(pathname)}
      onTabPress={(tab) => openShellRoute(tab.route, pathname)}
      bottomInset={insets.bottom}
    />
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, alignItems: "center" },
  pill: {
    width: "100%",
    maxWidth: 448,
    borderRadius: 30,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", gap: 4 },
  highlight: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.25)",
    boxShadow: "0px 0px 15px rgba(255,255,255,0.2)",
  },
  tabPressable: { flex: 1, minWidth: 0 },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  label: { fontSize: 11, lineHeight: 13 },
  dotWrap: { position: "absolute", top: 8, right: 8, width: 10, height: 10 },
  ping: { ...StyleSheet.absoluteFill, borderRadius: 9999, backgroundColor: "#ff6467" },
  dot: { width: 10, height: 10, borderRadius: 9999, backgroundColor: "#fb2c36", borderWidth: 1, borderColor: "#ffffff" },
});
