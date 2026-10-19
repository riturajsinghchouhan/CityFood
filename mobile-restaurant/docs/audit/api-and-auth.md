# CityFood restaurant partner app: API and auth audit for the React Native port

This is a read-only audit. No repository files were changed, nothing was logged into, and no write endpoints were called. Only public GETs were sent to production. For `.env` files, only key names are listed, never values.

- Frontend paths are relative to `Frontend/src/`, and `@food` means `Frontend/src/modules/Food`.
- Backend paths are relative to `Backend/src/`.
- Production base URL: `https://cityfood.co.in/api/v1`. Every path below is relative to it.
- **Companion doc:** `mobile-user/docs/audit/api-and-auth.md` (the user-app audit). It already covers the following, which apply unchanged to the restaurant role and are not repeated here:
  - the axios factory `createModuleClient` (Bearer header, single-flight refresh on 401, no refresh on 429, and `accessDenied` on 403);
  - the error envelope (`message ?? error`);
  - CORS;
  - JWT lifetime (365 days) and refresh with no rotation;
  - the OTP rules and bypasses;
  - the Socket.IO URL and transport;
  - the generic `/uploads/*` endpoints;
  - the FCM route table.
  This document covers only what is different or specific to the restaurant role.

---

## 0. Summary for the RN team

