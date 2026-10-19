// Port of components/user/DeliveryTrackingMap.jsx: Google map with restaurant, customer and
// rider markers, the route split into traveled (dashed grey) and remaining (solid) parts,
// live rider location over the shared socket, and fit-to-bounds camera.
import { Navigation } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { GOOGLE_MAPS_API_KEY } from "../../config";
import useLatest from "../../hooks/useLatest";
import { subscribeToOrder } from "../../lib/socket";
import { useTheme } from "../../theme/ThemeContext";
import { shadow } from "../../theme/tokens";
import { resolveMediaUrl, Text } from "../ui";
import { CustomerPinIcon, RestaurantPinIcon } from "./MapIcons";
import {
  decodePolyline,
  distanceToPathMeters,
  fetchDrivingRoute,
  findClosestPointIndex,
  getHeadingFromRoutePath,
  normEncodedPolyline,
  resolveRiderHeading,
} from "./mapGeo";

const RIDER_IMAGE = require("../../../assets/images/MapRider.png");
const OFF_ROUTE_THRESHOLD_M = 120;
const LIVE_ROUTE_RECALC_MS = 15000;
const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
const PIN_BOX = 128; // room for the 64px pulse ring scaled to 2x
const PIN_SIZE = 44;
const PIN_ANCHOR = { x: 0.5, y: (PIN_BOX / 2 + PIN_SIZE / 2) / PIN_BOX };

const toLatLng = (p) => ({ latitude: p.lat, longitude: p.lng });

function imageSource(value) {
  return typeof value === "string" && value.trim() ? resolveMediaUrl(value) : null;
}

function PulseRing({ color }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          borderColor: color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
        },
      ]}
    />
  );
}

// Circular pin with an image (or the SVG pin), a pointer below and an optional pulse.
function PinMarker({ coordinate, borderColor, pulseColor, pulse, uri, Fallback }) {
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(!uri);
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    if (!settled || pulse) return undefined;
    const t = setTimeout(() => setFrozen(true), 400);
    return () => clearTimeout(t);
  }, [settled, pulse]);
  const showImage = uri && !failed;
  return (
    <Marker coordinate={coordinate} anchor={PIN_ANCHOR} tracksViewChanges={pulse || !frozen}>
      <View style={styles.pinBox}>
        {pulse ? <PulseRing color={pulseColor} /> : null}
        <View style={[styles.pinCircle, { borderColor }]}>
          <View style={styles.pinInner}>
            {showImage ? (
              <Image
                source={{ uri }}
                style={styles.fill}
                resizeMode="contain"
                onLoad={() => setSettled(true)}
                onError={() => {
                  setFailed(true);
                  setSettled(true);
                }}
              />
            ) : (
              <Fallback size={32} />
            )}
          </View>
        </View>
        <View style={[styles.pointer, { borderTopColor: borderColor }]} />
      </View>
    </Marker>
  );
}

function RiderMarker({ location }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Marker
      coordinate={toLatLng(location)}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={location.heading || 0}
      tracksViewChanges={!loaded}
      zIndex={20}
    >
      <Image source={RIDER_IMAGE} style={styles.rider} resizeMode="contain" onLoad={() => setLoaded(true)} />
    </Marker>
  );
}

