# CityFood Restaurant app: conversion checklist

This file tracks the conversion of the restaurant partner web panel to an Expo Android app. Each row ends with a status:

- **Verified**: run and seen working.
- **Built, not tested**: the code is written; it needs a device test.
- **Blocked**: can't be completed yet; the row says what is needed.
- **Pending**: not built yet.

Evidence:

- [docs/audit/routes-and-design.md](docs/audit/routes-and-design.md)
- [docs/audit/api-and-auth.md](docs/audit/api-and-auth.md)
- [docs/API_MAP.md](docs/API_MAP.md)

## Inputs found

| Item | Value | Source |
|---|---|---|
| Target app | Restaurant partner app | Stated by the user |
| Web source | `Frontend/src/modules/Food/pages/restaurant`, `components/restaurant` (about 31k lines) | Repo |
| Flutter wrapper | None exists | Same as the user app, confirmed by the user |
| App name | CityFood Restaurant | Chosen by the user |
| Package | `com.cityfood.restaurant` | User's `google-services.json` (project `cityfood-69559`) |
| Version | 1.0.0 (versionCode 1) | Fresh start |
| Icon and splash | CityFood logo (`Frontend/src/assets/logo.png`), the same logo the restaurant login uses | `pages/restaurant/auth/Login.jsx:29` |
| API | `https://cityfood.co.in/api/v1`; socket `https://cityfood.co.in` | Shared with the user app |
| Runtime theme | `GET /app-config/restaurant_app` returns 404 "Config not found", so the CSS defaults apply (`--rt-primary` `#B80B3D`) | Live API |
| Firebase | `google-services.json` includes `com.cityfood.restaurant`. It's the same project as the backend's service account. | ~/Downloads (user) |
| Test login | Test restaurant "CityFood App Test Restaurant", id `6ad604330e0130a4445e707a`, owner phone **8624862400**, OTP **123456**. Registered via `POST /food/restaurant/register` on 2026-10-19 with the user's approval; status **pending** until an admin approves it. | `Backend/src/core/otp/otp.service.js:106` (test number, never sends SMS) |
| Expo account | Not logged in. Builds are local release APKs. | `npx eas-cli whoami` |

### Decisions and assumptions

