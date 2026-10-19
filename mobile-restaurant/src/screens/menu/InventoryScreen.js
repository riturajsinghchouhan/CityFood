// Port of pages/restaurant/Inventory.jsx (/inventory tab): menu items grouped by category with
// stock and "recommended" toggles, out-of-stock timers, search and filters, the Add-ons tab with
// its form, the Add item / bulk upload popup and the floating "Jump to category" menu.
// The shell draws the navbar (with the search icon) and the bottom nav.
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addAddon,
  bulkCreateFood,
  deleteAddon,
  deleteFood,
  getAddons,
  getCurrentRestaurant,
  getMenu,
  setAddonAvailability,
  setFoodAvailability,
  setFoodRecommended,
  updateAddon,
  uploadMedia,
} from "../../api";
import { AddItemSheet, BulkResultDialog } from "../../components/menu/AddItemSheet";
import { confirmAsync, setItemHandoff } from "../../components/menu/common";
import {
  EXCEL_UNAVAILABLE,
  parseInventoryExcel,
  rowsToInventoryItems,
  writeInventoryTemplate,
} from "../../components/menu/excel";
import {
  AddonCard,
  AddonForm,
  CategoryCard,
  FilterSheet,
  InventoryTabs,
  JumpMenu,
  SearchToolsCard,
} from "../../components/menu/InventoryParts";
import { pal } from "../../components/menu/palette";
import StockOffSheet from "../../components/menu/StockOffSheet";
import { buildStockRule, expiredRuleIds, isRuleActive } from "../../components/menu/stockRules";
import { getImageValidationError, getUploadErrorMessage } from "../../components/menu/uploadErrors";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { Text, toast } from "../../components/ui";
import { useBackOverride } from "../../navigation/back";
import { store } from "../../storage";

const INVENTORY_STORAGE_KEY = "restaurant_inventory_state";
const INVENTORY_RECOMMENDED_KEY = "restaurant_inventory_recommended_map";
const INVENTORY_ACTIVE_TAB_KEY = "restaurant_inventory_active_tab";
const INVENTORY_ADDON_FORM_KEY = "restaurant_inventory_addon_form";
const INVENTORY_STOCK_RULES_KEY = "restaurant_inventory_stock_rules_v1";

const INVENTORY_TABS = ["all-items", "add-ons"];

const MENU_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "recommended", label: "Recommended" },
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-veg" },
];

const ADDON_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const ADDON_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
const EXCEL_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const filterMenuItems = (items = [], filterValue = "all") => {
  if (filterValue === "in-stock") return items.filter((item) => item.inStock);
  if (filterValue === "out-of-stock") return items.filter((item) => !item.inStock);
  if (filterValue === "recommended") return items.filter((item) => item.isRecommended);
  if (filterValue === "veg") return items.filter((item) => item.isVeg);
  if (filterValue === "non-veg") return items.filter((item) => !item.isVeg);
  return items;
};

const filterAddonsList = (items = [], filterValue = "all") => {
  if (filterValue === "available") return items.filter((item) => item.isAvailable !== false);
  if (filterValue === "unavailable") return items.filter((item) => item.isAvailable === false);
  if (filterValue === "approved") return items.filter((item) => item.approvalStatus === "approved");
  if (filterValue === "pending") return items.filter((item) => item.approvalStatus === "pending");
  if (filterValue === "rejected") return items.filter((item) => item.approvalStatus === "rejected");
  return items;
};

function toInventoryItem(item, section, subsection, recommendedMap) {
  return {
    id: String(item.id || Date.now() + Math.random()),
    name: item.name || "Unnamed Item",
    description: item.description || "",
    image: item.image || "",
    images: item.image ? [item.image] : [],
    price: item.price ?? "",
    variants: Array.isArray(item.variants) ? item.variants : Array.isArray(item.variations) ? item.variations : [],
    category: section.name || subsection?.name || "",
    categoryId: section.categoryId || section.id || "",
    inStock: item.isAvailable !== undefined ? item.isAvailable : true,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    isVeg: item.foodType === "Veg",
    foodType: item.foodType || "Non-Veg",
    approvalStatus: String(item.approvalStatus || "approved").toLowerCase(),
    rejectionReason: item.rejectionReason || "",
    isRecommended:
      item.isRecommended !== undefined ? Boolean(item.isRecommended) : Boolean(recommendedMap?.[String(item.id)]),
    stockQuantity: item.stock || "Unlimited",
    unit: item.itemSizeUnit || "piece",
    preparationTime: item.preparationTime || "",
    expiryDate: null,
    lastRestocked: null,
  };
}

