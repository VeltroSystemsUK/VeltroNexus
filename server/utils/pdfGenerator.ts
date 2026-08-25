import PDFDocument from "pdfkit";
import type { ProspectWithCompany, Contact, Activity, DueDiligence, DueDiligenceData } from "@shared/schema";

interface CompaniesHouseData {
  officers?: any;
  psc?: any;
  charges?: any;
}

export interface PDFSection {
  id: string;
  label: string;
  enabled: boolean;
  type?: "module" | "structure" | "container";
  subtype?: "pageBreak" | "divider" | "spacer" | "2-column";
  columns?: PDFSection[][];
}

export interface PDFHeaderConfig {
  title: string;
  showDate: boolean;
  showUser: boolean;
}

interface PDFLayoutPreferences {
  sections: PDFSection[];
  header?: PDFHeaderConfig;
}

interface ProspectReportData {
  prospect: ProspectWithCompany;
  contacts: Contact[];
  activities: Activity[];
  dueDiligence?: DueDiligence;
  companiesHouseData?: CompaniesHouseData | null;
  pdfLayoutPreferences?: PDFLayoutPreferences | null;
  user?: { firstName: string; lastName: string } | null;
}

// Professional Color Palette
const COLORS = {
  primary: "#2c3e50",
  secondary: "#34495e",
  accent: "#2563EB",
  success: "#4caf50",
  warning: "#ff9800",
  danger: "#f44336",
  text: "#333333",
  textSecondary: "#6B7280",
  textLight: "#9CA3AF",
  border: "#dfe6e9",
  borderLight: "#eee",
  backgroundLight: "#f8f9fa",
  backgroundMuted: "#F3F4F6",
  white: "#FFFFFF",
  swotStrengthsBg: "#e8f5e9",
  swotStrengthsBorder: "#4caf50",
  swotWeaknessesBg: "#fff3e0",
  swotWeaknessesBorder: "#ff9800",
  swotOpportunitiesBg: "#e3f2fd",
  swotOpportunitiesBorder: "#2196f3",
  swotThreatsBg: "#ffebee",
  swotThreatsBorder: "#f44336",
};

// Compact Layout Constants
const SPACING = {
  sectionMargin: 10,
  cellPadding: { x: 8, y: 5 },
  sectionPadding: 8,
  headerMargin: 6,
  paragraphGap: 6,
};

const DEFAULT_SECTIONS: PDFSection[] = [
  { id: "companyInfo", label: "Company Information", enabled: true, type: "module" },
  { id: "officers", label: "Officers", enabled: true, type: "module" },
  { id: "psc", label: "Persons with Significant Control", enabled: true, type: "module" },
  { id: "charges", label: "Charges", enabled: true, type: "module" },
  { id: "savedAssociations", label: "Saved Associated Companies", enabled: true, type: "module" },
  { id: "loanDetails", label: "Loan Details", enabled: true, type: "module" },
  { id: "security", label: "Security & Collateral", enabled: true, type: "module" },
  { id: "notes", label: "Notes", enabled: true, type: "module" },
  { id: "contacts", label: "Key Contacts", enabled: true, type: "module" },
  { id: "activities", label: "Activities & Tasks", enabled: true, type: "module" },
  { id: "dueDiligence", label: "Due Diligence", enabled: true, type: "module" },
  { id: "creditRatios", label: "Credit Ratios", enabled: true, type: "module" },
  { id: "accountsAnalysis", label: "Accounts Analysis", enabled: true, type: "module" },
  { id: "adverseMedia", label: "Adverse Media Screening", enabled: true, type: "module" },
  { id: "campari", label: "CAMPARI Analysis", enabled: true, type: "module" },
  { id: "swotAnalysis", label: "SWOT Analysis", enabled: true, type: "module" },
];

// ... (Page dimensions consts remain same)

// Recursive Renderer
function renderRecursiveSection(
  doc: typeof PDFDocument.prototype,
  section: PDFSection,
  data: ProspectReportData,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): void {
  // 1. Structure Elements
  if (section.type === "structure") {
    if (section.subtype === "pageBreak") {
      doc.addPage();
      pageNumber++;
      doc.y = MARGIN;
      return;
    }
    if (section.subtype === "divider") {
      doc.moveDown(0.5);
      doc.moveTo(x, doc.y).lineTo(x + width, doc.y).strokeColor(COLORS.border).lineWidth(1).stroke();
      doc.moveDown(0.5);
      return;
    }
    if (section.subtype === "spacer") {
      doc.moveDown(2);
      return;
    }
  }

  // 2. Container Elements (Columns)
  if (section.type === "container" && section.subtype === "2-column" && section.columns) {
    const gap = 20;
    const colWidth = (width - gap) / 2;
    const startY = doc.y;

    // Render Left Column
    const leftCol = section.columns[0];
    let leftY = startY;
    if (leftCol && leftCol.length > 0) {
      doc.y = startY;
      leftCol.forEach(subSection => {
        if (subSection.enabled) {
          renderRecursiveSection(doc, subSection, data, x, colWidth);
        }
      });
      leftY = doc.y;
    }

    // Render Right Column
    const rightCol = section.columns[1];
    let rightY = startY;
    if (rightCol && rightCol.length > 0) {
      doc.y = startY; // Reset to top for second column
      // Note: If left column triggered page breaks, this logic gets complex. 
      // PDFKit doesn't support "back to page X". 
      // Limitation: 2-Column mode assumes content fits on current page OR flows naturally.
      // If content breaks page, right column will start on NEW page. 
      // For simple reports this is acceptable, but for robust generation we'd need page-buffering.
      // We will assume "flow" logic: reset Y only if we are on the ORIGINAL page.
      // Actually, standard PDFKit patterns for columns usually involve setting y back.

      rightCol.forEach(subSection => {
        if (subSection.enabled) {
          renderRecursiveSection(doc, subSection, data, x + colWidth + gap, colWidth);
        }
      });
      rightY = doc.y;
    }

    // Sync Y to the tallest column (approximate)
    // NOTE: If page breaks occurred, doc.y is on the new page. 
    // This simple logic assumes both columns flow linearly. 
    // If one column spans 3 pages and the other 1, we end up on page 3.
    // The safest "max" is just taking current doc.y which reflects the end of the Last rendered column (Right).
    // To properly "sync" we'd need to track page numbers. 
    // For now, let's assume standard behavior: Right column ends at rightY. 
    // If Left column ended "lower" visually on the same page, we might want to respect that.
    // But since we can't easily check "visual Y" across pages, we accept the Right Column's end position as the new flow point.
    // OR we could check if leftY > rightY on the SAME page.
    // Given the complexity, this basic implementation supports simple side-by-side modules.

    // Attempt simple sync if on same page
    if (leftY > rightY && leftY < PAGE_HEIGHT) {
      doc.y = leftY + SPACING.sectionMargin;
    } else {
      doc.y = rightY + SPACING.sectionMargin;
    }
    return;
  }

  // 3. Data Modules (Leaves)
  if (!section.enabled) return;

  // Apply module renderers with width constraint
  // Refactored renderers below will need to accept (doc, data, x, width)
  // For now, standard renderers assume full width. We need to adapt them or wrap them.
  // Since we don't want to rewrite EVERY renderer function signature immediately,
  // we can use a temporary hack: The renderers usually use 'MARGIN' and 'CONTENT_WIDTH'.
  // We should refactor them to take x/width optionally.

  // Implementation note: I need to update the switch statement to pass x/width.
  // Many renderers currently hardcode MARGIN. 
  // I will perform a replacement on the renderers to accept options or just x/width.
  // Or I can use `doc.translate` (but that affects page breaks).

  // STRATEGY: Update the main switch logic here to call modified renderers.

  renderModule(doc, section.id, data, x, width);
}



