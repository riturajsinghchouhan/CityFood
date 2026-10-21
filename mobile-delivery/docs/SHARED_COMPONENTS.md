# Delivery app: shell and shared components

Written by the shell agent. Read `docs/SCREEN_GUIDE.md` first. Everything here is **read-only** for screen agents; if you need a change, describe it in your report.

## 1. Navigation structure

```
src/app/_layout.js                 root: fonts, providers, root Stack, HardwareBackBinding, PushBinding, Toaster
src/app/login.js, otp.js, signup/*, terms.js, support.js, profile/{privacy,terms}.js
                                   public screens (auth agent), root Stack
src/app/(app)/_layout.js           PROTECTED group (web ProtectedRoute): redirects to /login?from=<path>
                                   when signed out; a Stack of (tabs) + every protected stack screen
src/app/(app)/(tabs)/_layout.js    HomeShell = DeliveryHomeV2: Expo Router Tabs + custom bottom nav
                                   + ShellOverlays (order panels, verification, summary)
src/app/(app)/(tabs)/index.js      Feed (shell agent)
```

- Everything under `src/app/(app)/` is already behind the login guard. **Do not wrap these screens in `withProtected()`.**
- Public screens (login, otp, signup, terms, support, profile/privacy, profile/terms) stay at the root, outside `(app)`.
- The web's `/feed` is `/`. Don't create a `feed` route.

## 2. Route files the screen agents create

Keep route files thin: import the screen from `src/screens/<area>/` and `export default` it.

### Shell tabs: `src/app/(app)/(tabs)/`

These files are already declared in the tabs layout. Expo Router warns in dev until they exist.

| File | Path | Web component | Notes |
|---|---|---|---|
| `pocket.js` | `/pocket` | `PocketV2` | Nav item "Pocket" |
| `orders.js` | `/orders` | `OrdersV2` | Nav item "Orders"; use `useShellActions()` (see §4) |
| `profile.js` | `/profile` | `ProfileV2` | Nav item "Profile" |
| `history.js` | `/history` | `HistoryV2` | Hidden tab (`href: null`). The bar is shown but no item is active. Opened from Profile with `router.push("/history")` |

### Stack screens: `src/app/(app)/`

| File | Path | Web component |
|---|---|---|
| `notifications.js` | `/notifications` | `NotificationsV2` |
| `profile/details.js` | `/profile/details` | `profile/ProfileDetailsV2` |
| `help/tickets/index.js` | `/help/tickets` | `help/SupportTicketsV2` |
| `help/tickets/create.js` | `/help/tickets/create` | `help/CreateSupportTicketV2` |
| `help/tickets/[ticketId].js` | `/help/tickets/:ticketId` | `help/ViewSupportTicketV2` |
| `help/id-card.js` | `/help/id-card` | `help/ShowIdCardV2` (opened from the feed header ID icon) |
| `pocket/payout.js` | `/pocket/payout` | `pocket/PayoutV2` |
| `pocket/deductions.js` | `/pocket/deductions` | `pocket/DeductionStatementV2` |
| `pocket/limit-settlement.js` | `/pocket/limit-settlement` | `pocket/LimitSettlementV2` |
| `pocket/balance.js` | `/pocket/balance` | `pocket/PocketBalanceV2` |
| `pocket/cash-limit.js` | `/pocket/cash-limit` | `pocket/CashLimitInfoV2` |
| `pocket/details.js` | `/pocket/details` | `pocket/PocketDetailsV2` |

Notes:
- `src/app/(app)/profile/` (protected) and `src/app/profile/` (public privacy/terms) can both exist; their full paths don't clash.
- Not built (audit §8): `profile/bank`, `profile/documents`, `pocket/statement`, `welcome`. `toNativePath` still knows these paths. Linking to one without a route file shows the Expo Router "unmatched route" screen, so don't link to them.
- Back: sub pages use `useAppBack()` from `src/navigation/back.js`. It already maps `pocket/*` → `/pocket`, `profile/*`, `help/id-card` and `help/tickets` → `/profile`, `help/tickets/*` → `/help/tickets`, and `notifications` → `/profile`.
- Stack screens have no bottom nav, matching the web, where sub pages unmount the shell.

## 3. Shell components (`src/components/shell/`)

