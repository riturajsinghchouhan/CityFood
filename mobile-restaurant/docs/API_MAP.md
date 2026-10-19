# Restaurant app: API and data-layer map

Port of the restaurant partner panel's data layer (`Frontend/src/services/api/index.js` `restaurantAPI` and friends, `hooks/useRestaurantNotifications.js`, `RestaurantBlockGuard.jsx`, `useRestaurantBackNavigation.js`). Endpoint numbers (#) refer to `docs/audit/api-and-auth.md` §2.

**Conventions**

- Import from `src/api` (flat names or namespaces such as `ordersApi`).
- Every function resolves to the response **body** `{success, message, data}`. On the web the same call returned the axios response, so web `res.data.data.x` is RN `res.data.x`.
- Errors are `ApiError {message, status, data, isNetworkError}`. The message is `body.message ?? body.error`.
- One axios client (`src/api/client.js`):
  - sends `Bearer restaurant_accessToken`;
  - on a 401, makes one shared refresh call to `POST /food/auth/refresh-token` and retries;
  - never refreshes on a 429;
  - sends no zone headers.
- Files are `{uri, name, type}` objects. `toUploadFile(asset)` accepts an expo-image-picker or expo-document-picker asset.

## 1. Endpoints

68 functions in total:

- the 62 working endpoints from audit §2 (#3, the refresh call, lives inside the client);
- 5 working `restaurantAPI` methods the web never calls (audit §2.14);
- `GET /app-config/restaurant_app`, which currently returns 404.

### Auth and onboarding (`src/api/auth.js`, `src/api/upload.js`, `src/api/zones.js`)

| # | Method | Path | RN function | File | Web function replaced |
|---|---|---|---|---|---|
| 1 | POST | `/food/auth/restaurant/request-otp` | `sendOTP(phone)` | auth.js | `restaurantAPI.sendOTP` → `requestRestaurantOtp` |
| 2 | POST | `/food/auth/restaurant/verify-otp` | `verifyOTP(phone, otp, fcmToken?, platform="mobile")` | auth.js | `restaurantAPI.verifyOTP` → `verifyRestaurantOtp` |
| 3 | POST | `/food/auth/refresh-token` | (internal) `refreshAccessToken` | client.js | axios interceptor |
| 4 | POST | `/food/auth/logout` | `logout(refreshToken, fcmToken, platform)` | auth.js | `restaurantAPI.logout` → `authService.logout` |
| 5 | GET | `/food/auth/me` | `getMe()` | auth.js | `restaurantAPI.getMe` |
| 6 | POST | `/food/restaurant/register` (multipart, no auth) | `register(fields \| FormData)` | auth.js | `restaurantAPI.register` |
| 7 | GET | `/food/zones/public` | `getPublicZones(params)` | zones.js | `zoneAPI.getPublicZones` |
| 8 | GET | `/food/zones/detect?lat&lng` | `detectZone(lat, lng)` | zones.js | `zoneAPI.detectZone` |
| 9 | POST | `/uploads/image` (`file`, `folder`) | `uploadMedia(file, {folder})` | upload.js | `uploadAPI.uploadMedia` |
| 10 | POST | `/uploads/file` (PDF) | `uploadFile(file, {folder})` | upload.js | `uploadAPI.uploadFile` |

### Profile, outlet and availability (`src/api/profile.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 11 | GET | `/food/restaurant/current` | `getCurrentRestaurant({noCache})` (3 s dedupe cache) | `restaurantAPI.getCurrentRestaurant` (`getRestaurantCurrentOnce`) |
| 12 | PATCH | `/food/restaurant/profile` | `updateProfile(body)`, `updateBankDetails(body)` | `restaurantAPI.updateProfile` (UpdateBankDetails uses it too) |
| 13 | PATCH | `/food/restaurant/availability` | `updateAcceptingOrders(bool)` | `restaurantAPI.updateAcceptingOrders` |
| 14 | POST | `/food/restaurant/profile/profile-image` (`file`) | `uploadProfileImage(file)` | `restaurantAPI.uploadProfileImage` |
| 15 | DELETE | `/food/restaurant/account` | `deleteAccount()` | `restaurantAPI.deleteAccount` |
| 22 | GET | `/food/restaurant/dining-settings/pending` | `getPendingDiningRequest()` | `restaurantAPI.getPendingDiningRequest` |
| §2.14 | PATCH | `/food/restaurant/dining-settings` | `updateDiningSettings(body)` | `restaurantAPI.updateDiningSettings` (unused on web) |
| §2.14 | POST | `/food/restaurant/dining-settings/request` | `requestDiningUpdate(body)` | `restaurantAPI.requestDiningUpdate` (unused on web) |
| §2.14 | POST | `/food/restaurant/profile/menu-image` (`file`) | `uploadMenuImage(file)` | `restaurantAPI.uploadMenuImage` (unused on web) |
| §2.14 | POST | `/food/restaurant/profile/cover-images` (`files[]`) | `uploadCoverImages(files)` | `restaurantAPI.uploadCoverImages` (unused on web) |
| §2.14 | POST | `/food/restaurant/profile/menu-images` (`files[]`) | `uploadMenuImages(files)` | `restaurantAPI.uploadMenuImages` (unused on web) |

The file also exports `invalidateCurrentRestaurant()`.

**Re-approval warning:** #12, #14 and cover-images reset an approved restaurant to `pending`. Warn the owner before calling them.

### Orders lifecycle and dining bookings (`src/api/orders.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 16 | GET | `/food/restaurant/orders?page&limit&status` | `getOrders(params, {force})` → `data:{orders, meta}`, statuses normalised | `restaurantAPI.getOrders` |
| 17 | GET | `/food/restaurant/orders/:orderId` | `getOrderById(id)` | `restaurantAPI.getOrderById` |
| 18 | PATCH | `/food/restaurant/orders/:orderId/status` | `updateOrderStatus(id, {orderStatus, note})` | `restaurantAPI.updateOrderStatus` |
| 18 | PATCH | same, `preparing`, retried as `confirmed` on 400 | `acceptOrder(id, prepTime)` | `restaurantAPI.acceptOrder` |
| 18 | PATCH | same, `cancelled_by_restaurant` + `note` | `rejectOrder(id, reason)` | `restaurantAPI.rejectOrder` |
| 18 | PATCH | same, `ready_for_pickup` | `markOrderReady(id)` | `restaurantAPI.markOrderReady` |
| 19 | POST | `/food/restaurant/orders/:orderId/resend-notification` | `resendDeliveryNotification(id, voipToken="")` | `restaurantAPI.resendDeliveryNotification` |
| 20 | GET | `/food/dining/bookings/restaurant/:restaurantId` | `getRestaurantBookings(idOrRestaurant)` | `diningAPI.getRestaurantBookings` |
| 21 | PATCH | `/food/dining/bookings/:bookingId/status` | `updateBookingStatusRestaurant(id, status)` | `diningAPI.updateBookingStatusRestaurant` |

Helpers in the same file: `RESTAURANT_ORDER_TAB_STATUS`, `normalizeOrderStatus`, `toBackendOrderStatus`, `isCancelledStatus` and `resolveOrderActionId`.

**Pickup OTP and handover:** the restaurant only displays the OTP. It arrives as `pickup_otp_reveal` on the socket, or as `pickupOtp` on the order rows. The rider verifies it, so there is no restaurant endpoint for handover.

### Menu, categories, items, variants, add-ons and inventory (`src/api/menu.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 23 | GET | `/food/restaurant/menu` | `getMenu(params)` | `restaurantAPI.getMenu` |
| 24 | GET | `/food/restaurant/categories` | `getCategories(params)` (compact), `getAllCategories(params)` (with counts and inactive) | `restaurantAPI.getCategories` / `getAllCategories` |
| 25 | POST | `/food/restaurant/categories` | `createCategory(body)` | `restaurantAPI.createCategory` |
| 26 | PATCH | `/food/restaurant/categories/:id` | `updateCategory(id, body)` | `restaurantAPI.updateCategory` |
| 27 | DELETE | `/food/restaurant/categories/:id` | `deleteCategory(id)` | `restaurantAPI.deleteCategory` |
| 28 | POST | `/food/restaurant/foods` (variants `[{name, price}]`) | `createFood(body)` | `restaurantAPI.createFood` |
| 29 | POST | `/food/restaurant/foods/bulk` | `bulkCreateFood(items)` | `restaurantAPI.bulkCreateFood` |
| 30 | PATCH | `/food/restaurant/foods/:id` | `updateFood(id, body)`, `setFoodAvailability(id, bool)`, `setFoodRecommended(id, bool)` | `restaurantAPI.updateFood` (the Inventory toggles) |
| 31 | DELETE | `/food/restaurant/foods/:id` | `deleteFood(id)` | `restaurantAPI.deleteFood` |
| 32 | GET | `/food/restaurant/addons` | `getAddons(params)` | `restaurantAPI.getAddons` |
| 33 | POST | `/food/restaurant/addons` | `addAddon(body)` | `restaurantAPI.addAddon` |
| 34 | PATCH | `/food/restaurant/addons/:id` | `updateAddon(id, body)`, `setAddonAvailability(id, bool)` | `restaurantAPI.updateAddon` |
| 35 | DELETE | `/food/restaurant/addons/:id` | `deleteAddon(id)` | `restaurantAPI.deleteAddon` |

### Offers and promocodes (`src/api/offers.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 36 | GET | `/food/promocodes` | `getPromocodes()` | `restaurantAPI.getPromocodes` |
| 37 | POST | `/food/promocodes` | `createPromocode(data)` | `restaurantAPI.createPromocode` |
| 38 | PATCH | `/food/promocodes/:id` | `togglePromocodeStatus(id, isActive)` | `restaurantAPI.togglePromocodeStatus` |
| 39 | DELETE | `/food/promocodes/:id` (204) | `deletePromocode(id)` | `restaurantAPI.deletePromocode` |

### Ratings, complaints and feedback (`src/api/feedback.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 40 | GET | `/food/restaurant/complaints` | `getComplaints(params)` | `restaurantAPI.getComplaints` |
| 59 | POST | `/food/restaurant/feedback-experience` | `submitFeedbackExperience({rating 1-5, comment})` | `api.post(FEEDBACK_EXPERIENCE_CREATE)` in ShareFeedback.jsx |

### Finance, withdrawals and bank (`src/api/finance.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 41 | GET | `/food/restaurant/finance?startDate&endDate` | `getFinance(params)` | `restaurantAPI.getFinance` |
| 42 | GET | `/food/restaurant/dashboard-stats?period` | `getDashboardStats(params)` | `restaurantAPI.getDashboardStats` |
| 43 | POST | `/food/restaurant/withdraw {amount, requestId}` | `createWithdrawalRequest(amount)` | `restaurantAPI.createWithdrawalRequest` |
| 44 | GET | `/food/restaurant/withdrawals` | `getWithdrawalHistory()` | `restaurantAPI.getWithdrawalHistory` |

Bank details are saved through #12 with `updateBankDetails`.

### Outlet timings and delivery settings (`src/api/outlet.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 45 | GET | `/food/restaurant/outlet-timings` | `getOutletTimings()` | `restaurantAPI.getOutletTimings` |
| 46 | PUT | `/food/restaurant/outlet-timings` | `saveOutletTimings(outletTimings)` | `restaurantAPI.saveOutletTimings` |

Delivery settings use #11 and #13.

### Notifications inbox (`src/api/notifications.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 47 | GET | `/food/notifications/inbox?page=1&limit=50` | `getInbox(params)` | `notificationAPI.getInbox` |
| 48 | PATCH | `/food/notifications/:id/read` | `markAsRead(id)` | `notificationAPI.markAsRead` |
| 49 | DELETE | `/food/notifications/:id` | `dismiss(id)` | `notificationAPI.dismiss` |
| 50 | DELETE | `/food/notifications/inbox/all` | `dismissAll()` | `notificationAPI.dismissAll` |

### Push and FCM (`src/api/push.js`, driven by `src/lib/push.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 51 | POST | `/fcm-tokens/save` | `saveFcmToken(token, "web")` | `restaurantAPI.saveFcmToken` |
| 52 | POST | `/fcm-tokens/mobile/save` | `saveFcmToken(token, "mobile")` | `restaurantAPI.saveFcmToken(token,'mobile')` |
| 53 | POST | `/fcm-tokens/device/save` | `savePushDevice({fcmToken, pushPlatform, devicePlatform, deviceId})` | `restaurantAPI.savePushDevice` |
| 54 | DELETE | `/fcm-tokens/remove` | `removeFcmToken(token, platform)` | `restaurantAPI.removeFcmToken` |
| 55 | DELETE | `/fcm-tokens/device/remove` | `removePushDevice({deviceId, fcmToken})` | `restaurantAPI.removePushDevice` |
| 56 | POST | `/fcm-tokens/test` | `sendTestNotification(platform, channel)` | `notificationAPI.sendTestNotification` |

### Support (`src/api/support.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 57 | POST | `/food/restaurant/support/tickets` | `createSupportTicket(body)` | `restaurantAPI.createSupportTicket` |
| 58 | GET | `/food/restaurant/support/tickets` | `getSupportTickets(params)` | `restaurantAPI.getSupportTickets` |

### CMS and config (`src/api/content.js`)

| # | Method | Path | RN function | Web function replaced |
|---|---|---|---|---|
| 60 | GET | `/food/pages/privacy` | `getPrivacy()` / `getPage("privacy")` | PrivacyPolicyPage `api.get` |
| 61 | GET | `/food/pages/terms` | `getTerms()` | TermsAndConditionsPage `api.get` (production returns `data:null`) |
| 62 | GET | `/food/admin/business-settings/public` | `getBusinessSettings()` | `utils/businessSettings.js` |
| extra | GET | `/app-config/restaurant_app` | `getAppConfig()` (404 today; ThemeContext keeps the defaults) | `utils/themeSettings.js applyDynamicTheme` |

The file also exports the helper `publicGetOnce(url, {noCache, params})`.

## 2. Skipped or not ported

| Web call site | Reason |
|---|---|
| `restaurantAPI.reverify()` (OrdersMain.jsx:1487) | Undefined on the web; it would throw a TypeError. There is no backend endpoint. |
| `restaurantAPI.resetPassword`, `verifyOTP(null, …, email)` (ForgotPassword.jsx) | Dead email/password flow. Restaurants use phone OTP only. |
| `restaurantAPI.login(email, password)` | It always rejects on the web. |
| `GET /restaurant/onboarding` (`checkOnboardingStatus`) | 404 in production. `lib/onboarding.checkOnboardingStatus` uses `/food/auth/me` plus the local draft step, which matches what the web does when the call fails. |
| `/uploads/single` fallback | 404 in production. |
| `restaurantAPI.updateMenu` (PATCH `/food/restaurant/menu`) | Always returns 400 "Menu editing is disabled". |
| `restaurantAPI.getRestaurantByOwner` (HubFinance.jsx:92) | Hard-coded stub ("REST000001"). Use `getFinance().data.restaurant`. |
| Socket `new_dining_booking`, `play_notification_sound` | The backend never emits them. |
| Socket `reconnect` / `reconnect_attempt` listeners | These are Manager events in socket.io v4 and never fire on the socket. Re-join happens on `connect`. |
| `search` param on getOrders (RestaurantNavbar.jsx:70) | The backend ignores it. Callers can still pass it, but it has no effect. |
| Prep time in `acceptOrder` | The backend has no field for it. The argument is kept for parity and not sent (audit §6 #6). |
| EditOwner.jsx reading `data.image` after a profile-image upload | Web bug. The correct key is `data.profileImage.url`, as documented in `uploadProfileImage`. |
| `menuImages` / `menuPdf` never appended at register (web bug) | Not skipped: `register()` accepts and sends them. |
| `getPublicOffers`, `getCouponsByItemIdPublic`, `getRestaurants`, `getRestaurantById`, `getMenuByRestaurantId`, `getOutletTimingsByRestaurantId`, `getAddonsByRestaurantId` | Customer-app endpoints that live on `restaurantAPI`. Restaurant screens do not use them. |
| `GET /food/restaurant/download-menu-pdf/:id` | The frontend only uses the admin variant. |
| DownloadReport, RatingsReviews, DishRatings, FssaiDetails, FssaiUpdate, Hyperpure, ManageOutlets, PhoneNumbersPage, FinanceDetailsPage, RushHour, DaySlots | UI-only or mock screens with no backend (audit §2.13). An FSSAI update is #12 with `fssaiNumber`, `fssaiExpiry` and `fssaiImage`. |
| Flutter bridge (`flutter_inappwebview` getFcmToken, native sound) | Replaced by expo-notifications (`lib/push`) and expo-audio (`lib/ring`). |

## 3. Contexts, libs and hooks

### `useAuth()`: `src/context/AuthContext.js`

- `ready`: `true` once the stored tokens have been read.
- `isAuthenticated`: `true` with an unexpired RESTAURANT access token or an unexpired refresh token (the web's `isModuleAuthenticated`).
- `restaurant`: the verify-otp `user`, replaced by the full `/current` restaurant once it loads. Stored under `food:v1:auth:restaurant:user`.
- `restaurantId`: `restaurant._id || restaurant.id`.
- `pendingPhone`: `restaurant_pendingPhone`. Saved on needsRegistration, on pendingApproval and after register.
- `pendingApproval`: the last `{phone, status, isRejected, rejectionReason}`. It is the web's router state for pending-verification.
- `requestOtp(phone)`: request-otp. Use it for Login, Signup and Resend.
- `verifyOtp({phone, otp, isSignUp?, fcmToken?})` resolves to one of the following. It fetches the FCM token without a permission prompt and sends it with `platform:"mobile"`.
  - `{outcome:"needsRegistration", phone}`: go to onboarding.
  - `{outcome:"pendingApproval", phone, status, isRejected, rejectionReason}`: go to pending-verification. An error whose message matches `/pending approval/i` also resolves this way.
  - `{outcome:"authenticated", restaurant, onboardingStep}`: if `onboardingStep` is set, go to `onboarding?step=N`; otherwise go to `/`.
- `register(fields | FormData)`: multipart register. Afterwards, go to pending-verification.
- `refreshRestaurant({noCache})`: GET `/current`, then updates `restaurant`. Returns the restaurant.
- `updateRestaurant(partial | fn)`: merges a mutation result into the local restaurant.
- `logout()`: the web order:
  1. device/remove;
  2. fcm remove;
  3. `/food/auth/logout {refreshToken, fcmToken, platform:"mobile"}`;
  4. clears `restaurant_*` tokens and the session-cache keys.
- `onLogout(fn)`: called on logout and on session expiry. Returns an unsubscribe.
- `setPendingPhone(phone)` / `clearPendingPhone()`: manage the pending phone.

### `useRestaurantGuard()`: `src/context/RestaurantGuardContext.js` (RestaurantBlockGuard)

- `status`: `"idle" | "loading" | "active" | "blocked"`. Polls `/current` every 30 s while logged in and in the foreground, and checks immediately when the app returns to the foreground.
- `checking`: `true` until the first check finishes. Show the web's "Checking account status…" spinner.
- `blocked`: `status === "rejected"` (or `isActive === false`). Polling stops. Show "Account Blocked" with a Logout button.
- `blockReason`: always `"Disabled by admin"` in practice, because `/current` does not return `rejectionReason`.
- `restaurantStatus` / `pending` / `rejected` / `approved`: the current `restaurant.status`. Pending is not blocked, as on the web.
- `pendingUpdateReason`: why the restaurant is pending again (for example "Menu Update").
- `recheck()`: checks now.
- A 401 logs the restaurant out. Network errors count as active.

### `useRestaurantNotifications()`: `src/context/RestaurantNotificationsContext.js` (one socket for the whole app)

- `newOrder`: the head of the alert queue (`orderQueue[0]`).
- `orderQueue`: orders waiting for a decision. Deduplicated by any id.
- `isConnected`: socket state.
- `isRinging`: the ring loop is active.
- `muted` / `setMuted(bool | fn)`: the web popup's mute toggle. Muting stops the ring; unmuting restarts it for the active order.
- `stopAlert()`: stops the ring only.
- `clearNewOrder()`: the web `clearNewOrder` (stops the ring and pops the queue head).
- `popupOrder` / `showNewOrderPopup`: the new-order popup to render globally.
- `acceptDeadline`: an epoch-ms timestamp, 180 s after the popup opened. When it passes, the order is auto-rejected with "No response from restaurant (Auto-rejected)".
- `actionInFlight`: `"accept" | "reject" | null`.
- `acceptNewOrder(prepTimeMins?)`: `acceptOrder` (`preparing`, retried as `confirmed`), then closes the popup. Throws `ApiError`; show the web toasts (400 shows the message, 404 shows "Order not found…").
- `rejectNewOrder(reason)`: `rejectOrder`, then closes the popup.
- `dismissNewOrder()`: the web's "cancel" on the reject dialog. Closes the popup without an API call and marks the order viewed.
- `pickupOtpReveal`: `{orderMongoId, orderId, otp, message}` or `null`. Persisted as `restaurant_pickupOtpReveal`. Render the "Delivery Partner Arrived" modal from it.
- `clearPickupOtpReveal()`: the modal's "Got it".
- `refreshNow(limit = 30)`: a reconciliation fetch.
- `subscribe(fn)`: provider events. See `useRestaurantEvents`.

### Hooks in the same file

- `useAcceptCountdown()`: seconds left in the 180 s window. It ticks only in the component that calls it.
- `useRestaurantEvents(handler)`: replaces the web's window events. Event types:
  - `status_update`: the raw `order_status_update` payload.
  - `cancelled` (`byUser`): toast "Order canceled by user" or "Order cancelled".
  - `admin_assigned`: toast "Order assigned by admin to you".
  - `accepted`, `rejected`, `auto_rejected`: "Order auto-rejected due to no response".
  - `scheduled_order`: toast "New scheduled order received for HH:MM".
  - `orders_refresh`: refetch the order lists.
  - `pickup_otp_reveal`.
  - `admin_notification`: refetch the inbox.

### `src/lib/socket.js`

- `connectRestaurantSocket(id)`: connects to `SOCKET_URL`, path `/socket.io`, with transports websocket then polling, `auth:{token}`, and infinite reconnection with a 1–5 s delay. Emits `join-restaurant` on connect and again 2 s later.
- `disconnectRestaurantSocket()`: closes the connection.
- `ensureSocketConnected()`: reconnects if the connection dropped.
- `subscribeRestaurantEvents({new_order, order_status_update, pickup_otp_reveal, admin_notification, "restaurant-room-joined"})`: returns an unsubscribe.
- `isSocketConnected()` / `subscribeSocketConnection(fn)`: connection state.
- `RESTAURANT_SOCKET_EVENTS`: the list of events above.

### `src/lib/ring.js`

- `startRing(key)`: plays immediately, then every 6 s for up to 120 s. Each play also vibrates `[200,100,200,100,300]`.
- `stopRing()`: stops the loop.
- `playRingOnce()`: one ring and one vibration.
- `prepareRing()`: sets up the player and audio mode ahead of time.
- `releaseRing()`: releases the player (on logout).
- `isRinging()` / `getRingingKey()` / `subscribeRing(fn)`: ring state.
- `ALERT_LOOP_INTERVAL_MS` / `ALERT_LOOP_MAX_MS`: the 6 s and 120 s constants.

### `src/lib/push.js`

- `configureNotificationHandler()`: call once at startup. A foreground `new_order` push starts the in-app ring and is shown without the system sound. Other pushes are shown with sound.
- `ensureAndroidChannel()`: creates channel `default` with importance MAX, sound `restaurant_order_ring.wav`, vibration, public lock-screen visibility and NOTIFICATION_RINGTONE usage.
- `getPushTokenForLogin()`: gets the FCM token without prompting. Used by verify-otp.
- `registerForPushNotifications()`: asks for permission, gets the token and calls `/fcm-tokens/device/save` with `{pushPlatform:"mobile", devicePlatform:"android", deviceId:"tuggo:restaurant:android:<last16>"}`.
- `subscribePushTokenRefresh()`: calls device/save again when the token rotates.
- `unregisterPushDevice()`: device/remove, then fcm remove. `useAuth().logout()` already calls it.
- `setNewOrderPushHandler(fn)`: used by the provider.
- `getNotificationTarget(data)`: returns a web path. `new_order` and `order_status_update` map to `/restaurant/orders/<id>`, which also fixes the backend's `/food/user/orders` link.
- `addNotificationTapListener(navigate)`: calls `navigate(webPath, data)`, including for the notification that cold-started the app. Map the path with `toNativePath`.

### `src/lib/onboarding.js`

- `isRestaurantOnboardingComplete(restaurant)`, `determineStepToShow(data)` and `checkOnboardingStatus()`: ports of the web's onboardingUtils.

### `src/navigation/back.js` and `src/navigation/links.js`

- `resolveBackPath(pathname, params)`: the web's fixed parent rules, plus the screen exceptions:
  - Notifications goes to `/`;
  - WithdrawalHistory goes to `/hub-finance`;
  - OutletTimings goes to `/explore`;
  - Promocodes and EditCuisines return `null`, which means a stack pop.
- `useAppBack()`: the header back arrow.
- `useBackOverride(fn)`: closes sheets first while the screen is focused.
- `HardwareBackBinding`: mount once in the root layout. Back on the tab roots `/inventory`, `/feedback` and `/explore` goes to `/`; back on `/` exits the app.
- `goTo(path)`: navigates with `router.dismissTo`.
- `toNativePath(webPath)`: strips `/food/restaurant` and `/restaurant`, and maps `/food/user/orders/<id>` to `/orders/<id>`.
- `openLink(link)`: internal paths navigate inside the app; external URLs open outside it.

### `useTheme()`: `src/theme/ThemeContext.js` (light only)

- `colors`: the light tokens. They include `primary` (default `#B80B3D`, or the admin `primaryColor`), `primaryStrong` / `secondary` (`#66001D`, or `secondaryColor`), `primarySoft`, `rtBorder`, the tints `primaryTint3…25`, `primaryBorder` and `focusBorder`.
- `headerGradient`: `["#B80B3D", "#66001D"]`, hard-coded as on the web.
- `logoUrl`, `fontFamily`: from `/app-config/restaurant_app`.
- `mode` is always `"light"` and `isDark` is always `false`. `setMode` and `toggleMode` do nothing.
- `applyAppConfig(cfg)`: applies an app config.
- In `tokens.js`:
  - `rtButtonColor(color, colors)` applies the theme rule: black and gray-900 buttons, and `#EB590E`, render in `primary`.
  - `mixWithWhite(hex, amount)` and `derivePrimaryTokens(primary)` compute the tints.

## 4. Decisions

- **Polling.** The web polled orders every 8 s regardless of the socket, which already exceeds the limit of 100 requests per 15 minutes per user. Here:
  - while the socket is connected, there is no interval poll. One reconciliation fetch runs on each (re)connect, which catches orders missed while offline;
  - while the socket is disconnected, the app polls every 30 s;
  - when the app returns to the foreground, one fetch runs (the web's `visibilitychange` handler).
  - The worst case is 30 order requests plus 30 `/current` block-guard requests per 15 minutes.
  - The OrdersMain 60 s `checkOrdersToPopup` is folded into this queue. The fallback poll enqueues `confirmed` orders, and the popup shows the queue head.
- **Ringing.** The web rang only on desktop; the phone app always rings.
  - **Start:**
    - a socket `new_order` always rings (a backend resend rings again and re-shows the popup);
    - a poll or a foreground push rings at most once per 15 s per order;
    - a queued order rings when its popup opens.
  - **Stop:** accept, reject, dismiss ("viewed"), cancel (socket or poll), mute, 120 s elapsed, or logout.
  - **RN additions:**
    - an order handled elsewhere (any status other than `created` from another device or admin) stops the ring and leaves the queue;
    - a dismissed order is not re-rung by the fallback poll (on the web, the 8 s poll re-rang every unaccepted order roughly every 16 s).
- **Audio.**
  - expo-audio `createAudioPlayer` with `playsInSilentMode:true`. On Android, `false` would suppress playback in silent or vibrate mode; `true` lets it play on the media stream, so media volume 0 still mutes it.
  - `interruptionMode:"duckOthers"` lowers other apps' audio.
  - Each play also calls `Vibration.vibrate`.
  - JS timers stop while the app is backgrounded. In the background and when the app is killed, the system notification on channel `default` plays `restaurant_order_ring.wav` once per push.
- **Auto-reject.** If the auto-reject API call fails, the popup closes and the queue advances. On the web the queue could get stuck here.
- **The 401 refresh call does not check restaurant status** (backend behaviour). Blocked restaurants are hidden only by the guard poll, as on the web.
