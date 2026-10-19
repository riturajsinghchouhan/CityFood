# Shared shell components

The shell pieces that Home, CategoryPage, Dining, Under250 and RestaurantDetails build on. Each one is a port of a web component. Paths below are relative to `src/`.

## Already mounted globally (do not mount again)

These are mounted in `app/_layout.js`, where the web's `UserLayout.jsx` puts them:

| Piece | Where | Behavior |
|---|---|---|
| `LocationGuard` | Stack `screenLayout`, around every route except `login` and `support` | Pass-through. The web version only copied location state into Redux. |
| `SearchOverlayHost` | After the Stack | Renders `SearchOverlay` while `useSearchOverlay().isSearchOpen`. To open it, call `openSearch()`, optionally after `setSearchValue(text)`. |
| `AppIntroSplashHost` | After the Stack, above everything except toasts | Shows admin intro ads once per app process. Not shown while the path is `/login` or `/support`. |
| `BottomNavigation` | `(tabs)/_layout.js` | Hides itself when `isOutOfService`. |

## Placement rules for floating pieces

`StickyCartCard`, `OrderTrackingCard` and `AddToCartAnimation` are `position: absolute`. Render each one as the **last child of the screen's root view**, outside the scroll view.

Tab screens end at the top of the tab bar. The web offsets (`bottom-[70px]` and so on) are measured from the viewport bottom, under the nav. To convert them, use `useFloatingBottom(webBottom, hasBottomNav)` from `components/shell/floating.js`:

- **On a tab screen:** returns `webBottom - 78` (the web nav height), never below 0.
- **Elsewhere:** returns `webBottom` plus the bottom safe-area inset.

---

## `components/shell/PageNavbar.js`

**Replaces:** `components/user/PageNavbar.jsx`

```js
import PageNavbar from "../../components/shell/PageNavbar";
```

The transparent header row. It shows the logo on the left, the location in the center (area, then address, then city), and wallet and cart buttons on the right. The cart button has a count badge. Dining renders it with `textColor="dark"` inside its own sticky white header, followed by its own search bar. The search bar is not part of PageNavbar.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `textColor` | `"white"` or any other string | `"white"` | `"white"` gives white text and icons. Any other value gives `colors.primary` (icons use `#a14b84` in dark mode). Dining passes `"dark"`. |
| `showProfile` | bool | `false` | Adds the round "A" button, which opens `/profile`. |
| `showLogo` | bool | `true` | Shows the company logo, which opens `/`. If there is no logo URL, the company name is shown instead. If the image fails to load, nothing is shown, as on web; the live logo URL currently returns 404. |
| `onNavClick` | fn(event) | none | Called on any touch in the bar (`onTouchStart`). |
| `style` | style | none | Outer style. Default padding is `px-3 py-2`. |

**Web props dropped:** `zIndex`, because there is no stacking context to manage.

**Behavior kept from web:**

- About 1.2 s after mount, if there are no stored coordinates and the location is a placeholder:
  - If location permission is already granted, it fetches GPS.
  - Otherwise it goes to `/address-selector` and shows the toast "Please enter location or enable GPS".
- The location button is disabled while `useAppLocation().loading` and shows "Loading...".

## `components/shell/HomeHeader.js`

**Replaces:** `components/user/home/HomeHeader.jsx`

```js
import HomeHeader, {
  HomeHeaderLocationRow,
  HomeHeaderSearchRow,
  HOME_SEARCH_PLACEHOLDERS,
  useRotatingPlaceholder,
} from "../../components/shell/HomeHeader";
```

The header has two rows:

1. **Location row:** a red MapPin, the area name in white, the address in uppercase, and the notifications bell. The bell has a pulsing unread dot. Tapping it opens a popover with the latest 5 items (inbox plus local), "All caught up!" when there are none, and **View All**, which opens `/notifications`.
2. **Search row:** a white search pill with an animated rotating placeholder and a mic, plus the VEG MODE switch.

