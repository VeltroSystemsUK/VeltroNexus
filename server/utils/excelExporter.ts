import ExcelJS from "exceljs";
import type { ProspectWithCompany, User } from "@shared/schema";

interface ExportSection {
  title: string;
  headerLabel: string; // Second column header name
  stages: string[];
  startRow: number;
}

const SECTIONS: ExportSection[] = [
  {
    title: "ENQUIRY STAGE - No paperwork received - initial discussions",
    headerLabel: "Enquiry Stage",
    stages: ["lead", "contacted"],
    startRow: 2,
  },
  {
    title: "POST ENQUIRY STAGE - Receipt of Application form or Business Plan",
    headerLabel: "Post Enquiry",
    stages: ["qualified", "packaging", "due-diligence"],
    startRow: 17,
  },
  {
    title: "IN FLIGHT STAGE - Applications with MF",
    headerLabel: "In Flight",
    stages: ["submission", "further-information"],
    startRow: 32,
  },
  {
    title: "PENDING INVESTMENT STAGE - Approved Applications",
    headerLabel: "Pending Investment",
    stages: ["approved"],
    startRow: 47,
  },
  {
    title: "CLOSED DEALS - Declined",
    headerLabel: "Closed Status",
    stages: ["declined"],
    startRow: 62,
  },
];

const COLUMN_HEADERS = [
  "Date of Enquiry",
  "Company Name",
  "", // Will be replaced with section-specific label (Stage)
  "Amount",
  "Adviser",
  "Referral Source",
  "Sector",
  "POSTCODE",
  "Comments",
];

export async function generatePipelineExcel(
  prospects: ProspectWithCompany[],
  user?: User | null
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pipeline");

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // Date
    { width: 30 }, // Company
    { width: 20 }, // Stage
    { width: 15 }, // Amount
    { width: 20 }, // Adviser
    { width: 20 }, // Referral
    { width: 45 }, // Sector (wider for SIC Code + Business Activity)
    { width: 12 }, // Postcode
    { width: 40 }, // Comments
  ];

  let currentRow = 1;

  // Group prospects by section
  for (const section of SECTIONS) {
    const sectionProspects = prospects.filter((p) => section.stages.includes(p.stage));

    // Add section title row
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = section.title;
    titleRow.getCell(1).font = { bold: true, size: 12 };
    titleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };
    worksheet.mergeCells(currentRow, 1, currentRow, 9);
    currentRow++;

    // Add header row
    const headerRow = worksheet.getRow(currentRow);
    COLUMN_HEADERS.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = index === 2 ? section.headerLabel : header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    currentRow++;

    // Add prospect data
    sectionProspects.forEach((prospect) => {
      const dataRow = worksheet.getRow(currentRow);

      // Date of Enquiry
      dataRow.getCell(1).value = prospect.createdAt ? new Date(prospect.createdAt) : null;
      dataRow.getCell(1).numFmt = "dd/mm/yyyy";

      // Company name
      dataRow.getCell(2).value = prospect.company.companyName;

      // Stage (capitalize first letter)
      const stageLabel = prospect.stage
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      dataRow.getCell(3).value = stageLabel;

      // Amount (convert from pence to pounds)
      if (prospect.loanAmount) {
        dataRow.getCell(4).value = prospect.loanAmount / 100;
        dataRow.getCell(4).numFmt = "£#,##0";
      }

      // Adviser - User Name (first + last name)
      const adviserName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
      dataRow.getCell(5).value = adviserName || "";

      // Referral Source - from prospect
      dataRow.getCell(6).value = prospect.referralSource || "";

      // Sector - SIC Code and Business Activity from company
      const sicCode = prospect.company.sicCode || "";
      const sicDescription = prospect.company.sicDescription || "";
      dataRow.getCell(7).value =
        sicCode && sicDescription
          ? `${sicCode} - ${sicDescription}`
          : sicCode || sicDescription || "";

      // Postcode - isolated from Companies House data
      dataRow.getCell(8).value = prospect.company.postcode || "";

      // Comments - prospect notes
      dataRow.getCell(9).value = prospect.notes || "";

      // Add borders to all cells
      for (let col = 1; col <= 9; col++) {
        dataRow.getCell(col).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }

      currentRow++;
    });

    // Add some blank rows between sections
    currentRow += 2;
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
