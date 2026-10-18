import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Bike, Search } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import { Pill, apiErrorMessage, formatDate } from "./franchiseUi"

/**
 * Delivery boys who registered before the app asked for a zone. Until they get one they are HQ riders
 * and are not counted in, or dispatched for, any franchise.
 */
export default function RidersWithoutZone() {
  const navigate = useNavigate()
  const [riders, setRiders] = useState([])
  const [zones, setZones] = useState([])
  const [choice, setChoice] = useState({})
  const [savingId, setSavingId] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getRidersWithoutZone({ limit: 200, search: search.trim() || undefined })
      setRiders(res?.data?.data?.data || [])
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load delivery boys"))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    adminAPI.getZones().then((res) => setZones(res?.data?.data?.zones || [])).catch(() => setZones([]))
  }, [])

  const save = async (rider) => {
    const zoneId = choice[rider._id]
    if (!zoneId) {
      toast.error("Pick a zone first")
      return
    }
    try {
      setSavingId(rider._id)
      const res = await adminAPI.setRiderZone(rider._id, zoneId)
      toast.success(`${rider.name} moved to ${res?.data?.data?.rider?.zoneName || "the zone"}`)
      setRiders((list) => list.filter((r) => r._id !== rider._id))
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not set the zone"))
    } finally {
      setSavingId("")
    }
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-5xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/food/franchises")} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200" title="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Delivery boys without a zone</h1>
            <p className="text-sm text-slate-600">They joined before zones were asked at sign-up. Give each one a zone so the right franchise manages them.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="riders-without-zone-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or city"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Delivery boy</th>
                <th className="px-4 py-2.5 font-medium">City (from sign-up)</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Zone</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && riders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : riders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Every delivery boy has a zone.</td></tr>
              ) : riders.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.phone}</p>
                  </td>
                  <td className="px-4 py-2.5">{r.city || "—"}</td>
                  <td className="px-4 py-2.5"><Pill>{r.status}</Pill></td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <select
                      id={`zone-${r._id}`}
                      value={choice[r._id] || ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [r._id]: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Select zone</option>
                      {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      disabled={savingId === r._id}
                      onClick={() => save(r)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingId === r._id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
