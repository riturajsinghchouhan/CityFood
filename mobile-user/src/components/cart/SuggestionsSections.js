// "More items for you" (same-restaurant menu) and "Complete your meal with" (approved addons).
import { ChevronRight, Minus, Plus, Sparkles } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppImage, Skeleton, Text } from "../ui";
import { radius, shadow, tw } from "../../theme/tokens";
import { RUPEE } from "../../screens/cart/cartUtils";
import { useCartPalette } from "./palette";

const FALLBACK_300 = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop";
const FALLBACK_200 = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop";

function VegIcon({ isVeg }) {
  const color = isVeg ? tw.green600 : tw.red600;
  return (
    <View style={[styles.vegIcon, { borderColor: color }]}>
      <View style={[styles.vegIconDot, { backgroundColor: color }]} />
    </View>
  );
}

function MoreItemCard({ item, cartItem, onAdd, onUpdate, p }) {
  const isVeg = item.foodType === "Veg" || item.isVeg;
  const inCart = !!cartItem && cartItem.quantity > 0;
  return (
    <View
      style={[
        styles.moreCard,
        { borderColor: p.isDark ? tw.gray800 : tw.gray100, backgroundColor: p.isDark ? "#141414" : "rgba(249,250,251,0.6)" },
      ]}
    >
      <View>
        <View style={[styles.moreImage, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
          {item.image ? (
            <AppImage src={item.image} width={124} fallbackSrc={FALLBACK_300} style={StyleSheet.absoluteFill} placeholderType="none" />
          ) : (
            <View style={styles.noImage}>
              <Text style={{ fontSize: 12, color: tw.gray400 }}>No image</Text>
            </View>
          )}
          <View style={[styles.vegWrap, { backgroundColor: p.isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)" }]}>
            <VegIcon isVeg={isVeg} />
          </View>
          <View style={styles.addWrap}>
            {inCart ? (
              <View style={[styles.qtyPill, { borderColor: p.primary, backgroundColor: p.card }]}>
                <Pressable hitSlop={6} onPress={() => onUpdate(item, (cartItem?.quantity || 1) - 1)} style={styles.qtyBtn}>
                  <Minus size={12} strokeWidth={2.5} color={p.primary} />
                </Pressable>
                <Text style={[styles.qtyText, { color: p.primary }]}>{cartItem?.quantity || 1}</Text>
                <Pressable hitSlop={6} onPress={() => onUpdate(item, (cartItem?.quantity || 1) + 1)} style={styles.qtyBtn}>
                  <Plus size={12} strokeWidth={2.5} color={p.primary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel={`Add ${item.name} to cart`}
                onPress={() => onAdd(item)}
                style={[styles.addBtn, { borderColor: p.primary, backgroundColor: p.card }]}
              >
                <Plus size={16} strokeWidth={2.8} color={p.primary} />
              </Pressable>
            )}
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.moreName, { color: p.white900 }]}>
          {item.name}
        </Text>
        {item.description ? (
          <Text numberOfLines={1} style={[styles.moreDesc, { color: p.t500 }]}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.morePrice, { color: p.white900 }]}>
        {RUPEE}
        {item.price}
      </Text>
    </View>
  );
}

export function MoreItemsSection({ loading, items, cart, restaurantName, menuTarget, onSeeMenu, onAdd, onUpdate }) {
  const p = useCartPalette();
  if (!loading && items.length === 0) return null;
  const findCartItem = (item) => {
    const targetId = item.id || item._id;
    return cart.find((ci) => String(ci.id) === String(targetId) || String(ci.itemId) === String(targetId));
  };
  return (
    <View style={[p.cardStyle, { paddingVertical: 16 }]}>
      <View style={styles.moreHeader}>
        <View style={styles.moreTitleRow}>
          <View style={[styles.sparkCircle, { backgroundColor: p.primary + "1A" }]}>
            <Sparkles size={16} color={p.primary} />
          </View>
          <View>
            <Text style={[styles.moreTitle, { color: p.white900 }]}>More items for you</Text>
            <Text style={[styles.moreSub, { color: p.t500 }]}>From {restaurantName}</Text>
          </View>
        </View>
        {menuTarget ? (
          <Pressable onPress={onSeeMenu} style={styles.seeMenu}>
            <Text style={[styles.seeMenuText, { color: p.primary }]}>See menu</Text>
            <ChevronRight size={14} color={p.primary} />
          </Pressable>
        ) : null}
      </View>
      {loading ? (
        <View style={styles.hRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: 144 }}>
              <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: radius.xl }} />
              <Skeleton style={{ height: 14, marginTop: 8, width: "75%", borderRadius: 4 }} />
              <Skeleton style={{ height: 12, marginTop: 6, width: "50%", borderRadius: 4 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => String(item.id || item._id)}
          showsHorizontalScrollIndicator={false}
          style={styles.hList}
          contentContainerStyle={styles.hListContent}
          renderItem={({ item }) => (
            <MoreItemCard item={item} cartItem={findCartItem(item)} onAdd={onAdd} onUpdate={onUpdate} p={p} />
          )}
        />
      )}
    </View>
  );
}

export function AddonsSection({ loading, addons, onAdd }) {
  const p = useCartPalette();
  if (addons.length === 0) return null;
  return (
    <View style={[p.cardStyle, { paddingVertical: 20 }]}>
      <View style={styles.addonHeader}>
        <View style={[styles.addonIcon, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
          <Sparkles size={16} color={p.primary} />
        </View>
        <Text style={[styles.addonTitle, { color: p.t800 }]}>Complete your meal with</Text>
      </View>
      {loading ? (
        <View style={styles.hRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ width: 112 }}>
              <Skeleton style={{ width: "100%", height: 112, borderRadius: radius.md }} />
              <Skeleton style={{ height: 16, marginTop: 8, borderRadius: 4 }} />
              <Skeleton style={{ height: 12, marginTop: 4, width: "66%", borderRadius: 4 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={addons}
          keyExtractor={(addon, index) => String(addon.id || addon._id || index)}
          showsHorizontalScrollIndicator={false}
          style={styles.hList}
          contentContainerStyle={styles.hListContent}
          renderItem={({ item: addon }) => (
            <View style={{ width: 112 }}>
              <View style={[styles.addonImageWrap, { backgroundColor: p.isDark ? tw.gray800 : tw.gray100 }]}>
                <AppImage
                  src={addon.image || addon.images?.[0] || FALLBACK_200}
                  fallbackSrc={FALLBACK_200}
                  width={112}
                  style={styles.addonImage}
                  placeholderType="none"
                />
                <View style={styles.addonVeg}>
                  <View style={styles.addonVegDot} />
                </View>
                <Pressable onPress={() => onAdd(addon)} style={[styles.addonAdd, { borderColor: p.primary }]}>
                  <Plus size={14} color={p.primary} />
                </Pressable>
              </View>
              <Text numberOfLines={2} style={[styles.addonName, { color: p.t800 }]}>
                {addon.name}
              </Text>
              {addon.description ? (
                <Text numberOfLines={1} style={[styles.addonDesc, { color: p.t500 }]}>
                  {addon.description}
                </Text>
              ) : null}
              <Text style={[styles.addonPrice, { color: p.t800 }]}>
                {RUPEE}
                {addon.price}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moreHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  moreTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sparkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  moreTitle: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  moreSub: { fontSize: 11, marginTop: 2 },
  seeMenu: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeMenuText: { fontSize: 12, fontWeight: "600" },
  hRow: { flexDirection: "row", gap: 12, overflow: "hidden" },
  hList: { marginHorizontal: -16 },
  hListContent: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  moreCard: { width: 144, justifyContent: "space-between", borderRadius: radius.xl, padding: 10, borderWidth: 1 },
  moreImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", marginBottom: 8 },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  vegWrap: { position: "absolute", top: 6, left: 6, padding: 2, borderRadius: 4 },
  vegIcon: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegIconDot: { width: 6, height: 6, borderRadius: 3 },
  addWrap: { position: "absolute", bottom: 6, right: 6 },
  qtyPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    height: 28,
    gap: 4,
    ...shadow.md,
  },
  qtyBtn: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 12, fontWeight: "700", minWidth: 12, textAlign: "center" },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  moreName: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  moreDesc: { fontSize: 11, marginTop: 2 },
  morePrice: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  addonHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  addonIcon: { width: 24, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  addonTitle: { fontSize: 14, fontWeight: "600" },
  addonImageWrap: { borderRadius: radius.md, overflow: "hidden" },
  addonImage: { width: "100%", height: 112, borderRadius: radius.md },
  addonVeg: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 14,
    height: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.green600,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  addonVegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tw.green600 },
  addonAdd: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  addonName: { fontSize: 12, fontWeight: "500", marginTop: 6, lineHeight: 16 },
  addonDesc: { fontSize: 12, marginTop: 2 },
  addonPrice: { fontSize: 12, fontWeight: "600", marginTop: 2 },
});
