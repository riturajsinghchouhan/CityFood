# mobile-delivery: API and data-layer map

This maps the CityFood rider web app (`Frontend/src/modules/DeliveryV2`, `deliveryAPI` in `Frontend/src/services/api/index.js`, `Food/hooks/useDeliveryNotifications.js`) onto the Expo app's data layer. The audit numbers (#1–#52) come from `docs/audit/api-and-auth.md` §2.

**Return convention.** Every `src/api` function resolves to the response body, `{success, message, data}`. On the web, `res.data.data.x` is the same value as `res.data.x` here. Errors are thrown as `ApiError {message, status, data, isNetworkError}`. The base URL is `EXPO_PUBLIC_API_BASE_URL` (`…/api/v1`).

## 1. Endpoints (`src/api/*.js`, all re-exported from `src/api/index.js`)

### Auth and onboarding (`auth.js`, `zones.js`)

| # | Method and path | Function |
|---|---|---|
| 1 | POST `/food/auth/delivery/request-otp` | `sendOTP(phone)`. Sends `"91XXXXXXXXXX"`; build the input with `toDeliveryOtpPhone("98…")` |
| 2 | POST `/food/auth/delivery/verify-otp` | `verifyOTP(phone, otp, fcmToken, "mobile")` |
| 3 | GET `/food/auth/me` | `getMe()` (single flight, 3 s cache), `getProfile()` (`data.profile`), `invalidateMe()` |
| 4 | POST `/food/auth/refresh-token` | handled by the `api/client.js` interceptor |
| 5 | POST `/food/auth/logout` | `logout(refreshToken, fcmToken, "mobile")` |
| 6 | POST `/food/delivery/register` (multipart, no auth) | `register(formData)`, `buildRegisterFormData(details, files, {fcmToken})`, `REGISTER_FILE_FIELDS`, `REGISTER_REQUIRED_FILES` |
| 7 | PATCH `/food/delivery/profile` (multipart) | `completeProfile(fd)` / `updateProfileMultipart(fd)` |
| 8 | GET `/food/zones/public` | `getPublicZones()` |

### Profile (`profile.js`)

| # | Method and path | Function |
|---|---|---|
| 9 | PATCH `/food/delivery/profile/details` | `updateProfileDetails({vehicle} \| {profilePhoto})` |
| 10 | PATCH `/food/delivery/profile/bank-details` | `updateBankDetails({bankDetails, panNumber, upiQrCode?})` (sends JSON, or multipart when `upiQrCode` is a file); `updateProfile(payload)` is the raw JSON version |
| 11 | GET `/food/delivery/referrals/stats` | `getReferralStats()` |
| 12 | DELETE `/food/delivery/account` | `deleteAccount()` |
| 13 | GET `/food/delivery/emergency-help` | `getEmergencyHelp()` |

### Duty and location (`duty.js`)

| # | Method and path | Function |
|---|---|---|
| 14 | PATCH `/food/delivery/availability` | `updateOnlineStatus(isOnline, selfieBase64, address)`, `updateLocation(lat, lng, isOnline, extras)` |
| +1 | POST `/food/delivery/location` | `postLocationBatch(points)`. The web never calls it; `lib/locationTask` uses it |

### Offers, assignment and trip (`orders.js`)

