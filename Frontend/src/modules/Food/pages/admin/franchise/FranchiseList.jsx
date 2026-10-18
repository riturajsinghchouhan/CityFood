import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, Plus, Search, Eye, Edit, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import {
  StatusBadge,
  StatTile,
  apiErrorMessage,
  formatCount,
  formatInr,
  revenueModelLabel,
} from "./franchiseUi"

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "grace", label: "Grace" },
  { key: "suspended", label: "Suspended" },
  { key: "terminated", label: "Terminated" },
]

export default function FranchiseList() {
  const navigate = useNavigate()
  const [franchises, setFranchises] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [ridersWithoutZone, setRidersWithoutZone] = useState(0)

  useEffect(() => {
    adminAPI.getRidersWithoutZone({ limit: 1 })
      .then((res) => setRidersWithoutZone(res?.data?.data?.meta?.total || 0))
      .catch(() => setRidersWithoutZone(0))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchFranchises = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getFranchises({
        status: status === "all" ? undefined : status,
        search: debouncedSearch || undefined,
      })
      setFranchises(res?.data?.data?.franchises || [])
      setSummary(res?.data?.data?.summary || null)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load franchises"))
      setFranchises([])
    } finally {
      setLoading(false)
    }
  }, [status, debouncedSearch])

  useEffect(() => {
    fetchFranchises()
  }, [fetchFranchises])

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manage Franchise</h1>
              <p className="text-sm text-slate-600">Each franchise runs one city zone. Track its restaurants, riders, orders and earnings.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFranchises}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => navigate("/admin/food/franchises/add")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>New Franchise</span>
            </button>
          </div>
        </div>

        {ridersWithoutZone > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 mb-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{formatCount(ridersWithoutZone)} delivery boy(s) have no zone. They are not counted in any franchise until you give them one.</span>
            <button onClick={() => navigate("/admin/food/franchises/riders-without-zone")} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 whitespace-nowrap">
              Assign zones
            </button>
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
            <StatTile label="Franchises" value={formatCount(summary.liveFranchises)} hint={`${formatCount(summary.totalFranchises)} total`} />
            <StatTile label="Restaurants" value={formatCount(summary.restaurants)} />
            <StatTile label="Delivery boys" value={formatCount(summary.deliveryPartners)} />
            <StatTile label="Orders running now" value={formatCount(summary.activeOrders)} tone="blue" />
            <StatTile label="Orders delivered" value={formatCount(summary.deliveredOrders)} />
            <StatTile label="Total sales" value={formatInr(summary.gmv)} hint="Delivered orders" />
            <StatTile label="Your commission" value={formatInr(summary.hqCommission)} tone="green" hint="From commission franchises" />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${status === tab.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="franchise-search"
              type="text"
              placeholder="Search name, code or owner phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading && franchises.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading franchises...</p>
          </div>
        ) : franchises.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No franchises found</h3>
            <p className="text-slate-600 mb-6">
              {search || status !== "all"
                ? "Try a different search or status."
                : "Give your first city franchise. Pick a zone, set commission or subscription, and it goes live."}
            </p>
            {!search && status === "all" && (
              <button
                onClick={() => navigate("/admin/food/franchises/add")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>New Franchise</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Franchise</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium text-right">Restaurants</th>
                  <th className="px-4 py-3 font-medium text-right">Delivery boys</th>
                  <th className="px-4 py-3 font-medium text-right">Running orders</th>
                  <th className="px-4 py-3 font-medium text-right">Delivered</th>
                  <th className="px-4 py-3 font-medium text-right">Sales</th>
                  <th className="px-4 py-3 font-medium text-right">Your earning</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {franchises.map((f) => {
                  const s = f.stats
                  return (
                    <tr
                      key={f._id}
                      onClick={() => navigate(`/admin/food/franchises/${f._id}`)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{f.name}</p>
                        <p className="text-xs text-slate-500">{f.code} · {f.zone?.name || "Zone removed"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-900">{f.owner?.name}</p>
                        <p className="text-xs text-slate-500">{f.owner?.phone}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{revenueModelLabel(f)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCount(s.restaurants.approved)}
                        <span className="text-slate-400"> / {formatCount(s.restaurants.total)}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCount(s.deliveryPartners.approved)}
                        <span className="text-slate-400"> · {formatCount(s.deliveryPartners.online)} online</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-blue-700">{formatCount(s.orders.active)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCount(s.orders.delivered)}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatInr(s.earnings.gmv)}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium text-green-700">
                        {f.revenueModel === "COMMISSION" ? formatInr(s.earnings.hqShare) : revenueModelLabel(f).replace("Subscription ", "")}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/food/franchises/${f._id}`) }}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {f.status !== "terminated" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/food/franchises/edit/${f._id}`) }}
                              className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
