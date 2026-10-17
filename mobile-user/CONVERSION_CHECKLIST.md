# CityFood user app: conversion checklist

This file tracks the conversion of the CityFood customer web app to an Expo Android app. Each row ends with a status:

- **Verified**: run and seen working.
- **Built, not tested**: code is written; it needs a device test.
- **Blocked**: can't be completed yet; the row says what is needed.
- **Pending**: not built yet.

Supporting evidence is in [docs/audit/](docs/audit/): routes and screens, API and auth, design and platform. The endpoint map is in [docs/API_MAP.md](docs/API_MAP.md).

## Inputs found

| Item | Value | Source |
|---|---|---|
| Target app | User (customer) app | Stated by the user |
| Web frontend | `Frontend/` (Vite + React 19, react-router 7, Tailwind v4) | Repo |
| Backend | `Backend/` (Express + MongoDB; `server.js`, separate `socket-server.js`) | Repo |
| Flutter wrapper | **None exists** for CityFood. App identity comes from the web app instead. | Confirmed by the user. The wrappers in `~/Public/projects/dima-hasao/flutter/` belong to a different product and were not used. |
| App name | CityFood | Web `<title>`, `manifest.json`, `MasterLandingPage` branding |
| Android package | `com.cityfood.user` | Chosen by the user (there is no wrapper `applicationId`) |
| Version | 1.0.0 (versionCode 1) | There is no wrapper `pubspec.yaml`, so this is a fresh start |
| App icon and splash | `Frontend/src/assets/logo.png` (640×640) on white | Web manifest uses `logo.png` on `#ffffff` |
| API base URL | `https://cityfood.co.in/api/v1` | Given by the user; `/health` returns UP. In `mobile-user/.env` as `EXPO_PUBLIC_API_BASE_URL`. |
| Socket URL | `https://cityfood.co.in` (path `/socket.io`) | `Frontend/src/modules/Food/utils/socketOrigin.js`: on HTTPS it uses the API origin. The live endpoint answers the Engine.IO handshake. |
| Google Maps key | Copied from `Frontend/.env` `VITE_GOOGLE_MAPS_API_KEY` into `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `Frontend/.env` |
| Razorpay public key | Not stored in the app; the server returns it per order (`razorpay.key`) | `Backend` create-order and wallet top-up responses |
| Firebase or FCM | **Missing** `google-services.json` for `com.cityfood.user` | Only the web config and VAPID key exist (web push) |
| Runtime theme | `GET /app-config/user_app` sets primary `#B80B3D`, secondary `#66001D`, font Poppins | Live API, `Frontend/src/modules/Food/utils/themeSettings.js` |
| Test login | Phone **9755633147**, OTP **123456** | `Backend/src/core/otp/otp.service.js:106` (hard-coded test number). Verified live: verify-otp returns tokens with role USER. |
| Expo account | Not logged in at the start of the run | `npx eas-cli whoami` |
| Expo SDK | 58 (`expo@58.0.14`, react-native 0.88, React 19.3) | `npm view expo` (latest stable) |

### Conflicts and assumptions

1. **API URL:** `Frontend/.env` has `VITE_API_BASE_URL=http://localhost:5000/api/v1`, a local dev value. The deployed product uses `https://cityfood.co.in/api/v1`, given by the user, so the app uses that.
2. **First screen:** web `/` is `MasterLandingPage`, a marketing site page (feature rows, footer, an admin link). The app opens on the food Home (`/food/user`), which is what a native shell around the user app would show. The landing page is left out.
3. **Theme default:** `index.jsx` defaults the customer app to dark (`appTheme`), but `ThemeContext` (`userAppTheme`) defaults to light and takes precedence. The app defaults to **light** and keeps the Profile → Appearance toggle.
4. **Admin colors apply in dark mode too.** The web sets `--primary` and `--secondary` inline on `<html>`, which beats the `.dark` rules. The app does the same.
5. **Login always lands on Home.** The web's `Login.jsx` ignores `state.from` after login. Kept as-is.
6. **Saved cards with CVV in localStorage** (`userPaymentMethods`): those screens are reachable only from the dead `Checkout.jsx`, so they are left out (see Left out below). No card data is stored on the device.
7. **8 web images are corrupted** in git and on the live site (see Blocked). They are kept as empty frames of the same size, the way they appear on the web today.

## Auth (how the backend works)

