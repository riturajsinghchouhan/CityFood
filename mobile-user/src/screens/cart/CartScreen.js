// Cart and checkout, ported from Frontend/src/modules/Food/pages/user/cart/Cart.jsx.
import * as Clipboard from "expo-clipboard";
import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { ArrowLeft, Share2, Utensils } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import {
  calculateOrder,
  checkRiderAvailability,
  createOrder,
  getAddonsByRestaurantId,
  getCouponsByItemIdPublic,
  getMenuByRestaurantId,
  getOrders,
  getRestaurantById,
  getRestaurants,
  getWallet,
} from "../../api";
import { ASSET_ORIGIN } from "../../config";
import { Button, Screen, Text, toast } from "../../components/ui";
import BillDetailsSection from "../../components/cart/BillDetailsSection";
import CartItemsCard from "../../components/cart/CartItemsCard";
import { GstDialog, ShareDialog } from "../../components/cart/CartDialogs";
import CouponSection from "../../components/cart/CouponSection";
import DeliveryAddressSection from "../../components/cart/DeliveryAddressSection";
import DeliveryTimeSection from "../../components/cart/DeliveryTimeSection";
import NoteSection from "../../components/cart/NoteSection";
import { OrderSuccess, SavingsCongrats } from "../../components/cart/OrderPlacedOverlays";
import { useCartPalette } from "../../components/cart/palette";
import PaymentBar from "../../components/cart/PaymentBar";
import PaymentSheet from "../../components/cart/PaymentSheet";
import RecipientSection from "../../components/cart/RecipientSection";
import { AddonsSection, MoreItemsSection } from "../../components/cart/SuggestionsSections";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useCart } from "../../context/CartContext";
import { useAppLocation } from "../../context/LocationContext";
import { useOrders } from "../../context/OrdersContext";
import { useProfile } from "../../context/ProfileContext";
import useLatest from "../../hooks/useLatest";
import { payForOrder } from "../../lib/razorpay";
import { useAppBack } from "../../navigation/back";
import { store } from "../../storage";
import { tw } from "../../theme/tokens";
import {
  buildTimeSlots,
  computePlatformSavings,
  DEFAULT_FEE_SETTINGS,
  formatFullAddress,
  getAddressId,
  localDateString,
  normalizeLabel,
  RUPEE,
  sanitizeRecipientPhone,
  toCartCoupon,
  toPricingItems,
} from "./cartUtils";

const orderSound = require("../../../assets/sounds/zomato_sms.mp3");

const RECIPIENT_KEY = "food-cart-recipient-details-v1";
const NOTE_KEY = "food-cart-order-note-v1";
const feeSettings = DEFAULT_FEE_SETTINGS;