1. **New-order ring on phones (the user's decision).** The web only loops the ringtone at 768px and wider. The app rings on phones: `restaurant-order-ring.wav` every 6 s for up to 120 s, plus vibration and a high-priority push on channel `default` with that sound.
2. **One socket and one notifications provider.** The web's `GlobalPickupOtpModal` opened a second socket.
3. **Polling.** The web polls orders every 8 s, which goes over the backend's default limit of 100 requests per 15 minutes per user. The app relies on the socket and polls less often. The interval is in `docs/API_MAP.md`.
4. **Navigation.** It follows the web at phone width: a floating bottom nav (Orders, Inventory, Feedback, Explore), the hamburger drawer and the red header. Dashboard, Ratings & reviews and Withdrawal history stay reachable from the drawer only, as on the web.
5. **Light theme only.** The panel has no dark mode.
6. **Excel bulk upload (Inventory)** is on hold. The web loads SheetJS 0.19.3 from its CDN. The user's npm config refuses remote tarballs, and registry `xlsx@0.18.5` has CVE-2023-30533. This needs the user's decision.

## Screens

Native paths are the web paths without `/food/restaurant`. PR means `ProtectedRoute`, then `RestaurantBlockGuard`, then `RestaurantLayout`.

| # | Web route | Component | Guard | Native route | Status |
|---|---|---|---|---|---|
| 1 | `welcome` | `auth/Welcome.jsx` | public | `/welcome` | Pending |
| 2 | `login` | `auth/Login.jsx` | public | `/login` | Pending |
| 3 | `otp` | `auth/OTP.jsx` | public | `/otp` | Pending |
| 4 | `signup` | `auth/Signup.jsx` | public | `/signup` | Pending |
| 5 | `pending-verification` | `auth/VerificationPending.jsx` | public | `/pending-verification` | Pending |
| 6 | `onboarding?step=1..3` | `Onboarding.jsx` (3-step registration) | public (reads its own token or pending phone) | `/onboarding` | Pending |
| 7 | `privacy`, `profile/privacy` | `PrivacyPolicyPage.jsx` | public | `/privacy` | Pending |
| 8 | `terms`, `profile/terms` | `TermsAndConditionsPage.jsx` | public | `/terms` | Pending |
| 9 | `` (index) | `OrdersMain.jsx` | PR | `/` (Orders tab) | Pending |
| 10 | `dashboard` | `RestaurantDashboard.jsx` | PR | `/dashboard` | Pending |
| 11 | `orders/all` | `AllOrdersPage.jsx` | PR | `/orders/all` | Pending |
| 12 | `orders/:id` | `OrderDetails.jsx` | PR | `/orders/[id]` | Pending |
| 13 | `notifications` | `Notifications.jsx` | PR | `/notifications` | Pending |
| 14 | `delivery-settings` | `DeliverySettings.jsx` | PR | `/delivery-settings` | Pending |
| 15 | `menu-categories` | `MenuCategoriesPage.jsx` | PR | `/menu-categories` | Pending |
| 16 | `explore` | `ExploreMore.jsx` | PR | `/explore` (Explore tab) | Pending |
| 17 | `outlet-timings` | `OutletTimings.jsx` | PR | `/outlet-timings` | Pending |
| 18 | `outlet-info` | `OutletInfo.jsx` | PR | `/outlet-info` | Pending |
| 19 | `ratings-reviews` | `RatingsReviews.jsx` (static FAQ) | PR | `/ratings-reviews` | Pending |
| 20 | `edit-owner` | `EditOwner.jsx` | PR | `/edit-owner` | Pending |
| 21 | `inventory` | `Inventory.jsx` | PR | `/inventory` (Inventory tab) | Pending (Excel import on hold) |
| 22 | `feedback?tab=` | `Feedback.jsx` | PR | `/feedback` (Feedback tab) | Pending |
| 23 | `share-feedback` | `ShareFeedback.jsx` | PR | `/share-feedback` | Pending |
| 24 | `help-centre/support` | `RestaurantSupport.jsx` | PR | `/help-centre/support` | Pending |
| 25 | `hub-menu/item/:id` | `ItemDetailsPage.jsx` (`new` = create) | PR | `/hub-menu/item/[id]` | Pending |
| 26 | `hub-finance?tab=` | `HubFinance.jsx` | PR | `/hub-finance` | Pending |
| 27 | `withdrawal-history` | `WithdrawalHistoryPage.jsx` | PR | `/withdrawal-history` | Pending |
| 28 | `promocodes` | `Promocodes.jsx` | PR | `/promocodes` | Pending |
| 29 | `update-bank-details` | `UpdateBankDetails.jsx` | PR | `/update-bank-details` | Pending |
| 30 | `zone-setup` | `ZoneSetup.jsx` (map, zones) | PR | `/zone-setup` | Pending |
| — | (overlays) | New-order popup and ring, `GlobalPickupOtpModal`, block guard screen, dining "New Table Request" popup | n/a | shell | Pending |
| — | (shell) | `RestaurantLayout`: red navbar, hamburger drawer, `BottomNavOrders` | n/a | layout | Pending |

### Left out (please confirm)

| Screen | Reason |
|---|---|
| `forgot-password` | Legacy email/password reset; nothing links to it |
| `rush-hour` | Nothing links to it |
| `outlet-timings/:day` (`DaySlots`) | Nothing links to it, and it's broken |
| `edit-cuisines`, `edit-address` | Nothing links to them; `edit-address` only calls `alert()` |
| `dish-ratings` | Stub; nothing links to it |
| `fssai`, `fssai/update` | Placeholder and stub, reachable only from the unlinked ManageOutlets |
| `hyperpure` | Stub; nothing links to it |
| `finance-details` | Nothing calls its handler, and the page crashes |
| `phone` | Mock; nothing links to it |
| `download-report` | Fake: no API call, no file |
| `manage-outlets` | Legacy; nothing links to it |
| `reservations` | Only redirects to Explore |
| Admin, user and delivery routes | Other apps |

## Blocked

| Item | Why | What's needed |
|---|---|---|
| Welcome carousel images (`loginbanner1-4.png`, `loginbanner.png`) | Corrupted in git and on the live site; can't be repaired | The original images |
| Excel bulk upload | SheetJS can't be installed under the current npm setting | The user's decision (see Decisions 6) |
| Logged-in testing | The test restaurant is pending | Admin approves "CityFood App Test Restaurant" |

## Backend issues found (not fixed)

- **Registration:** anyone can register any phone, and re-registering deletes a `rejected` record, so blocked restaurants can come back.
- **Status not enforced:** the API never checks restaurant status, so a blocked restaurant that still has a token keeps full access.
- **Socket rooms:** any logged-in socket can join any restaurant room.
- **Pickup OTP exposure:** the pickup OTP appears in every order-list row and in push text.
- **Rate limit:** the web panel's 8 s polling alone goes over the default limit.
- **Approval reset:** any profile edit or image upload sends an approved restaurant back to `pending` (hidden from customers until re-approved).

## Device test list

To be completed.
