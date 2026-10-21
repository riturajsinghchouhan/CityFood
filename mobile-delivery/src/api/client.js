// The single HTTP client. Mirrors the web deliveryClient (Frontend/src/services/api/axios.js,
// createModuleClient("delivery")): Bearer delivery_accessToken, single-flight refresh on 401
// via /food/auth/refresh-token, no refresh on 429, and one error shape for both backend formats
// ({message} and {error}). No X-Zone-Id / X-User-Lat headers: those are customer-only.
import axios, { create as createAxios } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config";
import { KEYS, secure, store } from "../storage";

let accessToken = null;
let refreshToken = null;
let sessionExpiredHandler = null;

export async function loadTokens() {
  accessToken = await secure.get(KEYS.accessToken);
  refreshToken = await secure.get(KEYS.refreshToken);
  return { accessToken, refreshToken };
}

export async function setTokens(next) {
  if ("accessToken" in next) {
    accessToken = next.accessToken || null;
    await secure.set(KEYS.accessToken, accessToken);
  }
  if ("refreshToken" in next) {
    refreshToken = next.refreshToken || null;
    await secure.set(KEYS.refreshToken, refreshToken);
  }
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await secure.remove(KEYS.accessToken);
  await secure.remove(KEYS.refreshToken);
}

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

// Called once by AuthContext so a failed refresh logs the rider out.
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

export class ApiError extends Error {
  constructor(message, { status, data, isNetworkError } = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.isNetworkError = Boolean(isNetworkError);
  }
}

function toApiError(err) {
  if (err instanceof ApiError) return err;
  const res = err?.response;
  if (!res) {
    const timedOut = err?.code === "ECONNABORTED";
    return new ApiError(
      timedOut
        ? "Request timed out. Please try again."
        : "Unable to connect. Please check your internet connection.",
      { isNetworkError: true },
    );
  }
  const body = res.data || {};
  const message =
    (typeof body.message === "string" && body.message) ||
    (typeof body.error === "string" && body.error) ||
    (res.status === 429
      ? "Too many requests. Please try again later."
      : res.status >= 500
        ? "Something went wrong. Please try again."
        : "Request failed");
  return new ApiError(message, { status: res.status, data: body });
}

const http = createAxios({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshToken) throw new ApiError("Session expired", { status: 401 });
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE_URL}/food/auth/refresh-token`, { refreshToken }, { timeout: 10000 })
      .then(async (res) => {
        const data = res.data?.data || {};
        if (!data.accessToken) throw new ApiError("Session expired", { status: 401 });
        await setTokens({
          accessToken: data.accessToken,
          ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
        });
        return data.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err?.config;
    const status = err?.response?.status;
    if (status === 401 && original && !original._retry && !original.skipAuthRefresh) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      } catch {
        await clearTokens();
        await store.remove(KEYS.user);
        sessionExpiredHandler?.();
        throw new ApiError("Your session has expired. Please log in again.", { status: 401 });
      }
    }
    throw toApiError(err);
  },
);

// Unwrap the backend's {success, message, data} envelope.
async function call(promise) {
  const res = await promise;
  return res.data;
}

export const api = {
  get: (url, config) => call(http.get(url, config)),
  post: (url, body, config) => call(http.post(url, body, config)),
  put: (url, body, config) => call(http.put(url, body, config)),
  patch: (url, body, config) => call(http.patch(url, body, config)),
  delete: (url, config) => call(http.delete(url, config)),
};

export default api;
