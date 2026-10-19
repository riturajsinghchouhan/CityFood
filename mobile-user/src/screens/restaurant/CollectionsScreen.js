// Port of Frontend/src/modules/Food/pages/user/Collections.jsx (local state only, as on web).
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Plus, Share2, Store, UtensilsCrossed, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Svg, { Defs, Pattern, Polygon, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dialog, Screen, Text, inputFont } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

// Web gradient classes. Two of them use an invalid "to-#55254b" class, so they fade to transparent.
const GRADIENTS = [
  ["#ff6467", "#dc2626"],
  ["#ff8904", "rgba(251,146,60,0)"],
  ["#ad46ff", "#e60076"],
  ["#05df72", "#009966"],
  ["#ff8904", "#fb2c36"],
  ["#ffb900", "#d08700"],
  ["#fb64b6", "#ec003f"],
  ["#ffb900", "rgba(251,191,36,0)"],
];

function Illustration() {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingBottom: 40 }]} pointerEvents="none">
      <View style={{ width: 128, height: 96 }}>
        <View style={[styles.miniCard, { left: 0, top: 8, transform: [{ rotate: "-12deg" }] }]}>
          <View style={styles.miniInner}>
            <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: "#ffb900", alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={16} color="#ffffff" />
            </View>
          </View>
          <Svg width={10} height={14} style={{ position: "absolute", top: -4, right: 8 }}>
            <Polygon points="0,0 10,0 10,9.8 5,14 0,9.8" fill={tw.red500} />
          </Svg>
        </View>
        <View style={[styles.miniCard, { right: 0, top: 0, transform: [{ rotate: "12deg" }] }]}>
          <View style={styles.miniInner}>
            <Store size={24} color={colors.primary} />
          </View>
          <Svg width="100%" height={8} style={{ position: "absolute", top: -2, left: 0, right: 0 }}>
            <Defs>
              <Pattern id="awning" width={8} height={8} patternUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={4} height={8} fill="#ff8904" />
                <Rect x={4} y={0} width={4} height={8} fill="#ffffff" />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width="100%" height={8} fill="url(#awning)" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

