// The circular map + treasure chest illustration of Coupons.jsx's empty state.
import { LinearGradient } from "expo-linear-gradient";
import { MapPin } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { shadow } from "../../theme/tokens";
import { c } from "./palette";

const ROADS = [
  { d: "M 20 100 Q 50 80, 80 100 T 140 100", stroke: "#a1a1aa", w: 4 },
  { d: "M 100 20 Q 100 50, 100 80 T 100 140", stroke: "#a1a1aa", w: 4 },
  { d: "M 40 40 Q 60 60, 80 80 T 120 120", stroke: "#b4b4b8", w: 3 },
  { d: "M 160 40 Q 140 60, 120 80 T 80 120", stroke: "#b4b4b8", w: 3 },
  { d: "M 30 170 Q 50 150, 70 130 T 110 90", stroke: "#b4b4b8", w: 3 },
  { d: "M 170 170 Q 150 150, 130 130 T 90 90", stroke: "#b4b4b8", w: 3 },
  { d: "M 50 50 L 70 70", stroke: "#c4c4c7", w: 2 },
  { d: "M 150 50 L 130 70", stroke: "#c4c4c7", w: 2 },
  { d: "M 50 150 L 70 130", stroke: "#c4c4c7", w: 2 },
  { d: "M 150 150 L 130 130", stroke: "#c4c4c7", w: 2 },
];

function Coin({ style }) {
  return (
    <LinearGradient colors={[c.yellow400, c.yellow500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.coin, style]} />
  );
}

export default function CouponsEmptyIllustration() {
  return (
    <View style={styles.circle}>
      <Svg viewBox="0 0 200 200" width="100%" height="100%" style={styles.map}>
        {ROADS.map((r) => (
          <Path key={r.d} d={r.d} stroke={r.stroke} strokeWidth={r.w} fill="none" strokeLinecap="round" />
        ))}
      </Svg>

      <View style={[styles.pin, { left: 48, top: 64 }]}>
        <MapPin size={28} color={c.red500} fill={c.red500} />
      </View>
      <View style={[styles.pin, { right: 48, top: 80 }]}>
        <MapPin size={28} color={c.red500} fill={c.red500} />
      </View>

      <View style={styles.center}>
        <View style={styles.coins}>
          <Coin />
          <Coin style={{ marginLeft: -4 }} />
          <Coin style={{ marginLeft: -8 }} />
        </View>

        <View style={styles.chestWrap}>
          <LinearGradient colors={[c.amber800, c.amber900]} style={styles.chest}>
            <LinearGradient colors={[c.amber900, c.amber950]} style={styles.lid} />
            <View style={styles.lockWrap}>
              <LinearGradient
                colors={[c.yellow400, c.yellow600]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lock}
              >
                <View style={styles.keyhole} />
              </LinearGradient>
            </View>
            <View style={[styles.strap, { top: 12 }]} />
            <View style={[styles.strap, { bottom: 12 }]} />
            <View style={styles.detail} />
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 256,
    height: 256,
    borderRadius: 9999,
    backgroundColor: c.gray200,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "inset 0px 2px 4px rgba(0,0,0,0.05)",
  },
  map: { position: "absolute", top: 0, left: 0, opacity: 0.7 },
  pin: { position: "absolute", zIndex: 20 },
  center: { zIndex: 10, alignItems: "center" },
  coins: { position: "absolute", left: -40, top: 8, gap: 2, zIndex: 1 },
  coin: { width: 28, height: 28, borderRadius: 9999, borderWidth: 2, borderColor: c.yellow600, ...shadow.lg },
  chestWrap: { marginTop: 16 },
  chest: { width: 96, height: 80, borderRadius: 8, ...shadow.xl },
  lid: { position: "absolute", top: -12, left: 0, right: 0, height: 20, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  lockWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  lock: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: c.yellow700,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.lg,
  },
  keyhole: { width: 16, height: 16, borderRadius: 9999, backgroundColor: c.yellow700 },
  strap: { position: "absolute", left: 12, width: 64, height: 6, borderRadius: 9999, backgroundColor: c.amber950 },
  detail: { position: "absolute", top: 4, left: 16, width: 64, height: 2, backgroundColor: c.amber700 },
});
