import express from 'express';
import authRoutes from '../core/auth/auth.routes.js';
import deliveryRoutes from '../modules/food/delivery/routes/delivery.routes.js';
import restaurantRoutes from '../modules/food/restaurant/routes/restaurant.routes.js';
import landingRoutes from '../modules/food/landing/routes/landing.routes.js';
import { getPublicDiningCategories, getPublicDiningRestaurants, getPublicRestaurantOccupiedSeats } from '../modules/food/dining/controllers/diningPublic.controller.js';
import { createBooking, getMyBookings, createReview, getRestaurantBookings, updateBookingStatus } from '../modules/food/dining/controllers/diningBooking.controller.js';
import uploadRoutes from '../modules/uploads/routes/upload.routes.js';
import restaurantAdminRoutes from '../modules/food/admin/routes/admin.routes.js';
import userRoutes from '../modules/food/user/routes/user.routes.js';
import orderUserRoutes from '../modules/food/orders/routes/order.routes.user.js';
import fcmRoutes from '../core/notifications/fcm.routes.js';
import notificationRoutes from '../core/notifications/notification.routes.js';
import { authMiddleware } from '../core/auth/auth.middleware.js';
import * as businessSettingsController from '../modules/food/admin/controllers/businessSettings.controller.js';
import { requireRoles } from '../core/roles/role.middleware.js';
import { getQueuesController } from '../controllers/admin.controller.js';
import webhookRoutes from '../core/payments/routes/webhook.routes.js';
import searchRoutes from '../modules/food/search/routes/search.routes.js';
import appConfigRoutes from '../core/appConfig/appConfig.routes.js';
import promocodeRoutes from './promocodeRoutes.js';
import { requireZone } from '../middlewares/zone.middleware.js';
import envSettingRoutes from './admin/envSettingRoutes.js';
import franchiseAdminRoutes from '../modules/food/franchise/routes/franchiseAdmin.routes.js';
import franchisePanelRoutes from '../modules/food/franchise/routes/franchisePanel.routes.js';
import { franchiseAdminGate } from '../modules/food/franchise/middleware/franchiseAdminGate.middleware.js';
import { listFranchiseOptionsController } from '../modules/food/franchise/controllers/franchiseAdmin.controller.js';
import { submitInquiryController } from '../modules/food/inquiry/controllers/partnerInquiry.controller.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Apply Global Zone Interceptor (Reads X-Zone-Id from Frontend Axios)
router.use(requireZone);

router.get('/v1/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Server is healthy' });
});

// App Config Route
router.use('/v1/app-config', appConfigRoutes);

// Food-prefixed auth routes
router.use('/v1/food/auth', authRoutes);

// Backward-compatible auth routes
router.use('/v1/auth', authRoutes);
router.use('/v1/food/delivery', deliveryRoutes);
router.use('/v1/driver', deliveryRoutes);
router.use('/v1/food/restaurant', restaurantRoutes);
router.use('/v1/food', landingRoutes);
router.use('/v1/food/search', searchRoutes);
router.use('/v1/food/promocodes', promocodeRoutes);
router.get('/v1/food/dining/categories/public', getPublicDiningCategories);
router.get('/v1/food/dining/restaurants/public', getPublicDiningRestaurants);
router.get('/v1/food/dining/restaurants/:restaurantId/occupied-seats/public', getPublicRestaurantOccupiedSeats);

// Dining Booking Routes
router.post('/v1/food/dining/bookings', authMiddleware, requireRoles('USER'), createBooking);
router.get('/v1/food/dining/bookings/my', authMiddleware, requireRoles('USER'), getMyBookings);
router.post('/v1/food/dining/bookings/:bookingId/review', authMiddleware, requireRoles('USER'), createReview);
router.get('/v1/food/dining/bookings/restaurant/:restaurantId', authMiddleware, requireRoles('RESTAURANT', 'ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'), getRestaurantBookings);
router.patch('/v1/food/dining/bookings/:bookingId/status', authMiddleware, requireRoles('RESTAURANT', 'ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'), updateBookingStatus);

router.use('/v1/uploads', uploadRoutes);

// Public "partner with us" form on the franchise / restaurant / delivery landing pages.
router.post('/v1/food/inquiries', authRateLimiter, submitInquiryController);

// Mark business-settings/public as truly public
router.get('/v1/food/admin/business-settings/public', businessSettingsController.getBusinessSettings);

router.use('/v1/food/admin/env', envSettingRoutes);
// Franchise names for the "filter by franchise" dropdown; sub-admins see it on the pages they manage.
router.get('/v1/food/admin/franchise-options', authMiddleware, requireRoles('ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'), listFranchiseOptionsController);
// Franchise management is owner-level only: sub-admins are excluded.
router.use('/v1/food/admin/franchises', authMiddleware, requireRoles('ADMIN', 'SUPER_ADMIN'), franchiseAdminRoutes);
// Franchise owner panel (own login; every route scoped to the owner's franchise zone).
router.use('/v1/food/franchise', franchisePanelRoutes);
// Franchise owners use the same admin APIs; franchiseAdminGate limits them to their zone and to operational actions.
router.use('/v1/food/admin', authMiddleware, requireRoles('ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN', 'FRANCHISE_OWNER'), franchiseAdminGate, restaurantAdminRoutes);
router.use('/v1/food/user', authMiddleware, requireRoles('USER'), userRoutes);
router.use('/v1/food/notifications', authMiddleware, requireRoles('USER', 'RESTAURANT', 'DELIVERY_PARTNER'), notificationRoutes);
router.use('/v1/food/orders', authMiddleware, requireRoles('USER'), orderUserRoutes);
router.use('/v1/payments/webhook', webhookRoutes);
router.use('/v1/fcm-tokens', fcmRoutes);
router.use('/fcm-tokens', fcmRoutes);

router.get('/v1/admin/queues', authMiddleware, requireRoles('ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'), getQueuesController);

export default router;