| File | Export | Purpose |
|---|---|---|
| `DeliveryTabBar.js` | `default DeliveryTabBar` | Custom `tabBar` (receives `{state, descriptors, emitter, navigateToTab, insets}`). White bar, `border-t gray-100`, `px-8 py-3 pb-6`, LayoutGrid / Wallet / Package / User; active `gray-950` scale 1.1, inactive `gray-400` opacity 0.7 |
| | `NAV_ITEMS` | `[{name, label, icon}]` for index, pocket, orders, profile |
| | `useTabBarHeight()` | Full bar height in dp, including the bottom safe area. Tab scenes already end above the bar, so you rarely need it |
| | `DeliveryTabBarView` | Presentational bar `{activeName, onPress(item), bottomInset}` |
| `ShellOverlays.js` | `default` | Mounted once in the tabs layout. Don't render it yourself |
| `shellStore.js` | `useShellState()` | `{isModalMinimized, showVerification, bypassOtp}` |
| | `openVerification({bypassOtp})`, `closeVerification()`, `setModalMinimized(bool)`, `getShellState()`, `setShellState(patch)` | Shell UI state shared across tabs; on the web this was state in the single DeliveryHomeV2 instance |
| `useShellActions.js` | `default useShellActions()` | The handlers DeliveryHomeV2 passes to `OrdersV2`; see §4 |

### What the shell already shows (don't duplicate it in tab screens)

- **Feed only:**
  - top header (avatar, online toggle, emergency, ID card, bell + inbox sheet)
  - map / offline hero
  - NewOrderModal (offer + 60 s countdown + slide to accept / pass)
  - PickupActionModal
  - drop card, "VERIFY & COMPLETE"
- **Any shell tab:**
  - the minimised "Order Action Pending" bar
  - DeliveryVerificationModal (drop OTP → cash / Razorpay QR → complete)
  - OrderSummaryModal ("Well Done!")
  - the auto-killed-order reason prompt
- **App-wide (root, via DeliveryContext):** offer ring, socket, polling, background location, toasts for socket events.

Tab screens must not render their own offer popup or verification flow.

## 4. `useShellActions()`, for the Orders tab

```js
import useShellActions from "../../components/shell/useShellActions";
const { acceptOrder, passOrder, openOrder, markDelivered } = useShellActions();
```

| Web prop (`OrdersV2`) | Action | Behaviour |
|---|---|---|
| `onAccept(order)` | `acceptOrder(order)` | `DeliveryContext.acceptOffer` (GhostAssignFix lock, 403 → removes the offer with a toast, then refreshes `/orders/active`). Returns a promise that rejects on failure |
| `onPass(order)` | `passOrder(order)` | `passOffer` ("Order passed" toast) |
| `onOpen(order)` | `openOrder(order)` | `openAcceptedOrder(order)` (sets the active order and its phase), then `router.navigate("/")` |
| `onMarkDelivered(order)` | `markDelivered(order)` | Selects the order if it isn't the active one, then opens the verification flow with the OTP step skipped (web `handleTriggerMarkDelivered`). The flow opens over the current tab, as on the web |

For the lists, read `incomingOrders`, `acceptedOrders` and `orderCapacity` straight from `useDelivery()`.

## 5. Feed components (`src/components/feed/`)

These are internal to the feed and shell. You can reuse them, but don't edit them.

| File | Export | Notes |
|---|---|---|
| `ActionSlider.js` | `default ActionSlider({label, successLabel, onConfirm, disabled, color})` | Swipe-to-confirm pill. A rejected `onConfirm` resets it |
| `palette.js` | `p`, `alpha(hex, a)`, `tracking`, `GRADIENT_33DEG`, `GRADIENT_TO_RIGHT` | Tailwind v4 colours that `tw` lacks (amber, emerald, blue 300–500, purple…). Plus `alpha(hex, a)` for `/NN` opacity |
| `mapUtils.js` | `callPhone(n)`, `openUrl(url)`, `openRestaurantInMaps(order, address)`, `openCustomerDropInMaps(order)`, `fetchDrivingRoute`, `decodePolyline`, `parsePoint` | Google Maps links open through `Linking` (the Maps app on Android) |
| `tripParts.js` | `MinimizeHandle`, `MarkDeliveredButton` | |
| `BottomPopup.js` | `default BottomPopup({isOpen, onClose, title, children})` | DeliveryHomeV2's minimal popup |
| `useNotificationInbox.js` | `default useNotificationInbox({limit})` | `{items, unreadCount, refresh, markAsRead, dismissAll}`. Refreshes on the `inbox_refresh` event. NotificationsV2 also needs `dismiss(id)`; add it in your own area or ask |
| `useKeyboardHeight.js` | `default` | Keyboard height for absolute overlays |
