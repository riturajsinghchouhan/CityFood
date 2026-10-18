import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, createContext, useContext } from "react"
import { ProfileProvider } from "@food/context/ProfileContext"
import { CartProvider } from "@food/context/CartContext"
import { OrdersProvider } from "@food/context/OrdersContext"
import SearchOverlay from "./SearchOverlay"
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"
import Footer from "./Footer"
import { UserNotificationProvider } from "@food/context/UserNotificationContext"
import AppIntroSplash from "./AppIntroSplash"
import { LocationProvider } from "@food/context/LocationProvider"
import { useAppLocation } from "@food/hooks/useAppLocation"
import LocationGuard from "./LocationGuard"

const debugWarn = (...args) => {}

const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => { debugWarn("SearchOverlayProvider not available") },
  openSearch: () => { debugWarn("SearchOverlayProvider not available") },
  closeSearch: () => {},
})

export function useSearchOverlay() {
  return useContext(SearchOverlayContext)
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = () => setIsSearchOpen(true)
  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }}>
      {children}
      {isSearchOpen && (
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={closeSearch}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      )}
    </SearchOverlayContext.Provider>
  )
}

const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => { debugWarn("LocationSelectorProvider not available") },
  closeLocationSelector: () => {},
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const navigate = useNavigate()

  const openLocationSelector = () => {
    navigate("/food/user/address-selector")
  }

  const value = {
    isLocationSelectorOpen: false,
    openLocationSelector,
    closeLocationSelector: () => {},
  }

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
    </LocationSelectorContext.Provider>
  )
}

function UserLayoutShell() {
  const location = useLocation()
  const { isOutOfService } = useAppLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  const path = location.pathname.startsWith("/food")
    ? location.pathname.substring(5) || "/"
    : location.pathname
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path

  const isProfileRoot =
    normalizedPath === "/profile" ||
    normalizedPath === "/user/profile"

  const showBottomNav = !isOutOfService && (
    normalizedPath === "/" ||
    normalizedPath === "/user" ||
    normalizedPath === "/dining" ||
    normalizedPath === "/user/dining" ||
    normalizedPath === "/under-250" ||
    normalizedPath === "/user/under-250" ||
    normalizedPath === "/orders" ||
    normalizedPath === "/user/orders" ||
    isProfileRoot ||
    normalizedPath === ""
  )

  const isUnder250 = normalizedPath === "/under-250" || normalizedPath === "/user/under-250"

  // Inner pages get the same desktop header in normal flow (md+ only); auth screens stay bare.
  const isAuthPage = /^\/(user\/)?auth(\/|$)/.test(normalizedPath)
  const showStaticDesktopNav = !showBottomNav && !isAuthPage && !isOutOfService

  // Desktop footer on browse pages, not on task flows (cart, tracking, forms).
  const showDesktopFooter = !isOutOfService && (
    normalizedPath === "/" ||
    normalizedPath === "/user" ||
    normalizedPath === "" ||
    /^\/(user\/)?(dining|under-250|offers|gourmet|collections|categories|category\/[^/]+|help)$/.test(normalizedPath)
  )

  return (
    <>
      <div className="hidden md:block">
        {showBottomNav && <DesktopNavbar showLogo={!isUnder250} />}
        {showStaticDesktopNav && <DesktopNavbar variant="static" />}
      </div>
      <LocationGuard>
        <main className={`${showBottomNav ? "md:pt-20 pb-[calc(76px+max(env(safe-area-inset-bottom,0px),10px))] md:pb-0" : ""}`}>
          <Outlet />
        </main>
      </LocationGuard>
      {showDesktopFooter && <Footer />}
      {showBottomNav && <BottomNavigation />}
    </>
  )
}

export default function UserLayout() {
  const [introFinished, setIntroFinished] = useState(() => {
    try {
      return !!(typeof window !== 'undefined' && sessionStorage.getItem("appIntroSeen"))
    } catch (e) {
      return true;
    }
  })

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200 box-border">
      {!introFinished && (
        <AppIntroSplash onComplete={() => setIntroFinished(true)} />
      )}

      <CartProvider>
        <ProfileProvider>
          <LocationProvider>
            <OrdersProvider>
              <SearchOverlayProvider>
                <LocationSelectorProvider>
                  <UserNotificationProvider>
                    <UserLayoutShell />
                  </UserNotificationProvider>
                </LocationSelectorProvider>
              </SearchOverlayProvider>
            </OrdersProvider>
          </LocationProvider>
        </ProfileProvider>
      </CartProvider>
    </div>
  )
}
