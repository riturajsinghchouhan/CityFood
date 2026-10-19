# API map: web → mobile-user

Every customer endpoint the web app calls, where it lives in `mobile-user/src`, and the web function it replaces.

## Conventions

- All paths are relative to `API_BASE_URL` (`https://cityfood.co.in/api/v1`).
- All HTTP goes through `src/api/client.js`. It handles Bearer auth, the zone headers, single-flight refresh, and `ApiError`.
- Import functions flat (`import { getAddresses } from "../api"`) or through a namespace (`addressesApi.getAddresses`). Namespaces: `profileApi`, `addressesApi`, `locationApi`, `restaurantsApi`, `contentApi`, `ordersApi`, `walletApi`, `supportApi`, `notificationsApi`, `pushApi`, `diningApi`.
- **Return value:** functions resolve to the backend body `{success, message, data}`. Web code that read `res.data.data.x` becomes `res.data.x` here.
- **Already unwrapped:** a few helpers return `data` directly, as on web. These are `getPublicLandingSettings`, `getPublicExploreIcons`, `getPublicGourmetRestaurants` (an array), `getPublicCategories` and `getPublicFoods`.
- **Caches:**
  - Functions marked "cached" dedupe in-flight requests and reuse a result for the TTL shown.
  - Wherever the web accepted `{ noCache: true }` as config, it is accepted here too.
  - Address, profile and wallet mutations invalidate their read cache.
- **Images:** `resolveAssetUrl(url)` (`src/api/assets.js`) turns `/uploads/x.webp` into `https://cityfood.co.in/uploads/x.webp`. `resolveImage(v)` does the same for both the `{url}` and the plain-string forms of `profileImage`.
- **Uploads:**
  - `toUploadFile(asset)` turns an image-picker asset into `{uri, name, type}`.
  - `postMultipart(url, fields)` posts `FormData` with `UPLOAD_TIMEOUT_MS`.

## Ported endpoints (72 distinct method+path pairs in `src/api`, plus 4 auth endpoints in existing files)

### Auth (already in `src/context/AuthContext.js` / `src/api/client.js`, not duplicated)

| Method | Path | Mobile | Web |
|---|---|---|---|
| POST | `/food/auth/user/request-otp` | `useAuth().requestOtp` | `authAPI.sendOTP` |
| POST | `/food/auth/user/verify-otp` | `useAuth().verifyOtp` | `authAPI.verifyOTP` |
| POST | `/food/auth/refresh-token` | client interceptor | axios interceptor |
| POST | `/food/auth/logout` | `useAuth().logout` | `authAPI.logout` |

### Profile: `src/api/profile.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | `/food/auth/me` | `getCurrentUser` | `authAPI.getCurrentUser` | cached 3 s |
| GET | `/food/auth/me` | `getProfile` | `userAPI.getProfile` | same request; user always at `data.user` |
| PATCH | `/food/user/profile` | `updateProfile(body)` | `userAPI.updateProfile` | |
| POST | `/food/user/profile/profile-image` | `uploadProfileImage(asset)` | `userAPI.uploadProfileImage` | multipart field `file` |
| DELETE | `/food/user/account` | `deleteAccount()` | `userAPI.deleteAccount` | |

### Addresses: `src/api/addresses.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | `/food/user/addresses` | `getAddresses` | `userAPI.getAddresses` | cached 3 s |
| POST | `/food/user/addresses` | `addAddress(body)` | `userAPI.addAddress` | |
| PATCH | `/food/user/addresses/:id` | `updateAddress(id, body)` | `userAPI.updateAddress` | |
| DELETE | `/food/user/addresses/:id` | `deleteAddress(id)` | `userAPI.deleteAddress` | |
| PATCH | `/food/user/addresses/:id/default` | `setDefaultAddress(id)` | `userAPI.setDefaultAddress` | |

### Location and zones: `src/api/location.js`

