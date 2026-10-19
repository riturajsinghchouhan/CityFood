// Port of pages/restaurant/EditOwner.jsx (/edit-owner, "Contact details"). On web every field is
// readOnly/disabled, nothing calls handleSave, "Photo View" has no handler, the delete dialog is
// never opened and the Places input it waits for is never rendered, so the screen is a read-only
// view of the owner, location and bank details (plus the pending-update banner).
import { Clock, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { getCurrentRestaurant, getPublicZones } from "../../api";
import { PageHeader, extra } from "../../components/outlet/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, Text } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { tw } from "../../theme/tokens";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  photo: null,
  restaurantName: "",
  primaryContactNumber: "",
  pureVegRestaurant: false,
  panNumber: "",
  nameOnPan: "",
  accountNumber: "",
  ifscCode: "",
  accountHolderName: "",
  accountType: "",
  upiId: "",
  zoneId: "",
  location: { addressLine1: "", area: "", city: "", pincode: "" },
};

const CITIES = ["Indore", "Bhopal", "Mumbai", "Pune", "Delhi", "Bangalore"];
const ACCOUNT_TYPES = ["Savings", "Current"];

// Disabled shadcn Input (readOnly): bg-gray-50 border-gray-200 text-gray-500; opacity 50 while loading.
function ROInput({ value, placeholder, disabled, style }) {
  const empty = value === "" || value == null;
  return (
    <View style={[styles.input, disabled && styles.disabled, style]}>
      <Text style={[styles.inputText, empty && styles.placeholder]} numberOfLines={1}>
        {empty ? placeholder : value}
      </Text>
    </View>
  );
}

// Disabled Radix Select: shows the item label when the value is one of its items, the placeholder
// when empty, and nothing for an unknown value.
function ROSelect({ value, items, placeholder, style }) {
  const shown = !value ? placeholder : items.includes(value) ? value : "";
  return (
    <View style={[styles.input, styles.disabled, style]}>
      <Text style={[styles.selectText, !value && styles.placeholder]} numberOfLines={1}>
        {shown}
      </Text>
    </View>
  );
}

