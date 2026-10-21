# Delivery partner (rider) app — routes and design audit

Source: `Frontend/src/modules/DeliveryV2` (React 19 + Vite + Tailwind v4), plus what it imports from `src/modules/Food`, `src/services/api` and `src/shared`.
This audit only read the code. No project scripts were run. Audit date: 2026-10-21.

Path aliases (from `Frontend/jsconfig.json`): `@food/api` → `src/services/api`, `@food/*` → `src/modules/Food/*`, `@delivery/*` → `src/modules/DeliveryV2/*`, `@/*` → `src/*`.

---

## 1. Routing

### 1.1 How the delivery module is reached

```
src/app/routes.jsx  (AppRoutes)
 ├─ /delivery/auth/*  → modules/auth/routes (generic Login/Support; NOT the rider login — ignore)
 ├─ /food/*           → FoodAppWrapper → modules/Food/routes.jsx (App)
 │                       └─ "delivery/*" → lazy(import("../DeliveryV2"))  = DeliveryV2/index.jsx
 └─ /*                → FoodAppWrapper as well (so /delivery/... also resolves, but every link in the module uses /food/delivery/...)
```

The `Food/routes.jsx` `App` wraps every module in:
- `AuthInitializer`
- `ScrollToTop`
- `PushSoundEnableButton`: a floating "enable sound" prompt shown on non-admin routes.
- An effect that calls `registerWebPushForCurrentModule()` once per module. For delivery it gets a web FCM token and calls `deliveryAPI.saveFcmToken` and `savePushDevice`.

`DeliveryV2/index.jsx` nests the following, outside to inside:
`DeliveryErrorBoundary` → `DeliveryNotificationProvider` (socket, alerts, FCM relay) → `<div class="delivery-v2-theme">` (imports `deliveryTheme.css`) → `DeliveryV2Router`.

The theme colour is applied once at boot. `src/index.jsx` lazily imports `Food/utils/themeSettings.js` → `applyDynamicTheme()`. That GETs `/app-config/{user_app,restaurant_app,delivery_app,admin_app}` and sets `--dv-primary` and `--dv-primary-strong` on `:root`. It also stores `delivery_app_logo` in localStorage.

### 1.2 The guard

`components/ProtectedRoute.jsx` only checks `isModuleAuthenticated("delivery")`, which looks at the token in localStorage:
- an unexpired `delivery_accessToken` with the delivery role, **or**
- an unexpired refresh token.

If neither is present, it redirects to `/food/delivery/login` with `state.from`.

**The router has no approval, onboarding, document-verification or online-status guard.** These are enforced elsewhere:
- **Approval / pending / rejected:** handled only at OTP verify time. The backend returns `pendingApproval: true` (plus `isRejected` and `rejectionReason`) and no tokens, so the rider never gets a session.
- **Registration needed:** the OTP response returns `needsRegistration: true`, and the app goes to `/signup/details`.
- **Online status:** gates behaviour only, not routes. The map, location tracking and order offers run only while online.
- **Cash limit:** a `cashLimit.blocked` banner comes from `GET /orders/available`.

### 1.3 All routes (`DeliveryV2Router.jsx`, base `/food/delivery`)

**Layout key:**
- **HomeShell** = `DeliveryHomeV2`, a single component with an internal `tab` prop. It renders the bottom nav (4 items). On the feed tab only, it also renders the coloured top header.
- **Sub** = full-screen page with its own header and a back arrow (`useDeliveryBackNavigation`). It has no bottom nav.

| # | Path | Component | Guard | Layout / notes |
|---|------|-----------|-------|----------------|
| 1 | `welcome` | auth/Welcome | none | Sub. Mock "Hi X, complete 1 order to unlock ₹100" page with a fake audio player and a confetti sheet. Nothing navigates here. |
| 2 | `login` | auth/SignIn | none | Full-screen. Phone (+91 fixed), "Send OTP to Register/Login". Links to `support`, `profile/terms`, `profile/privacy`. |
| 3 | `otp` | auth/OTP | none (needs `deliveryAuthData` in localStorage, else → login) | Full-screen. 6-digit OTP, 60 s resend. Shows the pending or rejected state inline. |
| 4 | `signup` | `<Navigate to=/food/delivery/login>` | – | Redirect only. Note: the referral link `signup?ref=` lands here, so the `ref` is lost. |
| 5 | `signup/details` | auth/SignupStep1 | none (expects `deliverySignupDetails`) | Sub form, step 1 of 2. |
| 6 | `signup/documents` | auth/SignupStep2 | none (expects step-1 details, else → signup) | Sub form, step 2 of 2, KYC photos. Success state reads "Profile Under Review". |
| 7 | `terms` | TermsAndConditionsV2 | none | Sub. Not linked. |
| 8 | `profile/privacy` | PrivacyPolicyV2 | none (declared twice; the first, unprotected one wins) | Sub, CMS HTML. |
| 9 | `profile/terms` | TermsAndConditionsV2 | none (declared twice) | Sub, CMS HTML. |
| 10 | `` (index) | DeliveryHomeV2 tab=feed | login | HomeShell: map + top header + bottom nav. |
| 11 | `feed` | DeliveryHomeV2 tab=feed | login | Same as above (bottom-nav target). |
| 12 | `pocket` | DeliveryHomeV2 tab=pocket → PocketV2 | login | HomeShell; PocketV2 has its own sticky header in the primary colour. |
| 13 | `orders` | DeliveryHomeV2 tab=orders → OrdersV2 | login | HomeShell; plain title. |
| 14 | `history` | DeliveryHomeV2 tab=history → HistoryV2 | login | HomeShell. Not in the bottom nav (opened from Profile → "Trips history"), so no nav item is highlighted. |
| 15 | `profile` | DeliveryHomeV2 tab=profile → ProfileV2 | login | HomeShell; sticky header in the primary colour. |
| 16 | `notifications` | NotificationsV2 | login | Sub. Back button goes to `/profile`. |
| 17 | `profile/details` | profile/ProfileDetailsV2 | login | Sub: photo, vehicle, bank/UPI, documents (bottom sheets). |
| 18 | `profile/bank` | profile/ProfileBankV2 | login | Sub. **Not linked** (ProfileDetails covers it). |
| 19 | `profile/documents` | profile/ProfileDocsV2 | login | Sub. **Not linked**. |
| 20 | `support` | help/PublicSupportV2 | none | Sub, static. Back uses `navigate(-1)`. |
| 21 | `help/tickets` | help/SupportTicketsV2 | login | Sub. |
| 22 | `help/tickets/create` | help/CreateSupportTicketV2 | login | Sub. |
| 23 | `help/tickets/:ticketId` | help/ViewSupportTicketV2 | login | Sub. |
| 24 | `help/id-card` | help/ShowIdCardV2 | login | Sub, opened from the feed header ID icon. |
| 25 | `pocket/payout` | pocket/PayoutV2 | login | Sub, withdrawal history. |
| 26 | `pocket/statement` | pocket/PocketStatementV2 | login | Sub. **Not linked**. |
| 27 | `pocket/deductions` | pocket/DeductionStatementV2 | login | Sub. |
| 28 | `pocket/limit-settlement` | pocket/LimitSettlementV2 | login | Sub. |
| 29 | `pocket/balance` | pocket/PocketBalanceV2 | login | Sub, withdraw. |
| 30 | `pocket/cash-limit` | pocket/CashLimitInfoV2 | login | Sub. |
| 31 | `pocket/details` | pocket/PocketDetailsV2 | login | Sub. |
| 32 | `*` | Navigate → `/food/delivery` | – | Fallback. |

