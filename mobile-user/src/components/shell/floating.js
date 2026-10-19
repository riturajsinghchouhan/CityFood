// Shared placement helpers for the floating shell pieces (cart pill, active-order card).
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height of the web bottom nav at phone width with no safe-area inset:
// row 67px (py-1.5 + 55px tab) + 1px border + 10px min bottom padding.
export const WEB_BOTTOM_NAV_HEIGHT = 78;

/**
 * Converts a web `fixed bottom-[N px]` offset into a `bottom` for an absolutely positioned
 * view inside a screen. Tab screens end at the top of the native tab bar, so the bar
 * height is subtracted there (never below 0, so the view stays above the bar). Other
 * screens extend under the system navigation bar, so its inset is added.
 */
export function useFloatingBottom(webBottom, hasBottomNav) {
  const insets = useSafeAreaInsets();
  if (hasBottomNav) return Math.max(0, webBottom - WEB_BOTTOM_NAV_HEIGHT);
  return webBottom + insets.bottom;
}

/**
 * Measures a tapped view for the fly-to-cart animation. Resolves to the cart's
 * `sourcePosition` shape: the view's center in window coordinates.
 * Usage: addToCart(item, await measureSourcePosition(buttonRef)).
 */
export function measureSourcePosition(ref, extra = {}) {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (![x, y, width, height].every(Number.isFinite)) {
        resolve(null);
        return;
      }
      resolve({ viewportX: x + width / 2, viewportY: y + height / 2, ...extra });
    });
  });
}