// Page dimensions
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 35;
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

let pageNumber = 0;

// ============================================================================
// IMPROVED: Smart Page Break Management
// ============================================================================

function getRemainingSpace(doc: typeof PDFDocument.prototype): number {
  return PAGE_HEIGHT - FOOTER_HEIGHT - doc.y;
}

function needsNewPage(doc: typeof PDFDocument.prototype, requiredHeight: number): boolean {
  return getRemainingSpace(doc) < requiredHeight;
}

/**
 * IMPROVED: Smarter page break that checks both position and remaining space
 * Only skips adding page if we're at the very top AND have enough space
 */
function ensureSpace(doc: typeof PDFDocument.prototype, requiredHeight: number): void {
  const remaining = getRemainingSpace(doc);
  const isNearTop = doc.y < MARGIN + 30;

  // Only skip if we're near top AND have sufficient space
  if (isNearTop && remaining >= requiredHeight) {
    return;
  }

  if (remaining < requiredHeight) {
    doc.addPage();
    pageNumber++;
    doc.y = MARGIN;
  }
}

/**
 * Force a new page for section boundaries to prevent orphaned items
 */
function startNewSectionPage(doc: typeof PDFDocument.prototype, minSpaceNeeded: number = 120): void {
  if (getRemainingSpace(doc) < minSpaceNeeded) {
    doc.addPage();
    pageNumber++;
    doc.y = MARGIN;
  }
}

function renderTextWithPageBreaks(
  doc: typeof PDFDocument.prototype,
  text: string,
  x: number,
  options: {
    width?: number;
    fontSize?: number;
    font?: string;
    color?: string;
    lineGap?: number;
  } = {}
): number {
  const {
    width = CONTENT_WIDTH - 20,
    fontSize = 10,
    font = "Helvetica",
    color = COLORS.text,
    lineGap = 4,
  } = options;

  doc.fontSize(fontSize).font(font).fillColor(color);

  const textHeight = doc.heightOfString(text, { width, lineGap });

  if (needsNewPage(doc, textHeight + 10)) {
    doc.addPage();
    pageNumber++;
    doc.y = MARGIN;
  }

  const startY = doc.y;
  doc.text(text, x, startY, { width, lineGap });

  return doc.y;
}

