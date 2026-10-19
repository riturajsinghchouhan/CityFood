// Logout from inside the protected area. When the session ends on its own (expiry, 401) the (app)
// layout redirects to /login with `from` (ProtectedRoute); after a deliberate logout it goes to
// /login (or /welcome) without `from`, as the web's navigate(..., {replace: true}) does.
import { useCallback, useState } from "react";
import { useAuth } from "../../context/AuthContext";

let logoutTarget = null;

export function markShellLogout(to = "/login") {
  logoutTarget = to;
}

/** Where the (app) layout sends a deliberate logout, or null when the session simply ended. */
export function shellLogoutTarget() {
  return logoutTarget;
}

// Called by the (app) layout once a session is active again.
export function clearShellLogout() {
  logoutTarget = null;
}

/**
 * ExploreMore.jsx handleLogout: device/remove, fcm remove, POST /food/auth/logout, clear the
 * restaurant_* storage (all inside useAuth().logout()). The (app) layout then replaces the
 * screen with /login. logout({to: "/welcome"}) is the web's account-deletion / error exit.
 * Returns {logout, isLoggingOut}.
 */
export function useShellLogout() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const run = useCallback(
    async ({ to = "/login" } = {}) => {
      if (isLoggingOut) return;
      setIsLoggingOut(true);
      markShellLogout(to);
      try {
        await logout();
      } catch {
        // useAuth().logout never blocks on API errors; local state is cleared regardless
      }
    },
    [isLoggingOut, logout],
  );
  return { logout: run, isLoggingOut };
}
