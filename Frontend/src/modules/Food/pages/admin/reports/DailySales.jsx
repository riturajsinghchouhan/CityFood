import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt,
  Calendar,
  RefreshCw,
  UtensilsCrossed,
  Bike,
  Store,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  PackageCheck,
  Timer
} from "lucide-react";
import { adminAPI } from "@/services/api";
import { toast } from "sonner";

const INR = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return "--";
  const m = Number(minutes);
  if (m < 1) return "< 1 min";
  if (m < 60) return `${m} min`;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatTimeOnly(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getTodayStr() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function getYesterdayStr() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(yesterday);
}

export default function DailySales() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [activeTab, setActiveTab] = useState("food"); // "food" | "riders" | "restaurants"
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [salesData, setSalesData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  const fetchSalesData = useCallback(async (date, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await adminAPI.getDailySales(date);
      if (response.data?.success && response.data?.data) {
        setSalesData(response.data.data);
      } else {
        toast.error(response.data?.message || "Failed to load daily sales data");
      }
    } catch (err) {
      console.error("Error fetching daily sales:", err);
      toast.error(err.response?.data?.message || "Failed to load daily sales");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData(selectedDate);
  }, [selectedDate, fetchSalesData]);

  const toggleExpandOrder = (id) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const overall = salesData?.overallSummary || {};
  const foodSummary = salesData?.foodSummary || {};
  const foodOrders = salesData?.foodOrders || [];
  const deliveryBoys = salesData?.deliveryBoysSummary || [];
  const restaurants = salesData?.restaurantsSummary || [];

  // Filter orders by search
  const filteredFoodOrders = useMemo(() => {
    if (!searchTerm.trim()) return foodOrders;
    const term = searchTerm.toLowerCase();
    return foodOrders.filter(
      (o) =>
        (o.orderId && o.orderId.toLowerCase().includes(term)) ||
        (o.storeName && o.storeName.toLowerCase().includes(term)) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(term)) ||
        (o.deliveryPartner?.name && o.deliveryPartner.name.toLowerCase().includes(term))
    );
  }, [foodOrders, searchTerm]);

  const filteredRiders = useMemo(() => {
    if (!searchTerm.trim()) return deliveryBoys;
    const term = searchTerm.toLowerCase();
    return deliveryBoys.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.phone && r.phone.toLowerCase().includes(term))
    );
  }, [deliveryBoys, searchTerm]);

  const filteredRestaurants = useMemo(() => {
    if (!searchTerm.trim()) return restaurants;
    const term = searchTerm.toLowerCase();
    return restaurants.filter(
      (r) =>
        (r.restaurantName && r.restaurantName.toLowerCase().includes(term)) ||
        (r.area && r.area.toLowerCase().includes(term))
    );
  }, [restaurants, searchTerm]);

  const formattedDateHeader = useMemo(() => {
    if (!selectedDate) return "";
    const [year, month, day] = selectedDate.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [selectedDate]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-red-200">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                Daily Sales & Cash Audit
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                {formattedDateHeader}
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Preset Buttons */}
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayStr())}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedDate === getTodayStr()
                ? "bg-neutral-900 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(getYesterdayStr())}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedDate === getYesterdayStr()
                ? "bg-neutral-900 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            Yesterday
          </button>

          {/* Date Picker Input */}
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 h-4 w-4 text-neutral-500 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getTodayStr()}
              className="pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-300 bg-white text-neutral-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
            />
          </div>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              fetchSalesData(selectedDate, true).finally(() => {
                setTimeout(() => setIsRefreshing(false), 500);
              });
            }}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 transition-all cursor-pointer"
            title="Refresh daily data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-neutral-900" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Delivered Orders */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Delivered</span>
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <PackageCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{overall.totalOrders || 0}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            {foodSummary.totalOrders || 0} Food Orders
          </p>
        </div>

        {/* Total Paid (Gross Sales) */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Total Paid</span>
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{INR(overall.totalCustomerPaid)}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Customer gross payments</p>
        </div>

        {/* Store Share */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Restaurants Net</span>
            <span className="p-1.5 rounded-xl bg-orange-50 text-orange-600">
              <Store className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{INR(overall.totalStoreEarned)}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Net restaurant earnings</p>
        </div>

        {/* Admin Earned */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Admin Cut</span>
            <span className="p-1.5 rounded-xl bg-violet-50 text-violet-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{INR(overall.totalAdminEarned)}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Commission + Platform + GST</p>
        </div>

        {/* Delivery Boy Earning */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Rider Fees</span>
            <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Bike className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{INR(overall.totalRiderEarned)}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Earned by delivery partners</p>
        </div>

        {/* COD Cash in Hand (CRITICAL FOCUS) */}
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">COD In Hand</span>
            <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
              <Banknote className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-amber-900 mt-2">{INR(overall.totalCodCollected)}</p>
          <p className="text-[10px] font-bold text-amber-700 mt-0.5">Physical cash with riders</p>
        </div>

        {/* Online / Digital Paid */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Online Paid</span>
            <span className="p-1.5 rounded-xl bg-cyan-50 text-cyan-600">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl font-black text-neutral-900 mt-2">{INR(overall.totalOnlinePaid)}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Razorpay, QR & Wallet</p>
        </div>
      </div>

      {/* Main Tab Navigation & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "food"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" />
            <span>Food Orders</span>
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
              {foodOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("riders")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "riders"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <Bike className="h-4 w-4" />
            <span>Delivery Boys Reconciliation</span>
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
              {deliveryBoys.length} riders
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("restaurants")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "restaurants"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <Store className="h-4 w-4" />
            <span>Restaurants Summary</span>
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
              {restaurants.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search order, restaurant, rider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Content Sections based on Active Tab */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-neutral-300 border-t-neutral-900 mb-3" />
          <p className="text-sm font-semibold">Loading daily audit for {selectedDate}...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: FOOD ORDERS */}
          {activeTab === "food" && (
            <div className="space-y-6">
              {/* Food Module Specific KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Food Delivered Sales</span>
                  <p className="text-xl font-black text-neutral-900 mt-1">{INR(foodSummary.totalCustomerPaid)}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{foodSummary.totalOrders} total orders delivered</p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Restaurants Earned</span>
                  <p className="text-xl font-black text-orange-600 mt-1">{INR(foodSummary.totalStoreEarned)}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Net food sales payable</p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Admin Cut (Food)</span>
                  <p className="text-xl font-black text-violet-600 mt-1">{INR(foodSummary.totalAdminEarned)}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Commission + Platform Fee</p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Food Riders Earning</span>
                  <p className="text-xl font-black text-indigo-600 mt-1">{INR(foodSummary.totalRiderEarned)}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">COD Cash: {INR(foodSummary.totalCodCollected)}</p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-neutral-500">Avg Delivery Time</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    {formatDuration(foodSummary.avgDeliveryTimeMinutes)}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Average delivery speed</p>
                </div>
              </div>

              {/* Delivery Boys in Food Orders */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bike className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-base font-bold text-neutral-900">
                      Delivery Boys - Food Cash & Orders Breakdown
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">
                    {deliveryBoys.filter((r) => r.foodOrdersCount > 0).length} active riders today
                  </span>
                </div>

                {deliveryBoys.filter((r) => r.foodOrdersCount > 0).length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">No delivery riders had delivered food orders on this date.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deliveryBoys
                      .filter((r) => r.foodOrdersCount > 0)
                      .map((rider) => (
                        <div
                          key={rider.partnerId}
                          className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-2.5 hover:bg-white hover:shadow-xs transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-neutral-900">{rider.name}</p>
                              <p className="text-[11px] text-neutral-500">{rider.phone || "No phone"} • {rider.vehicleType}</p>
                            </div>
                            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">
                              {rider.foodOrdersCount} delivered
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 border-t border-neutral-200/80 pt-2 text-center">
                            <div>
                              <p className="text-[10px] text-neutral-400 font-semibold uppercase">Earned</p>
                              <p className="text-xs font-bold text-neutral-900">{INR(rider.foodEarnings)}</p>
                            </div>
                            <div className="bg-amber-100/70 rounded-lg py-1">
                              <p className="text-[10px] text-amber-800 font-bold uppercase">COD Cash</p>
                              <p className="text-xs font-black text-amber-900">{INR(rider.codCashCollected)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-neutral-400 font-semibold uppercase">Online</p>
                              <p className="text-xs font-bold text-cyan-700">{INR(rider.onlinePaymentsHandled)}</p>
                            </div>
                          </div>

                          <div className="text-[10px] text-neutral-500 flex flex-wrap gap-1 items-center">
                            <span className="font-semibold text-neutral-600">Orders:</span>
                            {rider.ordersList.slice(0, 4).map((o) => (
                              <span
                                key={o.orderId}
                                onClick={() => navigate(`/admin/food/orders/all?search=${encodeURIComponent(o.orderId)}`)}
                                className="underline text-indigo-600 cursor-pointer hover:text-indigo-800"
                              >
                                #{o.orderId}{typeof o.deliveryDurationMinutes === "number" ? ` (${o.deliveryDurationMinutes}m)` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Detailed Food Orders List */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-neutral-900">
                    Delivered Food Orders Details ({filteredFoodOrders.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/food/orders/all")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    View All Orders Page <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {filteredFoodOrders.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-semibold">No delivered food orders found for this date.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-600 uppercase font-bold text-[10px] tracking-wider border-y border-neutral-200">
                        <tr>
                          <th className="px-3 py-2.5">Order ID</th>
                          <th className="px-3 py-2.5">Restaurant</th>
                          <th className="px-3 py-2.5">Customer</th>
                          <th className="px-3 py-2.5">Delivery Boy</th>
                          <th className="px-3 py-2.5">Delivery Time</th>
                          <th className="px-3 py-2.5">Payment</th>
                          <th className="px-3 py-2.5 text-right">Customer Paid</th>
                          <th className="px-3 py-2.5 text-right">Restaurant</th>
                          <th className="px-3 py-2.5 text-right">Admin</th>
                          <th className="px-3 py-2.5 text-right">Rider</th>
                          <th className="px-3 py-2.5 text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredFoodOrders.map((order) => {
                          const isExpanded = expandedOrders.has(order.id);
                          return (
                            <React.Fragment key={order.id}>
                              <tr className="hover:bg-neutral-50/80">
                                <td className="px-3 py-3 font-mono font-bold text-neutral-900">
                                  <span
                                    onClick={() => navigate(`/admin/food/orders/all?search=${encodeURIComponent(order.orderId)}`)}
                                    className="cursor-pointer hover:underline text-indigo-600"
                                  >
                                    #{order.orderId}
                                  </span>
                                </td>
                                <td className="px-3 py-3 font-medium text-neutral-800">{order.storeName}</td>
                                <td className="px-3 py-3 text-neutral-600">
                                  <p className="font-semibold text-neutral-900">{order.customer?.name}</p>
                                  <p className="text-[10px] text-neutral-400">{order.customer?.phone}</p>
                                </td>
                                <td className="px-3 py-3">
                                  {order.deliveryPartner ? (
                                    <div>
                                      <p className="font-semibold text-neutral-900">{order.deliveryPartner.name}</p>
                                      <p className="text-[10px] text-neutral-400">{order.deliveryPartner.phone}</p>
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 italic">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {typeof order.deliveryDurationMinutes === "number" ? (
                                    <div>
                                      <span
                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                          order.deliveryDurationMinutes <= 25
                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                                            : order.deliveryDurationMinutes <= 40
                                            ? "bg-amber-50 text-amber-900 border border-amber-300"
                                            : "bg-rose-50 text-rose-900 border border-rose-300"
                                        }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {formatDuration(order.deliveryDurationMinutes)}
                                      </span>
                                      {(order.createdAt || order.deliveredAt) && (
                                        <p className="text-[10px] text-neutral-400 mt-0.5 whitespace-nowrap">
                                          {formatTimeOnly(order.createdAt)} → {formatTimeOnly(order.deliveredAt)}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 text-xs italic">--</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      order.payment.isCod
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-cyan-100 text-cyan-800 border border-cyan-200"
                                    }`}
                                  >
                                    {order.payment.isCod ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                                    {order.payment.method}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right font-black text-neutral-900">
                                  {INR(order.pricing.totalPaid)}
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-orange-600">
                                  {INR(order.shares.storeEarned)}
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-violet-600">
                                  {INR(order.shares.adminEarned)}
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-indigo-600">
                                  {INR(order.shares.riderEarned)}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandOrder(order.id)}
                                    className="p-1 rounded-lg hover:bg-neutral-200 text-neutral-500 cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row Breakdown */}
                              {isExpanded && (
                                <tr className="bg-neutral-50/60">
                                  <td colSpan="11" className="px-4 py-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3 rounded-xl border border-neutral-200 text-xs">
                                      <div>
                                        <p className="font-bold text-neutral-500 uppercase text-[10px]">Pricing Components</p>
                                        <p className="mt-1">Subtotal: {INR(order.pricing.subtotal)}</p>
                                        <p>Packaging Fee: {INR(order.pricing.packagingFee)}</p>
                                        <p>Delivery Fee: {INR(order.pricing.deliveryFee)}</p>
                                        <p>Platform Fee: {INR(order.pricing.platformFee)}</p>
                                        <p>Tax / GST: {INR(order.pricing.tax)}</p>
                                        {order.pricing.discount > 0 && <p className="text-red-500">Discount: -{INR(order.pricing.discount)}</p>}
                                      </div>

                                      <div>
                                        <p className="font-bold text-neutral-500 uppercase text-[10px]">Rider Cash Status</p>
                                        <p className="mt-1 font-semibold">
                                          Mode: {order.payment.isCod ? "Cash on Delivery (COD)" : "Digital Online"}
                                        </p>
                                        {order.payment.isCod ? (
                                          <p className="text-amber-800 font-bold bg-amber-50 p-1 rounded mt-1">
                                            Rider collected {INR(order.pricing.totalPaid)} cash in hand
                                          </p>
                                        ) : (
                                          <p className="text-cyan-800 font-semibold bg-cyan-50 p-1 rounded mt-1">
                                            Paid digitally via {order.payment.method}
                                          </p>
                                        )}
                                        <p className="text-neutral-500 text-[11px] mt-1">Rider Payout: {INR(order.shares.riderEarned)}</p>
                                      </div>

                                      <div>
                                        <p className="font-bold text-neutral-500 uppercase text-[10px]">Store & Admin Cut</p>
                                        <p className="mt-1">Commission: {INR(order.pricing.commission)}</p>
                                        <p className="text-orange-600 font-semibold">Restaurant Net: {INR(order.shares.storeEarned)}</p>
                                        <p className="text-violet-600 font-semibold">Admin Net: {INR(order.shares.adminEarned)}</p>
                                      </div>

                                      <div>
                                        <p className="font-bold text-neutral-500 uppercase text-[10px]">Delivery Timeline</p>
                                        <div className="mt-1 space-y-1">
                                          <p className="text-neutral-600">
                                            Placed: <span className="font-semibold text-neutral-800">{formatTimeOnly(order.createdAt) || "--"}</span>
                                          </p>
                                          <p className="text-neutral-600">
                                            Delivered: <span className="font-semibold text-neutral-800">{formatTimeOnly(order.deliveredAt) || "--"}</span>
                                          </p>
                                          <div className="pt-1 border-t border-neutral-100">
                                            <span className="font-bold text-neutral-700">Time Taken: </span>
                                            <span className={`font-bold ${
                                              (order.deliveryDurationMinutes || 0) <= 25
                                                ? "text-emerald-700"
                                                : (order.deliveryDurationMinutes || 0) <= 40
                                                ? "text-amber-700"
                                                : "text-rose-700"
                                            }`}>
                                              {formatDuration(order.deliveryDurationMinutes)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <p className="font-bold text-neutral-500 uppercase text-[10px]">Items Summary</p>
                                        <p className="text-neutral-600 mt-1 line-clamp-2">{order.itemsSummary || "Details unavailable"}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DELIVERY BOYS RECONCILIATION */}
          {activeTab === "riders" && (
            <div className="space-y-6">
              {/* Riders Executive KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Active Riders Today</span>
                  <p className="text-2xl font-black text-neutral-900 mt-1">{deliveryBoys.length}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{overall.totalOrders} total delivered orders</p>
                </div>

                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 shadow-xs">
                  <span className="text-xs font-black text-amber-800">Total COD Cash Collected to Deposit</span>
                  <p className="text-2xl font-black text-amber-900 mt-1">{INR(overall.totalCodCollected)}</p>
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">Physical cash in hand across all riders</p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-neutral-500">Total Rider Delivery Earnings</span>
                  <p className="text-2xl font-black text-indigo-600 mt-1">{INR(overall.totalRiderEarned)}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Total payout earned by riders today</p>
                </div>
              </div>

              {/* Riders Comprehensive List */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-neutral-900">
                    Delivery Partners Cash & Payout Audit ({filteredRiders.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/food/delivery-partners/cash-limit-settlement")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Open Rider Settlement <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {filteredRiders.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-semibold">No delivery partners delivered orders on this date.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-600 uppercase font-bold text-[10px] tracking-wider border-y border-neutral-200">
                        <tr>
                          <th className="px-3 py-2.5">Delivery Boy</th>
                          <th className="px-3 py-2.5">Vehicle</th>
                          <th className="px-3 py-2.5 text-center">Food Orders</th>
                          <th className="px-3 py-2.5 text-center">Total Delivered</th>
                          <th className="px-3 py-2.5 text-right">Rider Earnings</th>
                          <th className="px-3 py-2.5 text-right font-black text-amber-900 bg-amber-50">COD Cash Collected</th>
                          <th className="px-3 py-2.5 text-right">Online Payments</th>
                          <th className="px-3 py-2.5">Order IDs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredRiders.map((rider) => (
                          <tr key={rider.partnerId} className="hover:bg-neutral-50/80">
                            <td className="px-3 py-3">
                              <p className="font-bold text-neutral-900">{rider.name}</p>
                              <p className="text-[11px] text-neutral-400">{rider.phone || "No phone"}</p>
                            </td>
                            <td className="px-3 py-3 text-neutral-600">{rider.vehicleType}</td>
                            <td className="px-3 py-3 text-center font-semibold text-orange-700">{rider.foodOrdersCount}</td>
                            <td className="px-3 py-3 text-center font-black text-neutral-900">
                              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-bold">
                                {rider.totalOrdersCount}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-indigo-600">
                              {INR(rider.totalEarnings)}
                            </td>
                            <td className="px-3 py-3 text-right font-black text-amber-900 bg-amber-50/60">
                              {INR(rider.codCashCollected)}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-cyan-700">
                              {INR(rider.onlinePaymentsHandled)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {rider.ordersList.map((o) => (
                                  <span
                                    key={o.orderId}
                                    onClick={() => navigate(`/admin/food/orders/all?search=${encodeURIComponent(o.orderId)}`)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                                      o.isCod
                                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                        : "bg-cyan-100 text-cyan-800 hover:bg-cyan-200"
                                    }`}
                                    title={`${o.isCod ? "COD" : "Online"}: ${INR(o.totalPaid)}`}
                                  >
                                    #{o.orderId}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RESTAURANTS SUMMARY */}
          {activeTab === "restaurants" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-orange-600" />
                    <h2 className="text-base font-bold text-neutral-900">
                      Restaurants Today's Earnings Summary ({filteredRestaurants.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/food/restaurant-report")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                  >
                    View Restaurant Report <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {filteredRestaurants.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-semibold">No restaurants with delivered orders on this date.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-600 uppercase font-bold text-[10px] tracking-wider border-y border-neutral-200">
                        <tr>
                          <th className="px-3 py-2.5">Restaurant</th>
                          <th className="px-3 py-2.5 text-center">Orders Delivered</th>
                          <th className="px-3 py-2.5 text-right">Gross Sales</th>
                          <th className="px-3 py-2.5 text-right">Admin Commission</th>
                          <th className="px-3 py-2.5 text-right">Net Payable to Restaurant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredRestaurants.map((rest) => (
                          <tr key={rest.restaurantId} className="hover:bg-neutral-50/80">
                            <td className="px-3 py-2.5 font-bold text-neutral-900">
                              {rest.restaurantName}
                              {rest.area && <span className="text-neutral-400 font-normal ml-1">({rest.area})</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-neutral-700">{rest.ordersCount}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-neutral-900">{INR(rest.grossSales)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-violet-600">-{INR(rest.commissionDeducted)}</td>
                            <td className="px-3 py-2.5 text-right font-black text-orange-600">{INR(rest.netPayable)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