function renderParagraphsWithBreaks(
  doc: typeof PDFDocument.prototype,
  paragraphs: string[],
  x: number,
  options: {
    fontSize?: number;
    color?: string;
    width?: number;
  } = {}
): number {
  const { fontSize = 10, color = COLORS.text, width = CONTENT_WIDTH - 20 } = options;

  paragraphs.forEach((para, index) => {
    if (!para || para.trim() === "") return;

    doc.y = renderTextWithPageBreaks(doc, para, x, {
      fontSize,
      color,
      width,
      font: "Helvetica",
      lineGap: 4,
    });

    if (index < paragraphs.length - 1) {
      doc.y += SPACING.paragraphGap;
    }
  });

  return doc.y;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function createProspectReportDocument(data: ProspectReportData): typeof PDFDocument.prototype {
  return new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Credit Assessment Report - ${data.prospect.company.companyName}`,
      Author: "Veltro",
      Subject: "Commercial Lending Credit Assessment",
      Keywords: "credit, assessment, lending, commercial",
    },
  });
}

export function renderProspectReport(doc: typeof PDFDocument.prototype, data: ProspectReportData): void {
  const { prospect, contacts, activities, dueDiligence, companiesHouseData, pdfLayoutPreferences, user } = data;
  pageNumber = 0;

  // Augment prospect with preferences and user for Cover Page rendering
  type AugmentedProspect = ProspectWithCompany & { pdfLayoutPreferences?: any; user?: any; };
  const augmentedProspect = prospect as AugmentedProspect;

  augmentedProspect.pdfLayoutPreferences = pdfLayoutPreferences;
  augmentedProspect.user = user;

  // Cover Page
  renderCoverPage(doc, augmentedProspect);

  // Executive Summary Page
  doc.addPage();
  pageNumber++;
  renderExecutiveSummary(doc, augmentedProspect, companiesHouseData, dueDiligence);

  // Render sections recursively
  const sections = pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;
  const enabledSections = sections; // processed inside recursive function

  // Add spacing after executive summary
  doc.y += SPACING.sectionMargin * 2;
  ensureSpace(doc, 100);

  // Render Root List
  enabledSections.forEach(section => {
    renderRecursiveSection(doc, section, data, MARGIN, CONTENT_WIDTH);
  });

  // Adviser recommendation sign-off (rendered once, after all sections)
  ensureSpace(doc, 130);
  doc.y += 15;
  renderSignatureSection(doc, doc.y, augmentedProspect, dueDiligence);

  // Footers (rendered once, after every page exists)
  addFootersToAllPages(doc, prospect);
}

// Helper to route module rendering
function renderModule(doc: typeof PDFDocument.prototype, id: string, data: ProspectReportData, x: number, width: number) {
  const { companiesHouseData, prospect, contacts, activities, dueDiligence } = data;

  switch (id) {
    case "companyInfo":
      if (companiesHouseData) {
        doc.y = renderCompanyInfoCompact(doc, prospect, companiesHouseData, doc.y, x, width);
      }
      break;

    case "officers":
      if (companiesHouseData?.officers?.items?.length > 0) {
        doc.y = renderOfficersCompact(doc, companiesHouseData!.officers.items, doc.y, x, width);
      }
      break;

    case "psc":
      if (companiesHouseData?.psc?.items?.length > 0) {
        doc.y = renderPSCCompact(doc, companiesHouseData!.psc.items, doc.y, x, width);
      }
      break;

    case "charges":
      if (companiesHouseData?.charges) {
        doc.y = renderChargesCompact(doc, companiesHouseData.charges, doc.y, x, width);
      }
      break;

    case "savedAssociations":
      if ((prospect.savedAssociations as any[])?.length > 0) {
        doc.y = renderSavedAssociationsCompact(doc, prospect.savedAssociations as any[], doc.y, x, width);
      }
      break;

    case "loanDetails":
      doc.y = renderLoanDetailsCompact(doc, prospect, doc.y, x, width);
      break;

    case "security":
      if (checkHasCollateral(prospect)) {
        doc.y = renderSecurityCompact(doc, prospect, doc.y, x, width);
      }
      break;

    case "notes":
      if (prospect.loanRequirementNotes || prospect.notes) {
        doc.y = renderNotesCompact(doc, prospect, doc.y, x, width);
      }
      break;

    case "contacts":
      if (contacts.length > 0) {
        doc.y = renderContactsCompact(doc, contacts, doc.y, x, width);
      }
      break;

    case "activities":
      if (activities.length > 0) {
        doc.y = renderActivitiesCompact(doc, activities, doc.y, x, width);
      }
      break;

    case "dueDiligence":
      if (dueDiligence) {
        doc.y = renderDueDiligenceCompact(doc, dueDiligence, doc.y, x, width);
      }
      break;

    case "creditRatios":
      const ddData = (dueDiligence?.data as unknown as DueDiligenceData) || {};
      if (ddData.underwriting?.financialAnalysis) {
        doc.y = renderCreditRatios(doc, ddData.underwriting.financialAnalysis, doc.y, x, width);
      }
      break;

    case "campari": {
      const campariSections = (dueDiligence?.data as unknown as DueDiligenceData)?.underwriting?.adviserSummary
        ?.sections as Record<string, string> | undefined;
      if (campariSections && Object.keys(campariSections).length > 0) {
        doc.y = renderCAMPARIAnalysis(doc, campariSections, doc.y, x, width);
      }
      break;
    }

    case "accountsAnalysis": {
      const accountsAnalysis = (dueDiligence?.data as unknown as DueDiligenceData)?.underwriting?.accountsAnalysis;
      if (accountsAnalysis && (accountsAnalysis.summary || accountsAnalysis.concerns?.length || accountsAnalysis.auditorOpinion)) {
        doc.y = renderAccountsAnalysisCompact(doc, accountsAnalysis, doc.y, x, width);
      }
      break;
    }

    case "adverseMedia": {
      const adverseMedia = (dueDiligence?.data as unknown as DueDiligenceData)?.underwriting?.adverseMedia;
      if (adverseMedia && (adverseMedia.summary || adverseMedia.riskLevel || adverseMedia.flags?.length)) {
        doc.y = renderAdverseMediaCompact(doc, adverseMedia, doc.y, x, width);
      }
      break;
    }

    case "swotAnalysis":
      const ddDataSwot = (dueDiligence?.data as unknown as DueDiligenceData) || {};
      if (ddDataSwot.underwriting?.swotAnalysis) {
        doc.y = renderSWOTAnalysis(doc, ddDataSwot.underwriting.swotAnalysis, doc.y, x, width);
      }
      break;
  }

  // Add small margin after module
  doc.y += SPACING.sectionMargin;
}

// ============================================================================
// COVER PAGE
// ============================================================================

function renderCoverPage(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany & { pdfLayoutPreferences?: any; user?: any }): void {
  const centerX = PAGE_WIDTH / 2;

  // Header bar
  doc.rect(0, 0, PAGE_WIDTH, 95).fill(COLORS.primary);

  doc.fontSize(26).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("VELTRO", centerX - 55, 28);

  doc.fontSize(11).fillColor(COLORS.white).font("Helvetica");
  doc.text("Commercial Lending Intelligence", centerX - 95, 58);

  // Main title (Dynamic)
  const reportTitle = prospect.pdfLayoutPreferences?.header?.title || "Credit Assessment Report";

  doc.y = 150;
  doc.fontSize(26).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(reportTitle, 0, doc.y, { align: "center", width: PAGE_WIDTH });

  // Company name box
  doc.y += 55;
  const boxWidth = 380;
  const boxX = (PAGE_WIDTH - boxWidth) / 2;

  doc.roundedRect(boxX, doc.y, boxWidth, 75, 4).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  doc.fontSize(18).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, boxX + 15, doc.y + 24, {
    width: boxWidth - 30,
    align: "center",
  });

  // ... (rest of Company details)

  // Report date (Dynamic)
  const showDate = prospect.pdfLayoutPreferences?.header?.showDate !== false; // Default true
  if (showDate) {
    doc.y = PAGE_HEIGHT - 135;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Report Date:", 0, doc.y, { align: "center", width: PAGE_WIDTH });
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      0,
      doc.y + 14,
      { align: "center", width: PAGE_WIDTH }
    );
  }

  // Prepared By (Dynamic)
  const showUser = prospect.pdfLayoutPreferences?.header?.showUser !== false; // Default true
  if (showUser && prospect.user) {
    const userName = `${prospect.user.firstName} ${prospect.user.lastName}`;
    doc.y = PAGE_HEIGHT - 100;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`Prepared by: ${userName}`, 0, doc.y, { align: "center", width: PAGE_WIDTH });
  }

  // Confidentiality notice
  doc.y = PAGE_HEIGHT - 65;
  doc.fontSize(7).fillColor(COLORS.textLight).font("Helvetica");
  doc.text(
    "CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. Unauthorized distribution, copying, or disclosure is strictly prohibited.",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, align: "center", lineGap: 1.5 }
  );
}

// ============================================================================
// EXECUTIVE SUMMARY
// ============================================================================

function renderExecutiveSummary(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  companiesHouseData?: CompaniesHouseData | null,
  dueDiligence?: DueDiligence
): void {
  doc.y = MARGIN;

  // Section header
  doc.fontSize(20).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("01 EXECUTIVE SUMMARY", MARGIN, doc.y);

  doc.moveTo(MARGIN, doc.y + 28)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 28)
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .stroke();

  doc.y += 42;

  // Business Overview Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 165, 4)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let contentY = doc.y + 12;

  doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("BUSINESS OVERVIEW", MARGIN + 12, contentY);

  contentY += 22;

  // Two-column layout
  const col1X = MARGIN + 12;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 8;
  const colWidth = (CONTENT_WIDTH / 2) - 20;

  // Left column
  const leftItems = [
    { label: "Company", value: prospect.company.companyName },
    { label: "Sector/Industry", value: prospect.company.sicDescription || "N/A" },
    { label: "Pipeline Stage", value: capitalizeStage(prospect.stage) },
    { label: "Referral Source", value: prospect.referralSource || "Direct" },
  ];

  leftItems.forEach((item) => {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(item.label, col1X, contentY);
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(item.value, col1X, contentY + 9, { width: colWidth });
    contentY += 27;
  });

  // Right column
  contentY = doc.y + 34;

  const rightItems = [
    { label: "LOAN AMOUNT", value: prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "TBD" },
    { label: "TERM", value: prospect.term ? `${prospect.term} months` : "TBD" },
    { label: "INTEREST RATE", value: prospect.interestRate ? `${prospect.interestRate}%` : "TBD" },
    { label: "PRIORITY", value: prospect.priority ? prospect.priority.toUpperCase() : "Normal" },
  ];

  rightItems.forEach((item) => {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(item.label, col2X, contentY);
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(item.value, col2X, contentY + 9, { width: colWidth });
    contentY += 27;
  });

  doc.y += 175;

  // Security Position Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 80, 4)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 12;

  doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("SECURITY POSITION", MARGIN + 12, contentY);

  contentY += 22;

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Security", col1X, contentY);
  doc.fontSize(13).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity * 100), col1X, contentY + 10);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Security Types", col2X, contentY);
  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text(securityTypes.length > 0 ? securityTypes.join(", ") : "None", col2X, contentY + 10, {
    width: colWidth,
  });

  doc.y += 90;

  // Assessment Status Box
  const ddDataForStatus = (dueDiligence?.data as unknown as DueDiligenceData) || {};
  const riskGrade = ddDataForStatus.underwriting?.riskGrade;

  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 65, 4)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 12;

  doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("ASSESSMENT STATUS", MARGIN + 12, contentY);

  if (riskGrade) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Risk Grade", col2X, contentY);
    doc.fontSize(15).fillColor(getRiskGradeColor(riskGrade)).font("Helvetica-Bold");
    doc.text(riskGrade, col2X, contentY + 11);
  }

  contentY += 22;

  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text(prospect.stage || "Due diligence not yet started", MARGIN + 12, contentY, {
    width: colWidth,
  });

  doc.y += 75;

  // Key Findings Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 85, 4)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 12;

  doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("KEY FINDINGS", MARGIN + 12, contentY);

  contentY += 22;

  const keyFindings = [
    `Company Status: ${prospect.company.companyStatus || "Active"}`,
    `Active Officers: ${companiesHouseData?.officers ? (companiesHouseData.officers.items?.length ?? 0) : "Not available"}`,
    `Outstanding Charges: ${companiesHouseData?.charges ? (companiesHouseData.charges.outstanding_count ?? 0) : "Not available"}`,
    `Incorporated: ${prospect.company.incorporationDate ? new Date(prospect.company.incorporationDate).toLocaleDateString("en-GB") : "N/A"}`,
    `Location: ${prospect.company.postcode || "N/A"}`,
  ];

  keyFindings.forEach((finding) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(`• ${finding}`, MARGIN + 12, contentY);
    contentY += 13;
  });
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function renderCompactSectionHeader(doc: typeof PDFDocument.prototype, title: string, startY: number, x: number = MARGIN): number {
  // Calculate header height
  const headerHeight = 20;

  // Check if we need a new page for this section
  ensureSpace(doc, headerHeight + 40);

  doc.y = startY;

  // Accent line
  doc.moveTo(x, doc.y)
    .lineTo(x + 3, doc.y)
    .strokeColor(COLORS.accent)
    .lineWidth(2.5)
    .stroke();

  doc.fontSize(12).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(title, x + 10, doc.y - 2);

  doc.y += headerHeight;

  return doc.y;
}

// ============================================================================
// COMPANY INFO
// ============================================================================

function renderCompanyInfoCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  companiesHouseData: CompaniesHouseData,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const sectionHeight = 95;
  ensureSpace(doc, sectionHeight + 20);

  let y = renderCompactSectionHeader(doc, "Company Information", startY, x);

  const company = prospect.company;

  doc.roundedRect(x, y, width, sectionHeight, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let detailY = y + 10;
  const labelX = x + 10;
  const valueX = x + 120;
  const maxWidth = width - 135;

  const details = [
    { label: "Company Number:", value: company.companyNumber },
    { label: "Status:", value: company.companyStatus || "active" },
    { label: "Type:", value: company.companyType || "ltd" },
    {
      label: "Incorporated:",
      value: company.incorporationDate
        ? new Date(company.incorporationDate).toLocaleDateString("en-GB")
        : "N/A",
    },
  ];

  details.forEach((detail) => {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(detail.label, labelX, detailY);

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(detail.value, valueX, detailY, { width: maxWidth });

    detailY += 17;
  });

  return y + sectionHeight + SPACING.sectionMargin;
}

// ============================================================================
// OFFICERS
// ============================================================================

function renderOfficersCompact(doc: typeof PDFDocument.prototype, officers: any[], startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  const itemHeight = 30;
  const headerHeight = 25;

  // Ensure we have space for at least header + 1 item
  ensureSpace(doc, headerHeight + itemHeight);

  let y = renderCompactSectionHeader(doc, "Officers", startY, x);
  doc.y = y;

  const displayOfficers = officers.slice(0, 10);

  displayOfficers.forEach((officer, index) => {
    // Check if we need a new page before rendering this item
    if (needsNewPage(doc, itemHeight + 5)) {
      doc.addPage();
      pageNumber++;
      doc.y = MARGIN;
      y = MARGIN;
    }

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(officer.name, x + 8, y);

    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    const details = [
      officer.officer_role,
      officer.appointed_on ? `Appointed: ${new Date(officer.appointed_on).toLocaleDateString("en-GB")}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    doc.text(details, x + 8, y + 12, { width: width - 16 });
    y += itemHeight;
    doc.y = y;
  });

  if (officers.length > 10) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${officers.length - 10} more officers`, x + 8, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// PSC
// ============================================================================

function renderPSCCompact(doc: typeof PDFDocument.prototype, pscList: any[], startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  const itemHeight = 30;
  const headerHeight = 25;

  // Ensure we have space for at least header + 1 item
  ensureSpace(doc, headerHeight + itemHeight);

  let y = renderCompactSectionHeader(doc, "Persons with Significant Control", startY, x);
  doc.y = y;

  const displayPSCs = pscList.slice(0, 10);

  displayPSCs.forEach((psc) => {
    // Check if we need a new page before rendering this item
    if (needsNewPage(doc, itemHeight + 5)) {
      doc.addPage();
      pageNumber++;
      doc.y = MARGIN;
      y = MARGIN;
    }

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(psc.name, x + 8, y);

    const natures = psc.natures_of_control?.join(", ") || "Not specified";
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(natures, x + 8, y + 12, { width: width - 16 });

    y += itemHeight;
    doc.y = y;
  });

  if (pscList.length > 10) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${pscList.length - 10} more PSCs`, x + 8, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// CHARGES
