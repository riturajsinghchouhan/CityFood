// Bottom sheets and the share modal of RestaurantDetails.jsx.
import * as Clipboard from "expo-clipboard";
import { Bookmark, ChevronDown, Copy, Mail, MessageCircle, Minus, Percent, Plus, Send, Share2, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppImage, BottomSheet, Dialog, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import {
  calculateBestDiscount,
  getFoodVariants,
  hasFoodVariants,
  isRecommendedItem,
  RUPEE,
} from "../../screens/restaurant/lib";
import { DishImage } from "./DishCard";

function usePalette() {
  const { colors, isDark } = useTheme();
  return {
    colors,
    isDark,
    sheetBg: isDark ? "#1a1a1a" : "#ffffff",
    border: isDark ? tw.gray800 : tw.gray200,
    title: isDark ? "#ffffff" : tw.gray900,
    muted: isDark ? tw.gray400 : tw.gray500,
    optionBg: isDark ? "#2a2a2a" : "#ffffff",
    optionBorder: isDark ? tw.gray700 : tw.gray200,
  };
}

function PrimaryCloseButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.closeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
      <X size={16} color="#ffffff" />
      <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>Close</Text>
    </Pressable>
  );
}

// Category image (h-10 rounded-xl in the sheet, h-6 rounded-full on the chips). The web
// hides the <img> on error, and shows the first letter when there is no image.
export function CategoryThumb({ category, size, radius, borderColor = tw.gray200 }) {
  const [failed, setFailed] = useState(false);
  if (category.image) {
    if (failed) return null;
    return (
      <AppImage
        src={category.image}
        width={size}
        placeholderType="none"
        onError={() => setFailed(true)}
        style={{ height: size, width: size, borderRadius: radius, borderWidth: 1, borderColor }}
      />
    );
  }
  return (
    <View style={[styles.center, { height: size, width: size, borderRadius: radius, backgroundColor: tw.gray100 }]}>
      <Text style={{ fontSize: size > 30 ? 14 : 10, fontWeight: "700", color: tw.gray500, textTransform: "uppercase" }}>
        {category.name?.charAt(0) || "C"}
      </Text>
    </View>
  );
}


export function MenuCategoriesSheet({ visible, onClose, categories, onSelect }) {
  const p = usePalette();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="85%" style={{ backgroundColor: p.sheetBg }}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, gap: 4 }}>
        {categories.map((category, index) => (
          <Pressable
            key={`${category.id}-${index}`}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: p.isDark ? tw.gray800 : tw.gray50 }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <CategoryThumb category={category} size={40} radius={12} />
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: p.title, flexShrink: 1 }}>
                {category.name}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: p.muted }}>{category.count}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: p.border, backgroundColor: p.sheetBg }]}>
        <PrimaryCloseButton onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

