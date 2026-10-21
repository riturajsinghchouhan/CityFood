// Port of DeliveryV2/components/map/LiveMap.jsx on react-native-maps (PROVIDER_GOOGLE):
//   - light custom style, no default UI; zoom comes from the parent (+/- FABs);
//   - follows the rider (web `center` prop) and fits rider + restaurant + customer every 12 s
//     (padding 70/70/120/70);
//   - DRIVING route rider -> target (restaurant while picking up, customer after pickup) through the
//     Directions REST API, refetched after 5 s (<500 m) / 20 s (<2 km) / 60 s, or at once when the rider
//     is >100 m off the route; the encoded polyline goes to the parent (pushed to the customer);
//   - travelled part grey dashed (#9ca3af), remaining part blue (#3b82f6, 8 px);
//   - rider marker MapRider.png 72x72 rotated by heading (GPS, else the route direction);
//   - restaurant / customer markers 44x44 from their images (bundled icons replace the flaticon PNGs);
//   - public service zones as #22c55e polygons at 3 % fill.
// Not ported: the web's 45° tilt/heading (no effect on its raster map) and the unused baseline
// restaurant -> customer DirectionsService request (its result was never drawn).
import { Store, UserRound } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { getPublicZones } from "../../api/zones";
import { GOOGLE_MAPS_API_KEY } from "../../config";
import { useDelivery } from "../../context/DeliveryContext";
import { calculateHeading } from "../../lib/delivery/geo";
import { TRIP_STATUS } from "../../lib/delivery/orders";
import { brand, tw } from "../../theme/tokens";
import { resolveMediaUrl } from "../ui/AppImage";
import Text from "../ui/Text";
import { distanceM, fetchDrivingRoute, parsePoint } from "./mapUtils";

const RIDER_IMAGE = require("../../../assets/images/MapRider.png");

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const FIT_EVERY_MS = 12000;
const OFF_ROUTE_M = 100;
const toLatLng = (p) => ({ latitude: p.lat, longitude: p.lng });

function closestIndex(path, point) {
  let min = Infinity;
  let idx = 0;
  for (let i = 0; i < path.length; i += 1) {
    const d = distanceM(point, path[i]);
    if (d < min) {
      min = d;
      idx = i;
    }
  }
  return { idx, min };
}

function ImageMarker({ coordinate, uri, Fallback }) {
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(!uri);
  const showImage = uri && !failed;
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!settled} zIndex={15}>
      <View style={styles.pin}>
        {showImage ? (
          <Image
            source={{ uri }}
            style={styles.pinImage}
            resizeMode="cover"
            onLoad={() => setSettled(true)}
            onError={() => {
              setFailed(true);
              setSettled(true);
            }}
          />
        ) : (
          <View style={styles.pinFallback}>
            <Fallback size={24} color={tw.gray900} />
          </View>
        )}
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
      flat
      tracksViewChanges={!loaded}
      zIndex={20}
    >
      <Image source={RIDER_IMAGE} style={styles.rider} resizeMode="contain" onLoad={() => setLoaded(true)} />
    </Marker>
  );
}

function Message({ title, body }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.message]}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
    </View>
  );
}

/**
 * mapRef: a ref that receives {centerOnRider()} for the recentre FAB.
 * onMapClick(lat, lng), onPolylineReceived(encoded), zoom (8..22).
 */
export default function LiveMap({ mapRef, onMapClick, onPolylineReceived, zoom = 14 }) {
  if (!GOOGLE_MAPS_API_KEY) {
    return <Message title="Map is not configured" body="Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in the app environment." />;
  }
  return <LiveMapView mapRef={mapRef} onMapClick={onMapClick} onPolylineReceived={onPolylineReceived} zoom={zoom} />;
}