| Method | Path | Function | Web |
|---|---|---|---|
| GET | `/food/location/reverse-geocode` | `reverseGeocode(lat, lng)` | `locationAPI.reverseGeocode` |
| POST | `/food/location/distance` | `computeDistance(body)` | `locationAPI.computeDistance` |
| GET | `/food/zones/detect` | `detectZone(lat, lng)` | `zoneAPI.detectZone` |
| GET | `/food/zones/public` | `getPublicZones(params)` | `zoneAPI.getPublicZones` |
| GET | `/food/user/location` | `getLocation()` | `userAPI.getLocation` |
| PUT | `/food/user/location` | `updateLocation(payload)` | `userAPI.updateLocation` |

### Restaurants, catalog and search: `src/api/restaurants.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | `/food/restaurant/restaurants` | `getRestaurants(params, config)` | `restaurantAPI.getRestaurants` | cached 1 s; default `limit: 1000` |
| GET | `/food/restaurant/restaurants/:idOrSlug` | `getRestaurantById(id)` | `restaurantAPI.getRestaurantById` | |
| GET | `/food/restaurant/restaurants/:id/menu` | `getMenuByRestaurantId(id)` | `restaurantAPI.getMenuByRestaurantId` | cached 5 min |
| GET | `/food/restaurant/restaurants/:id/outlet-timings` | `getOutletTimingsByRestaurantId(id)` | `restaurantAPI.getOutletTimingsByRestaurantId` | cached 5 min |
| GET | `/food/restaurant/restaurants/:id/addons` | `getAddonsByRestaurantId(id)` | `restaurantAPI.getAddonsByRestaurantId` | |
| GET | `/food/restaurant/offers` | `getPublicOffers()` | `restaurantAPI.getPublicOffers` | |
| GET | `/food/restaurant/offers` | `getCouponsByItemIdPublic(restaurantId)` | `restaurantAPI.getCouponsByItemIdPublic` | same client-side adaptation into `data.coupons` |
| GET | `/food/restaurant/categories/public` | `getPublicCategories(zoneId)` | `getPublicCategories` | cached 5 min; unwrapped |
| GET | `/food/restaurant/foods/public` | `getPublicFoods(params)` | `getPublicFoods` | cached 5 min; unwrapped |
| GET | `/food/search/unified` | `unifiedSearch(params)` | `searchAPI.unifiedSearch` | |
| GET | `/food/search/categories/admin` | `getSearchCategories(params)` | (`adminAPI.getPublicCategories`, broken) | public; working version of the broken call |
| GET | `/food/promocodes/restaurant/:id` | `getActivePromocodes(id)` | `userAPI.getActivePromocodes` | |
| POST | `/food/promocodes/validate` | `validatePromocode(body)` | `userAPI.validatePromocode` | |

### Landing, CMS and config: `src/api/content.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | any public path | `publicGetOnce(url, config)` | `publicGetOnce` | cached 5 min |
| GET | `/food/landing/settings/public` | `getPublicLandingSettings(zoneId)` | `getPublicLandingSettings` | cached; unwrapped |
| GET | `/food/explore-icons/public` | `getPublicExploreIcons(zoneId)` | `getPublicExploreIcons` | cached; unwrapped |
| GET | `/food/hero-banners/gourmet/public` | `getPublicGourmetRestaurants(zoneId)` | `getPublicGourmetRestaurants` | cached; returns an array |
| GET | `/food/hero-banners/gourmet/public` | `getGourmetRestaurants(zoneId)` | `api.get` in Gourmet.jsx | uncached |
| GET | `/food/hero-banners/public` | `getHeroBanners(zoneId)` | `publicGetOnce` in Home.jsx | cached |
| GET | `/food/hero-banners/ads/public` | `getAdBanners(zoneId)` | `publicGetOnce` in Home.jsx | cached |
| GET | `/food/hero-banners/under-250/public` | `getUnder250Banners(zoneId)` | `api.get` in Under250.jsx | |
| GET | `/food/app-intro-ads/public` | `getAppIntroAds()` | `api.get` in AppIntroSplash.jsx | |
| GET | `/food/pages/:key` | `getPage(key)`, `getAbout`, `getTerms`, `getPrivacy`, `getRefund`, `getShipping`, `getCancellation` | `publicAPI.getTerms/getPrivacy`, `api.get(API_ENDPOINTS.ADMIN.*_PUBLIC)` | `data` is null if the page was never saved |
| GET | `/food/admin/business-settings/public` | `getBusinessSettings()` | `publicAPI.getBusinessSettings` | prefer `useAppSettings()`, which caches it for 6 h |
| GET | `/app-config/:appName` | `getAppConfig("user_app")` | `applyDynamicTheme` (themeSettings.js) | AppSettingsProvider applies it to the theme |

