// Routing file
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { AppShellSkeleton } from '@food/components/ui/loading-skeletons'

const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))
import ProtectedRoute from '@food/components/ProtectedRoute'
import { isModuleAuthenticated } from '@food/utils/auth'
import { isFranchiseSession } from '@food/utils/adminSidebarMenu'

const PageLoader = () => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase()
    if (
      path.includes('/terms') ||
      path.includes('/privacy') ||
      path.includes('/support')
    ) {
      return null
    }
  }
  return <AppShellSkeleton />
}

/**
 * FoodAppWrapper — Quick-spicy App. को /food prefix के साथ render करता है.
 * 
 * Quick-spicy की App.jsx में routes /restaurant, /usermain, /admin, /delivery
 * जैसे hain (bina /food prefix ke). Yahan hum useLocation se /food ke baad wala
 * path nikalne ke baad FoodApp render karte hain. FoodApp internally BrowserRouter
 * nahi use karta (sirf Routes use karta hai), isliye ye directly kaam karta hai.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const RedirectToFood = () => {
  const location = useLocation();
  // We safely replace the exact current pathname with a /food prefixed pathname
  // This effectively catches programmatic navigation to absolute paths like '/restaurant/login'
  // and turns them into '/food/restaurant/login'
  return <Navigate to={`/food${location.pathname}${location.search}`} replace />;
};

const MasterLandingPage = lazy(() => import('./MasterLandingPage'))
const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))
const FranchiseLogin = lazy(() => import('../modules/Franchise/FranchiseLogin'))
const PartnerLandingPage = lazy(() => import('./PartnerLandingPage'))

/**
 * HQ uses the panel at /admin, franchise owners the same pages at /franchise.
 * Pages still link to /admin/...; a signed-in owner is moved to the /franchise copy of that URL
 * (and HQ back to /admin), so each panel stays on its own URL.
 */
const PanelGate = ({ panel }) => {
  const location = useLocation()
  if (isModuleAuthenticated('admin')) {
    const target = isFranchiseSession() ? 'franchise' : 'admin'
    if (target !== panel) {
      const rest = location.pathname.replace(/^\/(admin|franchise)/, '')
      return <Navigate to={`/${target}${rest}${location.search}${location.hash}`} replace />
    }
  }
  return <Suspense fallback={<PageLoader />}><AdminRouter /></Suspense>
}

const AppRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route.startsWith('/food/') || route.startsWith('/admin') || route.startsWith('/franchise')) {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <Routes>
      {/* Auth Module */}
      <Route path="/user/auth/*" element={<Suspense fallback={<PageLoader />}><AuthApp /></Suspense>} />
      <Route path="/delivery/auth/*" element={<Suspense fallback={<PageLoader />}><AuthApp /></Suspense>} />
      <Route path="/restaurant/auth/*" element={<Suspense fallback={<PageLoader />}><AuthApp /></Suspense>} />

      {/* Food Module - Handle both /food and root / for the user app */}
      <Route path="/food/*" element={<FoodAppWrapper />} />

      {/* Global Admin Portal - AdminRouter handles its own protection for sub-routes */}
      <Route path="/admin/*" element={<PanelGate panel="admin" />} />

      {/* Franchise owner panel - same pages as admin, scoped by the backend to the owner's zone */}
      <Route path="/franchise/login" element={<Suspense fallback={<PageLoader />}><FranchiseLogin /></Suspense>} />
      {/* Public "partner with us" pages; their forms land in Admin > Manage Inquiry */}
      <Route path="/franchise/landingpage" element={<Suspense fallback={<PageLoader />}><PartnerLandingPage key="franchise" type="franchise" /></Suspense>} />
      <Route path="/res/landingpage" element={<Suspense fallback={<PageLoader />}><PartnerLandingPage key="restaurant" type="restaurant" /></Suspense>} />
      <Route path="/deli/landingpage" element={<Suspense fallback={<PageLoader />}><PartnerLandingPage key="delivery" type="delivery" /></Suspense>} />
      <Route path="/franchise/*" element={<PanelGate panel="franchise" />} />

      {/* Handle root and other paths via FoodAppWrapper */}
      <Route path="/" element={
        <Suspense fallback={<PageLoader />}>
          <MasterLandingPage />
        </Suspense>
      } />
      <Route path="/*" element={<FoodAppWrapper />} />
    </Routes>
  )
}

export default AppRoutes
