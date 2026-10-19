// HubFinance "Get report -> Download PDF". The web rendered this HTML in an offscreen iframe,
// captured it with html2canvas and saved it with jsPDF; here expo-print renders the same HTML to
// an A4 PDF that is handed to the share sheet under the web's file name.
import dayjs from "dayjs";
import { shareReceiptPdf } from "../orders/orderReceiptPdf";
import { formatINR } from "./format";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money2 = (v) => formatINR(Number(v || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// toLocaleDateString("en-IN") -> "19/10/2026"
const dateIN = (v) => dayjs(v).format("D/M/YYYY");

/** HubFinance getReportData(). */
export function buildReportData({ financeData, pastCyclesData, selectedDateRange, currentCycleDates }) {
  const currentCycle = financeData?.currentCycle || {};
  const allOrdersMap = new Map();
  if (Array.isArray(financeData?.currentCycle?.orders)) {
    financeData.currentCycle.orders.forEach((order) => {
      if (order.orderId) allOrdersMap.set(order.orderId, { ...order, cycle: "Current Cycle" });
    });
  }
  if (Array.isArray(pastCyclesData?.orders)) {
    pastCyclesData.orders.forEach((order) => {
      if (order.orderId && !allOrdersMap.has(order.orderId)) {
        allOrdersMap.set(order.orderId, { ...order, cycle: "Past Cycle" });
      }
    });
  }
  return {
    restaurantName: financeData?.restaurant?.name || "Restaurant",
    restaurantId: financeData?.restaurant?.restaurantId || "N/A",
    dateRange: selectedDateRange,
    currentCycle: {
      ...currentCycleDates,
      estimatedPayout: `₹${money2(currentCycle.estimatedPayout)}`,
      orders: currentCycle.totalOrders || 0,
      payoutDate: currentCycle.payoutDate ? dateIN(currentCycle.payoutDate) : "-",
    },
    pastCycles: pastCyclesData,
    allOrders: Array.from(allOrdersMap.values()),
  };
}

export function buildReportHtml(reportData) {
  const totalEarnings = (reportData.allOrders || [])
    .reduce((sum, order) => sum + (order.payout || order.restaurantEarning || 0), 0)
    .toFixed(2);
  const rows = (reportData.allOrders || [])
    .map((order) => {
      const orderDate = order.createdAt ? dateIN(order.createdAt) : order.deliveredAt ? dateIN(order.deliveredAt) : "N/A";
      const foodItems = order.foodNames || (order.items && order.items.map((item) => item.name).join(", ")) || "N/A";
      const itemQuantities = order.items ? order.items.map((item) => String(item.quantity || 1)).join(", ") : "N/A";
      const orderAmount = Number(order.totalAmount || order.orderTotal || order.amount || 0);
      const earning = Number(order.payout || order.restaurantEarning || 0);
      return `
        <tr>
          <td>${esc(order.cycle || "N/A")}</td>
          <td>${esc(order.orderId || "N/A")}</td>
          <td>${esc(orderDate)}</td>
          <td>${esc(foodItems)}</td>
          <td>${esc(itemQuantities)}</td>
          <td>₹${orderAmount.toFixed(2)}</td>
          <td>₹${earning.toFixed(2)}</td>
        </tr>`;
    })
    .join("");
  const c = reportData.currentCycle;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Finance Report - ${esc(reportData.dateRange)}</title>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; background-color: #fff; box-sizing: border-box; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { margin: 0; font-size: 28px; color: #000; text-transform: uppercase; letter-spacing: 1px; }
    .header p { margin: 5px 0; font-size: 14px; color: #444; }
    .section { margin-bottom: 30px; clear: both; }
    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #000; border-left: 4px solid #000; padding-left: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #ddd; }
    .current-cycle { background-color: #fcfcfc; padding: 25px; border: 1px solid #eee; border-radius: 12px; margin-bottom: 25px; page-break-inside: avoid; }
    .payout-amount { font-size: 36px; font-weight: 800; color: #000; margin: 10px 0; }
    .orders-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; border: 1px solid #000; }
    .orders-table th { background-color: #f2f2f2; padding: 12px 8px; text-align: left; border: 1px solid #000; font-weight: bold; font-size: 11px; text-transform: uppercase; }
    .orders-table td { padding: 10px 8px; border: 1px solid #000; font-size: 11px; word-wrap: break-word; vertical-align: top; }
    .footer { margin-top: 50px; padding-top: 25px; border-top: 1px solid #000; text-align: center; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Finance Report</h1>
    <p>${esc(reportData.restaurantName)}</p>
    <p>ID: ${esc(reportData.restaurantId)}</p>
    <p>Generated on: ${esc(dayjs().format("D/M/YYYY, h:mm:ss a"))}</p>
  </div>

  <div class="section">
    <div class="section-title">Current Cycle</div>
    <div class="current-cycle">
      <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">Est. payout (${esc(c.start)} - ${esc(c.end)} ${esc(c.month)})</p>
      <div class="payout-amount">${esc(c.estimatedPayout)}</div>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">${esc(c.orders)} orders</p>
      <div class="info-row">
        <div>
          <p class="info-label" style="font-size: 11px; margin: 5px 0;">Payout for</p>
          <p style="margin: 0; font-weight: 600;">${esc(c.start)} - ${esc(c.end)} ${esc(c.month)}'${esc(c.year)}</p>
        </div>
        <div style="text-align: right;">
          <p class="info-label" style="font-size: 11px; margin: 5px 0;">Payout date</p>
          <p style="margin: 0; font-weight: 600;">${esc(c.payoutDate)}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detailed Order Wise Report</div>
    ${
      reportData.allOrders && reportData.allOrders.length > 0
        ? `<table class="orders-table">
      <thead>
        <tr>
          <th style="width: 14%;">Cycle</th>
          <th style="width: 15%;">Order ID</th>
          <th style="width: 12%;">Date</th>
          <th style="width: 28%;">Items</th>
          <th style="width: 8%;">Qty</th>
          <th style="width: 11%;">Amount</th>
          <th style="width: 12%;">Earning</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background-color: #e8f5e9; font-weight: bold;">
          <td colspan="5" style="text-align: right;">Total Earnings:</td>
          <td colspan="2">₹${totalEarnings}</td>
        </tr>
      </tfoot>
    </table>`
        : `<div class="info-row"><span class="info-label">Status:</span><span class="info-value">No orders available</span></div>`
    }
  </div>

  <div class="footer">
    <p>This is an auto-generated report. For detailed information, please visit the Finance section.</p>
    <p>Total Orders: ${reportData.allOrders?.length || 0} | Total Earnings: ₹${totalEarnings}</p>
  </div>
</body>
</html>`;
}

/** Render and share; resolves with the PDF uri. */
export async function shareFinanceReport(reportData) {
  const fileName = `finance-report-${String(reportData.dateRange).replace(/\s+/g, "-").replace(/'/g, "")}_${new Date()
    .toISOString()
    .split("T")[0]}.pdf`;
  return shareReceiptPdf(buildReportHtml(reportData), fileName);
}
