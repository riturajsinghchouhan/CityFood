// Support tickets and safety reports. Web: supportAPI (user part), userAPI safety-emergency calls.
import { api } from "./client";

// Body: {type*: order|restaurant|other, issueType*, description?, orderId (Mongo _id, if type=order),
// restaurantId (if type=restaurant)} -> data.ticket
export function createTicket(body) {
  return api.post("/food/user/support/ticket", body ?? {});
}

// Params: page, limit. data: {tickets, total, page, limit}
export function getMyTickets(params = {}) {
  return api.get("/food/user/support/my-tickets", { params });
}

// message: 10-4000 chars -> data.report
export function createSafetyEmergencyReport(message) {
  return api.post("/food/user/safety-emergency-reports", { message: String(message || "") });
}

// Params: page, limit. data: {safetyEmergencies, pagination}
export function getMySafetyEmergencyReports(params) {
  return api.get("/food/user/safety-emergency-reports", { params: params ?? {} });
}
