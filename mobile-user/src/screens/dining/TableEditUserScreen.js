// Port of Frontend/src/modules/Food/pages/user/dining/TableEditUserPage.jsx (/dining/edit-user).
// Save replaces this screen with the confirmation page. That page re-reads the profile, so the
// edited values are not shown there (same as web). No dark-mode styles on web.
import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Phone, User } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Screen, Text } from "../../components/ui";
import { NAV_KEYS, getNavState, navigateWithState, pal } from "./diningLib";

function Field({ label, icon: Icon, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Icon size={20} color={pal.slate400} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={pal.slate300}
          keyboardType={keyboardType}
          selectionColor={pal.red500}
          style={styles.input}
        />
      </View>
    </View>
  );
}

export default function TableEditUserScreen() {
  const [state] = useState(() => getNavState(NAV_KEYS.editUser) || {});
  const { user, restaurant, guests, date, timeSlot, discount, specialRequest } = state;
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const handleSave = () => {
    navigateWithState(
      "/dining/book-confirmation",
      NAV_KEYS.confirmation,
      { restaurant, guests, date, timeSlot, discount, specialRequest, user: { ...user, name, phone } },
      { replace: true },
    );
  };

  return (
    <Screen background="#f8f9fa">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ArrowLeft size={24} color={pal.slate900} />
        </Pressable>
        <Text style={styles.headerTitle}>EDIT DETAILS</Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <View style={styles.avatar}>
              <User size={40} color={pal.red500} />
            </View>
            <Text style={styles.introTitle}>Personalize Booking</Text>
            <Text style={styles.introSub}>CONTACT DETAILS FOR THE RESTAURANT</Text>
          </View>

          <View style={{ gap: 24 }}>
            <Field label="FULL NAME" icon={User} value={name} onChangeText={setName} placeholder="Enter your full name" />
            <Field
              label="MOBILE NUMBER"
              icon={Phone}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={{ paddingTop: 40 }}>
            <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}>
              <CheckCircle2 size={20} color="#ffffff" />
              <Text style={styles.saveText}>SAVE CHANGES</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderBottomWidth: 1,
    borderColor: pal.slate100,
  },
  backBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: pal.slate50 },
  pressed: { transform: [{ scale: 0.95 }] },
  headerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, color: pal.slate900 },
  content: { paddingHorizontal: 16, paddingVertical: 32, paddingBottom: 80, gap: 32 },
  intro: { alignItems: "center", gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: pal.red50,
    borderWidth: 4,
    borderColor: "#ffffff",
    marginBottom: 16,
    boxShadow: "0px 20px 25px -5px rgba(254,226,226,1), 0px 8px 10px -6px rgba(254,226,226,1)",
  },
  introTitle: { fontSize: 24, fontWeight: "900", color: pal.slate900 },
  introSub: { fontSize: 12, fontWeight: "700", letterSpacing: 2.4, color: pal.slate400, textAlign: "center" },
  label: { marginLeft: 8, fontSize: 10, fontWeight: "900", letterSpacing: 2, color: pal.slate400 },
  inputWrap: { justifyContent: "center" },
  inputIcon: { position: "absolute", left: 16, zIndex: 1 },
  input: {
    height: 56,
    paddingLeft: 48,
    paddingRight: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: pal.slate100,
    borderRadius: 16,
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: pal.slate900,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  saveBtn: {
    height: 56,
    width: "100%",
    borderRadius: 16,
    backgroundColor: pal.red500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    boxShadow: "0px 20px 25px -5px rgba(254,202,202,1), 0px 8px 10px -6px rgba(254,202,202,1)",
  },
  saveText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.4, color: "#ffffff" },
  cancelBtn: {
    marginTop: 16,
    height: 56,
    width: "100%",
    borderRadius: 16,
    backgroundColor: pal.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.4, color: pal.slate500 },
});
