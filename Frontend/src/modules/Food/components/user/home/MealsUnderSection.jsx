import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { getPublicFoods } from "@food/api";
import OptimizedImage from "@food/components/OptimizedImage";
import { useCart } from "@food/context/CartContext";
import { isModuleAuthenticated } from "@food/utils/auth";

export default function MealsUnderSection({ config, zoneId }) {
  const [foods, setFoods] = useState([]);
  const enabled = config?.enabled !== false;
  const priceLimit = Number(config?.priceLimit) || 200;
  const maxItems = Number(config?.maxItems) || 20;

  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, updateQuantity, getCartItem, cart } = useCart();

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getPublicFoods({ maxPrice: priceLimit, limit: maxItems, ...(zoneId ? { zoneId } : {}) })
      .then((data) => {
        if (!cancelled) setFoods(Array.isArray(data?.foods) ? data.foods : []);
      })
      .catch(() => {
        if (!cancelled) setFoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, priceLimit, maxItems, zoneId]);

  const handleAddToCart = (e, food) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart");
      navigate('/user/auth/login', { state: { from: location.pathname } });
      return;
    }

    const itemToAdd = {
      id: food.id,
      itemId: food.id,
      name: food.name,
      price: food.price,
      image: food.image,
      restaurantId: food.restaurantId,
      restaurant: food.restaurantName,
      restaurantName: food.restaurantName,
      foodType: food.foodType,
      isVeg: food.foodType === 'Veg' || food.isVeg,
    };

    const res = addToCart(itemToAdd);
    if (res?.ok === false) {
      toast.error(res.error || "Cannot add item from different restaurant. Please clear cart first.");
      return;
    }
    toast.success(`Added ${food.name} to cart`);
  };

  const handleIncrease = (e, food) => {
    e.preventDefault();
    e.stopPropagation();
    const cartItem = getCartItem(food.id);
    updateQuantity(food.id, (cartItem?.quantity || 0) + 1);
  };

  const handleDecrease = (e, food) => {
    e.preventDefault();
    e.stopPropagation();
    const cartItem = getCartItem(food.id);
    updateQuantity(food.id, (cartItem?.quantity || 0) - 1);
  };

  if (!enabled || foods.length === 0) return null;

  return (
    <section className="content-auto pt-2 sm:pt-3 lg:pt-4">
      <div className="px-4 mb-4 flex items-center gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
          {config?.title || "Meals under"} ₹{priceLimit}
        </h2>
        <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1" />
      </div>
      <div className="px-4 pb-4 lg:pb-6 flex overflow-x-auto no-scrollbar gap-4">
        {foods.map((food) => {
          const cartItem = getCartItem(food.id);
          const inCart = !!cartItem && cartItem.quantity > 0;
          const isVeg = food.foodType === 'Veg' || food.isVeg;

          return (
            <Link
              key={food.id}
              to={`/user/restaurants/${food.restaurantId}`}
              className="shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-all group flex flex-col"
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {food.image ? (
                  <OptimizedImage
                    src={food.image}
                    alt={food.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No image
                  </div>
                )}

                {/* Popular Badge */}
                {(food.isRecommended || food.isPopular) && (
                  <span className="absolute top-2 left-2 z-10 bg-white/95 dark:bg-[#1a1a1a]/95 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm tracking-wide">
                    Popular
                  </span>
                )}

                {/* Add to Cart Circular Button or Counter */}
                <div
                  className="absolute right-2 bottom-2 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {inCart ? (
                    <div className="flex items-center bg-white dark:bg-[#1a1a1a] border-2 border-primary text-primary rounded-full shadow-lg px-1.5 py-0.5 h-8 sm:h-9 gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDecrease(e, food)}
                        className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full active:scale-90 transition-transform"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                      <span className="text-xs sm:text-sm font-bold min-w-[14px] text-center text-primary">
                        {cartItem?.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleIncrease(e, food)}
                        className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full active:scale-90 transition-transform"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(e, food)}
                      className="w-8 h-8 sm:w-9 sm:h-9 bg-white dark:bg-[#1a1a1a] border-2 border-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all text-primary group/btn cursor-pointer"
                      aria-label={`Add ${food.name} to cart`}
                      title="Add to cart"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-primary group-hover/btn:rotate-90 transition-transform duration-200" strokeWidth={2.8} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    {isVeg ? (
                      <div className="shrink-0 h-3 w-3 rounded-[3px] border border-green-600 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                      </div>
                    ) : (
                      <div className="shrink-0 h-3 w-3 rounded-[3px] border border-red-600 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{food.name}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{food.restaurantName}</p>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1.5">₹{food.price}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
