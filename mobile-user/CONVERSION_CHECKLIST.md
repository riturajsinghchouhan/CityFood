# CityFood user app: conversion checklist

This file tracks the conversion of the CityFood customer web app to an Expo Android app. Each row ends with one status:

- **Verified**: run and seen working, on the Android emulator or against the live API.
- **Built, not tested**: the code is written and the bundle builds, but it hasn't been exercised. It needs a device test.
- **Blocked**: it can't be completed yet; the row says what is needed.

Related documents:

- Evidence: [docs/audit/](docs/audit/) (routes and screens, API and auth, design and platform)
- Endpoint map: [docs/API_MAP.md](docs/API_MAP.md)
- Conversion rules: [docs/SCREEN_GUIDE.md](docs/SCREEN_GUIDE.md)
- Shared shell components: [docs/SHARED_COMPONENTS.md](docs/SHARED_COMPONENTS.md)

## Inputs found

| Item | Value | Source |
|---|---|---|
| Target app | User (customer) app | Stated by the user |
| Web frontend | `Frontend/` (Vite, React 19, react-router 7, Tailwind **v4**) | Repo |
| Backend | `Backend/` (Express, MongoDB; `server.js` plus a separate `socket-server.js`) | Repo |
| Flutter wrapper | **None exists** for CityFood, so app identity comes from the web app | Confirmed by the user. The wrappers in `~/Public/projects/dima-hasao/flutter/` belong to another product and were not used. |
| App name | CityFood | Web title, `manifest.json`, branding |
| Android package | `com.cityfood.user` | Chosen by the user (there is no wrapper `applicationId`) |
| Version | 1.0.0 (versionCode 1) | Fresh start; there is no `pubspec.yaml` |
| Icon and splash | `Frontend/src/assets/logo.png` (640×640) on white | The web manifest uses the logo on `#ffffff` |
| API base URL | `https://cityfood.co.in/api/v1` | Given by the user; `/health` returns UP. Set as `EXPO_PUBLIC_API_BASE_URL` in `mobile-user/.env`. |
| Socket URL | `https://cityfood.co.in` (path `/socket.io`) | Web `socketOrigin.js` uses the API origin on HTTPS. The live handshake works. |
| Google Maps key | Copied from `Frontend/.env` (`VITE_GOOGLE_MAPS_API_KEY`) into `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `Frontend/.env` |
| Razorpay | Key comes from the server with each order. Production returned a **test** key (`rzp_test_`). | Live wallet top-up order response |
| Firebase / FCM | `mobile-user/google-services.json` (project `cityfood-69559`; includes `com.cityfood.user`, plus the restaurant and delivery apps) | Provided by the user on 2026-10-19. Same project as the backend's service account. |
| Runtime theme | `GET /app-config/user_app`: primary `#B80B3D`, secondary `#66001D`, font Poppins | Live API, `themeSettings.js` |
| Test login | Phone **9755633147**, OTP **123456** | `Backend/src/core/otp/otp.service.js:106`. Verified on the emulator. |
| Expo account | **Not logged in** | `npx eas-cli whoami` |
| Expo SDK | 58 (`expo@58.0.14`, React Native 0.88, React 19.3, New Architecture) | Latest stable |

### Conflicts and assumptions

1. **API URL.** `Frontend/.env` has `http://localhost:5000/api/v1`, a dev value. The deployed URL the user gave is used instead.
2. **First screen.** Web `/` is `MasterLandingPage`, a marketing page. The app opens on the food Home (`/food/user`).
3. **Default theme.** The web defaults to **light**, because `ThemeContext` (`userAppTheme`) overrides `index.jsx`. The Profile → Appearance toggle is kept.
4. **Admin colors in dark mode.** The admin colors apply in dark mode too. The web sets them inline on `<html>`, which takes precedence over the `.dark` rules.
5. **Fonts.** Food pages render in Poppins. The live login page renders in the **system font** (Tailwind `ui-sans-serif`, which is Roboto on Android) and public support renders in **Inter**. Both were checked by reading computed fonts on the live site, and the app matches them.
6. **Colors.** The web uses Tailwind **v4**. Palette values come from the live CSS (OKLCH converted to hex), not v3 values.
7. **Login landing.** Login always lands on Home, as the web does; the web's `Login.jsx` ignores `from`.
8. **Saved cards.** The saved-card screens (`Payments`, `AddPayment`, `EditPayment`) can only be reached from the dead `Checkout.jsx`, so they are left out. They stored the card number and CVV in localStorage; no card data is stored on the device.