| # | Method and path | Function |
|---|---|---|
| 15 | GET `/food/delivery/orders/available` | `getOrders(params, {noCache})` (2.5 s dedupe), alias `getAvailableOrders` |
| 16 | GET `/food/delivery/orders/active` | `getActiveOrders()` |
| 17 | GET `/food/delivery/orders/current` | `getCurrentDelivery()` |
| 18 | PATCH `/orders/:id/accept` | `acceptOrder(id)` |
| 19 | PATCH `/orders/:id/pass` | `passOrder(id)` |
| 20 | PATCH `/orders/:id/reached-pickup` | `confirmReachedPickup(id)` |
| 21 | POST `/orders/:id/request-pickup-otp` | `requestPickupOtp(id)` |
| 22 | PATCH `/orders/:id/confirm-pickup` | `confirmOrderId(id, confirmedOrderId, {lat, lng}, {billImageUrl, otp})`, alias `confirmPickup` |
| 23 | PATCH `/orders/:id/reached-drop` | `confirmReachedDrop(id)`. Calling it again resends the drop OTP |
| 24 | POST `/orders/:id/verify-drop-otp` | `verifyDropOtp(id, otp)` |
| 25 | PATCH `/orders/:id/complete` | `completeDelivery(id, {otp, rating, paymentOverride, paymentMethod})` |
| 26 | POST `/orders/:id/payment-qr` | `createCollectQr(id)` |
| 27 | GET `/orders/:id/payment-status` | `getPaymentStatus(id)` |
| 28 | PATCH `/orders/:id/reject` | `rejectOrder(id, {reason})`. The backend ignores the reason, and the only web trigger is never emitted |
| +2 | GET `/food/delivery/orders/:id` | `getOrderDetails(id)` (§2.11: unused by the web but working) |

The `/orders/...` paths are under `/food/delivery`.

### Finance (`finance.js`)

| # | Method and path | Function |
|---|---|---|
| 29 | GET `/food/delivery/wallet` | `getWallet(params)`, `getWalletTransactions(params)` |
| 30 | GET `/food/delivery/earnings` | `getEarnings(params)` |
| 31 | GET `/food/delivery/earning-addons/active` | `getActiveEarningAddons()` |
| 32 | GET `/food/delivery/trip-history` | `getTripHistory(params)` |
| 33 | GET `/food/delivery/pocket-details` | `getPocketDetails(params)` |
| 34 | GET `/food/delivery/cash-limit` | `getCashLimit()` |
| 35 | POST `/food/delivery/wallet/withdraw` | `createWithdrawalRequest({amount, paymentMethod, bankDetails?})`. Adds the web's `requestId` |
| 36 | POST `/food/delivery/wallet/deposit/order` | `createDepositOrder(amount)`. Then open `react-native-razorpay` with `data.razorpay` |
| 37 | POST `/food/delivery/wallet/deposit/verify` | `verifyDepositPayment({razorpay_order_id, razorpay_payment_id, razorpay_signature, amount})` |

### Support, inbox, push and content

| # | Method and path | Function |
|---|---|---|
| 38–40 | GET/POST `/food/delivery/support-tickets`, GET `…/:id` | `getSupportTickets`, `createSupportTicket`, `getSupportTicketById` (`support.js`) |
| 41 | GET `/food/notifications/inbox?page=1&limit=100` | `getInbox(params)` (`notifications.js`) |
| 42 | PATCH `/food/notifications/:id/read` | `markAsRead(id)` |
| 43 | DELETE `/food/notifications/:id` | `dismiss(id)` |
| 44 | DELETE `/food/notifications/inbox/all` | `dismissAll()` |
| 45 | POST `/fcm-tokens/save` | `saveFcmToken(token, "web")` (`push.js`) |
| 46 | POST `/fcm-tokens/mobile/save` | `saveFcmToken(token, "mobile")` |
| 47 | POST `/fcm-tokens/device/save` | `savePushDevice({fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId})`. `lib/push` uses this one |
| 48 | DELETE `/fcm-tokens/remove` | `removeFcmToken(token, "mobile")` |
| 49 | DELETE `/fcm-tokens/device/remove` | `removePushDevice({deviceId, fcmToken})` |
| 50 | POST `/fcm-tokens/test` | `sendTestNotification("mobile", "fcm")` |
| 51 | GET `/food/pages/:key` | `getPage(key)`, `getPrivacy()`, `getTerms()` (try `*_delivery` first, then fall back) (`content.js`) |
| 52 | GET `/food/admin/business-settings/public` | `getBusinessSettings()` |
| +3 | GET `/food/zones/nearby` | `getZonesInRadius(lat, lng, km)` (§2.11) |
| +4 | GET `/app-config/delivery_app` | `getAppConfig()`. Used by ThemeContext; returns 404 in production today |
| — | POST `/uploads/image`, `/uploads/file` | `uploadMedia`, `uploadFile` (`upload.js`, shared). Use these if a pickup bill photo is ever needed |

