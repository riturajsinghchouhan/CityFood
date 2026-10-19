// ui/avatar.tsx: round image over an initial fallback (shown while loading or on error).
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { resolveImage } from "../../api";
import { Text } from "../ui";
import { useTheme } from "../../theme/ThemeContext";

export default function UserAvatar({ size, image, initial, fontSize, fontWeight = "600" }) {
  const { colors } = useTheme();
  const uri = typeof image === "string" && image.trim() ? resolveImage(image) : null;
  const [failedUri, setFailedUri] = useState(null);
  const showImage = Boolean(uri) && failedUri !== uri;
  return (
    <View
      style={[
        styles.root,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "33" },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: colors.primary }]}>
        <Text style={{ color: "#ffffff", fontSize, fontWeight }}>{initial}</Text>
      </View>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailedUri(uri)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  fallback: { alignItems: "center", justifyContent: "center" },
});
