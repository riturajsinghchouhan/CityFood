# CityFood Frontend: design and platform audit for the Expo port (customer app)

Scope: `/home/ak/Public/projects/CityFood/Frontend` (Vite 7 + React 19 + Tailwind CSS v4), customer-facing code only:
`src/modules/Food/pages/user/**`, `src/modules/Food/components/user/**`, `src/modules/auth/**`, plus the shared code they import (`src/modules/Food/{components/ui,hooks,utils,context}`, `src/shared/**`, `src/services/api`).
That is 94 JS/JSX files and about 48.7k lines. The largest are RestaurantDetails (4261 lines), Cart (4014), Home (3688), OrderTracking (2510), Under250 (2024), CategoryPage (2013), Dining (1525), Profile (1420), Orders (1376), PageNavbar (1127) and AddressSelectorPage (1044).

This was a read-only audit. No repo files were modified, and no secret values were read out of `.env`.

---

## 0. Critical findings to read first

1. **85 of the raster images under `src/modules/Food/assets/` are corrupted in git.** Every `\r` and `\n` byte in them was rewritten to `\r\n`, so the PNG signature is now `89 50 4E 47 0D 0A 1A 0D 0A`. PIL cannot open any of them, and the corruption is already present in the committed blobs (initial commit `14202bd`), so it is not a local checkout problem. The damage cannot be undone reliably. Get clean originals from the designer or source, or use the alternatives listed below. **Metro/Expo will fail on these files, or they will render blank.**
   Files used by the customer app that are affected:
   - `src/modules/Food/assets/offerimage.png` (Home, Under250)
   - `src/modules/Food/assets/explore more icons/{offers,gourmet,top 10,collection}.png` (Home "Explore more")
   - `src/modules/Food/assets/category-icons/{food,quick,taxi,hotel}.png` (HomeHeader service switcher). **Alternative:** `public/super-app/{food,grocery,taxi,hotel}.png` are valid 640x640 JPEGs (with a `.png` extension) covering the same subjects.
   - `src/modules/Food/assets/bikelogo.png` (rider marker in DeliveryTrackingMap). **Alternative:** `public/MapRider.png`, a valid 408x612 RGBA image that is already used in the same map.
   - `src/modules/Food/assets/fssai.png` (RestaurantDetails)
   - `src/modules/Food/assets/collectionspagebanner.png` (Collections)
   - Also corrupt but not used by user screens: `quicky-spicy-logo.png`, `quick-favicon.png`, `appzetologo.png`, `loginbanner.png`, `deliveryloginbanner.png`, `groumetpagebanner.png`, `top10pagebanner.png`, `offerpagebanner.png`, `referralbonuscardbg.png`, `tiptransfericon.png`, `circleicon.png`, `menu-items/*`, `restaurant/*`, `hub/**`, `Dashboard-icons/*`, `Transaction-report-icons/*`.
   - Valid images (checked with PIL): `logo.png`, `gourmet_new_banner.png`, `chef-mascot.png`, `out-of-zone-bg.png`, `category-icons/{combo,price,veg,discount}_promo.png`, `offerpagebanner.svg`, and everything under `public/` and `src/assets/`.
2. **The brand color does not match the logo.** The CSS primary is plum `#7e3866`, while the logo is green, red and orange. The admin panel can also override primary, secondary, font and logo at runtime through `GET /app-config/user_app` (see 1.6). The RN theme should therefore be built from tokens that are fetched at runtime and fall back to static defaults.
3. **The dark-mode default is inconsistent.** `src/index.jsx` reads the localStorage key `appTheme` and defaults the user app to dark. `ThemeContext` reads `userAppTheme`, defaults to light, and wins once it mounts. In practice users get light mode, with a Light/Dark toggle in Profile.
4. **`FIREBASE_SERVICE_ACCOUNT` is in `Frontend/.env`.** It is a server credential and must not ship in the app (see section 6).
5. **The web app already includes native-shell hooks.** `index.jsx`, `firebaseMessaging.js`, `auth/pages/Login.jsx` and `imageUploadUtils.js` check for `window.flutter_inappwebview` or `window.ReactNativeWebView`, and `native_last_route` is stored. These show where the native app is expected to provide FCM tokens and the camera or file picker.

---

## 1. Design tokens

### 1.1 Tailwind setup
- **Tailwind v4 with no `tailwind.config.js`.** It is configured CSS-first in `src/shared/styles/global.css` via `@import "tailwindcss"`, `@import "tw-animate-css"`, `@theme inline { ... }`, and `@custom-variant dark (&:is(.dark *))`. It is loaded through the `@tailwindcss/vite` plugin in `vite.config.js`.
- **shadcn/ui-style token naming** (background, foreground, card, primary, and so on) with CVA components in `src/modules/Food/components/ui/*.tsx`.
- **Other CSS files.** `components/user/DeliveryTrackingMap.css` is customer-related. `restaurantTheme.css` and `deliveryTheme.css` belong to other apps and can be ignored.
- **Path aliases** (in `vite.config.js` and `jsconfig.json`):
  - `@` maps to `src`
  - `@food` maps to `src/modules/Food`
  - `@food/api` maps to `src/services/api`
  - `@delivery` maps to `src/modules/DeliveryV2`

### 1.2 CSS variables (`:root`, light theme)

