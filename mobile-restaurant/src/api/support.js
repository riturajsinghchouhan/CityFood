// Restaurant support tickets. Web: restaurantAPI.createSupportTicket/getSupportTickets (RestaurantSupport.jsx).
import { api } from "./client";

export const SUPPORT_CATEGORIES = ["orders", "payments", "menu", "restaurant", "technical", "other"];

// POST /food/restaurant/support/tickets {category, issueType (required), subject, description,
// orderRef|orderId, priority:"low"|"medium"|"high"} -> 201 data.ticket
export function createSupportTicket(body = {}) {
  return api.post("/food/restaurant/support/tickets", body ?? {});
}

// GET /food/restaurant/support/tickets?page&limit(<=100)&status&search -> data {tickets, total, page, ...}
export function getSupportTickets(params = {}) {
  return api.get("/food/restaurant/support/tickets", { params });
}
