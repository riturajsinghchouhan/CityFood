# CityFood Delivery (rider) app: conversion checklist

This file tracks the conversion of the delivery partner web app to an Expo Android app. Each row ends with a status:

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
| Target app | Delivery partner (rider) app | Stated by the user |
| Web source | `Frontend/src/modules/DeliveryV2` (about 13.8k lines) | Repo |
| Flutter wrapper | None exists | Same as the other apps |
| App name | CityFood Delivery | Same pattern as the other two apps |
| Package | `com.cityfood.delivery` | User's `google-services.json` (project `cityfood-69559`) |
| Version | 1.0.0 (versionCode 1) | Fresh start |
| Icon and splash | CityFood logo | `Frontend/public/logo.png` (the rider login uses the same logo) |
| API | `https://cityfood.co.in/api/v1`; socket `https://cityfood.co.in` | Shared |
| Runtime theme | `GET /app-config/delivery_app` returns 404, so the CSS defaults apply: primary `#15498b`, strong `#000000` | Live API, `deliveryTheme.css` |
| Firebase | `google-services.json` (FCM). Realtime Database client config comes from `Frontend/.env` `VITE_FIREBASE_*` → `EXPO_PUBLIC_FIREBASE_*` (public). | Repo env |
| Rate limit | 3,500 requests per 15 minutes (`RateLimit-Policy` header) | Live API |
| Test login | "CityFood App Test Rider", id `6ad881b64c9fe039d5d62576`, phone **8624862400**, OTP **123456**, bicycle, Indore zone. Registered via `POST /food/delivery/register` on 2026-10-21; status **pending** until an admin approves it. | Backend test number (no SMS) |
| Expo account | Not logged in. Builds are local release APKs. | |

### Decisions

1. **Background location while online (the user's decision).** The web tracks only while the home screen is open.
   - The app uses an Android foreground service ("You're online"), expo-location and expo-task-manager. It posts to the native-oriented `POST /food/delivery/location`, which needs no backend change.
   - During an active order it also sends the web's socket `update-location` (throttled to 50 m / 10 s) and the Realtime Database writes.
2. **Offers ring and vibrate (the user's decision).** The web's alert sound is commented out. The app loops `delivery_alert.mp3` during the 60 s offer, on channel `default` at MAX importance.
3. **Availability updates.** The web re-sent `PATCH /availability` on every GPS fix (a bug). The app sends the 45 s heartbeat only.
4. **Not ported:** the sim/Play button, the OTP-bypass slider and the dead OTP name step (dev/test shortcuts).

## Screens

Native paths are the web paths without `/food/delivery`. Login means `ProtectedRoute` (token check).

| # | Web route | Component | Guard | Native route | Status |
|---|---|---|---|---|---|
| 1 | `login` | `auth/SignIn` | public | `/login` | Pending |
| 2 | `otp` | `auth/OTP` | public | `/otp` | Pending |
| 3 | `signup/details` | `auth/SignupStep1` | public | `/signup/details` | Pending |
| 4 | `signup/documents` | `auth/SignupStep2` (KYC photos) | public | `/signup/documents` | Pending |
| 5 | `profile/terms`, `terms` | `TermsAndConditionsV2` | public | `/profile/terms` | Pending |
| 6 | `profile/privacy` | `PrivacyPolicyV2` | public | `/profile/privacy` | Pending |
| 7 | `support` | `help/PublicSupportV2` | public | `/support` | Pending |
| 8 | `` / `feed` | `DeliveryHomeV2` feed (map, duty toggle, offers, active trip) | login | `/` (Feed tab) | Pending |
| 9 | `pocket` | `PocketV2` | login | `/pocket` (tab) | Pending |
| 10 | `orders` | `OrdersV2` | login | `/orders` (tab) | Pending |
| 11 | `history` | `HistoryV2` | login | `/history` | Pending |
| 12 | `profile` | `ProfileV2` | login | `/profile` (tab) | Pending |
| 13 | `notifications` | `NotificationsV2` | login | `/notifications` | Pending |
| 14 | `profile/details` | `profile/ProfileDetailsV2` | login | `/profile/details` | Pending |
| 15 | `help/tickets` | `help/SupportTicketsV2` | login | `/help/tickets` | Pending |
| 16 | `help/tickets/create` | `help/CreateSupportTicketV2` | login | `/help/tickets/create` | Pending |
| 17 | `help/tickets/:ticketId` | `help/ViewSupportTicketV2` | login | `/help/tickets/[ticketId]` | Pending |
| 18 | `help/id-card` | `help/ShowIdCardV2` | login | `/help/id-card` | Pending |
| 19 | `pocket/payout` | `pocket/PayoutV2` | login | `/pocket/payout` | Pending |
| 20 | `pocket/deductions` | `pocket/DeductionStatementV2` | login | `/pocket/deductions` | Pending |
| 21 | `pocket/limit-settlement` | `pocket/LimitSettlementV2` | login | `/pocket/limit-settlement` | Pending |
| 22 | `pocket/balance` | `pocket/PocketBalanceV2` | login | `/pocket/balance` | Pending |
| 23 | `pocket/cash-limit` | `pocket/CashLimitInfoV2` | login | `/pocket/cash-limit` | Pending |
| 24 | `pocket/details` | `pocket/PocketDetailsV2` | login | `/pocket/details` | Pending |
| — | (overlays) | New-offer popup with ring and 60 s slide-to-accept; go-online selfie flow; trip OTP and payment sheets | n/a | shell | Pending |

### Left out (please confirm)

| Screen | Reason |
|---|---|
| `welcome` | Mock |
| `profile/bank`, `profile/documents`, `pocket/statement` | Not linked from anywhere (`ProfileDetails` covers bank and documents) |
| Pocket → `/earnings` link | The route doesn't exist on web (broken link) |

## Blocked

| Item | Why | What's needed |
|---|---|---|
| Logged-in testing | The test rider is pending | Admin approves "CityFood App Test Rider" |
| Support contact details | The web shows a stale `support@thetuggo.com` and +91 9917675609 | Business settings, if they have them; otherwise the user's real contact details |

## Backend issues found (not fixed)

See `docs/audit/api-and-auth.md` §6 for the full list. Main ones:

- **OTP bypass:** pickup and drop OTPs can be skipped (`SKIP` or omitted).
- **OTP leak:** the reached-pickup and confirm-pickup responses include the OTPs.
- **Status endpoint:** `PATCH /orders/:id/status` lets a rider set any status.
- **Location spoofing:** the socket `update-location` isn't checked against the assigned rider.
- **Firebase access:** Realtime Database reads and writes need no auth, and offers carry customer PII.
- **Data exposure:** `/me` and register return the full rider document (bank, Aadhaar, PAN).
- **Status not enforced:** status is never re-checked after login.

## Device test list

To be completed.
