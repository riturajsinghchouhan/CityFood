# Restaurant app: screen conversion guide

Read **`/home/ak/Public/projects/CityFood/mobile-user/docs/SCREEN_GUIDE.md`** first. Every rule in it applies here too: conversion not redesign, phone width only, no mock data, all requests go through `src/api`, `FlatList` for long lists, cleanup, no package installs, shared files are read-only, code style, and the "before you finish" checks.

This file lists only what is different for the restaurant partner app.

## Paths and sources

| | |
|---|---|
| App folder | `/home/ak/Public/projects/CityFood/mobile-restaurant` (package `com.cityfood.restaurant`) |
| Web source | `Frontend/src/modules/Food/pages/restaurant/**`, `components/restaurant/**` and the hooks they import |
| Audits | `docs/audit/routes-and-design.md`, `docs/audit/api-and-auth.md` |
| Data layer | `docs/API_MAP.md`: every endpoint function and context hook |
| Shell components | `docs/SHARED_COMPONENTS.md` (written by the shell agent) |
| Reference screenshots | `.reference/` at 390px. `loggedout/` has the auth screens; logged-in screens are added once the test restaurant is approved. |

## Differences from the user app

### Theme

- **Light only.** The restaurant panel has no dark mode, and its `dark:` classes never switch on. Ignore them.
- **Primary color:** `colors.primary` defaults to `#B80B3D` (`--rt-primary`).
- **Header gradient:** `#B80B3D` → `#66001D`, hard-coded on web.
- **Button rule:** `restaurantTheme.css` forces black and `gray-900` buttons to the primary color. Copy that.
- **Fonts:** Poppins, like the user app.

### Routes

- Native paths are the web paths without the `/food/restaurant` prefix. The orders home (`OrdersMain`) is `/`.
- Auth routes are `/welcome`, `/login`, `/otp`, `/signup`, `/onboarding`, `/pending-verification`, `/privacy`, `/terms`.
- Protected screens: `export default withProtected(Screen)`. The shell adds the block-guard behavior.

### Back behavior

- Use `useAppBack()` from `src/navigation/back.js` wherever the web uses `useRestaurantBackNavigation`.
- Use `router.back()` wherever the web uses `navigate(-1)`.
- The Android back button is bound globally.

### New orders

- The ring, countdown, pickup-OTP modal and socket all live in `RestaurantNotificationsContext`.
- **Screens never open their own socket** and never play sounds themselves. Read state and actions from the context.

### Approval reset

Any profile edit or image upload puts an approved restaurant back to `pending` on the backend. Copy exactly what the web does around these edits, and don't add extra warnings.

### Images

- **Unrecoverable on web:** the Welcome carousel images (`loginbanner1-4.png`) and `loginbanner.png` are corrupted. Keep their space with an empty `View` of the same size, and don't `require()` them.
- **Valid images:** `Frontend/public/restaurant-banner.jpg` and anything `file` reports as an image. Copy valid ones into `assets/images/` at the same relative path.

### Charts

The Dashboard's recharts become react-native-svg drawings. Keep the same chart type, data, colors and axis labels. Don't add a chart library.

### Excel bulk upload (Inventory)

Build everything except parsing the file. Excel parsing is on hold: SheetJS can't be installed under the npm `allow-remote` setting. Leave a clearly isolated `parseInventoryExcel(fileUri)` function that throws `"Excel import not available yet"`, and report it.

## Gotchas (React Native 0.88 / SDK 58)

These were found the hard way in the user app.

| Problem | What to do |
|---|---|
| `StyleSheet.absoluteFillObject` no longer exists | Spreading it silently does nothing. Use `StyleSheet.absoluteFill`. |
| Custom `tabBar` props | It receives `{state, descriptors, emitter, navigateToTab, insets}`. There is no `navigation`. |
| Overlapping or animated `VideoView`s | Need `surfaceType="textureView"`. |
| Several inputs passing focus between each other (OTP boxes) | They lose characters on Android. Use one hidden input that drives display boxes, like mobile-user's `LoginScreen`. |
| Release-only problems | Test real interactions (taps), not only deep links. |

## Memory rules

The machine has 7 GB of RAM:

- Run heavy commands one at a time.
- Run ESLint only on your own files.
- Run `npx expo export --platform android --output-dir /tmp/claude-1000/-home-ak-Public-projects-CityFood/5f0a0c79-b9dd-445b-aef5-42a86afe5866/scratchpad/export-<area>` once, at the end. If it fails on another agent's unfinished file, say so and don't retry in a loop.