function EtaBadge({ eta, color }) {
  const [blink] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);
  return (
    <View pointerEvents="none" style={styles.etaWrap}>
      <View style={[styles.eta, { backgroundColor: color + "F2" }]}>
        <Text style={styles.etaLabel}>ARRIVAL</Text>
        <View style={styles.etaRow}>
          <Text style={styles.etaValue}>{String(eta)}</Text>
          <View style={styles.etaIcons}>
            <Animated.View style={[styles.etaDot, { opacity: blink }]} />
            <Navigation size={12} color="#ffffff" style={{ transform: [{ rotate: "45deg" }] }} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DeliveryTrackingMap({
  orderId,
  orderTrackingIds = [],
  restaurantCoords,
  customerCoords,
  order = null,
  onEtaUpdate = null,
}) {
  const { colors } = useTheme();
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [riderLocation, setRiderLocation] = useState(null);
  const [smoothLocation, setSmoothLocation] = useState(null);
  const [currentEta, setCurrentEta] = useState(null);
  const [fullRoutePath, setFullRoutePath] = useState(null);
  const fullRoutePathRef = useLatest(fullRoutePath);
  const interpRef = useRef({ lastPos: null, nextPos: null, startTime: 0, durationMs: 1500 });
  const frameRef = useRef(null);
  const lastUpdateAtRef = useRef(0);
  const lastSmoothSetRef = useRef(0);
  const baselineRequestedRef = useRef(false);
  const lastEncodedPolylineRef = useRef("");
  const lastLiveRouteAtRef = useRef(0);
  const currentEtaRef = useLatest(currentEta);
  const onEtaUpdateRef = useLatest(onEtaUpdate);

  const trackingKey = useMemo(() => {
    const ids = [orderId, ...(Array.isArray(orderTrackingIds) ? orderTrackingIds : [])]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    return [...new Set(ids)].join("|");
  }, [orderId, orderTrackingIds]);

  const tripStatus = order?.status || order?.orderStatus || "pending";
  const isOrderPickedUp = ["picked_up", "out_for_delivery", "delivered"].includes(String(tripStatus).toLowerCase());

  // 1. Initial rider position from the order payload.
  const initialLoc = order?.deliveryState?.currentLocation;
  if (initialLoc && !riderLocation) {
    const lat = typeof initialLoc.lat === "number" ? initialLoc.lat : Array.isArray(initialLoc.coordinates) ? Number(initialLoc.coordinates[1]) : null;
    const lng = typeof initialLoc.lng === "number" ? initialLoc.lng : Array.isArray(initialLoc.coordinates) ? Number(initialLoc.coordinates[0]) : null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const heading = resolveRiderHeading(initialLoc.bearing || initialLoc.heading, null, lat, lng, fullRoutePath);
      setRiderLocation({ lat, lng, heading });
    }
  }

  // Align the rider heading with the route once the route is known.
  useEffect(() => {
    if (!fullRoutePath || fullRoutePath.length < 2) return;
    setRiderLocation((prev) => {
      if (!prev || prev.heading) return prev;
      const pathHead = getHeadingFromRoutePath(fullRoutePath, prev);
      if (!Number.isFinite(pathHead) || pathHead === 0) return prev;
      if (interpRef.current?.nextPos) interpRef.current.nextPos.heading = pathHead;
      return { ...prev, heading: pathHead };
    });
  }, [fullRoutePath]);

  // Smooth glide between socket positions (the web's 30 fps requestAnimationFrame loop).
  const startGlide = () => {
    if (frameRef.current) return;
    const step = () => {
      const { lastPos, nextPos, startTime, durationMs } = interpRef.current;
      if (!lastPos || !nextPos) {
        frameRef.current = null;
        return;
      }
      const duration = Math.max(600, durationMs || 1500);
      const raw = Math.min((Date.now() - startTime) / duration, 1);
      const progress = raw * raw * (3 - 2 * raw);
      let lastHead = lastPos.heading || 0;
      let nextHead = nextPos.heading || 0;
      if (Math.abs(nextHead - lastHead) > 180) {
        if (nextHead > lastHead) lastHead += 360;
        else nextHead += 360;
      }
      const now = Date.now();
      if (now - lastSmoothSetRef.current >= 33 || raw >= 1) {
        lastSmoothSetRef.current = now;
        setSmoothLocation({
          lat: lastPos.lat + (nextPos.lat - lastPos.lat) * progress,
          lng: lastPos.lng + (nextPos.lng - lastPos.lng) * progress,
          heading: (lastHead + (nextHead - lastHead) * progress) % 360,
        });
      }
      frameRef.current = raw >= 1 ? null : requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };
  const startGlideRef = useLatest(startGlide);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    },
    [],
  );

  // 2. Live rider location over the shared socket (joins tracking rooms for every id).
  const riderLocationRef = useLatest(riderLocation);
  useEffect(() => {
    const ids = trackingKey.split("|").filter(Boolean);
    if (!ids.length) return undefined;
    const apply = (data) => {
      const dataOrderId = data?.orderId || data?.order_id || data?.trackingId || data?.order?.id || data?.order?._id;
      const matchedId = dataOrderId
        ? ids.find((id) => String(id) === String(dataOrderId))
        : ids.length === 1
          ? ids[0]
          : null;
      const lat = Number(data?.lat ?? data?.boy_lat ?? data?.location?.lat ?? data?.location?.coordinates?.[1]);
      const lng = Number(data?.lng ?? data?.boy_lng ?? data?.location?.lng ?? data?.location?.coordinates?.[0]);
      if (!data || !matchedId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const prevPos = interpRef.current?.nextPos || riderLocationRef.current;
      const rawHeading = data?.heading ?? data?.bearing ?? data?.location?.heading;
      const heading = resolveRiderHeading(rawHeading, prevPos, lat, lng, fullRoutePathRef.current);
      const nextPos = { lat, lng, heading };
      const now = Date.now();
      const delta = Math.max(300, Math.min(now - (lastUpdateAtRef.current || now), 4000));
      lastUpdateAtRef.current = now;
      interpRef.current = { lastPos: interpRef.current.nextPos || nextPos, nextPos, startTime: now, durationMs: delta };
      setRiderLocation(nextPos);
      startGlideRef.current();

      if (data?.polyline) {
        const encoded = normEncodedPolyline(data.polyline);
        if (encoded && encoded !== lastEncodedPolylineRef.current) {
          lastEncodedPolylineRef.current = encoded;
          const plain = decodePolyline(encoded);
          if (plain.length > 1) setFullRoutePath(plain);
        }
      }
      if (data?.eta) {
        setCurrentEta(data.eta);
        onEtaUpdateRef.current?.(data.eta);
      }
    };
    return subscribeToOrder(ids, { onLocation: apply });
  }, [trackingKey, fullRoutePathRef, onEtaUpdateRef, riderLocationRef, startGlideRef]);

  const displayRiderLocation = smoothLocation || riderLocation;

  const routeDestination = isOrderPickedUp ? customerCoords || null : restaurantCoords || null;

  // Reset the route when the order or the leg (pickup / delivery) changes.
  const legKey = `${orderId}|${isOrderPickedUp}`;
  const firstLegRef = useRef(true);
  useEffect(() => {
    if (firstLegRef.current) {
      firstLegRef.current = false;
      return;
    }
    baselineRequestedRef.current = false;
    lastEncodedPolylineRef.current = "";
    lastLiveRouteAtRef.current = 0;
    setFullRoutePath(null);
  }, [legKey]);

  // Baseline restaurant -> customer route until the rider sends a polyline.
  const rLat = restaurantCoords?.lat;
  const rLng = restaurantCoords?.lng;
  const cLat = customerCoords?.lat;
  const cLng = customerCoords?.lng;
  const hasRoute = Boolean(fullRoutePath?.length);
  useEffect(() => {
    if (hasRoute || baselineRequestedRef.current) return undefined;
    if (![rLat, rLng, cLat, cLng].every(Number.isFinite)) return undefined;
    baselineRequestedRef.current = true;
    let active = true;
    fetchDrivingRoute({ lat: rLat, lng: rLng }, { lat: cLat, lng: cLng }).then((result) => {
      if (!active || !result) return;
      if (result.path.length > 1) setFullRoutePath(result.path);
      if (result.durationText && !currentEtaRef.current) {
        setCurrentEta(result.durationText);
        onEtaUpdateRef.current?.(result.durationText);
      }
    });
    return () => {
      active = false;
    };
  }, [hasRoute, rLat, rLng, cLat, cLng, legKey, currentEtaRef, onEtaUpdateRef]);

  // Recalculate rider -> destination when the rider leaves the current route.
  const isRiderOffRoute =
    Boolean(fullRoutePath?.length && displayRiderLocation) &&
    distanceToPathMeters(fullRoutePath, displayRiderLocation) > OFF_ROUTE_THRESHOLD_M;
  const displayRiderRef = useLatest(displayRiderLocation);
  const destRef = useLatest(routeDestination);
  useEffect(() => {
    if (!isRiderOffRoute) return;
    const origin = displayRiderRef.current;
    const destination = destRef.current;
    if (!origin || !destination) return;
    const now = Date.now();
    if (now - lastLiveRouteAtRef.current < LIVE_ROUTE_RECALC_MS) return;
    lastLiveRouteAtRef.current = now;
    fetchDrivingRoute({ lat: origin.lat, lng: origin.lng }, destination).then((result) => {
      if (!result) return;
      if (result.path.length > 1) setFullRoutePath(result.path);
      if (result.durationText) {
        setCurrentEta(result.durationText);
        onEtaUpdateRef.current?.(result.durationText);
      }
    });
  }, [isRiderOffRoute, displayRiderLocation, displayRiderRef, destRef, onEtaUpdateRef]);

  // Camera: fit restaurant, customer and rider; at most every 15 s unless the leg changed.
  const lastCameraRef = useRef({ time: 0, status: null });
  useEffect(() => {
    if (!mapReady || !restaurantCoords || !customerCoords) return;
    const now = Date.now();
    const statusChanged = lastCameraRef.current.status !== isOrderPickedUp;
    if (!statusChanged && now - lastCameraRef.current.time < 15000) return;
    lastCameraRef.current = { time: now, status: isOrderPickedUp };
    const points = [restaurantCoords, customerCoords, riderLocation].filter(Boolean).map(toLatLng);
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 100, bottom: 120, left: 60, right: 60 },
      animated: true,
    });
  }, [mapReady, riderLocation, restaurantCoords, customerCoords, isOrderPickedUp]);

  const { traveledPath, remainingPath } = useMemo(() => {
    if (!fullRoutePath || fullRoutePath.length < 2) return { traveledPath: [], remainingPath: [] };
    if (!displayRiderLocation) return { traveledPath: [], remainingPath: fullRoutePath };
    const splitIdx = findClosestPointIndex(fullRoutePath, displayRiderLocation);
    const here = { lat: displayRiderLocation.lat, lng: displayRiderLocation.lng };
    return {
      traveledPath: [...fullRoutePath.slice(0, splitIdx + 1), here],
      remainingPath: [here, ...fullRoutePath.slice(splitIdx + 1)],
    };
  }, [fullRoutePath, displayRiderLocation]);

  const remainingColor = isOrderPickedUp ? "#2b7fff" : "#00c950";
  const center = isOrderPickedUp ? customerCoords || { lat: 0, lng: 0 } : restaurantCoords || { lat: 0, lng: 0 };
  const [initialCamera] = useState(() => ({ center: toLatLng(center), zoom: 15, heading: 0, pitch: 0 }));

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={[styles.message, { backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }]}>
        <Text style={{ fontSize: 14, color: "#4a5565", textAlign: "center" }}>Loading map configuration...</Text>
      </View>
    );
  }

  const restaurantUri = imageSource(order?.restaurantLogo || order?.restaurantId?.logo || order?.restaurantId?.profileImage);
  const customerUri = imageSource(order?.customerImage || order?.userId?.profileImage || order?.userId?.avatar);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialCamera={initialCamera}
        onMapReady={() => setMapReady(true)}
        customMapStyle={MAP_STYLE}
        zoomControlEnabled
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
      >
        {traveledPath.length > 1 ? (
          <Polyline
            coordinates={traveledPath.map(toLatLng)}
            strokeColor="rgba(156,163,175,0.85)"
            strokeWidth={5}
            lineDashPattern={[12, 10]}
            zIndex={6}
          />
        ) : null}
        {remainingPath.length > 1 ? (
          <Polyline coordinates={remainingPath.map(toLatLng)} strokeColor={remainingColor} strokeWidth={6} zIndex={8} />
        ) : null}
        {restaurantCoords ? (
          <PinMarker
            key={`r|${restaurantUri}|${!isOrderPickedUp}`}
            coordinate={toLatLng(restaurantCoords)}
            borderColor={colors.primary}
            pulseColor={colors.primary + "80"}
            pulse={!isOrderPickedUp}
            uri={restaurantUri}
            Fallback={RestaurantPinIcon}
          />
        ) : null}
        {customerCoords ? (
          <PinMarker
            key={`c|${customerUri}|${isOrderPickedUp}`}
            coordinate={toLatLng(customerCoords)}
            borderColor="#00c950"
            pulseColor="rgba(34,197,94,0.5)"
            pulse={isOrderPickedUp}
            uri={customerUri}
            Fallback={CustomerPinIcon}
          />
        ) : null}
        {displayRiderLocation ? <RiderMarker location={displayRiderLocation} /> : null}
      </MapView>
      {riderLocation && currentEta ? <EtaBadge eta={currentEta} color={colors.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  message: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  fill: { width: "100%", height: "100%" },
  pinBox: { width: PIN_BOX, height: PIN_BOX, alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    left: (PIN_BOX - 64) / 2,
    top: (PIN_BOX - 64) / 2,
  },
  pinCircle: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    backgroundColor: "#ffffff",
    padding: 4,
    overflow: "hidden",
    ...shadow.xl,
  },
  pinInner: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  pointer: {
    position: "absolute",
    top: PIN_BOX / 2 + PIN_SIZE / 2 - 4,
    left: PIN_BOX / 2 - 6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  rider: { width: 64, height: 64 },
  etaWrap: { position: "absolute", top: 16, left: 16 },
  eta: {
    borderRadius: 16,
    padding: 12,
    minWidth: 90,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.5)",
    boxShadow: "0px 10px 30px rgba(249,115,22,0.4)",
  },
  etaLabel: { fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: "900", letterSpacing: 1.8, marginBottom: 2 },
  etaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  etaValue: { fontSize: 20, fontWeight: "900", color: "#ffffff", lineHeight: 24, letterSpacing: -0.5 },
  etaIcons: { flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.8 },
  etaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
});