- `POST /food/auth/user/request-otp {phone}` → `POST /food/auth/user/verify-otp {phone, otp:string, platform:"mobile", name?, ref?, fcmToken?}`.
- **New user:** the first verify returns `{isNewUser:true, needsName:true}` with no tokens. The app verifies again with the same OTP plus `name`.
- **Tokens:** `data.accessToken` (also `data.token`) and `data.refreshToken` arrive in the JSON body. There are **no cookies anywhere**. Requests send `Authorization: Bearer <access>`. Both tokens default to a 365-day expiry.
- **Refresh:** `POST /food/auth/refresh-token {refreshToken}` returns `{accessToken, refreshToken}` (the same refresh token comes back). On a 401 the client refreshes once (single-flight) and retries; on 429 it doesn't refresh; on 403 it doesn't log out.
- **Logout:** `POST /food/auth/logout {refreshToken, fcmToken, platform}`. **`GET /food/auth/me`** returns the raw user document.
- **In the app:** tokens are stored in SecureStore (`user_accessToken`, `user_refreshToken`) and the user object in AsyncStorage. The logged-in check follows the web rule: an unexpired USER access token or an unexpired refresh token. Code: `src/api/client.js`, `src/context/AuthContext.js`.

## Design tokens

From `Frontend/src/shared/styles/global.css` and the live `/app-config`, collected in `src/theme/tokens.js`:

- **Colors:** page `#F9F9FB`; card white; primary from `/app-config` (fallback `#7e3866`); dark mode uses page `#0A0A0A`, card `#1A1A1A`, and primary `#F76208` unless overridden.
- **Fonts:** Poppins 300–900, bundled with `@expo-google-fonts/poppins`, mapped by weight in `components/ui/Text.js`. Body text is 14px, captions 12px.
- **Spacing:** 4px grid, 16px gutter.
- **Radius:** 6/8/10/12/16/24 and full.
- **Shadows:** Tailwind `shadow-*` as RN `boxShadow`.
- **Icons:** lucide (`lucide-react-native`, matched by name), plus react-icons `FaLocationDot`.

## Native capabilities

There is no Flutter wrapper, so these come from what the web app uses.

| Capability | Web source | Native | Status |
|---|---|---|---|
| Push notifications | `firebaseMessaging.js` (web FCM, VAPID) | expo-notifications. Native FCM token goes to `/fcm-tokens/...` (no backend change). Channel `default` with sound `zomato_sms`. | Blocked: needs `google-services.json` |
| Location | `hooks/useLocation.jsx` (`navigator.geolocation`) | expo-location, foreground only | Pending |
| Camera and gallery | EditProfile avatar (`<input type=file>`) | expo-image-picker | Pending |
| Maps | `@react-google-maps/api` (tracking, address pin) | react-native-maps (`PROVIDER_GOOGLE`) | Pending |
| Payments | Razorpay checkout.js | react-native-razorpay 3 (native SDK, New Architecture) | Pending |
| Share and clipboard | `navigator.share`, `wa.me`, clipboard | RN `Share`, `Linking`, expo-clipboard | Pending |
| Voice search | Web Speech API | expo-speech-recognition | Pending |
| Invoice download | jsPDF + html2canvas | expo-print + expo-sharing | Pending |
| Sounds and vibration | `new Audio`, `navigator.vibrate` | expo-audio, expo-haptics | Pending |
| Splash and icon | manifest logo on white | expo-splash-screen and adaptive icon from `logo.png` | Built, not tested |
| Android back button | web `useAppBackNavigation` fixed parents | `src/navigation/back.js` (same rules; history-back elsewhere) | Built, not tested |
| Deep links | none on web | scheme `cityfood://` (Expo Router default only) | Built, not tested |

## Screens

Native paths are the web paths without the `/food/user` prefix. PR means login required (`ProtectedRoute requiredRole="user"`).

