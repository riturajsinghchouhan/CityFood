// Ratings, complaints and app feedback. Web: restaurantAPI.getComplaints (Feedback.jsx) and the
// ShareFeedback.jsx api.post. RatingsReviews.jsx / DishRatings.jsx have no backend; the only rating
// numbers are rating/totalRatings on getCurrentRestaurant() and getDashboardStats().
import { api } from "./client";

// GET /food/restaurant/complaints?page&limit... -> data {complaints, total, page, limit}
export function getComplaints(params = {}) {
  return api.get("/food/restaurant/complaints", { params });
}

// Delivered orders for the reviews tab (Feedback.jsx uses getOrders({status:'delivered'})):
// use getOrders from ./orders.

/**
 * POST /food/restaurant/feedback-experience {rating:1-5, module:"restaurant", comment}.
 * ShareFeedback.jsx collects 0-10 and sends ceil(rating/2) || 1; pass the 1-5 value here.
 */
export function submitFeedbackExperience({ rating, comment = "", module = "restaurant" } = {}) {
  return api.post("/food/restaurant/feedback-experience", { rating, module, comment });
}
