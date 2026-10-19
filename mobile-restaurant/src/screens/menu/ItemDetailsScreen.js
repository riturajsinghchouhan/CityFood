// Port of pages/restaurant/ItemDetailsPage.jsx (/hub-menu/item/:id, "new" = create): one item
// image (camera or gallery, uploaded on save), category, name, description, veg / non-veg,
// base price or variants, preparation time, recommended and in-stock. No bottom nav here; the
// Save bar is pinned to the bottom and rises with the keyboard.
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createFood, getCategories, getCurrentRestaurant, getMenu, updateFood, uploadMedia } from "../../api";
import ImageSourcePicker from "../../components/auth/onboarding/ImageSourcePicker";
import { CenterSheet, MenuSwitch, SelectField, confirmAsync, peekItemHandoff } from "../../components/menu/common";
import { pal } from "../../components/menu/palette";
import { AppImage, Text, inputFont, toast } from "../../components/ui";
import { goTo, useAppBack } from "../../navigation/back";
import { store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";

const INVENTORY_RECOMMENDED_KEY = "restaurant_inventory_recommended_map";
const MAX_NAME = 70;
const MAX_DESCRIPTION = 1000;
const MIN_DESCRIPTION = 5;
const IN_STOCK_GREEN = "#16a34a"; // the page's [data-slot="switch"][data-state="checked"] override

const PREP_OPTIONS = [
  { value: "", label: "Select timing" },
  { value: "10-20 mins", label: "10-20 mins" },
  { value: "20-25 mins", label: "20-25 mins" },
  { value: "25-35 mins", label: "25-35 mins" },
  { value: "35-45 mins", label: "35-45 mins" },
];

// utils/foodVariants.js getFoodVariants
const getFoodVariants = (item = {}) =>
  (Array.isArray(item?.variants) ? item.variants : Array.isArray(item?.variations) ? item.variations : [])
    .map((entry = {}, index) => {
      const id = String(entry?.id || entry?._id || `variant-${index}`);
      const name = String(entry?.name || "").trim();
      const price = Number(entry?.price);
      if (!name || !Number.isFinite(price) || price <= 0) return null;
      return { id, _id: id, name, price };
    })
    .filter(Boolean);

const createVariantDraft = (variant = {}) => ({
  localId: String(variant?.id || variant?._id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  persistedId: String(variant?.id || variant?._id || ""),
  name: String(variant?.name || ""),
  price: variant?.price != null ? String(variant.price) : "",
});

// Strips ₹, spaces, commas and anything but digits and one dot.
const cleanPrice = (text) => {
  const value = String(text).replace(/[₹\s,]/g, "").replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : value;
};

const scopeChip = (scope) => {
  if (scope === "Veg") return { bg: pal.green50, border: pal.green200, fg: pal.green700 };
  if (scope === "Non-Veg") return { bg: pal.red50, border: pal.red200, fg: pal.red700 };
  return { bg: pal.slate100, border: pal.slate200, fg: pal.slate700 };
};

function findMenuItem(sections, id) {
  const searchId = String(id).trim();
  const match = (i) => String(i.id || i._id || "").trim() === searchId;
  for (const section of sections) {
    const item = section.items?.find(match);
    if (item) return item;
    for (const sub of section.subsections || []) {
      const subItem = sub.items?.find(match);
      if (subItem) return subItem;
    }
  }
  return null;
}

export default function ItemDetailsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = useAppBack();
  const params = useLocalSearchParams();
  const id = String(params.id || "");
  const isNewItem = id === "new";
  const defaultCategory = params.category ? String(params.category) : "Select category";
  const defaultCategoryId = params.categoryId ? String(params.categoryId) : "";
  const [handoff] = useState(() => peekItemHandoff(id));

  const [itemData, setItemData] = useState(null);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategoryId);
  const [itemDescription, setItemDescription] = useState("");
  const [foodType, setFoodType] = useState("Non-Veg");
  const [basePrice, setBasePrice] = useState("");
  const [variants, setVariants] = useState([]);
  const [preparationTime, setPreparationTime] = useState("");
  const [isRecommended, setIsRecommended] = useState(false);
  const [isInStock, setIsInStock] = useState(true);
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState(() => new Map());
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isCategoryPopupOpen, setIsCategoryPopupOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItem, setLoadingItem] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState(null);

  const currentApprovalStatus = String(itemData?.approvalStatus || "").toLowerCase();
  const currentRejectionReason = String(itemData?.rejectionReason || "").trim();
  const descriptionLength = itemDescription.length;

  const populateFormFromItem = useCallback(
    (item = {}) => {
      setItemData(item);
      setItemName(item.name || "");
      setCategory(item.category || item.categoryName || defaultCategory);
      setSelectedCategoryId(item.categoryId || "");
      setItemDescription(item.description || "");
      setFoodType(item.foodType === "Veg" ? "Veg" : "Non-Veg");
      const itemVariants = getFoodVariants(item);
      setVariants(itemVariants.map(createVariantDraft));
      setBasePrice(itemVariants.length === 0 ? item.price?.toString() || "" : "");
      setPreparationTime(item.preparationTime || "");
      setIsRecommended(item.isRecommended || false);
      setIsInStock(item.isAvailable !== false);
      const existing =
        Array.isArray(item.images) && item.images.length > 0 ? item.images.filter(Boolean) : item.image ? [item.image] : [];
      setImages(existing);
      setImageFiles(new Map());
      setCurrentImageIndex(0);
    },
    [defaultCategory],
  );

  // Item: Inventory's hand-off first, then the menu API (edit only).
  useEffect(() => {
    let alive = true;
    if (handoff?.item) populateFormFromItem(handoff.item);
    if (!isNewItem && id) {
      setLoadingItem(true);
      getMenu()
        .then((res) => {
          if (!alive) return;
          const found = findMenuItem(res?.data?.menu?.sections || [], id);
          if (found) populateFormFromItem(found);
          else toast.error("Item not found");
        })
        .catch(() => {
          if (alive) toast.error("Failed to load item data");
        })
        .finally(() => {
          if (alive) setLoadingItem(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [id, isNewItem, handoff, populateFormFromItem]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const res = await getCategories();
      const list = res?.success && Array.isArray(res?.data?.categories) ? res.data.categories : [];
      setCategories(list.map((cat) => ({ id: cat._id || cat.id, name: cat.name, foodTypeScope: cat.foodTypeScope || "Both" })));
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Categories load on mount, and again when the owner returns from "Add Category" (the web
  // remounts this page on that round trip).
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories]),
  );

  // With no category chosen yet: match the passed name, or default to the first for a new item.
  useEffect(() => {
    if (selectedCategoryId || categories.length === 0 || loadingItem) return;
    const preferredName = String(category || defaultCategory || "").trim();
    const next = categories.find((cat) => cat.name === preferredName) || (isNewItem ? categories[0] : null);
    if (next) {
      setSelectedCategoryId(next.id);
      setCategory(next.name);
    }
  }, [categories, selectedCategoryId, category, defaultCategory, isNewItem, loadingItem]);

  useEffect(() => {
    let alive = true;
    getCurrentRestaurant()
      .then((res) => {
        if (!alive) return;
        const profile = res?.data?.restaurant || res?.data || null;
        setRestaurantProfile(profile);
        if (profile?.pureVegRestaurant === true) setFoodType("Veg");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Single-image mode: a new pick replaces the current image.
  const handleImageAdd = (asset) => {
    if (!asset?.uri) return;
    const map = new Map();
    map.set(asset.uri, asset);
    setImages([asset.uri]);
    setImageFiles(map);
    setCurrentImageIndex(0);
  };

  const handleImageDelete = async (index) => {
    if (index < 0 || index >= images.length) return;
    if (!(await confirmAsync("Are you sure you want to delete this image?"))) return;
    const toDelete = images[index];
    const next = images.filter((_, i) => i !== index);
    const map = new Map(imageFiles);
    map.delete(toDelete);
    setImages(next);
    setImageFiles(map);
    if (next.length === 0) setCurrentImageIndex(0);
    else if (currentImageIndex >= next.length) setCurrentImageIndex(next.length - 1);
    toast.success("Image deleted successfully");
  };

  const goToNext = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const goToPrevious = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const touch = useRef({ start: null, end: null });
  const onTouchStart = (e) => {
    touch.current = { start: e.nativeEvent.pageX, end: null };
  };
  const onTouchMove = (e) => {
    touch.current.end = e.nativeEvent.pageX;
  };
  const onTouchEnd = () => {
    const { start, end } = touch.current;
    if (start == null || end == null || images.length === 0) return;
    const distance = start - end;
    if (distance > 50) goToNext();
    if (distance < -50) goToPrevious();
  };

  const handleCategorySelect = (catId) => {
    const selected = categories.find((c) => c.id === catId);
    setSelectedCategoryId(selected?.id || "");
    setCategory(selected?.name || "");
    setIsCategoryPopupOpen(false);
  };

  const openAddCategory = () => {
    setIsCategoryPopupOpen(false);
    router.push("/menu-categories");
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      toast.error("Please enter an item name");
      return;
    }
    try {
      setUploadingImages(true);
      const uploadedImageUrls = [];
      const existingImageUrls = images.filter((img) => typeof img === "string" && img.trim() !== "" && !imageFiles.has(img));
      const filesToUpload = Array.from(imageFiles.values());

      if (filesToUpload.length > 0) {
        toast.info(`Uploading ${filesToUpload.length} image(s)...`);
        for (const file of filesToUpload) {
          const fileName = file.fileName || file.name || file.uri.split("/").pop() || "image";
          try {
            let uploadRes;
            try {
              uploadRes = await uploadMedia(file, { folder: "tuggo/restaurant/menu-items" });
            } catch {
              // Retry without a folder in case the provider rejects the custom folder (web).
              uploadRes = await uploadMedia(file);
            }
            const url = uploadRes?.data?.url;
            if (!url) throw new Error("Failed to get uploaded image URL");
            uploadedImageUrls.push(url);
          } catch (uploadError) {
            toast.error(`Failed to upload ${fileName}: ${uploadError?.message || "Please try again."}`);
            setUploadingImages(false);
            return;
          }
        }
      }

      const allImageUrls = [...existingImageUrls, ...uploadedImageUrls]
        .filter((url, index, self) => url && typeof url === "string" && url.trim() !== "" && self.indexOf(url) === index)
        .slice(0, 1);

      const matchedCategory = categories.find((c) => String(c?.id || "") === String(selectedCategoryId || "")) || null;
      const categoryId = matchedCategory?.id || null;
      const categoryName = matchedCategory?.name || category || "";

      if (!categoryId) {
        toast.error("Please select an approved category first");
        setIsCategoryPopupOpen(true);
        setUploadingImages(false);
        return;
      }

      if (matchedCategory?.foodTypeScope && matchedCategory.foodTypeScope !== "Both" && matchedCategory.foodTypeScope !== foodType) {
        toast.error(`This ${matchedCategory.foodTypeScope} category cannot accept ${foodType} food`);
        setUploadingImages(false);
        return;
      }

      const normalizedVariants = variants
        .map((v) => ({ persistedId: String(v.persistedId || "").trim(), name: String(v.name || "").trim(), price: Number(v.price) }))
        .filter((v) => v.name || v.persistedId || v.price);

      if (normalizedVariants.some((v) => !v.name)) {
        toast.error("Each variant must have a name");
        setUploadingImages(false);
        return;
      }
      if (normalizedVariants.some((v) => !Number.isFinite(v.price) || v.price <= 0)) {
        toast.error("Each variant price must be greater than 0");
        setUploadingImages(false);
        return;
      }

      const hasVariants = normalizedVariants.length > 0;
      const parsedBasePrice = Number(basePrice);
      if (!hasVariants && (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0)) {
        toast.error("Please enter a valid base price");
        setUploadingImages(false);
        return;
      }

      const body = {
        name: itemName.trim(),
        description: itemDescription.trim(),
        price: hasVariants ? undefined : parsedBasePrice,
        variants: normalizedVariants.map((v) => ({ ...(v.persistedId ? { _id: v.persistedId } : {}), name: v.name, price: v.price })),
        image: allImageUrls.length > 0 ? allImageUrls[0] : "",
        foodType,
        isAvailable: isInStock,
        isRecommended: Boolean(isRecommended),
        preparationTime: preparationTime || "",
        categoryId: categoryId || undefined,
        categoryName,
      };

      let itemId;
      if (isNewItem) {
        const createRes = await createFood(body);
        const created = createRes?.data?.food;
        itemId = String(created?._id || created?.id || "");
        if (!itemId) throw new Error("Failed to create item in database");
      } else {
        itemId = String(itemData?.id || id || "");
        if (!itemId) throw new Error("Invalid item id");
        await updateFood(itemId, body);
      }

      const map = (await store.get(INVENTORY_RECOMMENDED_KEY, {})) || {};
      await store.set(INVENTORY_RECOMMENDED_KEY, { ...(typeof map === "object" ? map : {}), [itemId]: Boolean(isRecommended) });

      const imageCount = allImageUrls.length;
      toast.success(
        isNewItem
          ? `Item created successfully with ${imageCount} image(s)`
          : `Item updated and sent for approval again with ${imageCount} image(s)`,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      goTo("/inventory");
    } catch (error) {
      if (error?.isNetworkError) {
        toast.error("Network error. Please check if backend server is running and try again.");
      } else {
        toast.error(error?.message || "Failed to save item. Please try again.");
      }
    } finally {
      setUploadingImages(false);
    }
  };

  const updateVariant = (localId, field, value) => {
    setVariants((prev) => prev.map((v) => (v.localId === localId ? { ...v, [field]: value } : v)));
  };

  const pureVeg = restaurantProfile?.pureVegRestaurant === true;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8} accessibilityLabel="Back">
          <ArrowLeft size={20} color={pal.gray700} />
        </Pressable>
        <Text style={styles.headerTitle}>Item details</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {!isNewItem && currentApprovalStatus === "rejected" && currentRejectionReason ? (
          <View style={styles.rejectWrap}>
            <View style={styles.rejectBox}>
              <Text style={styles.rejectTitle}>Approval rejected</Text>
              <Text style={styles.rejectReason}>Reason: {currentRejectionReason}</Text>
              <Text style={styles.rejectHint}>UPDATE THE DISH AND SAVE TO SEND IT FOR APPROVAL AGAIN</Text>
            </View>
          </View>
        ) : null}

        <View style={{ backgroundColor: "#ffffff" }}>
          {images.length > 0 ? (
            <View>
              <View style={styles.carousel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                {images[currentImageIndex] ? (
                  <AppImage key={images[currentImageIndex]} src={images[currentImageIndex]} style={StyleSheet.absoluteFill} placeholderType="food" />
                ) : null}
                {images.length > 1 ? (
                  <>
                    <Pressable onPress={goToPrevious} style={[styles.navBtn, { left: 12 }]}>
                      <ChevronLeft size={20} color={pal.gray900} />
                    </Pressable>
                    <Pressable onPress={goToNext} style={[styles.navBtn, { right: 12 }]}>
                      <ChevronRight size={20} color={pal.gray900} />
                    </Pressable>
                    <View style={styles.counter}>
                      <Text style={styles.counterText}>
                        {currentImageIndex + 1} / {images.length}
                      </Text>
                    </View>
                  </>
                ) : null}
                <Pressable onPress={() => handleImageDelete(currentImageIndex)} style={styles.deleteImageBtn} accessibilityLabel="Delete image">
                  <Trash2 size={20} color={pal.gray900} />
                </Pressable>
              </View>
              {images.length > 1 ? (
                <View style={styles.dots}>
                  {images.map((img, index) => (
                    <Pressable
                      key={img}
                      onPress={() => setCurrentImageIndex(index)}
                      style={index === currentImageIndex ? styles.dotActive : styles.dot}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <LinearGradient colors={[pal.gray100, pal.gray200]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyImage}>
              <View style={styles.emptyIcon}>
                <Camera size={40} color={pal.gray400} />
              </View>
              <Text style={styles.emptyTitle}>No images added yet</Text>
              <Text style={styles.emptySub}>Tap the button below to add one image</Text>
            </LinearGradient>
          )}

          <View style={styles.addImageWrap}>
            <Pressable onPress={() => setIsPhotoPickerOpen(true)} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
              <LinearGradient colors={[pal.gray900, pal.gray800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addImageBtn}>
                <View style={styles.addImageIcon}>
                  <Plus size={16} color="#ffffff" />
                </View>
                <Text style={styles.addImageText}>Add Image</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Category</Text>
            <Pressable onPress={() => setIsCategoryPopupOpen(true)} style={styles.selectBtn}>
              <Text style={styles.selectText}>{category || "Select category"}</Text>
              <ChevronDown size={20} color={pal.gray500} />
            </Pressable>
          </View>

          <View>
            <Text style={styles.label}>Item name</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                maxLength={MAX_NAME}
                placeholder="Enter item name"
                placeholderTextColor={pal.gray400}
                selectionColor={colors.primary}
                style={[styles.input, inputFont, { paddingRight: 48 }]}
              />
              <View style={styles.editIcon} pointerEvents="none">
                <Pencil size={16} color={pal.gray500} />
              </View>
            </View>
            <Text style={styles.counterRight}>
              {itemName.length} / {MAX_NAME}
            </Text>
          </View>

          <View>
            <Text style={styles.label}>Item description</Text>
            <View>
              <TextInput
                value={itemDescription}
                onChangeText={setItemDescription}
                maxLength={MAX_DESCRIPTION}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Eg: Yummy veg paneer burger with a soft patty, veggies, cheese, and special sauce"
                placeholderTextColor={pal.gray400}
                selectionColor={colors.primary}
                style={[styles.input, inputFont, { paddingRight: 48, minHeight: 104 }]}
              />
              <View style={[styles.editIcon, { top: 12 }]} pointerEvents="none">
                <Pencil size={16} color={pal.gray500} />
              </View>
            </View>
            <View style={styles.descMeta}>
              <Text style={[styles.metaText, descriptionLength < MIN_DESCRIPTION && { color: pal.red500 }]}>
                {descriptionLength < MIN_DESCRIPTION ? "Min 5 characters required" : ""}
              </Text>
              <Text style={styles.metaText}>
                {descriptionLength} / {MAX_DESCRIPTION}
              </Text>
            </View>
            <View style={styles.dietRow}>
              <Pressable
                onPress={() => setFoodType("Veg")}
                style={[styles.dietBtn, foodType === "Veg" ? { borderWidth: 2, borderColor: pal.green600 } : { backgroundColor: pal.gray100 }]}
              >
                {foodType === "Veg" ? <Check size={16} color={pal.green600} /> : null}
                <Text style={[styles.dietText, { color: foodType === "Veg" ? pal.green600 : pal.gray700 }]}>Veg</Text>
              </Pressable>
              {!pureVeg ? (
                <Pressable
                  onPress={() => setFoodType("Non-Veg")}
                  style={[styles.dietBtn, foodType === "Non-Veg" ? { borderWidth: 2, borderColor: pal.red600 } : { backgroundColor: pal.gray100 }]}
                >
                  {foodType === "Non-Veg" ? <Check size={16} color={pal.red600} /> : null}
                  <Text style={[styles.dietText, { color: foodType === "Non-Veg" ? pal.red600 : pal.gray700 }]}>Non-Veg</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Item price</Text>
            <View style={{ gap: 12 }}>
              {variants.length === 0 ? (
                <View>
                  <Text style={styles.subLabel}>Base price</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={basePrice}
                      onChangeText={(t) => setBasePrice(cleanPrice(t))}
                      keyboardType="decimal-pad"
                      placeholder="Enter price"
                      placeholderTextColor={pal.gray400}
                      selectionColor={colors.primary}
                      style={[styles.input, inputFont, { paddingLeft: 32, paddingRight: 48, backgroundColor: pal.gray50 }]}
                    />
                    <Text style={styles.rupee}>{"₹"}</Text>
                    <View style={styles.editIcon} pointerEvents="none">
                      <Pencil size={16} color={pal.gray500} />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.variantNote}>
                  <Text style={styles.variantNoteText}>Customers will see the lowest variant price first.</Text>
                </View>
              )}

              <View style={styles.variantBox}>
                <View style={styles.variantHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantTitle}>Variants</Text>
                    <Text style={styles.variantSub}>Optional. Add multiple names and prices like Half, Full, Small, Large.</Text>
                  </View>
                  <Pressable onPress={() => setVariants((prev) => [...prev, createVariantDraft()])} style={styles.addVariantBtn}>
                    <Plus size={14} color={pal.orange700} />
                    <Text style={styles.addVariantText}>Add variant</Text>
                  </Pressable>
                </View>
                {variants.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    {variants.map((variant, index) => (
                      <View key={variant.localId} style={styles.variantRow}>
                        <View style={{ flex: 1, gap: 12 }}>
                          <View>
                            <Text style={styles.subLabel}>Variant name</Text>
                            <TextInput
                              value={variant.name}
                              onChangeText={(t) => updateVariant(variant.localId, "name", t)}
                              placeholder={index === 0 ? "e.g., Half" : "e.g., Full"}
                              placeholderTextColor={pal.gray400}
                              selectionColor={colors.primary}
                              style={[styles.variantInput, inputFont]}
                            />
                          </View>
                          <View>
                            <Text style={styles.subLabel}>Variant price</Text>
                            <View style={styles.inputWrap}>
                              <TextInput
                                value={variant.price}
                                onChangeText={(t) => updateVariant(variant.localId, "price", cleanPrice(t))}
                                keyboardType="decimal-pad"
                                placeholder="Enter price"
                                placeholderTextColor={pal.gray400}
                                selectionColor={colors.primary}
                                style={[styles.variantInput, inputFont, { paddingLeft: 32 }]}
                              />
                              <Text style={styles.rupee}>{"₹"}</Text>
                            </View>
                          </View>
                        </View>
                        <Pressable onPress={() => setVariants((prev) => prev.filter((v) => v.localId !== variant.localId))} style={styles.removeVariant}>
                          <X size={16} color={pal.gray500} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.variantSub}>No variants added. This item will use the base price only.</Text>
                )}
              </View>

              <View>
                <Text style={styles.subLabel}>Preparation Time</Text>
                <SelectField
                  value={preparationTime}
                  options={PREP_OPTIONS}
                  onChange={setPreparationTime}
                  placeholder="Select timing"
                  style={{ backgroundColor: pal.gray50 }}
                />
              </View>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setIsRecommended(!isRecommended)}
              style={[styles.recommendBtn, { backgroundColor: isRecommended ? pal.blue100 : pal.gray100 }]}
            >
              <ThumbsUp size={16} color={isRecommended ? pal.blue700 : pal.gray700} />
              <Text style={[styles.recommendText, { color: isRecommended ? pal.blue700 : pal.gray700 }]}>Recommend</Text>
            </Pressable>
            <View style={styles.stockRow}>
              <MenuSwitch value={isInStock} onValueChange={setIsInStock} checkedColor={IN_STOCK_GREEN} uncheckedColor={pal.gray300} />
              <Text style={styles.stockText}>In stock</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        {!isNewItem ? (
          <Pressable onPress={goBack} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleSave}
          disabled={uploadingImages}
          style={[
            styles.saveBtn,
            uploadingImages
              ? { backgroundColor: pal.gray300 }
              : { backgroundColor: colors.primary, boxShadow: `0px 4px 6px -1px ${colors.primary}40` },
          ]}
        >
          {uploadingImages ? (
            <>
              <ActivityIndicator size="small" color={pal.gray500} />
              <Text style={[styles.saveText, { color: pal.gray500 }]}>Uploading...</Text>
            </>
          ) : (
            <Text style={styles.saveText}>Save Item</Text>
          )}
        </Pressable>
      </View>

      <CenterSheet
        open={isCategoryPopupOpen}
        onClose={() => setIsCategoryPopupOpen(false)}
        maxHeight="85%"
        contentStyle={{ padding: 8 }}
        header={
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select category</Text>
            <View style={styles.sheetHeaderBtns}>
              <Pressable onPress={openAddCategory} style={[styles.sheetAdd, { backgroundColor: colors.primary }]} accessibilityLabel="Add Category">
                <Plus size={16} color="#ffffff" />
                <Text style={styles.sheetAddText}>Add</Text>
              </Pressable>
              <Pressable onPress={() => setIsCategoryPopupOpen(false)} style={{ padding: 4 }} hitSlop={6}>
                <X size={20} color={pal.gray600} />
              </Pressable>
            </View>
          </View>
        }
      >
        {loadingCategories ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator size="small" color={pal.gray600} />
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Text style={styles.sheetEmptyText}>No categories available</Text>
            <Pressable onPress={openAddCategory} style={[styles.sheetEmptyBtn, { backgroundColor: colors.primary }]}>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.sheetEmptyBtnText}>Add Category</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {categories.map((cat) => {
              const active = String(selectedCategoryId || "") === String(cat.id);
              const chip = scopeChip(cat.foodTypeScope);
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => handleCategorySelect(cat.id)}
                  style={[styles.catOption, { backgroundColor: active ? colors.primary : pal.gray50 }]}
                >
                  <Text style={[styles.catOptionText, { color: active ? "#ffffff" : pal.gray900 }]}>{cat.name}</Text>
                  <View style={[styles.scopeChip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
                    <Text style={[styles.scopeChipText, { color: chip.fg }]}>{cat.foodTypeScope || "Both"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </CenterSheet>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageAdd}
        title="Item Image"
        description="Choose how to upload your item image"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: pal.gray200,
  },
  backBtn: { padding: 4, borderRadius: 9999 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: pal.gray900 },
  rejectWrap: { paddingHorizontal: 16, paddingTop: 16 },
  rejectBox: { borderRadius: 16, borderWidth: 1, borderColor: pal.red200, backgroundColor: pal.red50, paddingHorizontal: 16, paddingVertical: 12 },
  rejectTitle: { fontSize: 14, fontWeight: "600", color: pal.red700 },
  rejectReason: { marginTop: 4, fontSize: 14, lineHeight: 20, color: pal.red600 },
  rejectHint: { marginTop: 8, fontSize: 12, fontWeight: "500", letterSpacing: 2.2, color: pal.red500 },
  carousel: { width: "100%", height: 320, overflow: "hidden", backgroundColor: pal.gray100 },
  navBtn: {
    position: "absolute",
    top: 140,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  deleteImageBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  counter: { position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  counterText: { fontSize: 12, fontWeight: "500", color: "#ffffff" },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, backgroundColor: "#ffffff" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: pal.gray300 },
  dotActive: { width: 32, height: 8, borderRadius: 4, backgroundColor: pal.gray900 },
  emptyImage: { width: "100%", height: 320, alignItems: "center", justifyContent: "center" },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    boxShadow: "0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)",
  },
  emptyTitle: { fontSize: 14, fontWeight: "500", color: pal.gray600 },
  emptySub: { marginTop: 4, fontSize: 12, color: pal.gray500 },
  addImageWrap: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: pal.gray100 },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)",
  },
  addImageIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  addImageText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  form: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: "500", color: pal.gray900, marginBottom: 8 },
  subLabel: { fontSize: 12, color: pal.gray600, marginBottom: 4 },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  selectText: { flex: 1, fontSize: 14, color: pal.gray900 },
  inputWrap: { justifyContent: "center" },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 8,
    fontSize: 14,
    color: pal.gray900,
    backgroundColor: "#ffffff",
  },
  editIcon: { position: "absolute", right: 12, padding: 4 },
  rupee: { position: "absolute", left: 12, fontSize: 14, color: pal.gray600 },
  counterRight: { marginTop: 4, textAlign: "right", fontSize: 12, color: pal.gray500 },
  descMeta: { marginTop: 4, flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 12, color: pal.gray500 },
  dietRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  dietBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  dietText: { fontSize: 14, fontWeight: "500" },
  variantNote: { borderRadius: 8, borderWidth: 1, borderColor: pal.orange100, backgroundColor: pal.orange50, paddingHorizontal: 12, paddingVertical: 8 },
  variantNoteText: { fontSize: 14, color: pal.orange700 },
  variantBox: { borderRadius: 12, borderWidth: 1, borderColor: pal.gray200, backgroundColor: "#ffffff", padding: 12, gap: 12 },
  variantHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  variantTitle: { fontSize: 14, fontWeight: "500", color: pal.gray900 },
  variantSub: { fontSize: 12, color: pal.gray500 },
  addVariantBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: pal.orange200,
    backgroundColor: pal.orange50,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addVariantText: { fontSize: 12, fontWeight: "600", color: pal.orange700 },
  variantRow: { flexDirection: "row", gap: 12, borderRadius: 8, borderWidth: 1, borderColor: pal.gray200, backgroundColor: pal.gray50, padding: 12 },
  variantInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 8,
    fontSize: 14,
    color: pal.gray900,
    backgroundColor: "#ffffff",
  },
  removeVariant: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: pal.gray200,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: pal.gray200 },
  recommendBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  recommendText: { fontSize: 14, fontWeight: "500" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stockText: { fontSize: 14, color: pal.gray700 },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: pal.gray200,
    boxShadow: "0px -4px 16px rgba(0,0,0,0.06)",
  },
  deleteBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: pal.gray300, borderRadius: 12, alignItems: "center", backgroundColor: "#ffffff" },
  deleteText: { fontSize: 14, fontWeight: "600", color: pal.gray700 },
  saveBtn: { flex: 1, flexDirection: "row", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: pal.gray200,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: pal.gray900 },
  sheetHeaderBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetAdd: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8 },
  sheetAddText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  sheetLoading: { paddingVertical: 48, alignItems: "center" },
  sheetEmpty: { paddingVertical: 48, alignItems: "center", gap: 16 },
  sheetEmptyText: { fontSize: 14, color: pal.gray500 },
  sheetEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  sheetEmptyBtnText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  catOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  catOptionText: { flex: 1, fontSize: 14, fontWeight: "500" },
  scopeChip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  scopeChipText: { fontSize: 11, fontWeight: "600" },
});