**Sticky search row:** on web the search row is `position: sticky`. To reproduce that, render the two rows separately and put `HomeHeaderSearchRow` at a `stickyHeaderIndices` index. The default export renders both rows in order.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `location` | location object | none | Pass `useAppLocation().location`. Web passed `effectiveLocation`. |
| `handleLocationClick` | fn | `router.push("/address-selector")` | Location tap. |
| `handleSearchFocus` | fn | `router.push("/search")` | Search pill tap. Home on web navigates to `/search`; it does not open the overlay. |
| `handleVoiceSearchClick` | fn | push `/search` with `voice: "true"` | Mic tap. |
| `placeholderIndex` | number | `0` | Index into `placeholders`. Use `useRotatingPlaceholder()`, which advances every 2 s like Home.jsx. |
| `placeholders` | string[] | `HOME_SEARCH_PLACEHOLDERS` | The 8 strings from Home.jsx, `Search "burger"` and so on. |
| `vegMode` | bool | `false` | Switch state. It also sets the bell dot border: `#00b09b` when on, primary when off. |
| `handleVegModeChange` | fn(next: bool) | none | Switch tap. |
| `isCategoryStuck` | bool | `false` | Search row background becomes white/95, or `#0a0a0a`/95 in dark mode, once the category bar is stuck. |
| `pushSearchDown` | bool | `false` | Search row `marginTop` becomes 252 instead of 8. Web passes `activeTab === "food" && festVideoActive`. |

`HomeHeaderLocationRow` takes `{location, handleLocationClick, vegMode, style}`. `HomeHeaderSearchRow` takes the remaining props, plus `style`. The web props `activeTab` and `setActiveTab` were unused and are dropped.

## `components/shell/HomeHeroBackground.js`

**Replaces:** the header background in Home.jsx L2192-2234. This is not a separate web component.

```js
import HomeHeroBackground from "../../components/shell/HomeHeroBackground";
```

An absolute panel at the top of Home, behind HomeHeader. It has a `#3a142c` to `#1a0a14` gradient and a 28px bottom radius. When `images` is non-empty:

- The images cross-fade over 1 s and change every 5 s.
- `.mp4`, `.webm` and `.ogg` files play as muted, looping videos.
- A 20% black wash sits on top.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `images` | string[] | `[]` | `festBannerImages` from landing settings. Relative URLs are fine. |
| `height` | number | `300` | Used only when there are no images (the web measured the header plus FestBanner). With images the height is always 360. |
| `style` | style | none | |

## `components/shell/SearchOverlay.js`

**Replaces:** `components/user/SearchOverlay.jsx` and `hooks/useVoiceSearch.js`

It is already mounted through `SearchOverlayHost`; screens only call `useSearchOverlay().openSearch()`.

**Contents:**

- Search input, mic and close button.
- "Recent Searches" chips, stored under the `user_recent_searches_v1` key.
- A 3-column "All Dishes" grid, or "Search Results (n)" while typing.

**Behavior:**

- Submitting, or tapping a dish, saves the term and opens the search screen with `q` set.
- Android back closes the overlay.
- The default export takes the web props `{isOpen, onClose, searchValue, onSearchChange}`, if you need it standalone.

## `components/shell/useVoiceSearch.js`

**Replaces:** `hooks/useVoiceSearch.js`

```js
const { isListening, startListening, stopListening } = useVoiceSearch(onResult);
```

- `onResult(transcript)` is called once with the final en-IN result.
- `startListening` asks for microphone permission first.
- The error toasts use the web's wording.
- The search screen (`?voice=true`) can use this hook too.

## `components/shell/AppIntroSplash.js`

**Replaces:** `components/user/AppIntroSplash.jsx`

It is already mounted through `AppIntroSplashHost`, and the default export is `AppIntroSplash({onComplete})`.

**Contents:**

- Image or video slides, each shown for `duration` seconds (default 3).
- **Skip**.
- **Visit {restaurant}**, which opens the restaurant page when the ad is linked.
- Progress dots.

