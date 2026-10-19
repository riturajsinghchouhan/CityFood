// Invoice PDFs. The web built them with jsPDF (UserOrderDetails) and html2canvas + jsPDF
// (OrderInvoice) and downloaded the file; here the same layouts are HTML for expo-print,
// and the PDF is handed to the share sheet.
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Render HTML to a PDF named `filename` and open the share sheet.
export async function sharePdf(html, filename) {
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

export function printHtml(html) {
  return Print.printAsync({ html });
}

/**
 * UserOrderDetails "Invoice" (jsPDF, A4 in mm): red INVOICE title, platform and restaurant
 * blocks, order / billed-to info, striped item table with a red header, totals and footer.
 */
export function buildSummaryInvoiceHtml({
  settings = {},
  companyName,
  restaurantName,
  restaurantLocation,
  restaurantFssai,
  restaurantGstin,
  orderIdDisplay,
  paymentDate,
  paymentMethod,
  userName,
  addressText,
  items = [],
  pricing = {},
}) {
  const logoUrl = settings.logo?.url;
  const rows = items
    .map((item, index) => {
      const discounted = Number(item.price) || 0;
      const original = Math.max(discounted, Number(item.originalPrice) || 0);
      const qty = item.quantity || item.qty || 1;
      const unit = original > discounted ? `Rs. ${original.toFixed(2)} -> Rs. ${discounted.toFixed(2)}` : `Rs. ${discounted.toFixed(2)}`;
      const line =
        original > discounted
          ? `Rs. ${(original * qty).toFixed(2)} -> Rs. ${(discounted * qty).toFixed(2)}`
          : `Rs. ${(discounted * qty).toFixed(2)}`;
      const name = item.variantName ? `${item.name || "Item"} (${item.variantName})` : item.name || "Item";
      return `<tr><td class="c">${index + 1}</td><td>${esc(name)}</td><td class="c">${qty}</td><td class="r">${unit}</td><td class="r">${line}</td></tr>`;
    })
    .join("");

  const subtotal = Number(pricing.subtotal || pricing.total || 0);
  const tax = Number(pricing.tax || 0);
  const deliveryFee = Number(pricing.deliveryFee || 0);
  const platformFee = Number(pricing.platformFee || 0);
  const discount = (Number(pricing.discount) || 0) + (Number(pricing.originalItemTotal) || 0) - (Number(pricing.subtotal) || 0);
  const total = Number(pricing.total || 0);
  const totalRow = (label, value) => `<tr><td>${label}</td><td class="r">${value}</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #0f172b; }
  .page { position: relative; width: 210mm; min-height: 297mm; padding: 15mm 14mm 20mm; }
  .border { position: absolute; left: 5mm; top: 5mm; right: 5mm; bottom: 5mm; border: 0.35mm solid #e2e8f0; }
  .logo { position: absolute; left: 14mm; top: 15mm; width: 30mm; height: 30mm; object-fit: contain; }
  h1 { margin: 4mm 0 0; text-align: center; color: #dc2626; font-size: 22pt; }
  .cols { display: flex; margin-top: 21mm; }
  .col { width: 96mm; font-size: 9pt; color: #45556c; line-height: 1.45; }
  .col b.name { display: block; font-size: 11pt; color: #0f172b; margin-bottom: 1mm; }
  .col .addr { width: 85mm; min-height: 14mm; }
  hr { border: 0; border-top: 0.18mm solid #e2e8f0; margin: 4mm 0 6mm; }
  .info { display: flex; font-size: 9pt; color: #45556c; line-height: 1.6; }
  .info b { color: #0f172b; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8mm; font-size: 9pt; }
  table.items th { background: #dc2626; color: #fff; text-align: left; padding: 4mm 1.4mm; }
  table.items td { padding: 4mm 1.4mm; }
  table.items tbody tr:nth-child(odd) td { background: #f5f5f5; }
  .c { text-align: center; } .r { text-align: right; }
  table.totals { margin: 6mm 0 0 auto; width: 56mm; font-size: 9pt; color: #45556c; border-collapse: collapse; }
  table.totals td { padding: 0.8mm 0; }
  table.totals tr.grand td { padding-top: 3mm; font-weight: bold; font-size: 11pt; color: #0f172b; }
  .foot { position: absolute; left: 0; right: 0; bottom: 13mm; text-align: center; font-style: italic; font-size: 8pt; color: #90a1b9; }
</style></head><body><div class="page"><div class="border"></div>
  ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" />` : ""}
  <h1>INVOICE</h1>
  <div class="cols">
    <div class="col"><b class="name">${esc(companyName)}</b>
      <div class="addr">${esc(settings.address || "")}</div>
      FSSAI: ${esc(settings.fssai || "N/A")}<br/>GSTIN: ${esc(settings.gstin || "N/A")}</div>
    <div class="col"><b class="name">${esc(restaurantName)}</b>
      <div class="addr">${esc(restaurantLocation || "Address not available")}</div>
      FSSAI: ${esc(restaurantFssai || "N/A")}<br/>GSTIN: ${esc(restaurantGstin || "N/A")}</div>
  </div>
  <hr/>
  <div class="info">
    <div class="col"><b>Order ID: ${esc(orderIdDisplay || "N/A")}</b><br/>Date &amp; Time: ${esc(paymentDate || "N/A")}<br/>Payment: ${esc(paymentMethod)}</div>
    <div class="col"><b>Billed To:</b><br/><span style="color:#0f172b">${esc(userName || "Customer")}</span><br/>${esc(addressText || "Address not available")}</div>
  </div>
  ${
    items.length
      ? `<table class="items"><thead><tr><th class="c" style="width:15mm">S.No</th><th>Item Description</th><th class="c" style="width:15mm">Qty</th><th class="r" style="width:35mm">Unit Price</th><th class="r" style="width:35mm">Total Price</th></tr></thead><tbody>${rows}</tbody></table>`
      : ""
  }
  <table class="totals">
    ${totalRow("Item Total:", `Rs. ${subtotal.toFixed(2)}`)}
    ${tax > 0 ? totalRow("GST (gov. taxes):", `Rs. ${tax.toFixed(2)}`) : ""}
    ${totalRow("Delivery Fee:", deliveryFee > 0 ? `Rs. ${deliveryFee.toFixed(2)}` : "Free")}
    ${platformFee > 0 ? totalRow("Platform Fee:", `Rs. ${platformFee.toFixed(2)}`) : ""}
    ${discount > 0 ? totalRow("Discount:", `- Rs. ${discount.toFixed(2)}`) : ""}
    <tr class="grand"><td>Grand Total:</td><td class="r">Rs. ${total.toFixed(2)}</td></tr>
  </table>
  <div class="foot">This is a computer generated invoice and does not require a physical signature.</div>
</div></body></html>`;
}

/** OrderInvoice tax invoice: the on-screen invoice card, as the web printed / rasterized it. */
export function buildTaxInvoiceHtml(inv) {
  const rows = inv.items
    .map((item, index) => {
      const d = Number(item.price) || 0;
      const o = Math.max(d, Number(item.originalPrice) || 0);
      const disc = o > d;
      return `<tr class="row"><td class="c b-r">${index + 1}</td><td class="b-r" style="font-weight:500;color:#101828">${esc(item.name)} ${item.variantName ? `(${esc(item.variantName)})` : ""}</td><td class="c b-r" style="font-weight:bold">${item.quantity}</td><td class="r b-r">${disc ? `<span class="strike">₹${o.toFixed(2)}</span>` : ""}<span style="${disc ? "font-weight:bold;color:#008236" : ""}">₹${d.toFixed(2)}</span></td><td class="r" style="font-weight:bold;color:#101828">${disc ? `<span class="strike" style="font-weight:normal">₹${(o * item.quantity).toFixed(2)}</span>` : ""}₹${(d * item.quantity).toFixed(2)}</td></tr>`;
    })
    .join("");
  const extra = (label, value, style = "font-weight:500") =>
    `<tr class="t1"><td colspan="4" class="r b-r lbl">${label}</td><td class="r" style="${style}">${value}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: Arial, sans-serif; color: #000; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; margin-bottom: 16px; }
  .badge { width: 96px; height: 96px; border-radius: 50%; background: #dc2626; border: 2px solid #c10007; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; }
  .badge .chef { background: #fff; border-radius: 50%; padding: 4px; margin-bottom: 4px; font-size: 24px; line-height: 1; }
  .badge .nm { font-size: 10px; font-weight: bold; letter-spacing: 0.05em; text-align: center; line-height: 1.2; }
  h1 { margin: 0; font-size: 30px; font-weight: 800; color: #1e2939; letter-spacing: 0.025em; text-transform: uppercase; }
  .muted { color: #6a7282; } .small { font-size: 12px; }
  .box { display: flex; border: 1px solid #99a1af; margin-bottom: 24px; font-size: 14px; }
  .half { width: 50%; padding: 16px; }
  .cap { font-size: 12px; color: #6a7282; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; letter-spacing: 0.05em; }
  .grid { display: grid; gap: 4px 8px; margin-top: 8px; font-size: 12px; }
  .grid .k { color: #6a7282; font-weight: 500; } .grid .v { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
  .tbl { border: 1px solid #99a1af; margin-bottom: 24px; }
  th { background: #f3f4f6; border-bottom: 1px solid #99a1af; padding: 8px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #1e2939; }
  td { padding: 8px 12px; color: #1e2939; }
  .b-r { border-right: 1px solid #99a1af; }
  .row { border-bottom: 1px solid #d1d5dc; }
  .c { text-align: center; } .r { text-align: right; }
  .strike { margin-right: 4px; font-size: 10px; color: #99a1af; text-decoration: line-through; }
  .t1 { border-top: 1px solid #d1d5dc; }
  .lbl { font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  .words { border: 1px solid #99a1af; padding: 12px; margin-bottom: 24px; background: #f9fafb; display: flex; align-items: center; }
  .foot { display: flex; border: 1px solid #99a1af; font-size: 10px; }
  ol { padding-left: 16px; margin: 0; color: #4a5565; } li { margin-bottom: 6px; }
</style></head><body>
  <div class="head">
    <div class="badge"><div class="chef">👩‍🍳</div><div class="nm">${esc(inv.companyName.toUpperCase())}</div></div>
    <div style="text-align:right"><h1>Tax Invoice</h1><div class="small muted" style="margin-top:8px;text-transform:uppercase;font-weight:500">Invoice Number</div><div style="font-weight:bold;color:#1e2939">${esc(inv.id)}</div></div>
  </div>
  <div class="box">
    <div class="half" style="border-right:1px solid #99a1af">
      <div class="cap">Sold By / Seller</div>
      <div style="font-weight:bold;color:#1e2939;text-transform:uppercase;font-size:16px">${esc(inv.sellerName)}</div>
      <div style="color:#4a5565;margin:4px 0 16px;line-height:1.375">${inv.sellerLines.map(esc).join("<br/>")}</div>
      <div class="grid" style="grid-template-columns:80px auto">
        <div class="k">GSTIN</div><div class="v">: ${esc(inv.gstNumber || "N/A")}</div>
        <div class="k">FSSAI License</div><div class="v">: ${esc(inv.fssaiNumber || "N/A")}</div>
        <div class="k">PAN</div><div class="v">: ${esc(inv.panNumber || "N/A")}</div>
      </div>
    </div>
    <div class="half">
      <div class="cap">Invoice To</div>
      <div style="font-weight:bold;color:#1e2939;font-size:16px">${esc(inv.customerName)}</div>
      <div style="color:#4a5565;margin:4px 0 16px;line-height:1.375">${inv.customerLines.map(esc).join("<br/>")}</div>
      <div class="grid" style="grid-template-columns:100px auto 1fr;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb">
        <div class="k">Order ID</div><div class="v">:</div><div class="v">${esc(inv.id)}</div>
        <div class="k">Invoice Date</div><div class="v">:</div><div class="v">${esc(inv.date)}</div>
        <div class="k">Payment</div><div class="v">:</div><div class="v">${esc(inv.payment)}</div>
      </div>
    </div>
  </div>
  <div class="tbl"><table>
    <thead><tr><th class="c b-r" style="width:48px">Sr. No</th><th class="b-r">Item Description</th><th class="c b-r" style="width:64px">Qty</th><th class="r b-r" style="width:96px">Unit Price</th><th class="r" style="width:96px">Total</th></tr></thead>
    <tbody>${rows}
      <tr style="border-top:2px solid #99a1af;background:#f9fafb"><td colspan="2" class="r b-r" style="font-weight:bold;text-transform:uppercase;font-size:12px">Total</td><td class="c b-r" style="font-weight:bold">${inv.totalQty}</td><td class="b-r"></td><td class="r" style="font-weight:bold;color:#101828">₹${inv.subtotal.toFixed(2)}</td></tr>
      ${inv.deliveryFee > 0 ? extra("Delivery Charges", `₹${inv.deliveryFee.toFixed(2)}`) : ""}
      ${inv.platformFee > 0 ? extra("Platform Fee", `₹${inv.platformFee.toFixed(2)}`) : ""}
      ${inv.tax > 0 ? extra("GST (Gov. Taxes)", `₹${inv.tax.toFixed(2)}`) : ""}
      ${inv.discount > 0 ? extra("Discount", `-₹${inv.discount.toFixed(2)}`, "font-weight:bold;color:#008236") : ""}
      <tr style="border-top:2px solid #99a1af;background:#f3f4f6"><td colspan="4" class="r b-r" style="padding:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.025em">Grand Total</td><td class="r" style="padding:12px;font-weight:800;font-size:16px;color:#101828">₹${inv.total.toFixed(2)}</td></tr>
    </tbody></table></div>
  <div class="words"><span class="small muted" style="text-transform:uppercase;font-weight:600;letter-spacing:0.05em;margin-right:8px">Amount In Words:</span><span style="font-weight:bold;color:#101828">${esc(inv.amountInWords)}</span></div>
  <div class="foot">
    <div style="width:66.66%;padding:16px;border-right:1px solid #99a1af">
      <div style="font-weight:bold;margin-bottom:8px;text-transform:uppercase;color:#1e2939;letter-spacing:0.05em">Terms &amp; Conditions:</div>
      <ol>
        <li>If you have any issues or queries in respect of your order, please contact customer chat support through the platform.</li>
        <li>In case you need to get more information about the seller's FSSAI status, please visit foscos.fssai.gov.in.</li>
        <li>Please note that we never ask for bank account details such as CVV, account number, UPI Pin, etc. across our support channels.</li>
      </ol>
    </div>
    <div style="width:33.33%;display:flex;flex-direction:column">
      <div style="flex:1;padding:16px;border-bottom:1px solid #99a1af;display:flex;align-items:center;justify-content:center;background:rgba(249,250,251,0.5)">
        <div style="font-family:serif;font-size:20px;color:#6a7282;font-style:italic;transform:rotate(-12deg);opacity:0.8;margin-top:16px">${esc(inv.companyName)}</div>
      </div>
      <div style="padding:8px 0;text-align:center;font-weight:bold;color:#1e2939;text-transform:uppercase;letter-spacing:0.1em;font-size:10px">Authorised Signatory</div>
    </div>
  </div>
</body></html>`;
}