## Auth

- **Login.** `POST /food/auth/user/request-otp {phone}` → `POST /food/auth/user/verify-otp {phone, otp, platform:"mobile", name?, ref?, fcmToken?}`. A new user gets `{needsName:true}` and verifies again with the same OTP plus `name`.
- **Tokens.** Bearer tokens (`accessToken`, `refreshToken`) come back in the JSON body. There are no cookies. Both tokens default to a 365-day expiry.
- **Storage.** Tokens are kept in **SecureStore** (`user_accessToken`, `user_refreshToken`); the user object is kept in AsyncStorage.
- **Restart rule.** A session counts as logged in when there is an unexpired USER access token or an unexpired refresh token (the web rule).
- **Refresh.** One refresh at a time on 401, then the request is retried. There is no refresh on 429, and a 403 does not log the user out. A failed refresh clears the session.
- **Logout.** `POST /food/auth/logout {refreshToken, fcmToken, platform:"mobile"}`, then every context clears its per-user state.
- **Code.** `src/api/client.js`, `src/context/AuthContext.js`.

## Design tokens

All tokens are in `src/theme/tokens.js` and the shared primitives are in `src/components/ui/`.

- **Colors (light):** page `#F9F9FB`, cards white, primary from `/app-config`.
- **Colors (dark):** page `#0A0A0A`, cards `#1A1A1A`, primary `#F76208` unless the admin overrides it.
- **Fonts:** Poppins 300–900 and Inter 400–700, bundled.
- **Spacing:** 4px grid with a 16px gutter. Radius: 6, 8, 10, 12, 16, 24 or full.
- **Shadows:** Tailwind's shadow scale, as RN `boxShadow`.
- **Icons:** `lucide-react-native`, with the same names as the web. The brand icons (Facebook, Instagram, Twitter) and `FaLocationDot` are drawn from the web's own SVG paths.

## Native capabilities

There is no Flutter wrapper, so this list comes from what the web app uses.

| Capability | Native | Status |
|---|---|---|
| Push notifications | expo-notifications with a native FCM token, sent to `/fcm-tokens/device/save` (no backend change). Uses channel `default` with sound `zomato_sms`. Tapping a notification goes to its web link, mapped to the native route. | Built, not tested (`google-services.json` added; needs a device test) |
| In-app order and OTP toasts (socket) | socket.io → toasts with the web's text and timings | Built, not tested |
| Location | expo-location, foreground only. Zone detection uses the backend. | Verified: the emulator GPS resolved Indore and the zone is in service |
| Camera and gallery (avatar) | expo-image-picker | Built, not tested |
| Maps (tracking, address pin) | react-native-maps with `PROVIDER_GOOGLE` | Built, not tested (address list verified; map not exercised) |
| Payments | `react-native-razorpay` 3 (native SDK, New Architecture) | Built, not tested (production uses a test key) |
| Share, clipboard, `tel:`, `mailto:` | RN `Share`, `Linking`, expo-clipboard | Built, not tested |
| Voice search | expo-speech-recognition | Built, not tested |
| Invoice PDF | expo-print plus expo-sharing | Built, not tested |
| Sounds and haptics | expo-audio, expo-haptics | Built, not tested |
| Splash and app icon | expo-splash-screen and adaptive icon from `logo.png` | Verified: the app launches |
| Android back button | `src/navigation/back.js`: the web's fixed-parent rules, history back elsewhere | Built, not tested |
| Deep links | `cityfood://` scheme | Verified: all screens were opened by deep link on the emulator |

## Screens

Native paths are the web paths without the `/food/user` prefix. PR means login is required.

