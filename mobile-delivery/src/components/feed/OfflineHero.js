// DeliveryHomeV2 offline body: #f8f9fa "fake map" (4 % dot grid + 6 % SVG roads), the round
// delivery_avatar with a soft blue glow, and the "You are Offline" card.
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { brand, tw } from "../../theme/tokens";
import Text from "../ui/Text";
import { p } from "./palette";

const AVATAR = require("../../../assets/images/delivery_avatar.jpg");
const SIZE = 224; // w-56
const GLOW = SIZE * 1.5 + 120; // scale-150 + blur-[60px]

export default function OfflineHero() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <Circle cx="12" cy="12" r="2" fill="#000" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dots)" opacity={0.04} />
      </Svg>
      <Svg style={[StyleSheet.absoluteFill, { opacity: 0.06 }]} pointerEvents="none">
        <Path d="M -100,200 Q 150,250 300,100 T 800,300" stroke="#000" strokeWidth={8} fill="none" />
        <Path d="M 200,-100 Q 250,150 100,300 T 300,800" stroke="#000" strokeWidth={6} fill="none" />
        <Path d="M 400,-100 Q 350,150 500,400 T 200,800" stroke="#000" strokeWidth={10} fill="none" />
      </Svg>

      <View style={styles.content}>
        <View style={styles.avatarWrap}>
          <Svg width={GLOW} height={GLOW} style={styles.glow} pointerEvents="none">
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={p.blue500} stopOpacity={0.2} />
                <Stop offset="0.6" stopColor={p.blue500} stopOpacity={0.12} />
                <Stop offset="1" stopColor={p.blue500} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#glow)" />
          </Svg>
          <Image source={AVATAR} style={styles.avatar} resizeMode="cover" />
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>You are Offline</Text>
          <Text style={styles.sub}>Go online to receive orders</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: brand.offlinePlaceholder, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  content: { zIndex: 10, alignItems: "center", marginTop: 128 },
  avatarWrap: { marginTop: 40, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", left: (SIZE - GLOW) / 2, top: (SIZE - GLOW) / 2 },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 8,
    borderColor: "#ffffff",
    boxShadow: "0px 20px 60px rgba(0,0,0,0.25)",
  },
  card: {
    marginTop: 32,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.5)",
    boxShadow: "0px 8px 30px rgba(0,0,0,0.08)",
  },
  title: { color: tw.gray900, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.8, fontSize: 18 },
  sub: { color: tw.gray500, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 },
});