### Orders: `src/api/orders.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | `/food/orders/check-rider-availability` | `checkRiderAvailability(params)` | `orderAPI.checkRiderAvailability` | |
| POST | `/food/orders/calculate` | `calculateOrder(payload)` | `orderAPI.calculateOrder` | |
| POST | `/food/orders` | `createOrder(payload)` | `orderAPI.createOrder` | |
| POST | `/food/orders/verify-payment` | `verifyPayment(body)` | `orderAPI.verifyPayment` | |
| GET | `/food/orders` | `getOrders(params)` | `orderAPI.getOrders` | normalized to `data.orders` and `data.pagination`. Also replaces the broken `userAPI.getOrders`: use `getOrders({limit: 1})`, then `data.pagination.total` |
| GET | `/food/orders/:id` | `getOrderDetails(id, {force})` | `orderAPI.getOrderDetails` | cached 800 ms |
| PATCH | `/food/orders/:id/cancel` | `cancelOrder(id, body)` | `orderAPI.cancelOrder` | |
| PATCH | `/food/orders/:id/instructions` | `updateOrderInstructions(id, text)` | `orderAPI.updateOrderInstructions` | |
| PATCH | `/food/orders/:id/ratings` | `submitOrderRatings(id, body)` | `orderAPI.submitOrderRatings` | |
| POST | `/food/user/support/ticket` | `submitComplaint(payload)` | `orderAPI.submitComplaint` | `{type: "order", ...}` |

### Wallet and referrals: `src/api/wallet.js`

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| GET | `/food/user/wallet` | `getWallet` | `userAPI.getWallet` | cached 3 s |
| POST | `/food/user/wallet/topup/order` | `createWalletTopupOrder(amount)` | `userAPI.createWalletTopupOrder` | |
| POST | `/food/user/wallet/topup/verify` | `verifyWalletTopupPayment(body)` | `userAPI.verifyWalletTopupPayment` | |
| GET | `/food/user/referrals/stats` | `getReferralStats()` | `userAPI.getReferralStats` | |
| GET | `/food/user/referrals/details` | `getReferralDetails()` | `userAPI.getReferralDetails` | |

### Support and safety: `src/api/support.js`

| Method | Path | Function | Web |
|---|---|---|---|
| POST | `/food/user/support/ticket` | `createTicket(body)` | `supportAPI.createTicket` |
| GET | `/food/user/support/my-tickets` | `getMyTickets(params)` | `supportAPI.getMyTickets` |
| POST | `/food/user/safety-emergency-reports` | `createSafetyEmergencyReport(message)` | `userAPI.createSafetyEmergencyReport` |
| GET | `/food/user/safety-emergency-reports` | `getMySafetyEmergencyReports(params)` | `userAPI.getMySafetyEmergencyReports` |

### Notification inbox: `src/api/notifications.js`

| Method | Path | Function | Web |
|---|---|---|---|
| GET | `/food/notifications/inbox` | `getInbox(params)` | `notificationAPI.getInbox` |
| PATCH | `/food/notifications/:id/read` | `markAsRead(id)` | `notificationAPI.markAsRead` |
| DELETE | `/food/notifications/:id` | `dismiss(id)` | `notificationAPI.dismiss` |
| DELETE | `/food/notifications/inbox/all` | `dismissAll()` | `notificationAPI.dismissAll` |