| # | Web route | Web component | Guard | Native route | Status |
|---|---|---|---|---|---|
| 1 | `/food/user` | `Home.jsx` | public | `/` (tab) | Verified (emulator: hero, sticky search and categories, filters, explore, meals under, restaurant list) |
| 2 | `dining` | `Dining.jsx` | public | `/dining` | Built, not tested (the test zone has no dining data) |
| 3 | `dining/:category` | `DiningCategory.jsx` | public | `/dining/[category]` | Built, not tested |
| 4 | `dining/:diningType/:slug` | `DiningRestaurantDetails.jsx` | public | `/dining/[diningType]/[slug]` | Built, not tested |
| 5 | `dining/book/:slug` | `TableBooking.jsx` | public | `/dining/book/[slug]` | Built, not tested |
| 6 | `dining/book-confirmation` | `TableBookingConfirmation.jsx` | public | `/dining/book-confirmation` | Built, not tested |
| 7 | `dining/book-success` | `TableBookingSuccess.jsx` | public | `/dining/book-success` | Built, not tested |
| 8 | `dining/edit-user` | `TableEditUserPage.jsx` | public | `/dining/edit-user` | Built, not tested |
| 9 | `bookings`, `profile/dining-bookings` | `MyBookings.jsx` | PR | `/bookings`, `/profile/dining-bookings` | Built, not tested |
| 10 | `under-250` | `Under250.jsx` | public | `/under-250` (tab) | Verified (emulator) |
| 11 | `categories` | `Categories.jsx` | public | `/categories` | Built, not tested |
| 12 | `category/:category` | `CategoryPage.jsx` | public | `/category/[category]` | Built, not tested |
| 13 | `restaurants` | `Restaurants.jsx` | public | `/restaurants` | Built, not tested |
| 14 | `restaurants/:slug` | `RestaurantDetails.jsx` | public | `/restaurants/[slug]` | Verified (emulator, after fixing a crash) |
| 15 | `search` | `ProfessionalSearch.jsx` | public | `/search` | Built, not tested |
| 16 | `cart` | `Cart.jsx` (the real checkout) | public | `/cart` | Verified: empty state. The full checkout is Built, not tested. |
| 17 | `address-selector` | `AddressSelectorPage.jsx` | public | `/address-selector` | Verified: saved address list. The map and form are Built, not tested. |
| 18 | `orders` | `Orders.jsx` | PR | `/orders` (tab) | Verified: empty state against live data (see the data note under Backend) |
| 19 | `orders/:orderId` | `OrderTracking.jsx` | PR | `/orders/[orderId]` | Verified: "Order Not Found" state. Live tracking is Built, not tested. |
| 20 | `orders/:orderId/invoice` | `OrderInvoice.jsx` | PR | `/orders/[orderId]/invoice` | Built, not tested |
| 21 | `orders/:orderId/details` | `UserOrderDetails.jsx` | PR | `/orders/[orderId]/details` | Built, not tested |
| 22 | `offers` | `Offers.jsx` | public | `/offers` | Built, not tested |
| 23 | `gourmet` | `Gourmet.jsx` | public | `/gourmet` | Built, not tested |
| 24 | `collections` | `Collections.jsx` | public | `/collections` | Built, not tested |
| 25 | `collections/:id` | `CollectionDetail.jsx` | public | `/collections/[id]` | Built, not tested |
| 26 | `profile` | `Profile.jsx` | PR | `/profile` (tab) | Verified (emulator) |
| 27 | `profile/edit` | `EditProfile.jsx` | PR | `/profile/edit` | Built, not tested |
| 28 | `profile/favorites` | `Favorites.jsx` | PR | `/profile/favorites` | Built, not tested |
| 29 | `profile/support` | `Support.jsx` | PR | `/profile/support` | Built, not tested |
| 30 | `profile/coupons` | `Coupons.jsx` | PR | `/profile/coupons` | Built, not tested |
| 31 | `profile/about` | `About.jsx` | PR | `/profile/about` | Built, not tested |
| 32 | `profile/report-safety-emergency` | `ReportSafetyEmergency.jsx` | PR | `/profile/report-safety-emergency` | Built, not tested |
| 33 | `profile/refer-earn` | `ReferEarn.jsx` | PR | `/profile/refer-earn` | Built, not tested |
| 34–38 | `profile/{terms,privacy,refund,shipping,cancellation}` | Legal pages (CMS HTML) | public | `/profile/...` | Built, not tested |
| 39 | `help` | `Help.jsx` | public | `/help` | Built, not tested |
| 40 | `notifications` | `Notifications.jsx` | PR | `/notifications` | Verified: empty inbox |
| 41 | `wallet` | `Wallet.jsx` + `AddMoneyModal` | PR | `/wallet` | Verified: balance and empty history. Top-up is Built, not tested. |
| 42 | `complaints/submit/:orderId` | `SubmitComplaint.jsx` | PR | `/complaints/submit/[orderId]` | Built, not tested |
| 43 | `/user/auth/login` | `Login.jsx` | public | `/login` | Verified: phone → OTP → verify → Home with the test account |
| 44 | `/user/auth/support` | `PublicSupport.jsx` | public | `/support` | Built, not tested |
| 45 | (overlay) | `AppIntroSplash.jsx` | n/a | root layout | Built, not tested (the server currently returns no intro ads) |
| 46 | (overlay) | `SearchOverlay.jsx` | n/a | root layout | Built, not tested |
| 47 | (guard) | `LocationGuard.jsx` and the out-of-zone screen | n/a | root layout | Built, not tested (the test location is in zone) |
| 48 | (shell) | `BottomNavigation.jsx` | n/a | `(tabs)/_layout.js` | Verified (emulator) |

