// Background doodles, droplets and floating leaves from Login.jsx.
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

let leafSeq = 0;

function BotanicalLeaf({ size, rotate = 0, opacity = 0.85 }) {
  const [gradId] = useState(() => `leafGrad${++leafSeq}`);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#05DF72" />
          <Stop offset="50%" stopColor="#00C950" />
          <Stop offset="100%" stopColor="#008236" />
        </LinearGradient>
      </Defs>
      <Path d="M12 52 C 16 32, 34 16, 56 10 C 52 30, 36 48, 12 52 Z" fill={`url(#${gradId})`} />
      <Path d="M14 50 Q 32 30 52 14" stroke="#016630" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} fill="none" />
      <Path d="M26 38 Q 32 34 36 36" stroke="#016630" strokeWidth={1} strokeLinecap="round" opacity={0.4} fill="none" />
      <Path d="M36 28 Q 42 24 46 26" stroke="#016630" strokeWidth={1} strokeLinecap="round" opacity={0.4} fill="none" />
    </Svg>
  );
}

// framer-motion y: [-offset, offset], repeat reverse, easeInOut.
function FloatingLeaf({ delay, duration, offset, style, ...leaf }) {
  const [y] = useState(() => new Animated.Value(-offset));
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: offset, duration: duration * 1000, easing: ease, useNativeDriver: true }),
        Animated.timing(y, { toValue: -offset, duration: duration * 1000, easing: ease, useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay * 1000);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [y, delay, duration, offset]);
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, style, { transform: [{ translateY: y }] }]}>
      <BotanicalLeaf {...leaf} />
    </Animated.View>
  );
}

const doodleStroke = { fill: "none", stroke: "#2D3748", strokeWidth: 0.9, strokeLinecap: "round", strokeLinejoin: "round" };

function Pizza({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...doodleStroke}>
      <Path d="M12 2L2 22h20L12 2z" />
      <Circle cx="12" cy="14" r="1.5" />
      <Circle cx="9" cy="18" r="1" />
      <Circle cx="15" cy="18" r="1" />
    </Svg>
  );
}

function Burger({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...doodleStroke}>
      <Path d="M4 11h16a1 1 0 0 0 1-1A6 6 0 0 0 3 10a1 1 0 0 0 1 1z" />
      <Path d="M3 14h18" />
      <Path d="M4 17h16a2 2 0 0 1 2 2 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 2 2 0 0 1 2-2z" />
    </Svg>
  );
}

function ForkKnife({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...doodleStroke}>
      <Path d="M18 2v20M21 2v6a3 3 0 0 1-3 3M15 2v6a3 3 0 0 0 3 3" />
      <Path d="M6 2v20M3 2v6a3 3 0 0 0 6 0V2" />
    </Svg>
  );
}

export default function LoginDecor() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.abs, { top: 32, left: 32, opacity: 0.25 }]}>
        <Pizza size={68} />
      </View>
      <View style={[styles.abs, { top: 64, right: 28, opacity: 0.2 }]}>
        <Burger size={60} />
      </View>
      <View style={[styles.abs, { top: 380, left: 16, opacity: 0.2 }]}>
        <Burger size={56} />
      </View>
      <View style={[styles.abs, { top: 330, right: 24, opacity: 0.25 }]}>
        <ForkKnife size={44} />
      </View>

      <FloatingLeaf delay={0} duration={4.5} offset={6} style={{ top: 72, left: 12 }} size={40} rotate={-35} opacity={0.9} />
      <View style={[styles.abs, styles.drop, { top: 100, left: 48, backgroundColor: "#FB2C36", transform: [{ rotate: "45deg" }] }]} />
      <View style={[styles.abs, styles.drop, { top: 108, left: 32, backgroundColor: "#00C950", transform: [{ rotate: "-30deg" }] }]} />
      <FloatingLeaf delay={1} duration={5} offset={8} style={{ top: 208, right: 16 }} size={32} rotate={35} opacity={0.85} />
      <FloatingLeaf delay={2} duration={4} offset={7} style={{ bottom: 350, left: 12 }} size={36} rotate={-15} opacity={0.9} />
      <FloatingLeaf delay={1.5} duration={5.5} offset={6} style={{ bottom: 400, right: 12 }} size={40} rotate={45} opacity={0.9} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  drop: { width: 8, height: 4, borderRadius: 999, opacity: 0.8 },
});