| Token | Hex | Notes |
|---|---|---|
| `--background` / `--color-page-bg` | `#F9F9FB` | page background |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--sidebar-foreground` | `#3c0f3d` | very dark plum text |
| `--card`, `--popover`, `--sidebar` | `#ffffff` | |
| **`--primary`** / `--color-primary-orange` (legacy name) / `--ring` | **`#7e3866`** | brand plum |
| `--primary-foreground` | `#ffffff` | |
| `--secondary` / `--sidebar-accent` | `#55254b` | deep plum |
| `--accent` / `--muted-foreground` | `#b18da5` | dusty mauve |
| `--muted` | `#f1f5f9` | slate-100 |
| `--destructive` | `#ef4444` | red-500 |
| `--border`, `--input` | `#e2e8f0` | slate-200 |
| `--radius` | `0.625rem` (10px) | sm=6, md=8, lg=10, xl=14px |

Dark theme (`.user-app.dark`). `user-app` is added to `<html>` for the customer app.

| Token | Hex |
|---|---|
| `--background` | `#0A0A0A` |
| `--card`, `--popover`, `--sidebar` | `#141414` |
| `--foreground` | `#F3F4F6` |
| **`--primary`** / `--ring` | **`#F76208`** (orange in dark mode, not plum) |
| `--secondary` | `#000000` |
| `--muted`, `--accent` | `#1f2937` |
| `--muted-foreground` | `#9ca3af` |
| `--border`, `--input` | `#27272A` |

### 1.3 Hard-coded hex values in user code (top occurrences)
- **Dark-mode surfaces:** `#1A1A1A` (209, mostly `dark:bg-[#1a1a1a]`), `#0A0A0A` (116), `#2A2A2A` (19), `#121212` (18), `#141414`, `#111`.
- **Light surfaces:** `#F9F9FB` (34), `#F5F5F5` (16), `#FDFAFC` (7, plum-tinted white), `#F8F9FA`, `#F6F7FB`.
- **Brand variants:** `#55254B` (12), `#B18DA5` (9), `#A05485` (6), `#7E3866` (6, also as `#7e386610` and `#7e386605` alpha tints), `#3C0F3D` (5). The active bottom-nav pill uses `#FFEEF2`.
- **Reds** (offers, "closed" and error states): `#DC2626` (15), `#E52E2E` (12), `#CB202D` (12), `#D92323`, `#EF4F5F`, `#EF8F98`.
- **Greens** (veg marker, success, ratings): `#0A4D27` (8), `#22C55E` (8), `#166534` (6).
- **Other:** `#23180F` (11, dark brown text), `#FFF200` (6, yellow highlight), `#2D3748`, `#6B7280`, `#111827`.
- **Intro CTA:** gradient `from-orange-500 to-amber-500` in `AppIntroSplash.jsx`.

### 1.4 Most-used Tailwind color classes in user code
Counts exclude `dark:` variants.

| Class | Count | Class | Count |
|---|---|---|---|
| bg-white | 432 | text-gray-900 | 332 |
| text-primary | 318 | text-white | 292 |
| text-gray-500 | 261 | text-gray-700 | 210 |
| text-gray-600 | 208 | border-gray-200 | 207 |
| text-gray-400 | 172 | border-primary | 133 |
| bg-gray-50 | 130 | bg-gray-100 | 129 |
| bg-primary | 112 | text-gray-800 | 111 |
| text-muted | 92 | bg-gray-800 | 86 |
| border-gray-100 | 83 | text-green-600 | 69 |
| text-red-500 | 65 | border-gray-300 | 54 |
| bg-gray-200 | 48 | border-green-500 | 47 |
| bg-green-50 | 45 | bg-green-600 | 44 |
| bg-secondary | 40 | text-black | 40 |
| bg-black/40, /50 (overlays) | 23 / 15 | bg-primary/10, /5, /20 | 16 / 14 / dark 24 |
| bg-orange-50/100 | 18 / 23 | text-yellow-400 (stars) | 15 |
| text-blue-600 | 17 | slate-100/400/500/900 | 20–38 each |

**Dark mode:** there are 2761 `dark:` usages across 67 of the 94 files. The most common are:
- `dark:text-white` (300)
- `dark:text-gray-400` (287)
- `dark:border-gray-800` (236)
- `dark:bg-[#1a1a1a]` (203)
- `dark:text-gray-300` (190)
- `dark:border-gray-700` (97)
- `dark:bg-gray-800` (85)
- `dark:bg-[#0a0a0a]` (84)

**Suggested RN palette:** primary `#7e3866`, primaryDark `#55254b`, accent `#b18da5`, page `#F9F9FB`, card `#fff`, text `#111827` / `gray-900`, textSecondary `gray-500` / `600`, border `gray-200` `#e5e7eb`, success `green-600` `#16a34a`, danger `red-500` / `600`, star `yellow-400` `#facc15`. Dark mode: bg `#0A0A0A`, card `#1A1A1A`, border `gray-800` `#1f2937`, primary `#F76208`. NativeWind v4 would keep most class names the same, which is the lowest-friction port.

### 1.5 Fonts
- **Loaded with Google Fonts `<link>` tags in `index.html`.** There are two separate links:
  - `Inter` 400/500/600/700 and `Outfit` 400–900
  - `Poppins` 300/400/500/600/700/800 and `Outfit` 300–800
- **The disabled SplashScreen `@import`s** Outfit 900. There is no `@font-face` and no font files in the repo.
- **Base font** is set on `:root` as `font-family: var(--main-font-family, 'Poppins', system-ui, ...)`. In practice the app font is **Poppins**, and `--font-outfit` is available for display text.
- `--main-font-family` can be overridden at runtime from `/app-config/user_app` `fontFamily` (`src/modules/Food/utils/themeSettings.js`).
- **Explicit families in user code are rare:** `font-sans` 7, `font-mono` 3, `font-['Poppins','Nunito Sans']` 2, `font-['Inter']` 1, `font-serif` 1.
- **Weights used:**

  | Class | Count |
  |---|---|
  | `font-bold` | 443 |
  | `font-medium` | 378 |
  | `font-semibold` | 333 |
  | `font-black` | 124 |
  | `font-extrabold` | 21 |
  | `font-normal` | 12 |

  So Poppins needs 400, 500, 600, 700, 800 and 900. Poppins 900 is not currently loaded on web; the browser falls back to synthesized bold.
