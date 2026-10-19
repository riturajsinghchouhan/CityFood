// Port of components/user/home/ExploreMoreSection.jsx: the Offers / Gourmet / Collections
// tiles with the admin heading. Icons come from /explore-icons; where the web would fall
// back to its local images (unrecoverable), the tile stays empty at the same size.
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { openLink } from "../../navigation/links";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { AppImage, ScalePressable, Skeleton, Text } from "../ui";
import { FadeInUp, Shine } from "./anim";

const TILE = 80;

function SkeletonTile({ index }) {
  return (
    <View style={styles.skelSlot}>
      <View style={[styles.skelTile, index % 4 === 0 && { backgroundColor: "#fffaf4" }]}>
        <Skeleton style={styles.skelIcon} />
        <View style={styles.skelLines}>
          <Skeleton style={styles.skelLine1} />
          <Skeleton style={styles.skelLine2} />
        </View>
      </View>
    </View>
  );
}

function ExploreMoreSection({ heading = "Explore More", items = [], showSkeleton = false }) {
  const { isDark } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: isDark ? "#ffffff" : tw.gray900 }]}>{heading}</Text>
        <View style={[styles.line, { backgroundColor: isDark ? tw.gray800 : tw.gray100 }]} />
      </View>
      <View style={styles.rowWrap}>
        <View style={styles.row}>
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, index) => <SkeletonTile key={`explore-skel-${index}`} index={index} />)
            : items.map((item, index) => (
                <FadeInUp key={item.id} delay={index * 80} duration={400} style={styles.slot}>
                  <ScalePressable scaleTo={0.95} onPress={() => openLink(item.href)} style={styles.item}>
                    <View
                      style={[
                        styles.tile,
                        { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderColor: isDark ? tw.gray800 : tw.gray100 },
                      ]}
                    >
                      {item.image ? (
                        <AppImage src={item.image} width={TILE} style={StyleSheet.absoluteFill} placeholderType="none" />
                      ) : null}
                      <View style={styles.shine} pointerEvents="none">
                        <Shine width={TILE} duration={3000} mode="keyframe" delay={5000 + index * 500} alpha={0.5} skew={-25} />
                      </View>
                    </View>
                    <Text style={[styles.label, { color: isDark ? tw.gray400 : tw.gray500 }]}>
                      {String(item.label || "").toUpperCase()}
                    </Text>
                  </ScalePressable>
                </FadeInUp>
              ))}
        </View>
      </View>
    </View>
  );
}

export default memo(ExploreMoreSection);

const styles = StyleSheet.create({
  section: { paddingTop: 8 },
  headingRow: { paddingHorizontal: 16, marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontSize: 18, fontWeight: "700", lineHeight: 23 },
  line: { height: 1, flex: 1 },
  rowWrap: { paddingHorizontal: 16, paddingBottom: 16, overflow: "hidden" },
  // justify-center in an overflow-x row: wider content overflows on both sides.
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 40, paddingVertical: 8 },
  slot: { width: TILE },
  item: { width: "100%", alignItems: "center", gap: 8 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 12px -4px rgba(0,0,0,0.1)",
  },
  shine: { ...StyleSheet.absoluteFillObject, zIndex: 30, overflow: "hidden" },
  label: { fontSize: 10, fontWeight: "700", textAlign: "center", letterSpacing: -0.25, lineHeight: 12, paddingHorizontal: 4 },
  skelSlot: { width: TILE },
  skelTile: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1e3d6",
    backgroundColor: "#ffffff",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    boxShadow: "0px 10px 30px rgba(15,23,42,0.04)",
  },
  skelIcon: { width: 56, height: 56, borderRadius: 16 },
  skelLines: { flex: 1, gap: 8 },
  skelLine1: { height: 16, width: "75%", borderRadius: 999 },
  skelLine2: { height: 12, width: "50%", borderRadius: 999 },
});
