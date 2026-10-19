// Port of Frontend/src/modules/Food/pages/user/dining/DiningRestaurantDetails.jsx
// (/dining/:diningType/:slug). The offers, "Open now" and "Featured In" copy is static on web.
// The web builds a favorite toggle here but never renders a button for it, so it is not ported.
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, IndianRupee, MapPin, Share2, Ticket, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMenuByRestaurantId, getOccupiedSeatsPublic, getRestaurantById } from "../../api";
import { BottomSheet, Button, Screen, Text, toast } from "../../components/ui";
import AppImage from "../../components/ui/AppImage";
import { ASSET_ORIGIN } from "../../config";
import { useAppBack } from "../../navigation/back";
import { useTheme } from "../../theme/ThemeContext";
import { brand, tw } from "../../theme/tokens";
import { getMenuFromResponse } from "../browse/lib";
import { NAV_KEYS, formatTimeValue, getNavState, navigateWithState, pal } from "./diningLib";

const formatAddress = (restaurant) =>
  restaurant?.location?.formattedAddress ||
  restaurant?.location?.addressLine1 ||
  restaurant?.location?.address ||
  [restaurant?.location?.area || restaurant?.area, restaurant?.location?.city || restaurant?.city]
    .filter(Boolean)
    .join(", ");

const buildImageList = (restaurant) => {
  const candidates = [
    restaurant?.coverImage?.url,
    restaurant?.coverImage,
    ...(Array.isArray(restaurant?.coverImages) ? restaurant.coverImages.map((image) => image?.url || image) : []),
    ...(Array.isArray(restaurant?.menuImages) ? restaurant.menuImages.map((image) => image?.url || image) : []),
    restaurant?.profileImage?.url,
    restaurant?.profileImage,
  ];
  return candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
};

const buildFacilities = (restaurant) => {
  const facilities = [];
  if (restaurant?.diningSettings?.tableBookingEnabled !== false) facilities.push("Dinner");
  if (restaurant?.isAcceptingOrders !== false) facilities.push("Lunch");
  if (restaurant?.diningSettings?.homeDeliveryAvailable || restaurant?.homeDeliveryAvailable) facilities.push("Home delivery");
  if (restaurant?.diningSettings?.takeawayAvailable || restaurant?.takeawayAvailable) facilities.push("Takeaway available");
  if (restaurant?.diningSettings?.vegOnly || restaurant?.vegOnly) facilities.push("Vegetarian only");
  if (restaurant?.diningSettings?.lessNoisy || restaurant?.ambience === "quiet") facilities.push("Less noisy");
  return facilities.length > 0
    ? facilities
    : ["Dinner", "Lunch", "Home delivery", "Takeaway available", "Vegetarian only", "Less noisy"];
};

const buildFeaturedSections = (menuSections) =>
  menuSections
    .map((section, index) => {
      const items = [
        ...(Array.isArray(section?.items) ? section.items : []),
        ...(Array.isArray(section?.subsections) ? section.subsections : []).flatMap((sub) => sub?.items || []),
      ];
      return { id: `${section?.name || "section"}-${index}`, title: section?.name || "Menu", pages: items.length || 1 };
    })
    .slice(0, 2);

const TOP_TABS = [
  { id: "prebook", label: "Pre-book offers", target: "prebook" },
  { id: "walkin", label: "Walk-in offers", target: "prebook" },
  { id: "menu", label: "Menu", target: "menu" },
  { id: "photos", label: "Photos", target: "photos" },
  { id: "about", label: "About", target: "about" },
];

