import { createContext, useContext } from "react";
import { Text as RNText, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, fontSize, headingFontByWeight } from "../../theme/tokens";

// Delivery fonts (deliveryTheme.css): every element inherits Nunito Sans; h1-h4, .font-black and
// .font-extrabold use Sora (letter-spacing .01em). Only Nunito 500-800 and Sora 600/700 are loaded,
// so weights resolve to the nearest loaded face (see theme/tokens fontFamilyByWeight).
// FontScope family "heading" renders a subtree as headings (Sora).
const FontScopeContext = createContext("body");

export function FontScope({ family, children }) {
  return <FontScopeContext.Provider value={family}>{children}</FontScopeContext.Provider>;
}

function familyFor(weight, heading) {
  const w = String(weight || "400");
  if (heading) return headingFontByWeight[w] || headingFontByWeight.default;
  return fontFamilyByWeight[w] || fontFamilyByWeight["400"];
}

const SORA_SPACING = 0.01; // em

// Font style for TextInputs and other non-Text elements in the current scope.
export function useScopedFont(weight = "400") {
  const scope = useContext(FontScopeContext);
  return { fontFamily: familyFor(weight, scope === "heading") };
}

/**
 * App-wide Text: the delivery font at the right weight (Android ignores fontWeight with custom fonts)
 * and the theme's text color by default. Body is text-sm (14px).
 * Props: heading (h1-h4 -> Sora). fontWeight "800"/"900" (font-extrabold / font-black) -> Sora too.
 */
export default function Text({ style, heading = false, children, ...props }) {
  const { colors } = useTheme();
  const scope = useContext(FontScopeContext);
  const flat = StyleSheet.flatten(style) || {};
  const weight = String(flat.fontWeight || (heading ? "700" : "400"));
  const isHeading = heading || scope === "heading";
  let font;
  if (flat.fontFamily) {
    font = { fontFamily: flat.fontFamily, fontWeight: undefined };
  } else {
    const family = familyFor(weight, isHeading);
    font = { fontFamily: family, fontWeight: undefined };
    if (family.startsWith("Sora") && flat.letterSpacing === undefined) {
      font.letterSpacing = (flat.fontSize || fontSize.sm) * SORA_SPACING;
    }
  }
  return (
    <RNText {...props} style={[{ color: colors.text, fontSize: fontSize.sm }, flat, font]}>
      {children}
    </RNText>
  );
}
