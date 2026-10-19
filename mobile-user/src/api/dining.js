// Dining / table booking. Web: diningAPI (customer part).
// Several of these endpoints return a bare array in `data`.
import { api } from "./client";

// data: [{_id, name, slug, imageUrl, restaurantCount}]
export function getDiningCategories(params = {}) {
  return api.get("/food/dining/categories/public", { params });
}

// Params: category, city, zoneId. data: [restaurant with categories, diningSettings]
export function getDiningRestaurants(params = {}) {
  return api.get("/food/dining/restaurants/public", { params });
}

// data: {occupiedSeats}
export function getOccupiedSeatsPublic(restaurantId) {
  return api.get(`/food/dining/restaurants/${String(restaurantId)}/occupied-seats/public`);
}

// Dining page banners (uncached). data.banners
export function getDiningHeroBanners() {
  return api.get("/food/hero-banners/ads/public");
}

// Same endpoint as restaurants.getRestaurantById; kept under the web's dining name.
export function getRestaurantBySlug(slug, config = {}) {
  return api.get(`/food/restaurant/restaurants/${String(slug)}`, config);
}

// data: [booking with populated restaurant]
export function getBookings() {
  return api.get("/food/dining/bookings/my");
}

// Body: {restaurant | restaurantId, guests, date, timeSlot, specialRequest, userRef: {name, phone, email}}
export function createBooking(payload = {}) {
  return api.post("/food/dining/bookings", payload);
}

// Body: {bookingId, rating, comment}
export function createReview(payload = {}) {
  return api.post(`/food/dining/bookings/${String(payload?.bookingId)}/review`, payload);
}
