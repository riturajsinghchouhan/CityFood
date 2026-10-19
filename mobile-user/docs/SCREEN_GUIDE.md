# Screen conversion guide

Read this before converting any screen. It is the shared contract for everyone building screens in `mobile-user/`.

## The job

Convert web screens from `Frontend/` into native screens. **This is a conversion, not a redesign.** The design spec is the web app as it renders at phone width (360–412px), which is what customers see today.

## Rules

### Read the web code first

- Read the whole web component, and every child component it renders, before writing anything.
- Port the structure, text and labels, states and behavior exactly.

### Reproduce at phone width

- Use the mobile layout only. Ignore `md:` and `lg:` desktop branches and `hidden md:block` blocks.
- Match colors, font sizes and weights, spacing, radius, shadows, icons, images, copy, loading, empty, error and success states, modals and sheets, and the intent of any animations.

### Reference screenshots

The live web app at 390px wide is captured in `mobile-user/.reference/`. Files are `<route>-NN.png`; `00` is the top of the page and higher numbers scroll down. The `loggedout/` subfolder has the logged-out views.

- Look at them with your image-reading tool before and after building a screen.
- They were taken in the Indore test zone with the test account, which has 3 past orders.
- **The source code is the authority.** Screenshots show only one state.

### Don't add anything the web doesn't have

- No new screens, features, flows, onboarding, analytics, or new navigation patterns.
- When unsure, don't change it.
- If the web has a bug that crashes the screen, port the evident intent, then list the deviation in your report.

### Platform changes only

- Touch instead of hover.
- Safe areas, status bar, keyboard avoidance.
- Lists with more than a handful of items, or unbounded lists, use `FlatList` or `SectionList` with stable keys.
- Clean up every listener, timer and socket subscription.

### Data rules

- No mock data, no TODOs, no placeholders for existing functionality.
- Every request goes through `src/api` (see `docs/API_MAP.md`). Never call axios or fetch directly from a screen. The exception is third-party URLs the web calls directly (for example the Google Geocoding REST API); put those calls in a helper in your own area, not inline in JSX.
- Don't call the same API twice for one screen. Don't add polling the web doesn't do.

### Packages and permissions

- Don't install packages. Everything needed is installed; see `package.json`.
- If you truly need another package, stop and say so in your report.
- Don't add Android permissions.

### Shared files are read-only for you

Only create or edit files in the areas assigned to you. These are read-only:

- `src/app/_layout.js`, `src/app/(tabs)/_layout.js`
- `src/components/ui/*`, `src/theme/*`, `src/api/*`, `src/context/*`, `src/lib/*`, `src/navigation/*`, `src/storage/*`, `src/hooks/useLatest.js`
- `app.config.js`, `package.json`, `CONVERSION_CHECKLIST.md`

If one needs a change (a bug, or a missing function), describe the exact change in your final report instead of making it. The only exception is a clear one-line bug fix in `src/api` or `src/context` that blocks your screen; if you make one, report it.

### Code style

- JavaScript (`.js`), no TypeScript.
- 2-space indent, double quotes, semicolons.
- Comments only where something is not obvious.
- Match the existing code in `src/`.

## Routes

Native paths are the web paths without the `/food/user` prefix. Route files live in `src/app/`:

| Web | Native file |
|---|---|
| `/food/user` (Home tab) | `src/app/(tabs)/index.js` |
| `/food/user/under-250` (tab) | `src/app/(tabs)/under-250.js` |
| `/food/user/orders` (tab) | `src/app/(tabs)/orders.js` |
| `/food/user/profile` (tab) | `src/app/(tabs)/profile.js` |
| `/food/user/dining` (tab bar shown, no tab of its own) | `src/app/(tabs)/dining.js` |
| `/food/user/restaurants/:slug` | `src/app/restaurants/[slug].js` |
| `/food/user/orders/:orderId/details` | `src/app/orders/[orderId]/details.js` |
| `/user/auth/login` | `src/app/login.js` |
| `/user/auth/support` | `src/app/support.js` |

Every other route follows the same pattern. The full list is in `CONVERSION_CHECKLIST.md`.

### Keep route files thin