`hasSeenAppIntro()` returns whether the intro has already finished in this process.

## `components/shell/LocationGuard.js`

**Replaces:** `components/user/LocationGuard.jsx` and Home.jsx's out-of-zone screen

```js
import LocationGuard, { OutOfZoneScreen } from "../../components/shell/LocationGuard";
```

- **`LocationGuard`:** a pass-through, already mounted. Do not use it in screens.
- **`OutOfZoneScreen({onChangeLocation})`:** the full-screen "We are coming soon in your city" state with the `out-of-zone-bg.png` background. Its **Change Location** button runs `onChangeLocation`, and defaults to `router.push("/address-selector")`.
  - Home renders it instead of its content when `!loading && isOutOfZone`, both from `useAppLocation()`.
  - It is absolutely positioned to fill its parent.

## `components/shell/StickyCartCard.js`

**Replaces:** `components/user/StickyCartCard.jsx`

A round orange cart button with a black count badge, floating at the bottom right. It opens `/cart` and is hidden when the cart is empty.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `hasBottomNav` | bool | `true` | Position from web `bottom-[70px]`. Pass `true` on Home. |

## `components/shell/OrderTrackingCard.js`

**Replaces:** `components/user/OrderTrackingCard.jsx`

The floating active-order card. It shows a cooking animation, the restaurant name, a status line, an "ARRIVING IN n min" box and a dismiss X. Tapping it opens `/orders/<id>`.

**Behavior:**

