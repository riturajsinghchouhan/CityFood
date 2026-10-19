// OrdersMain handlePrint: the 80 mm thermal receipt for the new-order popup. The web printed the
// HTML through a hidden iframe; here expo-print opens the system print dialog with the same HTML.
import dayjs from "dayjs";
import * as Print from "expo-print";
import { getBusinessSettings } from "../../api/content";
import { getCurrentRestaurant } from "../../api/profile";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function buildReceiptHtml(order, restaurant = {}, settings = {}) {
  const pricing = order.pricing || {};
  const itemsTotal = order.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
  const subtotal = pricing.subtotal || itemsTotal;
  const tax = pricing.tax || 0;
  const deliveryFee = pricing.deliveryFee || 0;
  const platformFee = pricing.platformFee || 0;
  const total = pricing.total || order.total || subtotal + tax + deliveryFee + platformFee;
  const rawPay = String(order.paymentMethod || order.payment?.method || "").toLowerCase().trim();
  const isCod = rawPay === "cash" || rawPay === "cod";

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <div class="item-row">
          <div class="item-qty">${esc(item.quantity)}x</div>
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-price">Rs.${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</div>
        </div>`,
    )
    .join("");

  // toLocaleString('en-US', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})
  const orderDate = dayjs(order.createdAt || undefined).format("MMM D, hh:mm A");
  const addr = order.customerAddress;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { margin: 0; }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          width: 80mm;
          margin: 0;
          padding: 5mm;
          padding-bottom: 10mm;
          font-size: 12px;
          color: #000;
          box-sizing: border-box;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
        .flex-between { display: flex; justify-content: space-between; }
        .item-row { display: flex; margin-bottom: 5px; }
        .item-qty { width: 15%; font-weight: bold; }
        .item-name { width: 55%; padding-right: 5px; }
        .item-price { width: 30%; text-align: right; }
        h1 { font-size: 16px; margin: 5px 0; }
        h2 { font-size: 14px; margin: 5px 0; }
        p { margin: 3px 0; }
      </style>
    </head>
    <body>
      <div class="center">
        <h1>${esc(restaurant.restaurantName || order.restaurantName || "Restaurant")}</h1>
        ${restaurant.address?.street ? `<p>${esc(restaurant.address.street)}, ${esc(restaurant.address.city || "")}</p>` : ""}
        <p>FSSAI: ${esc(restaurant.fssaiNumber || restaurant.fssai || "N/A")}</p>
      </div>
      <div class="divider"></div>
      <p class="bold">Order ID: #${esc(order.orderId || order._id)}</p>
      <p>Date: ${orderDate}</p>
      <p>Payment: <span class="bold">${isCod ? "Cash on Delivery" : "Paid Online"}</span></p>
      <div class="divider"></div>
      <p class="bold">Customer Details:</p>
      <p>${esc(order.customerName || "Customer")}</p>
      ${addr ? `<p>${esc([addr.street, addr.city].filter(Boolean).join(", "))}</p>` : ""}
      <div class="divider"></div>
      <div class="item-row bold" style="margin-bottom: 8px;">
        <div class="item-qty">Qty</div>
        <div class="item-name">Item</div>
        <div class="item-price">Total</div>
      </div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="flex-between"><span>Item Total:</span><span>Rs.${subtotal.toFixed(2)}</span></div>
      <div class="flex-between"><span>Taxes:</span><span>Rs.${tax.toFixed(2)}</span></div>
      ${deliveryFee > 0 ? `<div class="flex-between"><span>Delivery Fee:</span><span>Rs.${deliveryFee.toFixed(2)}</span></div>` : ""}
      ${platformFee > 0 ? `<div class="flex-between"><span>Platform Fee:</span><span>Rs.${platformFee.toFixed(2)}</span></div>` : ""}
      <div class="divider"></div>
      <div class="flex-between bold" style="font-size: 14px;"><span>GRAND TOTAL:</span><span>Rs.${Number(total).toFixed(2)}</span></div>
      <div class="divider"></div>
      ${
        order.note || order.restaurantNote
          ? `<p class="bold">Notes:</p>
             ${order.note ? `<p>User: ${esc(order.note)}</p>` : ""}
             ${order.restaurantNote ? `<p>Restaurant: ${esc(order.restaurantNote)}</p>` : ""}
             <div class="divider"></div>`
          : ""
      }
      <div class="center" style="margin-top: 15px;">
        <p class="bold">Thank you for ordering!</p>
        <p style="font-size: 10px;">Powered by ${esc(settings.companyName || "CityFood")}</p>
      </div>
    </body>
    </html>`;
}

/** Loads business settings and the restaurant, then opens the print dialog. Throws on failure. */
export async function printOrderReceipt(order) {
  let settings = {};
  try {
    settings = (await getBusinessSettings())?.data || {};
  } catch {
    // web continued without settings
  }
  let restaurant = {};
  try {
    restaurant = (await getCurrentRestaurant())?.data?.restaurant || {};
  } catch {
    // web continued without restaurant details
  }
  await Print.printAsync({ html: buildReceiptHtml(order, restaurant, settings) });
}