function GuestSheet({ visible, onClose, maxCapacity, occupiedSeats, remainingSeats, selectedGuests, onSelect, onContinue }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 32 - 36) / 4);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={[styles.sheet, { backgroundColor: isDark ? pal.slate900 : "#ffffff" }]}
    >
      <View style={styles.sheetInner}>
        <View style={[styles.sheetHandle, { backgroundColor: isDark ? pal.slate700 : "#e7e5e4" }]} />
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: isDark ? pal.slate100 : "#23180f" }]}>Select number of guests</Text>
            <Text style={[styles.sheetSub, { color: isDark ? pal.slate400 : "#7b6651" }]}>
              {remainingSeats > 0
                ? `Only ${remainingSeats} out of ${maxCapacity} seats available now.`
                : "Fully booked for now. Try later!"}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.sheetClose, { backgroundColor: isDark ? pal.slate800 : "#f5f5f5" }]}
          >
            <X size={16} color={isDark ? pal.slate300 : "#5b5b5b"} />
          </Pressable>
        </View>

        <View style={styles.guestGrid}>
          {Array.from({ length: maxCapacity }, (_, index) => {
            const count = index + 1;
            const isBooked = count <= occupiedSeats;
            const isTooLarge = count > remainingSeats && !isBooked;
            const selected = selectedGuests === count;
            let look;
            if (selected) {
              look = {
                borderColor: colors.primary,
                backgroundColor: isDark ? "rgba(59,7,100,0.3)" : brand.plumTint,
                color: colors.primary,
                transform: [{ scale: 1.02 }],
                boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
              };
            } else if (isBooked) {
              look = {
                borderColor: isDark ? "rgba(127,29,29,0.3)" : pal.red100,
                backgroundColor: isDark ? "rgba(69,10,10,0.2)" : pal.red50,
                color: pal.red400,
                opacity: 0.7,
              };
            } else if (isTooLarge) {
              look = {
                borderColor: isDark ? pal.slate800 : tw.gray100,
                backgroundColor: isDark ? pal.slate950 : tw.gray50,
                color: isDark ? pal.slate600 : tw.gray300,
              };
            } else {
              look = {
                borderColor: isDark ? pal.slate800 : "#ece7de",
                backgroundColor: isDark ? pal.slate800 : "#ffffff",
                color: isDark ? pal.slate100 : "#23180f",
              };
            }
            const { color, ...boxLook } = look;
            return (
              <Pressable
                key={`sheet-${count}`}
                disabled={isBooked || isTooLarge}
                onPress={() => onSelect(count)}
                style={[styles.guestCell, { width: cell }, boxLook]}
              >
                {isBooked ? (
                  <View style={{ alignItems: "center", gap: 2 }}>
                    <Text style={[styles.bookedLabel, { color }]}>BOOKED</Text>
                    <Text style={[styles.guestText, { color }]}>{count}</Text>
                  </View>
                ) : (
                  <Text style={[styles.guestText, { color }]}>{count}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Button
          onPress={onContinue}
          disabled={remainingSeats === 0 || selectedGuests > remainingSeats}
          style={[
            styles.continueBtn,
            remainingSeats === 0 || selectedGuests > remainingSeats
              ? { backgroundColor: tw.gray200, opacity: 1 }
              : { backgroundColor: colors.primary },
          ]}
          textStyle={{
            fontSize: 16,
            fontWeight: "700",
            color: remainingSeats === 0 || selectedGuests > remainingSeats ? tw.gray400 : "#ffffff",
          }}
          title={remainingSeats === 0 ? "Fully Booked" : "Continue"}
        />
      </View>
    </BottomSheet>
  );
}

export default function DiningRestaurantDetailsScreen() {
  const { slug, diningType } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const halfWidth = Math.floor((windowWidth - 32 - 12) / 2);
  const goBack = useAppBack();
  const [routeState] = useState(() => getNavState(NAV_KEYS.details(slug)));
  const routeRestaurant = routeState?.restaurant || null;

  const [restaurant, setRestaurant] = useState(routeRestaurant);
  const [menuSections, setMenuSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGuests, setSelectedGuests] = useState(2);
  const [isBookingSheetOpen, setIsBookingSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("prebook");
  const [occupiedSeats, setOccupiedSeats] = useState(0);

  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const contentY = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const lookup = routeRestaurant?._id || routeRestaurant?.restaurantId || routeRestaurant?.id || slug;
        const restaurantResponse = await getRestaurantById(lookup);
        if (cancelled) return;
        if (!restaurantResponse?.success) {
          setError("Restaurant not found");
          setRestaurant(null);
          return;
        }
        const resolved = restaurantResponse?.data?.restaurant || restaurantResponse?.data || null;
        if (!resolved) {
          setError("Restaurant not found");
          setRestaurant(null);
          return;
        }
        setRestaurant(resolved);
        const restaurantId = resolved?._id || resolved?.id || slug;

        try {
          const availabilityRes = await getOccupiedSeatsPublic(restaurantId);
          if (!cancelled && availabilityRes?.success) {
            setOccupiedSeats(Number(availabilityRes.data?.occupiedSeats) || 0);
          }
        } catch {
          // web logs and keeps 0 occupied seats
        }

        const menuResponse = await getMenuByRestaurantId(restaurantId).catch(() => null);
        if (cancelled) return;
        const resolvedMenu = menuResponse ? getMenuFromResponse(menuResponse) : null;
        setMenuSections(Array.isArray(resolvedMenu?.sections) ? resolvedMenu.sections : []);
      } catch {
        if (cancelled) return;
        setError("Failed to load restaurant");
        setRestaurant(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeRestaurant, slug]);

  const maxCapacity = restaurant?.diningSettings?.maxGuests || 6;
  const remainingSeats = Math.max(0, maxCapacity - occupiedSeats);

  const scrollToSection = useCallback((id) => {
    const y = sectionY.current[id];
    if (typeof y !== "number") return;
    // Land the section just under the stuck tab bar (scrollIntoView block: "start").
    scrollRef.current?.scrollTo({ y: Math.max(0, contentY.current + y - 64), animated: true });
  }, []);

  const pageBg = isDark ? pal.slate950 : "#f6f7fb";

  if (loading) {
    return (
      <Screen background="#f6f7fb">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !restaurant) {
    return (
      <Screen background="#f6f7fb">
        <View style={[styles.center, { gap: 16, paddingHorizontal: 16 }]}>
          <Text style={styles.notFound}>Restaurant not found</Text>
          <Button variant="outline" onPress={goBack} title="Go Back" />
        </View>
      </Screen>
    );
  }

  const restaurantName = restaurant.name || restaurant.restaurantName || "Restaurant";
  const address = formatAddress(restaurant) || "Address unavailable";
  const imageGallery = buildImageList(restaurant);
  const heroImage = imageGallery[0] || "";
  const menuPreviewImages = imageGallery.length > 0 ? imageGallery : [""];
  const featuredSections = buildFeaturedSections(menuSections);
  const cuisines =
    Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
      ? restaurant.cuisines.join(", ")
      : "Asian, Italian, Continental, Chinese, North Indian, Desserts, Beverages, Coffee";
  const costForTwo = restaurant?.costForTwo ? `₹${restaurant.costForTwo} for two` : "₹1900 for two";
  const facilities = buildFacilities(restaurant);
  const rating = Number(restaurant?.rating || restaurant?.avgRating || 0).toFixed(1);
  const reviewCount = restaurant?.totalRatings || restaurant?.reviewCount || restaurant?.reviewsCount || 0;
  const openingTime = formatTimeValue(restaurant?.openingTime || restaurant?.diningSettings?.openingTime || "12:00");
  const closingTime = formatTimeValue(restaurant?.closingTime || restaurant?.diningSettings?.closingTime || "23:59");
  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false;

  const handleShare = async () => {
    const url = `${ASSET_ORIGIN}/food/user/dining/${diningType}/${slug}`;
    try {
      await Share.share({ title: restaurantName, message: `Check out ${restaurantName} on CityFood!\n${url}`, url });
    } catch {
      toast.error("Sharing failed. Please try again.");
    }
  };

  const handleContinueBooking = () => {
    if (!isDiningEnabled) return;
    setIsBookingSheetOpen(false);
    navigateWithState({ pathname: "/dining/book/[slug]", params: { slug } }, NAV_KEYS.book(slug), {
      guestCount: selectedGuests,
      restaurant,
    });
  };

  const sectionTitle = [styles.sectionTitle, { color: isDark ? pal.slate100 : "#23180f" }];
  const divider = { borderColor: isDark ? pal.slate800 : "#e8e8ef" };
  const photoList = imageGallery.length > 0 ? imageGallery.slice(0, 4) : menuPreviewImages.slice(0, 2);

  return (
    <Screen background={pageBg}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 112 + insets.bottom }}
      >
        {/* Hero + book button */}
        <View>
          <View style={styles.hero}>
            {heroImage ? (
              <AppImage src={heroImage} priority style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={["#eadcc7", "#a09279", "#655749"]} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.78)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroTopRow}>
              <Pressable onPress={goBack} style={styles.heroBtn}>
                <ArrowLeft size={20} color="#ffffff" />
              </Pressable>
              <Pressable onPress={handleShare} style={styles.heroBtn}>
                <Share2 size={20} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.heroBottom}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName}>{restaurantName}</Text>
                <Text style={styles.heroAddress}>{address}</Text>
                <Text style={styles.heroMeta}>
                  {costForTwo}
                  <Text style={[styles.heroMeta, { color: "rgba(255,255,255,0.65)" }]}>{"  •  "}</Text>
                  {cuisines}
                </Text>
                <View style={styles.openPill}>
                  <CheckCircle2 size={16} color="#48d597" />
                  <Text style={styles.openPillText}>Open now</Text>
                  <Text style={[styles.openPillText, { color: "rgba(255,255,255,0.7)" }]}>|</Text>
                  <Text style={styles.openPillText}>
                    {openingTime} to {closingTime}
                  </Text>
                </View>
              </View>
              <View style={[styles.ratingCard, { backgroundColor: isDark ? pal.slate800 : "#ffffff" }]}>
                <View style={styles.ratingRow}>
                  <Text style={[styles.ratingValue, { color: isDark ? pal.slate100 : "#1f2328" }]}>{rating}</Text>
                  <Text style={styles.ratingStar}>{"★"}</Text>
                </View>
                <Text style={[styles.reviews, { color: isDark ? pal.slate400 : "#6e7481" }]}>{reviewCount} Reviews</Text>
              </View>
            </View>
          </View>

          <View style={styles.bookWrap}>
            <Pressable
              onPress={() => isDiningEnabled && setIsBookingSheetOpen(true)}
              disabled={!isDiningEnabled}
              style={[
                styles.bookPill,
                isDiningEnabled
                  ? { borderColor: isDark ? pal.slate800 : "#f1ebee", backgroundColor: isDark ? pal.slate900 : "#ffffff" }
                  : {
                      borderColor: isDark ? "rgba(127,29,29,0.3)" : "#f2d7da",
                      backgroundColor: isDark ? "rgba(69,10,10,0.2)" : "#fff5f6",
                      opacity: 0.8,
                    },
              ]}
            >
              <Ticket size={15} color={colors.primary} />
              <Text
                style={[
                  styles.bookPillText,
                  { color: isDiningEnabled ? (isDark ? pal.slate100 : "#2b2118") : "#c06a79" },
                ]}
              >
                {isDiningEnabled ? "Book a table" : "Dining paused"}
              </Text>
            </Pressable>
            {!isDiningEnabled ? (
              <View style={styles.pausedNote}>
                <Text style={styles.pausedNoteText}>Dining bookings are currently turned off by the restaurant.</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Sticky tabs */}
        <View
          style={[
            styles.tabsBar,
            { borderColor: isDark ? pal.slate800 : "#ececf3", backgroundColor: isDark ? "rgba(2,6,23,0.95)" : "rgba(255,255,255,0.95)" },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {TOP_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id);
                    scrollToSection(tab.target);
                  }}
                  style={[
                    styles.tab,
                    active
                      ? { borderColor: colors.primary, backgroundColor: isDark ? pal.slate900 : "#ffffff" }
                      : { borderColor: isDark ? pal.slate800 : "#ece9e1", backgroundColor: isDark ? pal.slate900 : "#fafafa" },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: active ? (isDark ? pal.slate100 : "#2a2018") : isDark ? pal.slate400 : "#8b8881" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Sections */}
        <View style={styles.sections} onLayout={(e) => (contentY.current = e.nativeEvent.layout.y)}>
          <View onLayout={(e) => (sectionY.current.prebook = e.nativeEvent.layout.y)}>
            <Text style={sectionTitle}>Pre-book offers</Text>
            <Text style={[styles.prebookSub, { color: isDark ? pal.purple400 : colors.primary }]}>
              Limited slots with extra offers
            </Text>
            <LinearGradient
              colors={["#0f4a87", "#0b2954", "#0b2954"]}
              locations={[0, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.offerCard}
            >
              <View style={styles.offerTop}>
                <View>
                  <Text style={styles.offerTitle}>Flat 50% OFF</Text>
                  <Text style={styles.offerSub}>Dining Carnival offer</Text>
                </View>
                {/* No handler on web. */}
                <Pressable style={styles.offerBtn}>
                  <Text style={styles.offerBtnText}>Book now</Text>
                </Pressable>
              </View>
              <View style={styles.offerFooter}>
                <Text style={styles.offerFooterText}>3 slots available from 3:30 PM today</Text>
              </View>
            </LinearGradient>
          </View>

          <View
            style={[styles.section, divider]}
            onLayout={(e) => (sectionY.current.menu = e.nativeEvent.layout.y)}
          >
            <View style={styles.menuHeader}>
              <View>
                <Text style={sectionTitle}>Menu</Text>
                <Text style={[styles.menuUpdated, { color: isDark ? "#ff8904" : "#e19135" }]}>Last updated a month ago</Text>
              </View>
              <View style={[styles.dishesPill, { backgroundColor: isDark ? "rgba(67,20,7,0.3)" : "#fff3e6" }]}>
                <Text style={[styles.dishesPillText, { color: isDark ? "#ffb86a" : "#e58a2c" }]}>
                  {featuredSections.length || 2} dishes
                </Text>
              </View>
            </View>
            <View style={styles.grid2}>
              {(featuredSections.length > 0
                ? featuredSections
                : [
                    { id: "food", title: "Food", pages: 16 },
                    { id: "beverages", title: "Beverages", pages: 10 },
                  ]
              ).map((section, index) => (
                <View
                  key={section.id}
                  style={[
                    styles.menuCard,
                    { borderColor: isDark ? pal.slate800 : "#ede8dd", backgroundColor: isDark ? pal.slate900 : "#ffffff" },
                  ]}
                >
                  <View style={{ aspectRatio: 0.88, backgroundColor: isDark ? pal.slate800 : "#f7f1e7" }}>
                    {menuPreviewImages[index] ? (
                      <AppImage src={menuPreviewImages[index]} width={180} style={StyleSheet.absoluteFill} />
                    ) : (
                      <View style={[styles.centerFill, { backgroundColor: isDark ? pal.slate800 : "#f3eadf" }]}>
                        <Text style={[styles.placeholderText, { color: isDark ? pal.slate400 : "#a28868", fontWeight: "500" }]}>
                          Menu preview
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.menuCardBody}>
                    <Text style={[styles.menuCardTitle, { color: isDark ? pal.slate100 : "#2b2218" }]}>{section.title}</Text>
                    <Text style={[styles.menuCardPages, { color: isDark ? pal.slate400 : "#7f7a73" }]}>
                      {section.pages} pages
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            style={[styles.section, divider]}
            onLayout={(e) => (sectionY.current.photos = e.nativeEvent.layout.y)}
          >
            <Text style={sectionTitle}>Photos</Text>
            <View style={styles.grid2}>
              {photoList.map((image, index) => (
                <View
                  key={`${image || "placeholder"}-${index}`}
                  style={[
                    styles.photo,
                    { backgroundColor: isDark ? pal.slate800 : "#f6efe4" },
                    index === 0 ? { width: "100%", aspectRatio: 1.72 } : { width: halfWidth, aspectRatio: 1.08 },
                  ]}
                >
                  {image ? (
                    <AppImage src={image} width={index === 0 ? 400 : 200} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={styles.centerFill}>
                      <Text style={[styles.placeholderText, { color: isDark ? pal.slate400 : "#a28868" }]}>Photo coming soon</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View
            style={[styles.section, divider]}
            onLayout={(e) => (sectionY.current.about = e.nativeEvent.layout.y)}
          >
            <Text style={sectionTitle}>About the restaurant</Text>
            <View
              style={[
                styles.aboutCard,
                { borderColor: isDark ? pal.slate800 : "#ececf4", backgroundColor: isDark ? pal.slate900 : "#fafbff" },
              ]}
            >
              <View style={{ gap: 16 }}>
                <View style={styles.aboutRow}>
                  <IndianRupee size={16} color="#f0b500" style={{ marginTop: 2 }} />
                  <Text style={[styles.aboutText, { color: isDark ? pal.slate400 : "#5f6474" }]}>{costForTwo}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <View style={styles.aboutDot} />
                  <Text style={[styles.aboutText, { color: isDark ? pal.slate400 : "#5f6474" }]}>{cuisines}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.aboutText, { color: isDark ? pal.slate400 : "#5f6474" }]}>{address}</Text>
                </View>
              </View>

              <View style={[styles.aboutSub, divider]}>
                <Text style={[styles.aboutSubTitle, { color: isDark ? pal.slate100 : "#23180f" }]}>Featured In</Text>
                <View style={[styles.featuredCard, { backgroundColor: isDark ? pal.slate800 : "#ffffff" }]}>
                  <View style={{ aspectRatio: 1.2, backgroundColor: isDark ? pal.slate700 : "#efe8df" }}>
                    {heroImage ? (
                      <AppImage src={heroImage} width={360} style={StyleSheet.absoluteFill} />
                    ) : (
                      <View style={styles.centerFill}>
                        <Text style={[styles.placeholderText, { color: isDark ? pal.slate400 : "#a28868" }]}>Featured image</Text>
                      </View>
                    )}
                  </View>
                  <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"]} style={styles.featuredCaption}>
                    <Text style={styles.featuredCaptionText}>Pan-Asian Restaurants</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={[styles.aboutSub, divider]}>
                <Text style={[styles.aboutSubTitle, { color: isDark ? pal.slate100 : "#23180f" }]}>Facilities</Text>
                <View style={styles.facilities}>
                  {facilities.slice(0, 6).map((facility) => (
                    <View key={facility} style={styles.facility}>
                      <View style={styles.facilityDot} />
                      <Text style={[styles.aboutText, { color: isDark ? pal.slate400 : "#5f6474" }]}>{facility}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: 16 + insets.bottom,
            borderColor: isDark ? pal.slate800 : "#ebe5da",
            backgroundColor: isDark ? "rgba(2,6,23,0.95)" : "rgba(255,255,255,0.95)",
          },
        ]}
      >
        <Pressable
          onPress={() => isDiningEnabled && setIsBookingSheetOpen(true)}
          disabled={!isDiningEnabled}
          style={[
            styles.bottomBtn,
            isDiningEnabled
              ? { borderColor: "#b18da5", backgroundColor: isDark ? pal.slate900 : "#ffffff" }
              : { borderColor: isDark ? pal.slate800 : tw.gray200, backgroundColor: isDark ? pal.slate900 : tw.gray50, opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              styles.bottomBtnText,
              { color: isDiningEnabled ? (isDark ? pal.purple400 : colors.primary) : isDark ? pal.slate600 : tw.gray400 },
            ]}
          >
            {isDiningEnabled ? "Book a table" : "Dining paused"}
          </Text>
        </Pressable>
      </View>

      <GuestSheet
        visible={isBookingSheetOpen}
        onClose={() => setIsBookingSheetOpen(false)}
        maxCapacity={maxCapacity}
        occupiedSeats={occupiedSeats}
        remainingSeats={remainingSeats}
        selectedGuests={selectedGuests}
        onSelect={setSelectedGuests}
        onContinue={handleContinueBooking}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerFill: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 24, fontWeight: "700", color: "#23180f", textAlign: "center" },
  hero: { height: 392, overflow: "hidden" },
  heroTopRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 1,
  },
  heroBtn: {
    height: 40,
    width: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(81,88,106,0.75)",
  },
  heroBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  heroName: { fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -1.08, color: "#ffffff" },
  heroAddress: { marginTop: 8, maxWidth: "94%", fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.92)" },
  heroMeta: { marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.9)" },
  openPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  openPillText: { fontSize: 13, fontWeight: "500", color: "#ffffff" },
  ratingCard: {
    marginBottom: 4,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    boxShadow: "0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { fontSize: 31, lineHeight: 34, fontWeight: "900" },
  ratingStar: { fontSize: 18, color: "#18b54f" },
  reviews: { marginTop: 4, fontSize: 13, lineHeight: 16 },
  bookWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  bookPill: {
    height: 52,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    boxShadow: "0px 10px 24px rgba(15,23,42,0.05)",
  },
  bookPillText: { fontSize: 15, fontWeight: "500" },
  pausedNote: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pal.amber200,
    backgroundColor: pal.amber50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pausedNoteText: { fontSize: 14, color: pal.amber800 },
  tabsBar: { borderBottomWidth: 1, paddingTop: 12, paddingBottom: 12 },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 4 },
  tab: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  tabText: { fontSize: 14 },
  sections: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginTop: 20, borderTopWidth: 1, paddingTop: 16 },
  sectionTitle: { fontSize: 28, lineHeight: 30, fontWeight: "900" },
  prebookSub: { marginTop: 4, fontSize: 15 },
  offerCard: { marginTop: 12, borderRadius: 18, overflow: "hidden", boxShadow: "0px 10px 26px rgba(8,52,95,0.25)" },
  offerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  offerTitle: { fontSize: 28, lineHeight: 30, fontWeight: "900", color: "#ffffff" },
  offerSub: { marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.8)" },
  offerBtn: { borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16, paddingVertical: 8 },
  offerBtnText: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  offerFooter: { borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 8 },
  offerFooterText: { textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.75)" },
  menuHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  menuUpdated: { marginTop: 8, fontSize: 13 },
  dishesPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  dishesPillText: { fontSize: 12, fontWeight: "600" },
  grid2: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  menuCard: { flex: 1, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  menuCardBody: { paddingHorizontal: 8, paddingBottom: 12, paddingTop: 8, alignItems: "center" },
  menuCardTitle: { fontSize: 16, lineHeight: 20, fontWeight: "500", textAlign: "center" },
  menuCardPages: { marginTop: 4, fontSize: 12 },
  placeholderText: { fontSize: 14, textAlign: "center" },
  photo: { borderRadius: 18, overflow: "hidden" },
  aboutCard: { marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 16 },
  aboutRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  aboutText: { flexShrink: 1, fontSize: 14 },
  aboutDot: { marginTop: 7, height: 8, width: 8, borderRadius: 999, backgroundColor: "#8a8f9d" },
  aboutSub: { marginTop: 20, borderTopWidth: 1, paddingTop: 16 },
  aboutSubTitle: { fontSize: 20, fontWeight: "600" },
  featuredCard: { marginTop: 12, borderRadius: 16, overflow: "hidden", boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" },
  featuredCaption: { marginTop: -56, padding: 12, paddingTop: 40 },
  featuredCaptionText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  facilities: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 16 },
  facility: { width: "46%", flexDirection: "row", alignItems: "center", gap: 8 },
  facilityDot: { height: 7, width: 7, borderRadius: 999, borderWidth: 1, borderColor: "#8a8f9d" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 16 },
  bottomBtn: { height: 48, width: "100%", borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bottomBtnText: { fontSize: 17, fontWeight: "500" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, boxShadow: "0px -20px 60px rgba(15,23,42,0.18)" },
  sheetInner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  sheetHandle: { alignSelf: "center", marginBottom: 16, height: 6, width: 56, borderRadius: 999 },
  sheetHeader: { marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "900" },
  sheetSub: { marginTop: 4, fontSize: 14 },
  sheetClose: { height: 36, width: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  guestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  guestCell: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  guestText: { fontSize: 14, fontWeight: "700" },
  bookedLabel: { fontSize: 10, fontWeight: "900", letterSpacing: -0.5, opacity: 0.6 },
  continueBtn: { marginTop: 24, height: 48, width: "100%", borderRadius: 16 },
});