### Push tokens: `src/api/push.js` (used by `src/lib/push.js`)

| Method | Path | Function | Web | Notes |
|---|---|---|---|---|
| POST | `/fcm-tokens/save`, `/fcm-tokens/mobile/save` | `saveFcmToken(token, {platform})` | `userAPI.saveFcmToken` | deduped for 24 h; `mobile` uses the mobile path |
| POST | `/fcm-tokens/device/save` | `savePushDevice(payload)` | `userAPI.savePushDevice` | |
| DELETE | `/fcm-tokens/device/remove` | `removePushDevice(payload)` | `userAPI.removePushDevice` | |
| DELETE | `/fcm-tokens/remove` | `removeFcmToken(token, {platform})` | `userAPI.removeFcmToken` | |
| POST | `/fcm-tokens/test` | `sendTestNotification(platform, channel)`, `testFcmNotification({platform})` | `notificationAPI.sendTestNotification`, `userAPI.testFcmNotification` | |

### Dining: `src/api/dining.js`

| Method | Path | Function | Web |
|---|---|---|---|
| GET | `/food/dining/categories/public` | `getDiningCategories(params)` | `diningAPI.getCategories` |
| GET | `/food/dining/restaurants/public` | `getDiningRestaurants(params)` | `diningAPI.getRestaurants` |
| GET | `/food/dining/restaurants/:id/occupied-seats/public` | `getOccupiedSeatsPublic(id)` | `diningAPI.getOccupiedSeatsPublic` |
| GET | `/food/hero-banners/ads/public` | `getDiningHeroBanners()` | `diningAPI.getHeroBanners` |
| GET | `/food/restaurant/restaurants/:slug` | `getRestaurantBySlug(slug)` | `diningAPI.getRestaurantBySlug` |
| GET | `/food/dining/bookings/my` | `getBookings()` | `diningAPI.getBookings` |
| POST | `/food/dining/bookings` | `createBooking(payload)` | `diningAPI.createBooking` |
| POST | `/food/dining/bookings/:id/review` | `createReview(payload)` | `diningAPI.createReview` |

## Deliberately skipped

| Web call | Reason |
|---|---|
| `GET /food/admin/fee-settings/public` (`adminAPI.getPublicFeeSettings`, Cart.jsx) | Sits behind admin auth, so customers always get 401/403. Cart pricing comes from `calculateOrder`. |
| `diningAPI.getRestaurantBookings` → `GET /food/dining/bookings/restaurant/:id` (TableBooking.jsx) | RESTAURANT/ADMIN role only, so it always fails for customers. |
| `diningAPI.updateBookingStatusRestaurant` | Restaurant only. |
| `restaurantAPI.getPublicDishes` (SearchOverlay.jsx) | Method undefined and no backend route. Use `getPublicFoods`. |
| `restaurantAPI.getInventoryByRestaurantId` (RestaurantDetails.jsx) | Method undefined and no backend route. Use the menu items' `isAvailable`. |
| `adminAPI.getPublicCategories` (Categories.jsx, ProfessionalSearch.jsx) | Method undefined. Ported as `getSearchCategories` (public `/food/search/categories/admin`), or use `getPublicCategories`. |
| `userAPI.getOrders` (Cart.jsx first-order coupon count) | Method undefined. Use `getOrders({limit: 1})`. |
| `diningAPI.getOfferBanners`, `getStories`, `getBankOffers` | Web stubs that resolve to `[]` with no request; there is no endpoint. |
| `uploadAPI.uploadMedia` / `uploadFile` (`/uploads/image`, `/uploads/file`) | Not used by customer screens. The profile photo goes through `uploadProfileImage`. |
| `GET /food/user/profile`, `/food/referral-settings`, `/food/orders/:id/payments`, `/food/orders/:id/drop-otp` | Exist on the backend but the web never calls them. |
| Every `adminAPI`, `restaurantAPI` (dashboard), `deliveryAPI` method | Not customer-facing. |
| Direct Google Geocoding / Nominatim calls in AddressSelectorPage.jsx and SelectAddress.jsx (search/forward geocoding) | Screen-level third-party calls. The reverse-geocode chain is in LocationContext (`reverseGeocode`). |