// ============================================================================

function renderChargesCompact(doc: typeof PDFDocument.prototype, chargesData: any, startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  const charges = chargesData.items || [];
  const maxCharges = Math.min(charges.length, 5);
  const chargesListHeight = maxCharges * 26;
  const totalHeight = 65 + (charges.length > 0 ? chargesListHeight + 5 : 0);

  ensureSpace(doc, totalHeight + 25);

  let y = renderCompactSectionHeader(doc, "Charges", startY, x);

  const totalCharges = chargesData.total_count || 0;
  const satisfied = chargesData.satisfied_count || 0;
  const outstanding = chargesData.outstanding_count || totalCharges - satisfied;

  // Summary box
  doc.roundedRect(x, y, width, 58, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = x + 12;
  const col2X = x + width / 3;
  const col3X = x + (width / 3) * 2;
  let summaryY = y + 12;

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Charges", col1X, summaryY);
  doc.fontSize(13).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(totalCharges.toString(), col1X, summaryY + 11);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Outstanding", col2X, summaryY);
  doc.fontSize(13)
    .fillColor(outstanding > 0 ? COLORS.warning : COLORS.success)
    .font("Helvetica-Bold");
  doc.text(outstanding.toString(), col2X, summaryY + 11);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Satisfied", col3X, summaryY);
  doc.fontSize(13).fillColor(COLORS.textSecondary).font("Helvetica-Bold");
  doc.text(satisfied.toString(), col3X, summaryY + 11);

  y += 63;

  // List recent charges
  if (charges.length > 0) {
    y += 3;

    charges.slice(0, maxCharges).forEach((charge: any) => {
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(charge.classification?.description || "Charge", MARGIN + 8, y);

      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      const chargeDetails = [
        charge.status,
        charge.created_on ? `Created: ${new Date(charge.created_on).toLocaleDateString("en-GB")}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      doc.text(chargeDetails, MARGIN + 8, y + 11);
      y += 26;
    });

    if (charges.length > 5) {
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(`...and ${charges.length - 5} more charges`, MARGIN + 8, y);
      y += 10;
    }
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SAVED ASSOCIATIONS
// ============================================================================

// ============================================================================
// SAVED ASSOCIATIONS
// ============================================================================

function renderSavedAssociationsCompact(
  doc: typeof PDFDocument.prototype,
  associations: any[],
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const itemHeight = 16;
  const maxItems = Math.min(associations.length, 5);
  const sectionHeight = maxItems * itemHeight + 10;

  ensureSpace(doc, sectionHeight + 25);

  let y = renderCompactSectionHeader(doc, "Saved Associated Companies", startY, x);

  associations.slice(0, 5).forEach((assoc: any) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(
      `${assoc.companyName || assoc.company_name} (${assoc.companyNumber || assoc.company_number})`,
      x + 8,
      y
    );
    y += itemHeight;
  });

  if (associations.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${associations.length - 5} more`, x + 8, y);
    y += 10;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// LOAN DETAILS
// ============================================================================

function renderLoanDetailsCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const boxHeight = 90;
  ensureSpace(doc, boxHeight + 25);

  let y = renderCompactSectionHeader(doc, "Loan Details", startY, x);

  // Draw entire box at once
  doc.roundedRect(x, y, width, boxHeight, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = x + 12;
  const col2X = x + width / 3;
  const col3X = x + (width / 3) * 2;
  let detailY = y + 10;

  // Row 1: Amount, Term, Rate
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Loan Amount", col1X, detailY);
  doc.fontSize(13).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A", col1X, detailY + 11);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Term", col2X, detailY);
  doc.fontSize(13).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "N/A", col2X, detailY + 11);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Interest Rate", col3X, detailY);
  doc.fontSize(13).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.interestRate ? `${prospect.interestRate}%` : "N/A", col3X, detailY + 11);

  detailY += 40;

  // Row 2: Stage, Priority, Referral
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Stage", col1X, detailY);
  doc.fontSize(10).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, detailY + 11);

  if (prospect.priority) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Priority", col2X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.priority.toUpperCase(), col2X, detailY + 11);
  }

  if (prospect.referralSource) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Referral Source", col3X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.referralSource, col3X, detailY + 11);
  }

  return y + boxHeight + SPACING.sectionMargin;
}

