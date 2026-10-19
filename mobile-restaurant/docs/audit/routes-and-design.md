# Restaurant Partner App: Routes, Screens and Design Audit

This is a read-only audit of the React web app in `Frontend/`. It covers what we need to port the **restaurant partner panel** (the app restaurant owners use) to Expo / React Native.

**Scope:** we build only the phone-width layout.

**Paths:** unless stated otherwise, paths are relative to `Frontend/src/modules/Food/`. `@food/` resolves to that folder and `@/` resolves to `Frontend/src/`.

---

## 0. Key findings (read first)

1. **Phone users get no order ringtone.** The ringtone currently loops only on desktop. `OrdersMain.jsx` gates the alert loop behind `window.matchMedia("(min-width: 768px)")`. The RN app must ring, vibrate and show a full-screen alert on the phone.
2. **Some routes are reachable only from the hamburger drawer.** On phones the drawer is opened from the header. Dashboard, Ratings & reviews and Withdrawal history are linked only from there. Everything else is also reachable from the **Explore** tab.
3. **Many routed screens are stubs, mocks or broken, or nothing links to them.** See §8 for the list:
   - DaySlots, FinanceDetailsPage, Hyperpure, DishRatings, RushHour, PhoneNumbersPage, DownloadReport, ManageOutlets
   - FssaiDetails / FssaiUpdate
   - EditCuisines, EditRestaurantAddress
   - ForgotPassword
4. **Links without the `/food` prefix still work on the web.** Several pages navigate to `/restaurant/...`, and `app/routes.jsx` routes `/*` to the Food module, so those paths still mount `RestaurantRouter` and keep `location.state`. (`RedirectToFood` is defined there but not used in any route.) In RN, give every screen one canonical name.
5. **The brand colour comes from the server.** `--rt-primary` defaults to `#B80B3D` but is overwritten at runtime from `GET /app-config/restaurant_app` (`primaryColor`, `secondaryColor`, `logoUrl`). The header gradient is **hard-coded** `#B80B3D → #66001D` and ignores the server value.
6. **All restaurant onboarding and login banner images are corrupted.** These are `assets/restaurant/loginbanner1..4.png` and `assets/loginbanner.png`, damaged by the LF→CRLF conversion in git. Undoing the CRLF conversion does not repair them (every PNG chunk fails its CRC check). `mobile-user/assets/images` has no copy. Valid replacements are `Frontend/public/restaurant-banner.jpg` and `public/logo.png`, or new artwork.
7. **There is no dark mode.** `ThemeContext` defaults the restaurant to light (key `restaurantAppTheme`) and has no toggle. 87 `dark:` classes remain in OTP, Onboarding, Feedback and Inventory, but nothing turns them on. Build the RN app light-only.
8. **One socket connection is opened twice.** `GlobalPickupOtpModal` sits outside `RestaurantNotificationProvider`, so it calls `useRestaurantNotifications()` without the context and opens a second socket connection. The RN app should use one provider.

---

## 1. Routing

### 1.1 How a URL reaches the restaurant screens

| File | Matches | Notes |
|---|---|---|
| `Frontend/src/app/routes.jsx` | `/restaurant/auth/*` → `modules/auth/routes.jsx` (generic Login / Support; `*` redirects to `/user/auth/login`) | **Not** the restaurant login. It is shared and unrelated, so leave it out. |
| | `/food/*` → `FoodAppWrapper`; `/*` → `FoodAppWrapper` | Both `/food/restaurant/...` and `/restaurant/...` reach the Food module. |
| | Native-shell detection stores the last route in `localStorage.native_last_route` | Web-wrapper only; drop it. |
| `modules/Food/routes.jsx` | `restaurant/*` → `RestaurantRouter` | Wrapped in `AuthInitializer`, `ScrollToTop` and `PushSoundEnableButton`. Calls `registerWebPushForCurrentModule()` (web FCM) once per module. |
| `components/restaurant/RestaurantRouter.jsx` | All restaurant screens (below) | Wraps everything in `<div class="restaurant-theme">` and imports `restaurantTheme.css`. Renders `<GlobalPickupOtpModal/>` on **every** restaurant route. |

### 1.2 Guards

| Guard | File | Behaviour |
|---|---|---|
| `ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login"` | `components/ProtectedRoute.jsx` → `utils/auth.js#isModuleAuthenticated` | Passes if `restaurant_accessToken` is unexpired and the JWT role can access the module. Also passes if the access token has expired but `restaurant_refreshToken` is still valid. Otherwise redirects to login with `state.from`. |
| `RestaurantBlockGuard` | `components/restaurant/RestaurantBlockGuard.jsx` | On mount and every **30 s** it calls `restaurantAPI.getCurrentRestaurant()`. See the outcomes below. |
| Onboarding / approval | Not a route guard; handled inside screens | `OrdersMain` redirects to `/food/restaurant/onboarding?step=N` if onboarding is incomplete (`onboardingUtils`). OTP sends the user to onboarding or pending-verification. VerificationPending checks approval once on mount. |

`RestaurantBlockGuard` outcomes:
- **Loading:** a "Checking account status…" spinner.
- **Blocked** (`status==='rejected'` or `isActive===false`): an "Account Blocked" screen (ShieldX icon, "You are blocked by Admin") with a Logout button that clears auth and goes to login.
- **401:** clears auth and goes to login.
- **Network error:** treated as active.

### 1.3 Layout

`RestaurantLayout` (`components/restaurant/RestaurantLayout.jsx`) wraps every protected route. It provides:
- `RestaurantNotificationProvider`, which holds the socket and new-order state (§4).
- `RestaurantLayoutProvider`, whose visibility options come from `utils/restaurantLayoutConfig.js`.
- **Shell:** `RestaurantSidebar` (a drawer on phone), a `<header>` containing `RestaurantNavbar`, a scrolling `<main id="restaurant-main-scroll">` (body scroll is locked), and `BottomNavOrders`.
- **Navbar and sidebar:** shown on **every** protected route (`showNavbar: true`, `showSidebar: true`).
- **Bottom nav:** hidden when the path contains `/create-offers`, `/hub-menu/item`, `/outlet-timings/` or `/orders/`. Because of the `/orders/` match, it is hidden on `orders/all` **and** on `orders/:id`.
- **Bottom padding:** when the bottom nav is shown, `main` gets `pb-[calc(5.5rem+safe-area)]`.

### 1.4 Every restaurant route

Base is `/food/restaurant`. All components are lazily loaded from `pages/restaurant/`.

**Auth and public routes:** no guard, no `RestaurantLayout`, no navbar or bottom nav.

| # | Path | Component | Notes |
|---|---|---|---|
| 1 | `welcome` | `auth/Welcome.jsx` | Onboarding carousel |
| 2 | `login` | `auth/Login.jsx` | Phone login |
| 3 | `otp` | `auth/OTP.jsx` | 6-digit backend OTP |
| 4 | `signup` | `auth/Signup.jsx` | Name and phone |
| 5 | `forgot-password` | `auth/ForgotPassword.jsx` | Legacy email/password reset; nothing links to it |
| 6 | `pending-verification` | `auth/VerificationPending.jsx` | Pending or rejected status |
| 7 | `onboarding` (`?step=1..3`) | `Onboarding.jsx` | 3-step registration wizard. **No guard** but it reads the token or pending phone itself. |
| 8 | `privacy` | `PrivacyPolicyPage.jsx` | |
| 9 | `terms` | `TermsAndConditionsPage.jsx` | |
| 10 | `profile/privacy` | `PrivacyPolicyPage.jsx` | Linked from Login and Signup |
| 11 | `profile/terms` | `TermsAndConditionsPage.jsx` | Linked from Login and Signup |

**Protected routes:** `ProtectedRoute` → `RestaurantBlockGuard` → `RestaurantLayout`. Every one of these has the navbar and the sidebar drawer. The "Bottom nav" column shows whether the bottom nav is visible.

