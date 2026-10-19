# Restaurant app: shell and shared components

The shell is the protected-area frame: navbar, hamburger drawer, floating bottom nav, block guard and the global overlays. It is a port of `components/restaurant/{RestaurantLayout, RestaurantNavbar, RestaurantSidebar, BottomNavOrders, RestaurantBlockGuard, GlobalPickupOtpModal, RestaurantModal, RestaurantPageShell}.jsx` and the new-order popup from `OrdersMain.jsx`.

Read `docs/SCREEN_GUIDE.md` first. Shell files are read-only for screen agents:

- `src/app/_layout.js`
- `src/app/(app)/_layout.js`
- `src/app/(app)/(tabs)/_layout.js`
- `src/components/shell/**`

## 1. Route files to create

The protected area is the `(app)` route group. Group names don't appear in URLs, so `src/app/(app)/dashboard.js` is `/dashboard`.

The `(app)` layout already does three things for every file under it:

1. Redirects to `/login` (with `from`) when logged out.
2. Applies the block guard.
3. Draws the navbar, drawer and bottom nav.

`withProtected(Screen)` is optional here. It's harmless if you keep it, as `SCREEN_GUIDE.md` says.

Keep route files thin (`export { default } from "../../screens/<area>/X";`).

### Tab screens

These render inside the `(tabs)` navigator. The bottom nav is their tab bar.

| Native path | File to create | Web component |
|---|---|---|
| `/` | `src/app/(app)/(tabs)/index.js` | `OrdersMain.jsx` |
| `/inventory` | `src/app/(app)/(tabs)/inventory.js` | `Inventory.jsx` |
| `/feedback` | `src/app/(app)/(tabs)/feedback.js` | `Feedback.jsx` (`?tab=reviews/complaints`) |
| `/explore` | `src/app/(app)/(tabs)/explore.js` | `ExploreMore.jsx` |

### Stack screens

These are pushed over the tabs. The "Bottom nav" column says whether the shell shows the floating bar on that screen, following the web's `HIDE_BOTTOM_NAV_PATTERNS`.

| Native path | File to create | Web component | Bottom nav |
|---|---|---|---|
| `/dashboard` | `src/app/(app)/dashboard.js` | `RestaurantDashboard.jsx` | yes |
| `/orders/all` | `src/app/(app)/orders/all.js` | `AllOrdersPage.jsx` | no |
| `/orders/:id` | `src/app/(app)/orders/[id].js` | `OrderDetails.jsx` | no |
| `/notifications` | `src/app/(app)/notifications.js` | `Notifications.jsx` | yes |
| `/delivery-settings` | `src/app/(app)/delivery-settings.js` | `DeliverySettings.jsx` | yes |
| `/menu-categories` | `src/app/(app)/menu-categories.js` | `MenuCategoriesPage.jsx` | yes |
| `/outlet-timings` | `src/app/(app)/outlet-timings.js` | `OutletTimings.jsx` | yes |
| `/outlet-info` | `src/app/(app)/outlet-info.js` | `OutletInfo.jsx` | yes |
| `/ratings-reviews` | `src/app/(app)/ratings-reviews.js` | `RatingsReviews.jsx` | yes |
| `/edit-owner` | `src/app/(app)/edit-owner.js` | `EditOwner.jsx` | yes |
| `/share-feedback` | `src/app/(app)/share-feedback.js` | `ShareFeedback.jsx` | yes |
| `/help-centre/support` | `src/app/(app)/help-centre/support.js` | `RestaurantSupport.jsx` | yes |
| `/hub-menu/item/:id` (`new` = create) | `src/app/(app)/hub-menu/item/[id].js` | `ItemDetailsPage.jsx` | no |
| `/hub-finance` | `src/app/(app)/hub-finance.js` | `HubFinance.jsx` (`?tab=invoices`) | yes |
| `/withdrawal-history` | `src/app/(app)/withdrawal-history.js` | `WithdrawalHistoryPage.jsx` | yes |
| `/promocodes` | `src/app/(app)/promocodes.js` | `Promocodes.jsx` | yes |
| `/update-bank-details` | `src/app/(app)/update-bank-details.js` | `UpdateBankDetails.jsx` | yes |
| `/zone-setup` | `src/app/(app)/zone-setup.js` | `ZoneSetup.jsx` | yes |

Notes:

- `/reservations` needs no file. `toNativePath` already maps it to `/explore`, as the web redirect does.
- The dropped stub routes (CONVERSION_CHECKLIST / audit §8) get no file.
- The auth routes stay at the root: `src/app/{welcome,login,otp,signup,onboarding,pending-verification,privacy,terms}.js` and `profile/{privacy,terms}.js`.
- Don't add `_layout.js` files inside `(app)`. If a screen needs a nested layout, ask the shell owner.

