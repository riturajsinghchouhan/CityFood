// ProfileV2's two centered popups (fixed inset-0 bg-black/60, white max-w-sm rounded-2xl shadow-2xl):
// the logout confirm and the 2-step delete-account confirmation (type DELETE MY ACCOUNT).
import { AlertTriangle } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { brand, tw } from "../../theme/tokens";
import { Dialog } from "../ui/Sheet";
import Text from "../ui/Text";
import { FOCUS_RING, dvInput } from "./common";

const CONFIRM_TEXT = "DELETE MY ACCOUNT";

function DialogButton({ label, onPress, variant, disabled, disabledOpacity = 0.6 }) {
  const filled = variant === "red600" || variant === "red500";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        filled ? { backgroundColor: variant === "red600" ? tw.red600 : tw.red500 } : styles.btnOutline,
        disabled && { opacity: disabledOpacity },
      ]}
    >
      <Text style={[styles.btnText, { color: filled ? "#ffffff" : tw.gray700 }]}>{label}</Text>
    </Pressable>
  );
}

export function LogoutDialog({ visible, onClose, onConfirm, submitting }) {
  return (
    <Dialog visible={visible} onClose={onClose} style={styles.dialog}>
      <View style={styles.pad}>
        <Text heading style={styles.title}>
          Do you want to log out?
        </Text>
        <Text style={styles.body}>You will be signed out from your delivery account.</Text>
        <View style={styles.row}>
          <DialogButton label="No" onPress={onClose} />
          <DialogButton
            label={submitting ? "Logging out..." : "Yes"}
            onPress={onConfirm}
            variant="red600"
            disabled={submitting}
          />
        </View>
      </View>
    </Dialog>
  );
}

export function DeleteAccountDialog({ visible, onClose, step, setStep, captcha, setCaptcha, deleting, onDelete }) {
  const [focused, setFocused] = useState(false);
  return (
    <Dialog visible={visible} onClose={onClose} style={styles.dialog}>
      {step === 1 ? (
        <View style={styles.pad}>
          <View style={styles.warnHead}>
            <View style={styles.warnIcon}>
              <AlertTriangle size={24} color={tw.red500} />
            </View>
            <Text heading style={[styles.title, { marginBottom: 0 }]}>
              Delete Account?
            </Text>
          </View>
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>⚠️ This action is permanent!</Text>
            {[
              "Your profile and documents will be deleted",
              "Wallet balance and earnings will be forfeited",
              "Trip history will be anonymized",
              "Pending withdrawals will be cancelled",
              "You can register again as a new partner",
            ].map((line) => (
              <Text key={line} style={styles.warnLine}>
                • {line}
              </Text>
            ))}
          </View>
          <View style={styles.row}>
            <DialogButton label="Cancel" onPress={onClose} />
            <DialogButton label="Continue" onPress={() => setStep(2)} variant="red500" />
          </View>
        </View>
      ) : (
        <View style={styles.pad}>
          <Text heading style={styles.title}>
            Confirm Deletion
          </Text>
          <Text style={[styles.body, { marginBottom: 16 }]}>
            Type <Text style={styles.confirmWord}>{CONFIRM_TEXT}</Text> to confirm.
          </Text>
          <TextInput
            value={captcha}
            onChangeText={setCaptcha}
            placeholder="Type here..."
            placeholderTextColor={tw.gray400}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            selectionColor={brand.primary}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused && { boxShadow: FOCUS_RING }]}
          />
          <View style={styles.row}>
            <DialogButton
              label="Back"
              onPress={() => {
                setStep(1);
                setCaptcha("");
              }}
            />
            <DialogButton
              label={deleting ? "Deleting..." : "Delete Forever"}
              onPress={onDelete}
              variant="red500"
              disabled={captcha.trim() !== CONFIRM_TEXT || deleting}
              disabledOpacity={0.4}
            />
          </View>
        </View>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 384,
    borderRadius: 16,
    borderWidth: 0,
    padding: 0,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    ...brand.cardShadow,
  },
  pad: { padding: 20 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: "900", color: tw.gray900, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: tw.gray500, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  btn: { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnOutline: { borderWidth: 1, borderColor: tw.gray200 },
  btnText: { fontSize: 16, fontWeight: "700" },
  warnHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  warnIcon: { backgroundColor: tw.red100, borderRadius: 9999, padding: 10 },
  warnBox: {
    backgroundColor: tw.red50,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tw.red100,
    gap: 6,
  },
  warnTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: tw.red600, marginBottom: 2 },
  warnLine: { fontSize: 12, lineHeight: 16, color: "rgba(251,44,54,0.8)" },
  confirmWord: { fontSize: 14, fontWeight: "700", color: tw.red500 },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    ...dvInput,
    fontSize: 14,
    fontFamily: "monospace",
    marginBottom: 16,
  },
});
