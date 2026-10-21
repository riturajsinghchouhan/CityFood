import { useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { adminAPI } from "@/services/api/index.js"
import { ALL_FRANCHISES, getFranchiseFilter, setFranchiseFilter } from "@food/utils/franchiseFilter"

/**
 * "Filter by franchise" bar shown by AdminLayout above HQ's order, food, restaurant, deliveryman,
 * report and transaction pages. Changing it re-mounts the page so it refetches with the filter.
 */
export default function FranchiseFilterBar() {
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState(getFranchiseFilter)

  useEffect(() => {
    let cancelled = false
    adminAPI.getFranchiseOptions()
      .then((res) => {
        if (cancelled) return
        const list = res?.data?.data?.franchises || []
        setFranchises(list)
        // A deleted franchise left in storage would hide everything; fall back to All (except for 'own' and 'all_franchises').
        const current = getFranchiseFilter()
        if (current !== ALL_FRANCHISES && current !== "own" && current !== "all_franchises" && !list.some((f) => f.id === current)) {
          setValue(ALL_FRANCHISES)
          setFranchiseFilter(ALL_FRANCHISES)
        }
      })
      .catch(() => {
        if (!cancelled) setFranchises([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleChange = (e) => {
    setValue(e.target.value)
    setFranchiseFilter(e.target.value)
  }

  const selected = franchises.find((f) => f.id === value)

  return (
    <div className="px-4 lg:px-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 shrink-0">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Franchise</span>
        </div>
        <select
          value={value}
          onChange={handleChange}
          disabled={loading}
          className="w-full sm:w-72 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
        >
          <option value={ALL_FRANCHISES}>{loading ? "Loading..." : "All (Franchise + Own)"}</option>
          <option value="all_franchises">All Franchises (Only Franchise)</option>
          <option value="own">Own (Without Franchise)</option>
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}{f.zoneName ? ` (${f.zoneName})` : ""}{f.status && f.status !== "active" ? ` - ${f.status}` : ""}
            </option>
          ))}
        </select>
        {value === "all_franchises" && (
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-700">Franchise-only</strong> data
          </span>
        )}
        {value === "own" && (
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-700">Own (Direct Admin / Non-Franchise)</strong> data only
          </span>
        )}
        {selected && (
          <span className="text-xs text-slate-500">
            Showing data of zone <strong className="text-slate-700">{selected.zoneName || "-"}</strong> only
          </span>
        )}
      </div>
    </div>
  )
}