### Left out (please confirm)

| Screen | Reason |
|---|---|
| `/` `MasterLandingPage.jsx` | Marketing website page |
| `auth/SignIn.jsx`, `auth/Portal.jsx` | Not routed |
| `auth/OTP.jsx` | Crashes on render (`loginBanner` undefined). The real OTP flow is in `Login.jsx`. |
| `auth/AuthCallback.jsx` | OAuth stub; there is no Google sign-in |
| `cart/Checkout.jsx`, `cart/SelectAddress.jsx` | Orphaned mock checkout that crashes on render |
| `profile/Payments.jsx`, `AddPayment.jsx`, `EditPayment.jsx` | Reachable only from the dead Checkout; stored card numbers and CVV |
| `DiningExplore50.jsx`, `DiningExploreNear.jsx`, `Coffee.jsx`, `ProductDetail.jsx` | Orphaned, mock data |
| `TableModificationPolicy.jsx`, `TableCancellationPolicy.jsx` | Not linked anywhere |
| `help/OrderHelp.jsx` | Not linked; local data only |
| `profile/Logout.jsx`, `profile/Accessibility.jsx` | Not linked (logout is on Profile itself) |
| Web-imported but never rendered: `PromoRow`, `AdsBannerCarousel`, `QuickSection`, the "All Categories" modal, the PageNavbar on Under250 | Never shown on the web |
| Desktop navbar and footer | Desktop only |
| Restaurant (46), Delivery (34) and Admin (146) routes | Other apps |

## API checks (live, as the test account)

**46/46 passed: Verified.**

- **Reads:** every GET the app uses, covering auth/me, addresses, location, wallet, referrals, orders, notifications, tickets, safety reports, bookings, zones, reverse geocode, restaurants, menu, outlet timings, addons, offers, categories, foods, search, promocodes, landing, explore icons, hero, gourmet, under-250 banners, intro ads, CMS pages, business settings, app-config, dining and rider availability.
- **Stateless writes:** refresh token, order bill calculation, promo validation.
- **Writes on the test account's own data:** an address was added, edited and deleted; the account's original address is untouched.
- **Wallet top-up order:** created to check the key mode (test). No payment was made.

**Not exercised** (they would reach real restaurants, riders or support staff): placing an order, cancelling, rating, delivery instructions, support tickets, safety reports, dining bookings and reviews. These are **Built, not tested** and should be checked on a device. Payments can use Razorpay test cards, because production uses a test key.

## Native replacements and dependencies added

