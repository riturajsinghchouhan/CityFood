import { useLayoutEffect, useRef } from "react";

// A ref that always holds the latest value, for reading inside callbacks and
// listeners without re-subscribing. Updated after render, not during it.
export default function useLatest(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
