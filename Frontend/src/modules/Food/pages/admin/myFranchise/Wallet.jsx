import { useCallback, useEffect, useState } from "react"
import { Wallet as WalletIcon, Send, Info } from "lucide-react"
import { toast } from "sonner"
import { franchiseAPI } from "@food/api"
import {
  ADJUSTMENT_LABELS, Pill, SignedAmount, StatTile, apiErrorMessage, formatCount, formatDateTime, formatInr,
} from "@food/pages/admin/franchise/franchiseUi"
import { PageHeader, RefreshButton, Table } from "./shared"

const you = { positiveLabel: "HQ owes you", negativeLabel: "You owe HQ" }
const STATUS = {
  pending: { label: "Waiting for HQ", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Paid", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
}
const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

/** Franchise owner: money HQ holds for you, and withdrawal requests to HQ. */
export default function Wallet() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await franchiseAPI.getWallet()
      setData(res?.data?.data || null)
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load your wallet"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const request = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!(value >= 1)) return toast.error("Enter an amount of at least ₹1")
    if (value > (data?.balance?.availableToWithdraw || 0)) return toast.error(`You can withdraw up to ${formatInr(data?.balance?.availableToWithdraw)}`)
    try {
      setSending(true)
      await franchiseAPI.requestWithdrawal(value, note.trim())
      toast.success("Request sent to HQ")
      setAmount("")
      setNote("")
      load()
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not send the request"))
    } finally {
      setSending(false)
    }
    return undefined
  }

  if (!data) {
    return <div className="p-6 text-center text-slate-500">{loading ? "Loading wallet..." : "Wallet is not available."}</div>
  }
  const { balance, withdrawals, adjustments, bank } = data
  const orders = balance.unsettledOrders || {}
  const onHold = balance.onHold || {}
  const canWithdraw = balance.availableToWithdraw >= 1
  const onlinePaid = Number(orders.customerPaid || 0) - Number(orders.cashCollected || 0)
  // Why the withdraw button is off, in the order the owner should act on.
  const reasons = []
  if (balance.balance < -0.005) {
    reasons.push(
      `You owe HQ ${formatInr(-balance.balance)}. Your riders collected ${formatInr(orders.cashCollected)} in cash on ${formatCount(orders.cashCount)} COD orders. ` +
      `That cash already holds your earning and the restaurants' share, so HQ has nothing to pay you for those orders; HQ's commission and the taxes in it are due to HQ.`,
    )
  }
  if (Number(onHold.count) > 0 && balance.balance > -0.005) {
    reasons.push(
      `${formatInr(Math.max(0, onHold.net))} from ${formatCount(onHold.count)} recent orders is on hold for ${balance.holdbackDays} days (refund window)` +
      (onHold.nextReleaseAt ? ` and starts unlocking on ${formatDateTime(onHold.nextReleaseAt)}.` : "."),
    )
  }
  if (Number(balance.pendingWithdrawals) > 0) {
    reasons.push(`${formatInr(balance.pendingWithdrawals)} is already requested and waiting for HQ.`)
  }
  if (!reasons.length) reasons.push("No online-order money is waiting with HQ yet.")
  const statement = [
    ["Online payments received by HQ", onlinePaid],
    ["Cash collected by your riders", Number(orders.cashCollected || 0)],
    ["Restaurants' share (you pay them)", Number(orders.restaurantShare || 0)],
    ["Riders' share (you pay them)", Number(orders.riderShare || 0)],
    ["Your earning", Number(orders.franchiseEarning ?? (Number(orders.franchiseGross || 0) - Number(orders.hqShare || 0)))],
    ["HQ commission", Number(orders.hqShare || 0)],
    // Rest of what customers paid: GST, TCS, gateway fee (net of any HQ-funded coupon), all held by HQ.
    ["Taxes & gateway fee (HQ keeps)", Number(orders.customerPaid || 0) - Number(orders.restaurantShare || 0) - Number(orders.riderShare || 0) - Number(orders.franchiseGross || 0)],
  ]

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-6xl flex flex-col gap-5">
        <PageHeader
          icon={WalletIcon}
          title="Wallet & Withdraw"
          subtitle="Customers' online payments reach HQ. Your share stays here until you withdraw it."
          actions={<RefreshButton loading={loading} onClick={load} />}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Available to withdraw" tone="green" value={formatInr(balance.availableToWithdraw)} hint={`Orders older than ${balance.holdbackDays} days, minus open requests`} />
          <StatTile label="Wallet balance" value={<SignedAmount value={balance.balance} {...you} />} hint={balance.balance < -0.005 ? `You owe HQ · limit ${formatInr(balance.creditLimit)}` : "Including recent orders"} />
          <StatTile label="Requests waiting" value={formatInr(balance.pendingWithdrawals)} hint="Sent to HQ, not paid yet" />
          <StatTile label="Orders in wallet" value={formatCount(balance.unsettledOrders.count)} hint={`${formatInr(balance.unsettledOrders.customerPaid)} paid by customers`} />
        </div>

        <section className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-2">How your wallet is worked out</h2>
            <p className="text-xs text-slate-500 mb-3">{formatCount(orders.count)} unsettled orders, {formatInr(orders.customerPaid)} paid by customers</p>
            <dl className="text-sm divide-y divide-slate-100">
              {statement.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="tabular-nums text-slate-900">{formatInr(value)}</dd>
                </div>
              ))}
              {Number(balance.riderCashDeposited) > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-600">Rider cash deposited with HQ</dt>
                  <dd className="tabular-nums text-slate-900">{formatInr(balance.riderCashDeposited)}</dd>
                </div>
              )}
              {Math.abs(Number(balance.pendingAdjustments) || 0) > 0.005 && (
                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-600">Fees and adjustments</dt>
                  <dd className="tabular-nums"><SignedAmount value={balance.pendingAdjustments} {...you} /></dd>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 font-semibold">
                <dt className="text-slate-900">Wallet balance</dt>
                <dd className="tabular-nums"><SignedAmount value={balance.balance} {...you} /></dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500 mt-2">
              Balance = restaurants + riders + your earning − cash your riders collected (+ rider cash deposited with HQ and adjustments).
              Online orders: HQ holds the money and owes you that part. COD orders: your riders hold the cash, so you owe HQ its commission and the taxes.
            </p>
          </div>
          <div className={`rounded-lg p-4 ${canWithdraw ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-2">
              <Info className="w-4 h-4" /> {canWithdraw ? `You can withdraw ${formatInr(balance.availableToWithdraw)}` : "Why you can't withdraw right now"}
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">
              {(canWithdraw ? reasons.filter((r) => !r.startsWith("No online")) : reasons).map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </section>

        <form onSubmit={request} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="wd-amount" className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
            <input id="wd-amount" className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Up to ${balance.availableToWithdraw}`} />
          </div>
          <div>
            <label htmlFor="wd-note" className="block text-sm font-medium text-slate-700 mb-1">Note for HQ (optional)</label>
            <input id="wd-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="submit" disabled={sending || !(balance.availableToWithdraw >= 1)} className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Send className="w-4 h-4" /> {sending ? "Sending..." : "Request withdrawal"}
          </button>
          <p className="md:col-span-3 text-xs text-slate-500">
            HQ pays to: {[bank?.accountHolderName, bank?.accountNumber, bank?.ifscCode].filter(Boolean).join(" · ") || (bank?.upiId ? `UPI ${bank.upiId}` : "no bank details yet. Ask HQ to add them.")}
          </p>
        </form>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Withdrawal requests</h2>
          <Table
            columns={[{ label: "Requested" }, { label: "Amount", right: true }, { label: "Note" }, { label: "Status" }]}
            rows={withdrawals}
            empty="No requests yet."
            renderRow={(w) => (
              <tr key={w._id}>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(w.createdAt)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatInr(w.amount)}</td>
                <td className="px-4 py-2.5">{w.note || "—"}</td>
                <td className="px-4 py-2.5">
                  <Pill className={STATUS[w.status]?.className}>{STATUS[w.status]?.label}</Pill>
                  {w.utr ? <span className="block text-xs text-slate-500 mt-0.5">UTR {w.utr}</span> : null}
                  {w.rejectionReason ? <span className="block text-xs text-slate-500 mt-0.5">{w.rejectionReason}</span> : null}
                </td>
              </tr>
            )}
          />
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Wallet statement</h2>
          <Table
            columns={[{ label: "Date" }, { label: "Type" }, { label: "Note" }, { label: "Amount", right: true }]}
            rows={adjustments}
            empty="Fees, payments and payouts show here."
            renderRow={(a) => (
              <tr key={a._id}>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(a.createdAt)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{a.type === "WITHDRAWAL_PAID" ? "Withdrawal paid" : ADJUSTMENT_LABELS[a.type] || a.type}</td>
                <td className="px-4 py-2.5">{a.note || "—"}{a.utr ? <span className="block text-xs text-slate-500">UTR {a.utr}</span> : null}</td>
                <td className="px-4 py-2.5 text-right tabular-nums"><SignedAmount value={a.amount} {...you} /></td>
              </tr>
            )}
          />
        </section>
      </div>
    </div>
  )
}
