// Port of Frontend/src/modules/Food/pages/user/Offers.jsx.
import { router } from "expo-router";
import { ArrowLeft, Clock, Star } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPublicOffers } from "../../api";
import { RestaurantGridSkeleton } from "../../components/restaurant/Skeletons";
import { AppImage, Button, Screen, Text, toast, useDelayedLoading } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { RUPEE } from "./lib";

// assets/offerpagebanner.svg drawn with react-native-svg (object-cover).
function OfferBanner() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
      <Rect width="1200" height="400" rx="32" fill="#FF4C4C" />
      <SvgText x="600" y="200" textAnchor="middle" fontSize="72" fontWeight="bold" fill="#fff">
        Great Offers
      </SvgText>
      <SvgText x="600" y="252" textAnchor="middle" fontSize="32" fill="#fff">
        Save big on your next meal!
      </SvgText>
      <Circle cx="1100" cy="80" r="60" fill="#fff" fillOpacity="0.15" />
      <Circle cx="100" cy="320" r="40" fill="#fff" fillOpacity="0.10" />
      <Rect x="900" y="250" width="180" height="80" rx="24" fill="#fff" fillOpacity="0.18" />
    </Svg>
  );
}

export default function OffersScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { width, height } = useWindowDimensions();
  const [offers, setOffers] = useState([]);
  const [groupedOffers, setGroupedOffers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const showSkeleton = useDelayedLoading(loading);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPublicOffers();
      const data = res?.data;
      if (data) {
        setOffers(data.allOffers || []);
        setGroupedOffers(data.groupedByOffer || {});
      }
    } catch (err) {
      const message = err?.message || "Failed to load offers";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const groups = Object.entries(groupedOffers);
  const tileWidth = (width - 32 - 16) / 2;
  const muted = isDark ? tw.gray400 : tw.gray600;

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"} edges={[]} statusBarStyle="light">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ width: "100%", height: height * 0.25, overflow: "hidden" }}>
          <OfferBanner />
          <Pressable onPress={goBack} style={[styles.back, { top: insets.top + 16 }]}>
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 24, gap: 24 }}>
          {showSkeleton ? <RestaurantGridSkeleton count={4} compact /> : null}

          {error && !loading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <Text style={{ textAlign: "center", color: isDark ? "#f87171" : tw.red500 }}>{error}</Text>
              <Button title="Retry" onPress={fetchOffers} style={{ marginTop: 16 }} />
            </View>
          ) : null}

          {!showSkeleton && !error ? (
            <>
              {groups.map(([offerText, dishes]) => (
                <View key={offerText}>
                  <Text style={[styles.groupTitle, { color: isDark ? "#f87171" : tw.red500 }]}>{offerText}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    {(dishes || []).slice(0, 8).map((dish) => (
                      <Pressable key={dish.id} style={{ width: tileWidth }} onPress={() => router.push(`/restaurants/${dish.restaurantSlug}`)}>
                        <View style={styles.dishImage}>
                          <AppImage
                            src={dish.dishImage || dish.restaurantImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                            width={tileWidth}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.offerBadge}>
                            <Text style={{ fontSize: 10, fontWeight: "600", color: "#ffffff" }}>{dish.offer}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", marginBottom: 4 }}>
                          <View style={styles.rating}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>{dish.restaurantRating?.toFixed(1) || "0.0"}</Text>
                            <Star size={10} color="#ffffff" fill="#ffffff" />
                          </View>
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: isDark ? tw.gray100 : tw.gray900 }}>
                          {dish.restaurantName}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 12, marginBottom: 4, color: muted }}>
                          {dish.dishName} - {RUPEE}
                          {dish.discountedPrice}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Clock size={12} color={isDark ? tw.gray400 : tw.gray500} />
                          <Text style={{ fontSize: 12, color: isDark ? tw.gray400 : tw.gray500 }}>{dish.deliveryTime}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {groups.length === 0 && offers.length > 0 ? (
                <View style={{ gap: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: isDark ? tw.gray100 : tw.gray900 }}>Available Coupons</Text>
                  {offers.map((o, i) => (
                    <View
                      key={o.id || o.offerId || i}
                      style={[styles.coupon, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.slate200 }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <View>
                          <Text style={{ fontSize: 12, color: isDark ? tw.slate400 : tw.slate500 }}>Coupon</Text>
                          <Text style={{ fontSize: 18, fontWeight: "800", letterSpacing: 0.45, color: isDark ? tw.slate100 : tw.slate900 }}>
                            {o.couponCode || "-"}
                          </Text>
                        </View>
                        <View style={styles.titleBadge}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>{o.title || "Offer"}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, color: isDark ? "#cbd5e1" : "#334155" }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#cbd5e1" : "#334155" }}>Restaurant:</Text>{" "}
                        {o.restaurantName || "All Restaurants"}
                      </Text>
                      {o.endDate ? (
                        <Text style={{ fontSize: 12, color: isDark ? tw.slate400 : tw.slate500 }}>
                          Valid till: {new Date(o.endDate).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {offers.length === 0 && !loading ? (
                <View style={{ paddingVertical: 48, alignItems: "center" }}>
                  <Text style={{ color: isDark ? tw.gray400 : tw.gray500 }}>No offers available at the moment</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(31,41,55,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 16, letterSpacing: 0.6 },
  dishImage: { height: 128, borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  offerBadge: { position: "absolute", top: 8, left: 8, backgroundColor: tw.blue600, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  rating: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: tw.green600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coupon: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8, boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  titleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: tw.blue600 },
});
