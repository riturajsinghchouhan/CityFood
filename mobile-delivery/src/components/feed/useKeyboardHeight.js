// Keyboard height while it is open (the trip sheets are absolute overlays, so they lift themselves).
import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

export default function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
