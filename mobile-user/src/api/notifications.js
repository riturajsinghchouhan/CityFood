// Notification inbox. Web: notificationAPI.getInbox/markAsRead/dismiss/dismissAll.
import { api } from "./client";

// Params: page, limit. data: {items:[{_id, title, message, link, category, isRead, createdAt}], pagination, unreadCount}
export function getInbox(params = {}, config = {}) {
  return api.get("/food/notifications/inbox", { params, ...config });
}

export function markAsRead(id, config = {}) {
  return api.patch(`/food/notifications/${String(id)}/read`, {}, config);
}

// Soft dismiss of one notification.
export function dismiss(id, config = {}) {
  return api.delete(`/food/notifications/${String(id)}`, config);
}

export function dismissAll(config = {}) {
  return api.delete("/food/notifications/inbox/all", config);
}
