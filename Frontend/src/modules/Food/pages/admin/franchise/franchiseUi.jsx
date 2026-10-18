import { useEffect, useState } from "react"

// Shared bits for the franchise admin pages.

export const FRANCHISE_STATUS_META = {
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  grace: { label: "Grace", className: "bg-amber-100 text-amber-800" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700" },
  terminated: { label: "Terminated", className: "bg-slate-200 text-slate-700" },
}

export const ORDER_STATUS_LABELS = {
  created: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  reached_pickup: "Rider at restaurant",
  picked_up: "Picked up",
  reached_drop: "Rider at customer",
  delivered: "Delivered",
  cancelled_by_user: "Cancelled by customer",
  cancelled_by_restaurant: "Cancelled by restaurant",
  cancelled_by_admin: "Cancelled by admin",
  dead: "Expired",
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const count = new Intl.NumberFormat("en-IN")

export const formatInr = (value) => inr.format(Number(value) || 0)
export const formatCount = (value) => count.format(Number(value) || 0)

export const formatDate = (value) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export const formatDateTime = (value) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/** Backend errors come back as { error } (error handler) or { message } (sendError). */
export const apiErrorMessage = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.error || error?.response?.data?.message || fallback

export const revenueModelLabel = (franchise) => {
  if (!franchise) return "—"
  if (franchise.revenueModel === "COMMISSION") return `Commission ${Number(franchise.commissionPercent) || 0}%`
  const plan = franchise.subscription?.plan === "YEARLY" ? "year" : "month"
  return `Subscription ${formatInr(franchise.subscription?.amount)}/${plan}`
}

export function StatusBadge({ status }) {
  const meta = FRANCHISE_STATUS_META[status] || { label: status || "—", className: "bg-slate-100 text-slate-700" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export function StatTile({ label, value, hint, tone = "default" }) {
  const toneClass = {
    default: "text-slate-900",
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
  }[tone]
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export const SETTLEMENT_STATUS_META = {
  payout_pending: { label: "HQ to pay", className: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  carried_forward: { label: "Franchise owes", className: "bg-amber-100 text-amber-800" },
  zero: { label: "Nothing due", className: "bg-slate-100 text-slate-700" },
}

export const ADJUSTMENT_LABELS = {
  SUBSCRIPTION_FEE: "Subscription fee",
  PAYMENT_RECEIVED: "Payment received",
  HQ_PAID_PAYOUT: "Paid by HQ for franchise",
  MANUAL: "Adjustment",
}

export function Pill({ className = "bg-slate-100 text-slate-700", children }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>{children}</span>
}

/** Signed money: green when HQ owes the franchise, amber when the franchise owes HQ. */
export function SignedAmount({ value, positiveLabel = "HQ owes franchise", negativeLabel = "Franchise owes HQ" }) {
  const n = Number(value) || 0
  if (Math.abs(n) < 0.005) return <span className="text-slate-600">{formatInr(0)}</span>
  return (
    <span className={n > 0 ? "text-green-700" : "text-amber-700"} title={n > 0 ? positiveLabel : negativeLabel}>
      {n > 0 ? "+" : "−"}{formatInr(Math.abs(n))}
    </span>
  )
}

/**
 * Small modal that collects a few values (UTR, reason, amount) before an action.
 * fields: [{ name, label, type?, placeholder?, required?, options? }]
 */
export function ActionDialog({ open, title, description, fields = [], confirmLabel = "Confirm", tone = "blue", onConfirm, onClose, children }) {
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])))
      setError("")
      setSaving(false)
    }
    // fields are defined inline by callers; reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const toneClass = {
    blue: "bg-blue-600 hover:bg-blue-700",
    red: "bg-red-600 hover:bg-red-700",
    green: "bg-green-600 hover:bg-green-700",
    amber: "bg-amber-600 hover:bg-amber-700",
  }[tone]

  const submit = async (e) => {
    e.preventDefault()
    const missing = fields.find((f) => f.required && !String(values[f.name] ?? "").trim())
    if (missing) {
      setError(`${missing.label} is required`)
      return
    }
    try {
      setSaving(true)
      setError("")
      await onConfirm(values)
    } catch (err) {
      setError(apiErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 flex flex-col gap-4">
        <div>
          <h2 id="action-dialog-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
        </div>
        {children}
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`dlg-${f.name}`} className="block text-sm font-medium text-slate-700 mb-1">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            {f.options ? (
              <select
                id={`dlg-${f.name}`}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={`dlg-${f.name}`}
                rows={3}
                value={values[f.name] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                id={`dlg-${f.name}`}
                type={f.type || "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={values[f.name] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {f.hint && <p className="text-xs text-slate-500 mt-1">{f.hint}</p>}
          </div>
        ))}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-lg disabled:opacity-60 ${toneClass}`}>
            {saving ? "Saving..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
