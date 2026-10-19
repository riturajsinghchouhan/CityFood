// Open/close state for the search overlay (web: SearchOverlayContext in UserLayout.jsx).
// The overlay UI itself is rendered by the screen layer.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const SearchOverlayContext = createContext(null);

export function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchValue("");
  }, []);

  const value = useMemo(
    () => ({ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }),
    [isSearchOpen, searchValue, openSearch, closeSearch],
  );

  return <SearchOverlayContext.Provider value={value}>{children}</SearchOverlayContext.Provider>;
}

export function useSearchOverlay() {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) throw new Error("useSearchOverlay must be used inside SearchOverlayProvider");
  return ctx;
}