// Menu sections -> inventory categories, with active stock rules forcing items out of stock.
function convertMenu(sections, stockRules, recommendedMap) {
  const nowMs = Date.now();
  return sections.map((section, sectionIndex) => {
    const allItems = [];
    (Array.isArray(section.items) ? section.items : []).forEach((item) =>
      allItems.push(toInventoryItem(item, section, null, recommendedMap)),
    );
    (Array.isArray(section.subsections) ? section.subsections : []).forEach((subsection) => {
      (Array.isArray(subsection.items) ? subsection.items : []).forEach((item) =>
        allItems.push(toInventoryItem(item, section, subsection, recommendedMap)),
      );
    });
    const items = allItems.map((item) => {
      const rule = stockRules?.[String(item.id)] || null;
      if (!isRuleActive(rule, nowMs)) return item;
      return { ...item, inStock: false, isAvailable: false, stockRule: rule };
    });
    return {
      id: section.id || `category-${sectionIndex}`,
      name: section.name || "Unnamed Category",
      description: section.description || "",
      itemCount: items.length,
      inStock: items.length > 0 ? items.every((i) => i.inStock) : true,
      items,
      order: section.order !== undefined ? section.order : sectionIndex,
    };
  });
}

const addonCreatedMs = (addon = {}) => {
  const fromDates = [addon.requestedAt, addon.createdAt, addon.updatedAt]
    .map((v) => new Date(v).getTime())
    .find((ms) => Number.isFinite(ms) && ms > 0);
  if (fromDates) return fromDates;
  const match = String(addon.id || "").match(/\d{10,}/);
  if (!match) return 0;
  const fromId = Number(match[0]);
  return Number.isFinite(fromId) ? fromId : 0;
};

