// OrdersMain top filter bar: horizontally scrolling pills, the active one in primary (scale 1.05)
// and the others white at 70 % opacity. The active pill is scrolled to the centre. The All pill
// carries the pending-orders count and a pulsing red dot.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { pal } from "./ordersUtils";

function PulseDot() {
  const [anim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.redDot, { opacity: anim }]} />;
}

function FilterPill({ tab, active, badge, onPress, onLayout }) {
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [active, anim]);
  const [pressAnim] = useState(() => new Animated.Value(1));
  const press = (to) => Animated.timing(pressAnim, { toValue: to, duration: 100, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onLayout={onLayout} onPressIn={() => press(0.95)} onPressOut={() => press(1)}>
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: active ? colors.primary : "#fff" },
          {
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ scale: Animated.multiply(anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }), pressAnim) }],
          },
        ]}
      >
        <Text style={[styles.pillText, { color: active ? "#fff" : "#000" }]}>{tab.label}</Text>
        {badge > 0 ? (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
            <PulseDot />
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// The list (and this bar inside it) remounts on every filter change; keep the scroll position.
let lastScrollX = 0;

const FilterTabsBar = forwardRef(function FilterTabsBar({ tabs, activeId, onSelect, pendingOrdersCount = 0 }, ref) {
  const scrollRef = useRef(null);
  const layouts = useRef({});
  const widthRef = useRef(0);
  const centeredFor = useRef(null);

  const scrollToTab = useCallback(
    (id) => {
      const l = layouts.current[id];
      if (!l || !scrollRef.current) return;
      const width = widthRef.current || Dimensions.get("window").width;
      const x = Math.max(0, l.x - width / 2 + l.width / 2);
      scrollRef.current.scrollTo({ x, animated: true });
    },
    [],
  );

  useImperativeHandle(ref, () => ({ scrollToTab }), [scrollToTab]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!layouts.current[activeId]) return; // centred once the pills are measured
      centeredFor.current = activeId;
      scrollToTab(activeId);
    });
    return () => cancelAnimationFrame(raf);
  }, [activeId, scrollToTab]);

  const onPillLayout = (id, layout) => {
    layouts.current[id] = layout;
    if (centeredFor.current !== activeId && Object.keys(layouts.current).length === tabs.length) {
      centeredFor.current = activeId;
      scrollToTab(activeId);
    }
  };

  return (
    <View style={styles.bar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        contentOffset={{ x: lastScrollX, y: 0 }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          lastScrollX = e.nativeEvent.contentOffset.x;
        }}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
      >
        {tabs.map((tab) => (
          <FilterPill
            key={tab.id}
            tab={tab}
            active={activeId === tab.id}
            badge={tab.id === "all" ? pendingOrdersCount : 0}
            onPress={() => onSelect(tab.id)}
            onLayout={(e) => onPillLayout(tab.id, e.nativeEvent.layout)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

export default FilterTabsBar;

const styles = StyleSheet.create({
  bar: { backgroundColor: tw.gray100 },
  row: { gap: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 9999,
    overflow: "hidden",
  },
  pillText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999, backgroundColor: pal.amber100 },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: "900", color: pal.amber700 },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: tw.red500,
    boxShadow: "0px 0px 8px rgba(239,68,68,0.6)",
  },
});
