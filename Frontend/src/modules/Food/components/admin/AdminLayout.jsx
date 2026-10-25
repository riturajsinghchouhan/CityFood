import { useState, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import AdminSidebar from "./AdminSidebar"
import AdminNavbar from "./AdminNavbar"
import FranchiseFilterBar from "./FranchiseFilterBar"
import { isFranchiseSession } from "@food/utils/adminSidebarMenu"
import { FRANCHISE_FILTER_EVENT, getFranchiseFilter, isFranchiseFilterPage } from "@food/utils/franchiseFilter"
import { API_BASE_URL } from "@food/api/config"
import { adminAPI } from "@/services/api/index.js"
import { resolveSocketOrigin } from "@food/utils/socketOrigin"
import { getModuleToken } from "@food/utils/auth"
import io from "socket.io-client"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { pathname } = useLocation();
  const [franchiseFilter, setFranchiseFilterState] = useState(getFranchiseFilter);
  // HQ only: franchise owners are already limited to their own zone.
  const showFranchiseFilter = !isFranchiseSession() && isFranchiseFilterPage(pathname);

  useEffect(() => {
    const onChange = (e) => setFranchiseFilterState(e.detail?.franchiseId || getFranchiseFilter());
    window.addEventListener(FRANCHISE_FILTER_EVENT, onChange);
    return () => window.removeEventListener(FRANCHISE_FILTER_EVENT, onChange);
  }, []);

  // Smaller admin type: turns on the "admin-compact" text scale (see shared/styles/global.css)
  useEffect(() => {
    document.documentElement.classList.add("admin-compact")
    return () => document.documentElement.classList.remove("admin-compact")
  }, [])

  // Global Admin Real-Time Socket Connection
  useEffect(() => {
    const origin = resolveSocketOrigin();
    if (!origin) return;

    const token = getModuleToken("admin") || localStorage.getItem("admin_accessToken");
    const socket = io(origin, {
      auth: { token: token ? `Bearer ${token}` : undefined },
      query: { token: token || undefined },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      socket.emit("joinRoom", "admin");
    });

    socket.on("admin_notification", (payload) => {
      // Toast popup
      if (payload?.title && payload?.message) {
        toast.info(payload.title, {
          description: payload.message,
          duration: 6000,
        });
      }
      // Trigger notifications and badges update
      window.dispatchEvent(new Event("adminNotificationsUpdated"));
      window.dispatchEvent(new Event("sidebar_badges_update"));
    });

    socket.on("sidebar_badges_update", () => {
      window.dispatchEvent(new Event("sidebar_badges_update"));
      window.dispatchEvent(new Event("adminNotificationsUpdated"));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Get initial collapsed state from localStorage to set initial margin
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_sidebar_state')
      if (saved !== null) {
        const state = JSON.parse(saved)
        if (state && typeof state.isCollapsed !== 'undefined') {
          setIsSidebarCollapsed(state.isCollapsed)
        }
      }
    } catch (e) {
      debugError('Error loading sidebar collapsed state:', e)
    }

    // Refresh profile to keep permissions up to date
    adminAPI.getAdminProfile().then(res => {
      const admin = res.data?.data?.admin;
      if (admin) {
        localStorage.setItem('admin_user', JSON.stringify(admin));
        window.dispatchEvent(new Event('adminAuthChanged'));
      }
    }).catch(e => debugError('Failed to refresh admin profile:', e));
  }, [])

  const handleCollapseChange = (collapsed) => {
    setIsSidebarCollapsed(collapsed)
  }

  return (
    <div className="h-[100dvh] bg-neutral-200 flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-[60] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapseChange={handleCollapseChange}
      />

      {/* Main Content Area */}
      <div className={`
        flex-1 flex min-h-0 flex-col transition-all duration-300 ease-in-out min-w-0
        ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-80'}
      `}>
        {/* Top Navbar */}
        <AdminNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Backend disconnected banner */}
        {!API_BASE_URL && (
          <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm text-amber-900">
            Backend disconnected. Data is not live.
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-neutral-100">
          {showFranchiseFilter && <FranchiseFilterBar />}
          {/* Re-mount the page when the franchise filter changes so it refetches its data. */}
          <Outlet key={showFranchiseFilter ? franchiseFilter : "page"} />
        </main>
      </div>
    </div>
  );
}