| # | Path | Component | Bottom nav | Reachable from (phone) |
|---|---|---|---|---|
| 12 | `` (index) | `OrdersMain.jsx` | yes (Orders tab) | Bottom nav; home |
| 13 | `dashboard` | `RestaurantDashboard.jsx` (uses `RestaurantPageShell`) | yes | **Drawer only** |
| 14 | `orders/all` | `AllOrdersPage.jsx` | no | Explore → Order history; drawer; Dashboard |
| 15 | `orders/:id` | `OrderDetails.jsx` | no | Orders list, All orders, Dashboard |
| 16 | `notifications` | `Notifications.jsx` | yes | Navbar bell; drawer; HubFinance |
| 17 | `delivery-settings` | `DeliverySettings.jsx` | yes | Explore; drawer |
| 18 | `rush-hour` | `RushHour.jsx` | yes | **Nothing links here** |
| 19 | `menu-categories` | `MenuCategoriesPage.jsx` | yes | Explore; drawer; ItemDetails category sheet |
| 20 | `explore` | `ExploreMore.jsx` | yes (Explore tab) | Bottom nav |
| 21 | `outlet-timings` | `OutletTimings.jsx` | yes | Explore; drawer |
| 22 | `outlet-timings/:day` | `DaySlots.jsx` | no | **Nothing links here** (and it is broken) |
| 23 | `outlet-info` | `OutletInfo.jsx` | yes | Explore restaurant card; drawer |
| 24 | `ratings-reviews` | `RatingsReviews.jsx` (static FAQ) | yes | Drawer |
| 25 | `edit-owner` | `EditOwner.jsx` | yes | Explore profile area |
| 26 | `edit-cuisines` | `EditCuisines.jsx` | yes | **Nothing links here** |
| 27 | `edit-address` | `EditRestaurantAddress.jsx` | yes | **Nothing links here** |
| 28 | `inventory` | `Inventory.jsx` | yes (Inventory tab) | Bottom nav; drawer |
| 29 | `feedback` (`?tab=reviews/complaints`) | `Feedback.jsx` | yes (Feedback tab) | Bottom nav; Explore; drawer; Dashboard |
| 30 | `share-feedback` | `ShareFeedback.jsx` | yes | Explore (links to `Share-Feedback`; matching is case-insensitive); drawer |
| 31 | `dish-ratings` | `DishRatings.jsx` (stub) | yes | **Nothing links here** |
| 32 | `help-centre/support` | `RestaurantSupport.jsx` | yes | Explore; drawer; All orders; Feedback |
| 33 | `fssai` | `FssaiDetails.jsx` (placeholder) | yes | ManageOutlets only, which nothing links to |
| 34 | `fssai/update` | `FssaiUpdate.jsx` (stub) | yes | FssaiDetails only |
| 35 | `hyperpure` | `Hyperpure.jsx` (stub) | yes | **Nothing links here** |
| 36 | `hub-menu/item/:id` (`new` = create) | `ItemDetailsPage.jsx` | no | Inventory |
| 37 | `hub-finance` (`?tab=invoices`) | `HubFinance.jsx` | yes | Explore; drawer |
| 38 | `withdrawal-history` | `WithdrawalHistoryPage.jsx` | yes | HubFinance; drawer |
| 39 | `finance-details` | `FinanceDetailsPage.jsx` | yes | **Nothing links here** (the handler is never called, and the page crashes) |
| 40 | `phone` | `PhoneNumbersPage.jsx` (mock) | yes | **Nothing links here** |
| 41 | `download-report` | `DownloadReport.jsx` (mock) | yes | **Nothing links here** |
| 42 | `promocodes` | `Promocodes.jsx` | yes | Explore; drawer |
| 43 | `manage-outlets` | `ManageOutlets.jsx` (legacy) | yes | **Nothing links here** |
| 44 | `update-bank-details` | `UpdateBankDetails.jsx` | yes | Explore; drawer |
| 45 | `reservations` | `<Navigate to="/food/restaurant/explore">` | — | Redirect only |
| 46 | `zone-setup` | `ZoneSetup.jsx` | yes | Explore; drawer |

Overlays that every restaurant route can show:
- `GlobalPickupOtpModal` (`components/restaurant/GlobalPickupOtpModal.jsx`): shown when the socket sends `pickup_otp_reveal`. It reads "Delivery Partner Arrived", shows the OTP big and has a "Got it" button.
- The navbar's "New Table Request!" dining popup.
- The new-order popup inside `OrdersMain`.

### 1.5 Auth flow

The OTP is a **backend phone OTP** (`restaurantAPI.sendOTP` / `restaurantAPI.verifyOTP`), not Firebase phone auth. Firebase is used only for FCM and for `signOut` on logout.

```
Welcome (4-slide carousel)
  ├─ Login ──► sendOTP("+91 XXXXXXXXXX","login")
  │             sessionStorage.restaurantAuthData = {method:"phone", phone, isSignUp:false, module:"restaurant"}
  │             sessionStorage.restaurantLoginPhone
  └─ Signup ─► sendOTP(fullPhone,"register")
                sessionStorage.restaurantAuthData = {isSignUp:true, name, ...}
                        │
                        ▼
OTP (6 boxes, resend timer) ── verifyOTP(phone, code, purpose, null, email, fcmToken, platform)
  ├─ needsRegistration ─► localStorage.restaurant_pendingPhone → Onboarding
  ├─ pendingApproval (or an error message saying so) ─► pending-verification {phone, isRejected, rejectionReason}
  └─ accessToken + user ─► setAuthData("restaurant", ...) writes
       restaurant_accessToken, restaurant_refreshToken, restaurant_authenticated='true', restaurant_user;
       dispatches "restaurantAuthChanged"; clears restaurantAuthData; after 800 ms:
         signup                    → onboarding
         login, onboarding pending → onboarding?step=N
         otherwise                 → / (OrdersMain)

Onboarding step 1 → 2 → 3 → submit
  ├─ new restaurant: multipart restaurantAPI.register(formData) → pending-verification
  └─ existing profile: uploadMedia → restaurantAPI.updateProfile → explore

VerificationPending
  checks getCurrentRestaurant() once, only if a token exists
  approved → /food/restaurant ; rejected → "Retry Registration" → onboarding
  "Back to Login" / "Sign out" → login
```

**Hard-coded auth details to handle in the port:**
- Login has a "Demo fill" button: `+91 9876543210` with the toast "Use OTP 1234". This contradicts the 6-digit OTP.
- Login's support dialog has a hard-coded `tel:18008894567` and `https://wa.me/919876543210`.
- On OTP, the FCM token comes from the Flutter bridge (`window.flutter_inappwebview.callHandler('getFcmToken')`) or from `localStorage.fcm_web_registered_token_restaurant`. In RN, use the `expo-notifications` device push token.

**Logout** (Explore profile sheet and Onboarding):
1. `removePushDevice({deviceId, fcmToken, voipToken})`, then `removeFcmToken`, then `logout(null, fcmToken, platform)`.
2. Firebase `signOut`.
3. Clear `restaurant_*` storage and `sessionStorage.restaurantAuthData`.
4. Go to login. On error or account deletion, go to welcome.

---

## 2. Per-screen summary

Notation:
- **L/E/Err** = loading / empty / error states.
- **Breakpoints** marks cosmetic `sm:`/`md:` classes as "cosmetic only". For phone, use the base (unprefixed) classes.

### 2.1 Auth and onboarding

**Welcome** (`auth/Welcome.jsx`)
- A 4-slide swipeable carousel with auto-advance, dots, and Login / Signup buttons.
- Uses framer-motion `AnimatePresence` and custom touch/mouse swipe.
- Assets: `loginbanner1..4.png`, **all corrupt** (§6).
- Breakpoints: `md:`/`lg:` text sizes only.

**Login** (`auth/Login.jsx`)
- A centred phone card (`max-w-[430px]`): +91 prefix (flag from `flagcdn.com`), 10-digit input, Send OTP, Terms and Privacy links.
- Support dialog (shadcn `Dialog`) offers phone and WhatsApp.
- Logo comes from `useAppLogo("restaurant_app")`, falling back to `/logo.png`. The background is `/restaurant-banner.jpg`.
- No separate desktop layout; `sm:` adds shadow and rounding.

**OTP** (`auth/OTP.jsx`)
- 6 single-digit inputs with auto-advance, a resend countdown and a verify spinner.
- Shows an error message on failure.
- Redirects to login if `restaurantAuthData` is missing.
- Has 87 `dark:` classes in total across 4 files; this is one of them, and they are unused.

**Signup** (`auth/Signup.jsx`)
- Name, country-code `Select` (hard-coded list) and phone; sends a register OTP.
- **Desktop-only:** the left image panel (`hidden lg:flex lg:w-1/2`) uses the corrupt `loginbanner.png`. On phone it is a single column.

**ForgotPassword** (`auth/ForgotPassword.jsx`)
- 3 steps: email, then OTP, then new password (`resetPassword`).
- Nothing links to it, and the panel is phone-OTP only. **Leave it out.**

**VerificationPending** (`auth/VerificationPending.jsx`)
- A pending card, or a rejected card with `rejectionReason`.
- Shows "Checking approval status…".
- Buttons: Retry Registration, Back to Login, Sign out.
- Does **not poll**. In RN, add polling or re-check when the app returns to the foreground.

