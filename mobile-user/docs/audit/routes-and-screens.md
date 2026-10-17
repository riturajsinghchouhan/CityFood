# CityFood Frontend: customer (user) app route and screen audit

**Scope:** `/home/ak/Public/projects/CityFood/Frontend`. This is a read-only audit and no repo files were modified.

**Stack:** Vite, React 19.2, react-router-dom 7.9, Tailwind 4.1 with default breakpoints (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px). There are no custom screens. The only custom variant is `dark` in `src/shared/styles/global.css:5`.

**Path aliases** (`vite.config.js:16-21`):
- `@food/api` → `src/services/api/index.js`. This is checked before `@food`.
- `@food` → `src/modules/Food`
- `@` → `src`

In this report:
- **FU** = `src/modules/Food`
- **P** = `src/modules/Food/pages/user`
- **CU** = `src/modules/Food/components/user`

---

## 0. Key takeaways for the React Native port

1. **One router file holds every customer screen:** `CU/UserRouter.jsx`. It has 59 path→component routes plus 4 redirects, all nested inside one layout route, `<UserLayout/>` (`UserRouter.jsx:99`). The live login page sits outside it, in `src/modules/auth/pages/Login.jsx`.
2. **Auth is a single check, `ProtectedRoute requiredRole="user"`** (`FU/components/ProtectedRoute.jsx:8-24`). It calls `isModuleAuthenticated('user')` (`FU/utils/auth.js:163-182`), which looks at localStorage `user_accessToken` / `user_refreshToken` and the JWT expiry and role. If the check fails, it redirects to `/user/auth/login` with `state.from`.
   - 22 user routes are protected. Cart and checkout are **public**, but Add-to-cart itself requires login (`RestaurantDetails.jsx:1211`, `Under250.jsx:1028`, `MealsUnderSection.jsx:41`).
3. **The same screen can be reached under several URL prefixes, and the code mixes them:** `/food/user/X`, `/user/X`, `/food/X` and `/X`. The canonical form is **`/food/user/X`**: the bottom nav, `useAppBackNavigation` and `openLocationSelector` all use it.
4. **Most screens have one responsive layout.** The real mobile/desktop split is in `UserLayout`:
   - `DesktopNavbar` is shown only at `md` and up (`hidden md:block`, `UserLayout.jsx:122`).
   - `BottomNavigation` is mobile only (`md:hidden`, `BottomNavigation.jsx:55`).
   - Both appear only on the 5 tab-root screens.
   - Many screens are mobile-only in practice (`max-w-md` columns).
5. **Back is not history-based.** Most screens navigate to a fixed parent route, either through `FU/hooks/useAppBackNavigation.js` (`resolveBackPath` maps path → parent) or through hard-coded `<Link to=...>`. Only a few screens use `navigate(-1)`. There is no hardware or popstate back handling for the user app.
6. **Several screens are dead or mock.** See §7 for orphaned pages and pages that crash on render.

---

## 1. Routing tree

### 1.1 Bootstrap

- `src/main.jsx` → `src/app/providers.jsx` `AppProviders`:
  - `StrictMode` → Redux `Provider` (`src/app/store.js`)
  - → `BrowserRouter`, or `HashRouter` when inside a Flutter/RN WebView, on `file:`, or on a delivery route (`providers.jsx:33-45`)
  - → `UserNotificationProvider` → `Toaster` (sonner, top-center)
- `src/app/App.jsx`:
  - `ThemeProvider` (`FU/context/ThemeContext.jsx`) → `PageLoader` → `AppRoutes`
  - Cleans expired `food:v1:*` scoped storage on mount (`App.jsx:32-35`)

### 1.2 Root routes: `src/app/routes.jsx`

| Line | Path | Element | User-relevant? |
|---|---|---|---|
| 80 | `/user/auth/*` | `modules/auth/routes.jsx` (AuthApp) | **Yes**: user login and support |
| 81 | `/delivery/auth/*` | AuthApp | Same Login component (see §6) |
| 82 | `/restaurant/auth/*` | AuthApp | Same Login component |
| 85 | `/food/*` | `FoodAppWrapper` → `modules/Food/routes.jsx` | **Yes** |
| 88 | `/admin/*` | `FU/components/admin/AdminRouter.jsx` | No |
| 91 | `/` | `src/app/MasterLandingPage.jsx` | **Yes**: public landing |
| 96 | `/*` | `FoodAppWrapper` (catch-all) | **Yes**: so `/user/...` and `/cart` etc. also work |

`AppRoutes` also stores `native_last_route` in localStorage when running in a WebView shell (`routes.jsx:57-75`).

### 1.3 Auth module: `src/modules/auth/routes.jsx`

The paths below are relative to `/user/auth/` (and the delivery and restaurant equivalents).

| Path | Component | Notes |
|---|---|---|
| `login` | `src/modules/auth/pages/Login.jsx` | **Live user login.** Phone → OTP → name, all on one page |
| `support` | `src/modules/auth/pages/PublicSupport.jsx` | Public support (merchant-oriented copy) |
| `portal` | `<Navigate to="/">` | `Portal.jsx` is lazy-imported but never rendered |
| `*` | `<Navigate to="/user/auth/login">` | Catches `/user/auth/otp` and `/user/auth/callback` too |

### 1.4 Food module: `src/modules/Food/routes.jsx`

- **Wrappers:** `AuthInitializer` (`FU/components/AuthInitializer.jsx`), which shows a one-tick loader before rendering, `ScrollToTop`, `PushSoundEnableButton`, and web-push (FCM) registration per module (`routes.jsx:45-66`).
- **Routes:**
  - `restaurant/*` → RestaurantRouter (not user)
  - `delivery/*` → DeliveryV2 (not user)
  - `admin/*` → redirects to `/admin`
  - `user/food` → redirects to `/food/user` (L94)
  - **`user/*` → `CU/UserRouter.jsx`** (L95-98)
  - **`/*` → `CU/UserRouter.jsx`** (L101), the default for anything else

### 1.5 User router: `CU/UserRouter.jsx`

- **Layout:** every route below is a child of `<Route element={<UserLayout/>}>` (L99).
- **Guard:** `PR` means the route is wrapped in `<ProtectedRoute requiredRole="user" loginPath="/user/auth/login">`, from `FU/components/ProtectedRoute.jsx:8`. Unauthenticated users go to `/user/auth/login` with `state.from`.
- **Nav column:**
  - `BN+DN` = BottomNavigation on mobile and DesktopNavbar at `md` and up (`UserLayout.jsx:105-130`)
  - `own` = the page draws its own header
  - `—` = no header at all

Full path = `/food/user/` + Path.

