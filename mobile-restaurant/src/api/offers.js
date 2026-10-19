// Promocodes (restaurant offers). Web: restaurantAPI.getPromocodes/createPromocode/
// togglePromocodeStatus/deletePromocode (Promocodes.jsx). Route needs RESTAURANT or ADMIN role.
import { api } from "./client";

// GET /food/promocodes -> data.promocodeList[]
export function getPromocodes() {
  return api.get("/food/promocodes");
}

// POST /food/promocodes {code, description, discountType, discountValue, minOrderAmount?,
// maxDiscountAmount?, expiryDate, usageLimit?} -> 201 data.promocode. Duplicate code: 400.
export function createPromocode(data) {
  return api.post("/food/promocodes", data ?? {});
}

// PATCH /food/promocodes/:id {isActive} -> data.promocode
export function togglePromocodeStatus(id, isActive) {
  return api.patch(`/food/promocodes/${id}`, { isActive });
}

// DELETE /food/promocodes/:id -> 204 with an empty body (resolves to "" / undefined).
export function deletePromocode(id) {
  return api.delete(`/food/promocodes/${id}`);
}