- Fetches `getOrders({limit: 10})` on mount, then every 90 s while the app is in the foreground, as on web.
- Is patched live by `orderStatusNotification` socket events.
- Refreshes when a new order is added through `useOrders().upsertOrder` (this replaces the web's `order-placed` event).
- Skips the request when logged out.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `hasBottomNav` | bool | `true` | Web `bottom-20` when true, `bottom-6` when false. Home passes `true`. |

`components/shell/orderSocketPatch.js` exports `patchOrderFromSocketPayload(prev, payload)` and `socketPayloadNeedsRefetch(payload, status)`. These are ports of `utils/orderSocketPatch.js`, for the OrderTracking screen.

## `components/shell/AddToCartAnimation.js`

**Replaces:** `components/user/AddToCartAnimation.jsx`

The floating orange **Cart · N items** pill. It opens `linkTo`. It also plays two animations:

- **Fly-to-cart:** a thumbnail flies from the tapped button to the pill on `addToCart(item, sourcePosition)`.
- **Fly-back:** a thumbnail flies back to the button on `updateQuantity` or `removeFromCart` when a `sourcePosition` and product info are passed.

Render it as the **last child of the screen root**, because it fills the screen with `box-none` touches.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `bottomOffset` | number | `96` | Web px from the viewport bottom. The bottom safe-area inset is added. RestaurantDetails passes `80`. |
| `bottom` | number | none | Explicit native `bottom`, which overrides `bottomOffset`. This replaces Under250's `dynamicBottom` class: use `useFloatingBottom(72 or 92, true)`. |
| `hideOnPages` | bool | `true` | Hides the pill on `/`, `/cart*` and `/profile*`. |
| `linkTo` | string | `"/cart"` | Native path. |

**Source position:** use `measureSourcePosition(ref)` from `components/shell/floating.js`. It resolves to `{viewportX, viewportY}`, the view's center in window coordinates. Pass the result as `sourcePosition`:

```js
const pos = await measureSourcePosition(addButtonRef);
addToCart(line, pos);
```

## `components/shell/AddToCartButton.js`

**Replaces:** `components/user/AddToCartButton.jsx`

It is imported but unused on web, and is ported for completeness.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `item` | cart line | required | Its `id` is the cart line id. |
| `style` | style | none | |

- Shows **Add to Cart** until the item is in the cart, then a −/qty/+ stepper.
- When logged out, shows the toast "Please login to add items to cart" and opens `/login` with `from`.

---

## `components/restaurant-cards/`

Import from the folder index:

```js
import {
  RestaurantGrid,
  RestaurantGridFooter,
  HomeRestaurantCard,
  resolveRestaurantSlug,
  RestaurantImageCarousel,
  RestaurantCarouselStateProvider,
  RestaurantOfferBanner,
  resolveItemOffer,
  FOOD_IMAGES,
  getRestaurantAvailabilityStatus,
} from "../../components/restaurant-cards";
```

### `RestaurantGrid`

**Replaces:** `home/RestaurantGrid.jsx`

A `FlatList` with one card per row, 20px gaps and `px-4`. It ends in `RestaurantGridFooter`: the logo and "THAT'S ALL FOR NOW". Use it as Home's main scroll container by passing everything above it as `ListHeaderComponent`.

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `restaurants` | array | `[]` | Filtered restaurants. If empty, renders `null`, as on web, unless `ListHeaderComponent` is set. |
| `isOutOfService` | bool | `false` | Every card turns grey. |
| `isLoading` | bool | `false` | Cards are dimmed to 50%. |
| `isFavorite` | fn(slug) → bool | none | Same as web. |
| `onToggleFavorite` | fn(restaurant, slug, favorite) | none | **Changed from web:** there is no `event` first argument. |
| any `FlatList` prop | | | For example `ListHeaderComponent`, `onScroll`, `refreshControl`, `contentContainerStyle` or `stickyHeaderIndices`. |

**Web props dropped:**

- `backendOrigin`: `AppImage` and `resolveMediaUrl` resolve relative URLs.
- `showSkeleton`: unused on web.

### `HomeRestaurantCard`

**Replaces:** `home/HomeRestaurantCard.jsx`

**Props:** `restaurant`, `index` (default 0), `isOutOfService`, `isFavorite`, `onToggleFavorite(restaurant, slug, favorite)`, `animateEntrance` (default false).

**Navigation:**

- Tapping the card opens `/restaurants/[slug]`.
- Tapping a preview dish adds `highlightItemId`.
- Banned restaurants cannot be tapped.

Outlet timings are fetched on mount when the list item has none. The fetch is cached per restaurant.

### `RestaurantImageCarousel`

**Replaces:** `home/RestaurantImageCarousel.jsx`

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `restaurant` | object | required | |
| `height` | number | `208` | Replaces the web `className` heights:<br>• Home "near & fast" tiles: `h-24` = 96<br>• Gourmet: `h-32` = 128<br>• CategoryPage: `h-48` = 192<br>• HomeRestaurantCard: `h-44` = 176 |
| `radiusStyle` | style | none | Replaces the web `roundedClass`, for example `{borderTopLeftRadius: 16, borderTopRightRadius: 16}` for `rounded-t-2xl`. |
| `autoPlay` | bool | `false` | Advances every 7 s. |
| `priority` | bool | `false` | Loads the first image at high priority. |
| `onSlideClick` | fn(slide) | none | Without it, taps pass through to the parent `Pressable`. |
| `style` | style | none | |

**Web prop dropped:** `backendOrigin`.

**Offer line:** to show `RestaurantOfferBanner` for the visible dish, as CategoryPage does, wrap the card in `RestaurantCarouselStateProvider` and render `<RestaurantOfferBanner restaurant={r} />` under the carousel.

### Helpers

- **`resolveItemOffer(restaurant, item)`:** returns `{offerText, originalPrice, discountedPrice}` or `null`.
- **`getRestaurantAvailabilityStatus(restaurant, now?, options?)`:** a port of `utils/restaurantAvailability.js`. Returns `isOpen`, `closingCountdownLabel`, `openingTime`, `closingTime` and `reason`.
- **`resolveRestaurantSlug(restaurant, index)`:** the web's slug fallback.
- **`FOOD_IMAGES`:** the web's stock Unsplash fallbacks.