The router has 34 `<Route>` elements and 32 unique paths. Two paths are declared twice: `profile/terms` and `profile/privacy`.

There is one broken link: PocketV2 navigates to `/food/delivery/earnings`, which has no route and falls back to the feed.

### 1.4 Auth screens (`pages/auth`)

1. **SignIn (`login`)**
   - Shows the logo from `useAppLogo("delivery_app")` (business settings `deliveryLogo`/`logo`, falling back to `/logo.png`) and the headline "Deliver smiles. / Earn on your schedule.".
   - Shows the hero rider illustration `/delivery-hero-clean.png` (falls back to `-seamless`), the India flag from flagcdn.com and a 10-digit phone input.
   - The phone draft is saved in `delivery_draft_phone`.
   - Calls `deliveryAPI.sendOTP(phone,"login")`, stores `deliveryAuthData` {phone, …} and navigates to `otp`.
   - Shows a "Need Help? Support" pill and Terms/Privacy links.
2. **OTP (`otp`)**
   - 6 boxes with auto-submit on the 6th digit and paste support. The resend timer is 60 s.
   - Gets the FCM token from the Flutter bridge or `fcm_web_registered_token_delivery`, then calls `verifyOTP(phone, otp, purpose, name, fcmToken, platform)`. The response branches:
     - `pendingApproval` → inline amber "Pending Verification" card, or a red "Application Rejected" card with the reason. Rejected riders get a "Re-apply Now" button, which sets `deliveryNeedsRegistration` and goes to `signup/details`, plus a back-to-login link.
     - `needsRegistration` → sets `deliveryNeedsRegistration=true` and seeds `deliverySignupDetails` with the phone → `signup/details`.
     - Otherwise → `setAuthData("delivery", accessToken, user, refreshToken)`, fires the `deliveryAuthChanged` event and goes to `/food/delivery`.
   - The "name input" branch exists but `showNameInput` is never set true, so it is dead code.
3. **SignupStep1 (`signup/details`)**
   - Fields: name, email (validated), address, city, state, service zone (select from `zoneAPI.getPublicZones()`), vehicle type (bike/scooter/ev/bicycle…), vehicle name, vehicle number (regex `^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$`, optional for bicycle), driving licence number (required unless EV or bicycle), PAN number, 12-digit Aadhaar, and an optional `ref`.
   - Saves to `deliverySignupDetails` and goes to step 2.
4. **SignupStep2 (`signup/documents`)**
   - Photo slots. Required: profile photo, Aadhaar front, Aadhaar back, PAN, RC. Optional: DL front and DL back.
   - Each slot offers **Take Photo** (`openCamera`: Flutter bridge or `<input capture>`) and **Gallery** (`<input type=file accept=jpg/png/webp/heic>`).
   - Images are compressed to WebP (1024 px, quality 0.8) as data URLs and kept in IndexedDB (`DELIVERY_FILES_DB`) so a reload doesn't lose them. `deliverySignupDocs` holds the flags.
   - Submits a multipart `FormData` to `deliveryAPI.register` (no token, when `deliveryNeedsRegistration`) or `completeProfile`. Friendly errors cover duplicate vehicle, Aadhaar and DL numbers.
   - On success it shows the "Profile Under Review" card → "Back to Login".
5. **Welcome (`welcome`)** is a mock page and unreachable. Leave it out.

---

## 2. Per-screen summary (phone only)

None of the screens has a separate desktop layout. There are no `hidden md:flex` or `md:hidden` splits. The only responsive classes are a few `sm:`/`md:` size tweaks (text, padding, avatar size). Build phone only.

### Home shell — `DeliveryHomeV2` (2,106 lines; the core of the app)

**Feed tab**
- **Top header** (absolute, `--dv-primary` background):
  - Avatar → profile.
  - **Online/Offline toggle pill** (92×32, sliding white knob; green `#22c55e` when online, red `#ef4444` when offline via the CSS override).
  - DEV-only "SIM" button.
  - Right side: Emergency (red triangle) → bottom sheet, ID card → `help/id-card`, Bell with unread badge → Notifications bottom sheet.
- **Status strip under the header:**
  - With an active order: two cards, DISTANCE km (primary) and ARRIVAL min (`#10B981`, remapped to primary).
  - Without one: "System Online / Waiting for order requests" or "System Offline", plus a "Call Team Leader" button when that number is configured.
  - A "Cash Limit Alert" amber banner when the backend blocks the rider.
- **Body:**
  - Offline: a static "fake map" (dot pattern + SVG roads), a large round `/delivery_avatar.png` and a "You are Offline / Go online to receive orders" card.
  - Online: `LiveMap`, plus FABs on the right (zoom +/-, a Play/simulation button that also shows in production, a "Navigation2" button that sets `gestureHandling: greedy`, and Target = recentre) and a red "Location unavailable" card when there is a GPS error.
- **Order overlays** (a spring bottom sheet sitting above the bottom nav at `bottom: 92px`; tapping the map minimises it to a dark "Order Action Pending / N orders waiting" bar):
  - `NewOrderModal`: incoming offer.
  - `PickupActionModal`: PICKING_UP and REACHED_PICKUP.
  - **Drop card** (inline, PICKED_UP): customer name and address, call button, navigate button (opens Google Maps), items, time and distance tiles, drop note, **"Slide to Arrive"** slider (disabled until within range), and a "Mark as Delivered" button (skips OTP).
  - **REACHED_DROP**: a gradient button (`#15498b → #000`) "VERIFY & COMPLETE" opens `DeliveryVerificationModal`.
  - **COMPLETED**: `OrderSummaryModal` ("Well Done!", earnings added, Done → `resetTrip`).
- **Other sheets and dialogs:**
  - `PhotoUploadModal`: shift-start selfie, required to go online.
  - Emergency Help sheet with 5 rows (Medical, Accident, Police, Insurance, Team Leader), each `tel:` from `GET /emergency-help`.
  - Notifications sheet: inbox list, Clear All, "View Notification History" → `/notifications`.
  - `window.prompt` asking for a reason when the socket sends `order_auto_killed`.

**Other tabs (rendered inside the shell)**
- **Pocket tab (`PocketV2`):**
  - Header "Pocket details".
  - "Submit bank details" banner → profile/details.
  - Earnings card → broken `/earnings` link.
  - "Earnings Guarantee" live offer card from `getActiveEarningAddons` (orders done and earned so far against the target).
  - Rows: Pocket balance, Available cash limit; tiles for Payout, Limit settlement, Deductions, Pocket details.
  - **Deposit cash popup** (amount → `createDepositOrder` → Razorpay checkout → `verifyDepositPayment` → reload). The popup is closed with the browser back button (`history.pushState`).
