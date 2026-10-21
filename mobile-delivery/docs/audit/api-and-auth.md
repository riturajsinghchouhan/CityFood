# CityFood delivery partner (rider) app: API and auth audit for the React Native port

This is a read-only audit. No repository files were changed, nothing was logged into, no project code was run, and no write endpoints were called. Only public GETs were sent to production. For `.env` files, only key names are listed, never values.

- Frontend paths are relative to `Frontend/src/`. `@food` means `Frontend/src/modules/Food`, and `DV2` means `Frontend/src/modules/DeliveryV2`.
- Backend paths are relative to `Backend/src/`.
- Production base URL: `https://cityfood.co.in/api/v1`. Every path below is relative to it.
- **Companion docs** (not repeated here):
  - `mobile-user/docs/audit/api-and-auth.md` covers the axios factory `createModuleClient` (Bearer header, single-flight refresh on 401, no refresh on 429, `accessDenied` on 403), the error envelope (`message ?? error`), CORS, JWT lifetime (365 days, refresh with no rotation), OTP rules and bypasses, the Socket.IO URL and transport, the generic `/uploads/*` endpoints, and the FCM route table.
  - `mobile-restaurant/docs/audit/api-and-auth.md` covers the shared refresh and logout behaviour, the `/fcm-tokens/*` endpoints (#51–56 there), the notifications inbox (#47–50 there), and the FCM message format (`channel_id:"default"`, APNs key names).
  This document covers only what is different or specific to the delivery role.

---

## 0. Summary for the RN team

| Topic | Fact |
|---|---|
| Login | `POST /food/auth/delivery/request-otp {phone}`, then `POST /food/auth/delivery/verify-otp {phone, otp, fcmToken?, platform?:'web'\|'mobile'}`. There are **three outcomes**: tokens (approved, or a "legacy" rider created before 2026-05-26 in any status); `needsRegistration:true` (no rider with these last 10 digits); `pendingApproval:true` with `isRejected` and `message` (status `pending` or `rejected`). The last two return **no tokens**. |
| Phone string | The OTP record is keyed by the **exact phone string** sent. The web sends `"91XXXXXXXXXX"` (12 digits, from `normalizePhone("+91 …")`). Send the same string to request-otp and verify-otp. Rider lookup uses only the last 10 digits. |
| Signup | Registration is a **single unauthenticated multipart call**, `POST /food/delivery/register`, with `zoneId` required and up to 9 file fields. The rider is created with `status:"pending"`, and an admin must approve before login works. |
| Status | `FoodDeliveryPartner.status` is one of `pending`, `approved` or `rejected`. `/food/auth/me` reports `rejected` as **`"blocked"`**. After login, the web **never checks status again**, and the backend never enforces it on API calls. |
| Tokens | The response holds `data.accessToken` (also `data.token`), `data.refreshToken` and `data.user = {id, _id, name, phone, email, status, profileImage, walletAmount, refCode, createdAt}`. The JWT is `{userId:<partner _id>, role:"DELIVERY_PARTNER"}`. The web stores `delivery_accessToken`, `delivery_refreshToken`, `delivery_user` and `delivery_authenticated` (plus the `food:v1:auth:delivery:*` copies). |
| Profile source | `GET /food/auth/me` returns `data.user`, which is the **entire rider document** plus `deliveryId`, `documents`, `vehicle` and `location`. There is no `/food/delivery/me`. |
| Endpoint count | **52 distinct backend endpoints** are called by delivery screens, hooks, stores and the shared provider (section 2). Several more exist but are never called, including the native-oriented **`POST /food/delivery/location`** batch endpoint (section 4). There are **~20 broken/dead call sites or backend issues** (section 6). |
| Offers | Offers are written to **Firebase RTDB `delivery_partner_offers/<riderId>/<orderMongoId>`** *and* emitted on the socket as **`new_order_available`** to `delivery:<riderId>` (both on every dispatch attempt). An FCM `type:"new_order"` push is also sent. Each offer is valid for **60 s**. After that, a BullMQ job marks it `timeout`, removes it from RTDB, and re-broadcasts at the next radius tier (2→4→6→8→10→15 km, then cycles). Accept via `PATCH /orders/:id/accept`, decline via `PATCH /orders/:id/pass`. |
| Location | Dispatch picks riders by `availabilityStatus:'online'`, `status:'approved'`, and distance from **`lastLat`/`lastLng`**, which are written only by `PATCH /food/delivery/availability` (with numeric lat/lng) or `POST /food/delivery/location`. **There is no staleness check and no auto-offline.** A rider with an old fix keeps getting offers based on it. Riders with no fix at all still get offers. |
| Live tracking | The socket `update-location {orderId, lat, lng, heading, speed, accuracy, userId, restaurantId, polyline?, eta?}` is re-broadcast as **`location-update`** to `tracking:<orderId>`, `user:<userId>` and `restaurant:<restaurantId>`, throttled to 1 per 10 s per order. The user app reads it from there. |
| Background | The backend does not require background location, but in practice it needs it: `lastLat`/`lastLng` drive offers, and customer tracking relies on `update-location`. Use a foreground service with `POST /food/delivery/location` (it returns `{config:{intervalMs, distanceFilterMeters, stopTracking}}`). |
| Push | A native Android FCM token can be saved **with no backend change**: `platform:"mobile"`+`fcmToken` in verify-otp (saved even when pending), or `POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId}`. New-order pushes use `notification`+`data` on channel **`default`**. Rider milestone pushes (picked up, arrived at drop, delivered) are **data-only**, so the app needs a background handler to show them. |
| Rate limit | The API limiter allows 100 requests per 15 minutes per user by default. The web rider app goes far above that: `PATCH /availability` runs on **every GPS fix** (section 6, F1), the available-orders poll runs every 15–45 s, and there are 45 s location heartbeats. The RN app must throttle hard. |

---

## 1. Delivery auth end to end

### 1.1 Routes (`core/auth/auth.routes.js`, mounted at `/v1/food/auth` and `/v1/auth`)

| Method & path | Line | Middleware |
|---|---|---|
| POST `/food/auth/delivery/request-otp` | `auth.routes.js:34` | `authRateLimiter` (per IP) |
| POST `/food/auth/delivery/verify-otp` | `auth.routes.js:35` | `authRateLimiter` |
| POST `/food/auth/refresh-token` | `:45` | none |
| POST `/food/auth/logout` | `:48` | none |
| GET `/food/auth/me` | `:51` | `authMiddleware` |

### 1.2 Request OTP

- **DTO** (`dtos/auth/deliveryOtpRequest.dto.js`): `{phone: string, 8–15 chars}`. There is no digits-only rule. The SMS sender (`core/otp/otp.service.js:36-40`) needs the last 10 digits to match `^[6-9]\d{9}$`.
- **Frontend**:
  - `DV2/pages/auth/SignIn.jsx:63-99` validates a 10-digit number that starts with 6–9.
  - It calls `clearModuleAuth("delivery")`, then `deliveryAPI.sendOTP("+91 <10 digits>")` (`services/api/index.js:1462`), which goes through `authService.requestDeliveryOtp` (`services/api/auth.js:279-285`).
  - `normalizePhone` keeps up to 15 digits, so the body is `{phone:"91XXXXXXXXXX"}`.
  - It stores `localStorage.deliveryAuthData = {method:"phone", phone:"+91 …", isSignUp:false, purpose:"login", module:"delivery"}` and goes to `/food/delivery/otp`.
- **Service**: `requestDeliveryOtp` (`core/auth/auth.service.js:472-481`) creates an OTP for **any** phone. The OTP is echoed back only when not in production or when `USE_DEFAULT_OTP` is on.
- **Response**: `{success:true, message:"OTP sent successfully", data:{phone, otp?}}` (`auth.controller.js:108-119`).

### 1.3 Verify OTP

- **DTO** (`dtos/auth/deliveryOtpVerify.dto.js`):

  ```json
  { "phone": "8-15 chars", "otp": "exactly 6 chars", "fcmToken": "string|null optional", "platform": "web|mobile (default web)" }
  ```

- **Frontend**: `verifyDeliveryOtp` (`services/api/auth.js:287-298`) sends `fcmToken` and `platform` only when a token exists. `DV2/pages/auth/OTP.jsx:211-232` collects the token like the restaurant does: Flutter bridge handlers `getFcmToken`, `getFCMToken`, `getPushToken` and `getFirebaseToken` with `platform:"mobile"`, otherwise `localStorage.fcm_web_registered_token_delivery`.
- **Service**: `verifyDeliveryOtpAndLogin` (`auth.service.js:488-574`):

| Step | Lines | Outcome |
|---|---|---|
| `verifyOtp(phone, otp)` fails | `:489-492` | **401** `AuthError` (for example "Invalid OTP") |
| No digits in phone | `:494-497` | `{needsRegistration:true, phone}` |
| **Unknown phone**: no rider where `phone == last10` or `phone` matches `/<last10>$/` | `:499-508` | **`{needsRegistration:true, phone}`**, no tokens, nothing created. Envelope message is "Login successful". |
| FCM token sent | `:510-530` | Pushed into `fcmTokenMobile` (`platform==="mobile"`) or `fcmTokens`. This happens **before** the status gate, so pending and rejected riders also get pushes. |
| **Pending** (status `pending`, created on or after 2026-05-26) | `:532-547` | `{pendingApproval:true, isRejected:false, rejectionReason:null, message:"Your account is pending admin verification. You will be notified once approved."}`. No tokens, and **no `status` or `phone` field** (unlike restaurant). |
| **Rejected** (status `rejected`, same date rule) | same | `{pendingApproval:true, isRejected:true, rejectionReason, message:"Your account was rejected: <reason>"}` or "…not approved. Please contact support." |
| **Approved**, or a **legacy** rider (created before 2026-05-26) in **any** status | `:549-574` | `{token, accessToken, refreshToken, needsRegistration:false, user:{id, _id, name, phone, email, status, profileImage, walletAmount, refCode, createdAt}}` (`sanitizeDeliveryForAuthResponse`, `:76-96`). The refresh token is stored in `FoodRefreshToken`, with a TTL of `JWT_REFRESH_EXPIRES_IN` (default 365d). |

- **Web routing after verify** (`OTP.jsx:236-327`):
  - `pendingApproval`: removes `deliveryAuthData` and shows an in-page pending or rejected message (no separate screen). The rider stays on the OTP page. There is no "check again" action except logging in again.
  - `needsRegistration`: sets `localStorage.deliveryNeedsRegistration="true"` and `deliverySignupDetails={name:"", phone:<last10>, countryCode:"+91"}`, then goes to `/food/delivery/signup/details`.
  - Tokens:
    1. `setAuthData("delivery", accessToken, user, refreshToken)`;
    2. `clearCachedFcmToken("delivery")`;
    3. `registerWebPushForCurrentModule("/food/delivery")`;
    4. dispatch the `deliveryAuthChanged` event;
    5. poll until `delivery_accessToken` and `delivery_authenticated==="true"` exist, then go to `/food/delivery`.
  - `handleSubmitName` (`OTP.jsx:330-410`) is a dead "second verify-otp call with a name" path (section 6).

### 1.4 Signup and registration

The flow is: OTP → `needsRegistration` → `SignupStep1` (details) → `SignupStep2` (documents) → `POST /food/delivery/register`.

- **Endpoint**: `POST /food/delivery/register` (`modules/food/delivery/routes/delivery.routes.js:46`).
  - **No auth** and no proof of OTP verification.
  - It uses multer `upload.fields` (`:34-44`): memory storage with **no size, count or type limits** beyond these fields.
- **Frontend**: `deliveryAPI.register(formData)` (`index.js:1495-1502`) runs when `deliveryNeedsRegistration==="true"`. Otherwise `SignupStep2` calls `deliveryAPI.completeProfile(formData)`, which is `PATCH /food/delivery/profile` with Bearer (`SignupStep2.jsx:482-491`).
- **Zones**: `SignupStep1.jsx:52` calls `GET /food/zones/public` (production returns 200 with `data.zones[]`).

**Text fields** (validator `delivery/validators/delivery.validator.js:13-46`; service `registerDeliveryPartner`, `delivery.service.js:13-145`):

| Field | Rule (backend) | Web UI rule (`SignupStep1.jsx:150-210`) |
|---|---|---|
| `name` | required, min 1 | letters, spaces, `.` and `-` |
| `phone` | 8–15 chars. Stored **as sent** (the web sends 10 digits). Model `unique`. | from OTP step |
| `email` | email or `""` | **required** in UI |
| `countryCode` | optional (default `+91`) | `+91` |
| `address`, `city`, `state` | optional | required |
| `zoneId` | **required**, 24-hex ObjectId of an **active** `FoodZone`, otherwise 400 "Selected service zone is not available…" | required |
| `vehicleType` | any string | `bike`, `scooter`, `bicycle` or `ev` (default `bike`) |
| `vehicleName`, `vehicleNumber` | optional. `vehicleNumber` is `unique, sparse` in the model, so a duplicate gives an E11000 error. | number required unless `bicycle`, format `^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$` |
| `drivingLicenseNumber` | `^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$` (15 chars) or `""` | required unless `ev` or `bicycle` |
| `panNumber` | `^[A-Z]{5}[0-9]{4}[A-Z]$` or `""` | required |
| `aadharNumber` | `^[0-9]{12}$` or `""` | required |
| `ref` | ≤64 chars. A valid rider ObjectId is stored as `referredBy`; the reward is credited on admin approval. | from `?ref=` |
| `fcmToken`, `platform` | optional. Saved into `fcmTokenMobile` or `fcmTokens`. | as in OTP |
| `documents[drivingLicense][number]` | **ignored** (the web sends it anyway) | |

**Multipart file fields** (`delivery.routes.js:34-44`). Each file is processed by sharp, resized to 800×800 at q85, and saved under folder `delivery` (`services/upload.service.js:168-177`). Each field also accepts a URL string in the same body key (`delivery.service.js:37-83`).

| Field | Web sends? | Web required? | Stored as |
|---|---|---|---|
| `profilePhoto` (selfie) | yes | yes | `profilePhoto` |
| `aadharFrontPhoto` | yes | yes | `aadharFrontPhoto` |
| `aadharBackPhoto` | yes | yes | `aadharBackPhoto` |
| `panPhoto` | yes | yes | `panPhoto` |
| `drivingLicenseFrontPhoto` | yes | no | `drivingLicenseFrontPhoto` |
| `drivingLicenseBackPhoto` | yes | no | `drivingLicenseBackPhoto` |
| `rcPhoto` (vehicle RC) | yes | yes | `rcPhoto` |
| `aadharPhoto` (single) | no | | `aadharPhoto` |
| `upiQrCode` | no (only used by bank-details) | | ignored by register |

- The web stores captured images as data-URLs (`localStorage.deliverySignupDocs` plus IndexedDB) and converts them to `File` objects named `*.webp` at submit time (`SignupStep2.jsx:427-445`). There is **no bank-details field at registration**.
- **Duplicates** (`delivery.service.js:26-33`):
  - An existing rider with the **same `phone` string** and status other than `rejected` gives **400** "Delivery partner with this phone already exists".
  - If the existing rider is `rejected`, **every** rider with that phone is **hard-deleted** and registration goes ahead.
  - The duplicate check uses the exact string, while login uses the last 10 digits. So `9876543210` and `919876543210` can both register (section 6).
- **Response**: **201** `{success, message:"Delivery partner registered successfully", data:<full rider document>}` (`delivery.controller.js:10-18`). The document includes bank fields and FCM tokens. Admins get a push (`type:"new_registration"`, `subType:"delivery_partner"`).
- **Web after register**: clears the signup keys and shows a success screen (`isSuccess`). The rider then has to log in with OTP, which returns `pendingApproval` until an admin approves.
- **Admin approval** (for reference): `approveDeliveryPartner` / `rejectDeliveryPartner` (`admin/services/admin.service.js:4868`, `:4946`). These set the status and send the rider a push: `type:"onboarding_approved"` ("Welcome Aboard! 🚲") or `type:"onboarding_rejected"`. The push reaches the rider only if a token was sent at verify-otp or register. **RN: always send `fcmToken`+`platform:"mobile"` in verify-otp and register.**

### 1.5 Status values and how the web gates screens

**Model fields** (`modules/food/delivery/models/deliveryPartner.model.js`):

- `status`: enum `pending|approved|rejected`, default `pending` (`:107-111`).
- `rejectionReason`, `rejectedAt`, `approvedAt`.
- `availabilityStatus`: enum `online|offline`, default `offline` (`:121-125`).
- `shiftStartPic`, `shiftStartTime`, `shiftStartAddress`.
- `lastLocation` (GeoJSON, 2dsphere), `lastLat`, `lastLng`, `lastLocationAt`.
- `fcmTokens[]`, `fcmTokenMobile[]`, `pushDevices[]` (same shape as for restaurants).
- `zoneId`, `referralCode`, `referredBy`, `referralCount`, `rating`, `totalRatings`.

There is no `isActive` or `isBanned`.

**Web gates:**

1. `DV2/components/ProtectedRoute.jsx` uses only `isModuleAuthenticated("delivery")`: an unexpired `DELIVERY_PARTNER` access token, or an unexpired refresh token. Every app route except auth, terms, privacy and `support` is wrapped (`DeliveryV2Router.jsx:52-79`).
2. **No status re-check after login.** The ID card screen (`help/ShowIdCardV2.jsx:57-59`) only colours a badge from `status` (`approved`/`active`, `pending`, `blocked`/`suspended`). A rider rejected or "blocked" after login keeps full access. The backend middleware does not check status either.
3. Going online requires a live selfie plus GPS (`DeliveryHomeV2.jsx:1440-1470`, `PhotoUploadModal`). There is no backend check that the rider is approved before going online. Dispatch does filter `status:'approved'`, though.
4. Cash limit: `GET /food/delivery/orders/available` returns `cashLimit` (with `blocked` **always false**) and the web shows a "deposit to get orders" banner. Server-side, the cash-limit block on accept is **commented out / removed** (`order-delivery.service.js:~455`, "Cash limit restriction removed").

### 1.6 Token storage (web), refresh, logout, /me

| Purpose | Key |
|---|---|
| Access token | `delivery_accessToken` / `food:v1:auth:delivery:accessToken` |
| Refresh token | `delivery_refreshToken` / `food:v1:auth:delivery:refreshToken` |
| Auth flag | `delivery_authenticated` / `food:v1:auth:delivery:authenticated` |
| Rider object | `delivery_user` / `food:v1:auth:delivery:user` |
| FCM token sent | `fcm_web_registered_token_delivery` |
| OTP handoff | `localStorage.deliveryAuthData` (note: **local**Storage, unlike the restaurant's sessionStorage) |
| Signup drafts | `deliveryNeedsRegistration`, `deliverySignupDetails`, `deliverySignupDocs` + IndexedDB |
| Online preference | zustand persist `delivery-v2-online-pref` (`{isOnline}` only, `DV2/store/useDeliveryStore.js:112`), plus legacy `app:isOnline` |
| Socket debug | `delivery_socket_debug` |

- **Socket token**: `useDeliveryNotifications.js:99` reads the legacy `delivery_accessToken`.
- **Refresh**: the shared interceptor calls `POST /food/auth/refresh-token {refreshToken}` → `{accessToken, refreshToken}`, with no rotation and no status check.
- **Logout** (`DV2/pages/ProfileV2.jsx:165-205`) runs these steps:
  1. `DELETE /fcm-tokens/device/remove {deviceId, fcmToken, voipToken}`. The `deviceId` is `"tuggo:delivery:<platform>:<last 16 chars of token>"`.
  2. `DELETE /fcm-tokens/remove {token, platform}`.
  3. `POST /food/auth/logout {refreshToken, fcmToken, platform}`, where the refresh token comes from storage.
  4. `clearModuleAuth("delivery")` and removal of `app:isOnline`.
  - **It does not set the rider offline** and does not clear `delivery-v2-online-pref` (section 6). **RN: call `PATCH /food/delivery/availability {status:"offline"}` before logout.**
- **`GET /food/auth/me`** for `DELIVERY_PARTNER` (`auth.service.js:690-760`) returns `data.user` =
  - the **whole lean rider document**: bank account number, Aadhaar and PAN numbers, all photo URLs, `fcmTokens`, `pushDevices`, `lastLat`/`lastLng`, `availabilityStatus` and the rest;
  - plus `deliveryId:"DP-<last 8 of _id>"`;
  - `status` (`rejected` reported as **`"blocked"`**);
  - `profileImage:{url}|null`;
  - `documents:{aadhar:{number, document}, pan:{number, document}, drivingLicense:{number, document}, bankDetails:{accountHolderName, accountNumber, ifscCode, bankName, upiId, upiQrCode}}` (each `null` when empty). `drivingLicense.document` reads the non-existent `drivingLicensePhoto`, so it is always null (section 6). `aadhar.document` reads only `aadharPhoto`, not the front/back fields;
  - `location:{addressLine1, city, state}|null`;
  - `vehicle:{type, brand, model, number}|null`.
  - The web wraps this as `deliveryAPI.getProfile()` → `res.data.data.profile` (`index.js:1473-1480`), with a 3 s in-flight cache (`index.js:1434-1458`).
- **Delete account**: `DELETE /food/delivery/account` (`delivery.routes.js:105`). It runs a transaction that snapshots balances, detaches orders and transactions, deletes related rows, and then deletes the rider. It returns `{success, message:"Account deleted successfully", data:null}`. It is called from `ProfileV2.jsx:492`. There is **no guard** for an active order or cash in hand.

---

## 2. Every API call made by delivery code

Client legend:

- **D** = `deliveryClient` (Bearer `delivery_accessToken`, with refresh).
- **U** = `userClient` (public endpoints).
- **L** = legacy `apiClient` with `contextModule:'delivery'`.

All responses use the envelope `{success, message, data}`. Unless noted, backend handlers are in `modules/food/delivery/controllers/delivery.controller.js` (abbreviated `ctl`) and `modules/food/orders/controllers/order.controller.js` (abbreviated `octl`), with services `delivery.service.js` (`dsvc`) and `orders/services/order-delivery.service.js` (`odsvc`).

### 2.1 Auth and onboarding (8)

| # | Method & path | C | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 1 | POST `/food/auth/delivery/request-otp` | D | `{phone}` | `{phone, otp?}` | `auth/SignIn.jsx:84`, `auth/OTP.jsx:446` (resend) |
| 2 | POST `/food/auth/delivery/verify-otp` | D | `{phone, otp, fcmToken?, platform?}` | section 1.3 | `auth/OTP.jsx:243` (and dead `:358`) |
| 3 | GET `/food/auth/me` | D | | `{user}` (section 1.6) | `getProfile`/`getMe`: `DeliveryHomeV2.jsx:452`, `ProfileV2.jsx:70`, `PocketV2.jsx:80,148`, `pocket/PocketBalanceV2.jsx:44,105`, `profile/ProfileDetailsV2.jsx:116,239`, `profile/ProfileDocsV2.jsx:25,44`, `profile/ProfileBankV2.jsx:26`, `help/ShowIdCardV2.jsx:19`, `@food/hooks/useDeliveryNotifications.js:649` |
| 4 | POST `/food/auth/refresh-token` | D | `{refreshToken}` | `{accessToken, refreshToken}` | axios interceptor |
| 5 | POST `/food/auth/logout` | D | `{refreshToken, fcmToken, platform}` | | `ProfileV2.jsx:196` |
| 6 | POST `/food/delivery/register` | D (no token) | multipart, section 1.4 | 201, full rider doc | `auth/SignupStep2.jsx:490` |
| 7 | PATCH `/food/delivery/profile` | D | multipart (see 2.2) | `{partner, requiresReapproval:false}` | `SignupStep2.jsx:491` (completeProfile), `ProfileDetailsV2.jsx:295`, `ProfileDocsV2.jsx:41` |
| 8 | GET `/food/zones/public` | U | | `{zones[]}` | `auth/SignupStep1.jsx:52`, `components/map/LiveMap.jsx:257` |

### 2.2 Profile, documents, bank and referral (5, plus #3 and #7)

| # | Method & path | Request | Response `data` | Notes / calling file |
|---|---|---|---|---|
| 9 | PATCH `/food/delivery/profile/details` (JSON) | `{vehicle:{number, type, brand, model}}` and/or `{profilePhoto:"<url>"\|""}`. **Nothing else is read** (`dsvc:196-216`). | `{partner}` | `ProfileDetailsV2.jsx:331` (delete photo), `:821` (vehicle). **`ProfileBankV2.jsx:58` sends `{documents:{bankDetails, pan}}` here, and it is silently ignored** (section 6). |
| 10 | PATCH `/food/delivery/profile/bank-details` (multipart or JSON) | `documents[bankDetails][accountHolderName\|accountNumber\|ifscCode\|bankName\|upiId]`, `documents[pan][number]`, file `upiQrCode` (or a URL string). Nested JSON `{documents:{bankDetails:{…}, pan:{number}}}` also works. | `{bankDetails:{accountHolderName, accountNumber, ifscCode, bankName, upiId, upiQrCode}, panNumber}` | `ProfileDetailsV2.jsx:411` |
| 11 | GET `/food/delivery/referrals/stats` | | `{stats:{referralCount, totalReferralEarnings, rewardAmount}}` | `ProfileV2.jsx:84` |
| 12 | DELETE `/food/delivery/account` | | `null` | `ProfileV2.jsx:492` |
| 13 | GET `/food/delivery/emergency-help` | | `{medicalEmergency, accidentHelpline, contactPolice, insurance, teamLeader}` (phone strings) | `DeliveryHomeV2.jsx:451` |

`PATCH /food/delivery/profile` (#7) **only** applies these (`dsvc:147-194`):

- text: `name`, `countryCode`, `address`, `city`, `state`, `vehicleType`, `vehicleName`, `vehicleNumber`, `drivingLicenseNumber`;
- `fcmToken`/`platform`;
- the **`profilePhoto`** file.

All other files that are uploaded (`aadharPhoto`, `aadharFront/BackPhoto`, `panPhoto`, DL front/back, `rcPhoto`) are **accepted and discarded**. `email`, `zoneId`, `panNumber` and `aadharNumber` are not in the DTO. There is **no re-approval** on any edit (`requiresReapproval:false`). This is the opposite of the restaurant role.

### 2.3 Duty online/offline and location (1 used, plus 1 unused)

| # | Method & path | Request | Response `data` | Calling file |
|---|---|---|---|---|
| 14 | PATCH `/food/delivery/availability` | `{status:"online"\|"offline"\|true\|false, latitude?:number, longitude?:number, shiftStartPicBase64?:<raw base64 JPEG, no data: prefix>, shiftStartAddress?}`. **Any other or missing `status` sets the rider OFFLINE** (`dsvc:342-346`). lat/lng are applied only if both are `typeof number`. The selfie is uploaded only when going online. | `{availabilityStatus}` | **Go online**: `DeliveryHomeV2.jsx:1595` with the selfie from `PhotoUploadModal` (canvas JPEG q0.7), then `updateLocation(lat, lng, true)` at `:1601`. **Go offline**: `:1467`. GPS error: `:674`. **Status sync effect** at `:645`, which fires on *every* `riderLocation` change. **Location heartbeat** at `:771` (every ≥45 s from watchPosition) and `:897` (45 s interval). `updateLocation` also sends `heading`, `speed` and `accuracy`, which are ignored. |
| (unused) | POST `/food/delivery/location` | section 4.2 | `{processedCount, totalReceived, activeOrderId, config:{stopTracking, mode, intervalMs, distanceFilterMeters}}` | **Not called by the web**. It was built for the Flutter driver wrapper. |

Shift-start selfie: the JSON body limit is 15 MB (`app.js:88-97`). The image is resized server-side to 800×800.

**Location update frequency on the web** (`DeliveryHomeV2.jsx:675-860`):

- `watchPosition({enableHighAccuracy:true, maximumAge:3000, timeout:10000})` runs only while online.
- On each fix it emits the socket `update-location` (only when an active order exists) and writes Firebase `delivery_boys/<id>` when the rider moved ≥50 m or 10 s have passed.
- `PATCH /availability` with lat/lng runs every ≥45 s.
- A GPS permission error (not a timeout) forces the rider offline.
- Auto "reached pickup" and "reached drop" fire within 100 m of the target in production builds (`:707-718`).

### 2.4 Order offers and assignment (5)

| # | Method & path | Request | Response `data` | Calling file |
|---|---|---|---|---|
| 15 | GET `/food/delivery/orders/available?page&limit` | | `{docs[], total, page, limit, …, cashLimit:{blocked:false, message, totalCashLimit, cashInHand, availableCashLimit}, orderCapacity}`. `docs` are **raw lean orders**, not sanitized: populated `userId{name, phone, email}`, `restaurantId{restaurantName, name, address, phone, ownerPhone, location, profileImage}`, `dispatch.offeredTo[]`, `pricing`, `payment`. The list includes (a) unassigned orders with an `offered` entry for this rider in status `confirmed`, `preparing` or `ready_for_pickup`, and (b) **all of this rider's non-terminal orders** (`odsvc:319-421`). | `DeliveryHomeV2.jsx:1136` (poll, section 3.3), `useDeliveryNotifications.js:395` (recovery) |
| 16 | GET `/food/delivery/orders/active` | | `{activeOrders[], capacity}`. These are sanitized orders (no OTPs) with `dispatch.status:'accepted'` and status `confirmed`, `preparing`, `ready_for_pickup`, `picked_up` or `reached_drop`, merged with transaction payment info (`paymentStatus:'paid'`, `isPaid` when captured) (`odsvc:277-317`). `capacity` comes from `getDeliveryPartnerOrderCapacity` (`{canAcceptMore, effectiveLimit, …}`). | `DeliveryHomeV2.jsx:608` (mount), `:1129` (poll), `:1249` (after accept) |
| 17 | GET `/food/delivery/orders/current` | | `{activeOrder: <sanitized order>\|null}` (the most recently updated active order) | `useDeliveryNotifications.js:396` (recovery) |
| 18 | PATCH `/food/delivery/orders/:orderId/accept` | `{}` | `{order}`, sanitized and populated `restaurantId`/`userId` | `hooks/useOrderManager.js:34` |
| 19 | PATCH `/food/delivery/orders/:orderId/pass` | `{}` | `{orderId, passed:true}` | `DeliveryHomeV2.jsx:1267`. Called by the "Pass" button and by **the 60 s countdown auto-reject in `NewOrderModal.jsx:26-33`**. |

`:orderId` can be the Mongo `_id` or the display `order_id` (`buildOrderIdentityFilter`).

**Accept rules** (`odsvc:423-716`):

- **403** "This order belongs to another zone" when the rider's zone franchise does not match the order's franchise.
- It is idempotent when the order is already accepted by the same rider.
- A per-rider Redis lock gives 400 "Another order acceptance is being processed".
- Capacity: 400 "Maximum active order limit reached (N)".
- The atomic update requires `dispatch.status:'unassigned'` with an `offered` entry for this rider, **or** `dispatch.status:'assigned'` to this rider.
- Failures:
  - 400 "Order was cancelled";
  - 400 "Order already delivered";
  - 400 "Order not ready for delivery assignment";
  - **403 "Order already accepted by another partner"**;
  - 400 "Order is no longer available to accept".
- On success:
  - It sets RTDB `active_orders/<orderMongoId>` with `{polyline, lat, lng, boy_lat, boy_lng, restaurant_lat/lng, customer_lat/lng, status:'accepted', last_updated}`.
  - It emits `order_status_update` to the rider, restaurant and user rooms.
  - It emits `order_claimed {orderId, orderMongoId, claimedBy}` to every offered rider **and** to room `all_delivery`.
  - It sends an `order_claimed` FCM to the other riders.
  - It removes all RTDB offers for the order.

**Pass** (`odsvc:718-755`): marks this rider's `offered` entry as `rejected`. If the order was `assigned` to this rider, it unassigns it and re-runs dispatch. A non-existent offer gives 400 "Offer is no longer available".

### 2.5 Active order lifecycle (9)

| # | Step | Method & path | Request | Response `data` | Calling file |
|---|---|---|---|---|---|
| 20 | Reached restaurant | PATCH `/orders/:id/reached-pickup` | `{}` | `{order}` (**raw `toObject()` with `pickupOtp` and `deliveryOtp`**, section 6) | `useOrderManager.js:111` (button, or the 100 m geofence) |
| 21 | Ask restaurant for pickup OTP | POST `/orders/:id/request-pickup-otp` | `{}` | `null` (message "OTP sent to restaurant") | `components/modals/PickupActionModal.jsx:176` |
| 22 | Picked up (pickup OTP verify) | PATCH `/orders/:id/confirm-pickup` | `{confirmedOrderId, latitude, longitude, billImageUrl, otp}`. Only `billImageUrl` and `otp` are read. `otp` may be **`"SKIP"`/`"BYPASS"`/`"NONE"`**, which bypasses the check (`odsvc:983-1049`). | `{order}` (raw, with OTPs) | `useOrderManager.js:135` (the web always passes `billImageUrl:null`) |
| 23 | Reached customer (sends drop OTP to customer) | PATCH `/orders/:id/reached-drop` | `{}` | `{order}`, sanitized. Calling it again **resends the same OTP** to the customer (socket `delivery_drop_otp` + FCM). | `useOrderManager.js:164`, `DeliveryVerificationModal.jsx:97` (resend, 30 s cooldown) |
| 24 | Drop OTP verify | POST `/orders/:id/verify-drop-otp` | `{otp:"1234"}` (4 digits; a longer value is matched on its last 4) | `{order}`, sanitized | `useOrderManager.js:198`, `DeliveryVerificationModal.jsx:120` |
| 25 | Delivered (and COD collection) | PATCH `/orders/:id/complete` | `{otp, rating:5, paymentOverride, paymentMethod}`. `otp` missing or `"BYPASS"`/`"SKIP"`/`"NONE"` **bypasses the drop OTP**. `paymentMethod:"cash"` switches an unpaid QR order to cash. `ratings` (an object) is merged into `order.ratings`. | `{order}`, sanitized | `useOrderManager.js:210` |
| 26 | COD: create a UPI QR | POST `/orders/:id/payment-qr` (alias `/collect/qr`) | `{}` | `{qrId, image_url, imageUrl, status, amount, expiresAt, reused}` | `DeliveryVerificationModal.jsx:320` |
| 27 | COD: QR payment status | GET `/orders/:id/payment-status` | | `{status:'paid'\|'pending'\|'expired'\|'failed', paid, payment, qr, latestPaymentSnapshot, riderEarning, platformProfit, pricingTotal, transactionStatus}`. It syncs with Razorpay on each call. | `DeliveryVerificationModal.jsx:289`, **polled every 4 s** while the QR modal is open (`:311`) |
| 28 | (dead) failure reason | PATCH `/orders/:id/reject` | `{reason}` (**ignored by the controller**) | `{order}` (raw, with `deliveryOtp`) | `DeliveryHomeV2.jsx:1302`, only on the never-emitted `order_auto_killed` |

Paths in this table are under `/food/delivery`.

**State and gating notes:**

- **Reached pickup** (`odsvc:819-927`) sets `deliveryState:{currentPhase:'at_pickup', status:'reached_pickup', reachedPickupAt}`, generates a 4-digit `pickupOtp`, and notifies the restaurant (`type:"rider_arrived"`). It does **not** change `orderStatus`. There is no server-side distance check.
- **Request pickup OTP** (`odsvc:929-981`) needs reached-pickup first ("Pickup OTP not generated yet…"). It emits `pickup_otp_reveal {otp}` to the restaurant room, and sends an FCM whose body contains the OTP.
- **Confirm pickup** gives 400 if the order is already at or past `picked_up` ("Order is already at status …"). It sets `orderStatus:'picked_up'` and `deliveryState.currentPhase:'en_route_to_delivery'`. It sends a data-only rider push "Order picked up!" and a user push.
- **Reached drop** (`odsvc:1051-1138`) sets `deliveryState:{currentPhase:'at_drop', status:'reached_drop'}`, generates `deliveryOtp`, and sets `deliveryVerification.dropOtp.required=true`. It does **not** change `orderStatus`. The customer receives socket `delivery_drop_otp` on `user:<id>` and `tracking:<orderId>`, plus an FCM.
- **Complete** (`odsvc:1195-1344`):
  - The order must not already be `delivered`. **No check that it was picked up.**
  - Payment:
    - already paid or captured: OK;
    - `razorpay_qr`: Razorpay is synced, and the call **fails with 400 "Payment has not been verified by the server…" until paid**;
    - **cash**: `financeService.capturePayment(..., source:'rider_cod')` records the COD as collected. This adds the order total to the rider's **cash in hand**. There is no separate "cash collected" endpoint.
  - It then sets `orderStatus:'delivered'` and `deliveryState.deliveredAt`, and sends a data-only rider push "Payment collected!" or "Delivery successful!" (`type:"order_completed"`, with `amountCollected`).
- **Web UI flow** (`DeliveryVerificationModal.jsx`):
  - Choose cash, or generate a QR and poll until paid.
  - Enter the OTP → #24 → #25.
  - "Mark delivered" (`handleTriggerMarkDelivered`, `DeliveryHomeV2.jsx:1280-1290`) opens the modal with `bypassOtp=true`, so the rider can complete with no OTP.
- **Unused order endpoints**:
  - GET `/orders/:orderId` (`getOrderDetails`; not called by DV2);
  - PATCH `/orders/:orderId/status {orderStatus}` (`updateOrderStatus`; not called, but dangerous, see section 6).

### 2.6 Earnings, pocket, wallet, payouts, cash limit and settlements (9)

| # | Method & path | Request | Response `data` | Calling file |
|---|---|---|---|---|
| 29 | GET `/food/delivery/wallet` | optional `?type=bonus\|deposit\|deduction\|withdrawal&limit≤200` (default 50) | `{wallet:{totalBalance, pocketBalance, cashInHand, totalWithdrawn, pendingWithdrawals, totalEarned, totalBonus, totalCashLimit, availableCashLimit, deliveryWithdrawalLimit, transactions[≤50]}}` (`deliveryFinance.service.js:25-105`). Transactions have `type` `payment`, `withdrawal` or `deposit` (`{id, type, amount, status, date, description, orderId?, payoutMethod?, paymentMethod?, razorpayPaymentId?}`). With `type=bonus` they come from `DeliveryBonusTransaction`. | `PocketV2.jsx:82`, `PocketBalanceV2.jsx:46`, `CashLimitInfoV2.jsx:33`, `ProfileDetailsV2.jsx:105`. Via `getWalletTransactions` (which unwraps to `data.transactions`): `HistoryV2.jsx:69` (bonus), `PocketStatementV2.jsx:57` (bonus), `LimitSettlementV2.jsx:28` (deposit), `DeductionStatementV2.jsx:31` (**deduction, never produced**), `PayoutV2.jsx:28` and `PocketBalanceV2.jsx:47` (withdrawal) |
| 30 | GET `/food/delivery/earnings` | `?period=today\|week\|month\|all&date&page&limit` (the week runs Sunday–Saturday, server local time) | `{summary:{totalEarnings, totalOrders, totalHours:0, totalMinutes:0, orderEarning, incentive:0, otherEarnings:0}, period, date, pagination}` (`dsvc:464-529`) | `PocketV2.jsx:81`, `PocketBalanceV2.jsx:45` (`period:'week'`) |
| 31 | GET `/food/delivery/earning-addons/active` | | `{activeOffer, offers:[{id, title, description, targetAmount, targetOrders, currentOrders, currentEarnings, startDate, endDate, validTill, isLive}]}` | `PocketV2.jsx:88` |
| 32 | GET `/food/delivery/trip-history` | `?period=daily\|weekly\|monthly&date=YYYY-MM-DD&status=Completed\|Cancelled\|Pending&startDate&endDate&limit≤1000` | `{period, date, range:{start, end}, trips:[{id, orderId, status:'Completed'\|'Cancelled'\|'Pending', restaurantName, items, paymentMethod, totalAmount, codAmount, codCollectedAmount, deliveryEarning, createdAt, deliveredAt, date, time}]}` (`dsvc:578-676`) | `HistoryV2.jsx:49`, `PocketStatementV2.jsx:56` |
| 33 | GET `/food/delivery/pocket-details` | `?startDate&endDate&limit≤2000` (default the current week) | `{week:{start, end}, summary:{totalEarning, totalBonus, grandTotal}, trips[], transactions:{payment[], bonus[]}}` | `PocketDetailsV2.jsx:45` |
| 34 | GET `/food/delivery/cash-limit` | | `{deliveryCashLimit, deliveryWithdrawalLimit}` (admin settings) | `CashLimitInfoV2.jsx:34` |
| 35 | POST `/food/delivery/wallet/withdraw` | `{amount, paymentMethod:'bank_transfer', requestId, bankDetails?}`. `requestId` (or the `Idempotency-Key` header) is the idempotency key. | 201 `{withdrawal:<FoodDeliveryWithdrawal doc>}`. Errors: "Minimum withdrawal amount is ₹N" (default 100), "Insufficient balance…". `moneyRateLimiter`: 20 per 10 min. | `PocketBalanceV2.jsx:117` |
| 36 | POST `/food/delivery/wallet/deposit/order` (cash-limit settlement) | `{amount}` (≥1, ≤ cash in hand, ≤ 5,00,000) | 201 `{razorpay:{key, orderId, amount(paise), currency}}`. Without Razorpay configured it returns a dummy `order_dev_*` id. | `PocketV2.jsx:138` |
| 37 | POST `/food/delivery/wallet/deposit/verify` | `{razorpay_order_id, razorpay_payment_id, razorpay_signature, amount}` | `{deposit, wallet}` | `PocketV2.jsx:166` (after Razorpay Checkout via `@food/utils/razorpay`; RN needs `react-native-razorpay`) |

Cash-limit semantics:

- `cashInHand` is the COD collected (order totals of delivered cash orders) minus completed deposits.
- `availableCashLimit = max(0, deliveryCashLimit − cashInHand)`.
- Payouts are approved by an admin (`updateDeliveryWithdrawalStatus`). There is no rider-side settlement history endpoint apart from the wallet transaction types.

### 2.7 Support and help (3)

| # | Method & path | Request | Response `data` | Calling file |
|---|---|---|---|---|
| 38 | GET `/food/delivery/support-tickets` | | `{tickets:[{_id, ticketId:"TKT-…", subject, description, category, priority, status:'open'\|'in_progress'\|'resolved'\|'closed', adminResponse, createdAt}]}` (no pagination) | `help/SupportTicketsV2.jsx:24` |
| 39 | POST `/food/delivery/support-tickets` | `{subject (≥3), description (≥10), category:'payment'\|'account'\|'technical'\|'order'\|'other', priority:'low'\|'medium'\|'high'\|'urgent'}` | 201, the ticket | `help/CreateSupportTicketV2.jsx:26` |
| 40 | GET `/food/delivery/support-tickets/:id` | Mongo `_id` | the ticket, or 404 | `help/ViewSupportTicketV2.jsx:24` |

`help/PublicSupportV2.jsx` (route `/food/delivery/support`, no auth) and `help/ShowIdCardV2.jsx` make no other calls. The SOS sheet uses #13 numbers as `tel:` links.

### 2.8 Notifications inbox (4)

`@food/hooks/useNotificationInbox("delivery")` → L with `contextModule:'delivery'` (`NotificationsV2.jsx:44`). These are identical to the restaurant audit #47–50.

| # | Method & path |
|---|---|
| 41 | GET `/food/notifications/inbox?page=1&limit=100` |
| 42 | PATCH `/food/notifications/:id/read` |
| 43 | DELETE `/food/notifications/:id` |
| 44 | DELETE `/food/notifications/inbox/all` |

### 2.9 Push and FCM (6)

The request bodies are identical to the restaurant audit #51–56, sent through D.

| # | Method & path | Calling file |
|---|---|---|
| 45 | POST `/fcm-tokens/save` `{token, platform:'web'}` | `@food/utils/firebaseMessaging.js:513-514` via `registerWebPushForCurrentModule` (`OTP.jsx`, `ProfileV2.jsx:60`, `DeliveryHomeV2.jsx`) |
| 46 | POST `/fcm-tokens/mobile/save` `{token, platform:'mobile'}` | same function, mobile platform |
| 47 | POST `/fcm-tokens/device/save` `{fcmToken, voipToken?, pushPlatform, devicePlatform, deviceId}` | `firebaseMessaging.js:531-532` (Flutter WebView) |
| 48 | DELETE `/fcm-tokens/remove` `{token, platform}` | `ProfileV2.jsx:190` |
| 49 | DELETE `/fcm-tokens/device/remove` `{deviceId, fcmToken, voipToken}` | `ProfileV2.jsx:182` |
| 50 | POST `/fcm-tokens/test` `{platform, channel:'fcm'}` | `ProfileV2.jsx:213` |

### 2.10 CMS and config (2, public)

| # | Method & path | Notes |
|---|---|---|
| 51 | GET `/food/pages/:key` | `PrivacyPolicyV2.jsx:16-19` tries `privacy_delivery` and falls back to `privacy`. `TermsAndConditionsV2.jsx:16-20` tries `terms_delivery` and falls back to `terms`. **In production all four currently return `data:null`**, so both screens are empty. |
| 52 | GET `/food/admin/business-settings/public` | `useCompanyName` (`DeliveryHomeV2.jsx:198`, `ShowIdCardV2.jsx:9`, `auth/Welcome.jsx:13`) |

**Third-party calls from the client:**

- Google Geocoding (`PhotoUploadModal.jsx:135`, env key `VITE_GOOGLE_MAPS_API_KEY`), with Nominatim reverse as fallback (`:148`), to build the shift-start address.
- The Google Maps JS `DirectionsService` (`@react-google-maps/api`, `components/map/LiveMap.jsx`) for the route.
- Firebase RTDB (section 3.2).

### 2.11 deliveryAPI methods not called by DeliveryV2

| Method | Endpoint | Status |
|---|---|---|
| `getOrderDetails` | GET `/food/delivery/orders/:orderId` | works (`getOrderById` with a rider ownership filter) |
| `updateOrderStatus` | PATCH `/food/delivery/orders/:orderId/status` | works, and is unsafe (section 6) |
| `updateProfilePhotoBase64` | POST `/food/delivery/profile/photo-base64 {base64, mimeType}` | works (≤8 MB), returns `{partner}` |
| `reverify` | POST `/food/delivery/reverify` | **stub**: always `{success:true, message:"Submitted"}` |
| `getZonesInRadius` | GET `/food/zones/nearby?lat&lng&radius` | public; production returned 200 |
| `getCurrentDelivery` | GET `/food/delivery/orders/current` | only the provider uses it (#17) |
| (none) | POST `/food/delivery/location` | not wrapped at all (section 4) |

---

## 3. Realtime for riders

### 3.1 Socket.IO

- **Client**: `@food/hooks/useDeliveryNotifications.js` (1317 lines). It is provided once by `DeliveryNotificationProvider` in `DV2/index.jsx`.
  - URL: `resolveSocketOrigin()`, which is `https://cityfood.co.in` with path `/socket.io/` in production.
  - Options (`:778-791`): `transports:['websocket','polling']`, infinite reconnection with a 1–5 s delay, `timeout:20000`, `auth:{token}`, `query:{token}`. The token comes from `localStorage.delivery_accessToken`. The hook reconnects on `deliveryAuthChanged`.
- **Server auth** is the same as for the other roles (`config/socket.js:59-101`).
- **Rooms**: a `DELIVERY_PARTNER` socket is auto-joined to **`delivery:<riderId>`** and **`all_delivery`** (`socket.js:129-136`).
  - The client also emits `join-delivery <riderId>`; the server checks the id against the JWT and replies `delivery-room-joined {room, deliveryPartnerId}`.
  - The client emits `join-tracking <orderId>` before its first location emit for an order. Server reply: `tracking-room-joined`.

**Events the client emits:**

| Event | Payload | Server behaviour |
|---|---|---|
| `join-delivery` | riderId | joins `delivery:<id>` (own id only) |
| `resync` | none | on connect and reconnect. The server replies (`socket.js:350-420`, `resyncState`): `active_order <sanitized order>` if one exists; `pending_offers {offers[], count, recoveredAt}` plus one `new_order_available {…offer, recovered:true}` per offer (offers ≤60 s old only); and finally `resync_complete {timestamp}`. |
| `join-tracking` | orderId | joins `tracking:<orderId>` |
| `update-location` | `{orderId (required), lat, lng, heading, speed, accuracy, status:'on_the_way', polyline?, eta?, userId?, restaurantId?}` | Section 3.2. Ignored for non-rider roles or when `orderId` is missing. |

**Events the client listens to:**

| Event | Emitted by backend? | Payload / web behaviour |
|---|---|---|
| `new_order_available` | **yes**, `order-dispatch.service.js:404` on every dispatch attempt (and `:241` fallback) | `buildDeliverySocketPayload` (`order.helpers.js:239-412`): `{_id, orderMongoId, orderId(display), status, items, pricing, total, payment, paymentMethod, restaurantId, restaurantName, restaurantAddress, restaurantPhone, restaurantLat/Lng, restaurantLocation{…}, deliveryAddress, customerAddress, customerLocation{lat, lng}, customerName, customerPhone, note, riderEarning, deliveryBonusAmount, earnings, deliveryFee, dispatch, createdAt, pickupDistanceKm, offeredAt, isResend}`. **The web ignores it** unless `channel==='socket_fallback'` or the RTDB listener has errored (`:378-388`). |
| `order_claimed` | yes (on accept, admin assign, cancel) | `{orderId, orderMongoId, claimedBy}`. Dismisses the popup and removes the order from the queue. |
| `order_status_update` | yes | `{orderMongoId, orderId, orderStatus, deliveryState, deliveryVerification}` (dispatch changes add `dispatchStatus`). Admin assignment sends it with `dispatch.status:'accepted'`. A cancel arrives as `orderStatus:'cancelled_by_*'`. |
| `order_ready` | yes (`order.service.js:1417`) | sent when the restaurant marks the order ready; shown as a toast |
| `order_deleted` | yes (`order.service.js:1975`) | removes the order |
| `admin_notification` | yes | `{title, message, …}`; refreshes the inbox |
| `admin_force_status` | yes (`admin.controller.js:1536`) | `{status:'online'\|'offline', message}`; flips the local online flag |
| `active_order`, `pending_offers`, `resync_complete`, `delivery-room-joined` | yes (resync) | as above |
| `new_order` | **only to restaurant rooms** | dead listener for riders |
| `order_cancelled`, `order_auto_killed`, `order_reassigned_elsewhere`, `play_notification_sound` | **never emitted** | dead listeners |

The hook also listens to `reconnect` and `reconnect_attempt` on the socket. In socket.io v4 those are Manager events, so they never fire. The resync happens through `connect`.

### 3.2 Firebase Realtime Database

The web client uses the Firebase JS SDK **without auth** (`ensureFirebaseInitialized({enableAuth:false})`, `@food/realtimeTracking.js`). Client env key names: `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_DATABASE_URL`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `_MEASUREMENT_ID`.

| Path | Writer | Reader | Contents |
|---|---|---|---|
| `delivery_partner_offers/<riderId>/<orderMongoId>` | backend `publishDeliveryOfferToFirebase` (`order-dispatch.firebase.js:16-35`) on every dispatch attempt. Removed on accept, timeout, pass/claim and cancel. | **rider web** `subscribeDeliveryPartnerOffers` (`useDeliveryNotifications.js:1180-1255`). The rider **must be online** (local flag); the newest `offeredAt` per order is deduped. A key disappearing means "claimed or expired" and closes the popup. | the socket offer payload + `status:'offered'`, `offeredAt`, `last_updated` |
| `delivery_boys/<riderId>` | **rider web client** `writeDeliveryLocation` (`DeliveryHomeV2.jsx:651, 755, 906`): `set({lat, lng, heading, speed, accuracy, timestamp, last_updated, isOnline, activeOrderId, status})`. Also the backend socket handler (`socket.js:317`) and `POST /location` (`deliveryTracking.service.js`). | admin live map (`subscribeAllDeliveryLocations`) | rider position |
| `active_orders/<orderMongoId>` (and the display id) | backend on accept (`odsvc` accept), the socket `update-location` handler (`socket.js:303`), and `POST /location` | user tracking (an alternative to the socket) | `{lat, lng, heading, speed, accuracy, polyline, eta, status, last_updated, restaurant_lat/lng, customer_lat/lng}` |

**Live location for the user app** comes from the socket `location-update`, which has two sources:

1. **Rider socket `update-location`** (what the web does). The server (`socket.js:205-330`):
   - throttles to **1 broadcast per 10 s per orderId** (polyline and eta every 30 s);
   - emits `location-update {orderId, deliveryPartnerId, lat, lng, heading, speed, timestamp, status, polyline?, eta?}` to `tracking:<orderId>`, plus `user:<data.userId>` and `restaurant:<data.restaurantId>` **if the rider includes those ids**;
   - writes Redis hot keys and RTDB `active_orders`/`delivery_boys`;
   - schedules a BullMQ job that writes **only `lastLocation`** (not `lastLat`/`lastLng`) to Mongo after 30 s.
   - **RN must send `orderId` (prefer the Mongo `_id`; the user app joins tracking rooms by id), `userId` and `restaurantId`.**
2. **`POST /food/delivery/location`** (section 4.2). This emits `location-update` to the `tracking:` rooms and the restaurant room. **It never reaches the `user:` room** because of a field-name bug (section 6).

**RN recommendation:** subscribe to socket `new_order_available` plus `order_claimed` instead of RTDB. The backend emits both on every attempt. Keep FCM for the background, and poll `/orders/available` only when the socket is down. This removes the need for unauthenticated RTDB access in the app. Writing `delivery_boys` from the client is redundant when `POST /location` is used.

### 3.3 How offers arrive and time out

- **Dispatch start**: in `auto` dispatch mode, `tryAutoAssign` runs when the order becomes dispatchable: `confirmed`, `preparing` or `ready_for_pickup` (`order.service.js:485-502, 615-626`) and paid or cash.
- **Rider selection** (`order-dispatch.service.js:91-208`):
  - riders with `availabilityStatus:'online'`, `status:'approved'`, and the franchise or HQ scope of the restaurant's zone;
  - not at capacity;
  - with `haversine(restaurant, lastLat/lastLng) ≤ tierKm`, and inside the zone polygon (falling back to radius-only);
  - **riders with no `lastLat` are also included** (`locationUnknown:true`);
  - sorted by distance.
  - `lastLocationAt` is selected but **never used**.
- **Each attempt** (`:279-465`):
  - for every eligible rider: RTDB offer + socket `new_order_available`;
  - then a single urgent FCM to all of them, `{title:"🚴 New Order Nearby!", body:"Order #… is waiting. Be the first to accept!", data:{type:"new_order", orderId, orderMongoId, link:"/delivery/orders/<id>"}}`, with `notification` + `android.priority:"high"`, `channel_id:"default"`, plus iOS VoIP when registered;
  - every rider is recorded in `dispatch.offeredTo` as `{partnerId, at, action:'offered'}`;
  - a `DISPATCH_TIMEOUT_CHECK` job is scheduled **60 s** later.
- **Timeout** (`processDispatchTimeout`, `:467-524`): every still-`offered` entry becomes `timeout`, the RTDB offers are removed, and the next attempt runs at the next tier. Tiers come from `FoodFeeSettings.dispatchRadiusTiers` (default `[2,4,6,8,10,15]` km). After the last tier, **the cycle restarts at 2 km** with `offeredTo` cleared. With no eligible riders, it moves to the next tier after 60 s. **It never gives up by itself.**
- **Client timing**:
  - `NewOrderModal.jsx` shows a **60 s countdown** and then calls `onReject` (→ **pass**).
  - The ring repeats every **4.5 s for up to 120 s** (`useDeliveryNotifications.js:228-229`), with a 15 s dedupe per order, and a background `showNotification` when the tab is hidden.
  - On resync, offers older than 60 s are dropped (`order.service.js:853`). `/orders/available` returns offered orders even after 60 s until the timeout job marks them.
- **Admin manual assignment** (`order.service.js:1693+`) sets `dispatch.status:'accepted'` directly. The rider gets `order_status_update` and an FCM "New Order Assigned! 🚀" (`type:"delivery_accepted"`). The app must load it through `/orders/active`.
- **Polling fallback (web)**: while online on the feed or orders tab, `GET /orders/active` + `GET /orders/available?limit=20&page=1` every **45 s when the socket is connected, 15 s when not**, skipping hidden tabs (`DeliveryHomeV2.jsx:1120-1195`).

### 3.4 FCM and web push for the delivery role

- **Web**: `registerWebPushForCurrentModule` saves the token through #45, or #47 inside the Flutter WebView. In-app, an FCM `new_order` is relayed as the window event `delivery-fcm-order-alert` (`firebaseMessaging.js:642-658`).
- **Pushes the rider receives**:

| `data.type` | Format | Source |
|---|---|---|
| `new_order` | notification+data, urgent | dispatch |
| `order_claimed` | notification+data | another rider accepted |
| `delivery_accepted` | notification+data | admin assigned |
| `order_status_update` | **data-only** | picked up / reached drop |
| `order_completed` | **data-only**, with `amountCollected` and `paymentMethod` | delivered |
| `onboarding_approved` / `onboarding_rejected` | notification+data | admin decision |

  Admin broadcasts also arrive.
- **Storage and targets**: `listOwnerUrgentPushTargets` (`core/notifications/voip.service.js:158-200`) merges the Android `pushDevices[].fcmToken` with the legacy `fcmTokens` and `fcmTokenMobile`. Regular pushes use `fcmTokens` + `fcmTokenMobile` (`notifyOwnersSafely`).
- **Native FCM token with no backend change: yes.**
  1. `POST /food/auth/delivery/verify-otp {phone, otp, fcmToken, platform:"mobile"}` saves into `fcmTokenMobile`, **even for pending riders**, so the approval push arrives.
  2. `POST /food/delivery/register` multipart with `fcmToken`, `platform=mobile`.
  3. After login (preferred): `POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android", deviceId}` with Bearer DELIVERY_PARTNER. Repeat it on token refresh.
  4. `PATCH /food/delivery/profile` with `fcmToken`, `platform=mobile` also works.
  - On logout: `DELETE /fcm-tokens/device/remove {deviceId, fcmToken}`, then `POST /food/auth/logout {refreshToken, fcmToken, platform:"mobile"}`.
- **Android channel**: create channel id **`default`**, high importance, with a ringtone sound for `new_order`. Data-only messages need a headless or background handler to display a notification.
- **APNs VoIP (iOS only, ignore)**: `APNS_VOIP_TOPIC_DELIVERY` (alias `APNS_TOPIC_DELIVERY`) plus the shared keys listed in the restaurant audit. **Never send `voipToken` on Android.**

---

## 4. Background location

### 4.1 What the backend expects

- **Assignment depends on the stored location.** Dispatch ranks riders by `lastLat`/`lastLng` (section 3.3). These fields are updated **only** by:
  - `PATCH /food/delivery/availability` with numeric `latitude`/`longitude` (the web does this at most every 45 s, and only while the page is alive);
  - `POST /food/delivery/location`.
  - The socket `update-location` does **not** update them (it writes `lastLocation` only, after 30 s).
- **There is no stale-location handling.** `lastLocationAt` is never compared, there is no cron that sets idle riders offline, and a socket disconnect only logs (`socket.js:339-347`). If the rider's location stops updating, for example because the app is killed or backgrounded:
  - the rider **stays `online`**;
  - they keep being offered orders based on the **last known position** (or as `locationUnknown` if they never had one);
  - they keep receiving offer FCMs.
  - Only the 60 s offer timeout handles a non-responsive rider: dispatch re-broadcasts to the same tier every cycle.
- **Customer tracking** stalls. The user app shows the last `location-update`. Nothing on the server detects or reports staleness.
- **Admin live monitor** (`admin/controllers/liveMonitor.controller.js:68`) reads `lastLat`, `lastLng`, `lastLocationAt` and `availabilityStatus` for display only.
- **Conclusion**: nothing in the backend *requires* background location, but correct dispatch and live tracking *depend on* it. **RN recommendation:**
  - Run a foreground-service location task while online (expo-location `startLocationUpdatesAsync` with a foreground-service notification). Post to `POST /food/delivery/location` at the cadence it returns.
  - Emit the socket `update-location` while on a trip, if the socket is alive.
  - Set the rider offline (`PATCH /availability {status:"offline"}`) on logout, when location permission is revoked, and when the rider turns tracking off.

### 4.2 `POST /food/delivery/location` (unused by the web, built for the native wrapper)

`delivery.routes.js:61`, `delivery/services/deliveryTracking.service.js:14-322`.

- **Body**: any of `{locations:[point…]}`, a bare array, a single point, or `{locations:point}`.
- **Point**: `{lat|latitude, lng|longitude, capturedAt?:ISO, orderId?:<24-hex>, speed?, heading?|bearing?, accuracy?, altitude?, battery?}`. Invalid coordinates are skipped. Points are deduped per `(rider, capturedAt)` into `DeliveryLocationLog`, so this supports **offline backlogs**.
- **Effects** (only when the newest point is newer than `lastLocationAt`):
  - Mongo `lastLat`, `lastLng`, `lastLocation`, `lastLocationAt` (this **is what dispatch uses**);
  - Redis hot keys;
  - RTDB `delivery_boys/<id>` (`is_online`, `active_order_id`) and `active_orders/<id>`;
  - socket `location-update` to the `tracking:<_id>` and `tracking:<order_id>` rooms and the restaurant room.
- **Response** `data`: `{processedCount, totalReceived, activeOrderId, config:{stopTracking, mode, intervalMs, distanceFilterMeters}}`:

| Rider state | `mode` | `stopTracking` | `intervalMs` | `distanceFilterMeters` |
|---|---|---|---|---|
| Not approved, or offline with no trip | `offline` | `true` | 30000 | 100 |
| On a trip | `onTrip` | `false` | 10000 | 20 |
| Online, idle | `idle` | `false` | 20000 | 50 |

- **Caveats** (section 6):
  - The "active order" lookup uses statuses `['accepted','confirmed','reached_pickup','picked_up','out_for_delivery','reached_drop']`, so a trip in `preparing` or `ready_for_pickup` is treated as "idle". It does not filter `dispatch.status:'accepted'`.
  - It selects a non-existent `user` field, so it never emits to the customer's `user:` room.
  - It does **not** set the rider online.
  - Rate: at 10 s per point it uses about 90 of the 100 requests per 15 minutes. **Batch points** (for example, one POST every 30–60 s carrying several points), or confirm the production `RATE_LIMIT_MAX`.

---

## 5. Uploads

| What | Endpoint | Multipart field(s) | Auth | Notes |
|---|---|---|---|---|
| Registration KYC + selfie | POST `/food/delivery/register` | `profilePhoto`, `aadharFrontPhoto`, `aadharBackPhoto`, `aadharPhoto`, `panPhoto`, `drivingLicenseFrontPhoto`, `drivingLicenseBackPhoto`, `rcPhoto` (1 each; `upiQrCode` accepted but ignored) + text fields (section 1.4) | none | sharp resizes to 800×800, folder `delivery`. A URL string is also accepted per field. |
| Profile photo | PATCH `/food/delivery/profile` | **`profilePhoto`** (+ optional text fields) | D | Returns `data.partner.profilePhoto` (URL string). **This is the only file this endpoint stores.** |
| Profile photo (base64) | POST `/food/delivery/profile/photo-base64` | JSON `{base64, mimeType}` (≤8 MB) | D | unused by the web |
| Remove photo / set photo URL | PATCH `/food/delivery/profile/details` | JSON `{profilePhoto:""\|"<url>"}` | D | |
| UPI QR (bank) | PATCH `/food/delivery/profile/bank-details` | **`upiQrCode`** + `documents[...]` text keys | D | |
| Shift-start selfie | PATCH `/food/delivery/availability` | JSON `shiftStartPicBase64` (raw base64, no `data:` prefix) + `shiftStartAddress` | D | Required by the web UI to go online. The backend accepts going online without it. |
| KYC re-upload after registration | **none works** | `ProfileDocsV2.jsx` sends `aadharPhoto`, `panPhoto` and `drivingLicensePhoto` to PATCH `/profile`. The first two are discarded; `drivingLicensePhoto` is not a multer field, so multer rejects it with "Unexpected field". | | section 6 |
| Pickup bill photo | none | `confirm-pickup` accepts `billImageUrl`. The web always sends `null`. If needed, upload through `POST /uploads/image` (`file` + `folder`, unauthenticated, see the user audit) and pass the URL. | | |

Other upload notes:

- Multer memory storage has **no size or type limits** (`middleware/upload.js`).
- In RN, send `{uri, name, type}` parts and let the client set the boundary.
- Image URLs may be relative `/uploads/...` when local storage is used. Prefix them with `https://cityfood.co.in`.

---

## 6. Broken or dead call sites, and backend issues (listed, not fixed)

### Frontend: broken, dead or wasteful

1. **F1: `PATCH /availability` on every GPS fix.** The "status sync" effect depends on `riderLocation` (`DeliveryHomeV2.jsx:644-660`), so each `watchPosition` fix sends PATCH `{status}` plus an RTDB `set`. Together with the 15–45 s poll and the 45 s heartbeats, this goes far beyond 100 requests per 15 minutes.
2. **The bank screen saves nothing.** `ProfileBankV2.jsx:50-58` sends `{documents:{bankDetails, pan}}` to `/profile/details`, which ignores it, and still toasts "Bank details updated". The working path is `ProfileDetailsV2.jsx:400-411` → `/profile/bank-details`.
3. **Document re-upload does nothing or errors.** `ProfileDocsV2.jsx:71-73` uploads `aadharPhoto`/`panPhoto` (discarded by PATCH `/profile`) and `drivingLicensePhoto` (not a multer field, so it is rejected).
4. **Logout leaves the rider online** (`ProfileV2.jsx:165-205`). There is no `availability:offline` call, and `delivery-v2-online-pref` is not cleared. The rider keeps receiving offers and FCMs, and the next login auto-sends `status:online` without a selfie (the effect at `:645`).
5. **The reject reason is never saved.** `deliveryAPI.rejectOrder(id, {reason})` sends a body that `rejectOrderDeliveryController` drops. It is triggered only by `order_auto_killed`, which is never emitted.
6. **Dead socket listeners:** `new_order` (restaurant-only), `order_cancelled`, `order_auto_killed`, `order_reassigned_elsewhere` and `play_notification_sound` are never emitted. `reconnect` and `reconnect_attempt` on the socket never fire in v4.
7. **`DeductionStatementV2` is always empty.** It asks `/wallet?type=deduction`, and no transaction has type `deduction`.
8. **`OTP.jsx:330-410` `handleSubmitName`** re-verifies the same OTP with a name. The backend has no name-based auto-register, and the OTP is consumed on first use. This is a dead path.
9. **Bill photo**: `pickUpOrder(billImageUrl, otp)` is always called with `null`.
10. **`getProfile` reads `profile.documents?.photo`** (`DeliveryHomeV2.jsx:458`), which does not exist. It falls back to `profileImage.url`.
11. **The terms and privacy screens are empty in production.** `/food/pages/{privacy,terms}[_delivery]` all return `data:null`.
12. **The "Skip OTP" pickup button and the "Mark delivered" bypass** are product decisions exposed in the UI (`PickupActionModal.jsx:243`, `DeliveryHomeV2.jsx:1280`). Decide whether RN keeps them.

### Backend issues

1. **The drop OTP is bypassable.** `PATCH /orders/:id/complete` with no `otp` (or `"SKIP"`/`"BYPASS"`/`"NONE"`) marks the drop OTP verified and delivers the order (`order-delivery.service.js:1204-1225`). The pickup OTP is also bypassable with `otp:"SKIP"` (`:996-1011`).
2. **OTP leakage to the rider.** `reached-pickup` and `confirm-pickup` return `order.toObject()` with `+pickupOtp +deliveryOtp`. `reject` and `status` return it with `+deliveryOtp`. A rider can read the customer's drop OTP from the reached-pickup response.
3. **`PATCH /orders/:id/status` is unsafe.** The rider may set `picked_up` (skipping pickup OTP), `preparing`/`ready_for_pickup`, or **`cancelled_by_restaurant`** on their own order (`validators/order.validator.js:128-138`, `odsvc:1346-1381`). There is no refund or finance handling there. The web does not call it.
4. **Delivery is possible without pickup.** `complete` only checks `isStatusAdvance(from,'delivered')`, so an order in `confirmed`, `preparing` or `ready_for_pickup` can be delivered directly. COD cash is recorded as collected (`capturePayment` `rider_cod`) with no cash confirmation step.
5. **A rider can unassign an in-progress order.** `PATCH /orders/:id/reject` works on any order assigned to the rider, even `picked_up`. It resets dispatch and re-dispatches (`:757-817`). It only refuses when the rider is not the assignee.
6. **There is no stale-location handling or auto-offline** (section 4.1). Riders without any GPS fix still receive offers.
7. **Socket `update-location` has no assignment check.** Any authenticated rider can broadcast fake positions for any `orderId`, including to arbitrary `user:`/`restaurant:` rooms via `userId`/`restaurantId`, and can overwrite RTDB `active_orders/<id>` (`socket.js:205-330`). (`joinRoom` lets anyone join any room, as noted in the earlier audits.)
8. **Firebase RTDB is used unauthenticated by clients.** The web reads `delivery_partner_offers/<riderId>` and writes `delivery_boys/<riderId>` with no Firebase auth, so the DB rules must allow public access to those paths. Offer payloads include **customer name, phone and address** for every rider in the broadcast radius. The rules were not verified (the URL is in `.env`).
9. **`POST /food/delivery/location` bugs.** The active-order statuses are wrong (`accepted`, `out_for_delivery` and `reached_pickup` are not order statuses here; `preparing`/`ready_for_pickup` are missing), and there is no `dispatch.status` filter. It selects `user` instead of `userId`, so customers never receive this path's `location-update` through the `user:` room.
10. **The socket location path never updates `lastLat`/`lastLng`.** The BullMQ sync writes `lastLocation` only, and uses `findOneAndUpdate({orderId})` on the order, which misses the Mongo `_id`. Dispatch therefore ignores socket-only riders' movement.
11. **`PATCH /availability` treats a missing or invalid `status` as `offline`.** A location-only body (for example `{latitude, longitude}`) silently takes the rider offline.
12. **Status is not enforced after login.** `authMiddleware`/`requireRoles` and refresh never check `status`, so a rejected ("blocked") rider with a token keeps API access. They are only excluded from new dispatch. The 2026-05-26 legacy bypass lets older riders log in even when `rejected`.
13. **verify-otp saves the FCM token before the status check.** The phone match is an unanchored "ends with last 10" regex.
14. **Registration is unauthenticated and does not verify phone ownership.** The duplicate check is an exact-string match, while login matches the last 10 digits, so `98…` and `9198…` registrations can coexist and the login picks either. Re-registering a `rejected` phone **hard-deletes** the old rider(s), orphaning their orders and finance. The 201 response returns the full document (bank and Aadhaar fields, tokens).
15. **`GET /food/auth/me` returns the entire rider document**, including bank account number, Aadhaar and PAN numbers, FCM tokens and device list. `documents.drivingLicense.document` reads the non-existent `drivingLicensePhoto`, so it is always null. Aadhaar front and back are not exposed under `documents`.
16. **`PATCH /food/delivery/profile` silently drops KYC files** and `panNumber`, `aadharNumber`, `email` and `zoneId`. KYC cannot be updated after registration.
17. **The cash-limit block was removed.** `/orders/available` always returns `cashLimit.blocked:false`, and accept no longer checks cash capacity (`odsvc:~450-456`), even though the UI still shows a deposit banner.
18. **The withdrawal request accepts a client-supplied `bankDetails`** (`deliveryFinance.service.js:111-163`), which overrides the profile bank account. Admin approval is the only safeguard.
19. **Account deletion** has no guard for an active trip, unpaid cash in hand or pending withdrawals.
20. **`POST /food/delivery/reverify` is a stub** that always returns success.
21. **Offer broadcast scope**: `order_claimed` goes to room `all_delivery` (every online rider), and offers reach every rider in the tier every 60 s, forever, until accepted or cancelled.
22. **`modules/food/orders/services/order-delivery-HEAD.service.js`** (1188 lines) is an unreferenced leftover copy of the delivery service.
