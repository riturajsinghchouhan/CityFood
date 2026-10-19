// ZoneSetup's Google map: zone polygons (the restaurant's zone green, the others red), the
// draggable restaurant marker with its "Restaurant Location" info window, tap to drop the marker,
// the roadmap/satellite control (mapTypeControl HORIZONTAL_BAR, TOP_RIGHT) and the loading/error
// overlays. Points are {lat, lng}; zones are the /zones/public list.
import { Loader2 } from "lucide-react-native";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polygon } from "react-native-maps";
import { tw } from "../../theme/tokens";
import { Text } from "../ui";

const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 };

export function Spinner({ size = 20, color = tw.gray400 }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

export function zonePaths(zone) {
  if (!Array.isArray(zone?.coordinates) || zone.coordinates.length < 3) return null;
  return zone.coordinates.map((c) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) }));
}

// google.maps.geometry.poly.containsLocation (ray casting).
export function containsLocation(lat, lng, path) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i, i += 1) {
    const yi = path[i].latitude;
    const xi = path[i].longitude;
    const yj = path[j].latitude;
    const xj = path[j].longitude;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const ZoneMap = forwardRef(function ZoneMap(
  { zones, assignedZoneId, marker, markerTitle, onMapPress, onMarkerDragEnd, onReady, loading, error, onRetry, onTouchStart, onTouchEnd },
  ref,
) {
  const mapRef = useRef(null);
  const [mapType, setMapType] = useState("standard");

  useImperativeHandle(ref, () => ({
    focus(lat, lng, zoom = 17) {
      mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom }, { duration: 500 });
    },
  }));

  return (
    <View style={styles.card} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {!error ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialCamera={{ center: INDIA_CENTER, zoom: 5, heading: 0, pitch: 0 }}
          mapType={mapType}
          zoomControlEnabled
          zoomEnabled
          scrollEnabled
          toolbarEnabled={false}
          showsMyLocationButton={false}
          onMapReady={onReady}
          onPress={(e) => {
            const c = e.nativeEvent?.coordinate;
            if (c) onMapPress(c.latitude, c.longitude);
          }}
        >
          {zones.map((z) => {
            const paths = zonePaths(z);
            if (!paths) return null;
            const id = z._id || z.id;
            const assigned = assignedZoneId === id;
            return (
              <Polygon
                key={String(id)}
                coordinates={paths}
                strokeColor={assigned ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.8)"}
                fillColor={assigned ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}
                strokeWidth={2}
              />
            );
          })}
          {marker ? (
            <Marker
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              draggable
              title="Restaurant Location"
              description={markerTitle || `${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}`}
              onDragEnd={(e) => {
                const c = e.nativeEvent?.coordinate;
                if (c) onMarkerDragEnd(c.latitude, c.longitude);
              }}
            />
          ) : null}
        </MapView>
      ) : (
        <View style={styles.map} />
      )}

      {!loading && !error ? (
        <View style={styles.typeControl}>
          {[
            ["standard", "Map"],
            ["satellite", "Satellite"],
          ].map(([type, label], i) => (
            <Pressable
              key={type}
              onPress={() => setMapType(type)}
              style={[styles.typeBtn, i === 0 && styles.typeBtnDivider]}
              accessibilityRole="button"
              accessibilityState={{ selected: mapType === type }}
            >
              <Text style={[styles.typeText, mapType === type && styles.typeTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.overlay}>
          <View style={styles.center}>
            <View style={styles.spinnerGap}>
              <Spinner size={32} color={tw.red600} />
            </View>
            <Text style={styles.loadingText}>Loading map...</Text>
            <Text style={styles.loadingHint}>If this takes too long, please refresh the page</Text>
          </View>
        </View>
      ) : null}
      {!loading && error ? (
        <View style={[styles.overlay, styles.errorPad]}>
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Unable to load map</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [styles.retryBtn, pressed && { backgroundColor: tw.red700 }]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
});

export default ZoneMap;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tw.gray200,
    overflow: "hidden",
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  map: { width: "100%", height: 600 },
  typeControl: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 2,
    boxShadow: "0px 1px 4px -1px rgba(0,0,0,0.3)",
  },
  typeBtn: { height: 40, paddingHorizontal: 14, justifyContent: "center" },
  typeBtnDivider: { borderRightWidth: 1, borderRightColor: "#e6e6e6" },
  typeText: { fontSize: 16, color: "#565656" },
  typeTextActive: { color: "#000000", fontWeight: "500" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", zIndex: 10 },
  errorPad: { padding: 24 },
  center: { alignItems: "center", maxWidth: 448 },
  spinnerGap: { marginBottom: 8 },
  loadingText: { fontSize: 16, color: tw.gray600 },
  loadingHint: { marginTop: 8, fontSize: 12, color: tw.gray400, textAlign: "center" },
  errorTitle: { fontSize: 16, fontWeight: "600", color: tw.red600, marginBottom: 8 },
  errorText: { fontSize: 14, color: tw.gray600, marginBottom: 16, textAlign: "center" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tw.red600, borderRadius: 8 },
  retryText: { fontSize: 16, color: "#ffffff" },
});
