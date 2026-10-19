// Port of Frontend/src/modules/Food/components/ImageSourcePicker.jsx: Camera or device gallery.
import * as ImagePicker from "expo-image-picker";
import { Camera, Upload } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import AccountDialog, { DialogHeaderBlock } from "./AccountDialog";
import { ScalePressable, Text, toast } from "../ui";
import { tw } from "../../theme/tokens";

async function openCamera(onFileSelect, quality) {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.error("Could not open camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality });
    if (result.canceled || !result.assets?.[0]) return;
    onFileSelect(result.assets[0]);
  } catch {
    toast.error("Failed to capture image");
  }
}

async function openGallery(onFileSelect) {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    onFileSelect(result.assets[0]);
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
  const handleOpenCamera = () => {
    onClose();
    openCamera(onFileSelect, 0.8);
  };
  const handlePickFromDevice = () => {
    onClose();
    openGallery(onFileSelect);
  };

  return (
    <AccountDialog visible={isOpen} onClose={onClose} style={styles.dialog} closeColor={tw.gray900}>
      <DialogHeaderBlock title={title} description={description} />
      <View style={styles.options}>
        <ScalePressable scaleTo={0.98} onPress={handleOpenCamera} style={styles.option}>
          <Text style={styles.label}>Use Camera</Text>
          <View style={[styles.iconBox, { backgroundColor: tw.orange50 }]}>
            <Camera size={20} color="#ea580c" />
          </View>
        </ScalePressable>
        <ScalePressable scaleTo={0.98} onPress={handlePickFromDevice} style={styles.option}>
          <Text style={styles.label}>Upload from Device</Text>
          <View style={[styles.iconBox, { backgroundColor: tw.blue50 }]}>
            <Upload size={20} color={tw.blue600} />
          </View>
        </ScalePressable>
      </View>
    </AccountDialog>
  );
}

const styles = StyleSheet.create({
  dialog: { backgroundColor: "#ffffff" },
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
  label: { fontSize: 14, fontWeight: "500", color: tw.gray900 },
  iconBox: { padding: 8, borderRadius: 8 },
});
