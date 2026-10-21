// UI state that DeliveryHomeV2 keeps across its tabs (one component instance on web, so the state
// survives tab switches): the minimised order panel, the verification flow ("VERIFY & COMPLETE" or
// "Mark as Delivered" = bypassOtp) and the notification sheet. A tiny external store so the Feed
// screen, the shell overlays and the Orders tab share it.
import { useSyncExternalStore } from "react";

let state = {
  isModalMinimized: false,
  showVerification: false,
  bypassOtp: false,
};
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getShellState() {
  return state;
}

export function setShellState(patch) {
  const next = typeof patch === "function" ? patch(state) : patch;
  const merged = { ...state, ...next };
  if (Object.keys(merged).every((k) => merged[k] === state[k])) return;
  state = merged;
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Read the shell UI state (re-renders on change). */
export function useShellState() {
  return useSyncExternalStore(subscribe, getShellState, getShellState);
}

export const setModalMinimized = (value) => setShellState({ isModalMinimized: Boolean(value) });

/** web: setBypassOtp(bypass); setShowVerification(true) */
export function openVerification({ bypassOtp = false } = {}) {
  setShellState({ showVerification: true, bypassOtp: Boolean(bypassOtp), isModalMinimized: false });
}

export function closeVerification() {
  setShellState({ showVerification: false, bypassOtp: false });
}
