// DeliveryV2/pages/profile/ProfileDetailsV2 (/profile/details): profile photo (camera / gallery ->
// PATCH /profile multipart profilePhoto), approval + phone pills, rider level and rating, the vehicle
// card + "Vehicle Info" popup (PATCH /profile/details {vehicle}), the bank card, UPI ID and QR, the
// "Bank & Payments" popup (PATCH /profile/bank-details, multipart when a new UPI QR is picked), the
// verification docs list and the fullscreen document viewer. Android back closes an open popup first
// (each popup is a Modal), as the web's history.pushState/popstate did.
// Not ported (unreachable or unused on the web): the "Remove Photo?" popup (nothing opens it), the
// wallet-balance fetch (its value is never shown), and the unused DL re-upload / activePicker refs.
import { router } from "expo-router";
import {
  ArrowLeft,
  Banknote,
  Bike,
  Camera,
  Car,
  CheckCircle,
  Edit2,
  Eye,
  FileText,
  Image as ImageIcon,
  QrCode,
  Shield,
  Smartphone,
  Truck,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildFormData, getProfile, toUploadFile, updateBankDetails, updateProfile, updateProfileDetails, updateProfileMultipart } from "../../api";
import Spinner from "../../components/content/Spinner";
import BankSheet from "../../components/profile/BankSheet";
import DocumentViewer from "../../components/profile/DocumentViewer";
import VehicleSheet from "../../components/profile/VehicleSheet";
import {
  dvCard,
  imageValidationError,
  pickImage,
  serverMessage,
  twp,
  uploadErrorMessage,
} from "../../components/profile/common";
import { alpha } from "../../components/feed/palette";
import { AppImage, Screen, Text, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";
import { brand, dvColor, light, shadow, tw } from "../../theme/tokens";

const EMPTY_BANK = {
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  panNumber: "",
  upiId: "",
  upiQrCode: null,
};

function bankFromProfile(pd) {
  return {
    accountHolderName: pd?.documents?.bankDetails?.accountHolderName || "",
    accountNumber: pd?.documents?.bankDetails?.accountNumber || "",
    ifscCode: pd?.documents?.bankDetails?.ifscCode || "",
    bankName: pd?.documents?.bankDetails?.bankName || "",
    panNumber: pd?.documents?.pan?.number || "",
    upiId: pd?.documents?.bankDetails?.upiId || "",
    upiQrCode: pd?.documents?.bankDetails?.upiQrCode || null,
  };
}

function vehicleIconFor(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("car")) return Car;
  if (t.includes("bike") || t.includes("scooter") || t.includes("motorcycle")) return Bike;
  if (t.includes("bicycle")) return Bike;
  return Truck;
}

function parseNumericValue(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

// The loader: a 64px ring (border-4 orange-100 -> 28 % primary, border-t orange-500) spinning
// around a User icon.
function RingLoader() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={styles.ringWrap}>
      <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <User size={24} color={brand.primary} />
      </View>
    </View>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Icon size={16} color={tw.gray400} />
      <Text heading style={styles.sectionTitle}>
        {children}
      </Text>
    </View>
  );
}