function LiveMapView({ mapRef, onMapClick, onPolylineReceived, zoom }) {
  const { riderLocation, activeOrder, tripStatus } = useDelivery();
  const viewRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [route, setRoute] = useState(null); // {path, polyline}
  const routeRef = useRef(null);
  const lastDirectionsAtRef = useRef(0);
  const fetchingRef = useRef(false);
  const lastFitRef = useRef(0);
  const phaseRef = useRef("");
  const polylineCb = useRef(onPolylineReceived);

  useEffect(() => {
    polylineCb.current = onPolylineReceived;
  }, [onPolylineReceived]);

  const restaurantPoint = useMemo(
    () =>
      parsePoint(activeOrder?.restaurantLocation) || parsePoint(activeOrder?.restaurantId) || parsePoint(activeOrder?.restaurant),
    [activeOrder?.restaurantLocation, activeOrder?.restaurantId, activeOrder?.restaurant],
  );
  const customerPoint = useMemo(
    () =>
      parsePoint(activeOrder?.customerLocation) ||
      parsePoint(activeOrder?.deliveryAddress) ||
      parsePoint(activeOrder?.customer_address) ||
      parsePoint(activeOrder?.user),
    [activeOrder?.customerLocation, activeOrder?.deliveryAddress, activeOrder?.customer_address, activeOrder?.user],
  );

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    if (tripStatus === TRIP_STATUS.PICKING_UP || tripStatus === TRIP_STATUS.REACHED_PICKUP) return restaurantPoint;
    if (tripStatus === TRIP_STATUS.PICKED_UP || tripStatus === TRIP_STATUS.REACHED_DROP) return customerPoint;
    return null;
  }, [activeOrder, tripStatus, restaurantPoint, customerPoint]);

  // Rider position; heading from GPS, else from the route segment nearest to the rider.
  const rider = useMemo(() => {
    if (!riderLocation) return null;
    const lat = parseFloat(riderLocation.lat ?? riderLocation.latitude);
    const lng = parseFloat(riderLocation.lng ?? riderLocation.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let heading = parseFloat(riderLocation.heading || 0) || 0;
    const path = route?.path;
    if (!heading && path?.length > 1) {
      const { idx } = closestIndex(path, { lat, lng });
      const next = path[idx < path.length - 1 ? idx + 1 : idx];
      const prev = path[idx < path.length - 1 ? idx : Math.max(0, idx - 1)];
      if (prev && next && (prev.lat !== next.lat || prev.lng !== next.lng)) {
        heading = calculateHeading(prev.lat, prev.lng, next.lat, next.lng);
      }
    }
    return { lat, lng, heading };
  }, [riderLocation, route]);

  const center = rider || targetLocation;

  // Public zones once.
  useEffect(() => {
    let alive = true;
    getPublicZones()
      .then((res) => {
        const raw = res?.data?.zones;
        if (!alive || !res?.success || !Array.isArray(raw)) return;
        setZones(
          raw
            .map((zone) => ({
              id: String(zone._id || zone.id || zone.name),
              paths: (Array.isArray(zone.coordinates) ? zone.coordinates : [])
                .map((c) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) }))
                .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)),
            }))
            .filter((z) => z.paths.length >= 3),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // New phase / order: drop the old route.
  useEffect(() => {
    phaseRef.current = `${tripStatus}:${activeOrder?._id || ""}`;
    lastDirectionsAtRef.current = 0;
    routeRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoute(null);
  }, [tripStatus, activeOrder?._id]);

  // Directions refresh throttle (web shouldUpdateRoute).
  useEffect(() => {
    if (!rider || !targetLocation || fetchingRef.current) return;
    const current = routeRef.current;
    let should = !current;
    if (!should && current?.path?.length) {
      should = closestIndex(current.path, rider).min > OFF_ROUTE_M;
    }
    if (!should) {
      const dist = distanceM(rider, targetLocation);
      const throttle = dist > 2000 ? 60000 : dist > 500 ? 20000 : 5000;
      should = Date.now() - lastDirectionsAtRef.current >= throttle;
    }
    if (!should) return;
    fetchingRef.current = true;
    const phaseKey = phaseRef.current;
    fetchDrivingRoute(rider, targetLocation).then((result) => {
      fetchingRef.current = false;
      lastDirectionsAtRef.current = Date.now();
      if (!result || phaseKey !== phaseRef.current) return;
      routeRef.current = result;
      setRoute(result);
      if (result.polyline) polylineCb.current?.(result.polyline);
    });
  }, [rider, targetLocation]);

  // Follow the rider, and fit the trip into view at most every 12 s.
  useEffect(() => {
    const map = viewRef.current;
    if (!map) return;
    const hasAnchors = restaurantPoint || customerPoint;
    const now = Date.now();
    if (hasAnchors && now - lastFitRef.current >= FIT_EVERY_MS) {
      lastFitRef.current = now;
      const pts = [restaurantPoint, customerPoint, rider].filter(Boolean).map(toLatLng);
      map.fitToCoordinates(pts, { edgePadding: { top: 70, right: 70, bottom: 120, left: 70 }, animated: true });
      return;
    }
    if (rider) map.animateCamera({ center: toLatLng(rider) }, { duration: 500 });
  }, [rider, restaurantPoint, customerPoint]);

  // Zoom from the parent's +/- buttons.
  useEffect(() => {
    viewRef.current?.animateCamera({ zoom }, { duration: 250 });
  }, [zoom]);

  // Recentre FAB (web handleCenterMap -> panTo).
  useEffect(() => {
    if (!mapRef) return undefined;
    mapRef.current = {
      centerOnRider: () => {
        if (rider) viewRef.current?.animateCamera({ center: toLatLng(rider) }, { duration: 400 });
      },
    };
    return () => {
      mapRef.current = null;
    };
  }, [mapRef, rider]);

  const { remainingPath, traveledPath } = useMemo(() => {
    const full = route?.path;
    if (!rider || !Array.isArray(full) || !full.length) return { remainingPath: [], traveledPath: [] };
    const { idx } = closestIndex(full, rider);
    let start = idx;
    if (idx < full.length - 1) {
      const toCurrent = distanceM(rider, full[idx]);
      const toNext = distanceM(rider, full[idx + 1]);
      const segment = distanceM(full[idx], full[idx + 1]);
      if (toNext < segment && toNext < toCurrent) start = idx + 1;
    }
    const point = { lat: rider.lat, lng: rider.lng };
    return {
      traveledPath: [...full.slice(0, start), point].map(toLatLng),
      remainingPath: [point, ...full.slice(start)].map(toLatLng),
    };
  }, [route, rider]);

  const restaurantImage = resolveMediaUrl(
    activeOrder?.restaurantImage || activeOrder?.restaurant?.logo || activeOrder?.restaurant?.profileImage || "",
  );
  const customerImage = resolveMediaUrl(
    activeOrder?.customerImage || activeOrder?.user?.logo || activeOrder?.user?.profileImage || "",
  );

  // The camera is set once, from the first known centre; later moves are imperative.
  const [initialCamera, setInitialCamera] = useState(null);
  if (!initialCamera && center) setInitialCamera({ center: toLatLng(center), zoom, heading: 0, pitch: 0 });

  if (!center || !initialCamera) {
    return (
      <Message title="Current location unavailable" body="Enable precise location to view your delivery zone." />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={viewRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={MAP_STYLE}
        initialCamera={initialCamera}
        toolbarEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsIndoors={false}
        pitchEnabled={false}
        rotateEnabled
        onPress={(e) => {
          const c = e.nativeEvent?.coordinate;
          onMapClick?.(c?.latitude, c?.longitude);
        }}
      >
        {zones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.paths}
            fillColor="rgba(34,197,94,0.03)"
            strokeColor="rgba(34,197,94,0.1)"
            strokeWidth={1}
            zIndex={1}
          />
        ))}
        {traveledPath.length > 1 ? (
          <Polyline
            coordinates={traveledPath}
            strokeColor={brand.routeGrey}
            strokeWidth={4}
            lineDashPattern={[4, 6]}
            zIndex={10}
          />
        ) : null}
        {remainingPath.length > 1 ? (
          <Polyline coordinates={remainingPath} strokeColor="rgba(59,130,246,0.9)" strokeWidth={8} zIndex={12} />
        ) : null}
        {restaurantPoint ? (
          <ImageMarker
            key={`r-${restaurantImage || "none"}`}
            coordinate={toLatLng(restaurantPoint)}
            uri={restaurantImage}
            Fallback={Store}
          />
        ) : null}
        {customerPoint ? (
          <ImageMarker
            key={`c-${customerImage || "none"}`}
            coordinate={toLatLng(customerPoint)}
            uri={customerImage}
            Fallback={UserRound}
          />
        ) : null}
        {rider ? <RiderMarker location={rider} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  rider: { width: 72, height: 72 },
  pin: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pinImage: { width: 44, height: 44 },
  pinFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tw.gray200,
  },
  message: { alignItems: "center", justifyContent: "center", backgroundColor: tw.gray50, paddingHorizontal: 32 },
  messageTitle: { fontWeight: "900", color: tw.gray900, textAlign: "center" },
  messageBody: { marginTop: 8, fontSize: 14, fontWeight: "500", color: tw.gray500, textAlign: "center" },
});