**Onboarding** (`Onboarding.jsx`, 2899 lines)
- **Step 1, Restaurant information:**
  - Name, pure-veg yes/no.
  - Owner name, email, phone; primary contact.
  - Google Places search (`AutocompleteService`/`PlacesService`), then shop, floor, landmark, area, city, state, pincode.
  - Service zone `Select` (`zoneAPI.getPublicZones`, auto-detected with `zoneAPI.detectZone`, with a toast if outside every zone).
- **Step 2, Photo and timings:**
  - Profile image upload.
  - Opening and closing time (MUI `TimePicker` + dayjs).
  - Estimated delivery time.
  - Open-days grid Mon–Sun.
- **Step 3, Compliance and bank:**
  - PAN number, holder name, PAN image.
  - GST toggle; if on, number, legal name, address and image.
  - FSSAI number (14 digits), expiry (shadcn `Calendar` in a `Popover`), FSSAI image.
  - Bank account number and re-entry, IFSC, account type `Select`, holder name.
- **Validation:** regex for PAN, GST, FSSAI, IFSC and account number; the first error appears as a toast.
- **Drafts:** saved in `localStorage.restaurant_onboarding_data`, with files in IndexedDB (`ONBOARDING_FILES_DB`).
- **Other UI:** read-only "Edit Details" mode; a close (X) button to Explore; logout.
- **Dead code:** menu-image and PDF menu upload, and cuisines.
- **Breakpoints:** cosmetic only (`sm:grid-cols-2`).

### 2.2 Main tabs

**OrdersMain** (`OrdersMain.jsx`, 4309 lines, Orders tab)
- **Order tabs:** 9 swipeable filter tabs (All, New, Preparing, Ready, Out for delivery, Scheduled, Completed, Cancelled, Dead). Each uses `usePaginatedRestaurantOrders`, page size 30, with `RestaurantOrdersPagination`.
- **Other content:** a Table Bookings tab (`diningAPI`); search results fed by the navbar search through the `restaurantSearchUpdated` window event; a verification pending/rejected card with Reverify.
- **APIs:**
  - `getCurrentRestaurant`, `getOrders` (also polled every 60 s).
  - `acceptOrder(id, prepTime)`, `rejectOrder(id, reason)` (also called automatically when the countdown runs out), `markOrderReady`, `reverify`.
  - `getPendingDiningRequest`, `diningAPI.getRestaurantBookings` / `updateBookingStatusRestaurant`.
- **New-order popup:**
  - 3-minute countdown; prep time +/- (default 11); mute.
  - Print KOT: an HTML string printed through a hidden iframe.
  - **Swipe-to-accept slider on phone** (`md:hidden`; desktop shows a plain Accept button).
- **Other popups:** reject (with reasons), cancel, and an order-detail sheet.
- **Mobile vs desktop:** the 768 px `matchMedia` check makes the ringtone loop desktop-only. In RN it must ring on the phone.
- **States:** per-tab loading and empty.
- **Child components:** `RestaurantBentoGrid` (orders), `ResendNotificationButton`.
- **Dead code:** unused `jsPDF` import; `restaurant_online_status` key.

**Inventory** (`Inventory.jsx`, 3326 lines, Inventory tab)
- **Tabs:** All items (categories, then items) and Add-ons.
- **Item controls:** search, filter sheet, "jump to category" menu, availability `Switch`, recommended star, delete (`window.confirm`).
- **Out-of-stock popup:** for N hours, tomorrow, a custom date and time (custom `SimpleCalendar`), or manual.
  - The automatic re-enable is a client-side timer stored in `localStorage.restaurant_inventory_stock_rules_v1`. **It belongs on the backend.**
- **Add-ons:** create, edit, delete and toggle, with image upload. Add-ons go to admin approval.
- **Bulk upload:** an Excel file, read with SheetJS loaded **from a CDN `<script>`**. "Download dummy Excel template" includes sample rows.
- **Popups use `history.pushState`** so the hardware back button closes them.
- **States:** loading and empty per tab.
- **Breakpoints:** cosmetic only.

**Feedback** (`Feedback.jsx`, Feedback tab, `?tab=reviews|complaints`)
- **Reviews:** built on the client from delivered orders. It pages through `getOrders({limit:1000})` up to 50 times, then computes a rating summary and sorts (newest, oldest, best, worst).
- **Complaints:** `getComplaints({fromDate,toDate,complaintType,search})` with date presets, a custom `DateRangeCalendar` and an issue-type filter.
- **Sheets:** 3 framer-motion bottom sheets.
- **States:** `Loader2` loading; empty states for both tabs.
- **Header:** a refresh button that calls `window.location.reload()`; no back button.

**ExploreMore** (`ExploreMore.jsx`, 1867 lines, Explore tab: the "More" hub)
- **Header and card:** a header with home, search and profile buttons; a restaurant card linking to outlet-info.
- **Sections:**
  - Manage outlet: Outlet info, Outlet timings, Menu categories, Promo codes.
  - Settings: Delivery settings, Zone setup.
  - Orders: Order history, Complaints, Reviews.
  - Help: Support, Share your feedback.
  - Finance: Payout, Invoices, Bank details.
- **Modals and sheets:** search modal; profile bottom sheet (info, Edit profile → `edit-owner`, **Test FCM / Test VOIP** buttons, Logout, Delete Restaurant); logout and delete confirm dialogs.
- **Dead code:** the "Schedule off" feature, which includes a `TimePickerWheel` and `DateRangeCalendar`. Unused imports: `RestaurantBentoGrid`, `Card`.

### 2.3 Orders

**AllOrdersPage** (`orders/all`)
- **Content:** order history with date presets (default this week) and a custom `DateRangeCalendar`; search by order ID; a filter popup (order status; Ratings and Complaints filters exist but are never applied).
- **Data:** `getOrders({limit:1000})`, then filtered on the client; new orders arriving over the socket are added to the top.
- **States:** loading, error, empty and "Applying filters…".
- **Mobile vs desktop:** on desktop `md:flex-row` with an embedded `OrderDetails` side panel. **On phone** the panel is a full-screen `fixed` overlay, so in RN push `OrderDetails` as its own screen.
- Copies the order ID with `navigator.clipboard`.

**OrderDetails** (`orders/:id`; also embedded with `idProp` / `mongoIdProp` / `onClose`)
- **Content:** items, bill, payment status and a collapsible payout breakdown (commission, GST, PG fee, TCS, delivery cost; the delivery cost defaults to 30).
- **Actions:** download a **PDF receipt** (`jsPDF` + autotable, `doc.save`); copy the ID; `ResendNotificationButton`.
- **States:** loading, error, not-found.
- **Bug:** the not-found screen links to `/restaurant/orders`, which no route matches.

**Notifications** (`notifications`)
- **Content:** inbox notifications (`useNotificationInbox("restaurant", {limit:100, pollMs:5min})`, with read, dismiss and dismiss-all) merged with order-status items built from `getOrders({limit:30})`.
- **Storage:** dismissed order IDs in `localStorage.restaurant_dismissed_notifications`.
- **Navigation:** back goes to `/restaurant` (hard-coded).
- **States:** loading, empty.

