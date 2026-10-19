// Port of pages/user/orders/UserOrderDetails.jsx (delivered / cancelled order details).
import dayjs from "dayjs";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Copy,
  CreditCard,
  Download,
  FileText,
  MapPin,
  Phone,
  RotateCcw,
  ShoppingBag,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { getOrderDetails, getRestaurantById } from "../../api";
import DashedLine from "../../components/orders/DashedLine";
import { buildSummaryInvoiceHtml, sharePdf } from "../../components/orders/invoicePdf";
import { extractOrder } from "../../components/orders/orderUtils";
import { AppImage, ScalePressable, Screen, Text, toast } from "../../components/ui";
import { loadBusinessSettings } from "../../context/AppSettingsContext";
import { useCart } from "../../context/CartContext";
import { goTo, useAppBack } from "../../navigation/back";
import { withProtected } from "../../navigation/Protected";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80";

function isCancelledStatus(status) {
  return (
    status === "cancelled" ||
    status === "cancelled_by_restaurant" ||
    status === "restaurant_cancelled" ||
    Boolean(status?.includes?.("cancel"))
  );
}

function UserOrderDetailsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { replaceCart } = useCart();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getOrderDetails(orderId);
        const data = extractOrder(res);
        if (!active) return;
        if (!data) {
          toast.error("Order not found");
          goTo("/orders");
          return;
        }
        setOrder(data);
        const rid = data.restaurantId;
        if (rid && typeof rid === "string" && !data.restaurant) {
          try {
            const rRes = await getRestaurantById(rid);
            if (active && rRes?.data?.restaurant) setRestaurant(rRes.data.restaurant);
          } catch {
            // the order can still be shown
          }
        }
      } catch (error) {
        if (!active) return;
        toast.error(error?.data?.message || "Failed to load order details");
        goTo("/orders");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  const page = isDark ? "#0a0a0a" : "#f9fafb";
  const card = isDark ? "#121212" : "#ffffff";
  const cardBorder = isDark ? "#1f2937" : "#e5e7eb";
  const t = {
    title: isDark ? "#f3f4f6" : "#1f2937",
    sub: isDark ? "#9ca3af" : "#6b7280",
    body: isDark ? "#d1d5db" : "#374151",
    value: isDark ? "#e5e7eb" : "#1f2937",
  };

  if (loading) {
    return (
      <Screen background={page}>
        <View style={styles.center}>
          <Text style={{ fontSize: 14, color: isDark ? "#9ca3af" : "#4b5563" }}>Loading order details...</Text>
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen background={page}>
        <View style={[styles.center, { gap: 12 }]}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? "#d1d5db" : "#374151" }}>Order not found</Text>
          <ScalePressable scaleTo={0.95} onPress={() => goTo("/orders")} style={[styles.smallBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>Back to Orders</Text>
          </ScalePressable>
        </View>
      </Screen>
    );
  }

  const orderIdDisplay = order.orderId || order._id || orderId;
  const restaurantObj = restaurant || (typeof order.restaurantId === "object" ? order.restaurantId : null) || order.restaurant || {};
  const restaurantName =
    order.restaurantId?.restaurantName ||
    order.restaurantId?.name ||
    order.restaurantName ||
    restaurantObj.restaurantName ||
    restaurantObj.name ||
    "Restaurant";

  const restaurantLocation = (() => {
    const loc = restaurantObj.location || {};
    if (restaurantObj.address) return restaurantObj.address;
    if (loc.formattedAddress) return loc.formattedAddress;
    if (loc.address) return loc.address;
    if (loc.street || loc.city) {
      const parts = [loc.street, loc.area, loc.city, loc.state, loc.zipCode || loc.pincode || loc.postalCode].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    if (loc.addressLine1) {
      const parts = [loc.addressLine1, loc.addressLine2, loc.city, loc.state].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    if (order.restaurantAddress) return order.restaurantAddress;
    return "Address not available";
  })();

  const items = Array.isArray(order.items) ? order.items : [];
  const pricing = order.pricing || {};
  const sendsCutlery = order.sendCutlery !== false;
  const userName = order.userName || "";
  const userPhone = order.userPhone || "";
  const paymentMethod = order.payment?.method || "Online";
  const paymentDate = order.createdAt ? dayjs(order.createdAt).format("D MMMM YYYY [at] h:mm a") : "";
  const addr = order.deliveryAddress || order.address || {};
  const addressText =
    addr.formattedAddress ||
    addr.address ||
    [addr.addressLine1, addr.addressLine2, addr.street, addr.area, addr.city, addr.state, addr.zipCode || addr.pincode || addr.postalCode]
      .filter(Boolean)
      .join(", ");
  const savings = (pricing.discount || 0) + (pricing.originalItemTotal || 0) - (pricing.subtotal || 0);
  const restaurantPhone = restaurantObj.primaryContactNumber || restaurantObj.phone || restaurantObj.contactNumber || order.restaurantPhone || "";
  const cancelled = isCancelledStatus(order.status);

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(String(order.orderId || order._id || orderId));
      toast.success("Order ID copied");
    } catch {
      toast.error("Failed to copy Order ID");
    }
  };

  const handleCallRestaurant = () => {
    if (!restaurantPhone) {
      toast.error("Restaurant phone number not available");
      return;
    }
    Linking.openURL(`tel:${restaurantPhone}`).catch(() => {});
  };

  const handleDownloadSummary = async () => {
    try {
      toast.info("Generating invoice...");
      let settings = {};
      try {
        settings = (await loadBusinessSettings()) || {};
      } catch {
        // generate without business settings
      }
      const html = buildSummaryInvoiceHtml({
        settings,
        companyName: settings.companyName || "CityFood",
        restaurantName,
        restaurantLocation,
        restaurantFssai: restaurantObj.fssaiNumber || restaurantObj.fssai || order.restaurantFssai,
        restaurantGstin: restaurantObj.gstNumber || restaurantObj.gstin || order.restaurantGstin,
        orderIdDisplay,
        paymentDate,
        paymentMethod,
        userName,
        addressText,
        items,
        pricing,
      });
      await sharePdf(html, `Invoice_${orderIdDisplay}_${Date.now()}.pdf`);
      toast.success("Invoice downloaded successfully!");
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  const handleReorder = () => {
    const target =
      restaurantObj.slug ||
      restaurantObj._id ||
      restaurantObj.restaurantId ||
      (typeof order?.restaurantId === "string" ? order.restaurantId : order?.restaurantId?._id);
    if (!target || !items.length) {
      toast.error("Order items or restaurant information not available");
      return;
    }
    const reorderItems = items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id;
        if (!itemId) return null;
        return {
          id: itemId,
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          originalPrice: Math.max(Number(item.price) || 0, Number(item.originalPrice) || 0),
          image: item.image || "",
          restaurant: restaurantName,
          restaurantId: restaurantObj._id || restaurantObj.restaurantId || order?.restaurantId,
          description: item.description || "",
          isVeg: item.isVeg === true || item.foodType === "Veg",
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
          reorderIndex: index,
        };
      })
      .filter(Boolean);
    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order");
      return;
    }
    replaceCart(reorderItems);
    toast.success("Items added to cart");
    router.push(`/restaurants/${target}`);
  };

  const handleComplaint = () => {
    const mongoId = order._id || orderId;
    if (!mongoId) {
      toast.error("Order ID not available. Please refresh the page.");
      return;
    }
    router.push(`/complaints/submit/${encodeURIComponent(String(mongoId))}`);
  };

  const headImage = items[0]?.image || restaurantObj.profileImage?.url || restaurantObj.profileImage || order.restaurantImage || PLACEHOLDER_IMAGE;
  const cardStyle = [styles.card, { backgroundColor: card, borderColor: cardBorder }];

  return (
    <Screen background={page}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: cardBorder }]}>
        <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4, borderRadius: 999 }}>
          <ArrowLeft size={24} color={isDark ? "#d1d5db" : "#374151"} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "600", color: t.title }}>Order Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        <View style={{ padding: 16, gap: 16 }}>
          <View style={[cardStyle, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <View style={{ backgroundColor: isDark ? "#1f2937" : "#f3f4f6", padding: 8, borderRadius: 8, alignSelf: "flex-start" }}>
              <ShoppingBag size={24} color={isDark ? "#9ca3af" : "#4b5563"} />
            </View>
            <View style={{ flex: 1, justifyContent: "center", minHeight: 40 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: t.title }}>
                {order.status === "delivered"
                  ? "Order was delivered"
                  : cancelled
                    ? "Order was cancelled"
                    : "Order status: " + (order.status || "Processing")}
              </Text>
              {cancelled ? (
                <View
                  style={[
                    styles.cancelBox,
                    { backgroundColor: isDark ? "rgba(127,29,29,0.1)" : "#fef2f2", borderColor: isDark ? "rgba(127,29,29,0.3)" : "#fee2e2" },
                  ]}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", marginBottom: 4, color: isDark ? "#f87171" : "#b91c1c" }}>Cancellation Reason:</Text>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? "#fca5a5" : "#dc2626" }}>
                    {order.cancellationReason || "The restaurant was unable to fulfill this order."}
                  </Text>
                  <Text style={{ fontSize: 10, marginTop: 8, color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Refund will be initiated to your source payment method.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={cardStyle}>
            <View style={[styles.between, { marginBottom: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <AppImage src={headImage} width={40} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: t.title }}>{restaurantName}</Text>
                  <Text style={{ fontSize: 12, color: t.sub }}>{restaurantLocation}</Text>
                </View>
              </View>
              <Pressable onPress={handleCallRestaurant} style={[styles.phoneBtn, { borderColor: colors.primary + "33" }]}>
                <Phone size={16} color={colors.primary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: 0.3, color: t.sub }}>ORDER ID: #{String(orderIdDisplay).toUpperCase()}</Text>
              <Pressable onPress={handleCopyOrderId} hitSlop={8}>
                <Copy size={12} color={isDark ? "#6b7280" : "#9ca3af"} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <View
                style={[
                  styles.chip,
                  sendsCutlery
                    ? { backgroundColor: isDark ? "rgba(6,78,59,0.2)" : "#ecfdf5", borderColor: isDark ? "#065f46" : "#a7f3d0" }
                    : { backgroundColor: isDark ? "rgba(124,45,18,0.2)" : "#fff7ed", borderColor: isDark ? "#9a3412" : "#fed7aa" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: sendsCutlery ? (isDark ? "#34d399" : "#047857") : isDark ? "#fb923c" : "#c2410c",
                  }}
                >
                  {sendsCutlery ? "Send cutlery" : "Don't send cutlery"}
                </Text>
              </View>
              {order.note ? (
                <View style={[styles.chip, { backgroundColor: isDark ? "rgba(30,58,138,0.2)" : "#eff6ff", borderColor: isDark ? "#1e40af" : "#bfdbfe" }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? "#60a5fa" : "#1d4ed8" }}>Note: {order.note}</Text>
                </View>
              ) : null}
            </View>

            <DashedLine color={isDark ? "#1f2937" : "#e5e7eb"} style={{ marginVertical: 12 }} />

            {items.map((item, idx) => {
              const discounted = Number(item.price) || 0;
              const original = Math.max(discounted, Number(item.originalPrice) || 0);
              const hasDiscount = original > discounted;
              const veg = item.isVeg === true || item.foodType === "Veg";
              return (
                <View key={idx} style={[styles.itemRow, idx > 0 && { marginTop: 16 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    {item.image ? (
                      <AppImage src={item.image} width={64} style={[styles.itemImage, { borderColor: isDark ? "#1f2937" : "#f3f4f6" }]} placeholderType="none" />
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <View style={[styles.vegBox, { borderColor: veg ? "#16a34a" : "#dc2626" }]}>
                        <View style={{ flex: 1, alignSelf: "stretch", borderRadius: 999, backgroundColor: veg ? "#16a34a" : "#dc2626" }} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: t.body }}>
                        {item.quantity || item.qty || 1} x {item.name}
                        {item.variantName ? ` (${item.variantName})` : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {hasDiscount ? (
                      <Text style={{ fontSize: 12, textDecorationLine: "line-through", color: isDark ? "#6b7280" : "#9ca3af" }}>
                        ₹{original.toFixed(2)}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 14, fontWeight: "500", color: hasDiscount ? "#16a34a" : t.value }}>₹{discounted.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[cardStyle, { padding: 0, overflow: "hidden" }]}>
            <View style={[styles.between, { padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <FileText size={20} color={isDark ? "#9ca3af" : "#4b5563"} />
                <Text style={{ fontSize: 16, fontWeight: "600", color: t.title }}>Bill Summary</Text>
              </View>
              <Pressable onPress={handleDownloadSummary} style={[styles.dlBtn, { backgroundColor: colors.primary + "1A" }]}>
                <Download size={16} color={colors.primary} />
              </Pressable>
            </View>
            <View style={{ padding: 16, gap: 8 }}>
              <View style={styles.between}>
                <Text style={{ fontSize: 14, color: t.sub }}>Item total</Text>
                <Text style={{ fontSize: 14 }}>
                  {pricing.originalItemTotal ? (
                    <Text style={{ fontSize: 14, textDecorationLine: "line-through", color: isDark ? "#6b7280" : "#9ca3af" }}>
                      ₹{Number(pricing.originalItemTotal).toFixed(2)}{" "}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 14, color: t.value }}>₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}</Text>
                </Text>
              </View>
              <View style={styles.between}>
                <Text style={{ fontSize: 14, color: t.sub }}>GST (govt. taxes)</Text>
                <Text style={{ fontSize: 14, color: t.value }}>₹{Number(pricing.tax || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.between}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? "#6b7280" : "#9ca3af" }}>Delivery fee</Text>
                {pricing.deliveryFee === 0 ? (
                  <View style={[styles.freeTag, { borderColor: colors.primary }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>FREE</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? "#a04882" : colors.primary }}>
                  {pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : "FREE"}
                </Text>
              </View>
              <View style={styles.between}>
                <Text style={{ fontSize: 14, color: t.sub }}>Platform fee</Text>
                <Text style={{ fontSize: 14, color: t.value }}>₹{Number(pricing.platformFee || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.between, styles.paidRow, { borderTopColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: t.title }}>Paid</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: t.title }}>₹{Number(pricing.total || 0).toFixed(2)}</Text>
              </View>
            </View>
            {savings > 0 ? (
              <View style={{ backgroundColor: colors.primary + "0D", padding: 12, paddingBottom: 16, marginTop: 8 }}>
                <View style={styles.wave}>
                  <Svg width="100%" height={8} viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <Path
                      d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z"
                      fill={card}
                    />
                  </Svg>
                </View>
                <Text style={{ paddingTop: 4, textAlign: "center", fontSize: 14, fontWeight: "700", color: colors.primary }}>
                  You saved ₹{Number(savings).toFixed(2)} on this order!
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[cardStyle, { gap: 20 }]}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: isDark ? "#1f2937" : "#e5e7eb" }]}>
                <User size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: t.value }}>{userName || "Customer"}</Text>
                <Text style={{ fontSize: 12, color: t.sub }}>{userPhone}</Text>
              </View>
            </View>
            {[
              [CreditCard, "Payment method", `Paid via: ${paymentMethod.toUpperCase()}`],
              [Calendar, "Payment date", paymentDate],
              [MapPin, "Delivery address", addressText || "Address not available"],
            ].map(([Icon, label, value]) => (
              <View key={label} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ marginTop: 2 }}>
                  <Icon size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: t.value }}>{label}</Text>
                  <Text style={{ fontSize: 12, marginTop: 2, lineHeight: 19, color: t.sub }}>{value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 16 }}>
          <Pressable
            onPress={handleComplaint}
            style={[styles.complaint, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "33" }]}
          >
            <FileText size={16} color={colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Restaurant Complaint</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: 16 + insets.bottom, backgroundColor: card, borderTopColor: isDark ? "#1f2937" : "#e5e7eb" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <ScalePressable scaleTo={0.95} onPress={handleReorder} style={[styles.barBtn, { backgroundColor: colors.primary }, shadow.md]}>
            <RotateCcw size={16} color="#ffffff" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>Reorder</Text>
          </ScalePressable>
        </View>
        <Pressable
          onPress={handleDownloadSummary}
          style={[styles.barBtn, { flex: 1, borderWidth: 1, borderColor: colors.primary, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}
        >
          <Download size={16} color={colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Invoice</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export default withProtected(UserOrderDetailsScreen);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  smallBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, ...shadow.md },
  header: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, zIndex: 20, ...shadow.sm },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, ...shadow.sm },
  cancelBox: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  thumb: { width: 40, height: 40, borderRadius: 8, overflow: "hidden" },
  phoneBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemImage: { width: 64, height: 64, borderRadius: 12, overflow: "hidden", borderWidth: 1, ...shadow.sm },
  vegBox: { width: 12, height: 12, borderWidth: 1, padding: 1, alignItems: "center", justifyContent: "center" },
  dlBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  freeTag: { borderWidth: 1, paddingHorizontal: 4, borderRadius: 4, marginLeft: 4 },
  paidRow: { borderTopWidth: 1, marginTop: 8, paddingTop: 8 },
  wave: { position: "absolute", top: -6, left: 0, right: 0, height: 8, overflow: "hidden" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  complaint: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    zIndex: 20,
  },
  barBtn: { paddingVertical: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
