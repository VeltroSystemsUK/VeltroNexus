import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function readTemplate() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = join(
    __dirname,
    "../../attached_assets/Pipeline Template_1763118738966.xlsx"
  );

  try {
    await workbook.xlsx.readFile(templatePath);

    console.log("\n=== Excel Template Structure ===\n");

    workbook.eachSheet((worksheet, sheetId) => {
      console.log(`Sheet ${sheetId}: "${worksheet.name}"`);
      console.log(`  Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);

      // Find all section headers
      for (let i = 1; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const firstCell = row.getCell(1).value;
        if (firstCell && typeof firstCell === "string" && firstCell.includes("STAGE")) {
          console.log(`  Row ${i}: ${firstCell}`);
          // Print the next row (headers)
          const nextRow = worksheet.getRow(i + 1);
          const headers: any[] = [];
          nextRow.eachCell((cell) => {
            headers.push(cell.value);
          });
          console.log(`  Row ${i + 1}: ${JSON.stringify(headers)}`);
        }
      }
      console.log("");
    });
  } catch (error) {
    console.error("Error reading template:", error);
  }
}

readTemplate();