**Count:** all 52 audited endpoints are present, plus `POST /food/delivery/location`, which makes **53**. Four working extras bring it to 57 wrappers: order details, photo-base64 (`updateProfilePhotoBase64`), zones nearby, and app-config.

### Skipped and dead call sites (not ported, or ported with a note)

- **`PATCH /orders/:id/status` (`updateOrderStatus`)**: not ported. The web never calls it, and it is unsafe: a rider could cancel or skip the OTP (backend issue #3).
- **`POST /food/delivery/reverify`**: not ported. It is a stub that always returns success.
- **ProfileBankV2's `{documents:{bankDetails, pan}}` sent to `/profile/details`**: dead, because the backend ignores it. Use `updateBankDetails` (→ `/profile/bank-details`) instead.
- **ProfileDocsV2 KYC re-upload** (`aadharPhoto`, `panPhoto`, `drivingLicensePhoto` → PATCH `/profile`): no working endpoint. Only `profilePhoto` is stored, so there is no wrapper for this.
- **OTP.jsx `handleSubmitName`** (a second verify-otp call with a name): dead and not ported.
- **`getWalletTransactions({type:"deduction"})`**: ported, but it always returns empty. Nothing produces deductions.
- **`rejectOrder` on `order_auto_killed`**: ported as `submitAutoKillReason`. The event is never emitted, and the reason is ignored.
- **Dead socket listeners**: `new_order` (only sent to restaurants), `play_notification_sound`, `order_cancelled`, `order_auto_killed`, `order_reassigned_elsewhere`. They are still forwarded and handled so behaviour matches the web; it costs nothing.
- **DEV "SIM" simulation mode and the "Play" FAB**: not ported.
- **The web's `/uploads/single` fallback**: returns 404 in production and is not ported.

## 2. Context and lib APIs

### `useAuth()` (`src/context/AuthContext.js`)

**State:** `{ready, isAuthenticated, user, riderId, authData, pendingApproval}`

**Profile**
- `refreshProfile({noCache})`: calls `/food/auth/me`, stores `delivery_user`, and returns the user.
- `updateUser(partial | fn)`

**OTP login**
- `requestOtp("98765 43210")`: sends `"+91 <10>"`, which normalizes to `91XXXXXXXXXX`. It stores `deliveryAuthData`.
- `verifyOtp({otp, phone?, fcmToken?})` resolves to one of:
  - `{outcome:"authenticated", user}` → go to `/`
  - `{outcome:"needsRegistration", phone, signupDetails}` → go to `/signup/details`. `deliveryNeedsRegistration` and `deliverySignupDetails` are seeded.
  - `{outcome:"pendingApproval", isRejected, rejectionReason, message}` → stay on the OTP screen and show the amber or red card.
  - A wrong OTP throws `ApiError` (401).
- `reapply(phone?)`: the "Re-apply Now" action for rejected riders. It seeds signup.

**Signup**
- `getSignupDetails()`, `saveSignupDetails(d)`, `getSignupDocs()`, `saveSignupDocs(d)`, `clearSignupDrafts()`
- `register(details, files)` (or `register(formData)`): multipart register with the FCM token and `platform:"mobile"`. It clears the drafts on success.

**Logout**
- `logout()` runs these steps in order:
  1. **Stop background tracking** (queued points are flushed first).
  2. **PATCH availability offline.** The web did not do this (§6 F4).
  3. DELETE `device/remove`.
  4. DELETE `fcm-tokens/remove`.
  5. POST `/food/auth/logout`.
  6. Clear the `delivery_*` keys, `delivery-v2-online-pref`, and the location queue.
- On session expiry (refresh failed), tracking is stopped without telling the backend, because the token is gone.
- `onLogout(fn)` returns an unsubscribe.

**Storage keys** (`src/storage KEYS`):
- In SecureStore: `delivery_accessToken`, `delivery_refreshToken`.
- In AsyncStorage (under `food:v1:`): `delivery_user`, `deliveryAuthData`, `delivery_draft_phone`, `deliveryNeedsRegistration`, `deliverySignupDetails`, `deliverySignupDocs`, `delivery-v2-online-pref`, `fcm_web_registered_token_delivery`, `delivery_location_queue`, `delivery_tracking_config`, `delivery_tracking_meta`.

### `useDelivery()` (`src/context/DeliveryContext.js`)

**Duty and location**
- State:
  - `isOnline`, `onlineHydrated`, `goingOnline`, `riderLocation {lat,lng,heading,speed,accuracy}`, `locationError`
  - `locationPermission {foreground, background, servicesEnabled}`
  - `trackingConfig {mode, intervalMs, distanceFilterMeters, stopTracking}`, `isTracking`
- Going online follows the web's three steps:
  1. `prepareGoOnline()` gets a GPS fix and throws with a code: `PERMISSION_DENIED`, `SERVICES_DISABLED`, `TIMEOUT` or `UNAVAILABLE`. The web toasted "Please enable your GPS for current location".
  2. `captureShiftSelfie()` opens the front camera and returns `{base64, uri}` or `null`.
  3. `resolveShiftAddress(lat, lng)` returns an address, then `goOnline({selfieBase64, address, coords})` does the PATCH, sets the rider online, syncs the location, starts tracking, and resolves `{backgroundPermission}`.
- `startShift()` runs all three steps with the system camera.
- `goOffline()`
- `requestBackgroundLocation()`: call it after showing the explanation UI. On Android 11+ it opens Settings.
- `refreshLocationPermission()`

**Offers**
- State:
  - `incomingOrders` (the queue) and `visibleOffer`, which is the selected offer. It is hidden while `orderCapacity.canAcceptMore === false`.
  - `selectedIncomingId`, `offerTimeLeft` (counts down from 60), `offerDeadline`, `cashLimitNotice`, `isRinging`
- Actions:
  - `selectIncomingOrder(o)`
  - `acceptOffer(o)`: applies the GhostAssignFix lock. A 403 or "already accepted" removes the offer with a toast.
  - `passOffer(o, {auto})`
- At 0 s the offer is passed automatically.

**Trip**
- State:
  - `activeOrder` (normalized, with `restaurantLocation` and `customerLocation`), `acceptedOrders` (multiple active orders), `orderCapacity`
  - `tripStatus`: `IDLE | PICKING_UP | REACHED_PICKUP | PICKED_UP | REACHED_DROP | COMPLETED`
  - `settings`, `setSettings`, `actionInFlight`
  - `distanceToTarget`, `isWithinRange` (1500 m; always true in `__DEV__` or when `EXPO_PUBLIC_ENABLE_RANGE_BYPASS=true`), `actionLimit`, `eta`
  - `pickupOtpRequested`, `dropOtpResendAt`
  - `payment {status:'idle'|'pending'|'paid'|'expired'|'failed', qr, loading}`
- Pickup:
  - `openAcceptedOrder(o)`
  - `reachPickup()`. This also fires automatically within 100 m in release builds.
  - `requestPickupOtp()`
  - `pickUpOrder(otp | "SKIP", billImageUrl?)`
- Drop:
  - `reachDrop()`. This also fires automatically within 100 m.
  - `resendDropOtp()` (30 s cooldown)
  - `verifyDropOtp(otp)`
- Completion:
  - `completeDelivery(otp | "BYPASS", "cash" | "online", order?)`
  - `collectCash(otp?)`
  - `startCollectQr()` polls payment-status every 4 s; `checkPaymentStatus()`, `stopQrPolling()`, `resetPayment(order?)`
  - `resetTrip()`: the summary screen's "Done".
- Other:
  - `refreshAcceptedOrders()`, `recoverDeliveryState()`
  - `setActivePolyline(encoded | {points})`: comes from the map's Directions result. It is pushed to the customer once per change.

**Realtime**
- State: `isConnected`, `orderReady` / `clearOrderReady`, `adminNotification` / `clearAdminNotification`, `autoKilledOrder` / `submitAutoKillReason(reason)`
- `subscribe(listener)` returns an unsubscribe. Events:
  - `offer_received`, `offer_removed`, `offer_accepted`, `offer_passed`
  - `order_cancelled`, `order_status_update`, `order_ready`, `trip_completed`
  - `admin_notification`, `inbox_refresh`, `admin_force_status`, `tracking_stopped`
- Toasts use the web's exact strings, through `components/ui/Toast`.

**Offer sources.** Offers are taken only while the rider is online, and all sources feed one de-duplicated queue:
- socket `new_order_available`, `pending_offers` (on resync), and `new_order` / `play_notification_sound`;
- RTDB `delivery_partner_offers/<riderId>`. A newer `offeredAt` adds an offer; a removed key means the order was claimed;
- a foreground FCM `new_order`, which adds the hinted offer and then runs `recoverDeliveryState`;
- polling GET `/orders/active` and `/orders/available?limit=20` every **45 s with the socket connected, 15 s without**, while the rider is online and the app is in the foreground.

**Dismissal.** `order_claimed` (another rider, silent if it was this rider), an RTDB key being removed, `order_cancelled`, `order_reassigned_elsewhere`, a 403 on accept, and pass all remove the offer.

**The 21 web socket listeners and how they are handled**

| Listener | Handling |
|---|---|
| `connect`, `reconnect` | Recovery runs. On connect the socket also emits `join-delivery` and `resync`. `reconnect` and `reconnect_attempt` are bound on the Manager, so they actually fire (they never did on the web). |
| `disconnect`, `connect_error`, `reconnect_attempt` | Update `isConnected` |
| `delivery-room-joined`, `resync_complete` | Forwarded |
| `active_order` | Recovered as the active order |
| `pending_offers` | Each offer goes into the queue |
| `new_order_available`, `new_order`, `play_notification_sound` | Offer |
| `order_ready` | Vibration pulse plus state |
| `order_status_update` | Cancel resets the trip; a dispatch accepted by admin assignment refreshes `/active` |
| `order_cancelled`, `order_deleted`, `order_auto_killed`, `order_reassigned_elsewhere`, `order_claimed` | Remove the offer or order |
| `admin_notification` | Toast plus `inbox_refresh` |
| `admin_force_status` | Online or offline, together with tracking |

### `src/lib/*`

**`socket.js`**
- `connectDeliverySocket(riderId)`, `disconnectDeliverySocket()`, `reconnectDeliverySocket()`, `ensureSocketConnected()`, `requestResync()`
- `emitLocation(data)`: emits `join-tracking` once, then `update-location`.
- `subscribeDeliveryEvents(handlers)`, `subscribeSocketConnection(fn)`, `isSocketConnected()`
- `DELIVERY_SOCKET_EVENTS`

**`firebase.js`**
- `getRealtimeDb()`, `isFirebaseConfigured()`
- `subscribeDeliveryPartnerOffers(riderId, onChange, onError)`
- `writeDeliveryLocation({deliveryId, lat, lng, heading, speed, accuracy, isOnline, activeOrderId, status})`
- It uses the Firebase JS SDK v11 with no auth, and reads `EXPO_PUBLIC_FIREBASE_*`.

**`locationTask.js`** (decision A)
- `LOCATION_TASK`, `TRACKING_MODES`
- Permissions: `getLocationPermissions()`, `requestForegroundLocation()`, `requestBackgroundLocation()`, `openLocationSettings()`
- Tracking: `startBackgroundTracking({activeOrderId})`, `stopBackgroundTracking({flush})`, `isBackgroundTrackingActive()`, `setTrackingActiveOrder(id)`, `applyPendingTrackingConfig()`
- Queue and config: `flushLocationQueue({force})`, `effectiveTrackingConfig()`, `getTrackingConfig()`
- Listeners: `subscribeLocationFixes(fn)`, `subscribeTrackingConfig(fn)`

**`push.js`**
- Channels and handlers: `configureNotificationHandler()`, `ensureAndroidChannels()`, `setForegroundPushHandler(fn)`
- Tokens: `getPushTokenForLogin()`, `registerForPushNotifications()`, `subscribePushTokenRefresh()`, `unregisterPushDevice()`, `deviceIdFor(token)` (gives `tuggo:delivery:android:<last16>`)
- Local offer notifications: `showLocalOfferNotification(order)`, `dismissLocalOfferNotification(key)`
- Taps: `getNotificationTarget(data)`, `addNotificationTapListener(navigate)`
- Payloads: `pushDataOf(x)`
- `BACKGROUND_PUSH_TASK` is defined at module top level.

**`ring.js`** (decision B)
- `startRing(key, {maxMs})`, `stopRing()`, `pulseAlert()`, `prepareRing()`, `releaseRing()`
- `isRinging()`, `getRingingKey()`, `subscribeRing(fn)`, `OFFER_WINDOW_MS`

**`shift.js`**
- `getCurrentFix()`, `captureShiftSelfie()`, `resolveShiftAddress(lat, lng)`

**`delivery/orders.js`**
- `TRIP_STATUS`
- Order ids: `getOrderMongoId`, `getOrderDisplayId`, `getOrderAcceptId`, `isSameOrder`, `getOrderAlertKey`
- Queue: `normalizeIncomingOrder`, `upsertIncomingOrderInQueue`, `removeIncomingOrderFromQueue`, `getPrimaryIncomingOrder`
- Active order: `extractOrderLocation`, `normalizeDeliveryActiveOrder`, `getTripStatusForOrder`, `resolveActiveOrderMeta`, `getProximityTarget`, `getOrderPaymentState`

**`delivery/geo.js`**
- `getHaversineDistance`, `calculateETA`, `calculateHeading`, `parseLatLng`, `calculateDistance`, `shouldSendLocationUpdate`

**`delivery/orderLocation.js`**
- A verbatim web port: `getRestaurantDisplayInfo`, `getCustomerDisplayInfo` (with `mapsUrl`), `getOrderPaymentInfo`.

### Navigation (`src/navigation`)

**`links.js`**
- `toNativePath(webPath)`: strips `/food/delivery` and `/delivery`, then applies the web's redirects:
  - `/feed`, `/welcome`, `/earnings` and `/orders/<id>` → `/`
  - `/signup` → `/login`
  - unknown paths → `/`
- `openLink(link)`

**`back.js`**
- `resolveBackPath(pathname, {backTo, from})`: the web's fixed-parent map.
- `useAppBack()`, `useBackOverride(handler)`, `HardwareBackBinding`, `TAB_ROOTS`, `goTo`

**Native routes** are the web paths without the prefix:
- Shell tabs: `/`, `/pocket`, `/orders`, `/history`, `/profile`
- Auth: `/login`, `/otp`, `/signup/details`, `/signup/documents`
- Content: `/terms`, `/profile/privacy`, `/profile/terms`, `/support`
- Inbox: `/notifications`
- Profile: `/profile/{details,bank,documents}`
- Help: `/help/tickets`, `/help/tickets/create`, `/help/tickets/[ticketId]`, `/help/id-card`
- Pocket: `/pocket/{payout,statement,deductions,limit-settlement,balance,cash-limit,details}`

### Theme (`src/theme`)

- The theme is light only. The primary is `#15498b` and the strong colour is `#000000`. The `brand` object holds the `--dv-*` tokens: soft `#e7effa`, bg `#eef3fb`, text `#0f1724`, muted `#4f5f77`, border `#d1dceb`, online `#22c55e`, offline `#ef4444`, plus the route, zone and verify gradients.
- **Colour rule helpers** (`tokens.js`, also available through `useTheme()`):
  - `dvColor("bg-green-500")` returns the colour the web actually renders, using the exact lists from `deliveryTheme.css`:
    - `text-` and `bg-` in orange, green, emerald, blue, cyan, indigo and teal at 500/600, plus `text-primary`, `#EB590E`, `#10B981` and `#00B761`, all become the primary;
    - the `-50` tints and `/10` alphas become the soft colour;
    - the listed borders become 28 % primary;
    - `from-*`/`to-*` become primary → (strong 82 % + primary);
    - `hover:bg-*-600` becomes strong;
    - the shadows become 35 % primary.
  - `isRemappedToPrimary(cls)`, `dvGradient()`, `mixWithWhite`, `mixColors`.
- `Text` maps font weights to font families:
  - Nunito Sans for body text. A 400 weight renders as 500, because only 500–800 are loaded on the web.
  - Sora 600/700 for the `heading` prop, `FontScope family="heading"`, and weights 800/900 (`font-extrabold` and `font-black`). Sora text also gets letter-spacing of 0.01 em.

## 3. Root layout wiring (`src/app/_layout.js`, still to be written)

```js
import "../lib/locationTask";   // FIRST: defines the background location task at top level
import "../lib/push";           // defines the background-push task at top level
import { NunitoSans_500Medium, NunitoSans_600SemiBold, NunitoSans_700Bold, NunitoSans_800ExtraBold } from "@expo-google-fonts/nunito-sans";
import { Sora_600SemiBold, Sora_700Bold, useFonts } from "@expo-google-fonts/sora";
import { configureNotificationHandler, addNotificationTapListener, registerForPushNotifications, subscribePushTokenRefresh } from "../lib/push";
import { toNativePath } from "../navigation/links";
import { HardwareBackBinding } from "../navigation/back";

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();          // module scope, once

// useFonts({ NunitoSans_500Medium, NunitoSans_600SemiBold, NunitoSans_700Bold, NunitoSans_800ExtraBold,
//            Sora_600SemiBold, Sora_700Bold })   // = FONT_NAMES in theme/tokens.js
```

**Provider order**, from outside to inside:

`GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider` → `AuthProvider` → `DeliveryProvider` → `RootStack` (`Stack` + `<HardwareBackBinding/>` + `<PushBinding/>` + `<Toaster/>`)

**`PushBinding`** works like the restaurant app's:
- `addNotificationTapListener((webPath) => { const p = toNativePath(webPath); if (p) router.push(p); })` runs once.
- When `isAuthenticated` is true: `registerForPushNotifications()`, then `return subscribePushTokenRefresh()`.

**Splash:** hide the splash screen when `useAuth().ready` and the fonts have loaded.

**Protected screens:** `navigation/Protected.js` (`withProtected`) wraps every route except `login`, `otp`, `signup/*`, `terms`, `profile/privacy`, `profile/terms` and `support`.

## 4. How decisions A and B work

**A. Background location while online**
- **Going online.** `goOnline` sends the PATCH, then calls `startBackgroundTracking`. That runs `Location.startLocationUpdatesAsync(LOCATION_TASK, …)` with:
  - accuracy Balanced, or High while on a trip;
  - `timeInterval` = intervalMs and `distanceInterval` = distanceFilterMeters;
  - `foregroundService {"You're online", "Sharing your location for orders", #15498b, killServiceOnDestroy:false}`.
  - It needs foreground permission and must be called from the foreground. Background permission is requested separately, after an explanation.
- **Each fix** is added to a persisted queue (up to 200 points). The queue is POSTed as a batch, at most 100 points per request, no more than once per `intervalMs`.
- **The server's `config` controls the cadence:**
  - idle: 20 s / 50 m
  - onTrip: 10 s / 20 m
  - `stopTracking` stops updates and sets the rider offline locally.
  - New options can only be re-applied while the app is in the foreground. A change that arrives in the background is applied on the next foreground.
- **Trip cadence while the local trip is still early.** While a local active order exists, the onTrip cadence is used even if the server says "idle". This covers backend issue #9: the server treats `preparing` and `ready_for_pickup` as idle.
- **When the JS runtime is alive**, the task's fixes and a foreground `watchPositionAsync` (3 s / 5 m) feed the provider. It then:
  - emits socket `update-location` (only with an active order, at ≥50 m or ≥10 s), sending `orderId` (Mongo id), `userId` and `restaurantId`;
  - writes RTDB `delivery_boys/<id>` on the same throttle;
  - runs the 100 m auto-arrival.
- **The 45 s heartbeat** PATCHes `/availability` with lat/lng and also writes RTDB. Availability is never sent on every fix.
- **Tracking stops** when the rider goes offline, logs out, the session expires (401), on `admin_force_status` offline, and when the foreground permission is revoked (the rider is set offline, as the web does).

**B. New-offer alert**
- When an offer becomes visible, `startRing(key, {maxMs: deadline − now})` loops `delivery_alert.mp3` through `expo-audio` with `playsInSilentMode`, and repeats a vibration pattern.
- **Window.** Each offer has a 60 s countdown that starts the first time it is shown; switching between queued offers keeps its deadline.
- **Stopping.** The ring stops on accept, pass, claimed or cancelled, at 0 s (auto-pass), when the rider goes offline, and on logout.
- **Channel.** Android channel `"default"` has importance MAX, sound `delivery_alert.mp3` and vibration. Local milestone notifications use a separate channel, `order_updates`, so they don't play the offer ringtone.
- **Foreground push.** A foreground FCM `new_order` is shown without the system sound and starts the in-app ring through the provider.
- **Background.** While the app is backgrounded, the FCM notification (channel sound) is the alert. Socket or RTDB offers that arrive in the background also post a local notification on `"default"`, de-duplicated for 20 s per order.

## 5. Not reproducible, or needs on-device verification

- **Face detection on the shift selfie.** The web's FaceDetector check runs only in Chrome and has a fake fallback. The system front camera is used instead.
- **Web keep-alive hacks** (Wake Lock, silent AudioContext): replaced by the foreground service.
- **Ringing while backgrounded.** The in-app audio is not set to play in the background; that would need the expo-audio background-playback plugin. The channel sound covers this case.
- **Data-only milestone pushes.** These are shown by `BACKGROUND_PUSH_TASK` (`expo-notifications` `registerTaskAsync`), which runs in the foreground, the background, and when the app is killed (headless). Two things are unverified:
  - The exact Android payload shape is not documented. `pushDataOf` handles `data`, `dataString` and nested `data`.
  - The backend adds an `android.notification` block even to `dataOnly` messages. That could make Android display those messages on its own, which would duplicate the local notification.
- **Re-applying location options with the same task name.** Calling `startLocationUpdatesAsync` again with the same task name to apply new options is not documented. It is expected to update the running task; verify on a device.
- **Firebase RTDB without auth** depends on the database rules allowing public read and write (backend issue #8). If access is denied, the socket, polling and FCM still deliver offers.
- **The "Skip OTP" pickup (`"SKIP"`) and "Mark delivered" (`"BYPASS"`)** are product decisions on the web. They are exposed here as argument values; the UI decides whether to offer them.
