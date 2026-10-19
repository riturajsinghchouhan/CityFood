// Notification inbox. Web: notificationAPI.getInbox/markAsRead/dismiss/dismissAll with
// contextModule "restaurant" (useNotificationInbox.js). The Bearer is the restaurant token.
import { api } from "./client";

// GET /food/notifications/inbox?page=1&limit=50 -> data {items:[{_id, title, message, link, category,
// isRead, createdAt}], pagination, unreadCount}
export function getInbox(params = {}, config = {}) {
  return api.get("/food/notifications/inbox", { params: { page: 1, limit: 50, ...params }, ...config });
}

// PATCH /food/notifications/:id/read
export function markAsRead(id, config = {}) {
  return api.patch(`/food/notifications/${String(id)}/read`, {}, config);
}

// DELETE /food/notifications/:id (soft dismiss)
export function dismiss(id, config = {}) {
  return api.delete(`/food/notifications/${String(id)}`, config);
}

// DELETE /food/notifications/inbox/all
export function dismissAll(config = {}) {
  return api.delete("/food/notifications/inbox/all", config);
}