## Contexts

Use `<AppProviders>` (`src/context/AppProviders.js`) to mount all of them in the right order:

> Auth → Theme → AppSettings → Location → Profile → Cart → Orders → UserNotification → SearchOverlay

Every context clears its per-user state on `useAuth().onLogout`.

### `useCart()`: `src/context/CartContext.js`

Persisted under `KEYS.cart`. The line shape is exactly the web's.

**State**

- `ready`: the saved cart has loaded.
- `cart`: raw lines. Each line is `{id: "<itemId>::<variantId|base>", itemId, productId, name, price, quantity, image, imageUrl, restaurant (name), restaurantId, variantId, variantName, variantPrice, originalPrice?, isVeg?, foodType?, ...}`.
- `items`: animation shape `[{product: {id, name, imageUrl}, quantity}]`.
- `itemCount`: total quantity.
- `total`: `sum(price * quantity)`.
- `restaurantId`, `restaurantName`: the restaurant of the current cart.
- `lastAddEvent`, `lastRemoveEvent`: `{product, sourcePosition}`, cleared after 1.5 s.

**Actions**

- `addToCart(item, sourcePosition?)`: returns `{ok: true}`, or `{ok: false, code: "RESTAURANT_MISMATCH" | "MISSING_RESTAURANT", error, cartRestaurant?}`.
  - Restaurants are compared by name first. Ids are compared only when both names are missing.
  - The web only shows `error` as a toast.
- `clearCartAndAdd(item, sourcePosition?)`: the "replace cart" choice after a `RESTAURANT_MISMATCH`.
- `removeFromCart(itemId, sourcePosition?, productInfo?)`
- `updateQuantity(itemId, quantity, sourcePosition?, productInfo?)`: a quantity of 0 or less removes the line.
- `getCartCount()`, `isInCart(itemId, variantId?)`, `getCartItem(itemId, variantId?)`
- `clearCart()`
- `replaceCart(items)`: reorder. Returns `{ok, count}`.
- `cleanCartForRestaurant(restaurantId, restaurantName)`
- `buildCartLineId(itemId, variantId)`: exported helper.

### `useProfile()`: `src/context/ProfileContext.js`

**State**

- `userProfile`: the `/food/auth/me` user. It is also written to `useAuth().user`.
- `loading`, `isAuthenticated`
- `addresses`: normalized. `label` is `Home`, `Office` or `Other`, with one address per label.
- `favorites`: restaurants, keyed by `slug`.
- `dishFavorites`: keyed by `id` + `restaurantId`.
- `vegMode`, `setVegMode`, `vegModeOption`, `setVegModeOption`

**Actions**

- `refreshProfile()`: re-fetches the profile and addresses.
- `updateUserProfile(partial)`: local merge.
- `addAddress(body)`: resolves to the normalized address.
- `updateAddress(id, body)`
- `deleteAddress(id)`
- `setDefaultAddress(id)`:
  1. Marks the address as default straight away.
  2. Switches the delivery location to it (`mode: "saved"`).
  3. Then calls the API. A failure is ignored.
- `getDefaultAddress()`, `getAddressById(id)`
- `addFavorite(restaurant)`, `removeFavorite(slug)`, `isFavorite(slug)`, `getFavorites()`
- `addDishFavorite(dish)`, `removeDishFavorite(dishId, restaurantId)`, `isDishFavorite(dishId, restaurantId)`, `getDishFavorites()`

**Helpers:** `addressToLocation(address, existing?)` and `normalizeAddressLabel(label)` are also exported.

### `useAppLocation()` (alias `useLocationContext`): `src/context/LocationContext.js`

**State**

