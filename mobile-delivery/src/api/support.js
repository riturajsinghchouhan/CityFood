// Rider support tickets. Web: deliveryAPI.getSupportTickets/createSupportTicket/getSupportTicketById
// (audit #38-#40).
import { api } from "./client";

// GET /food/delivery/support-tickets -> {tickets:[{_id, ticketId, subject, description, category,
// priority, status:'open'|'in_progress'|'resolved'|'closed', adminResponse, createdAt}]} (no pagination)
export function getSupportTickets() {
  return api.get("/food/delivery/support-tickets");
}

// POST /food/delivery/support-tickets {subject (≥3), description (≥10),
// category:'payment'|'account'|'technical'|'order'|'other', priority:'low'|'medium'|'high'|'urgent'} -> 201 ticket
export function createSupportTicket(body) {
  return api.post("/food/delivery/support-tickets", body ?? {});
}

// GET /food/delivery/support-tickets/:id (Mongo _id) -> the ticket, or 404
export function getSupportTicketById(id) {
  return api.get(`/food/delivery/support-tickets/${encodeURIComponent(String(id))}`);
}
