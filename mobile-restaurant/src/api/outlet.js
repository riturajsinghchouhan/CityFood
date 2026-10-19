// Outlet timings. Web: restaurantAPI.getOutletTimings/saveOutletTimings (OutletTimings.jsx).
// Delivery settings = getCurrentRestaurant + updateAcceptingOrders (./profile).
// RushHour.jsx and DaySlots.jsx have no backend.
import { api } from "./client";

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// GET /food/restaurant/outlet-timings -> data.outletTimings {Monday:{isOpen, openingTime, closingTime}, ...}
export function getOutletTimings() {
  return api.get("/food/restaurant/outlet-timings");
}

// PUT /food/restaurant/outlet-timings {outletTimings:{<Day>:{isOpen, openingTime:"HH:mm", closingTime:"HH:mm"}}}
// Missing days default to open 09:00-22:00 on the server.
export function saveOutletTimings(outletTimings) {
  return api.put("/food/restaurant/outlet-timings", { outletTimings: outletTimings || {} });
}
