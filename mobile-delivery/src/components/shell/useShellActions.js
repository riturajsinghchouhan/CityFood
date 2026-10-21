// DeliveryHomeV2's handlers that it passes to OrdersV2 (onAccept, onPass, onOpen, onMarkDelivered),
// shared by the Orders tab and the feed overlays.
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { toast } from "../ui/Toast";
import { useDelivery } from "../../context/DeliveryContext";
import { isSameOrder } from "../../lib/delivery/orders";
import { openVerification } from "./shellStore";

export default function useShellActions() {
  const { acceptOffer, passOffer, openAcceptedOrder, activeOrder } = useDelivery();

  // handleAcceptOffer: accept (ghost-assign lock, removal and /orders/active refresh live in the context).
  // Rejects on failure so an ActionSlider can reset.
  const acceptOrder = useCallback((order) => acceptOffer(order), [acceptOffer]);

  // handlePassOffer
  const passOrder = useCallback((order) => passOffer(order), [passOffer]);

  // handleOpenAcceptedOrder: select the order, derive its phase and show the feed.
  const openOrder = useCallback(
    (order) => {
      openAcceptedOrder(order);
      router.navigate("/");
    },
    [openAcceptedOrder],
  );

  // handleTriggerMarkDelivered: open the verification flow with the OTP step skipped.
  const markDelivered = useCallback(
    (order) => {
      const target = order || activeOrder;
      if (!target) {
        toast.error("No order selected to deliver");
        return;
      }
      if (!isSameOrder(target, activeOrder)) openAcceptedOrder(target);
      openVerification({ bypassOtp: true });
    },
    [activeOrder, openAcceptedOrder],
  );

  return useMemo(
    () => ({ acceptOrder, passOrder, openOrder, markDelivered }),
    [acceptOrder, markDelivered, openOrder, passOrder],
  );
}
