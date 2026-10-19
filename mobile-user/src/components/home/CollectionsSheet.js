// Home.jsx bookmark UI (web L3542-3676): the "Added to bookmark" toast and the
// "Manage Collections" sheet opened when tapping the bookmark of a saved restaurant.
import { Bookmark, Check, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { tw } from "../../theme/tokens";
import { BottomSheet, Text } from "../ui";

export function BookmarkToast({ visible, bottom }) {
  const [v] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    const anim = Animated.spring(v, { toValue: visible ? 1 : 0, damping: 25, stiffness: 200, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [visible, v]);
  if (!mounted) return null;
  return (
    <View style={[styles.toastWrap, { bottom }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] },
        ]}
      >
        <Text style={styles.toastText}>Added to bookmark</Text>
      </Animated.View>
    </View>
  );
}

/** slug: the restaurant being managed. isFavorite / removeFavorite / favoritesCount from useProfile. */
export function ManageCollectionsSheet({ visible, slug, isFavorite, favoritesCount, onUncheck, onClose, onDone }) {
  const checked = slug ? isFavorite(slug) : true;
  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Collections</Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close">
          <X size={16} color="#ffffff" />
        </Pressable>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Bookmark size={24} color={tw.red500} fill={tw.red500} />
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>Bookmarks</Text>
              <Pressable
                disabled={!slug}
                onPress={() => {
                  if (slug && checked) onUncheck(slug);
                }}
                hitSlop={8}
                style={[styles.checkbox, checked && styles.checkboxOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                {checked ? <Check size={12} color="#ffffff" /> : null}
              </Pressable>
            </View>
            <Text style={styles.rowSub}>
              {favoritesCount} restaurant{favoritesCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.row, pressed && { backgroundColor: tw.gray50 }]}>
          <View style={styles.iconBox}>
            <Plus size={24} color={tw.red500} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Create new Collection</Text>
          </View>
        </Pressable>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={onDone} style={({ pressed }) => [styles.done, pressed && { backgroundColor: tw.gray400 }]}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 60 },
  toast: {
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  toastText: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  // The web sheet is bg-white in both themes.
  sheet: { backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  title: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: tw.gray700, alignItems: "center", justifyContent: "center" },
  list: { maxHeight: 480 },
  listContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 8 },
  iconBox: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTitle: { fontSize: 16, fontWeight: "500", color: tw.gray900 },
  rowSub: { fontSize: 14, color: tw.gray500, marginTop: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: tw.red500,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: tw.red500 },
  footer: { borderTopWidth: 1, borderTopColor: tw.gray200, paddingHorizontal: 16, paddingVertical: 16 },
  done: { backgroundColor: tw.gray300, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  doneText: { color: tw.gray700, fontWeight: "500", fontSize: 14 },
});
