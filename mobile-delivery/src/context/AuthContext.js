// Rider auth, same contract as the web (DeliveryV2/pages/auth/{SignIn,OTP,SignupStep1,SignupStep2}.jsx,
// ProfileV2.jsx logout, Food/utils/auth.js). Phone OTP only; verify-otp has THREE outcomes:
//   1. tokens            -> logged in (approved, or a legacy rider created before 2026-05-26)
//   2. needsRegistration -> unknown phone: deliveryNeedsRegistration="true", deliverySignupDetails
//                           seeded {name:"", phone:<last 10>, countryCode:"+91"} -> /signup/details
//   3. pendingApproval   -> {isRejected, rejectionReason, message}: shown inline on the OTP screen
//                           (no separate route); rejected riders may "Re-apply" (reapply()).
// Tokens live in SecureStore under delivery_accessToken / delivery_refreshToken (role DELIVERY_PARTNER).
//
// Logout (web ProfileV2 order) PLUS, unlike the web (audit §6 F4): the rider is set OFFLINE
// (PATCH /availability {status:"offline"}), background tracking is stopped and the online preference
// is cleared BEFORE the tokens are dropped.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildRegisterFormData,
  getMe,
  invalidateMe,
  logout as apiLogout,
  register as apiRegister,
  sendOTP,
  toDeliveryOtpPhone,
  verifyOTP,
} from "../api/auth";
import { clearTokens, getAccessToken, getRefreshToken, loadTokens, onSessionExpired, setTokens } from "../api/client";
import { updateOnlineStatus } from "../api/duty";
import { stopBackgroundTracking } from "../lib/locationTask";
import { getPushTokenForLogin, unregisterPushDevice } from "../lib/push";
import { releaseRing } from "../lib/ring";
import { DELIVERY_SESSION_CACHE_KEYS, KEYS, store } from "../storage";

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

export function riderIdOf(user, token) {
  const id = user?._id || user?.id || user?.deliveryPartnerId || decodeJwtPayload(token || "")?.userId;
  return id ? String(id) : null;
}

