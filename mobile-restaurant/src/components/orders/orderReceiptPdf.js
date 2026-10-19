// OrderDetails "Download" receipt. The web drew an A4 PDF with jsPDF and saved
// Order_Receipt_<id>.pdf; here the same layout is HTML rendered by expo-print and handed to the
// share sheet under the same file name.
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (v) => `Rs. ${Number(v || 0).toFixed(2)}`;
const discount = (v) => `-Rs. ${Math.abs(Number(v || 0)).toFixed(2)}`;

/** orderData: the OrderDetails transformed order. generatedOn: the footer timestamp text. */
export function buildOrderReceiptHtml(orderData, generatedOn) {
  const b = orderData.billing;
  const statusStr = String(orderData.status || "").toUpperCase();
  const statusColor =
    statusStr === "DELIVERED" ? "rgb(22,163,74)" : ["CANCELLED", "REJECTED"].includes(statusStr) ? "rgb(220,38,38)" : "#000";

  const billRows = [["Item Subtotal:", money(b.itemSubtotal)]];
  if (Number(b.packagingFee) > 0) billRows.push(["Packaging Fee:", money(b.packagingFee)]);
  if (Number(b.restaurantCommission) > 0) billRows.push(["Restaurant Commission:", discount(b.restaurantCommission)]);
  if (Number(b.gstOnItem) > 0) billRows.push(["GST on Item:", discount(b.gstOnItem)]);
  if (Number(b.gstOnCommission) > 0) billRows.push(["GST on Commission:", discount(b.gstOnCommission)]);
  if (Number(b.paymentGatewayFee) > 0) billRows.push(["Payment Gateway Fee:", discount(b.paymentGatewayFee)]);
  if (Number(b.tcs) > 0) billRows.push(["TCS:", discount(b.tcs)]);

  const items = orderData.items
    .map(
      (item) => `
      <div class="item">
        <div class="row bold"><span>${esc(item.quantity)} x ${esc(item.name)}</span><span>${esc(money(item.price))}</span></div>
        <div class="item-type">${esc(item.type)}</div>
      </div>`,
    )
    .join("");

  const bills = billRows
    .map(
      ([label, value]) =>
        `<div class="row bill"><span>${esc(label)}</span><span${value.startsWith("-") ? ' class="red"' : ""}>${esc(value)}</span></div>`,
    )
    .join("");

  const timeline = orderData.timeline
    .map((event) => {
      const dot = event.status === "completed" ? "rgb(22,163,74)" : event.status === "rejected" ? "rgb(220,38,38)" : "rgb(156,163,175)";
      return `
      <div class="event">
        <span class="dot" style="background:${dot}"></span>
        <div><div class="bold">${esc(event.event)}</div><div class="event-time">${esc(event.timestamp || "-")}</div></div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #000; }
  .frame { position: fixed; top: 5mm; left: 5mm; right: 5mm; bottom: 5mm; border: 0.5mm solid #000; }
  .page { padding: 14mm 15mm 20mm 15mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .title { font-size: 18pt; font-weight: bold; }
  .address { font-size: 10pt; margin-top: 2mm; }
  .receipt { font-size: 16pt; font-weight: bold; margin-top: 10mm; margin-bottom: 6mm; }
  .detail { display: flex; margin-bottom: 2.5mm; }
  .detail .label { width: 35mm; font-weight: bold; flex-shrink: 0; }
  h3 { font-size: 12pt; margin: 6mm 0 3mm 0; }
  .row { display: flex; justify-content: space-between; gap: 6mm; }
  .item { margin-top: 2mm; margin-bottom: 3mm; }
  .item-type { font-size: 8pt; color: rgb(100,100,100); margin-top: 1mm; }
  .rule { border-top: 0.5mm solid #000; margin: 4mm 0; }
  .bill { margin-bottom: 2mm; }
  .red { color: rgb(220,38,38); }
  .gets { color: rgb(30,58,138); font-weight: bold; font-size: 11pt; }
  .pay-status { font-style: italic; margin-top: 2mm; }
  .reason { margin-top: 6mm; color: rgb(220,38,38); }
  .reason .text { font-size: 9pt; margin-top: 2mm; }
  .event { display: flex; align-items: flex-start; gap: 4mm; margin-bottom: 3mm; }
  .dot { width: 4mm; height: 4mm; border-radius: 50%; margin-top: 0.5mm; flex-shrink: 0; }
  .event-time { font-size: 8pt; color: rgb(100,100,100); margin-top: 1mm; }
  .footer { margin-top: 12mm; text-align: center; font-size: 8pt; font-style: italic; color: rgb(100,100,100); }
</style>
</head>
<body>
  <div class="frame"></div>
  <div class="page">
    <div class="center title">${esc(orderData.restaurant)}</div>
    <div class="center address">${esc(orderData.address)}</div>
    <div class="center receipt">RESTAURANT RECEIPT</div>

    <div class="detail"><span class="label">Order ID:</span><span>${esc(orderData.id)}</span></div>
    <div class="detail"><span class="label">Date &amp; Time:</span><span>${esc(`${orderData.date}, ${orderData.time}`)}</span></div>
    <div class="detail"><span class="label">Status:</span><span style="color:${statusColor}">${esc(orderData.status)}</span></div>

    <h3>CUSTOMER DETAILS</h3>
    <div class="detail"><span class="label">Name:</span><span>${esc(orderData.customer.name)}</span></div>
    <div class="detail"><span class="label">Location:</span><span>${esc(orderData.customer.location || "-")}</span></div>
    <div class="detail"><span class="label">Distance:</span><span>${esc(orderData.customer.distance || "-")}</span></div>

    <h3>ITEM DETAILS</h3>
    ${items}

    <div class="rule"></div>
    <h3 style="margin-top:0">RESTAURANT PAYOUT</h3>
    ${bills}
    <div class="rule"></div>
    <div class="row gets"><span>Restaurant Gets:</span><span>${esc(money(b.restaurantGets))}</span></div>
    <div class="pay-status">Payment Status: ${esc(b.paymentStatus)}</div>

    ${
      orderData.reason
        ? `<div class="reason"><div class="bold">REASON:</div><div class="text">${esc(orderData.reason)}</div></div>`
        : ""
    }

    <div class="rule"></div>
    <h3 style="margin-top:0">ORDER TIMELINE</h3>
    ${timeline}

    <div class="footer">
      <div>Thank you for your business!</div>
      <div>Generated on: ${esc(generatedOn)}</div>
    </div>
  </div>
</body>
</html>`;
}

// Render to an A4 PDF named `filename` and open the share sheet (the web's doc.save()).
export async function shareReceiptPdf(html, filename) {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  let shareUri = uri;
  try {
    const target = new File(Paths.cache, filename);
    if (target.exists) target.delete();
    new File(uri).move(target);
    shareUri = target.uri;
  } catch {
    // keep the generated name
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: filename });
  }
  return shareUri;
}
