// components/Loader.jsx -> ui/loading-skeletons AppShellSkeleton, used while the
// booking screens load.
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { Skeleton } from "../ui";

const CHIP_WIDTHS = [112, 80, 96, 112, 96];

function RestaurantCardSkeleton({ isDark }) {
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "#efe2d4",
          backgroundColor: isDark ? "#141414" : "#ffffff",
        },
      ]}
    >
      <View style={styles.cardImage}>
        <LinearGradient
          colors={isDark ? ["#262626", "#181818"] : ["#fff7ee", "#ffe7cf"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Skeleton style={[styles.abs, { left: 16, top: 16, height: 32, width: 80, borderRadius: 999 }]} />
        <Skeleton style={[styles.abs, { right: 16, top: 16, height: 36, width: 36, borderRadius: 999 }]} />
        <View style={styles.cardImageBottom}>
          <Skeleton style={{ height: 20, width: "66%", borderRadius: 999 }} />
          <View style={styles.row8}>
            <Skeleton style={{ height: 16, width: 64, borderRadius: 999 }} />
            <Skeleton style={{ height: 16, width: 80, borderRadius: 999 }} />
          </View>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 20, width: "80%", borderRadius: 999 }} />
            <Skeleton style={{ height: 16, width: "66%", borderRadius: 999 }} />
          </View>
          <Skeleton style={{ height: 32, width: 48, borderRadius: 12 }} />
        </View>
        <View style={styles.row8}>
          <Skeleton style={{ height: 16, width: 64, borderRadius: 999 }} />
          <Skeleton style={{ height: 16, width: 80, borderRadius: 999 }} />
        </View>
      </View>
    </View>
  );
}

export default function DiningLoader() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0b0b0b", "#151515"] : ["#fffdf9", "#fff8f1"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        scrollEnabled={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        accessibilityLabel="Loading application"
      >
        <View style={styles.between}>
          <Skeleton style={{ height: 44, width: 160, borderRadius: 999 }} />
          <View style={styles.row12}>
            <Skeleton style={{ height: 44, width: 96, borderRadius: 999 }} />
            <Skeleton style={{ height: 44, width: 44, borderRadius: 999 }} />
          </View>
        </View>
        <View
          style={[
            styles.heroWrap,
            {
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
              backgroundColor: isDark ? "#141414" : "rgba(255,255,255,0.7)",
            },
          ]}
        >
          <Skeleton style={{ height: 192, width: "100%", borderRadius: 22 }} />
        </View>
        <View style={{ gap: 12 }}>
          <Skeleton style={{ height: 28, width: 208, borderRadius: 999 }} />
          <View style={[styles.row12, { overflow: "hidden" }]}>
            {CHIP_WIDTHS.map((w, i) => (
              <Skeleton key={`chip-${i}`} style={{ height: 36, width: w, borderRadius: 999 }} />
            ))}
          </View>
        </View>
        <View style={{ gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <RestaurantCardSkeleton key={`restaurant-card-${i}`} isDark={isDark} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
  between: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  row8: { flexDirection: "row", gap: 8 },
  row12: { flexDirection: "row", gap: 12 },
  heroWrap: { borderRadius: 28, borderWidth: 1, padding: 16 },
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  cardImage: { height: 176, overflow: "hidden" },
  abs: { position: "absolute" },
  cardImageBottom: { position: "absolute", left: 16, right: 16, bottom: 16, gap: 12 },
  cardBody: { padding: 16, gap: 16 },
});
