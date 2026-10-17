# CityFood customer app: API audit for the React Native port

This is a read-only audit; no repository files were changed. For `.env` files, only key names are listed, never values.

- Frontend paths are relative to `Frontend/src/`.
- Backend paths are relative to `Backend/src/` unless they start with `Backend/`.
- Production base URL: `https://cityfood.co.in/api/v1`. Every path below is relative to it.
- The backend router is mounted at both `/api` and `/` (`app.js:122-123`), so `/v1/...` also works.

---

## 0. Summary for the RN team

| Topic | Fact |
|---|---|
| Auth transport | Only `Authorization: Bearer <accessToken>`. No cookies anywhere: the backend never sets one and the frontend never uses `withCredentials`. |
| Login | Phone OTP: `POST /food/auth/user/request-otp`, then `POST /food/auth/user/verify-otp`. A brand-new user must call verify **twice**: the first call returns `needsName:true`, and the second resends the same OTP plus `name`. |
| Tokens | Returned in the JSON body: `data.accessToken` (also `data.token`) and `data.refreshToken`. JWT claims are `{userId, role:"USER"}`. Both tokens default to a **365-day** expiry (`JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES`). |
| Refresh | `POST /food/auth/refresh-token {refreshToken}` returns `{accessToken, refreshToken}`. There is **no rotation**: you get the same refresh token back. |
| CORS | `app.use(cors())` with defaults (origin `*`). A native app with no `Origin` header is allowed. Socket.IO CORS defaults to `*` (`SOCKET_CORS_ORIGIN`). |
| Error envelope | Success is `{success:true, message, data}`. Errors come in **two** shapes: `{success:false, message}` (middleware and some controllers) or `{success:false, error}` (global errorHandler and zod failures). Read `message ?? error`. |
| Zone headers | The web client sends `X-Zone-Id`, `X-User-Lat` and `X-User-Lng` on every user request. The backend never requires them. `X-Zone-Id` is copied into `req.query.zoneId`, but Redis cache keys ignore the header, so **always also send `?zoneId=`**. |
| Rate limits | Each authenticated user gets 100 requests per 15 minutes in production (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`), and over the limit you get 429. OTP routes allow 30 requests per 15 minutes per IP, and 3 OTPs per phone per 10 minutes. Wallet money routes allow 20 per 10 minutes. Poll carefully. |
| Realtime | Socket.IO runs on a **separate process**: port `SOCKET_PORT` (default 5001), default path `/socket.io`. In production behind HTTPS the client uses the API origin, `https://cityfood.co.in`. Auth is `auth: {token}`. The user app does **not** read Firebase RTDB. |
| Payments | Razorpay. Create-order and wallet top-up responses include `razorpay: {key, orderId, amount (paise), currency}`. Verify endpoints need **camelCase** `razorpayOrderId`, `razorpayPaymentId` and `razorpaySignature`. |
| Push | A native FCM token can be registered **with no backend change**: `POST /fcm-tokens/device/save {fcmToken, pushPlatform:"mobile", devicePlatform:"android"|"ios"}`, or `POST /fcm-tokens/mobile/save {token}`, or pass `fcmToken` + `platform:"mobile"` in verify-otp. Android needs a notification channel with id `default`. |
| Endpoint count | **70 distinct working backend endpoints** are used by customer-facing code (section 3). There are also 5 broken or dead call sites: 4 call undefined client methods, and 1 calls a restaurant-only endpoint. |

---

## 1. Frontend HTTP client

### 1.1 Files

- `services/api/axios.js`: the axios factory and the per-role clients.
- `services/api/auth.js`: auth calls and the `/me` cache.
- `services/api/index.js` (2155 lines): every domain API object: `authAPI`, `userAPI`, `orderAPI`, `restaurantAPI`, `locationAPI`, `zoneAPI`, `uploadAPI`, `diningAPI`, `publicAPI`, `searchAPI`, `supportAPI` and `notificationAPI`. It also exports `publicGetOnce` and the `getPublic*` helpers. Its default export is the legacy `apiClient`.
- `services/api/config.js`: `API_BASE_URL`, plus the `API_ENDPOINTS` map. That map is mostly empty strings; only the CMS page paths and business settings are filled in.
- `modules/Food/utils/auth.js`: token storage helpers.
- `modules/Food/utils/appStorage.js`: namespaced storage helpers.
- `modules/Food/utils/locationPersistence.js`: zone and location storage.
- Aliases: `@food/api` resolves to `src/services/api`, and `@food` to `src/modules/Food` (`Frontend/vite.config.js:16-21`).

### 1.2 Base URL

- `axios.js:12-15`: `VITE_API_BASE_URL` with any trailing `/` stripped, falling back to `/api/v1`. In development the Vite proxy forwards `/api` and `/uploads` to `http://localhost:5000` (`vite.config.js:26-31`).
- Frontend `.env` key names: `VITE_API_BASE_URL`, `VITE_SOCKET_PORT`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_RAZORPAY_KEY_ID` (not referenced in code), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT`. `VITE_SOCKET_BASE_URL` is read by the code but is not present in `.env`.

### 1.3 Axios instances (`axios.js`)

- **`createModuleClient(module)`** (`:111-249`) creates `userClient`, `restaurantClient`, `deliveryClient` and `adminClient` (`:255-258`). Each one uses `timeout: 30000` and `Content-Type: application/json`, and none sets `withCredentials`.
  - **Request interceptor** (`:137-170`):
    - For `FormData` bodies it deletes the Content-Type header.
    - It sets `Authorization: Bearer ${getAccessToken(module)}`.
    - For the `user` module it adds the headers `X-Zone-Id`, `X-User-Lat` and `X-User-Lng`, taken from `readStoredZoneContext()`.
  - **Response interceptor** (`:173-246`):
    - **429**: rejected immediately, with no refresh.
    - **403**: dispatches `window` event `accessDenied`, does not log out, and rejects.
    - **401**, if the request was not already retried:
      1. Read the refresh token. If there is none, `onRefreshFailed()` clears the module's auth and dispatches `authRefreshFailed`.
      2. Single-flight: concurrent 401s queue behind one refresh.
      3. Refresh with plain `axios.post(`${baseURL}/food/auth/refresh-token`, {refreshToken}, {timeout:10000})` (`:217-218`).
      4. Store the new access token with `setModuleAccessToken`, and store the refresh token if one comes back (`localStorage[`${module}_refreshToken`]`).
      5. Dispatch `authRefreshed`, then replay the original request with the new Bearer token.
      6. If the refresh fails, clear the module's auth, dispatch `authRefreshFailed`, and reject.
    - `formatApiError` (`:59-105`) rewrites `err.message` and `err.response.data.message` into friendly text.
- **Legacy `apiClient`** (default export, `:264-321`):
  - It picks the token by URL pattern: `/admin/` means the admin token, `/delivery` the delivery token, `/restaurant/` the restaurant token, and anything else the user token.
  - It adds the zone headers for user and delivery requests.
  - It has **no refresh logic**: it only formats errors.
  - It is used for `notificationAPI`, `publicAPI.getBusinessSettings`, `adminAPI.getPublicFeeSettings`, `authAPI.logout`/`refreshToken`, and the default `api` import (landing settings, intro ads, gourmet, under-250, CMS pages).
- **Uploads** (`index.js:1931-1963`): raw `axios.post` with a 300 s timeout. The token is the first one found among `admin_accessToken`, `restaurant_accessToken`, `delivery_accessToken`, `user_accessToken` and `accessToken`. The customer profile-image upload goes through `userClient` instead.

**RN recommendation:** keep a single `userClient` with Bearer auth, single-flight refresh on 401, no refresh on 429, and normalization of both error shapes. Because tokens last 365 days, refresh will rarely fire, but keep it.

### 1.4 Storage keys used for auth (web)

Two parallel stores are written by `setAuthData` (`modules/Food/utils/auth.js:288-344`):

1. Namespaced JSON (`appStorage.js:19-21`): `food:v1:<scope>:<name>`, with JSON-encoded values.
2. Legacy plain `localStorage` keys.

| Purpose | Namespaced key | Legacy key |
|---|---|---|
| Access token | `food:v1:auth:user:accessToken` | `user_accessToken` (oldest fallback: `accessToken`, `axios.js:27`) |
| Refresh token | `food:v1:auth:user:refreshToken` | `user_refreshToken` (oldest fallback: `refreshToken`, `axios.js:41`) |
| Auth flag | `food:v1:auth:user:authenticated` | `user_authenticated` (`'true'`) |
| User object | `food:v1:auth:user:user` | `user_user` (JSON) |
| FCM token sent to backend | `food:v1:auth-meta:fcm:user` | `fcm_web_registered_token_user` |
| Session data | `food:v1:auth-meta:user:sessionData` | `sessionStorage.userAuthData` (the key is `${module}AuthData`) |

- The same pattern exists for the other roles: `restaurant_*`, `delivery_*`, `admin_*`.
- `clearModuleAuth('user')` (`:188-212`) also removes `userProfile`, `user_user` and `user_edit_profile_draft`.
- Other user keys:
  - `sessionStorage.userAuthData`: OTP page handoff (`pages/user/auth/OTP.jsx:39`).
  - `sessionStorage.draft_phone_login` (`modules/auth/pages/Login.jsx:64`).
  - `localStorage.userAddresses`: address cache (`context/ProfileContext.jsx`).
- Zone and location keys (`locationPersistence.js`): `food:v1:zone:id|status|data`, `food:v1:location:current|mode`, plus the legacy keys `userLocation`, `userLat`, `userLng`, `deliveryAddressMode`, `userZoneId`, `userZone` and `outOfService`.
- Login state check `isModuleAuthenticated` (`auth.js:163-182`): the user is logged in if the access token is unexpired and has role `USER`, **or** if the refresh token is unexpired.

---

## 2. Backend auth for the USER role

### 2.1 Routes (`core/auth/auth.routes.js`, mounted at `/v1/food/auth` and `/v1/auth`, `routes/index.js:38,41`)

#### `POST /food/auth/user/request-otp` (`auth.routes.js:26`, `authRateLimiter`)

- Body: `{ phone }`. It must be a digits-only string, 8-15 characters, with no `+` (`dtos/auth/userOtpRequest.dto.js:4-10`).
  - SMS (SMSWala) requires the last 10 digits to match `^[6-9]\d{9}$` (`core/otp/otp.service.js:36-40`).
  - The web app sends the last 10 digits (`services/api/auth.js:437-453`).
- Response: `{success:true, message:"OTP sent successfully", data:{phone, otp?}}` (`auth.controller.js:14-19`). `otp` is echoed back only when `NODE_ENV != production` or `USE_DEFAULT_OTP=true` (`auth.service.js:104-106`).
- OTP rules:
  - 6 digits, expiring after 300 s (`OTP_EXPIRY_SECONDS`).
  - At most 3 requests per phone per 600 s (`OTP_RATE_LIMIT` / `OTP_RATE_WINDOW`), otherwise 400.
  - At most 5 verify attempts (`OTP_MAX_ATTEMPTS`) (`otp.service.js:89-158`).
- Bypasses:
  - `USE_DEFAULT_OTP=true` makes the OTP `123456` for every phone.
  - Two phone suffixes are hard-coded to `123456` (`otp.service.js:106,141`). These are review/test numbers.

#### `POST /food/auth/user/verify-otp` (`auth.routes.js:27`, `authRateLimiter`)

- Body (`dtos/auth/userOtpVerify.dto.js:4-19`):

  ```json
  { "phone": "9876543210", "otp": "123456", "ref": "<referrer user _id, optional>",
    "name": "optional 2-100 chars", "fcmToken": "optional", "platform": "web|mobile" }
  ```

  `otp` must be a **string**.
- **New user without `name`**: the OTP is verified but **not consumed**. The response is `data:{isNewUser:true, needsName:true}` with no tokens (`auth.service.js:136-151`). The client must call verify-otp again with the same phone, the same otp and `name`. The web app handles this at `modules/auth/pages/Login.jsx:184-189, 236-257`.
- A deactivated user gets 401 "Your account has been deactivated..." (`auth.service.js:178-182`).
- An `fcmToken` sent with `platform:"mobile"` goes into `fcmTokenMobile`; otherwise it goes into `fcmTokens` (`auth.service.js:185-204`).
- `ref` is applied only to brand-new users, and only when the referral settings are active (`auth.service.js:213-291`).
- Success (`auth.service.js:308-314`):

  ```json
  {"success":true,"message":"Login successful",
   "data":{"token":"<jwt>","accessToken":"<jwt>","refreshToken":"<jwt>","isNewUser":false,
     "user":{"id","_id","name","phone","email","role","isVerified","isActive","profileImage",
             "gender","referralCode","refCode","referralCount","walletAmount"}}}
  ```

- The web client stores the result with `setAuthData("user", accessToken, user, refreshToken)` (`Login.jsx:200`; `pages/user/auth/OTP.jsx`).

#### JWT (`core/auth/token.util.js`; `config/env.js:36-39`)

- Secret env keys: `JWT_ACCESS_SECRET` (falls back to `JWT_SECRET`) and `JWT_REFRESH_SECRET`.
- Expiry env keys: `JWT_ACCESS_EXPIRES` and `JWT_REFRESH_EXPIRES`, both defaulting to `365d`.
- Claims: `{userId, role}`.
- Refresh tokens are stored in Mongo collection `food_refresh_tokens` as `{userId, token, expiresAt}` with a TTL index (`core/refreshTokens/refreshToken.model.js`; `auth.service.js:302-306`).
- **There are no cookies anywhere in the backend.** A grep for `cookie` / `Set-Cookie` returns nothing.

#### `POST /food/auth/refresh-token` (`auth.routes.js:45`, no auth, no rate limiter)

- Body: `{refreshToken}` (`dtos/auth/refreshToken.dto.js`).
- Checks: the token must exist in the database, verify against the refresh secret, and belong to a USER who is still active (`auth.service.js:941-973`).
- Response: `{success:true, message:"Access token refreshed", data:{accessToken, refreshToken}}`. The refresh token returned is the **same** one; its database expiry is slid forward (`auth.service.js:975-977`; `auth.controller.js:42-46`).

#### `POST /food/auth/logout` (`auth.routes.js:48`, no auth)

- Body: `{refreshToken?, fcmToken?, platform?}`. At least one of the two tokens is required, otherwise 400.
- It deletes the refresh token and pulls the FCM token from every owner collection (`auth.service.js:552-587`).
- Response: `data:{invalidated:boolean}`.
- The web client sends the stored refresh token and the cached FCM token (`services/api/index.js:186-191`, `auth.js:543-555`).

#### `GET /food/auth/me` (`auth.routes.js:51`, `authMiddleware`)

- For USER it returns `data:{user:<raw lean FoodUser doc>}`, which is a different shape from the verify-otp `user`. Fields: `_id, phone, countryCode, name, email, profileImage, fcmTokens, fcmTokenMobile, pushDevices, dateOfBirth, anniversary, gender, referralCode, referredBy, referralCount, isVerified, isActive, flag, codEnabled, role, addresses[], lastKnownLocation, createdAt, updatedAt` (`core/users/user.model.js:68-189`).
- The web wraps this call in a 3 s cache with single-flight (`index.js:61-83`, `auth.js:577-646`).
- `GET /food/user/profile` also exists and returns `data:{user}` (`modules/food/user/routes/user.routes.js:41`).

### 2.2 Middleware

- **`authMiddleware`** (`core/auth/auth.middleware.js:20-54`):
  - Reads **only** `Authorization: Bearer`. It does not read cookies or a query token.
  - Sets `req.user = {userId, role}`.
  - For USER it does a database lookup on every request. A missing or deactivated user gets 401 `{success:false, message:"User account is deactivated"}`.
  - It then applies `apiRateLimiter`, keyed by userId: 100 requests per 15 minutes in production (`middleware/rateLimit.js:6-26`).
  - Other 401 bodies: `{success:false, message:"Authentication token missing"}` and `{..."Invalid or expired token"}`.
- **`requireRoles`** (`core/roles/role.middleware.js:3-17`): 401 `"Not authenticated"`; 403 `"Forbidden: insufficient permissions"`.
- **`requireZone`** (`middlewares/zone.middleware.js:7-22`, global at `routes/index.js:28`):
  - It never rejects a request.
  - If `X-Zone-Id` (or `?zoneId`) is a valid ObjectId, it sets `req.zoneId` and copies it into `req.query.zoneId`.
  - It ignores `X-User-Lat` and `X-User-Lng`. Only the restaurant-list controller reads those headers.
- Other global middleware: `helmet` (headers only), `mongo-sanitize`, and `xss-clean`. xss-clean HTML-escapes strings in request bodies (`app.js:42-105`). The JSON body limit is 15 MB.

### 2.3 CORS

- The only Express CORS setup is `app.use(cors())` at `app.js:85`, which reflects the default `*`.
- There is no other CORS configuration in `server.js`, `socket-server.js` or the routes.
- **Native clients with no `Origin` header are allowed.**
- Socket.IO: `origin: SOCKET_CORS_ORIGIN`, default `*` (`config/socket.js:51-56`).

### 2.4 Delete account

- `DELETE /food/user/account` (`user.routes.js:72`) runs a transaction that anonymizes orders and deletes the user (`services/deleteAccount.service.js:13-131`).
- Response: `{success:true, message:"Account deleted successfully", data:null}`.
- Tokens stop working afterwards because the user document no longer exists.

---

## 3. Every customer-facing API call

Paths are relative to `/api/v1`.

- "Auth" says whether a USER Bearer token is required.
- Response shapes come from the backend controllers. Every response is wrapped as `{success, message, data:<shown>}` unless the table says otherwise.
- FE = the frontend file(s) that make the call.

### 3.1 Auth (5)

| # | Method & path | Auth | Request | Response `data` | FE callers |
|---|---|---|---|---|---|
| 1 | POST `/food/auth/user/request-otp` | – | `{phone}` (10 digits) | `{phone, otp?}` | `modules/auth/pages/Login.jsx:93,121`; `pages/user/auth/SignIn.jsx:119`; `OTP.jsx:373` (resend) |
| 2 | POST `/food/auth/user/verify-otp` | – | `{phone, otp, ref?, name?, fcmToken?, platform?}` | `{token, accessToken, refreshToken, isNewUser, user}` or `{isNewUser:true, needsName:true}` | `Login.jsx:182,236`; `OTP.jsx:214,313` |
| 3 | POST `/food/auth/refresh-token` | – | `{refreshToken}` | `{accessToken, refreshToken}` | `services/api/axios.js:217` (interceptor) |
| 4 | POST `/food/auth/logout` | – | `{refreshToken?, fcmToken?, platform?}` | `{invalidated}` | `pages/user/profile/Profile.jsx:405`; `profile/Logout.jsx:118` |
| 5 | GET `/food/auth/me` | Bearer | – | `{user:<full doc>}` | `context/ProfileContext.jsx:161`; `dining/TableBookingConfirmation.jsx:51`; also via `userAPI.getProfile` in `components/user/AddMoneyModal.jsx:69`, `hooks/useUserNotifications.js:40` and `hooks/useOrderLocationSubscription.js:20` |

### 3.2 Profile and account (3)

| # | Method & path | Auth | Request | Response `data` | FE |
|---|---|---|---|---|---|
| 6 | PATCH `/food/user/profile` | Bearer | All optional: `{name, email, phone (cannot change), profileImage (URL), dateOfBirth "YYYY-MM-DD", anniversary "YYYY-MM-DD", gender: male\|female\|other\|prefer-not-to-say}` (`dtos/food/userProfileUpdate.dto.js:10-18`) | `{user}` | `profile/EditProfile.jsx:342`; `Login.jsx:261` |
| 7 | POST `/food/user/profile/profile-image` | Bearer | multipart, field **`file`** | `{profileImage, user}` | `profile/EditProfile.jsx:256` |
| 8 | DELETE `/food/user/account` | Bearer | – | `null` | `profile/Profile.jsx:482` |

### 3.3 Addresses (5): `modules/food/user/routes/user.routes.js:62-66`

The address object (`core/users/user.model.js:3-66`):

```
{ _id, label: Home|Office|Other, street, additionalDetails, city, state, zipCode, phone,
  location: {type:'Point', coordinates:[lng, lat]}, isDefault, createdAt, updatedAt }
```

| # | Method & path | Request | Response `data` | FE |
|---|---|---|---|---|
| 9 | GET `/food/user/addresses` | – | `{addresses:[Address]}` | `ProfileContext.jsx:173` |
| 10 | POST `/food/user/addresses` | `{label?, street*, additionalDetails?, city*, state*, zipCode?, phone?, latitude*:number, longitude*:number}` (`validators/userAddress.validator.js:11-21`) | 201 `{address}` | `ProfileContext.jsx:224`, called from `cart/AddressSelectorPage.jsx:667` and `cart/SelectAddress.jsx:145` |
| 11 | PATCH `/food/user/addresses/:id` | Same fields, all optional | `{address}` | `ProfileContext.jsx:247` |
| 12 | DELETE `/food/user/addresses/:id` | – | `{success:true}` | `ProfileContext.jsx:269` |
| 13 | PATCH `/food/user/addresses/:id/default` | `{}` | `{address}` | `ProfileContext.jsx:367` |

Address quirks:

- Request coordinates are **flat numbers**, but the response returns GeoJSON `coordinates:[lng,lat]`. The web also sends a `location` field; it is ignored.
- A POST with an existing label **overwrites** that address. A user therefore has at most one Home, one Office and one Other.
- The address API accepts `Work` and maps it to `Office`.

### 3.4 Location and zone (4)

| # | Method & path | Auth | Request | Response `data` | FE |
|---|---|---|---|---|---|
| 14 | GET `/food/user/location` | Bearer | – | `{location: null \| {latitude, longitude, address, formattedAddress, city, state, area, accuracy, updatedAt}}` | `hooks/useLocation.jsx:773` |
| 15 | PUT `/food/user/location` | Bearer | `{latitude\|lat*, longitude\|lng*, address?, formattedAddress?, city?, state?, area?, accuracy?}` | `{location}` | `hooks/useLocation.jsx:320`; `context/LocationProvider.jsx:96` |
| 16 | GET `/food/location/reverse-geocode?lat&lng` | – | query | `{results:[{formatted_address, address_components:{area,city,state,country,postal_code}}], location:{latitude, longitude, area, city, state, country, postalCode, formattedAddress, address, source?}}` | `hooks/useLocation.jsx:345,377` |
| 17 | GET `/food/zones/detect?lat&lng` | – | query | `{status:'IN_SERVICE'\|'OUT_OF_RADIUS'\|'OUT_OF_ZONE', zoneId, zone}` | `hooks/useZone.jsx:86` |

Notes:

- Also available but unused by the user screens:
  - `GET /food/zones/public` returns `{zones:[...]}`.
  - `POST /food/location/distance {rider?,restaurant?,customer?:{lat,lng}}` returns `{legs}`.
- Third-party calls made directly from the browser (not our API):
  - Google Geocoding (`hooks/useLocation.jsx:100`; `cart/AddressSelectorPage.jsx:463,531`).
  - BigDataCloud reverse geocoding (`useLocation.jsx:139`).
  - Nominatim (`useLocation.jsx:150`; `AddressSelectorPage.jsx:179`; `cart/SelectAddress.jsx:119`).
  - The Google Maps key comes from the build-time `VITE_GOOGLE_MAPS_API_KEY` (`utils/googleMapsApiKey.js:15`).

### 3.5 Restaurants, menu and catalog (9)

| # | Method & path | Auth | Query / request | Response `data` | FE |
|---|---|---|---|---|---|
| 18 | GET `/food/restaurant/restaurants` | – | `limit` (FE default 1000), `page`, `zoneId`, `lat`, `lng` (or the headers), `radiusKm`, `sortBy` (nearest\|rating\|rating-high\|rating-low\|price-low\|price-high\|newest\|deliveryTime), `cuisine`, `minRating`, `maxDeliveryTime`, `maxPrice`, `hasOffers`, `topRated`, `trusted`, `search`, `city`, `area` | `{restaurants:[...], total, page, limit}` | `pages/user/Home.jsx:1200`; `restaurants/Restaurants.jsx:63`; `CategoryPage.jsx:807`; `Under250.jsx:687`; `restaurants/RestaurantDetails.jsx:290,654`; `cart/Cart.jsx:648`; `profile/Support.jsx:58` |
| 19 | GET `/food/restaurant/restaurants/:idOrSlug` | – | `lat`, `lng` | `{restaurant:<raw doc + offers[], restaurantOffers.coupons, recommendedItems, rating, distanceInfo>}` | `RestaurantDetails.jsx:274,307`; `cart/Cart.jsx:587`; `orders/OrderTracking.jsx:1395`; `orders/UserOrderDetails.jsx:64`; `dining/DiningRestaurantDetails.jsx:122`; also `diningAPI.getRestaurantBySlug` in `RestaurantDetails.jsx:253` and `dining/TableBooking.jsx:148` |
| 20 | GET `/food/restaurant/restaurants/:id/menu` | – | – | `{menu:{sections:[{id, categoryId, name, image, sortOrder, itemCount, items:[...], subsections:[]}], categories:[...]}}` | `RestaurantDetails.jsx:773`; `Home.jsx:1686`; `CategoryPage.jsx:931`; `Under250.jsx:754`; `cart/Cart.jsx:830`; `DiningRestaurantDetails.jsx:157` |
| 21 | GET `/food/restaurant/restaurants/:id/outlet-timings` | – | ObjectId only | `{outletTimings:{Monday:{isOpen, openingTime:'HH:mm', closingTime}, ...}}` | `RestaurantDetails.jsx:630`; `dining/TableBooking.jsx:165`; `utils/outletTimingsCache.js:15` (via `hooks/user/useDeferredOutletTimings.js`) |
| 22 | GET `/food/restaurant/restaurants/:id/addons` | – | – | `{addons:[{id, _id, name, description, price, image, images[]}]}` | `cart/Cart.jsx:742` |
| 23 | GET `/food/restaurant/offers` | – | none (params ignored) | `{allOffers:[{id, offerId, couponCode, title, discountType, discountValue, maxDiscount, customerScope, restaurantScope, restaurantId, restaurantName, restaurantSlug, restaurantImage, deliveryTime, restaurantRating, endDate, showInCart, minOrderValue}], groupedByOffer}` | `Offers.jsx:34`; `profile/Coupons.jsx:18`; `RestaurantDetails.jsx:200`; `cart/Cart.jsx:941` (`getCouponsByItemIdPublic` filters `allOffers` on the client) |
| 24 | GET `/food/restaurant/categories/public` | – | `zoneId`, `limit`, `page`, `search` | `{categories:[{id, _id, name, image, type, status, isActive, foodTypeScope, zoneId, sortOrder, ...}], total, page, limit}` | `Home.jsx:768`; `CategoryPage.jsx:563`; `Under250.jsx:915` (`getPublicCategories`) |
| 25 | GET `/food/restaurant/foods/public` | – | `zoneId`, `maxPrice`, `limit`, `page` | `{foods:[{id, _id, restaurantId, restaurantName, categoryId, categoryName, name, description, price, image, foodType, isAvailable, isRecommended}], total, page, limit}` | `CategoryPage.jsx:209`; `components/user/home/MealsUnderSection.jsx:23` |
| 26 | GET `/food/search/unified` | – | `q`, `categoryId`, `lat`, `lng`, `zoneId`, `radiusKm` (20), `isVeg`, `minRating`, `maxDeliveryTime`, `page`, `limit` | `{restaurants:[raw docs + matchType:'restaurant'\|'food', matchedDish*, originalRestaurantId, distanceText], total, page, limit, zoneFiltered, wasFallback?}` | `search/ProfessionalSearch.jsx:153` |

Restaurant list item fields (`restaurant.service.js:1689-1707`):

```
_id, restaurantId, id, name/restaurantName, area, city, cuisines[], location (GeoJSON + address),
profileImage:{url}|null, coverImages[], estimatedDeliveryTime, estimatedDeliveryTimeMinutes,
offer, featuredDish, featuredPrice, discount, rating, totalRatings, isAcceptingOrders,
pureVegRestaurant, isActive, isBanned, openingTime, closingTime, openDays[], zoneRank,
outletTimings, recommendedItems[], previewItems[], distanceInfo, distanceText, distanceInKm?
```

The list returns `[]` when it has no zone, no city/state and no lat/lng. Banned restaurants are included (with `isBanned:true`), so the client must filter them out.

Menu item fields:

```
{id, _id, categoryId, categoryName, name, description, price, priceOnOtherPlatforms,
 variants:[{id, name, price}], variations (same as variants), image, foodType:'Veg'|'Non-Veg',
 isAvailable, isRecommended, preparationTime}
```

There is no per-item addon list; addons are per restaurant (#22). Unavailable items are included with `isAvailable:false`.

Cross-cutting catalog notes:

- `profileImage` is `{url}` on the list endpoint, but a raw string on detail, search, offers and dining.
- There is no `slug` field. Detail, menu and addons accept a dash-separated slug that matches `restaurantNameNormalized`.
- There is no `isOpen` field. Compute it from `outletTimings`.
- The veg flag is `pureVegRestaurant` for restaurants and `foodType==='Veg'` for items.

Coupon endpoints that exist but are **unused** by the screens:

- `GET /food/promocodes/restaurant/:restaurantId` returns `{promocodeList}`.
- `POST /food/promocodes/validate {code, restaurantId, orderAmount}` returns `{promocode, discountAmount, finalAmount}`.
- Both are public. Coupons are applied through `/food/orders/calculate` (`couponCode`) instead.

### 3.6 Landing, CMS and config (11)

| # | Method & path | Auth | Query | Response `data` | FE |
|---|---|---|---|---|---|
| 27 | GET `/food/landing/settings/public` | – | `zoneId` | Settings doc: `showHeroBanners, showUnder250, showDining, showExploreIcons, showTop10, showGourmet, under250PriceLimit, mealsUnder{enabled, title, priceLimit, maxItems}, festBannerImages[], stats, appLinks, socialLinks, footerLinks, exploreMoreHeading, recommendedRestaurants[]` | `Home.jsx:815`; `components/user/BottomNavigation.jsx:17`; `components/user/DesktopNavbar.jsx:156`; `Under250.jsx:580`; `app/MasterLandingPage.jsx:143` |
| 28 | GET `/food/explore-icons/public` | – | `zoneId` | `{items:[{_id, label, iconUrl, linkType, link, order}]}` | `Home.jsx:814` |
| 29 | GET `/food/hero-banners/public` | – | `zoneId` | `{banners:[{_id, imageUrl, title, ctaText, ctaLink, sortOrder, linkedRestaurants[]}]}` | `Home.jsx:892` |
| 30 | GET `/food/hero-banners/ads/public` | – | – | `{banners:[{_id, imageUrl, title, ctaText, ctaLink, diningType}]}` | `Home.jsx:940`; `Dining.jsx:197` |
| 31 | GET `/food/hero-banners/gourmet/public` | – | `zoneId` | `{restaurants:[{_id, name, rating, profileImage:{url}, coverImages, cuisines, slug, location, estimatedDeliveryTime, ...}]}` | `Home.jsx:816`; `Gourmet.jsx:50` |
| 32 | GET `/food/hero-banners/under-250/public` | – | `zoneId` | `{banners:[...]}` | `Under250.jsx:556` |
| 33 | GET `/food/app-intro-ads/public` | – | – | **Unwrapped**: `{success, data:[{_id, title, mediaUrl, mediaType, duration, order, restaurantId:{...}}]}` | `components/user/AppIntroSplash.jsx:29` |
| 34 | GET `/food/pages/:key` (about, terms, privacy, refund, shipping, cancellation) | – | – | `{title, content (HTML)}`; for about: `{appName, version, description, logo, features[], stats[]}`; `null` if never saved | `profile/About.jsx:71`, `Terms.jsx:27`, `Privacy.jsx:27`, `Refund.jsx:27`, `Shipping.jsx:27`, `Cancellation.jsx:28` |
| 35 | GET `/food/admin/business-settings/public` | – (explicit public route, `routes/index.js:62`) | – | `{companyName, email, phone{countryCode, number}, address, logo/userLogo/favicon{url}, supportEmail, supportPhone, supportHours, onlinePaymentOnly, maxCodAmount, maintenanceMode, ...}` | `cart/Cart.jsx:136`; `utils/businessSettings.js:106`; `modules/auth/pages/PublicSupport.jsx:23` |
| 36 | GET `/food/admin/fee-settings/public` | **Admin token required (bug)** | – | `{feeSettings}` when reachable | `cart/Cart.jsx:1103`. **Customers get 401/403** because the route sits inside the admin-auth mount (`routes/index.js:65`, `admin.routes.js:31`). Cart falls back to `/orders/calculate`. |
| 37 | GET `/app-config/:appName` (user_app etc.) | – | – | **Unwrapped**: `{success, data:{appName, primaryColor, secondaryColor, logoUrl, fontFamily}}`; 404 if not configured | `utils/themeSettings.js:9` (fetches all four app names) |

### 3.7 Orders (9): `modules/food/orders/routes/order.routes.user.js` (USER Bearer)

| # | Method & path | Request | Response `data` | FE |
|---|---|---|---|---|
| 38 | GET `/food/orders/check-rider-availability` | `?restaurantId&zoneId` | `{available, count, reason: available\|no_online_riders\|all_riders_busy\|no_riders_in_zone}` | `cart/Cart.jsx:1926` |
| 39 | POST `/food/orders/calculate` | `{items:[{itemId*, name*, price*, quantity*, variantId?, variantName?, variantPrice?, originalPrice?, isVeg?, image?, notes?}], restaurantId*, deliveryAddress?:{location:{coordinates:[lng,lat]}}, couponCode?, zoneId?, deliveryAddressId?, deliveryFleet?}` | `{pricing:{subtotal, tax, taxBreakdown, packagingFee, deliveryFee, deliveryFeeBreakdown?, freeDeliveryUpTo, platformFee, discount, couponDiscount?, total, currency, couponCode, appliedCoupon, couponError}}`. A bad coupon still returns 200, with `couponError` set. | `cart/Cart.jsx:1020,1498,1567,1633` |
| 40 | POST `/food/orders` | See the payload below the table | 201 `{order, razorpay: {key, orderId, amount(paise), currency} \| null}` | `cart/Cart.jsx:1946` |
| 41 | POST `/food/orders/verify-payment` | `{orderId (Mongo _id or FOD-id), razorpayOrderId, razorpayPaymentId, razorpaySignature}` | `{order, payment}` | `cart/Cart.jsx:2079` |
| 42 | GET `/food/orders` | `?page&limit` (FE default 20) | `{data:[order], meta:{total, page, limit, totalPages}}`. The FE normalizes this into `{orders, pagination}` (`index.js:2012-2053`). | `orders/Orders.jsx:195,223`; `orders/OrderTracking.jsx:768`; `components/user/OrderTrackingCard.jsx:151`; `RestaurantDetails.jsx:721`; `profile/Support.jsx:48` |
| 43 | GET `/food/orders/:orderId` | Mongo `_id` or `FOD-xxxx` | `{order}` (see the shape below the table) | `OrderTracking.jsx:797`; `UserOrderDetails.jsx:43`; `OrderInvoice.jsx:46`; `complaints/SubmitComplaint.jsx:50`; `OrderTrackingCard.jsx:260,315` |
| 44 | PATCH `/food/orders/:orderId/cancel` | `{reason?, refundDestination?: 'source'\|'wallet'}` | `{order}` | `OrderTracking.jsx:1285`; `cart/Cart.jsx:2131,2155` (auto-cancels when Razorpay is dismissed or fails) |
| 45 | PATCH `/food/orders/:orderId/instructions` | `{instructions}` | `{order}` (raw doc, not normalized) | `OrderTracking.jsx:1318` |
| 46 | PATCH `/food/orders/:orderId/ratings` | `{restaurantRating* 1-5, deliveryPartnerRating? 1-5, restaurantComment?, deliveryPartnerComment?}` | `{}` (the backend returns nothing) | `orders/Orders.jsx:662`; `OrderTracking.jsx:583` |

Create-order payload (#40, `order.validator.js:76-100`):

```
{ items[]*, address*:{street*, city*, state*, label?: Home|Office|Other, name?, fullName?, additionalDetails?,
  zipCode?, phone?, location?:{type:'Point', coordinates:[lng,lat]}},
  restaurantId*, pricing*:{subtotal*, total*, tax?, packagingFee?, deliveryFee?, platformFee?, discount?, currency?},
  paymentMethod*: cash|razorpay|razorpay_qr|card|wallet,
  restaurantName?, customerName?, customerPhone?, deliveryFleet?, note?, restaurantNote?,
  sendCutlery?, zoneId?, scheduledAt? (ISO) }
```

- The web builds this at `Cart.jsx:1688-1719, 1872-1891`.
- There is no `couponCode` or `tip` field; zod strips them, including `pricing.couponCode`.
- The create-order address rejects the label `Work`.
- The server trusts the client's `pricing.total`.

Order detail shape (#43, `order.helpers.js:194-220`):

```
_id, orderMongoId, orderId ("FOD-xxxxxxx"), status/orderStatus, items, deliveryAddress,
pricing, payment{method, status, amountDue, razorpay, refund},
restaurantId (populated: restaurantName, profileImage, location, area, city, rating, primaryContactNumber),
dispatch.deliveryPartnerId (populated: name, phone, rating, profileImage),
deliveryState{currentPhase, currentLocation{lat,lng}}, deliveryVerification.dropOtp{required, verified},
handoverOtp?, statusHistory, ratings, note, sendCutlery, scheduledAt, createdAt
```

Order enums (`order.model.js`):

- `orderStatus` (`:295-312`): created, confirmed, preparing, ready_for_pickup, reached_pickup, picked_up, reached_drop, delivered, cancelled_by_user, cancelled_by_restaurant, cancelled_by_admin, dead.
- `payment.status`: cod_pending, created, authorized, paid, failed, refunded, pending_qr.

Other order rules:

- Unpaid Razorpay orders are hidden from the list and auto-cancelled after 15 minutes.
- Cancelling is allowed while the status is `created`, or within 65 s of creation.

Extra routes that exist but are unused on the web:

- `GET /food/orders/:orderId/payments`
- `GET /food/orders/:orderId/drop-otp` returns `{otp}` while the order is at the drop phase.

### 3.8 Wallet and referrals (5)

| # | Method & path | Request | Response `data` | FE |
|---|---|---|---|---|
| 47 | GET `/food/user/wallet` | – | `{wallet:{balance, referralEarnings, transactions:[{id, type, amount, status, description, date, category, balanceAfter, razorpayOrderId, razorpayPaymentId}]}}` | `Wallet.jsx:40`; `cart/Cart.jsx:1067,2005` |
| 48 | POST `/food/user/wallet/topup/order` | `{amount}`: rupees, more than 0 and at most 50000 | `{razorpay:{key, orderId, amount(paise), currency}}` | `components/user/AddMoneyModal.jsx:50` |
| 49 | POST `/food/user/wallet/topup/verify` | `{razorpayOrderId, razorpayPaymentId, razorpaySignature, amount}`; `amount` is required | `{wallet}` | `AddMoneyModal.jsx:99` |
| 50 | GET `/food/user/referrals/stats` | – | `{stats:{referralCount, totalReferralEarnings, rewardAmount}}` | `profile/Profile.jsx:247` |
| 51 | GET `/food/user/referrals/details` | – | `{stats:{...+totalInvited, creditedCount, pendingCount, rejectedCount}, invitedFriends:[{id, name, phone(masked), profileImage, status, rewardAmount, earnedAmount, invitedAt}]}` | `profile/ReferEarn.jsx:50` |

Related public endpoint (unused): `GET /food/referral-settings` returns `{referralSettings}`.

### 3.9 Support, complaints and safety (4)

| # | Method & path | Request | Response `data` | FE |
|---|---|---|---|---|
| 52 | POST `/food/user/support/ticket` | `{type*: order\|restaurant\|other, issueType*, description?, orderId (Mongo _id, required if type=order), restaurantId (required if type=restaurant)}` | 201 `{ticket:{_id, type, orderId, restaurantId, issueType, description, status:'open', adminResponse}}` | `profile/Support.jsx:84`; `complaints/SubmitComplaint.jsx:117` (`orderAPI.submitComplaint` maps to `{type:'order', orderId, issueType, description}`) |
| 53 | GET `/food/user/support/my-tickets` | `?page&limit` | `{tickets, total, page, limit}` | `profile/Support.jsx:35` |
| 54 | POST `/food/user/safety-emergency-reports` | `{message}` (10-4000 chars) | 201 `{report}` | `profile/ReportSafetyEmergency.jsx:105` |
| 55 | GET `/food/user/safety-emergency-reports` | `?page&limit` | `{safetyEmergencies, pagination:{page, limit, total, pages}}` | `ReportSafetyEmergency.jsx:36` |

### 3.10 Notifications inbox (4): `core/notifications/notification.routes.js` (Bearer)

| # | Method & path | Response `data` | FE |
|---|---|---|---|
| 56 | GET `/food/notifications/inbox?page&limit` | `{items:[{_id, title, message, link, category, source, metadata, isRead, readAt, createdAt}], pagination:{page, limit, total, totalPages}, unreadCount}` | `hooks/useNotificationInbox.js:33`, used by `pages/user/Notifications.jsx` |
| 57 | PATCH `/food/notifications/:id/read` | notification | `useNotificationInbox.js:79` |
| 58 | DELETE `/food/notifications/:id` | notification (soft dismiss) | `useNotificationInbox.js:96` |
| 59 | DELETE `/food/notifications/inbox/all` | `{modifiedCount}` | `useNotificationInbox.js:109` |

### 3.11 Push / FCM tokens (5): `core/notifications/fcm.routes.js`

| # | Method & path | Auth | Request | FE |
|---|---|---|---|---|
| 60 | POST `/fcm-tokens/save` | Bearer | `{token, platform:'web'\|'mobile'}`. The FE switches to `/fcm-tokens/mobile/save {token}` when `platform==='mobile'`; that variant exists too. | `utils/firebaseMessaging.js:518` (`services/api/index.js:86-133`) |
| 61 | POST `/fcm-tokens/device/save` | Bearer | `{fcmToken\|token, voipToken?, pushPlatform:'mobile'\|'web', devicePlatform:'ios'\|'android'\|'web', deviceId?}` | `firebaseMessaging.js:536,576-581` (Flutter WebView bridge) |
| 62 | DELETE `/fcm-tokens/remove` | optional Bearer | body/query `{token, platform}` | `profile/Profile.jsx:399`; `profile/Logout.jsx:112` |
| 63 | DELETE `/fcm-tokens/device/remove` | Bearer | `{fcmToken\|voipToken\|deviceId}` | `Profile.jsx:391`; `Logout.jsx:104` |
| 64 | POST `/fcm-tokens/test` | Bearer | `{platform, channel}` | `Profile.jsx:509` |

### 3.12 Dining / table booking (6)

| # | Method & path | Auth | Request | Response `data` | FE |
|---|---|---|---|---|---|
| 65 | GET `/food/dining/categories/public` | – | – | bare array `[{_id, name, slug, imageUrl, restaurantCount}]` | `Dining.jsx:198` |
| 66 | GET `/food/dining/restaurants/public` | – | `category`, `city`, `zoneId` | bare array of restaurants, each with `categories`, `diningSettings{maxGuests, diningType}` | `Dining.jsx:199`; `DiningCategory.jsx:67` |
| 67 | GET `/food/dining/restaurants/:id/occupied-seats/public` | – | – | `{occupiedSeats}` | `dining/DiningRestaurantDetails.jsx:147` |
| 68 | POST `/food/dining/bookings` | Bearer | `{restaurant\|restaurantId, guests, date, timeSlot, specialRequest, userRef:{name, phone, email}}` | 201 booking `{_id, bookingId:'TB…', status:'pending', ...}` | `dining/TableBookingConfirmation.jsx:86` |
| 69 | GET `/food/dining/bookings/my` | Bearer | – | bare array of bookings (with populated restaurant) | `dining/MyBookings.jsx:112` |
| 70 | POST `/food/dining/bookings/:bookingId/review` | Bearer | `{bookingId, rating, comment}` | booking | `dining/MyBookings.jsx:127` |

### 3.13 Broken or dead call sites (do not port as-is)

| FE call | Problem |
|---|---|
| `restaurantAPI.getPublicDishes` (`components/user/SearchOverlay.jsx:71`) | The method is undefined in `services/api/index.js` and there is no backend route. It throws a TypeError, which is caught. Use #25 `foods/public` instead. |
| `restaurantAPI.getInventoryByRestaurantId` (`RestaurantDetails.jsx:980`) | The method is undefined and there is no backend route. Use `menu` items' `isAvailable`. |
| `adminAPI.getPublicCategories` (`pages/user/Categories.jsx:44`; `search/ProfessionalSearch.jsx:122`) | The method is undefined. Use #24, or `GET /food/search/categories/admin?zoneId`, which is public despite its name and returns `{categories}`. |
| `userAPI.getOrders` (`cart/Cart.jsx:1085`) | The method is undefined, so the first-order coupon count never loads. Use #42 with `limit=1` and read `meta.total`. |
| `diningAPI.getRestaurantBookings` (`dining/TableBooking.jsx:157,184`) | Calls `GET /food/dining/bookings/restaurant/:id` through `restaurantClient`. That route requires the RESTAURANT or ADMIN role, so it always fails for customers. |
| `GET /food/admin/fee-settings/public` (#36) | Requires an admin token, as described above. |

### 3.14 Endpoints the client must call outside our API

- Razorpay Checkout (see section 5).
- Google Maps JS and Geocoding, BigDataCloud, Nominatim (see section 3.4).
- Firebase Messaging (see section 6).

---

## 4. Realtime

### 4.1 Socket.IO (user)

- **Client**: `modules/Food/utils/userSocketManager.js` (one shared, ref-counted connection).
- **URL** (`utils/socketOrigin.js:13-60`):
  1. `VITE_SOCKET_BASE_URL` if set.
  2. Otherwise the origin of `API_BASE_URL` with `/api/v1` stripped. For `https:` it uses that origin with no port change. For `http:` it forces port `VITE_SOCKET_PORT` (default `5001`).
  - **Production: `https://cityfood.co.in`**. Nginx is assumed to proxy `/socket.io/` to the socket process.
- **Options** (`userSocketManager.js:78-84`): `path: '/socket.io/'`, `transports: ['websocket','polling']`, `reconnection: true`, `auth: {token}`, `query: {token}`.
  - When an `authRefreshed` event fires, the client updates `socket.auth` and reconnects (`:44-53, 162-167`).
- **Server**: `Backend/socket-server.js:41-44` listens on `SOCKET_PORT` (default 5001), and `config/socket.js` holds the logic.
  - The token is read from `handshake.auth.token`, then the `Authorization: Bearer` header, then `?token=`. It is verified with the access secret (`socket.js:17-25, 59-101`).
  - Errors: `connect_error` with message `AUTH_MISSING` or `AUTH_INVALID`.
  - A Redis adapter is used when `REDIS_ENABLED` and `REDIS_URL` are set.
  - The API process sends events through a Redis emitter (`Backend/server.js:61-70`).
- **Rooms**: users are auto-joined to `user:<userId>` (`socket.js:125-127`). Tracking rooms are named `tracking:<orderId>`.

Events the client emits:

| Event | When | Server behaviour |
|---|---|---|
| `join-tracking` (orderId) | On connect, for every tracked id. The web sends both the Mongo `_id` and the `FOD-` id (`components/user/DeliveryTrackingMap.jsx:246-253`). | Joins `tracking:<id>` and replies `tracking-room-joined {room, orderId}` (`socket.js:191-199`) |
| `leave-tracking` (orderId) | On unmount | `socket.js:333-337` |
| `resync` | On every connect (`userSocketManager.js:62`) | Replies `order_state <activeOrder>`, optionally `delivery_drop_otp`, then `resync_complete {timestamp}` (`socket.js:350-412`) |

Events the client listens to (`hooks/useUserNotifications.js:181-184`; `userSocketManager.js:56`):

| Event | Payload |
|---|---|
| `order_status_update` | `{orderMongoId, orderId, orderStatus, deliveryState?, deliveryVerification?, dispatch?, title?, message?}` (`order.service.js:1015,1275,1727,…`; `order-delivery.service.js:143`) |
| `order_state` | The full active-order snapshot (response to `resync`) |
| `delivery_drop_otp` | `{orderMongoId, orderId, otp, message}` (`order.helpers.js:79-91`) |
| `location-update` | Socket path: `{orderId, deliveryPartnerId, lat, lng, heading, speed, timestamp, status, polyline?, eta?}`, throttled to once per 10 s (`socket.js:218-263`). HTTP path adds `order_id, customOrderId, trackingId, driverId, accuracy` (`deliveryTracking.service.js:146-153`). |
| `admin_notification` | `{title, message}`. The client toasts it and refreshes the inbox. |
| `order_deleted` | Emitted by the server (`order.service.js:1934`). The web does not handle it. |

- **Polling fallback**: `OrderTracking.jsx:1111-1125` polls `GET /food/orders/:id` every 75 s while the socket is connected and every 12 s while it is not. Mind the rate limit of 100 requests per 15 minutes.
- Two socket security issues to fix server-side:
  - `joinRoom` (`socket.js:141-146`) lets any authenticated socket join any room.
  - `join-tracking` has no ownership check.
  - Together, these let any user receive another customer's drop OTP and location.

### 4.2 Firebase Realtime DB

- **The customer app does not read RTDB.** `realtimeTracking.js` exports `subscribeOrderTracking(active_orders/<id>)`, `subscribeDeliveryLocation(delivery_boys/<id>)`, `subscribeAllDeliveryLocations` and `subscribeRestaurantLocation(restaurant/<id>/location)`. Only delivery and admin code imports them (`hooks/useDeliveryNotifications.js`, `pages/admin/.../DeliveryBoyViewMap.jsx`, `DeliveryV2/pages/DeliveryHomeV2.jsx`).
- `useOrderLocationSubscription.js:39` says so explicitly: "Uses the shared user socket — no extra connection or Firebase reads."
- Paths the backend writes, for reference:
  - `active_orders/<orderMongoId>`: `{polyline, lat, lng, boy_lat, boy_lng, restaurant_lat, restaurant_lng, customer_lat, customer_lng, status, heading, speed, eta, last_updated}`.
  - `delivery_boys/<partnerId>`.
  - `delivery_partner_offers/<partnerId>/<orderId>`.
  - Sources: `socket.js:303-324`; `deliveryTracking.service.js:188-222`; `order-delivery.service.js:575-589`.
- An RN app could subscribe to `active_orders/<orderMongoId>` read-only if the RTDB rules allow it. That is not verified here; the rules are not in the repo.
- The web Firebase config uses `databaseURL: VITE_FIREBASE_DATABASE_URL` (`modules/Food/firebase.js:5-14`).

---

## 5. Payments: Razorpay

### 5.1 Food order (`pages/user/cart/Cart.jsx:1946-2160`)

1. *(Optional)* Call `POST /food/orders/calculate` for display pricing.
2. Call `GET /food/orders/check-rider-availability`. If the result is `available:false`, block the order.
3. Call `POST /food/orders` with `paymentMethod:'razorpay'`. The response is `data.razorpay = {key, orderId, amount (paise), currency:'INR'}`.
   - The backend converts with `amountPaise = round(total*100)` and requires at least 100 paise (`order.service.js:350-368`).
   - `razorpay` is `null` if Razorpay is not configured on the server; the order is still created.
4. Open Checkout (`utils/razorpay.js:63-147`). Options: `{key, amount, currency, order_id, name: <companyName from business settings>, description, image, prefill:{name, email, contact (last 10 digits)}, notes:{orderId, userId, restaurantId}, theme:{color:'#E23744'}, retry:{enabled:true, max_count:3}}`.
5. In the success handler, call `POST /food/orders/verify-payment {orderId: order._id, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature}`.
   - The backend checks an HMAC-SHA256 of `order_id|payment_id` (`orders/helpers/razorpay.helper.js:92-97`).
   - It then marks the order paid and starts dispatch (`order.service.js:507-553`).
6. On dismiss or failure, call `PATCH /food/orders/:id/cancel {reason}`. Even without that call, the server auto-cancels unpaid orders after 15 minutes.

Other payment methods and server details:

- `cash`: there is no gateway step. The user's `codEnabled` flag must be true. Business settings also control `onlinePaymentOnly` and `maxCodAmount`.
- `wallet`: the debit happens atomically during create, and the response comes back already `paid`. There is no split payment and no `useWallet` flag.
- `razorpay_qr` exists in the backend enum, but the web never uses it.
- Server env key names: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. They can be overridden in the DB through admin `/food/admin/env`.
- Webhook: `POST /payments/webhook/razorpay`, checked against `x-razorpay-signature`.
- The publishable key arrives in the create response, so the RN app needs no hard-coded key. Pass the same fields to `react-native-razorpay`.

### 5.2 Wallet top-up (`components/user/AddMoneyModal.jsx:40-130`)

1. Call `POST /food/user/wallet/topup/order {amount: rupees}` (more than 0 and at most 50000). The response is `data.razorpay = {key, orderId, amount (paise), currency}`.
   - In dev, when Razorpay is unconfigured, it returns `orderId:"order_dev_<ts>"` and `key:'rzp_test_dummy'`.
2. Open Checkout with `notes:{type:'wallet_topup', amount}`.
3. Call `POST /food/user/wallet/topup/verify {razorpayOrderId, razorpayPaymentId, razorpaySignature, amount}`.
   - The server checks the HMAC, fetches the payment from Razorpay (the order must match and the status must be `captured`), checks the PaymentIntent owner, matches the exact paise amount, and credits the wallet idempotently (`userWallet.service.js:125-189`).
   - The response is `data.wallet`.
4. Both money routes are limited to 20 requests per 10 minutes per user.

---

## 6. Push notifications (user FCM)

### Web flow (`modules/Food/utils/firebaseMessaging.js`)

- **Browser**: gets a token through the Firebase JS SDK with the VAPID key, then calls `userAPI.saveFcmToken(token, {platform:'web'})`, which posts `POST /fcm-tokens/save {token, platform:'web'}`. Saves are de-duplicated for 24 h (`services/api/index.js:86-133`).
- **Login**: the token is also sent in verify-otp as `{fcmToken, platform}` (`Login.jsx:170-182`; `OTP.jsx:197`).
- **Flutter WebView wrapper** (`firebaseMessaging.js:541-592`):
  1. Asks the native bridge for a token through `getFcmToken`, `getFCMToken`, `getPushToken` or `getFirebaseToken`. On iOS it also asks for a VoIP token.
  2. Posts `POST /fcm-tokens/device/save {fcmToken, voipToken?, pushPlatform:'mobile', devicePlatform:'ios'|'android'}`.
- **Logout**: `DELETE /fcm-tokens/device/remove`, then `DELETE /fcm-tokens/remove {token, platform}`, then `POST /food/auth/logout {refreshToken, fcmToken, platform}` (`Profile.jsx:391-405`).

### Backend

- Storage on FoodUser (`core/users/user.model.js:89-108`):
  - `fcmTokens:[String]` for web.
  - `fcmTokenMobile:[String]`.
  - `pushDevices:[{fcmToken, voipToken, pushPlatform, devicePlatform, appRole, deviceId, lastSeenAt}]`.
  - The last 10 tokens are kept per list. Invalid tokens are pruned automatically.
- Sending uses FCM HTTP v1 with a service account (`FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_SERVICE_ACCOUNT_PATH`). It targets **both** `fcmTokens` and `fcmTokenMobile` (`core/notifications/firebase.service.js:144-301, 472-580`).
- Each message carries:
  - `notification{title, body, image?}`.
  - `data`: all values stringified, with title and body copied in.
  - `android{priority:'high', notification:{channel_id:'default'}}`.
  - `apns{apns-priority:10, aps{sound, badge, alert, content-available?}}`.
  - `webpush`.

### Can a native FCM token be registered with no backend changes? Yes.

Use any of these:

- `POST /fcm-tokens/device/save {fcmToken, pushPlatform:'mobile', devicePlatform:'android'|'ios'}`. Recommended: it also records the device. Note that `deviceId` is accepted but never persisted (`firebase.service.js:312-319`).
- `POST /fcm-tokens/mobile/save {token}`
- `POST /fcm-tokens/save {token, platform:'mobile'}`
- verify-otp with `{fcmToken, platform:'mobile'}`

Platform requirements:

- On iOS, use the **FCM registration token**, not the raw APNs token. APNs-direct sending is only used for VoIP (`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_VOIP_P8_PATH`).
- On Android, create a notification channel with id **`default`**.
- `android.notification` is set even for data-only pushes, so Android may show the system notification itself instead of passing it to the app as data.

Security issues (server):

- `GET /fcm-tokens/test-set-token/:phone/:token` and `GET /fcm-tokens/test-get-token/:phone` are unauthenticated (`fcm.routes.js:53-93`).
- `DELETE /fcm-tokens/remove` without a Bearer token removes the token from every owner collection.

---

## 7. File uploads by the user

| Endpoint | Auth | Multipart fields | Limits / storage | Response |
|---|---|---|---|---|
| `POST /food/user/profile/profile-image` (`modules/food/user/routes/user.routes.js:43`) | Bearer USER | **`file`** (single image) | multer memoryStorage with no size or type limit (`middleware/upload.js:5`). Sharp resizes to at most 400x400 and converts to webp. Files go to Cloudinary when the DB setting says `cloudinary` and the `CLOUDINARY_*` env keys are set; otherwise to local `/uploads/<file>.webp`, a **relative URL**: prefix it with `https://cityfood.co.in`. A non-image returns 500. | `{success, message:"Profile image uploaded successfully", data:{profileImage, user}}` |

- The web calls this from `pages/user/profile/EditProfile.jsx:256` (`userAPI.uploadProfileImage`, `services/api/index.js:1782-1787`). It then also PATCHes `/food/user/profile` with `profileImage` (`EditProfile.jsx:333-342`).
- Generic `POST /uploads/image | /uploads/file | /uploads/video`:
  - Field `file`, plus an optional `folder`.
  - No auth.
  - Response `{data:{url, publicId:null}}`.
  - Customer screens do not use it.
- For RN, send `FormData` with `{uri, name, type}` under the field `file`, and let fetch or axios set the multipart boundary. The web client deletes the `Content-Type` header for FormData for the same reason (`axios.js:142-146`).

---

## 8. Porting checklist and gotchas

1. Store `accessToken`, `refreshToken` and `user` in SecureStore or Keychain. Send `Authorization: Bearer` on every request, plus `X-Zone-Id` and `?zoneId=` on catalog calls.
2. Handle the two-step verify-otp for new users (`needsName`).
3. Normalize errors from both `message` and `error` keys. `err.code` (for example `NO_RIDERS_AVAILABLE`) is never sent, so match on the message text.
4. Map Razorpay's snake_case response fields to camelCase before calling the verify endpoints. Wallet verify also needs `amount`.
5. Address requests use flat `latitude`/`longitude`; responses return GeoJSON `[lng, lat]`. One address per label.
6. `profileImage` is sometimes `{url}` and sometimes a string. Upload URLs may be relative.
7. Compute `isOpen` from `outletTimings`, and filter out `isBanned` restaurants.
8. Socket: connect to `https://cityfood.co.in` with path `/socket.io`, `auth:{token}`, transport `websocket`. Emit `resync` on connect, and `join-tracking` with both the Mongo `_id` and the `FOD-` id.
9. Budget for 100 authenticated requests per 15 minutes per user in production: avoid aggressive polling.
10. Don't port the broken calls listed in section 3.13. `fee-settings/public` needs a backend fix if it is required; otherwise rely on `/orders/calculate`.

### Backend issues found (FYI; nothing was modified)

- The restaurant detail endpoint (#19) and unified search (#26) return the **raw restaurant document**. It includes bank, PAN, GST and FSSAI data, owner phone and email, and FCM tokens.
- The public dining list leaks `ownerPhone`.
- Admin banner and landing CRUD on `landing.routes.js:67-123, 141-142` is unauthenticated.
- The dining review endpoint has no ownership check.
- Order detail leaks `pickupOtp` to the customer.
- Create-order trusts the client's `pricing.total`, and coupon usage is never incremented.
- Redis cache keys ignore the `X-Zone-Id` header.
- OTP bypass phone suffixes are hard-coded.
- Refresh tokens are not rotated, and tokens default to a 365-day expiry.
- The socket `joinRoom` and `join-tracking` handlers have no authorization.
- The FCM test routes are unauthenticated.
- Upload routes have no auth and no size limit.
