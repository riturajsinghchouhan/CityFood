import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Building2, Edit, RefreshCw, Search, PauseCircle, PlayCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import FranchiseFinance from "./FranchiseFinance"
import {
  ActionDialog,
  ORDER_STATUS_LABELS,
  StatusBadge,
  StatTile,
  apiErrorMessage,
  formatCount,
  formatDate,
  formatDateTime,
  formatInr,
  revenueModelLabel,
} from "./franchiseUi"

const TABS = [
  { key: "money", label: "Money & payouts" },
  { key: "active-orders", label: "Running orders" },
  { key: "orders", label: "All orders" },
  { key: "restaurants", label: "Restaurants" },
  { key: "riders", label: "Delivery boys" },
]

const PAGE_SIZE = 20

const ORDER_FILTERS = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
]

const PEOPLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
]

const APPROVAL_BADGE = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 text-right break-all">{value || "—"}</span>
    </div>
  )
}

function Pill({ className, children }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>{children}</span>
}

function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-full text-sm border ${value === o.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Paginated list for one tab. Keyed by tab in the parent so filters reset when switching tabs. */
function FranchiseTabList({ franchiseId, tab }) {
  const navigate = useNavigate()
  const isOrders = tab === "orders" || tab === "active-orders"
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [filter, debouncedSearch])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page, limit: PAGE_SIZE }
      let res
      if (isOrders) {
        params.status = tab === "active-orders" ? "active" : filter
        res = await adminAPI.getFranchiseOrders(franchiseId, params)
      } else {
        if (filter !== "all") params.status = filter
        if (debouncedSearch) params.search = debouncedSearch
        res = tab === "restaurants"
          ? await adminAPI.getFranchiseRestaurants(franchiseId, params)
          : await adminAPI.getFranchiseDeliveryPartners(franchiseId, params)
      }
      setRows(res?.data?.data?.data || [])
      setMeta(res?.data?.data?.meta || { total: 0, totalPages: 1 })
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load the list"))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [franchiseId, tab, isOrders, filter, debouncedSearch, page])

  useEffect(() => { load() }, [load])

  const emptyText = {
    "active-orders": "No orders are running right now.",
    orders: "No orders yet. Orders placed after the franchise started will show here.",
    restaurants: "No restaurants in this zone yet.",
    riders: "No delivery boys in this zone yet. New riders pick their zone at sign-up.",
  }[tab]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {tab === "active-orders" ? (
          <p className="text-sm text-slate-600">{formatCount(meta.total)} order(s) in progress</p>
        ) : (
          <FilterChips options={isOrders ? ORDER_FILTERS : PEOPLE_FILTERS} value={filter} onChange={setFilter} />
        )}
        <div className="flex items-center gap-2">
          {!isOrders && (
            <div className="relative md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id={`franchise-${tab}-search`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "restaurants" ? "Search restaurant or owner" : "Search name, phone or vehicle"}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <button onClick={load} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50" title="Refresh list">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            {isOrders ? (
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Restaurant</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Rider</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Placed</th>
              </tr>
            ) : tab === "restaurants" ? (
              <tr>
                <th className="px-4 py-2.5 font-medium">Restaurant</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Area</th>
                <th className="px-4 py-2.5 font-medium">Approval</th>
                <th className="px-4 py-2.5 font-medium">Taking orders</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-2.5 font-medium">Delivery boy</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Vehicle</th>
                <th className="px-4 py-2.5 font-medium">Approval</th>
                <th className="px-4 py-2.5 font-medium">Online</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{emptyText}</td></tr>
            ) : isOrders ? (
              rows.map((o) => (
                <tr key={o._id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">#{o.order_id || String(o._id).slice(-6)}</td>
                  <td className="px-4 py-2.5">{o.restaurantId?.restaurantName || "—"}</td>
                  <td className="px-4 py-2.5">{o.customerName || "—"}</td>
                  <td className="px-4 py-2.5">{o.dispatch?.deliveryPartnerId?.name || <span className="text-slate-400">Not assigned</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatInr(o.pricing?.total)}</td>
                  <td className="px-4 py-2.5 uppercase text-xs">{o.payment?.method || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))
            ) : tab === "restaurants" ? (
              rows.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/food/restaurants/edit/${r._id}`)}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.restaurantName || "—"}</td>
                  <td className="px-4 py-2.5">
                    <p>{r.ownerName || "—"}</p>
                    <p className="text-xs text-slate-500">{r.ownerPhone}</p>
                  </td>
                  <td className="px-4 py-2.5">{[r.location?.area, r.location?.city].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5"><Pill className={APPROVAL_BADGE[r.status] || "bg-slate-100 text-slate-700"}>{r.status}</Pill></td>
                  <td className="px-4 py-2.5">{r.status === "approved" ? (r.isAcceptingOrders === false ? "Closed" : "Open") : "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDate(r.createdAt)}</td>
                </tr>
              ))
            ) : (
              rows.map((d) => (
                <tr key={d._id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{d.name || "—"}</td>
                  <td className="px-4 py-2.5">{d.phone || "—"}</td>
                  <td className="px-4 py-2.5 capitalize">{[d.vehicleType, d.vehicleNumber].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2.5"><Pill className={APPROVAL_BADGE[d.status] || "bg-slate-100 text-slate-700"}>{d.status}</Pill></td>
                  <td className="px-4 py-2.5">
                    {d.availabilityStatus === "online"
                      ? <Pill className="bg-green-100 text-green-800">Online</Pill>
                      : <span className="text-slate-500">Offline</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDate(d.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-slate-600">Page {page} of {meta.totalPages}</span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40" title="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40" title="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function FranchiseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [franchise, setFranchise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [tab, setTab] = useState("active-orders")
  const [loginDialog, setLoginDialog] = useState(false)

  const fetchFranchise = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getFranchiseById(id)
      setFranchise(res?.data?.data?.franchise || null)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load franchise"))
      setFranchise(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchFranchise() }, [fetchFranchise])

  const changeStatus = async (status, confirmText) => {
    if (!window.confirm(confirmText)) return
    try {
      setUpdating(true)
      const res = await adminAPI.updateFranchiseStatus(id, status)
      setFranchise(res?.data?.data?.franchise || franchise)
      toast.success("Status updated")
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not update status"))
    } finally {
      setUpdating(false)
    }
  }

  if (loading && !franchise) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center max-w-7xl mx-auto">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading franchise...</p>
        </div>
      </div>
    )
  }

  if (!franchise) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center max-w-7xl mx-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Franchise not found</h3>
          <button onClick={() => navigate("/admin/food/franchises")} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg">Back to franchises</button>
        </div>
      </div>
    )
  }

  const { stats } = franchise
  const isCommission = franchise.revenueModel === "COMMISSION"
  const live = franchise.status !== "terminated"

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/admin/food/franchises")} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200" title="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{franchise.name}</h1>
                <StatusBadge status={franchise.status} />
              </div>
              <p className="text-sm text-slate-600">
                {franchise.code} · Zone: {franchise.zone?.name || "removed"} · Since {formatDate(franchise.startDate)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={fetchFranchise} className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            {live && (
              <button onClick={() => navigate(`/admin/food/franchises/edit/${id}`)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            {(franchise.status === "active" || franchise.status === "grace") && (
              <button
                disabled={updating}
                onClick={() => changeStatus("suspended", "Suspend this franchise? Customers will not be able to place new orders in this zone. Running orders will finish normally.")}
                className="flex items-center gap-2 px-3 py-2 border border-amber-300 text-amber-800 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-60"
              >
                <PauseCircle className="w-4 h-4" />
                <span>Suspend</span>
              </button>
            )}
            {(franchise.status === "suspended" || franchise.status === "grace") && (
              <button
                disabled={updating}
                onClick={() => changeStatus("active", "Activate this franchise? New orders will start again in this zone.")}
                className="flex items-center gap-2 px-3 py-2 border border-green-300 text-green-800 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-60"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Activate</span>
              </button>
            )}
            {live && (
              <button
                disabled={updating}
                onClick={() => changeStatus("terminated", "Terminate this franchise? This is permanent. The zone goes back to HQ and can be given to a new franchise.")}
                className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 bg-white rounded-lg hover:bg-red-50 disabled:opacity-60"
              >
                <XCircle className="w-4 h-4" />
                <span>Terminate</span>
              </button>
            )}
          </div>
        </div>

        {franchise.status === "suspended" && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            Suspended{franchise.statusReason ? `: ${franchise.statusReason}` : ""}. New orders in {franchise.zone?.name || "this zone"} are blocked.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Restaurants" value={formatCount(stats.restaurants.total)} hint={`${formatCount(stats.restaurants.approved)} approved · ${formatCount(stats.restaurants.pending)} pending · ${formatCount(stats.restaurants.acceptingOrders)} open`} />
          <StatTile label="Delivery boys" value={formatCount(stats.deliveryPartners.total)} hint={`${formatCount(stats.deliveryPartners.approved)} approved · ${formatCount(stats.deliveryPartners.pending)} pending · ${formatCount(stats.deliveryPartners.online)} online now`} />
          <StatTile label="Orders running now" value={formatCount(stats.orders.active)} tone="blue" hint={`${formatCount(stats.orders.today)} placed today`} />
          <StatTile label="Orders delivered" value={formatCount(stats.orders.delivered)} hint={`${formatCount(stats.orders.todayDelivered)} today · ${formatCount(stats.orders.monthDelivered)} this month · ${formatCount(stats.orders.cancelled)} cancelled`} />
          <StatTile label="Total sales" value={formatInr(stats.earnings.gmv)} hint={`${formatInr(stats.earnings.month.gmv)} this month`} />
          <StatTile label="Franchise earning" value={formatInr(stats.earnings.franchiseGross)} hint={`${formatInr(stats.earnings.month.franchiseGross)} this month · ${formatInr(stats.earnings.today.franchiseGross)} today`} />
          <StatTile
            label="Your earning"
            tone="green"
            value={isCommission ? formatInr(stats.earnings.hqShare) : revenueModelLabel(franchise).replace("Subscription ", "")}
            hint={isCommission
              ? `${formatInr(stats.earnings.month.hqShare)} this month · ${formatInr(stats.earnings.today.hqShare)} today`
              : `Subscription · ${formatInr(stats.earnings.hqShare)} commission from older orders`}
          />
          <StatTile label="Franchise keeps" value={formatInr(stats.earnings.franchiseNet)} hint="Franchise earning minus your commission" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Owner</h2>
            <InfoRow label="Name" value={franchise.owner?.name} />
            <InfoRow label="Phone" value={franchise.owner?.phone} />
            <InfoRow label="Email" value={franchise.owner?.email} />
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-sm min-w-0">
                <p className="font-medium text-slate-900">Franchise panel login</p>
                <p className="text-slate-500">
                  {franchise.ownerLogin?.exists
                    ? franchise.ownerLogin.isActive
                      ? `Active · last login ${franchise.ownerLogin.lastLoginAt ? formatDateTime(franchise.ownerLogin.lastLoginAt) : "never"}`
                      : "Disabled"
                    : "Not set up yet"}
                </p>
              </div>
              {live && (
                <button onClick={() => setLoginDialog(true)} className="shrink-0 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  {franchise.ownerLogin?.exists ? "Reset password" : "Set password"}
                </button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Earning model</h2>
            <InfoRow label="Model" value={revenueModelLabel(franchise)} />
            {!isCommission && (
              <>
                <InfoRow label="Plan" value={franchise.subscription?.plan === "YEARLY" ? "Yearly" : "Monthly"} />
                <InfoRow label="Period" value={`${formatDate(franchise.subscription?.startDate)} – ${formatDate(franchise.subscription?.endDate)}`} />
              </>
            )}
            <InfoRow label="Started" value={formatDate(franchise.startDate)} />
            <InfoRow label="Credit limit" value={formatInr(franchise.finance?.creditLimit ?? 10000)} />
            <InfoRow label="Pay restaurants/riders within" value={`${franchise.finance?.payoutSlaDays ?? 3} days`} />
            <InfoRow
              label="Franchise fees"
              value={[
                franchise.pricing?.deliveryFee != null ? `Delivery ${formatInr(franchise.pricing.deliveryFee)}` : null,
                franchise.pricing?.platformFee != null ? `Platform ${formatInr(franchise.pricing.platformFee)}` : null,
                franchise.pricing?.restaurantCommissionPercent != null ? `Restaurant commission ${franchise.pricing.restaurantCommissionPercent}%` : null,
              ].filter(Boolean).join(" · ") || "Same as HQ"}
            />
            {franchise.notes && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{franchise.notes}</p>}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">KYC & bank</h2>
            <InfoRow label="Firm" value={franchise.business?.legalName} />
            <InfoRow label="GST" value={franchise.business?.gstNumber} />
            <InfoRow label="PAN" value={franchise.business?.panNumber} />
            <InfoRow label="Account" value={franchise.bank?.accountNumber ? `${franchise.bank.accountNumber} · ${franchise.bank.ifscCode || ""}` : ""} />
            <InfoRow label="UPI" value={franchise.bank?.upiId} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="flex gap-1 border-b border-slate-200 px-3 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {tab === "money"
              ? <FranchiseFinance franchiseId={id} onChanged={fetchFranchise} />
              : <FranchiseTabList key={tab} franchiseId={id} tab={tab} />}
          </div>
        </div>
      </div>

      <ActionDialog
        open={loginDialog}
        title={franchise.ownerLogin?.exists ? "Reset franchise panel password" : "Set franchise panel password"}
        description={`The owner logs in at /franchise/login with phone ${franchise.owner?.phone} and this password. Share it with them privately.`}
        fields={[{ name: "password", label: "New password", required: true, placeholder: "At least 8 characters" }]}
        confirmLabel="Save password"
        onClose={() => setLoginDialog(false)}
        onConfirm={async ({ password }) => {
          const res = await adminAPI.setFranchiseOwnerLogin(id, password)
          setFranchise(res?.data?.data?.franchise || franchise)
          setLoginDialog(false)
          toast.success("Password saved")
        }}
      />
    </div>
  )
}
