// RestaurantBlockGuard (components/restaurant/RestaurantBlockGuard.jsx): GET /food/restaurant/current
// on login and every 30 s, here only while logged in AND the app is in the foreground (plus an
// immediate check when it returns to the foreground). Outcomes, as on web:
//   status "rejected" (or isActive === false) -> blocked ("Account Blocked", reason falls back to
//   "Disabled by admin" because /current never returns rejectionReason); polling stops.
//   401 -> session cleared (the api client refreshes first, then logs out via onSessionExpired).
//   network error -> treated as active.
// "pending" is NOT blocked by the web guard; it is exposed so screens can show a banner.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";

export const BLOCK_POLL_MS = 30000;
const GuardContext = createContext(null);

export function RestaurantGuardProvider({ children }) {
  const { isAuthenticated, refreshRestaurant, restaurant, logout, onLogout } = useAuth();
  // "idle" (logged out) | "loading" | "active" | "blocked"
  const [status, setStatus] = useState("idle");
  const [reason, setReason] = useState("");
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const check = useCallback(async () => {
    try {
      const r = await refreshRestaurant({ noCache: true });
      if (r?.status === "rejected" || r?.isActive === false) {
        setReason(r?.rejectionReason || "Disabled by admin");
        setStatus("blocked");
      } else {
        setStatus("active");
      }
    } catch (error) {
      if (error?.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (statusRef.current !== "blocked") setStatus("active");
    }
  }, [refreshRestaurant, logout]);

  useEffect(
    () =>
      onLogout(() => {
        statusRef.current = "idle";
        setStatus("idle");
        setReason("");
      }),
    [onLogout],
  );

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let timer = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      if (statusRef.current === "blocked") return;
      check();
      timer = setInterval(() => {
        if (statusRef.current === "blocked") {
          stop();
          return;
        }
        check();
      }, BLOCK_POLL_MS);
    };
    if (AppState.currentState === "active" || AppState.currentState == null) start();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [isAuthenticated, check]);

  // Logged in but the first check has not finished yet -> "loading" (web spinner).
  const effectiveStatus = isAuthenticated && status === "idle" ? "loading" : status;
  const restaurantStatus = String(restaurant?.status || "").toLowerCase() || null;

  const value = useMemo(
    () => ({
      status: effectiveStatus,
      checking: effectiveStatus === "loading",
      blocked: effectiveStatus === "blocked",
      blockReason: reason || "Disabled by admin",
      restaurantStatus,
      pending: restaurantStatus === "pending",
      rejected: restaurantStatus === "rejected",
      approved: restaurantStatus === "approved",
      pendingUpdateReason: restaurant?.pendingUpdateReason || null,
      recheck: check,
    }),
    [effectiveStatus, reason, restaurantStatus, restaurant?.pendingUpdateReason, check],
  );

  return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}

export function useRestaurantGuard() {
  const ctx = useContext(GuardContext);
  if (!ctx) throw new Error("useRestaurantGuard must be used inside RestaurantGuardProvider");
  return ctx;
}