// ============================================================================
// SECURITY
// ============================================================================

function renderSecurityCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const boxHeight = 62;
  ensureSpace(doc, boxHeight + 25);

  let y = renderCompactSectionHeader(doc, "Security & Collateral", startY, x);

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  doc.roundedRect(x, y, width, boxHeight, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Security", x + 12, y + 10);
  doc.fontSize(15).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity * 100), x + 12, y + 22);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Types: " + securityTypes.join(", "), x + 12, y + 44, { width: width - 24 });

  return y + boxHeight + SPACING.sectionMargin;
}

// ============================================================================
// NOTES
// ============================================================================

function renderNotesCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  // Calculate approximate height
  let estimatedHeight = 25;
  if (prospect.loanRequirementNotes) {
    estimatedHeight += Math.min(70, Math.ceil(prospect.loanRequirementNotes.length / 70) * 12);
  }
  if (prospect.notes) {
    estimatedHeight += Math.min(70, Math.ceil(prospect.notes.length / 70) * 12);
  }

  ensureSpace(doc, estimatedHeight);

  let y = renderCompactSectionHeader(doc, "Notes", startY, x);

  if (prospect.loanRequirementNotes) {
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("Loan Requirements:", x, y);
    y += 13;

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    const noteText = truncateText(prospect.loanRequirementNotes, 300);
    doc.text(noteText, x + 8, y, { width: width - 16 });

    const textHeight = doc.heightOfString(noteText, { width: width - 16 });
    y += textHeight + 4;
  }

  if (prospect.notes) {
    y += 8;
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("General Notes:", x, y);
    y += 13;

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    const noteText = truncateText(prospect.notes, 300);
    doc.text(noteText, x + 8, y, { width: width - 16 });

    const textHeight = doc.heightOfString(noteText, { width: width - 16 });
    y += textHeight + 4;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// CONTACTS
// ============================================================================

function renderContactsCompact(doc: typeof PDFDocument.prototype, contacts: Contact[], startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  const itemHeight = 26;
  const maxItems = Math.min(contacts.length, 10);
  const sectionHeight = maxItems * itemHeight + 10;

  ensureSpace(doc, sectionHeight + 25);

  let y = renderCompactSectionHeader(doc, "Key Contacts", startY, x);

  contacts.slice(0, 10).forEach((contact) => {
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(contact.name, x + 8, y);

    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    const details = [contact.role, contact.email, contact.phone].filter(Boolean).join(" | ");
    doc.text(details, x + 8, y + 12, { width: width - 16 });

    y += itemHeight;
  });

  if (contacts.length > 10) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${contacts.length - 10} more contacts`, x + 8, y);
    y += 10;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// ACTIVITIES
// ============================================================================

function renderActivitiesCompact(doc: typeof PDFDocument.prototype, activities: Activity[], startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  const itemHeight = 18;
  const maxItems = Math.min(activities.length, 5);
  const sectionHeight = maxItems * itemHeight + 10;

  ensureSpace(doc, sectionHeight + 25);

  let y = renderCompactSectionHeader(doc, "Activities & Tasks", startY, x);

  const recentActivities = activities.slice(0, 5);

  recentActivities.forEach((activity) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(truncateText(activity.title, 60), x + 8, y);

    const typeLabel =
      activity.activityType === "task" ? "Task" : activity.activityType === "call" ? "Call" : "Meeting";
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(
      `${typeLabel} | ${activity.completed ? "Completed" : "Pending"}`,
      x + width - 90,
      y
    );

    y += itemHeight;
  });

  if (activities.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${activities.length - 5} more activities`, x + 8, y);
    y += 10;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// DUE DILIGENCE
// ============================================================================

// ============================================================================
// DUE DILIGENCE
// ============================================================================

function renderDueDiligenceCompact(
  doc: typeof PDFDocument.prototype,
  dueDiligence: DueDiligence,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const ddData = (dueDiligence.data as unknown as DueDiligenceData) || {};
  const summary = ddData.underwriting?.adviserSummary?.recommendation;
  const boxHeight = summary ? 95 : 70;
  ensureSpace(doc, boxHeight + 25);

  let y = renderCompactSectionHeader(doc, "Due Diligence", startY, x);

  doc.roundedRect(x, y, width, boxHeight, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let contentY = y + 10;
  const col1X = x + 12;
  const col2X = x + width / 2 + 8;

  // Status and date
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Status", col1X, contentY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text("In Progress", col1X, contentY + 11);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Last Updated", col2X, contentY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
  doc.text(
    dueDiligence.updatedAt ? new Date(dueDiligence.updatedAt).toLocaleDateString("en-GB") : "N/A",
    col2X,
    contentY + 11
  );

  if (summary) {
    contentY += 38;
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Summary", col1X, contentY);

    contentY += 13;
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(summary, 150), col1X, contentY, {
      width: width - 24,
    });
  }

  return y + boxHeight + SPACING.sectionMargin;
}

// ============================================================================
// CREDIT RATIOS
// ============================================================================

// ============================================================================
// CREDIT RATIOS
// ============================================================================

function renderCreditRatios(doc: typeof PDFDocument.prototype, financialData: any, startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  ensureSpace(doc, 115);

  let y = renderCompactSectionHeader(doc, "Credit Ratios", startY, x);

  const ratios = [
    {
      label: "Debt Service Coverage",
      value: financialData.debtServiceCoverageRatio,
      format: (v: number) => v.toFixed(2) + "x",
    },
    { label: "Current Ratio", value: financialData.currentRatio, format: (v: number) => v.toFixed(2) },
    { label: "Debt to Equity", value: financialData.debtToEquity, format: (v: number) => v.toFixed(2) },
    { label: "Interest Coverage", value: financialData.interestCoverage, format: (v: number) => v.toFixed(2) + "x" },
  ];

  ratios.forEach((ratio, index) => {
    if (ratio.value != null) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const ratioX = x + 12 + col * (width / 2);
      const ratioY = y + row * 42;

      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(ratio.label, ratioX, ratioY);

      doc.fontSize(13).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(ratio.format(ratio.value), ratioX, ratioY + 11);
    }
  });

  let bottomY = y + 95;

  const redFlags = Array.isArray(financialData.redFlags)
    ? financialData.redFlags.filter((flag: any) => typeof flag === "string" || flag?.isActive)
    : [];

  if (redFlags.length > 0) {
    ensureSpace(doc, redFlags.length * 13 + 25);
    doc.fontSize(9).fillColor(COLORS.danger).font("Helvetica-Bold");
    doc.text("Red Flags", x + 12, bottomY);
    bottomY += 14;
    redFlags.forEach((flag: any) => {
      doc.fontSize(8).fillColor(COLORS.danger).font("Helvetica");
      doc.text(`• ${typeof flag === "string" ? flag : flag.label}`, x + 12, bottomY, { width: width - 24 });
      bottomY += 12;
    });
    bottomY += 6;
  }

  return bottomY;
}

