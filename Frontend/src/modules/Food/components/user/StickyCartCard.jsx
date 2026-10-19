import { Link, useNavigate } from "react-router-dom"
import { ChevronRight, Trash2 } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { motion, AnimatePresence } from "framer-motion"
import { foodImages } from "@food/constants/images"

const MAX_THUMBS = 2

/** Home page cart bar: item photos, restaurant, "N items | ₹total / Checkout" and clear cart. */
export default function StickyCartCard() {
  const { cart, getCartCount, clearCart } = useCart()
  const navigate = useNavigate()
  const items = Array.isArray(cart) ? cart : []
  const cartCount = getCartCount()

  // One photo per dish (variants of the same dish share a photo), newest first.
  const dishes = []
  const seen = new Set()
  for (const item of [...items].reverse()) {
    const key = String(item?.itemId || item?.id || item?.name || "")
    if (!key || seen.has(key)) continue
    seen.add(key)
    dishes.push(item)
  }
  const thumbs = dishes.slice(0, MAX_THUMBS)
  const extra = dishes.length - thumbs.length

  const restaurantName = items[0]?.restaurant || "Restaurant"
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-")
  const totalPrice = items.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0)

  const handleClear = () => {
    if (window.confirm(`Remove all items from ${restaurantName} from your cart?`)) clearCart()
  }

  return (
    <AnimatePresence>
      {cartCount > 0 && (
        <motion.div
          key="sticky-cart"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-17.5 md:bottom-6 inset-x-0 z-50 px-3 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-xl flex items-center gap-2.5 sm:gap-3 rounded-[22px] bg-white dark:bg-[#1a1a1a] p-2.5 sm:p-3 shadow-[0_8px_30px_rgba(0,0,0,0.14)] border border-gray-100 dark:border-gray-800">
            {/* Dish photos: overlapping circles, then +N for the rest */}
            <div className="flex items-center shrink-0">
              {thumbs.map((item, i) => (
                <img
                  key={String(item.itemId || item.id || i)}
                  src={item.image || foodImages[i % foodImages.length]}
                  alt={item.name || ""}
                  onError={(e) => { e.currentTarget.src = foodImages[0] }}
                  className={`relative h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover bg-gray-100 border-2 border-white dark:border-[#1a1a1a] shadow-sm ${i > 0 ? "-ml-4" : ""}`}
                  style={{ zIndex: MAX_THUMBS - i + 1 }}
                />
              ))}
              {extra > 0 && (
                <span className="-ml-4 relative z-0 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border-2 border-white dark:border-[#1a1a1a] bg-orange-50 text-[13px] font-bold text-orange-600 shadow-sm">
                  +{extra}
                </span>
              )}
            </div>

            {/* Restaurant and link back to its menu */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] sm:text-[17px] font-bold text-gray-900 dark:text-white leading-tight">{restaurantName}</p>
              <Link
                to={`/user/restaurants/${restaurantSlug}`}
                className="mt-1 inline-flex items-center gap-0.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 px-2.5 py-0.5 text-[13px] font-semibold text-orange-600"
              >
                Menu <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>

            {/* Checkout */}
            <button
              type="button"
              onClick={() => navigate("/user/cart")}
              className="shrink-0 rounded-2xl bg-[#1f6b2e] hover:bg-[#195a26] active:scale-[0.98] transition px-3.5 sm:px-5 py-1.5 sm:py-2 text-white text-center"
            >
              <span className="block text-[11px] sm:text-[13px] font-medium leading-tight opacity-95">
                {cartCount} {cartCount === 1 ? "item" : "items"} | ₹{Math.round(totalPrice)}
              </span>
              <span className="block text-[16px] sm:text-[19px] font-bold leading-tight">Checkout</span>
            </button>

            {/* Clear cart */}
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear cart"
              className="shrink-0 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 active:scale-95 transition"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
