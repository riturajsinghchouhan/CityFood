import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef, useMemo } from "react"
import { ChevronDown, ShoppingCart, Wallet, Search, Bell, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { useProfile } from "@food/context/ProfileContext"
import { FaLocationDot } from "react-icons/fa6"
import { AnimatePresence, motion } from "framer-motion"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { getPublicLandingSettings } from "@food/api"
import { useAppLocation } from "@food/hooks/useAppLocation"
import { useAppLogo } from "@food/hooks/useAppLogo"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// variant "fixed": pinned header used on the main tab pages (layout reserves md:pt-20 for it).
// variant "static": same header in normal flow for inner pages, so their own sticky headers still work.
export default function DesktopNavbar({ showLogo = true, variant = "fixed" }) {
    const isStatic = variant === "static"
    const location = useLocation()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { vegMode, setVegMode } = useProfile()
    const { zoneId } = useAppLocation()
    const [heroSearch, setHeroSearch] = useState("")
    const logoUrl = useAppLogo('user_app')
    const [logoFailed, setLogoFailed] = useState(false)
    useEffect(() => { setLogoFailed(false) }, [logoUrl])
    const [companyName, setCompanyName] = useState(null)
    const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
    const [under250PriceLimit, setUnder250PriceLimit] = useState(250)
    const navRef = useRef(null)
    const cartCount = getCartCount()

    // Show area if available, otherwise show city
    const areaName = userLocation?.area && userLocation?.area.trim() ? userLocation.area.trim() : null
    const cityName = userLocation?.city || "Indore"
    
    // Main location name: Show area
    const mainLocationName = useMemo(() => {
        let name = areaName || "Select Location"
        if (/^-?\d+(\.\d+)?$/.test(name.trim())) {
            return "Current Location"
        }
        return name
    }, [areaName])
    
    // Bottom location: Show city
    const bottomCity = cityName

    const handleLocationClick = () => {
        // Open location selector overlay
        openLocationSelector()
    }

    // Check active routes - support both /user/* and /* paths
    const isDining = location.pathname === "/food/user/dining" || location.pathname === "/food/dining"
    const isUnder250 = location.pathname === "/food/user/under-250" || location.pathname === "/food/under-250"
    const isProfile = location.pathname.startsWith("/food/user/profile") || location.pathname.startsWith("/food/profile")
    const isOrders = location.pathname.startsWith("/food/user/orders") || location.pathname.startsWith("/food/orders")
    const isDelivery = !isDining && !isUnder250 && !isProfile && !isOrders && (location.pathname === "/food/user" || location.pathname === "/food" || (location.pathname.startsWith("/food/user") && !location.pathname.includes("/dining") && !location.pathname.includes("/under-250") && !location.pathname.includes("/profile")))
    const isBannerRoute =
        !isStatic && (
            location.pathname === "/food/user" ||
            location.pathname === "/food" ||
            location.pathname === "/food/user/under-250" ||
            location.pathname === "/food/under-250"
        )

    const navTabs = [
        { key: "delivery", to: "/food/user/", label: "Delivery", active: isDelivery },
        { key: "under250", to: "/food/user/under-250", label: `Under ₹${under250PriceLimit}`, active: isUnder250 },
        { key: "orders", to: "/food/user/orders", label: "Orders", active: isOrders },
        { key: "profile", to: "/food/user/profile", label: "Profile", active: isProfile },
    ]

    // Load business settings company name
    useEffect(() => {
        const loadName = async () => {
            try {
                const cached = getCachedSettings()
                if (cached?.companyName) {
                    setCompanyName(cached.companyName)
                } else {
                    const settings = await loadBusinessSettings()
                    if (settings?.companyName) {
                        setCompanyName(settings.companyName)
                    }
                }
            } catch (error) {
                debugError('Error loading company name:', error)
            }
        }
        loadName()

        // Listen for business settings updates
        const handleSettingsUpdate = () => {
            const cached = getCachedSettings()
            if (cached?.companyName) {
                setCompanyName(cached.companyName)
            }
        }
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
        }
    }, [])

    useEffect(() => {
        if (!isBannerRoute) {
            setHasScrolledPastBanner(true)
            return
        }

        const handleScroll = () => {
            const heroShell =
                document.querySelector('[data-home-hero-shell="true"]') ||
                document.querySelector('[data-banner-shell="true"]')
            const navElement = navRef.current

            if (!heroShell || !navElement) {
                setHasScrolledPastBanner(true)
                return
            }

            // Stay transparent only while a banner actually sits behind the navbar at the very top;
            // otherwise page content would show through the tabs while scrolling.
            const heroRect = heroShell.getBoundingClientRect()
            const navHeight = navElement.getBoundingClientRect().height || 0
            const bannerBehindNav = window.scrollY <= 8 && heroRect.top < navHeight && heroRect.bottom > navHeight
            setHasScrolledPastBanner(!bannerBehindNav)
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)

        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [isBannerRoute])

    // Fetch landing settings to get dynamic price limit
    useEffect(() => {
        let cancelled = false
        getPublicLandingSettings(zoneId || null)
            .then((settings) => {
                if (cancelled || !settings) return
                if (typeof settings.under250PriceLimit === 'number') {
                    setUnder250PriceLimit(settings.under250PriceLimit)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUnder250PriceLimit(250)
                }
            })
        return () => { cancelled = true }
    }, [zoneId])

    const iconButtonClass = "h-10 w-10 xl:h-12 xl:w-12 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    const iconClass = "!h-5 !w-5 xl:!h-6 xl:!w-6 text-gray-700 dark:text-gray-300"
    const isTransparent = isBannerRoute && !hasScrolledPastBanner

    return (
        <nav
            ref={navRef}
            className={`hidden md:flex flex-col ${isStatic ? "relative z-40" : "fixed top-0 left-0 right-0 z-50 [@media(max-height:500px)]:absolute"} py-2 transition-all duration-300 ${isTransparent
                ? "bg-transparent !bg-transparent border-0 shadow-none"
                : "bg-background border-b border-border shadow-sm"
                }`}
        >
            {/* Single row: Logo - Location - Search - Tabs ... Veg - Icons */}
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center h-16 gap-3 xl:gap-5">
                    {/* Logo */}
                    {showLogo && (
                        <Link to="/food/user" className="flex items-center justify-center flex-shrink-0">
                            {logoUrl && !logoFailed ? (
                                <img
                                    src={logoUrl}
                                    alt={companyName || "Company Logo"}
                                    className="h-10 w-auto lg:h-12 object-contain"
                                    onError={() => setLogoFailed(true)}
                                />
                            ) : (
                                <span className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                                    {companyName || "CityFood"}
                                </span>
                            )}
                        </Link>
                    )}

                    {/* Location Selector */}
                    <Button
                        variant="ghost"
                        onClick={handleLocationClick}
                        disabled={locationLoading}
                        className="h-auto px-0 py-0 hover:bg-transparent transition-colors flex-shrink-0"
                        title={mainLocationName}
                    >
                        {locationLoading ? (
                            <span className="text-sm font-bold text-black dark:text-white">
                                Loading...
                            </span>
                        ) : (
                            <div className="flex flex-col items-start min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <FaLocationDot
                                        className="h-5 w-5 text-black dark:text-white flex-shrink-0"
                                        fill="currentColor"
                                        strokeWidth={2}
                                    />
                                    <span className="hidden lg:inline text-sm xl:text-base font-bold text-black dark:text-white whitespace-nowrap truncate max-w-[120px] xl:max-w-[160px]">
                                        {mainLocationName}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-black dark:text-white flex-shrink-0" strokeWidth={2.5} />
                                </div>
                                <span className="hidden lg:block text-[9px] xl:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                                    {bottomCity}
                                </span>
                            </div>
                        )}
                    </Button>

                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-[120px] max-w-xs xl:max-w-sm">
                        <div className="relative bg-muted rounded-lg transition-all duration-300 focus-within:ring-2 focus-within:ring-primary focus-within:bg-background border border-transparent focus-within:border-primary/20">
                            <div className="flex items-center px-3 py-2">
                                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-3" />
                                <Input
                                    value={heroSearch}
                                    onChange={(e) => {
                                        const nextValue = e.target.value
                                        setHeroSearch(nextValue)
                                        setSearchValue(nextValue)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && heroSearch.trim()) {
                                            navigate(`/food/search?q=${encodeURIComponent(heroSearch.trim())}`)
                                        }
                                    }}
                                    className="h-6 p-0 border-0 bg-transparent text-sm font-medium placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    placeholder="Search for restaurants, food..."
                                />
                                {heroSearch && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full ml-1"
                                        onClick={() => setHeroSearch("")}
                                    >
                                        <span className="sr-only">Clear</span>
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs - right beside the search */}
                    <div className="flex items-center gap-0.5 xl:gap-1 flex-shrink-0">
                        {navTabs.map((tab) => (
                            <Link
                                key={tab.key}
                                to={tab.to}
                                className={`relative px-2 xl:px-3 py-2 rounded-full text-xs xl:text-sm font-bold tracking-wide uppercase whitespace-nowrap transition-colors ${tab.active
                                    ? "text-primary"
                                    : "text-gray-600 dark:text-gray-400 hover:text-primary"
                                    }`}
                            >
                                {tab.active && (
                                    <motion.span
                                        layoutId="navIndicator"
                                        className="absolute inset-0 rounded-full bg-primary/10"
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                                <span className="relative">{tab.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Right: Veg Mode, Notifications, Wallet and Cart */}
                    <div className="flex items-center gap-1 xl:gap-2 flex-shrink-0 ml-auto">
                        <div className="flex items-center gap-2 mr-1">
                            <div className="hidden xl:flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 leading-none">VEG</span>
                                <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-none">MODE</span>
                            </div>
                            <Switch
                                checked={vegMode}
                                onCheckedChange={setVegMode}
                                title="Veg mode"
                                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600 h-5 w-9"
                            />
                        </div>

                        <Link to="/food/user/notifications" className="hidden xl:block">
                            <Button variant="ghost" className={iconButtonClass} title="Notifications">
                                <Bell className={iconClass} strokeWidth={2} />
                            </Button>
                        </Link>

                        <Link to="/food/user/wallet">
                            <Button variant="ghost" className={iconButtonClass} title="Wallet">
                                <Wallet className={iconClass} strokeWidth={2} />
                            </Button>
                        </Link>

                        <Link to="/food/user/cart">
                            <Button variant="ghost" className={`relative ${iconButtonClass}`} title="Cart">
                                <ShoppingCart className={iconClass} strokeWidth={2} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                        <span className="text-xs font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
                                    </span>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}