- `ready`: storage has loaded.
- `location`: in `saved` mode, the saved override or the stored location; otherwise the GPS location.
- `effectiveLocation`, `storedLocation`
- `deliveryAddressMode`: `"saved"` or `"current"`. Defaults to `"saved"`, as on web.
- `loading`, `error`, `permissionGranted`
- `isLocationResolved`
- `address`: `location.address || location.formattedAddress`.

**Zone state**

- `zoneId`, `zone`
- `zoneStatus`: `loading`, `IDLE`, `IN_SERVICE`, `OUT_OF_RADIUS`, `OUT_OF_ZONE` or `OUT_OF_SERVICE`.
- `isInService`, `isOutOfService`, `isOutOfRadius`, `isOutOfZone`
- `serviceUnavailableMessage`

The zone is detected from `location` with a 350 ms debounce and a 30 s cache. Zone and coordinates are pushed to `setZoneContext()` on every change.

**Actions**

- `requestLocation(updateDB = true, forceFresh = true)`: user-initiated GPS fix. Switches to `current` and resolves to the location.
- `setSavedLocation(loc, {mode = "saved", persistDb = true})`
- `setDeliveryAddressMode(mode)`
- `refreshZone()`
- `startWatchingLocation()`, `stopWatchingLocation()`: never started automatically, as on web.

**Web persistence helpers (AddressSelectorPage)**

