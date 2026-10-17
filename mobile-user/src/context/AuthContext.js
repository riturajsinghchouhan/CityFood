// Customer auth, same contract as the web (Frontend/src/modules/auth/pages/Login.jsx):
// OTP request -> verify; a new user without a name gets {isNewUser, needsName}
// and verifies again with the same OTP plus name. Tokens live in SecureStore.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, clearTokens, getRefreshToken, loadTokens, onSessionExpired, setTokens } from "../api/client";
import { KEYS, store } from "../storage";

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
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const logoutListeners = useRef(new Set());

  const resetLocal = useCallback(async () => {
    await clearTokens();
    await store.remove(KEYS.user);
    setUser(null);
    setIsAuthenticated(false);
    logoutListeners.current.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      resetLocal();
    });
    (async () => {
      const { accessToken, refreshToken } = await loadTokens();
      // Web rule (auth.js isModuleAuthenticated): valid USER access token or a valid refresh token.
      const role = decodeJwtPayload(accessToken || "")?.role;
      const authed =
        (isUnexpired(accessToken) && (!role || role === "USER")) || isUnexpired(refreshToken);
      if (authed) {
        setUser(await store.get(KEYS.user));
        setIsAuthenticated(true);
      } else if (accessToken || refreshToken) {
        await clearTokens();
      }
      setReady(true);
    })();
  }, [resetLocal]);

  const requestOtp = useCallback(
    (phone) => api.post("/food/auth/user/request-otp", { phone }, { skipAuthRefresh: true }),
    [],
  );

  // Returns {needsName: true} for a new user, otherwise logs in.
  const verifyOtp = useCallback(async ({ phone, otp, name, ref, fcmToken }) => {
    const body = { phone, otp: String(otp), platform: "mobile" };
    if (name) body.name = name;
    if (ref) body.ref = ref;
    if (fcmToken) body.fcmToken = fcmToken;
    const res = await api.post("/food/auth/user/verify-otp", body, { skipAuthRefresh: true });
    const data = res?.data || {};
    if (data.needsName && !data.accessToken && !data.token) {
      return { needsName: true, isNewUser: true };
    }
    const accessToken = data.accessToken || data.token;
    if (!accessToken) throw new Error(res?.message || "Login failed");
    await setTokens({ accessToken, refreshToken: data.refreshToken || null });
    await store.set(KEYS.user, data.user || null);
    setUser(data.user || null);
    setIsAuthenticated(true);
    return { user: data.user, isNewUser: Boolean(data.isNewUser) };
  }, []);

  const updateUser = useCallback((next) => {
    setUser((prev) => {
      const merged = typeof next === "function" ? next(prev) : { ...(prev || {}), ...next };
      store.set(KEYS.user, merged);
      return merged;
    });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    const fcmToken = await store.get(KEYS.fcmToken);
    if (refreshToken || fcmToken) {
      await api
        .post(
          "/food/auth/logout",
          { refreshToken: refreshToken || undefined, fcmToken: fcmToken || undefined, platform: "mobile" },
          { skipAuthRefresh: true },
        )
        .catch(() => {});
    }
    await store.remove(KEYS.fcmToken);
    await resetLocal();
  }, [resetLocal]);

  // Other contexts (cart, profile, notifications) clear their state on logout.
  const onLogout = useCallback((fn) => {
    logoutListeners.current.add(fn);
    return () => logoutListeners.current.delete(fn);
  }, []);

  const value = useMemo(
    () => ({ ready, user, isAuthenticated, requestOtp, verifyOtp, updateUser, logout, onLogout }),
    [ready, user, isAuthenticated, requestOtp, verifyOtp, updateUser, logout, onLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
