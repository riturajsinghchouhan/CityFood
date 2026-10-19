// Profile and account. Web: authAPI.getCurrentUser, userAPI.getProfile/updateProfile/
// uploadProfileImage/deleteAccount. Every function resolves to the backend body
// {success, message, data}; where the web read `res.data.data.x`, read `res.data.x`.
import { api } from "./client";
import { createSingleFlight } from "./cache";
import { postMultipart, toUploadFile } from "./upload";

// GET /food/auth/me, single-flight with a 3 s cache like the web's getUserMeOnce.
export const getCurrentUser = createSingleFlight(() => api.get("/food/auth/me"), 3000);

// Same request, normalized so the user is always at `data.user`.
export function getProfile() {
  return getCurrentUser().then((res) => {
    const user = res?.data?.user ?? res?.data ?? null;
    return { ...res, data: { user } };
  });
}

// Body (all optional): {name, email, profileImage, dateOfBirth "YYYY-MM-DD",
// anniversary "YYYY-MM-DD", gender: male|female|other|prefer-not-to-say}.
export async function updateProfile(body) {
  const res = await api.patch("/food/user/profile", body ?? {});
  getCurrentUser.invalidate();
  return res;
}

// Multipart field "file". `file` is an image-picker asset or {uri, name, type}.
export async function uploadProfileImage(file) {
  if (!file) throw new Error("File is required");
  const res = await postMultipart("/food/user/profile/profile-image", { file: toUploadFile(file) });
  getCurrentUser.invalidate();
  return res;
}

export function deleteAccount() {
  return api.delete("/food/user/account");
}