A route file imports the screen component from `src/screens/<area>/...` and exports it. Put screen code in `src/screens/<area>/` and screen-specific components in `src/components/<area>/`.

### Navigation

- Use `import { router, useLocalSearchParams, Link } from "expo-router"`.
- Web `navigate(path)` becomes `router.push(nativePath)`.
- Web `navigate(path, { replace: true })` becomes `router.replace(nativePath)`.
- Web `location.state` becomes route params. Keep values serializable, or put larger objects in context.
- For links that come from the server or admin (banner CTAs, notification links), use `openLink(link)` or `toNativePath(webPath)` from `src/navigation/links.js`.

### Back behavior must match the web

- If the web screen calls `useAppBackNavigation()`, use `useAppBack()` from `src/navigation/back.js`. It has the same fixed-parent rules.
- If the web uses `navigate(-1)`, use `router.back()`.
- The Android hardware back button is already bound globally to the same rules (history back elsewhere).
- If your screen has its own back handling (multi-step flows, an open panel that back should close first), use `useBackOverride(() => { ...; return true; })`. Return `true` when you handled it.
- Modals (`BottomSheet`, `Dialog`) close themselves on Android back.

### Login-required screens

For routes behind `ProtectedRoute` on web, `export default withProtected(Screen)` (`src/navigation/Protected.js`). For actions that need login on a public screen, read `useAuth().isAuthenticated` and send the user to `router.push({ pathname: "/login", params: { from: currentPath } })`, as the web does.

## Foundation you must use

### UI

Import from `src/components/ui`:

- **`Text`**: always use this instead of RN `Text`. It applies Poppins at the right `fontWeight`; Android ignores `fontWeight` for custom fonts otherwise. The default is 14px in the theme's text color.
- **`Screen`**: page container. `edges={["top"]}` by default; pass `edges={[]}` for full-bleed hero screens and handle the inset yourself. `background` sets the page color.
- **`Button`**: the variants and sizes of `ui/button.tsx`.
- **`Card`, `Badge`, `Input`, `Divider`, `Skeleton`, `Switch`, `VegMark`, `ScalePressable`**: `ScalePressable` replaces `whileTap` scale.
- **`useDelayedLoading`**
- **`AppImage`**: replaces `OptimizedImage` and `<img>` for remote images. Pass `width` (the rendered dp width) for list and card images so a resized variant is fetched. Use `placeholderType` `"food"` or `"shop"`. Accepts `require()`'d local assets too.
- **`BottomSheet`** (with `SheetHandle`) and **`Dialog`**: web bottom sheets (`rounded-t-3xl`) and Radix dialogs.
- **`toast`**: same API as sonner (`toast.success/error/info/warning/loading/dismiss`). The `Toaster` is already mounted.
- **`Confetti`**: replaces canvas-confetti.

Icons come from `lucide-react-native`, using the same names as the web's `lucide-react`. `Facebook`, `Instagram`, `Twitter` and react-icons `FaLocationDot` are in `src/components/ui/BrandIcons.js`.

### Theme

```js
const { colors, isDark } = useTheme();
```

- `colors.primary` is the runtime admin color (`#B80B3D` on the live app). Use it wherever the web uses `primary`.
- Tailwind palette values are in `tw` from `src/theme/tokens.js` (for example `tw.gray500`). Brand constants are in `brand`.
- Spacing, radius, font sizes and shadows are in `src/theme/tokens.js`.
- **Dark mode is real** (Profile → Appearance toggle). Every `dark:` class on web must be honored through `isDark` and `colors`. Common pairs:
  - `bg-white dark:bg-[#1a1a1a]` → `isDark ? "#1a1a1a" : "#fff"`
  - `text-gray-900 dark:text-white`
  - `border-gray-200 dark:border-gray-800`
- Build styles inside the component, or memoize them with `useThemedStyles(factory)`.

Tailwind to RN conversions:

