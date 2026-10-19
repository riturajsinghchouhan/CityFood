// Port of pages/restaurant/MenuCategoriesPage.jsx (/menu-categories): the restaurant's own
// categories with approval and diet-scope badges; create, edit, delete and activate/deactivate.
// Every change goes back to admin approval. A `draftCategoryName` param opens the create form.
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BadgeCheck, Check, Clock3, Edit2, Eye, EyeOff, Globe, Plus, Trash2, Upload, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { createCategory, deleteCategory, getAllCategories, updateCategory, uploadMedia } from "../../api";
import ImageSourcePicker from "../../components/auth/onboarding/ImageSourcePicker";
import { CenterSheet, SelectField, confirmAsync } from "../../components/menu/common";
import { pal } from "../../components/menu/palette";
import { getImageValidationError, getUploadErrorMessage } from "../../components/menu/uploadErrors";
import { useShellBottomInset } from "../../components/shell/BottomNavOrders";
import { AppImage, Text, inputFont, toast } from "../../components/ui";
import { useAppBack } from "../../navigation/back";

const defaultFormData = {
  name: "",
  type: "",
  image: "",
  isActive: true,
  sortOrder: 0,
  foodTypeScope: "Veg",
};

const SCOPE_OPTIONS = [
  { value: "Veg", label: "Veg" },
  { value: "Non-Veg", label: "Non-Veg" },
  { value: "Both", label: "Both" },
];

const approvalColors = (status) => {
  const value = String(status || "pending").toLowerCase();
  if (value === "approved") return { bg: pal.emerald50, fg: pal.emerald700, border: pal.emerald200 };
  if (value === "rejected") return { bg: pal.rose50, fg: pal.rose700, border: pal.rose200 };
  return { bg: pal.amber50, fg: pal.amber700, border: pal.amber200 };
};

const scopeColors = (scope) => {
  if (scope === "Veg") return { bg: pal.green50, fg: pal.green700, border: pal.green200 };
  if (scope === "Non-Veg") return { bg: pal.red50, fg: pal.red700, border: pal.red200 };
  return { bg: pal.slate100, fg: pal.slate700, border: pal.slate200 };
};

function CategoryRow({ category, onToggleActive, onEdit, onDelete }) {
  const status = category?.approvalStatus || "pending";
  const isEditable = category?.canEdit;
  const isGlobal = category?.isGlobal;
  const approval = approvalColors(status);
  const scope = scopeColors(category?.foodTypeScope);
  const StatusIcon = status === "approved" ? BadgeCheck : Clock3;
  const active = category?.isActive !== false;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.thumb}>
          {category?.image ? (
            <AppImage src={category.image} width={64} style={StyleSheet.absoluteFill} placeholderType="food" />
          ) : (
            <Text style={styles.thumbLetter}>{String(category?.name || "C").slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.badges}>
            <Text style={styles.cardName}>{category.name}</Text>
            <View style={[styles.badge, { backgroundColor: approval.bg, borderColor: approval.border }]}>
              <StatusIcon size={14} color={approval.fg} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: approval.fg }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: scope.bg, borderColor: scope.border }]}>
              <Text style={[styles.badgeText, { color: scope.fg }]}>{category?.foodTypeScope || "Both"}</Text>
            </View>
            {isGlobal ? (
              <View style={[styles.badge, { backgroundColor: pal.sky50, borderColor: pal.sky200 }]}>
                <Globe size={14} color={pal.sky700} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: pal.sky700 }]}>Global</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardLines}>
            <Text style={styles.cardLine}>{category?.itemCount || 0} item(s) linked</Text>
            {isGlobal ? (
              <Text style={styles.cardLine}>Admin controls this category now, so you can use it but not rename or delete it.</Text>
            ) : status === "approved" ? (
              <Text style={styles.cardLine}>Editing this category will send it back for admin approval.</Text>
            ) : (
              <Text style={styles.cardLine}>Foods can be added only after approval.</Text>
            )}
            {status === "rejected" && category?.rejectionReason ? (
              <Text style={[styles.cardLine, { color: pal.rose600 }]}>Reason: {category.rejectionReason}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onToggleActive(category)}
          disabled={!isEditable}
          style={[styles.actionBtn, { backgroundColor: pal.slate100, opacity: isEditable ? 1 : 0.5 }]}
          accessibilityLabel={active ? "Deactivate" : "Activate"}
        >
          {active ? <Eye size={16} color={pal.slate700} /> : <EyeOff size={16} color={pal.slate700} />}
        </Pressable>
        <Pressable
          onPress={() => onEdit(category)}
          disabled={!isEditable}
          style={[styles.actionBtn, { backgroundColor: pal.blue50, opacity: isEditable ? 1 : 0.5 }]}
        >
          <Edit2 size={16} color={pal.blue700} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(category)}
          disabled={!category?.canDelete}
          style={[styles.actionBtn, { backgroundColor: pal.rose50, opacity: category?.canDelete ? 1 : 0.5 }]}
        >
          <Trash2 size={16} color={pal.rose700} />
        </Pressable>
      </View>
    </View>
  );
}