**RestaurantDashboard** (`dashboard`, reachable only from the drawer)
- **Content:** a period `Select` (today, week, month, year, overall); 8 KPI cards (revenue, today's orders, balance, rating, total orders, AOV, menu items, cancelled); top dishes; recent orders.
- **Charts (recharts):** revenue AreaChart, order-status PieChart, payment-method PieChart, monthly BarChart.
- **API:** `getDashboardStats({period})`.
- **States:** first-load spinner only; on error it shows zeros.
- **Layout:** `RestaurantPageShell` + `RestaurantBentoGrid`, which is a single column on phone.

### 2.4 Menu

**ItemDetailsPage** (`hub-menu/item/:id`, `new` = create)
- **Images:** a multi-image carousel (swipe, add, delete). Deleting only removes the image locally; there is no API call.
- **Fields:** name, description, price, variants, prep time, veg/non-veg, recommended and in-stock switches, nutrition.
- **Pickers (bottom sheets):** serves, size, GST and tags (hard-coded options), and category. The category sheet links to "Add Category", which opens menu-categories.
- **Validation:** an approved category is required; the item's food type must match the category's `foodTypeScope`.
- **APIs:** `createFood`, `updateFood`, `uploadAPI.uploadMedia`.
- **Other:** `ImageSourcePicker`; keyboard inset handled with `visualViewport`.
- **Breakpoints:** only `md:grid-cols-2` in the variant rows.

**MenuCategoriesPage** (`menu-categories`)
- **Content:** the restaurant's own categories with approval badges; create, edit, delete (`window.confirm`) and active toggle. Every edit goes back to admin approval.
- **Form fields:** name, type, image (5 MB limit), sortOrder, `foodTypeScope`.
- **Other:** `state.draftCategoryName` automatically opens the create form.
- **States:** loading, empty.

**Promocodes** (`promocodes`)
- **Content:** a list with a toggle and delete (`window.confirm`).
- **Create:** a floating action button opens a create modal with code, description, % or flat discount, value, min order, max discount, `<input type="date">` expiry and usage limit.
- **Navigation:** back is `navigate(-1)`.
- **States:** loading, empty.

### 2.5 Outlet and settings

**OutletInfo** (`outlet-info`)
- **Header:** banner or logo with "Change Logo" (`uploadProfileImage`); the last 5 characters of the restaurant ID; rating, with a link to the reviews list.
- **Read-only sections:** basic details, compliance (document links open with `window.open`), bank and UPI (including the UPI QR).
- **Edit dialog:** a shadcn `Dialog` that saves with `updateProfile`.
- **Dead and hard-coded:** the missing-document "Upload" buttons do nothing; the rating defaults to "5.0".

**OutletTimings** (`outlet-timings`)
- **Content:** Mon–Sun accordion rows with an open/closed `Switch` and opening/closing times (MUI `MobileTimePicker`). Defaults are 09:00–22:00.
- **Saving:** auto-saves 500 ms after each change with `saveOutletTimings`.
- **States:** loading; errors are swallowed.
- **Navigation:** back goes to Explore.

**DeliverySettings** (`delivery-settings`)
- **Content:** one "accepting orders" toggle. Turning it off asks for confirmation in a `RestaurantModal`.
- **API:** `updateAcceptingOrders`, applied to the UI first and rolled back on error.
- **Side effects:** writes `restaurant_online_status` and `restaurant_delivery_status` and dispatches `restaurantStatusChanged`, which updates the navbar's Online/Offline pill.

**ZoneSetup** (`zone-setup`)
- **Map** (full Google Maps JS API): zone polygons, with the restaurant's zone highlighted; Places search; tap to drop a marker; `containsLocation` check plus `detectZone`.
- **Controls:** current location (`navigator.geolocation`); roadmap/satellite switch.
- **Save:** `updateProfile({location, zoneId})`, reported with `alert()`.
- **States:** map loading, map error.
- **Breakpoints:** `md:flex-row` is desktop-only; the phone layout stacks vertically.

**EditOwner** (`edit-owner`, opened from the Explore profile)
- **Fields:** profile image, restaurant name, owner name, phone (read-only), contact, email, zone, Google Places address, city `Select` (hard-coded list), pincode, PAN, bank, UPI.
- **Save:** `updateProfile` shows "submitted for admin approval".
- **Other:** a pending-update banner; delete account in a shadcn `Dialog`.

**UpdateBankDetails** (`update-bank-details`)
- **Fields:** holder name, account number and confirmation (9–18 digits), IFSC (regex), UPI ID, UPI QR upload (`ImageSourcePicker`).
- **Save:** `updateProfile`, then `alert()`.
- **States:** loading, saving, per-field errors.

### 2.6 Finance

**HubFinance** (`hub-finance`, `?tab=invoices`)
- **Payouts tab:** current-cycle estimate, withdrawal requests, past cycles with a date range, a Withdraw modal (`createWithdrawalRequest`) and a "Download PDF" statement.
- **Statement PDF:** built from an HTML string in an offscreen iframe, captured with `html2canvas`, then saved with `jsPDF`.
- **Invoices tab:** earnings, commission and gross summary, plus an order list.
- **Messages:** uses `alert()` throughout.
- **Breakpoints:** `sm:grid` only.

**WithdrawalHistoryPage** (`withdrawal-history`)
- **Content:** Pending and Approved sections from `getWithdrawalHistory`.
- **States:** loading, empty.
- **Gap:** rejected requests are never shown.
- **Navigation:** back goes to hub-finance.

### 2.7 Help and feedback

**RestaurantSupport** (`help-centre/support`)
- **Content:** ticket stats (4 tiles); a create-ticket form (category, priority, issue type, subject, order ref, description); a ticket list with a status filter.
- **APIs:** `getSupportTickets` / `createSupportTicket`.
- **States:** loading, empty.
- **Breakpoints:** `md:max-w-4xl` is desktop-only; phone shows 2 columns, then 1.

**ShareFeedback** (`share-feedback`)
- **Content:** a 0–10 score picker and a comment.
- **API:** `POST ADMIN.FEEDBACK_EXPERIENCE_CREATE` with `{rating: ceil(n/2), module:'restaurant'}`.
- **After submit:** a thank-you `RestaurantModal`.

**RatingsReviews** (`ratings-reviews`)
- **Content:** a static help page with an Unsplash banner, 6 FAQ accordions and "Was this helpful?" popups (`BottomPopup` from the delivery module).
- **APIs:** none.

**PrivacyPolicyPage / TermsAndConditionsPage**
- **Data:** `GET ADMIN.PRIVACY_PUBLIC` / `TERMS_PUBLIC`.
- **Rendering:** the HTML is rendered with `dangerouslySetInnerHTML`. In RN, use `react-native-render-html`.
- **States:** loading, empty.

### 2.8 Stubs, mocks and broken screens

None of these is linked from the UI except where noted. See §8.

| Screen | Problem |
|---|---|
| **DaySlots** | `STORAGE_KEY` is undefined, so saving throws. Stores to localStorage only. |
| **FinanceDetailsPage** | `useMemo` is used but not imported, so the page crashes. Driven only by `location.state`; the data is mock. |
| **Hyperpure** | Shows "under development". |
| **DishRatings** | Placeholder text only. |
| **RushHour** | Radio options; Confirm only logs. |
| **PhoneNumbersPage** | Hard-coded numbers; demo OTP accepts any 6 digits. |
| **DownloadReport** | Fake email confirmation. |
| **ManageOutlets** | Static link list. |
| **FssaiDetails** | "Not available" placeholder. |
| **FssaiUpdate** | The upload is never sent. |
| **EditCuisines** | Works, using `updateProfile({cuisines})`, but nothing links to it. |
| **EditRestaurantAddress** | Google Maps iframe embed; the update option only calls `alert()`. |

**Mobile vs desktop overall.** No restaurant screen has a fully separate mobile component. Desktop-only pieces use Tailwind `lg:` (1024 px) for the sidebar and bottom nav, `md:` (768 px) for the order alert, slider, AllOrders panel and Support width, and `lg:` for the Signup/ForgotPassword image panel. Everything else uses base classes for phone with cosmetic `sm:`/`md:` tweaks.

---

## 3. Phone navigation pattern

### 3.1 Bottom nav

`components/restaurant/BottomNavOrders.jsx` is visible below `lg` (1024 px).

**Style:**
- A floating pill: `fixed bottom-0`, `px-2`, `pb max(0.4rem, safe-area)`, `max-w-md`.
- Background `bg-primary` (forced to `--rt-primary` by the theme CSS), `rounded-[30px]`, `py-2`, `shadow-2xl shadow-primary/35`.
- Icons are 20 px (`h-5 w-5`). Labels are 11 px; active is white and weight 800, inactive is `white/70` and weight 500.
- The active item gets a `bg-white/25` rounded-full highlight, animated with a framer-motion `layoutId`, plus an icon wiggle.

| Tab | Label | lucide icon | Route | Badge |
|---|---|---|---|---|
| orders | Orders | `FileText` | `/food/restaurant` | Red pulsing dot when `newOrder` or `newReservation` |
| inventory | Inventory | `Package` | `/food/restaurant/inventory` | — |
| feedback | Feedback | `MessageSquare` | `/food/restaurant/feedback` | Red dot when inbox `unreadCount > 0` (polled every 60 s) |
| explore | Explore | `Compass` | `/food/restaurant/explore` | — |

**When it is hidden:**
- When the keyboard is open (`visualViewport` height < 85 % of the window).
- On the inner pages listed in §1.3.

**Bug:** a `useMemo` is called after an early `return null`, which violates the rules of hooks. Don't copy it.

### 3.2 Header

`RestaurantNavbar` appears at the top of **every** protected screen.

**Style:**
- `bg-gradient-to-r from-[#B80B3D] to-[#66001D]`, `rounded-b-[24px]`, `shadow-lg`, padding `px-3 pt-4 pb-4`.
- The gradient is hard-coded and does not follow `--rt-primary`.

**Left side:**
- Hamburger (`Menu`, `bg-white/15 rounded-xl`, `lg:hidden`).
- Logo (36 px, from business settings `restaurantLogo`).
- Restaurant name (15 px, `font-black`, white).
- `MapPin` with the address, then "•" and the COMPANY NAME (11 px, `white/80`).

**Right side:**
- Online/Offline pill: **display only**, green `#00e676` dot or grey. Its value comes from `localStorage.restaurant_online_status` or `isAcceptingOrders` and updates on `restaurantStatusChanged`.
- `Search`: shown only on Orders and Inventory. It opens an overlay input "Search by order ID or dish name", which searches orders with `getOrders({search})` (debounced 500 ms).
- `Bell`: opens notifications; shows an unread red dot.

**Dining popup:** a "New Table Request!" card (`fixed top-20`), shown when the socket sends `new_dining_booking`.

**Page headers:** many pages also render their own sub-header (back chevron and title) below the navbar. In RN, consider showing the brand navbar only on the 4 tab roots and using a plain stack header with a back arrow on inner screens.

### 3.3 Drawer

`RestaurantSidebar` is a hamburger drawer on phone.
- **Phone:** slides in from the left, `w-72`, `shadow-2xl`, over an overlay (`bg-gray-900/50`). It closes on route change, on the overlay tap and on X.
- **Desktop** (≥ `lg`): a fixed rail with a collapse button that saves `restaurant_sidebar_collapsed`. This is desktop-only.
- **Header:** logo, company name and a "PARTNER PANEL" caption.
- **Items** (from `RESTAURANT_SIDEBAR_SECTIONS` in `utils/restaurantLayoutConfig.js`):
  - **Main:** Dashboard, Orders, Inventory, Feedback (lucide `LayoutDashboard`, `FileText`, `Package`, `MessageSquare`).
  - **Outlet:** Outlet info, Outlet timings, Menu categories, Promo codes, Delivery settings, Zone setup.
  - **Orders & reviews:** Order history, Ratings & reviews.
  - **Finance:** Payout, Bank details, Withdrawal history.
  - **Support:** Notifications, Help centre, Share feedback.
- **Active item style:** `bg-[--rt-primary-soft] text-[--rt-primary]`, `rounded-xl`.
- **RN recommendation:** Explore already covers most of these. Add **Dashboard**, **Ratings & reviews** and **Withdrawal history** to Explore and drop the drawer, or keep a simple drawer if parity with the web is wanted.

### 3.4 Back behaviour

`hooks/useRestaurantBackNavigation.js` is used by about 23 screens. It does **not** use history; it computes a fixed parent route.
- If `state.backTo` or `state.from` is set, it uses that.
- Otherwise it falls back by route:

| From | Back to |
|---|---|
| `orders/all` | `explore` |
| `orders/:id` | `orders/all` |
| edit-owner, edit-cuisines, edit-address, phone, manage-outlets, update-bank-details, fssai*, outlet-info, outlet-timings(/:day), zone-setup, `hub-menu/item/:id` | `explore` |
| delivery-settings, rush-hour, menu-categories, privacy, terms | `/` (Orders) |
| ratings-reviews, dish-ratings | `/reviews`, which does not exist |
| help-centre/support, share-feedback | `feedback` |
| finance-details, download-report | `hub-finance` |

- Several branches handle paths that no longer exist: `/food/...`, `/advertisements`, `/coupon`.
- Exceptions: Promocodes and EditCuisines use `navigate(-1)`; Notifications goes to `/restaurant`; WithdrawalHistory goes to `hub-finance`; OutletTimings goes to `explore`.
- Inventory uses `history.pushState` / `popstate` so the hardware back button closes its popups.

**RN mapping:**
- Use expo-router tabs (Orders, Inventory, Feedback, Explore) with a stack per tab, or one root stack above the tabs.
- Use normal stack pop for back. Use `router.replace` when a screen was reached by a deep link and has no parent.
- Handle the Android hardware back button to close sheets first, as Inventory does.

---

## 4. Global providers, contexts, hooks and storage

| Item | File | Holds / does |
|---|---|---|
| `AuthInitializer` | `components/AuthInitializer.jsx` | Wraps the whole Food app. Initialises auth for user, restaurant, delivery and admin (token refresh). |
| `ThemeProvider` | `context/ThemeContext.jsx` (in `app/App.jsx`) | Restaurant theme key `restaurantAppTheme`, default `light`. The restaurant UI has no toggle. |
| `applyDynamicTheme()` | `utils/themeSettings.js` | Fetches `/app-config/{user,restaurant,delivery,admin}_app`. For restaurant it sets `--rt-primary` (`primaryColor`) and `--rt-primary-strong` (`secondaryColor`) and stores `restaurant_app_logo`. It sets `--main-font-family` from `fontFamily` for the current app. |
| `businessSettings` | `utils/businessSettings.js` | Cached in `localStorage.food_business_settings`; fires the `businessSettingsUpdated` event. Provides `companyName`, `restaurantLogo.url` / `logo.url` and the theme. |
| `useAppLogo('restaurant_app')` | `hooks/useAppLogo.js` | Resolves the logo from business settings or `restaurant_app_logo`. |
| `RestaurantLayoutContext` | `components/restaurant/RestaurantLayoutContext.jsx` | `options {showSidebar, showNavbar, showBottomNav}` from the route defaults plus per-page `setLayoutOptions` overrides. Not needed in RN; use the navigator's options instead. |
| `RestaurantNotificationProvider` / `useRestaurantNotifications` | `context/RestaurantNotificationContext.jsx`, `hooks/useRestaurantNotifications.js` (950 lines) | **The core realtime layer.** See below. |
| `useNotificationInbox(module, {limit, pollMs})` | `hooks/useNotificationInbox.js` | `notificationAPI.getInbox`, `markAsRead`, `dismiss`, `dismissAll`; `unreadCount`. Refreshes on the `notification-inbox-refresh` window event. Navbar polls every 5 min and the bottom nav every 1 min. |
| `usePaginatedRestaurantOrders` | `hooks/usePaginatedRestaurantOrders.js` | Page size 30; maps each tab to backend statuses (`RESTAURANT_ORDER_TAB_STATUS`). |
| `useRestaurantBackNavigation` | `hooks/useRestaurantBackNavigation.js` | See §3.4. |
| `useRestaurantLenis` | `hooks/useRestaurantLenis.js` | Lenis smooth scrolling. **Drop it.** |
| `useCompanyName` | `hooks/useCompanyName.js` | Company name from business settings (used by 8 files). |
| `onboardingUtils` | `utils/onboardingUtils.js` | `isRestaurantOnboardingComplete`, `checkOnboardingStatus`, step detection. |
| `utils/auth.js` | | Builds the per-module keys `${module}_accessToken` / `_refreshToken` / `_authenticated` / `_user`. Provides `setAuthData`, `clearModuleAuth`, `getModuleToken` and `set/get/clearRestaurantPendingPhone`. |
| `firebaseMessaging.js` | `utils/firebaseMessaging.js` | Web FCM registration: `restaurantAPI.saveFcmToken(token, platform)` and `savePushDevice(payload)`. The foreground restaurant sound is `restaurant-order-ring.wav`. In RN, replace this with `expo-notifications`. |
| `useAuthStore` | `@/core/auth/auth.store` (zustand) | Used by OrdersMain. |

### 4.1 `useRestaurantNotifications`

**State it exposes:**
- `newOrder`, which is `orderQueue[0]`, and `orderQueue`.
- `newReservation`, `pickupOtpReveal`, `isConnected`.
- `clearNewOrder`, `clearNewReservation`, `clearPickupOtpReveal`, `playNotificationSound`.

**Socket:**
- `socket.io-client` connecting to `resolveSocketOrigin(API_BASE_URL)`.
- Options: `path:'/socket.io/'`, `transports:['websocket','polling']`, `auth.token` + `query.token` = `restaurant_accessToken`.
- Emits `join-restaurant` with the restaurant ID on connect and reconnect.
- Listens for:
  - `restaurant-room-joined`
  - `new_order` (queued, then alert)
  - `new_dining_booking`
  - `play_notification_sound`
  - `order_status_update` (removes cancelled orders; dispatches `restaurantOrderStatusUpdate`)
  - `pickup_otp_reveal` (persisted in `localStorage.restaurant_pickupOtpReveal`)
  - `admin_notification` (refreshes the inbox)
  - `connect_error`, `disconnect`, `reconnect*`

**REST fallback:** polls `getOrders({limit:30})` every **8 s** and alerts on `confirmed` orders not yet seen (orders cancelled locally are skipped).

**Alert:**
- `new Audio(restaurant-order-ring.wav)`, looped every **6 s** for up to **120 s**.
- Repeat alerts for the same order are suppressed within 15 s; browser notifications within 20 s.
- `navigator.vibrate([200,100,200,100,300])`.
- Browser `Notification` / service worker `showNotification`. It asks for permission once (`restaurant_notification_permission_asked`).
- An audio-unlock listener on the first pointerdown or keydown.

**RN equivalents:**
- `expo-audio` with the bundled ring.
- `expo-haptics` or `Vibration`.
- `expo-notifications` with a high-priority Android channel and a custom sound, for alerts while the app is in the background or killed.
- `AppState` to reconnect the socket.
- Consider a full-screen-intent notification for new orders.

### 4.2 App-wide window events (replace with a store or event emitter)

- `restaurantAuthChanged`
- `restaurantStatusChanged`
- `restaurantSearchUpdated`
- `restaurantProfileRefresh`
- `restaurantOrderStatusUpdate`
- `outletTimingsUpdated`
- `businessSettingsUpdated`
- `themeLoaded`
- `notification-inbox-refresh`

### 4.3 Storage keys used by restaurant code

**localStorage:**

| Group | Keys |
|---|---|
| **Auth** | `restaurant_accessToken`, `restaurant_refreshToken`, `restaurant_authenticated`, `restaurant_user`; legacy fallbacks `accessToken`, `user` |
| **Onboarding** | `restaurant_pendingPhone`, `restaurant_onboarding`, `restaurant_onboarding_data`; IndexedDB `ONBOARDING_FILES_DB` |
| **Push** | `fcm_web_registered_token_restaurant`, `restaurant_notification_permission_asked` |
| **Realtime** | `restaurant_pickupOtpReveal` |
| **Status** | `restaurant_online_status`, `restaurant_delivery_status` |
| **UI** | `restaurant_sidebar_collapsed` (desktop), `restaurant_dismissed_notifications` |
| **Inventory** | `restaurant_inventory_state`, `restaurant_inventory_recommended_map`, `restaurant_inventory_active_tab`, `restaurant_inventory_addon_form`, `restaurant_inventory_stock_rules_v1`, `restaurant_addon_form_data` (unused) |
| **Profile fallbacks** | `restaurant_owner_contact`, `restaurant_cuisines`, `restaurant_address`, `restaurant_name` / `restaurantName` |
| **Unused or dead** | `restaurant_reviews_data`, `restaurant_schedule_off` (dead), `restaurant_invited_users` |
| **App config** | `food_business_settings`, `restaurant_app_logo` |

**sessionStorage:** `restaurantAuthData`, `restaurantLoginPhone`.

**RN mapping:** put tokens in `expo-secure-store`. Put drafts and caches in AsyncStorage. The onboarding draft files should be kept as file URIs, which removes the need for IndexedDB.

---

## 5. Design tokens (restaurant panel)

### 5.1 `components/restaurant/restaurantTheme.css`

| Token | Value | Notes |
|---|---|---|
| `--rt-primary` | `#B80B3D` (crimson) | **Overwritten at runtime** from `GET /app-config/restaurant_app` → `primaryColor`. |
| `--rt-primary-strong` | `#66001D` | Overwritten from `secondaryColor`. Used for hover and pressed states and dark buttons. |
| `--rt-primary-soft` | `#fdf2f5` | Active drawer item; `bg-primary/5` and `/10`. |
| `--rt-surface` | `#ffffff` | Cards |
| `--rt-border` | `#f0ccd5` | Drawer and card borders (mixed 65–80 % with white) |
| `--rt-text` | `#1f1f24` | Default text in `.restaurant-theme` |
| `--rt-muted` | `#6d6470` | Captions |
| `--rt-modal-z` / `--rt-sidebar-z` / `--rt-header-z` / `--rt-bottom-nav-z` | 200 / 50 / 30 / 60 | z-order |
| `--restaurant-content-max` | 1400px | Desktop only |

**Remapping rules.** Inside `.restaurant-theme`, these hard-coded classes are forced onto the tokens with `!important`. **In RN, apply the same mapping when porting class names.**
- `text-primary`, `bg-primary`, `text-[#EB590E]`, `bg-[#EB590E]` → `--rt-primary`.
- `hover:bg-secondary` → `--rt-primary-strong`.
- `border-primary` → primary mixed 30 % with white.
- **Every `<button>` with `bg-black` or `bg-gray-900` becomes primary with white text.**
- Legacy plum colours are remapped:

| Original class colour | Becomes |
|---|---|
| `#6a2f56` | strong |
| `#f6e9dc` | 8 % primary tint |
| `#fcf7fb` | 3 % tint |
| `#f9f0f7` | 6 % tint |
| `#e7d5e0` | 15 % tint |
| `#d5bdd0` | 25 % tint |
| `#6b4d62` | muted mix |

**Focus ring:** inputs get a border of primary at 55 % and a 3 px ring of primary at 15 %.

**Surfaces:**
- `.restaurant-surface-card`: radius 16, shadow `0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.03)`.
- `.restaurant-bento-card`: radius 20 (24 on desktop), shadow `0 1px 2px …04, 0 8px 24px -10px rgba(15,23,42,.08)`.

**Bottom sheets become centred dialogs.** `.restaurant-modal-sheet` overrides bottom sheets into **centred dialogs**: max width `min(100vw−2rem, 28rem)`, radius 24. ItemDetails' pickers therefore look like centred cards, not bottom sheets. Decide which style the RN app should use.

**Shared token from global CSS:** `Frontend/src/shared/styles/global.css` sets `--radius: 0.625rem` (10 px), giving sm 6 / md 8 / lg 10 / xl 14. The user-app `--primary: #7e3866` does **not** apply here because of the remapping above.

### 5.2 Other colours seen in restaurant code (top hex values)

| Colour | Uses | Where / role |
|---|---|---|
| `#E91E63` | 33 | OutletInfo |
| `#D3122A` | 16 | Login, red CTA |
| `#B80B3D` | 13 | Primary |
| `#6a2f56` | 13 | Remapped |
| `#1a1a1a` | 12 | |
| `#2563EB` | 8 | Blue |
| `#7e3866` | 7 | |
| `#66001D` | 5 | |
| `#FFEAF0` | 4 | |
| `#00e676` | — | Online dot |

**Status colours** (Tailwind v4 default palette):

| Meaning | Classes |
|---|---|
| Success | `green-600`, `emerald-50/200/600/800` (pickup OTP) |
| Error / reject | `red-50/500/600/700` |
| Info | `blue-50/600/700` |
| Warning | `orange-100/600`, `amber-*` |
| Dining | `purple-50` |
| Neutrals | `gray-50 … 900` and `slate-50 … 900` |

### 5.3 Most-used Tailwind classes in restaurant code

| Category | Classes (count) |
|---|---|
| Text colour | `text-gray-900` (382), `text-gray-500` (280), `text-white` (179), `text-gray-700` (163), `text-gray-600` (129), `text-gray-400` (95), `text-primary` (41), `text-red-600` (43), `text-black` (43) |
| Background | `bg-white` (329), `bg-gray-100` (146), `bg-gray-50` (130), `bg-primary` (46), `bg-black` (41), `bg-black/50` overlay (31), `bg-gray-200` (32) |
| Border | `border-gray-200` (191), `border-gray-300` (83), `border-gray-100` (57) |
| Font size | `text-sm` (491), `text-xs` (260), `text-base` (137), `text-lg` (99), `text-xl` (29), `text-2xl` (25); arbitrary sizes `text-[11px]`, `[13px]`, `[15px]`, `[10px]` |
| Font weight | `font-bold` (314), `font-medium` (239), `font-semibold` (215), `font-black` (62) |
| Radius | `rounded-full` (232), `rounded-lg` (215), `rounded-xl` (117), `rounded-2xl` (68), `rounded-3xl` (15), `rounded-[24px]` / `[30px]` (header and bottom nav) |
| Shadow | `shadow-sm` (56), `shadow-2xl` (40), `shadow` (39), `shadow-lg` (35), `shadow-md` (15), `shadow-xl` (12) |

### 5.4 Fonts

- `index.html` loads Google Fonts **Poppins** (300–800), **Outfit** (300–900) and **Inter** (400–700).
- `global.css` sets `body` to `var(--main-font-family, 'Poppins')`. The admin can override `fontFamily` per app through `/app-config/restaurant_app`.
- **RN:** use `@expo-google-fonts/poppins`, which is already a dependency of `mobile-restaurant`. Outfit appears only through `font-outfit` utilities, which are rare.

### 5.5 Dark mode

Not supported in the restaurant panel; build the RN app light-only (see §0 item 7).

### 5.6 Icons and UI kits

- **Icons:** `lucide-react` (50 imports) → `lucide-react-native`, already a dependency. The pickup OTP modal uses the emoji 🛵. Flags come from emoji or `flagcdn.com`.
- **UI kits:**
  - shadcn/radix components in `@food/components/ui/*`: dialog, select, popover, switch, checkbox, radio-group, calendar, date-range-calendar (react-day-picker 9), card, button, input, label.
  - MUI `@mui/x-date-pickers` (`TimePicker`, `MobileTimePicker`) with dayjs.
  - `BottomPopup` from `@delivery/components`.
  - `RestaurantModal`, a framer-motion portal modal in sizes sm–lg.

---

## 6. Assets used by restaurant screens

Checked with `file`. "Repaired copy" means `mobile-user/assets/...` at the same relative path.

| Asset | Used by | Frontend status | Valid copy elsewhere | Action |
|---|---|---|---|---|
| `Food/assets/restaurant/loginbanner1.png`, `…2`, `…3`, `…4` | Welcome carousel | **CORRUPT** (`data`; PNG signature `89 50 4E 47 0D 0A 1A 0D 0A`). Undoing CRLF does not help; chunk CRCs still fail. | **None.** Not in `mobile-user/assets/images/restaurant/`, which holds only the 3 `*_bg.png` files. | New artwork, or reuse `public/restaurant-banner.jpg` |
| `Food/assets/loginbanner.png` | Signup and ForgotPassword left panel (desktop-only, `hidden lg:flex`) | **CORRUPT** | None | Not needed on phone |
| `public/restaurant-banner.jpg` | Login background, with an `onError` fallback to itself | OK, JPEG, 823 KB | — | Copy into RN `assets/images` |
| `public/logo.png` | Login fallback logo; browser notification icon | OK, PNG 512×512 | `mobile-restaurant/assets/images/logo.png` exists (copied from mobile-user, which matches `src/assets/logo.png`, 640×640) | Already in place |
| `src/assets/logo.png` (`@/assets/logo.png`) | Login (last fallback) | OK, PNG 640×640 | Same as above | Already in place |
| Dynamic logo | Navbar, drawer, Login | From `businessSettings.restaurantLogo.url`, `/app-config/restaurant_app.logoUrl` or `restaurant_app_logo` | Remote URL | Fetch at runtime |
| `Food/assets/audio/restaurant-order-ring.wav` | **New-order ring:** `useRestaurantNotifications`, `OrdersMain`, foreground FCM sound | OK, WAV PCM 16-bit, 1.06 MB | **Not** in `mobile-restaurant/assets/sounds` | **Copy it.** For an Android notification-channel sound, also consider a compressed `.mp3`/`.ogg`. |
| `Food/assets/audio/alert.mp3` (also `public/alert.mp3`, identical, 449 KB) | Not used by restaurant code. `firebaseMessaging` uses it for the delivery module and as a generic fallback. | OK | `mobile-restaurant/assets/sounds/alert.mp3` exists | Optional generic fallback |
| `Food/assets/audio/zomato_sms.mp3` (also `public/zomato_sms.mp3`) | Not used by restaurant code (user/generic push sound) | OK | `mobile-restaurant/assets/sounds/zomato_sms.mp3` exists | Not needed; could be removed from mobile-restaurant |
| `public/original.mp3` | **Not referenced anywhere** in `src` or `public` JS | OK, MP3 | — | Ignore |
| `Food/assets/restaurant/restaurant_red_bg.png`, `restaurant_dark_red_bg.png`, `restaurant_login_bg.png` | **Not used by restaurant screens.** Only `pages/user/cart/Cart.jsx` and `pages/admin/orders/OrdersPage.jsx` reference these names. | JPEG data with a `.png` extension; the files themselves are valid | Repaired PNG copies in `mobile-user/assets/images/restaurant/` | Not needed |
| Remote: `images.unsplash.com` banner | RatingsReviews | Remote | — | Replace or drop |
| Remote: `flagcdn.com/w40/in.png` | Login country prefix | Remote | — | Use the 🇮🇳 emoji or a local file |
| Remote: `res.cloudinary.com/demo/.../sample.jpg` | Inventory Excel template sample rows | Text inside the template only | — | — |

---

## 7. Web-only libraries and APIs → Expo equivalents

The "Already in mobile-restaurant?" column refers to `mobile-restaurant/package.json`.

| Web usage | Where | Expo / RN equivalent | Already in mobile-restaurant? |
|---|---|---|---|
| `react-router-dom` v7 routes, `useNavigate`, `location.state`, `?tab=` query | Everywhere | `expo-router` (tabs and stack); `useLocalSearchParams`; pass IDs, not objects | yes |
| Tailwind v4 classes, CSS variables, `color-mix` | Everywhere | `StyleSheet` theme tokens (or NativeWind); compute tints in JS | — |
| `framer-motion` (25 files): sheets, slide-ins, `layoutId`, swipe | Everywhere | `react-native-reanimated` + `react-native-gesture-handler`; a bottom-sheet library (e.g. `@gorhom/bottom-sheet`) or a Modal | reanimated and RNGH: yes |
| `lenis` smooth scroll (7 files) | Many | Remove; use native `ScrollView` / `FlatList` | — |
| `sonner` toasts; `window.alert`; `window.confirm` | Everywhere | A toast library (`burnt` or `react-native-toast-message`); `Alert.alert` for confirmations | — |
| `socket.io-client` | `useRestaurantNotifications` | Same library, `transports:['websocket']`; reconnect on `AppState` change | yes |
| `new Audio(...)`, audio-unlock gesture | Notifications hook, OrdersMain | `expo-audio` (no unlock needed); loop until accepted | yes |
| `navigator.vibrate` | Notifications hook | `Vibration.vibrate(pattern)` / `expo-haptics` | haptics: yes |
| Browser `Notification`, service-worker `showNotification`, Firebase web messaging, Flutter bridge `getFcmToken` / VoIP | Hook, `firebaseMessaging`, OTP, ExploreMore | `expo-notifications`: device push token sent to `saveFcmToken` / `savePushDevice`; Android channel with the custom ring and max importance; foreground handler. VoIP: needs CallKit/PushKit → out of scope unless required. | yes |
| `window.matchMedia` (desktop-only ring) | OrdersMain | Remove; always ring on phone | — |
| `window.visualViewport` keyboard detection | BottomNav, ItemDetails, Onboarding | `Keyboard` events; `KeyboardAvoidingView`; tab bar `tabBarHideOnKeyboard` | — |
| `history.pushState` / `popstate` to close popups | Inventory | `BackHandler` / `usePreventRemove` | — |
| Hidden-iframe `print()` of a KOT/receipt | OrdersMain | `expo-print` `printAsync({html})` (same HTML string). Thermal Bluetooth printers would need a native module; check requirements. | yes |
| `jsPDF` + `jspdf-autotable` receipt download | OrderDetails (OrdersMain import unused) | `expo-print` `printToFileAsync({html})` + `expo-sharing` | yes |
| `html2canvas` + `jsPDF` statement PDF from an offscreen iframe | HubFinance | `expo-print` `printToFileAsync` with the same HTML + `expo-sharing` | yes |
| SheetJS `XLSX` loaded from a CDN script; `FileReader`; Blob download of the template | Inventory bulk upload | `xlsx` npm package (pure JS) + `expo-document-picker` + `expo-file-system` (read base64) + `expo-sharing` for the template | document-picker: **no**; xlsx: **no** |
| `<input type="file">`, `ImageSourcePicker`, Flutter picker bridge, `URL.createObjectURL` previews, `FileReader` | EditOwner, FssaiUpdate, Inventory, ItemDetails, MenuCategories, Onboarding, OutletInfo, UpdateBankDetails | `expo-image-picker` (camera + library; set quality and size limits); upload as `FormData` `{uri, name, type}`; preview with `expo-image` | yes |
| PDF menu upload (dead) / document picking | Onboarding (dead code) | `expo-document-picker` if revived | no |
| IndexedDB onboarding file cache | Onboarding | Keep file URIs in AsyncStorage, or copy into `FileSystem.documentDirectory` | — |
| `localStorage` / `sessionStorage` | Everywhere | `expo-secure-store` (tokens) + AsyncStorage (rest); in-memory store for session data | yes |
| Google Maps JS API: Places Autocomplete, Geocoder, Marker, Polygons, `containsLocation` | ZoneSetup, Onboarding, EditOwner | `react-native-maps` (`Polygon`, `Marker`, `onPress`); Places via the REST Autocomplete/Details API or a backend proxy; point-in-polygon in JS (or rely on `zoneAPI.detectZone`) | maps: yes |
| Google Maps `<iframe>` embed; `window.open` to Maps | EditRestaurantAddress | Static `MapView` + `Linking.openURL(geo:/maps url)` | yes (linking) |
| `navigator.geolocation` | ZoneSetup | `expo-location` | yes |
| `recharts` (Area, Bar, Pie) | Dashboard | `react-native-gifted-charts` or `victory-native` (both use `react-native-svg`, which is present) | chart lib: **no** |
| MUI `TimePicker` / `MobileTimePicker`; custom `TimePickerWheel` | Onboarding, OutletTimings, (DaySlots, ExploreMore dead) | `@react-native-community/datetimepicker` (mode `time`) | yes |
| `<input type="date">`; shadcn `Calendar`; react-day-picker `DateRangeCalendar`; custom `SimpleCalendar` | Promocodes, OutletInfo, Onboarding (FSSAI expiry), AllOrders, Feedback, Inventory | datetimepicker (date); for ranges, `react-native-calendars` or two date pickers | datetimepicker: yes |
| shadcn / radix `Dialog`, `Select`, `Popover`, `Switch`, `Checkbox`, `RadioGroup` | Many | RN `Modal`; custom picker sheet; RN `Switch`; small custom components | — |
| `navigator.clipboard.writeText` | AllOrders, OrderDetails | `expo-clipboard` | yes |
| `tel:` / `https://wa.me/` links | Login support | `Linking.openURL` | yes |
| `dangerouslySetInnerHTML` (CMS HTML) | Privacy, Terms | `react-native-render-html` | yes |
| `window.location.reload()` | Feedback, OrderDetails, OrdersMain, ZoneSetup | Refetch or pull-to-refresh (`RefreshControl`) | — |
| `createPortal` modal | RestaurantModal | RN `Modal` | — |
| `window.dispatchEvent` custom events | See §4.2 | zustand store or a tiny event emitter | add zustand if wanted |
| Firebase JS `signOut` | ExploreMore, EditOwner | Not needed (no Firebase auth); `@react-native-firebase` only if FCM is used directly | — |
| `navigator.share` | Not used | — | — |

---

## 8. Screens and pieces to leave out

### 8.1 Not part of the restaurant partner app

| Item | Why |
|---|---|
| `modules/auth/*` (mounted at `/restaurant/auth/*`, `/user/auth/*`, `/delivery/auth/*`) | Shared generic login and portal. Its catch-all goes to the user login. The restaurant panel uses its own `pages/restaurant/auth/*`. |
| `pages/admin/restaurant/*` (JoiningRequest, RestaurantsList, …), `AdminRouter`, `MasterLandingPage` | Admin-only. Restaurant approval and blocking happen there. |
| `pages/user/restaurants/*`, `components/user/home/Restaurant*`, `DiningRestaurantDetails` | Customer app. |
| `DeliveryV2`, `@delivery/*` | Delivery app; only `BottomPopup` is borrowed. |
| `PushSoundEnableButton`, `native_last_route`, Flutter / `ReactNativeWebView` bridge code | Web-wrapper plumbing. |

### 8.2 Routed but recommended to drop or defer (dead, stub, mock or broken)

| Screen | Reason |
|---|---|
| `auth/ForgotPassword.jsx` | Email/password reset; nothing links to it; the panel uses phone OTP only. |
| `DaySlots.jsx` (`outlet-timings/:day`) | Nothing links to it. Saving throws (`STORAGE_KEY` undefined). Stores to localStorage only. Replaced by OutletTimings. |
| `FinanceDetailsPage.jsx` | Nothing links to it. It crashes (`useMemo` not imported), uses mock values and has placeholder tabs. |
| `Hyperpure.jsx` | "Under development" stub. |
| `DishRatings.jsx` | Placeholder text only; nothing links to it. |
| `RushHour.jsx` | Confirm does nothing (no API); nothing links to it. |
| `PhoneNumbersPage.jsx` | Hard-coded numbers and a demo OTP; nothing links to it. |
| `DownloadReport.jsx` | Fake email confirmation; nothing links to it. |
| `ManageOutlets.jsx` | Legacy link list; nothing links to it. |
| `FssaiDetails.jsx`, `FssaiUpdate.jsx` | Placeholder; the update never uploads; only reachable through ManageOutlets. |
| `EditRestaurantAddress.jsx` | Nothing links to it; the "update" option only shows `alert`; it saves the same lat/lng. ZoneSetup covers location editing. |
| `EditCuisines.jsx` | Works, but nothing links to it. **Optional:** add it to Explore if cuisines matter. |
| `reservations` route | Only redirects to Explore. |
| `RatingsReviews.jsx` | Static FAQ with a remote banner. **Low priority;** include only if parity with the drawer is wanted. |

### 8.3 Dead code inside screens we keep

- **ExploreMore:** the whole "Schedule off" flow (reasons sheet, `DateRangeCalendar`, `TimePickerWheel`, `restaurant_schedule_off`). The Test FCM / Test VOIP buttons are debug tools; hide them in production or keep them behind a dev flag.
- **Onboarding:** menu-image and PDF menu upload, and the cuisines payload.
- **OrdersMain:** unused `jsPDF` import, `restaurant_online_status` `STORAGE_KEY`, no-op debug helpers.
- **Inventory:** the dummy Excel template rows (keep the template, but use realistic headers); `ADDON_FORM_STORAGE_KEY`.
- **AllOrdersPage:** the Ratings and Complaints filters are never applied.
- **HubFinance:** `handleViewDetails`.
- **Login:** the "Demo fill" button (+91 9876543210, "OTP 1234").

### 8.4 Desktop-only pieces (skip on phone)

| Piece | Phone replacement |
|---|---|
| Sidebar collapse rail (`lg:ml-20` / `lg:ml-72`, `restaurant_sidebar_collapsed`) | Drawer or Explore tab |
| `RestaurantBentoGrid` / `RestaurantCardGrid` multi-column variants | Single column only |
| `RestaurantPageShell` `max-w` / `md` / `lg` padding | Use `px-4 py-4` |
| AllOrdersPage side panel (`md:w-[450px] lg:w-[500px]`) | Push `OrderDetails` as its own screen |
| Desktop "Accept" button (`hidden md:block`) | Phone uses the swipe-to-accept slider |
| Signup and ForgotPassword left image panel (`hidden lg:flex`) | — |
| `RestaurantSupport` `md:max-w-4xl md:border-x`; ZoneSetup `md:flex-row` | Phone layouts |
| `.restaurant-modal-sheet` centring | Optional; you may prefer real bottom sheets on phone |

---

## 9. Counts

| Metric | Count |
|---|---|
| Route entries in `RestaurantRouter` | **46** (11 public/auth + 35 protected, of which 1 is a redirect) |
| Restaurant page files (`pages/restaurant/**`) | **43** (37 main + 6 auth); all are routed |
| Restaurant shell components (`components/restaurant/`) | 13 `.jsx` + 1 CSS |
| Restaurant hooks / contexts | 5 hooks (`useRestaurantNotifications`, `usePaginatedRestaurantOrders`, `useRestaurantBackNavigation`, `useRestaurantLenis`, `useNotificationInbox`) + 2 contexts (`RestaurantNotificationContext`, `RestaurantLayoutContext`) |
| Screens recommended to build (phone) | **29**: Welcome, Login, OTP, Signup, VerificationPending, Onboarding, Privacy, Terms, OrdersMain, Dashboard, AllOrders, OrderDetails, Notifications, Inventory, ItemDetails, MenuCategories, Promocodes, Feedback, ExploreMore, OutletInfo, OutletTimings, DeliverySettings, ZoneSetup, EditOwner, UpdateBankDetails, HubFinance, WithdrawalHistory, RestaurantSupport, ShareFeedback. The 2 Privacy/Terms routes per page count once. |
| Optional | 2 (RatingsReviews, EditCuisines) |
| Screens to leave out (dead, stub, mock, broken or nothing links to them) | **12**: ForgotPassword, DaySlots, FinanceDetails, Hyperpure, DishRatings, RushHour, PhoneNumbers, DownloadReport, ManageOutlets, FssaiDetails, FssaiUpdate, EditRestaurantAddress |
| Bottom-nav tabs | 4 (Orders, Inventory, Feedback, Explore) |
| Drawer items | 18 in 5 sections |
| Socket events handled | 7 app events + 5 connection events |
| Web-only libraries / APIs mapped | 34 rows in §7 |
| Restaurant assets | 9 local (5 images, all corrupt; 1 logo, valid; 1 banner JPG, valid; 1 WAV ring, valid; plus the dynamic logo) and 3 remote |
| Distinct localStorage keys | ~40 (see §4.3) |
| `dark:` classes (inactive) | 87 in 4 files |
