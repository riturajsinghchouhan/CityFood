import { createContext, useContext } from "react";
import { Text as RNText, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, fontSize } from "../../theme/tokens";

// Which font family a page renders in on web. Food pages use Poppins (via
// --main-font-family under UserLayout); the auth module's login page falls back
// to the system font (Tailwind's ui-sans-serif = Roboto on Android) and public
// support uses Inter.
const FontScopeContext = createContext("poppins");

const INTER_BY_WEIGHT = {
  "400": "Inter_400Regular",
  normal: "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  bold: "Inter_700Bold",
};

export function FontScope({ family, children }) {
  return <FontScopeContext.Provider value={family}>{children}</FontScopeContext.Provider>;
}

// Font style for TextInputs and other non-Text elements in the current scope.
export function useScopedFont(weight = "400") {
  const scope = useContext(FontScopeContext);
  const w = String(weight);
  if (scope === "system") return { fontWeight: w };
  if (scope === "inter") return { fontFamily: INTER_BY_WEIGHT[w] || INTER_BY_WEIGHT["400"] };
  return { fontFamily: fontFamilyByWeight[w] || fontFamilyByWeight["400"] };
}

// App-wide Text: the page's font at the right weight (Android ignores fontWeight
// with custom fonts) and the theme's text color by default. Body is text-sm (14px).
export default function Text({ style, children, ...props }) {
  const { colors } = useTheme();
  const scope = useContext(FontScopeContext);
  const flat = StyleSheet.flatten(style) || {};
  const weight = String(flat.fontWeight || "400");
  let font;
  if (flat.fontFamily) {
    font = { fontFamily: flat.fontFamily, fontWeight: undefined };
  } else if (scope === "system") {
    font = { fontWeight: weight };
  } else if (scope === "inter") {
    font = { fontFamily: INTER_BY_WEIGHT[weight] || INTER_BY_WEIGHT["400"], fontWeight: undefined };
  } else {
    font = { fontFamily: fontFamilyByWeight[weight] || fontFamilyByWeight["400"], fontWeight: undefined };
  }
  return (
    <RNText {...props} style={[{ color: colors.text, fontSize: fontSize.sm }, flat, font]}>
      {children}
    </RNText>
  );
}