const isLocalUri = (uri) => typeof uri === "string" && /^(file|content|ph|assets-library):/i.test(uri);

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const shellInset = useShellBottomInset();
  const { width: winW, height: winH } = useWindowDimensions();
  const listRef = useRef(null);

  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("all-items");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [categories, setCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const [togglePopupOpen, setTogglePopupOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [selectedBulkFile, setSelectedBulkFile] = useState(null);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);

  const [selectedOption, setSelectedOption] = useState("specific-time");
  const [hours, setHours] = useState(3);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: "2", minute: "30", period: "pm" });
  const [restaurantProfile, setRestaurantProfile] = useState(null);
  const [stockRules, setStockRules] = useState({});
  const [recommendedMap, setRecommendedMap] = useState({});

  const [addons, setAddons] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [isAddAddonOpen, setIsAddAddonOpen] = useState(false);
  const [editingAddonId, setEditingAddonId] = useState(null);
  const [addonName, setAddonName] = useState("");
  const [addonDescription, setAddonDescription] = useState("");
  const [addonPrice, setAddonPrice] = useState("");
  const [addonImageFile, setAddonImageFile] = useState(null);
  const [addonImagePreview, setAddonImagePreview] = useState("");
  const [savingAddon, setSavingAddon] = useState(false);

  const categoriesRef = useRef(categories);
  const stockRulesRef = useRef(stockRules);
  const recommendedRef = useRef(recommendedMap);
  useEffect(() => {
    categoriesRef.current = categories;
    stockRulesRef.current = stockRules;
    recommendedRef.current = recommendedMap;
  }, [categories, stockRules, recommendedMap]);

  // Restore what the web kept in localStorage before the first fetch (the stock rules decide
  // which fetched items show as out of stock).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [savedTab, savedCategories, savedRules, savedRecommended, savedForm] = await Promise.all([
        store.get(INVENTORY_ACTIVE_TAB_KEY),
        store.get(INVENTORY_STORAGE_KEY),
        store.get(INVENTORY_STOCK_RULES_KEY),
        store.get(INVENTORY_RECOMMENDED_KEY),
        store.get(INVENTORY_ADDON_FORM_KEY),
      ]);
      if (!alive) return;
      if (INVENTORY_TABS.includes(savedTab)) setActiveTab(savedTab);
      if (Array.isArray(savedCategories)) setCategories(savedCategories);
      const rules = savedRules && typeof savedRules === "object" ? savedRules : {};
      const recommended = savedRecommended && typeof savedRecommended === "object" ? savedRecommended : {};
      stockRulesRef.current = rules;
      recommendedRef.current = recommended;
      setStockRules(rules);
      setRecommendedMap(recommended);
      if (savedForm && typeof savedForm === "object") {
        setAddonName(savedForm.name || "");
        setAddonDescription(savedForm.description || "");
        setAddonPrice(savedForm.price || "");
        setEditingAddonId(savedForm.editingAddonId || null);
        if (savedForm.isOpen) setIsAddAddonOpen(true);
        if (savedForm.preview) setAddonImagePreview(savedForm.preview);
      }
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getCurrentRestaurant()
      .then((res) => {
        if (alive) setRestaurantProfile(res?.data?.restaurant || res?.data || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fetchMenuData = useCallback(async () => {
    try {
      setLoadingInventory(true);
      const res = await getMenu();
      const menu = res?.success ? res?.data?.menu : null;
      if (menu) {
        const next = convertMenu(menu.sections || [], stockRulesRef.current, recommendedRef.current);
        setCategories(next);
        setExpandedCategories(next.map((c) => c.id));
      } else {
        setCategories([]);
        setExpandedCategories([]);
      }
    } catch (error) {
      if (!error?.isNetworkError) toast.error("Failed to load menu data");
      setCategories([]);
      setExpandedCategories([]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchAddons = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoadingAddons(true);
      const res = await getAddons();
      const data = res?.data?.addons || [];
      setAddons([...data].sort((a, b) => addonCreatedMs(b) - addonCreatedMs(a)));
    } catch {
      toast.error("Failed to load add-ons");
      setAddons([]);
    } finally {
      if (showLoading) setLoadingAddons(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated) fetchMenuData();
  }, [hydrated, fetchMenuData]);

  useEffect(() => {
    if (hydrated && activeTab === "add-ons") fetchAddons(true);
  }, [hydrated, activeTab, fetchAddons]);

  // The web remounts Inventory (and refetches) whenever the owner comes back to it, e.g. after
  // saving an item; the tab stays mounted here, so refetch when it regains focus.
  const focusedOnce = useRef(false);
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      fetchMenuData();
      if (activeTabRef.current === "add-ons") fetchAddons(false);
    }, [fetchMenuData, fetchAddons]),
  );

  // Persistence (web localStorage).
  useEffect(() => {
    if (hydrated) store.set(INVENTORY_ACTIVE_TAB_KEY, activeTab);
  }, [hydrated, activeTab]);
  useEffect(() => {
    if (hydrated) store.set(INVENTORY_STORAGE_KEY, categories);
  }, [hydrated, categories]);
  useEffect(() => {
    if (hydrated) store.set(INVENTORY_STOCK_RULES_KEY, stockRules);
  }, [hydrated, stockRules]);
  useEffect(() => {
    if (!hydrated) return;
    store.set(INVENTORY_ADDON_FORM_KEY, {
      name: addonName,
      description: addonDescription,
      price: addonPrice,
      preview: isLocalUri(addonImagePreview) ? "" : addonImagePreview,
      isOpen: isAddAddonOpen,
      editingAddonId,
    });
  }, [hydrated, addonName, addonDescription, addonPrice, addonImagePreview, isAddAddonOpen, editingAddonId]);

  // Out-of-stock timers: every 15 s, items whose resume time passed go back in stock.
  useEffect(() => {
    if (!stockRules || Object.keys(stockRules).length === 0) return undefined;
    const runExpiryCheck = async () => {
      const expired = expiredRuleIds(stockRulesRef.current);
      if (expired.length === 0) return;
      const known = new Set(categoriesRef.current.flatMap((c) => (c.items || []).map((i) => String(i.id))));
      setCategories((prev) =>
        prev.map((category) => {
          let changed = false;
          const items = (category.items || []).map((item) => {
            if (!expired.includes(String(item.id))) return item;
            changed = true;
            return { ...item, inStock: true, isAvailable: true, stockRule: null };
          });
          if (!changed) return category;
          return { ...category, items, inStock: items.every((i) => i.inStock) };
        }),
      );
      setStockRules((prev) => {
        const next = { ...prev };
        expired.forEach((id) => delete next[id]);
        return next;
      });
      await Promise.all(
        expired.filter((id) => known.has(id)).map((id) => setFoodAvailability(id, true).catch(() => {})),
      );
    };
    runExpiryCheck();
    const intervalId = setInterval(runExpiryCheck, 15000);
    return () => clearInterval(intervalId);
  }, [stockRules]);

  // Filter "Apply" shows the web's 1.5 s loading overlay.
  const applyTimer = useRef(null);
  useEffect(() => () => clearTimeout(applyTimer.current), []);

  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + (cat.itemCount || cat.items?.length || 0), 0),
    [categories],
  );
  const activeFilterOptions = activeTab === "add-ons" ? ADDON_FILTER_OPTIONS : MENU_FILTER_OPTIONS;

  if (!activeFilterOptions.some((option) => option.value === selectedFilter)) {
    setSelectedFilter("all");
  }

  const menuFilterCounts = useMemo(
    () =>
      MENU_FILTER_OPTIONS.reduce((acc, option) => {
        acc[option.value] = categories.reduce(
          (sum, category) => sum + filterMenuItems(category.items || [], option.value).length,
          0,
        );
        return acc;
      }, {}),
    [categories],
  );

  const addonFilterCounts = useMemo(
    () =>
      ADDON_FILTER_OPTIONS.reduce((acc, option) => {
        acc[option.value] = filterAddonsList(addons, option.value).length;
        return acc;
      }, {}),
    [addons],
  );

  const filteredCategories = useMemo(() => {
    const byStatus = categories
      .map((category) => {
        const items = filterMenuItems(category.items || [], selectedFilter);
        if (items.length === 0) return null;
        return { ...category, items, itemCount: items.length, inStock: items.every((i) => i.inStock) };
      })
      .filter(Boolean);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus
      .map((category) => {
        const items = category.items || [];
        const matchesCategory =
          category.name?.toLowerCase().includes(q) || (category.description || "").toLowerCase().includes(q);
        const matching = items.filter((item) => item.name?.toLowerCase().includes(q));
        if (!matchesCategory && matching.length === 0) return null;
        const shown = matching.length > 0 ? matching : items;
        return { ...category, items: shown, itemCount: shown.length, inStock: shown.every((i) => i.inStock) };
      })
      .filter(Boolean);
  }, [categories, selectedFilter, searchQuery]);

  const filteredAddons = useMemo(() => {
    const byFilter = filterAddonsList(addons, selectedFilter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter((addon) => {
      const status = String(addon?.approvalStatus || "").toLowerCase();
      return (
        String(addon?.name || "").toLowerCase().includes(q) ||
        String(addon?.description || "").toLowerCase().includes(q) ||
        status.includes(q)
      );
    });
  }, [addons, searchQuery, selectedFilter]);

  const listToRender = useMemo(() => (activeTab === "add-ons" ? [] : filteredCategories), [activeTab, filteredCategories]);
  const activeFilterCount =
    activeTab === "add-ons" ? addonFilterCounts[selectedFilter] || 0 : menuFilterCounts[selectedFilter] || 0;
  const hasActiveTools = searchQuery.trim().length > 0 || selectedFilter !== "all";

  // ----- stock toggles -----
  const updateAvailabilityAPI = async (categoryId, itemId, isAvailable) => {
    try {
      if (!categoryId) return;
      if (itemId) {
        await setFoodAvailability(itemId, isAvailable);
        return;
      }
      const category = categoriesRef.current.find((c) => c.id === categoryId);
      await Promise.all((category?.items || []).map((it) => setFoodAvailability(it.id, isAvailable)));
    } catch (error) {
      toast.error(error?.message || "Failed to update availability");
    }
  };

  const getTargetItemIds = (type, categoryId, itemId) => {
    const category = categoriesRef.current.find((entry) => entry.id === categoryId);
    const items = Array.isArray(category?.items) ? category.items : [];
    if (type === "category") return items.map((item) => String(item.id)).filter(Boolean);
    return itemId ? [String(itemId)] : [];
  };

  const applyStock = (type, categoryId, itemId, inStock, rule) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        const items = category.items || [];
        const patch = { inStock, isAvailable: inStock, stockRule: rule };
        if (type === "category") {
          return { ...category, inStock, items: items.map((item) => ({ ...item, ...patch })) };
        }
        // The category toggle stays independent of item toggles, as on web.
        return { ...category, items: items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) };
      }),
    );
  };

  const handleToggleChange = async (type, categoryId, itemId, nextChecked) => {
    if (nextChecked) {
      const targetIds = getTargetItemIds(type, categoryId, itemId);
      applyStock(type, categoryId, itemId, true, null);
      setStockRules((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => delete next[id]);
        return next;
      });
      await updateAvailabilityAPI(categoryId, type === "category" ? null : itemId, true);
      return;
    }
    setToggleTarget({ type, categoryId, itemId });
    setSelectedOption("specific-time");
    setHours(3);
    setSelectedDate(null);
    setSelectedTime({ hour: "2", minute: "30", period: "pm" });
    setTogglePopupOpen(true);
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) {
      setTogglePopupOpen(false);
      return;
    }
    const { type, categoryId, itemId } = toggleTarget;
    const targetIds = getTargetItemIds(type, categoryId, itemId);
    const nextRule = buildStockRule({ selectedOption, hours, selectedDate, selectedTime, restaurantProfile });

    if (selectedOption === "custom-date-time") {
      if (!nextRule.resumeAt) {
        toast.error("Please select a valid custom date and time");
        return;
      }
      if (new Date(nextRule.resumeAt).getTime() <= Date.now()) {
        toast.error("Custom date & time must be in the future");
        return;
      }
    }

    applyStock(type, categoryId, itemId, false, nextRule);
    setStockRules((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = nextRule;
      });
      return next;
    });
    await updateAvailabilityAPI(categoryId, type === "category" ? null : itemId, false);
    setTogglePopupOpen(false);
    setToggleTarget(null);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const handleRecommendToggle = async (categoryId, itemId) => {
    const category = categoriesRef.current.find((cat) => cat.id === categoryId);
    const item = category?.items.find((i) => i.id === itemId);
    const next = !item?.isRecommended;
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id !== categoryId
          ? cat
          : { ...cat, items: cat.items.map((i) => (i.id === itemId ? { ...i, isRecommended: next } : i)) },
      ),
    );
    try {
      if (itemId) await setFoodRecommended(itemId, next);
      const map = { ...(recommendedRef.current || {}), [String(itemId)]: Boolean(next) };
      recommendedRef.current = map;
      setRecommendedMap(map);
      store.set(INVENTORY_RECOMMENDED_KEY, map);
    } catch {
      // The web ignores a failed recommend save.
    }
  };

  const handleDeleteFoodItem = async (foodId) => {
    if (!(await confirmAsync("Are you sure you want to delete this item?"))) return;
    try {
      setIsLoading(true);
      await deleteFood(foodId);
      toast.success("Food item deleted successfully");
      await fetchMenuData();
    } catch (err) {
      const serverMessage = err?.data?.error || err?.data?.message;
      if (serverMessage === "Food item not found or unauthorized") {
        toast.success("Item is already deleted. Refreshing list...");
        await fetchMenuData();
      } else {
        toast.error(serverMessage || err?.message || "Failed to delete item");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditItem = (category, item) => {
    if (!item?.id) return;
    const categoryId = category?.id || category?.categoryId || "";
    setItemHandoff(item.id, {
      item: { ...item, category: category?.name || "", categoryId, isAvailable: item.inStock },
      category: category?.name || "",
      categoryId,
      groupId: categoryId,
    });
    router.push({
      pathname: "/hub-menu/item/[id]",
      params: { id: item.id, backTo: "/inventory", category: category?.name || "", categoryId },
    });
  };

  // ----- filters -----
  const handleFilterApply = () => {
    setIsLoading(true);
    setFilterOpen(false);
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => setIsLoading(false), 1500);
  };

  const handleFilterClear = () => {
    setSelectedFilter("all");
    setFilterOpen(false);
  };

  // ----- add-ons -----
  const resetAddonForm = () => {
    setAddonName("");
    setAddonDescription("");
    setAddonPrice("");
    setAddonImageFile(null);
    setAddonImagePreview("");
    setEditingAddonId(null);
    setIsAddAddonOpen(false);
    store.remove(INVENTORY_ADDON_FORM_KEY);
  };

  const handleAddonImageSelect = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mime = String(asset.mimeType || "image/jpeg").toLowerCase();
      if (!ADDON_IMAGE_TYPES.includes(mime)) {
        toast.error("Invalid image type. Please use PNG, JPG, JPEG, WEBP, HEIC, or HEIF.");
        return;
      }
      if (Number(asset.fileSize || 0) > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB.");
        return;
      }
      setAddonImageFile(asset);
      setAddonImagePreview(asset.uri);
    } catch {
      toast.error("Failed to open gallery");
    }
  };

  const handleSaveAddon = async () => {
    if (!addonName.trim()) {
      toast.error("Please enter add-on name");
      return;
    }
    const parsedPrice = parseFloat(addonPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setSavingAddon(true);
    try {
      let imageUrl = addonImagePreview && !isLocalUri(addonImagePreview) ? addonImagePreview : "";
      if (addonImageFile) {
        const validationError = getImageValidationError({ mimeType: "image/jpeg", ...addonImageFile });
        if (validationError) {
          toast.error(validationError);
          setSavingAddon(false);
          return;
        }
        const uploadRes = await uploadMedia(addonImageFile, { folder: "tuggo/restaurant/addons" });
        imageUrl = uploadRes?.data?.url || "";
      }
      const payload = {
        name: addonName.trim(),
        description: addonDescription.trim(),
        price: parsedPrice,
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
      };
      if (editingAddonId) {
        await updateAddon(editingAddonId, { draft: payload });
        toast.success("Add-on updated and submitted for approval");
      } else {
        await addAddon(payload);
        toast.success("Add-on submitted to admin for approval");
      }
      resetAddonForm();
      fetchAddons(true);
    } catch (error) {
      toast.error(getUploadErrorMessage(error, { fallback: error?.message || "Failed to save add-on" }));
    } finally {
      setSavingAddon(false);
    }
  };

  const handleEditAddon = (addon) => {
    setAddonName(addon.name || "");
    setAddonDescription(addon.description || "");
    setAddonPrice(addon.price != null ? String(addon.price) : "");
    setEditingAddonId(addon.id);
    setAddonImagePreview((addon.images && addon.images[0]) || addon.image || "");
    setAddonImageFile(null);
    setIsAddAddonOpen(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleDeleteAddon = async (addonId) => {
    if (!(await confirmAsync("Are you sure you want to delete this add-on?"))) return;
    try {
      await deleteAddon(addonId);
      toast.success("Add-on deleted successfully");
      fetchAddons(false);
    } catch {
      toast.error("Failed to delete add-on");
    }
  };

  const handleAddonToggle = async (addonId, isAvailable) => {
    try {
      await setAddonAvailability(addonId, isAvailable);
      setAddons((prev) => prev.map((a) => (a.id === addonId ? { ...a, isAvailable } : a)));
      toast.success(`Add-on ${isAvailable ? "enabled" : "disabled"} successfully`);
    } catch {
      toast.error("Failed to update add-on availability");
    }
  };

  // ----- add item / bulk upload -----
  const closeAddPopup = () => {
    setIsAddPopupOpen(false);
    setShowBulkUpload(false);
  };

  const downloadTemplate = async () => {
    try {
      setIsUploadingBulk(true);
      const uri = await writeInventoryTemplate();
      await Sharing.shareAsync(uri, {
        mimeType: EXCEL_TYPES[0],
        dialogTitle: "cityfood_inventory_template.xlsx",
      });
    } catch (err) {
      toast.error(
        err?.message === EXCEL_UNAVAILABLE
          ? EXCEL_UNAVAILABLE
          : "Failed to generate Excel template. Please check your internet connection.",
      );
    } finally {
      setIsUploadingBulk(false);
    }
  };

  const pickBulkFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: EXCEL_TYPES, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      setSelectedBulkFile(result.assets[0]);
    } catch {
      toast.error("Could not open the file picker");
    }
  };

  const handleBulkSubmit = async () => {
    if (!selectedBulkFile) {
      toast.error("Please select an Excel file first");
      return;
    }
    setIsUploadingBulk(true);
    try {
      let rows;
      try {
        rows = await parseInventoryExcel(selectedBulkFile.uri);
      } catch (err) {
        toast.error(err?.message === EXCEL_UNAVAILABLE ? EXCEL_UNAVAILABLE : "Error parsing file. Ensure it's a valid Excel file.");
        return;
      }
      if (!Array.isArray(rows) || rows.length < 2) {
        toast.error("File is empty or missing headers");
        return;
      }
      const items = rowsToInventoryItems(rows);
      if (items.length === 0) {
        toast.error("No valid items found in the file");
        return;
      }
      const res = await bulkCreateFood(items);
      const results = res?.data;
      if (res?.success) {
        setBulkUploadResult({
          successCount: results?.successCount || 0,
          errorCount: results?.errorCount || 0,
          errors: results?.errors || [],
          total: items.length,
        });
        setSelectedBulkFile(null);
        await fetchMenuData();
      } else {
        toast.error(res?.message || "Failed to upload bulk items");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to upload bulk items");
    } finally {
      setIsUploadingBulk(false);
    }
  };

  // ----- swipe between the two tabs (not from the tab buttons or the chip row) -----
  const swipe = useRef({ x: 0, y: 0, endX: 0, swiping: false, ignore: false, transitioning: false });
  const swipeTimers = useRef([]);
  useEffect(() => () => swipeTimers.current.forEach(clearTimeout), []);
  const markNoSwipe = () => {
    swipe.current.ignore = true;
  };
  const onTouchStart = (e) => {
    const s = swipe.current;
    if (s.ignore) return;
    s.x = e.nativeEvent.pageX;
    s.y = e.nativeEvent.pageY;
    s.endX = s.x;
    s.swiping = false;
  };
  const onTouchMove = (e) => {
    const s = swipe.current;
    if (s.ignore) return;
    const { pageX, pageY } = e.nativeEvent;
    if (!s.swiping) {
      const dx = Math.abs(pageX - s.x);
      const dy = Math.abs(pageY - s.y);
      if (dx > dy && dx > 10) s.swiping = true;
    }
    if (s.swiping) s.endX = pageX;
  };
  const onTouchEnd = () => {
    const s = swipe.current;
    if (s.ignore || !s.swiping) {
      s.ignore = false;
      s.swiping = false;
      return;
    }
    const distance = s.x - s.endX;
    s.swiping = false;
    if (Math.abs(distance) > 50 && !s.transitioning) {
      const current = INVENTORY_TABS.indexOf(activeTab);
      let next = current;
      if (distance > 0 && current < INVENTORY_TABS.length - 1) next = current + 1;
      else if (distance < 0 && current > 0) next = current - 1;
      if (next !== current) {
        s.transitioning = true;
        swipeTimers.current.push(
          setTimeout(() => {
            setActiveTab(INVENTORY_TABS[next]);
            swipeTimers.current.push(
              setTimeout(() => {
                s.transitioning = false;
              }, 300),
            );
          }, 50),
        );
      }
    }
  };

  // ----- jump to category -----
  const toolsHeight = useRef(0);
  const rows = useMemo(() => {
    const list = [{ key: "tabs", type: "tabs" }, { key: "tools", type: "tools" }];
    if (activeTab === "add-ons") {
      if (isAddAddonOpen) list.push({ key: "addon-form", type: "addonForm" });
      if (loadingAddons) list.push({ key: "addons-loading", type: "addonsLoading" });
      else if (filteredAddons.length === 0) list.push({ key: "addons-empty", type: "addonsEmpty" });
      else filteredAddons.forEach((addon) => list.push({ key: `addon-${addon.id}`, type: "addon", addon }));
    } else {
      if (!loadingInventory && listToRender.length === 0) list.push({ key: "menu-empty", type: "menuEmpty" });
      listToRender.forEach((category) => list.push({ key: `cat-${category.id}`, type: "category", category }));
    }
    return list;
  }, [activeTab, isAddAddonOpen, loadingAddons, filteredAddons, loadingInventory, listToRender]);

  const scrollToCategory = (categoryId) => {
    const index = rows.findIndex((r) => r.type === "category" && r.category.id === categoryId);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, viewOffset: toolsHeight.current, animated: true });
  };

  const jumpTimer = useRef(null);
  useEffect(() => () => clearTimeout(jumpTimer.current), []);

  useBackOverride(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return true;
    }
    return false;
  });

  const summary =
    activeTab === "add-ons"
      ? `${filteredAddons.length} add-on${filteredAddons.length !== 1 ? "s" : ""} in this view`
      : `${listToRender.length} categor${listToRender.length !== 1 ? "ies" : "y"} and ${activeFilterCount} item${activeFilterCount !== 1 ? "s" : ""} in focus`;

  const renderRow = ({ item: row }) => {
    switch (row.type) {
      case "tabs":
        return (
          <View onTouchStart={markNoSwipe}>
            <InventoryTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              totalItems={totalItems}
              addonCount={addons.length}
            />
          </View>
        );
      case "tools":
        return (
          <View
            onLayout={(e) => {
              toolsHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <SearchToolsCard
              activeTab={activeTab}
              summary={summary}
              hasActiveTools={hasActiveTools}
              onClearAll={() => {
                setSearchQuery("");
                setSelectedFilter("all");
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedFilter={selectedFilter}
              onOpenFilter={() => setFilterOpen(true)}
              onAddItem={() => setIsAddPopupOpen(true)}
              isAddAddonOpen={isAddAddonOpen}
              onToggleAddon={() => setIsAddAddonOpen((v) => !v)}
              filterOptions={activeFilterOptions}
              filterCounts={activeTab === "add-ons" ? addonFilterCounts : menuFilterCounts}
              onSelectFilter={setSelectedFilter}
              onChipsTouch={markNoSwipe}
            />
          </View>
        );
      case "addonForm":
        return (
          <View style={styles.rowPad}>
            <AddonForm
              name={addonName}
              setName={setAddonName}
              description={addonDescription}
              setDescription={setAddonDescription}
              price={addonPrice}
              setPrice={setAddonPrice}
              preview={addonImagePreview}
              file={addonImageFile}
              onPickImage={handleAddonImageSelect}
              onCancel={resetAddonForm}
              onSave={handleSaveAddon}
              saving={savingAddon}
            />
          </View>
        );
      case "addonsLoading":
        return (
          <View style={styles.addonsLoading}>
            <ActivityIndicator size="large" color={pal.slate400} />
          </View>
        );
      case "addonsEmpty":
        return (
          <View style={styles.rowPad}>
            <View style={[styles.emptyCard, { paddingVertical: 80 }]}>
              <Text style={styles.emptyTitle}>{hasActiveTools ? "No matching add-ons found" : "No add-ons available"}</Text>
              <Text style={styles.emptySub}>
                {hasActiveTools ? "Try changing your search or filters" : "All add-ons will appear here"}
              </Text>
            </View>
          </View>
        );
      case "addon":
        return (
          <View style={styles.rowPad}>
            <AddonCard addon={row.addon} onEdit={handleEditAddon} onDelete={handleDeleteAddon} onToggle={handleAddonToggle} />
          </View>
        );
      case "menuEmpty":
        return (
          <View style={styles.rowPad}>
            <View style={[styles.emptyCard, { paddingVertical: 64, paddingHorizontal: 24 }]}>
              <Text style={styles.emptyTitle}>
                {hasActiveTools ? "No matching categories or items found" : "No menu categories available"}
              </Text>
              <Text style={styles.emptySub}>
                {hasActiveTools
                  ? "Try adjusting your search or filters."
                  : "Your menu categories will appear here once items are added."}
              </Text>
            </View>
          </View>
        );
      case "category":
        return (
          <View style={styles.rowPad}>
            <CategoryCard
              category={row.category}
              expanded={expandedCategories.includes(row.category.id)}
              onToggleExpand={toggleCategory}
              onToggle={handleToggleChange}
              busy={isLoading}
              onEdit={handleEditItem}
              onDelete={handleDeleteFoodItem}
              onRecommend={handleRecommendToggle}
            />
          </View>
        );
      default:
        return null;
    }
  };

  const toggleCategoryData =
    toggleTarget?.type === "category" ? categories.find((c) => c.id === toggleTarget.categoryId) : null;
  const jumpBottom = 96 + insets.bottom;

  return (
    <View style={styles.page}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: shellInset + 128 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * index - toolsHeight.current), animated: true });
          clearTimeout(jumpTimer.current);
          jumpTimer.current = setTimeout(() => {
            listRef.current?.scrollToIndex({ index, viewOffset: toolsHeight.current, animated: true });
          }, 250);
        }}
        initialNumToRender={8}
        windowSize={11}
      />
      {activeTab !== "add-ons" ? (
        <JumpMenu
          open={isMenuOpen}
          onToggle={() => setIsMenuOpen((v) => !v)}
          onClose={() => setIsMenuOpen(false)}
          categories={categories}
          bottom={jumpBottom}
          popupWidth={Math.min(winW * 0.6, 384)}
          popupHeight={winH * 0.45}
          onJump={(categoryId) => {
            setIsMenuOpen(false);
            clearTimeout(jumpTimer.current);
            jumpTimer.current = setTimeout(() => scrollToCategory(categoryId), 200);
          }}
        />
      ) : null}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        options={activeFilterOptions}
        counts={activeTab === "add-ons" ? addonFilterCounts : menuFilterCounts}
        selectedFilter={selectedFilter}
        onSelect={setSelectedFilter}
        onClear={handleFilterClear}
        onApply={handleFilterApply}
      />

      <StockOffSheet
        open={togglePopupOpen}
        target={toggleTarget}
        category={toggleCategoryData}
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
        hours={hours}
        setHours={setHours}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        onClose={() => setTogglePopupOpen(false)}
        onConfirm={handleToggleConfirm}
      />

      <AddItemSheet
        open={isAddPopupOpen}
        showBulkUpload={showBulkUpload}
        onClose={closeAddPopup}
        onAddSingle={() => {
          setIsAddPopupOpen(false);
          router.push({ pathname: "/hub-menu/item/[id]", params: { id: "new", backTo: "/inventory" } });
        }}
        onShowBulk={() => setShowBulkUpload(true)}
        onHideBulk={() => setShowBulkUpload(false)}
        onDownloadTemplate={downloadTemplate}
        selectedBulkFile={selectedBulkFile}
        onPickFile={pickBulkFile}
        onSubmit={handleBulkSubmit}
        isUploadingBulk={isUploadingBulk}
      />

      <BulkResultDialog
        result={bulkUploadResult}
        onClose={() => setBulkUploadResult(null)}
        onDone={() => {
          setBulkUploadResult(null);
          closeAddPopup();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: pal.pageBg },
  rowPad: { paddingHorizontal: 16, marginBottom: 16 },
  addonsLoading: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: pal.slate200,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 16,
    alignItems: "center",
    boxShadow: "0px 18px 40px -34px rgba(15,23,42,0.35)",
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: pal.slate700, textAlign: "center" },
  emptySub: { marginTop: 8, fontSize: 14, color: pal.slate500, textAlign: "center" },
});