const last10 = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authData, setAuthDataState] = useState(null); // web localStorage.deliveryAuthData
  const [pendingApproval, setPendingApproval] = useState(null);
  const logoutListeners = useRef(new Set());

  const setAuthData = useCallback(async (next) => {
    setAuthDataState(next || null);
    await store.set(KEYS.authData, next || null);
  }, []);

  // clearModuleAuth("delivery") + the keys the web leaves behind.
  const resetLocal = useCallback(async () => {
    await clearTokens();
    await store.remove(KEYS.user);
    await store.removeMany(DELIVERY_SESSION_CACHE_KEYS);
    invalidateMe();
    releaseRing();
    setUser(null);
    setIsAuthenticated(false);
    setAuthDataState(null);
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
      // Tokens are already gone: the backend can't be told "offline"; stop the location task at least.
      stopBackgroundTracking({ flush: false }).catch(() => {});
      resetLocal();
    });
    (async () => {
      const { accessToken, refreshToken } = await loadTokens();
      // isModuleAuthenticated("delivery"): unexpired DELIVERY_PARTNER access token, or unexpired refresh token.
      const role = String(decodeJwtPayload(accessToken || "")?.role || "").toUpperCase();
      const authed =
        (isUnexpired(accessToken) && (!role || role === "DELIVERY_PARTNER")) || isUnexpired(refreshToken);
      if (authed) {
        setUser(await store.get(KEYS.user));
        setIsAuthenticated(true);
      } else if (accessToken || refreshToken) {
        await clearTokens();
        stopBackgroundTracking({ flush: false }).catch(() => {});
      }
      setAuthDataState(await store.get(KEYS.authData));
      setReady(true);
    })();
  }, [resetLocal]);

  /**
   * GET /food/auth/me -> data.user (whole rider document + deliveryId, documents, vehicle, location;
   * status "rejected" reported as "blocked"). Stored as delivery_user. options.noCache bypasses the 3 s cache.
   */
  const refreshProfile = useCallback(async (options = {}) => {
    if (options.noCache) invalidateMe();
    const res = await getMe();
    const next = res?.data?.user || res?.data?.deliveryPartner || null;
    if (next) {
      setUser(next);
      store.set(KEYS.user, next);
    }
    return next;
  }, []);

  // Local merge after a mutation that returned the partner (profile/details, photo...).
  const updateUser = useCallback((next) => {
    setUser((prev) => {
      const merged = typeof next === "function" ? next(prev) : { ...(prev || {}), ...next };
      store.set(KEYS.user, merged);
      return merged;
    });
  }, []);

  /**
   * SignIn: requestOtp("98765 43210") — 10 digits starting 6-9 (validate in the screen). Sends
   * "+91 <10 digits>" (normalized to "91XXXXXXXXXX", the web format) and stores deliveryAuthData
   * {method:"phone", phone:"+91 …", isSignUp:false, purpose:"login", module:"delivery"}. Resend: same call.
   */
  const requestOtp = useCallback(
    async (phoneInput) => {
      const phone = /^\+?91\s/.test(String(phoneInput)) ? String(phoneInput) : toDeliveryOtpPhone(phoneInput);
      const res = await sendOTP(phone);
      await store.set(KEYS.draftPhone, last10(phone));
      await setAuthData({ method: "phone", phone, isSignUp: false, purpose: "login", module: "delivery" });
      setPendingApproval(null);
      return res;
    },
    [setAuthData],
  );

  /**
   * verifyOtp({otp, phone?, fcmToken?}). phone defaults to deliveryAuthData.phone. The FCM token is
   * fetched without a prompt when not given and sent with platform "mobile". Resolves to one of:
   *  {outcome:"pendingApproval", isRejected, rejectionReason, message}      -> stay on OTP, show card
   *  {outcome:"needsRegistration", phone:<last10>, signupDetails}             -> /signup/details
   *  {outcome:"authenticated", user}                                         -> "/" (feed)
   * Wrong OTP etc. throw ApiError (401 "Invalid OTP").
   */
  const verifyOtp = useCallback(
    async ({ otp, phone: phoneArg, fcmToken } = {}) => {
      const phone = phoneArg || authData?.phone || (await store.get(KEYS.authData))?.phone;
      if (!phone) throw new Error("Phone number not found. Please try again.");
      const token = fcmToken === undefined ? await getPushTokenForLogin() : fcmToken;
      const res = await verifyOTP(phone, otp, token || null, "mobile");
      const data = res?.data || {};

      if (data.pendingApproval === true) {
        await setAuthData(null);
        const info = {
          phone: last10(phone),
          isRejected: Boolean(data.isRejected),
          rejectionReason: data.rejectionReason || "",
          message: data.message || "Your account is pending admin verification. You will be notified once approved.",
        };
        setPendingApproval(info);
        return { outcome: "pendingApproval", ...info };
      }

      if (data.needsRegistration === true) {
        await setAuthData(null);
        const signupDetails = { name: "", phone: last10(phone), countryCode: "+91" };
        await store.set(KEYS.needsRegistration, "true");
        await store.set(KEYS.signupDetails, signupDetails);
        setPendingApproval(null);
        return { outcome: "needsRegistration", phone: signupDetails.phone, signupDetails };
      }

      const accessToken = data.accessToken || data.token;
      const nextUser = data.user;
      if (!accessToken || !nextUser) throw new Error("Invalid response from server");

      await setTokens({ accessToken, refreshToken: data.refreshToken || null });
      await store.set(KEYS.user, nextUser);
      await setAuthData(null);
      invalidateMe();
      setUser(nextUser);
      setPendingApproval(null);
      setIsAuthenticated(true);
      refreshProfile({ noCache: true }).catch(() => {});
      return { outcome: "authenticated", user: nextUser };
    },
    [authData, refreshProfile, setAuthData],
  );

  // OTP "Re-apply Now" for a rejected rider: seed the signup flow with the phone.
  const reapply = useCallback(async (phone) => {
    const signupDetails = { name: "", phone: last10(phone || pendingApproval?.phone), countryCode: "+91" };
    await store.set(KEYS.needsRegistration, "true");
    await store.set(KEYS.signupDetails, signupDetails);
    setPendingApproval(null);
    return signupDetails;
  }, [pendingApproval]);

  // Signup drafts (web deliverySignupDetails / deliverySignupDocs; images stay as local file URIs).
  const getSignupDetails = useCallback(() => store.get(KEYS.signupDetails), []);
  const saveSignupDetails = useCallback((details) => store.set(KEYS.signupDetails, details), []);
  const getSignupDocs = useCallback(() => store.get(KEYS.signupDocs), []);
  const saveSignupDocs = useCallback((docs) => store.set(KEYS.signupDocs, docs), []);
  const clearSignupDrafts = useCallback(
    () => store.removeMany([KEYS.signupDetails, KEYS.signupDocs, KEYS.needsRegistration]),
    [],
  );

  /**
   * register(details, files) -> multipart POST /food/delivery/register (no auth) with the FCM token +
   * platform "mobile". details: step-1 fields (zoneId required); files: {profilePhoto, aadharFrontPhoto,
   * aadharBackPhoto, panPhoto, rcPhoto, drivingLicenseFrontPhoto?, drivingLicenseBackPhoto?} picker
   * assets. A ready FormData is accepted as the first argument. On success the signup drafts are cleared
   * (web shows "Profile Under Review" -> Back to Login). Resolves to the body (data = rider, status pending).
   */
  const register = useCallback(
    async (details, files) => {
      let formData = details;
      if (!(typeof FormData !== "undefined" && details instanceof FormData)) {
        const fcmToken = await getPushTokenForLogin();
        formData = buildRegisterFormData(details, files, { fcmToken, platform: "mobile" });
      }
      const res = await apiRegister(formData);
      await clearSignupDrafts();
      return res;
    },
    [clearSignupDrafts],
  );

  /**
   * Web ProfileV2 logout + go offline: stop background tracking (flushing queued points), PATCH
   * availability offline, DELETE /fcm-tokens/device/remove, DELETE /fcm-tokens/remove,
   * POST /food/auth/logout {refreshToken, fcmToken, platform:"mobile"}, then clear delivery_* auth,
   * the online preference and caches. API failures never block the local logout.
   */
  const logout = useCallback(async () => {
    await stopBackgroundTracking().catch(() => {});
    if (getAccessToken()) await updateOnlineStatus(false).catch(() => {});
    const refreshToken = getRefreshToken();
    const fcmToken = await store.get(KEYS.fcmToken);
    await unregisterPushDevice().catch(() => {});
    await apiLogout(refreshToken || null, fcmToken || null, "mobile").catch(() => {});
    await store.remove(KEYS.fcmToken);
    await resetLocal();
  }, [resetLocal]);

  // Other contexts reset their state on logout / session expiry. Returns an unsubscribe.
  const onLogout = useCallback((fn) => {
    logoutListeners.current.add(fn);
    return () => logoutListeners.current.delete(fn);
  }, []);

  const riderId = useMemo(() => (isAuthenticated ? riderIdOf(user, getAccessToken()) : null), [isAuthenticated, user]);

  const value = useMemo(
    () => ({
      ready,
      isAuthenticated,
      user,
      riderId,
      authData,
      pendingApproval,
      refreshProfile,
      updateUser,
      requestOtp,
      verifyOtp,
      reapply,
      register,
      getSignupDetails,
      saveSignupDetails,
      getSignupDocs,
      saveSignupDocs,
      clearSignupDrafts,
      logout,
      onLogout,
    }),
    [
      ready,
      isAuthenticated,
      user,
      riderId,
      authData,
      pendingApproval,
      refreshProfile,
      updateUser,
      requestOtp,
      verifyOtp,
      reapply,
      register,
      getSignupDetails,
      saveSignupDetails,
      getSignupDocs,
      saveSignupDocs,
      clearSignupDrafts,
      logout,
      onLogout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
