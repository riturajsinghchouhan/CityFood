// Port of Frontend/src/modules/Food/pages/user/profile/Profile.jsx (bottom-nav root, login required).
import { router } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Building2,
  Info,
  Leaf,
  MapPin,
  Moon,
  Palette,
  Power,
  Settings as SettingsIcon,
  Share2,
  ShoppingCart,
  Sun,
  Tag,
  Trash2,
  TriangleAlert,
  User,
  Wallet,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { deleteAccount, getReferralStats, getWallet, sendTestNotification } from "../../api";
import AccountDialog, { DialogHeaderBlock } from "../../components/account/AccountDialog";
import ChoiceOption from "../../components/account/ChoiceOption";
import ProfileRow, { Chevron, IconChip, ProfileCard, rowLabelColor } from "../../components/account/ProfileRow";
import { buildReferralLink, referralShareText, shareReferral } from "../../components/account/referral";
import UserAvatar from "../../components/account/UserAvatar";
import { Button, Screen, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCompanyName } from "../../context/AppSettingsContext";
import { useProfile } from "../../context/ProfileContext";
import { unregisterPushDevice } from "../../lib/push";
import { goTo } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { brand, fontFamilyByWeight, shadow, tw } from "../../theme/tokens";

// Session cache, like the web's module-level profilePageCache.
const profilePageCache = {
  referralReward: null,
  walletBalance: null,
};

const VALID_GENDERS = ["male", "female", "other", "prefer-not-to-say"];

function isDateFilled(dateField) {
  if (!dateField) return false;
  if (dateField instanceof Date) return !Number.isNaN(dateField.getTime());
  if (typeof dateField === "string") {
    const trimmed = dateField.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return false;
    return !Number.isNaN(new Date(trimmed).getTime());
  }
  return false;
}

function calculateProfileCompletion(userProfile, hasValidEmail) {
  if (!userProfile) return 0;
  const hasName = Boolean(userProfile.name && typeof userProfile.name === "string" && userProfile.name.trim() !== "");
  const hasPhone = Boolean(userProfile.phone && typeof userProfile.phone === "string" && userProfile.phone.trim() !== "");
  const hasImage = Boolean(
    userProfile.profileImage &&
      typeof userProfile.profileImage === "string" &&
      userProfile.profileImage.trim() !== "" &&
      userProfile.profileImage !== "null" &&
      userProfile.profileImage !== "undefined",
  );
  const hasGender = Boolean(
    userProfile.gender &&
      typeof userProfile.gender === "string" &&
      VALID_GENDERS.includes(userProfile.gender.trim().toLowerCase()),
  );
  const done = [hasName, hasPhone || hasValidEmail, hasImage, isDateFilled(userProfile.dateOfBirth), hasGender];
  return Math.round((done.filter(Boolean).length / 5) * 100);
}

