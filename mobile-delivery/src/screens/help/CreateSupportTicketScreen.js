// DeliveryV2/pages/help/CreateSupportTicketV2 (/help/tickets/create): subject, description, category
// and priority -> POST /food/delivery/support-tickets, then back to /help/tickets.
import { Send } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { createSupportTicket } from "../../api";
import Spinner from "../../components/content/Spinner";
import { HelpHeader, OptionSelect } from "../../components/help/HelpParts";
import { Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, fontFamilyByWeight, mixWithWhite, tw } from "../../theme/tokens";

const CATEGORIES = [
  { value: "payment", label: "Payment" },
  { value: "order", label: "Order" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Tech Issue" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const FOCUS_RING = "0px 0px 0px 4px rgba(21,73,139,0.15)";

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Field({ multiline, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      placeholderTextColor={tw.gray400}
      selectionColor={brand.primary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        multiline && styles.textarea,
        focused && { borderColor: mixWithWhite(brand.primary, 0.55), boxShadow: FOCUS_RING },
      ]}
    />
  );
}

export default function CreateSupportTicketScreen() {
  const goBack = useAppBack();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", category: "other", priority: "medium" });

  const handleSubmit = async () => {
    if (form.subject.length < 3) return toast.error("Subject too short");
    if (form.description.length < 10) return toast.error("Description too short");
    setLoading(true);
    try {
      const res = await createSupportTicket(form);
      if (res?.success) {
        toast.success("Ticket raised successfully");
        goBack();
      }
    } catch {
      toast.error("Failed to create ticket");
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  return (
    <Screen edges={["bottom"]} background="#ffffff">
      <HelpHeader title="Raise Ticket" onBack={goBack} uppercase />
      <KeyboardAvoidingView behavior="padding" style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.fields}>
            <View style={styles.group}>
              <Label>Issue Topic</Label>
              <Field
                placeholder="Main subject of your concern"
                value={form.subject}
                onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
              />
            </View>

            <View style={styles.group}>
              <Label>Detail Description</Label>
              <Field
                multiline
                placeholder="Explain your issue here..."
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />
            </View>

            <View style={styles.grid}>
              <View style={[styles.group, styles.flex1]}>
                <Label>Category</Label>
                <OptionSelect
                  title="Category"
                  value={form.category}
                  options={CATEGORIES}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                />
              </View>
              <View style={[styles.group, styles.flex1]}>
                <Label>Priority</Label>
                <OptionSelect
                  title="Priority"
                  value={form.priority}
                  options={PRIORITIES}
                  onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                />
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.submit, loading && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            {loading ? <Spinner size={20} color="#ffffff" /> : <Send size={20} color="#ffffff" />}
            <Text style={styles.submitText}>Submit Ticket</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scroll: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40, gap: 32 },
  fields: { gap: 24 },
  group: { gap: 8 },
  grid: { flexDirection: "row", gap: 16 },
  label: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 4,
  },
  input: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: brand.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 14,
    fontFamily: fontFamilyByWeight["700"],
    color: brand.text,
    ...brand.cardShadow,
  },
  textarea: { height: 6 * 20 + 32 },
  submit: {
    width: "100%",
    backgroundColor: "#000000",
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...brand.cardShadow,
  },
  submitText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
});
