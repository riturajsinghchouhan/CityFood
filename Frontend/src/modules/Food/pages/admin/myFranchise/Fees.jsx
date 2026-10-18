import { useEffect, useState } from "react"
import { Plus, Save, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { franchiseAPI } from "@food/api"
import { apiErrorMessage } from "@food/pages/admin/franchise/franchiseUi"
import { PageHeader } from "./shared"

const FIELDS = [
  { key: "deliveryFee", label: "Delivery fee (₹)", hint: "Flat fee per order. Used when you have no distance slabs." },
  { key: "freeDeliveryUpTo", label: "Free delivery above (₹)", hint: "Orders with food total at or above this get free delivery." },
  { key: "platformFee", label: "Platform fee (₹)", hint: "Charged to the customer on every order." },
  { key: "packagingFee", label: "Packaging fee (₹)" },
  { key: "restaurantCommissionPercent", label: "Default restaurant commission (%)", hint: "For restaurants without their own commission. Set per restaurant on the Restaurants page." },
]

const toInput = (v) => (v === null || v === undefined ? "" : String(v))
const toValue = (v) => (String(v).trim() === "" ? null : Number(v))
const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function Pricing() {
  const [form, setForm] = useState(null)
  const [ranges, setRanges] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    franchiseAPI.getPricing()
      .then((res) => {
        const p = res?.data?.data?.pricing || {}
        setForm(Object.fromEntries(FIELDS.map((f) => [f.key, toInput(p[f.key])])))
        setRanges((p.deliveryFeeRanges || []).map((r) => ({ min: toInput(r.min), max: toInput(r.max), fee: toInput(r.fee) })))
      })
      .catch((error) => toast.error(apiErrorMessage(error, "Could not load your fees")))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    const slabs = ranges.filter((r) => r.min !== "" || r.max !== "" || r.fee !== "")
    if (slabs.some((r) => r.min === "" || r.max === "" || r.fee === "")) {
      toast.error("Fill from km, to km and fee for every distance slab, or remove it")
      return
    }
    try {
      setSaving(true)
      const body = Object.fromEntries(FIELDS.map((f) => [f.key, toValue(form[f.key])]))
      body.deliveryFeeRanges = slabs.map((r) => ({ min: Number(r.min), max: Number(r.max), fee: Number(r.fee) }))
      await franchiseAPI.updatePricing(body)
      toast.success("Saved. New orders in your zone use these fees.")
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save your fees"))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <p className="text-slate-500 p-6 text-center">Loading...</p>

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
    <form onSubmit={save} className="flex flex-col gap-4 max-w-3xl mx-auto">
      <PageHeader icon={Tag} title="Fees & commission" subtitle="Set the customer fees and restaurant commission for your zone. Leave a box empty to use the HQ value." />

      <section className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="min-w-0">
            <label htmlFor={`pr-${f.key}`} className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
            <input
              id={`pr-${f.key}`}
              className={inputClass}
              inputMode="decimal"
              placeholder="Use HQ value"
              value={form[f.key]}
              onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.]/g, "") }))}
            />
            {f.hint && <p className="text-xs text-slate-500 mt-1">{f.hint}</p>}
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Delivery fee by distance</h2>
          <p className="text-sm text-slate-500">Optional. When set, these slabs decide the delivery fee instead of the flat fee. The last slab covers everything beyond it.</p>
        </div>
        {ranges.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            {["min", "max", "fee"].map((k) => (
              <div key={k} className="min-w-0">
                <label htmlFor={`slab-${i}-${k}`} className="block text-xs text-slate-600 mb-1">{k === "min" ? "From km" : k === "max" ? "To km" : "Fee ₹"}</label>
                <input
                  id={`slab-${i}-${k}`}
                  className={inputClass}
                  inputMode="decimal"
                  value={r[k]}
                  onChange={(e) => setRanges((list) => list.map((x, j) => (j === i ? { ...x, [k]: e.target.value.replace(/[^\d.]/g, "") } : x)))}
                />
              </div>
            ))}
            <button type="button" onClick={() => setRanges((list) => list.filter((_, j) => j !== i))} className="p-2.5 text-slate-500 hover:text-red-600" title="Remove slab">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRanges((list) => [...list, { min: list.length ? list[list.length - 1].max : "0", max: "", fee: "" }])}
          className="self-start flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" /> Add slab
        </button>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save fees"}
        </button>
      </div>
    </form>
    </div>
  )
}
