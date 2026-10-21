// DeliveryV2/pages/help/ShowIdCardV2 (/help/id-card): the partner ID card — photo (ui-avatars
// fallback), company name, status badge, full name, partner ID, mobile, registered vehicle and the
// validity line (createdAt + 1 year). The web offers no download/share, so neither does this.
import dayjs from "dayjs";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBusinessSettings, getProfile } from "../../api";
import Spinner from "../../components/content/Spinner";
import { Screen, Text, toast } from "../../components/ui";
import { resolveMediaUrl } from "../../components/ui/AppImage";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, shadow, tw } from "../../theme/tokens";

const YELLOW_500 = "#f0b100";

const avatarFallback = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Delivery Partner")}&background=ff8100&color=fff&size=128`;

function statusOf(profile) {
  return profile?.status?.toLowerCase() || (profile?.isActive ? "active" : "inactive");
}

function statusColor(profile) {
  if (!profile) return dvColor("bg-green-500", light);
  const s = statusOf(profile);
  if (s === "active" || s === "approved") return dvColor("bg-green-500", light);
  if (s === "pending") return YELLOW_500;
  if (s === "suspended" || s === "blocked") return tw.red500;
  return tw.gray500;
}

function useCompanyName() {
  const [companyName, setCompanyName] = useState("CityFood");
  useEffect(() => {
    let alive = true;
    getBusinessSettings()
      .then((res) => {
        if (alive && res?.data?.companyName) setCompanyName(res.data.companyName);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return companyName;
}

export default function IdCardScreen() {
  const goBack = useAppBack();
  const insets = useSafeAreaInsets();
  const companyName = useCompanyName();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getProfile();
        if (!alive) return;
        if (res?.success && res?.data?.profile) setProfileData(res.data.profile);
        else toast.error("Failed to load profile data");
      } catch {
        if (alive) toast.error("Failed to load ID card data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <Screen background={tw.gray100}>
        <View style={styles.center}>
          <Spinner size={32} color={tw.gray600} />
          <Text style={styles.stateText}>Loading ID card...</Text>
        </View>
      </Screen>
    );
  }

  if (!profileData) {
    return (
      <Screen background={tw.gray100}>
        <View style={styles.center}>
          <Text style={[styles.stateText, { marginBottom: 16 }]}>Failed to load ID card data</Text>
          <Pressable onPress={goBack} style={styles.goBackBtn}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const created = profileData.createdAt ? dayjs(profileData.createdAt).add(1, "year") : dayjs();
  const status = statusOf(profileData);
  const vehicle = profileData.vehicle;
  const vehicleParts = [];
  if (vehicle?.type) vehicleParts.push(vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1));
  if (vehicle?.number) vehicleParts.push(vehicle.number);

  const card = {
    name: profileData.name || "Delivery Partner",
    id: profileData.deliveryId || profileData._id?.toString().slice(-8).toUpperCase() || "N/A",
    phone: profileData.phone || "N/A",
    status: status.charAt(0).toUpperCase() + status.slice(1),
    statusColor: statusColor(profileData),
    validTill: created.isValid() ? created.format("D MMMM YYYY") : "Invalid Date",
    vehicle: vehicleParts.length > 0 ? vehicleParts.join(" - ") : null,
  };

  const photoUrl = profileData?.profileImage?.url || profileData?.documents?.photo || null;
  const imageUri = !photoUrl || imageFailed ? avatarFallback(card.name) : resolveMediaUrl(photoUrl);

  return (
    <Screen edges={[]} background={tw.gray100}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={[styles.top, { height: 160 + insets.top }]}>
          <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.photoWrap}>
            <View style={styles.photoRing}>
              <Image
                source={{ uri: imageUri }}
                style={styles.photo}
                contentFit="cover"
                transition={150}
                onError={() => {
                  if (!imageFailed) setImageFailed(true);
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.main}>
          <Text style={styles.company}>{companyName}</Text>
          <Text heading style={styles.partner}>
            PARTNER
          </Text>
          <Text heading style={styles.idCard}>
            ID CARD
          </Text>

          <View style={[styles.badge, { backgroundColor: card.statusColor }]}>
            <Text style={styles.badgeText}>{card.status}</Text>
          </View>

          <View style={styles.details}>
            <View style={styles.itemCenter}>
              <Text heading style={styles.fullName}>
                {card.name}
              </Text>
              <Text style={styles.fullNameLabel}>Full Name</Text>
            </View>

            <View style={styles.grid}>
              <View style={[styles.itemCenter, styles.flex1]}>
                <Text style={styles.value}>{card.id}</Text>
                <Text style={styles.smallLabel}>Partner ID</Text>
              </View>
              <View style={[styles.itemCenter, styles.flex1]}>
                <Text style={styles.value}>{card.phone}</Text>
                <Text style={styles.smallLabel}>Mobile</Text>
              </View>
            </View>

            {card.vehicle ? (
              <View style={styles.vehicleBox}>
                <Text style={[styles.value, { textTransform: "uppercase" }]}>{card.vehicle}</Text>
                <Text style={styles.smallLabel}>Registered Vehicle</Text>
              </View>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                This ID card is issued for essential delivery services only.{"\n"}Valid On: {card.validTill}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Pressable
        onPress={goBack}
        style={[styles.close, { top: insets.top + 16 }]}
        hitSlop={6}
        accessibilityLabel="Close"
      >
        <X size={24} color="#000000" />
      </Pressable>
    </Screen>
  );
}

const TRACK_WIDEST = (size) => size * 0.1;

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 16 },
  stateText: { fontSize: 16, lineHeight: 24, color: tw.gray600, textAlign: "center" },
  goBackBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: brand.primary, borderRadius: 10 },
  goBackText: { fontSize: 16, lineHeight: 24, color: "#ffffff" },
  scroll: { flexGrow: 1 },
  close: {
    position: "absolute",
    right: 16,
    padding: 8,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.5)",
    zIndex: 30,
  },
  top: { backgroundColor: tw.gray300, zIndex: 10 },
  photoWrap: { position: "absolute", left: 0, right: 0, bottom: -78, alignItems: "center" },
  photoRing: { padding: 6, backgroundColor: "#ffffff", borderRadius: 9999, ...shadow["2xl"] },
  photo: { width: 144, height: 144, borderRadius: 72, borderWidth: 4, borderColor: tw.gray100 },
  main: {
    flexGrow: 1,
    backgroundColor: "#ffffff",
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  company: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: brand.primary,
    textTransform: "uppercase",
    letterSpacing: 12 * 0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  partner: { fontSize: 36, lineHeight: 45, fontWeight: "900", color: tw.gray900, marginBottom: 4, textAlign: "center" },
  idCard: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: TRACK_WIDEST(20),
    marginBottom: 24,
    textAlign: "center",
  },
  badge: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 9999,
    marginBottom: 32,
    boxShadow: "0px 10px 15px -3px rgba(21,73,139,0.35), 0px 4px 6px -4px rgba(21,73,139,0.35)",
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 12 * 0.2,
  },
  details: { width: "100%", marginTop: 16, gap: 32 },
  itemCenter: { alignItems: "center" },
  fullName: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    color: tw.gray950,
    textTransform: "uppercase",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  fullNameLabel: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 4,
  },
  grid: { flexDirection: "row", gap: 32, width: "100%" },
  value: { fontSize: 14, lineHeight: 20, fontWeight: "900", color: tw.gray950, textAlign: "center" },
  smallLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: TRACK_WIDEST(9),
  },
  vehicleBox: {
    alignItems: "center",
    backgroundColor: tw.gray50,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.dvBorder,
    ...brand.cardShadow,
  },
  footer: { paddingTop: 16, borderTopWidth: 1, borderTopColor: tw.gray100 },
  footerText: {
    fontSize: 10,
    lineHeight: 20,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
});
