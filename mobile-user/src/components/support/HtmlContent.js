// CMS HTML (dangerouslySetInnerHTML) rendered natively, styled like the web's Tailwind
// `prose prose-slate` block on the legal pages.
import { memo, useMemo } from "react";
import { Linking, Platform } from "react-native";
import RenderHtml, { defaultSystemFonts } from "react-native-render-html";
import { openLink } from "../../navigation/links";
import { fontFamilyByWeight } from "../../theme/tokens";
import { c } from "./palette";

const POPPINS = Object.values(fontFamilyByWeight).filter((v, i, a) => a.indexOf(v) === i);
const SYSTEM_FONTS = [...defaultSystemFonts, ...POPPINS];

// react-native-render-html 6.3.4 declares these as function-component defaultProps,
// which React 19 ignores, so they are passed explicitly.
const ENGINE_DEFAULTS = {
  htmlParserOptions: { decodeEntities: true },
  emSize: 14,
  ignoredDomTags: [],
  ignoredStyles: [],
  classesStyles: {},
  enableUserAgentStyles: true,
  enableCSSInlineProcessing: true,
  customHTMLElementModels: {},
  fallbackFonts: {
    "sans-serif": Platform.select({ ios: "system", default: "sans-serif" }),
    monospace: Platform.select({ ios: "Menlo", default: "monospace" }),
    serif: Platform.select({ ios: "Times New Roman", default: "serif" }),
  },
  systemFonts: SYSTEM_FONTS,
};

// Web <a> inside the content: app paths navigate, everything else (http, mailto:, tel:) opens outside.
function onLinkPress(href) {
  if (!href) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) {
    Linking.openURL(href).catch(() => {});
    return;
  }
  openLink(href);
}

const heading = (size, lineHeight, marginTop, marginBottom, color) => ({
  fontSize: size,
  lineHeight,
  marginTop,
  marginBottom,
  color,
  fontFamily: fontFamilyByWeight["900"],
  fontWeight: "normal",
});

function HtmlContent({ html, width, isDark, linkColor }) {
  const styles = useMemo(() => {
    const body = isDark ? c.slate300 : c.slate700;
    const p = isDark ? c.gray400 : c.gray600;
    const head = isDark ? "#ffffff" : c.gray900;
    const strong = isDark ? "#ffffff" : c.gray900;
    return {
      baseStyle: { fontSize: 16, lineHeight: 28, color: body, fontFamily: fontFamilyByWeight["400"] },
      tagsStyles: {
        p: { color: p, marginTop: 20, marginBottom: 20, lineHeight: 28 },
        h1: heading(36, 40, 0, 32, head),
        h2: heading(24, 32, 48, 24, head),
        h3: heading(20, 32, 32, 12, head),
        h4: heading(16, 24, 24, 8, head),
        h5: heading(16, 24, 24, 8, head),
        h6: heading(16, 24, 24, 8, head),
        strong: { color: strong, fontFamily: fontFamilyByWeight["600"], fontWeight: "normal" },
        b: { color: strong, fontFamily: fontFamilyByWeight["600"], fontWeight: "normal" },
        a: { color: linkColor, textDecorationLine: "underline", fontFamily: fontFamilyByWeight["500"] },
        ul: { marginTop: 20, marginBottom: 20, paddingLeft: 26 },
        ol: { marginTop: 20, marginBottom: 20, paddingLeft: 26 },
        li: { color: p, marginTop: 8, marginBottom: 8 },
        blockquote: {
          borderLeftWidth: 4,
          borderLeftColor: isDark ? c.slate700 : c.slate200,
          paddingLeft: 16,
          marginTop: 28,
          marginBottom: 28,
          fontStyle: "italic",
          color: strong,
        },
        hr: { marginTop: 48, marginBottom: 48, height: 1, backgroundColor: isDark ? c.slate700 : c.slate200 },
        img: { marginTop: 32, marginBottom: 32 },
      },
    };
  }, [isDark, linkColor]);

  const renderersProps = useMemo(
    () => ({
      a: { onPress: (_event, href) => onLinkPress(href) },
      img: { enableExperimentalPercentWidth: false },
    }),
    [],
  );

  const source = useMemo(() => ({ html: String(html || "") }), [html]);

  return (
    <RenderHtml
      {...ENGINE_DEFAULTS}
      contentWidth={width}
      source={source}
      baseStyle={styles.baseStyle}
      tagsStyles={styles.tagsStyles}
      renderersProps={renderersProps}
      defaultTextProps={{ selectable: false, allowFontScaling: true }}
    />
  );
}

export default memo(HtmlContent);