// ============================================================================
// ACCOUNTS ANALYSIS
// ============================================================================

function renderAccountsAnalysisCompact(
  doc: typeof PDFDocument.prototype,
  accounts: any,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const concerns = Array.isArray(accounts.concerns) ? accounts.concerns : [];
  const summary = accounts.summary || "";
  const summaryHeight = summary ? doc.heightOfString(truncateText(summary, 300), { width: width - 24 }) : 0;
  const boxHeight = 55 + (concerns.length ? concerns.length * 13 + 10 : 0) + (summary ? summaryHeight + 16 : 0);

  ensureSpace(doc, boxHeight + 25);

  let y = renderCompactSectionHeader(doc, "Accounts Analysis", startY, x);

  doc.roundedRect(x, y, width, boxHeight, 3).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = x + 12;
  const col2X = x + width / 2 + 8;
  let contentY = y + 10;

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Risk Assessment", col1X, contentY);
  doc
    .fontSize(11)
    .fillColor(
      accounts.riskAssessment === "high"
        ? COLORS.danger
        : accounts.riskAssessment === "medium"
          ? COLORS.warning
          : COLORS.success
    )
    .font("Helvetica-Bold");
  doc.text(accounts.riskAssessment ? accounts.riskAssessment.toUpperCase() : "N/A", col1X, contentY + 11);

  if (accounts.auditorOpinion) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Auditor Opinion", col2X, contentY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(accounts.auditorOpinion, col2X, contentY + 11, { width: width / 2 - 20 });
  }

  contentY += 34;

  if (summary) {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(summary, 300), col1X, contentY, { width: width - 24 });
    contentY += summaryHeight + 8;
  }

  if (concerns.length > 0) {
    doc.fontSize(8).fillColor(COLORS.warning).font("Helvetica-Bold");
    doc.text("Concerns", col1X, contentY);
    contentY += 13;
    concerns.forEach((concern: string) => {
      doc.fontSize(8).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${concern}`, col1X, contentY, { width: width - 24 });
      contentY += 13;
    });
  }

  return y + boxHeight + SPACING.sectionMargin;
}

// ============================================================================
// ADVERSE MEDIA SCREENING
// ============================================================================

function renderAdverseMediaCompact(
  doc: typeof PDFDocument.prototype,
  adverseMedia: any,
  startY: number,
  x: number = MARGIN,
  width: number = CONTENT_WIDTH
): number {
  const flags = Array.isArray(adverseMedia.flags) ? adverseMedia.flags : [];
  const summary = adverseMedia.summary || "";
  const summaryHeight = summary ? doc.heightOfString(truncateText(summary, 300), { width: width - 24 }) : 0;
  const boxHeight = 50 + (flags.length ? flags.length * 13 + 10 : 0) + (summary ? summaryHeight + 20 : 0);

  ensureSpace(doc, boxHeight + 25);

  let y = renderCompactSectionHeader(doc, "Adverse Media Screening", startY, x);

  const riskColor =
    adverseMedia.riskLevel === "HIGH" ? COLORS.danger : adverseMedia.riskLevel === "MEDIUM" ? COLORS.warning : COLORS.success;

  doc.roundedRect(x, y, width, boxHeight, 3).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let contentY = y + 10;
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Risk Level", x + 12, contentY);
  doc.fontSize(13).fillColor(riskColor).font("Helvetica-Bold");
  doc.text(adverseMedia.riskLevel || "Not screened", x + 12, contentY + 11);

  contentY += 34;

  if (summary) {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(summary, 300), x + 12, contentY, { width: width - 24 });
    contentY += summaryHeight + 8;
  }

  if (flags.length > 0) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica-Bold");
    doc.text("Flags", x + 12, contentY);
    contentY += 13;
    flags.forEach((flag: string) => {
      doc.fontSize(8).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${flag}`, x + 12, contentY, { width: width - 24 });
      contentY += 13;
    });
  }

  return y + boxHeight + SPACING.sectionMargin;
}