function Labeled({ label, children, hint }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function SectionHead({ title, caption }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

export default function EditOwnerScreen() {
  const goBack = useAppBack();
  const shellInset = useShellBottomInset();
  const [formData, setFormData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [restaurantStatus, setRestaurantStatus] = useState({ status: "", pendingUpdateReason: "", approvedAt: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCurrentRestaurant();
        const data = res?.data?.restaurant;
        if (data && !cancelled) {
          setFormData({
            name: data.ownerName || data.name || "",
            phone: data.ownerPhone || data.primaryContactNumber || data.phone || "",
            email: data.ownerEmail || data.email || "",
            photo: data.profileImage?.url || null,
            restaurantName: data.restaurantName || "",
            primaryContactNumber: data.primaryContactNumber || "",
            pureVegRestaurant: !!data.pureVegRestaurant,
            panNumber: data.panNumber || "",
            nameOnPan: data.nameOnPan || "",
            accountNumber: data.accountNumber || "",
            ifscCode: data.ifscCode || "",
            accountHolderName: data.accountHolderName || "",
            accountType: data.accountType || "",
            upiId: data.upiId || "",
            zoneId: data.zoneId || "",
            location: {
              addressLine1: data.location?.addressLine1 || "",
              area: data.location?.area || data.area || "",
              city: data.location?.city || data.city || "",
              pincode: data.location?.pincode || data.pincode || "",
            },
          });
          setRestaurantStatus({
            status: data.status || "",
            pendingUpdateReason: data.pendingUpdateReason || "",
            approvedAt: data.approvedAt || null,
          });
        }
      } catch {
        // web falls back to a localStorage copy that only its (unreachable) save writes
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicZones()
      .then((res) => {
        const list = res?.data?.zones || [];
        if (!cancelled) setZones(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showPending =
    restaurantStatus.status === "pending" &&
    (restaurantStatus.approvedAt ||
      (restaurantStatus.pendingUpdateReason && restaurantStatus.pendingUpdateReason !== "New Registration"));
  const reason = restaurantStatus.pendingUpdateReason;
  const zone = zones.find((z) => String(z?._id || z?.id || "") === String(formData.zoneId || ""));
  const zoneLabel = formData.zoneId && zone
    ? zone.name || zone.zoneName || zone.serviceLocation || String(zone._id || zone.id)
    : zonesLoading
      ? "Loading zones..."
      : "Select a zone";
  const v = (value) => (loading ? "Loading..." : value);

  return (
    <View style={styles.page}>
      <PageHeader title="Contact details" onBack={goBack} />
      <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingBottom: 24 + shellInset }]}>
        {showPending ? (
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Clock size={20} color={extra.amber600} />
            </View>
            <View style={styles.fill}>
              <Text style={styles.bannerTitle}>{reason || "Update Pending"}</Text>
              <Text style={styles.bannerText}>
                Your restaurant <Text style={styles.bold}>{reason || "profile update"}</Text> is pending approval. Please
                wait for admin response.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.photoBlock}>
          <View style={styles.avatar}>
            {!loading && formData.photo ? (
              <AppImage src={formData.photo} width={96} style={StyleSheet.absoluteFill} placeholderType="none" />
            ) : (
              <User size={48} color={tw.gray500} />
            )}
          </View>
          <Text style={[styles.photoView, loading && styles.disabled]}>Photo View</Text>
        </View>

        <View style={styles.fields}>
          <Labeled label="Restaurant Name">
            <ROInput value={v(formData.restaurantName)} placeholder="Enter restaurant name" disabled={loading} />
          </Labeled>

          <View style={styles.vegRow}>
            <View style={styles.vegLeft}>
              <View style={[styles.vegBox, { borderColor: formData.pureVegRestaurant ? tw.green600 : tw.red600 }]}>
                <View style={[styles.vegDot, { backgroundColor: formData.pureVegRestaurant ? tw.green600 : tw.red600 }]} />
              </View>
              <Text style={styles.vegLabel}>Pure Veg Restaurant</Text>
            </View>
            <View style={[styles.vegToggle, { backgroundColor: formData.pureVegRestaurant ? tw.green600 : tw.red600 }]}>
              <View style={[styles.vegKnob, { left: formData.pureVegRestaurant ? 28 : 4 }]} />
            </View>
          </View>

          <Labeled label="Owner Name">
            <ROInput value={v(formData.name)} placeholder="Enter owner name" disabled={loading} />
          </Labeled>
          <Labeled label="Login Phone Number" hint="* Login number cannot be changed from here.">
            <ROInput value={v(formData.phone)} placeholder="Enter phone number" disabled={loading} />
          </Labeled>
          <Labeled label="Primary Contact Number">
            <ROInput value={v(formData.primaryContactNumber)} placeholder="Enter contact number" disabled={loading} />
          </Labeled>
          <Labeled label="Email Address">
            <ROInput value={v(formData.email)} placeholder="Enter email address" disabled={loading} />
          </Labeled>

          <SectionHead title="Restaurant Location" caption="ZONE & ADDRESS" />

          <Labeled label="Service Zone*">
            <View style={[styles.input, styles.zoneSelect]}>
              <Text style={styles.selectText} numberOfLines={1}>
                {zoneLabel}
              </Text>
            </View>
          </Labeled>

          <ROInput value={formData.location.addressLine1} placeholder="Shop no. / building no." disabled={loading} />
          <ROInput value={formData.location.area} placeholder="Area / Sector / Locality*" disabled={loading} />
          <View style={styles.twoCol}>
            <ROSelect value={formData.location.city} items={CITIES} placeholder="Select City*" style={styles.col} />
            <ROInput value={formData.location.pincode} placeholder="Pincode*" disabled={loading} style={styles.col} />
          </View>

          <SectionHead title="Financial Details" caption="PAN & BANK ACCOUNT" />

          <Labeled label="PAN Number">
            <ROInput value={v(formData.panNumber)} placeholder="ABCDE1234F" disabled={loading} />
          </Labeled>
          <Labeled label="Name on PAN Card">
            <ROInput value={v(formData.nameOnPan)} placeholder="Enter name as per PAN" disabled={loading} />
          </Labeled>
          <Labeled label="Bank Account Number">
            <ROInput value={v(formData.accountNumber)} placeholder="Enter account number" disabled={loading} />
          </Labeled>
          <Labeled label="Account Type">
            <ROSelect value={formData.accountType} items={ACCOUNT_TYPES} placeholder="Select account type" />
          </Labeled>
          <Labeled label="IFSC Code">
            <ROInput value={v(formData.ifscCode)} placeholder="SBIN0001234" disabled={loading} />
          </Labeled>
          <Labeled label="UPI ID (Optional)">
            <ROInput value={v(formData.upiId)} placeholder="name@okaxis" disabled={loading} />
          </Labeled>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  fill: { flex: 1 },
  bold: { fontWeight: "700" },
  disabled: { opacity: 0.5 },
  content: { paddingHorizontal: 16, paddingTop: 24, gap: 24 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: extra.amber50,
    borderWidth: 1,
    borderColor: extra.amber200,
    borderRadius: 16,
    padding: 16,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)",
  },
  bannerIcon: { backgroundColor: extra.amber100, padding: 8, borderRadius: 12 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: extra.amber900 },
  bannerText: { marginTop: 4, fontSize: 12, lineHeight: 19, color: extra.amber700 },
  photoBlock: { alignItems: "center", gap: 12 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 9999,
    backgroundColor: tw.gray200,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoView: { fontSize: 14, color: tw.blue600 },
  fields: { gap: 16 },
  label: { fontSize: 14, fontWeight: "500", color: tw.gray700, marginBottom: 8 },
  hint: { marginTop: 4, fontSize: 10, color: tw.gray400 },
  input: {
    height: 36,
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tw.gray200,
    backgroundColor: tw.gray50,
    paddingHorizontal: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  inputText: { fontSize: 16, color: tw.gray500 },
  placeholder: { color: tw.gray500 },
  selectText: { fontSize: 14, color: tw.gray500 },
  zoneSelect: { height: 40 },
  vegRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: tw.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.gray100,
  },
  vegLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  vegBox: { width: 16, height: 16, borderWidth: 2, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 8, height: 8, borderRadius: 9999 },
  vegLabel: { fontSize: 14, fontWeight: "600", color: tw.gray700 },
  vegToggle: { width: 48, height: 24, borderRadius: 9999 },
  vegKnob: { position: "absolute", top: 4, width: 16, height: 16, borderRadius: 9999, backgroundColor: "#ffffff" },
  sectionHead: { paddingTop: 24, paddingBottom: 8, borderTopWidth: 1, borderTopColor: tw.gray100 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  sectionCaption: { marginTop: 4, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: tw.gray400 },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
});