- **Expo:** use `@expo-google-fonts/poppins` (`Poppins_400Regular` through `Poppins_900Black`), with `@expo-google-fonts/outfit` as optional. RN needs one font family per weight, so map `fontWeight` to the matching family name.

### 1.6 Runtime theming (must carry over)
- `applyDynamicTheme()` in `src/modules/Food/utils/themeSettings.js` calls `GET /app-config/user_app` and sets `--primary`, `--secondary` and `--main-font-family`. It also stores `logoUrl` in localStorage as `user_app_logo`.
- `loadBusinessSettings()` in `src/modules/Food/utils/businessSettings.js` loads the company name, `userLogo`/`logo`, the favicon, and so on. It is cached for 6 hours under the `food:v1` scoped key `settings/business`.
- Hooks: `useAppLogo('user_app')` in `hooks/useAppLogo.js` and `useCompanyName`.

### 1.7 Typography sizes (counts in user code)

| Class | Count | Size |
|---|---|---|
| `text-sm` | 631 | 14px |
| `text-xs` | 352 | 12px |
| `text-base` | 261 | 16px |
| `text-lg` | 200 | 18px |
| `text-xl` | 138 | 20px |
| `text-2xl` | 89 | 24px |
| `text-3xl` | 47 | 30px |
| `text-4xl` and larger | 28 | |

Arbitrary sizes such as `text-[10px]` (bottom-nav labels) and `text-[11px]` are common. Body text is 14px and captions are 12px.

### 1.8 Radius, shadows, spacing, effects
- **Radius:**

  | Class | Count |
  |---|---|
  | `rounded-full` | 460 (pills, chips, avatars, icon buttons) |
  | `rounded-xl` | 259 (12px) |
  | `rounded-lg` | 165 (8px) |
  | `rounded-2xl` | 142 (16px) |
  | `rounded` | 120 |
  | `rounded-3xl` | 29 |
  | `rounded-t-3xl` | 26 (bottom sheets) |

  The bottom-nav tab pill uses `rounded-[1.5rem]`. The shadcn Card is `rounded-xl border py-6 shadow-sm`.
- **Shadows:**

  | Class | Count |
  |---|---|
  | `shadow-sm` | 186 |
  | `shadow` | 110 |
  | `shadow-lg` | 73 |
  | `shadow-2xl` | 56 |
  | `shadow-md` | 44 |
  | `shadow-xl` | 34 |

  The bottom nav uses `shadow-[0_-4px_20px_rgba(0,0,0,0.08)]`. In RN, shadows need `elevation` on Android and `shadow*` props on iOS (or `boxShadow` on New Architecture with RN 0.76+).
- **Spacing:** a 4px grid.

  | Class | Count |
  |---|---|
  | `gap-2` | 302 |
  | `px-4` | 298 |
  | `gap-3` | 272 |
  | `p-4` | 236 |
  | `gap-4` | 175 |
  | `mb-4` | 168 |
  | `px-3` | 140 |
  | `py-3` | 113 |
  | `px-6` | 108 |
  | `p-6` | 87 |

  The standard screen gutter is 16px (`px-4`). Icon sizes are mostly `h-5 w-5` (20px) and `h-4 w-4` (16px). Controls are `h-10` / `h-12` (40 / 48px).
- **Glass and overlays:** `backdrop-blur-sm/md/xl` (about 96 uses) and `bg-black/40`. In Expo use `expo-blur` `BlurView`.
- **Layout:** 50 `fixed inset-*` overlays/modals, 29 `sticky top-0` headers, and `env(safe-area-inset-*)` padding. In Expo use `react-native-safe-area-context`.
- **Custom CSS animations** in `global.css`: fade-in, fade-in-up, slide-in-left, fade-down, shimmer (skeletons), explore-shine, and `animate-scroll` (marquee). `AnimatedPage` provides a 220ms fade plus 20px translate-up page entrance.

### 1.9 Dark mode
Dark mode exists. It is class-based (`.dark` on `<html>`) and toggled from **Profile, Appearance (Light/Dark)** through `useTheme()` in `src/modules/Food/context/ThemeContext.jsx`. The setting is persisted in localStorage `userAppTheme`; there is also a legacy `appTheme` key read in `index.jsx`. There is no "system" option. Expo equivalent: `useColorScheme()` / NativeWind `colorScheme.set()`, persisted with AsyncStorage.

---

## 2. Assets

### 2.1 App logo, icon and splash candidates

| File | Size | Notes |
|---|---|---|
| `Frontend/src/assets/logo.png` | **640x640** PNG RGB (no alpha), 544 KB | Highest-resolution logo. Round illustrated badge: "City Food" wordmark (white "City", red "Food"), rider on a red scooter, food items, green ring, tagline "Good Food · Fast Delivery · Better Tomorrow", on a white background. |
| `Frontend/public/logo.png` | 512x512 PNG RGB, 368 KB | Same artwork, byte-identical to `src/modules/Food/assets/logo.png`. Used in `manifest.json` (192 and 512 entries), as the apple-touch-icon, on the SignIn and Login screens, and as a fallback in RestaurantGrid and Restaurants. |
| `Frontend/public/favicon.ico` | ICO with 16, 32, 48, 64, 128 and 256 frames | Same badge artwork. Note that `index.html` actually points to `/vite.svg` as the icon; business settings swap the favicon at runtime. |

