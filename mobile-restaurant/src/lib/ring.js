// New-order ringtone, ported from useRestaurantNotifications.js (playNotificationSound +
// startAlertLoop/stopAlertLoop). The web rang only on desktop widths; the phone app always rings.
// Behaviour: play now, replay every 6 s (ALERT_LOOP_INTERVAL_MS) for at most 120 s
// (ALERT_LOOP_MAX_MS) or until stopRing() (accept / reject / dismiss / cancel / mute).
// Each play also vibrates [200,100,200,100,300] like navigator.vibrate on web.
// Audio mode: playsInSilentMode=true so Android does not suppress playback in silent/vibrate
// ringer mode (expo-audio's only silent-mode switch); it plays on the MEDIA stream, so media
// volume 0 still mutes it. interruptionMode "duckOthers" lowers other apps' audio.
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Vibration } from "react-native";

export const ALERT_LOOP_INTERVAL_MS = 6000;
export const ALERT_LOOP_MAX_MS = 120000;
const VIBRATION_PATTERN = [0, 200, 100, 200, 100, 300];

const RING_SOURCE = require("../../assets/sounds/restaurant_order_ring.wav");

let player = null;
let modeSet = null;
let loopTimer = null;
let startedAt = 0;
let ringingKey = null;
const listeners = new Set();

function notify() {
  const ringing = Boolean(loopTimer);
  listeners.forEach((fn) => {
    try {
      fn(ringing, ringingKey);
    } catch {
      // ignore listener errors
    }
  });
}

function ensureMode() {
  if (!modeSet) {
    modeSet = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
    }).catch(() => {
      modeSet = null;
    });
  }
  return modeSet;
}

function getPlayer() {
  if (!player) {
    player = createAudioPlayer(RING_SOURCE);
    player.volume = 1;
    player.loop = false;
  }
  return player;
}

// Preload the player and audio mode (call once at app start; optional).
export function prepareRing() {
  ensureMode();
  try {
    getPlayer();
  } catch {
    // created lazily on first ring instead
  }
}

// One ring + vibration (web playNotificationSound).
export async function playRingOnce() {
  Vibration.vibrate(VIBRATION_PATTERN);
  try {
    await ensureMode();
    const p = getPlayer();
    p.volume = 1;
    await p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio failures must never break the order flow.
  }
}

function clearLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  startedAt = 0;
}

/**
 * Start (or restart) the alert loop for an order key. Restarting resets the 120 s window,
 * as the web's startAlertLoop does for each new alert.
 */
export function startRing(key = null) {
  clearLoop();
  ringingKey = key;
  startedAt = Date.now();
  playRingOnce();
  loopTimer = setInterval(() => {
    if (Date.now() - startedAt >= ALERT_LOOP_MAX_MS) {
      stopRing();
      return;
    }
    playRingOnce();
  }, ALERT_LOOP_INTERVAL_MS);
  notify();
}

// web stopAlertLoop: stop the loop, pause and rewind.
export function stopRing() {
  const wasRinging = Boolean(loopTimer) || ringingKey !== null;
  clearLoop();
  ringingKey = null;
  Vibration.cancel();
  if (player) {
    try {
      player.pause();
      player.seekTo(0).catch(() => {});
    } catch {
      // ignore
    }
  }
  if (wasRinging) notify();
}

export function isRinging() {
  return Boolean(loopTimer);
}

export function getRingingKey() {
  return ringingKey;
}

// listener(isRinging, key). Returns an unsubscribe.
export function subscribeRing(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Release the native player (logout).
export function releaseRing() {
  stopRing();
  if (player) {
    try {
      player.remove();
    } catch {
      // ignore
    }
    player = null;
  }
}
