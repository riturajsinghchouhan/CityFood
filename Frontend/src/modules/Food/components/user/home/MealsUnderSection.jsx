import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicFoods } from "@food/api";
import OptimizedImage from "@food/components/OptimizedImage";

export default function MealsUnderSection({ config, zoneId }) {
  const [foods, setFoods] = useState([]);
  const enabled = config?.enabled !== false;
  const priceLimit = Number(config?.priceLimit) || 200;
  const maxItems = Number(config?.maxItems) || 20;

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
        {foods.map((food) => (
          <Link
            key={food.id}
            to={`/user/restaurants/${food.restaurantId}`}
            className="shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-gray-100 dark:bg-gray-800">
              {food.image ? (
                <OptimizedImage src={food.image} alt={food.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="p-2.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{food.name}</p>
              <p className="text-xs text-gray-500 truncate">{food.restaurantName}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">₹{food.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
