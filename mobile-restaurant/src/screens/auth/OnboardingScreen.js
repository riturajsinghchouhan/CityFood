// Onboarding.jsx: the 3-step registration wizard (?step=1..3).
//   1. Restaurant info, owner details, contact + location (address search, zone auto-detect).
//   2. Profile photo, outlet timings, estimated delivery time, open days.
//   3. PAN, GST, FSSAI (with expiry) and bank details, then multipart register -> pending-verification.
// Validation runs per step and toasts the first error, as on web. The draft (fields and picked
// files) is kept in storage under restaurant_onboarding_data and resumed for the same phone.
import { router, useLocalSearchParams } from "expo-router";
import { Image as ImageIcon, Calendar as CalendarIcon, LogOut, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { detectZone, getPublicZones } from "../../api/zones";
import SelectField from "../../components/auth/SelectField";
import { useBranding } from "../../components/auth/useBranding";
import ImageSourcePicker from "../../components/auth/onboarding/ImageSourcePicker";
import LocationSearch from "../../components/auth/onboarding/LocationSearch";
import {
  DateField,
  DocPreview,
  Field,
  Hint,
  Label,
  Pill,
  RemoveBadge,
  Section,
  TimeSelector,
  UploadButton,
} from "../../components/auth/onboarding/fields";
import {
  daysOfWeek,
  findZoneForLocation,
  formatDateToLocalYMD,
  formatNameToCapital,
  getTodayLocalYMD,
  isLocalFile,
  lettersOnly,
  normalizeBankAcc,
  normalizeEmail,
  normalizeGST,
  normalizeIFSC,
  normalizePAN,
  normalizePhoneDigits,
  normalizePincode,
  normalizeTimeValue,
  previewUri,
  toLocalFile,
  validateStep1,
  validateStep2,
  validateStep3,
} from "../../components/auth/onboarding/helpers";
import { getPlaceDetails, parseNominatim, searchLocations } from "../../components/auth/onboarding/places";
import { Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { radius, tw } from "../../theme/tokens";

const INITIAL_STEP1 = {
  restaurantName: "",
  pureVegRestaurant: null,
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  primaryContactNumber: "",
  zoneId: "",
  location: {
    formattedAddress: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    latitude: "",
    longitude: "",
  },
};

const INITIAL_STEP2 = {
  menuImages: [],
  menuPdf: null,
  profileImage: null,
  cuisines: [],
  estimatedDeliveryTime: "",
  openingTime: "",
  closingTime: "",
  openDays: [],
};

const INITIAL_STEP3 = {
  panNumber: "",
  nameOnPan: "",
  panImage: null,
  gstRegistered: false,
  gstNumber: "",
  gstLegalName: "",
  gstAddress: "",
  gstImage: null,
  fssaiNumber: "",
  fssaiExpiry: "",
  fssaiImage: null,
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  accountHolderName: "",
  accountType: "",
};

const ACCOUNT_TYPES = [
  { value: "Saving", label: "Saving" },
  { value: "Current", label: "Current" },
];

function parseStepParam(value) {
  const s = parseInt(String(value || ""), 10);
  return s >= 1 && s <= 3 ? s : null;
}

// getVerifiedPhoneFromStoredRestaurant: the pending phone, else the logged-in restaurant's phone.
function verifiedPhoneFrom(pendingPhone, restaurant) {
  if (pendingPhone && String(pendingPhone).trim()) return String(pendingPhone).trim();
  const r = restaurant || {};
  const candidates = [
    r.ownerPhone,
    r.primaryContactNumber,
    r.phone,
    r.phoneNumber,
    r.mobile,
    r.contactNumber,
    r.contact?.phone,
    r.owner?.phone,
    r.restaurant?.phone,
  ];
  const phone = candidates.find((v) => typeof v === "string" && v.trim());
  return phone ? phone.trim() : "";
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams();
  const stepParam = parseStepParam(params.step);
  const { colors } = useTheme();
  const { companyName } = useBranding();
  const insets = useSafeAreaInsets();
  const { ready, pendingPhone, restaurant, register, logout } = useAuth();

  const [step, setStep] = useState(stepParam || 1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [zones, setZones] = useState([]);
  const zonesRef = useRef([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [step1, setStep1] = useState(INITIAL_STEP1);
  const [step2, setStep2] = useState(INITIAL_STEP2);
  const [step3, setStep3] = useState(INITIAL_STEP3);

  const [sourcePicker, setSourcePicker] = useState({ isOpen: false, title: "", onSelectFile: null });
  const [locationSearchValue, setLocationSearchValue] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const justSelectedRef = useRef(false);
  const justSelectedTimer = useRef(null);
  const zoneDetectTimerRef = useRef(null);
  const lastZoneDetectKeyRef = useRef(null);
  const lastOutOfZoneToastKeyRef = useRef(null);
  const scrollRef = useRef(null);

  const update1 = (patch) => setStep1((prev) => ({ ...prev, ...patch }));
  const updateLocation = (patch) => setStep1((prev) => ({ ...prev, location: { ...prev.location, ...patch } }));
  const update2 = (patch) => setStep2((prev) => ({ ...prev, ...patch }));
  const update3 = (patch) => setStep3((prev) => ({ ...prev, ...patch }));

  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  // ?step=N changes after mount (web: separate effect on searchParams).
  const [prevStepParam, setPrevStepParam] = useState(stepParam);
  if (stepParam !== prevStepParam) {
    setPrevStepParam(stepParam);
    if (stepParam) setStep(stepParam);
  }

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  // Zones for the service-zone select and the polygon check (public endpoint), once.
  useEffect(() => {
    let cancelled = false;
    getPublicZones()
      .then((res) => {
        const list = res?.data?.zones || (Array.isArray(res?.data) ? res.data : []);
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

  // Resume the stored draft when it belongs to the same phone; otherwise discard it.
  const hydrateStarted = useRef(false);
  useEffect(() => {
    if (!ready || hydrateStarted.current) return;
    hydrateStarted.current = true;
    const currentPhone = verifiedPhoneFrom(pendingPhone, restaurant);
    setVerifiedPhoneNumber(currentPhone);
    (async () => {
      try {
        const localData = await store.get(KEYS.onboardingData);
        if (localData) {
          const checkPhone =
            normalizePhoneDigits(localData.loginPhone || "") || normalizePhoneDigits(localData.step1?.ownerPhone || "");
          const normalizedCurrent = normalizePhoneDigits(currentPhone);
          if (!checkPhone || !normalizedCurrent || checkPhone === normalizedCurrent) {
            if (localData.step1) {
              setStep1((prev) => ({
                ...prev,
                ...localData.step1,
                location: { ...prev.location, ...(localData.step1.location || {}) },
              }));
              if (localData.step1.location?.formattedAddress) {
                justSelectedRef.current = true;
                setLocationSearchValue(localData.step1.location.formattedAddress);
                justSelectedTimer.current = setTimeout(() => {
                  justSelectedRef.current = false;
                }, 600);
              }
            }
            if (localData.step2) {
              setStep2((prev) => ({
                ...prev,
                ...localData.step2,
                openingTime: normalizeTimeValue(localData.step2.openingTime),
                closingTime: normalizeTimeValue(localData.step2.closingTime),
              }));
            }
            if (localData.step3) setStep3((prev) => ({ ...prev, ...localData.step3 }));
            if (localData.currentStep && !stepParam) {
              setStep(Math.min(3, Math.max(1, Number(localData.currentStep) || 1)));
            }
          } else {
            await store.remove(KEYS.onboardingData);
          }
        }
        if (currentPhone) setStep1((prev) => ({ ...prev, ownerPhone: currentPhone }));
      } finally {
        setHydrated(true);
        setLoading(false);
      }
    })();
  }, [ready, pendingPhone, restaurant, stepParam]);

  // Save the draft whenever step data changes (debounced; one AsyncStorage write per pause).
  useEffect(() => {
    if (!hydrated) return undefined;
    const t = setTimeout(() => {
      store.set(KEYS.onboardingData, {
        step1,
        step2,
        step3,
        currentStep: step,
        timestamp: Date.now(),
        loginPhone: verifiedPhoneNumber,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [hydrated, step1, step2, step3, step, verifiedPhoneNumber]);

  // The footer hides while the keyboard is open, as on web.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => () => clearTimeout(justSelectedTimer.current), []);

  const handleLocationSelect = useCallback((parsed) => {
    let matchedZoneId = "";
    if (parsed.latitude && parsed.longitude && zonesRef.current.length > 0) {
      matchedZoneId = findZoneForLocation(parsed.latitude, parsed.longitude, zonesRef.current) || "";
      if (!matchedZoneId) {
        toast.error("This address is not in our service zone. Please select a valid location.", { id: "out-of-zone" });
      }
    }
    const hasCoord = (v) => v !== undefined && v !== null && v !== "";
    setStep1((prev) => ({
      ...prev,
      zoneId: matchedZoneId || prev.zoneId,
      location: {
        ...prev.location,
        formattedAddress: parsed.formattedAddress || prev.location.formattedAddress,
        addressLine1: parsed.formattedAddress || prev.location.addressLine1 || "",
        area: parsed.area || prev.location.area,
        city: parsed.city || prev.location.city,
        state: parsed.state || prev.location.state,
        pincode: parsed.pincode || prev.location.pincode,
        latitude: hasCoord(parsed.latitude) ? parsed.latitude : prev.location.latitude,
        longitude: hasCoord(parsed.longitude) ? parsed.longitude : prev.location.longitude,
      },
    }));
    // The Places details round trip can outlast the 600 ms window; re-arm it so writing the
    // chosen address into the search box doesn't start a new search.
    justSelectedRef.current = true;
    clearTimeout(justSelectedTimer.current);
    justSelectedTimer.current = setTimeout(() => {
      justSelectedRef.current = false;
    }, 600);
    setLocationSearchValue(parsed.formattedAddress || "");
    setLocationSuggestions([]);
  }, []);

  const onSelectSuggestion = async (s) => {
    // Prevent re-search after selecting; reset after the debounce window.
    justSelectedRef.current = true;
    setLocationSuggestions([]);
    clearTimeout(justSelectedTimer.current);
    justSelectedTimer.current = setTimeout(() => {
      justSelectedRef.current = false;
    }, 600);
    if (s.isGoogle) {
      const parsed = await getPlaceDetails(s.id, s.display);
      handleLocationSelect(parsed || { formattedAddress: s.display });
    } else {
      handleLocationSelect(parseNominatim(s));
    }
  };

  // Address search: 400 ms debounce, 3+ characters.
  useEffect(() => {
    if (step !== 1) return undefined;
    if (justSelectedRef.current) return undefined;
    const q = String(locationSearchValue || "").trim();
    if (q.length < 3) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (justSelectedRef.current) return;
      setIsSearchingLocation(true);
      try {
        const list = await searchLocations(q);
        if (!cancelled && !justSelectedRef.current) setLocationSuggestions(list);
      } catch {
        if (!cancelled) setLocationSuggestions([]);
      } finally {
        if (!cancelled) setIsSearchingLocation(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [locationSearchValue, step]);

  // Zone auto-detect for the chosen coordinates (GET /food/zones/detect), 350 ms debounce.
  const lat = Number(step1.location?.latitude);
  const lng = Number(step1.location?.longitude);
  const hasLatLng = step1.location?.latitude !== "" && step1.location?.latitude != null && Number.isFinite(lat) && Number.isFinite(lng);
  useEffect(() => {
    if (step !== 1 || !hasLatLng) return undefined;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastZoneDetectKeyRef.current === key) return undefined;
    clearTimeout(zoneDetectTimerRef.current);
    zoneDetectTimerRef.current = setTimeout(async () => {
      lastZoneDetectKeyRef.current = key;
      try {
        const res = await detectZone(lat, lng);
        const payload = res?.data;
        if (res?.success && payload) {
          if (payload.status === "IN_SERVICE" && payload.zoneId) {
            setStep1((prev) => (prev.zoneId === payload.zoneId ? prev : { ...prev, zoneId: payload.zoneId }));
            lastOutOfZoneToastKeyRef.current = null;
          } else {
            if (lastOutOfZoneToastKeyRef.current !== key) {
              if (justSelectedRef.current) toast.error("Selected location is outside all service zones");
              lastOutOfZoneToastKeyRef.current = key;
            }
            setStep1((prev) => (prev.zoneId ? { ...prev, zoneId: "" } : prev));
          }
        }
      } catch {
        // keep the current zone
      }
    }, 350);
    return () => clearTimeout(zoneDetectTimerRef.current);
  }, [step, hasLatLng, lat, lng]);

  const openImageSourcePicker = (title, onSelectFile) => setSourcePicker({ isOpen: true, title, onSelectFile });
  const closeImageSourcePicker = () => setSourcePicker((prev) => ({ ...prev, isOpen: false }));

  const pickInto = (setter, key) => (asset) => {
    const file = toLocalFile(asset);
    if (file) setter((prev) => ({ ...prev, [key]: file }));
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      await store.remove(KEYS.onboardingData);
    } catch {
      // the local logout below still happens
    } finally {
      setIsLoggingOut(false);
      router.replace("/login");
    }
  };

  const toggleDay = (day) => {
    setStep2((prev) => ({
      ...prev,
      openDays: prev.openDays.includes(day) ? prev.openDays.filter((d) => d !== day) : [...prev.openDays, day],
    }));
  };

  const submitRegistration = async () => {
    if (!isLocalFile(step2.profileImage)) throw new Error("Restaurant profile image is required");
    if (!isLocalFile(step3.panImage)) throw new Error("PAN image is required");
    if (step3.gstRegistered && !isLocalFile(step3.gstImage)) {
      throw new Error("GST image is required when GST registered");
    }
    if (!isLocalFile(step3.fssaiImage)) throw new Error("FSSAI image is required");

    const loc = step1.location || {};
    const ownerPhone = normalizePhoneDigits(step1.ownerPhone);
    const fields = {
      restaurantName: step1.restaurantName || "",
      pureVegRestaurant: step1.pureVegRestaurant === true ? "true" : "false",
      ownerName: step1.ownerName || "",
      ownerEmail: (step1.ownerEmail || "").trim(),
      ownerPhone,
      primaryContactNumber: normalizePhoneDigits(step1.primaryContactNumber),
      zoneId: step1.zoneId || "",
      addressLine1: loc.addressLine1 || "",
      addressLine2: loc.addressLine2 || "",
      area: loc.area || "",
      city: loc.city || "",
      state: loc.state || "",
      pincode: loc.pincode || "",
      landmark: loc.landmark || "",
      formattedAddress: loc.formattedAddress || "",
      latitude: String(loc.latitude || ""),
      longitude: String(loc.longitude || ""),
      cuisines: (step2.cuisines || []).join(","),
      estimatedDeliveryTime: (step2.estimatedDeliveryTime || "").trim(),
      openingTime: normalizeTimeValue(step2.openingTime) || "",
      closingTime: normalizeTimeValue(step2.closingTime) || "",
      openDays: (step2.openDays || []).join(","),
      profileImage: step2.profileImage,
      panNumber: step3.panNumber || "",
      nameOnPan: step3.nameOnPan || "",
      panImage: step3.panImage,
      gstRegistered: step3.gstRegistered ? "true" : "false",
      fssaiNumber: step3.fssaiNumber || "",
      fssaiExpiry: step3.fssaiExpiry || "",
      fssaiImage: step3.fssaiImage,
      accountNumber: step3.accountNumber || "",
      ifscCode: (step3.ifscCode || "").toUpperCase(),
      accountHolderName: step3.accountHolderName || "",
      accountType: step3.accountType || "",
    };
    if (step3.gstRegistered) {
      fields.gstNumber = step3.gstNumber || "";
      fields.gstLegalName = step3.gstLegalName || "";
      fields.gstAddress = step3.gstAddress || "";
      fields.gstImage = step3.gstImage;
    }

    await register(fields);
    await store.remove(KEYS.onboardingData);
    toast.success("Registration submitted. Awaiting admin approval.", { duration: 4000 });
    router.replace({ pathname: "/pending-verification", params: { phone: ownerPhone } });
  };

  const handleNext = async () => {
    setError("");
    const validationErrors = step === 1 ? validateStep1(step1) : step === 2 ? validateStep2(step2) : validateStep3(step3);
    if (validationErrors.length > 0) {
      // Only the first error, so validation proceeds top-to-bottom.
      toast.error(validationErrors[0], { duration: 4000 });
      return;
    }
    setSaving(true);
    try {
      if (step === 1) {
        setStep(2);
        scrollTop();
      } else if (step === 2) {
        setStep(3);
        scrollTop();
      } else {
        await submitRegistration();
      }
    } catch (err) {
      setError(err?.message || "Failed to save onboarding data");
    } finally {
      setSaving(false);
    }
  };

  // Fewer than 3 characters: no suggestions and no spinner.
  const queryLongEnough = String(locationSearchValue || "").trim().length >= 3;

  const zoneOptions = [
    { value: "", label: zonesLoading ? "Loading zones..." : "Select a zone" },
    ...zones.map((z) => {
      const id = String(z?._id || z?.id || "");
      return { value: id, label: z?.name || z?.zoneName || z?.serviceLocation || id };
    }),
  ];

  const renderStep1 = () => (
    <View style={styles.stepGap}>
      <Section title="Restaurant information">
        <View style={styles.gap12}>
          <View>
            <Label>Restaurant name*</Label>
            <Field
              value={step1.restaurantName || ""}
              onChangeText={(v) => update1({ restaurantName: formatNameToCapital(v) })}
              placeholder="Customers will see this name"
            />
          </View>
          <View>
            <Label>Pure veg restaurant?*</Label>
            <View style={styles.pillRow}>
              <Pill
                outlined
                label="Yes, Pure Veg"
                active={step1.pureVegRestaurant === true}
                activeColor={tw.green600}
                onPress={() => update1({ pureVegRestaurant: true })}
              />
              <Pill
                outlined
                label="No, Mixed Menu"
                active={step1.pureVegRestaurant === false}
                activeColor={colors.primary}
                onPress={() => update1({ pureVegRestaurant: false })}
              />
            </View>
            <Hint>This helps users filter restaurants by dietary preference.</Hint>
          </View>
        </View>
      </Section>

      <Section title="Owner details">
        <Text style={styles.sectionLead}>These details will be used for all business communications and updates.</Text>
        <View style={styles.gap16}>
          <View>
            <Label>Full name*</Label>
            <Field
              value={step1.ownerName || ""}
              onChangeText={(v) => update1({ ownerName: formatNameToCapital(lettersOnly(v)) })}
              placeholder="Owner full name"
            />
          </View>
          <View>
            <Label>Email address*</Label>
            <Field
              value={step1.ownerEmail || ""}
              onChangeText={(v) => update1({ ownerEmail: normalizeEmail(v) })}
              placeholder="ritu@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View>
            <Label>Phone number*</Label>
            <Field
              value={step1.ownerPhone || ""}
              onChangeText={(v) => update1({ ownerPhone: v.replace(/\D/g, "").slice(0, 10) })}
              editable={!verifiedPhoneNumber}
              placeholder="10 digit mobile number"
              keyboardType="number-pad"
            />
          </View>
        </View>
      </Section>

      <Section title="Restaurant contact & location" gap={16}>
        <View>
          <Label>Primary contact number*</Label>
          <Field
            value={step1.primaryContactNumber || ""}
            onChangeText={(v) => update1({ primaryContactNumber: v.replace(/\D/g, "").slice(0, 10) })}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="Restaurant's primary contact number"
          />
          <Hint>
            Customers, delivery partners and {companyName} may call on this number for order support.
          </Hint>
        </View>
        <View style={styles.gap12}>
          <Text style={styles.locationLead}>{"Add your restaurant's location for order pick-up."}</Text>
          <LocationSearch
            value={locationSearchValue}
            onChangeText={setLocationSearchValue}
            suggestions={queryLongEnough ? locationSuggestions : []}
            searching={queryLongEnough && isSearchingLocation}
            onSelect={onSelectSuggestion}
            editable
          />
          <Field
            value={step1.location?.addressLine1 || ""}
            onChangeText={(v) => updateLocation({ addressLine1: v })}
            placeholder="Shop no. / building no. (optional)"
            style={styles.noTop}
          />
          <Field
            value={step1.location?.addressLine2 || ""}
            onChangeText={(v) => updateLocation({ addressLine2: v })}
            placeholder="Floor / tower (optional)"
            style={styles.noTop}
          />
          <Field
            value={step1.location?.landmark || ""}
            onChangeText={(v) => updateLocation({ landmark: v })}
            placeholder="Nearby landmark (optional)"
            style={styles.noTop}
          />
          <Field
            value={step1.location?.area || ""}
            onChangeText={(v) => updateLocation({ area: v })}
            placeholder="Area / Sector / Locality*"
            style={styles.noTop}
          />
          <Field
            value={step1.location?.city || ""}
            onChangeText={(v) => updateLocation({ city: v })}
            placeholder="City*"
            style={styles.noTop}
          />
          <View style={styles.gap12}>
            <Field
              value={step1.location?.state || ""}
              onChangeText={(v) => updateLocation({ state: v })}
              placeholder="State"
              style={styles.noTop}
            />
            <Field
              value={step1.location?.pincode || ""}
              onChangeText={(v) => updateLocation({ pincode: normalizePincode(v) })}
              placeholder="Pincode"
              keyboardType="number-pad"
              style={styles.noTop}
            />
          </View>
          <Hint>Please ensure that this address is the same as mentioned on your FSSAI license.</Hint>
          <View style={styles.zoneBlock}>
            <Label>Service zone*</Label>
            <SelectField
              value={step1.zoneId || ""}
              options={zoneOptions}
              onChange={(v) => update1({ zoneId: v })}
              disabled={zonesLoading || Boolean(step1.location?.latitude)}
              title="Service zone"
              style={styles.select}
            />
            <Hint>Choose the service zone where your restaurant will be available.</Hint>
          </View>
        </View>
      </Section>
    </View>
  );

  const profileUri = previewUri(step2.profileImage);

  const renderStep2 = () => (
    <View style={styles.stepGap}>
      <Section title="Restaurant photo" gap={20}>
        <Text style={styles.small}>
          Add a clear primary profile image for your restaurant. This helps customers recognize your brand.
        </Text>
        <View style={styles.gap8}>
          <Label>Restaurant profile image</Label>
          <View style={styles.profileRow}>
            <View>
              <View style={styles.avatar}>
                {profileUri ? (
                  <Image source={{ uri: profileUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <ImageIcon size={24} color={tw.gray500} />
                )}
              </View>
              {step2.profileImage ? (
                <RemoveBadge onPress={() => update2({ profileImage: null })} style={styles.avatarRemove} />
              ) : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.profileTitle}>Upload profile image</Text>
              <Text style={styles.profileSub}>This will be shown on your listing card and restaurant page.</Text>
            </View>
          </View>
          <UploadButton
            onPress={() => openImageSourcePicker("Upload profile image", pickInto(setStep2, "profileImage"))}
          />
        </View>
      </Section>

      <Section gap={20}>
        <View style={styles.gap12}>
          <Label>Outlet timings</Label>
          <View style={styles.gap16}>
            <TimeSelector
              label="Opening time"
              value={step2.openingTime || ""}
              onChange={(val) => update2({ openingTime: normalizeTimeValue(val) || "" })}
            />
            <TimeSelector
              label="Closing time"
              value={step2.closingTime || ""}
              onChange={(val) => update2({ closingTime: normalizeTimeValue(val) || "" })}
            />
          </View>
          <View>
            <Label>Estimated delivery time*</Label>
            <Field
              value={step2.estimatedDeliveryTime || ""}
              onChangeText={(v) => update2({ estimatedDeliveryTime: v })}
              placeholder="e.g., 25-30 mins"
            />
          </View>
        </View>

        <View style={styles.gap8}>
          <View style={styles.daysLabel}>
            <CalendarIcon size={14} color={tw.gray800} />
            <Label>Open days</Label>
          </View>
          <Text style={styles.hintPlain}>Select the days your restaurant accepts delivery orders.</Text>
          <View style={styles.daysGrid}>
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.dayCell, { backgroundColor: active ? colors.primary : tw.gray100 }]}
                >
                  <Text style={[styles.dayText, { color: active ? "#ffffff" : tw.gray800 }]}>{day.charAt(0)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepGap}>
      <Section title="PAN details" gap={16}>
        <View style={styles.gap16}>
          <View>
            <Label>PAN number</Label>
            <Field
              value={step3.panNumber || ""}
              onChangeText={(v) => update3({ panNumber: normalizePAN(v) })}
              placeholder="ABCDE1234F"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <View>
            <Label>PAN Card Holder Name</Label>
            <Field
              value={step3.nameOnPan || ""}
              onChangeText={(v) => update3({ nameOnPan: formatNameToCapital(lettersOnly(v)) })}
            />
          </View>
        </View>
        <View>
          <Label>PAN image</Label>
          <UploadButton
            style={styles.mt8}
            onPress={() => openImageSourcePicker("Upload PAN image", pickInto(setStep3, "panImage"))}
          />
          {step3.panImage ? <DocPreview value={step3.panImage} onRemove={() => update3({ panImage: null })} /> : null}
        </View>
      </Section>

      <Section title="GST details" gap={16}>
        <View style={styles.gstRow}>
          <Text style={styles.gstLabel}>GST registered?</Text>
          <Pill
            label="Yes"
            active={step3.gstRegistered}
            activeColor={colors.primary}
            onPress={() => update3({ gstRegistered: true })}
          />
          <Pill
            label="No"
            active={!step3.gstRegistered}
            activeColor={colors.primary}
            onPress={() => update3({ gstRegistered: false })}
          />
        </View>
        {step3.gstRegistered ? (
          <View style={styles.gap12}>
            <Field
              value={step3.gstNumber || ""}
              onChangeText={(v) => update3({ gstNumber: normalizeGST(v) })}
              placeholder="GST number (15 characters)"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.noTop}
            />
            <Field
              value={step3.gstLegalName || ""}
              onChangeText={(v) => update3({ gstLegalName: formatNameToCapital(lettersOnly(v)) })}
              placeholder="Legal name"
              style={styles.noTop}
            />
            <Field
              value={step3.gstAddress || ""}
              onChangeText={(v) => update3({ gstAddress: v })}
              placeholder="Registered address"
              style={styles.noTop}
            />
            <UploadButton
              onPress={() => openImageSourcePicker("Upload GST image", pickInto(setStep3, "gstImage"))}
            />
            {step3.gstImage ? <DocPreview value={step3.gstImage} onRemove={() => update3({ gstImage: null })} /> : null}
          </View>
        ) : null}
      </Section>

      <Section title="FSSAI details" gap={16}>
        <View style={styles.gap16}>
          <Field
            value={step3.fssaiNumber || ""}
            onChangeText={(v) => update3({ fssaiNumber: v.replace(/\D/g, "").slice(0, 14) })}
            placeholder="FSSAI number (14 digits)"
            keyboardType="number-pad"
            style={styles.noTop}
          />
          <View>
            <Label style={styles.mb4}>FSSAI expiry date</Label>
            <DateField
              value={step3.fssaiExpiry}
              minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
              onChange={(date) => {
                const formatted = formatDateToLocalYMD(date);
                if (formatted && formatted >= getTodayLocalYMD()) update3({ fssaiExpiry: formatted });
              }}
            />
          </View>
        </View>
        <View>
          <UploadButton
            onPress={() => openImageSourcePicker("Upload FSSAI image", pickInto(setStep3, "fssaiImage"))}
          />
          {step3.fssaiImage ? (
            <DocPreview value={step3.fssaiImage} onRemove={() => update3({ fssaiImage: null })} />
          ) : null}
        </View>
      </Section>

      <Section title="Bank account details" gap={16}>
        <View style={styles.gap16}>
          <Field
            value={step3.accountNumber || ""}
            onChangeText={(v) => update3({ accountNumber: normalizeBankAcc(v) })}
            placeholder="Account number"
            keyboardType="number-pad"
            style={styles.noTop}
          />
          <Field
            value={step3.confirmAccountNumber || ""}
            onChangeText={(v) => update3({ confirmAccountNumber: normalizeBankAcc(v) })}
            placeholder="Re-enter account number"
            keyboardType="number-pad"
            style={styles.noTop}
          />
        </View>
        <View style={styles.gap16}>
          <Field
            value={step3.ifscCode || ""}
            onChangeText={(v) => update3({ ifscCode: normalizeIFSC(v) })}
            placeholder="IFSC code"
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.noTop}
          />
          <SelectField
            value={step3.accountType || ""}
            options={ACCOUNT_TYPES}
            onChange={(v) => update3({ accountType: v })}
            placeholder="Select account type"
            style={styles.select}
          />
        </View>
        <Field
          value={step3.accountHolderName || ""}
          onChangeText={(v) => update3({ accountHolderName: formatNameToCapital(lettersOnly(v)) })}
          placeholder="Account holder name"
          style={styles.noTop}
        />
      </Section>
    </View>
  );

  const nextLabel = step === 3 ? (saving ? "Uploading Documents..." : "Submit Profile") : saving ? "Saving..." : "Continue";

  return (
    <Screen background={tw.gray100}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.push("/explore")} style={styles.closeBtn} hitSlop={6} accessibilityLabel="Close onboarding">
            <X size={20} color={tw.gray600} />
          </Pressable>
          <Text style={styles.headerTitle}>Restaurant onboarding</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.stepText}>STEP {step} OF 3</Text>
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.logoutBtn, pressed && { backgroundColor: tw.red50 }, isLoggingOut && { opacity: 0.5 }]}
            accessibilityLabel="Logout"
          >
            <LogOut size={16} color={tw.red600} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? <Text style={styles.loadingText}>Loading...</Text> : step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!keyboardOpen ? (
          <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable
              disabled={step === 1 || saving}
              onPress={() => {
                setStep((s) => Math.max(1, s - 1));
                scrollTop();
              }}
              style={[styles.backBtn, (step === 1 || saving) && styles.disabled]}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleNext}
              disabled={saving}
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: pressed ? colors.primaryStrong : colors.primary },
                saving && styles.disabled,
              ]}
            >
              <Text style={styles.nextText}>{nextLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ImageSourcePicker
        isOpen={sourcePicker.isOpen}
        onClose={closeImageSourcePicker}
        onFileSelect={sourcePicker.onSelectFile}
        title={sourcePicker.title}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  closeBtn: { padding: 4, borderRadius: 9999 },
  headerTitle: { fontSize: 14, fontWeight: "600", color: "#000000" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { fontSize: 10, fontWeight: "700", color: tw.gray500, letterSpacing: 0.25, textAlign: "right" },
  logoutBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  main: { paddingHorizontal: 16, paddingVertical: 16 },
  loadingText: { fontSize: 14, color: tw.gray600 },
  stepGap: { gap: 24 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  mt8: { marginTop: 8 },
  mb4: { marginBottom: 4 },
  noTop: { marginTop: 0 },
  pillRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  sectionLead: { fontSize: 14, lineHeight: 20, color: tw.gray600, marginBottom: 16 },
  locationLead: { fontSize: 14, lineHeight: 20, color: tw.gray700 },
  zoneBlock: { paddingTop: 8 },
  select: { marginTop: 4, borderColor: "#e8dde3" },
  small: { fontSize: 12, lineHeight: 16, color: tw.gray500 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tw.gray100,
    borderWidth: 1,
    borderColor: tw.gray200,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarRemove: { position: "absolute", top: -4, right: -4, zIndex: 10 },
  profileTitle: { fontSize: 12, fontWeight: "500", color: tw.gray900 },
  profileSub: { fontSize: 11, color: tw.gray500 },
  daysLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  hintPlain: { fontSize: 11, color: tw.gray500 },
  daysGrid: { marginTop: 4, flexDirection: "row", gap: 6 },
  dayCell: { flex: 1, aspectRatio: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 11, fontWeight: "500" },
  gstRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  gstLabel: { fontSize: 14, color: tw.gray700 },
  error: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: tw.red600 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { height: 36, paddingHorizontal: 16, borderRadius: radius.md, justifyContent: "center" },
  backText: { fontSize: 14, fontWeight: "500", color: tw.gray700 },
  nextBtn: { height: 36, paddingHorizontal: 24, borderRadius: radius.md, justifyContent: "center", alignItems: "center" },
  nextText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  disabled: { opacity: 0.5 },
});