export function FilterSheet({ visible, onClose, filters, setFilters, vegMode, vegModeOption, activeFilterCount }) {
  const p = usePalette();
  const sortOption = (value, label) => {
    const active = filters.sortBy === value;
    return (
      <Pressable
        onPress={() => setFilters((prev) => ({ ...prev, sortBy: prev.sortBy === value ? null : value }))}
        style={[
          styles.option,
          active
            ? { borderColor: p.isDark ? "#60a5fa" : "#3b82f6", backgroundColor: p.isDark ? "rgba(30,58,138,0.3)" : tw.blue50 }
            : { borderColor: p.optionBorder, backgroundColor: p.optionBg },
        ]}
      >
        <Text style={{ color: active ? (p.isDark ? "#60a5fa" : "#1d4ed8") : p.isDark ? tw.gray300 : tw.gray700 }}>{label}</Text>
      </Pressable>
    );
  };
  const vegOption = (value) => {
    const isVeg = value === "veg";
    const active = filters.vegNonVeg === value;
    const activeStyle = isVeg
      ? { borderColor: p.isDark ? tw.green500 : tw.green600, backgroundColor: p.isDark ? "rgba(20,83,45,0.3)" : tw.green50 }
      : { borderColor: tw.red600, backgroundColor: p.isDark ? "rgba(127,29,29,0.3)" : tw.red50 };
    const activeText = isVeg ? (p.isDark ? "#4ade80" : tw.green700) : p.isDark ? tw.gray300 : tw.red600;
    return (
      <Pressable
        onPress={() => setFilters((prev) => ({ ...prev, vegNonVeg: prev.vegNonVeg === value ? null : value }))}
        style={[
          styles.option,
          { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
          active ? activeStyle : { borderColor: p.optionBorder, backgroundColor: p.optionBg },
        ]}
      >
        <View style={{ height: 16, width: 16, borderRadius: 999, backgroundColor: isVeg ? (p.isDark ? tw.green500 : tw.green600) : tw.red600 }} />
        <Text style={{ fontWeight: "500", color: active ? activeText : p.isDark ? tw.gray300 : tw.gray700 }}>{isVeg ? "Veg" : "Non-veg"}</Text>
      </Pressable>
    );
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="80%" style={{ backgroundColor: p.sheetBg }}>
      <View style={[styles.filterHeader, { borderBottomColor: p.border }]}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: p.title }}>Filters and Sorting</Text>
        <Pressable onPress={onClose} hitSlop={6} style={{ padding: 8, borderRadius: 999 }}>
          <X size={20} color={p.isDark ? tw.gray400 : tw.gray600} />
        </Pressable>
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupTitle, { color: p.title }]}>Sort by:</Text>
          <View style={{ gap: 6 }}>
            {sortOption("low-to-high", "Price - low to high")}
            {sortOption("high-to-low", "Price - high to low")}
          </View>
        </View>
        {vegModeOption !== "pure-veg" ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.groupTitle, { color: p.title }]}>Veg/Non-veg preference:</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {vegOption("veg")}
              {!vegMode ? vegOption("non-veg") : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.filterFooter, { borderTopColor: p.border, backgroundColor: p.sheetBg }]}>
        <Pressable
          onPress={() => setFilters({ sortBy: null, vegNonVeg: null, highlyReordered: false, spicy: false })}
          hitSlop={6}
        >
          <Text style={{ fontSize: 14, fontWeight: "500", color: p.isDark ? "#f87171" : tw.red600 }}>Clear All</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.applyBtn, { backgroundColor: p.colors.primary, opacity: pressed ? 0.9 : 1 }]}>
          <Text style={{ color: "#ffffff", fontWeight: "700" }}>
            Apply {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export function ItemDetailSheet({
  visible,
  onClose,
  item,
  restaurant,
  selectedVariantId,
  onSelectVariant,
  quantity,
  disabled,
  isFavorite,
  onBookmark,
  onDecrement,
  onIncrement,
  onAddItem,
}) {
  const p = usePalette();
  if (!item) return null;
  const variants = getFoodVariants(item);
  const withVariants = hasFoodVariants(item);
  const variant = variants.find((v) => String(v.id) === String(selectedVariantId || "")) || variants[0] || null;
  const basePrice = withVariants ? variant?.price || item.price : item.price;
  const priceNum = Number(basePrice) || 0;
  const { discountAmount } = calculateBestDiscount(restaurant, item, priceNum);
  const discounted = Math.max(0, priceNum - discountAmount);
  const variantPrefix = withVariants ? `${variant?.name || "Default"} · ` : "";
  const isVeg = item.foodType === "Veg";

  let priceNode;
  if (discountAmount > 0) {
    priceNode = (
      <>
        <Text style={styles.strike}>
          {RUPEE}
          {Math.round(priceNum)}
        </Text>
        <Text style={styles.addPrice}>
          {variantPrefix}
          {RUPEE}
          {Math.round(discounted)}
        </Text>
      </>
    );
  } else if (item.originalPrice && item.originalPrice > basePrice) {
    priceNode = (
      <>
        <Text style={styles.strike}>
          {RUPEE}
          {Math.round(item.originalPrice)}
        </Text>
        <Text style={styles.addPrice}>
          {variantPrefix}
          {RUPEE}
          {Math.round(basePrice)}
        </Text>
      </>
    );
  } else {
    priceNode = (
      <Text style={styles.addPrice}>
        {variantPrefix}
        {RUPEE}
        {Math.round(basePrice)}
      </Text>
    );
  }

  const roundBtn = {
    borderColor: isFavorite ? (p.isDark ? "#f87171" : tw.red500) : p.isDark ? tw.gray800 : "#ffffff",
    backgroundColor: isFavorite ? (p.isDark ? "rgba(127,29,29,0.3)" : tw.red50) : p.isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)",
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="90%" style={{ backgroundColor: p.sheetBg, overflow: "visible" }}>
      <View style={styles.floatingCloseWrap} pointerEvents="box-none">
        <Pressable onPress={onClose} style={styles.floatingClose}>
          <X size={20} color="#ffffff" />
        </Pressable>
      </View>
      <View style={[styles.detailImage, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
        {item.image ? (
          <DishImage src={item.image} width={400} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={[styles.center, { flex: 1 }]}>
            <Text style={{ fontSize: 14, color: tw.gray400 }}>No image available</Text>
          </View>
        )}
        <View style={styles.imageActions}>
          <Pressable onPress={onBookmark} style={[styles.roundBtn, roundBtn]}>
            <Bookmark
              size={20}
              color={isFavorite ? (p.isDark ? "#f87171" : tw.red500) : p.isDark ? tw.gray300 : tw.gray600}
              fill={isFavorite ? (p.isDark ? "#f87171" : tw.red500) : "transparent"}
            />
          </Pressable>
          {/* The web share button here has no handler. */}
          <Pressable
            style={[
              styles.roundBtn,
              { borderColor: p.isDark ? tw.gray800 : "#ffffff", backgroundColor: p.isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)" },
            ]}
          >
            <Share2 size={20} color={p.isDark ? tw.gray300 : tw.gray600} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View
            style={[
              styles.vegBox,
              p.isDark
                ? { borderColor: tw.gray600, backgroundColor: "rgba(17,24,39,0.3)" }
                : { borderColor: isVeg ? tw.green600 : tw.red600, backgroundColor: isVeg ? tw.green50 : tw.red50 },
            ]}
          >
            <View style={{ height: 10, width: 10, borderRadius: 999, backgroundColor: isVeg ? tw.green600 : tw.red600 }} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: p.title, flex: 1 }}>{item.name}</Text>
        </View>
        <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 16, color: p.isDark ? tw.gray400 : tw.gray600 }}>{item.description}</Text>
        {isRecommendedItem(item) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 2, borderRadius: 999, overflow: "hidden", backgroundColor: p.isDark ? tw.gray700 : tw.gray200 }}>
              <View style={{ height: "100%", width: "50%", borderRadius: 999, backgroundColor: p.isDark ? "#4ade80" : tw.green500 }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "500", color: p.isDark ? tw.gray400 : tw.gray600 }}>highly reordered</Text>
          </View>
        ) : null}
        {item.notEligibleForCoupons ? (
          <Text style={{ fontSize: 12, fontWeight: "500", marginBottom: 16, color: p.muted }}>NOT ELIGIBLE FOR COUPONS</Text>
        ) : null}
        {withVariants ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8, color: p.title }}>Choose a variant</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {variants.map((v) => {
                const active = String(selectedVariantId || "") === String(v.id);
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => onSelectVariant(v.id)}
                    style={[
                      styles.variantChip,
                      active
                        ? { borderColor: p.isDark ? "#f87171" : tw.red500, backgroundColor: p.isDark ? "rgba(127,29,29,0.3)" : tw.red50 }
                        : { borderColor: p.isDark ? tw.gray700 : tw.gray200, backgroundColor: p.isDark ? "#2a2a2a" : "#ffffff" },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: active ? (p.isDark ? "#fecaca" : tw.red600) : p.isDark ? tw.gray300 : tw.gray700,
                      }}
                    >
                      {v.name} · {RUPEE}
                      {Math.round(v.price)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.detailFooter, { borderTopColor: p.border, backgroundColor: p.sheetBg }]}>
        <View
          style={[
            styles.qtyBox,
            { borderColor: p.isDark ? tw.gray700 : tw.gray300, backgroundColor: p.isDark ? "#2a2a2a" : "#ffffff", opacity: disabled ? 0.5 : 1 },
          ]}
        >
          <Pressable disabled={quantity === 0 || disabled} hitSlop={8} onPress={onDecrement}>
            <Minus
              size={20}
              color={quantity === 0 || disabled ? (p.isDark ? tw.gray600 : tw.gray300) : p.isDark ? tw.gray400 : tw.gray600}
            />
          </Pressable>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              minWidth: 32,
              textAlign: "center",
              color: disabled ? (p.isDark ? tw.gray600 : tw.gray400) : p.title,
            }}
          >
            {quantity}
          </Text>
          <Pressable disabled={disabled} hitSlop={8} onPress={onIncrement}>
            <Plus size={20} color={disabled ? (p.isDark ? tw.gray600 : tw.gray300) : p.isDark ? tw.gray400 : tw.gray600} />
          </Pressable>
        </View>
        <Pressable
          disabled={disabled}
          onPress={onAddItem}
          style={({ pressed }) => [
            styles.addItemBtn,
            disabled
              ? { backgroundColor: p.isDark ? tw.gray700 : tw.gray300, opacity: 0.5 }
              : { backgroundColor: p.colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={{ color: disabled ? (p.isDark ? tw.gray600 : tw.gray500) : "#ffffff", fontWeight: "600" }}>Add item</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{priceNode}</View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export function OffersSheet({ visible, onClose, restaurant }) {
  const p = usePalette();
  const [expanded, setExpanded] = useState(() => new Set());
  const coupons = Array.isArray(restaurant?.restaurantOffers?.coupons) ? restaurant.restaurantOffers.coupons : [];
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="85%" style={{ backgroundColor: p.sheetBg }}>
      <View style={[styles.sheetHeader, { borderBottomColor: p.border }]}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: p.title }}>Offers at {restaurant?.name || "Unknown Restaurant"}</Text>
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16 }}>
        {coupons.length > 0 ? (
          <View>
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 12, color: p.title }}>Restaurant coupons</Text>
            <View style={{ gap: 12 }}>
              {coupons.map((coupon, index) => {
                const key = coupon?.id || coupon?.code || `coupon-${index}`;
                const isOpen = expanded.has(key);
                return (
                  <View key={key} style={[styles.coupon, { borderColor: p.isDark ? tw.gray700 : tw.gray200 }]}>
                    <Pressable
                      onPress={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      style={styles.couponRow}
                    >
                      <Percent size={20} color={p.isDark ? "#60a5fa" : tw.blue600} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", marginBottom: 4, color: p.title }}>{coupon?.title || "Restaurant coupon"}</Text>
                        <Text style={{ fontSize: 12, color: p.muted }}>Use code {coupon?.code || "N/A"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            if (coupon?.code) Clipboard.setStringAsync(String(coupon.code)).catch(() => {});
                          }}
                          style={[styles.codeBtn, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "500", color: p.isDark ? tw.gray300 : tw.gray700 }}>{coupon?.code || "Copy"}</Text>
                        </Pressable>
                        <ChevronDown size={16} color={p.muted} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
                      </View>
                    </Pressable>
                    {isOpen ? (
                      <View style={[styles.couponTerms, { borderTopColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
                        <Text style={{ fontSize: 12, color: p.isDark ? tw.gray400 : tw.gray600 }}>Terms and conditions apply</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: p.border, backgroundColor: p.sheetBg }]}>
        <PrimaryCloseButton onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

export function MenuOptionsSheet({ visible, onClose, restaurant, isFavorite, onToggleCollection, onShare }) {
  const p = usePalette();
  const fssai = restaurant?.onboarding?.step3?.fssai?.registrationNumber;
  const row = (Icon, label, onPress) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.optionRow, pressed && { backgroundColor: p.isDark ? tw.gray800 : tw.gray50 }]}>
      <Icon size={20} color={p.isDark ? tw.gray300 : tw.gray700} />
      <Text style={{ fontSize: 16, color: p.title }}>{label}</Text>
    </Pressable>
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="70%" style={{ backgroundColor: p.sheetBg }}>
      <View style={[styles.sheetHeader, { borderBottomColor: p.border }]}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: p.title }}>{restaurant?.name || "Unknown Restaurant"}</Text>
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16 }}>
        <View style={{ gap: 4 }}>
          {row(Bookmark, isFavorite ? "Remove from Collection" : "Add to Collection", onToggleCollection)}
          {row(Share2, "Share this restaurant", onShare)}
        </View>
        <View style={{ marginTop: 24, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 12, lineHeight: 20, color: tw.gray500 }}>
            Menu items, prices, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.
          </Text>
        </View>
        {fssai ? (
          <View style={[styles.fssaiRow, { borderTopColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
            {/* fssai.png is unrecoverable: keep its box empty. */}
            <View style={styles.fssaiSmallBox} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "500", letterSpacing: 0.25, textTransform: "uppercase", color: p.muted }}>Lic. No.</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: p.isDark ? tw.gray300 : tw.gray700 }}>{fssai}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" }}>
        <View style={{ height: 4, width: 48, borderRadius: 999, backgroundColor: tw.gray300 }} />
      </View>
    </BottomSheet>
  );
}

