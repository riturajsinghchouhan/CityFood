import React, { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { adminAPI } from "@food/api"
import { isFranchiseSession } from "@food/utils/adminSidebarMenu"
import { ArrowLeft, Loader2, DollarSign, ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

export default function AdminEarningReport() {
  const location = useLocation()
  const navigate = useNavigate()
  const isFranchise = isFranchiseSession() || location.pathname?.startsWith("/franchise")
  
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState({})

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filters = location.state?.filters || { time: "All Time", zone: "All Zones", restaurant: "All restaurants" }
  const searchQuery = location.state?.searchQuery || ""

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true)
        
        let fromDate = null
        let toDate = null
        const now = new Date()
        
        if (filters.time === "Today") {
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        } else if (filters.time === "This Week") {
          const dayOfWeek = now.getDay()
          const diff = now.getDate() - dayOfWeek
          fromDate = new Date(now.getFullYear(), now.getMonth(), diff)
          toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59)
        } else if (filters.time === "This Month") {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
          toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        }

        const params = {
          search: searchQuery || undefined,
          zone: filters.zone !== "All Zones" ? filters.zone : undefined,
          restaurant: filters.restaurant !== "All restaurants" ? filters.restaurant : undefined,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
          limit: 1000
        }

        const response = await adminAPI.getTransactionReport(params)

        if (response?.data?.success && response.data.data) {
          // Filter to only successful transactions (delivered, captured, settled) to show earnings
          const validTx = response.data.data.transactions.filter(t => 
            ['delivered', 'captured', 'settled'].includes(String(t.status).toLowerCase())
          )
          setTransactions(validTx || [])
        } else {
          setTransactions([])
          if (response?.data?.message) {
            toast.error(response.data.message)
          }
        }
      } catch (error) {
        console.error("Error fetching earning report:", error)
        toast.error("Failed to fetch earning report")
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [])

  const formatMoney = (amount) => {
    return `\u20B9${Number(amount || 0).toFixed(2)}`
  }

  const formatDiscount = (amount) => {
    return `-\u20B9${Number(amount || 0).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading {isFranchise ? "franchise" : "admin"} earning details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">{isFranchise ? "Franchise Earning Breakdown" : "Admin Earning Breakdown"}</h1>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">
            {transactions.length} Transactions Found
          </div>
        </div>

        {/* Content Grid */}
        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Earnings Found</h3>
            <p className="text-slate-500">No successful transactions matched the selected filters.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Restaurant</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Customer Paid</th>
                    <th className="px-6 py-4 text-right">HQ Earning</th>
                    <th className="px-6 py-4 text-right">Franchise Earning</th>
                    <th className="px-6 py-4 text-right">Restaurant Payout</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.map((tx) => {
                    // Money split from the backend (splitOrderEarnings): the parts add up to what the customer paid.
                    const e = tx.earnings || {}
                    const taxes = e.taxes || {}
                    const itemSubtotal = Number(tx.itemSubtotalAfterDiscount ?? tx.totalItemAmount ?? 0)
                    const itemDiscount = Number(tx.restaurantDiscount || 0) > 0 && Number(tx.originalItemCost || 0) > itemSubtotal ? Number(tx.restaurantDiscount) : 0
                    const couponDiscount = Number(e.discount || 0)
                    const restaurantCommission = Number(e.restaurantCommission || 0)
                    const restaurantDeductions = restaurantCommission + Number(taxes.gstOnItem || 0) + Number(taxes.gstOnCommission || 0) + Number(e.paymentGatewayFee || 0) + Number(taxes.tcs || 0)
                    const franchise = tx.franchise
                    const franchiseCoupon = Math.max(0, couponDiscount - Number(e.hqCouponCost || 0))
                    const splitTotal = Number(e.restaurantShare || 0) + Number(e.riderShare || 0) + Number(e.franchiseEarning || 0) + Number(e.hqEarning || 0) + Number(taxes.total || 0) + Number(e.paymentGatewayFee || 0)
                    const isExpanded = !!expandedCards[tx.id]
                    const line = (label, value, { minus = false, bold = false, muted = false } = {}) => (
                      <div className="flex items-center justify-between">
                        <span className={`${muted ? "text-[12px] text-gray-500" : "text-[13px] text-gray-600"} font-medium`}>{label}</span>
                        <span className={`${muted ? "text-[12px]" : "text-[13px]"} ${minus ? "text-red-600" : "text-gray-900"} ${bold ? "font-semibold" : ""}`}>
                          {minus ? formatDiscount(value) : formatMoney(value)}
                        </span>
                      </div>
                    )

                    return (
                      <React.Fragment key={tx.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">#{tx.orderId}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            <div>{tx.restaurant}</div>
                            <div className="text-[11px] text-slate-400">{franchise ? franchise.name : "HQ zone"}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full tracking-wide">
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatMoney(tx.orderAmount)}</td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatMoney(e.hqEarning)}</td>
                          <td className="px-6 py-4 text-right font-bold text-teal-600">{franchise ? formatMoney(e.franchiseEarning) : "-"}</td>
                          <td className="px-6 py-4 text-right font-bold text-blue-600">{formatMoney(e.restaurantShare)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleExpand(tx.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors"
                            >
                              Details {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="8" className="p-0 bg-slate-50/50 border-b-2 border-slate-200">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6"
                              >
                                {/* Customer Bill */}
                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                  <h3 className="text-sm font-bold text-gray-900 mb-3 tracking-wide">Customer Bill</h3>
                                  <div className="space-y-2.5">
                                    {itemDiscount > 0 && line("Original item cost", tx.originalItemCost)}
                                    {itemDiscount > 0 && line("Restaurant discount", itemDiscount, { minus: true })}
                                    {line("Item subtotal", itemSubtotal, { bold: true })}
                                    {line("Packaging fee", e.packagingFee)}
                                    {line("Delivery fee", e.deliveryFee)}
                                    {line("Platform fee", e.platformFee)}
                                    {line("GST", taxes.gstFromCustomer)}
                                    {couponDiscount > 0 && line("Coupon discount", couponDiscount, { minus: true })}
                                    <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
                                      <span className="text-sm font-bold text-gray-900">Total paid by user{tx.paymentMethod ? ` (${tx.paymentMethod})` : ""}</span>
                                      <span className="text-sm font-bold text-gray-900">{formatMoney(tx.orderAmount)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Who gets what */}
                                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 shadow-sm">
                                  <h3 className="text-sm font-bold text-emerald-900 mb-3 tracking-wide">Who Gets What</h3>
                                  <div className="space-y-2.5">
                                    {line("Restaurant", e.restaurantShare)}
                                    {line("Delivery boy", e.riderShare)}
                                    <p className="text-[11px] leading-relaxed text-gray-500">
                                      Platform earning = delivery {formatMoney(e.deliveryFee)} + platform {formatMoney(e.platformFee)} + commission {formatMoney(restaurantCommission)} - rider {formatMoney(e.riderShare)}
                                      {franchiseCoupon > 0 ? ` - franchise coupon ${formatMoney(franchiseCoupon)}` : ""} = {formatMoney(e.platformEarning)}
                                    </p>
                                    {franchise && line(`Franchise (${franchise.name})`, e.franchiseEarning)}
                                    {line(
                                      franchise
                                        ? `HQ commission (${franchise.revenueModel === "COMMISSION" ? `${franchise.commissionPercent}%` : "subscription, 0%"})`
                                        : "HQ (platform earning)",
                                      e.hqCommission,
                                    )}
                                    {Number(e.hqCouponCost || 0) > 0 && line("HQ-funded coupon", e.hqCouponCost, { minus: true, muted: true })}
                                    {line("HQ earning", e.hqEarning, { bold: true })}
                                    <div className="pt-1 text-[12px] font-semibold text-gray-700">Government (held by HQ)</div>
                                    <div className="pl-3 border-l-2 border-emerald-100 space-y-2">
                                      {line("GST from customer", taxes.gstFromCustomer, { muted: true })}
                                      {Number(taxes.gstOnItem || 0) > 0 && line("GST on item", taxes.gstOnItem, { muted: true })}
                                      {Number(taxes.gstOnCommission || 0) > 0 && line("GST on commission", taxes.gstOnCommission, { muted: true })}
                                      {Number(taxes.tcs || 0) > 0 && line("TCS", taxes.tcs, { muted: true })}
                                    </div>
                                    {Number(e.paymentGatewayFee || 0) > 0 && line("Payment gateway fee", e.paymentGatewayFee)}
                                    <div className="pt-2 mt-2 border-t border-emerald-200 flex items-center justify-between">
                                      <span className="text-sm font-bold text-emerald-900">Total (= customer paid)</span>
                                      <span className="text-sm font-bold text-emerald-900">{formatMoney(splitTotal)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Restaurant Payout */}
                                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 shadow-sm">
                                  <h3 className="text-sm font-bold text-blue-900 mb-3 tracking-wide">Restaurant Payout</h3>
                                  <div className="space-y-2.5">
                                    {line("Item subtotal", itemSubtotal, { bold: true })}
                                    {Number(e.packagingFee || 0) > 0 && line("Packaging fee", e.packagingFee)}
                                    {line("Deductions", restaurantDeductions, { minus: true })}
                                    <div className="pl-3 border-l-2 border-blue-100 space-y-2 mt-1 mb-1">
                                      {line("Restaurant commission", restaurantCommission, { minus: true, muted: true })}
                                      {Number(taxes.gstOnItem || 0) > 0 && line("GST on item", taxes.gstOnItem, { minus: true, muted: true })}
                                      {Number(taxes.gstOnCommission || 0) > 0 && line("GST on commission", taxes.gstOnCommission, { minus: true, muted: true })}
                                      {Number(e.paymentGatewayFee || 0) > 0 && line("Payment gateway fee", e.paymentGatewayFee, { minus: true, muted: true })}
                                      {Number(taxes.tcs || 0) > 0 && line("TCS", taxes.tcs, { minus: true, muted: true })}
                                    </div>
                                    <div className="pt-2 mt-2 border-t border-blue-200 flex items-center justify-between">
                                      <span className="text-sm font-bold text-blue-900">Restaurant gets</span>
                                      <span className="text-sm font-bold text-blue-900">{formatMoney(e.restaurantShare)}</span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
