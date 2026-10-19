// Port of Frontend/src/modules/Food/pages/user/profile/EditProfile.jsx.
import dayjs from "dayjs";
import { ArrowLeft, Pencil, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { updateProfile, uploadProfileImage } from "../../api";
import ImageSourcePicker from "../../components/account/ImageSourcePicker";
import { DateField, SelectField, useFieldColors } from "../../components/account/ProfileFormFields";
import UserAvatar from "../../components/account/UserAvatar";
import { Screen, Text, toast } from "../../components/ui";
import { useProfile } from "../../context/ProfileContext";
import { goTo, useAppBack } from "../../navigation/back";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilyByWeight, shadow, tw } from "../../theme/tokens";

const EDIT_PROFILE_DRAFT_KEY = KEYS.editProfileDraft;
const MAX_IMAGE_MB = 5;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|mil|biz|info|name|museum|co\.in|in|co|us|me|io|uk)$/i;

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const normalizePhoneToTenDigits = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const buildFormDataFromProfile = (profile = {}) => ({
  name: profile.name || "",
  mobile: normalizePhoneToTenDigits(profile.mobile || profile.phone || ""),
  email: profile.email || "",
  dateOfBirth: profile.dateOfBirth ? dayjs(profile.dateOfBirth) : null,
  anniversary: profile.anniversary ? dayjs(profile.anniversary) : null,
  gender: profile.gender || "",
});

const formatDay = (d) => (d && d.isValid() ? d.format("YYYY-MM-DD") : null);

// shared/utils/uploadErrors.js
const FILE_SIZE_LIMIT_RE = /(file size|too large|max(?:imum)?(?: allowed)?(?: file)? size|limit exceeded)/i;
const INVALID_TYPE_RE = /(invalid file type|only .* allowed|unsupported media type|mime|format not supported)/i;

function getImageValidationError(asset) {
  const type = asset?.mimeType || (asset?.type === "image" ? "image/" : "");
  if (!String(type).startsWith("image/")) return "Please select a valid image file.";
  if (Number(asset?.fileSize || 0) > MAX_IMAGE_MB * 1024 * 1024) return `Image size should be less than ${MAX_IMAGE_MB}MB.`;
  return "";
}

function getUploadErrorMessage(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").trim();
  if (message && (FILE_SIZE_LIMIT_RE.test(message) || message.includes("LIMIT_FILE_SIZE"))) {
    return `Image size should be less than ${MAX_IMAGE_MB}MB.`;
  }
  if (message && INVALID_TYPE_RE.test(message)) return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
  if (status === 413) return `Image size should be less than ${MAX_IMAGE_MB}MB.`;
  if (status === 415) return "Invalid image format. Please upload JPG, PNG, WEBP, or GIF.";
  if (status >= 500) return "Upload failed on the server. Please try again.";
  return message || "Failed to upload image.";
}

const validateEmail = (value) => {
  if (!value) return "Email is required";
  return EMAIL_REGEX.test(value) ? "" : "Please enter a valid email";
};
const validateMobile = (value) => {
  if (!value) return "";
  return /^\d{10}$/.test(value) ? "" : "Mobile number must be 10 digits";
};
const validateDateOfBirth = (value) => {
  if (!value) return "";
  const dob = dayjs(value);
  if (!dob.isValid()) return "Please select a valid date of birth";
  return dob.isAfter(dayjs(), "day") ? "Date of birth cannot be in the future" : "";
};

function Label({ children, optional }) {
  const { isDark } = useTheme();
  return (
    <Text style={[styles.label, { color: isDark ? "#ffffff" : tw.gray700 }]}>
      {children}
      {optional ? (
        <Text style={[styles.label, styles.optional, { color: isDark ? tw.gray500 : tw.gray400 }]}> (Optional)</Text>
      ) : null}
    </Text>
  );
}

