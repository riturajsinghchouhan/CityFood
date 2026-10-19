// components/ImageSourcePicker.jsx: "Use Camera" or "Upload from Device" (expo-image-picker).
import * as ImagePicker from "expo-image-picker";
import { Camera, Upload } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Dialog, ScalePressable, Text, toast } from "../../ui";
import { tw } from "../../../theme/tokens";

async function openCamera(onFileSelect) {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.error("Could not open camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    onFileSelect?.(result.assets[0]);
  } catch {
    toast.error("Failed to capture image");
  }
}

async function openGallery(onFileSelect) {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    onFileSelect?.(result.assets[0]);
  } catch {
    toast.error("Failed to open gallery");
  }
}

export default function ImageSourcePicker({
  isOpen,
  onClose,
  onFileSelect,
  title = "Update photo",
  description = "Choose how you want to upload your photo.",
}) {
  return (
    <Dialog visible={isOpen} onClose={onClose} style={styles.dialog}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.options}>
        <ScalePressable
          scaleTo={0.98}
          onPress={() => {
            onClose();
            openCamera(onFileSelect);
          }}
          style={styles.option}
        >
          <Text style={styles.optionLabel}>Use Camera</Text>
          <View style={[styles.iconBox, { backgroundColor: tw.orange50 }]}>
            <Camera size={20} color="#f54900" />
          </View>
        </ScalePressable>
        <ScalePressable
          scaleTo={0.98}
          onPress={() => {
            onClose();
            openGallery(onFileSelect);
          }}
          style={styles.option}
        >
          <Text style={styles.optionLabel}>Upload from Device</Text>
          <View style={[styles.iconBox, { backgroundColor: tw.blue50 }]}>
            <Upload size={20} color={tw.blue600} />
          </View>
        </ScalePressable>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { maxWidth: 384, padding: 0, borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff" },
  header: { padding: 20, paddingBottom: 12, gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  description: { fontSize: 14, color: tw.gray500 },
  options: { gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  option: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tw.gray200,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  iconBox: { padding: 8, borderRadius: 8 },
});