| Web | Native | Package |
|---|---|---|
| react-router | Expo Router (file routes, tabs) | expo-router |
| localStorage / sessionStorage | SecureStore for tokens, AsyncStorage for the rest | expo-secure-store, @react-native-async-storage/async-storage |
| Tailwind / shadcn | StyleSheet plus one theme file and shared primitives | — |
| Google Fonts | Bundled fonts | @expo-google-fonts/poppins, @expo-google-fonts/inter |
| lucide-react | Same icon set | lucide-react-native, react-native-svg |
| OptimizedImage | `AppImage` (expo-image, same Cloudinary / wsrv.nl sizing) | expo-image |
| @react-google-maps/api | Native Google map | react-native-maps |
| navigator.geolocation | Foreground location | expo-location |
| socket.io-client | Same library | socket.io-client |
| axios | Same library, single client | axios |
| Web push / FCM | Native FCM | expo-notifications |
| Razorpay checkout.js | Razorpay native SDK | react-native-razorpay |
| `<input type=file>` | Camera and gallery picker | expo-image-picker |
| jsPDF + html2canvas | Print to PDF and the share sheet | expo-print, expo-sharing |
| navigator.clipboard | Clipboard | expo-clipboard |
| Audio / vibrate | Audio and haptics | expo-audio, expo-haptics |
| `<video>` (intro ads, fest hero) | Native video | expo-video |
| MUI DatePicker | Native date picker | @react-native-community/datetimepicker |
| Web Speech API | Speech recognition | expo-speech-recognition |
| CMS HTML | HTML renderer (pure JS; excluded from expo-doctor's directory check) | react-native-render-html |
| CSS gradients | Linear gradient | expo-linear-gradient |
| sonner, Radix dialogs, canvas-confetti, framer-motion | In-house `toast`, `BottomSheet` / `Dialog`, `Confetti`, Animated / reanimated | react-native-reanimated (also an Expo Router peer) |
| dayjs | Same library | dayjs |

## Deviations from the web

All of these were deliberate; please review.

### Web bugs fixed (the web crashes or misbehaves)

- **Restaurant page:** sharing a recommended dish crashed (`handleSystemShare` is undefined). It now opens the share sheet.
- **Categories and Search:** these pages called the non-existent `adminAPI.getPublicCategories`, so they always showed "No results" or an empty trending list. They now use `/food/search/categories/admin`.
- **First-order-only coupons:** these never worked, because `userAPI.getOrders` doesn't exist and the order count was always 0. They now count the user's orders.
- **Search overlay:** it referenced an undefined `autoStartVoice`, which crashes, and a non-existent `getPublicDishes`. The native version drops the auto-start and uses `getPublicFoods`.
- **Order invoice:** it crashed on API orders (`order.subtotal.toFixed`). It now reads the API's shape.
- **Name prompt:** an existing account with no name could never log in on web, because the second verify fails once the OTP has been used. In the app the name is saved through the profile API instead.
- **GPS fallback:** the web crashed on an undefined variable when falling back to the stored location. The intended fallback is ported.
- **Broken characters:** garbled text on web ("ðŸŽ‰", "â€¢", "�") now shows as 🎉, • and ©.
- **Under ₹250 / restaurant page:** a failed add-to-cart (restaurant mismatch) left a phantom quantity of 1. Quantities now come from the cart.
- **Edit-profile draft:** the draft is now cleared on logout, as the web's `clearModuleAuth` intends.

### Platform adaptations

- **OTP boxes:** fast typing and autofilled codes spread across the boxes. Android moves focus asynchronously, so digits were being lost.
- **Text and pickers:** web `<select>` and `<datalist>` controls became native dialogs and lists. `window.confirm` and `alert` became `Alert.alert`.
- **Files and sharing:** PDFs are generated and opened in the share sheet instead of downloaded. Share links use `https://cityfood.co.in/...`.
- **Visual effects:** hover and shine effects and CSS blur were dropped or approximated. CSS `grayscale` on closed restaurants keeps only the opacity change.
- **Home layout:**
  - The sticky search and category bar is an overlay, because a FlatList header can't hold a sticky part.
  - The FILTERS bar isn't sticky. On the web it is, but it's always covered by the sticky search and category bar.
- **Orders list:** the full-screen spinner only shows on the first load. The web showed it on every 60 s poll.
- **Dialogs:** backdrops are 50% black instead of the web's 40%. Logout and delete-account dialogs close when you tap outside them.
- **Tracking ETA:** before the rider has a route, the ETA comes from the Google Directions REST API. If the Maps key is restricted to Android apps only, the baseline route and ETA won't appear; the map and markers still do.

### Kept as on the web (flag if you want them changed)

- **Login:** always lands on Home, even when you were sent there from another screen.
- **Address selector:** back always goes Home, even when opened from Cart. "Add New" sends you to login without a return path.
- **Cart:** back and "Add more items" push a new restaurant screen instead of returning to the existing one.
- **Restaurant mismatch:** shows only a toast; there is no "replace cart" dialog.
- **Ratings:** unrated orders are treated as rated (`Number(null)` is finite), so the auto rating prompt never appears.
- **Help page:** shows placeholder phone, email and `$` amounts.
- **Dark mode:** a few dark-mode color slips are kept: the Help contact cards, the Coupons empty title, and the switch-off popup.
- **Dining:** the price filter and mic do nothing, the distance label is blank, and edits on the edit-user page are lost.
- **Dining confirmation with no user:** falls back to the **hard-coded name "Shailu" and phone "8090512291"**. That looks like a real person's contact; consider removing it from both web and app.

## Blocked

| Item | Why | What's needed |
|---|---|---|
| 8 images | Corrupted in git and on the live site (LF→CRLF on binary files) and not repairable: `bikelogo.png`, `collectionspagebanner.png`, `explore more icons/{collection,gourmet,offers,top 10}.png`, `fssai.png`, `offerimage.png` | The original files. Put them in `mobile-user/assets/images/` at the same paths; they will also fix the website. 23 other corrupted images were repaired and checked with CRC. The app keeps an empty frame of the same size where these appear, as the web does today. |
| Store-ready signed APK (EAS) | Expo isn't logged in. The local release APK (see Release build below) is signed with the Android debug key, so it can be installed but not published. | `cd mobile-user && npx eas-cli login`, then `npx eas-cli build --platform android --profile production`. EAS creates and keeps the upload keystore. |

## Backend

**No backend changes were made.**

### Security issues found (not fixed)

- **OTP login is wide open.** `requestUserOtp` (`core/auth/auth.service.js:104`) returns the OTP in the response when `NODE_ENV !== "production"` or `USE_DEFAULT_OTP=true`, and the live server does this. With `USE_DEFAULT_OTP=true`, every phone gets `123456`, so anyone can log in as any customer. Set `NODE_ENV=production` and `USE_DEFAULT_OTP=false` on the server.
- **Other issues:**
  - Restaurant detail and search responses expose bank, PAN and GST details and owner contacts.
  - Any logged-in user can join another order's socket room and see its delivery OTP and live location.
  - Create-order trusts the total the client sends.
  - The FCM test routes and the banner/landing editing need no authentication.
  - The OTP bypass phone numbers are hard-coded in the source.
- **Secret in the frontend env.** `FIREBASE_SERVICE_ACCOUNT` is in `Frontend/.env`. It isn't bundled, but it belongs on the backend only; rotate it if it was ever shared.

### Data note

Between 12:20 and 13:15 on 2026-10-19, all 3 orders of the test account (including `FOD-5530421`) disappeared from the live database. The account itself is unchanged. Nothing in this conversion deletes orders; the most likely cause is someone cleaning test data. The app correctly shows the empty and "not found" states.

## Checks run

| Check | Result |
|---|---|
| ESLint (`npx eslint src`) | 0 errors. The warnings are `react-hooks/set-state-in-effect` on fetch-on-mount effects, which is set to warn on purpose. |
| `npx expo-doctor` | 20/20 passed |
| Expo config resolves (`npx expo config`) | Yes |
| Android JS bundle (`npx expo export --platform android`) | Builds (9.2 MB Hermes bytecode) |
| Static import check (every named and default import resolves) | 0 problems |
| Local native build (`./gradlew assembleDebug`, x86_64) | BUILD SUCCESSFUL |
| Live API checks | 46/46 passed |
| Emulator walkthrough | Login, Home, Under ₹250, restaurant page, Profile, Orders, Wallet, Notifications, address selector and Cart ran and matched the web references. One crash and three UI bugs were found and fixed. |
| Performance review | No timers or listeners without cleanup. Long lists use FlatList or SectionList (Home is one virtualized list). Images use width-matched variants. Unused packages were removed (netinfo, expo-device, webview). |

## Release build

`releases/CityFood-user-v1.0.0-release.apk` (project root, gitignored), built locally on 2026-10-19:

| Property | Value |
|---|---|
| Package / version | `com.cityfood.user`, 1.0.0 (versionCode 1) |
| CPU architecture | `arm64-v8a` (all phones from roughly the last 7 years) |
| Size | 50.7 MB |
| JS bundle | Embedded, so no Metro server is needed |
| Firebase | `google-services.json` included |
| Signature | Android **debug** certificate. Installable for testing, not for Play Store upload. |

It was built with low-memory Gradle settings, because this machine has 7 GB of RAM:

```
cd mobile-user && CI=1 npx expo prebuild --platform android --clean --no-install
cd android && NODE_OPTIONS=--max-old-space-size=1536 ./gradlew assembleRelease --no-daemon --max-workers=1 \
  "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m" -Porg.gradle.parallel=false \
  -Pkotlin.compiler.execution.strategy=in-process -PreactNativeArchitectures=arm64-v8a
```

The release build needed a fix: 21 web images were JPEGs named `.png`, which Android's resource compiler rejects. They were converted to real PNGs.

## Device test list

Walk through these in order on a real Android phone, using the APK from the EAS build. Log in with phone 9755633147 and OTP 123456.

1. **Install and launch.** The splash shows the logo on white, then Home. Allow the location prompt. The address row shows your area; the zone should be in service in the Indore test zone.
2. **Home.** Scroll the whole page: the sticky search and categories bar, the FILTERS sheet (apply and clear), Veg Mode on and off (with its popup and overlays), and a hero banner tap.
3. **Search.** Type a dish, then tap the mic and allow the microphone for voice search. Open a result.
4. **Restaurant page.** Menu sections, the MENU sheet jump, Veg/Non-veg chips and in-menu search. Try "Add" while logged out: it should go to login.
5. **Login.**
   - Phone → Send OTP → 6-digit code. Try pasting or autofilling the code too.
   - Check the resend timer and "Change Number".
   - Android back on the OTP step returns to the phone step.
6. **Cart and checkout.**
   - Add items and change quantities, then try a coupon.
   - Check delivery time scheduling, address change, recipient details and the bill.
   - Pay with Razorpay using a **test card**, then try cash on delivery. Only do this if you accept that a real test restaurant receives the order.
   - Expect the order-placed sound, confetti and the "Track Your Order" button.
7. **Order tracking.** Status updates arriving live (socket), the map with rider, restaurant and customer pins and the route, the delivery OTP card, and the call buttons. Cancel within the countdown if needed.
8. **Orders tab.** Today and History lists, search, the ⋮ menu (share, details), reorder, and invoice → PDF share sheet.
9. **Address selector.**
   - The map with the center pin: move it and watch the address update.
   - Search, "Use Current Location", add, edit and delete an address, and set the default.
10. **Profile.**
    - Edit the profile: avatar from camera and from gallery, the date pickers, and gender.
    - Appearance Light/Dark: open each screen again in dark mode.
    - Veg mode, Refer & Earn (share sheet, copy), Coupons (copy), Favorites, About, Support tickets, Report safety, and the legal pages.
11. **Wallet.** Add money with a Razorpay test card, then check the history.
12. **Under ₹250 and Dining tabs.** Filters, item sheets, and the booking flow if a dining restaurant exists in your zone.
13. **Android back button.** From every screen, back should go where the web's back arrow goes. Back on a tab returns to Home, and back on Home exits the app. Back closes open sheets first.
14. **Session.**
    - Kill the app and reopen it: you should still be logged in.
    - Log out: you land on login, and the cart, profile and favorites are cleared.
    - For session expiry, delete the account's refresh token on the server or wait out its expiry: the next request should send you to login.
15. **No network.** Turn on airplane mode on Home, Cart and Orders. Expect the web's error toasts ("Unable to connect…") and no crash. Turn the network back on and retry.
16. **Uploads and downloads.** Avatar upload works. The invoice PDF opens the share sheet and saves.
17. **Push notifications.** Allow notifications after login, place an order, and check that status pushes arrive with the CityFood sound and that tapping one opens the order.
18. **Maps key.** If maps show blank tiles on the EAS build, add the build's SHA-1 (from `npx eas-cli credentials`) to the Maps key restrictions in Google Cloud.
