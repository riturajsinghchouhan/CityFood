import { useEffect, useState } from "react"
import { KeyRound, Settings as SettingsIcon } from "lucide-react"
import { toast } from "sonner"
import { franchiseAPI } from "@food/api"
import { apiErrorMessage, revenueModelLabel } from "@food/pages/admin/franchise/franchiseUi"
import { PageHeader } from "./shared"

const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

/** Franchise owner: franchise details from HQ and password change. */
export default function FranchiseSettings() {
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ current: "", next: "", confirm: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    franchiseAPI.me().then((res) => setMe(res?.data?.data?.user || null)).catch(() => setMe(null))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (form.next.length < 8) return toast.error("New password must be at least 8 characters")
    if (form.next !== form.confirm) return toast.error("The new passwords do not match")
    try {
      setSaving(true)
      await franchiseAPI.changePassword(form.current, form.next)
      setForm({ current: "", next: "", confirm: "" })
      toast.success("Password changed")
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not change the password"))
    } finally {
      setSaving(false)
    }
    return undefined
  }

  const f = me?.franchise
  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-3xl flex flex-col gap-4">
        <PageHeader icon={SettingsIcon} title="Franchise Settings" />
        <section className="bg-white border border-slate-200 rounded-lg p-5 text-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><p className="text-slate-500">Franchise</p><p className="font-medium text-slate-900">{f?.name || "—"}</p></div>
          <div><p className="text-slate-500">Code</p><p className="font-medium text-slate-900">{f?.code || "—"}</p></div>
          <div><p className="text-slate-500">Zone</p><p className="font-medium text-slate-900">{f?.zoneId?.name || "—"}</p></div>
          <div><p className="text-slate-500">HQ terms</p><p className="font-medium text-slate-900">{f ? revenueModelLabel(f) : "—"}</p></div>
          <div><p className="text-slate-500">Login phone</p><p className="font-medium text-slate-900">{me?.phone || "—"}</p></div>
          <div><p className="text-slate-500">Login email</p><p className="font-medium text-slate-900">{me?.email || "—"}</p></div>
          <p className="sm:col-span-2 text-slate-500">To change your zone, owner details or HQ terms, contact HQ.</p>
        </section>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Change password</h2>
          {[
            { k: "current", label: "Current password", auto: "current-password" },
            { k: "next", label: "New password", auto: "new-password" },
            { k: "confirm", label: "Repeat new password", auto: "new-password" },
          ].map((field) => (
            <div key={field.k}>
              <label htmlFor={`pw-${field.k}`} className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
              <input id={`pw-${field.k}`} type="password" autoComplete={field.auto} className={inputClass} value={form[field.k]} onChange={(e) => setForm((v) => ({ ...v, [field.k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" disabled={saving} className="self-end px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  )
}
