// Restaurant auth, same contract as the web (pages/restaurant/auth/{Login,OTP}.jsx, Onboarding.jsx,
// ExploreMore.jsx logout, utils/auth.js). Phone OTP only; verify-otp has THREE outcomes:
//   1. tokens          -> logged in (approved, or a legacy restaurant created before 2026-05-26)
//   2. needsRegistration -> unknown phone: pendingPhone saved, go to onboarding, then register()
//   3. pendingApproval -> {status, isRejected, rejectionReason}: pendingPhone saved, no tokens
// Tokens live in SecureStore under restaurant_accessToken / restaurant_refreshToken.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  logout as apiLogout,
  register as apiRegister,
  sendOTP,
  verifyOTP,
} from "../api/auth";
import { clearTokens, getRefreshToken, loadTokens, onSessionExpired, setTokens } from "../api/client";
import { getCurrentRestaurant, invalidateCurrentRestaurant } from "../api/profile";
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "../lib/onboarding";
import { getPushTokenForLogin, unregisterPushDevice } from "../lib/push";
import { KEYS, RESTAURANT_SESSION_CACHE_KEYS, store } from "../storage";

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(globalThis.atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

function isUnexpired(token) {
  const payload = token && decodeJwtPayload(token);
  return Boolean(payload?.exp && payload.exp * 1000 > Date.now());
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingPhone, setPendingPhoneState] = useState(null);
  // Last pendingApproval outcome (web passes it as router state to pending-verification).
  const [pendingApproval, setPendingApproval] = useState(null);
  const logoutListeners = useRef(new Set());

  const setPendingPhone = useCallback(async (phone) => {
    setPendingPhoneState(phone || null);
    await store.set(KEYS.pendingPhone, phone || null);
  }, []);

  const clearPendingPhone = useCallback(() => setPendingPhone(null), [setPendingPhone]);

  // clearModuleAuth("restaurant") + clearRestaurantSessionCache().
  const resetLocal = useCallback(async () => {
    await clearTokens();
    await store.remove(KEYS.user);
    await store.removeMany(RESTAURANT_SESSION_CACHE_KEYS);
    invalidateCurrentRestaurant();
    setRestaurant(null);
    setIsAuthenticated(false);
    logoutListeners.current.forEach((fn) => {
      try {
        fn();
      } catch {
        // a listener must not block logout
      }
    });
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      resetLocal();
    });
    (async () => {
      const { accessToken, refreshToken } = await loadTokens();
      // isModuleAuthenticated('restaurant'): unexpired RESTAURANT access token, or unexpired refresh token.
      const role = String(decodeJwtPayload(accessToken || "")?.role || "").toUpperCase();
      const authed =
        (isUnexpired(accessToken) && (!role || role === "RESTAURANT")) || isUnexpired(refreshToken);
      if (authed) {
        setRestaurant(await store.get(KEYS.user));
        setIsAuthenticated(true);
      } else if (accessToken || refreshToken) {
        await clearTokens();
      }
      setPendingPhoneState(await store.get(KEYS.pendingPhone));
      setReady(true);
    })();
  }, [resetLocal]);

  /**
   * GET /food/restaurant/current -> the restaurant (also stored as restaurant_user).
   * options.noCache bypasses the 3 s dedupe cache. Throws ApiError on failure.
   */
  const refreshRestaurant = useCallback(async (options = {}) => {
    const res = await getCurrentRestaurant(options);
    const next = res?.data?.restaurant || null;
    if (next) {
      setRestaurant(next);
      store.set(KEYS.user, next);
    }
    return next;
  }, []);

  // Local merge after a mutation that returned the restaurant (updateProfile, availability...).
  const updateRestaurant = useCallback((next) => {
    setRestaurant((prev) => {
      const merged = typeof next === "function" ? next(prev) : { ...(prev || {}), ...next };
      store.set(KEYS.user, merged);
      return merged;
    });
  }, []);

  // POST request-otp. Login and Signup both use it (resend too).
  const requestOtp = useCallback((phone) => sendOTP(phone), []);

  /**
   * verifyOtp({phone, otp, isSignUp?, fcmToken?}). The FCM token is fetched without a prompt when
   * not given and sent with platform "mobile". Resolves to one of:
   *  {outcome:"needsRegistration", phone}                                  -> onboarding
   *  {outcome:"pendingApproval", phone, status, isRejected, rejectionReason} -> pending-verification
   *  {outcome:"authenticated", restaurant, onboardingStep}                  -> onboardingStep ? onboarding?step=N : "/"
   * (isSignUp -> onboardingStep 1 as the web's Signup path does.) Other errors throw ApiError;
   * an error whose message matches /pending approval/i resolves as pendingApproval, like OTP.jsx.
   */
  const verifyOtp = useCallback(
    async ({ phone, otp, isSignUp = false, fcmToken } = {}) => {
      const token = fcmToken === undefined ? await getPushTokenForLogin() : fcmToken;
      let res;
      try {
        res = await verifyOTP(phone, otp, token || null, "mobile");
      } catch (err) {
        if (/pending approval/i.test(err?.message || "")) {
          await setPendingPhone(phone);
          const info = { phone, status: "pending", isRejected: false, rejectionReason: null };
          setPendingApproval(info);
          return { outcome: "pendingApproval", ...info };
        }
        throw err;
      }
      const data = res?.data || {};

      if (data.needsRegistration) {
        await setPendingPhone(data.phone || phone);
        setPendingApproval(null);
        return { outcome: "needsRegistration", phone: data.phone || phone };
      }

      if (data.pendingApproval) {
        const info = {
          phone: data.phone || phone,
          status: data.status || "pending",
          isRejected: Boolean(data.isRejected),
          rejectionReason: data.rejectionReason || null,
        };
        await setPendingPhone(info.phone);
        setPendingApproval(info);
        return { outcome: "pendingApproval", ...info };
      }

      const accessToken = data.accessToken || data.token;
      const user = data.user ?? data.restaurant;
      if (!accessToken || !user) throw new Error(res?.message || "Login failed");

      await setTokens({ accessToken, refreshToken: data.refreshToken || null });
      await store.set(KEYS.user, user);
      invalidateCurrentRestaurant();
      setRestaurant(user);
      setPendingApproval(null);
      setIsAuthenticated(true);

      let onboardingStep = null;
      if (isSignUp) {
        onboardingStep = 1;
      } else if (!isRestaurantOnboardingComplete(user)) {
        onboardingStep = await checkOnboardingStatus();
      }
      // Pull the full /current profile in the background (verify returns a slim user).
      refreshRestaurant({ noCache: true }).catch(() => {});
      return { outcome: "authenticated", restaurant: user, onboardingStep };
    },
    [refreshRestaurant, setPendingPhone],
  );

  /**
   * register(fields): multipart POST /food/restaurant/register (no auth). fields: see api/auth.register.
   * On success pendingPhone = ownerPhone; route to pending-verification. Resolves to the body
   * (data = the new restaurant document, status "pending").
   */
  const register = useCallback(
    async (fields) => {
      const res = await apiRegister(fields);
      const phone =
        (fields && typeof fields.get === "function" ? fields.get("ownerPhone") : fields?.ownerPhone) ||
        res?.data?.ownerPhone ||
        pendingPhone;
      if (phone) await setPendingPhone(String(phone));
      setPendingApproval({
        phone: phone ? String(phone) : null,
        status: "pending",
        isRejected: false,
        rejectionReason: null,
      });
      return res;
    },
    [pendingPhone, setPendingPhone],
  );

  /**
   * Web logout (ExploreMore.jsx / Onboarding.jsx): DELETE /fcm-tokens/device/remove, DELETE
   * /fcm-tokens/remove, POST /food/auth/logout {refreshToken, fcmToken, platform:"mobile"}, then
   * clear restaurant_* auth + session cache. API failures never block the local logout.
   */
  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    const fcmToken = await store.get(KEYS.fcmToken);
    await unregisterPushDevice().catch(() => {});
    await apiLogout(refreshToken || null, fcmToken || null, "mobile").catch(() => {});
    await store.remove(KEYS.fcmToken);
    await resetLocal();
  }, [resetLocal]);

  // Other contexts (notifications, guard) reset their state on logout. Returns an unsubscribe.
  const onLogout = useCallback((fn) => {
    logoutListeners.current.add(fn);
    return () => logoutListeners.current.delete(fn);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      isAuthenticated,
      restaurant,
      restaurantId: restaurant?._id || restaurant?.id || null,
      pendingPhone,
      pendingApproval,
      refreshRestaurant,
      updateRestaurant,
      requestOtp,
      verifyOtp,
      register,
      logout,
      onLogout,
      setPendingPhone,
      clearPendingPhone,
    }),
    [
      ready,
      isAuthenticated,
      restaurant,
      pendingPhone,
      pendingApproval,
      refreshRestaurant,
      updateRestaurant,
      requestOtp,
      verifyOtp,
      register,
      logout,
      onLogout,
      setPendingPhone,
      clearPendingPhone,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