export default function CollectionsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("delivery");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deliveryCollections, setDeliveryCollections] = useState([{ id: "bookmarks", name: "Bookmarks", dishes: 0, restaurants: 0, isDefault: true }]);
  const [diningCollections, setDiningCollections] = useState([{ id: "bookmarks", name: "Bookmarks", dishes: 0, restaurants: 0, isDefault: true }]);
  const current = activeTab === "delivery" ? deliveryCollections : diningCollections;
  const setCurrent = activeTab === "delivery" ? setDeliveryCollections : setDiningCollections;
  const cardWidth = (width - 32 - 16) / 2;

  const closeCreate = () => {
    setIsCreateOpen(false);
    setNewName("");
  };
  const handleCreate = () => {
    if (!newName.trim()) return;
    setCurrent((prev) => [...prev, { id: `collection-${Date.now()}`, name: newName.trim(), dishes: 0, restaurants: 0, isDefault: false }]);
    setNewName("");
    setIsCreateOpen(false);
  };

  const tab = (key, label) => {
    const active = activeTab === key;
    return (
      <Pressable onPress={() => setActiveTab(key)} style={{ flex: 1, paddingVertical: 16, alignItems: "center" }}>
        <Text style={{ fontWeight: "600", fontSize: 16, color: active ? (isDark ? tw.gray100 : tw.gray900) : isDark ? tw.gray500 : tw.gray400 }}>{label}</Text>
        {active ? <View style={[styles.tabBar, { backgroundColor: colors.primary }]} /> : null}
      </Pressable>
    );
  };

  return (
    <Screen background={isDark ? "#0a0a0a" : "#ffffff"} edges={[]}>
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* collectionspagebanner.png is unrecoverable: the banner area keeps its size and background. */}
        <LinearGradient colors={["#fffbeb", "#ffffff"]} style={{ width: "100%", height: Math.max(height * 0.25, insets.top + 64) }} />

        <View style={[styles.tabs, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderBottomColor: isDark ? tw.gray800 : tw.gray200 }]}>
          {tab("delivery", "Delivery")}
          {tab("dining", "Dining")}
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 24, flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {current.map((collection, index) => (
            <Pressable
              key={collection.id}
              style={{ width: cardWidth }}
              onPress={() => router.push(collection.isDefault ? "/profile/favorites" : `/collections/${collection.id}`)}
            >
              <LinearGradient colors={GRADIENTS[index % GRADIENTS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.collectionCard}>
                <Illustration />
                {/* The web share button only stops the link; it does nothing else. */}
                <Pressable hitSlop={6} style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                  <Share2 size={20} color="rgba(255,255,255,0.8)" />
                </Pressable>
                <View style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                  <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 18, marginBottom: 4 }}>{collection.name}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                    {collection.dishes} dish | {collection.restaurants} restaurant
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setIsCreateOpen(true)}
            style={({ pressed }) => [
              styles.createCard,
              {
                width: cardWidth,
                borderColor: isDark ? tw.gray700 : tw.gray200,
                backgroundColor: pressed ? (isDark ? tw.gray800 : tw.gray50) : isDark ? "#1a1a1a" : "#ffffff",
              },
            ]}
          >
            <View style={[styles.plusCircle, { backgroundColor: isDark ? colors.primary + "33" : "#F9F9FB", borderColor: colors.primary + (isDark ? "66" : "4D") }]}>
              <Plus size={24} color={colors.primary} />
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontWeight: "600", fontSize: 16, color: isDark ? tw.gray300 : tw.gray700 }}>Create a new</Text>
              <Text style={{ fontWeight: "600", fontSize: 16, color: isDark ? tw.gray300 : tw.gray700 }}>Collection</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable onPress={goBack} style={[styles.back, { top: insets.top + 16 }]}>
        <ArrowLeft size={20} color="#ffffff" />
      </Pressable>

      <Dialog
        visible={isCreateOpen}
        onClose={closeCreate}
        style={{ padding: 0, borderWidth: 0, borderRadius: 16, overflow: "hidden", width: "90%", maxWidth: 384, backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}
      >
        <View style={[styles.modalHeader, { borderBottomColor: isDark ? tw.gray800 : tw.gray200 }]}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? tw.gray100 : tw.gray900 }}>Create New Collection</Text>
          <Pressable onPress={closeCreate} style={styles.modalClose}>
            <X size={20} color={isDark ? tw.gray400 : tw.gray500} />
          </Pressable>
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          <Text style={{ fontSize: 14, color: isDark ? tw.gray400 : tw.gray500 }}>Give your collection a unique name</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g., Weekend Favorites"
            placeholderTextColor={isDark ? tw.gray400 : tw.gray500}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => newName.trim() && handleCreate()}
            selectionColor={colors.primary}
            style={[
              styles.input,
              inputFont,
              { borderColor: isDark ? tw.gray700 : tw.gray200, backgroundColor: isDark ? "#2a2a2a" : "#ffffff", color: isDark ? "#ffffff" : tw.gray900 },
            ]}
          />
          {newName.trim() ? (
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? tw.gray800 : tw.gray50 }}>
              <Text style={{ fontSize: 12, marginBottom: 4, color: isDark ? tw.gray500 : tw.gray400 }}>Preview</Text>
              <Text style={{ fontWeight: "600", color: isDark ? tw.gray200 : tw.gray800 }}>{newName.trim()}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 12, padding: 16, backgroundColor: isDark ? tw.gray800 : tw.gray50 }}>
          <Pressable
            onPress={closeCreate}
            style={[styles.modalBtn, { borderWidth: 1, borderColor: isDark ? tw.gray700 : tw.gray200, backgroundColor: isDark ? "rgba(39,39,42,0.3)" : "#ffffff" }]}
          >
            <Text style={{ fontWeight: "600", color: isDark ? tw.gray300 : tw.gray700 }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleCreate}
            disabled={!newName.trim()}
            style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: newName.trim() ? 1 : 0.5 }]}
          >
            <Text style={{ fontWeight: "600", color: "#ffffff" }}>Create Collection</Text>
          </Pressable>
        </View>
      </Dialog>
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
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBar: { position: "absolute", bottom: 0, width: 80, height: 4, borderRadius: 999 },
  collectionCard: { borderRadius: 16, padding: 16, height: 192, overflow: "hidden" },
  miniCard: {
    position: "absolute",
    width: 56,
    height: 44,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  miniInner: { flex: 1, backgroundColor: tw.gray50, alignItems: "center", justifyContent: "center", padding: 4 },
  createCard: { borderWidth: 2, borderStyle: "dashed", borderRadius: 16, padding: 16, height: 192, alignItems: "center", justifyContent: "center", gap: 12 },
  plusCircle: { width: 48, height: 48, borderRadius: 999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  input: { height: 48, fontSize: 16, borderWidth: 2, borderRadius: 12, paddingHorizontal: 12 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