## 2. What the shell already draws

Don't draw any of these in a screen:

- **Navbar** (`RestaurantNavbar`): on every protected screen, under the status bar, with a light status-bar style. It contains:
  - the hamburger;
  - the logo;
  - the restaurant name;
  - the address • COMPANY line;
  - the Online/Offline pill;
  - search, on `/` and `/inventory` only;
  - the bell, which goes to `/notifications` and shows a red dot when there are unread notifications.
- **Drawer** (`RestaurantDrawer`): the 18 sidebar links, in the web's order and with the web's icons. It closes on a route change, on Android back, on an overlay tap or on X.
- **Bottom nav** (`BottomNavOrders`): a floating pill with a red dot on Orders when an order is waiting (`newOrder`) and a red dot on Feedback when there are unread notifications. It hides while the keyboard is open.
- **New-order popup**, with its reject popup, the 180 s countdown, the prep-time stepper (default 11) and the print button. It shows on every screen.
- **"Delivery Partner Arrived"** pickup-OTP modal.
- **Block guard screens**: "Checking account status..." and "Account Blocked".

### Screens must not

- render a navbar or bottom nav;
- open a socket, play sounds, or render the new-order or pickup-OTP popups;
- use `Screen` with the default `edges={["top"]}`. The navbar already handles the top inset. If you use `Screen`, pass `edges={[]}` and `statusBarStyle="light"` (the navbar sets `"light"`, and `Screen` would otherwise switch it to dark).

### Page background

The layout background is `bg-gray-100` (`tw.gray100`). Web pages that set their own `bg-*` keep it on their root `View`.

## 3. Hooks and components for screens

Import from `src/components/shell` (barrel) or from the file.

### Layout helpers

