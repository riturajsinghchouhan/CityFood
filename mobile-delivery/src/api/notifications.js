// Notification inbox. Web: notificationAPI.getInbox/markAsRead/dismiss/dismissAll with
// contextModule "delivery" (useNotificationInbox("delivery"), audit #41-#44). Bearer = rider token.
import { api } from "./client";

// GET /food/notifications/inbox?page=1&limit=100 -> data {items:[{_id, title, message, link, category,
// isRead, createdAt}], pagination, unreadCount}
export function getInbox(params = {}, config = {}) {
  return api.get("/food/notifications/inbox", { params: { page: 1, limit: 100, ...params }, ...config });
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
