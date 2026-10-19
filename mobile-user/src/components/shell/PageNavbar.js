// Port of components/user/PageNavbar.jsx: the transparent header row used by Dining
// (logo, centered location selector, wallet and cart buttons, optional profile).
// The web component computes a long main/sub location in a memo but renders only
// area / address / city, so only that part is ported.
import * as Location from "expo-location";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronDown, ShoppingCart, Wallet } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useCart } from "../../context/CartContext";
import { useAppLocation } from "../../context/LocationContext";
import useLatest from "../../hooks/useLatest";
import { useTheme } from "../../theme/ThemeContext";
import Text from "../ui/Text";
import { toast } from "../ui/Toast";

const LOGO_HEIGHT = 32 * 1.2; // h-8 with scale-[1.2]

const isPlaceholder = (loc) =>
  !loc || loc.formattedAddress === "Select location" || loc.city === "Current Location";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function NavLogo({ uri, companyName }) {
  const [aspect, setAspect] = useState(null);
  const [failed, setFailed] = useState(false);
  if (failed) return null; // web hides the <img> on error
  return (
    <Image
      source={{ uri }}
      style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * (aspect || 1) }}
      contentFit="contain"
      accessibilityLabel={companyName || "Company Logo"}
      onLoad={(e) => {
        const { width, height } = e?.source || {};
        if (width > 0 && height > 0) setAspect(width / height);
      }}
      onError={() => setFailed(true)}
    />
  );
}

function CircleButton({ onPress, label, isDark, children }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.circle,
        { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(243,244,246,0.5)", opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * textColor: "white" (white text/icons, over a dark or image background) or anything else
 * (primary-colored, as Dining uses with "dark"). showProfile adds the "A" profile button.
 * showLogo shows the company logo on the left. onNavClick runs on any tap inside the bar.
 */
export default function PageNavbar({ textColor = "white", showProfile = false, showLogo = true, onNavClick, style }) {
  const { colors, isDark } = useTheme();
  const { location, storedLocation, loading, requestLocation, ready } = useAppLocation();
  const { itemCount } = useCart();
  const { logo: logoUrl, companyName } = useAppSettings();
  const autoLocationAttemptedRef = useRef(false);
  const requestLocationRef = useLatest(requestLocation);

  // Web: once, 1.2 s after mount, when there are no stored coordinates and the location is
  // missing/placeholder: fetch GPS if permission is already granted, else send the user
  // to the address selector with a toast.
  useEffect(() => {
    if (!ready || autoLocationAttemptedRef.current || loading) return undefined;
    const lat = Number(storedLocation?.latitude);
    const lng = Number(storedLocation?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return undefined;
    if (!isPlaceholder(location)) return undefined;
    autoLocationAttemptedRef.current = true;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission?.granted) {
          router.push("/address-selector");
          toast.error("Please enter location or enable GPS");
          return;
        }
        const fetched = await requestLocationRef.current();
        if (cancelled) return;
        if (isPlaceholder(fetched)) {
          router.push("/address-selector");
          toast.error("Please enter location or enable GPS");
        }
      } catch {
        // web: ignored
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [ready, location, loading, storedLocation, requestLocationRef]);

  // Reset the one-time attempt once the location is valid, so a later invalid state can retry.
  useEffect(() => {
    if (!isPlaceholder(location)) autoLocationAttemptedRef.current = false;
  }, [location]);

  const areaName = location?.area && location.area.trim() ? location.area.trim() : "Select Location";
  const cityName = location?.city || "Indore";
  const fullAddress = location?.address || location?.formattedAddress || "";
  const savedAddressLabel =
    (location?.label && String(location.label).trim()) || (storedLocation?.label && String(storedLocation.label).trim()) || "";

  const displayArea = /^-?\d+(\.\d+)?$/.test(areaName.trim()) ? "Current Location" : areaName;

  const displayAddress = useMemo(() => {
    if (savedAddressLabel) return `Delivering to ${savedAddressLabel}`;
    let addr = fullAddress || "";
    if (cityName) addr = addr.replace(new RegExp(`,?\\s*${escapeRegExp(cityName)}\\s*`, "gi"), "").trim();
    if (areaName && areaName.length > 3) addr = addr.replace(new RegExp(`^${escapeRegExp(areaName)},?\\s*`, "i"), "").trim();
    const coords = /^-?\d+\.\d+,\s*-?\\s*\d+\.\d+$/;
    if (coords.test(fullAddress.trim()) || coords.test(addr.trim()) || !addr || addr === ",") return "Pinpoint location";
    return addr;
  }, [fullAddress, cityName, areaName, savedAddressLabel]);

  const isWhite = textColor === "white";
  const textMain = isWhite ? "#ffffff" : colors.primary;
  const iconColor = isWhite ? "#ffffff" : isDark ? "#a14b84" : colors.primary;

  return (
    <View style={[styles.nav, style]} onTouchStart={onNavClick}>
      <View style={styles.row}>
        {showLogo ? (
          <Pressable onPress={() => router.push("/")} style={styles.logo}>
            {logoUrl ? (
              <NavLogo uri={logoUrl} companyName={companyName} />
            ) : (
              <Text style={[styles.companyName, { color: textMain }]}>{companyName || "CityFood"}</Text>
            )}
          </Pressable>
        ) : null}

        <View style={styles.center} pointerEvents="box-none">
          <Pressable onPress={() => router.push("/address-selector")} disabled={loading} style={styles.locationBtn}>
            {loading ? (
              <Text style={[styles.loadingText, { color: textMain }]}>Loading...</Text>
            ) : (
              <View style={styles.locationCol}>
                <View style={styles.areaRow}>
                  <Text numberOfLines={1} style={[styles.area, { color: textMain }]}>
                    {displayArea}
                  </Text>
                  <ChevronDown size={12} color={textMain} strokeWidth={2.5} />
                </View>
                {displayAddress ? (
                  <Text numberOfLines={1} style={[styles.address, { color: textMain, opacity: 0.7 }]}>
                    {displayAddress}
                  </Text>
                ) : null}
                <Text style={[styles.city, { color: textMain, opacity: 0.6 }]}>{cityName.toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.actions}>
          <CircleButton onPress={() => router.push("/wallet")} label="Wallet" isDark={isDark}>
            <Wallet size={18} color={iconColor} strokeWidth={3} />
          </CircleButton>
          <View>
            <CircleButton onPress={() => router.push("/cart")} label="Cart" isDark={isDark}>
              <ShoppingCart size={18} color={iconColor} strokeWidth={3} />
            </CircleButton>
            {itemCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]} pointerEvents="none">
                <Text style={styles.badgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
              </View>
            ) : null}
          </View>
          {showProfile ? (
            <CircleButton onPress={() => router.push("/profile")} label="Profile" isDark={isDark}>
              <Text style={[styles.profileText, { color: iconColor }]}>A</Text>
            </CircleButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: "100%", paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  logo: { marginRight: 12, flexShrink: 0 },
  companyName: { fontSize: 16, fontWeight: "700" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  locationBtn: { alignItems: "center" },
  loadingText: { fontSize: 14, fontWeight: "700" },
  locationCol: { alignItems: "center", maxWidth: 160 },
  areaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  area: { fontSize: 12, fontWeight: "700", maxWidth: 140 },
  address: { fontSize: 9, fontWeight: "500", maxWidth: 140, textAlign: "center" },
  city: { fontSize: 9, fontWeight: "900", letterSpacing: 1.8, textAlign: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "900", lineHeight: 12 },
  profileText: { fontSize: 14, fontWeight: "900" },
});
