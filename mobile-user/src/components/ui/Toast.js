// Native stand-in for sonner (<Toaster position="top-center" richColors offset="80px" />).
// Same call API as web: toast(msg), toast.success/error/info/warning/loading(msg, {description, duration, id}),
// toast.dismiss(id).
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { shadow } from "../../theme/tokens";
import Text from "./Text";

const listeners = new Set();
let toasts = [];
let seq = 0;

function emit() {
  listeners.forEach((fn) => fn(toasts));
}

function show(type, message, opts = {}) {
  const id = opts.id ?? `t${++seq}`;
  const duration = opts.duration ?? (type === "loading" ? Infinity : 4000);
  const item = { id, type, message: String(message ?? ""), description: opts.description, duration };
  const exists = toasts.some((t) => t.id === id);
  toasts = exists ? toasts.map((t) => (t.id === id ? item : t)) : [...toasts, item].slice(-3);
  emit();
  return id;
}

export const toast = Object.assign((message, opts) => show("default", message, opts), {
  success: (m, o) => show("success", m, o),
  error: (m, o) => show("error", m, o),
  info: (m, o) => show("info", m, o),
  warning: (m, o) => show("warning", m, o),
  loading: (m, o) => show("loading", m, o),
  dismiss: (id) => {
    toasts = id === undefined ? [] : toasts.filter((t) => t.id !== id);
    emit();
  },
});

// sonner richColors palette.
const RICH = {
  default: { bg: "#ffffff", border: "#ededed", fg: "#171717" },
  loading: { bg: "#ffffff", border: "#ededed", fg: "#171717" },
  success: { bg: "#ecfdf3", border: "#bffcd9", fg: "#008a2e" },
  error: { bg: "#fff0f0", border: "#ffe0e1", fg: "#e60000" },
  info: { bg: "#f0f8ff", border: "#d3e0fd", fg: "#0973dc" },
  warning: { bg: "#fffcf0", border: "#fdf5d3", fg: "#dc7609" },
};

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert };

function ToastItem({ item }) {
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (!Number.isFinite(item.duration)) return undefined;
    const t = setTimeout(() => toast.dismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [anim, item.duration, item.id]);
  const c = RICH[item.type] || RICH.default;
  const Icon = ICONS[item.type];
  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: c.bg, borderColor: c.border },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <Pressable style={styles.row} onPress={() => toast.dismiss(item.id)}>
        {item.type === "loading" ? (
          <ActivityIndicator size="small" color={c.fg} />
        ) : Icon ? (
          <Icon size={18} color={c.fg} />
        ) : null}
        <View style={styles.body}>
          <Text style={[styles.title, { color: c.fg }]}>{item.message}</Text>
          {item.description ? (
            <Text style={[styles.desc, { color: c.fg }]}>{item.description}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function Toaster() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => listeners.delete(setItems);
  }, []);
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 16 }]}>
      {items.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 8, zIndex: 9999, elevation: 9999 },
  toast: {
    width: "100%",
    maxWidth: 356,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadow.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: "500" },
  desc: { fontSize: 13, marginTop: 2, opacity: 0.9 },
});
