// Port of pages/restaurant/OutletInfo.jsx (/outlet-info): outlet banner, logo with "Change Logo"
// (POST profile-image), rating link, and the read-only restaurant/basic/compliance/bank cards with
// an edit dialog that PATCHes /profile. As on web there is no re-approval warning.
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, ChevronRight, Star, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { getCurrentRestaurant, resolveImage, updateProfile, uploadProfileImage } from "../../api";
import ImageSourcePicker from "../../components/auth/onboarding/ImageSourcePicker";
import { CenterSheet } from "../../components/menu/common";
import { getUploadErrorMessage } from "../../components/menu/uploadErrors";
import { openShellRoute } from "../../components/shell/navigate";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, Text, inputFont, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAppBack } from "../../navigation/back";
import { brand, tw } from "../../theme/tokens";

const DEFAULT_MAIN = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop";
const DEFAULT_THUMB = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop";
const PINK = brand.outletPink; // #E91E63
const PINK_SOFT = "#FFEAF0";

const EDIT_TITLES = {
  restaurantName: "Restaurant Name",
  basic: "Basic Details",
  compliance: "Compliance Details",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) -> "05 Mar 2027"
function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "");

// <input type="date"> value (YYYY-MM-DD, UTC like toISOString) or "".
function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

const imageUrlOf = (v) => (typeof v === "string" ? v : v?.url) || "";

function StatusChip({ status }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{capitalize(status || "Approved")}</Text>
    </View>
  );
}

function Field({ label, value, style }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, style]}>{value}</Text>
    </View>
  );
}

function CardHeader({ title, status, onEdit, small }) {
  return (
    <View style={[styles.cardHead, !small && styles.cardHeadGap]}>
      <View style={styles.cardHeadLeft}>
        <Text style={small ? styles.nameLabel : styles.cardTitle}>{title}</Text>
        <StatusChip status={status} />
      </View>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Text style={styles.editLink}>Edit</Text>
      </Pressable>
    </View>
  );
}

function EditInput({ label, value, onChangeText, placeholder, upper, keyboardType }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tw.gray400}
        autoCapitalize={upper ? "characters" : "sentences"}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, inputFont, focused && styles.inputFocused]}
      />
    </View>
  );
}

function DateInput({ label, value, onChange }) {
  const open = () => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    DateTimePickerAndroid.open({
      value: Number.isNaN(base.getTime()) ? new Date() : base,
      mode: "date",
      onValueChange: (_event, date) => {
        if (!date) return;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        onChange(`${y}-${m}-${d}`);
      },
    });
  };
  const [y, m, d] = value ? value.split("-") : [];
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable onPress={open} style={[styles.input, styles.dateInput]}>
        <Text style={[styles.dateText, !value && { color: tw.gray400 }]}>{value ? `${d}/${m}/${y}` : "dd/mm/yyyy"}</Text>
      </Pressable>
    </View>
  );
}