- **Orders tab (`OrdersV2`):**
  - "New offers": cards showing rider pay, pickup and drop with maps links, total bill, payment, **Accept** (tap the card's accept) and **Pass**.
  - "Accepted orders": a capacity count (`activeOrderCount/effectiveLimit`), cards that tap to open (→ feed with that order selected) and a "Mark Delivered" button.
  - This tab supports **multiple concurrent orders** (`orderCapacity`).
- **History tab (`HistoryV2`):**
  - Header "Trip History".
  - Daily/weekly/monthly tabs, a date picker sheet and a trip-type picker sheet (ALL/COMPLETED/CANCELLED…).
  - Summary of COD collected and earnings.
  - Trip list with time, earning and a QR/COD badge.
  - "Incentive Records" bonus sheet (`getWalletTransactions type=bonus`).
- **Profile tab (`ProfileV2`):**
  - Header "Profile". Avatar card → profile/details.
  - Referral share (`navigator.share`, falling back to a wa.me link).
  - "Trips history" → history.
  - "Current Shift Verification" card (shift selfie, start time, address).
  - Support tickets, Test Notification (`/fcm-tokens/test`).
  - Delete Account (2-step dialog; you type `DELETE MY ACCOUNT`).
  - Log out (confirm dialog; removes the push device and FCM token, then `logout`).

### Modals and components
- **NewOrderModal:**
  - Handle (minimise), primary-coloured header with earnings (₹, with bonus split) and a **60 s countdown pill**. At 0 it calls `onReject` → `passOrder`.
  - Queue chips when several offers are waiting.
  - Pickup, drop and total distance/ETA (from the backend, or haversine with an ETA of 416 m/min plus prep time).
  - Restaurant and customer blocks with "open in Maps" links, payment info, and items.
  - **"Slide to Accept"** (`ActionSlider`) plus a Reject/Pass text button.
  - Bug: a `useEffect` runs after an early `return null`, which breaks the hooks rule.
- **PickupActionModal:**
  - Restaurant logo, name and address; call (`tel:`) and navigate (Google Maps dir URL); distance and ETA; collapsible items list.
  - PICKING_UP: **"Slide to Reach"** (disabled until within range) → `reachPickup`.
  - REACHED_PICKUP: "Request OTP from restaurant" (`requestPickupOtp`), a 4-digit pickup OTP input, then **"Slide to Pick Up"** → `confirmOrderId(…, {otp})`. There is also a skip path: "Slide to Pick Up (Bypass OTP)" sends `'SKIP'`.
  - Also has a "Mark as Delivered" shortcut.
- **DeliveryVerificationModal:**
  - Step 1 is the customer **drop OTP**: 4 boxes, **"Slide to Verify OTP"** (`verifyDropOtp`), and Resend with a cooldown (it re-calls `reached-drop`). This step is skipped with `skipOtp` or when the order is already verified.
  - Step 2 is **payment collection**. For COD it offers "Show Payment QR" (`createCollectQr` returns a Razorpay QR `image_url`, shown as an image and polled every 4 s via `getPaymentStatus`) or "Collect cash" (`paymentOverride: 'cash'`). Then Complete → `completeDelivery`.
- **PhotoUploadModal** (shift-start selfie):
  - Front camera via `getUserMedia` (720×720, mirrored) with `window.FaceDetector`. When FaceDetector is unavailable, a timer fakes "face detected".
  - Capture → canvas JPEG at quality 0.7 as base64.
  - Reverse-geocodes the address: Google Geocoder, then the Geocoding REST API, then Nominatim, then raw lat,lng.
  - Upload → `updateOnlineStatus(true, base64, address)`.
- **OrderSummaryModal:** full-screen success with earnings.
- **ActionSlider:** a framer-motion drag-to-confirm pill with label, success label, `disabled` and a colour class.
- **BottomPopup:** the shared sheet (handle, title, close, backdrop, max height). Used by Welcome and ProfileDetails. DeliveryHomeV2 defines its own minimal copy, whose close icon is wrongly an AlertTriangle.
- **WeekSelector:** a week-range picker (Radix Popover + Calendar + date-fns). Used by PocketStatement, DeductionStatement and PocketDetails.
- **LiveMap:** see §4.5.
- **DeliveryErrorBoundary:** a fallback card with a reload button.

### Sub pages
- **NotificationsV2:** merges legacy local notifications (always empty now; `getDeliveryNotifications()` returns `[]`) with the server inbox (`useNotificationInbox("delivery",{limit:100})`). Mark read, delete, clear all. Has an empty state.
- **ProfileDetailsV2** (956 lines):
  - Profile photo: take, gallery or remove (sheet).
  - Rider level and total rating.
  - Vehicle Info sheet.
  - Documents list with verification status, a document viewer modal and DL re-upload.
  - "Bank & Payments" sheet: holder, account number, IFSC (regex), bank name, UPI ID (regex), PAN, UPI QR image upload → `updateBankDetailsMultipart`.
  - Uses `history.pushState` so the back button closes sheets.
- **ProfileBankV2 / ProfileDocsV2:** simpler older versions (bank form; "Registration Docs" with a vehicle-number card and Aadhaar/PAN/DL status plus a viewer). Unlinked.
- **PublicSupportV2:** static "Help & Support". It has a hard-coded **stale brand**: `support@thetuggo.com`, `tel:+919917675609`, business hours and 3 FAQ items. It is the only page with many `dark:` classes.
- **SupportTicketsV2:** list → view and create. **CreateSupportTicketV2:** category, subject, description. **ViewSupportTicketV2:** ticket info, status and admin reply.
- **ShowIdCardV2:** "PARTNER ID CARD" with photo, full name, mobile, partner ID and registered vehicle.
- **Pocket sub-pages:**
  - PayoutV2: withdrawal history (wallet txns).
  - PocketStatementV2: week selector, trips and txns. Unlinked.
  - DeductionStatementV2: week selector.
  - LimitSettlementV2: cash-limit settlements.
  - PocketBalanceV2: balance, earnings and a **withdraw** form (`createWithdrawalRequest`; asks for bank details first).
  - CashLimitInfoV2: cash limit, used and available (`getCashLimit`, `getWallet`).
  - PocketDetailsV2: weekly earnings breakdown (`getPocketDetails`).
- **TermsAndConditionsV2 / PrivacyPolicyV2:** CMS HTML from `publicAPI.getTerms("terms_delivery"→"terms")` / `getPrivacy("privacy_delivery"→"privacy")`.

---

## 3. Phone navigation pattern

- **Bottom nav** (only in the HomeShell): white bar with a top border and shadow, `px-8 py-3 pb-6`, 4 items with icon 24 px and label 11 px.
  - Active item: `text-gray-950 scale-110`. Inactive: `text-gray-400 opacity-70`.

| Label | lucide icon | Route |
|---|---|---|
| Feed | `LayoutGrid` | `/food/delivery/feed` |
| Pocket | `Wallet` | `/food/delivery/pocket` |
| Orders | `Package` | `/food/delivery/orders` |
| Profile | `User` | `/food/delivery/profile` |

  History is a fifth shell tab without a nav item.
- **Headers:**
  - Feed: the overlay header described above.
  - Pocket and Profile: a sticky header in `--dv-primary` with a white uppercase title.
  - Orders and History: in-page titles.
  - Sub pages: white header with an `ArrowLeft` back button and a bold title (`text-lg/xl font-bold|black`).
- **No drawer** anywhere.
- **Back behaviour:** `hooks/useDeliveryBackNavigation.js` gives a deterministic parent map, honouring `location.state.backTo|from` when present:
  - `signup/documents` → `signup/details`; `signup/details` → `signup` (which redirects to login).
  - `otp` → login; `terms` → signup.
  - `profile/{details,bank,documents,terms,privacy}`, `help/id-card` and `help/tickets` → `profile`.
  - `help/tickets/create` and `help/tickets/:id` → `help/tickets`.
  - `pocket/*` → `pocket`.
  - Anything else → `/food/delivery`.

  In RN, map this to the native stack plus Android `BackHandler`. On the tab roots, back should exit or minimise; never go back into auth. PocketV2 and ProfileDetailsV2 use `history.pushState` + `popstate` so hardware back closes the open popup. Use `Modal onRequestClose` or bottom-sheet back handling instead.
- **The order sheet "minimise" pattern:** tapping the map or the chevron minimises the sheet to a floating bar above the nav; tapping the bar restores it. It restores itself when `tripStatus` or the incoming order changes.

---

## 4. Global providers, stores and hooks

### 4.1 `store/useDeliveryStore.js` (zustand + persist)
- **State:**
  - `isOnline`, `riderLocation {lat,lng,heading}`, `activeOrder`, `acceptedOrders[]`.
  - `orderCapacity {enabled,maxConcurrentOrders,effectiveLimit,activeOrderCount,remainingSlots,canAcceptMore}`.
  - `tripStatus`: one of `IDLE | PICKING_UP | REACHED_PICKUP | PICKED_UP | DELIVERING | REACHED_DROP | COMPLETED`.
  - `settings {pickupRangeLimit:1500, deliveryRangeLimit:1500}` (metres; never updated from the backend in this module).
- **Persisted:** only `isOnline`, under the localStorage key **`delivery-v2-online-pref`**. `useDeliveryNotifications` also reads that key directly to decide whether to show offers.

### 4.2 Hooks
- `useOrderManager`: `acceptOrder`, `reachPickup`, `pickUpOrder(billImageUrl, otp)`, `reachDrop`, `completeDelivery(otp, paymentOverride, order)`, `resetTrip`. Each calls the API and then `updateTripStatus`.
- `useProximityCheck`:
  - Target: the restaurant during PICKING_UP and REACHED_PICKUP, the customer during PICKED_UP and REACHED_DROP.
  - Gives a haversine `distanceToTarget` and `isWithinRange` (≤1500 m).
  - **Always true in dev** (`import.meta.env.DEV`, or the `VITE_APP_MODE=developer` / `VITE_ENABLE_RANGE_BYPASS` env vars).
- `useDeliveryBackNavigation`: see §3.
- `utils/geo.js`: `getHaversineDistance`, `calculateETA` (rolling speed, falling back to 4.5 m/s), `calculateHeading`.
- `utils/orderLocation.js`: `getRestaurantDisplayInfo` / `getCustomerDisplayInfo` (name, address, coords, `mapsUrl`) and `getOrderPaymentInfo`. Reuse these as they are.
- `utils/trackingInterval.js` (`shouldSendLocationUpdate`, speed-adaptive): **imported but never called** (dead code). It is a good basis for the RN background task.
- Shared from Food: `useCompanyName`, `useAppLogo`, `useNotificationInbox` (notificationAPI inbox, read, dismiss, dismissAll), `utils/orderDispatchId` (normalise, queue upsert/remove, `isSameOrder`, ids), `utils/currency`, `utils/razorpay`, `utils/imageUploadUtils` (`openCamera`), `utils/auth` (`setAuthData`, `isModuleAuthenticated`, `clearModuleAuth`).

### 4.3 Online/offline duty toggle
- **Going online:**
  1. `getCurrentPosition` (high accuracy, 10 s timeout). If that fails, a toast says "enable GPS".
  2. Open the `PhotoUploadModal` selfie.
  3. Upload → `PATCH /food/delivery/availability {status:"online", shiftStartPicBase64, shiftStartAddress}` → `toggleOnline()` → an immediate `updateLocation` → toast "Shift started successfully!".
- **Going offline:** `toggleOnline()` + `PATCH availability {status:"offline"}`.
- **Being forced offline:**
  - A GPS permission error or unavailable position (not a timeout) sets the rider offline and PATCHes offline.
  - The socket `admin_force_status` event sets the store online or offline with a toast.
- **Bug to avoid:** effect "2. Online/Offline Status Sync" depends on `riderLocation`. It therefore re-PATCHes `availability` **and** writes RTDB on *every GPS fix*. In RN, sync status only when it changes.

### 4.4 Location tracking (web behaviour)
- `navigator.geolocation.watchPosition` with `{enableHighAccuracy:true, maximumAge:3000, timeout:10000}`.
- **It runs only while `DeliveryHomeV2` is mounted and `isOnline`.** That covers all 5 shell tabs. Opening any Sub page (pocket/*, help/*, profile/details…) unmounts the shell and stops tracking. When the browser tab is hidden, tracking is best-effort.
- **Keep-alive hacks**, only while online with an active order in PICKING_UP or PICKED_UP:
  - Screen Wake Lock.
  - A silent `AudioContext` oscillator (gain 0.0001) to keep Chrome's JS alive while the rider is in Google Maps.
  - On `visibilitychange` and `focus`: a fresh `getCurrentPosition`.
- **Heading:** GPS heading, or computed from the previous fix when moved more than 1.5 m. Rolling speed is averaged over the last 5 fixes and feeds the ETA.
- **What is sent, and how often:**

| Channel | Condition | Payload |
|---|---|---|
| Socket.IO `update-location` (+ `join-tracking` once per order) | moved ≥ **50 m** or ≥ **10 s** since last send, **and** there is an active order id | lat, lng, heading, speed, accuracy, orderId, userId, restaurantId, status:'on_the_way', encoded route polyline, eta |
| Firebase RTDB `set delivery_boys/{partnerId}` (`writeDeliveryLocation`) | same 50 m / 10 s throttle (also every status change, and the 45 s heartbeat) | lat, lng, heading, speed, accuracy, timestamp, last_updated, isOnline, activeOrderId, status |
| HTTP `PATCH /food/delivery/availability` (`updateLocation`) | ≥ **45 s** since the last HTTP sync (in the watch callback), plus a **45 s `setInterval` heartbeat** while online | status online, latitude, longitude, heading, speed, accuracy |

- The route polyline is also pushed to the customer through `emitLocation` whenever a new Directions result arrives.
- **Geofence auto-arrival:** in production only (not dev or sim), within **100 m** of the target, PICKING_UP calls `reachPickup()` and PICKED_UP calls `reachDrop()` automatically, once per phase. It re-arms when the rider is more than 200 m away.
- **Simulation mode:** a DEV "SIM" button. The Play FAB is also visible in production and should be dropped. It interpolates along the Directions path at 20 fps and emits every 2 s.
- **For RN:**
  - Use `expo-location` `watchPositionAsync` in the foreground.
  - **While online, also use background updates:** `Location.startLocationUpdatesAsync` + `expo-task-manager`, with an Android foreground-service notification ("You are online").
  - Permissions: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`, and the Play background-location declaration.
  - Use the `shouldSendLocationUpdate` throttle and post HTTP plus RTDB from the task (the socket may not be alive in the background).
  - **Product decision to confirm with the user:** web tracks only in the foreground, and native background tracking is a behaviour change.

### 4.5 Maps and navigation (`components/map/LiveMap.jsx`)
- Uses `@react-google-maps/api` `useJsApiLoader` with libraries `places,geometry` and the key from `VITE_GOOGLE_MAPS_API_KEY`. Shows an error UI when the key is missing or the load fails.
- Map options: no default UI, tilt 45, rotate control, and a **light custom style** (geometry `#f5f5f5`, label text `#616161`, POI icons hidden, roads `#ffffff`, water `#c9c9c9`). Zoom comes from the parent (+/-). `fitBounds` covers the rider and target with padding 70/70/120/70.
- **Service zones:** `zoneAPI.getPublicZones()` → `Polygon` with fill `#22c55e`, 3 % opacity.
- **Directions:**
  - Client-side `DirectionsService` (DRIVING) from rider to target (restaurant or customer by phase), plus a "baseline" restaurant → customer route.
  - Refetch throttle: 5 s when under 500 m, 20 s when under 2 km, 60 s otherwise; refetch immediately when off-route (based on the nearest path vertex).
  - The overview path goes to the parent (simulation); the overview polyline goes to the parent, which emits it to the customer.
- **Polylines:**
  - Travelled or baseline part: grey `#9ca3af` dashed (icon `M 0,-1 0,1`, repeating).
  - Remaining route: blue `#3b82f6` solid.
- **Markers:**
  - **Rider:** `OverlayView` with `/MapRider.png` at 72×72, rotated by heading (0.5 s transition).
  - Restaurant: `Marker` with the restaurant image URL, falling back to a flaticon CDN png.
  - Customer: `Marker` with the user image, falling back to a flaticon png.
  - Replace the CDN fallbacks with bundled icons.
- **External navigation:**
  - Restaurant: `window.open("https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=driving")`, or a `search/?api=1&query=address` fallback.
  - Customer: `dir/?api=1&origin=restaurant&destination=customer`.
  - NewOrderModal and OrdersV2 use `mapsUrl` from `orderLocation.js`.
  - For RN: `Linking.openURL('google.navigation:q=lat,lng&mode=d')`, falling back to the https URL.

### 4.6 New-order and assignment alerts (`Food/hooks/useDeliveryNotifications.js`, 1,317 lines, via `DeliveryNotificationProvider`)
- **Socket.IO client:**
  - Connects to `socketOrigin` with path `/socket.io/`, transports `['websocket','polling']`, infinite reconnection (1–5 s back-off), and `auth.token` + `query.token` set to the delivery access token.
  - Emits `join-delivery <partnerId>`.
  - On reconnect, focus or visibility it emits `resync`. The server answers with `resync_complete`, `active_order` and `pending_offers`.
- **Listened events:**
  - `connect`, `delivery-room-joined`, `resync_complete`, `active_order`, `pending_offers` (re-dispatched as window event `deliveryPendingOffers`), `connect_error`, `disconnect`, `reconnect_attempt`, `reconnect`.
  - **`new_order`**, **`new_order_available`**, `play_notification_sound`, `order_ready`, `order_status_update`, `order_cancelled`, `order_deleted`, **`order_auto_killed`**, `order_reassigned_elsewhere`, **`order_claimed`** (taken by another rider), **`admin_notification`** (toast plus inbox refresh), **`admin_force_status`**.
- **Emits:** `join-delivery`, `resync`, `join-tracking <orderId>`, `update-location {...}`.
- **Firebase RTDB:** `onValue(delivery_partner_offers/{partnerId})` is a second offer feed and only counts when the rider is online. Removed keys mean the offer is gone.
- **FCM:** foreground web messages are relayed by `firebaseMessaging.js` as the window event `delivery-fcm-order-alert`.
- **Polling fallback** (DeliveryHomeV2): every **15 s** without a socket and **45 s** with one, while online on the feed or orders tab: `GET /orders/active` and `GET /orders/available?limit=20`. Offers are filtered on dispatch status `unassigned|assigned` and order status `confirmed|preparing|ready_for_pickup`.
- **Alert:**
  - `handleIncomingOrderAlert` → `navigator.vibrate([200,100,200,100,300])`, plus an **alert loop every 4.5 s for up to 120 s** until `clearNewOrder()` (accept, pass or claimed).
  - A browser `Notification` / service-worker notification is shown when the tab is hidden.
  - **Note: the `audio.play()` for `alert.mp3` is commented out**, so in-app the web is currently silent and only vibrates. The FCM push path can play `alert.mp3` once the user taps `PushSoundEnableButton`.
  - For RN, follow the restaurant-app decision: loop `alert.mp3` and vibrate, and use a high-priority push with a custom-sound notification channel.
- **Offer queue:**
  - Several offers are queued; the first is shown and the rest appear as chips in the modal.
  - "GhostAssignFix": the accept target must match the locked visible id.
  - When the rider is at capacity (`canAcceptMore === false`) the modal is hidden.
  - **Countdown:** 60 s per offer → auto-pass (`POST /orders/:id/pass`).
- **Accept / reject:** slide to accept → `POST /orders/:id/accept` → refresh `GET /orders/active`. Pass → `POST /orders/:id/pass`. A 403 or "already accepted" error removes the offer from the queue with a toast.

### 4.7 Active order flow (API per step)

| Step | UI | API (base `/api/v1/food/delivery`) | tripStatus |
|---|---|---|---|
| Accept | Slide to Accept | `POST orders/:id/accept` | PICKING_UP |
| Arrive at restaurant | Slide to Reach (range-gated; auto at ≤100 m) | `POST orders/:id/reached-pickup` | REACHED_PICKUP |
| Pickup OTP | "Request OTP" → restaurant gives a 4-digit code | `POST orders/:id/request-pickup-otp` | – |
| Picked up | Slide to Pick Up (otp, or `SKIP`) | `POST orders/:id/confirm-pickup {confirmedOrderId, location, otp, billImageUrl:null}` | PICKED_UP |
| Arrive at drop | Slide to Arrive (range-gated; auto at ≤100 m) | `POST orders/:id/reached-drop` (also used to resend the drop OTP) | REACHED_DROP |
| Drop OTP | Verify & Complete → 4-digit OTP → Slide to Verify | `POST orders/:id/verify-drop-otp` | – |
| COD payment | Show Payment QR (poll 4 s), or Collect cash | `POST orders/:id/payment-qr`, `GET orders/:id/payment-status` | – |
| Delivered | Complete | `POST orders/:id/complete {otp, rating:5, paymentOverride, paymentMethod}` | COMPLETED → summary → `resetTrip` |

The exact HTTP verbs are in `src/services/api/index.js` around line 1461. Check them in the API audit.

A "Mark as Delivered" shortcut opens verification with `skipOtp`, which sends otp `BYPASS`. An `order_auto_killed` event (over 1 h) prompts for a reason → `POST orders/:id/reject {reason}`.

### 4.8 localStorage keys used by the delivery module
- **Auth:** `delivery_accessToken`, `delivery_refreshToken` (`setAuthData` also writes `delivery:refreshToken`), `delivery_authenticated`, `delivery_user`.
- **Login and signup drafts:** `delivery_draft_phone`, `deliveryAuthData`, `deliverySignupDetails`, `deliverySignupDocs`, `deliveryNeedsRegistration`, and IndexedDB `DELIVERY_FILES_DB` (signup images).
- **State:** `delivery-v2-online-pref` (zustand), `app:isOnline`.
- **Push:** `fcm_web_registered_token_delivery`, the FCM token cache `${tokenCachePrefix}delivery`, `delivery_notification_permission_asked`, `push_sound_enabled`.
- **Branding and theme:** `delivery_app_logo`, `deliveryAppTheme` (ThemeContext; unused by delivery).
- **Debug:** `delivery_socket_debug`.
- **Window events:** `deliveryAuthChanged`, `authRefreshFailed`, `authRefreshed`, `deliveryPendingOffers`, `delivery-fcm-order-alert`, `deliveryNotificationsUpdated`, `push-sound-enabled`.

---

## 5. Design tokens

### 5.1 `deliveryTheme.css`

| Token | Value | Use |
|---|---|---|
| `--dv-primary` | **`#15498b`** (deep blue) | Headers, CTAs, and *every* remapped accent (see below) |
| `--dv-primary-strong` | `#000000` | Hover state and gradient end |
| `--dv-primary-soft` | `#e7effa` | Remapped `bg-*-50` tints |
| `--dv-accent` | `#000000` | (unused) |
| `--dv-surface` | `#ffffff` | |
| `--dv-bg` | `#eef3fb` | Remapped `bg-yellow-*`, `bg-[#f6e9dc]` |
| `--dv-text` | `#0f1724` | Body text |
| `--dv-muted` | `#4f5f77` | |
| `--dv-border` | `#d1dceb` | Card borders (rounded-2xl/3xl) |

- **Page background:** two radial gradients (`#d5e3f7`, `#e7edf8`) over a linear gradient `#f7faff → #edf2fb`. Most screens paint white or `gray-50` over it.
- **The CSS overrides colours with `!important` inside `.delivery-v2-theme`:**
  - Tailwind `text-` and `bg-` orange-500/600, green-500/600, emerald-500/600, blue-500/600, cyan, indigo and teal, plus `text-primary`, `bg-primary`, `#EB590E`, `#10B981` and `#00B761`, all render as **`--dv-primary`**.
  - The `-50` tints and `/10` alphas become `--dv-primary-soft`.
  - Those borders become 28 % primary mixed with white.
  - Gradients `from-*` and `to-*` become primary → strong.
  - **So the rendered app is monochrome blue (`#15498b`) plus black, white and greys, with red for errors and emergency.** For example, the ARRIVAL card that the JSX colours `#10B981` shows blue, and the "orange" distance card shows blue.
- **Online toggle exception:** online `#22c55e` and offline `#ef4444`.
- **Inputs:** border `#e8dee7`, white background. Focus ring: `0 0 0 4px rgb(21 73 139 / .15)`.
- **Cards:** `rounded-2xl` and `rounded-3xl` get shadow `0 10px 28px -18px rgba(17,39,67,.24)`.
- **Small screens:** below 640 px, `px-6`/`p-6` shrink to 1.1rem.

**Runtime colour.** `GET https://cityfood.co.in/api/v1/app-config/delivery_app` (checked live with curl) returns **HTTP 404 `{"success":false,"message":"Config not found"}`**. So production uses the CSS defaults: **primary `#15498b`, strong `#000000`**. The admin ThemeSettings default for delivery is `#0ea5e9`/`#0284c7`, but nothing is saved. For RN, hard-code `#15498b`/`#000` and optionally fetch the same endpoint, ignoring a 404. `fontFamily` from that config would set `--main-font-family`, but it is absent.

Other literal colours in the JSX: the verify gradient `linear-gradient(33deg,#15498b,#000)`; the drop polyline `#3b82f6` and baseline `#9ca3af`; the zone `#22c55e`; the offline placeholder background `#f8f9fa`; SignIn headline colours `#1e293b` and `#0f766e` (teal, not remapped because they are arbitrary values); and PublicSupport `#1A2642`, `#E53935`, `#4CB8C4`.

### 5.2 Fonts
- `deliveryTheme.css` `@import`s Google Fonts **Nunito Sans 500/600/700/800** and **Sora 600/700**. These are the only fonts that render inside the module:
  - Body: `font-family: "Nunito Sans", "Outfit", "Poppins"`, and `.delivery-v2-theme *` inherits it.
  - **h1–h4, `.font-black` and `.font-extrabold` use Sora** (letter-spacing .01em).
- **Outfit** is loaded globally in `index.html` (with Inter and Poppins) and referenced as `font-['Outfit']` in SignIn. The unlayered `* { font-family: inherit }` rule beats Tailwind v4's layered utilities, so **Outfit does not render**, and `font-poppins` is explicitly remapped to Nunito Sans.
- RN: `@expo-google-fonts/nunito-sans` (500/600/700/800) and `@expo-google-fonts/sora` (600/700). Use Sora for headings and any `font-black`/`font-extrabold` text, and Nunito Sans for the rest.

### 5.3 Typography and spacing habits (counted from className strings)
- **Weights:** `font-bold` 263, `font-black` 143, `font-medium` 74, `font-semibold` 32.
- **Case and tracking:** `uppercase` 197, `tracking-widest` 111, `tracking-tight` 30, `tracking-wider` 21. The style is heavy, uppercase micro-labels.
- **Sizes:** `text-sm` 142, `text-[10px]` 107, `text-xs` 76, `text-[11px]` 38, `text-[9px]` 24, `text-lg` 41, `text-xl` 30, `text-2xl` 12.
- **Radii:** `rounded-full` 105, `rounded-2xl` 86, `rounded-xl` 68, `rounded-lg` 30, `rounded-3xl` 26. Bottom sheets use `rounded-t-3xl`/`rounded-[3rem]`.
- **Spacing:** `px-4` 80, `p-4` 42, `py-4` 33, `py-3` 29, `p-6` 24, `p-5` 24; `gap-2` 67, `gap-4` 62, `gap-3` 51.
- **Shadows:** `shadow-sm` 60, `shadow-2xl` 28, `shadow-lg` 21, `shadow-xl` 20.
- **Colours** (Tailwind v4 palette): `text-gray-400` 129, `bg-white` 120, `text-white` 80, `border-gray-100` 78, `text-gray-900` 75, `text-gray-500` 58, `text-gray-950` 50, `bg-gray-50` 50, `text-red-500` 35, `text-gray-600` 31, `text-gray-700` 28, `border-gray-200` 27, `bg-gray-100` 22, `text-blue-600` 21 (renders as primary), `bg-black` 16.
- Tailwind v4 gray hex values: 50 `#f9fafb`, 100 `#f3f4f6`, 200 `#e5e7eb`, 400 `#99a1af`, 500 `#6a7282`, 600 `#4a5565`, 700 `#364153`, 900 `#101828`, 950 `#030712`; red-500 `#fb2c36`, red-600 `#e7000b`. These are the v4 oklch values converted to hex; reuse the user app's palette file if it already has them.

### 5.4 Dark mode
- **Not supported by delivery.** `src/index.jsx` defaults `/delivery` paths to light. There is no theme toggle and no `useTheme` in DeliveryV2. Only a few `dark:` classes exist (OTP 14, PublicSupport 22, Privacy 6, Terms 2), and they are leftovers. **Build light only.**

### 5.5 Icons
- **lucide-react only.** About 50 icons, including:
  - Navigation and arrows: ArrowLeft, ArrowRight, ChevronDown, ChevronRight, LayoutGrid, Navigation, Navigation2, Target, Plus, Minus, ExternalLink.
  - Alerts and status: AlertTriangle, Bell, Check, CheckCircle, CheckCircle2, Clock, Clock3, History, HelpCircle, Loader2.
  - Money: Banknote, CreditCard, IndianRupee, Wallet.
  - Contact and people: Contact, Mail, MessageSquare, Phone, Send, Star, User.
  - Places and orders: ChefHat, MapPin, Package, Store.
  - Media and actions: Camera, Edit2, Eye, FastForward, FileText, Image, Pause, Play, Save, Trash2, Upload, X.
- RN: `lucide-react-native` + `react-native-svg`.

---

## 6. Assets

Every image and sound the delivery module uses was checked with `file`. **All are valid.** None of the delivery assets have CRLF corruption.

| Asset | Used by | Status / source for RN |
|---|---|---|
| `Frontend/public/MapRider.png` | LiveMap rider marker | PNG 408×612 RGBA. A byte-identical copy is in `mobile-user/assets/images/MapRider.png`. |
| `Frontend/public/delivery_avatar.png` | header avatar fallback, offline hero | **Actually a JPEG**, 1024×1024. Copy it as `.jpg`. |
| `Frontend/public/delivery-hero-clean.png` | SignIn hero | PNG 576×206 RGBA |
| `Frontend/public/delivery-hero-seamless.png` | SignIn hero fallback | PNG 576×208 RGBA (could skip) |
| `Frontend/public/logo.png` | SignIn logo fallback | PNG 512×512 (a different file from `src/assets/logo.png`) |
| `Frontend/src/assets/logo.png` | SignIn import | PNG 640×640. Same bytes as `mobile-user/assets/images/logo.png` and `mobile-delivery/assets/images/logo.png` (already present). |
| `Frontend/src/modules/Food/assets/audio/alert.mp3` | new-order alert (socket and FCM) | MP3 128 kbps 44.1 kHz, 449 KB. Also at `Frontend/public/alert.mp3`. |
| `Food/assets/audio/zomato_sms.mp3` | generic push sound (user module) | valid; not needed for delivery |
| Remote: `flagcdn.com/w40/in.png`, flaticon PNGs (restaurant 3170733, customer 1275302, rider 2950150) | SignIn flag, map marker fallbacks | Replace with bundled icons or emoji. |

Unused in `public/`: `delivery-rider.png` and `delivery-hero-reference.png`. `mobile-delivery/assets/` already has icon, splash, android-icon-*, notification-icon and `images/logo.png`.

---

## 7. Web-only APIs and libraries → Expo equivalents

| Web (where) | Expo / RN equivalent | Notes |
|---|---|---|
| `@react-google-maps/api` GoogleMap, Marker, Polygon, Polyline, OverlayView (LiveMap) | `react-native-maps` with `PROVIDER_GOOGLE`, `customMapStyle` (same JSON), `Marker` (rider image, `rotation={heading}`, `flat`, `anchor {0.5,0.5}`), `Polyline` (`lineDashPattern` for the dashed baseline), `Polygon` for zones | Needs an Android Maps SDK key in `app.config.js` (`android.config.googleMaps.apiKey`); dev build. |
| `DirectionsService` (client JS) | `fetch` the Directions REST API (`maps.googleapis.com/maps/api/directions/json`) and decode `overview_polyline` (`@mapbox/polyline` or a 20-line decoder), or `react-native-maps-directions` | Keep the 5/20/60 s + off-route throttle; the key needs the Directions API enabled. Send the encoded polyline to the customer as the web does. |
| `google.maps.geometry.spherical.computeDistanceBetween` | `utils/geo.getHaversineDistance` | |
| `google.maps.Geocoder` + Geocoding REST + Nominatim (selfie address) | `Location.reverseGeocodeAsync` (expo-location), with Google REST as fallback | |
| `navigator.geolocation.watchPosition` / `getCurrentPosition` | `expo-location` `requestForegroundPermissionsAsync`, `watchPositionAsync({accuracy: High, distanceInterval, timeInterval})`, `getCurrentPositionAsync` | |
| Foreground-only tracking + Wake Lock + silent AudioContext hack | **Background:** `Location.startLocationUpdatesAsync` + `expo-task-manager` + `foregroundService` notification while online; `expo-keep-awake` while on an active trip | Behaviour change: confirm with the user. Drop the AudioContext hack. |
| `visibilitychange` / `focus` refresh | `AppState` change listener | |
| `window.open(google maps URL)` | `Linking.openURL('google.navigation:q=lat,lng&mode=d')`, falling back to `https://www.google.com/maps/dir/?api=1…` | |
| `window.location.href = 'tel:'` | `Linking.openURL('tel:…')` | |
| `getUserMedia` + `<video>` + canvas + `window.FaceDetector` (shift selfie) | `expo-camera` `CameraView facing="front"` + `takePictureAsync({base64, quality:0.7})`, or `expo-image-picker.launchCameraAsync({cameraType: front})`; `expo-image-manipulator` to resize and compress | Face detection: `expo-face-detector` is deprecated. Skip it, as the web already fakes it when unsupported, or add an ML Kit plugin later. |
| `<input type=file accept capture>` + Flutter `openCamera` bridge + canvas WebP compress + IndexedDB drafts (KYC signup, profile docs, bank UPI QR) | `expo-image-picker` (camera and library) → `expo-image-manipulator` (1024 px, WEBP/JPEG 0.8) → multipart `FormData` `{uri, name, type}`; keep drafts as file URIs in AsyncStorage (`expo-file-system` for copies) | Field names: `profilePhoto, aadharFrontPhoto, aadharBackPhoto, panPhoto, drivingLicenseFrontPhoto, drivingLicenseBackPhoto, rcPhoto` (+ text fields). |
| `new Audio(alert.mp3)` (commented out on web) + `navigator.vibrate` | `expo-audio` (or `expo-av`) looping player; `Vibration.vibrate([200,100,200,100,300], true)` / `expo-haptics` | Loop every ~4.5 s for 120 s until accept/pass, as the restaurant app does. |
| Web Notification API, service worker, web FCM (`firebase/messaging`), `PushSoundEnableButton` | `expo-notifications` + native FCM (`google-services.json` already in mobile-delivery): Android channel "orders" with HIGH importance and custom sound `alert.mp3`; send the token with `deliveryAPI.saveFcmToken(token,'android')` / `savePushDevice`; on logout `removePushDevice`/`removeFcmToken` | Push was blocked for the user app; check the server's FCM sender config. |
| `socket.io-client` | same package in RN (`transports:['websocket']`) | Reconnect on `AppState` active and emit `resync`. |
| `firebase/database` (RTDB writes `delivery_boys/{id}`, reads `delivery_partner_offers/{id}`) | the Firebase JS SDK works in RN, or `@react-native-firebase/database` | Needs the RTDB URL in config. |
| zustand `persist` (localStorage) | zustand `persist` + `createJSONStorage(() => AsyncStorage)` | |
| localStorage tokens | `expo-secure-store` for tokens; AsyncStorage for drafts and flags | |
| `window.addEventListener` custom events (`deliveryAuthChanged`, `deliveryPendingOffers`, …) | a small event emitter or a zustand store | |
| `sonner` toasts | `react-native-toast-message` (or the user app's toast) | |
| `framer-motion` drag slider (`ActionSlider`), spring sheets, AnimatePresence | `react-native-gesture-handler` + `react-native-reanimated` swipe button; `@gorhom/bottom-sheet` or `Modal` | |
| `window.history.pushState` / `popstate` (back closes popup) | `BackHandler` / `Modal onRequestClose` | |
| Razorpay web checkout (`initRazorpayPayment`, cash deposit) | `react-native-razorpay` (dev build), or Razorpay checkout in `react-native-webview` | Then call `verifyDepositPayment`. |
| Razorpay collect QR (`image_url`) | `<Image source={{uri}}>` + 4 s polling | |
| `window.prompt` (auto-killed reason) | custom modal with `TextInput` | |
| Radix Popover + shadcn Calendar + date-fns (WeekSelector, History date picker) | a custom week-picker sheet + `date-fns` (works in RN), or `react-native-calendars` | |
| `navigator.share` / wa.me fallback (referral) | `Share.share({message})` from react-native | The web referral URL `…/signup?ref=` redirects to login. Decide with the backend whether the referral should open the app (deep link) or the website. |
| Clipboard (if any) | `expo-clipboard` | |
| `dangerouslySetInnerHTML` CMS HTML (Terms, Privacy) | `react-native-render-html` (or a WebView) | |
| `window.flutter_inappwebview`, `ReactNativeWebView`, iOS scroll hacks, `import.meta.env.DEV` sim/bypass | Remove; use `__DEV__` for any dev-only simulation | |
| Charts / PDF | **none in delivery** (`payoutPdfGenerator` is not imported) | – |

---

## 8. Screens to leave out (or merge)

| Screen | Reason |
|---|---|
| `auth/Welcome` (`/welcome`) | Mock: hard-coded "₹100 unlock", fake audio player, confetti; nothing links to it. |
| `/signup` route | Only a redirect to login. |
| `profile/ProfileBankV2` (`/profile/bank`) | Unlinked; superseded by the "Bank & Payments" sheet in ProfileDetailsV2. |
| `profile/ProfileDocsV2` (`/profile/documents`) | Unlinked; ProfileDetailsV2 lists the documents and has a viewer. Optionally merge its vehicle card. |
| `pocket/PocketStatementV2` (`/pocket/statement`) | Unlinked (no navigate to it). Optional: build it later if the user wants it. |
| `/terms` (bare) | Unlinked duplicate of `profile/terms`; keep one Terms screen. |
| Duplicate `profile/terms` / `profile/privacy` protected routes | Shadowed duplicates; keep one public route each. |
| PocketV2 → `/earnings` card | Broken link (no route); drop it or point it to pocket/details. |
| DEV "SIM" button + Play FAB simulation, "Bypass OTP" pickup slider, range bypass | Dev and test tooling (the Play FAB even ships in production). Keep behind `__DEV__` at most. |
| "Navigation2" FAB (`gestureHandling: greedy`) | Web-only map gesture tweak. |
| OTP "name input" step | Dead (`showNameInput` is never true). |
| Legacy local notifications (`deliveryNotifications.js`) | Always empty; use only the server inbox. |
| `PublicSupportV2` stale contact (`support@thetuggo.com`, `+91 9917675609`) | Keep the screen but take the email and phone from business settings, or ask the user. |
| `PushSoundEnableButton`, web-push registration, Flutter bridges | Replaced by native permissions and push. |

Keep the rest:
- Auth: login, OTP with pending/rejected, signup 2 steps.
- Shell tabs: Feed, Pocket, Orders, History, Profile.
- Notifications, profile/details, support, ticket list/create/view, ID card.
- Pocket: payout, deductions, limit settlement, balance, cash limit, details.
- Terms, Privacy.

---

## Counts

- **Routes:** 34 `<Route>` elements and 32 unique paths in `DeliveryV2Router`.
  - 6 public auth/legal paths: welcome, login, otp, signup/details, signup/documents, terms (plus profile/terms and profile/privacy, public as declared).
  - 1 public support page.
  - 6 HomeShell paths (index plus 5 tabs).
  - 18 other protected sub pages.
  - 2 redirects (`signup`, `*`).
- **Page files:** 28 (5 auth, 1 shell, 4 tab pages, 1 notifications, 3 profile, 5 help, 7 pocket, 2 legal).
- **Phone screens to build:** 23 = login, OTP, signup ×2, shell with 5 tabs (feed, pocket, orders, history, profile), notifications, profile details, support, tickets ×3, ID card, pocket subs ×6, terms, privacy.
- **Screens to leave out:** 5. Welcome, ProfileBank, ProfileDocs and PocketStatement are dropped; bare `/terms` is merged into Terms.
- **Modals and sheets:** 6 order/trip modals (NewOrder, PickupAction, the inline drop card, DeliveryVerification with COD QR, OrderSummary, PhotoUpload selfie) plus Emergency, Notifications, Deposit, Logout, Delete-account, the History pickers and bonus sheet, and the ProfileDetails sheets (photo, vehicle, bank, document viewer, remove photo).
- **Components:** 11 (BottomPopup, ErrorBoundary, LiveMap, 5 modals, ProtectedRoute, ActionSlider, WeekSelector).
- **Hooks:** 3 + `proximity.utils`. **Utils:** 3 (`trackingInterval` unused). **Store:** 1.
- **Socket events:** 21 listened (incl. connection lifecycle), 4 emitted. **RTDB paths:** 2 (`delivery_boys/{id}` write, `delivery_partner_offers/{id}` read).
- **Assets:** 6 local images/sounds needed; all valid. `delivery_avatar.png` is really a JPEG.
- **Design:** 1 primary colour in use (`#15498b`; live app-config is 404); 2 fonts actually rendered (Nunito Sans, Sora); 1 icon library (lucide); dark mode none.
