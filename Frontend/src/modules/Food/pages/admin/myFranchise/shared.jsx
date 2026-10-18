import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { apiErrorMessage } from "@food/pages/admin/franchise/franchiseUi"

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function FilterChips({ options, value, onChange }) {
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

export function SearchBox({ id, value, onChange, placeholder }) {
  return (
    <div className="relative md:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export function RefreshButton({ loading, onClick }) {
  return (
    <button onClick={onClick} className="p-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50" title="Refresh">
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  )
}

export function Pager({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 text-sm mt-3">
      <span className="text-slate-600">Page {page} of {totalPages}</span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40" title="Previous page">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="p-1.5 border border-slate-300 rounded-lg disabled:opacity-40" title="Next page">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

export function Table({ columns, rows, empty, loading, renderRow }) {
  return (
    <div className="bg-white overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.right ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr>
          ) : rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  )
}

/** Paginated list: refetches when page, filter or (debounced) search change. */
export function usePagedList(fetcher, { filter = "all", search = "", pageSize = 20 } = {}) {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [debounced, setDebounced] = useState(search)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(1) }, [filter, debounced])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page, limit: pageSize }
      if (filter && filter !== "all") params.status = filter
      if (debounced) params.search = debounced
      const res = await fetcher(params)
      setRows(res?.data?.data?.data || [])
      setMeta(res?.data?.data?.meta || { total: 0, totalPages: 1 })
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load the list"))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fetcher, page, pageSize, filter, debounced])

  useEffect(() => { load() }, [load])
  return { rows, setRows, meta, page, setPage, loading, reload: load }
}

export const APPROVAL_BADGE = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
}
