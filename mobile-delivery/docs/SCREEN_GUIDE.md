# Delivery (rider) app: screen conversion guide

Read **`/home/ak/Public/projects/CityFood/mobile-user/docs/SCREEN_GUIDE.md`** first. Every rule in it applies here too: conversion not redesign, phone width only, no mock data, all requests go through `src/api`, `FlatList` for long lists, cleanup, no package installs, shared files are read-only, code style, and the "before you finish" checks.

Also read the restaurant delta, `/home/ak/Public/projects/CityFood/mobile-restaurant/docs/SCREEN_GUIDE.md`. Its gotchas table applies here too.

This file lists only what is different for the delivery partner app.

## Paths and sources

| | |
|---|---|
| App folder | `/home/ak/Public/projects/CityFood/mobile-delivery` (package `com.cityfood.delivery`) |
| Web source | `Frontend/src/modules/DeliveryV2/**` and what it imports. **Read only.** Never run npm, node or vite in `Frontend/` or `Backend/`: the repo recently had malware injected (now removed). |
| Audits | `docs/audit/routes-and-design.md`, `docs/audit/api-and-auth.md` |
| Data layer | `docs/API_MAP.md`: endpoint functions, `AuthContext`, `DeliveryContext` (duty, offers, active orders), lib (socket, firebase, push, ring, `locationTask`) |
| Shell | `docs/SHARED_COMPONENTS.md` (written by the shell agent) |
| Reference screenshots | `.reference/` at 390px. `loggedout/` has login, signup, terms, privacy and support. Logged-in screens are added after the test rider is approved. |

## Differences from the other apps

### Theme

- **Light only.**
- **Colors:** primary `#15498b`, strong `#000000`.
- **Color remap:** `deliveryTheme.css` maps orange, green, blue, emerald and teal Tailwind colors to the primary. The result is blue, black, white and greys.
- **Exceptions:**
  - Red for errors and emergencies.
  - The online toggle: green when online, red when offline.
- **Fonts:** Nunito Sans for body text; Sora for headings and black/extra-bold text. `Text` maps them.

### Routes

- Native paths are the web paths without `/food/delivery`.
- The home shell has tabs Feed (`/`), Pocket, Orders and Profile. History is reached from Profile and has no nav item.
- The remaining screens are stack screens.

### Back behavior

Use `useAppBack()` (`src/navigation/back.js`, a port of `useDeliveryBackNavigation`) wherever the web uses it, and `router.back()` wherever the web uses `navigate(-1)`.

### Duty, offers, trips and location

All of this lives in `DeliveryContext` and the libs. Screens never open sockets, play sounds, start location tracking or write to Firebase themselves.

**User decisions** (these differ from the web):

1. **Background location while online.** It runs as a foreground service with a persistent "You're online" notification.
2. **Offers ring and vibrate.** On the web they only vibrate.

### Dev and test shortcuts are not ported

- the sim/Play button
- the OTP-bypass slider
- the dead OTP name step

### Images

- **Bundled images:** `assets/images/{MapRider.png, delivery_avatar.jpg, delivery-hero-clean.png, logo.png}`.
- **Flags and markers:** the web loads these from flaticon and flagcdn. Use bundled vector icons from lucide or react-native-svg instead.

## Memory rules

The machine has 7 GB of RAM:

- Run heavy commands one at a time.
- Run ESLint only on your own files.
- **Don't** run `expo export`. The lead runs it at the end.