function EmptyCart({ onBack }) {
  const p = useCartPalette();
  return (
    <Screen background={p.isDark ? "#0a0a0a" : tw.gray50}>
      <View style={[styles.header, styles.emptyHeader, { backgroundColor: p.card, borderColor: p.isDark ? tw.gray800 : tw.gray200 }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={16} color={p.isDark ? tw.gray300 : tw.gray700} />
        </Pressable>
        <Text style={{ fontWeight: "600", color: p.isDark ? "#ffffff" : tw.gray800 }}>Cart</Text>
      </View>
      <View style={styles.emptyBody}>
        <View style={styles.emptyCircle}>
          <Utensils size={40} color={tw.gray400} />
        </View>
        <Text style={[styles.emptyTitle, { color: p.isDark ? "#ffffff" : tw.gray800 }]}>Your cart is empty</Text>
        <Text style={[styles.emptySub, { color: p.t500 }]}>Add items from a restaurant to start a new order</Text>
        <Button title="Browse Restaurants" onPress={() => router.dismissTo("/")} />
      </View>
    </Screen>
  );
}

export default function CartScreen() {
  const p = useCartPalette();
  const goBack = useAppBack();
  const { companyName, settings } = useAppSettings();
  const { cart, updateQuantity, addToCart, clearCart, cleanCartForRestaurant } = useCart();
  const { getDefaultAddress, setDefaultAddress, addresses, userProfile } = useProfile();
  const { upsertOrder } = useOrders();
  const {
    location: currentLocation,
    storedLocation,
    loading: currentLocationLoading,
    zoneId,
    setSavedLocation,
    deliveryAddressMode,
  } = useAppLocation();

  const player = useAudioPlayer(orderSound);
  const playerRef = useLatest(player);

  const [showCoupons, setShowCoupons] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [manualCouponCode, setManualCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const [restaurantNote, setRestaurantNote] = useState("");
  const [showRestaurantNoteInput, setShowRestaurantNoteInput] = useState(false);
  const [noteRestored, setNoteRestored] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [recipientDetails, setRecipientDetails] = useState({ name: "", phone: "" });
  const [recipientRestored, setRecipientRestored] = useState(false);

  const [sendCutlery, setSendCutlery] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(true);
  const [showGstModal, setShowGstModal] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [showSavingsCongrats, setShowSavingsCongrats] = useState(false);
  const [congrats, setCongrats] = useState({ amount: 0, percentage: 0, items: [] });
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderSuccessSavingsAmount, setOrderSuccessSavingsAmount] = useState(0);
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [addons, setAddons] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [moreRestaurantItems, setMoreRestaurantItems] = useState([]);
  const [loadingMoreItems, setLoadingMoreItems] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [userOrderCount, setUserOrderCount] = useState(0);

  const userProfileRef = useLatest(userProfile);
  const availableCouponsRef = useLatest(availableCoupons);

  // Order-placed sound, as the web plays it when the success view appears.
  useEffect(() => {
    if (!showOrderSuccess) return;
    const audio = playerRef.current;
    try {
      audio.volume = 0.8;
      audio.seekTo(0);
      audio.play();
    } catch {
      // Playback failures must not break the success view.
    }
  }, [showOrderSuccess, playerRef]);

  // Savings congratulations -> order success after 3 s.
  useEffect(() => {
    if (!showSavingsCongrats) return undefined;
    const timer = setTimeout(() => {
      setShowSavingsCongrats(false);
      setShowOrderSuccess(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showSavingsCongrats]);

  useEffect(() => {
    if (showOrderSuccess) setCongrats({ amount: 0, percentage: 0, items: [] });
  }, [showOrderSuccess]);

  // Business settings come from AppSettingsProvider (web: publicAPI.getBusinessSettings on mount).
  const onlinePaymentOnly = !!settings?.onlinePaymentOnly;
  const maxCodAmount = Number(settings?.maxCodAmount) || 0;

  const availableTimeSlots = useMemo(
    () => (isScheduled ? buildTimeSlots(restaurantData, scheduledDate) : []),
    [isScheduled, scheduledDate, restaurantData],
  );

  useEffect(() => {
    if (isScheduled && availableTimeSlots.length > 0) {
      if (!availableTimeSlots.some((slot) => slot.value === scheduledTime)) {
        setScheduledTime(availableTimeSlots[0].value);
      }
    } else if (!isScheduled) {
      setScheduledDate("");
      setScheduledTime("");
    }
  }, [isScheduled, availableTimeSlots, scheduledTime]);

  const savedAddress = getDefaultAddress();
  const selectedAddress = addresses.find((addr) => getAddressId(addr) && getAddressId(addr) === selectedAddressId);

  const currentLocationAddress = useMemo(() => {
    const loc = currentLocation?.latitude && currentLocation?.longitude ? currentLocation : storedLocation;
    if (!loc?.latitude || !loc?.longitude) return null;
    const formattedAddress = loc?.formattedAddress || loc?.address || "";
    if (!formattedAddress || formattedAddress === "Select location") return null;
    return {
      label: "Home",
      formattedAddress,
      address: formattedAddress,
      street: loc?.street || loc?.address || loc?.area || "Current Location",
      additionalDetails: loc?.area || "",
      city: loc?.city || loc?.area || "Current City",
      state: loc?.state || loc?.city || "Current State",
      zipCode: loc?.postalCode || loc?.zipCode || "",
      phone: userProfile?.phone || "",
      location: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
    };
  }, [currentLocation, storedLocation, userProfile?.phone]);

  const defaultAddress = useMemo(
    () =>
      deliveryAddressMode === "current"
        ? currentLocationAddress || selectedAddress || savedAddress || null
        : selectedAddress || savedAddress || currentLocationAddress || null,
    [deliveryAddressMode, currentLocationAddress, selectedAddress, savedAddress],
  );

  const hasSavedAddress = Boolean(defaultAddress && formatFullAddress(defaultAddress));
  const recipientName = String(recipientDetails.name || "").trim() || userProfile?.name || "Your Name";
  const recipientPhone = sanitizeRecipientPhone(recipientDetails.phone || "") || userProfile?.phone || "";

  // Restore recipient details and the restaurant note (web localStorage keys).
  useEffect(() => {
    let active = true;
    Promise.all([store.get(RECIPIENT_KEY), store.get(NOTE_KEY)]).then(([recipient, note]) => {
      if (!active) return;
      const profile = userProfileRef.current;
      setRecipientDetails({
        name: recipient?.name || profile?.name || "",
        phone: sanitizeRecipientPhone(recipient?.phone || "") || profile?.phone || "",
      });
      setIsEditingRecipient(Boolean(recipient?.isEditingRecipient));
      const storedNote = String(note?.restaurantNote || "");
      setRestaurantNote(storedNote);
      setShowRestaurantNoteInput(Boolean(note?.showRestaurantNoteInput) || storedNote.trim().length > 0);
      setRecipientRestored(true);
      setNoteRestored(true);
    });
    return () => {
      active = false;
    };
  }, [userProfileRef]);

  useEffect(() => {
    setRecipientDetails((prev) => ({
      name: prev.name || userProfile?.name || "",
      phone: prev.phone || userProfile?.phone || "",
    }));
  }, [userProfile?.name, userProfile?.phone]);

  useEffect(() => {
    if (!recipientRestored) return;
    store.set(RECIPIENT_KEY, {
      name: recipientDetails.name || "",
      phone: sanitizeRecipientPhone(recipientDetails.phone || ""),
      isEditingRecipient,
    });
  }, [recipientDetails, isEditingRecipient, recipientRestored]);

  useEffect(() => {
    if (!noteRestored) return;
    store.set(NOTE_KEY, { restaurantNote, showRestaurantNoteInput });
  }, [restaurantNote, showRestaurantNoteInput, noteRestored]);

  useEffect(() => {
    if (deliveryAddressMode === "current") setSelectedAddressId(null);
  }, [deliveryAddressMode]);

  useEffect(() => {
    const defaultId = getAddressId(savedAddress);
    if (deliveryAddressMode !== "current" && !selectedAddressId && defaultId) setSelectedAddressId(defaultId);
  }, [savedAddress, selectedAddressId, deliveryAddressMode]);

  const restaurantId =
    cart.length > 0 ? restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null : null;
  const firstRestaurantId = cart[0]?.restaurantId;
  const firstRestaurantName = cart[0]?.restaurant;

  // Restaurant: by the cart's restaurantId, else by name from the restaurant list.
  const restaurantDataRef = useLatest(restaurantData);
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (cart.length === 0) {
        setRestaurantData(null);
        return;
      }
      if (restaurantDataRef.current) return;
      setLoadingRestaurant(true);
      if (firstRestaurantId) {
        try {
          const res = await getRestaurantById(firstRestaurantId);
          const data = res?.data?.restaurant;
          if (data) {
            const matches =
              (data.restaurantId || data._id?.toString()) === firstRestaurantId ||
              data._id?.toString() === firstRestaurantId ||
              data.restaurantId === firstRestaurantId;
            if (!active) return;
            if (matches) setRestaurantData(data);
            setLoadingRestaurant(false);
            return;
          }
        } catch {
          // try the name fallback
        }
      }
      if (firstRestaurantName) {
        try {
          const res = await getRestaurants({ limit: 100 });
          const restaurants = res?.data?.restaurants || (Array.isArray(res?.data) ? res.data : []);
          const target = firstRestaurantName.toLowerCase().trim();
          let match = restaurants.find((r) => r.name?.toLowerCase().trim() === target);
          if (!match) {
            match = restaurants.find(
              (r) => r.name?.toLowerCase().includes(target) || target.includes(r.name?.toLowerCase()),
            );
          }
          if (match) {
            const found = match.name?.toLowerCase().trim();
            if (!active) return;
            if (!(target && found && target !== found)) setRestaurantData(match);
            setLoadingRestaurant(false);
            return;
          }
        } catch {
          // fall through
        }
      }
      if (!active) return;
      setRestaurantData(null);
      setLoadingRestaurant(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [cart.length, firstRestaurantId, firstRestaurantName, restaurantDataRef]);

  // Approved addons for "Complete your meal".
  useEffect(() => {
    let active = true;
    if (cart.length === 0 || !restaurantData) {
      if (!loadingRestaurant) setAddons([]);
      return undefined;
    }
    if (loadingRestaurant) return undefined;
    const idString = String(restaurantData._id || restaurantData.restaurantId || "");
    if (!/^[a-zA-Z0-9\-_]+$/.test(idString) || idString.length < 3) {
      setAddons([]);
      return undefined;
    }
    setLoadingAddons(true);
    getAddonsByRestaurantId(idString)
      .then((res) => active && setAddons(res?.data?.addons || []))
      .catch(() => active && setAddons([]))
      .finally(() => active && setLoadingAddons(false));
    return () => {
      active = false;
    };
  }, [restaurantData, cart.length === 0, loadingRestaurant]); // eslint-disable-line react-hooks/exhaustive-deps

  // "More items for you" from the same restaurant's menu.
  const menuFetchId =
    restaurantData?._id || restaurantData?.restaurantId || restaurantData?.slug || firstRestaurantId || restaurantId;
  const cartEmpty = cart.length === 0;
  useEffect(() => {
    let active = true;
    if (!menuFetchId || cartEmpty) {
      setMoreRestaurantItems([]);
      return undefined;
    }
    setLoadingMoreItems(true);
    getMenuByRestaurantId(menuFetchId)
      .then((res) => {
        if (!active) return;
        if (res?.success && res?.data?.menu) {
          const all = [];
          const seen = new Set();
          for (const section of res.data.menu.sections || []) {
            for (const item of section.items || []) {
              const itemId = item.id || item._id;
              if (itemId && !seen.has(String(itemId)) && item.isAvailable !== false && item.name && item.price > 0) {
                seen.add(String(itemId));
                all.push({ ...item, id: itemId, categoryName: section.name || item.categoryName || item.category || "" });
              }
            }
          }
          setMoreRestaurantItems(all);
        } else {
          setMoreRestaurantItems([]);
        }
      })
      .catch(() => active && setMoreRestaurantItems([]))
      .finally(() => active && setLoadingMoreItems(false));
    return () => {
      active = false;
    };
  }, [menuFetchId, cartEmpty]);

  const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant";

  const handleAddMoreItemToCart = (item) => {
    const cartRestaurantId = cart[0]?.restaurantId || restaurantData?.restaurantId || restaurantData?._id || restaurantId;
    const cartRestaurantName = cart[0]?.restaurant || restaurantData?.name || restaurantName;
    if (!cartRestaurantId || !cartRestaurantName) {
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    const res = addToCart({
      id: item.id || item._id,
      itemId: item.id || item._id,
      name: item.name,
      price: Number(item.price),
      image: item.image || "",
      description: item.description || "",
      isVeg: item.foodType === "Veg" || item.isVeg,
      foodType: item.foodType || (item.isVeg ? "Veg" : "Non-Veg"),
      restaurant: cartRestaurantName,
      restaurantId: cartRestaurantId,
      restaurantName: cartRestaurantName,
    });
    if (res?.ok === false) {
      toast.error(res.error || "Cannot add item to cart");
      return;
    }
    toast.success(`Added ${item.name} to cart`);
  };

  const handleUpdateMoreItemQuantity = (item, newQuantity) => {
    const targetId = item.id || item._id;
    const cartItem = cart.find((ci) => String(ci.id) === String(targetId) || String(ci.itemId) === String(targetId));
    if (!cartItem) return;
    if (newQuantity <= 0) {
      updateQuantity(cartItem.id, 0);
      toast.info(`Removed ${item.name} from cart`);
    } else {
      updateQuantity(cartItem.id, newQuantity);
    }
  };

  const handleAddAddon = (addon) => {
    const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
    const cartRestaurantName = cart[0]?.restaurant || restaurantName;
    if (!cartRestaurantId || !cartRestaurantName) {
      toast.error("Restaurant information is missing. Please refresh the page.");
      return;
    }
    addToCart({
      id: addon.id,
      name: addon.name,
      price: addon.price,
      image: addon.image || addon.images?.[0] || "",
      description: addon.description || "",
      isVeg: true,
      restaurant: cartRestaurantName,
      restaurantId: cartRestaurantId,
    });
  };

  // Coupons. The web asked once per cart item, but the endpoint ignores the item, so one call gives
  // the same list (attributed, as on web, to the first item with an id).
  const couponItem = cart.find((ci) => ci.itemId || ci.id);
  const couponItemId = couponItem ? couponItem.itemId || couponItem.id : null;
  const couponItemName = couponItem?.name;
  useEffect(() => {
    let active = true;
    if (cartEmpty || !restaurantId) {
      setAvailableCoupons([]);
      return undefined;
    }
    setLoadingCoupons(true);
    (async () => {
      const all = [];
      if (couponItemId) {
        try {
          const res = await getCouponsByItemIdPublic(restaurantId, couponItemId);
          const seen = new Set();
          (res?.success ? res?.data?.coupons || [] : []).forEach((coupon) => {
            if (!seen.has(coupon.couponCode)) {
              seen.add(coupon.couponCode);
              all.push(toCartCoupon(coupon, { name: couponItemName }, couponItemId));
            }
          });
        } catch {
          // no offers
        }
      }
      if (!active) return;
      setAvailableCoupons(all);
      setLoadingCoupons(false);
    })();
    return () => {
      active = false;
    };
  }, [cartEmpty, restaurantId, couponItemId, couponItemName]);

  // Backend pricing whenever the cart, address or coupon changes.
  const appliedCouponRef = useLatest(appliedCoupon);
  const pricingKey = JSON.stringify([
    toPricingItems(cart, { withOriginalPrice: false }),
    defaultAddress,
    appliedCoupon?.code,
    couponCode,
    restaurantData?.restaurantId || restaurantData?._id || restaurantId,
  ]);
  useEffect(() => {
    let active = true;
    if (cart.length === 0 || !hasSavedAddress) {
      setPricing(null);
      return undefined;
    }
    const applied = appliedCouponRef.current;
    calculateOrder({
      items: toPricingItems(cart, { withOriginalPrice: false }),
      restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || undefined,
      deliveryAddress: defaultAddress,
      couponCode: applied?.code || couponCode || undefined,
    })
      .then((res) => {
        if (!active || !res?.success || !res?.data?.pricing) return;
        const next = res.data.pricing;
        setPricing(next);
        if (next.couponError && applied) {
          toast.error(next.couponError);
          setAppliedCoupon(null);
          setCouponCode("");
          setManualCouponCode("");
        } else if (next.appliedCoupon && !applied) {
          const coupon = availableCouponsRef.current.find((c) => c.code === next.appliedCoupon.code);
          if (coupon) setAppliedCoupon(coupon);
        } else if (!next.appliedCoupon && applied) {
          setAppliedCoupon(null);
          setCouponCode("");
          setManualCouponCode("");
        }
      })
      .catch(() => active && setPricing(null));
    return () => {
      active = false;
    };
  }, [pricingKey, hasSavedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wallet balance and the first-order coupon count, once.
  useEffect(() => {
    let active = true;
    getWallet()
      .then((res) => {
        if (active && res?.success && res?.data?.wallet) setWalletBalance(res.data.wallet.balance || 0);
      })
      .catch(() => active && setWalletBalance(0));
    // Web called the undefined userAPI.getOrders here; this is the working equivalent.
    getOrders({ page: 1, limit: 1 })
      .then((res) => {
        if (active && res?.success) setUserOrderCount(res?.data?.pagination?.total || 0);
      })
      .catch(() => active && setUserOrderCount(0));
    return () => {
      active = false;
    };
  }, []);

  // ---- pricing math (backend pricing first, fee-settings fallback) ----
  const subtotal = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const fallbackDeliveryFee = (() => {
    if (appliedCoupon?.freeDelivery) return 0;
    const freeUpTo = Number(feeSettings.freeDeliveryUpTo || 0);
    if (Number.isFinite(freeUpTo) && freeUpTo > 0 && subtotal >= freeUpTo) return 0;
    return Number(feeSettings.deliveryFee || 0);
  })();
  const deliveryFee = pricing != null ? pricing.deliveryFee ?? 0 : fallbackDeliveryFee;
  const deliveryFeeBreakdown = pricing?.deliveryFeeBreakdown || null;
  const deliveryFeeBreakdownText =
    deliveryFeeBreakdown?.source === "distance" && Number.isFinite(Number(deliveryFeeBreakdown?.distanceKm))
      ? `Distance ${Number(deliveryFeeBreakdown.distanceKm).toFixed(1)} km`
      : null;
  const platformFee = pricing != null ? pricing.platformFee ?? 0 : feeSettings.platformFee ?? 0;
  const packagingFee = pricing != null ? pricing.packagingFee ?? 0 : feeSettings.packagingFee ?? 0;
  const gstOnItemTotal = pricing?.taxBreakdown?.itemTax ?? subtotal * ((feeSettings.gstRate ?? 0) / 100);
  const gstOnDeliveryFee = pricing?.taxBreakdown?.deliveryTax ?? 0;
  const gstOnPlatformFee = pricing?.taxBreakdown?.platformTax ?? 0;
  const gstOnPackagingFee = pricing?.taxBreakdown?.packagingTax ?? 0;
  const gstCharges =
    pricing != null
      ? pricing.tax ?? 0
      : Math.round(gstOnItemTotal + gstOnDeliveryFee + gstOnPlatformFee + gstOnPackagingFee);
  const couponDiscount =
    pricing?.couponDiscount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0);
  const discount = pricing?.discount || couponDiscount;
  const totalBeforeDiscount = subtotal + deliveryFee + platformFee + packagingFee + gstCharges;
  const total = pricing?.total || Math.max(0, totalBeforeDiscount - discount);
  const savings = pricing?.savings ?? Math.max(0, totalBeforeDiscount - total);
  const freeDeliveryUpTo = Number((pricing?.freeDeliveryUpTo ?? feeSettings.freeDeliveryUpTo) || 0);

  const isCodHidden =
    onlinePaymentOnly || (maxCodAmount > 0 && total > maxCodAmount) || userProfile?.codEnabled === false;
  useEffect(() => {
    if (isCodHidden && selectedPaymentMethod === "cash") setSelectedPaymentMethod("razorpay");
  }, [isCodHidden, selectedPaymentMethod]);

  const platformPricingSavings = useMemo(() => computePlatformSavings(cart, total), [cart, total]);
  const selectedPaymentLabel =
    selectedPaymentMethod === "wallet" ? "Wallet" : selectedPaymentMethod === "razorpay" ? "Online Payment" : "Cash on Delivery";

  // ---- share ----
  const sharePayload = useMemo(() => {
    const name = restaurantName || companyName || "this restaurant";
    const url = `${ASSET_ORIGIN}/food/user/cart`;
    return { title: `My Cart at ${name}`, text: `Check out what I'm ordering from ${name}! ${url}`, url };
  }, [restaurantName, companyName]);

  const handleSystemShare = async () => {
    try {
      await Share.share({ title: sharePayload.title, message: sharePayload.text });
      setShowShareModal(false);
      toast.success("Shared successfully");
    } catch {
      // share sheet failed; keep the modal open
    }
  };

  const openShareTarget = (target) => {
    const { text, url, title } = sharePayload;
    let link = "";
    if (target === "whatsapp") link = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    else if (target === "telegram") link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    else if (target === "email")
      link = `mailto:?subject=${encodeURIComponent(title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
    if (link) {
      Linking.openURL(link).catch(() => {});
      setShowShareModal(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await Clipboard.setStringAsync(sharePayload.url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
    setShowShareModal(false);
  };

  const handleBack = useCallback(() => {
    const idOrSlug = restaurantData?.slug || restaurantId;
    if (idOrSlug) router.push(`/restaurants/${idOrSlug}`);
    else goBack();
  }, [restaurantData?.slug, restaurantId, goBack]);

  const openLocationSelector = () => router.push("/address-selector");

  // ---- address selection ----
  const handleSelectSavedAddress = async (address) => {
    try {
      const addressId = getAddressId(address);
      if (addressId) {
        setSelectedAddressId(addressId);
        setDefaultAddress(addressId);
      }
      const coordinates = address.location?.coordinates || [];
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      if (!latitude || !longitude) {
        toast.error(`Invalid coordinates for ${address.label || "saved"} address`);
        return;
      }
      const zip = address.zipCode ? ` ${address.zipCode}` : "";
      await setSavedLocation(
        {
          city: address.city,
          state: address.state,
          address: `${address.street}, ${address.city}`,
          area: address.additionalDetails || "",
          zipCode: address.zipCode,
          latitude,
          longitude,
          formattedAddress: address.additionalDetails
            ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${zip}`
            : `${address.street}, ${address.city}, ${address.state}${zip}`,
        },
        { mode: "saved", persistDb: true },
      );
      toast.success(`${address.label || "Saved"} address selected!`);
    } catch {
      toast.error("Failed to select address. Please try again.");
    }
  };

  const handleSelectAddressByLabel = async (label) => {
    try {
      const address = addresses.find((addr) => normalizeLabel(addr.label) === normalizeLabel(label));
      if (!address) {
        toast.error(`No ${label} address found. Please add an address first.`);
        return;
      }
      await handleSelectSavedAddress(address);
    } catch {
      toast.error(`Failed to select ${label} address. Please try again.`);
    }
  };

  // ---- coupons ----
  const pricingRestaurantId = restaurantData?.restaurantId || restaurantData?._id || restaurantId || null;

  const handleApplyCoupon = async (coupon) => {
    if (coupon?.customerGroup === "new" && userOrderCount > 0) {
      toast.error("This coupon is only for first-time users");
      return;
    }
    if (subtotal < (Number(coupon.minOrder) || 0)) {
      toast.error(`Min order ${RUPEE}${Number(coupon.minOrder || 0)}`);
      return;
    }
    if (cart.length === 0) {
      toast.error("Add items to cart first");
      return;
    }
    if (!hasSavedAddress) {
      toast.error("Add delivery address first");
      return;
    }
    try {
      const res = await calculateOrder({
        items: toPricingItems(cart),
        restaurantId: pricingRestaurantId,
        deliveryAddress: defaultAddress,
        couponCode: coupon.code,
      });
      const pricingData = res?.data?.pricing;
      if (pricingData?.couponError) {
        toast.error(pricingData.couponError);
        return;
      }
      if (!pricingData || !pricingData.appliedCoupon) {
        toast.error("Coupon not applicable");
        return;
      }
      setPricing(pricingData);
      setAppliedCoupon({
        ...coupon,
        discount: Number(pricingData.appliedCoupon.discount || pricingData.couponDiscount || coupon.discount || 0),
      });
      setCouponCode(coupon.code);
      setManualCouponCode(coupon.code);
      setShowCoupons(false);
    } catch {
      toast.error("Failed to apply coupon");
    }
  };

  const handleApplyCouponCode = async () => {
    const inputCode = manualCouponCode.trim().toUpperCase();
    if (!inputCode) {
      toast.error("Enter coupon code");
      return;
    }
    if (cart.length === 0 || !hasSavedAddress) {
      toast.error("Add items and delivery address first");
      return;
    }
    const matched = availableCoupons.find((c) => String(c.code || "").toUpperCase() === inputCode);
    if (matched?.customerGroup === "new" && userOrderCount > 0) {
      toast.error("This coupon is only for first-time users");
      return;
    }
    try {
      const res = await calculateOrder({
        items: toPricingItems(cart),
        restaurantId: pricingRestaurantId,
        deliveryAddress: defaultAddress,
        couponCode: inputCode,
      });
      const pricingData = res?.data?.pricing;
      if (!pricingData) {
        toast.error("Unable to validate coupon");
        return;
      }
      if (pricingData.couponError) {
        toast.error(pricingData.couponError);
        setCouponCode("");
        return;
      }
      if (!pricingData.appliedCoupon) {
        toast.error("Invalid or unavailable coupon code");
        setCouponCode("");
        return;
      }
      setPricing(pricingData);
      setCouponCode(inputCode);
      setAppliedCoupon(
        matched || { code: inputCode, discount: pricingData.appliedCoupon.discount || 0, minOrder: 0, customerGroup: "all" },
      );
      setShowCoupons(false);
      toast.success("Coupon applied");
    } catch {
      toast.error("Failed to apply coupon");
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setManualCouponCode("");
    if (cart.length > 0 && hasSavedAddress) {
      try {
        const res = await calculateOrder({
          items: toPricingItems(cart, { vegRule: "explicit" }),
          restaurantId: pricingRestaurantId,
          deliveryAddress: defaultAddress,
          couponCode: null,
        });
        if (res?.success && res?.data?.pricing) setPricing(res.data.pricing);
      } catch {
        // keep current pricing
      }
    }
  };

  // ---- place order ----
  const finishPlacedOrder = (order, { clearNote }) => {
    setPlacedOrderId(order?._id || order?.orderId || order?.id || null);
    const totalSavings = platformPricingSavings.totalSavings;
    setOrderSuccessSavingsAmount(totalSavings > 0 ? totalSavings : 0);
    if (totalSavings > 0) {
      setCongrats({
        amount: totalSavings,
        percentage: platformPricingSavings.savingsPercentage,
        items: platformPricingSavings.items,
      });
      setShowSavingsCongrats(true);
    } else {
      setShowOrderSuccess(true);
    }
    if (order) upsertOrder(order);
    clearCart();
    if (clearNote) {
      setRestaurantNote("");
      setShowRestaurantNoteInput(false);
      store.remove(NOTE_KEY);
    }
  };

  const handlePlaceOrder = async () => {
    if (!hasSavedAddress) {
      toast.error("Please choose a delivery location to continue");
      openLocationSelector();
      return;
    }
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Please select both date and time to schedule your order");
        return;
      }
      if (new Date(`${scheduledDate}T${scheduledTime}:00`) < new Date()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }
    if (cart.length === 0) {
      Alert.alert("Your cart is empty");
      return;
    }

    setIsPlacingOrder(true);
    try {
      const orderPricing = pricing
        ? { ...pricing }
        : { subtotal, deliveryFee, tax: gstCharges, platformFee, discount, total, couponCode: appliedCoupon?.code || null };
      if (!orderPricing.couponCode && appliedCoupon?.code) orderPricing.couponCode = appliedCoupon.code;

      const orderItems = cart.map((item) => ({
        itemId: item.itemId || item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice ?? item.price,
        variantId: item.variantId || undefined,
        variantName: item.variantName || undefined,
        variantPrice: item.variantPrice || item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg === true || item.foodType === "Veg",
        preparationTime: item.preparationTime,
      }));

      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      const finalRestaurantName = restaurantData?.name || null;
      if (!finalRestaurantId) {
        Alert.alert("Error: Restaurant information is missing. Please refresh the page and try again.");
        setIsPlacingOrder(false);
        return;
      }

      const cartRestaurantIds = cart.map((i) => i.restaurantId).filter(Boolean).map((id) => String(id).trim());
      const cartRestaurantNames = cart.map((i) => i.restaurant).filter(Boolean).map((n) => n.trim().toLowerCase());
      if (new Set(cartRestaurantNames).size > 1) {
        if (finalRestaurantId && finalRestaurantName) {
          cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
          toast.error("Cart contained items from different restaurants. Items from other restaurants have been removed.");
        } else if (cart[0]?.restaurantId && cart[0]?.restaurant) {
          cleanCartForRestaurant(cart[0].restaurantId, cart[0].restaurant);
          toast.error("Cart contained items from different restaurants. Items from other restaurants have been removed.");
        } else {
          toast.error("Cart contains items from different restaurants. Please clear cart and try again.");
        }
        setIsPlacingOrder(false);
        return;
      }
      const dataId = restaurantData?._id?.toString();
      if (cartRestaurantIds.length > 0) {
        const cid = cartRestaurantIds[0];
        if (!(cid === finalRestaurantId || cid === dataId || cid === restaurantData?.restaurantId)) {
          Alert.alert(
            `Error: Cart items belong to "${cartRestaurantNames[0] || "Unknown Restaurant"}" but restaurant data doesn't match. Please refresh the page and try again.`,
          );
          setIsPlacingOrder(false);
          return;
        }
      }
      if (cartRestaurantNames.length > 0 && finalRestaurantName) {
        if (cartRestaurantNames[0] !== finalRestaurantName.toLowerCase().trim()) {
          Alert.alert(
            `Error: Cart items belong to "${cartRestaurantNames[0]}" but restaurant data shows "${finalRestaurantName}". Please refresh the page and try again.`,
          );
          setIsPlacingOrder(false);
          return;
        }
      }
      const firstId = cart[0]?.restaurantId;
      if (firstId && firstId !== finalRestaurantId && firstId !== dataId && firstId !== restaurantData?.restaurantId) {
        Alert.alert("Error: Restaurant information mismatch detected. Please refresh the page and try again.");
        setIsPlacingOrder(false);
        return;
      }

      const orderPayload = {
        items: orderItems,
        address: {
          ...defaultAddress,
          phone: recipientPhone || defaultAddress?.phone || "",
          name: recipientName,
          fullName: recipientName,
        },
        customerName: recipientName,
        customerPhone: recipientPhone || defaultAddress?.phone || "",
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName || undefined,
        pricing: orderPricing,
        note: "",
        restaurantNote: restaurantNote || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        zoneId: zoneId || undefined,
        scheduledAt: isScheduled ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() : undefined,
      };

      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error(
          `Insufficient wallet balance. Required: ${RUPEE}${total.toFixed(0)}, Available: ${RUPEE}${walletBalance.toFixed(0)}`,
        );
        setIsPlacingOrder(false);
        return;
      }

      if (!isScheduled) {
        try {
          const avail = await checkRiderAvailability({
            restaurantId: finalRestaurantId,
            zoneId: zoneId || defaultAddress?.zoneId || undefined,
          });
          if (avail?.data && avail.data.available === false) {
            toast.error("All riders are busy, kindly try after some time");
            setIsPlacingOrder(false);
            return;
          }
        } catch (availErr) {
          if (String(availErr?.message || "").toLowerCase().includes("busy")) {
            toast.error("All riders are busy, kindly try after some time");
            setIsPlacingOrder(false);
            return;
          }
        }
      }

      const orderResponse = await createOrder(orderPayload);
      const { order, razorpay } = orderResponse?.data || {};

      if (selectedPaymentMethod === "cash") {
        toast.success("Order placed with Cash on Delivery");
        finishPlacedOrder(order, { clearNote: true });
        setIsPlacingOrder(false);
        return;
      }

      if (selectedPaymentMethod === "wallet") {
        toast.success("Order placed with Wallet payment");
        finishPlacedOrder(order, { clearNote: true });
        setIsPlacingOrder(false);
        try {
          getWallet.invalidate?.();
          const walletRes = await getWallet();
          if (walletRes?.success && walletRes?.data?.wallet) setWalletBalance(walletRes.data.wallet.balance || 0);
        } catch {
          // keep the old balance
        }
        return;
      }

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        throw new Error(
          razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment",
        );
      }

      const userInfo = userProfile || {};
      try {
        const result = await payForOrder({
          order,
          razorpay,
          restaurantId,
          userId: userInfo.id || "",
          prefill: {
            name: recipientName || userInfo.name || "",
            email: userInfo.email || "",
            phone: recipientPhone || userInfo.phone || defaultAddress?.phone || "",
          },
        });
        if (result.status === "paid") {
          finishPlacedOrder(order, { clearNote: false });
        } else if (result.status === "cancelled") {
          if (result.cancelFailed) toast.warning(result.message);
          else toast.info(result.message);
        } else {
          Alert.alert(result.message || "Payment failed. Please try again.");
        }
      } catch (verifyErr) {
        Alert.alert(verifyErr?.message || "Payment verification failed. Please contact support.");
      }
      setIsPlacingOrder(false);
    } catch (error) {
      const message = error?.message || "Failed to create order. Please try again.";
      const data = error?.data;
      const isRiderBusy =
        message.toLowerCase().includes("all riders are busy") ||
        data?.code === "NO_RIDERS_AVAILABLE" ||
        data?.data?.reason === "all_riders_busy" ||
        data?.data?.reason === "no_online_riders";
      toast.error(isRiderBusy ? "All riders are busy, kindly try after some time" : message);
      setIsPlacingOrder(false);
    }
  };

  const handleGoToOrders = () => {
    setShowOrderSuccess(false);
    setShowSavingsCongrats(false);
    setCongrats({ amount: 0, percentage: 0, items: [] });
    setOrderSuccessSavingsAmount(0);
    router.push({ pathname: "/orders/[orderId]", params: { orderId: String(placedOrderId), confirmed: "true" } });
  };

  const addressLine = defaultAddress
    ? formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address"
    : "Delivery Address";

  const overlays = (
    <>
      <SavingsCongrats
        visible={showSavingsCongrats}
        amount={congrats.amount}
        percentage={congrats.percentage}
        items={congrats.items}
      />
      <OrderSuccess
        visible={showOrderSuccess}
        onTrack={handleGoToOrders}
        addressCity={defaultAddress?.city || "Your Location"}
        addressText={addressLine}
        savingsAmount={orderSuccessSavingsAmount}
        platformSavings={platformPricingSavings}
      />
    </>
  );

  if (cart.length === 0 && !showOrderSuccess && !showSavingsCongrats) {
    return <EmptyCart onBack={handleBack} />;
  }

  const headerAddress = defaultAddress
    ? formatFullAddress(defaultAddress) ||
      defaultAddress?.formattedAddress ||
      defaultAddress?.address ||
      defaultAddress?.city ||
      "Select address"
    : "Select address";

  return (
    <Screen background={p.page}>
      <View style={[styles.header, { backgroundColor: p.card, borderColor: p.isDark ? tw.gray800 : tw.gray200 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleBack} style={styles.backBtnSmall} hitSlop={8}>
            <ArrowLeft size={16} color={p.isDark ? tw.gray300 : tw.gray700} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: p.t500 }}>{restaurantName}</Text>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: p.isDark ? "#ffffff" : tw.gray800 }}>
              {restaurantData?.estimatedDeliveryTime || "10-15 mins"} to{" "}
              <Text style={{ fontSize: 14, fontWeight: "600", color: p.isDark ? "#ffffff" : tw.gray800 }}>Location</Text>
              <Text style={{ fontSize: 12, color: p.isDark ? tw.gray500 : tw.gray400 }}> {headerAddress}</Text>
            </Text>
          </View>
        </View>
        <Pressable onPress={() => setShowShareModal(true)} style={styles.backBtnSmall} hitSlop={8}>
          <Share2 size={16} color={p.t900} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 176 }}
        automaticallyAdjustKeyboardInsets
      >
        {savings > 0 ? (
          <View style={[styles.savings, { backgroundColor: p.isDark ? "rgba(30,58,138,0.2)" : "#dbeafe" }]}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: p.isDark ? "#bedbff" : "#193cb8" }}>
              Saved {RUPEE}
              {savings} on this order
            </Text>
          </View>
        ) : null}

        <View style={styles.content}>
          <CartItemsCard
            cart={cart}
            restaurantData={restaurantData}
            onQuantity={(id, qty) => updateQuantity(id, qty)}
            onAddMore={handleBack}
          />

          <NoteSection
            restaurantNote={restaurantNote}
            onChangeNote={setRestaurantNote}
            showNoteInput={showRestaurantNoteInput}
            onToggleNoteInput={() => setShowRestaurantNoteInput((v) => !v)}
            sendCutlery={sendCutlery}
            onToggleCutlery={() => setSendCutlery((v) => !v)}
          />

          <MoreItemsSection
            loading={loadingMoreItems}
            items={moreRestaurantItems}
            cart={cart}
            restaurantName={restaurantName}
            menuTarget={restaurantData?.slug || restaurantData?._id || cart[0]?.restaurantId}
            onSeeMenu={() =>
              router.push(`/restaurants/${restaurantData?.slug || restaurantData?._id || cart[0]?.restaurantId}`)
            }
            onAdd={handleAddMoreItemToCart}
            onUpdate={handleUpdateMoreItemQuantity}
          />

          <AddonsSection loading={loadingAddons} addons={addons} onAdd={handleAddAddon} />

          <CouponSection
            deliveryFee={deliveryFee}
            savedDeliveryAmount={feeSettings.deliveryFee || 25}
            appliedCoupon={appliedCoupon}
            discount={discount}
            onRemoveCoupon={handleRemoveCoupon}
            loadingCoupons={loadingCoupons}
            availableCoupons={availableCoupons}
            subtotal={subtotal}
            userOrderCount={userOrderCount}
            showCoupons={showCoupons}
            onToggleCoupons={() => setShowCoupons((v) => !v)}
            onApplyCoupon={handleApplyCoupon}
            manualCouponCode={manualCouponCode}
            onChangeManualCode={setManualCouponCode}
            onApplyManualCode={handleApplyCouponCode}
          />

          <DeliveryTimeSection
            eta={restaurantData?.estimatedDeliveryTime || "15-20 mins"}
            isScheduled={isScheduled}
            onToggleSchedule={() => {
              const next = !isScheduled;
              setIsScheduled(next);
              if (next && !scheduledDate) setScheduledDate(localDateString(new Date()));
            }}
            scheduledDate={scheduledDate}
            onChangeDate={setScheduledDate}
            scheduledTime={scheduledTime}
            onChangeTime={setScheduledTime}
            slots={availableTimeSlots}
          />

          <DeliveryAddressSection
            deliveryAddressMode={deliveryAddressMode}
            currentLocationLoading={currentLocationLoading}
            currentLocationAddress={currentLocationAddress}
            defaultAddress={defaultAddress}
            hasSavedAddress={hasSavedAddress}
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectLabel={handleSelectAddressByLabel}
            onSelectAddress={handleSelectSavedAddress}
            onOpenSelector={openLocationSelector}
          />

          <RecipientSection
            recipientName={recipientName}
            recipientPhone={recipientPhone}
            isEditing={isEditingRecipient}
            onToggleEditing={() => setIsEditingRecipient((v) => !v)}
            details={recipientDetails}
            onChangeName={(name) => setRecipientDetails((prev) => ({ ...prev, name }))}
            onChangePhone={(phone) => setRecipientDetails((prev) => ({ ...prev, phone: sanitizeRecipientPhone(phone) }))}
          />

          <BillDetailsSection
            expanded={showBillDetails}
            onToggle={() => setShowBillDetails((v) => !v)}
            total={total}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            deliveryFeeBreakdownText={deliveryFeeBreakdownText}
            freeDeliveryUpTo={freeDeliveryUpTo}
            platformFee={platformFee}
            packagingFee={packagingFee}
            gstCharges={gstCharges}
            couponDiscount={couponDiscount}
            platformSavings={platformPricingSavings}
            onShowGst={() => setShowGstModal(true)}
          />
        </View>
      </ScrollView>

      <PaymentBar
        method={selectedPaymentMethod}
        label={selectedPaymentLabel}
        walletBalance={walletBalance}
        total={total}
        isPlacingOrder={isPlacingOrder}
        hasSavedAddress={hasSavedAddress}
        onChange={() => setShowPaymentSheet(true)}
        onPlaceOrder={handlePlaceOrder}
      />

      <PaymentSheet
        visible={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        selected={selectedPaymentMethod}
        onSelect={setSelectedPaymentMethod}
        walletBalance={walletBalance}
        total={total}
        isCodHidden={isCodHidden}
      />

      <GstDialog
        visible={showGstModal}
        onClose={() => setShowGstModal(false)}
        companyName={companyName}
        itemGst={gstOnItemTotal}
        packagingGst={gstOnPackagingFee}
        deliveryGst={gstOnDeliveryFee}
        platformGst={gstOnPlatformFee}
        total={gstCharges}
      />

      <ShareDialog
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        onSystemShare={handleSystemShare}
        onTarget={openShareTarget}
        onCopy={copyShareLink}
      />

      {overlays}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  emptyHeader: { justifyContent: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  backBtnSmall: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  savings: { paddingHorizontal: 16, paddingVertical: 8 },
  content: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  emptyBody: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 16 },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tw.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptySub: { fontSize: 14, marginBottom: 16, textAlign: "center" },
});