**`useShellBottomInset()`** (from `BottomNavOrders.js`)
- Returns a number. Use it as the `paddingBottom` of your scroll content (`contentContainerStyle`).
- Where the bottom nav shows, it is `88 + insets.bottom` (the web's `pb-[calc(5.5rem+safe-area)]`). Elsewhere it is `insets.bottom`.
- Bottom-pinned footers (Save bars on `hub-menu/item`, `orders/:id`) add `insets.bottom` themselves.

**`useKeyboardVisible()`**: returns a boolean.

**`RestaurantPageShell`** `{style, noPadding}`
- The web's `RestaurantPageShell`: `px-4 py-4`, full width.
- Put it inside your own `ScrollView`/`FlatList`. Use `PAGE_PADDING` if you'd rather apply the padding to `contentContainerStyle`.

**`RestaurantSubheader`** `{title, description, actions, style}`: title `text-xl font-black`.

**`RestaurantCardGrid`** `{style}`: one column, 16 gap.

### Modal

**`RestaurantModal`**
- Props: `{open, onClose, title, description, size, variant: "center" | "sheet", showClose, closeOnBackdrop, noPadding, bottomOffset, panelStyle, contentStyle}`.
- The web's `RestaurantModal`: an RN `Modal`, full width minus 16 px gutters at phone width, rounded-2xl. The sheet variant has `rounded-t-3xl` and sits at the bottom.
- Android back calls `onClose`. Used by `ShareFeedback` and `DeliverySettings` on web.

### Drawer and navigation

**`useRestaurantDrawer()`**
- Returns `{open, close, isOpen}`.
- The navbar hamburger already opens the drawer. Web screens have no other way to open it.

**`openShellRoute(path, currentPath)`**
- How the drawer and bottom nav navigate.
- Tab roots are opened with `router.dismissTo` (pop back to the tabs and switch tab). Other paths use `router.push`.
- Use it if a screen links to a tab root (for example Dashboard → `/feedback`).

### Navbar title and actions

There is no per-screen navbar customisation. On web, `RestaurantLayout` passes the navbar only the route defaults (`getRestaurantHeaderOptions`), and no restaurant screen calls `setLayoutOptions`.

Inner pages render their own sub-header (back chevron and title) at the top of their content, as the web pages do. Use `useAppBack()` or `router.back()` as `SCREEN_GUIDE.md` says.

### Shared state replacing the web's window events and localStorage

**`useRestaurantSearch()`**
- Returns `{query, results, isLoading, error}`. Replaces the `restaurantSearchUpdated` event.
- The navbar fills it with a debounced (500 ms) `getOrders({page: 1, limit: 100, search})` while the user types. The backend ignores `search`, as on web.
- Only `OrdersMain` listened to it on web. Inventory shows the search button but never used the results.

**`setRestaurantOnlineStatus(isOnline)`**
- Replaces `localStorage.setItem("restaurant_online_status", …)` plus the `restaurantStatusChanged` event. It updates the navbar pill.
- Call it wherever the web writes that key: the OrdersMain toggle and DeliverySettings.
- `useStoredOnlineStatus()` reads the stored value: `true`/`false`, or `null` when nothing is stored.

**`useInboxUnreadCount()`, `refreshInboxUnread()`, `setInboxUnreadCount(n)`**
- The unread count behind the bell and the Feedback dot.
- The shell polls `GET /food/notifications/inbox?limit=20` every 60 s while the app is in the foreground, and refreshes it on the socket's `admin_notification`.
- After `markAsRead`, `dismiss` or `dismissAll` in Notifications, call `setInboxUnreadCount(newCount)` or `refreshInboxUnread()`. This replaces the web's `foodNotificationInboxRefresh` event.

**`useBusinessSettings()`**
- Returns `{settings, companyName, logoUrl}` from `GET /food/admin/business-settings/public`, cached in AsyncStorage and fetched once per launch.
- Replaces `useCompanyName()`, `useAppLogo("restaurant_app")` and `getCachedSettings()`. Don't fetch business settings again in a screen.

### Logout and printing

**`useShellLogout()`**
- Returns `{logout, isLoggingOut}`. The web's `ExploreMore` logout: device/remove, fcm remove, `/food/auth/logout`, then clearing the `restaurant_*` storage (all inside `useAuth().logout()`).
- The `(app)` layout then replaces the screen with `/login`.
- Explore's account deletion, after `deleteAccount()` succeeds, calls `logout({to: "/welcome"})`, as the web navigates to welcome.
- Explore keeps its own confirmation UI.

**`printOrderReceipt(order)`**: the popup's 80 mm thermal receipt through `expo-print`. Throws on failure.

## 4. Ownership of order events and toasts

The popup used to live in OrdersMain. Now that it is global, the shell owns every toast that belonged to it.

**Shell toasts. Don't repeat them in screens:**
- "Order accepted successfully"
- the accept errors: the 400 message, or "Order not found. It may have been cancelled or already processed."
- "Order auto-rejected due to no response"
- "Order canceled by user" / "Order cancelled"
- "Order assigned by admin to you"
- "New scheduled order received for hh:mm AM"
- "Preparing thermal receipt..." / "Failed to prepare thermal receipt."
- the reject-failure alert

**What OrdersMain still owns:**
- its lists;
- its own toasts for actions taken from the list: mark ready, cancel a preparing order, the online toggle;
- refetching on `useRestaurantEvents` `orders_refresh`, `status_update`, `accepted`, `rejected` and `auto_rejected` events.

It must not render the popup or the reject dialog.

## 5. Reference

### Layout tree

```
src/app/_layout.js            fonts, ThemeProvider › AuthProvider › RestaurantGuardProvider ›
                              RestaurantNotificationsProvider, root Stack, HardwareBackBinding,
                              push binding, Toaster
src/app/(app)/_layout.js      redirect when logged out › RestaurantBlockGuard › RestaurantLayout
                              (navbar, drawer, StackBottomNav, NewOrderPopup) › Stack
                              + GlobalPickupOtpModal (outside the guard, as on web)
src/app/(app)/(tabs)/_layout.js   Tabs with tabBar = OrdersTabBar
```

### Files

| File | Exports |
|---|---|
| `RestaurantLayout.js` | `RestaurantLayout` (default), `useRestaurantDrawer` |
| `RestaurantNavbar.js` | `RestaurantNavbar` (default) |
| `RestaurantDrawer.js` | `RestaurantDrawer` (default) |
| `BottomNavOrders.js` | `OrdersTabBar`, `StackBottomNav`, `BottomNavOrdersBar`, `useShellBottomInset`, `useKeyboardVisible` |
| `RestaurantBlockGuard.js` | `RestaurantBlockGuard` (default), `CheckingAccountScreen`, `AccountBlockedScreen` |
| `NewOrderPopup.js` | `NewOrderPopup` (default) |
| `GlobalPickupOtpModal.js` | `GlobalPickupOtpModal` (default) |
| `RestaurantModal.js` | `RestaurantModal` (default) |
| `RestaurantPageShell.js` | `RestaurantPageShell` (default), `RestaurantSubheader`, `RestaurantCardGrid`, `PAGE_PADDING` |
| `stores.js` | search, online status, inbox unread, business settings |
| `logout.js` | `useShellLogout` |
| `navigate.js` | `openShellRoute` |
| `printReceipt.js` | `printOrderReceipt`, `buildReceiptHtml` |
| `layoutConfig.js` | `ORDERS_TABS`, `TAB_ROUTES`, `RESTAURANT_SIDEBAR_SECTIONS`, `showBottomNavFor`, `headerOptionsFor`, `activeTabFor`, `BOTTOM_NAV_SPACE` |
