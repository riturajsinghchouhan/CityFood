import { Text as RNText, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, fontSize } from "../../theme/tokens";

// App-wide Text: Poppins at the right weight (Android ignores fontWeight with
// custom fonts) and the theme's text color by default. Body is text-sm (14px).
export default function Text({ style, children, ...props }) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  const weight = String(flat.fontWeight || "400");
  const fontFamily = flat.fontFamily || fontFamilyByWeight[weight] || fontFamilyByWeight["400"];
  return (
    <RNText
      {...props}
      style={[
        { color: colors.text, fontSize: fontSize.sm },
        flat,
        { fontFamily, fontWeight: undefined },
      ]}
    >
      {children}
    </RNText>
  );
}
