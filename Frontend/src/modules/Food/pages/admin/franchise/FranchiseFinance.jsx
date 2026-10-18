import { useCallback, useEffect, useState } from "react"
import { RefreshCw, IndianRupee, PlusCircle } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import WithdrawalRequests from "./WithdrawalRequests"
import {
  ADJUSTMENT_LABELS,
  ActionDialog,
  Pill,
  SETTLEMENT_STATUS_META,
  SignedAmount,
  StatTile,
  apiErrorMessage,
  formatCount,
  formatDate,
  formatDateTime,
  formatInr,
} from "./franchiseUi"

const payoutName = (p) =>
  p.kind === "restaurant" ? p.restaurantId?.restaurantName || "Restaurant" : p.deliveryPartnerId?.name || "Delivery boy"

/** HQ view of the money between HQ and one franchise. */
export default function FranchiseFinance({ franchiseId, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getFranchiseFinance(franchiseId)
      setData(res?.data?.data || null)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load money details"))
    } finally {
      setLoading(false)
    }
  }, [franchiseId])

  useEffect(() => { load() }, [load])

  const done = async (message) => {
    toast.success(message)
    setDialog(null)
    await load()
    onChanged?.()
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-500 py-6 text-center">Loading money details...</p>
  }
  if (!data) return null

  const { balance, settlements = [], adjustments = [], pendingPayouts = [] } = data
  const overdue = pendingPayouts.filter((p) => p.isOverdue)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Franchise wallet"
          value={<SignedAmount value={balance.balance} />}
          hint={balance.balance > 0.005
            ? "You hold this for the franchise"
            : balance.balance < -0.005
              ? `Franchise owes you · credit limit ${formatInr(balance.creditLimit)}`
              : "Nothing due either way"}
        />
        <StatTile label="Can withdraw now" tone="green" value={formatInr(balance.availableToWithdraw)} hint={`${formatInr(balance.pendingWithdrawals)} already requested · ${formatCount(balance.unsettledOrders.count)} orders in wallet`} />
        <StatTile label="Rider cash with HQ" value={formatInr(balance.riderCashDeposited)} hint="COD cash franchise riders handed to HQ, not yet settled" />
        <StatTile label="Pending adjustments" value={<SignedAmount value={balance.pendingAdjustments} />} hint="Fees, payments and payouts in the wallet" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDialog({ type: "payment" })}
          className="flex items-center gap-2 px-3 py-2 border border-green-300 bg-green-50 text-green-800 rounded-lg hover:bg-green-100"
        >
          <IndianRupee className="w-4 h-4" /> Record payment from franchise
        </button>
        <button
          onClick={() => setDialog({ type: "adjustment" })}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50"
        >
          <PlusCircle className="w-4 h-4" /> Add adjustment
        </button>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-slate-900">Withdrawal requests from this franchise</h3>
        <WithdrawalRequests franchiseId={franchiseId} onChanged={async () => { await load(); onChanged?.() }} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          Restaurant & rider payouts waiting
          {overdue.length > 0 && <Pill className="ml-2 bg-red-100 text-red-700">{overdue.length} overdue</Pill>}
        </h3>
        <p className="text-sm text-slate-500">The franchise pays these. If one is overdue, you can pay it yourself; the amount is charged to the franchise.</p>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">For</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Requested</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingPayouts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No payouts waiting.</td></tr>
              ) : pendingPayouts.map((p) => (
                <tr key={p._id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{payoutName(p)}</td>
                  <td className="px-4 py-2.5">{p.kind === "restaurant" ? "Restaurant" : "Delivery boy"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatInr(p.amount)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(p.createdAt)}</td>
                  <td className="px-4 py-2.5">{p.isOverdue ? <Pill className="bg-red-100 text-red-700">Overdue</Pill> : <Pill className="bg-amber-100 text-amber-800">Waiting</Pill>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setDialog({ type: "payDirect", payout: p })}
                      className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Pay directly
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-slate-900">Settlements</h3>
        <p className="text-sm text-slate-500">Earlier settlements and the final settlement when a franchise ends. Positive = you pay the franchise.</p>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">Orders</th>
                <th className="px-4 py-2.5 font-medium text-right">Orders net</th>
                <th className="px-4 py-2.5 font-medium text-right">Rider cash</th>
                <th className="px-4 py-2.5 font-medium text-right">Adjustments</th>
                <th className="px-4 py-2.5 font-medium text-right">Carried in</th>
                <th className="px-4 py-2.5 font-medium text-right">Net</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">No settlements yet.</td></tr>
              ) : settlements.map((s) => {
                const meta = SETTLEMENT_STATUS_META[s.status] || {}
                return (
                  <tr key={s._id}>
                    <td className="px-4 py-2.5 font-medium">{s.number}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.orders.count} <span className="text-slate-400">({s.orders.onlineCount} online · {s.orders.cashCount} cash)</span></td>
                    <td className="px-4 py-2.5 text-right tabular-nums"><SignedAmount value={s.orders.net} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatInr(s.riderCashDeposited)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums"><SignedAmount value={s.adjustmentsTotal} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums"><SignedAmount value={s.openingBalance} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold"><SignedAmount value={s.netPayable} /></td>
                    <td className="px-4 py-2.5"><Pill className={meta.className}>{meta.label || s.status}</Pill>{s.utr ? <span className="block text-xs text-slate-500 mt-0.5">UTR {s.utr}</span> : null}</td>
                    <td className="px-4 py-2.5 text-right">
                      {s.status === "payout_pending" && (
                        <button onClick={() => setDialog({ type: "settlementPaid", settlement: s })} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-slate-900">Adjustments</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Note</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Settled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No adjustments yet.</td></tr>
              ) : adjustments.map((a) => (
                <tr key={a._id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{ADJUSTMENT_LABELS[a.type] || a.type}</td>
                  <td className="px-4 py-2.5">{a.note || "—"}{a.utr ? <span className="block text-xs text-slate-500">UTR {a.utr}</span> : null}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums"><SignedAmount value={a.amount} /></td>
                  <td className="px-4 py-2.5">{a.settlementId ? "Yes" : <span className="text-slate-500">Next settlement</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ActionDialog
        open={dialog?.type === "payment"}
        title="Record payment from franchise"
        description="Money the franchise paid you for its dues. It reduces what the franchise owes."
        fields={[
          { name: "amount", label: "Amount (₹)", type: "number", required: true },
          { name: "utr", label: "UTR / reference", placeholder: "Bank or UPI reference" },
          { name: "note", label: "Note", type: "textarea" },
        ]}
        confirmLabel="Record payment"
        tone="green"
        onClose={() => setDialog(null)}
        onConfirm={async (v) => {
          await adminAPI.addFranchiseAdjustment(franchiseId, { type: "PAYMENT_RECEIVED", amount: Number(v.amount), utr: v.utr, note: v.note })
          await done("Payment recorded")
        }}
      />

      <ActionDialog
        open={dialog?.type === "adjustment"}
        title="Add adjustment"
        description="Use plus for money you owe the franchise (bonus, refund back) and minus for money it owes you (penalty, refund share)."
        fields={[
          { name: "direction", label: "Direction", options: [{ value: "-", label: "Franchise owes HQ (minus)" }, { value: "+", label: "HQ owes franchise (plus)" }], defaultValue: "-" },
          { name: "amount", label: "Amount (₹)", type: "number", required: true },
          { name: "note", label: "Reason", type: "textarea", required: true },
        ]}
        confirmLabel="Add adjustment"
        onClose={() => setDialog(null)}
        onConfirm={async (v) => {
          const amount = Math.abs(Number(v.amount)) * (v.direction === "+" ? 1 : -1)
          await adminAPI.addFranchiseAdjustment(franchiseId, { type: "MANUAL", amount, note: v.note })
          await done("Adjustment added")
        }}
      />

      <ActionDialog
        open={dialog?.type === "payDirect"}
        title={`Pay ${dialog?.payout ? payoutName(dialog.payout) : ""} directly`}
        description={dialog?.payout ? `${formatInr(dialog.payout.amount)} will be marked paid by HQ and charged to the franchise in its next settlement.` : ""}
        fields={[{ name: "utr", label: "UTR / reference of your payment", required: true }]}
        confirmLabel="Mark paid by HQ"
        tone="amber"
        onClose={() => setDialog(null)}
        onConfirm={async (v) => {
          await adminAPI.hqPayFranchiseWithdrawal(franchiseId, dialog.payout.kind, dialog.payout._id, v.utr)
          await done("Paid by HQ and charged to the franchise")
        }}
      />

      <ActionDialog
        open={dialog?.type === "settlementPaid"}
        title={`Mark settlement #${dialog?.settlement?.number ?? ""} as paid`}
        description={dialog?.settlement ? `You paid ${formatInr(dialog.settlement.netPayable)} to the franchise.` : ""}
        fields={[
          { name: "utr", label: "UTR / reference", required: true },
          ...(overdue.length > 0
            ? [{ name: "force", label: `${overdue.length} payout(s) are overdue`, options: [{ value: "no", label: "Wait until they are paid" }, { value: "yes", label: "Pay the franchise anyway" }], defaultValue: "no" }]
            : []),
        ]}
        confirmLabel="Mark paid"
        onClose={() => setDialog(null)}
        onConfirm={async (v) => {
          await adminAPI.markFranchiseSettlementPaid(franchiseId, dialog.settlement._id, v.utr, v.force === "yes")
          await done("Settlement marked as paid")
        }}
      />
    </div>
  )
}
