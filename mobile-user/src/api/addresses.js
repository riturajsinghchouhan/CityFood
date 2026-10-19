// Saved addresses. Web: userAPI.getAddresses/addAddress/updateAddress/deleteAddress/setDefaultAddress.
// Requests use flat latitude/longitude; responses carry GeoJSON location.coordinates [lng, lat].
// One address per label (Home | Office | Other): posting an existing label overwrites it.
import { api } from "./client";
import { createSingleFlight } from "./cache";

export const getAddresses = createSingleFlight(() => api.get("/food/user/addresses"), 3000);

async function mutate(promise) {
  const res = await promise;
  getAddresses.invalidate();
  return res;
}

// Body: {label?, street*, additionalDetails?, city*, state*, zipCode?, phone?, latitude*, longitude*}
export function addAddress(body) {
  return mutate(api.post("/food/user/addresses", body ?? {}));
}

export function updateAddress(id, body) {
  return mutate(api.patch(`/food/user/addresses/${String(id)}`, body ?? {}));
}

export function deleteAddress(id) {
  return mutate(api.delete(`/food/user/addresses/${String(id)}`));
}

export function setDefaultAddress(id) {
  return mutate(api.patch(`/food/user/addresses/${String(id)}/default`, {}));
}