- `persistUserLocation(loc, {mode})`
- `persistDeliveryAddressMode(mode)`
- `clearStoredUserLocation()`
- `notifyLocationUpdated(loc)`
- `reverseGeocode(lat, lng)`: tries the backend first, then Google if `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set, otherwise BigDataCloud + Nominatim.

**Startup**

1. Show the stored location (24 h TTL), or the user's DB location.
2. Fetch GPS once per launch when there is no usable location. This prompts for permission. It also fetches when the mode is `current` and this is the first fetch of the launch.

### `useOrders()`: `src/context/OrdersContext.js`

The device-local order list, persisted under `KEYS.orders`.

- `orders`
- `upsertOrder(apiOrder)`: call this after placing an order. It replaces the web's `order-placed` event.
- `getOrderById(id)`: matches `_id`, `orderId`, `orderMongoId` and `id`.
- `getAllOrders()`: newest first.

### `useUserNotifications()`: `src/context/UserNotificationContext.js`

**Realtime (shared socket while logged in)**

- `isConnected`
- `banner`: `{kind: "order_status" | "drop_otp" | "admin", title, message, duration, orderId?, otp?, shownAt}`. This replaces the web toasts and keeps their dedupe rules: 4 s for status updates and 15 s for OTPs.
- `dismissBanner()`
- `addNotificationListener(type, fn)`: returns an unsubscribe.
  - `type` is `"orderStatusNotification"` or `"deliveryDropOtp"`, with the web CustomEvent detail shapes.
  - The hook `useNotificationEvent(type, handler)` does the same for a component's lifetime.
- `setOrderTrackingVisible(bool)`: suppresses status banners while the tracking screen is open, as the web did.

**Inbox (no polling, as on web)**

- `items`, `unreadCount`, `inboxLoading`
- `refreshInbox(limit?)`: the default limit is 20 (header). The Notifications screen passes 100.
- `markAsRead(id)`, `dismiss(id)`, `dismissAll()`
- The inbox also refreshes on every `admin_notification`.

**Local list (`food_user_notifications`)**

- `localNotifications`
- `setLocalNotifications(listOrUpdater)`
- `addLocalNotification(n)`, `removeLocalNotification(id)`
- `totalUnreadCount`: local unread + inbox unread.

### `useAppSettings()`: `src/context/AppSettingsContext.js`

- `settings`: business settings, with URLs made absolute. Cached for 6 h and refreshed on every launch.
- `loading`
- `companyName`: falls back to `"CityFood"`.
- `logo`: `userLogo`, then `logo`, then the app-config `logoUrl`.
- `refresh()`
- The `/app-config/user_app` colors and logo are applied through `useTheme().applyAppConfig`.

**Also exported**

- `useCompanyName()`, `useAppLogo()`
- `loadBusinessSettings()`, `getCachedSettings()`, `getCompanyName()`, `getCompanyNameAsync()`: for use outside React.

### `useSearchOverlay()`: `src/context/SearchOverlayContext.js`

- `isSearchOpen`, `searchValue`, `setSearchValue`, `openSearch()`, `closeSearch()`
- Only the state is here; the overlay UI is built by the screens.
- The web's LocationSelectorContext held no state (`openLocationSelector` only navigated to `/food/user/address-selector`), so it is not ported. Navigate to the address selector screen directly.

## Libraries

### `src/lib/socket.js`

A single ref-counted Socket.IO connection:

- URL `SOCKET_URL`, path `/socket.io`, websocket transport only.
- `auth: {token}`, re-read on every reconnect so a refreshed token is used.
- On connect it re-joins the tracking rooms and emits `resync`.

**Functions**

- `subscribeToUserEvents({order_status_update, order_state, delivery_drop_otp, admin_notification, ...})`: returns an unsubscribe.
- `subscribeToOrder(orderIds, {onLocation, onStatus, onState, onDropOtp, onRoomJoined, onResyncComplete})`: returns an unsubscribe.
  - It emits `join-tracking` and `leave-tracking`.
  - Pass both the Mongo `_id` and the `FOD-` id.
- `subscribeSocketConnection(fn)`, `isSocketConnected()`, `requestResync()`, `disconnectSocket()`
- The connection closes when there are no subscribers left.

**Polling fallback:** OrderTracking on web polls `getOrderDetails(id, {force: true})` every 75 s while connected and every 12 s while disconnected.

### `src/lib/push.js`

- `configureNotificationHandler()`: call once at startup.
- `registerForPushNotifications()`:
  1. Creates Android channel `default` (HIGH importance, sound `zomato_sms.mp3`).
  2. Requests permission.
  3. Gets the native FCM token.
  4. Stores it in `KEYS.fcmToken` and posts it to `/fcm-tokens/device/save`.
  - Returns `null` with one `console.warn` until `google-services.json` is added.
  - The web registered on every user route while logged in. Call this after login and on app start when authenticated.
- `subscribePushTokenRefresh()`: re-registers when FCM rotates the token.
- `unregisterPushDevice()`: removes the device and the token. Call it before `useAuth().logout()`, matching the order in Profile.jsx.
- `addNotificationTapListener(navigate)`: covers both cold start and running app.
  - `navigate(webPath, data)` gets `data.link`, then `click_action`, then `targetUrl`, else `/`.
  - Backend values: `/food/user/orders/<id>` and `/food/user/orders/<id>/tracking` for order updates, `/` for tests, and the admin-configured broadcast link.
- `getNotificationTarget(data)`

### `src/lib/razorpay.js`

**`openRazorpayCheckout({razorpay, name, description, image, prefill, notes})`**

- Uses the web's options: `theme #E23744`, `retry` up to 3, and image `https://cityfood.co.in/logo.png`.
- Resolves to `{razorpayOrderId, razorpayPaymentId, razorpaySignature}`.
- Rejects with `PaymentError`. When the user dismissed checkout, `err.cancelled` is `true` and `err.code` is `"PAYMENT_CANCELLED"`. `isPaymentCancelled(err)` checks this.

**`payForOrder({order, razorpay, restaurantId, userId, prefill: {name, email, phone}})`**

This is the Cart.jsx flow:

1. Opens checkout.
2. Calls `/food/orders/verify-payment`.
3. On dismiss or failure, auto-cancels the order with the web's reason strings.

It resolves to `{status: "paid" | "cancelled" | "failed", message}`.

**`payForWalletTopup({amount, razorpay})`**

This is the AddMoneyModal.jsx flow. It prefills from the profile and calls `/food/user/wallet/topup/verify` with `amount`.