| # | Web route | Web component | Guard | Native route | Status |
|---|---|---|---|---|---|
| 1 | `/food/user` | `pages/user/Home.jsx` | public | `/` (tab) | Pending |
| 2 | `/food/user/dining` | `pages/user/Dining.jsx` | public | `/dining` (tab bar visible, no tab of its own) | Pending |
| 3 | `dining/:category` | `DiningCategory.jsx` | public | `/dining/[category]` | Pending |
| 4 | `dining/:diningType/:slug` | `dining/DiningRestaurantDetails.jsx` | public | `/dining/[diningType]/[slug]` | Pending |
| 5 | `dining/book/:slug` | `dining/TableBooking.jsx` | public | `/dining/book/[slug]` | Pending |
| 6 | `dining/book-confirmation` | `dining/TableBookingConfirmation.jsx` | public | `/dining/book-confirmation` | Pending |
| 7 | `dining/book-success` | `dining/TableBookingSuccess.jsx` | public | `/dining/book-success` | Pending |
| 8 | `dining/edit-user` | `dining/TableEditUserPage.jsx` | public | `/dining/edit-user` | Pending |
| 9 | `bookings`, `profile/dining-bookings` | `dining/MyBookings.jsx` | PR | `/bookings`, `/profile/dining-bookings` | Pending |
| 10 | `under-250` | `Under250.jsx` | public | `/under-250` (tab) | Pending |
| 11 | `categories` | `Categories.jsx` | public | `/categories` | Pending |
| 12 | `category/:category` | `CategoryPage.jsx` | public | `/category/[category]` | Pending |
| 13 | `restaurants` | `restaurants/Restaurants.jsx` | public | `/restaurants` | Pending |
| 14 | `restaurants/:slug` | `restaurants/RestaurantDetails.jsx` | public (add to cart needs login) | `/restaurants/[slug]` | Pending |
| 15 | `search` | `search/ProfessionalSearch.jsx` | public | `/search` | Pending |
| 16 | `cart` | `cart/Cart.jsx` (the real checkout) | public | `/cart` | Pending |
| 17 | `address-selector` | `cart/AddressSelectorPage.jsx` | public ("Add New" needs login) | `/address-selector` | Pending |
| 18 | `orders` | `orders/Orders.jsx` | PR | `/orders` (tab) | Pending |
| 19 | `orders/:orderId` | `orders/OrderTracking.jsx` | PR | `/orders/[orderId]` | Pending |
| 20 | `orders/:orderId/invoice` | `orders/OrderInvoice.jsx` | PR | `/orders/[orderId]/invoice` | Pending |
| 21 | `orders/:orderId/details` | `orders/UserOrderDetails.jsx` | PR | `/orders/[orderId]/details` | Pending |
| 22 | `offers` | `Offers.jsx` | public | `/offers` | Pending |
| 23 | `gourmet` | `Gourmet.jsx` | public | `/gourmet` | Pending |
| 24 | `collections` | `Collections.jsx` | public | `/collections` | Pending |
| 25 | `collections/:id` | `CollectionDetail.jsx` | public | `/collections/[id]` | Pending |
| 26 | `profile` | `profile/Profile.jsx` | PR | `/profile` (tab) | Pending |
| 27 | `profile/edit` | `profile/EditProfile.jsx` | PR | `/profile/edit` | Pending |
| 28 | `profile/favorites` | `profile/Favorites.jsx` | PR | `/profile/favorites` | Pending |
| 29 | `profile/support` | `profile/Support.jsx` | PR | `/profile/support` | Pending |
| 30 | `profile/coupons` | `profile/Coupons.jsx` | PR | `/profile/coupons` | Pending |
| 31 | `profile/about` | `profile/About.jsx` | PR | `/profile/about` | Pending |
| 32 | `profile/report-safety-emergency` | `profile/ReportSafetyEmergency.jsx` | PR | `/profile/report-safety-emergency` | Pending |
| 33 | `profile/refer-earn` | `profile/ReferEarn.jsx` | PR | `/profile/refer-earn` | Pending |
| 34 | `profile/terms` | `profile/Terms.jsx` | public | `/profile/terms` | Pending |
| 35 | `profile/privacy` | `profile/Privacy.jsx` | public | `/profile/privacy` | Pending |
| 36 | `profile/refund` | `profile/Refund.jsx` | public | `/profile/refund` | Pending |
| 37 | `profile/shipping` | `profile/Shipping.jsx` | public | `/profile/shipping` | Pending |
| 38 | `profile/cancellation` | `profile/Cancellation.jsx` | public | `/profile/cancellation` | Pending |
| 39 | `help` | `help/Help.jsx` | public | `/help` | Pending |
| 40 | `notifications` | `Notifications.jsx` | PR | `/notifications` | Pending |
| 41 | `wallet` | `Wallet.jsx` | PR | `/wallet` | Pending |
| 42 | `complaints/submit/:orderId` | `complaints/SubmitComplaint.jsx` | PR | `/complaints/submit/[orderId]` | Pending |
| 43 | `/user/auth/login` | `modules/auth/pages/Login.jsx` (OTP and name steps) | public | `/login` | Pending |
| 44 | `/user/auth/support` | `modules/auth/pages/PublicSupport.jsx` | public | `/support` | Pending |
| 45 | (overlay) | `AppIntroSplash.jsx` (server intro slides, once per session) | n/a | overlay in the root layout | Pending |
| 46 | (overlay) | `SearchOverlay.jsx` | n/a | overlay | Pending |
| 47 | (guard) | `LocationGuard.jsx` (out-of-zone screen) | n/a | wrapper | Pending |
| 48 | (shell) | `BottomNavigation.jsx` (Home, Under ₹X, Orders, Profile) | n/a | `(tabs)/_layout.js` | Pending |