function EditProfileForm({ initialProfile, fromDraft }) {
  const { isDark, colors } = useTheme();
  const field = useFieldColors();
  const { userProfile, updateUserProfile, refreshProfile } = useProfile();
  const [formData, setFormData] = useState(() => buildFormDataFromProfile(initialProfile));
  const [initialData] = useState(() => buildFormDataFromProfile(initialProfile));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "");
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ mobile: "", email: "", dateOfBirth: "" });
  const [focused, setFocused] = useState(null);
  const [syncedProfile, setSyncedProfile] = useState(userProfile);

  // Web: refill the form whenever the profile changes (unless restored from a draft).
  if (syncedProfile !== userProfile) {
    setSyncedProfile(userProfile);
    if (!fromDraft && userProfile) {
      setFormData(buildFormDataFromProfile(userProfile));
      if (userProfile.profileImage) {
        setProfileImage(userProfile.profileImage);
        setImagePreview(userProfile.profileImage);
      }
    }
  }

  useEffect(() => {
    store.set(EDIT_PROFILE_DRAFT_KEY, {
      name: formData.name,
      phone: formData.mobile,
      mobile: formData.mobile,
      email: formData.email,
      profileImage,
      dateOfBirth: formatDay(formData.dateOfBirth),
      anniversary: formatDay(formData.anniversary),
      gender: formData.gender || "",
    });
  }, [formData, profileImage]);

  const avatarInitial = formData.name?.charAt(0).toUpperCase() || "A";
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

  const handleChange = (key, value) => {
    let normalizedValue = value;
    let errorMessage = "";
    if (key === "mobile") {
      normalizedValue = String(value || "").replace(/\D/g, "").slice(0, 10);
      errorMessage = validateMobile(normalizedValue);
    } else if (key === "email") {
      normalizedValue = String(value || "").trim();
      errorMessage = validateEmail(normalizedValue);
    } else if (key === "dateOfBirth") {
      errorMessage = validateDateOfBirth(normalizedValue);
    }
    setFormData((prev) => ({ ...prev, [key]: normalizedValue }));
    if (key === "mobile" || key === "email" || key === "dateOfBirth") {
      setFieldErrors((prev) => ({ ...prev, [key]: errorMessage }));
    }
  };

  const processProfileImageFile = async (asset) => {
    if (!asset) return;
    const validationError = getImageValidationError(asset);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setImagePreview(asset.uri);
    try {
      setIsUploadingImage(true);
      const response = await uploadProfileImage(asset);
      const imageUrl = response?.data?.profileImage;
      if (imageUrl) {
        setProfileImage(imageUrl);
        setImagePreview(imageUrl);
        toast.success("Profile image uploaded successfully");
        const mergedProfile = {
          ...(userProfile || {}),
          name: formData.name,
          phone: formData.mobile,
          mobile: formData.mobile,
          email: formData.email,
          dateOfBirth: formatDay(formData.dateOfBirth),
          anniversary: formatDay(formData.anniversary),
          gender: formData.gender || "",
          profileImage: imageUrl,
        };
        updateUserProfile(mergedProfile);
        store.set(EDIT_PROFILE_DRAFT_KEY, mergedProfile);
        refreshProfile();
      }
    } catch (error) {
      toast.error(getUploadErrorMessage(error));
      setImagePreview(profileImage);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const validateForm = () => {
    const nextErrors = {
      mobile: validateMobile(formData.mobile),
      email: validateEmail(formData.email),
      dateOfBirth: validateDateOfBirth(formData.dateOfBirth),
    };
    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleUpdate = async () => {
    if (isSaving) return;
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    try {
      setIsSaving(true);
      const response = await updateProfile({
        name: formData.name,
        email: formData.email || undefined,
        dateOfBirth: formatDay(formData.dateOfBirth) || undefined,
        anniversary: formatDay(formData.anniversary) || undefined,
        gender: formData.gender || undefined,
        profileImage: profileImage || undefined,
      });
      const updatedUser = response?.data?.user;
      if (updatedUser) {
        updateUserProfile({
          ...updatedUser,
          phone: updatedUser.phone || formData.mobile,
          profileImage: updatedUser.profileImage || profileImage,
        });
        await store.remove(EDIT_PROFILE_DRAFT_KEY);
        refreshProfile();
        toast.success("Profile updated successfully");
        goTo("/profile");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = (name) => [
    styles.input,
    {
      borderColor: focused === name ? colors.primary : field.border,
      backgroundColor: field.background,
      color: field.text,
    },
  ];
  const canSubmit = hasChanges && !isSaving && !isUploadingImage;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarRow}>
          <View>
            <UserAvatar size={96} image={imagePreview} initial={avatarInitial} fontSize={30} />
            <Pressable
              onPress={() => setPhotoPickerOpen(true)}
              disabled={isUploadingImage}
              style={[styles.editBtn, { backgroundColor: colors.primary }, isUploadingImage && styles.half]}
            >
              {isUploadingImage ? (
                <ActivityIndicator size={16} color="#ffffff" />
              ) : (
                <Pencil size={16} color="#ffffff" />
              )}
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
          <View style={styles.fieldGroup}>
            <Label>Name</Label>
            <View>
              <TextInput
                value={formData.name}
                onChangeText={(t) => handleChange("name", t)}
                placeholder="Name"
                placeholderTextColor={field.placeholder}
                selectionColor={colors.primary}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                style={[inputStyle("name"), styles.inputWithClear]}
              />
              {formData.name ? (
                <Pressable onPress={() => handleChange("name", "")} style={styles.clearBtn} hitSlop={8}>
                  <X size={20} color={isDark ? tw.gray500 : tw.gray400} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Label>Mobile</Label>
            <TextInput
              value={formData.mobile}
              onChangeText={(t) => handleChange("mobile", t)}
              placeholder="Mobile"
              keyboardType="phone-pad"
              placeholderTextColor={field.placeholder}
              selectionColor={colors.primary}
              onFocus={() => setFocused("mobile")}
              onBlur={() => setFocused(null)}
              style={inputStyle("mobile")}
            />
            {fieldErrors.mobile ? <Text style={styles.error}>{fieldErrors.mobile}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Label>Email</Label>
            <TextInput
              value={formData.email}
              onChangeText={(t) => handleChange("email", t)}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={field.placeholder}
              selectionColor={colors.primary}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
            />
            {fieldErrors.email ? <Text style={styles.error}>{fieldErrors.email}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Label>Date of birth</Label>
            <DateField
              value={formData.dateOfBirth}
              onChange={(v) => handleChange("dateOfBirth", v)}
              maximumDate={new Date()}
            />
            {fieldErrors.dateOfBirth ? <Text style={styles.error}>{fieldErrors.dateOfBirth}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Label optional>Anniversary</Label>
            <DateField value={formData.anniversary} onChange={(v) => handleChange("anniversary", v)} />
          </View>

          <View style={styles.fieldGroup}>
            <Label>Gender</Label>
            <SelectField
              value={formData.gender || ""}
              onChange={(v) => handleChange("gender", v)}
              options={genderOptions}
              placeholder="Gender"
            />
          </View>
        </View>

        <Pressable
          onPress={handleUpdate}
          disabled={!canSubmit}
          style={[styles.submit, { backgroundColor: canSubmit ? colors.primary : tw.gray200 }]}
        >
          {isSaving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size={20} color={tw.gray400} />
              <Text style={[styles.submitText, { color: tw.gray400 }]}>Saving...</Text>
            </View>
          ) : (
            <Text style={[styles.submitText, { color: canSubmit ? "#ffffff" : tw.gray400 }]}>Update profile</Text>
          )}
        </Pressable>
      </ScrollView>

      <ImageSourcePicker
        isOpen={photoPickerOpen}
        onClose={() => setPhotoPickerOpen(false)}
        onFileSelect={processProfileImageFile}
        title="Update profile photo"
        description="Choose how you want to upload your profile photo."
      />
    </>
  );
}

export default function EditProfileScreen() {
  const goBack = useAppBack();
  const { isDark } = useTheme();
  const { userProfile } = useProfile();
  // The web reads its draft synchronously from localStorage; here it loads once before the form mounts.
  const [draftState, setDraftState] = useState({ loaded: false, draft: null });

  useEffect(() => {
    let active = true;
    store.get(EDIT_PROFILE_DRAFT_KEY).then((draft) => {
      if (active) setDraftState({ loaded: true, draft: draft && typeof draft === "object" ? draft : null });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <View
        style={[
          styles.header,
          { backgroundColor: isDark ? "#1a1a1a" : "#ffffff", borderBottomColor: isDark ? tw.gray800 : tw.gray100 },
        ]}
      >
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={6}>
          <ArrowLeft size={20} color={isDark ? "#ffffff" : tw.gray700} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>Your Profile</Text>
      </View>
      {draftState.loaded ? (
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <EditProfileForm
            initialProfile={draftState.draft || userProfile || {}}
            fromDraft={Boolean(draftState.draft)}
          />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 112, gap: 24 },
  avatarRow: { alignItems: "center" },
  editBtn: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    ...shadow.lg,
  },
  half: { opacity: 0.5 },
  card: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 40, gap: 16, ...shadow.sm },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  optional: { fontWeight: "400" },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: fontFamilyByWeight["400"],
  },
  inputWithClear: { paddingRight: 40 },
  clearBtn: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  error: { fontSize: 12, color: tw.red600 },
  submit: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { fontSize: 16, fontWeight: "600" },
});