Recommendations:
- **App icon:** use `src/assets/logo.png` (640px), upscaled or re-exported to 1024x1024 for `expo.icon`. Ideally request the vector or a 1024px master. The badge is detailed and loses legibility at small sizes, so ask design for a simplified mark or the wordmark for the adaptive icon foreground (432px safe zone, transparent PNG).
- **Splash:** the same logo centered on `#ffffff`, which matches `manifest.json` `background_color` and `theme_color`. An alternative is the disabled web splash: a plum `bg-primary` screen with a white "CITYFOOD" wordmark in Outfit 900.

### 2.2 Splash and loading screens on web
- **`src/shared/components/SplashScreen.jsx`** is currently disabled (commented out in `src/app/App.jsx`). It shows a full-screen `bg-primary` with the animated "CITYFOOD" Outfit 900 wordmark, a shine sweep, and floating lucide food icons (framer-motion). It was gated by the session key `ui/splashShown`.
- **`src/modules/Food/components/user/AppIntroSplash.jsx`** is active and server-driven. It fetches `GET /food/app-intro-ads/public` and shows full-screen image or video slides with per-slide `duration`, a Skip button and a CTA. It runs once per session (sessionStorage `appIntroSeen`). Expo equivalent: an onboarding modal with `expo-video`/`expo-image`, persisted in AsyncStorage.
- **`App.jsx` loader** (when `isLoading`): a spinning ring in primary plus an italic uppercase "CityFood" label.
- **`src/shared/components/PageLoader.jsx`:** a route-change overlay with a `Loader2` spinner in a card.
- **`src/modules/Food/components/Loader.jsx`:** renders `AppShellSkeleton` and is used as the Suspense fallback.
- **`search/PremiumLoader.jsx`** and `MenuScanAnimation.jsx` (GSAP plus skeletons) are additional loaders.

### 2.3 Images used by user screens

| Asset | Used in | Status |
|---|---|---|
| `src/modules/Food/assets/offerimage.png` | Home, Under250 | CORRUPT |
| `.../explore more icons/{offers,gourmet,top 10,collection}.png` | Home | CORRUPT |
| `.../category-icons/{food,quick,taxi,hotel}.png` | home/HomeHeader | CORRUPT (use `public/super-app/*`) |
| `.../category-icons/{discount,veg,price}_promo.png` | home/PromoRow | OK, 1024x1024 JPEG |
| `.../chef-mascot.png` | Home | OK, 1024x1024 JPEG |
| `.../out-of-zone-bg.png` | Home (out-of-service state) | OK, 576x1024 RGBA |
| `.../gourmet_new_banner.png` | Gourmet | OK, 1024x1024 JPEG |
| `.../collectionspagebanner.png` | Collections | CORRUPT |
| `.../offerpagebanner.svg` | Offers | OK (SVG; needs `react-native-svg` or conversion) |
| `.../fssai.png` | RestaurantDetails | CORRUPT |
| `.../bikelogo.png` | DeliveryTrackingMap | CORRUPT (use `public/MapRider.png`) |
| `public/MapRider.png` | DeliveryTrackingMap | OK, 408x612 RGBA |
| `public/logo.png` | SignIn, Login, RestaurantGrid, Restaurants | OK, 512x512 |
| `public/food/login-bottom-banner.png` | SignIn, Login | OK, 576x236 RGBA |
| `public/super-app/{food,grocery,taxi,hotel}.png` | auth/Portal | OK, 640x640 JPEG |
| `/placeholder-dish.jpg`, `/placeholder-restaurant.jpg` | referenced in code | **MISSING from `public/`** (broken fallback) |
| `public/food/*.png` (16 dish photos, 640x640) | not referenced by user screens (seed/demo) | OK |
| Unsplash URLs (`src/modules/Food/constants/images.js`, 61 refs) | placeholders | remote |
| `https://ui-avatars.com` | ProductDetail avatar fallback | remote |

Most real content (restaurant, dish, banner, ad, logo images) comes from the API. `@/shared/utils/media.js` `getMediaUrl()` resolves backend-relative `/uploads/...` paths; this must be ported so URLs resolve against `API_BASE_URL`. `OptimizedImage.jsx` (used by 11 screens) does lazy loading, `srcSet` and WebP; replace it with `expo-image`, which gives caching, placeholders and transitions.

### 2.4 Audio
- `src/modules/Food/assets/audio/zomato_sms.mp3` plays on order placed (Cart, `new Audio`). It is identical to `public/zomato_sms.mp3` and is valid.
- `src/modules/Food/assets/audio/alert.mp3` is the fallback notification sound in `firebaseMessaging.js`.
- For Expo, use `expo-audio`. Custom push sounds must be bundled through the `expo-notifications` plugin `sounds` config.

### 2.5 Lottie and animation files
There are **no Lottie, GIF or JSON animation files** in user code. All animation is code: framer-motion, GSAP, CSS keyframes and `canvas-confetti`. Video only comes from server media (`.mp4`/`.webm` in AppIntroSplash, FestBanner and Home ads).

---

## 3. Icon libraries (user code)

| Library | Usage |
|---|---|
| **lucide-react** `^0.555.0` | 81 files, **120 unique icons**, 621 named imports. Top icons: ArrowLeft 50, Clock 29, MapPin 29, Star 23, X 23, Loader2 22, Search 16, ChevronDown 15, ChevronRight 15, Bookmark 14, Share2 12, Plus 12, UtensilsCrossed 11, CheckCircle2 11, AlertCircle 11, Phone 11, IndianRupee 9, Mic 8, Tag 8, Mail 8, Timer 7, ArrowRight 7, SlidersHorizontal 7, BadgePercent 7, ShieldCheck 7, Check 7, Utensils 7, FileText 7, CreditCard 7, Minus 6, ShoppingBag 6, Calendar 6, MessageCircle 6, Heart 6, ShoppingCart 6, Wallet 6, Trash2 6, User 6, Users 6, Info 6, Copy 5. |
| react-icons/fa6 | 6 files, only `FaLocationDot` (location pin in headers). |
| @heroicons/react | not used in user code (installed). |
| @mui/icons-material | not used in user code. |