// ============================================================================
// CAMPARI ANALYSIS
// ============================================================================

// ============================================================================
// CAMPARI ANALYSIS
// ============================================================================

function renderCAMPARIAnalysis(doc: typeof PDFDocument.prototype, campari: any, startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  let y = renderCompactSectionHeader(doc, "CAMPARI Analysis", startY, x);

  const sections = [
    { key: "character", label: "Character" },
    { key: "ability", label: "Ability" },
    { key: "means", label: "Means" },
    { key: "purpose", label: "Purpose" },
    { key: "amount", label: "Amount" },
    { key: "repayment", label: "Repayment" },
    { key: "insurance", label: "Insurance" },
  ];

  sections.forEach((section) => {
    const content = campari[section.key];
    if (content) {
      const textHeight = doc.heightOfString(content, { width: width - 16 });
      const sectionHeight = textHeight + 30;

      ensureSpace(doc, sectionHeight);

      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text(section.label, x, y);
      y += 15;

      doc.y = renderTextWithPageBreaks(doc, content, x + 8, {
        fontSize: 9,
        color: COLORS.text,
        width: width - 16,
      });

      y = doc.y + 10;
    }
  });

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SWOT ANALYSIS
// ============================================================================

// ============================================================================
// SWOT ANALYSIS
// ============================================================================

function renderSWOTAnalysis(doc: typeof PDFDocument.prototype, swot: any, startY: number, x: number = MARGIN, width: number = CONTENT_WIDTH): number {
  // Ensure we have space for header + at least one quadrant
  ensureSpace(doc, 100);

  let y = renderCompactSectionHeader(doc, "SWOT Analysis", startY, x);
  doc.y = y;

  const quadrants = [
    { key: "strengths", label: "Strengths", bg: COLORS.swotStrengthsBg, border: COLORS.swotStrengthsBorder },
    { key: "weaknesses", label: "Weaknesses", bg: COLORS.swotWeaknessesBg, border: COLORS.swotWeaknessesBorder },
    {
      key: "opportunities",
      label: "Opportunities",
      bg: COLORS.swotOpportunitiesBg,
      border: COLORS.swotOpportunitiesBorder,
    },
    { key: "threats", label: "Threats", bg: COLORS.swotThreatsBg, border: COLORS.swotThreatsBorder },
  ];

  quadrants.forEach((quad) => {
    const items = swot[quad.key];
    if (items && items.length > 0) {
      // Calculate actual height needed for this quadrant
      // Use more accurate height calculation - estimate ~18px per item for wrapped text
      const estimatedItemHeight = 18;
      const itemsHeight = items.length * estimatedItemHeight;
      const quadHeight = itemsHeight + 42; // header + padding

      // Check for page break BEFORE drawing the quadrant
      if (needsNewPage(doc, quadHeight + 10)) {
        doc.addPage();
        pageNumber++;
        doc.y = MARGIN;
        y = MARGIN;
      }

      doc.roundedRect(x, y, width, itemsHeight + 38, 3)
        .fillAndStroke(quad.bg, quad.border);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(quad.label, x + 10, y + 9);

      let itemY = y + 28;

      items.forEach((item: string) => {
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.text(`• ${item}`, x + 10, itemY, { width: width - 20 });
        itemY += estimatedItemHeight;
      });

      y = itemY + 12;
      doc.y = y;
    }
  });

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SIGNATURE SECTION
// ============================================================================

function renderSignatureSection(
  doc: typeof PDFDocument.prototype,
  startY: number,
  prospect: ProspectWithCompany,
  dueDiligence?: DueDiligence
): void {
  const ddData = (dueDiligence?.data as unknown as DueDiligenceData) || {};
  const recommendation =
    prospect.adviserRecommendation || ddData.underwriting?.adviserSummary?.recommendation || "";
  const recText = recommendation ? truncateText(recommendation, 500) : "No recommendation provided.";

  doc.y = startY;
  const recWidth = CONTENT_WIDTH - 24;
  doc.fontSize(9).font("Helvetica");
  const recHeight = doc.heightOfString(recText, { width: recWidth });
  const boxHeight = 78 + recHeight;

  ensureSpace(doc, boxHeight + 20);

  const boxY = doc.y;
  doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 3)
    .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let sigY = boxY + 12;

  doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("ADVISER RECOMMENDATION", MARGIN + 12, sigY);

  sigY += 22;

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Recommendation", MARGIN + 12, sigY);

  sigY += 13;
  doc.fontSize(9).fillColor(recommendation ? COLORS.text : COLORS.textLight).font("Helvetica");
  doc.text(recText, MARGIN + 12, sigY, { width: recWidth });

  sigY += recHeight + 10;

  if (prospect.adviserRecommendationSignedBy) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(
      `Signed by ${prospect.adviserRecommendationSignedBy}${
        prospect.adviserRecommendationSignedAt
          ? ` on ${new Date(prospect.adviserRecommendationSignedAt).toLocaleDateString("en-GB")}`
          : ""
      }`,
      MARGIN + 12,
      sigY
    );
    sigY += 16;
  }

  const col1X = MARGIN + 12;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 8;

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Signature: _________________________________", col1X, sigY);
  doc.text("Date: _________________________________", col2X, sigY);

  sigY += 18;

  doc.text("Name: _________________________________", col1X, sigY);
}

