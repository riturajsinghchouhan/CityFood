import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Building2, Save } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import { apiErrorMessage, formatInr } from "./franchiseUi"

const EMPTY_FORM = {
  name: "",
  zoneId: "",
  owner: { name: "", phone: "", email: "" },
  revenueModel: "COMMISSION",
  commissionPercent: "",
  subscription: { plan: "MONTHLY", amount: "", startDate: "", endDate: "" },
  business: { legalName: "", gstNumber: "", panNumber: "", address: "" },
  bank: { accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "" },
  finance: { creditLimit: "10000", payoutSlaDays: "3", holdbackDays: "7", graceDays: "7" },
  ownerPassword: "",
  notes: "",
}

const toDateInput = (value) => {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

const fromFranchise = (f) => ({
  name: f.name || "",
  zoneId: f.zoneId || "",
  owner: { name: f.owner?.name || "", phone: f.owner?.phone || "", email: f.owner?.email || "" },
  revenueModel: f.revenueModel || "COMMISSION",
  commissionPercent: f.revenueModel === "COMMISSION" ? String(f.commissionPercent ?? "") : "",
  subscription: {
    plan: f.subscription?.plan || "MONTHLY",
    amount: f.subscription?.amount ? String(f.subscription.amount) : "",
    startDate: toDateInput(f.subscription?.startDate),
    endDate: toDateInput(f.subscription?.endDate),
  },
  business: { ...EMPTY_FORM.business, ...(f.business || {}) },
  bank: { ...EMPTY_FORM.bank, ...(f.bank || {}) },
  finance: Object.fromEntries(
    Object.entries(EMPTY_FORM.finance).map(([k, v]) => [k, f.finance?.[k] !== undefined && f.finance?.[k] !== null ? String(f.finance[k]) : v])
  ),
  ownerPassword: "",
  notes: f.notes || "",
})

const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

function Field({ id, label, required, hint, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{children}</div>
    </section>
  )
}

export default function FranchiseForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [originalZoneId, setOriginalZoneId] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const [zonesRes, franchiseRes] = await Promise.all([
          adminAPI.getFranchiseAvailableZones(id),
          isEdit ? adminAPI.getFranchiseById(id) : Promise.resolve(null),
        ])
        if (cancelled) return
        setZones(zonesRes?.data?.data?.zones || [])
        const franchise = franchiseRes?.data?.data?.franchise
        if (franchise) {
          if (franchise.status === "terminated") {
            toast.error("A terminated franchise cannot be edited")
            navigate(`/admin/food/franchises/${id}`, { replace: true })
            return
          }
          setForm(fromFranchise(franchise))
          setOriginalZoneId(franchise.zoneId || "")
        }
      } catch (error) {
        if (!cancelled) toast.error(apiErrorMessage(error, "Could not load franchise details"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const setNested = (group, key, value) =>
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }))

  const selectedZone = useMemo(() => zones.find((z) => z._id === form.zoneId), [zones, form.zoneId])

  // Suggest "CityFood <Zone>" as the name until the admin types one.
  const handleZoneChange = (zoneId) => {
    const zone = zones.find((z) => z._id === zoneId)
    setForm((prev) => {
      const prevZone = zones.find((z) => z._id === prev.zoneId)
      const autoName = !prev.name || (prevZone && prev.name === `CityFood ${prevZone.name}`)
      return { ...prev, zoneId, name: autoName && zone ? `CityFood ${zone.name}` : prev.name }
    })
  }

  const validate = () => {
    if (!form.zoneId) return "Please select a zone"
    if (form.name.trim().length < 2) return "Franchise name is required"
    if (!form.owner.name.trim()) return "Owner name is required"
    if (!/^\d{10}$/.test(form.owner.phone)) return "Owner phone must be 10 digits"
    if (form.revenueModel === "COMMISSION") {
      const pct = Number(form.commissionPercent)
      if (!(pct > 0) || pct > 100) return "Commission % must be between 1 and 100"
    } else if (!(Number(form.subscription.amount) > 0)) {
      return "Subscription amount is required"
    }
    if (!isEdit && form.ownerPassword && form.ownerPassword.length < 8) return "Owner password must be at least 8 characters"
    if (!(Number(form.finance.payoutSlaDays) >= 1)) return "Payout time must be at least 1 day"
    return ""
  }

  const buildPayload = () => {
    const trimGroup = (group) =>
      Object.fromEntries(Object.entries(group).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]))
    const payload = {
      name: form.name.trim(),
      zoneId: form.zoneId,
      owner: trimGroup(form.owner),
      revenueModel: form.revenueModel,
      business: trimGroup(form.business),
      bank: trimGroup(form.bank),
      finance: Object.fromEntries(Object.entries(form.finance).map(([k, v]) => [k, Number(v) || 0])),
      notes: form.notes.trim(),
    }
    if (!isEdit && form.ownerPassword) payload.ownerPassword = form.ownerPassword
    if (form.revenueModel === "COMMISSION") {
      payload.commissionPercent = Number(form.commissionPercent)
    } else {
      payload.subscription = {
        plan: form.subscription.plan,
        amount: Number(form.subscription.amount),
        startDate: form.subscription.startDate || null,
        endDate: form.subscription.endDate || null,
      }
    }
    return payload
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      toast.error(problem)
      return
    }
    if (isEdit && originalZoneId && form.zoneId !== originalZoneId) {
      const ok = window.confirm(
        "Changing the zone moves this franchise to a new city. Restaurants and delivery boys will be counted from the new zone. Past orders stay with this franchise. Continue?"
      )
      if (!ok) return
    }
    try {
      setSaving(true)
      const payload = buildPayload()
      const res = isEdit
        ? await adminAPI.updateFranchise(id, payload)
        : await adminAPI.createFranchise(payload)
      const saved = res?.data?.data?.franchise
      toast.success(isEdit ? "Franchise updated" : "Franchise created")
      navigate(`/admin/food/franchises/${saved?._id || id}`)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save the franchise"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center max-w-4xl mx-auto">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  const noZonesLeft = !isEdit && zones.length === 0

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <form onSubmit={handleSubmit} className="w-full mx-auto max-w-4xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/admin/food/franchises/${id}` : "/admin/food/franchises")}
            className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit Franchise" : "New Franchise"}</h1>
            <p className="text-sm text-slate-600">One franchise runs one city zone.</p>
          </div>
        </div>

        {noZonesLeft && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
            Every zone already has a franchise. Create a new zone in Zone Setup first.
          </div>
        )}

        <Section title="City & name" description="Only zones without a franchise are listed.">
          <Field id="fr-zone" label="Zone (city)" required hint={selectedZone && selectedZone.isActive === false ? "This zone is inactive. Customers cannot order there until it is activated." : undefined}>
            <select id="fr-zone" className={inputClass} value={form.zoneId} onChange={(e) => handleZoneChange(e.target.value)}>
              <option value="">Select zone</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}{z.isActive === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field id="fr-name" label="Franchise name" required>
            <input id="fr-name" className={inputClass} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="CityFood Indore" />
          </Field>
        </Section>

        <Section title="Franchise owner" description="The person who runs this city.">
          <Field id="fr-owner-name" label="Owner name" required>
            <input id="fr-owner-name" className={inputClass} value={form.owner.name} onChange={(e) => setNested("owner", "name", e.target.value)} />
          </Field>
          <Field id="fr-owner-phone" label="Owner phone" required>
            <input
              id="fr-owner-phone"
              className={inputClass}
              inputMode="numeric"
              maxLength={10}
              value={form.owner.phone}
              onChange={(e) => setNested("owner", "phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digit mobile"
            />
          </Field>
          <Field id="fr-owner-email" label="Owner email">
            <input id="fr-owner-email" type="email" className={inputClass} value={form.owner.email} onChange={(e) => setNested("owner", "email", e.target.value.trim())} />
          </Field>
          {!isEdit && (
            <Field id="fr-owner-password" label="Franchise panel password" hint="The owner logs in at /franchise/login with the phone above and this password. You can also set it later.">
              <input id="fr-owner-password" type="text" autoComplete="new-password" className={inputClass} value={form.ownerPassword} onChange={(e) => setField("ownerPassword", e.target.value)} placeholder="At least 8 characters" />
            </Field>
          )}
        </Section>

        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900">How you earn from this franchise</h2>
          <p className="text-sm text-slate-500 mt-0.5">Changes apply to new orders only. Past orders keep the terms they were placed with.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {[
              { key: "COMMISSION", title: "Commission", text: "You get a % of the franchise's earning on every delivered order." },
              { key: "SUBSCRIPTION", title: "Subscription", text: "The franchise pays you a fixed monthly or yearly fee." },
            ].map((opt) => (
              <label
                key={opt.key}
                className={`flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.revenueModel === opt.key ? "border-blue-600 bg-blue-50" : "border-slate-300 hover:border-slate-400"}`}
              >
                <input
                  type="radio"
                  name="revenueModel"
                  value={opt.key}
                  checked={form.revenueModel === opt.key}
                  onChange={() => setField("revenueModel", opt.key)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-slate-900">{opt.title}</span>
                  <span className="block text-sm text-slate-600">{opt.text}</span>
                </span>
              </label>
            ))}
          </div>

          {form.revenueModel === "COMMISSION" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field
                id="fr-commission"
                label="Your commission %"
                required
                hint={Number(form.commissionPercent) > 0
                  ? `Example: if the franchise earns ${formatInr(104)} on an order, you get ${formatInr((104 * Number(form.commissionPercent)) / 100)}.`
                  : "Franchise earning = delivery fee + platform fee + restaurant commission − rider pay."}
              >
                <input
                  id="fr-commission"
                  className={inputClass}
                  inputMode="decimal"
                  value={form.commissionPercent}
                  onChange={(e) => setField("commissionPercent", e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="e.g. 20"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field id="fr-plan" label="Plan" required>
                <select id="fr-plan" className={inputClass} value={form.subscription.plan} onChange={(e) => setNested("subscription", "plan", e.target.value)}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </Field>
              <Field id="fr-amount" label={`Fee per ${form.subscription.plan === "YEARLY" ? "year" : "month"} (₹)`} required>
                <input
                  id="fr-amount"
                  className={inputClass}
                  inputMode="decimal"
                  value={form.subscription.amount}
                  onChange={(e) => setNested("subscription", "amount", e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="e.g. 15000"
                />
              </Field>
              <Field id="fr-sub-start" label="Current period start">
                <input id="fr-sub-start" type="date" className={inputClass} value={form.subscription.startDate} onChange={(e) => setNested("subscription", "startDate", e.target.value)} />
              </Field>
              <Field id="fr-sub-end" label="Current period end" hint="Used for renewal reminders.">
                <input id="fr-sub-end" type="date" className={inputClass} value={form.subscription.endDate} onChange={(e) => setNested("subscription", "endDate", e.target.value)} />
              </Field>
            </div>
          )}
        </section>

        <Section title="Money rules" description="How payouts, settlements and dues work for this franchise.">
          <Field id="fr-credit" label="Credit limit (₹)" hint="If the franchise owes you more than this, it gets a grace period, then is suspended.">
            <input id="fr-credit" className={inputClass} inputMode="decimal" value={form.finance.creditLimit} onChange={(e) => setNested("finance", "creditLimit", e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field id="fr-grace" label="Grace days" hint="Days to clear dues before new orders stop.">
            <input id="fr-grace" className={inputClass} inputMode="numeric" value={form.finance.graceDays} onChange={(e) => setNested("finance", "graceDays", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="fr-sla" label="Days to pay restaurants & riders" hint="After this, you are alerted and can pay them directly.">
            <input id="fr-sla" className={inputClass} inputMode="numeric" value={form.finance.payoutSlaDays} onChange={(e) => setNested("finance", "payoutSlaDays", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="fr-holdback" label="Settlement holdback (days)" hint="Orders are settled this many days after delivery, so refunds land first.">
            <input id="fr-holdback" className={inputClass} inputMode="numeric" value={form.finance.holdbackDays} onChange={(e) => setNested("finance", "holdbackDays", e.target.value.replace(/\D/g, ""))} />
          </Field>
        </Section>

        <Section title="Business details (KYC)" description="Optional now, needed before payouts.">
          <Field id="fr-legal" label="Legal / firm name">
            <input id="fr-legal" className={inputClass} value={form.business.legalName} onChange={(e) => setNested("business", "legalName", e.target.value)} />
          </Field>
          <Field id="fr-gst" label="GST number">
            <input id="fr-gst" className={`${inputClass} uppercase`} maxLength={15} value={form.business.gstNumber} onChange={(e) => setNested("business", "gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="23ABCDE1234F1Z5" />
          </Field>
          <Field id="fr-pan" label="PAN number">
            <input id="fr-pan" className={`${inputClass} uppercase`} maxLength={10} value={form.business.panNumber} onChange={(e) => setNested("business", "panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ABCDE1234F" />
          </Field>
          <Field id="fr-address" label="Office address">
            <input id="fr-address" className={inputClass} value={form.business.address} onChange={(e) => setNested("business", "address", e.target.value)} />
          </Field>
        </Section>

        <Section title="Bank details" description="Where you send this franchise's payouts.">
          <Field id="fr-bank-holder" label="Account holder name">
            <input id="fr-bank-holder" className={inputClass} value={form.bank.accountHolderName} onChange={(e) => setNested("bank", "accountHolderName", e.target.value)} />
          </Field>
          <Field id="fr-bank-acc" label="Account number">
            <input id="fr-bank-acc" className={inputClass} inputMode="numeric" maxLength={18} value={form.bank.accountNumber} onChange={(e) => setNested("bank", "accountNumber", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="fr-bank-ifsc" label="IFSC code">
            <input id="fr-bank-ifsc" className={`${inputClass} uppercase`} maxLength={11} value={form.bank.ifscCode} onChange={(e) => setNested("bank", "ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          </Field>
          <Field id="fr-bank-name" label="Bank name">
            <input id="fr-bank-name" className={inputClass} value={form.bank.bankName} onChange={(e) => setNested("bank", "bankName", e.target.value)} />
          </Field>
          <Field id="fr-upi" label="UPI ID">
            <input id="fr-upi" className={inputClass} value={form.bank.upiId} onChange={(e) => setNested("bank", "upiId", e.target.value.trim())} />
          </Field>
        </Section>

        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <label htmlFor="fr-notes" className="block text-base font-semibold text-slate-900">Notes</label>
          <textarea id="fr-notes" rows={3} className={`${inputClass} mt-3`} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Agreement details, contact person, etc." />
        </section>

        <div className="flex justify-end gap-2 pb-6">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/admin/food/franchises/${id}` : "/admin/food/franchises")}
            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || noZonesLeft}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create franchise"}
          </button>
        </div>
      </form>
    </div>
  )
}