**Expo:** use `lucide-react-native` with `react-native-svg`, which keeps the same icon names so imports can be swapped one to one. Replace `FaLocationDot` with lucide `MapPin` or `@expo/vector-icons` `FontAwesome6` `location-dot`.

Bottom nav tabs (`components/user/BottomNavigation.jsx`):
- Home (`Home`)
- Under ₹250 (`Tag`, with the label limit set dynamically from landing settings)
- Dining (`UtensilsCrossed`, hidden when `showDining=false`)
- Orders (`ShoppingBag`)
- Profile (`User`)

The active tab uses a `#ffeef2` pill with primary icon and text, a stroke width of 2.5, and 10px bold labels.

---

## 4. Web-only libraries and APIs, with Expo equivalents

### 4.1 Frontend `package.json` (versions as declared)

**dependencies:**

| Package | Version |
|---|---|
| @emotion/react | ^11.14.0 |
| @emotion/styled | ^11.14.1 |
| @googlemaps/js-api-loader | ^1.16.10 |
| @heroicons/react | ^2.1.5 |
| @mui/icons-material | ^7.3.6 |
| @mui/material | ^7.3.6 |
| @mui/x-date-pickers | ^8.22.1 |
| @radix-ui/react-alert-dialog | ^1.1.15 |
| @radix-ui/react-avatar | ^1.1.11 |
| @radix-ui/react-checkbox | ^1.3.3 |
| @radix-ui/react-dialog | ^1.1.15 |
| @radix-ui/react-dropdown-menu | ^2.1.16 |
| @radix-ui/react-label | ^2.1.8 |
| @radix-ui/react-navigation-menu | ^1.2.14 |
| @radix-ui/react-popover | ^1.1.15 |
| @radix-ui/react-select | ^2.2.6 |
| @radix-ui/react-slot | ^1.2.4 |
| @radix-ui/react-switch | ^1.2.6 |
| @react-google-maps/api | ^2.20.8 |
| @reduxjs/toolkit | ^2.11.2 |
| @tailwindcss/vite | ^4.1.17 |
| @tanstack/react-virtual | ^3.14.4 |
| axios | ^1.13.6 |
| canvas-confetti | ^1.9.4 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| dayjs | ^1.11.19 |
| file-saver | ^2.0.5 |
| firebase | ^11.0.2 |
| framer-motion | ^12.23.24 |
| gsap | ^3.13.0 |
| html2canvas | ^1.4.1 |
| jspdf | ^3.0.4 |
| jspdf-autotable | ^5.0.2 |
| leaflet | ^1.9.4 |
| lenis | ^1.3.15 |
| lucide-react | ^0.555.0 |
| next-themes | ^0.4.6 |
| pako | ^2.1.0 |
| react | ^19.2.0 |
| react-day-picker | ^9.12.0 |
| react-dom | ^19.2.0 |
| react-icons | ^5.4.0 |
| react-is | ^19.2.1 |
| react-leaflet | ^5.0.0 |
| react-redux | ^9.2.0 |
| react-router-dom | ^7.9.6 |
| recharts | ^3.5.1 |
| socket.io-client | ^4.8.1 |
| sonner | ^2.0.7 |
| tailwind-merge | ^3.4.0 |
| tailwindcss | ^4.1.17 |
| zustand | ^5.0.8 |

**devDependencies:**

| Package | Version |
|---|---|
| @eslint/js | ^9.39.1 |
| @types/node | ^24.10.1 |
| @types/react | ^19.2.5 |
| @types/react-dom | ^19.2.3 |
| @vitejs/plugin-react | ^5.1.1 |
| eslint | ^9.39.1 |
| eslint-plugin-react-hooks | ^7.0.1 |
| eslint-plugin-react-refresh | ^0.4.24 |
| globals | ^16.5.0 |
| tw-animate-css | ^1.4.0 |
| vite | ^7.2.4 |
| vite-plugin-pwa | ^1.2.0 |

