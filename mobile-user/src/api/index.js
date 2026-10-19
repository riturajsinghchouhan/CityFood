// Every customer endpoint, by domain. Import flat names (`import { getAddresses } from "../api"`)
// or a domain namespace (`addressesApi.getAddresses`). See docs/API_MAP.md for the web mapping.
export { default as api, ApiError, setZoneContext } from "./client";
export { resolveAssetUrl, resolveImage } from "./assets";
export { toUploadFile, postMultipart } from "./upload";

export * from "./profile";
export * from "./addresses";
export * from "./location";
export * from "./restaurants";
export * from "./content";
export * from "./orders";
export * from "./wallet";
export * from "./support";
export * from "./notifications";
export * from "./push";
export * from "./dining";

export * as profileApi from "./profile";
export * as addressesApi from "./addresses";
export * as locationApi from "./location";
export * as restaurantsApi from "./restaurants";
export * as contentApi from "./content";
export * as ordersApi from "./orders";
export * as walletApi from "./wallet";
export * as supportApi from "./support";
export * as notificationsApi from "./notifications";
export * as pushApi from "./push";
export * as diningApi from "./dining";