function InfoCard({ icon: Icon, label, value, badge = null, onEdit = null }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Icon size={24} color={brand.primary} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.infoLabel}>{label}</Text>
          <View style={styles.infoValueRow}>
            <Text heading style={styles.infoValue}>
              {value || "—"}
            </Text>
            {badge}
          </View>
        </View>
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={6}>
          <Edit2 size={16} color={tw.gray400} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ProfileDetailsScreen() {
  const goBack = useAppBack();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [showVehiclePopup, setShowVehiclePopup] = useState(false);
  const [vehicleInput, setVehicleInput] = useState({ number: "", brand: "", type: "" });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false);
  const [bankDetails, setBankDetails] = useState(EMPTY_BANK);
  const [upiQrFile, setUpiQrFile] = useState(null);
  const [upiQrPreview, setUpiQrPreview] = useState(null);
  const [isUpdatingBankDetails, setIsUpdatingBankDetails] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;
    (async () => {
      try {
        setLoading(true);
        const res = await getProfile();
        if (!(res?.success && res?.data?.profile)) throw new Error("Profile fetch failed");
        if (!alive) return;
        const pd = res.data.profile;
        setProfile(pd);
        const vNum = pd?.vehicle?.number || "";
        const vBrand = pd?.vehicle?.brand || "";
        const vType = pd?.vehicle?.type || "";
        setVehicleNumber(vNum);
        setVehicleBrand(vBrand);
        setVehicleType(vType);
        setVehicleInput({ number: vNum, brand: vBrand, type: vType });
        setBankDetails(bankFromProfile(pd));
      } catch (error) {
        if (!alive) return;
        if (error?.status === 401) {
          toast.error("Session expired. Please login again.");
          timer = setTimeout(() => router.replace("/login"), 2000);
        } else {
          toast.error(serverMessage(error, "Failed to load profile data"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await getProfile();
    if (mounted.current && res?.success && res?.data?.profile) {
      setProfile(res.data.profile);
      setBankDetails(bankFromProfile(res.data.profile));
    }
  }, []);

  const isAdminApproved = ["approved", "active"].includes(String(profile?.status || "").toLowerCase());

  const getDocumentVerificationLabel = (doc) => {
    if (!doc?.document) return "Not uploaded";
    if (doc?.verified || isAdminApproved) return "Verified";
    return "Pending Verification";
  };

  const getDocumentNumber = (doc) => String(doc?.number || doc?.idNumber || doc?.documentNumber || "").trim();

  const getDrivingLicenseNumber = () =>
    String(
      profile?.documents?.drivingLicense?.number ||
        profile?.documents?.drivingLicense?.idNumber ||
        profile?.documents?.drivingLicense?.documentNumber ||
        profile?.drivingLicenseNumber ||
        profile?.documents?.drivingLicenseNumber ||
        "",
    ).trim();

  const ratingValue = parseNumericValue(
    profile?.metrics?.rating,
    profile?.ratings?.average,
    profile?.averageRating,
    profile?.rating,
    profile?.stats?.averageRating,
    profile?.analytics?.averageRating,
  );
  const ratingCount = Number(
    profile?.metrics?.ratingCount ||
      profile?.ratings?.count ||
      profile?.totalRatings ||
      profile?.reviewCount ||
      profile?.reviewsCount ||
      profile?.stats?.totalRatings ||
      profile?.analytics?.totalRatings ||
      0,
  );
  const ratingDisplay = ratingValue ? `${ratingValue.toFixed(1)}${ratingCount > 0 ? ` (${ratingCount})` : ""}` : "-";

  const getRiderLevel = () => {
    if (!Number.isFinite(ratingValue) || ratingValue <= 0 || ratingCount <= 0) return "New Rider";
    if (ratingValue >= 4.8 && ratingCount >= 100) return "Champion";
    if (ratingValue >= 4.6 && ratingCount >= 50) return "Elite";
    if (ratingValue >= 4.3 && ratingCount >= 20) return "Pro";
    if (ratingValue >= 4.0 && ratingCount >= 10) return "Rising";
    return "Starter";
  };
  const riderLevel = getRiderLevel();

  const profileImageUrl = profile?.profileImage?.url || profile?.documents?.photo || null;

  const uploadProfileFile = async (file) => {
    try {
      setIsUploadingImage(true);
      const res = await updateProfileMultipart(buildFormData({ profilePhoto: toUploadFile(file) }));
      if (res?.success) {
        toast.success("Profile photo updated");
        await refreshProfile();
      } else {
        toast.error(res?.message || "Update failed");
      }
    } catch (error) {
      toast.error(uploadErrorMessage(error, "Failed to upload bank details image."));
    } finally {
      if (mounted.current) setIsUploadingImage(false);
    }
  };

  const pickProfilePhoto = async (source) => {
    const picked = await pickImage(source, "profile-profilePhoto").catch(() => null);
    if (!picked) return;
    if (picked.error) {
      toast.error(picked.error);
      return;
    }
    uploadProfileFile(picked.file);
  };

  const pickUpiQr = async (source) => {
    const picked = await pickImage(source, "profile-upiQrCode").catch(() => null);
    if (!picked) return;
    if (picked.error) {
      toast.error(picked.error);
      return;
    }
    const validation = imageValidationError(picked.file);
    if (validation) {
      toast.error(validation);
      return;
    }
    setUpiQrFile(picked.file);
    setUpiQrPreview(picked.file.uri);
    toast.success("UPI QR selected");
  };

  const saveVehicle = async () => {
    const num = vehicleInput.number.trim();
    const vBrand = vehicleInput.brand.trim();
    const type = vehicleInput.type;
    if (!num) return toast.error("Vehicle number is required");
    if (!vBrand) return toast.error("Vehicle brand is required");
    const numRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{4}$/i;
    if (!numRegex.test(num.replace(/\s+/g, ""))) {
      return toast.error("Please enter a valid vehicle number (e.g. MH12AB1234)");
    }
    try {
      await updateProfileDetails({ vehicle: { number: num, brand: vBrand, type } });
      setVehicleNumber(num);
      setVehicleBrand(vBrand);
      setVehicleType(type);
      setShowVehiclePopup(false);
      toast.success("Flight details updated!");
      await refreshProfile();
    } catch {
      toast.error("Cloud storage sync failed");
    }
    return undefined;
  };

  const submitBankDetails = async () => {
    setIsUpdatingBankDetails(true);
    try {
      const { accountNumber, ifscCode, panNumber, upiId } = bankDetails;
      if (accountNumber && !/^\d{9,18}$/.test(accountNumber.trim())) {
        return toast.error("Invalid Account Number (9-18 digits)");
      }
      if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
        return toast.error("Invalid IFSC Code (e.g. SBIN0001234)");
      }
      if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
        return toast.error("Invalid PAN Card format (e.g. ABCDE1234F)");
      }
      if (upiId && !/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) {
        return toast.error("Invalid UPI ID (e.g. user@bank)");
      }

      const bank = {
        accountHolderName: (bankDetails.accountHolderName || "").trim(),
        accountNumber: (bankDetails.accountNumber || "").trim(),
        ifscCode: (bankDetails.ifscCode || "").trim().toUpperCase(),
        bankName: (bankDetails.bankName || "").trim(),
        upiId: (bankDetails.upiId || "").trim(),
      };
      const pan = (bankDetails.panNumber || "").trim().toUpperCase();
      if (upiQrFile) {
        // multipart (documents[bankDetails][...], documents[pan][number], upiQrCode file)
        await updateBankDetails({ bankDetails: bank, panNumber: pan, upiQrCode: upiQrFile });
      } else {
        // same keys as JSON; an empty PAN is still sent (clears it), like the web's FormData
        await updateProfile({ documents: { bankDetails: bank, pan: { number: pan } } });
      }
      toast.success("Bank details updated");
      setShowBankDetailsPopup(false);
      setUpiQrFile(null);
      setUpiQrPreview(null);
      await refreshProfile();
    } catch (error) {
      toast.error(serverMessage(error, "Update failed"));
    } finally {
      if (mounted.current) setIsUpdatingBankDetails(false);
    }
    return undefined;
  };

  const openDocument = (name, url) => {
    setSelectedDocument({ name, url });
    setShowDocumentModal(true);
  };

  if (loading) {
    return (
      <Screen background="#F8FAFC">
        <View style={[styles.flex1, styles.center]}>
          <View style={styles.loaderCol}>
            <RingLoader />
            <Text style={styles.loaderText}>Initializing Profile...</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const VehicleIcon = vehicleIconFor(profile?.vehicle?.type);
  const vehicleValue =
    [profile?.vehicle?.type, profile?.vehicle?.brand, vehicleNumber]
      .filter(Boolean)
      .map((v) => String(v).toUpperCase())
      .join(" • ") || "N/A";

  const docs = [
    { icon: FileText, label: "Aadhar Card", doc: profile?.documents?.aadhar },
    { icon: FileText, label: "PAN Card", doc: profile?.documents?.pan },
    { icon: Truck, label: "Driving License", doc: profile?.documents?.drivingLicense, number: getDrivingLicenseNumber() },
  ];

  return (
    <Screen edges={[]} background="#FDFEFE">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <Pressable onPress={goBack} style={styles.backBtn} hitSlop={6} accessibilityLabel="Back">
              <ArrowLeft size={20} color={tw.gray700} />
            </Pressable>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <View style={styles.idPill}>
            <Text style={styles.idPillText}>ID: {profile?.deliveryId || "..."}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            {profileImageUrl ? (
              <AppImage src={profileImageUrl} width={128} placeholderType="none" style={styles.fill} />
            ) : (
              <View style={[styles.fill, styles.center]}>
                <User size={48} color={tw.gray300} />
              </View>
            )}
            {isUploadingImage ? (
              <View style={[StyleSheet.absoluteFill, styles.center, styles.uploading]}>
                <Spinner size={24} color="#ffffff" />
              </View>
            ) : null}
          </View>
          <View style={styles.avatarActions}>
            <Pressable
              onPress={() => pickProfilePhoto("camera")}
              style={({ pressed }) => [styles.avatarBtn, { backgroundColor: "#000000" }, pressed && styles.pressed]}
              accessibilityLabel="Take Photo"
            >
              <Camera size={20} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={() => pickProfilePhoto("gallery")}
              style={({ pressed }) => [styles.avatarBtn, { backgroundColor: brand.primary }, pressed && styles.pressed]}
              accessibilityLabel="Gallery"
            >
              <ImageIcon size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.identity}>
          <Text heading style={styles.name}>
            {profile?.name}
          </Text>
          <Text style={styles.subline}>Delivery Partner • {profile?.location?.city}</Text>
          <View style={styles.pills}>
            <View
              style={[
                styles.pill,
                isAdminApproved
                  ? { backgroundColor: brand.primary, borderColor: brand.dvBorder, ...shadow.lg }
                  : { backgroundColor: brand.primarySoft, borderColor: dvColor("border-orange-500/20", light) },
              ]}
            >
              <CheckCircle size={16} color={isAdminApproved ? "#ffffff" : brand.primary} />
              <Text style={[styles.pillText, { color: isAdminApproved ? "#ffffff" : brand.primary }]}>
                {isAdminApproved ? "Approved" : profile?.status || "Pending"}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: brand.primarySoft, borderColor: dvColor("border-blue-100", light) }]}>
              <Smartphone size={16} color={brand.primary} />
              <Text style={[styles.pillText, { color: brand.primary }]}>{profile?.phone}</Text>
            </View>
          </View>
        </View>

        {/* Rider stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rider Level</Text>
            <Text heading style={styles.statValue}>
              {riderLevel}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Rating</Text>
            <Text heading style={styles.statValue}>
              {ratingDisplay}
            </Text>
          </View>
        </View>

        {/* Vehicle */}
        <View>
          <View style={[styles.sectionHead, { marginBottom: 12 }]}>
            <SectionTitle icon={VehicleIcon}>Vehicle Assets</SectionTitle>
          </View>
          <InfoCard
            icon={VehicleIcon}
            label="Vehicle Details"
            value={vehicleValue}
            badge={
              !vehicleNumber ? (
                <View style={styles.missing}>
                  <Text style={styles.missingText}>Missing</Text>
                </View>
              ) : null
            }
            onEdit={() => {
              setVehicleInput({ number: vehicleNumber, brand: vehicleBrand, type: vehicleType });
              setShowVehiclePopup(true);
            }}
          />
        </View>

        {/* Bank & payments */}
        <View>
          <View style={styles.sectionHead}>
            <SectionTitle icon={Banknote}>Bank & Payments</SectionTitle>
            <Pressable
              onPress={() => {
                setBankDetails(bankFromProfile(profile));
                setUpiQrFile(null);
                setUpiQrPreview(null);
                setShowBankDetailsPopup(true);
              }}
              hitSlop={8}
            >
              <Text style={styles.editLink}>Edit Details</Text>
            </Pressable>
          </View>

          <View style={styles.bankStack}>
            <View style={styles.bankCard}>
              <View style={styles.bankGlow} />
              <View style={styles.bankTop}>
                <View style={styles.flexShrink}>
                  <Text style={styles.bankLabel}>Bank Account</Text>
                  <Text heading style={styles.bankName}>
                    {bankDetails.bankName || "Link Account"}
                  </Text>
                </View>
                <Banknote size={32} color={alpha("#2b7fff", 0.5)} />
              </View>
              <View style={styles.bankBottom}>
                <View style={styles.flexShrink}>
                  <Text style={styles.accountNo}>
                    {bankDetails.accountNumber
                      ? `•••• •••• •••• ${bankDetails.accountNumber.slice(-4)}`
                      : "XXXX XXXX XXXX XXXX"}
                  </Text>
                  <Text style={styles.holder}>{bankDetails.accountHolderName || "Account Holder"}</Text>
                </View>
                <View style={styles.ifscCol}>
                  <Text style={[styles.bankLabel, { letterSpacing: 0.9 }]}>IFSC Code</Text>
                  <Text style={styles.ifsc}>{bankDetails.ifscCode || "—"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.upiCard}>
              <View style={styles.upiLeft}>
                <View style={styles.upiIcon}>
                  <Smartphone size={28} color={twp.purple600} />
                </View>
                <View style={styles.flexShrink}>
                  <Text style={styles.upiLabel}>UPI ID</Text>
                  <Text heading style={styles.upiValue}>
                    {bankDetails.upiId || "Not added"}
                  </Text>
                </View>
              </View>
              {bankDetails.upiQrCode ? (
                <Pressable onPress={() => openDocument("UPI Scanner", bankDetails.upiQrCode)} style={styles.qrBtn}>
                  <QrCode size={24} color={tw.gray400} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Documents */}
        <View>
          <View style={styles.sectionHead}>
            <SectionTitle icon={Shield}>Verification Docs</SectionTitle>
          </View>
          <View style={styles.docs}>
            {docs.map((item) => {
              const Icon = item.icon;
              return (
                <View key={item.label} style={styles.docCard}>
                  <View style={styles.docLeft}>
                    <View style={styles.docIcon}>
                      <Icon size={20} color={tw.gray400} />
                    </View>
                    <View style={styles.flexShrink}>
                      <Text style={styles.docLabel}>{item.label}</Text>
                      <Text style={styles.docStatus}>{getDocumentVerificationLabel(item.doc)}</Text>
                      <Text style={styles.docNumber}>
                        {item.number || getDocumentNumber(item.doc) || "Number not added"}
                      </Text>
                    </View>
                  </View>
                  {item.doc?.document ? (
                    <Pressable onPress={() => openDocument(item.label, item.doc.document)} style={styles.eyeBtn}>
                      <Eye size={16} color={tw.gray400} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <VehicleSheet
        isOpen={showVehiclePopup}
        onClose={() => setShowVehiclePopup(false)}
        input={vehicleInput}
        setInput={setVehicleInput}
        onSave={saveVehicle}
      />
      <BankSheet
        isOpen={showBankDetailsPopup}
        onClose={() => setShowBankDetailsPopup(false)}
        bankDetails={bankDetails}
        setBankDetails={setBankDetails}
        upiQrPreview={upiQrPreview}
        onClearQr={() => {
          setUpiQrFile(null);
          setUpiQrPreview(null);
        }}
        onPickQr={pickUpiQr}
        onSubmit={submitBankDetails}
        submitting={isUpdatingBankDetails}
      />
      <DocumentViewer
        document={selectedDocument}
        visible={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
      />
    </Screen>
  );
}

const LABEL_10 = { fontSize: 10, lineHeight: 15, fontWeight: "900", color: tw.gray400, textTransform: "uppercase" };

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.95 }] },
  loaderCol: { alignItems: "center", gap: 16 },
  ringWrap: { width: 64, height: 64 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: dvColor("border-orange-100", light),
    borderTopColor: twp.orange500,
  },
  loaderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  header: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray100,
    zIndex: 50,
  },
  headerInner: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  backBtn: { padding: 8, borderRadius: 14 },
  headerTitle: { fontSize: 18, lineHeight: 18, fontWeight: "900", color: "#000000", textTransform: "uppercase", letterSpacing: -0.45 },
  idPill: {
    backgroundColor: brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    boxShadow: "0px 10px 15px -3px rgba(21,73,139,0.35), 0px 4px 6px -4px rgba(21,73,139,0.35)",
  },
  idPillText: { ...LABEL_10, color: "#ffffff", letterSpacing: 1 },
  scroll: { paddingTop: 16, paddingHorizontal: 16, gap: 24 },
  avatarBlock: { alignItems: "center" },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: tw.gray100,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
    ...shadow["2xl"],
  },
  uploading: { backgroundColor: "rgba(0,0,0,0.4)" },
  avatarActions: {
    position: "absolute",
    bottom: -26,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  avatarBtn: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    ...dvCard,
  },
  identity: { alignItems: "center", paddingTop: 24 },
  name: { fontSize: 24, lineHeight: 26, fontWeight: "900", color: tw.gray900, textAlign: "center" },
  subline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
  },
  pills: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...brand.cardShadow,
  },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 },
  stats: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    ...dvCard,
  },
  statLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    color: tw.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  statValue: { fontSize: 20, lineHeight: 28, fontWeight: "900", color: tw.gray900, textAlign: "center" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: tw.gray950,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  editLink: { ...LABEL_10, color: brand.primary, letterSpacing: 1 },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...dvCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: brand.primarySoft,
    borderWidth: 1,
    borderColor: dvColor("border-blue-100", light),
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { ...LABEL_10, letterSpacing: 1.5, marginBottom: 2 },
  infoValueRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  infoValue: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: tw.gray900, flexShrink: 1 },
  missing: { backgroundColor: tw.red50, paddingHorizontal: 6, borderRadius: 4 },
  missingText: { fontSize: 9, lineHeight: 13, fontWeight: "700", color: tw.red500, textTransform: "uppercase" },
  editBtn: { padding: 8, borderRadius: 10 },
  bankStack: { gap: 12 },
  bankCard: {
    backgroundColor: brand.primary, // bg-[#121212] is repainted with the primary
    borderRadius: 24,
    padding: 24,
    overflow: "hidden",
    ...brand.cardShadow,
  },
  bankGlow: {
    position: "absolute",
    top: -64,
    right: -64,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bankTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 },
  bankLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "900",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  bankName: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: "#ffffff", letterSpacing: -0.45 },
  bankBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  accountNo: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "monospace",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 2.4,
  },
  holder: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
  },
  ifscCol: { alignItems: "flex-end" },
  ifsc: { fontSize: 14, lineHeight: 20, fontWeight: "900", color: "#ffffff", letterSpacing: 1.4 },
  upiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    ...dvCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upiLeft: { flexDirection: "row", alignItems: "center", gap: 20, flexShrink: 1 },
  upiIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: twp.purple50,
    borderWidth: 1,
    ...dvCard,
    alignItems: "center",
    justifyContent: "center",
  },
  upiLabel: { ...LABEL_10, letterSpacing: 2, marginBottom: 4 },
  upiValue: { fontSize: 16, lineHeight: 24, fontWeight: "900", color: tw.gray900 },
  qrBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: tw.gray50,
    borderWidth: 1,
    ...dvCard,
    alignItems: "center",
    justifyContent: "center",
  },
  docs: { gap: 12 },
  docCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    ...dvCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  docLeft: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  docIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: tw.gray50, alignItems: "center", justifyContent: "center" },
  docLabel: { ...LABEL_10, letterSpacing: 1 },
  docStatus: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: tw.gray600 },
  docNumber: { fontSize: 11, lineHeight: 16, fontWeight: "600", color: tw.gray500, marginTop: 2 },
  eyeBtn: { padding: 8, backgroundColor: tw.gray50, borderRadius: 10 },
});