### Left out (please confirm)

| Screen | Reason |
|---|---|
| `/` `MasterLandingPage.jsx` | Marketing website page, not part of the ordering app |
| `pages/user/auth/SignIn.jsx`, `modules/auth/pages/Portal.jsx` | Not routed (dead files) |
| `pages/user/auth/OTP.jsx` | Crashes on render (`loginBanner` undefined, L413). The live OTP flow is inside `Login.jsx`. |
| `pages/user/auth/AuthCallback.jsx` | OAuth redirect stub. There is no Google sign-in in the live login. |
| `cart/Checkout.jsx`, `cart/SelectAddress.jsx` | Orphaned mock checkout that crashes (`MessageSquare` and `Textarea` not imported). The real checkout is `Cart.jsx`. |
| `profile/Payments.jsx`, `AddPayment.jsx`, `EditPayment.jsx` | Reachable only from the dead Checkout. They also store card numbers and CVV in localStorage. |
| `DiningExplore50.jsx`, `DiningExploreNear.jsx`, `Coffee.jsx` | Orphaned, mock data only |
| `dining/TableModificationPolicy.jsx`, `TableCancellationPolicy.jsx` | Not linked from anywhere |
| `ProductDetail.jsx` | Orphaned, mock data |
| `help/OrderHelp.jsx` | Not linked; local data only |
| `profile/Logout.jsx`, `profile/Accessibility.jsx` | Not linked from Profile. Logout is done from the Profile screen itself. |
| Desktop navbar and footer | Desktop only (`md:` breakpoints) |
| Restaurant (46), Delivery (34) and Admin (146) routes | Other apps or admin panel |

## Web-only code and its native replacement

See [docs/audit/design-and-platform.md §4](docs/audit/design-and-platform.md) for the full inventory. These replacements are in place:

| Web | Native | Where |
|---|---|---|
| localStorage / sessionStorage | SecureStore (tokens), AsyncStorage (`food:v1:` namespace) | `src/storage` |
| Tailwind / shadcn | StyleSheet and one theme file | `src/theme`, `src/components/ui` |
| sonner toasts | in-house `toast` with the same API and look | `components/ui/Toast.js` |
| Radix dialog and bottom-sheet modals | RN `Modal` (`BottomSheet`, `Dialog`) | `components/ui/Sheet.js` |
| OptimizedImage (Cloudinary `w_` or wsrv.nl) | `AppImage` (expo-image, same URL rules) | `components/ui/AppImage.js` |
| canvas-confetti | `Confetti` (Animated) | `components/ui/Confetti.js` |
| framer-motion `whileTap` | `ScalePressable` | `components/ui/primitives.js` |
| react-router back rules | `src/navigation/back.js` | |

## Blocked

| Item | Why | What's needed |
|---|---|---|
| Push notifications | There is no Android Firebase app for `com.cityfood.user` | In the Firebase console, add an Android app with package `com.cityfood.user`, download `google-services.json` into `mobile-user/`, and rebuild. `app.config.js` picks it up automatically. |
| 8 images | Corrupted in git (LF→CRLF on binary files) and on the live site; they could not be repaired. Files: `bikelogo.png`, `collectionspagebanner.png`, `explore more icons/{collection,gourmet,offers,top 10}.png`, `fssai.png`, `offerimage.png` | Original files. Put them in `mobile-user/assets/images/` under the same paths. 23 other images were repaired with CRC verification. |

## Backend changes

None so far.

## Device test list

To be completed at the end of the run.
