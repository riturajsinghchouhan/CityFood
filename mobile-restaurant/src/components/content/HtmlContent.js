// CMS HTML (dangerouslySetInnerHTML) rendered natively, styled like the restaurant legal pages'
// Tailwind `prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed` block. Light only.
// Copied from mobile-user/src/components/support/HtmlContent.js.
import { memo, useMemo } from "react";
import { Linking, Platform } from "react-native";
import RenderHtml, { defaultSystemFonts } from "react-native-render-html";
import { openLink } from "../../navigation/links";
import { fontFamilyByWeight, tw } from "../../theme/tokens";

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

const heading = (size, lineHeight, marginTop, marginBottom, weight) => ({
  fontSize: size,
  lineHeight,
  marginTop,
  marginBottom,
  color: tw.gray900,
  fontFamily: fontFamilyByWeight[weight],
  fontWeight: "normal",
});

// prose-sm scale: 14px body / 1.714 line height.
const BASE_STYLE = { fontSize: 14, lineHeight: 23, color: tw.gray700, fontFamily: fontFamilyByWeight["400"] };
const TAGS_STYLES = {
  p: { marginTop: 16, marginBottom: 16 },
  h1: heading(30, 34, 0, 24, "800"),
  h2: heading(20, 28, 32, 16, "700"),
  h3: heading(18, 28, 28, 8, "600"),
  h4: heading(14, 20, 20, 8, "600"),
  h5: heading(14, 20, 20, 8, "600"),
  h6: heading(14, 20, 20, 8, "600"),
  strong: { color: tw.gray900, fontFamily: fontFamilyByWeight["600"], fontWeight: "normal" },
  b: { color: tw.gray900, fontFamily: fontFamilyByWeight["600"], fontWeight: "normal" },
  a: { color: tw.gray900, textDecorationLine: "underline", fontFamily: fontFamilyByWeight["500"] },
  ul: { marginTop: 16, marginBottom: 16, paddingLeft: 22 },
  ol: { marginTop: 16, marginBottom: 16, paddingLeft: 22 },
  li: { marginTop: 4, marginBottom: 4 },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: tw.gray200,
    paddingLeft: 16,
    marginTop: 22,
    marginBottom: 22,
    fontStyle: "italic",
    color: tw.gray900,
  },
  hr: { marginTop: 40, marginBottom: 40, height: 1, backgroundColor: tw.gray200 },
  img: { marginTop: 24, marginBottom: 24 },
};

function HtmlContent({ html, width }) {
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
      baseStyle={BASE_STYLE}
      tagsStyles={TAGS_STYLES}
      renderersProps={renderersProps}
      defaultTextProps={{ selectable: false, allowFontScaling: true }}
    />
  );
}

export default memo(HtmlContent);
