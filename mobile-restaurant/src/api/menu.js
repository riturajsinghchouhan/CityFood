// Menu, categories, food items (with variants), add-ons and inventory stock toggles.
// Web: restaurantAPI.getMenu/getCategories/getAllCategories/createCategory/updateCategory/
// deleteCategory/createFood/bulkCreateFood/updateFood/deleteFood/getAddons/addAddon/updateAddon/
// deleteAddon (Inventory.jsx, ItemDetailsPage.jsx, MenuCategoriesPage.jsx).
// Images: upload first with uploadMedia(file, {folder}) and pass data.url here.
// restaurantAPI.updateMenu (PATCH /food/restaurant/menu) always returns 400 and is not ported.
import { api } from "./client";

// GET /food/restaurant/menu -> data.menu {sections:[{..., items[], subsections[]}], categories[]}
export function getMenu(params = {}) {
  return api.get("/food/restaurant/menu", { params });
}

// GET /food/restaurant/categories?compact&limit=1000 (id + name, for item forms).
export function getCategories(params = {}) {
  return api.get("/food/restaurant/categories", { params: { compact: true, limit: 1000, ...params } });
}

// GET /food/restaurant/categories?includeInactive&withCounts&limit=1000 (MenuCategoriesPage).
export function getAllCategories(params = {}) {
  return api.get("/food/restaurant/categories", {
    params: { includeInactive: true, withCounts: true, limit: 1000, ...params },
  });
}

// POST /food/restaurant/categories {name, type, image(url), isActive, sortOrder, foodTypeScope} -> data.category
export function createCategory(body) {
  return api.post("/food/restaurant/categories", body ?? {});
}

// PATCH /food/restaurant/categories/:id (partial, e.g. {isActive}) -> data.category
export function updateCategory(id, body) {
  return api.patch(`/food/restaurant/categories/${String(id)}`, body ?? {});
}

export function deleteCategory(id) {
  return api.delete(`/food/restaurant/categories/${String(id)}`);
}

/**
 * POST /food/restaurant/foods {name, description, price?, variants:[{name, price}], image(url), foodType,
 * isAvailable, isRecommended, preparationTime, categoryId?, categoryName} -> data.food
 * (approvalStatus "pending" until an admin approves). `variations` is accepted as an alias of variants.
 */
export function createFood(body) {
  return api.post("/food/restaurant/foods", body ?? {});
}

// POST /food/restaurant/foods/bulk, body: array of food objects -> bulk results
export function bulkCreateFood(items) {
  return api.post("/food/restaurant/foods/bulk", items ?? []);
}

// PATCH /food/restaurant/foods/:id (partial) -> data.food
export function updateFood(id, body) {
  return api.patch(`/food/restaurant/foods/${String(id)}`, body ?? {});
}

export function deleteFood(id) {
  return api.delete(`/food/restaurant/foods/${String(id)}`);
}

// Inventory stock toggle (Inventory.jsx): PATCH /foods/:id {isAvailable}.
export function setFoodAvailability(id, isAvailable) {
  return updateFood(id, { isAvailable: Boolean(isAvailable) });
}

// Inventory "recommended" toggle: PATCH /foods/:id {isRecommended}.
export function setFoodRecommended(id, isRecommended) {
  return updateFood(id, { isRecommended: Boolean(isRecommended) });
}

// GET /food/restaurant/addons?page&limit(<=100)&status(pending|approved|rejected)&search&includeDeleted
export function getAddons(params = {}) {
  return api.get("/food/restaurant/addons", { params: { limit: 100, page: 1, ...params } });
}

// POST /food/restaurant/addons {name, description?, price, image?, images[]?} -> data.addon (admin approval)
export function addAddon(body) {
  return api.post("/food/restaurant/addons", body ?? {});
}

// PATCH /food/restaurant/addons/:id: {draft:{...partial}} to edit, or {isAvailable} to toggle stock.
export function updateAddon(id, body) {
  return api.patch(`/food/restaurant/addons/${String(id)}`, body ?? {});
}

export function deleteAddon(id) {
  return api.delete(`/food/restaurant/addons/${String(id)}`);
}

// Inventory add-on stock toggle: PATCH /addons/:id {isAvailable}.
export function setAddonAvailability(id, isAvailable) {
  return updateAddon(id, { isAvailable: Boolean(isAvailable) });
}
