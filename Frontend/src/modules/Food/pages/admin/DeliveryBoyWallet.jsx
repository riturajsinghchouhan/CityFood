import { useState, useEffect, useCallback } from "react"
import { Search, PiggyBank, Loader2, Package, RefreshCw, Banknote, Wallet } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@food/components/ui/dialog"
const debugLog = (...args) => {}
const debugError = (...args) => {}

const formatCurrency = (amount) => {
  if (amount == null) return "₹0.00"
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function DeliveryBoyWallet() {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [summary, setSummary] = useState(null)
  const limit = 20

  // Settle Payout / Settle Cash modal state
  const [settleTarget, setSettleTarget] = useState(null) // { wallet, mode: 'payout' | 'cash' }
  const [settleAmount, setSettleAmount] = useState("")
  const [settleNote, setSettleNote] = useState("")
  const [settleTransactionId, setSettleTransactionId] = useState("")
  const [settling, setSettling] = useState(false)

  const fetchWallets = useCallback(async (overrides = {}) => {
    const p = overrides.page ?? page
    const q = overrides.search !== undefined ? overrides.search : searchQuery
    const silent = overrides.silent ?? false

    try {
      if (!silent) setLoading(true)
      const res = await adminAPI.getDeliveryWallets({
        search: q.trim() || undefined,
        page: p,
        limit,
      })
      if (res?.data?.success) {
        const data = res.data.data
        setWallets(data?.wallets || [])
        setTotal(data?.pagination?.total || 0)
        setPages(data?.pagination?.pages || 1)
        setSummary(data?.summary || null)
      } else {
        if (!silent) toast.error(res?.data?.message || "Failed to fetch delivery boy wallets")
        setWallets([])
      }
    } catch (err) {
      debugError("Error fetching delivery boy wallets:", err)
      if (!silent) toast.error(err?.response?.data?.message || "Failed to fetch delivery boy wallets")
      setWallets([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    fetchWallets()

    // Real-time polling every 5 seconds
    const interval = setInterval(() => {
      fetchWallets({ silent: true })
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchWallets])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchWallets({ page: 1, search: searchQuery })
    }, 500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const openSettlePayout = (wallet) => {
    const pocket = Number(wallet.pocketBalance ?? wallet.totalBalance ?? wallet.pocket_balance ?? wallet.balance ?? 0)
    setSettleTarget({ wallet, mode: "payout" })
    setSettleAmount(pocket > 0 ? String(pocket) : "")
    setSettleNote("")
    setSettleTransactionId("")
  }

  const openSettleCash = (wallet) => {
    const collected = Number(wallet.cashCollected ?? wallet.cashInHand ?? wallet.cash_collected ?? wallet.cash_in_hand ?? 0)
    setSettleTarget({ wallet, mode: "cash" })
    setSettleAmount(collected > 0 ? String(collected) : "")
    setSettleNote("")
    setSettleTransactionId("")
  }

  const handleConfirmSettle = async () => {
    if (!settleTarget) return
    const amountNum = Number(settleAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const deliveryId = settleTarget.wallet.deliveryId
    try {
      setSettling(true)
      if (settleTarget.mode === "payout") {
        const response = await adminAPI.markDeliveryPayoutAsPaid({
          deliveryPartnerId: deliveryId,
          amount: amountNum,
          transactionId: settleTransactionId.trim() || undefined,
          adminNote: settleNote.trim() || undefined,
        })
        if (response?.data?.success) {
          toast.success("Delivery payout marked as paid successfully")
        } else {
          toast.error(response?.data?.message || "Failed to settle payout")
          return
        }
      } else {
        const response = await adminAPI.settleDeliveryCashLimit(deliveryId, {
          amount: amountNum,
          adminNote: settleNote.trim() || undefined,
        })
        if (response?.data?.success) {
          toast.success("Cash limit settled successfully")
        } else {
          toast.error(response?.data?.message || "Failed to settle cash limit")
          return
        }
      }
      setSettleTarget(null)
      fetchWallets({ silent: true })
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to process settlement")
    } finally {
      setSettling(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-5 h-5 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">Delivery Boy Wallet</h1>
            </div>
            {import.meta.env.DEV && wallets.length > 0 && (
              <div className="hidden">
                {/* Debug: {JSON.stringify(wallets[0])} */}
              </div>
            )}
            <button
              onClick={() => fetchWallets()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            View each delivery boy&apos;s wallet: pocket balance, cash collected, total earnings, bonus, and withdrawals.
          </p>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {[
            { 
              label: "Remaining Cash Limit", 
              value: summary?.totalRemainingCashLimit ?? wallets.reduce((acc, w) => {
                const totalLimit = Number(w.totalCashLimit || w.overallCashLimit || w.total_limit || 1500);
                const remaining = Number(w.remainingCashLimit ?? w.availableCashLimit ?? w.available_cash_limit ?? w.remaining_limit ?? totalLimit);
                return acc + remaining;
              }, 0), 
              color: "text-emerald-600", 
              bg: "bg-emerald-50" 
            },
            { 
              label: "Cash Collected", 
              value: summary?.totalCashCollected ?? wallets.reduce((acc, w) => acc + Number(w.cashCollected ?? w.cashInHand ?? w.cash_collected ?? w.cash_in_hand ?? 0), 0), 
              color: "text-blue-600", 
              bg: "bg-blue-50" 
            },
            { 
              label: "Total Earning", 
              value: summary?.totalEarning ?? wallets.reduce((acc, w) => acc + Number(w.totalEarning ?? w.earnings ?? w.total_earning ?? 0), 0), 
              color: "text-slate-900", 
              bg: "bg-slate-100" 
            },
            { 
              label: "Bonus", 
              value: summary?.totalBonus ?? wallets.reduce((acc, w) => acc + Number(w.bonus ?? w.total_bonus ?? 0), 0), 
              color: "text-violet-600", 
              bg: "bg-violet-50" 
            },
            { 
              label: "Total Withdrawn", 
              value: summary?.totalWithdrawn ?? wallets.reduce((acc, w) => acc + Number(w.totalWithdrawn ?? w.payoutAmount ?? w.total_withdrawn ?? 0), 0), 
              color: "text-orange-600", 
              bg: "bg-orange-50" 
            },
            { 
              label: "Cash In Hand", 
              value: summary?.totalCashInHand ?? wallets.reduce((acc, w) => {
                const totalLimit = Number(w.totalCashLimit || w.overallCashLimit || w.total_limit || 1500);
                const remaining = Number(w.remainingCashLimit ?? w.availableCashLimit ?? w.available_cash_limit ?? w.remaining_limit ?? totalLimit);
                const collected = Number(w.cashCollected ?? w.cashInHand ?? w.cash_collected ?? w.cash_in_hand ?? 0);
                const cih = collected > 0 ? collected : (w.usedLimit || w.used_limit || (totalLimit - remaining));
                return acc + cih;
              }, 0), 
              color: "text-rose-600", 
              bg: "bg-rose-50" 
            },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{formatCurrency(stat.value)}</p>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Table Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Wallets</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {total}
              </span>
            </div>
            <div className="relative flex-1 w-full sm:w-[280px] lg:w-[350px]">
              <input
                type="text"
                placeholder="Search by name or phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading wallets…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Remaining Cash Limit</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Pocket Balance</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Cash Collected</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Earning</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Withdrawn</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Cash In Hand</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-16 h-16 text-slate-400 mb-4" />
                          <p className="text-lg font-semibold text-slate-700">No wallets found</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {searchQuery ? `No results for "${searchQuery}"` : "No approved delivery boys found."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w, i) => {
                      const totalLimit = Number(w.totalCashLimit || w.overallCashLimit || w.total_limit || 1500);
                      const remaining = Number(w.remainingCashLimit ?? w.availableCashLimit ?? w.available_cash_limit ?? w.remaining_limit ?? totalLimit);
                      const pocket = Number(w.pocketBalance ?? w.totalBalance ?? w.pocket_balance ?? w.balance ?? 0);
                      const collected = Number(w.cashCollected ?? w.cashInHand ?? w.cash_collected ?? w.cash_in_hand ?? 0);
                      const earning = Number(w.totalEarning ?? w.earnings ?? w.total_earning ?? 0);
                      const bonus = Number(w.bonus || w.total_bonus || 0);
                      const withdrawn = Number(w.totalWithdrawn ?? w.payoutAmount ?? w.total_withdrawn ?? 0);
                      
                      // User requirement: Cash In Hand should be the amount subtracted from 1500 (or total limit)
                      // If collected is 0 but remaining is less than total, we use the difference.
                      const cashInHand = collected > 0 ? collected : (w.usedLimit || w.used_limit || (totalLimit - remaining));

                      return (
                        <tr key={w.walletId || w.deliveryId || i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">{(page - 1) * limit + i + 1}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-slate-800">{w.name || "—"}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                            {w.phone || w.deliveryIdString || "—"}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${remaining <= 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {formatCurrency(remaining)}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(pocket)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(collected)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{formatCurrency(earning)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-violet-600">{formatCurrency(bonus)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-orange-600">{formatCurrency(withdrawn)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                            {formatCurrency(cashInHand)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openSettlePayout(w)}
                                disabled={pocket <= 0}
                                title="Settle this delivery boy's pending payout"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                Settle Payout
                              </button>
                              <button
                                onClick={() => openSettleCash(w)}
                                disabled={cashInHand <= 0}
                                title="Reset this delivery boy's cash-in-hand"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                Settle Cash
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Page {page} of {pages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settle Payout / Settle Cash Dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(open) => !open && setSettleTarget(null)}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              {settleTarget?.mode === "cash" ? "Settle cash limit" : "Settle payout"} — {settleTarget?.wallet?.name || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-xs text-slate-500">
              {settleTarget?.mode === "cash"
                ? "This records that cash was collected from this delivery boy, resetting their cash-in-hand without waiting for their own deposit."
                : "This pays out this delivery boy's earnings now, without waiting for them to request a withdrawal."}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            {settleTarget?.mode === "payout" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transaction ID (optional)</label>
                <input
                  type="text"
                  value={settleTransactionId}
                  onChange={(e) => setSettleTransactionId(e.target.value)}
                  placeholder="UTR / bank reference"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Note (optional)</label>
              <textarea
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 flex gap-2">
            <button
              onClick={() => setSettleTarget(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSettle}
              disabled={settling}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {settling ? "Settling…" : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