| # | Path | Component file | Guard (UserRouter line) | Nav |
|---|---|---|---|---|
| 1 | `` (home) | `P/Home.jsx` | public (101) | BN+DN; own `HomeHeader` |
| 2 | `dining` | `P/Dining.jsx` | public (102) | BN+DN; own `PageNavbar` (mobile only) |
| 3 | `dining/:category` | `P/DiningCategory.jsx` | public (103) | own |
| 4 | `dining/explore/upto50` | `P/DiningExplore50.jsx` | public (104) | own overlay |
| 5 | `dining/explore/near-rated` | `P/DiningExploreNear.jsx` | public (105) | own overlay |
| 6 | `dining/coffee` | `P/Coffee.jsx` | public (106) | own overlay |
| 7 | `dining/:diningType/:slug` | `P/dining/DiningRestaurantDetails.jsx` | public (107) | overlay on hero |
| 8 | `dining/book/:slug` | `P/dining/TableBooking.jsx` | public (108) | own |
| 9 | `dining/book-confirmation` | `P/dining/TableBookingConfirmation.jsx` | public (109) | own |
| 10 | `dining/book-success` | `P/dining/TableBookingSuccess.jsx` | public (110) | — |
| 11 | `dining/modification-policy` | `P/dining/TableModificationPolicy.jsx` | public (111) | own |
| 12 | `dining/cancellation-policy` | `P/dining/TableCancellationPolicy.jsx` | public (112) | own |
| 13 | `dining/edit-user` | `P/dining/TableEditUserPage.jsx` | public (113) | own |
| 14 | `bookings` | `P/dining/MyBookings.jsx` | **PR** (114-120) | own |
| 15 | `under-250` | `P/Under250.jsx` | public (122) | BN+DN (DN without logo); floating back |
| 16 | `categories` | `P/Categories.jsx` | public (123) | own |
| 17 | `category/:category` | `P/CategoryPage.jsx` | public (124) | own |
| 18 | `restaurants` | `P/restaurants/Restaurants.jsx` | public (125) | own |
| 19 | `restaurants/:slug` | `P/restaurants/RestaurantDetails.jsx` | public (126); add-to-cart requires login | own |
| 20 | `search` | `P/search/ProfessionalSearch.jsx` | public (127) | own |
| 21 | `product/:id` | `P/ProductDetail.jsx` | public (128) | overlay on hero |
| 22 | `cart` | `P/cart/Cart.jsx` | public (131) | own |
| 23 | `cart/checkout` | `P/cart/Checkout.jsx` | public (132) | own |
| 24 | `cart/select-address` | `P/cart/SelectAddress.jsx` | public (133) | own |
| 25 | `address-selector` | `P/cart/AddressSelectorPage.jsx` | public (134); "Add New" requires login | own |
| 26 | `orders` | `P/orders/Orders.jsx` | **PR** (137-144) | BN+DN; own |
| 27 | `orders/:orderId` | `P/orders/OrderTracking.jsx` | **PR** (145-152) | own |
| 28 | `orders/:orderId/invoice` | `P/orders/OrderInvoice.jsx` | **PR** (153-160) | own |
| 29 | `orders/:orderId/details` | `P/orders/UserOrderDetails.jsx` | **PR** (161-168) | own |
| 30 | `offers` | `P/Offers.jsx` | public (171) | floating back |
| 31 | `gourmet` | `P/Gourmet.jsx` | public (174) | floating back |
| 32 | `collections` | `P/Collections.jsx` | public (178) | floating back |
| 33 | `collections/:id` | `P/CollectionDetail.jsx` | public (179) | own |
| 34 | `profile` | `P/profile/Profile.jsx` | **PR** (184-191) | BN+DN; own |
| 35 | `profile/edit` | `P/profile/EditProfile.jsx` | **PR** (192-199) | own |
| 36 | `profile/payments` | `P/profile/Payments.jsx` | **PR** (200-207) | in-page title, no back |
| 37 | `profile/payments/new` | `P/profile/AddPayment.jsx` | **PR** (208-215) | — (Cancel button) |
| 38 | `profile/payments/:id/edit` | `P/profile/EditPayment.jsx` | **PR** (216-223) | — (Cancel button) |
| 39 | `profile/favorites` | `P/profile/Favorites.jsx` | **PR** (224-231) | own |
| 40 | `profile/support` | `P/profile/Support.jsx` | **PR** (232-239) | own |
| 41 | `profile/coupons` | `P/profile/Coupons.jsx` | **PR** (240-247) | own |
| 42 | `profile/about` | `P/profile/About.jsx` | **PR** (248-255) | own |
| 43 | `profile/report-safety-emergency` | `P/profile/ReportSafetyEmergency.jsx` | **PR** (257-264) | own |
| 44 | `profile/accessibility` | `P/profile/Accessibility.jsx` | **PR** (265-272) | own |
| 45 | `profile/logout` | `P/profile/Logout.jsx` | **PR** (273-280) | own |
| 46 | `profile/refer-earn` | `P/profile/ReferEarn.jsx` | **PR** (281-288) | own |
| 47 | `profile/dining-bookings` | `P/dining/MyBookings.jsx` (same file as #14) | **PR** (289-296) | own |
| 48 | `profile/terms` | `P/profile/Terms.jsx` | public (299) | own sticky |
| 49 | `profile/privacy` | `P/profile/Privacy.jsx` | public (300) | own sticky |
| 50 | `profile/refund` | `P/profile/Refund.jsx` | public (301) | own sticky |
| 51 | `profile/shipping` | `P/profile/Shipping.jsx` | public (302) | own sticky |
| 52 | `profile/cancellation` | `P/profile/Cancellation.jsx` | public (303) | own sticky |
| 53 | `auth/otp` | `P/auth/OTP.jsx` | public (310) | own (works only as `/food/user/auth/otp`) |
| 54 | `auth/callback` | `P/auth/AuthCallback.jsx` | public (311) | — (works only as `/food/user/auth/callback`) |
| 55 | `help` | `P/help/Help.jsx` | public (314) | — (title only) |
| 56 | `help/orders/:orderId` | `P/help/OrderHelp.jsx` | public (315) | own |
| 57 | `notifications` | `P/Notifications.jsx` | **PR** (318-325) | own |
| 58 | `wallet` | `P/Wallet.jsx` | **PR** (328-335) | own sticky |
| 59 | `complaints/submit/:orderId` | `P/complaints/SubmitComplaint.jsx` | **PR** (338-345) | own sticky |

**Redirect-only routes in UserRouter (306-309):** `login`, `sign-in`, `auth/login` and `auth/sign-in` all go to `/user/auth/login`.

**Public routes outside UserRouter:**

| Path | Component | Guard | Layout |
|---|---|---|---|
| `/` | `src/app/MasterLandingPage.jsx` | public | none (no UserLayout, no providers beyond the global ones) |
| `/user/auth/login` | `src/modules/auth/pages/Login.jsx` | public, no AuthRedirect | none |
| `/user/auth/support` | `src/modules/auth/pages/PublicSupport.jsx` | public | none |

**Dead user page files** (imported but never routed):
- `P/auth/SignIn.jsx` (lazy-imported at `UserRouter.jsx:78`, never used)
- `src/modules/auth/pages/Portal.jsx` (the `portal` route redirects instead)

**URL resolution details:**
- Bare `/` renders the landing page, **not** Home. Home is at `/food`, `/food/user` or `/user`.
- `/user/auth/*` always hits AuthApp first. So the Food `OTP` and `AuthCallback` screens are reachable only under `/food/user/auth/...`.
- `useAppBackNavigation` regexes expect `/user/...` after removing the `/food` prefix. On `/food/cart`-style URLs (no `/user`) they fall through to the default `/food/user`.

---

## 2. Per-screen summaries

Each entry covers: what the screen shows and does, its child components, its mobile/desktop behaviour, and its back target.

**Shared building blocks used by most screens** (not repeated in each entry):
- `CU/AnimatedPage.jsx`
- shadcn-style UI in `FU/components/ui/` (`button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `dialog.tsx`, `textarea.tsx`, `label.tsx`, `select.tsx`, `switch.tsx`, `avatar.tsx`, `checkbox.tsx`, `loading-skeletons.jsx`)
- `CU/ScrollReveal.jsx`, `FU/components/OptimizedImage.jsx`, `sonner` toast, `framer-motion`
- API objects from `src/services/api/index.js`

### 2.1 Landing and auth

**`/`: MasterLandingPage** (`src/app/MasterLandingPage.jsx`, 604 lines)
- **What it shows:** a marketing page with:
  - a full-screen hero slider (image or video, 5s autoplay, dots)
  - a "Better food for better people" stats card
  - a two-column feature list around a phone mockup
  - Play Store / App Store download buttons and a fake QR code
  - a footer with links and socials
- **Data:** `GET /food/landing/settings/public`.
- **Gaps:** there is no CTA into the user app or to login. It also shows a floating "Admin Delay Alerts" button to every visitor (→ `/admin/food/restaurant-delay-alerts`, L163-172).
- **Components:** local `FloatingFood`, `FeatureBadge`, `FeatureRow`, `FeatureRowRight`.
- **Layout:** one responsive layout (for example `flex-col md:flex-row`, `lg:flex-row`). No JS width checks.

**`/user/auth/login`: Login (`UnifiedOTPFastLogin`)** (`src/modules/auth/pages/Login.jsx`, 645 lines)
- **Flow on one page:**
  1. Phone entry: +91 fixed, 10 digits. The draft is kept in sessionStorage `draft_phone_login`. Calls `authAPI.sendOTP(phone, "login")`.
  2. A 6-box OTP step with a 60s resend timer and a "Change number" option.
  3. `authAPI.verifyOTP(..., "user", ..., fcmToken, platform)`.
  4. If the user is new or has no name, a "Welcome to CityFood!" name dialog opens.
  5. `setAuthData("user", access, user, refresh)`, then `navigate("/food/user")`.
- **Behaviour notes:**
  - It is hard-coded to the user role, even when mounted under `/delivery/auth` or `/restaurant/auth`.
  - It ignores `state.from`, so a ProtectedRoute redirect always lands back on Home.
  - It does not dispatch `userAuthChanged`.
- **Components:** `ui/dialog`, `button`, `input`, `label`. Top-right SUPPORT link goes to `/user/auth/support`.
- **Layout:** on mobile it fills the screen; on desktop it is a centred phone-frame card (`max-w-[430px] … sm:min-h-[920px] sm:shadow…`, L298). There is no back button.

**`/user/auth/support`: PublicSupport** (`src/modules/auth/pages/PublicSupport.jsx`)
- **What it shows:** merchant support email and phone cards, 3 static FAQs, and business-hours info.
- **Data:** `adminAPI.getPublicBusinessSettings()`, with hard-coded fallbacks.
- **Layout:** sticky header with back via `navigate(-1)`. Single `max-w-md` column.

**`/food/user/auth/otp`: OTP (legacy)** (`P/auth/OTP.jsx`)
- **Flow:**
  1. Reads sessionStorage `userAuthData` (written by the dead `SignIn.jsx`) and supports phone or email.
  2. 6-box OTP with paste support, auto-submit and a 60s resend.
  3. Optional name step.
  4. `setAuthData`, dispatches `userAuthChanged`, then `/food/user`.
- **Defect:** it **crashes on render**, because `loginBanner` is not defined (L413).
- **Layout:** the blurred desktop background is `hidden md:block`; the card is `max-w-[450px]`.

**`/food/user/auth/callback`: AuthCallback** (`P/auth/AuthCallback.jsx`)
- **What it does:** a stubbed OAuth return page with loading, success and error cards.
  - `?token=` → `setAuthData`, then `/food/user`.
  - `?code=` → shows "OAuth temporarily disabled".
  - no params → a mock success that logs nobody in.
- **Layout:** one responsive card.

### 2.2 Home and discovery

**Home** (`P/Home.jsx`, 3688 lines)
- **Out-of-zone state:** a full-screen "coming soon in your city" screen with a Change Location button (L2036-2061).
- **Otherwise, in order:**
  1. Header background (can be a fest video)
  2. `HomeHeader`
  3. `FestBanner`
  4. A sticky "What's on your mind?" category slider
  5. `HeroBanner` carousel
  6. A sticky filter-chip bar (Filters / Under 30 / Under 45 / Under 1km / Under 2km)
  7. "Recommended For You" grid
  8. `ExploreMoreSection`
  9. `MealsUnderSection`
  10. A Gourmet scroller
  11. "N Restaurants Delivering to You" with `RestaurantGrid`, or an out-of-radius mascot empty state
- **Modals and overlays:**
  - Filter bottom sheet with tabs: Sort, Time, Rating, Distance, Price, Trust, Offers
  - Veg-mode popup and switch-off-veg confirm
  - Pure-veg animation and switching-off-veg loading screen
  - Manage Collections sheet
  - Toast portal
  - An "All Categories" modal that is never opened
  - Floating `StickyCartCard` and `OrderTrackingCard` (with `hasBottomNav`)
- **Loading:** skeleton flags for banner, category, explore and restaurants.
- **Data:** `getPublicCategories`, `getPublicExploreIcons`, `getPublicLandingSettings`, `getPublicGourmetRestaurants`, hero banners, `restaurantAPI.getRestaurants`, menus.
- **Components:**
  - `CU/home/HomeHeader.jsx`: location block opening the selector, a notifications bell popover (latest 5, "View All" → `/food/user/notifications`), a sticky search bar with rotating placeholder, mic, and a VEG MODE toggle
  - `CU/home/FestBanner.jsx`
  - `CU/home/HeroBanner.jsx`: tap → `/restaurants/:slug`
  - `CU/home/ExploreMoreSection.jsx`
  - `CU/home/MealsUnderSection.jsx`: its own `getPublicFoods` call and add-to-cart
  - `CU/home/RestaurantGrid.jsx` → `CU/home/HomeRestaurantCard.jsx` → `CU/home/RestaurantImageCarousel.jsx`
  - `CU/home/QuickSection.jsx`: Quick tab placeholder; nothing switches to it
  - `CU/StickyCartCard.jsx`, `CU/OrderTrackingCard.jsx`
  - Unused imports: `PromoRow`, `AdsBannerCarousel`, `Footer`, `AddToCartButton`, `PageNavbar`
- **Hooks:** `useProfile`, `useCart`, `useAppLocation`, `useSearchOverlay`, `useLocationSelector`.
- **Layout:** one responsive tree, for example recommended grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (L2433). `window.innerWidth` is used only to position the veg popup (L562, L597). There is no back button.

**Under250** (`P/Under250.jsx`, 2024 lines)
- **What it shows:**
  - `MenuScanAnimation` intro
  - Banner carousel with floating back and search buttons, plus a slide-down search bar
  - Sticky category chips
  - A Sort button and an "Under 30 mins" toggle
  - Per-restaurant sections, each with a lazily revealed `HorizontalMenuScroller` of dishes under the price limit, plus infinite scroll
- **Modals:** Sort bottom sheet; item-detail sheet (image, bookmark/share, quantity, Add).
- **Other behaviour:** a floating view-cart bar (`AddToCartAnimation`). Filters persist to scoped storage. Adding to cart while logged out redirects to login.
- **Data:** `/food/hero-banners/under-250/public`, landing settings (price limit), restaurants, menus, categories.
- **Layout:** dishes are a horizontal scroller on mobile and a grid on desktop (`flex md:grid … md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, L141). Sheets are centred at `md` and up (L1652, L1726). There is a desktop-only bookmark/share row (`hidden md:flex`, L1808).
- **Back:** `navigate(-1)` (L1296), with the button offset to `md:top-48` to clear the DesktopNavbar.

**Categories** (`P/Categories.jsx`)
- **What it shows:** a sticky header "All Categories", client-side search, and a circular category grid.
- **States:** 12 skeletons while loading; "No results" with a reset button.
- **Data:** `adminAPI.getPublicCategories({zoneId})`.
- **Layout:** `grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8`.
- **Back:** `useAppBackNavigation` → `/food/user`.
- **Navigates to:** `/food/user/category/:slug`.

**CategoryPage** (`P/CategoryPage.jsx`, 2013 lines)
- **What it shows:**
  - Sticky header with back, search, a "Browse Category" chip slider and two rows of filter chips
  - "Matched Dishes" list
  - "All Restaurants" grid: cards use `RestaurantCarouselStateProvider` + `RestaurantImageCarousel` + `RestaurantOfferBanner`, with a local-only bookmark
  - Infinite scroll
  - Empty state with "Clear all filters"
- **Modals:** filter modal (portal) with tabs sort, time, rating, distance, price, offers, trust.
- **Storage:** filters persist under `food-category-page-filters-v1`.
- **Data:** `getPublicFoods`, `getPublicCategories`, `restaurantAPI.getRestaurants`, menus.
- **Layout:** filters go from stacked rows to a wrapped row (`flex-col md:flex-row md:flex-wrap`, L1328). Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. The modal is a bottom sheet on mobile and a centred dialog at `md`.
- **Back:** fixed `navigate('/user')` (L1248).

**Restaurants** (`P/restaurants/Restaurants.jsx`)
- **What it shows:** "All Restaurants" as horizontal cards (info on the left, image on the right) with heart favourite and Order Now / Offline. Banned restaurants are greyed out and sorted last. Ends with an end-of-list logo and `Footer`.
- **States:** delayed `RestaurantGridSkeleton`, then an empty state.
- **Data:** `restaurantAPI.getRestaurants({limit:300, zoneId})`.
- **Components:** `CU/Footer.jsx`, `CU/TextReveal.jsx`, `ui/loading-skeletons`. Hooks `useAppLogo`, `useDelayedLoading`.
- **Layout:** grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- **Back:** `<Link to="/">`, which goes to the landing page.

**RestaurantDetails** (`P/restaurants/RestaurantDetails.jsx`, 4261 lines). This is the core ordering screen.
- **Page structure, in order:**
  1. `MenuScanAnimation` intro
  2. Header: back, an expanding search, ⋮ menu
  3. Info card: rating, distance, open/offline, ETA
  4. Offline banner
  5. FLAT-% card and rotating coupon card (opens the Offers sheet)
  6. Filters button and Veg/Non-veg toggles (hidden in pure-veg or veg mode)
  7. Category chips
  8. Collapsible menu sections with dish cards: ADD / stepper, prep time, "highly reordered", greyed out when offline
  9. FSSAI footer
- **Behaviour:**
  - Infinite pagination, 20 items at a time.
  - Deep-link highlight via `?dish|dishId|highlightItemId|…`. `?under250=true` filters the menu.
  - Availability re-checked every 60s.
- **Sheets** (portals; bottom sheet on mobile, centred at `md`):
  - Menu categories
  - Filters & sorting
  - Item detail, with variant chips. There is no addon or customisation UI.
  - Offers
  - Menu options: add to collection, share, FSSAI
  - Share modal: WhatsApp, Telegram, Email, system share, copy
  - Dead (never opened): Location outlets, Manage collections, Schedule delivery
- **Different-restaurant item:** only a toast is shown; there is no conflict dialog.
- **States:** skeleton, connection error, "Restaurant not found", no dishes match filters, menu not available. The whole page is wrapped in an error boundary.
- **Floating elements:** a "MENU" pill and the `CU/AddToCartAnimation.jsx` view-cart pill (→ `/food/user/cart`).
- **Data:** restaurant by slug or id, outlet timings, menu, inventory, public offers, recent orders.
- **Hooks:** `useCart`, `useProfile`, `useAppLocation`.
- **Layout:** one layout. The per-card bookmark/share is `md:hidden` (L2274). `isMobileDevice()` (UA + `matchMedia(max-width:768px)`) picks the custom share sheet or `navigator.share`.
- **Back:** `goBack` → `/food/user` (or `/food/user/under-250` if `?under250`).
- **Defect:** `handleSystemShare` is undefined (L2298). Sharing a recommended dish crashes into the error boundary.

**ProfessionalSearch** (`P/search/ProfessionalSearch.jsx`)
- **What it shows:** sticky header with back (`navigate(-1)`), an autofocused input, clear and mic.
  - With no query: recent searches (scoped storage, max 5) and a trending categories slider (`?cat=`).
  - With a query: `PremiumLoader`, then "Matched Dishes" and "Restaurants" results, or an empty state.
- **Overlays:** dish sheet (bottom sheet on mobile, centred from `sm`, plus a JS `innerWidth>=640` check at L521) and a full-screen voice "Listening…" overlay. `?voice=true` auto-starts listening.
- **Data:** `searchAPI.unifiedSearch` (debounced 500ms) and `getPublicCategories`.
- **Components:** `P/search/PremiumLoader.jsx`, hook `FU/hooks/useVoiceSearch.js`.

**ProductDetail** (`P/ProductDetail.jsx`)
- **Legacy mock:** hard-coded products and restaurants, with USD×83 prices.
- **What it shows:** hero image, breadcrumb, quantity / add-to-cart (a different restaurant gives `alert()`), restaurant info, ingredients, "Your Order History" from local `OrdersContext`, and `Footer`.
- **States:** "Product Not Found".
- **Back:** `goBack` → `state.from` or `/food/user`. Nothing navigates to this route.

**Offers** (`P/Offers.jsx`)
- **What it shows:** banner with back, then offer groups (heading plus up to 8 dish cards each), with a fallback coupon grid.
- **States:** skeleton, error with Retry, empty.
- **Data:** `restaurantAPI.getPublicOffers()`.
- **Layout:** grids `grid-cols-2 … xl:grid-cols-4`.
- **Back:** → `/food/user`.

**Gourmet** (`P/Gourmet.jsx`)
- **What it shows:** hero banner, a count bar, and a premium restaurant grid with a local bookmark.
- **States:** skeleton, error with Retry, empty.
- **Data:** `/food/hero-banners/gourmet/public`.
- **Back:** → `/food/user`.
- **Defect:** distance reads `window.location` instead of the user location (L174), so the computed distance never applies.

**Collections** (`P/Collections.jsx`)
- **What it shows:** banner, sticky Delivery/Dining tabs, a grid of collection cards, and a "Create new collection" modal.
- **Data:** purely local state with no persistence. "Bookmarks" opens `/user/profile/favorites`.
- **Back:** → `/food/user`.

**CollectionDetail** (`P/CollectionDetail.jsx`)
- **Placeholder:** it lists `useProfile().getFavorites()` with remove buttons.
- **States:** empty state.
- **Back:** → `/food/user/collections`.

**Notifications** (`P/Notifications.jsx`, PR)
- **What it shows:** header with unread badge and "Clear All", then notification cards (tap marks as read, X deletes).
- **States:** "You're all caught up" empty state.
- **Data:** merges localStorage `food_user_notifications` (seeded with mock defaults) with `useNotificationInbox("user")`. It also listens for the `orderStatusNotification` and `deliveryDropOtp` window events.
- **Back:** `<Link to="/user">`.

**Wallet** (`P/Wallet.jsx`, PR)
- **What it shows:** sticky header, a balance hero ("{Company} Money" plus referral earnings), an "Add money" button that opens `CU/AddMoneyModal.jsx` (Razorpay top-up via `userAPI.createWalletTopupOrder` and `FU/utils/razorpay.js`), and transaction history with All / Additions / Deductions / Refunds chips.
- **States:** loading, error, empty.
- **Layout:** stacked on mobile, row at `md` (`flex-col md:flex-row`, L178).
- **Back:** → `/food/user/profile`.

### 2.3 Dining (table booking)

**Dining** (`P/Dining.jsx`, 1525 lines; a bottom-nav root)
- **What it shows:**
  - Mobile-only sticky `PageNavbar` and search (`md:hidden`, L524)
  - Hero banner carousel (auto-advance and swipe)
  - "What are you looking for?" 3-column category grid
  - "Popular Restaurants Within 10km" with filter chips and restaurant cards
- **Modals:** filter modal with 6 tabs (bottom sheet; `md:` centred horizontally).
- **States:** skeletons and an empty state; no error UI.
- **Data:** `diningAPI.getHeroBanners`, `getCategories`, `getRestaurants({lat,lng}|{city})`.
- **Components:** `CU/PageNavbar.jsx`.
- **Layout:** grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. On desktop the page relies on `DesktopNavbar`.
- **Defects:** the price filters and mic do nothing; the distance label is blank.

**DiningCategory** (`P/DiningCategory.jsx`)
- **What it shows:** header with back and a "Dining In {city}" location pill, a hero count, and restaurant cards (open/closed status, cost for two, "Menu & booking").
- **States:** loading, error and empty, all as plain text.
- **Data:** `diningAPI.getRestaurants({category})`.
- **Back:** → `/food/user/dining`.

**DiningExplore50 / DiningExploreNear** (`P/DiningExplore50.jsx`, `P/DiningExploreNear.jsx`)
- Near-identical pages: banner, search, filter chips and modal, and a grid of **hard-coded mock** restaurants. There is no API.
- **Orphaned:** nothing links to either route.
- **Navigates to:** `/user/restaurants/:slug`.

**Coffee** (`P/Coffee.jsx`)
- Static mock "Starbucks" store list with a location-selector button.
- **Back:** → `/food/user/dining`.

**DiningRestaurantDetails** (`P/dining/DiningRestaurantDetails.jsx`)
- **What it shows:**
  - Hero image with back and share, plus info and rating
  - "Book a table" button, or "Dining paused"
  - Sticky scroll-spy tabs: Pre-book offers, Walk-in offers, Menu, Photos, About
  - Fixed bottom "Book a table" CTA
- **Sheet:** guest-count bottom sheet (seats from the public occupied-seats endpoint).
- **States:** loading spinner; "Restaurant not found".
- **Placeholder content:** several hard-coded strings (offers, "Open now").
- **Layout:** mobile-only `max-w-md` column.
- **Defect:** it reads the `category` param, but the route param is named `:diningType`.

**TableBooking** (`P/dining/TableBooking.jsx`)
- **What it shows:** gradient header, guest grid (1–10, remaining seats), date (Today / Tomorrow / next weekday), a Lunch/Dinner toggle with 30-min slots from outlet timings, and a fixed CTA.
- **Storage:** writes sessionStorage `food_dining_booking_draft_v1`.
- **Layout:** `max-w-md`.
- **Back:** → `state.backTo` or `/food/user/dining`.

**TableBookingConfirmation** (`P/dining/TableBookingConfirmation.jsx`)
- **What it shows:** a summary card, a special-request modal, Guest Preferences (links to `/food/user/profile/cancellation` with `returnTo`), "Your Details" with Edit (→ `dining/edit-user`), T&C, and a fixed "Confirm your seat" button.
- **Data:** `authAPI.getCurrentUser` and `diningAPI.createBooking`.
- **Modals:** the Policy and Edit-User modals are never opened.
- **Layout:** modals are bottom sheets on mobile and centred at `sm`.

**TableBookingSuccess** (`P/dining/TableBookingSuccess.jsx`)
- Confetti and a ticket card (pending or confirmed).
- **Buttons:** → `/food/user/bookings` and → `/food/user`.
- **No header.** Without `state.booking` it redirects to dining.

**TableModificationPolicy / TableCancellationPolicy** (`P/dining/…`)
- Static policy pages. Back returns to the confirmation page with its state.
- **Orphaned.**

**TableEditUserPage** (`P/dining/TableEditUserPage.jsx`)
- Name and phone form that returns to the confirmation page.
- **Defect:** the confirmation page ignores the edited values. Back uses `navigate(-1)`.

**MyBookings** (`P/dining/MyBookings.jsx`, PR; two routes)
- **What it shows:** sticky header and booking cards with a status badge. Completed bookings show "RATE & REVIEW", which opens an in-file `ReviewModal` (`diningAPI.createReview`).
- **Data:** `diningAPI.getBookings`.
- **States:** Loader; empty state "Book a table".
- **Back:** `navigate("/")`, which goes to the landing page.

### 2.4 Cart, checkout and address

**Cart** (`P/cart/Cart.jsx`, 4014 lines). This is the real checkout.
- **What it shows, in order:**
  1. Sticky header: back, restaurant name, ETA to address, share
  2. Savings banner
  3. Items with steppers and variant pill
  4. Note and cutlery toggles, plus a restaurant-instructions textarea
  5. "More items for you"
  6. "Complete your meal" addons carousel
  7. Coupons: best coupon, view all, manual code
  8. Delivery time: now, or inline "Schedule it" (date and slot)
  9. Delivery address: current or saved mode, Home/Work/Other, list, chevron → address selector
  10. Recipient name and phone
  11. Collapsible bill details (GST modal)
  12. Cancellation policy
- **Sticky bottom bar:** "PAYING WITH x / CHANGE" and the Place Order button.
- **Payment sheet:** Razorpay (online), wallet, or cash. COD is hidden when `onlinePaymentOnly`, above `maxCodAmount`, or when `userProfile.codEnabled===false`.
- **Place-order flow:**
  1. Validate the order, then `checkRiderAvailability`, then `orderAPI.createOrder`.
  2. Cash or wallet → a "Savings congratulations" view, then the Order Success view (with sound).
  3. Razorpay → `initRazorpayPayment`, then `verifyPayment`. The order is auto-cancelled if the payment sheet is closed or errors.
  4. Then → `/user/orders/:id?confirmed=true`.
- **Other modals:** Share modal; a "Placing order" modal that is dead code.
- **States:** "Your cart is empty" (→ `/user`); a CartProvider-missing error.
- **Data:** `orderAPI.calculateOrder` for pricing, coupons by item, addons, menu, wallet, fee settings, business settings.
- **Storage:** `food-cart-recipient-details-v1`, `food-cart-order-note-v1`.
- **Layout:** one centred layout (`max-w-3xl`). Payment sheet is `max-h-[82vh] md:max-h-[60vh]`. Share uses `isMobileDevice()`.
- **Back:** → `/food/user/restaurants/:slug`.

**Checkout** (`P/cart/Checkout.jsx`)
- **Legacy mock:** hard-coded ×83 pricing and a `setTimeout` place order that writes to local `OrdersContext`.
- **Layout:** `grid-cols-1 lg:grid-cols-3` (address and payment on the left, sticky summary on the right).
- **Defect:** it **crashes on render with a non-empty cart**, because `MessageSquare` and `Textarea` are not imported (L259, L264).
- **Orphaned:** nothing navigates here.
- **Back:** `<Link to="/user/cart">`.

**SelectAddress** (`P/cart/SelectAddress.jsx`)
- Manual address form: Save-as label, autocomplete over saved addresses, and street / city / state / pincode / phone fields.
- **Save:** geocodes with Nominatim, then `addAddress` and `setDefaultAddress`, then `navigate(from)`.
- **Reachability:** only reachable from the orphaned Checkout page.
- **Layout:** `grid-cols-1 sm:grid-cols-2` fields.

**AddressSelectorPage** (`P/cart/AddressSelectorPage.jsx`, 1044 lines). This is the real location picker.
- **List view:**
  - "Use Current Location" (GPS → persist mode `current`)
  - Saved addresses: select, edit, delete with confirm. Empty state.
  - "Add New" (requires login)
- **Form view:** a full-screen overlay containing:
  - Google Map with a centre pin (`@googlemaps/js-api-loader`; key from `FU/utils/googleMapsApiKey.js`) and reverse geocoding when the map goes idle
  - Floating Nominatim search (debounced, top 4 results)
  - "Use My Location"
  - Form: street, flat, city, state, pincode, Home/Work/Other
  - Sticky "Save Address & Proceed" bar that stays above the keyboard (`visualViewport`)
- **Save, guest user:** stores the location locally only.
- **Save, logged-in user:** `addAddress` / `updateAddress`, then `setDefaultAddress`, then `setSavedLocation(persistDb)`.
- **Layout:** mobile-first. There are no Tailwind breakpoints. Map height is computed in JS from `innerHeight*0.45`, clamped to 260–420px.
- **Back:** `goBack` → `/food/user`. This is wrong when the page was opened from Cart.

### 2.5 Orders, help and complaints

**Orders** (`P/orders/Orders.jsx`, PR; a bottom-nav root)
- **What it shows:** sticky header (back → `/user`), search, sticky "Today's Orders / Past" tabs, and order cards. Each card has image, ID, status, items, bill, a rating summary or prompt, an ETA countdown, Reorder (`replaceCart`, then → restaurant), and a ⋮ menu (share, details).
- **Modals:** Rating & Feedback (auto-opens for an unrated delivered order; tracked in localStorage `shownRatingForOrders`); Share sheet.
- **States:** loading, empty "Start Ordering", no matches. 401 shows a toast.
- **Data:** `orderAPI.getOrders` over all pages, polled every 60s and refetched on `visibilitychange`.
- **Layout:** single layout. Mobile hides some bill lines and item images (`hidden sm:flex|block`).

**OrderTracking** (`P/orders/OrderTracking.jsx`, 2510 lines, PR)
- **What it shows:**
  - A "Order Confirmed!" splash when `?confirmed=true`
  - Sticky coloured status header (back → `/user/orders`, share, refresh)
  - Live map via `CU/DeliveryTrackingMap.jsx` (Google Maps; pins from `FU/constants/mapIcons.js`; inside a `MapErrorBoundary`)
  - Cards: delivery OTP, dynamic status, rating CTA or summary, delivery partner with call, contact and address with delivery instructions, restaurant with call and items, and a timed "Cancel Order (Ns)"
- **Dialogs:** Cancel (reason; refund to source or wallet), Order details, Delivery instructions, Rating.
- **States:** loading; "Order Not Found".
- **Realtime:** polls `getOrderDetails` every 12s, or every 75s when the socket is connected. Listens for the `orderStatusNotification` and `deliveryDropOtp` window events that `FU/hooks/useUserNotifications.js` raises from the shared socket. Uses `FU/utils/orderSocketPatch.js`.
- **Layout:** map `h-[300px] sm:h-[450px]`; content `max-w-4xl`.

**OrderInvoice** (`P/orders/OrderInvoice.jsx`, PR)
- Printable tax invoice (amount in words). Print opens a new window; Download PDF uses `html2canvas` + `jsPDF`.
- **States:** loading; not found.
- **Layout:** button labels are `hidden sm:inline`.
- **Back:** → `/user/orders/:id`.
- **Reachability:** reached only from OrderHelp.

**UserOrderDetails** (`P/orders/UserOrderDetails.jsx`, PR)
- **What it shows:** detail view for delivered or cancelled orders: status, restaurant (call, copy ID), items, bill with savings, user / payment / address. Fixed bottom bar with Reorder and Invoice (a client-side jsPDF summary), plus a "Restaurant Complaint" button.
- **Layout:** effectively mobile-only.
- **Back:** → `/food/user/orders`.

**Help** (`P/help/Help.jsx`)
- Static help centre: search, 3 quick actions, FAQ accordion, and a "Still need help" card.
- **Placeholder content:** phone, email, `$` amounts, and an `alert()` live chat.
- **No back button.** Layout `md:grid-cols-3`.
- **Reachability:** reached only from Accessibility.

**OrderHelp** (`P/help/OrderHelp.jsx`)
- Order summary, 6 hard-coded issue cards with actions (track, invoice, contact), and a contact card.
- **Data:** reads only the local `OrdersContext`, so it is usually "Order Not Found" on a fresh load.
- **Back:** → `/user/help`. Nothing links to this route.

**SubmitComplaint** (`P/complaints/SubmitComplaint.jsx`, PR)
- **What it shows:** order info card; type select, subject and description fields; a fixed Submit button.
- **Data:** `orderAPI.submitComplaint`, then → order details.
- **Header:** "View History" → `/user/profile/support`.
- **Layout:** mobile-only.
- **Back:** → `state.backTo` or `/food/user/orders`.

### 2.6 Profile

**Profile** (`P/profile/Profile.jsx`, PR; a bottom-nav root)
- **What it shows:** avatar card, then menu cards:
  - {Company} Money (wallet balance) → wallet
  - Your coupons, Your cart
  - Refer & Earn, with a share button
  - Saved addresses → address selector
  - Your profile (completion %) → edit
  - Veg Mode dialog; Appearance (Light/Dark) dialog
  - Your collections → favorites
  - Your orders
  - Help & Support, About, Report safety emergency
  - A debug "Test Notification" item
  - Log out (confirm overlay); Delete Account (two-step, type "DELETE MY ACCOUNT")
- **Not linked:** Payments, Accessibility, Logout page and dining bookings (commented out).
- **Data:** referral stats and wallet, cached per session.
- **Logout:** removes the push device and FCM token, `authAPI.logout`, Firebase `signOut`, then clears keys (§4.4).
- **Layout:** a single column that widens (`max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl`).
- **Back:** `<Link to="/user">`.

**EditProfile** (`P/profile/EditProfile.jsx`)
- **What it shows:** avatar upload (`FU/components/ImageSourcePicker.jsx` in Flutter, otherwise a file input), name, mobile, email, DOB and anniversary (MUI DatePicker), and gender.
- **Storage:** auto-saves a draft to `user_edit_profile_draft`.
- **Data:** `userAPI.updateProfile` / `uploadProfileImage`.
- **Back:** → `/food/user/profile`.

**Payments / AddPayment / EditPayment** (`P/profile/…`)
- Local-only saved cards in localStorage `userPaymentMethods` (CVV stored!). Validation uses `alert()`. EditPayment has a not-found state.
- **Layout:** card grid `md:grid-cols-2 lg:grid-cols-3`.
- **Back:** none; only Cancel buttons.
- **Reachability:** reached only from the orphaned Checkout page.

**Favorites** (`P/profile/Favorites.jsx`)
- Restaurants and Dishes tabs, read from ProfileContext (localStorage). Remove uses confirm.
- **States:** global and per-tab empty states.
- **Layout:** grid `grid-cols-2 … xl:grid-cols-5`.
- **Back:** → `/user/profile`.

**Support** (`P/profile/Support.jsx`)
- A ticket wizard (Order / Restaurant / Other issue → pick the order or restaurant → form), then a "My Tickets" list with statuses and admin replies.
- **Data:** `supportAPI.getMyTickets` / `createTicket`.

**Coupons** (`P/profile/Coupons.jsx`)
- Public offers list with copy-code.
- **States:** loading; an illustrated empty state.
- **Layout:** fixed `max-w-md`.

**About** (`P/profile/About.jsx`)
- Content from `/food/pages/about`: logo, name, version, features. Also a Legal card with 5 links to the legal pages.

**Terms / Privacy / Refund / Shipping / Cancellation** (`P/profile/…`, public)
- Each renders CMS HTML from `/food/pages/{terms|privacy|refund|shipping|cancellation}` with `dangerouslySetInnerHTML`. This needs a WebView or HTML renderer in React Native.
- **Layout:** sticky header.
- **Back:** `navigate(-1)` or `goBack`. Cancellation also honours `state.returnTo` for the dining flow.

**ReportSafetyEmergency** (`P/profile/ReportSafetyEmergency.jsx`)
- A `tel:100` card, a report form (minimum 10 characters), and a report history list with a detail dialog.
- **Data:** `userAPI.createSafetyEmergencyReport` and `getMySafetyEmergencyReports`.

**Accessibility** (`P/profile/Accessibility.jsx`)
- Four switches (large text, contrast, screen reader, reduce motion) that only set local state and have no effect.
- **Navigates to:** `/user/help`.

**Logout** (`P/profile/Logout.jsx`)
- Standalone confirm-and-logout page (duplicates the Profile logic with slightly different key cleanup).
- **Orphaned** (not linked from anywhere).

**ReferEarn** (`P/profile/ReferEarn.jsx`)
- Reward card, stats tiles and the invited-friends list.
- **Data:** `userAPI.getReferralDetails`.
- **Share:** link `/food/user/auth/login?ref=…` shared via `navigator.share`, or clipboard plus `wa.me`. Note that the `ref` param is ignored by the live Login.jsx.

---

## 3. Mobile navigation pattern

### 3.1 Bottom tab bar: `CU/BottomNavigation.jsx`

- **Container:** `md:hidden fixed bottom-0 … z-50` with a safe-area bottom inset (L55). Each item is 22% wide. The active item gets a pink pill (`bg-[#ffeef2]`) and primary-coloured text.

| Order | Label | Icon (lucide) | Route |
|---|---|---|---|
| 1 | Home | `Home` | `/food/user/` |
| 2 | `Under ₹{under250PriceLimit}` (dynamic, default 250) | `Tag` | `/food/user/under-250` |
| 3 | Orders | `ShoppingBag` | `/food/user/orders` |
| 4 | Profile | `User` | `/food/user/profile` |

- **Settings fetch:** `getPublicLandingSettings(zoneId)` supplies `under250PriceLimit` and `showDining`. `showDining` is fetched but **there is no Dining tab** on mobile; Dining is reachable only on desktop.
- **Active detection:** only checks `/food/...` paths (L37-52). On `/user/...` URLs without the `/food` prefix, no tab highlights correctly.
- **Visibility** (`UserLayout.jsx:105-116`): shown only on `/`, `/user`, `/dining`, `/under-250`, `/orders` and the profile root (after removing `/food`), and **hidden when `isOutOfService`**.
- **Content padding:** when the bar is shown, `<main>` gets `pb-[calc(76px+safe-area)] md:pb-0 md:pt-40` (L126).

### 3.2 Desktop top navbar: `CU/DesktopNavbar.jsx`

This is the desktop counterpart to the bottom nav, so it is not needed for React Native but is listed for completeness.
- `hidden md:flex fixed top-0`. It is shown on the same five roots, and without the logo on Under-250.
- **Contents:**
  - Logo → `/`
  - Location (opens the selector)
  - Hero search → `/food/search?q=`
  - Wallet → `/food/user/wallet`
  - Cart with count → `/food/user/cart`
  - Tabs: Delivery, Under ₹X, Dining (only if `showDining`), Profile

### 3.3 Headers

- **Home:** `CU/home/HomeHeader.jsx`.
  - Row 1: location and address (→ address selector), notifications bell popover.
  - Row 2 (sticky): search pill (opens `SearchOverlay`), mic (→ `/food/user/search?voice=true`), VEG MODE toggle.
- **Dining and Under250:** `CU/PageNavbar.jsx` (1127 lines), a mobile header with location, wallet, cart and profile links. Dining renders it inside `md:hidden`.
- **All other screens:** draw their own header (back arrow and title, often `sticky top-0`), or a floating round back button over a banner (Under250, Offers, Gourmet, Collections, Coffee, explore pages, DiningRestaurantDetails, ProductDetail).

### 3.4 Global overlays and floating UI (instead of drawers)

There is **no side drawer** anywhere in the user app.
- **`CU/SearchOverlay.jsx`:** a full-screen `fixed inset-0 z-[9999]` overlay. It is opened via `useSearchOverlay().openSearch()` (provider in `UserLayout.jsx:29-52`). Suggestions come from `restaurantAPI.getPublicDishes`; submitting → `/user/search?q=`.
- **Location selector:** `useLocationSelector().openLocationSelector()` (`UserLayout.jsx:68-86`) is not a sheet. It navigates to `/food/user/address-selector`.
- **`CU/AppIntroSplash.jsx`:** first-run intro ads from `/food/app-intro-ads/public`, shown once per session (sessionStorage `appIntroSeen`). Tapping an ad → `/food/user/restaurants/:slug`.
- **`CU/StickyCartCard.jsx`:** floating cart pill on Home → `/user/cart`. Sits at `bottom-[70px]` on mobile and `bottom-6` on desktop.
- **`CU/AddToCartAnimation.jsx`:** fly-to-cart animation plus a view-cart pill on RestaurantDetails and Under250. Hidden on the cart, home and profile pages.
- **`CU/OrderTrackingCard.jsx`:** floating active-order card on Home → `/food/user/orders/:id`. It polls `orderAPI.getOrders` and `getOrderDetails`.
- **`PushSoundEnableButton`** (`FU/components/PushSoundEnableButton.jsx`), mounted in `Food/routes.jsx`.
- **Toasts:** sonner, at the top centre.

### 3.5 Back navigation

- **`FU/hooks/useAppBackNavigation.js` → `goBack()`:**
  - It always calls `navigate(<fixed path>)` and **never** `navigate(-1)`.
  - `resolveBackPath` prefers `state.backTo`, then `state.from`, then `state.returnTo`; after that it maps by regex.
  - Examples:
    - profile/* → `/food/user/profile`
    - payments/new|edit → `/food/user/profile/payments`
    - wallet → `/food/user/profile`
    - restaurants/:slug → `/food/user` (or under-250)
    - cart/checkout|select-address → `/food/user/cart`
    - address-selector → `/food/user`
    - orders/:id(/details|/invoice) → `/food/user/orders`
    - complaints → `/food/user/orders`
    - dining/* → `/food/user/dining`
    - category/:x → `/food/user/categories`
    - collections/:id → `/food/user/collections`
    - default → `/food/user`
  - Used by: Categories, Collections, CollectionDetail, Offers, Gourmet, Coffee, ProductDetail, Wallet, EditProfile, ReportSafetyEmergency, Refund, Shipping, Cancellation, RestaurantDetails, Cart (fallback), AddressSelectorPage, UserOrderDetails, SubmitComplaint, and the dining pages.
- **Hard-coded `<Link>` / `navigate(path)`:**
  - Profile → `/user`; Orders → `/user`; Notifications → `/user`
  - OrderTracking → `/user/orders`; OrderInvoice → `/user/orders/:id`; OrderHelp → `/user/help`
  - Favorites, Coupons, About, Accessibility, Logout, ReferEarn → `/user/profile`; Support → `/food/user/profile`
  - CategoryPage → `/user`
  - Restaurants → `/` and MyBookings → `/` (both land on the landing page)
  - Cart → restaurant page; Checkout → `/user/cart`; SelectAddress → `state.from`
- **`navigate(-1)`:** Under250, ProfessionalSearch, TableEditUserPage, PublicSupport, and Terms/Privacy (with a `history.length>2` guard).
- **No back button:** Help, Payments, AddPayment and EditPayment (Cancel only), TableBookingSuccess, AuthCallback, Login.
- **Hardware back:** there is no `popstate` or Flutter/RN back handler for the user module. The only `popstate` listener is in the restaurant Inventory page.
- **Scroll:** both `ScrollToTop` (`Food/routes.jsx:33`) and `UserLayoutShell` (`UserLayout.jsx:92`) scroll to the top on every path change.

---

## 4. Global providers and contexts

### 4.1 Provider tree for user screens

```
StrictMode
 └ Redux Provider (src/app/store.js)
    └ BrowserRouter | HashRouter (src/app/providers.jsx)
       └ UserNotificationProvider (#1, global)
          └ ThemeProvider (FU/context/ThemeContext.jsx, App.jsx)
             └ AuthInitializer (Food/routes.jsx)
                └ UserLayout (CU/UserLayout.jsx:135-166)
                   [AppIntroSplash]
                   └ CartProvider
                      └ ProfileProvider
                         └ LocationProvider
                            └ OrdersProvider
                               └ SearchOverlayProvider (in-file)
                                  └ LocationSelectorProvider (in-file)
                                     └ UserNotificationProvider (#2, duplicate; opens a 2nd socket subscription)
                                        └ UserLayoutShell → LocationGuard → <Outlet/>
```

`MasterLandingPage`, `Login` and `PublicSupport` sit **outside** UserLayout. They have only Redux, Theme and notification #1.

### 4.2 Contexts

**CartContext** (`FU/context/CartContext.jsx`)
- **State:** `cart[]` lines with `id` = `buildCartLineId(item, variant)`, `restaurantId`, `restaurant`, `quantity`, `price`, variant and so on. Also `lastAddEvent` / `lastRemoveEvent` for animations, and derived `items`, `itemCount`, `total`.
- **API:** `addToCart` (enforces a **single restaurant**; returns `{ok:false, code:'RESTAURANT_MISMATCH'}`), `removeFromCart`, `updateQuantity`, `getCartCount`, `isInCart`, `getCartItem`, `clearCart`, `replaceCart`, `cleanCartForRestaurant`.
- **Persistence:** localStorage `cart` (written when non-empty or logged in, L161-172). There is no server cart.

**ProfileContext** (`FU/context/ProfileContext.jsx`)
- **State:** `userProfile`, `addresses`, `paymentMethods`, `favorites` (restaurants), `dishFavorites`, `vegMode`, `vegModeOption` (`pure-veg` etc.), `isAuthenticated`.
- **Loading:** fetched with `authAPI.getCurrentUser` and `userAPI.getAddresses`. Re-fetched on the window event `userAuthChanged`.
- **API:**
  - Server-backed: `add/update/delete/setDefaultAddress` (`userAPI.*`)
  - Local only: payment methods, favourites, dish favourites
- **Persistence:** localStorage `userProfile`, `user_user`, `userAddresses`, `userPaymentMethods`, `userFavorites`, `userDishFavorites`, `userVegMode`, `userVegModeOption`.

**LocationProvider / locationContext** (`FU/context/LocationProvider.jsx`, `FU/context/locationContext.js`)
- **Engine:** `useLocationEngine` (`FU/hooks/useLocation.jsx`): browser geolocation, `locationAPI.reverseGeocode`, `userAPI.updateLocation` / `getLocation` when logged in.
- **Zones:** `useZone` (`FU/hooks/useZone.jsx`, `detectZone(lat,lng)`).
- **State:** `location`, `effectiveLocation`, `deliveryAddressMode` (`current` | `saved`), `zoneId`, `zone`, `zoneStatus`, `isInService` / `isOutOfService` / `isOutOfRadius` / `isOutOfZone`, `serviceUnavailableMessage`, `permissionGranted`.
- **Actions:** `requestLocation`, `setSavedLocation`, `setDeliveryAddressMode`, `refreshZone`, `start/stopWatchingLocation`.
- **Window events:** `deliveryAddressModeUpdated`, `userLocationUpdated`.
- **Read via:**
  - `useAppLocation` (`FU/hooks/useAppLocation.jsx`)
  - `useLocation` from `FU/hooks/useLocation.jsx` (reads the same context; this is **not** react-router's `useLocation`)
- **Persistence** (`FU/utils/locationPersistence.js`):
  - Scoped `food:v1:location:current` (24h TTL) and `food:v1:location:mode`
  - Legacy mirrors `userLocation`, `userLat`, `userLng`, `deliveryAddressMode`
  - Zone: `userZoneId`, `userZone`, `outOfService`

**OrdersContext** (`FU/context/OrdersContext.jsx`)
- **What it is:** a local-only legacy order list (`createOrder`, `getOrderById`, `getAllOrders`), persisted in localStorage `userOrders`.
- **Used by:** OrderTracking (seed), OrderInvoice, OrderHelp, ProductDetail and Checkout. Real orders come from `orderAPI`.

**SearchOverlayContext** (in `CU/UserLayout.jsx:17-52`)
- **State:** `isSearchOpen`, `searchValue`. Renders `SearchOverlay`. Not persisted.

**LocationSelectorContext** (in `CU/UserLayout.jsx:54-86`)
- `openLocationSelector()` just navigates to `/food/user/address-selector`.

**UserNotificationContext** (`FU/context/UserNotificationContext.jsx` → `FU/hooks/useUserNotifications.js`)
- **What it does:** subscribes to the shared user socket (`FU/utils/userSocketManager`) for `order_status_update`, `order_state`, `delivery_drop_otp` and `admin_notification`. It re-broadcasts them as window CustomEvents (`orderStatusNotification`, `deliveryDropOtp`, …) and exposes `isConnected`.
- **Mounted twice** (providers.jsx and UserLayout).

**Notification inbox** (`FU/hooks/useNotificationInbox.js`)
- Broadcast inbox from the API (`markAsRead`, `dismiss`, `dismissAll`), plus local `food_user_notifications`. Window event `notificationsUpdated`.

**ThemeContext** (`FU/context/ThemeContext.jsx`)
- Light/dark theme with the key chosen by path: `userAppTheme` for the user app. Toggles the `.dark` class on `<html>`.

**Redux store** (`src/app/store.js`)
- Slices: `app`, `auth`, `food`, `taxi`, `quick`, `location`. None of them is persisted.
- In the user tree, the only use is `LocationGuard` (`CU/LocationGuard.jsx`) dispatching `location/setLocation`. No user screen reads Redux, so it can be dropped in React Native.

**AuthInitializer** (`FU/components/AuthInitializer.jsx`)
- A one-tick loader before routes render. It holds no state.

### 4.3 Auth token storage (`FU/utils/auth.js`)

- **`setAuthData('user', token, user, refresh)`** (L288-322) writes:
  - localStorage `user_accessToken`, `user_refreshToken`, `user_authenticated="true"`, `user_user`
  - scoped `food:v1:auth:user:*` mirrors
  - It calls `clearUserSession()` first.
- **`isModuleAuthenticated`** (L163-182): an unexpired access token with the right role, **or** an unexpired refresh token. Refresh happens in the axios layer (`src/services/api/axios.js`, `auth.js`).
- **`clearModuleAuth('user')`** (L188-212) removes the tokens, `user_user`, `fcm_web_registered_token_user` and sessionStorage `userAuthData`. `clearUserSession()` (L217-221) removes `userProfile`, `user_user` and `user_edit_profile_draft`.
- **Window event:** `userAuthChanged`.

### 4.4 Complete storage key inventory (user app)

**localStorage**

| Area | Keys |
|---|---|
| Auth | `user_accessToken`, `user_refreshToken`, `user_authenticated`, `user_user`, legacy `accessToken`, `user`, `fcm_web_registered_token_user` |
| Profile | `userProfile`, `userAddresses`, `userPaymentMethods`, `userFavorites`, `userDishFavorites`, `userVegMode`, `userVegModeOption`, `user_edit_profile_draft`, `tuggo_user_profile` (read only) |
| Cart and orders | `cart`, `userOrders`, `food-cart-recipient-details-v1`, `food-cart-order-note-v1`, `shownRatingForOrders` |
| Location | `userLocation`, `userLat`, `userLng`, `deliveryAddressMode`, `userZoneId`, `userZone`, `outOfService` |
| Scoped (`food:v1:*`) | `food:v1:location:current`, `food:v1:location:mode`, `food:v1:auth:user:*`, search history, Under250 filters (`food-under-250-filters` legacy key) |
| UI and other | `food-category-page-filters-v1`, `food_user_notifications`, `userAppTheme`, `native_last_route` |

**sessionStorage**

| Key | Purpose |
|---|---|
| `appIntroSeen` | Intro splash shown this session |
| `draft_phone_login` | Login phone draft |
| `userAuthData` | Legacy SignIn → OTP hand-off |
| `user_draft_phone` | Legacy SignIn phone draft |
| `oauthSuccess` | AuthCallback mock flag |
| `food_dining_booking_draft_v1` | Dining booking draft |

**Logout cleanup** (Profile.jsx L433-442): `clearModuleAuth('user')`, then removes `accessToken`, `user_authenticated`, `user_user`, `user`, `cart`, `userOrders`, `userVegMode`, `food-under-250-filters`.

---

## 5. Screens left out (non-customer roles)

These are listed by route prefix only.

**Restaurant partner (46 paths).** Served by `FU/components/restaurant/RestaurantRouter.jsx`:
- `/food/restaurant/*` (also reachable at `/restaurant/*` through the `/*` catch-all)
- auth: `welcome`, `login`, `otp`, `signup`, `forgot-password`, `pending-verification`, `onboarding`
- dashboard, `orders/*`, `menu-categories`, `inventory`, `outlet-*`, `hub-finance`, `promocodes`, `reservations`, `zone-setup` and similar
- `/restaurant/auth/*` (shared AuthApp)

**Delivery partner (34 paths).** Served by `src/modules/DeliveryV2/DeliveryV2Router.jsx` (via `DeliveryV2/index.jsx`):
- `/food/delivery/*` (also `/delivery/*`; HashRouter is forced for these)
- `welcome`, `login`, `otp`, `signup/*`, `feed`, `pocket/*`, `orders`, `history`, `profile/*`, `help/tickets/*`, `notifications`, `support`
- `/delivery/auth/*` (shared AuthApp)

**Admin (146 paths).** Served by `FU/components/admin/AdminRouter.jsx`:
- `/admin/*`, including `/admin/food/*`, `/admin/taxi/*` and `/admin/quick-commerce/*`
- `/food/admin/*` redirects to `/admin`
- Admin auth pages: `AdminLogin`, `AdminSignup`, `AdminForgotPassword` (`FU/pages/admin/auth/`)

**Other:**
- `/user/auth/portal` → `/` (the unused "super-app" Portal: Food / Quick / Taxi / Hotel)
- Redux `taxi` and `quick` slices, and `CU/home/QuickSection.jsx`: Quick-commerce placeholders with no user routes

---

## 6. Cross-cutting issues worth knowing before porting

1. **Login role bug:** `Login.jsx` is shared by `/user`, `/delivery` and `/restaurant` `/auth/login`, but it always authenticates as `user`. Delivery and restaurant have their own sign-in pages inside their routers.
2. **Two login implementations:**
   - The live one is `modules/auth/pages/Login.jsx`.
   - The legacy one is `P/auth/SignIn.jsx` (unrouted) → `P/auth/OTP.jsx`, which is broken.
   - They send different phone formats (raw 10 digits vs `"+91 XXXXXXXXXX"`).
3. **Placeholder support contacts differ between screens:**
   - Help / OrderHelp: `+1-800-123-4567`, `support@tuggo.com`
   - Orders / Tracking: `+919755633147`
   - PublicSupport: `8919142335`
4. **Payment-method screens are local-only and store the CVV in localStorage.** The real payments are Razorpay, wallet and COD in Cart.
5. **Mixed route prefixes everywhere:** `/food/user/x`, `/user/x`, `/x`, `/food/x`. In React Native, normalise to a single stack and route naming.

---

## 7. Dead, orphaned or broken screens

| Screen | Status |
|---|---|
| `P/auth/SignIn.jsx` | Not routed |
| `src/modules/auth/pages/Portal.jsx` | Not routed |
| `P/auth/OTP.jsx` | Crashes (`loginBanner` undefined, L413); reachable only at `/food/user/auth/otp` |
| `P/auth/AuthCallback.jsx` | OAuth stub |
| `P/cart/Checkout.jsx` | Orphaned and mock; crashes (`MessageSquare` and `Textarea` not imported) |
| `P/cart/SelectAddress.jsx` | Reachable only from Checkout |
| `P/profile/Payments.jsx`, `AddPayment.jsx`, `EditPayment.jsx` | Reachable only from Checkout |
| `P/DiningExplore50.jsx`, `P/DiningExploreNear.jsx` | Orphaned, mock data |
| `P/dining/TableModificationPolicy.jsx`, `TableCancellationPolicy.jsx` | Orphaned |
| `P/ProductDetail.jsx` | Orphaned, mock |
| `P/Coffee.jsx` | Static mock |
| `P/Collections.jsx`, `P/CollectionDetail.jsx` | Local-only placeholder |
| `P/help/OrderHelp.jsx` | Not linked; local data only |
| `P/profile/Logout.jsx`, `P/profile/Accessibility.jsx` | Not linked from Profile |
| `P/restaurants/RestaurantDetails.jsx` | Runtime crash on share of a recommended dish (L2298) |

---

## 8. Totals

| Item | Count |
|---|---|
| Customer route entries in `UserRouter.jsx` that render a component | **59** |
| Customer redirect-only routes in UserRouter | 4 (`login`, `sign-in`, `auth/login`, `auth/sign-in`) |
| Customer routes outside UserRouter | **3** (`/` landing, `/user/auth/login`, `/user/auth/support`), plus 2 auth redirects (`portal`, `*`) |
| **Total customer routes that render a screen** | **62** |
| Distinct customer page components routed | **61** (MyBookings serves 2 routes) |
| ↳ Protected by `ProtectedRoute requiredRole="user"` | **22** routes (bookings, 4 × orders, 14 × profile, notifications, wallet, complaints) |
| ↳ Public | **40** routes (37 in UserRouter + 3 outside) |
| Routes with bottom nav (mobile) / DesktopNavbar | **5** (Home, Dining, Under250, Orders, Profile) |
| Bottom-nav tabs | **4** (Home, Under ₹X, Orders, Profile) |
| Unrouted user page files | 2 (`SignIn.jsx`, `Portal.jsx`) |
| Contexts and providers on user screens | 9 (Cart, Profile, Location, Orders, SearchOverlay, LocationSelector, UserNotification ×2 mounts, Theme) plus Redux (`location` slice only) and AuthInitializer |
| Dead, orphaned, mock or broken screens flagged | 21 (§7) |
| Non-customer route paths excluded | Restaurant 46, Delivery 34, Admin 146 (226 total) |
