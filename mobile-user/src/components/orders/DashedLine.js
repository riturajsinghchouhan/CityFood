// border-t border-dashed: RN can't dash a single side reliably, so clip a dashed box to 1px.
import { View } from "react-native";

export default function DashedLine({ color = "#e5e7eb", style }) {
  return (
    <View style={[{ height: 1, overflow: "hidden" }, style]}>
      <View style={{ height: 2, borderWidth: 1, borderColor: color, borderStyle: "dashed" }} />
    </View>
  );
}
