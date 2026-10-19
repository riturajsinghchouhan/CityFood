// Under250.jsx bottom sheets: Sort By, item detail (image, bookmark/share, quantity, Add item)
// and the "Share dish" options fallback.
import { Bookmark, Minus, Plus, Share2, X } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppImage, BottomSheet, Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";
import { shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/browse/lib";

function Handle() {
  return (
    <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
      <View style={{ width: 48, height: 4, borderRadius: 999, backgroundColor: tw.gray300 }} />
    </View>
  );
}

export const UNDER250_SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "delivery-time-low", label: "Estimated Time: Low to High" },
  { id: "distance-low", label: "Distance: Low to High" },
];

export function SortSheet({ visible, onClose, draft, setDraft, onClearAll, onApply }) {
  const { colors, isDark } = useTheme();
  const accent = isDark ? "#b18da5" : colors.primary;
  const border = isDark ? tw.gray800 : tw.gray200;
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="60%" style={{ backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}>
      <Handle />
      <View style={[styles.sheetHeader, { borderBottomColor: border }]}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900 }}>Sort By</Text>
        <Pressable onPress={onClearAll} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: accent }}>Clear all</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}>
        {UNDER250_SORT_OPTIONS.map((option) => {
          const active = draft === option.id;
          return (
            <Pressable
              key={option.id || "relevance"}
              onPress={() => setDraft(option.id)}
              style={[
                styles.optionBtn,
                active
                  ? { borderColor: colors.primary, backgroundColor: isDark ? colors.primary + "33" : "#fdfafc" }
                  : { borderColor: border },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: active ? accent : isDark ? tw.gray300 : tw.gray700 }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: border, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
        <Pressable onPress={onClose} style={styles.footerBtn}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? tw.gray300 : tw.gray700 }}>Close</Text>
        </Pressable>
        <Pressable onPress={onApply} style={[styles.footerBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>Apply</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export function ItemDetailSheet({
  visible,
  item,
  onClose,
  bookmarked,
  onToggleBookmark,
  onShare,
  quantity,
  setQuantity,
  disabled,
  priceInfo,
  onAdd,
  addButtonRef,
}) {
  const { colors, isDark } = useTheme();
  const scrollYRef = useRef(0);
  const gestureRef = useRef({ startY: 0, dragging: false });
  if (!item) return null;

  const onTouchStart = (e) => {
    gestureRef.current = { startY: e.nativeEvent.pageY || 0, dragging: true };
  };
  const onTouchEnd = (e) => {
    if (!gestureRef.current.dragging) return;
    const deltaY = (e.nativeEvent.pageY || 0) - gestureRef.current.startY;
    gestureRef.current.dragging = false;
    if (scrollYRef.current <= 0 && deltaY > 80) onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      style={{ overflow: "visible", backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}
    >
      <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ flexShrink: 1 }}>
        <View style={styles.closeWrap}>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? tw.gray700 : tw.gray800 }]}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.imageWrap}>
          <AppImage src={item.image} width={400} priority style={StyleSheet.absoluteFill} />
          <View style={styles.imageActions}>
            <Pressable
              onPress={onToggleBookmark}
              style={[
                styles.roundAction,
                bookmarked
                  ? { borderColor: tw.red500, backgroundColor: tw.red50 }
                  : { borderColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.9)" },
              ]}
            >
              <Bookmark size={20} color={bookmarked ? tw.red500 : tw.gray600} fill={bookmarked ? tw.red500 : "transparent"} />
            </Pressable>
            <Pressable onPress={onShare} style={[styles.roundAction, { borderColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.9)" }]}>
              <Share2 size={20} color={tw.gray600} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {item.isVeg ? (
              <View style={[styles.vegLarge, { borderColor: isDark ? tw.green500 : tw.green600, backgroundColor: isDark ? "rgba(20,83,45,0.2)" : tw.green50 }]}>
                <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: isDark ? tw.green500 : tw.green600 }} />
              </View>
            ) : null}
            <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: isDark ? "#ffffff" : tw.gray900 }}>{item.name}</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 22, color: isDark ? tw.gray400 : tw.gray600, marginBottom: 16 }}>
            {item.description || `${item.name} from ${item.restaurant || "Under 250"}`}
          </Text>
          {item.customisable ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1, height: 2, borderRadius: 999, backgroundColor: tw.gray200, overflow: "hidden" }}>
                <View style={{ height: "100%", width: "50%", backgroundColor: colors.primary }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray600 }}>highly reordered</Text>
            </View>
          ) : null}
          {item.notEligibleForCoupons ? (
            <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray500, marginBottom: 16 }}>
              NOT ELIGIBLE FOR COUPONS
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.actionBar, { borderTopColor: isDark ? tw.gray800 : tw.gray200, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
          <View style={[styles.qtyBox, { borderColor: isDark ? tw.gray700 : tw.gray300, opacity: disabled ? 0.5 : 1 }]}>
            <Pressable
              disabled={quantity <= 1 || disabled}
              onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}
              hitSlop={6}
            >
              <Minus size={20} color={quantity <= 1 || disabled ? (isDark ? tw.gray600 : tw.gray300) : isDark ? tw.gray400 : tw.gray600} />
            </Pressable>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                minWidth: 32,
                textAlign: "center",
                color: disabled ? (isDark ? tw.gray600 : tw.gray400) : isDark ? "#ffffff" : tw.gray900,
              }}
            >
              {quantity}
            </Text>
            <Pressable disabled={disabled} onPress={() => setQuantity((prev) => prev + 1)} hitSlop={6}>
              <Plus size={20} color={disabled ? (isDark ? tw.gray600 : tw.gray300) : isDark ? tw.gray400 : tw.gray600} />
            </Pressable>
          </View>
          <Pressable
            ref={addButtonRef}
            disabled={disabled}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addItemBtn,
              disabled
                ? { backgroundColor: isDark ? tw.gray700 : tw.gray300, opacity: 0.5 }
                : { backgroundColor: pressed ? colors.secondary : colors.primary },
            ]}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: disabled ? (isDark ? tw.gray600 : tw.gray500) : "#ffffff" }}>Add item</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {priceInfo.strike != null ? (
                <Text style={{ fontSize: 14, color: "#fecaca", textDecorationLine: "line-through" }}>
                  {RUPEE}
                  {priceInfo.strike}
                </Text>
              ) : null}
              <Text style={{ fontSize: 16, fontWeight: "700", color: disabled ? (isDark ? tw.gray600 : tw.gray500) : "#ffffff" }}>
                {RUPEE}
                {priceInfo.price}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const SHARE_OPTIONS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "copy", label: "Copy Link" },
];

export function ShareOptionsSheet({ visible, onClose, onSelect }) {
  const { isDark } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} style={{ backgroundColor: isDark ? "#1a1a1a" : "#ffffff", paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ alignItems: "center", paddingBottom: 12 }}>
        <View style={{ width: 48, height: 4, borderRadius: 999, backgroundColor: tw.gray300 }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: isDark ? "#ffffff" : tw.gray900 }}>Share dish</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? tw.gray400 : tw.gray500 }}>Close</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {SHARE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.shareBtn, { borderColor: isDark ? tw.gray700 : tw.gray200 }]}
          >
            <Text style={{ fontSize: 14, fontWeight: "500", color: isDark ? tw.gray200 : tw.gray800 }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1 },
  footerBtn: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  closeWrap: { position: "absolute", top: -44, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  closeBtn: { height: 40, width: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", ...shadow.lg },
  imageWrap: { width: "100%", height: 256, overflow: "hidden", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  imageActions: { position: "absolute", bottom: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  roundAction: { height: 40, width: 40, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegLarge: { height: 20, width: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  actionBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, height: 44 },
  addItemBtn: { flex: 1, height: 44, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareBtn: { width: "47.5%", flexGrow: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
});
