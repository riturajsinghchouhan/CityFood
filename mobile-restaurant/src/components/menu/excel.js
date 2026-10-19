// Inventory bulk upload: Excel template and parsing (Inventory.jsx downloadTemplate /
// handleBulkSubmit). The web loads SheetJS from a CDN; the app cannot install it yet (npm
// allow-remote setting, decision pending). Everything that needs SheetJS is isolated in the two
// functions below, which throw EXCEL_UNAVAILABLE until the library is added. The row mapping
// (rowsToInventoryItems) is the web's and is ready to use with SheetJS' sheet_to_json(header: 1).

export const EXCEL_UNAVAILABLE = "Excel import not available yet";

export const TEMPLATE_FILENAME = "cityfood_inventory_template.xlsx";

export const TEMPLATE_HEADERS = [
  "Name",
  "Description",
  "Price",
  "Category Name",
  "Food Type (Veg/Non-Veg)",
  "Preparation Time",
  "Is Available (TRUE/FALSE)",
  "Image URL",
  "Variants (Name:Price, Name:Price)",
];

export const TEMPLATE_ROWS = [
  ["Chicken Dum Biryani", "Authentic slow-cooked chicken biryani with aromatic spices", 350, "Biryani", "Non-Veg", "30 mins", "TRUE", "https://res.cloudinary.com/demo/image/upload/sample.jpg", "Half:180, Full:350"],
  ["Paneer Tikka", "Grilled cottage cheese cubes marinated in yogurt and spices", 280, "Starters", "Veg", "20 mins", "TRUE", "https://res.cloudinary.com/demo/image/upload/sample.jpg", ""],
];

/**
 * Reads the first sheet of the picked .xlsx/.xls file into a 2D array (header row first),
 * like XLSX.utils.sheet_to_json(worksheet, { header: 1 }).
 * @param {string} fileUri expo-document-picker asset uri
 * @returns {Promise<Array<Array<any>>>}
 */
export async function parseInventoryExcel(fileUri) {
  throw new Error(EXCEL_UNAVAILABLE);
}

/**
 * Writes TEMPLATE_HEADERS + TEMPLATE_ROWS to an .xlsx file in the cache directory and returns
 * its uri (to hand to expo-sharing).
 * @returns {Promise<string>}
 */
export async function writeInventoryTemplate() {
  throw new Error(EXCEL_UNAVAILABLE);
}

// Web header matching, unchanged: rows -> bulkCreateFood items.
export function rowsToInventoryItems(jsonData) {
  const rawHeaders = (jsonData[0] || []).map((h) => String(h || "").trim().toLowerCase());
  const rows = jsonData.slice(1);

  return rows
    .filter((row) => row.length > 0 && row[0])
    .map((row) => {
      const item = {};
      rawHeaders.forEach((header, index) => {
        const val = row[index];
        if (header.includes("variant") || header.includes("variation")) {
          if (val && typeof val === "string") {
            const parsedVariants = val
              .split(",")
              .map((v) => {
                const parts = v.split(":");
                if (parts.length === 2) {
                  const vName = parts[0].trim();
                  const vPrice = Number(parts[1].trim());
                  if (vName && !isNaN(vPrice)) return { name: vName, price: vPrice };
                }
                return null;
              })
              .filter(Boolean);
            if (parsedVariants.length > 0) item.variants = parsedVariants;
          }
        } else if (header === "name") item.name = val;
        else if (header.includes("description")) item.description = val;
        else if (header.includes("price")) item.price = Number(val) || 0;
        else if (header.includes("category")) item.categoryName = val;
        else if (header.includes("type")) item.foodType = val;
        else if (header.includes("prep")) item.preparationTime = val;
        else if (header.includes("available")) item.isAvailable = String(val).toLowerCase() === "true";
        else if (header.includes("image")) item.image = val;
      });
      return item;
    });
}
