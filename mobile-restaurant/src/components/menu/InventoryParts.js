// Presentational pieces of Inventory.jsx: tab buttons, the search/filter card, a category
// accordion with its item cards, the add-on form and card, the filter popup and the floating
// "Jump to category" menu.
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
  SlidersHorizontal,
  ThumbsUp,
  Trash2,
  Upload,
  Utensils,
  X,
} from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AppImage, inputFont, ScalePressable, Text } from "../ui";
import { brand } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeContext";
import { CenterSheet, MenuSwitch } from "./common";
import { mixHex, pal } from "./palette";
import { getRuleStatusLabel } from "./stockRules";

const bentoBorder = mixHex(brand.rtBorder, "#ffffff", 0.65);

const APPROVAL_META = {
  rejected: { label: "Rejected", fg: pal.red700, border: pal.red200 },
  pending: { label: "Pending", fg: pal.amber700, border: pal.amber200 },
  approved: { label: "Approved", fg: pal.emerald700, border: pal.emerald200 },
};

const approvalMeta = (status) => {
  const s = String(status || "approved").toLowerCase();
  return APPROVAL_META[s] || APPROVAL_META.approved;
};

export function InventoryTabs({ activeTab, onChange, totalItems, addonCount }) {
  const { colors } = useTheme();
  const tab = (id, label, count) => {
    const active = activeTab === id;
    return (
      <Pressable
        key={id}
        onPress={() => onChange(id)}
        style={[
          styles.tab,
          active
            ? { borderColor: colors.primaryBorder, backgroundColor: colors.primary, transform: [{ scale: 1.02 }], boxShadow: "0px 18px 32px -24px rgba(126,56,102,0.6)" }
            : { borderColor: pal.plumBorder, backgroundColor: "rgba(255,255,255,0.9)", boxShadow: "0px 16px 40px -34px rgba(109,100,112,0.35)" },
        ]}
      >
        <Text style={[styles.tabLabel, { color: active ? "#ffffff" : brand.muted }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.tabCount, { backgroundColor: active ? "#ffffff" : pal.plumChip }]}>
          <Text style={[styles.tabCountText, { color: active ? colors.primary : brand.muted }]}>{count}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={styles.tabsRow}>
      {tab("all-items", "All items", totalItems)}
      {tab("add-ons", "Add ons", addonCount)}
    </View>
  );
}

export function SearchToolsCard({
  activeTab,
  summary,
  hasActiveTools,
  onClearAll,
  searchQuery,
  onSearchChange,
  selectedFilter,
  onOpenFilter,
  onAddItem,
  isAddAddonOpen,
  onToggleAddon,
  filterOptions,
  filterCounts,
  onSelectFilter,
  onChipsTouch,
}) {
  const { colors } = useTheme();
  const clearColor = mixHex(colors.primaryStrong, brand.muted, 0.4);
  return (
    <View style={styles.toolsWrap}>
      <View style={styles.toolsCard}>
        <View style={styles.toolsHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolsTitle}>
              {activeTab === "add-ons" ? "Search and review add-ons" : "Search and manage menu inventory"}
            </Text>
            <Text style={styles.toolsSub}>{summary}</Text>
          </View>
          {hasActiveTools ? (
            <Pressable onPress={onClearAll} style={[styles.clearAll, { borderColor: colors.primaryTint15 }]}>
              <Text style={[styles.clearAllText, { color: clearColor }]}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={pal.slate400} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={activeTab === "add-ons" ? "Search add-ons by name or status" : "Search categories or menu items"}
            placeholderTextColor={pal.slate400}
            selectionColor={colors.primary}
            style={[styles.searchInput, inputFont, { borderColor: colors.primaryTint15, backgroundColor: colors.primaryTint3 }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => onSearchChange("")} style={styles.searchClear} hitSlop={6} accessibilityLabel="Clear search">
              <X size={16} color={pal.slate400} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.toolsButtons}>
          <Pressable onPress={onOpenFilter} style={[styles.filterBtn, { borderColor: colors.primaryTint15 }]}>
            <SlidersHorizontal size={16} color={colors.primary} />
            <Text style={[styles.filterBtnText, { color: colors.primaryStrong }]}>Filters</Text>
            {selectedFilter !== "all" ? <View style={[styles.filterDot, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
          {activeTab !== "add-ons" ? (
            <Pressable onPress={onAddItem} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.primaryBtnText}>+ Add item</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onToggleAddon} style={[styles.primaryBtn, { backgroundColor: colors.primary, minWidth: 128 }]}>
              <Text style={styles.primaryBtnText}>{isAddAddonOpen ? "Close" : "Add Add-on"}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          onTouchStart={onChipsTouch}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {filterOptions.map((option) => {
            const isActive = selectedFilter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelectFilter(option.value)}
                style={[
                  styles.chip,
                  isActive
                    ? { borderColor: colors.primaryBorder, backgroundColor: colors.primary }
                    : { borderColor: colors.primaryTint15, backgroundColor: colors.primaryTint3 },
                ]}
              >
                <Text style={[styles.chipText, { color: isActive ? "#ffffff" : brand.muted }]}>{option.label}</Text>
                <View style={[styles.chipCount, { backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#ffffff" }]}>
                  <Text style={[styles.chipCountText, { color: isActive ? "#ffffff" : pal.plumCount }]}>
                    {filterCounts[option.value] || 0}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function ItemCard({ category, item, onEdit, onDelete, onRecommend, onToggle }) {
  const meta = approvalMeta(item.approvalStatus);
  const isRejected = item.approvalStatus === "rejected";
  const vegColor = item.isVeg ? pal.green600 : pal.red600;
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemMain}>
        {item.image ? (
          <View style={styles.itemImageWrap}>
            <AppImage src={item.image} width={64} style={styles.itemImage} placeholderType="food" />
          </View>
        ) : null}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemChips}>
            <View style={[styles.itemChip, { borderColor: item.isVeg ? pal.green100 : pal.red100 }]}>
              <View style={[styles.vegBox, { borderColor: vegColor }]}>
                <View style={[styles.vegDot, { backgroundColor: vegColor }]} />
              </View>
              <Text style={[styles.itemChipText, { color: vegColor }]}>{item.isVeg ? "Veg" : "Non-veg"}</Text>
            </View>
            <View style={[styles.itemChip, { borderColor: meta.border }]}>
              <Text style={[styles.itemChipText, { color: meta.fg }]}>{meta.label}</Text>
            </View>
          </View>
          <View style={styles.itemActions}>
            <Text style={[styles.itemStatus, { color: item.inStock ? pal.green500 : pal.rose500 }]} numberOfLines={2}>
              {item.inStock ? "● Live" : `● ${getRuleStatusLabel(item.stockRule)}`}
            </Text>
            <Pressable
              onPress={() => onEdit(category, item)}
              style={[styles.smallBtn, { backgroundColor: isRejected ? pal.red600 : pal.slate100 }]}
            >
              <Pencil size={12} color={isRejected ? "#ffffff" : pal.slate800} />
              <Text style={[styles.smallBtnText, { color: isRejected ? "#ffffff" : pal.slate800 }]}>
                {isRejected ? "Fix" : "Edit"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onDelete(item.id || item._id)}
              style={[styles.smallBtn, { backgroundColor: pal.rose50 }]}
              accessibilityLabel="Delete Item"
            >
              <Trash2 size={12} color={pal.rose600} />
            </Pressable>
          </View>
          {item.approvalStatus === "rejected" && item.rejectionReason ? (
            <Text style={styles.itemReason}>{item.rejectionReason}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.itemSide}>
        <Pressable
          onPress={() => onRecommend(category.id, item.id)}
          style={[
            styles.thumbBtn,
            item.isRecommended
              ? { backgroundColor: pal.blue600, borderColor: pal.blue600, transform: [{ rotate: "12deg" }, { scale: 1.1 }] }
              : { backgroundColor: "#ffffff", borderColor: pal.slate100 },
          ]}
        >
          <ThumbsUp size={16} color={item.isRecommended ? "#ffffff" : pal.slate300} />
        </Pressable>
        <MenuSwitch value={item.inStock} scale={0.9} onValueChange={(checked) => onToggle("item", category.id, item.id, checked)} />
      </View>
    </View>
  );
}

export function CategoryCard({ category, expanded, onToggleExpand, onToggle, busy, ...itemHandlers }) {
  const items = category.items || [];
  const outCount = items.filter((i) => !i.inStock).length;
  const recommended = items.filter((i) => i.isRecommended).length;
  return (
    <View style={[styles.catCard, busy && { opacity: 0.6 }]}>
      <Pressable onPress={() => onToggleExpand(category.id)} style={styles.catHeader}>
        <View style={styles.catHeadInfo}>
          <View style={styles.catTitleRow}>
            <Text style={styles.catName}>{category.name}</Text>
            <View style={styles.catChips}>
              <View style={[styles.catChip, { backgroundColor: pal.slate100 }]}>
                <Text style={[styles.catChipText, { color: pal.slate500 }]}>
                  {category.items?.length || category.itemCount || 0} items
                </Text>
              </View>
              <View
                style={[
                  styles.catChip,
                  { borderWidth: 1 },
                  category.inStock
                    ? { backgroundColor: pal.green50, borderColor: pal.green100 }
                    : { backgroundColor: pal.amber50, borderColor: pal.amber100 },
                ]}
              >
                <Text style={[styles.catChipText, { color: category.inStock ? pal.green700 : pal.amber700 }]}>
                  {category.inStock ? "Healthy" : "Needs attention"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.catStats}>
            {category.inStock ? (
              <View style={[styles.statPill, { backgroundColor: "rgba(240,253,244,0.5)", borderColor: "rgba(220,252,231,0.5)" }]}>
                <View style={[styles.statDot, { backgroundColor: pal.green500 }]} />
                <Text style={[styles.statText, { color: pal.green700 }]}>All items live</Text>
              </View>
            ) : (
              <View style={[styles.statPill, { backgroundColor: "rgba(255,241,242,0.5)", borderColor: "rgba(255,228,230,0.5)" }]}>
                <View style={[styles.statDot, { backgroundColor: pal.rose500 }]} />
                <Text style={[styles.statText, { color: pal.rose700 }]}>{outCount} Items paused</Text>
              </View>
            )}
            <View style={[styles.statPill, { backgroundColor: "rgba(239,246,255,0.5)", borderColor: "rgba(219,234,254,0.5)" }]}>
              <Text style={[styles.statText, { color: pal.blue700 }]}>{recommended} Recommended</Text>
            </View>
          </View>
        </View>
        <View style={styles.catControls}>
          <MenuSwitch value={category.inStock} scale={1.1} onValueChange={(checked) => onToggle("category", category.id, null, checked)} />
          <Pressable
            onPress={() => onToggleExpand(category.id)}
            style={[
              styles.expandBtn,
              expanded ? { backgroundColor: pal.slate900, borderColor: pal.slate900 } : { backgroundColor: "#ffffff", borderColor: pal.slate200 },
            ]}
          >
            {expanded ? <ChevronUp size={20} color="#ffffff" /> : <ChevronDown size={20} color={pal.slate600} />}
          </Pressable>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.catItems}>
          {items.map((item) => (
            <ItemCard key={item.id} category={category} item={item} onToggle={onToggle} {...itemHandlers} />
          ))}
        </View>
      ) : null}
      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="small" color={pal.slate400} />
        </View>
      ) : null}
    </View>
  );
}

export function AddonCard({ addon, onEdit, onDelete, onToggle }) {
  const available = addon.isAvailable !== false;
  const image = Array.isArray(addon.images) && addon.images[0] ? addon.images[0] : null;
  return (
    <View style={[styles.bento, styles.addonCard]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.addonTitleRow}>
          <Text style={styles.addonName}>{addon.name}</Text>
          <View style={[styles.pill, { backgroundColor: available ? pal.emerald50 : pal.slate100 }]}>
            <Text style={[styles.pillText, { color: available ? pal.emerald700 : pal.slate600 }]}>{available ? "Live" : "Paused"}</Text>
          </View>
          {addon.approvalStatus === "approved" ? (
            <View style={[styles.pill, { backgroundColor: pal.green100 }]}>
              <Text style={[styles.pillText, { color: pal.green800 }]}>Approved</Text>
            </View>
          ) : null}
          {addon.approvalStatus === "pending" ? (
            <View style={[styles.pill, { backgroundColor: pal.yellow100 }]}>
              <Text style={[styles.pillText, { color: pal.yellow800 }]}>Pending</Text>
            </View>
          ) : null}
          {addon.approvalStatus === "rejected" ? (
            <View style={[styles.pill, { backgroundColor: pal.red100 }]}>
              <Text style={[styles.pillText, { color: pal.red800 }]}>Rejected</Text>
            </View>
          ) : null}
        </View>
        {addon.description ? <Text style={styles.addonDesc}>{addon.description}</Text> : null}
        <Text style={styles.addonPrice}>Rs. {addon.price}</Text>
        {addon.approvalStatus === "rejected" && addon.rejectionReason ? (
          <Text style={styles.addonReason}>Reason: {addon.rejectionReason}</Text>
        ) : null}
      </View>
      <View style={styles.addonSide}>
        {image ? <AppImage src={image} width={80} style={styles.addonImage} placeholderType="food" /> : null}
        <View style={styles.addonButtons}>
          <Pressable onPress={() => onEdit(addon)} style={styles.iconBtn} accessibilityLabel="Edit add-on">
            <Pencil size={16} color={pal.slate500} />
          </Pressable>
          <Pressable onPress={() => onDelete(addon.id)} style={styles.iconBtn} accessibilityLabel="Delete add-on">
            <Trash2 size={16} color={pal.red500} />
          </Pressable>
          <View style={styles.addonSwitch}>
            <MenuSwitch value={available} checkedColor={pal.green600} onValueChange={(checked) => onToggle(addon.id, checked)} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function AddonForm({
  name,
  setName,
  description,
  setDescription,
  price,
  setPrice,
  preview,
  file,
  onPickImage,
  onCancel,
  onSave,
  saving,
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.addonForm}>
      <View>
        <Text style={styles.formLabel}>Add-on Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., Coke, Chips"
          placeholderTextColor={pal.gray400}
          selectionColor={colors.primary}
          style={[styles.formInput, inputFont]}
        />
      </View>
      <View>
        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the add-on..."
          placeholderTextColor={pal.gray400}
          selectionColor={colors.primary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={[styles.formInput, inputFont, { minHeight: 80 }]}
        />
      </View>
      <View>
        <Text style={styles.formLabel}>Price (₹) *</Text>
        <TextInput
          value={String(price ?? "")}
          onChangeText={setPrice}
          placeholder="0.00"
          placeholderTextColor={pal.gray400}
          selectionColor={colors.primary}
          keyboardType="decimal-pad"
          style={[styles.formInput, inputFont]}
        />
      </View>
      <View>
        <Text style={styles.formLabel}>Image (1 only)</Text>
        {preview ? <AppImage src={preview} width={96} style={styles.addonPreview} placeholderType="food" /> : null}
        <Pressable onPress={onPickImage} style={styles.uploadBtn}>
          <View style={styles.uploadRow}>
            <Upload size={16} color={pal.gray500} />
            <Text style={styles.uploadTitle} numberOfLines={1}>
              {file?.fileName || file?.name || "Upload image"}
            </Text>
          </View>
          <Text style={styles.uploadSub}>{file ? "Image selected successfully" : "Tap to choose 1 image from your device"}</Text>
        </Pressable>
        <Text style={styles.uploadHint}>PNG, JPG, WEBP, HEIC up to 5MB.</Text>
      </View>
      <View style={styles.formActions}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
        >
          {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text style={styles.submitText}>{saving ? "Saving..." : "Submit for approval"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FilterSheet({ open, onClose, activeTab, options, counts, selectedFilter, onSelect, onClear, onApply }) {
  const { colors } = useTheme();
  return (
    <CenterSheet open={open} onClose={onClose} contentStyle={styles.filterBody}>
      <View style={styles.filterHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterTitle}>Filters</Text>
          <Text style={styles.filterDesc}>
            {activeTab === "add-ons"
              ? "Refine the add-ons list by availability or approval status."
              : "Refine your inventory by stock state, recommendation, or food type."}
          </Text>
        </View>
        {selectedFilter !== "all" ? (
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>Active</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.filterList}>
        {options.map((option) => {
          const checked = selectedFilter === option.value;
          return (
            <Pressable key={option.value} onPress={() => onSelect(option.value)} style={styles.filterRow}>
              <View style={styles.filterRowLeft}>
                <View style={[styles.radio, { borderColor: checked ? colors.primaryStrong : pal.gray300 }]}>
                  {checked ? <View style={[styles.radioDot, { backgroundColor: colors.primaryStrong }]} /> : null}
                </View>
                <Text style={styles.filterLabel}>{option.label}</Text>
              </View>
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{counts[option.value] || 0}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.filterActions}>
        {selectedFilter !== "all" ? (
          <Pressable onPress={onClear} style={[styles.filterBtnAction, styles.filterClear]}>
            <Text style={styles.filterClearText}>Clear</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onApply} style={[styles.filterBtnAction, { backgroundColor: colors.primary }]}>
          <Text style={styles.filterApplyText}>Apply</Text>
        </Pressable>
      </View>
    </CenterSheet>
  );
}

export function JumpMenu({ open, onToggle, onClose, categories, onJump, bottom, popupWidth, popupHeight }) {
  const { colors } = useTheme();
  return (
    <>
      {open ? <Pressable style={styles.jumpBackdrop} onPress={onClose} /> : null}
      {open ? (
        <View style={[styles.jumpPopup, { bottom: bottom + 48, width: popupWidth, height: popupHeight }]}>
          <View style={[styles.jumpHead, { backgroundColor: colors.primaryTint6 }]}>
            <Text style={[styles.jumpTitle, { color: colors.primaryStrong }]}>Jump to category</Text>
          </View>
          <View style={styles.jumpDivider} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.jumpList}>
            {categories.map((category, index) => {
              const itemCount = category.itemCount || category.items?.length || 0;
              const isLast = index === categories.length - 1;
              return (
                <Pressable key={category.id} onPress={() => onJump(category.id)} style={styles.jumpRow}>
                  <View style={styles.jumpRowInner}>
                    <Text style={styles.jumpName}>{category.name}</Text>
                    <View style={styles.jumpCount}>
                      <Text style={styles.jumpCountText}>{itemCount}</Text>
                    </View>
                  </View>
                  {!isLast ? <View style={styles.jumpDash} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <ScalePressable scaleTo={0.96} onPress={onToggle} style={[styles.jumpBtn, { bottom }]}>
        {open ? <X size={16} color={colors.primaryStrong} /> : <Utensils size={16} color={colors.primary} />}
        <Text style={[styles.jumpBtnText, { color: colors.primaryStrong }]}>{open ? "Close" : "Menu"}</Text>
      </ScalePressable>
    </>
  );
}

const styles = StyleSheet.create({
  tabsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: pal.pageBg },
  tab: {
    flex: 1,
    minHeight: 52,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  tabCount: { minWidth: 24, minHeight: 20, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2, alignItems: "center", justifyContent: "center" },
  tabCountText: { fontSize: 12, fontWeight: "600" },
  toolsWrap: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: "rgba(243,245,248,0.95)" },
  toolsCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 16,
    boxShadow: "0px 20px 48px -34px rgba(15,23,42,0.45)",
  },
  toolsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  toolsTitle: { fontSize: 14, fontWeight: "600", color: pal.slate950 },
  toolsSub: { marginTop: 4, fontSize: 12, color: pal.slate500 },
  clearAll: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  clearAllText: { fontSize: 12, fontWeight: "600" },
  searchBox: { marginTop: 16, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 16, zIndex: 1 },
  searchInput: {
    height: 48,
    borderRadius: 20,
    borderWidth: 1,
    paddingLeft: 44,
    paddingRight: 40,
    fontSize: 14,
    color: pal.slate900,
  },
  searchClear: { position: "absolute", right: 12, padding: 4, borderRadius: 9999 },
  toolsButtons: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  filterBtn: {
    height: 48,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  filterBtnText: { fontSize: 14, fontWeight: "600" },
  filterDot: { position: "absolute", right: 6, top: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#ffffff" },
  primaryBtn: {
    height: 48,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 18px 32px -24px rgba(126,56,102,0.7)",
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  chipsScroll: { marginTop: 12, marginHorizontal: -4 },
  chipsRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "600" },
  chipCount: { marginLeft: 8, minWidth: 20, borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2, alignItems: "center" },
  chipCountText: { fontSize: 11, fontWeight: "600" },
  catCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    boxShadow: "0px 22px 52px -36px rgba(15,23,42,0.45)",
  },
  catHeader: { backgroundColor: "#ffffff", paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", gap: 16 },
  catHeadInfo: { flex: 1, minWidth: 0 },
  catTitleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 8, marginBottom: 8 },
  catName: { fontSize: 20, fontWeight: "900", color: pal.slate950, letterSpacing: -0.5 },
  catChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  catChip: { borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  catChipText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  catStats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statText: { fontSize: 10, fontWeight: "700" },
  catControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  expandBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catItems: { backgroundColor: "rgba(248,250,252,0.3)", paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, gap: 16 },
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 30 },
  bento: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: bentoBorder,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: bentoBorder,
    borderRadius: 20,
    boxShadow: "0px 1px 2px rgba(15,23,42,0.04), 0px 8px 24px -10px rgba(15,23,42,0.08)",
  },
  itemMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  itemImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff",
    boxShadow: "0px 4px 6px -1px rgba(0,0,0,0.1), 0px 0px 0px 1px rgba(241,245,249,0.5)",
  },
  itemImage: { width: "100%", height: "100%" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: "900", color: pal.slate950, letterSpacing: -0.3, marginBottom: 6 },
  itemChips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 10 },
  itemChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 9999,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  itemChipText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.45 },
  vegBox: { width: 10, height: 10, borderRadius: 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 4, height: 4, borderRadius: 2 },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  itemStatus: { flexShrink: 1, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.9 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  smallBtnText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.9 },
  itemReason: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "700",
    fontStyle: "italic",
    color: pal.red600,
    backgroundColor: "rgba(254,242,242,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,226,226,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  itemSide: { alignItems: "center", gap: 12, marginLeft: "auto", paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: pal.slate100 },
  thumbBtn: {
    width: 32,
    height: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  addonCard: { padding: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  addonTitleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 },
  addonName: { fontSize: 16, fontWeight: "600", color: pal.slate950 },
  pill: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "600" },
  addonDesc: { marginBottom: 8, fontSize: 14, lineHeight: 24, color: pal.slate600 },
  addonPrice: { fontSize: 16, fontWeight: "700", color: pal.slate950 },
  addonReason: { marginTop: 8, fontSize: 12, fontWeight: "500", color: pal.red600 },
  addonSide: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addonImage: { width: 80, height: 80, borderRadius: 16, borderWidth: 1, borderColor: pal.slate200 },
  addonButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { padding: 8, borderRadius: 9999 },
  addonSwitch: { marginLeft: 4, borderRadius: 9999, backgroundColor: pal.slate100, paddingHorizontal: 8, paddingVertical: 4 },
  addonForm: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: pal.gray200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 16,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  formLabel: { fontSize: 14, fontWeight: "500", color: pal.gray700, marginBottom: 4 },
  formInput: {
    borderWidth: 1,
    borderColor: pal.gray300,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: pal.gray900,
  },
  addonPreview: { width: 96, height: 96, borderRadius: 4, borderWidth: 1, borderColor: pal.gray200, marginBottom: 8 },
  uploadBtn: { borderRadius: 6, borderWidth: 1, borderColor: pal.gray300, backgroundColor: pal.gray50, paddingHorizontal: 12, paddingVertical: 12 },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  uploadTitle: { flex: 1, fontSize: 14, fontWeight: "500", color: pal.gray900 },
  uploadSub: { marginTop: 4, fontSize: 12, color: pal.gray500 },
  uploadHint: { marginTop: 4, fontSize: 12, color: pal.gray500 },
  formActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: pal.gray300, borderRadius: 6 },
  cancelText: { fontSize: 14, fontWeight: "500", color: pal.gray700 },
  submitBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  submitText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  filterBody: { padding: 24 },
  filterHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  filterTitle: { fontSize: 18, fontWeight: "700", color: pal.gray900 },
  filterDesc: { marginTop: 4, fontSize: 14, color: pal.gray500 },
  activeChip: { borderRadius: 9999, backgroundColor: pal.gray100, paddingHorizontal: 12, paddingVertical: 4 },
  activeChipText: { fontSize: 12, fontWeight: "500", color: pal.gray700 },
  filterList: { gap: 16, marginBottom: 24 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pal.gray200,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  filterLabel: { fontSize: 16, color: pal.gray900 },
  filterCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: pal.gray100, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  filterCountText: { fontSize: 12, fontWeight: "500", color: pal.gray700 },
  filterActions: { flexDirection: "row", gap: 12 },
  filterBtnAction: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  filterClear: { borderWidth: 1, borderColor: pal.gray300 },
  filterClearText: { fontSize: 14, fontWeight: "500", color: pal.gray900 },
  filterApplyText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
  jumpBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  jumpPopup: {
    position: "absolute",
    right: 16,
    maxWidth: 384,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: pal.plumBorder,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    boxShadow: "0px 24px 60px -30px rgba(126,56,102,0.45)",
  },
  jumpHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  jumpTitle: { fontSize: 14, fontWeight: "600" },
  jumpDivider: { marginHorizontal: 16, height: 1, backgroundColor: pal.slate200 },
  jumpList: { paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  jumpRow: { paddingVertical: 12 },
  jumpRowInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  jumpName: { flex: 1, fontSize: 14, fontWeight: "500", color: pal.slate900 },
  jumpCount: {
    height: 28,
    minWidth: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: pal.slate200,
    backgroundColor: pal.slate50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  jumpCountText: { fontSize: 12, fontWeight: "600", color: pal.slate700 },
  jumpDash: { marginTop: 12, borderTopWidth: 1, borderStyle: "dashed", borderColor: pal.slate200 },
  jumpBtn: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: pal.plumBorder,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: "0px 18px 36px -28px rgba(126,56,102,0.45)",
  },
  jumpBtnText: { fontSize: 14, fontWeight: "600" },
});