| Topic | Fact |
|---|---|
| Login | `POST /food/auth/restaurant/request-otp {phone}`, then `POST /food/auth/restaurant/verify-otp {phone, otp, fcmToken?, platform?:'web'\|'mobile'}`. verify-otp has **three outcomes**: tokens (approved), `needsRegistration:true` (phone not found), or `pendingApproval:true` (status `pending` or `rejected`). The last two return **no tokens**. |
| Signup | verify-otp **never creates a restaurant**. An unknown phone must go through onboarding and then `POST /food/restaurant/register`. That call is **multipart and unauthenticated**, and the account is created with `status:"pending"`. After an admin approves it, the owner logs in again with OTP. |
| Status | `FoodRestaurant.status` is one of `pending`, `approved` or `rejected`. There is no separate `blocked` value. When an admin blocks a restaurant, it is stored as `status:"rejected"`, `rejectionReason:"Disabled by admin"`, `isBanned:true` and `isAcceptingOrders:false`. **Any profile edit or image upload resets an approved restaurant to `pending`**, which hides it from customers and blocks new orders until an admin approves it again. |
| Tokens | The access token comes back as `data.accessToken` (also `data.token`), with `data.refreshToken` and `data.user`. The JWT claims are `{userId:<restaurant _id>, role:"RESTAURANT"}`. The web stores them as `restaurant_accessToken`, `restaurant_refreshToken`, `restaurant_user` and `restaurant_authenticated` (plus the namespaced `food:v1:auth:restaurant:*` copies). |
| Profile source | Screens use `GET /food/restaurant/current` (→ `data.restaurant`), not `/food/auth/me`. `/me` returns a slimmer `data.user` that has no `approvedAt` or `pendingUpdateReason`. |
| Endpoint count | **62 distinct working backend endpoints** are used by restaurant screens, hooks and the layout (section 2). Six more `restaurantAPI` methods exist but no screen calls them. There are also **9 broken or dead call sites** (section 6). About 11 screens are UI-only mocks with no backend at all (section 2.13). |
| Realtime | Socket.IO with `auth:{token}`. The server auto-joins `restaurant:<restaurantId>`, and the web also emits `join-restaurant <id>`. The events that matter are `new_order`, `order_status_update` and `pickup_otp_reveal`, plus `admin_notification`. `new_dining_booking` and `play_notification_sound` are **never emitted** by the backend. |
| New-order alert | The web plays a WAV ring right away, repeats it every **6 s for up to 120 s**, and shows a **180 s accept countdown that auto-rejects** the order when it reaches 0. It also polls `GET /food/restaurant/orders` every 8 s as a fallback. On the server, an order that stays `created` gets an automated phone call (default after 3 min), a second call 90 s later, and then an **auto-cancel** 90 s after that. All of these delays are admin-configurable. |
| Push | A native Android FCM token can be saved **with no backend change**. Use `platform:"mobile"` + `fcmToken` in verify-otp, and/or `POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId}`. New-order pushes are `notification`+`data` messages with `android.priority:"high"` and **`channel_id:"default"`**, so the app must create a channel with id `default` (give it the ringtone sound). |
| Downloads | `DownloadReport.jsx` is a **fake**: it has no API call and only shows a success tick. The only real "reports" are PDFs generated **on the device** with jsPDF: the finance statement (`HubFinance.jsx`) and the order receipt (`OrderDetails.jsx`). |
| Rate limit | The API limiter allows 100 requests per 15 minutes per user by default (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`; the local `.env` overrides these keys and the production values are unknown). The web panel's polling alone (orders every 8 s, bookings every 8 s, counts every 30 s, `/current` every 30 s, and more) is **well above 100 per 15 minutes**. The RN app must poll far less and rely on socket and push. |

---

## 1. Restaurant auth end to end

### 1.1 Routes (`core/auth/auth.routes.js`, mounted at `/v1/food/auth` and `/v1/auth`)

| Method & path | Line | Middleware |
|---|---|---|
| POST `/food/auth/restaurant/request-otp` | `auth.routes.js:30` | `authRateLimiter` (per IP, default 30 per 15 min) |
| POST `/food/auth/restaurant/verify-otp` | `auth.routes.js:31` | `authRateLimiter` |
| POST `/food/auth/refresh-token` | `auth.routes.js:45` | none |
| POST `/food/auth/logout` | `auth.routes.js:48` | none |
| GET `/food/auth/me` | `auth.routes.js:51` | `authMiddleware` |

### 1.2 Request OTP

- **DTO** (`dtos/auth/restaurantOtpRequest.dto.js`): `{ phone: string, 8–15 chars }`.
  - Unlike the user DTO, it does not enforce digits only. In practice the SMS provider still needs a valid Indian 10-digit number (see the user audit for `otp.service.js`).
- **Frontend**:
  - `restaurantAPI.sendOTP` (`services/api/index.js:689`) calls `requestRestaurantOtp` (`services/api/auth.js:253-259`). That function runs `normalizePhone()` and posts `{phone}`.
  - `pages/restaurant/auth/Login.jsx:119-131` sends `"+91 <10 digits>"`, which `normalizePhone` turns into digits. It then stores `sessionStorage.restaurantAuthData = {method:"phone", phone, isSignUp:false, module:"restaurant"}` and `sessionStorage.restaurantLoginPhone`, and navigates to `/food/restaurant/otp`.
- **Service**: `requestRestaurantOtp` (`core/auth/auth.service.js:351-360`).
  - It creates an OTP for **any** phone. There is no check that a restaurant exists.
  - The OTP is echoed back only when not in production or when `USE_DEFAULT_OTP` is on.
- **Response**: `{success:true, message:"OTP sent successfully", data:{phone, otp?}}` (`auth.controller.js:84-95`).

### 1.3 Verify OTP

- **DTO** (`dtos/auth/restaurantOtpVerify.dto.js`):

  ```json
  { "phone": "8-15 chars", "otp": "exactly 6 chars (string)", "fcmToken": "string|null optional",
    "platform": "web|mobile (default web)" }
  ```

- **Frontend**: `verifyRestaurantOtp` (`services/api/auth.js:261-271`) sends `fcmToken` and `platform` only when a token exists. `pages/restaurant/auth/OTP.jsx:131-155` collects the token as follows:
  - Inside the Flutter WebView, it asks the bridge handlers `getFcmToken`, `getFCMToken`, `getPushToken` and `getFirebaseToken`, and sets `platform="mobile"`.
  - Otherwise it reads `localStorage.fcm_web_registered_token_restaurant`.
- **Service**: `verifyRestaurantOtpAndLogin` (`auth.service.js:362-446`).
  1. `verifyOtp(phone, otp)`. If it fails, `AuthError` returns **401** with a message such as "Invalid OTP".
  2. It finds the restaurant by `ownerPhone`, `primaryContactNumber`, `ownerPhoneDigits` or `ownerPhoneLast10`. It matches the raw value, the digits-only value, the last 10 digits, and a "ends with last 10" regex (`:368-385`).
  3. **Not found** (`:387-392`): the response is `data:{needsRegistration:true, phone}`, with **no tokens**. Nothing is created.
  4. If `fcmToken` was sent and `platform==="mobile"`, the token is pushed into `fcmTokenMobile`; otherwise it goes into `fcmTokens` (`:395-412`). **This happens before the status check**, so pending and rejected restaurants also get their token saved.
  5. **Status gate** (`:415-426`): if `status !== "approved"` and the restaurant was created on or after **2026-05-26** (older restaurants count as "legacy" and skip this check), the response is

     ```json
     { "pendingApproval": true, "status": "pending|rejected", "isRejected": true|false, "rejectionReason": "...|null", "phone": "..." }
     ```

     with **no tokens**. An admin-blocked restaurant (`status:"rejected"`, reason `"Disabled by admin"`) also lands here.
  6. **Approved**: the service signs `{userId, role:"RESTAURANT"}`, stores the refresh token in `FoodRefreshToken`, and returns

     ```json
     { "token": "<access>", "accessToken": "<access>", "refreshToken": "<refresh>", "needsRegistration": false,
       "user": { "id", "name", "restaurantName", "phone", "email", "status", "profileImage", "createdAt" } }
     ```

     (`sanitizeRestaurantForAuthResponse`, `auth.service.js:54-72`). The envelope message is "Authentication successful".
- **Web routing after verify** (`OTP.jsx:155-213`):
  - `needsRegistration`: `setRestaurantPendingPhone(phone)`, then go to `/food/restaurant/onboarding`.
  - `pendingApproval`: `setRestaurantPendingPhone`, then go to `/food/restaurant/pending-verification` with state `{phone, isRejected, rejectionReason}`.
  - Tokens:
    1. `setAuthData("restaurant", accessToken, user, refreshToken)`, then dispatch `restaurantAuthChanged`.
    2. If the user came from the Signup page (`isSignUp`), go to onboarding.
    3. Otherwise run `isRestaurantOnboardingComplete(user)` (`utils/onboardingUtils.js:160`). If that is false, run `checkOnboardingStatus()`, which calls `GET /food/auth/me` and then the **non-existent** `GET /restaurant/onboarding` (404, see section 6).
    4. Otherwise go to `/food/restaurant` (the orders home).
  - Error path: a message that matches `/pending approval/i` also routes to the pending screen.

### 1.4 Signup and registration (an unregistered phone)

There is **no "pending restaurant" stub**. The flow is: OTP verify → `needsRegistration` → a three-step onboarding wizard (`pages/restaurant/Onboarding.jsx`, 2899 lines) → `POST /food/restaurant/register`.

- `Signup.jsx:113-125` only sends an OTP with `isSignUp:true`, then goes to the same OTP page.
- **Endpoint**: `POST /food/restaurant/register` (`modules/food/restaurant/routes/restaurant.routes.js:84`).
  - **No auth**: there is no Bearer token and no proof that the phone was OTP-verified (see section 6).
  - It uses multer `upload.fields` (`:75-82`).
- **Frontend**: `restaurantAPI.register(formData)` (`index.js:1075-1080`) goes through `restaurantClient` with a 300 s timeout. The form is built at `Onboarding.jsx:1628-1697`.

**Multipart file fields** (`restaurant.routes.js:75-82`):

| Field | Max | Sent by web? | Notes |
|---|---|---|---|
| `profileImage` | 1 | **yes (required by UI)** | Uploaded to storage by `uploadRestaurantImage` |
| `panImage` | 1 | **yes (required by UI)** | |
| `gstImage` | 1 | only if `gstRegistered` | |
| `fssaiImage` | 1 | **yes (required by UI)** | |
| `menuImages` | 10 | **no**: collected in step 2 but never appended (bug, section 6) | |
| `menuPdf` | 1 | **no**, same bug | Stored as a PDF in `food/restaurants/menu-pdf` |

Each file field can also be given as a URL string in the same body field. The service falls back to `payload.<field>` (`restaurant.service.js:429-475`).

**Text fields** (validator `validators/restaurant.validator.js:56-104`; the service is `registerRestaurant`, `restaurant.service.js:380-608`):

| Field | Rule |
|---|---|
| `restaurantName` | required, min 1 |
| `ownerName` | required, min 1 |
| `pureVegRestaurant` | **required** boolean-like (`"true"`, `"false"`, `"1"`, `"0"`, `"yes"` or `"no"`) |
| `ownerPhone` | 8–15 chars. Optional in the zod schema but **required in the service** (`:418`). It is stored as digits only. |
| `ownerEmail` | email or `""` |
| `primaryContactNumber` | 8–15 chars, optional |
| `zoneId` | ObjectId string, optional (the web requires it) |
| `addressLine1`, `addressLine2`, `area`, `city`, `state`, `pincode`, `landmark`, `formattedAddress`, `latitude`, `longitude` | strings (latitude and longitude are strings too) |
| `cuisines` | comma-separated string |
| `openDays` | comma-separated string (`"Monday,Tuesday"` or abbreviations) |
| `openingTime`, `closingTime` | `HH:mm` or `h:mm AM/PM`. They must differ. |
| `estimatedDeliveryTime` | free text, for example `"30-35 mins"` (parsed to minutes) |
| `panNumber` | must match `^[A-Z]{5}[0-9]{4}[A-Z]$`, or be `""` |
| `nameOnPan` | string |
| `gstRegistered` | `"true"` or `"1"`, otherwise false |
| `gstNumber`, `gstLegalName`, `gstAddress` | strings |
| `fssaiNumber`, `fssaiExpiry` | strings (the expiry is a date string) |
| `accountNumber`, `ifscCode`, `accountHolderName`, `accountType` | strings |

- **Duplicates**:
  - An existing record with the same `ownerPhoneDigits`, or the same normalized name plus last 10 digits, causes **400** "Restaurant with this name and owner phone already exists".
  - **Exception:** if the existing record is `rejected`, it is **deleted** and registration goes ahead (`:494-504`). See section 6.
- **Response**: **201** `{success, message:"Restaurant registered successfully", data:<the full restaurant document from toObject()>}` (`restaurant.controller.js:26-51`). The document is created with `status:"pending"` and `pendingUpdateReason:"New Registration"`.
  - Admins get a push, and an onboarding email with the T&C PDF is sent if there is an email address.
- **Web after register**: it stores `restaurant_pendingPhone` and goes to `/food/restaurant/pending-verification`.
- **Uploads during onboarding**: images are kept locally (IndexedDB `ONBOARDING_FILES_DB` plus `localStorage.restaurant_onboarding_data`) until final submit. They are then sent as multipart in the register call.
- **Already logged-in restaurant with incomplete onboarding** (`hasExistingRestaurantProfile`, `Onboarding.jsx:1559-1625`):
  1. Each image is first uploaded with `POST /uploads/image` (folders `food/restaurants/profile`, `/pan`, `/gst` and `/fssai`).
  2. Then it calls **`PATCH /food/restaurant/profile`** with a JSON body (the same fields, plus `location:{...}` and URL strings for the images), instead of register.
- **Zones in onboarding**: `GET /food/zones/public` and `GET /food/zones/detect?lat&lng` go through `userClient`, without a token. Address search uses Nominatim directly (`https://nominatim.openstreetmap.org/search`, `Onboarding.jsx:2186`), and the map uses the Google Maps JS loader.

### 1.5 Approval status, and how the web gates screens

**Model fields** (`modules/food/restaurant/models/restaurant.model.js`):

- `status`: enum `pending|approved|rejected`, default `pending` (`:277-281`).
- `approvedAt`, `rejectedAt`, `rejectionReason`, `pendingUpdateReason`.
- `isBanned`.
- `isAcceptingOrders` (`:128`): the online/offline toggle.
- `fcmTokens[]`, `fcmTokenMobile[]` and `pushDevices[{fcmToken, voipToken, pushPlatform, devicePlatform, appRole, deviceId, lastSeenAt}]` (`:192-211`).

There is no `isActive` field on restaurants.

**Admin actions** (for reference):

- `PATCH /food/admin/restaurants/:id/status {status|isActive}` (`admin.service.js:2723+`):
  - with false: `status:"rejected"`, `rejectionReason:"Disabled by admin"`, `isBanned:true`, `isAcceptingOrders:false`;
  - with true: `status:"approved"`.
- `PATCH /food/admin/restaurants/:id/reject` is the reject action.

**Re-approval on edit (important):**

- `updateRestaurantProfile` (`restaurant.service.js:841-1180`) sets `status:"pending"` together with a `pendingUpdateReason` on **every** non-empty update, even a cuisines-only change. Possible reasons include "Zone Update", "Financial Details Update", "Regulatory Documents Update", "Location/Address Update", "Menu Update", "Timings Update", "Photo/Banner Update", "Owner Details Update", "Dietary Category Update" and "Restaurant Name Change" (`:1150-1176`).
- `uploadRestaurantProfileImage` and `uploadRestaurantCoverImages` also set `status:"pending"` (`:1265`, `:1326`).
- A pending restaurant:
  - is removed from the customer listing (`listApprovedRestaurants` filter, `:1413-1420`);
  - cannot receive orders (`orders/services/order.service.js:155`, "Restaurant not accepting orders");
  - **cannot log in again** (verify-otp returns `pendingApproval`) until an admin approves it.
- Tokens it already holds keep working: `authMiddleware` and `requireRestaurant` never check status (`core/auth/auth.middleware.js:20-54`, `restaurant.routes.js:68-73`).
- **RN: warn the owner before any profile edit.**

**Web gates:**

1. `ProtectedRoute requiredRole="restaurant"` (`components/restaurant/RestaurantRouter.jsx:78-81`). This uses `isModuleAuthenticated('restaurant')`, the same rule as for users: the access token is unexpired with role `RESTAURANT`, or the refresh token is unexpired.
2. `RestaurantBlockGuard` (`components/restaurant/RestaurantBlockGuard.jsx:12-54`):
   - It calls `GET /food/restaurant/current` on mount and then **every 30 s**.
   - If `status==="rejected"` or `isActive===false`, it shows an "Account Blocked" screen with a Logout button. `isActive` never exists, and `rejectionReason` is not selected by `/current`, so the UI falls back to "Disabled by admin".
   - A 401 response clears auth and redirects to login.
   - A **pending** status is *not* blocked here.
3. `VerificationPending.jsx:30-75`:
   - When a token exists, it calls `/current`. If the status is `approved`, it goes to `/food/restaurant`. It re-checks when the page becomes visible.
   - Pending and rejected users normally have **no token** (verify-otp returned none), so the screen just waits. To re-check, the user must log in again with OTP. RN should offer a "Check status" action that re-runs the OTP login.
4. `isRestaurantOnboardingComplete` (`onboardingUtils.js:160-215`) treats a restaurant as complete when any of these hold:
   - it is legacy (created before 2026-05-26);
   - its status is `approved`;
   - it is pending **and** (`approvedAt` is set, or `pendingUpdateReason` is not `"New Registration"`);
   - the onboarding fields are present (heuristic).

### 1.6 Token storage (web), refresh, logout, /me

**Storage keys.** `setAuthData` and `clearModuleAuth` (`modules/Food/utils/auth.js`) use the same pattern as the user module (see section 1.4 of the user audit).

| Purpose | Legacy key | Namespaced key |
|---|---|---|
| Access token | `restaurant_accessToken` | `food:v1:auth:restaurant:accessToken` |
| Refresh token | `restaurant_refreshToken` | `food:v1:auth:restaurant:refreshToken` |
| Auth flag | `restaurant_authenticated` | `food:v1:auth:restaurant:authenticated` |
| Restaurant object | `restaurant_user` | `food:v1:auth:restaurant:user` |
| FCM token sent | `fcm_web_registered_token_restaurant` | `food:v1:auth-meta:fcm:restaurant` |
| Pending phone (pre-registration and pending) | `restaurant_pendingPhone` | `food:v1:auth-meta:restaurant:pendingPhone` (`auth.js:243-265`) |
| OTP handoff | `sessionStorage.restaurantAuthData`, `sessionStorage.restaurantLoginPhone` | |
| Onboarding draft | `localStorage.restaurant_onboarding_data` + IndexedDB (files) | |
| Pickup OTP being shown | `localStorage.restaurant_pickupOtpReveal` | |
| Notification permission asked | `localStorage.restaurant_notification_permission_asked` | |

- On logout, `clearRestaurantSessionCache()` (`auth.js:224-240`) also removes `restaurant_owner_contact`, `restaurant_onboarding`, `restaurant_onboarding_data`, `restaurant_invited_users`, `restaurant_schedule_off`, `restaurant_online_status`, `restaurant_outlet_timings`, `restaurant_hub_menu_active_tab`, `restaurant_name` and `restaurantName`.
- The socket hook reads the **legacy** key `restaurant_accessToken`, falling back to `accessToken` (`hooks/useRestaurantNotifications.js:646-647`).
- **Refresh**: this is the shared interceptor. It calls `POST /food/auth/refresh-token {refreshToken}` and gets back `{accessToken, refreshToken}` (the same refresh token, with no rotation). The refresh does **not** check restaurant status.
- **Logout**:
  - The web (`pages/restaurant/ExploreMore.jsx:575-616`) runs these steps in order:
    1. `DELETE /fcm-tokens/device/remove {deviceId, fcmToken, voipToken}`, only in the WebView;
    2. `DELETE /fcm-tokens/remove {token, platform}`;
    3. `POST /food/auth/logout {refreshToken, fcmToken, platform}` (`index.js:1059-1068`);
    4. `clearModuleAuth("restaurant")`.
  - The backend logout (`auth.service.js:~550-590`) pulls the FCM token from **all four** user collections and deletes the refresh-token document. It requires `refreshToken` or `fcmToken`.
  - `Onboarding.jsx:610-654` has the same logout sequence.
- **`GET /food/auth/me`** for RESTAURANT (`auth.service.js:604-656`) returns `data.user = {id, _id, name, restaurantName, cuisines, location:{addressLine1..landmark}|null, ownerName, ownerEmail, ownerPhone, primaryContactNumber, profileImage:{url}|null, menuImages:[{url,publicId:null}], coverImages:[], openingTime, closingTime, openDays, status, createdAt, updatedAt, rating, totalRatings}`.
  - It is used only by `restaurantAPI.getMe` → `checkOnboardingStatus`.
  - **Prefer `/food/restaurant/current`** (section 2.2), which is richer and is what screens use.
- **Delete account**: `DELETE /food/restaurant/account` (`restaurant.routes.js:234`).
  - It runs a transaction (`services/deleteAccount.service.js`) and returns `{success, message:"Account deleted successfully", data:null}`.
  - It is called from `EditOwner.jsx` and `ExploreMore.jsx:654`.
- **Forgot password / email login**: there are none. `restaurantAPI.login` always rejects (`index.js:1069`), and `ForgotPassword.jsx` is dead (section 6).

---

## 2. Every API call made by restaurant code

Client legend:

- **R** = `restaurantClient` (Bearer `restaurant_accessToken`, with refresh).
- **U** = `userClient` (sends the user token if present; these endpoints are public).
- **L** = legacy `apiClient` (picks the token by URL or `contextModule`, with **no refresh**).
- **X** = raw axios. The `/uploads/*` calls use the first token found among admin, restaurant, delivery and user; the endpoints themselves are **unauthenticated**.

All responses use the envelope `{success, message, data}` unless noted. Backend file paths are under `modules/food/restaurant/` unless noted.

### 2.1 Auth and onboarding (10)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 1 | POST `/food/auth/restaurant/request-otp` | R | `{phone}` | `{phone, otp?}` | `auth/Login.jsx:121`, `auth/Signup.jsx:113`, `auth/OTP.jsx:232` (resend) |
| 2 | POST `/food/auth/restaurant/verify-otp` | R | `{phone, otp, fcmToken?, platform?}` | tokens, `{needsRegistration}` or `{pendingApproval…}` (section 1.3) | `auth/OTP.jsx:155` |
| 3 | POST `/food/auth/refresh-token` | X | `{refreshToken}` | `{accessToken, refreshToken}` | `services/api/axios.js` interceptor |
| 4 | POST `/food/auth/logout` | L | `{refreshToken, fcmToken?, platform?}` | `{invalidated}` | `ExploreMore.jsx:595`, `Onboarding.jsx:642` |
| 5 | GET `/food/auth/me` | R | none | `{user}` (section 1.6) | `utils/onboardingUtils.js:246` |
| 6 | POST `/food/restaurant/register` | R (no auth needed) | multipart (section 1.4) | the full restaurant document | `Onboarding.jsx:1697` |
| 7 | GET `/food/zones/public` | U | none | the zone list | `Onboarding.jsx:1017,2263`, `EditOwner.jsx`, `ZoneSetup.jsx` |
| 8 | GET `/food/zones/detect?lat&lng` | U | none | the detected zone | `Onboarding.jsx:2226`, `ZoneSetup.jsx` |
| 9 | POST `/uploads/image` (falls back to `/uploads/single`, which 404s) | X | multipart `file`, `folder` | `{url, publicId:null}` | `Onboarding.jsx:1282`, `Inventory.jsx:1343`, `ItemDetailsPage.jsx:569,575`, `MenuCategoriesPage.jsx:172`, `UpdateBankDetails.jsx:129` |
| 10 | POST `/uploads/file` (PDF only) | X | multipart `file`, `folder` | `{url, publicId:null}` | `Onboarding.jsx:1304` |

### 2.2 Profile, outlet and availability (5)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 11 | GET `/food/restaurant/current` | R | none. Deduped, with a 3 s cache (`index.js:1350-1382`). | `{restaurant}` (see below) | `RestaurantBlockGuard.jsx:18` (every 30 s), the notifications hook `:319`, `OrdersMain.jsx` (6 calls), `RestaurantNavbar.jsx:138`, `AllOrdersPage`, `DeliverySettings`, `EditCuisines`, `EditOwner`, `EditRestaurantAddress`, `ExploreMore`, `Feedback`, `Inventory`, `ItemDetailsPage`, `OutletInfo`, `UpdateBankDetails`, `ZoneSetup`, `auth/VerificationPending` |
| 12 | PATCH `/food/restaurant/profile` | R | partial JSON; any of the fields below | `{restaurant}` (and **the status becomes `pending`**) | `EditCuisines.jsx:149`, `EditOwner.jsx:468`, `EditRestaurantAddress.jsx:177`, `OutletInfo.jsx:155`, `UpdateBankDetails.jsx:166`, `ZoneSetup.jsx:510`, `Onboarding.jsx:923,949,1617` |
| 13 | PATCH `/food/restaurant/availability` | R | `{isAcceptingOrders:boolean}` | `{restaurant}` | `DeliverySettings.jsx` |
| 14 | POST `/food/restaurant/profile/profile-image` | R | multipart **`file`** | `{profileImage:{url}}` (and the status becomes `pending`) | `OutletInfo.jsx:101`, `EditOwner.jsx:429` (which reads the wrong key, see section 6) |
| 15 | DELETE `/food/restaurant/account` | R | none | `null` | `EditOwner.jsx`, `ExploreMore.jsx:654` |

**`/current` → `restaurant`** (`restaurant.service.js:97-215`, with the select at `:611-668`):

```
{ id, _id, restaurantId, name, restaurantName, zoneId, cuisines[],
  location:{type, coordinates, latitude, longitude, formattedAddress, address, addressLine1, addressLine2, area, city, state, pincode, landmark}|null,
  ownerName, ownerEmail, ownerPhone, primaryContactNumber,
  panNumber, nameOnPan, panImage, gstRegistered, gstNumber, gstLegalName, gstAddress, gstImage,
  fssaiNumber, fssaiExpiry, fssaiImage, accountNumber, ifscCode, accountHolderName, accountType, upiId, upiQrImage,
  pureVegRestaurant, profileImage:{url}|null, coverImages:[{url,publicId}], menuImages:[{url,publicId}],
  openingTime, closingTime, openDays[], estimatedDeliveryTime, estimatedDeliveryTimeMinutes,
  diningSettings:{isEnabled,maxGuests,diningType}, isAcceptingOrders, status, approvedAt, pendingUpdateReason,
  createdAt, updatedAt, rating, totalRatings }
```

`rejectionReason` and `isBanned` are **not** returned.

**PATCH `/profile` accepted keys** (`restaurant.service.js:841-1148`):

- Identity: `restaurantName` (or `name`), `cuisines[]`, `zoneId`.
- Location: `location{formattedAddress, addressLine1…landmark, latitude, longitude, coordinates}`.
- Owner: `ownerName`, `ownerEmail`, `ownerPhone`, `primaryContactNumber`, `pureVegRestaurant`.
- Media: `profileImage`, `coverImages`, `menuImages`, `menuPdf` (URL strings or `{url}`).
- Timings: `openingTime`, `closingTime`, `openDays`, `estimatedDeliveryTime`.
- Tax and licences: `panNumber`, `nameOnPan`, `panImage`, `gstRegistered`, `gstNumber`, `gstLegalName`, `gstAddress`, `gstImage`, `fssaiNumber`, `fssaiExpiry` (must parse as a date), `fssaiImage`.
- Bank: `accountNumber`, `ifscCode`, `accountHolderName`, `accountType`, `upiId`, `upiQrImage` / `upiQrCode`.

The route has an `invalidateCache('restaurants:*'|'restaurant_detail:*')` pre-hook (`restaurant.routes.js:98-103`).

### 2.3 Orders lifecycle (4, plus 2 dining booking calls and 1 dining-settings call = 7)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 16 | GET `/food/restaurant/orders` | R | `?page&limit(≤100, default 30)&status`. `status` is one of `new` (`created`+`confirmed`), `preparing`, `ready`/`ready_for_pickup`, `out_for_delivery`/`picked_up`, `scheduled`, `completed`/`delivered`, `cancelled` or `all` (`order.service.js:1136-1180`). `search` is **ignored** by the backend. | `{orders[], meta, pagination, total}` (`order.controller.js:160-174`). Each order is `normalizeOrderForClient` + `orderMongoId` + **`pickupOtp`** + populated `userId{name,phone,email,profileImage}`. Only paid, cash, wallet or `razorpay_qr` orders are included (`order.service.js:1183-1217`). The FE remaps the status: `created→confirmed`, `ready_for_pickup→ready`, `picked_up→out_for_delivery`, `*cancel*→cancelled` (`index.js:901-978`). | notifications hook (8 s poll), `OrdersMain.jsx` (popup check every 60 s, counts every 30 s), `hooks/usePaginatedRestaurantOrders.js:39` (New tab every 15 s, or 45 s while the socket is up), `AllOrdersPage`, `Notifications.jsx`, `Feedback.jsx` (`status:'delivered'`), `RestaurantNavbar.jsx:70` (search) |
| 17 | GET `/food/restaurant/orders/:orderId` | R | Mongo `_id` or `order_id` | `{order}` | `OrderDetails.jsx` |
| 18 | PATCH `/food/restaurant/orders/:orderId/status` | R | `{orderStatus, note?}`. `orderStatus` is one of `confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `delivered` or `cancelled_by_restaurant` (`orders/validators/order.validator.js:129-146`). The status can only move forward (`isStatusAdvance`, `order.helpers.js:487`); cancel is allowed until delivered. | `{order}` | `OrdersMain.jsx` via `acceptOrder` (sends `preparing`, and retries with `confirmed` on 400, `index.js:1010-1028`), `rejectOrder` (`cancelled_by_restaurant` + `note`), `markOrderReady` (`ready_for_pickup`). **The prep time chosen in the accept popup is never sent** (`_prepTimeMins` is unused). `OrdersMain.jsx:3826-3895` also **auto-marks orders ready** once `estimatedDeliveryTime` (default 30 min) has passed since `tracking.preparing.timestamp`, checking every 2 s. |
| 19 | POST `/food/restaurant/orders/:orderId/resend-notification` | R | `{voipToken:""}` | the dispatch result (it re-offers the order to riders) | `components/restaurant/ResendNotificationButton.jsx:22` |
| 20 | GET `/food/dining/bookings/restaurant/:restaurantId` | R | none | the bookings list | `OrdersMain.jsx` (every 8 s, `:674`) |
| 21 | PATCH `/food/dining/bookings/:bookingId/status` | R | `{status}` | the booking | `OrdersMain.jsx` |
| 22 | GET `/food/restaurant/dining-settings/pending` | R | none | the pending dining request | `OrdersMain.jsx` |

What a status change triggers on the server (`order.service.js:1219-1430`):

- It emits `order_status_update` to `restaurant:<id>`, `user:<id>`, and the rider room if a rider is assigned.
- It sends FCM to the user, the restaurant and the rider.
- `confirmed` or `preparing` (coming from `created`) **starts the rider dispatch** (`tryAutoAssign`).
- `ready_for_pickup` emits `order_ready` to the assigned rider.
- Cancel settles the finance and clears the rider offers.

**Pickup OTP / handover:**

- When a rider taps "Request OTP", the server sets `deliveryVerification.pickupOtp.requestedAt`.
- It emits `pickup_otp_reveal {orderMongoId, orderId, otp, message}` to `restaurant:<id>` and sends an FCM "OTP Requested" whose body contains the OTP (`orders/services/order-delivery.service.js:935-960`).
- The restaurant only **displays** the OTP: `GlobalPickupOtpModal.jsx`, fed by the socket or by the 8 s poll fallback, which picks orders with `pickupOtp` + `requestedAt` within 15 minutes + not verified (`useRestaurantNotifications.js:409-445`).
- The rider enters the OTP, so there is no restaurant endpoint for verifying it.

### 2.4 Menu: categories, items, variants and add-ons (13)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 23 | GET `/food/restaurant/menu` | R | none | `{menu:{sections:[{…, items[], subsections:[]}], categories[]}}`, built from `food_items` (`services/restaurantMenu.service.js:106-115`) | `Inventory.jsx:978,1063`, `ItemDetailsPage.jsx:190` |
| 24 | GET `/food/restaurant/categories` | R | `?compact&limit=1000` or `?includeInactive&withCounts&limit=1000` | the categories (the same controller as the public list, but restaurant-scoped when authenticated) | `ItemDetailsPage.jsx:245`, `MenuCategoriesPage.jsx:85` |
| 25 | POST `/food/restaurant/categories` | R | `{name, type, image(url), isActive, sortOrder, foodTypeScope}` | `{category}` | `MenuCategoriesPage.jsx:190` |
| 26 | PATCH `/food/restaurant/categories/:id` | R | the same fields, partial (for example `{isActive}`) | `{category}` | `MenuCategoriesPage.jsx:187,225` |
| 27 | DELETE `/food/restaurant/categories/:id` | R | none | the result | `MenuCategoriesPage.jsx:211` |
| 28 | POST `/food/restaurant/foods` | R | `{name, description, price?, variants:[{name, price}], image(url), foodType, isAvailable, isRecommended, preparationTime, categoryId?, categoryName}` | `{food}`. It is created with **`approvalStatus:"pending"`** (admin approval) and admins are notified. | `ItemDetailsPage.jsx:673` |
| 29 | POST `/food/restaurant/foods/bulk` | R | an array of food objects (or `{items}`) | the bulk results | `Inventory.jsx:962` |
| 30 | PATCH `/food/restaurant/foods/:id` | R | partial food. Stock toggle: `{isAvailable}`. Recommended toggle: `{isRecommended}`. | `{food}` | `ItemDetailsPage.jsx:696`, `Inventory.jsx:1732,1741,1973` |
| 31 | DELETE `/food/restaurant/foods/:id` | R | none | the message | `Inventory.jsx:1999` |
| 32 | GET `/food/restaurant/addons` | R | `?page&limit(≤100)&status(pending\|approved\|rejected)&search&includeDeleted` | the paginated add-ons | `Inventory.jsx:1210` |
| 33 | POST `/food/restaurant/addons` | R | `{name, description?, price, image?, images[]?}` (`validators/addon.validator.js:4-10`) | `{addon}` (admin approval) | `Inventory.jsx:1358` |
| 34 | PATCH `/food/restaurant/addons/:id` | R | `{draft:{…partial}}` to edit, or `{isAvailable}` to toggle stock | `{addon}` | `Inventory.jsx:1355,1401` |
| 35 | DELETE `/food/restaurant/addons/:id` | R | none | the result | `Inventory.jsx:1387` |

Food-item variants accept `variants` or `variations`, each `{name, price}`. When variants are present, the display price is derived from them (`services/restaurantFood.service.js:99-111`).

### 2.5 Offers and promocodes (4): `routes/promocodeRoutes.js` (`authMiddleware` + `requireRoles('RESTAURANT','ADMIN')`)

| # | Method & path | Request | Response | Calling file |
|---|---|---|---|---|
| 36 | GET `/food/promocodes` | none | `{promocodeList[]}` | `Promocodes.jsx` |
| 37 | POST `/food/promocodes` | `{code, description, discountType, discountValue, minOrderAmount?, maxDiscountAmount?, expiryDate, usageLimit?}`. The required fields are code, description, discountType, discountValue and expiryDate (`controllers/promocodeController.js:30-60`). | 201 `{promocode}`. A duplicate code returns 400. | `Promocodes.jsx` |
| 38 | PATCH `/food/promocodes/:id` | `{isActive}` | `{promocode}` | `Promocodes.jsx` |
| 39 | DELETE `/food/promocodes/:id` | none | **204, empty body** | `Promocodes.jsx` |

### 2.6 Ratings, reviews and complaints (1 real)

| # | Method & path | C | Request | Response | Calling file |
|---|---|---|---|---|---|
| 40 | GET `/food/restaurant/complaints` | R | `?page&limit…` | `{complaints, total, page, limit}` (`admin/services/admin.service.js:124-168`) | `Feedback.jsx` |

`RatingsReviews.jsx` and `DishRatings.jsx` have **no API**; they show static or mock data. The only rating figures available are `rating` and `totalRatings` on `/current` and the dashboard stats.

### 2.7 Finance, earnings, withdrawals and bank (4, plus bank details via #12)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 41 | GET `/food/restaurant/finance` | R | `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (optional; enables `pastCycles`) | `{restaurant:{name, restaurantId:"REST…", address}, currentCycle:{start, end, totalOrders, totalEarnings, orders[…]…}, invoiceSummary, pastCycles:{orders[{orderId, createdAt, items, foodNames, orderTotal, totalAmount, payout, commission, paymentMethod, orderStatus, status}], totalOrders}}` (`services/restaurantFinance.service.js:147-205`) | `HubFinance.jsx:40,302,1279` |
| 42 | GET `/food/restaurant/dashboard-stats` | R | `?period` (default `month`) | `{period, restaurant:{name, isOnline, status, averageRating, totalRatings, joinedAt}, kpis:{totalOrders, todayOrders, pendingOrders, processingOrders, deliveredOrders, cancelledOrders, totalRevenue, availableBalance, cycleEarnings, averageOrderValue, averageRating, totalRatings, menuItems, activeMenuItems, approvedMenuItems, addons, complaints, completionRate, cancellationRate}, orderStatusBreakdown, paymentMethodBreakdown, revenueTrend, monthlyTrend, topItems, recentOrders}` (`services/restaurantDashboard.service.js:85-370`) | `RestaurantDashboard.jsx` |
| 43 | POST `/food/restaurant/withdraw` | R | `{amount, requestId}`. `requestId` = `restaurant-<amount>-<floor(now/10s)>` is the idempotency key; an `Idempotency-Key` header also works. `moneyRateLimiter`: 20 per 10 min. | 201 `<withdrawal>`, or 200 for a duplicate. "Insufficient balance. Available: ₹X" returns 400. | `HubFinance.jsx:1273` |
| 44 | GET `/food/restaurant/withdrawals` | R | none | `<withdrawal[]>` (the array is `data` itself) | `HubFinance.jsx:63,1283`, `WithdrawalHistoryPage.jsx` |

- **Bank details**: these are updated through `PATCH /food/restaurant/profile` (#12) with `{accountHolderName, accountNumber, ifscCode, upiId, upiQrImage}` (`UpdateBankDetails.jsx:166`). The UPI QR image is first uploaded with `/uploads/image` folder `food/restaurants/upi-qr`. This also triggers re-approval.
- `FinanceDetailsPage.jsx` has no API; it renders router state.

### 2.8 Outlet timings, rush hour and delivery settings (2, plus #13)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 45 | GET `/food/restaurant/outlet-timings` | R | none | `{outletTimings:{Monday:{isOpen, openingTime, closingTime}, …}}`. It falls back to the onboarding `openDays`/`openingTime`/`closingTime` (`services/outletTimings.service.js:52-82`). | `OutletTimings.jsx` |
| 46 | PUT `/food/restaurant/outlet-timings` | R | `{outletTimings:{<DayName>:{isOpen, openingTime:"HH:mm", closingTime:"HH:mm"}}}`. Days that are missing default to open 09:00–22:00. | `{outletTimings}` | `OutletTimings.jsx` |

- `DeliverySettings.jsx` uses #11 and #13 (the online toggle).
- `RushHour.jsx` and `DaySlots.jsx` have **no backend**: DaySlots saves to `localStorage` only, and RushHour saves nothing.
- The "schedule off" feature in `ExploreMore.jsx` is local-only (`restaurant_schedule_off`).

### 2.9 Notifications inbox (4): `/food/notifications` (`requireRoles('USER','RESTAURANT','DELIVERY_PARTNER')`)

| # | Method & path | Notes | Calling file |
|---|---|---|---|
| 47 | GET `/food/notifications/inbox?page=1&limit=50` | L with `contextModule:'restaurant'` → `{items[], pagination, unreadCount}` | `hooks/useNotificationInbox.js:33` (`Notifications.jsx`, navbar) |
| 48 | PATCH `/food/notifications/:id/read` | | `useNotificationInbox.js:79` |
| 49 | DELETE `/food/notifications/:id` | | `useNotificationInbox.js:96` |
| 50 | DELETE `/food/notifications/inbox/all` | | `useNotificationInbox.js:109` |

The response shapes are in section 3.10 of the user audit.

### 2.10 Push and FCM (6)

| # | Method & path | C | Request | Calling file |
|---|---|---|---|---|
| 51 | POST `/fcm-tokens/save` | R | `{token, platform:'web'}` (deduped for 24 h, `index.js:88-131`) | `utils/firebaseMessaging.js:509-510` (called by `registerWebPushForCurrentModule` on every route change, `routes.jsx:59`) |
| 52 | POST `/fcm-tokens/mobile/save` | R | `{token, platform:'mobile'}` | the same function, when `platform==='mobile'` |
| 53 | POST `/fcm-tokens/device/save` | R | `{fcmToken\|token, voipToken?, pushPlatform:'mobile'\|'web', devicePlatform:'ios'\|'android'\|'web', deviceId?}` | `firebaseMessaging.js:527-528` (WebView bridge) |
| 54 | DELETE `/fcm-tokens/remove` | R | body and query `{token, platform}` | `ExploreMore.jsx:589`, `Onboarding.jsx:636` |
| 55 | DELETE `/fcm-tokens/device/remove` | R | `{deviceId, fcmToken, voipToken}` | `ExploreMore.jsx:581` |
| 56 | POST `/fcm-tokens/test` | R | `{platform, channel:'fcm'\|'voip'}` | `ExploreMore.jsx:696` |

### 2.11 Support and feedback (3)

| # | Method & path | C | Request | Response | Calling file |
|---|---|---|---|---|---|
| 57 | POST `/food/restaurant/support/tickets` | R | `{category:'orders'\|'payments'\|'menu'\|'restaurant'\|'technical'\|'other', issueType (required), subject, description, orderRef\|orderId, priority:'low'\|'medium'\|'high'}` | 201 `{ticket}` | `RestaurantSupport.jsx` |
| 58 | GET `/food/restaurant/support/tickets` | R | `?page&limit(≤100)&status&search` | `{tickets, total, page, …}` | `RestaurantSupport.jsx` |
| 59 | POST `/food/restaurant/feedback-experience` | L (restaurant token, chosen by URL) | `{rating:1-5, module:'restaurant', comment}` | the created feedback | `ShareFeedback.jsx:37` |

### 2.12 CMS and config (3, public)

| # | Method & path | Calling file |
|---|---|---|
| 60 | GET `/food/pages/privacy` | `PrivacyPolicyPage.jsx:17` (production returned 200) |
| 61 | GET `/food/pages/terms` | `TermsAndConditionsPage.jsx:17`. Production currently returns `data:null`. |
| 62 | GET `/food/admin/business-settings/public` | `utils/businessSettings.js:106` via `useCompanyName` (8 restaurant files). Production returned 200. |

### 2.13 Screens with no backend (UI mocks; decide whether to port)

- `DownloadReport.jsx` (section 5)
- `RatingsReviews.jsx`
- `DishRatings.jsx`
- `FssaiDetails.jsx`
- `FssaiUpdate.jsx`: it has a file picker but never saves. Updating FSSAI really means sending #12 with `fssaiNumber`, `fssaiExpiry` and `fssaiImage`.
- `Hyperpure.jsx`
- `ManageOutlets.jsx`
- `PhoneNumbersPage.jsx`
- `FinanceDetailsPage.jsx`
- `RushHour.jsx`
- `DaySlots.jsx` (localStorage only)

### 2.14 restaurantAPI methods that exist but are not called by restaurant screens

| Method | Endpoint | Status |
|---|---|---|
| `updateDiningSettings` | PATCH `/food/restaurant/dining-settings` | works |
| `requestDiningUpdate` | POST `/food/restaurant/dining-settings/request` | works |
| `uploadMenuImage` | POST `/food/restaurant/profile/menu-image` | `file`, returns `{menuImage:{url}}`, does not attach |
| `uploadCoverImages` | POST `/food/restaurant/profile/cover-images` | `files[]` up to 20, returns `{coverImages[], profileImage?}`, and the status becomes pending |
| `uploadMenuImages` | POST `/food/restaurant/profile/menu-images` | `files[]` up to 20, returns `{menuImages[]}` |
| `updateMenu` | PATCH `/food/restaurant/menu` | **always 400** "Menu editing is disabled" (`restaurantMenu.service.js:117-121`) |

`GET /food/restaurant/download-menu-pdf/:id` exists (owner or admin), but the frontend only calls the admin variant.

---

## 3. Realtime for restaurants

### 3.1 Socket.IO

- **Client**: `hooks/useRestaurantNotifications.js`. One connection is provided by `RestaurantNotificationProvider` (`context/RestaurantNotificationContext.jsx`) inside `RestaurantLayout`.
- **URL**: `resolveSocketOrigin()` (`:606`), the same as for users. In production it is `https://cityfood.co.in` with path `/socket.io/`.
- **Options** (`:657-672`): `transports:['websocket','polling']`, infinite reconnection with a 1–5 s delay, `timeout:20000`, `auth:{token}`, `query:{token}`.
  - The token comes from `localStorage.restaurant_accessToken`.
  - **It is not refreshed on `authRefreshed`** (unlike the user socket manager). With 365-day tokens this is low risk.
- **Server auth** (`config/socket.js:59-101`): the token is read from `auth.token`, then the Bearer header, then `?token`. A failure gives `connect_error` `AUTH_MISSING` or `AUTH_INVALID`.
- **Rooms**: a RESTAURANT socket is **auto-joined** to `restaurant:<restaurantId>` on connect (`socket.js:125-128`).
  - The client also emits `join-restaurant <restaurant _id>` on connect, retries it after 2 s, and sends it again on reconnect (`:674-700`).
  - The server checks that the id equals the JWT `userId` and replies `restaurant-room-joined {room, restaurantId}` (`socket.js:149-155`).
  - The restaurant id comes from `GET /food/restaurant/current` → `restaurant._id`.

**Events the client listens to:**

| Event | Emitted by (backend) | Payload | Web behaviour |
|---|---|---|---|
| `new_order` | `notifyRestaurantNewOrder`, `orders/services/order.helpers.js:418-466`. Only for cash or wallet orders, or once payment is captured. | The full order document plus `orderMongoId` and `orderId` (the `order_id` display id) | Skipped if scheduled more than 15 min ahead. Otherwise queued and alerted (section 3.2). |
| `order_status_update` | `order.service.js:1265-1290` and other places | `{orderMongoId, orderId, orderStatus, deliveryState, deliveryVerification, dispatch, title, message}` (an admin assignment also carries `updatedBy:"ADMIN"`) | A cancel removes the order from the alert queue and records it so polling does not revive it. Dispatches the window event `restaurantOrderStatusUpdate`. `OrdersMain.jsx:1622-1660` toasts "Order canceled by user" or "Order assigned by admin to you". |
| `pickup_otp_reveal` | `orders/services/order-delivery.service.js:946` | `{orderMongoId, orderId, otp, message}` | Shows `GlobalPickupOtpModal` and persists it to `localStorage.restaurant_pickupOtpReveal` |
| `admin_notification` | `admin/services/notificationBroadcast.service.js:212` | `{title, message, …}` | Refreshes the inbox |
| `restaurant-room-joined` | `socket.js:154` | `{room, restaurantId}` | Logged only |
| `new_dining_booking` | **never emitted** | | dead listener |
| `play_notification_sound` | **never emitted** | | dead listener |

- **Events the client emits:** only `join-restaurant`. A `resync` exists on the server but is not used by the restaurant client.
- The hook also listens for `reconnect` and `reconnect_attempt` on the *socket*. In socket.io v4 those are Manager events, so they never fire. The re-join actually happens through `connect`.

### 3.2 How new-order alerts work on the web

- **Sources**:
  - the socket event `new_order`;
  - the REST fallback **poll every 8 s**: `GET /food/restaurant/orders?page=1&limit=30`, keeping status `confirmed` (which includes backend `created`), skipping cancelled ids, with scheduled orders included only if due within 30 min. The poll takes the 5 newest (`useRestaurantNotifications.js:337-456`).
- **Dedupe**: one alert per order key per 15 s (`ALERT_DEDUPE_MS`). Socket events bypass the dedupe; this is intentional so that "resend" rings again.
- **Sound** (`:225-305, :847-920`):
  - The asset is `@food/assets/audio/restaurant-order-ring.wav`. It plays immediately, then **repeats every 6 s (`ALERT_LOOP_INTERVAL_MS`) for at most 120 s (`ALERT_LOOP_MAX_MS`)**, or until the order is accepted, rejected or cancelled.
  - It also calls `navigator.vibrate([200,100,200,100,300])`.
  - The web plays audio **only on desktop width (≥768 px)**; on mobile web it only vibrates.
  - The Flutter native bridge sound (`triggerWebViewNativeNotification`) is **commented out**.
- **Background tab**: a service-worker `showNotification` with title "New order #…", body "N items - ₹total" and tag `restaurant-order-<id>` (deduped for 20 s).
- **Accept popup** (`OrdersMain.jsx:1146-1210, 1844-1874`):
  - It has a prep-time stepper (default 11 min, **not sent** to the backend) and a **180 s countdown**.
  - When the countdown reaches 0, the web calls `rejectOrder(id, "No response from restaurant (Auto-rejected)")`, which sends `cancelled_by_restaurant`.
- **Server-side escalation** (independent of the app):
  - `orders/services/order-call-alert.service.js`: for orders still `created`, an automated voice call (OBD) is placed after `delayMinutes` (default 3). A secondary call follows `escalationDelaySeconds` (default 90) later. Then the order is **auto-cancelled** after `autoCancelDelaySeconds` (default 90), if `autoCancelEnabled` (the default).
  - `admin/services/restaurantDelayAlert.service.js` alerts admin devices after `delayMinutes` (default 5), when that feature is enabled.

**RN recommendation:** play a looping ringtone through a foreground notification or full-screen intent while the order is `created`, and keep the 180 s countdown. Poll `status=new` only when the socket is down, and no more often than every 30 s, because of the 100 requests per 15 minutes limit.

### 3.3 FCM and web push for the restaurant role

- **Web**: `registerWebPushForCurrentModule(pathname)` runs on route change (`modules/Food/routes.jsx:59`). For a restaurant path, it calls `restaurantAPI.saveFcmToken(token, 'web')` (#51), or `savePushDevice` (#53) when inside the Flutter WebView (`utils/firebaseMessaging.js:507-536`).
  - `firebaseMessaging.js:628-631` deliberately does **not** play the generic FCM sound inside the restaurant panel; the socket and popup own the ringtone.
- **Backend storage**: `upsertFirebaseDeviceToken` writes `fcmTokens` (web) or `fcmTokenMobile` (mobile). `upsertOwnerPushDevice` writes `pushDevices[]` **and** adds the token to `fcmTokenMobile` when `pushPlatform:'mobile'` (`core/notifications/firebase.service.js:312-368`). `ownerType` comes from the JWT role `RESTAURANT` (`fcm.routes.js:17-35`).
- **New-order push** (`order.helpers.js:440-457` → `core/notifications/voip.service.js:324-352`):
  - `sendUrgentOrderNotificationToOwner` sends iOS VoIP to `pushDevices` with `devicePlatform:'ios'` and a `voipToken`.
  - It sends FCM to the Android `pushDevices` tokens merged with the legacy `fcmTokens` and `fcmTokenMobile`.
  - The message (`firebase.service.js:150-230`):
    - `notification:{title:"New order received", body:"Order #<id> is waiting for review."}`;
    - `data:{type:"new_order", orderId:<mongoId>, orderMongoId, link:"/restaurant/orders/<id>", title, body}`;
    - `android:{priority:"high", notification:{channel_id:"default", default_vibrate_timings, default_light_settings}}`. The sound line is commented out, so the sound comes from the channel.
  - It is **not data-only**, so a killed Android app shows it through the system tray on channel `default`. Give that channel the ringtone sound and high importance.
- **Other restaurant pushes**: all go through `notifyOwnersSafely` → `listOwnerTokens` (`fcmTokens` + `fcmTokenMobile`).
  - Order status updates: `data.type:"order_status_update"`, `orderId`, `orderStatus`, `link:/food/user/orders/<id>`. The link points to the user route.
  - Pickup OTP request: the body contains the OTP.
  - Admin broadcasts.
  - The title gets an owner-type prefix (`OWNER_APP_PREFIXES`).
- **Can a native FCM token be saved without backend changes? Yes.** Any of these works:
  1. `POST /food/auth/restaurant/verify-otp {phone, otp, fcmToken:<FCM>, platform:"mobile"}`. This goes into `fcmTokenMobile` and is saved even for pending accounts.
  2. After login: `POST /fcm-tokens/device/save {fcmToken:<FCM>, pushPlatform:"mobile", devicePlatform:"android", deviceId:<stable id>}`. This is preferred: it fills `pushDevices` and `fcmTokenMobile`.
  3. `POST /fcm-tokens/mobile/save {token:<FCM>}`.
  - On logout, call `DELETE /fcm-tokens/device/remove {deviceId, fcmToken}` and then `POST /food/auth/logout {refreshToken, fcmToken, platform:"mobile"}`.
  - On a token refresh, call `device/save` again.
- **APNs VoIP (iOS only; ignore for the Android build).**
  - Env key names read by `core/notifications/voip.service.js` and `config/env.js`:
    - `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_AUTH_KEY_PATH`, `APNS_VOIP_P8_PATH`, `APNS_PRODUCTION`;
    - `APNS_VOIP_TOPIC_RESTAURANT` (alias `APNS_TOPIC_RESTAURANT`), `APNS_VOIP_TOPIC_DELIVERY` (alias `APNS_TOPIC_DELIVERY`), `APNS_VOIP_TOPIC` (alias `APNS_TOPIC`);
    - `APNS_VOIP_PFX_PATH`, `APNS_VOIP_CERT_PATH`, `APNS_VOIP_CERT_PASSWORD`, `VOIP_CERT_PASSWORD`.
  - VoIP is sent only to `pushDevices` entries with `devicePlatform:'ios'`, `pushPlatform:'mobile'` and a `voipToken`.
  - **For Android, never send `voipToken`.**

---

## 4. File uploads

| What | Endpoint | Multipart field(s) | Auth | Result / follow-up |
|---|---|---|---|---|
| Registration documents and images | POST `/food/restaurant/register` | `profileImage`, `panImage`, `gstImage`, `fssaiImage` (1 each), `menuImages` (≤10), `menuPdf` (1), plus the text fields | none | The URLs are stored on the new restaurant |
| Profile/logo image | POST `/food/restaurant/profile/profile-image` | **`file`** | R | `data.profileImage.url`. The image is saved on the restaurant and the **status becomes pending**. |
| Cover/banner images | POST `/food/restaurant/profile/cover-images` | **`files`** (≤20) | R | `data.coverImages[]`. They are appended, and the status becomes pending. Not used by the web. |
| Menu photos (gallery) | POST `/food/restaurant/profile/menu-images` | **`files`** (≤20) | R | `data.menuImages[]`. Not used by the web. |
| One menu image | POST `/food/restaurant/profile/menu-image` | **`file`** | R | `data.menuImage.url`, not attached. Not used by the web. |
| Menu item, category or add-on images; UPI QR; documents after login (PAN, GST, FSSAI, profile in edit mode) | POST `/uploads/image` | **`file`** + `folder` text field. Folders used by the web: `food/categories`, `tuggo/restaurant/addons`, `food/restaurants/{profile,pan,gst,fssai,upi-qr}`, plus the ItemDetails folder. | **none** | `data.url`. Pass the URL in the next JSON call (#12, #25/26, #28/30, #33/34). |
| Menu PDF (onboarding edit mode) | POST `/uploads/file` | **`file`** (PDF only) + `folder` | none | `data.url` |

- The multer memory storage has no size or type limit; images are converted by sharp. See section 7 of the user audit for the storage details (Cloudinary, or local `/uploads/...`; a local URL is relative, so prefix it with `https://cityfood.co.in`).
- RN: send `{uri, name, type}` parts and let fetch or axios set the multipart boundary. The web client removes `Content-Type` for FormData.
- Bank documents: there is no bank-document upload. Bank changes are the text fields in #12, plus the optional `upiQrImage` URL.

---

## 5. Report downloads

- **`DownloadReport.jsx` (route `/food/restaurant/download-report`) is UI only.**
  - The user picks the report view (`detailed` / `item`), the period type (`DAILY` / `WEEKLY` / `MONTHLY`) and a range (7/14/30 days, 4/8/12 weeks, 3/6/12 months, or custom). `handleSend` then only shows a "success" check for 2 s (`DownloadReport.jsx:52-55`).
  - It makes **no request**, there is **no backend endpoint**, and **no file** is produced. There is a "Mail" icon, but nothing is emailed.
- The real exports are all **generated on the client**:
  - **Finance statement PDF** (`HubFinance.jsx:560-680`):
    1. Fetches `GET /food/restaurant/finance?startDate&endDate` (#41).
    2. Renders HTML into a hidden iframe.
    3. Converts it with `html2canvas` (scale 2) and then `jsPDF('p','mm','a4')`, paging the image.
    4. Saves it with `pdf.save("finance-report-<range>_<YYYY-MM-DD>.pdf")`, which triggers a browser download.
  - **Order receipt PDF** (`OrderDetails.jsx:327-586`): `jsPDF` + `jspdf-autotable`, saved as `Order_Receipt_<id>.pdf`.
  - **Thermal KOT/bill print** (`OrdersMain.jsx:2280-2315`): HTML in an iframe, then `contentWindow.print()`.
- There are no CSV or XLSX exports for restaurants.
- RN equivalent: build the PDF on the device (for example `expo-print` from HTML) and share it with `expo-sharing`. Alternatively, ask the backend team for a server-side report endpoint.

---

## 6. Broken or dead call sites, and backend issues (listed, not fixed)

### Frontend: broken or dead

1. **`restaurantAPI.reverify()` is undefined.** `OrdersMain.jsx:1487` would throw a TypeError. Only `deliveryAPI.reverify` exists (`index.js:1703`).
2. **`restaurantAPI.resetPassword` is undefined, and `verifyOTP(null, …, email)` rejects.** `auth/ForgotPassword.jsx:108,174` is a dead email/password flow; restaurants use phone OTP only.
3. **`GET /restaurant/onboarding` returns 404** (it does not exist; verified in production). It is called by `checkOnboardingStatus` (`utils/onboardingUtils.js:258`). The error is swallowed.
4. **Menu images and menu PDF are never sent at registration.** They are collected in onboarding step 2 and persisted to IndexedDB, but `Onboarding.jsx:1628-1697` never appends `menuImages` or `menuPdf`.
5. **`EditOwner.jsx:430` reads the wrong key.** It reads `data.image` from the profile-image upload, but the backend returns `data.profileImage`. `OutletInfo.jsx:102` reads it correctly.
6. **The prep time is ignored.** `acceptOrder(orderId, prepTime)` drops it (`index.js:1010`). The web instead auto-marks orders ready when `estimatedDeliveryTime` (or 30 min) elapses, client side (`OrdersMain.jsx:3826-3895`).
7. **`restaurantAPI.getRestaurantByOwner` is a hard-coded stub** that returns "Your Restaurant / REST000001" (`index.js:708-720`). It is used by `HubFinance.jsx:92`.
8. **Dead socket listeners:** `new_dining_booking` and `play_notification_sound` (never emitted). The `reconnect` and `reconnect_attempt` socket listeners never fire in socket.io v4.
9. **The order search sends a `search` param** (`RestaurantNavbar.jsx:70`), and `listOrdersRestaurant` ignores it.

Also note:

- `DownloadReport.jsx` and the other UI-only screens (section 2.13).
- `RestaurantBlockGuard` checks `isActive` (which does not exist) and `rejectionReason` (which `/current` does not return).
- `restaurantAPI` defines `getOrderById` and `getPublicOffers` twice; the later definitions win.
- `/uploads/single` (the upload fallback) is a 404.
- `restaurantAPI.updateMenu` always returns 400.

### Backend issues

1. **Registration is unauthenticated and does not verify phone ownership.** Anyone can register any phone number as owner (`restaurant.routes.js:84`). The full restaurant document, including bank fields, is returned in the response.
2. **Re-registering deletes `rejected` restaurants** (`restaurant.service.js:494-504`). Admin "block" is stored as `rejected`, so a **blocked restaurant can call `/register` again**. Its old record is hard-deleted (which orphans its orders and finance), and a fresh pending record is created.
3. **Every profile edit or image upload resets an approved restaurant to `pending`.** The outlet disappears from customers and cannot take orders, and the owner **can no longer log in** until an admin re-approves. Existing tokens keep working.
4. **Pending and blocked status is not enforced on API calls.** `authMiddleware`/`requireRestaurant` and refresh never check `status` or `isBanned`, so a blocked restaurant with a token can still call every endpoint. Only the web's 30 s `RestaurantBlockGuard` poll hides the UI.
5. **verify-otp saves the FCM token before the status check**, so pending and rejected accounts receive pushes. It also matches the phone with an unanchored "ends with last 10 digits" regex across four fields.
6. **The 2026-05-26 legacy bypass** (`auth.service.js:417`, also in `onboardingUtils.js:164`): restaurants created before that date can log in even when `rejected` or blocked.
7. **`PATCH /profile` and `PATCH /availability` are registered twice** (`restaurant.routes.js:98-109`). The second registrations are unreachable.
8. **The socket's `joinRoom` lets any authenticated client join any room**, including `restaurant:<id>` and `admin` (`config/socket.js:141-146`). Any customer could receive another restaurant's orders and pickup OTPs. This was already flagged in the user audit.
9. **Pickup OTPs are exposed widely.** They are included in every `GET /food/restaurant/orders` row (`select('+pickupOtp')`) and in the FCM body text ("The OTP is: …").
10. **`/uploads/image|file|video` are unauthenticated** and have no size limit (also in the user audit).
11. **The rate limit is incompatible with the web panel's polling.** By default the limit is 100 requests per 15 minutes per user, while the panel polls orders every 8 s plus several other loops. Either production overrides `RATE_LIMIT_MAX` (the value is unknown here) or the web panel is getting 429s.
12. **The order-status FCM to the restaurant carries `link:/food/user/orders/<id>`**, a user-app route.
13. **`GET /fcm-tokens/test-set-token/:phone/:token` and `/test-get-token/:phone` are unauthenticated** (user collection only). This is also in the user audit.
14. **`GET /food/pages/terms` returns `data:null` in production**, so the Terms screen is empty.
