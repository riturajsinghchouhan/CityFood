// Port of hooks/useVoiceSearch.js. The Web Speech API becomes expo-speech-recognition:
// one final result in en-IN, then stop. Error toasts keep the web wording.
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../ui/Toast";
import useLatest from "../../hooks/useLatest";

export function useVoiceSearch(onResult) {
  const [isListening, setIsListening] = useState(false);
  // Only react to events from a session this hook started (another screen may own the recognizer).
  const activeRef = useRef(false);
  const onResultRef = useLatest(onResult);

  const stopListening = useCallback(() => {
    if (!activeRef.current) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.warn("Speech recognition stop error:", e);
    }
    setIsListening(false);
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (activeRef.current) setIsListening(true);
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || !event?.isFinal) return;
    const transcript = event.results?.[0]?.transcript;
    if (transcript) onResultRef.current?.(transcript);
    stopListening();
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!activeRef.current) return;
    const errorType = event?.error;
    console.error("Speech recognition error:", errorType);
    if (errorType === "not-allowed") {
      toast.error("Microphone access denied. Please allow permission.");
    } else if (errorType === "no-speech" || errorType === "speech-timeout") {
      toast.error("No speech detected. Try again.");
    } else if (errorType === "network") {
      toast.error("Voice search requires an active internet connection.");
    } else if (errorType !== "aborted") {
      toast.error(`Voice search error: ${errorType}`);
    }
    stopListening();
  });

  useSpeechRecognitionEvent("end", () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setIsListening(false);
  });

  const startListening = useCallback(async () => {
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        toast.error("Voice search is not supported on this device.");
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        toast.error("Microphone access denied. Please allow permission.");
        return;
      }
      activeRef.current = true;
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: false, maxAlternatives: 1, continuous: false });
    } catch (error) {
      activeRef.current = false;
      console.error("Speech recognition initialization failed:", error);
      toast.error("Could not start voice search.");
    }
  }, []);

  // Release the recognizer if the owner unmounts mid-session.
  useEffect(
    () => () => {
      if (activeRef.current) {
        activeRef.current = false;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // already stopped
        }
      }
    },
    [],
  );

  return { isListening, startListening, stopListening };
}

export default useVoiceSearch;