export default function MenuCategoriesScreen() {
  const goBack = useAppBack();
  const params = useLocalSearchParams();
  const shellInset = useShellBottomInset();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllCategories();
      const list = res?.data?.categories || [];
      setCategories(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(error?.message || "Failed to load categories");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // location.state.draftCategoryName opens the create form once, then the state is cleared.
  const draftCategoryName = String(params.draftCategoryName || "").trim();
  useEffect(() => {
    if (!draftCategoryName) return;
    setEditingCategory(null);
    setFormData({ ...defaultFormData, name: draftCategoryName });
    setSelectedImageFile(null);
    setImagePreview(null);
    setShowModal(true);
    router.setParams({ draftCategoryName: undefined });
  }, [draftCategoryName]);

  const ownCategories = useMemo(() => categories.filter((c) => c.ownedByRestaurant), [categories]);

  const resetModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData(defaultFormData);
    setSelectedImageFile(null);
    setImagePreview(null);
    setUploadingImage(false);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(defaultFormData);
    setSelectedImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEditModal = (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now");
      return;
    }
    setEditingCategory(category);
    setFormData({
      name: category?.name || "",
      type: category?.type || "",
      image: category?.image || "",
      isActive: category?.isActive !== false,
      sortOrder: Number.isFinite(Number(category?.sortOrder)) ? Number(category.sortOrder) : 0,
      foodTypeScope: category?.foodTypeScope || "Veg",
    });
    setSelectedImageFile(null);
    setImagePreview(category?.image || null);
    setShowModal(true);
  };

  const handleImageFileChange = (asset) => {
    if (!asset) return;
    if (Number(asset.fileSize || 0) > 5 * 1024 * 1024) {
      toast.error("Image size exceeds 5MB limit.");
      return;
    }
    setSelectedImageFile(asset);
    setImagePreview(asset.uri || null);
  };

  const handleSaveCategory = async () => {
    if (!String(formData.name || "").trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      setUploadingImage(true);
      let imageUrl = String(formData.image || "").trim();
      if (selectedImageFile) {
        const validationError = getImageValidationError({ mimeType: "image/jpeg", ...selectedImageFile });
        if (validationError) {
          toast.error(validationError);
          setUploadingImage(false);
          return;
        }
        const res = await uploadMedia(selectedImageFile, { folder: "food/categories" });
        const url = res?.data?.url;
        if (url) imageUrl = String(url);
      }
      const payload = {
        name: String(formData.name || "").trim(),
        type: String(formData.type || "").trim(),
        image: imageUrl,
        isActive: formData.isActive !== false,
        sortOrder: Number.isFinite(Number(formData.sortOrder)) ? Number(formData.sortOrder) : 0,
        foodTypeScope: formData.foodTypeScope,
      };
      if (editingCategory) {
        await updateCategory(editingCategory._id || editingCategory.id, payload);
        toast.success("Category updated and sent for admin approval");
      } else {
        await createCategory(payload);
        toast.success("Category created and sent for admin approval");
      }
      resetModal();
      fetchCategories();
    } catch (error) {
      toast.error(getUploadErrorMessage(error, { fallback: error?.message || "Failed to save category" }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!category?.canDelete) {
      toast.error(category?.canEdit ? "Remove foods from this category before deleting it" : "Admin controls this category now");
      return;
    }
    if (!(await confirmAsync(`Delete "${category.name}"?`))) return;
    try {
      await deleteCategory(category._id || category.id);
      toast.success("Category deleted successfully");
      fetchCategories();
    } catch (error) {
      toast.error(error?.message || "Failed to delete category");
    }
  };

  const handleToggleActive = async (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now");
      return;
    }
    try {
      await updateCategory(category._id || category.id, { isActive: !(category?.isActive !== false) });
      toast.success("Category updated and sent for admin approval");
      fetchCategories();
    } catch (error) {
      toast.error(error?.message || "Failed to update category");
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How this works</Text>
        <Text style={styles.infoText}>
          New categories stay pending until admin approval. Editing an approved category sends it back for review. Only
          approved categories can be used for food uploads.
        </Text>
      </View>
      <Pressable onPress={openCreateModal} style={styles.addBtn}>
        <Plus size={20} color="#ffffff" />
        <Text style={styles.addBtnText}>Add Category</Text>
      </Pressable>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={pal.slate500} />
        </View>
      ) : ownCategories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No restaurant categories yet</Text>
          <Text style={styles.emptyText}>
            Start with a category and choose whether it should accept veg, non-veg, or both kinds of dishes.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8} accessibilityLabel="Back">
          <ArrowLeft size={20} color={pal.slate700} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Menu Categories</Text>
          <Text style={styles.topSub}>Create categories, track approvals, and resubmit edits safely.</Text>
        </View>
      </View>

      <FlatList
        data={loading ? [] : ownCategories}
        keyExtractor={(c) => String(c._id || c.id)}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <View style={styles.rowPad}>
            <CategoryRow
              category={item}
              onToggleActive={handleToggleActive}
              onEdit={openEditModal}
              onDelete={handleDeleteCategory}
            />
          </View>
        )}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 + shellInset }}
      />

      <CenterSheet open={showModal} onClose={resetModal} contentStyle={styles.modalBody}>
        <View style={styles.modalHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{editingCategory ? "Edit Category" : "Create Category"}</Text>
            <Text style={styles.modalSub}>
              {editingCategory
                ? "Any edit sends this category back for admin approval."
                : "Choose the diet scope carefully before sending it for approval."}
            </Text>
          </View>
          <Pressable onPress={resetModal} hitSlop={8}>
            <X size={20} color={pal.slate600} />
          </Pressable>
        </View>

        <View style={styles.fields}>
          <View>
            <Text style={styles.fieldLabel}>Category Name</Text>
            <TextInput
              value={formData.name}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, name: t }))}
              placeholder="Enter category name"
              placeholderTextColor={pal.gray400}
              selectionColor={pal.slate900}
              style={[styles.fieldInput, inputFont]}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Diet Scope</Text>
            <SelectField
              value={formData.foodTypeScope}
              options={SCOPE_OPTIONS}
              onChange={(v) => setFormData((prev) => ({ ...prev, foodTypeScope: v }))}
              style={styles.fieldSelect}
              textStyle={{ fontSize: 16 }}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Optional Type Label</Text>
            <TextInput
              value={formData.type}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, type: t }))}
              placeholder="Examples: Starters, Desserts, Drinks"
              placeholderTextColor={pal.gray400}
              selectionColor={pal.slate900}
              style={[styles.fieldInput, inputFont]}
            />
          </View>
          <View style={styles.imageRow}>
            {imagePreview || formData.image ? (
              <AppImage src={imagePreview || formData.image} width={64} style={styles.preview} placeholderType="food" />
            ) : null}
            <Pressable onPress={() => setIsPhotoPickerOpen(true)} style={styles.uploadBtn}>
              <Upload size={16} color={pal.slate700} />
              <Text style={styles.uploadText}>Upload Image</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: formData.isActive }}
          >
            <View style={[styles.checkbox, formData.isActive && styles.checkboxOn]}>
              {formData.isActive ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}
            </View>
            <Text style={styles.checkText}>Keep category active</Text>
          </Pressable>
        </View>

        <View style={styles.modalActions}>
          <Pressable onPress={resetModal} style={[styles.modalBtn, styles.cancelBtn]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveCategory}
            disabled={uploadingImage}
            style={[styles.modalBtn, { backgroundColor: pal.slate900, opacity: uploadingImage ? 0.6 : 1 }]}
          >
            <Text style={styles.saveText}>
              {uploadingImage ? "Uploading..." : editingCategory ? "Save & Resubmit" : "Create"}
            </Text>
          </Pressable>
        </View>
      </CenterSheet>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageFileChange}
        title="Category Image"
        description="Choose how to upload your category image"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: pal.slate50 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: pal.slate200,
  },
  backBtn: { padding: 4, borderRadius: 9999 },
  topTitle: { fontSize: 20, fontWeight: "700", color: pal.slate900 },
  topSub: { fontSize: 12, color: pal.slate500 },
  headerBlock: { paddingHorizontal: 16, gap: 16, marginBottom: 16 },
  infoCard: { borderRadius: 16, borderWidth: 1, borderColor: pal.slate200, backgroundColor: "#ffffff", padding: 16 },
  infoTitle: { fontSize: 14, fontWeight: "600", color: pal.slate900 },
  infoText: { marginTop: 8, fontSize: 14, color: pal.slate600 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: pal.slate900,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addBtnText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },
  loading: { paddingVertical: 48, alignItems: "center" },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: pal.slate300,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: pal.slate900, textAlign: "center" },
  emptyText: { marginTop: 8, fontSize: 14, color: pal.slate500, textAlign: "center" },
  rowPad: { paddingHorizontal: 16, marginBottom: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: pal.slate200,
    backgroundColor: "#ffffff",
    padding: 16,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  cardTop: { flexDirection: "row", gap: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: pal.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbLetter: { fontSize: 18, fontWeight: "700", color: pal.slate500 },
  cardInfo: { flex: 1, minWidth: 0 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  cardName: { fontSize: 16, fontWeight: "600", color: pal.slate900 },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 9999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardLines: { marginTop: 8, gap: 4 },
  cardLine: { fontSize: 14, color: pal.slate500 },
  actions: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { borderRadius: 12, padding: 8 },
  modalBody: { padding: 16 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: pal.slate900 },
  modalSub: { fontSize: 12, color: pal.slate500 },
  fields: { gap: 16 },
  fieldLabel: { marginBottom: 8, fontSize: 14, fontWeight: "500", color: pal.slate700 },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pal.slate300,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: pal.slate900,
  },
  fieldSelect: { borderRadius: 12, borderColor: pal.slate300 },
  imageRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  preview: { width: 64, height: 64, borderRadius: 16 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: pal.slate300,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadText: { fontSize: 14, fontWeight: "500", color: pal.slate700 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1, borderColor: pal.gray500, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: pal.blue600, borderColor: pal.blue600 },
  checkText: { fontSize: 14, color: pal.slate700 },
  modalActions: { marginTop: 24, flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  cancelBtn: { borderWidth: 1, borderColor: pal.slate300 },
  cancelText: { fontSize: 16, fontWeight: "500", color: pal.slate700 },
  saveText: { fontSize: 16, fontWeight: "500", color: "#ffffff" },
});
