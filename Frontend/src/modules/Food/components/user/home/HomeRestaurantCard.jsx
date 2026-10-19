import { Link, useLocation, useNavigate } from "react-router-dom";
import { memo, useMemo } from "react";
import {
  Bookmark,
  Minus,
  Plus,
  Star,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import RestaurantImageCarousel, {
  RestaurantCarouselStateProvider,
  resolveItemOffer,
} from "@food/components/user/home/RestaurantImageCarousel";
import { foodImages } from "@food/constants/images";
import { useDeferredOutletTimings } from "@food/hooks/user/useDeferredOutletTimings";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { useCart } from "@food/context/CartContext";
import { isModuleAuthenticated } from "@food/utils/auth";
import { buildCartLineId } from "@food/utils/foodVariants";

function resolveRestaurantSlug(restaurant, index) {
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallbackSlugSource =
    nameStr ||
    (typeof restaurant?.restaurantName === "string"
      ? restaurant.restaurantName.trim()
      : "") ||
    String(
      restaurant?.slug ||
        restaurant?.id ||
        restaurant?._id ||
        `restaurant-${index}`,
    );

  return typeof restaurant?.slug === "string" && restaurant.slug.trim()
    ? restaurant.slug.trim()
    : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");
}

function resolveImageUrl(url, backendOrigin) {
  if (typeof url !== "string" || !url.trim()) return "";
  const trimmed = url.trim();
  if (/^(https?:|\/\/|data:|blob:)/i.test(trimmed) || !backendOrigin) return trimmed;
  return `${backendOrigin.replace(/\/$/, "")}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

// Restaurant-level headline shown above the name, e.g. "20% OFF" or an offer title.
function resolveHeadlineOffer(restaurant) {
  if (typeof restaurant?.offer === "string" && restaurant.offer.trim()) {
    return restaurant.offer.trim();
  }
  const offers = Array.isArray(restaurant?.offers) ? restaurant.offers : [];
  const best = offers.reduce(
    (acc, offer) =>
      !acc || Number(offer.discountValue) > Number(acc.discountValue) ? offer : acc,
    null,
  );
  if (best) {
    const value = Number(best.discountValue) || 0;
    const isFlat = String(best.discountType || "").toUpperCase() === "FLAT";
    if (best.title) return best.title;
    if (value > 0) return isFlat ? `Flat ₹${value} off` : `${value}% off`;
  }
  if (Number(restaurant?.discount) > 0) return `${restaurant.discount}% off`;
  return null;
}

function buildPreviewItems(restaurant, backendOrigin) {
  const source =
    Array.isArray(restaurant?.previewItems) && restaurant.previewItems.length > 0
      ? restaurant.previewItems
      : Array.isArray(restaurant?.recommendedItems)
        ? restaurant.recommendedItems
        : [];

  return source
    .filter((item) => item?.name)
    .map((item, idx) => {
      const price = Number(item.price) || 0;
      const offer = resolveItemOffer(restaurant, { ...item, id: item.id || item._id, price });
      const finalPrice = offer ? offer.discountedPrice : price;
      const otherPrice = Number(item.priceOnOtherPlatforms) || 0;
      const lowerPercent =
        otherPrice > finalPrice && finalPrice > 0
          ? Math.round(((otherPrice - finalPrice) / otherPrice) * 100)
          : 0;

      return {
        id: item.id || item._id,
        name: item.name,
        image:
          resolveImageUrl(item.image || item.imageUrl, backendOrigin) ||
          foodImages[idx % foodImages.length],
        foodType: item.foodType,
        isRecommended: item.isRecommended === true,
        hasVariants: item.hasVariants === true,
        priceOnOtherPlatforms: otherPrice || null,
        price,
        finalPrice,
        hasDiscount: Boolean(offer),
        lowerPercent,
      };
    });
}

const stop = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

function PreviewItemCard({ item, quantity = 0, onSelect, onAdd, onChangeQuantity }) {
  const isVeg = item.foodType === "Veg";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => onSelect(item, event)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(item, event);
      }}
      className="flex-shrink-0 w-[150px] sm:w-[170px] text-left focus:outline-none"
    >
      <div className="relative h-[120px] sm:h-[135px] w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-800">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = foodImages[0];
          }}
        />
        {item.isRecommended && (
          <span className="absolute left-2 top-2 rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-green-700 shadow-sm">
            Popular
          </span>
        )}
        {quantity > 0 ? (
          <div
            onClick={stop}
            className="absolute bottom-2 right-2 flex h-9 items-center gap-1 rounded-full border-2 border-primary bg-white px-1 text-primary shadow-md"
          >
            <button
              type="button"
              onClick={(event) => onChangeQuantity(item, quantity - 1, event)}
              aria-label={`Remove one ${item.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary/10 active:scale-90"
            >
              <Minus className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <span className="min-w-[14px] text-center text-sm font-bold">{quantity}</span>
            <button
              type="button"
              onClick={(event) => onChangeQuantity(item, quantity + 1, event)}
              aria-label={`Add one more ${item.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary/10 active:scale-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(event) => onAdd(item, event)}
            aria-label={`Add ${item.name} to cart`}
            title={item.hasVariants ? "Choose an option" : "Add to cart"}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary/60 bg-white text-primary shadow-md hover:scale-110 active:scale-90 transition-transform"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-start gap-1.5">
        {item.foodType && (
          <span
            className={`mt-[3px] flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border ${
              isVeg ? "border-green-600" : "border-red-600"
            }`}
            title={isVeg ? "Vegetarian" : "Non-vegetarian"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
          </span>
        )}
        <span className="text-[14px] font-medium leading-snug text-gray-900 dark:text-gray-100 line-clamp-2">
          {item.name}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {item.hasDiscount ? (
          <>
            <span className="text-[13px] text-gray-400 line-through">₹{Math.round(item.price)}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[14px] font-bold text-primary">
              ₹{Math.round(item.finalPrice)}
            </span>
          </>
        ) : (
          <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300">
            ₹{Math.round(item.price)}
          </span>
        )}
      </div>

      {item.lowerPercent > 0 && (
        <p className="mt-1 text-[12px] font-semibold text-primary">
          Our app: {item.lowerPercent}% lower
        </p>
      )}
    </div>
  );
}

function HomeRestaurantCard({
  restaurant,
  index = 0,
  backendOrigin = "",
  isOutOfService = false,
  isFavorite,
  onToggleFavorite,
  animateEntrance = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, updateQuantity, getCartItem } = useCart();
  const isBanned = Boolean(
    restaurant?.isBanned === true ||
    restaurant?.status === 'banned' ||
    (restaurant?.status === 'rejected' && /disabled by admin|banned/i.test(restaurant?.rejectionReason || ''))
  );

  const { ref, outletTimings } = useDeferredOutletTimings(
    restaurant?.mongoId,
    restaurant?.outletTimings ?? null,
  );

  const restaurantForAvailability = useMemo(
    () => ({ ...restaurant, outletTimings: outletTimings ?? restaurant?.outletTimings }),
    [restaurant, outletTimings],
  );

  const rawAvailability = getRestaurantAvailabilityStatus(
    restaurantForAvailability,
    new Date()
  );

  // If banned, it visually presents exactly like an approved restaurant when offline
  const availability = isBanned
    ? { ...rawAvailability, isOpen: false, closingCountdownLabel: null }
    : rawAvailability;

  const restaurantSlug = resolveRestaurantSlug(restaurant, index);
  const favorite = !isBanned && typeof isFavorite === 'function' ? isFavorite(restaurantSlug) : false;
  const priority = index < 3;

  const previewItems = useMemo(
    () => buildPreviewItems(restaurant, backendOrigin),
    [restaurant, backendOrigin],
  );
  const headlineOffer = useMemo(() => resolveHeadlineOffer(restaurant), [restaurant]);
  const pricedItems = previewItems.map((item) => item.finalPrice).filter((p) => p > 0);
  const minItemPrice = pricedItems.length > 0 ? Math.round(Math.min(...pricedItems)) : null;
  const cuisineText = (Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
    ? restaurant.cuisines.slice(0, 2).join(", ")
    : restaurant?.cuisine) || "";
  const metaParts = [restaurant?.deliveryTime, restaurant?.distance, cuisineText].filter(Boolean);

  const openItem = (itemId, event) => {
    if (isBanned) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    navigate(`/user/restaurants/${restaurantSlug}${itemId ? `?highlightItemId=${itemId}` : ""}`);
  };

  // Same cart line id as the restaurant page (item id + "base"), so quantities stay in sync there.
  const lineIdOf = (item) => buildCartLineId(item.id, "");
  const quantityOf = (item) => getCartItem(lineIdOf(item))?.quantity || 0;

  const canOrder = () => {
    if (!isModuleAuthenticated("user")) {
      toast.error("Please login to add items to cart");
      navigate("/user/auth/login", { state: { from: location.pathname } });
      return false;
    }
    if (isBanned || isOutOfService || !availability.isOpen) {
      toast.error(isOutOfService ? "This restaurant does not deliver to your location." : "Restaurant is currently offline. Please try again later.");
      return false;
    }
    return true;
  };

  const handleAddItem = (item, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Items with sizes/options are chosen on the restaurant page.
    if (item.hasVariants) {
      openItem(item.id);
      return;
    }
    if (!canOrder()) return;
    const lineItemId = lineIdOf(item);
    const result = addToCart({
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: item.finalPrice,
      originalPrice: item.price,
      variantId: "",
      variantName: "",
      variantPrice: item.finalPrice,
      image: item.image,
      restaurant: restaurant.name,
      restaurantId: restaurant.mongoId || restaurant.restaurantId || restaurant._id || restaurant.id,
      isVeg: item.foodType === "Veg",
      foodType: item.foodType,
      priceOnOtherPlatforms: item.priceOnOtherPlatforms,
    });
    if (result?.ok === false) {
      toast.error(result.error || "Could not add this item.");
      return;
    }
    toast.success(`Added ${item.name} to cart`);
  };

  const handleChangeQuantity = (item, quantity, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (quantity > quantityOf(item) && !canOrder()) return;
    updateQuantity(lineIdOf(item), quantity);
  };

  const handleSlideClick = (slide, event) => {
    if (slide?.id && slide?.isRecommended) openItem(slide.id, event);
  };

  const CardWrapper = isBanned ? "div" : Link;
  const cardWrapperProps = isBanned
    ? { className: "h-full flex cursor-not-allowed select-none" }
    : { to: `/user/restaurants/${restaurantSlug}`, className: "h-full flex" };

  return (
    <div
      ref={ref}
      className={`h-full ${isBanned ? "cursor-not-allowed select-none" : ""}`}
      style={{
        animation: animateEntrance
          ? `fade-in-up 0.5s ease-out ${Math.min(index, 9) * 0.05}s backwards`
          : "none",
      }}
    >
      <CardWrapper {...cardWrapperProps}>
        <RestaurantCarouselStateProvider>
          <Card
            className={`overflow-hidden gap-0 border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] py-0 rounded-[24px] flex flex-col h-full w-full relative shadow-sm transition-shadow duration-300 ${
              isBanned || isOutOfService || !availability.isOpen
                ? "grayscale opacity-75"
                : ""
            } ${isBanned ? "cursor-not-allowed" : "cursor-pointer hover:shadow-lg"}`}
          >
            {/* Restaurant info */}
            <div className="flex items-start justify-between gap-3 px-4 pt-4">
              <div className="min-w-0 flex-1">
                {headlineOffer && (
                  <p className="mb-0.5 text-[13px] font-extrabold uppercase tracking-wide text-primary line-clamp-1">
                    {headlineOffer}
                  </p>
                )}
                <h3 className="text-[20px] font-bold leading-tight tracking-tight text-gray-950 dark:text-white line-clamp-1">
                  {restaurant.name}
                </h3>

                <div className="mt-1.5 flex items-center gap-1.5 text-[14px] text-gray-600 dark:text-gray-300 min-w-0">
                  <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-green-700">
                    <Star className="h-2.5 w-2.5 fill-white text-white" strokeWidth={0} />
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0">
                    {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "New"}
                  </span>
                  {metaParts.length > 0 && (
                    <span className="truncate">• {metaParts.join(" • ")}</span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      availability.isOpen ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {availability.isOpen ? "Open now" : "Offline"}
                  </span>
                  {availability.isOpen &&
                    availability.closingCountdownLabel &&
                    availability.openingTime &&
                    availability.closingTime && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                        <Timer className="h-3 w-3 flex-shrink-0" strokeWidth={3} />
                        {availability.closingCountdownLabel}
                      </span>
                    )}
                  {minItemPrice > 0 && (
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      • Items at ₹{minItemPrice}
                    </span>
                  )}
                </div>
              </div>

              {!isBanned && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(event) => onToggleFavorite(event, restaurant, restaurantSlug, favorite)}
                  aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                  className={`h-10 w-10 flex-shrink-0 rounded-full border transition-all duration-300 ${
                    favorite
                      ? "bg-red-500 border-red-500 text-white"
                      : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-100"
                  }`}
                >
                  <Bookmark className={`h-[18px] w-[18px] ${favorite ? "fill-white" : ""}`} />
                </Button>
              )}
            </div>

            {/* Dishes row, or the image carousel when the restaurant has no dishes yet */}
            {previewItems.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pt-3 pb-4">
                {previewItems.map((item) => (
                  <PreviewItemCard
                    key={item.id || item.name}
                    item={item}
                    quantity={quantityOf(item)}
                    onSelect={(selected, event) => openItem(selected.id, event)}
                    onAdd={handleAddItem}
                    onChangeQuantity={handleChangeQuantity}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 pt-3 pb-4">
                <RestaurantImageCarousel
                  restaurant={restaurant}
                  priority={priority}
                  autoPlay={!isBanned && availability.isOpen}
                  backendOrigin={backendOrigin}
                  onSlideClick={handleSlideClick}
                  className="h-44 sm:h-52"
                  roundedClass="rounded-2xl"
                />
              </div>
            )}
          </Card>
        </RestaurantCarouselStateProvider>
      </CardWrapper>
    </div>
  );
}

export default memo(HomeRestaurantCard);
