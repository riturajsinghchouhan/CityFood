// SignupStep2's DocumentUpload card: label (+ red * when required), then either the photo preview with
// a red remove button and an "Uploaded" badge, or a dashed drop box with "Take Photo" / "Gallery".
// bg-green-500 and bg-[#00B761] render as the delivery primary (deliveryTheme.css).
import { Image } from "expo-image";
import { Camera, Check, Image as ImageIcon, Upload, X } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";
import { ScalePressable, Text } from "../ui";
import { FieldLabel } from "./FormFields";

function DocumentUpload({ docType, label, required = true, doc, onPick, onRemove }) {
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <FieldLabel label={label} required={required} style={styles.label} />
      {doc ? (
        <View>
          <Image source={{ uri: doc.uri }} style={styles.preview} contentFit="cover" />
          <Pressable onPress={() => onRemove(docType)} style={styles.remove} hitSlop={6}>
            <X size={16} color="#ffffff" />
          </Pressable>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Check size={16} color="#ffffff" />
            <Text style={styles.badgeText}>Uploaded</Text>
          </View>
        </View>
      ) : (
        <View style={styles.dropBox}>
          <View style={styles.dropInfo}>
            <Upload size={32} color={tw.gray400} style={styles.uploadIcon} />
            <Text style={styles.dropTitle}>Upload document</Text>
            <Text style={styles.dropHint}>PNG, JPG up to 5MB</Text>
          </View>
          <View style={styles.buttons}>
            <ScalePressable
              scaleTo={0.95}
              onPress={() => onPick(docType, "camera")}
              style={[styles.btn, { backgroundColor: tw.gray900 }]}
            >
              <Camera size={16} color="#ffffff" />
              <Text style={styles.btnText}>Take Photo</Text>
            </ScalePressable>
            <ScalePressable
              scaleTo={0.95}
              onPress={() => onPick(docType, "gallery")}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              <ImageIcon size={16} color="#ffffff" />
              <Text style={styles.btnText}>Gallery</Text>
            </ScalePressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default memo(DocumentUpload);

const styles = StyleSheet.create({
  card: { backgroundColor: "#ffffff", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: tw.gray200 },
  label: { marginBottom: 8 },
  preview: { width: "100%", height: 192, borderRadius: 8 },
  remove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: tw.red500,
    padding: 8,
    borderRadius: 9999,
  },
  badge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: { fontSize: 14, lineHeight: 20, color: "#ffffff" },
  dropBox: {
    width: "100%",
    height: 192,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: tw.gray300,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dropInfo: { alignItems: "center", paddingTop: 20, paddingBottom: 12 },
  uploadIcon: { marginBottom: 8 },
  dropTitle: { fontSize: 14, lineHeight: 20, color: tw.gray500, marginBottom: 4 },
  dropHint: { fontSize: 12, lineHeight: 16, color: tw.gray400 },
  buttons: { width: "100%", flexDirection: "row", gap: 8, paddingBottom: 16 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#ffffff" },
});
