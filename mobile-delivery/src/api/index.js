// Every rider endpoint, by domain. Import flat names (`import { acceptOrder } from "../api"`) or a
// domain namespace (`ordersApi.acceptOrder`). See docs/API_MAP.md for the web mapping.
// Return convention: each function resolves to the response BODY {success, message, data}
// (the web got the axios response, so web `res.data.data.x` is RN `res.data.x`).
// Errors are ApiError {message, status, data, isNetworkError}.
export { default as api, ApiError } from "./client";
export { resolveAssetUrl, resolveImage } from "./assets";

export * from "./upload";
export * from "./auth";
export * from "./profile";
export * from "./duty";
export * from "./orders";
export * from "./finance";
export * from "./support";
export * from "./notifications";
export * from "./push";
export * from "./zones";
export * from "./content";

export * as uploadApi from "./upload";
export * as authApi from "./auth";
export * as profileApi from "./profile";
export * as dutyApi from "./duty";
export * as ordersApi from "./orders";
export * as financeApi from "./finance";
export * as supportApi from "./support";
export * as notificationsApi from "./notifications";
export * as pushApi from "./push";
export * as zonesApi from "./zones";
export * as contentApi from "./content";
