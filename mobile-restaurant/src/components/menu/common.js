// Small shared pieces for the menu screens: the shadcn Switch with the per-screen checked colour,
// the restaurant-modal-sheet panel (restaurantTheme.css turns these bottom sheets into centred,
// rounded-3xl dialogs), a native stand-in for <select>, window.confirm, and the item hand-off
// that replaces Inventory's location.state.item.
import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui";
import { pal } from "./palette";

// components/ui/switch.tsx: h-[1.15rem] w-8 track, size-4 thumb; unchecked bg-input.
export function MenuSwitch({ value, onValueChange, checkedColor = pal.green500, uncheckedColor = pal.gray300, scale = 1, disabled }) {
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? checkedColor : uncheckedColor, transform: [{ scale }], opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }] }]}
      />
    </Pressable>
  );
}

function useFade(open) {
  const [mounted, setMounted] = useState(open);
  const [anim] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      Animated.spring(anim, { toValue: 1, stiffness: 300, damping: 30, mass: 1, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, anim]);
  return { mounted, anim };
}

/**
 * A `restaurant-modal-sheet` panel: centred, max-w min(100vw - 2rem, 28rem), rounded-3xl, white.
 * `scroll` wraps the children in a ScrollView capped at maxHeight (max-h-[85vh] etc.).
 * `header` renders above the scroll area (the web's sticky sheet headers).
 */
export function CenterSheet({
  open,
  onClose,
  children,
  header,
  footer,
  maxHeight = "90%",
  scroll = true,
  backdrop = "rgba(0,0,0,0.5)",
  panelStyle,
  contentStyle,
  width,
}) {
  const insets = useSafeAreaInsets();
  const { mounted, anim } = useFade(open);
  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose?.()}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={[styles.root, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}>
          <Animated.View style={[styles.backdrop, { backgroundColor: backdrop, opacity: anim }]}>
            <Pressable style={styles.fill} onPress={() => onClose?.()} />
          </Animated.View>
          <Animated.View
            style={[
              styles.panel,
              width ? { width, maxWidth: "100%" } : null,
              { maxHeight },
              {
                opacity: anim,
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
              },
              panelStyle,
            ]}
          >
            {header}
            {scroll ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={contentStyle}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={contentStyle}>{children}</View>
            )}
            {footer}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Native <select>: a field that opens a list of options. options: [{value, label}] */
export function SelectField({ value, options, onChange, placeholder, style, textStyle, iconColor = pal.gray500, title }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.selectField, style]} accessibilityRole="button">
        <Text style={[styles.selectText, textStyle]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={20} color={iconColor} />
      </Pressable>
      <CenterSheet open={open} onClose={() => setOpen(false)} maxHeight="70%" contentStyle={styles.selectList}>
        {title ? <Text style={styles.selectTitle}>{title}</Text> : null}
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => {
                setOpen(false);
                onChange?.(o.value);
              }}
              style={({ pressed }) => [styles.selectOption, (active || pressed) && { backgroundColor: pal.gray100 }]}
            >
              <Text style={styles.selectOptionText}>{o.label}</Text>
              {active ? <Check size={16} color={pal.gray900} /> : null}
            </Pressable>
          );
        })}
      </CenterSheet>
    </>
  );
}

// window.confirm(message) -> Promise<boolean>
export function confirmAsync(message) {
  return new Promise((resolve) => {
    Alert.alert("", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// Inventory passes the tapped item to ItemDetailsPage through location.state; route params must
// stay small, so the object waits here until the details screen reads it.
let itemHandoff = null;

export function setItemHandoff(id, payload) {
  itemHandoff = { id: String(id), payload };
}

// Not cleared on read (StrictMode runs state initialisers twice); the next tap replaces it.
export function peekItemHandoff(id) {
  if (!itemHandoff || itemHandoff.id !== String(id)) return null;
  return itemHandoff.payload;
}

const styles = StyleSheet.create({
  track: { width: 32, height: 18, borderRadius: 9999, padding: 1, justifyContent: "center" },
  thumb: { width: 16, height: 16, borderRadius: 9999, backgroundColor: "#ffffff" },
  fill: { flex: 1 },
  root: { flex: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  backdrop: { ...StyleSheet.absoluteFill },
  panel: {
    minWidth: 280,
    maxWidth: 448,
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
  },
  scroll: { flexGrow: 0 },
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  selectText: { flex: 1, fontSize: 14, color: pal.gray900 },
  selectList: { padding: 8 },
  selectTitle: { fontSize: 16, fontWeight: "700", color: pal.gray900, paddingHorizontal: 12, paddingVertical: 10 },
  selectOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectOptionText: { fontSize: 14, color: pal.gray900 },
});