| Tailwind | RN |
|---|---|
| `px-4` / `p-4` | 16 |
| `gap-3` | 12 |
| `text-xs` / `sm` / `base` / `lg` / `xl` / `2xl` | 12 / 14 / 16 / 18 / 20 / 24 |
| `font-medium` / `semibold` / `bold` / `extrabold` / `black` | `fontWeight` 500 / 600 / 700 / 800 / 900 |
| `rounded-lg` / `xl` / `2xl` / `3xl` / `full` | 8 / 12 / 16 / 24 / 9999 |
| `shadow-sm` / `md` / `lg` | `shadow.sm` / `shadow.md` / `shadow.lg` |
| `h-10` | 40 |
| `w-5 h-5` icon | `size={20}` |
| `bg-black/50` | `rgba(0,0,0,0.5)` |
| `bg-primary/10` | `colors.primary + "1A"` (hex alpha) |

`backdrop-blur` is not available; use a solid or semi-transparent background of the same tint.

### Data and state

See `docs/API_MAP.md` for every endpoint function and every context hook:

- `useAuth()`, `useCart()`, `useProfile()`, `useAppLocation()`, `useOrders()`, `useUserNotifications()`, `useAppSettings()`, `useSearchOverlay()`
- `src/lib/socket.js`
- `src/lib/razorpay.js`

API functions return the backend body `{success, message, data}`, so the web's `res.data.data.x` becomes `res.data.x`. Errors are `ApiError` with a user-facing `.message`; show it with `toast.error(err.message)` wherever the web shows a toast.

### Native replacements

| Web | Native |
|---|---|
| `navigator.share` / `wa.me` | RN `Share.share()` / `Linking.openURL` |
| clipboard | `expo-clipboard` |
| `tel:` / `mailto:` | `Linking.openURL` |
| `new Audio` | `expo-audio` (`assets/sounds/*.mp3`) |
| `navigator.vibrate` | `expo-haptics` |
| `<video>` | `expo-video` |
| `<input type=file>` | `expo-image-picker` |
| CMS HTML (`dangerouslySetInnerHTML`) | `react-native-render-html` |
| jsPDF invoice | `expo-print` `printToFileAsync` from an HTML template, plus `expo-sharing` |
| Google Maps | `react-native-maps` with `provider={PROVIDER_GOOGLE}` |
| geolocation | `useAppLocation()`; `expo-location` only if the context doesn't cover it |
| Web Speech API | `expo-speech-recognition` |
| date picker | `@react-native-community/datetimepicker` |
| gradients | `expo-linear-gradient` |
| carousels | horizontal `FlatList` / `ScrollView` with `pagingEnabled` or `snapToInterval` |
| framer / GSAP animations | RN `Animated` or `react-native-reanimated` (installed) |

Before using an Expo module API, check the SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/sdk/<module>.md`). APIs change between SDKs.

### Local images

Web assets in `src/modules/Food/assets/...` are in `mobile-user/assets/images/` at the same relative path.

- `public/super-app/*.png` are actually JPEGs and are in `assets/images/super-app/*.jpg`.
- `public/MapRider.png` and `public/food/login-bottom-banner.png` are under `assets/images/`.
- The app logo is `assets/images/logo.png`.
- **8 images are unrecoverable** (corrupted in git and on the live site): `bikelogo.png`, `collectionspagebanner.png`, `explore more icons/{collection,gourmet,offers,top 10}.png`, `fssai.png`, `offerimage.png`. Where the web uses them, render an empty `View` of the same size. Don't `require()` them, because the files don't exist.

## Live API checks

Base URL: `https://cityfood.co.in/api/v1`.

- GET calls are fine to test freely with curl, to confirm response shapes.
- Don't call create, update or delete endpoints, don't place orders or payments, and don't log in from scripts. The lead tests writes with the test account.

## Before you finish

1. Lint your files: `cd mobile-user && npx eslint <your files>`. There must be 0 errors.
2. Confirm the app bundles: `npx expo export --platform android --output-dir /tmp/claude-1000/-home-ak-Public-projects-CityFood/5f0a0c79-b9dd-445b-aef5-42a86afe5866/scratchpad/export-<yourarea>`. It can fail because of another area's half-written file. If so, re-run it, and say which file failed if it keeps failing.
3. Look at your screens' reference screenshots once more and compare them with your code.
4. Final report, short:
   - files created
   - screens done
   - any web behavior you could not reproduce, and why
   - deviations from the web (bugs fixed, crashes avoided)
   - shared-file changes you need
   - anything left Blocked