// animate-pulse for the icon while a request runs.
function Pulse({ active, children }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function SectionTitle({ title }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <View style={[styles.sectionBar, { backgroundColor: colors.primary }]} />
      <Text style={[styles.sectionText, { color: rowLabelColor(isDark) }]}>{title}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { userProfile, vegMode, setVegMode, getDefaultAddress, addresses } = useProfile();
  const { logout } = useAuth();
  const { colors, isDark, mode: appearance, setMode: setAppearance } = useTheme();
  const companyName = useCompanyName();
  const defaultAddress = getDefaultAddress?.();
  const savedAddressSummary = defaultAddress
    ? [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode]
        .filter(Boolean)
        .join(", ")
    : "No address saved. Tap to save Home, Work, or Other.";

  const [vegModeOpen, setVegModeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [referralReward, setReferralReward] = useState(() => profilePageCache.referralReward || 0);
  const [walletBalance, setWalletBalance] = useState(() => profilePageCache.walletBalance || 0);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteCaptcha, setDeleteCaptcha] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const loggingOutRef = useRef(false);

  const avatarInitial =
    userProfile?.name?.charAt(0)?.toUpperCase() || userProfile?.phone?.charAt(1)?.toUpperCase() || "U";
  const displayName = userProfile?.name || userProfile?.phone || "User";
  const hasValidEmail = Boolean(
    userProfile?.email && userProfile.email.trim() !== "" && userProfile.email.includes("@"),
  );
  const profileCompletion = calculateProfileCompletion(userProfile, hasValidEmail);
  const isComplete = profileCompletion === 100;

  useEffect(() => {
    if (profilePageCache.referralReward !== null) return undefined;
    let mounted = true;
    getReferralStats()
      .then((res) => {
        const finalReward = Number(res?.data?.stats?.rewardAmount) || 0;
        if (mounted) setReferralReward(finalReward);
        profilePageCache.referralReward = finalReward;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profilePageCache.walletBalance !== null) return undefined;
    let mounted = true;
    getWallet()
      .then((res) => {
        const bal = Number(res?.data?.wallet?.balance);
        const finalBal = Number.isFinite(bal) ? bal : 0;
        if (mounted) setWalletBalance(finalBal);
        profilePageCache.walletBalance = finalBal;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const referralLink = buildReferralLink(userProfile);

  const handleShareReferral = async () => {
    if (!referralLink) return;
    try {
      await shareReferral({
        companyName,
        text: referralShareText(companyName, referralReward),
        link: referralLink,
      });
    } catch {
      // Same as web: share failures are ignored.
    }
  };

  // Web order: remove push device + token, POST /food/auth/logout, clear local data, go to login.
  const handleLogout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setIsLoggingOut(true);
    try {
      await unregisterPushDevice();
    } catch {
      // Continue with logout even if push cleanup fails.
    }
    try {
      await logout();
    } catch {
      // logout() already clears local state; never block on it.
    }
    loggingOutRef.current = false;
    setIsLoggingOut(false);
    router.replace("/login");
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success("Account deleted successfully");
      setDeleteAccountOpen(false);
      await logout().catch(() => {});
      router.replace("/login");
    } catch (err) {
      toast.error(err?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestNotification = async () => {
    if (isTestingNotification) return;
    setIsTestingNotification(true);
    try {
      const response = await sendTestNotification("mobile");
      const details = response?.data || {};
      const successCount = details?.successCount || 0;
      const failureCount = details?.failureCount || 0;
      if (successCount > 0) {
        toast.success(`Test sent! Delivered: ${successCount}, Failed: ${failureCount}`);
      } else {
        toast.error(`Test failed to deliver. Delivered: 0, Failed: ${failureCount}`);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to send test notification");
    } finally {
      setIsTestingNotification(false);
    }
  };

  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const labelColor = rowLabelColor(isDark);
  const pillBg = isDark ? tw.gray800 : tw.gray100;
  const pillText = isDark ? tw.gray300 : tw.gray700;
  const lightSelected = appearance === "light";
  const darkSelected = appearance === "dark";
  const appearanceOption = (selected) => ({
    borderColor: selected ? (isDark ? brand.accent : colors.primary) : isDark ? tw.gray700 : tw.gray200,
    background: selected ? (isDark ? "rgba(60,15,61,0.2)" : brand.plumTint) : isDark ? tw.gray800 : "#ffffff",
    markerBorder: selected ? (isDark ? brand.accent : colors.primary) : isDark ? tw.gray600 : tw.gray300,
    markerFill: isDark ? brand.accent : colors.primary,
    titleColor: isDark ? "#ffffff" : tw.gray900,
    descriptionColor: isDark ? tw.gray400 : tw.gray500,
  });

  return (
    <Screen background={isDark ? "#0a0a0a" : "#f5f5f5"}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => goTo("/")} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={20} color={isDark ? "#ffffff" : "#000000"} />
          </Pressable>
        </View>

        <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
          <View style={styles.infoRow}>
            <UserAvatar size={64} image={userProfile?.profileImage} initial={avatarInitial} fontSize={24} />
            <View style={styles.infoText}>
              <Text style={[styles.name, { color: isDark ? "#ffffff" : "#000000" }]}>{displayName}</Text>
              {hasValidEmail ? (
                <Text style={[styles.email, { color: isDark ? tw.gray300 : "#000000" }]}>{userProfile.email}</Text>
              ) : null}
              {userProfile?.phone ? (
                <Text
                  style={[
                    styles.phone,
                    {
                      color: hasValidEmail ? (isDark ? tw.gray400 : tw.gray600) : isDark ? "#ffffff" : "#000000",
                    },
                  ]}
                >
                  {userProfile.phone}
                </Text>
              ) : null}
              {!hasValidEmail && !userProfile?.phone ? (
                <Text style={[styles.phone, { color: isDark ? tw.gray400 : tw.gray500 }]}>Not available</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <ProfileRow
            Icon={Wallet}
            label={`${companyName} Money`}
            onPress={() => router.push("/wallet")}
            right={
              <Text style={[styles.balance, { color: isDark ? "#4ade80" : tw.green600 }]}>
                {"₹"}
                {Number(walletBalance || 0).toFixed(0)}
              </Text>
            }
          />
          <ProfileRow Icon={Tag} label="Your coupons" onPress={() => router.push("/profile/coupons")} />
          <ProfileRow Icon={ShoppingCart} label="Your cart" onPress={() => router.push("/cart")} />

          <ProfileCard onPress={() => router.push("/profile/refer-earn")}>
            <View style={[styles.rowBetween, styles.mb8]}>
              <View style={styles.rowGap12}>
                <IconChip Icon={Tag} />
                <Text style={[styles.rowLabel, { color: labelColor }]}>Refer & Earn</Text>
              </View>
              {referralReward > 0 ? (
                <View style={[styles.earnBadge, { backgroundColor: isDark ? "rgba(20,83,45,0.2)" : tw.green100 }]}>
                  <Text style={[styles.earnText, { color: isDark ? "#86efac" : tw.green700 }]}>
                    Earn {"₹"}
                    {referralReward}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.rowBetween}>
              <Text style={[styles.referDesc, { color: isDark ? tw.gray400 : tw.gray500 }]}>
                Invite a friend. Reward is added to your wallet when they sign up.
              </Text>
              <Pressable
                onPress={handleShareReferral}
                disabled={!referralLink}
                style={[styles.referBtn, !referralLink && styles.disabled]}
                hitSlop={6}
              >
                <Share2 size={14} color={colors.primary} />
                <Text style={[styles.referBtnText, { color: colors.primary }]}>Refer</Text>
              </Pressable>
            </View>
          </ProfileCard>

          <ProfileRow
            Icon={MapPin}
            label="Saved addresses"
            subtitle={savedAddressSummary}
            onPress={() => router.push("/address-selector")}
            right={
              <View style={[styles.countPill, { backgroundColor: pillBg }]}>
                <Text style={[styles.countText, { color: pillText }]}>{addresses?.length || 0}</Text>
              </View>
            }
          />

          <ProfileRow
            Icon={User}
            label="Your profile"
            onPress={() => router.push("/profile/edit")}
            right={
              <View
                style={[
                  styles.completion,
                  isComplete
                    ? { backgroundColor: colors.primary, borderColor: "transparent", ...shadow.sm }
                    : { backgroundColor: "#7e386615", borderColor: colors.primary + "1A" },
                ]}
              >
                <Text style={[styles.completionText, { color: isComplete ? "#ffffff" : colors.primary }]}>
                  {profileCompletion}% completed
                </Text>
              </View>
            }
          />

          <ProfileRow
            Icon={Leaf}
            label="Veg Mode"
            onPress={() => setVegModeOpen(true)}
            chevronColor={tw.gray400}
            right={<Text style={[styles.rightValue, { color: labelColor }]}>{vegMode ? "ON" : "OFF"}</Text>}
          />

          <ProfileRow
            Icon={Palette}
            label="Appearance"
            onPress={() => setAppearanceOpen(true)}
            chevronColor={tw.gray400}
            right={
              <Text style={[styles.rightValue, { color: labelColor }]}>
                {appearance.charAt(0).toUpperCase() + appearance.slice(1)}
              </Text>
            }
          />
        </View>

        <View style={styles.section}>
          <SectionTitle title="Collections" />
          <ProfileRow Icon={Bookmark} label="Your collections" onPress={() => router.push("/profile/favorites")} />
        </View>

        <View style={styles.section}>
          <SectionTitle title="Food Orders" />
          <ProfileRow Icon={Building2} label="Your orders" onPress={() => router.navigate("/orders")} />
        </View>

        <View style={styles.moreSection}>
          <SectionTitle title="More" />
          <View style={styles.list}>
            <ProfileRow Icon={SettingsIcon} label="Help & Support" onPress={() => router.push("/profile/support")} />
            <ProfileRow Icon={Info} label="About" onPress={() => router.push("/profile/about")} />
            <ProfileRow
              Icon={TriangleAlert}
              label="Report a safety emergency"
              onPress={() => router.push("/profile/report-safety-emergency")}
            />

            <ProfileCard onPress={handleTestNotification}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGap12}>
                  <View style={[styles.chip, { backgroundColor: isDark ? "rgba(30,58,138,0.2)" : tw.blue50 }]}>
                    <Pulse active={isTestingNotification}>
                      <Bell size={20} color="#3b82f6" />
                    </Pulse>
                  </View>
                  <Text style={[styles.rowLabel, { color: labelColor }]}>
                    {isTestingNotification ? "Sending test..." : "Test Notification"}
                  </Text>
                </View>
                <Chevron />
              </View>
            </ProfileCard>

            <ProfileCard onPress={() => !isLoggingOut && setLogoutConfirmOpen(true)}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGap12}>
                  <View style={[styles.chip, { backgroundColor: pillBg }]}>
                    <Pulse active={isLoggingOut}>
                      <Power size={20} color={pillText} />
                    </Pulse>
                  </View>
                  <Text style={[styles.rowLabel, { color: labelColor }]}>
                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </Text>
                </View>
                <Chevron />
              </View>
            </ProfileCard>

            <ProfileRow
              Icon={Trash2}
              iconBackground={isDark ? "rgba(127,29,29,0.2)" : tw.red50}
              iconColor={tw.red500}
              label="Delete Account"
              labelColor={tw.red500}
              chevronColor="#fca5a5"
              onPress={() => {
                setDeleteStep(1);
                setDeleteCaptcha("");
                setDeleteAccountOpen(true);
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Veg Mode popup */}
      <AccountDialog visible={vegModeOpen} onClose={() => setVegModeOpen(false)}>
        <DialogHeaderBlock
          title="Veg Mode"
          description="Filter restaurants and dishes based on your dietary preferences"
        />
        <View style={styles.options}>
          <ChoiceOption
            selected={vegMode}
            onPress={() => {
              setVegMode(true);
              setVegModeOpen(false);
            }}
            borderColor={vegMode ? tw.green600 : tw.gray200}
            background={vegMode ? tw.green50 : "#ffffff"}
            markerBorder={vegMode ? tw.green600 : tw.gray300}
            markerFill={tw.green600}
            title="Veg Mode ON"
            description="Show only vegetarian options"
            titleColor={tw.gray900}
            descriptionColor={tw.gray500}
            trailing={<Leaf size={20} color={vegMode ? tw.green600 : tw.gray400} />}
          />
          <ChoiceOption
            selected={!vegMode}
            onPress={() => {
              setVegMode(false);
              setVegModeOpen(false);
            }}
            borderColor={!vegMode ? colors.secondary : isDark ? tw.gray800 : tw.gray200}
            background={!vegMode ? (isDark ? "rgba(60,15,61,0.1)" : brand.plumTint) : "#ffffff"}
            markerBorder={!vegMode ? colors.secondary : tw.gray300}
            markerFill={colors.secondary}
            title="Veg Mode OFF"
            description="Show all options"
            titleColor={tw.gray900}
            descriptionColor={tw.gray500}
          />
        </View>
      </AccountDialog>

      {/* Appearance popup */}
      <AccountDialog
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        style={{ backgroundColor: cardBg, borderColor: isDark ? tw.gray800 : tw.gray200 }}
      >
        <DialogHeaderBlock
          title="Appearance"
          description="Choose your preferred theme"
          titleColor={isDark ? "#ffffff" : tw.gray900}
          descriptionColor={isDark ? tw.gray400 : tw.gray500}
        />
        <View style={styles.options}>
          <ChoiceOption
            selected={lightSelected}
            onPress={() => {
              setAppearance("light");
              setAppearanceOpen(false);
            }}
            {...appearanceOption(lightSelected)}
            leading={<Sun size={20} color={isDark ? tw.yellow400 : "#eab308"} />}
            title="Light"
            description="Default light theme"
          />
          <ChoiceOption
            selected={darkSelected}
            onPress={() => {
              setAppearance("dark");
              setAppearanceOpen(false);
            }}
            {...appearanceOption(darkSelected)}
            leading={<Moon size={20} color={isDark ? tw.gray300 : tw.gray600} />}
            title="Dark"
            description="Dark theme"
          />
        </View>
      </AccountDialog>

      {/* Logout confirmation */}
      <AccountDialog
        visible={logoutConfirmOpen}
        onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)}
        showCloseButton={false}
        style={[styles.confirm, { backgroundColor: cardBg, borderColor: isDark ? tw.gray800 : tw.gray200 }]}
      >
        <Text style={[styles.confirmTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>Log out?</Text>
        <Text style={[styles.confirmText, { color: isDark ? tw.gray400 : tw.gray500 }]}>
          Are you sure you want to log out?
        </Text>
        <View style={styles.confirmButtons}>
          <Button
            variant="outline"
            title="No"
            style={styles.flexBtn}
            disabled={isLoggingOut}
            onPress={() => setLogoutConfirmOpen(false)}
          />
          <Button
            title="Yes"
            style={[styles.flexBtn, { backgroundColor: colors.secondary }]}
            textStyle={styles.white}
            disabled={isLoggingOut}
            onPress={() => {
              setLogoutConfirmOpen(false);
              handleLogout();
            }}
          />
        </View>
      </AccountDialog>

      {/* Delete account confirmation */}
      <AccountDialog
        visible={deleteAccountOpen}
        onClose={() => !isDeleting && setDeleteAccountOpen(false)}
        showCloseButton={false}
        style={[styles.confirm, { backgroundColor: cardBg, borderColor: isDark ? tw.gray800 : tw.gray200 }]}
      >
        {deleteStep === 1 ? (
          <View>
            <View style={[styles.rowGap12, styles.mb16]}>
              <View style={[styles.warnChip, { backgroundColor: isDark ? "rgba(127,29,29,0.3)" : tw.red100 }]}>
                <TriangleAlert size={24} color={tw.red500} />
              </View>
              <Text style={[styles.confirmTitle, { color: isDark ? "#ffffff" : tw.gray900 }]}>Delete Account?</Text>
            </View>
            <View
              style={[
                styles.warnBox,
                {
                  backgroundColor: isDark ? "rgba(127,29,29,0.1)" : tw.red50,
                  borderColor: isDark ? "rgba(127,29,29,0.3)" : tw.red100,
                },
              ]}
            >
              <Text style={[styles.warnTitle, { color: isDark ? "#f87171" : tw.red600 }]}>
                ⚠️ This action is permanent and cannot be undone!
              </Text>
              <View style={styles.warnList}>
                {[
                  "Your profile, addresses, and preferences will be deleted",
                  "Wallet balance will be forfeited",
                  "Order history will be anonymized",
                  "Referral rewards will be lost",
                  "You can sign up again as a new user with the same number",
                ].map((line) => (
                  <Text
                    key={line}
                    style={[styles.warnItem, { color: isDark ? "rgba(248,113,113,0.7)" : "rgba(239,68,68,0.8)" }]}
                  >
                    • {line}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.confirmButtonsTight}>
              <Button variant="outline" title="Cancel" style={styles.flexBtn} onPress={() => setDeleteAccountOpen(false)} />
              <Button
                title="Continue"
                style={[styles.flexBtn, { backgroundColor: tw.red500 }]}
                textStyle={styles.white}
                onPress={() => setDeleteStep(2)}
              />
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.confirmTitle, styles.mb8, { color: isDark ? "#ffffff" : tw.gray900 }]}>
              Confirm Deletion
            </Text>
            <Text style={[styles.confirmText, styles.mb16, { color: isDark ? tw.gray400 : tw.gray500 }]}>
              Type <Text style={[styles.confirmText, styles.deleteWord]}>DELETE MY ACCOUNT</Text> to confirm.
            </Text>
            <TextInput
              value={deleteCaptcha}
              onChangeText={setDeleteCaptcha}
              placeholder="Type here..."
              placeholderTextColor={tw.gray400}
              autoFocus
              autoCorrect={false}
              autoCapitalize="characters"
              autoComplete="off"
              style={[
                styles.captcha,
                {
                  borderColor: isDark ? tw.gray700 : tw.gray200,
                  backgroundColor: isDark ? tw.gray900 : tw.gray50,
                  color: isDark ? "#ffffff" : tw.gray900,
                },
              ]}
            />
            <View style={styles.confirmButtonsTight}>
              <Button
                variant="outline"
                title="Back"
                style={styles.flexBtn}
                onPress={() => {
                  setDeleteStep(1);
                  setDeleteCaptcha("");
                }}
              />
              <Button
                title={isDeleting ? "Deleting..." : "Delete Forever"}
                style={[
                  styles.flexBtn,
                  { backgroundColor: tw.red500 },
                  (deleteCaptcha.trim() !== "DELETE MY ACCOUNT" || isDeleting) && styles.faded,
                ]}
                textStyle={styles.white}
                disabled={deleteCaptcha.trim() !== "DELETE MY ACCOUNT" || isDeleting}
                onPress={handleDeleteAccount}
              />
            </View>
          </View>
        )}
      </AccountDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  infoCard: { borderRadius: 16, paddingTop: 4, overflow: "hidden", ...shadow.sm },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 },
  infoText: { flex: 1, paddingTop: 4 },
  name: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  email: { fontSize: 14, marginBottom: 4 },
  phone: { fontSize: 14, marginBottom: 12 },
  group: { gap: 8, marginTop: 12, marginBottom: 12 },
  section: { marginBottom: 12 },
  moreSection: { marginBottom: 32, paddingBottom: 32 },
  list: { gap: 8 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  sectionBar: { width: 4, height: 16, borderRadius: 4 },
  sectionText: { fontSize: 16, fontWeight: "600" },
  balance: { fontSize: 16, fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap12: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { fontSize: 16, fontWeight: "500" },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  chip: { borderRadius: 999, padding: 8 },
  earnBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  earnText: { fontSize: 12, fontWeight: "600" },
  referDesc: { fontSize: 12, flex: 1 },
  referBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  referBtnText: { fontSize: 12, fontWeight: "500" },
  disabled: { opacity: 0.5 },
  countPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  countText: { fontSize: 12, fontWeight: "500" },
  completion: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  completionText: { fontSize: 12, fontWeight: "500" },
  rightValue: { fontSize: 16, fontWeight: "500" },
  options: { gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  confirm: { padding: 20 },
  confirmTitle: { fontSize: 18, fontWeight: "700" },
  confirmText: { fontSize: 14, marginTop: 4 },
  confirmButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
  confirmButtonsTight: { flexDirection: "row", gap: 12 },
  flexBtn: { flex: 1, borderRadius: 12 },
  white: { color: "#ffffff" },
  faded: { opacity: 0.4 },
  warnChip: { borderRadius: 999, padding: 10 },
  warnBox: { borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  warnTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  warnList: { gap: 6 },
  warnItem: { fontSize: 12 },
  deleteWord: { fontWeight: "700", color: tw.red500 },
  captcha: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: fontFamilyByWeight["400"],
    marginBottom: 16,
  },
});
