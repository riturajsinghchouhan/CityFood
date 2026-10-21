// New-offer alert (user decision B): ring + vibrate for the offer's 60 s window.
// The web's in-app sound is commented out (it only vibrated [200,100,200,100,300] every 4.5 s for up to
// 120 s); the app instead LOOPS assets/sounds/delivery_alert.mp3 continuously and repeats the vibration
// pattern until stopRing() — DeliveryContext stops it on accept / pass / claimed-by-other / cancelled /
// timeout (60 s auto-pass) / going offline / logout. ALERT_MAX_MS is a hard safety stop.
// Audio mode: playsInSilentMode so Android does not suppress playback in silent/vibrate ringer mode; it
// plays on the MEDIA stream, so media volume 0 still mutes it (the vibration still runs).
// shouldPlayInBackground is false: when the app is backgrounded the FCM new_order notification (channel
// "default", sound delivery_alert.mp3) is the alert; background JS audio would need the expo-audio
// background-playback plugin (not configured).
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Vibration } from "react-native";

export const OFFER_WINDOW_MS = 60000;
export const ALERT_MAX_MS = OFFER_WINDOW_MS;
// Vibration.vibrate(pattern, true) repeats from index 0: wait 0, buzz 200, 100, 200, 100, 300, pause 1200.
const VIBRATION_PATTERN = [0, 200, 100, 200, 100, 300, 1200];

const RING_SOURCE = require("../../assets/sounds/delivery_alert.mp3");

let player = null;
let modeSet = null;
let stopTimer = null;
let ringingKey = null;
let ringing = false;
const listeners = new Set();

function notify() {
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
    player.loop = true;
  }
  return player;
}

// Preload the player and audio mode (optional; call once at app start).
export function prepareRing() {
  ensureMode();
  try {
    getPlayer();
  } catch {
    // created lazily on first ring instead
  }
}

/**
 * Start (or restart) ringing for an offer key. Restarting with a new key resets the window, like the
 * web's startAlertLoop for each new alert. Same key while ringing = no-op. maxMs defaults to the
 * offer's remaining window (pass the time left on its countdown).
 */
export async function startRing(key = null, { maxMs = ALERT_MAX_MS } = {}) {
  if (ringing && key !== null && key === ringingKey) return;
  clearTimeout(stopTimer);
  ringingKey = key;
  ringing = true;
  Vibration.vibrate(VIBRATION_PATTERN, true);
  stopTimer = setTimeout(stopRing, Math.max(1000, Math.min(maxMs, ALERT_MAX_MS)));
  notify();
  try {
    await ensureMode();
    if (!ringing) return; // stopped while the audio mode was being set
    const p = getPlayer();
    p.loop = true;
    p.volume = 1;
    await p.seekTo(0).catch(() => {});
    if (ringing) p.play();
  } catch {
    // Audio failures must never break the offer flow; vibration still runs.
  }
}

// One short alert (web playNotificationSound for order_ready): vibrate once, no loop.
export function pulseAlert() {
  Vibration.vibrate([0, 200, 100, 200, 100, 300]);
}

export function stopRing() {
  const was = ringing;
  clearTimeout(stopTimer);
  stopTimer = null;
  ringing = false;
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
  if (was) notify();
}

export function isRinging() {
  return ringing;
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