export function ShareModal({ visible, onClose, onSystemShare, onTarget, onCopy }) {
  const p = usePalette();
  const row = (Icon, label, onPress) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shareRow,
        { borderColor: p.isDark ? tw.gray700 : tw.gray200 },
        pressed && { backgroundColor: p.isDark ? tw.gray800 : tw.gray50 },
      ]}
    >
      <Icon size={20} color={p.isDark ? tw.gray300 : tw.gray700} />
      <Text style={{ fontSize: 14, fontWeight: "500", color: p.title }}>{label}</Text>
    </Pressable>
  );
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      style={{ padding: 0, borderRadius: 16, borderWidth: 0, maxWidth: 448, width: "100%", backgroundColor: p.sheetBg, boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)" }}
    >
      <View style={[styles.shareHeader, { borderBottomColor: p.border }]}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: p.title }}>Share</Text>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
          <X size={16} color={p.isDark ? tw.gray300 : tw.gray600} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}>
        {row(Share2, "Share via system apps", onSystemShare)}
        {row(MessageCircle, "WhatsApp", () => onTarget("whatsapp"))}
        {row(Send, "Telegram", () => onTarget("telegram"))}
        {row(Mail, "Email", () => onTarget("email"))}
        {row(Copy, "Copy link", onCopy)}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  closeBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16 },
  catRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1 },
  groupTitle: { fontSize: 14, fontWeight: "600" },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 2 },
  filterFooter: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applyBtn: { paddingHorizontal: 24, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  floatingCloseWrap: { position: "absolute", top: -44, left: 0, right: 0, alignItems: "center", zIndex: 20 },
  floatingClose: {
    height: 40,
    width: 40,
    borderRadius: 999,
    backgroundColor: tw.gray800,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  detailImage: { height: 256, width: "100%", overflow: "hidden", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  imageActions: { position: "absolute", bottom: 16, right: 16, flexDirection: "row", gap: 12 },
  roundBtn: { height: 40, width: 40, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegBox: { height: 20, width: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  variantChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  detailFooter: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, height: 44 },
  addItemBtn: { flex: 1, height: 44, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  strike: { fontSize: 14, color: "#fecaca", textDecorationLine: "line-through" },
  addPrice: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  sheetHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1 },
  coupon: { borderWidth: 1, borderRadius: 8, overflow: "hidden", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  couponRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  codeBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  couponTerms: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 8, paddingVertical: 12, borderRadius: 8 },
  fssaiRow: { marginTop: 16, marginBottom: 8, paddingHorizontal: 8, paddingTop: 16, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.8 },
  fssaiSmallBox: { height: 32, width: 56, backgroundColor: "#ffffff", borderRadius: 4, borderWidth: 1, borderColor: tw.gray100 },
  shareHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
});
