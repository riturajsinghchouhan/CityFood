// Port of pages/restaurant/ExploreMore.jsx (/explore tab): the "Explore more" hub with the
// restaurant card, the five link sections, the feature search and the "My profile" panel
// (edit owner, test notifications, logout, delete restaurant). The web's "Schedule off" feature,
// its pickers and the logout confirmation are never reachable on web and are not ported.
import { router } from "expo-router";
import { ArrowLeft, ChevronRight, Search, Store, UserRound } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { deleteAccount, getCurrentRestaurant, sendTestNotification } from "../../api";
import {
  DeleteRestaurantDialog,
  ExploreSearch,
  ExploreSection,
  FadeUp,
  NoResults,
  ProfileSheet,
  filterSections,
} from "../../components/outlet/ExploreParts";
import { formatExploreAddress } from "../../components/outlet/common";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { useShellLogout } from "../../components/shell/logout";
import { openShellRoute } from "../../components/shell/navigate";
import { TAB_ROUTES } from "../../components/shell/layoutConfig";
import { ScalePressable, Text, toast } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { registerForPushNotifications } from "../../lib/push";
import { useTheme } from "../../theme/ThemeContext";
import { tw } from "../../theme/tokens";

// Web route ("/feedback?tab=complaints") -> native navigation; tab roots switch tabs.
function openRoute(route) {
  const [pathname, query] = route.split("?");
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  if (TAB_ROUTES.has(pathname)) {
    if (Object.keys(params).length) router.dismissTo({ pathname, params });
    else openShellRoute(pathname, "/explore");
    return;
  }
  router.push(Object.keys(params).length ? { pathname, params } : pathname);
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { restaurant: sessionUser } = useAuth();
  const shellInset = useShellBottomInset();
  const { logout, isLoggingOut } = useShellLogout();

  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [activeTestNotification, setActiveTestNotification] = useState("");
  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCurrentRestaurant();
        const data = res?.data?.restaurant;
        if (data && !cancelled) setRestaurantData(data);
      } catch {
        // web keeps the defaults when the fetch fails
      } finally {
        if (!cancelled) setLoadingRestaurant(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const userData = useMemo(() => {
    // Priority 1 on web: the session user when it carries name + role (it never has a role).
    if (sessionUser && sessionUser.name && sessionUser.role) {
      return {
        name: sessionUser.name,
        phone: sessionUser.phone || restaurantData?.ownerPhone || restaurantData?.phone || "N/A",
        email: sessionUser.email || restaurantData?.ownerEmail || restaurantData?.email || "N/A",
        role: String(sessionUser.role).toUpperCase(),
        profileImage: sessionUser.profileImage || restaurantData?.profileImage,
      };
    }
    if (restaurantData) {
      return {
        name: restaurantData.ownerName || restaurantData.name || "Restaurant Owner",
        phone: restaurantData.ownerPhone || restaurantData.phone || "N/A",
        email: restaurantData.ownerEmail || restaurantData.email || "N/A",
        role: "OWNER",
        profileImage: restaurantData.profileImage,
      };
    }
    return { name: loadingRestaurant ? "Loading..." : "Restaurant Owner", phone: "", email: "", role: "OWNER" };
  }, [sessionUser, restaurantData, loadingRestaurant]);

  const restaurantDisplayName = restaurantData?.name || "Loading...";
  const restaurantDisplayAddress = restaurantData?.location ? formatExploreAddress(restaurantData.location) : "";

  const handleLogout = () => {
    if (isLoggingOut) return;
    setProfileOpen(false);
    logout();
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setDeleteAccountConfirmOpen(false);
      logout({ to: "/welcome" });
    } catch {
      Alert.alert("", "Failed to delete account. Please try again.");
      setDeleteAccountConfirmOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleTestNotification = async (channel = "fcm") => {
    if (activeTestNotification) return;
    setActiveTestNotification(channel);
    try {
      // Refresh this device's registration first (asks for notification permission if needed).
      if (channel === "fcm") await registerForPushNotifications();
      const res = await sendTestNotification("mobile", channel);
      const voipResult = res?.data?.voip;
      if (channel === "voip" && voipResult?.skipped) {
        toast.error(voipResult.reason || "No VoIP token registered on this device");
        return;
      }
      if (channel === "voip") {
        if (voipResult?.failureCount > 0) {
          toast.error(voipResult?.results?.[0]?.error || "VoIP send failed");
          return;
        }
        toast.success("Test VOIP sent! Check your iPhone.");
      } else {
        const details = res?.data || {};
        const successCount = details?.successCount || 0;
        const failureCount = details?.failureCount || 0;
        if (successCount > 0) toast.success(`Test sent! Delivered: ${successCount}, Failed: ${failureCount}`);
        else toast.error(`Test failed to deliver. Delivered: 0, Failed: ${failureCount}`);
      }
    } catch (err) {
      toast.error(
        (!err?.isNetworkError && err?.data?.message) ||
          (channel === "voip" ? "Failed to send test VOIP" : "Failed to send test notification"),
      );
    } finally {
      setActiveTestNotification("");
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const filteredSections = filterSections(searchQuery);

  return (
    <View style={styles.page}>
      <FadeUp duration={250} style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => openShellRoute("/", "/explore")}
            style={({ pressed }) => [styles.headerBtn, pressed && { backgroundColor: tw.gray100 }]}
            hitSlop={6}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={tw.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Explore more</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [styles.searchBtn, pressed && { backgroundColor: tw.gray100 }]}
            accessibilityLabel="Search"
          >
            <Search size={20} color={tw.gray900} />
          </Pressable>
          <Pressable
            onPress={() => setProfileOpen(true)}
            style={[
              styles.profileBtn,
              profileOpen ? [{ backgroundColor: colors.primary }, styles.profileBtnActive] : { backgroundColor: tw.gray100 },
            ]}
            accessibilityLabel="Profile"
          >
            <UserRound size={20} color={profileOpen ? "#ffffff" : tw.gray900} />
          </Pressable>
        </View>
      </FadeUp>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + 96 + shellInset }]}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp delay={0.05}>
          <ScalePressable
            scaleTo={0.99}
            onPress={() => router.push("/outlet-info")}
            style={styles.restaurantCard}
            accessibilityRole="button"
          >
            <View style={styles.cardLeft}>
              <View style={styles.storeIcon}>
                <Store size={20} color={tw.gray900} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardName}>{restaurantDisplayName}</Text>
                {restaurantDisplayAddress ? <Text style={styles.cardAddress}>{restaurantDisplayAddress}</Text> : null}
              </View>
            </View>
            <ChevronRight size={20} color={tw.gray300} />
          </ScalePressable>
        </FadeUp>

        {filteredSections.length > 0 ? (
          filteredSections.map((section, index) => (
            <View key={section.key}>
              <ExploreSection section={section} delay={0.1 + index * 0.05} onOpen={(item) => openRoute(item.route)} />
              {index < filteredSections.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))
        ) : (
          <NoResults />
        )}
      </ScrollView>

      <ExploreSearch
        open={searchOpen}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onClose={closeSearch}
        onOpen={(item) => {
          openRoute(item.route);
          closeSearch();
        }}
      />

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userData={userData}
        loading={loadingRestaurant}
        onEditOwner={() => {
          setProfileOpen(false);
          router.push("/edit-owner");
        }}
        onTest={handleTestNotification}
        activeTest={activeTestNotification}
        showVoip={__DEV__}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        onDelete={() => {
          setProfileOpen(false);
          setDeleteAccountConfirmOpen(true);
        }}
      />

      <DeleteRestaurantDialog
        open={deleteAccountConfirmOpen}
        onClose={() => setDeleteAccountConfirmOpen(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeletingAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: tw.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 50,
  },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  headerBtn: { padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: tw.gray900 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBtn: { padding: 8, borderRadius: 8 },
  profileBtn: { padding: 8, borderRadius: 9999 },
  profileBtnActive: { boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)" },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tw.gray200,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  storeIcon: { padding: 8, backgroundColor: tw.gray100, borderRadius: 8 },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: "600", color: tw.gray900, marginBottom: 2 },
  cardAddress: { fontSize: 14, color: tw.gray500 },
  divider: { borderTopWidth: 1, borderTopColor: tw.gray200, marginBottom: 24 },
});
