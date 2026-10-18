import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import { ActionDialog, Pill, apiErrorMessage, formatDateTime, formatInr } from "./franchiseUi"

const STATUS_PILL = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
}
const STATUS_LABEL = { pending: "Waiting", approved: "Paid", rejected: "Rejected" }
const FILTERS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

const bankLine = (b = {}) =>
  [b.accountHolderName, b.accountNumber, b.ifscCode].filter(Boolean).join(" · ") || (b.upiId ? `UPI ${b.upiId}` : "No bank details")

/** HQ: franchise withdrawal requests, approve with UTR or reject. Pass franchiseId to show one franchise. */
export default function WithdrawalRequests({ franchiseId, onChanged }) {
  const [status, setStatus] = useState("pending")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getFranchiseWithdrawals({ status: status === "all" ? undefined : status, franchiseId })
      setRows(res?.data?.data?.withdrawals || [])
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load withdrawal requests"))
    } finally {
      setLoading(false)
    }
  }, [status, franchiseId])

  useEffect(() => { load() }, [load])

  const done = async (message) => {
    toast.success(message)
    setDialog(null)
    await load()
    onChanged?.()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`px-3 py-1 rounded-full text-sm border ${status === f.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              {!franchiseId && <th className="px-4 py-2.5 font-medium">Franchise</th>}
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium">Pay to</th>
              <th className="px-4 py-2.5 font-medium">Requested</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No withdrawal requests here.</td></tr>
            ) : rows.map((w) => (
              <tr key={w._id}>
                {!franchiseId && (
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{w.franchiseId?.name || "—"}</p>
                    <p className="text-xs text-slate-500">{w.franchiseId?.code} · {w.franchiseId?.zoneId?.name}</p>
                  </td>
                )}
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatInr(w.amount)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{bankLine(w.bank)}{w.bank?.upiId && w.bank?.accountNumber ? <span className="block">UPI {w.bank.upiId}</span> : null}{w.note ? <span className="block text-slate-500">Note: {w.note}</span> : null}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(w.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <Pill className={STATUS_PILL[w.status]}>{STATUS_LABEL[w.status]}</Pill>
                  {w.utr ? <span className="block text-xs text-slate-500 mt-0.5">UTR {w.utr}</span> : null}
                  {w.rejectionReason ? <span className="block text-xs text-slate-500 mt-0.5">{w.rejectionReason}</span> : null}
                </td>
                <td className="px-4 py-2.5">
                  {w.status === "pending" && (
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setDialog({ type: "approve", w })} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                      <button onClick={() => setDialog({ type: "reject", w })} className="px-2.5 py-1 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionDialog
        open={dialog?.type === "approve"}
        title={`Pay ${dialog ? formatInr(dialog.w.amount) : ""} to ${dialog?.w?.franchiseId?.name || "the franchise"}`}
        description={dialog ? `Send the money to ${bankLine(dialog.w.bank)}, then enter the payment reference.` : ""}
        fields={[{ name: "utr", label: "UTR / reference", required: true }]}
        confirmLabel="Approve & mark paid"
        tone="green"
        onClose={() => setDialog(null)}
        onConfirm={async ({ utr }) => {
          await adminAPI.approveFranchiseWithdrawal(dialog.w._id, utr)
          await done("Withdrawal approved")
        }}
      />
      <ActionDialog
        open={dialog?.type === "reject"}
        title="Reject withdrawal request"
        description="The amount stays in the franchise wallet."
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
        confirmLabel="Reject"
        tone="red"
        onClose={() => setDialog(null)}
        onConfirm={async ({ reason }) => {
          await adminAPI.rejectFranchiseWithdrawal(dialog.w._id, reason)
          await done("Withdrawal rejected")
        }}
      />
    </div>
  )
}