// ============================================================================
// FOOTER
// ============================================================================

function addFootersToAllPages(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany): void {
  const pages = doc.bufferedPageRange();

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    const footerY = PAGE_HEIGHT - 32;

    // Left - Company name
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
    doc.text(prospect.company.companyName, MARGIN, footerY, {
      width: CONTENT_WIDTH / 2 - 10,
      align: "left",
    });

    // Center - Confidential
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica-Bold");
    doc.text("CONFIDENTIAL", PAGE_WIDTH / 2 - 38, footerY);

    // Right - Page number
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN + CONTENT_WIDTH / 2 + 10, footerY, {
      width: CONTENT_WIDTH / 2 - 10,
      align: "right",
    });

    // Bottom - Veltro
    doc.fontSize(7).fillColor(COLORS.textLight).font("Helvetica");
    doc.text("Veltro • Commercial Lending Solutions", MARGIN, footerY + 11, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function checkHasCollateral(prospect: ProspectWithCompany): boolean {
  return (
    (prospect.directorsGuarantee != null && prospect.directorsGuarantee > 0) ||
    (prospect.commercialProperty != null && prospect.commercialProperty > 0) ||
    (prospect.homeEquity != null && prospect.homeEquity > 0) ||
    (prospect.propertyOther != null && prospect.propertyOther > 0) ||
    (prospect.debenture != null && prospect.debenture > 0) ||
    (prospect.parentCompanyGuarantee != null && prospect.parentCompanyGuarantee > 0) ||
    (prospect.collateral != null && prospect.collateral > 0) ||
    (prospect.crossCompanyGuarantee != null && prospect.crossCompanyGuarantee > 0)
  );
}

function calculateTotalSecurity(prospect: ProspectWithCompany): number {
  let total = 0;
  if (prospect.directorsGuarantee) total += prospect.directorsGuarantee;
  if (prospect.commercialProperty) total += prospect.commercialProperty;
  if (prospect.homeEquity) total += prospect.homeEquity;
  if (prospect.propertyOther) total += prospect.propertyOther;
  if (prospect.debenture) total += prospect.debenture;
  if (prospect.parentCompanyGuarantee) total += prospect.parentCompanyGuarantee;
  if (prospect.collateral) total += prospect.collateral;
  if (prospect.crossCompanyGuarantee) total += prospect.crossCompanyGuarantee;
  return total;
}

function getSecurityTypes(prospect: ProspectWithCompany): string[] {
  const types: string[] = [];
  if (prospect.directorsGuarantee && prospect.directorsGuarantee > 0) types.push("PG");
  if (prospect.commercialProperty && prospect.commercialProperty > 0) types.push("Commercial");
  if (prospect.homeEquity && prospect.homeEquity > 0) types.push("Residential");
  if (prospect.propertyOther && prospect.propertyOther > 0) types.push("Other Property");
  if (prospect.debenture && prospect.debenture > 0) types.push("Debenture");
  if (prospect.parentCompanyGuarantee && prospect.parentCompanyGuarantee > 0) types.push("Parent Guarantee");
  if (prospect.collateral && prospect.collateral > 0) types.push("Other");
  if (prospect.crossCompanyGuarantee && prospect.crossCompanyGuarantee > 0) types.push("Cross Guarantee");
  return types;
}

function getStageColor(stage: string): string {
  const stageColors: { [key: string]: string } = {
    lead: "#6B7280",
    contacted: "#3B82F6",
    qualified: "#8B5CF6",
    proposal: "#F59E0B",
    "due-diligence": "#EC4899",
    approval: "#10B981",
    approved: "#059669",
    declined: "#DC2626",
    withdrawn: "#6B7280",
  };
  return stageColors[stage] || COLORS.textSecondary;
}

function getRiskGradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return COLORS.success;
  if (grade === "C") return COLORS.warning;
  return COLORS.danger;
}

function formatCurrency(amountInPence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInPence / 100);
}

function capitalizeStage(stage: string): string {
  return stage
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
