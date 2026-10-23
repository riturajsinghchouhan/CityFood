import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageCircle, Phone, Search, StickyNote, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"

/** Admin > Manage Inquiry: forms sent from the franchise / restaurant / delivery landing pages. */
const TITLES = {
  restaurant: { title: "Restaurant Inquiries", page: "/res/landingpage" },
  delivery: { title: "Delivery Inquiries", page: "/deli/landingpage" },
  franchise: { title: "Franchise Inquiries", page: "/franchise/landingpage" },
}

const STATUSES = [
  { value: "new", label: "New", className: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "Contacted", className: "bg-amber-100 text-amber-800" },
  { value: "closed", label: "Closed", className: "bg-slate-200 text-slate-700" },
]
const statusOf = (value) => STATUSES.find((s) => s.value === value) || STATUSES[0]

const formatDate = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"

export default function PartnerInquiries({ type = "restaurant" }) {
  const meta = TITLES[type] || TITLES.restaurant
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ new: 0, contacted: 0, closed: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getInquiries({ type, status: status === "all" ? undefined : status, search: query || undefined, page, limit })
      const data = res?.data?.data || {}
      setRows(data.inquiries || [])
      setTotal(data.total || 0)
      setCounts(data.counts || { new: 0, contacted: 0, closed: 0 })
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load inquiries")
    } finally {
      setLoading(false)
    }
  }, [type, status, query, page])

  useEffect(() => {
    load()
  }, [load])

  // Search after the admin stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQuery(search.trim())
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const update = async (row, body, message) => {
    setSavingId(row._id)
    try {
      const res = await adminAPI.updateInquiry(row._id, body)
      const updated = res?.data?.data?.inquiry
      setRows((list) => list.map((r) => (r._id === row._id ? { ...r, ...updated } : r)))
      if (body.status && body.status !== row.status) {
        setCounts((c) => ({ ...c, [row.status]: Math.max(0, (c[row.status] || 0) - 1), [body.status]: (c[body.status] || 0) + 1 }))
      }
      toast.success(message)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not update the inquiry")
    } finally {
      setSavingId(null)
    }
  }

  const editNote = (row) => {
    const note = window.prompt(`Note for ${row.fullName}`, row.adminNote || "")
    if (note === null) return
    update(row, { adminNote: note }, "Note saved")
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete the inquiry from ${row.fullName}?`)) return
    setSavingId(row._id)
    try {
      await adminAPI.deleteInquiry(row._id)
      toast.success("Inquiry deleted")
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete the inquiry")
    } finally {
      setSavingId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit))
  const allCount = counts.new + counts.contacted + counts.closed

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">{meta.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            People who filled the form on{" "}
            <a href={meta.page} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
              {meta.page}
            </a>
            . Call them and mark the inquiry as contacted.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All", count: allCount }, ...STATUSES.map((s) => ({ ...s, count: counts[s.value] || 0 }))].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStatus(s.value)
                setPage(1)
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                status === s.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {s.label} <span className="ml-1 opacity-70">{s.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={type === "delivery" ? "Search name, mobile, city" : "Search name, mobile, city, restaurant"}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">{type === "delivery" ? "Vehicle" : "Restaurant Name"}</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No inquiries {status !== "all" ? `marked ${statusOf(status).label.toLowerCase()}` : "yet"}.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row._id} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{(page - 1) * limit + i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{row.fullName}</p>
                      {row.adminNote ? (
                        <p className="mt-1 max-w-[220px] text-xs text-slate-500" title={row.adminNote}>
                          <StickyNote className="mr-1 inline h-3 w-3" />
                          {row.adminNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.phone}</td>
                    <td className="px-4 py-3 text-slate-700">{row.city}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{(type === "delivery" ? row.vehicleType : row.restaurantName) || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        disabled={savingId === row._id}
                        onChange={(e) => update(row, { status: e.target.value }, `Marked as ${statusOf(e.target.value).label.toLowerCase()}`)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${statusOf(row.status).className}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <a href={`tel:+91${row.phone}`} title="Call" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
                          <Phone className="h-4 w-4" />
                        </a>
                        <a href={`https://wa.me/91${row.phone}`} target="_blank" rel="noreferrer" title="WhatsApp" className="rounded-lg border border-slate-200 p-2 text-green-600 hover:bg-green-50">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <button type="button" onClick={() => editNote(row)} title="Add note" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
                          <StickyNote className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => remove(row)} disabled={savingId === row._id} title="Delete" className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Page {page} of {pages} · {total} inquiries
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