export default function OutletInfoScreen() {
  const goBack = useAppBack();
  const shellInset = useShellBottomInset();
  const { updateRestaurant } = useAuth();

  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [mainImage, setMainImage] = useState(DEFAULT_MAIN);
  const [thumbnailImage, setThumbnailImage] = useState(DEFAULT_THUMB);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantMongoId, setRestaurantMongoId] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const applyRestaurantData = (data) => {
    if (!data) return;
    setRestaurantData(data);
    setRestaurantName(data.name || data.restaurantName || "");
    setRestaurantId(data.restaurantId || data.id || "");
    setRestaurantMongoId(String(data.id || data._id || ""));
    const profileImageUrl = imageUrlOf(data.profileImage);
    if (profileImageUrl) setThumbnailImage(profileImageUrl);
    const coverImages = Array.isArray(data.coverImages) ? data.coverImages : [];
    const firstCover = imageUrlOf(coverImages[0]);
    if (firstCover) setMainImage(firstCover);
    else if (profileImageUrl) setMainImage(profileImageUrl);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getCurrentRestaurant();
        if (!cancelled) applyRestaurantData(res?.data?.restaurant);
      } catch {
        // web keeps the placeholders
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = async () => {
    const res = await getCurrentRestaurant({ noCache: true });
    const data = res?.data?.restaurant;
    applyRestaurantData(data);
    if (data) updateRestaurant(data);
  };

  const handleProfileImageReplace = async (file) => {
    if (!file) return;
    try {
      setUploadingImage(true);
      const res = await uploadProfileImage(file);
      const uploaded = res?.data?.profileImage;
      if (uploaded?.url) {
        setThumbnailImage(uploaded.url);
        await refetch();
      }
    } catch (error) {
      toast.error(getUploadErrorMessage(error, { fallback: "Failed to upload image." }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditClick = (section) => {
    setEditSection(section);
    setEditFormData({ ...(restaurantData || {}) });
    setEditModalOpen(true);
  };

  const setField = (key) => (value) => setEditFormData((prev) => ({ ...prev, [key]: value }));

  const handleEditSave = async () => {
    try {
      setSavingEdit(true);
      const payload = {};
      if (editSection === "restaurantName") {
        payload.restaurantName = editFormData.restaurantName || editFormData.name;
      } else if (editSection === "basic") {
        payload.ownerName = editFormData.ownerName;
        payload.primaryContactNumber = editFormData.primaryContactNumber;
        payload.ownerEmail = editFormData.ownerEmail || editFormData.email;
        payload.pureVegRestaurant = editFormData.pureVegRestaurant;
      } else if (editSection === "compliance") {
        payload.panNumber = editFormData.panNumber;
        payload.gstNumber = editFormData.gstNumber;
        payload.fssaiNumber = editFormData.fssaiNumber;
        payload.fssaiExpiry = editFormData.fssaiExpiry;
      } else if (editSection === "bank") {
        payload.accountHolderName = editFormData.accountHolderName;
        payload.accountNumber = editFormData.accountNumber;
        payload.ifscCode = editFormData.ifscCode;
        payload.upiId = editFormData.upiId;
      }
      await updateProfile(payload);
      toast.success("Details updated successfully!");
      await refetch();
      setEditModalOpen(false);
    } catch {
      toast.error("Failed to update details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const openDoc = (value) => {
    const url = resolveImage(value);
    if (url) Linking.openURL(url).catch(() => {});
  };

  const status = restaurantData?.status;
  const rating = typeof restaurantData?.rating === "number" ? restaurantData.rating.toFixed(1) : "";
  const shownId = loading
    ? "..."
    : restaurantMongoId && restaurantMongoId.length >= 5
      ? restaurantMongoId.slice(-5)
      : restaurantId || "N/A";
  const f = editFormData;

  const dialogHeader = (
    <View style={styles.dialogHeader}>
      <Text style={styles.dialogTitle}>Edit {EDIT_TITLES[editSection] || "Bank Details"}</Text>
      <Pressable onPress={() => setEditModalOpen(false)} style={styles.dialogClose} hitSlop={6} accessibilityLabel="Close">
        <X size={20} color={tw.gray900} />
      </Pressable>
    </View>
  );
  const dialogFooter = (
    <View style={styles.dialogFooter}>
      <Pressable
        onPress={() => setEditModalOpen(false)}
        style={({ pressed }) => [styles.cancelBtn, pressed && { backgroundColor: tw.gray50 }]}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={handleEditSave}
        disabled={savingEdit}
        style={({ pressed }) => [styles.saveBtn, pressed && { backgroundColor: "#D81B60" }, savingEdit && { opacity: 0.7 }]}
      >
        <Text style={styles.saveText}>{savingEdit ? "Saving..." : "Save Changes"}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={goBack} style={styles.backBtn} hitSlop={6} accessibilityLabel="Go back">
            <ArrowLeft size={24} color={tw.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Outlet info</Text>
        </View>
        <Text style={styles.headerId}>Restaurant id: {shownId}</Text>
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 48 + shellInset }}>
        <View style={styles.white}>
          <View style={styles.banner}>
            {mainImage ? <AppImage src={mainImage} style={StyleSheet.absoluteFill} placeholderType="none" /> : null}
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.bannerText}>
              <Text style={styles.bannerLabel}>OUTLET PHOTO</Text>
              <Text style={styles.bannerName} numberOfLines={1}>
                {restaurantName || "Outlet Banner"}
              </Text>
            </View>
          </View>

          <View style={styles.logoSection}>
            <View style={styles.logoCard}>
              <View style={styles.logoBox}>
                <AppImage src={thumbnailImage} style={StyleSheet.absoluteFill} placeholderType="none" />
              </View>
              <View style={styles.logoRight}>
                <Text style={styles.logoLabel}>Logo / Profile Photo</Text>
                <Pressable
                  disabled={uploadingImage}
                  onPress={() => setPickerOpen(true)}
                  style={[styles.logoBtn, uploadingImage && { opacity: 0.7 }]}
                >
                  <Text style={styles.logoBtnText}>{uploadingImage ? "Uploading..." : "Change Logo"}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <View style={styles.ratingPill}>
              <Text style={styles.ratingValue}>{rating || "5.0"}</Text>
              <Star size={14} color="#ffffff" fill="#ffffff" />
            </View>
            <Pressable onPress={() => openShellRoute("/feedback", "/outlet-info")} style={styles.reviewsLink}>
              <Text style={styles.reviewsText}>{restaurantData?.totalRatings || 1} DELIVERY REVIEWS</Text>
              <ChevronRight size={16} color={PINK} style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
        </View>

        <View style={styles.infoWrap}>
          <View style={styles.infoHead}>
            <Text style={styles.infoTitle}>Restaurant Information</Text>
            <Text style={styles.infoSub}>All onboarding and profile details at one place.</Text>
          </View>

          <View style={styles.cards}>
            <View style={[styles.card, styles.cardSmall]}>
              <CardHeader title="Restaurant name" status={status} onEdit={() => handleEditClick("restaurantName")} small />
              <Text style={styles.nameValue}>{restaurantName || "N/A"}</Text>
            </View>

            <View style={styles.card}>
              <CardHeader title="Basic details" status={status} onEdit={() => handleEditClick("basic")} />
              <View style={styles.fields}>
                <Field label="Owner name" value={restaurantData?.ownerName || "N/A"} />
                <Field
                  label="Primary contact"
                  value={restaurantData?.primaryContactNumber || restaurantData?.ownerPhone || "N/A"}
                />
                <Field label="Email" value={restaurantData?.email || restaurantData?.ownerEmail || "N/A"} />
                <Field label="Restaurant type" value={restaurantData?.pureVegRestaurant ? "Pure Veg" : "Veg & Non-Veg"} />
              </View>
            </View>

            <View style={styles.card}>
              <CardHeader title="Compliance details" status={status} onEdit={() => handleEditClick("compliance")} />
              <View style={styles.fields}>
                <Field label="PAN number" value={(restaurantData?.panNumber || "N/A").toUpperCase()} />
                <Field label="GST registered" value={restaurantData?.gstNumber ? "Yes" : "No"} />
                <Field label="FSSAI number" value={restaurantData?.fssaiNumber || "N/A"} />
                <Field label="FSSAI expiry" value={formatDate(restaurantData?.fssaiExpiry)} />
                <View>
                  <Text style={styles.fieldLabel}>FSSAI document</Text>
                  <View style={styles.docRow}>
                    <Pressable onPress={() => openDoc(restaurantData?.fssaiImage)}>
                      <Text style={styles.docLink}>View image</Text>
                    </Pressable>
                    <Text style={styles.docLink}>Upload</Text>
                  </View>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>PAN document</Text>
                  <View style={styles.docRow}>
                    <Pressable onPress={() => openDoc(restaurantData?.panImage)}>
                      <Text style={styles.docLink}>View image</Text>
                    </Pressable>
                    <Text style={styles.docLink}>Upload</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <CardHeader title="Bank and UPI details" status={status} onEdit={() => handleEditClick("bank")} />
              <View style={styles.fields}>
                <Field label="Account holder" value={restaurantData?.accountHolderName || restaurantData?.nameOnPan || "N/A"} />
                <Field
                  label="Account number"
                  value={restaurantData?.accountNumber ? `.... .... ${String(restaurantData.accountNumber).slice(-4)}` : "N/A"}
                  style={styles.wide}
                />
                <Field label="IFSC code" value={(restaurantData?.ifscCode || "N/A").toUpperCase()} />
                <Field label="UPI ID" value={restaurantData?.upiId || "N/A"} />
                {/* Web reads `upiImage`, which /current never returns (the field is upiQrImage). */}
                <Field label="UPI QR image" value={restaurantData?.upiImage ? "Uploaded" : "Not uploaded"} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <CenterSheet
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        header={dialogHeader}
        footer={dialogFooter}
        width={425}
        maxHeight="90%"
        panelStyle={styles.dialogPanel}
        contentStyle={styles.dialogBody}
      >
        {editSection === "restaurantName" ? (
          <EditInput
            label="Restaurant Name"
            value={f.restaurantName || f.name || ""}
            onChangeText={setField("restaurantName")}
            placeholder="Enter restaurant name"
          />
        ) : null}
        {editSection === "basic" ? (
          <>
            <EditInput label="Owner Name" value={f.ownerName || ""} onChangeText={setField("ownerName")} placeholder="Enter owner name" />
            <EditInput
              label="Primary Contact"
              value={f.primaryContactNumber || f.ownerPhone || ""}
              onChangeText={setField("primaryContactNumber")}
              placeholder="Enter contact number"
            />
            <EditInput
              label="Email"
              value={f.email || f.ownerEmail || ""}
              onChangeText={setField("email")}
              placeholder="Enter email address"
              keyboardType="email-address"
            />
            <Pressable
              onPress={() => setField("pureVegRestaurant")(!f.pureVegRestaurant)}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(f.pureVegRestaurant) }}
            >
              <View style={[styles.checkbox, f.pureVegRestaurant && { backgroundColor: PINK, borderColor: PINK }]}>
                {f.pureVegRestaurant ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
              </View>
              <Text style={styles.checkLabel}>Pure Veg Restaurant</Text>
            </Pressable>
          </>
        ) : null}
        {editSection === "compliance" ? (
          <>
            <EditInput label="PAN Number" value={f.panNumber || ""} onChangeText={setField("panNumber")} placeholder="Enter PAN number" upper />
            <EditInput
              label="GST Number"
              value={f.gstNumber || ""}
              onChangeText={setField("gstNumber")}
              placeholder="Enter GST number (if any)"
              upper
            />
            <EditInput label="FSSAI Number" value={f.fssaiNumber || ""} onChangeText={setField("fssaiNumber")} placeholder="Enter FSSAI number" />
            <DateInput label="FSSAI Expiry" value={toDateInput(f.fssaiExpiry)} onChange={setField("fssaiExpiry")} />
          </>
        ) : null}
        {editSection === "bank" ? (
          <>
            <EditInput
              label="Account Holder"
              value={f.accountHolderName || f.nameOnPan || ""}
              onChangeText={setField("accountHolderName")}
              placeholder="Enter account holder name"
            />
            <EditInput
              label="Account Number"
              value={f.accountNumber || ""}
              onChangeText={setField("accountNumber")}
              placeholder="Enter bank account number"
            />
            <EditInput label="IFSC Code" value={f.ifscCode || ""} onChangeText={setField("ifscCode")} placeholder="Enter IFSC code" upper />
            <EditInput label="UPI ID" value={f.upiId || ""} onChangeText={setField("upiId")} placeholder="Enter UPI ID (optional)" />
          </>
        ) : null}
      </CenterSheet>

      <ImageSourcePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onFileSelect={handleProfileImageReplace}
        title="Update Profile Photo"
        description="Choose how to upload your profile photo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tw.gray50 },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    zIndex: 50,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: tw.gray900 },
  headerId: { fontSize: 13, color: tw.gray600, flexShrink: 1 },
  white: { backgroundColor: "#ffffff" },
  banner: { width: "100%", height: 224, backgroundColor: tw.gray100, overflow: "hidden" },
  bannerText: { position: "absolute", bottom: 12, left: 16 },
  bannerLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: "rgba(255,255,255,0.8)" },
  bannerName: { fontSize: 14, fontWeight: "700", color: "#ffffff", maxWidth: 240 },
  logoSection: { paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: tw.gray100 },
  logoCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.8)",
    borderRadius: 24,
    padding: 14,
    boxShadow: "0px 2px 10px rgba(0,0,0,0.02)",
  },
  logoBox: {
    width: 88,
    height: 88,
    backgroundColor: tw.gray100,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tw.gray100,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  logoRight: { alignItems: "flex-end", gap: 6 },
  logoLabel: { fontSize: 12, fontWeight: "600", color: tw.gray500 },
  logoBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  logoBtnText: { fontSize: 13, fontWeight: "700", color: "#ffffff" },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
  },
  ratingPill: {
    backgroundColor: PINK,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  ratingValue: { fontSize: 14, fontWeight: "900", color: "#ffffff" },
  reviewsLink: { flexDirection: "row", alignItems: "center" },
  reviewsText: { fontSize: 14, fontWeight: "900", color: PINK, letterSpacing: 0.35 },
  infoWrap: { padding: 16, backgroundColor: "#F8F9FA" },
  infoHead: { marginBottom: 16 },
  infoTitle: { fontSize: 17, fontWeight: "700", color: tw.gray900, letterSpacing: -0.4 },
  infoSub: { marginTop: 4, fontSize: 13, fontWeight: "500", color: tw.gray500 },
  cards: { gap: 14 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.5)",
    boxShadow: "0px 2px 8px rgba(0,0,0,0.03)",
  },
  cardSmall: { padding: 16 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardHeadGap: { marginBottom: 18 },
  cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  nameLabel: { fontSize: 13, fontWeight: "600", color: tw.gray500 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: tw.gray900 },
  chip: { paddingHorizontal: 10, paddingVertical: 2, backgroundColor: PINK_SOFT, borderRadius: 9999 },
  chipText: { fontSize: 10, fontWeight: "700", color: PINK, letterSpacing: 0.25 },
  editLink: { fontSize: 14, fontWeight: "700", color: brand.blue },
  nameValue: { marginTop: 2, fontSize: 16, fontWeight: "900", color: tw.gray900 },
  fields: { gap: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: tw.gray500, marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: "700", color: tw.gray900 },
  wide: { letterSpacing: 0.75 },
  docRow: { flexDirection: "row", gap: 16, marginTop: 6 },
  docLink: { fontSize: 15, fontWeight: "700", color: brand.blue, letterSpacing: -0.4 },
  dialogPanel: { borderRadius: 24 },
  dialogHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingRight: 56,
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    backgroundColor: "rgba(249,250,251,0.5)",
  },
  dialogTitle: { fontSize: 19, fontWeight: "900", color: tw.gray900, letterSpacing: -0.5 },
  dialogClose: { position: "absolute", right: 16, top: 16, padding: 8, borderRadius: 9999, opacity: 0.7 },
  dialogBody: { paddingHorizontal: 24, paddingVertical: 20, gap: 16 },
  dialogFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "rgba(249,250,251,0.8)",
    borderTopWidth: 1,
    borderTopColor: tw.gray100,
  },
  cancelBtn: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 12,
    alignItems: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: tw.gray700 },
  saveBtn: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: PINK,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  saveText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  inputLabel: { fontSize: 13, fontWeight: "700", color: tw.gray700, marginBottom: 6, letterSpacing: 0.35 },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    borderColor: tw.gray200,
    fontSize: 15,
    color: tw.gray900,
    paddingHorizontal: 16,
  },
  inputFocused: { backgroundColor: "#ffffff", borderColor: PINK, boxShadow: "0px 0px 0px 2px rgba(233,30,99,0.2)" },
  dateInput: { justifyContent: "center" },
  dateText: { fontSize: 15, color: tw.gray900 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tw.gray50,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tw.gray100,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tw.gray300,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { fontSize: 14, fontWeight: "700", color: tw.gray800 },
});