Not used by user code, so they can be dropped for the customer app: @emotion/*, @mui/material and icons (only `@mui/x-date-pickers` is used, in EditProfile), @heroicons, leaflet and react-leaflet (only the leaflet CSS is imported globally), lenis, recharts, @tanstack/react-virtual, next-themes, file-saver, pako, zustand (check), and @radix navigation-menu and alert-dialog.

### 4.2 Mapping (counts are user files)

| Web lib / API | Where used (customer) | Expo / RN equivalent |
|---|---|---|
| **react-router-dom** v7 (83 files; routes in `components/user/UserRouter.jsx` under `/food/user/*`, auth under `/user/auth/*`) | everywhere | **expo-router** (file-based) or React Navigation. Tabs: Home / Under250 / Dining / Orders / Profile. `useAppBackNavigation` (26 files) maps to `router.back()`. |
| **@react-google-maps/api** (`GoogleMap`, `Polyline`, `OverlayView`; libraries `geometry`, `places`) plus `google.maps.geometry.encoding.decodePath`, `spherical.computeDistanceBetween`, `LatLngBounds` | `components/user/DeliveryTrackingMap.jsx` (live rider tracking) | **react-native-maps** (`PROVIDER_GOOGLE`, `Marker`, `Polyline`, `fitToCoordinates`). Use `@mapbox/polyline` or `@googlemaps/polyline-codec` to decode, and `geolib`/haversine for distance. OverlayView becomes a custom `Marker` child view. |
| **@googlemaps/js-api-loader** with `google.maps.Map` (draggable pin), Geocoding REST `maps.googleapis.com/maps/api/geocode/json` | `pages/user/cart/AddressSelectorPage.jsx` | react-native-maps with a fixed center pin and `onRegionChangeComplete`. Keep the Geocoding REST calls; Places Autocomplete via REST or `react-native-google-places-autocomplete`. |
| **Nominatim** (OpenStreetMap reverse/forward geocode, behind `VITE_ENABLE_NOMINATIM_SEARCH`) | AddressSelectorPage, SelectAddress, `hooks/useLocation.jsx` | Same fetch calls work. Nominatim requires a `User-Agent` header; set it in RN. Or use `expo-location` `reverseGeocodeAsync`. |
| **navigator.geolocation** (`getCurrentPosition`, `watchPosition`) and `navigator.permissions.query({name:'geolocation'})` | `hooks/useLocation.jsx` (1766 lines; provided via `LocationProvider`, `useAppLocation`), `LocationGuard` | **expo-location** (`requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, `watchPositionAsync`). |
| **socket.io-client** 4.8 (path `/socket.io/`, `query.token`). Events: `join-tracking`, `leave-tracking`, `resync`, `location-update`, `order_status_update`, `order_state`, `delivery_drop_otp`, `admin_notification` | `utils/userSocketManager.js`, `utils/orderSocketPatch.js`, `hooks/useUserNotifications.js`, DeliveryTrackingMap, OrderTracking, OrderTrackingCard | `socket.io-client` works in RN. Force `transports: ['websocket']` and reconnect on `AppState` change. |
| **firebase** v11: `firebase/database` (`onValue`/`ref` for live rider location), `firebase/auth` (Google provider; `signOut` on logout), `firebase/messaging` (web push) | `src/modules/Food/firebase.js`, `realtimeTracking.js`, `hooks/useOrderLocationSubscription.js`, Profile, Logout, `utils/firebaseMessaging.js` (986 lines) | RTDB: the firebase JS SDK works in RN (or `@react-native-firebase/database`). Push: **expo-notifications** or `@react-native-firebase/messaging`; register the device token with the backend instead of the VAPID web token (`fcm_web_registered_token_user`). Google sign-in: `@react-native-google-signin/google-signin` or `expo-auth-session`. `AuthCallback.jsx` (OAuth redirect) becomes a deep-link scheme. |
| **Razorpay Checkout script** (`checkout.razorpay.com/v1/checkout.js`, `new window.Razorpay(...)` with `key`, `order_id`, `prefill`, `theme`, `handler`, `modal.ondismiss`) | `utils/razorpay.js`, used by Cart, Orders, OrderTracking, AddMoneyModal | **react-native-razorpay** (needs an Expo dev build/config plugin; not supported in Expo Go). The same options object maps almost one to one. |
| **framer-motion** (32 files; 427 `motion.div`, 105 `AnimatePresence`, `whileTap`, `layoutId`) | Login, SignIn, Portal, Home sections, modals, sheets | **react-native-reanimated** (entering/exiting layout animations), or **moti** for a framer-like API. `whileTap` becomes `Pressable` with a scale. |
| **gsap** | `AddToCartAnimation.jsx` (fly-to-cart), Home | Reanimated `withTiming`/`withSequence`. |
| CSS keyframes, `tw-animate-css`, `AnimatedPage`, `ScrollReveal` (IntersectionObserver), `TextReveal` | many | Reanimated entering animations; `FlatList` `onViewableItemsChanged` instead of IntersectionObserver. |
| **canvas-confetti** | Cart (order placed), TableBookingSuccess | `react-native-confetti-cannon` or `react-native-fast-confetti`. |
| **Carousels** (custom scroll-snap: `ui/horizontal-carousel.tsx`, `home/RestaurantImageCarousel.jsx` 744 lines, `AdsBannerCarousel`, `HeroBanner`, `FestBanner`; no swiper or embla) | Home, CategoryPage, cards | `FlatList horizontal pagingEnabled`, or `react-native-reanimated-carousel` / `react-native-pager-view`. |
| **sonner** toasts (`<Toaster position="top-center" richColors offset="80px" />` in `src/app/providers.jsx`; 28 files: `toast.error` 141, `toast.success` 61, `info` 7, `loading` 2, `warning` 1) | everywhere | **sonner-native** (same API) or `react-native-toast-message` / `burnt`. |
| **Radix / shadcn** UI: `ui/dialog` (6 files), `dropdown-menu`, `popover`, `select`, `switch`, `checkbox`, `avatar`, `label` | AddMoneyModal, Profile, EditProfile, OrderTracking, ReportSafetyEmergency, Login | RN `Modal` or **@gorhom/bottom-sheet** (most web modals are bottom sheets with `rounded-t-3xl`). Or a react-native-reusables (shadcn for RN) port, which keeps the same component names. |
| **react-dom `createPortal`** (22 uses, 5 files) | Home, CategoryPage, ProfessionalSearch, Cart, RestaurantDetails | `@gorhom/portal` or render inside `Modal`. |
| **@mui/x-date-pickers** `DatePicker` + dayjs adapter | EditProfile (date of birth) | `@react-native-community/datetimepicker`. |
| **dayjs** (8 files), `Intl` / `toLocaleString` (26 files) | dates, currency (INR) | dayjs works as is. On Hermes, `Intl` is supported, but test `toLocaleString('en-IN', {style:'currency'})`. |
| **jspdf + jspdf-autotable + html2canvas** | `orders/OrderInvoice.jsx`, `orders/UserOrderDetails.jsx` (download invoice PDF) | **expo-print** (`printToFileAsync` from an HTML template) plus **expo-sharing**. Or fetch a server-generated PDF. |
| `@/shared/utils/downloadUtils` (Blob, `URL.createObjectURL`, anchor download) | OrderInvoice, UserOrderDetails | `expo-file-system` with `expo-sharing`. |
| **navigator.share** (8 files: Under250, Orders, OrderTracking, DiningRestaurantDetails, ReferEarn, Cart, Profile, RestaurantDetails) | share restaurant, referral, order | RN `Share.share()` or `expo-sharing`. |
| **wa.me / t.me / twitter / facebook / linkedin share links**, `window.open` (7 files) | Under250, Orders, Cart, Profile, ReferEarn, RestaurantDetails, OrderInvoice | `Linking.openURL()` (WhatsApp: `whatsapp://send?text=` or wa.me); in-app browser via `expo-web-browser`. |
| `tel:` and `mailto:` links (7 files each) | Help, OrderHelp, Orders, OrderTracking, UserOrderDetails, ReportSafetyEmergency, PublicSupport | `Linking.openURL('tel:...')`. |
| **navigator.clipboard** (10 files) and `document.execCommand('copy')` fallback (3 files) | coupons, referral code, order ID, OTP paste | **expo-clipboard**. OTP autofill: `textContentType="oneTimeCode"` / `autoComplete="sms-otp"`. |
| **Web Speech API** (`SpeechRecognition` via `hooks/useVoiceSearch.js`) | SearchOverlay, ProfessionalSearch (mic button) | `expo-speech-recognition` (dev build) or drop the feature. |
| `navigator.vibrate` | OrderTracking | **expo-haptics** / `Vibration`. |
| `new Audio(...)` | Cart (order-placed sound), firebaseMessaging | **expo-audio**. |
| `<video>` (autoplay ads) | AppIntroSplash, Home | **expo-video**. |
| `<input type="file" accept="image/*">`, `FileReader`, `ImageSourcePicker` (camera or gallery; has a Flutter bridge) | EditProfile (avatar), `utils/imageUploadUtils.js` | **expo-image-picker**; upload with `FormData` `{uri, name, type}`. |
| `dangerouslySetInnerHTML` (CMS HTML) | Terms, Privacy, Refund, Shipping, Cancellation, OrderTracking, auth/Portal | `react-native-render-html` or a WebView. |
| `window.location`, `history.*`, `window.scrollTo` / `scrollIntoView`, `matchMedia`, `visibilitychange`, scroll listeners, `requestAnimationFrame` | 13 / 7 / 9 / 2 / 1 / 7 / 6 files | Navigation API, `ScrollView` refs (`scrollTo`, `scrollToIndex`), `useWindowDimensions`, `AppState`, `onScroll` with Reanimated `useAnimatedScrollHandler`. |
| `md:` responsive desktop UI (`DesktopNavbar.jsx`, `Footer.jsx`, `md:hidden` bottom nav) | layout | Drop on mobile. |
| **axios** (`src/services/api`, `@food/api`; 46 files) | API | Works in RN; replace the Vite proxy (`/api` to `localhost:5000`) with an absolute `EXPO_PUBLIC_API_BASE_URL`. |
| **Redux Toolkit** (`app/slices/locationSlice`) plus React contexts (Cart, Profile, Orders, Location, UserNotification, Theme) | state | Work as is; persist with AsyncStorage instead of localStorage. |
| PWA (`vite-plugin-pwa`, `manifest.json`, `public/firebase-messaging-sw.js`) | install and push | Not needed; native app config. |
| QR code | none in user code | n/a |
| `window.print` | none | n/a |

### 4.3 Storage keys (localStorage / sessionStorage) to move to AsyncStorage or SecureStore

**Scoped wrapper.** `src/modules/Food/utils/appStorage.js` stores keys under the namespace `food:v1`, with optional TTL and `cleanupExpiredScopedEntries`. Scoped keys in use:
- `auth/{module}:accessToken`
- `auth/{module}:refreshToken`
- `settings/business`
- `session/locationFetched`
- `ui/splashShown`

**Auth tokens (use expo-secure-store):**
- `user_accessToken`
- `user_refreshToken`
- `accessToken` (legacy)
- `refreshToken`
- `user_authenticated`
- `user_user`
- `userAuthData`
- `user` (generic)

**Push:**
- `fcm_web_registered_token_user`

**Cart and profile:**
- `cart`
- `userAddresses`
- `userProfile`
- `userPaymentMethods`
- `userFavorites`
- `userDishFavorites`
- `userOrders`
- `shownRatingForOrders`
- `food_user_notifications`

**Location and zone:**
- `userLocation`
- `userLat`
- `userLng`
- `userZoneId`
- `userZone`
- `outOfService`
- `deliveryAddressMode`

**Preferences:**
- `userVegMode`
- `userVegModeOption`
- `userAppTheme`
- `appTheme` (legacy)
- `user_app_logo`

**Auth drafts:**
- `user_draft_phone`
- `draft_phone_login`
- `oauthSuccess`

**Legacy and native:**
- `food_business_settings` (legacy, migrated)
- `native_last_route`

**sessionStorage:**
- `appIntroSeen`
- other scoped `session` values

---

## 5. Shared UI components used across user screens

shadcn-style primitives live in `src/modules/Food/components/ui/`. User-specific components live in `src/modules/Food/components/user/`.

| Component | Path | Used by (count / examples) |
|---|---|---|
| Button (CVA variants default/destructive/outline/secondary/ghost/link; sizes default h-9, sm h-8, lg h-10, icon) | `components/ui/button.tsx` | 58 files |
| AnimatedPage (page-enter fade) | `components/user/AnimatedPage.jsx` | 48 files |
| Card / CardHeader / CardContent (`rounded-xl border shadow-sm`) | `components/ui/card.tsx` | 33 files |
| Input | `components/ui/input.tsx` | 20 files |
| Badge | `components/ui/badge.tsx` | 13 files (Home, HomeHeader, Dining, RestaurantDetails, Checkout, Help, ...) |
| OptimizedImage (lazy, srcSet, WebP) | `components/OptimizedImage.jsx` | 11 files |
| Loading skeletons (`AppShellSkeleton`, `RestaurantGridSkeleton`, `RestaurantDetailSkeleton`, `HeroBannerSkeleton`, `CategoryChipRowSkeleton`, `ExploreGridSkeleton`, `OrdersDashboardSkeleton`, `WalletSkeleton`, `ContentPageSkeleton`, ...) and `ui/skeleton.tsx` | `components/ui/loading-skeletons.jsx` | 9 files (Home, Offers, Gourmet, CategoryPage, Restaurants, RestaurantDetails, HeroBanner, ExploreMoreSection, MenuScanAnimation) |
| ScrollReveal | `components/user/ScrollReveal.jsx` | 9 files |
| UserLayout (shell: search overlay context, bottom nav, desktop navbar, intro splash, LocationGuard) | `components/user/UserLayout.jsx` | layout route, plus `useSearchOverlay` imported by 9 screens |
| Label | `components/ui/label.tsx` | 9 files |
| Dialog (Radix) | `components/ui/dialog.tsx` | 6 files |
| Textarea | `components/ui/textarea.tsx` | 5 |
| Loader (Suspense fallback) | `components/Loader.jsx` | 5 |
| Avatar | `components/ui/avatar.tsx` | 4 (HomeHeader, Home, Profile, EditProfile) |
| Switch, Checkbox, Select, Popover, DropdownMenu | `components/ui/*.tsx` | 1–3 each |
| BottomNavigation (tab bar) | `components/user/BottomNavigation.jsx` | via UserLayout |
| PageNavbar (sticky header: location, search, veg toggle, etc.) | `components/user/PageNavbar.jsx` | Home, Dining, Under250 |
| HomeHeader (location, notifications, service switcher) | `components/user/home/HomeHeader.jsx` | Home |
| RestaurantImageCarousel / HomeRestaurantCard / RestaurantGrid (restaurant card) | `components/user/home/*.jsx` | Home, CategoryPage |
| Footer (web footer) | `components/user/Footer.jsx` | Home, Restaurants, ProductDetail (drop on mobile) |
| SearchOverlay (full-screen search plus voice) | `components/user/SearchOverlay.jsx` | via UserLayout |
| StickyCartCard (floating "View cart" bar) | `components/user/StickyCartCard.jsx` | Home (also inline in RestaurantDetails) |
| OrderTrackingCard (active-order banner) | `components/user/OrderTrackingCard.jsx` | Home |
| AddToCartButton / AddToCartAnimation | `components/user/AddToCart*.jsx` | Home |
| AddMoneyModal (wallet top-up via Razorpay) | `components/user/AddMoneyModal.jsx` | Wallet |
| DeliveryTrackingMap | `components/user/DeliveryTrackingMap.jsx` | OrderTracking |
| LocationGuard | `components/user/LocationGuard.jsx` | UserLayout |
| ProtectedRoute | `components/ProtectedRoute.jsx` | UserRouter (orders, bookings, profile, ...) |
| PageLoader | `src/shared/components/PageLoader.jsx` | App |

Commonly used hooks and contexts:

| Hook / context | Files |
|---|---|
| `useAppBackNavigation` | 26 |
| `ProfileContext` | 24 |
| `CartContext` | 15 |
| `useAppLocation` | 14 |
| `useLocation` | 8 |
| `useCompanyName` | 8 |
| `OrdersContext` | 8 |
| `useAppLogo` | 5 |
| `useDelayedLoading` | 4 |

These are all in `src/modules/Food/{hooks,context}/`.

---

## 6. `Frontend/.env` (key names only)

Client keys (Vite exposes only `VITE_*` to the bundle). Map them to `EXPO_PUBLIC_*` in Expo:
- `VITE_API_BASE_URL`
- `VITE_SOCKET_PORT` (code also reads `VITE_SOCKET_BASE_URL`, which is not in `.env`)
- `VITE_GOOGLE_MAPS_API_KEY` (for native you need Android and iOS Maps SDK keys restricted by package name / bundle ID, set in `app.json` `android.config.googleMaps.apiKey` and `ios.config.googleMapsApiKey`)
- `VITE_RAZORPAY_KEY_ID` (public key ID only, which is fine to ship)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_VAPID_KEY` (web push only; not needed natively. Native FCM uses `google-services.json` and `GoogleService-Info.plist`)

Feature flags read in code but not present in `.env`:
- `VITE_ENABLE_NOMINATIM_SEARCH`
- `VITE_ENABLE_LOCATION_REVERSE_GEOCODE`
- `VITE_ENABLE_RANGE_BYPASS`
- `VITE_APP_MODE`

**SECRET: `FIREBASE_SERVICE_ACCOUNT` is a Firebase Admin service-account credential.** It is not `VITE_`-prefixed, so Vite does not bundle it today. It still should not be in the frontend `.env` at all. Do not copy it into the Expo project or into any `EXPO_PUBLIC_*` variable, because those are inlined into the JS bundle. Keep it on the Backend only. If it was ever committed or shared, consider rotating it.
