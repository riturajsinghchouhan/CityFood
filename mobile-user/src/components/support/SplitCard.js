// A web Card whose list body is rendered by a FlatList: the card is drawn in three
// pieces (top in ListHeaderComponent, one middle piece per row, bottom in the footer).
import { StyleSheet, View } from "react-native";

export function CardTop({ bg, border, padTop = 40, style, children }) {
  return (
    <View style={[styles.top, { backgroundColor: bg, borderColor: border, paddingTop: padTop }, style]}>
      {children}
    </View>
  );
}

export function CardMiddle({ bg, border, gapTop = 0, children }) {
  return (
    <View style={[styles.middle, { backgroundColor: bg, borderColor: border, paddingTop: gapTop }]}>{children}</View>
  );
}

export function CardBottom({ bg, border, padBottom = 40 }) {
  return <View style={[styles.bottom, { backgroundColor: bg, borderColor: border, height: padBottom }]} />;
}

const styles = StyleSheet.create({
  top: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 16,
  },
  middle: { borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 16 },
  bottom: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
});
