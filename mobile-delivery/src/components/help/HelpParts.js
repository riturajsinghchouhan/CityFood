// Shared bits of the DeliveryV2 help pages (SupportTicketsV2 / CreateSupportTicketV2 /
// ViewSupportTicketV2): the fixed white header (px-4 py-5, shadow-sm, border-b gray-50, ArrowLeft 24 +
// text-xl font-black title), the web <select> stand-in, and the ticket status colours after the
// delivery colour remap (orange / blue / green 50-600 -> primary soft / primary).
import { ArrowLeft, Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, SheetHandle } from "../ui/Sheet";
import Text from "../ui/Text";
import { brand, dvColor, light, mixWithWhite, shadow, tw } from "../../theme/tokens";

const FOCUS_RING = "0px 0px 0px 4px rgba(21,73,139,0.15)";

export function HelpHeader({ title, onBack, uppercase = false }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
      <Pressable onPress={onBack} style={styles.back} hitSlop={8} accessibilityLabel="Back">
        <ArrowLeft size={24} color={tw.gray950} />
      </Pressable>
      <Text heading style={[styles.title, uppercase && styles.titleUpper]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

// SupportTicketsV2 getStatusColor -> {bg, text, border}
export function listStatusColors(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":
      return { bg: dvColor("bg-orange-50", light), text: dvColor("text-orange-600", light), border: dvColor("border-orange-100", light) };
    case "in_progress":
      return { bg: dvColor("bg-blue-50", light), text: dvColor("text-blue-600", light), border: dvColor("border-blue-100", light) };
    case "resolved":
      return { bg: dvColor("bg-green-50", light), text: dvColor("text-green-600", light), border: dvColor("border-green-100", light) };
    default:
      return { bg: tw.gray50, text: tw.gray600, border: tw.gray100 };
  }
}

// ViewSupportTicketV2 getStatusColor -> {bg, text}
export function detailStatusColors(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":
    case "resolved":
      return { bg: brand.primarySoft, text: brand.primary };
    case "closed":
      return { bg: tw.gray50, text: tw.gray600 };
    default:
      return { bg: dvColor("bg-blue-50", light), text: dvColor("text-blue-600", light) };
  }
}

/**
 * <select> (rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-widest, forced white with a
 * #e8dee7 border by deliveryTheme.css) that opens a bottom sheet of options [{value, label}].
 */
export function OptionSelect({ value, options, onChange, title }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.select, open && { borderColor: mixWithWhite(brand.primary, 0.55), boxShadow: FOCUS_RING }]}
      >
        <Text style={styles.selectText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <ChevronDown size={16} color={brand.text} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="70%">
        <SheetHandle />
        {title ? (
          <Text heading style={styles.sheetTitle}>
            {title}
          </Text>
        ) : null}
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.sheetList}
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, (active || pressed) && { backgroundColor: brand.primarySoft }]}
              >
                <Text style={[styles.optionText, active && { color: brand.primary, fontWeight: "700" }]}>{item.label}</Text>
                {active ? <Check size={18} color={brand.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray50,
    zIndex: 50,
    ...shadow.sm,
  },
  back: { padding: 4, borderRadius: 9999 },
  title: { flexShrink: 1, fontSize: 20, lineHeight: 28, fontWeight: "900", color: tw.gray950 },
  titleUpper: { textTransform: "uppercase", letterSpacing: -0.5 },
  select: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: brand.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    ...brand.cardShadow,
  },
  selectText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: brand.text,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sheetTitle: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: tw.gray900, paddingHorizontal: 20, paddingBottom: 8 },
  sheetList: { paddingHorizontal: 12, paddingBottom: 16 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  optionText: { fontSize: 16, lineHeight: 24, color: brand.text },
});
