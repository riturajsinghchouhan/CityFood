// Port of pages/user/profile/Coupons.jsx: public offers with copy-code.
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Copy, TicketPercent } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPublicOffers } from "../../api";
import CouponsEmptyIllustration from "../../components/support/CouponsEmptyIllustration";
import FadeIn from "../../components/support/FadeIn";
import { c, webVars } from "../../components/support/palette";
import { Button, Screen, Text, toast } from "../../components/ui";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";

async function handleCopy(code) {
  const value = String(code || "").trim();
  if (!value) return;
  try {
    await Clipboard.setStringAsync(value);
    toast.success("Coupon copied");
  } catch {
    toast.error("Failed to copy");
  }
}

function CouponRow({ offer, isDark, v }) {
  const code = offer?.couponCode || "";
  const title = offer?.title || "";
  const restaurantName = offer?.restaurantName || "All Restaurants";
  const endDate = offer?.endDate ? new Date(offer.endDate) : null;
  const expiryText =
    endDate && !Number.isNaN(endDate.getTime()) ? `Valid till ${endDate.toLocaleDateString()}` : "No expiry";
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? c.gray800 : c.gray200 },
      ]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconBox}>
          <TicketPercent size={20} color={c.orange700} />
        </View>
        <View style={styles.flexShrink}>
          <View style={styles.codeRow}>
            <Text style={[styles.code, { color: isDark ? "#ffffff" : c.gray900 }]}>{code}</Text>
            {title ? (
              <View style={[styles.titleBadge, { backgroundColor: isDark ? c.gray800 : c.gray100 }]}>
                <Text style={[styles.titleBadgeText, { color: isDark ? c.gray200 : c.gray700 }]}>{title}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.restaurant, { color: isDark ? c.gray400 : c.gray600 }]} numberOfLines={1}>
            {restaurantName}
          </Text>
          <Text style={styles.expiry}>{expiryText}</Text>
        </View>
      </View>
      <Button
        variant="outline"
        onPress={() => handleCopy(code)}
        style={[styles.copyBtn, !isDark && { backgroundColor: v.background }]}
        left={<Copy size={16} color={v.foreground} />}
        title="Copy"
        textStyle={{ color: v.foreground }}
      />
    </View>
  );
}

export default function CouponsScreen() {
  const { isDark } = useTheme();
  const v = webVars(isDark);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getPublicOffers()
      .then((res) => {
        const list = res?.data?.allOffers || res?.allOffers || [];
        if (!cancelled) setOffers(Array.isArray(list) ? list.filter((o) => o?.showInCart !== false) : []);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedOffers = useMemo(
    () => [...offers].sort((a, b) => String(a?.couponCode || "").localeCompare(String(b?.couponCode || ""))),
    [offers],
  );

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => goTo("/profile")} style={styles.backBtn} accessibilityLabel="Back">
        <ArrowLeft size={16} color={isDark ? "#ffffff" : "#000000"} />
      </Pressable>
      <Text style={[styles.title, { color: isDark ? "#ffffff" : "#000000" }]}>Your coupons</Text>
    </View>
  );

  const minBlock = { minHeight: height * 0.6 };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <FadeIn style={styles.flex}>
        <FlatList
          data={loading ? [] : sortedOffers}
          keyExtractor={(o, i) => String(o?.id || o?.offerId || o?.couponCode || i)}
          renderItem={({ item }) => <CouponRow offer={item} isDark={isDark} v={v} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <View style={[styles.center, minBlock]}>
                <Text style={{ color: isDark ? c.gray400 : c.gray600 }}>Loading coupons...</Text>
              </View>
            ) : (
              <View style={[styles.center, styles.emptyWrap, minBlock]}>
                <View style={styles.illustration}>
                  <CouponsEmptyIllustration />
                </View>
                <View style={styles.emptyText}>
                  <Text style={styles.emptyTitle}>No coupons found</Text>
                  <Text style={styles.emptyBody}>
                    Discover hidden coupons on your map screen after placing an order
                  </Text>
                </View>
              </View>
            )
          }
          contentContainerStyle={[styles.list, { paddingBottom: 16 + 24 + insets.bottom }]}
        />
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  title: { fontSize: 20, fontWeight: "700" },
  center: { alignItems: "center", justifyContent: "center" },
  emptyWrap: { paddingHorizontal: 16 },
  illustration: { marginBottom: 32 },
  emptyText: { alignItems: "center", gap: 12, maxWidth: 384 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#000000", textAlign: "center" },
  emptyBody: { fontSize: 14, color: c.gray600, lineHeight: 23, textAlign: "center" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flexShrink: 1, minWidth: 0 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.orange100,
    alignItems: "center",
    justifyContent: "center",
  },
  codeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  code: { fontSize: 14, fontWeight: "600" },
  titleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  titleBadgeText: { fontSize: 12 },
  restaurant: { fontSize: 12, marginTop: 4 },
  expiry: { fontSize: 11, color: c.gray500, marginTop: 4 },
  copyBtn: { height: 36, paddingHorizontal: 12, borderRadius: 12 },
});
