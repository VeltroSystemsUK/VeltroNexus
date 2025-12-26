import PDFDocument from "pdfkit";
import type { ProspectWithCompany, Contact, Activity, DueDiligence } from "@shared/schema";

interface CompaniesHouseData {
  officers?: any;
  psc?: any;
  charges?: any;
}

interface PDFSection {
  id: string;
  label: string;
  enabled: boolean;
}

interface PDFLayoutPreferences {
  sections: PDFSection[];
}

interface ProspectReportData {
  prospect: ProspectWithCompany;
  contacts: Contact[];
  activities: Activity[];
  dueDiligence?: DueDiligence;
  companiesHouseData?: CompaniesHouseData | null;
  pdfLayoutPreferences?: PDFLayoutPreferences | null;
}

// Professional Color Palette - Compact Design
const COLORS = {
  primary: "#2c3e50", // Professional dark blue-gray for headers
  secondary: "#34495e", // Slightly lighter for secondary elements
  accent: "#2563EB", // Bright blue - highlights
  success: "#4caf50", // Green - positive indicators
  warning: "#ff9800", // Orange - warnings
  danger: "#f44336", // Red - alerts
  text: "#333333", // Dark gray - body text
  textSecondary: "#6B7280", // Medium gray - secondary text
  textLight: "#9CA3AF", // Light gray - captions
  border: "#dfe6e9", // Subtle border color
  borderLight: "#eee", // Very light border for sections
  backgroundLight: "#f8f9fa", // Light background for key findings
  backgroundMuted: "#F3F4F6", // Muted background
  white: "#FFFFFF",
  // SWOT Softened Colors
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
  sectionMargin: 15, // Space between sections
  cellPadding: { x: 8, y: 6 }, // Table cell padding
  sectionPadding: 10, // Padding inside sections
  headerMargin: 10, // Space below headers
};

const DEFAULT_SECTIONS: PDFSection[] = [
  { id: "companyInfo", label: "Company Information", enabled: true },
  { id: "officers", label: "Officers", enabled: true },
  { id: "psc", label: "Persons with Significant Control", enabled: true },
  { id: "charges", label: "Charges", enabled: true },
  { id: "savedAssociations", label: "Saved Associated Companies", enabled: true },
  { id: "loanDetails", label: "Loan Details", enabled: true },
  { id: "security", label: "Security & Collateral", enabled: true },
  { id: "notes", label: "Notes", enabled: true },
  { id: "contacts", label: "Key Contacts", enabled: true },
  { id: "activities", label: "Activities & Tasks", enabled: true },
  { id: "dueDiligence", label: "Due Diligence", enabled: true },
  { id: "creditRatios", label: "Credit Ratios", enabled: true },
  { id: "campari", label: "CAMPARI Analysis", enabled: true },
  { id: "swotAnalysis", label: "SWOT Analysis", enabled: true },
];

// Page dimensions
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 60; // Reserve space for footer to prevent overlap

let pageNumber = 0;

// ============================================================================
// FORMATTING FIX: Smart Page Break Management Utilities
// ============================================================================

/**
 * Calculate remaining space on current page (accounting for footer)
 */
function getRemainingSpace(doc: typeof PDFDocument.prototype): number {
  return PAGE_HEIGHT - FOOTER_SPACE - doc.y;
}

/**
 * Check if we need a new page for content of given height
 */
function needsNewPage(doc: typeof PDFDocument.prototype, requiredHeight: number): boolean {
  return getRemainingSpace(doc) < requiredHeight;
}

/**
 * Add a new page if needed to ensure content fits
 */
function ensureSpace(doc: typeof PDFDocument.prototype, requiredHeight: number): void {
  // Don't add pages if we're at the very start of a fresh page
  // This prevents double page additions
  if (doc.y <= MARGIN + 30) {
    return;
  }
  
  if (needsNewPage(doc, requiredHeight)) {
    doc.addPage();
    pageNumber++;
    doc.y = MARGIN + 20;
  }
}

/**
 * Smart text rendering that handles page breaks automatically
 * Prevents text from being cut off mid-paragraph
 */
function renderTextWithPageBreaks(
  doc: typeof PDFDocument.prototype,
  text: string,
  x: number,
  startY: number,
  options: {
    width?: number;
    fontSize?: number;
    font?: string;
    color?: string;
    lineGap?: number;
  } = {}
): number {
  const {
    width = CONTENT_WIDTH - 30,
    fontSize = 10,
    font = "Helvetica",
    color = COLORS.text,
    lineGap = 5,
  } = options;

  doc.fontSize(fontSize).font(font).fillColor(color);

  // Calculate text height before rendering
  const textHeight = doc.heightOfString(text, { width, lineGap });

  // Add new page if text won't fit
  if (needsNewPage(doc, textHeight + 10)) {
    doc.addPage();
    pageNumber++;
    doc.y = MARGIN + 20;
  } else {
    doc.y = startY;
  }

  // Render the text
  doc.text(text, x, doc.y, { width, lineGap });

  return doc.y;
}

/**
 * Render paragraphs with proper spacing and page break awareness
 * Key fix for CAMPARI and other long text sections
 */
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
  const { fontSize = 10, color = COLORS.text, width = CONTENT_WIDTH - 30 } = options;

  paragraphs.forEach((para, index) => {
    if (!para || para.trim() === "") return;

    // Render each paragraph with page break awareness
    doc.y = renderTextWithPageBreaks(doc, para, x, doc.y, {
      fontSize,
      color,
      width,
      font: "Helvetica",
      lineGap: 5,
    });

    // Add spacing between paragraphs (but not after last one)
    if (index < paragraphs.length - 1) {
      doc.y += 10;
    }
  });

  return doc.y;
}

export function generateProspectReport(data: ProspectReportData): typeof PDFDocument.prototype {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Credit Assessment Report - ${data.prospect.company.companyName}`,
      Author: "FlowLoan",
      Subject: "Commercial Lending Credit Assessment",
      Keywords: "credit, assessment, lending, commercial",
    },
  });

  const { prospect, contacts, activities, dueDiligence, companiesHouseData, pdfLayoutPreferences } =
    data;
  pageNumber = 0;

  // Cover Page
  renderCoverPage(doc, prospect);

  // Executive Summary Page
  doc.addPage();
  pageNumber++;
  renderExecutiveSummary(doc, prospect, dueDiligence, companiesHouseData);

  // Content sections - Standard layout with page tracking
  const sections = pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;
  const isSectionEnabled = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    return section?.enabled !== false;
  };

  // Section 1: Company Information - Officers, Key Contacts, PSCs, Background consolidated
  if (isSectionEnabled("companyInfo")) {
    doc.addPage();
    pageNumber++;
    renderCompanyInfoConsolidated(doc, prospect, companiesHouseData, contacts);
  }

  // Section 2: Loan Details with Due Diligence and Purpose of Loan
  if (isSectionEnabled("loanDetails")) {
    doc.addPage();
    pageNumber++;
    renderLoanDetailsWithDueDiligence(doc, prospect, dueDiligence);
  }

  // Section 3: Security, Collateral and Notes consolidated
  const hasCollateral = checkHasCollateral(prospect);
  const hasNotes = !!(prospect.loanRequirementNotes || prospect.notes);
  if ((isSectionEnabled("security") || isSectionEnabled("notes")) && (hasCollateral || hasNotes)) {
    doc.addPage();
    pageNumber++;
    renderSecurityCollateralNotes(doc, prospect);
  }

  // Section 4: Charges (if any)
  if (isSectionEnabled("charges") && companiesHouseData?.charges?.items?.length > 0) {
    doc.addPage();
    pageNumber++;
    renderCharges(doc, companiesHouseData!.charges);
  }

  // Section 5: Saved Associations (if any)
  if (
    isSectionEnabled("savedAssociations") &&
    prospect.savedAssociations &&
    Array.isArray(prospect.savedAssociations) &&
    prospect.savedAssociations.length > 0
  ) {
    doc.addPage();
    pageNumber++;
    renderSavedAssociations(doc, prospect.savedAssociations as any[]);
  }

  // Section 6: Activities (if any)
  if (isSectionEnabled("activities") && activities.length > 0) {
    doc.addPage();
    pageNumber++;
    renderActivities(doc, activities);
  }

  // Section 7: Due Diligence Tools (if any)
  if (isSectionEnabled("dueDiligence") && dueDiligence?.data) {
    const dd = dueDiligence.data as any;
    const hasSubstantiveContent =
      dd.checklist ||
      dd.loanCalculator ||
      dd.dscrCalculator ||
      dd.affordabilityEstimator ||
      dd.financialRatios ||
      dd.characterAssessment;
    if (hasSubstantiveContent) {
      doc.addPage();
      pageNumber++;
      renderDueDiligence(doc, dueDiligence);
    }
  }

  // Section 8: Credit Ratios (dedicated page)
  if (isSectionEnabled("creditRatios") && dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    // Check both locations for accountsAnalysis - creditUnderwriting is more commonly used
    const accountsAnalysis = ddData.creditUnderwriting?.accountsAnalysis || ddData.underwriting?.accountsAnalysis;
    if (accountsAnalysis?.ratios && Array.isArray(accountsAnalysis.ratios) && accountsAnalysis.ratios.length > 0) {
      doc.addPage();
      pageNumber++;
      renderCreditRatiosSection(doc, accountsAnalysis);
    }
  }

  // Section 9: CAMPARI Analysis (if any)
  if (isSectionEnabled("campari") && dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    const adviserSummary = ddData.underwriting?.adviserSummary || ddData.creditUnderwriting?.adviserSummary;
    if (adviserSummary) {
      doc.addPage();
      pageNumber++;
      renderCampariSection(doc, adviserSummary, prospect.loanAllocation as any[]);
    }
  }

  // Section 9: SWOT Analysis (if any)
  if (isSectionEnabled("swotAnalysis") && dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    const swotAnalysis = ddData.underwriting?.swotAnalysis || ddData.creditUnderwriting?.swotAnalysis;
    if (swotAnalysis) {
      doc.addPage();
      pageNumber++;
      renderSwotSection(doc, swotAnalysis);
    }
  }

  // Final Section: Adviser Recommendation with Signature (always last page)
  doc.addPage();
  pageNumber++;
  renderAdviserRecommendation(doc, prospect);

  // Add page numbers to all pages except cover
  const totalPages = doc.bufferedPageRange();
  for (let i = 1; i < totalPages.count; i++) {
    doc.switchToPage(i);
    renderPageFooter(doc, i, totalPages.count - 1);
  }

  // Note: do NOT call doc.end() here - the caller will call it after piping
  return doc;
}

function renderCoverPage(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  // Navy background header band
  doc.rect(0, 0, PAGE_WIDTH, 280).fill(COLORS.primary);

  // FlowLoan branding
  doc.fontSize(14).fillColor(COLORS.white).font("Helvetica");
  doc.text("FLOWLOAN", MARGIN, 40);
  doc.fontSize(10).fillColor(COLORS.textLight);
  doc.text("Commercial Lending Solutions", MARGIN, 58);

  // Main title
  doc.fontSize(36).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("Credit Assessment", MARGIN, 120);
  doc.text("Report", MARGIN, 165);

  // Subtitle line
  doc.rect(MARGIN, 220, 80, 3).fill(COLORS.accent);

  // Company name prominently displayed
  doc.fontSize(24).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, MARGIN, 320);

  // Company details
  doc.fontSize(12).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(`Company Registration: ${prospect.company.companyNumber || "N/A"}`, MARGIN, 360);

  if (prospect.company.registeredAddress) {
    doc.text(`Registered Address: ${prospect.company.registeredAddress}`, MARGIN, 380);
  }

  // Key metrics boxes
  const boxY = 440;
  const boxHeight = 70;
  const boxWidth = (CONTENT_WIDTH - 30) / 3;

  // Loan Amount Box
  renderMetricBox(
    doc,
    MARGIN,
    boxY,
    boxWidth,
    boxHeight,
    "Loan Amount",
    prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD",
    COLORS.accent
  );

  // Term Box
  renderMetricBox(
    doc,
    MARGIN + boxWidth + 15,
    boxY,
    boxWidth,
    boxHeight,
    "Term",
    prospect.term ? `${prospect.term} months` : "TBD",
    COLORS.secondary
  );

  // Stage Box
  renderMetricBox(
    doc,
    MARGIN + (boxWidth + 15) * 2,
    boxY,
    boxWidth,
    boxHeight,
    "Pipeline Stage",
    capitalizeStage(prospect.stage),
    getStageColor(prospect.stage)
  );

  // Report date
  doc.fontSize(11).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Report Date:", MARGIN, 560);
  doc.font("Helvetica-Bold").fillColor(COLORS.text);
  doc.text(
    new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    MARGIN,
    578
  );

  // Confidentiality notice at bottom
  doc.fontSize(9).fillColor(COLORS.textLight).font("Helvetica");
  const confidentialText =
    "CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. " +
    "Unauthorized distribution, copying, or disclosure is strictly prohibited.";
  doc.text(confidentialText, MARGIN, PAGE_HEIGHT - 80, {
    width: CONTENT_WIDTH,
    align: "center",
  });

  // Bottom accent bar
  doc.rect(0, PAGE_HEIGHT - 30, PAGE_WIDTH, 30).fill(COLORS.primary);
}

function renderMetricBox(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  accentColor: string
) {
  // Compact box with light background and accent border
  doc.rect(x, y, width, height).fill(COLORS.backgroundLight);

  // Accent bar on left - 5px as per CSS spec
  doc.rect(x, y, 5, height).fill(accentColor);

  // Label - compact
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label.toUpperCase(), x + 12, y + SPACING.cellPadding.y, { width: width - 20 });

  // Value - slightly smaller for compact design
  doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(value, x + 12, y + 24, { width: width - 20 });
}

function renderExecutiveSummary(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  dueDiligence?: DueDiligence,
  companiesHouseData?: CompaniesHouseData | null
) {
  renderSectionHeader(doc, "Executive Summary", "01");

  let y = doc.y + 15;

  // Business Overview Box - Key company and loan info at a glance
  doc.rect(MARGIN, y, CONTENT_WIDTH, 90).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
  doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("BUSINESS OVERVIEW", MARGIN + 15, y + 12);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  let overviewY = y + 32;

  // Left column
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Company", col1X, overviewY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyName || "N/A", col1X, overviewY + 11, {
    width: CONTENT_WIDTH / 2 - 30,
  });

  // Right column - Sector/SIC
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Sector/Industry", col2X, overviewY);
  const sector = prospect.company.sicDescription || prospect.company.sicCode || "N/A";
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(sector, col2X, overviewY + 11, { width: CONTENT_WIDTH / 2 - 30 });

  overviewY += 28;

  // Pipeline Stage and Referral Source
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Pipeline Stage", col1X, overviewY);
  doc.fontSize(10).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, overviewY + 11);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Referral Source", col2X, overviewY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.referralSource || "Direct", col2X, overviewY + 11);

  y += 105;

  // Loan Purpose Box - use loanRequirementNotes or fall back to notes
  const loanPurposeText = prospect.loanRequirementNotes || prospect.notes;
  if (loanPurposeText) {
    const purposeHeight = 70;
    doc.rect(MARGIN, y, CONTENT_WIDTH, purposeHeight).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, purposeHeight).fill(COLORS.accent);

    doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("LOAN PURPOSE & REQUIREMENTS", MARGIN + 15, y + 12);

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(loanPurposeText, 350), MARGIN + 15, y + 30, {
      width: CONTENT_WIDTH - 30,
    });

    y += purposeHeight + 10;
  }

  // Key Metrics Row - Loan Amount, Term, Rate, Priority
  const metricWidth = (CONTENT_WIDTH - 30) / 4;

  renderSmallMetricBox(
    doc,
    MARGIN,
    y,
    metricWidth,
    "Loan Amount",
    prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD"
  );
  renderSmallMetricBox(
    doc,
    MARGIN + metricWidth + 10,
    y,
    metricWidth,
    "Term",
    prospect.term ? `${prospect.term} months` : "TBD"
  );
  renderSmallMetricBox(
    doc,
    MARGIN + (metricWidth + 10) * 2,
    y,
    metricWidth,
    "Interest Rate",
    prospect.interestRate ? `${prospect.interestRate}%` : "TBD"
  );
  renderSmallMetricBox(
    doc,
    MARGIN + (metricWidth + 10) * 3,
    y,
    metricWidth,
    "Priority",
    prospect.priority ? capitalizeStage(prospect.priority) : "Normal"
  );

  y += 65;

  // Security Position
  const totalSecurity = calculateTotalSecurity(prospect);
  const colWidth = (CONTENT_WIDTH - 20) / 2;

  doc.rect(MARGIN, y, colWidth, 100).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("SECURITY POSITION", MARGIN + 15, y + 12);

  let secY = y + 35;
  renderKeyValue(
    doc,
    MARGIN + 15,
    secY,
    "Total Security",
    formatCurrency(totalSecurity),
    colWidth - 30
  );
  secY += 22;


  const securityTypes = getSecurityTypes(prospect);
  renderKeyValue(
    doc,
    MARGIN + 15,
    secY,
    "Security Types",
    securityTypes.length > 0 ? securityTypes.slice(0, 3).join(", ") : "None",
    colWidth - 30
  );

  // Assessment Status Box
  doc.rect(MARGIN + colWidth + 20, y, colWidth, 100).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("ASSESSMENT STATUS", MARGIN + colWidth + 35, y + 12);

  let statusY = y + 35;

  if (dueDiligence?.data) {
    const ddData = dueDiligence.data as any;

    // Checklist progress
    if (ddData.checklist) {
      const allItems = Object.values(ddData.checklist).flat();
      const totalItems = allItems.length;
      const completedItems = allItems.filter((item: any) => item?.checked).length;
      const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      renderProgressBar(
        doc,
        MARGIN + colWidth + 35,
        statusY,
        colWidth - 80,
        "Progress",
        percentage
      );
      statusY += 30;
    }

    // DSCR if available
    if (ddData.dscrCalculator?.dscr != null) {
      const dscr = ddData.dscrCalculator.dscr;
      const dscrStatus = dscr >= 1.25 ? "PASS" : dscr >= 1.0 ? "CAUTION" : "FAIL";
      const dscrColor =
        dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text("DSCR:", MARGIN + colWidth + 35, statusY);
      doc.fontSize(11).fillColor(dscrColor).font("Helvetica-Bold");
      doc.text(`${dscr.toFixed(2)} (${dscrStatus})`, MARGIN + colWidth + 70, statusY);
    }

    // Risk Grade if available
    const underwData = ddData.underwriting || ddData.creditUnderwriting;
    if (underwData?.riskGrade || underwData?.finalRiskGrade) {
      const grade = underwData.finalRiskGrade || underwData.riskGrade;
      const gradeColor = getRiskGradeColor(grade);
      statusY += 18;
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text("Risk Grade:", MARGIN + colWidth + 35, statusY);
      doc.fontSize(11).fillColor(gradeColor).font("Helvetica-Bold");
      doc.text(grade, MARGIN + colWidth + 95, statusY);
    }
  } else {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Due diligence not yet started", MARGIN + colWidth + 35, statusY);
  }

  y += 115;

  // Key Findings if space available
  if (y < PAGE_HEIGHT - 120) {
    const status = prospect.company.companyStatus || "Unknown";
    const activeOfficers =
      companiesHouseData?.officers?.items?.filter((o: any) => !o.resigned_on).length || 0;
    const outstanding =
      companiesHouseData?.charges?.items?.filter((c: any) => c.status === "outstanding").length ||
      0;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("KEY FINDINGS", MARGIN + 15, y + 12);

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    let findingsY = y + 32;

    doc.text(
      `• Company Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      MARGIN + 15,
      findingsY
    );
    doc.text(`• Active Officers: ${activeOfficers}`, MARGIN + 200, findingsY);
    doc.text(`• Outstanding Charges: ${outstanding}`, MARGIN + 350, findingsY);

    findingsY += 16;
    if (prospect.company.incorporationDate) {
      const incDate = new Date(prospect.company.incorporationDate);
      doc.text(`• Incorporated: ${incDate.toLocaleDateString("en-GB")}`, MARGIN + 15, findingsY);
    }
    if (prospect.company.postcode) {
      doc.text(`• Location: ${prospect.company.postcode}`, MARGIN + 200, findingsY);
    }
  }
}

function renderProgressBar(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  width: number,
  label: string,
  percentage: number
) {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label, x, y);

  // Background bar
  doc.rect(x, y + 14, width, 8).fill(COLORS.backgroundMuted);

  // Progress bar
  const progressWidth = (width * percentage) / 100;
  const progressColor =
    percentage >= 80 ? COLORS.success : percentage >= 50 ? COLORS.warning : COLORS.accent;
  doc.rect(x, y + 14, progressWidth, 8).fill(progressColor);

  // Percentage text
  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(`${percentage}%`, x + width + 10, y + 12);
}

function renderKeyValue(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number
) {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label, x, y);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(value, x, y + 12, { width: width });
}

function renderTableOfContents(
  doc: typeof PDFDocument.prototype,
  sections: PDFSection[],
  companiesHouseData: CompaniesHouseData | null | undefined,
  prospect: ProspectWithCompany,
  contacts: Contact[],
  activities: Activity[],
  dueDiligence?: DueDiligence
) {
  renderSectionHeader(doc, "Table of Contents", "02");

  let y = doc.y + 30;
  let pageNum = 3;

  doc.fontSize(11).font("Helvetica");

  const tocItems: { label: string; page: number }[] = [];

  sections.forEach((section) => {
    if (!section.enabled) return;

    let shouldInclude = false;
    switch (section.id) {
      case "companyInfo":
        shouldInclude = true;
        break;
      case "officers":
        shouldInclude = (companiesHouseData?.officers?.items?.length ?? 0) > 0;
        break;
      case "psc":
        shouldInclude = (companiesHouseData?.psc?.items?.length ?? 0) > 0;
        break;
      case "charges":
        shouldInclude = (companiesHouseData?.charges?.items?.length ?? 0) > 0;
        break;
      case "savedAssociations":
        shouldInclude =
          Array.isArray(prospect.savedAssociations) && prospect.savedAssociations.length > 0;
        break;
      case "loanDetails":
        shouldInclude = true;
        break;
      case "security":
        shouldInclude = checkHasCollateral(prospect);
        break;
      case "notes":
        shouldInclude = !!(prospect.loanRequirementNotes || prospect.notes);
        break;
      case "contacts":
        shouldInclude = contacts.length > 0;
        break;
      case "activities":
        shouldInclude = activities.length > 0;
        break;
      case "dueDiligence": {
        const ddData = dueDiligence?.data as any;
        const hasSubstantiveContent = ddData?.checklist || ddData?.loanCalculator || ddData?.dscrCalculator || ddData?.affordabilityEstimator || ddData?.financialRatios || ddData?.characterAssessment;
        shouldInclude = !!hasSubstantiveContent;
        break;
      }
      case "campari": {
        const ddDataCampari = dueDiligence?.data as any;
        shouldInclude = !!(ddDataCampari?.underwriting?.adviserSummary || ddDataCampari?.creditUnderwriting?.adviserSummary);
        break;
      }
      case "swotAnalysis": {
        const ddDataSwot = dueDiligence?.data as any;
        shouldInclude = !!(ddDataSwot?.underwriting?.swotAnalysis || ddDataSwot?.creditUnderwriting?.swotAnalysis);
        break;
      }
    }

    if (shouldInclude) {
      tocItems.push({ label: section.label, page: pageNum });
      pageNum++;
    }
  });

  tocItems.forEach((item, index) => {
    const sectionNum = String(index + 3).padStart(2, "0");

    // Section number
    doc.fillColor(COLORS.accent).font("Helvetica-Bold");
    doc.text(sectionNum, MARGIN, y);

    // Section label
    doc.fillColor(COLORS.text).font("Helvetica");
    doc.text(item.label, MARGIN + 35, y);

    // Dotted line
    const labelWidth = doc.widthOfString(item.label);
    const dotsStart = MARGIN + 35 + labelWidth + 10;
    const dotsEnd = PAGE_WIDTH - MARGIN - 30;

    doc.fillColor(COLORS.textLight);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      doc.text(".", dotX, y);
      dotX += 5;
    }

    // Page number
    doc.fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(String(item.page), PAGE_WIDTH - MARGIN - 20, y);

    y += 28;
  });
}

function renderSectionHeader(
  doc: typeof PDFDocument.prototype,
  title: string,
  sectionNumber?: string
) {
  // Compact header bar with thinner height
  const headerHeight = 40;
  doc.rect(0, MARGIN, PAGE_WIDTH, headerHeight).fill(COLORS.primary);

  // Section number (if provided) - inline with title
  if (sectionNumber) {
    doc.fontSize(10).fillColor(COLORS.accent).font("Helvetica");
    doc.text(`${sectionNumber}`, MARGIN, MARGIN + 14);
    // Title - uppercase for professional look
    doc.fontSize(16).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(title.toUpperCase(), MARGIN + 30, MARGIN + 12);
  } else {
    // Title only - uppercase
    doc.fontSize(16).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(title.toUpperCase(), MARGIN, MARGIN + 12);
  }

  doc.y = MARGIN + headerHeight + SPACING.sectionPadding;
}

// Consolidated Company Information - Officers, Key Contacts, PSCs, Background on same page(s)
function renderCompanyInfoConsolidated(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  companiesHouseData: CompaniesHouseData | null | undefined,
  contacts: Contact[]
) {
  renderSectionHeader(doc, "Company Information", "03");
  let y = doc.y + 10;

  // Company header info
  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(16).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, MARGIN + 15, y + 15);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  let detailY = y + 45;

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Company Number:", col1X, detailY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyNumber || "N/A", col1X + 100, detailY);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Status:", col2X, detailY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyStatus ? capitalizeStage(prospect.company.companyStatus) : "N/A", col2X + 50, detailY);

  detailY += 20;
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Type:", col1X, detailY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyType || "N/A", col1X + 100, detailY);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Incorporated:", col2X, detailY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.incorporationDate || "N/A", col2X + 70, detailY);

  y += 110;

  // Officers section (compact)
  const officers = companiesHouseData?.officers?.items?.filter((o: any) => !o.resigned_on) || [];
  if (officers.length > 0) {
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Officers", MARGIN, y);
    y += 20;

    officers.slice(0, 5).forEach((officer: any) => {
      if (y > PAGE_HEIGHT - 60) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      doc.rect(MARGIN, y, CONTENT_WIDTH, 35).fillAndStroke(COLORS.backgroundLight, COLORS.border);
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(officer.name || "Unknown", MARGIN + 10, y + 8);
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(officer.officer_role || "N/A", MARGIN + 10, y + 22);
      doc.text(`Appointed: ${officer.appointed_on || "N/A"}`, MARGIN + CONTENT_WIDTH - 150, y + 15);
      y += 40;
    });
    y += 10;
  }

  // Key Contacts section (compact)
  if (contacts.length > 0) {
    if (y > PAGE_HEIGHT - 100) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Key Contacts", MARGIN, y);
    y += 20;

    contacts.slice(0, 4).forEach((contact) => {
      if (y > PAGE_HEIGHT - 50) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      doc.rect(MARGIN, y, CONTENT_WIDTH, 30).fillAndStroke(COLORS.backgroundLight, COLORS.border);
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(contact.name, MARGIN + 10, y + 8);
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(contact.role || "N/A", MARGIN + 150, y + 8);
      doc.text(contact.email || "", MARGIN + CONTENT_WIDTH - 200, y + 8);
      y += 35;
    });
    y += 10;
  }

  // Persons of Significant Control (compact)
  const pscList = companiesHouseData?.psc?.items?.filter((p: any) => !p.ceased_on) || [];
  if (pscList.length > 0) {
    if (y > PAGE_HEIGHT - 100) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Persons of Significant Control", MARGIN, y);
    y += 20;

    pscList.slice(0, 4).forEach((psc: any) => {
      if (y > PAGE_HEIGHT - 50) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      doc.rect(MARGIN, y, CONTENT_WIDTH, 30).fillAndStroke(COLORS.backgroundLight, COLORS.border);
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(psc.name || "Unknown", MARGIN + 10, y + 8);
      const ownership = psc.natures_of_control?.find((n: string) => n.includes("ownership"))?.replace(/-/g, " ") || "";
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(ownership, MARGIN + CONTENT_WIDTH - 200, y + 8, { width: 180 });
      y += 35;
    });
    y += 10;
  }

  // Background section
  if (prospect.background) {
    if (y > PAGE_HEIGHT - 120) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Background", MARGIN, y);
    y += 20;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.white, COLORS.border);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(prospect.background, 500), MARGIN + 10, y + 10, { width: CONTENT_WIDTH - 20 });
  }
}

// Loan Details with Due Diligence and Purpose of Loan
function renderLoanDetailsWithDueDiligence(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  dueDiligence?: DueDiligence
) {
  renderSectionHeader(doc, "Loan Details", "04");
  let y = doc.y + 10;

  // Loan amount, term, rate
  doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.white, COLORS.border);
  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 3;
  const col3X = MARGIN + (CONTENT_WIDTH * 2) / 3;

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Loan Amount", col1X, y + 15);
  doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(formatCurrency(prospect.loanAmount || 0), col1X, y + 30);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Term", col2X, y + 15);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "N/A", col2X, y + 30);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Interest Rate", col3X, y + 15);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.interestRate ? `${prospect.interestRate}%` : "N/A", col3X, y + 30);

  y += 90;

  // Purpose of Loan (from Adviser Summary)
  const ddData = dueDiligence?.data as any;
  const adviserSummary = ddData?.underwriting?.adviserSummary || ddData?.creditUnderwriting?.adviserSummary;
  const purposeOfLoan = adviserSummary?.proposalSummary || adviserSummary?.purpose || "";

  if (purposeOfLoan) {
    // Convert long free-text into a structured layout (headings + bullets)
    const formattedPurpose = formatPurposeOfLoan(purposeOfLoan);

    // Render in a measured card (prevents overflow / overlap with following sections)
    const out = renderMeasuredTextCard({
      doc,
      title: "PURPOSE OF LOAN",
      text: formattedPurpose,
      y,
      pageNumber: 0,
      accentColor: COLORS.accent,
      fillColor: COLORS.backgroundLight,
      minHeight: 110,
      titleColor: COLORS.primary,
    });
    y = out.y;
  }

  // Due Diligence Summary
  if (ddData) {
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Due Diligence Overview", MARGIN, y);
    y += 20;

    const dueDiligenceItems = [];
    if (ddData.dscrCalculator?.dscr != null) {
      const dscr = ddData.dscrCalculator.dscr;
      const status = dscr >= 1.25 ? "PASS" : dscr >= 1.0 ? "CAUTION" : "FAIL";
      dueDiligenceItems.push({ label: "DSCR", value: `${dscr.toFixed(2)} (${status})` });
    }
    if (ddData.affordabilityEstimator?.disposableIncome != null) {
      dueDiligenceItems.push({
        label: "Disposable Income",
        value: formatCurrency(ddData.affordabilityEstimator.disposableIncome * 100),
      });
    }
    if (ddData.loanCalculator?.monthlyPayment != null) {
      dueDiligenceItems.push({
        label: "Monthly Payment",
        value: formatCurrency(ddData.loanCalculator.monthlyPayment * 100),
      });
    }
    if (ddData.checklist) {
      const allItems = Object.values(ddData.checklist).flat();
      const totalItems = allItems.length;
      const completedItems = allItems.filter((item: any) => item?.checked).length;
      dueDiligenceItems.push({
        label: "Checklist Progress",
        value: `${completedItems}/${totalItems} items completed`,
      });
    }

    if (dueDiligenceItems.length > 0) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, dueDiligenceItems.length * 25 + 15).fillAndStroke(COLORS.white, COLORS.border);
      let itemY = y + 10;
      dueDiligenceItems.forEach((item) => {
        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
        doc.text(item.label + ":", MARGIN + 15, itemY);
        doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
        doc.text(item.value, MARGIN + 150, itemY);
        itemY += 25;
      });
    }
  }
}

// Security, Collateral, and Notes consolidated
function renderSecurityCollateralNotes(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Security & Collateral", "05");
  let y = doc.y + 10;

  // Security types
  const securityItems = [];
  if (prospect.directorsGuarantee) securityItems.push({ label: "Directors Guarantee", value: formatCurrency(prospect.directorsGuarantee) });
  if (prospect.commercialProperty) securityItems.push({ label: "Commercial Property", value: formatCurrency(prospect.commercialProperty) });
  if (prospect.homeEquity) securityItems.push({ label: "Home Equity", value: formatCurrency(prospect.homeEquity) });
  if (prospect.propertyOther) securityItems.push({ label: "Other Property", value: formatCurrency(prospect.propertyOther) });
  if (prospect.debenture) securityItems.push({ label: "Debenture", value: formatCurrency(prospect.debenture) });
  if (prospect.parentCompanyGuarantee) securityItems.push({ label: "Parent Company Guarantee", value: formatCurrency(prospect.parentCompanyGuarantee) });
  if (prospect.collateral) securityItems.push({ label: "Other Collateral", value: formatCurrency(prospect.collateral) });
  if (prospect.crossCompanyGuarantee) securityItems.push({ label: "Cross Company Guarantee", value: formatCurrency(prospect.crossCompanyGuarantee) });

  const totalSecurity = calculateTotalSecurity(prospect);

  if (securityItems.length > 0) {
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Security Types", MARGIN, y);
    y += 20;

    const boxHeight = Math.min(securityItems.length * 25 + 40, 200);
    doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight).fillAndStroke(COLORS.white, COLORS.border);

    let itemY = y + 15;
    securityItems.forEach((item) => {
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(item.label, MARGIN + 15, itemY);
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(item.value, MARGIN + CONTENT_WIDTH - 120, itemY);
      itemY += 25;
    });

    // Total
    doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Total Security:", MARGIN + 15, itemY);
    doc.text(formatCurrency(totalSecurity), MARGIN + CONTENT_WIDTH - 120, itemY);

    y += boxHeight + 15;
  }

  // Notes section
  if (prospect.loanRequirementNotes || prospect.notes) {
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Notes", MARGIN, y);
    y += 20;

    const allNotes = [prospect.loanRequirementNotes, prospect.notes].filter(Boolean).join("\n\n");
    const notesHeight = Math.min(150, 50 + allNotes.length / 3);

    doc.rect(MARGIN, y, CONTENT_WIDTH, notesHeight).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(allNotes, 600), MARGIN + 15, y + 15, { width: CONTENT_WIDTH - 30 });
  }
}

// Adviser Recommendation with Signature Box (Final Page)
function renderAdviserRecommendation(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Adviser Recommendation");
  let y = doc.y + 20;

  // Recommendation text
  doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Recommendation", MARGIN, y);
  y += 20;

  const recommendationText = prospect.adviserRecommendation || "No recommendation provided.";
  const textHeight = Math.max(150, Math.min(300, recommendationText.length / 2));

  doc.rect(MARGIN, y, CONTENT_WIDTH, textHeight).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(11).fillColor(COLORS.text).font("Helvetica");
  doc.text(recommendationText, MARGIN + 15, y + 15, { width: CONTENT_WIDTH - 30 });

  y += textHeight + 30;

  // Signature box
  doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Signature", MARGIN, y);
  y += 20;

  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  if (prospect.adviserRecommendationSignedBy && prospect.adviserRecommendationSignedAt) {
    // Signed state
    doc.fontSize(10).fillColor(COLORS.success).font("Helvetica-Bold");
    doc.text("SIGNED", MARGIN + 15, y + 15);

    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Signed by:", MARGIN + 15, y + 40);
    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.adviserRecommendationSignedBy, MARGIN + 80, y + 40);

    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Date/Time:", MARGIN + 15, y + 60);
    const signedDate = new Date(prospect.adviserRecommendationSignedAt).toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(signedDate, MARGIN + 80, y + 60);
  } else {
    // Unsigned state
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Signature: _________________________________", MARGIN + 15, y + 25);
    doc.text("Name: _________________________________", MARGIN + 15, y + 50);
    doc.text("Date: _________________________________", MARGIN + 15, y + 75);
  }

  // Footer note
  y += 120;
  doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
  doc.text(
    "This report is confidential and intended for internal use only. The information contained herein has been prepared based on data provided and should be verified independently.",
    MARGIN,
    y,
    { width: CONTENT_WIDTH, align: "center" }
  );
}

function renderCompanyInfo(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Company Information", "03");

  let y = doc.y + 10;

  // Main company info card
  doc.rect(MARGIN, y, CONTENT_WIDTH, 180).fillAndStroke(COLORS.white, COLORS.border);

  // Company name prominently
  doc.fontSize(18).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, MARGIN + 20, y + 20);

  // Company details in two columns
  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  let detailY = y + 55;

  renderDetailRow(doc, col1X, detailY, "Company Number", prospect.company.companyNumber || "N/A");
  renderDetailRow(
    doc,
    col2X,
    detailY,
    "Company Status",
    prospect.company.companyStatus ? capitalizeStage(prospect.company.companyStatus) : "N/A"
  );
  detailY += 35;

  renderDetailRow(doc, col1X, detailY, "Company Type", prospect.company.companyType || "N/A");
  renderDetailRow(
    doc,
    col2X,
    detailY,
    "Incorporation Date",
    prospect.company.incorporationDate || "N/A"
  );
  detailY += 35;

  if (prospect.company.registeredAddress) {
    renderDetailRow(
      doc,
      col1X,
      detailY,
      "Registered Address",
      prospect.company.registeredAddress,
      CONTENT_WIDTH - 40
    );
  }

  y += 200;

  // SIC Codes section if available (cast to any as sicCodes may come from extended data)
  const companyData = prospect.company as any;
  if (
    companyData.sicCodes &&
    Array.isArray(companyData.sicCodes) &&
    companyData.sicCodes.length > 0
  ) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("SIC CODES", MARGIN + 20, y + 15);

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    let sicY = y + 35;
    companyData.sicCodes.forEach((code: string) => {
      doc.text(`• ${code}`, MARGIN + 20, sicY);
      sicY += 16;
    });
  }
}

function renderDetailRow(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  label: string,
  value: string,
  width?: number
) {
  // Compact detail row with tighter spacing
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label.toUpperCase(), x, y);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(value, x, y + 12, { width: width || 200 });
}

function renderOfficers(doc: typeof PDFDocument.prototype, officers: any) {
  renderSectionHeader(doc, "Officers", "04");

  const activeOfficers = officers.items.filter((o: any) => !o.resigned_on);
  const resignedOfficers = officers.items.filter((o: any) => o.resigned_on);

  let y = doc.y + 10;

  // Active Officers
  if (activeOfficers.length > 0) {
    doc.fontSize(12).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text(`Active Officers (${activeOfficers.length})`, MARGIN, y);
    y += 20;

    activeOfficers.forEach((officer: any, index: number) => {
      if (y > PAGE_HEIGHT - 150) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      // Officer card
      doc.rect(MARGIN, y, CONTENT_WIDTH, 50).fillAndStroke(COLORS.white, COLORS.border);

      // Green status indicator
      doc.rect(MARGIN, y, 4, 50).fill(COLORS.success);

      const name = officer.name || "Unknown";
      const role = officer.officer_role?.replace(/-/g, " ") || "Officer";
      const appointed = officer.appointed_on
        ? new Date(officer.appointed_on).toLocaleDateString("en-GB")
        : "N/A";

      doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(name, MARGIN + 15, y + 10);

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(role.charAt(0).toUpperCase() + role.slice(1), MARGIN + 15, y + 28);

      doc.text(`Appointed: ${appointed}`, MARGIN + CONTENT_WIDTH - 150, y + 28);

      y += 60;
    });
  }

  // Resigned Officers (condensed)
  if (resignedOfficers.length > 0) {
    y += 10;
    doc.fontSize(12).fillColor(COLORS.textSecondary).font("Helvetica-Bold");
    doc.text(`Former Officers (${resignedOfficers.length})`, MARGIN, y);
    y += 20;

    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    resignedOfficers.slice(0, 10).forEach((officer: any) => {
      if (y > PAGE_HEIGHT - 60) return;
      const name = officer.name || "Unknown";
      const resigned = officer.resigned_on
        ? new Date(officer.resigned_on).toLocaleDateString("en-GB")
        : "";
      doc.text(`• ${name} (resigned ${resigned})`, MARGIN + 10, y);
      y += 14;
    });

    if (resignedOfficers.length > 10) {
      doc.text(`... and ${resignedOfficers.length - 10} more former officers`, MARGIN + 10, y);
    }
  }
}

function renderPSC(doc: typeof PDFDocument.prototype, psc: any) {
  renderSectionHeader(doc, "Persons with Significant Control", "05");

  const activePsc = psc.items.filter((p: any) => !p.ceased_on);
  const ceasedPsc = psc.items.filter((p: any) => p.ceased_on);

  let y = doc.y + 10;

  if (activePsc.length > 0) {
    doc.fontSize(12).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text(`Active PSCs (${activePsc.length})`, MARGIN, y);
    y += 20;

    activePsc.forEach((person: any) => {
      if (y > PAGE_HEIGHT - 150) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      const name = person.name || "Unknown Entity";
      const kind = person.kind?.replace(/-/g, " ") || "";

      // PSC card
      const cardHeight = 60 + (person.natures_of_control?.length || 0) * 14;
      doc
        .rect(MARGIN, y, CONTENT_WIDTH, Math.min(cardHeight, 120))
        .fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, Math.min(cardHeight, 120)).fill(COLORS.accent);

      doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(name, MARGIN + 15, y + 12);

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(kind.charAt(0).toUpperCase() + kind.slice(1), MARGIN + 15, y + 28);

      if (person.natures_of_control && person.natures_of_control.length > 0) {
        let controlY = y + 44;
        doc.fontSize(8).fillColor(COLORS.textLight);
        person.natures_of_control.slice(0, 4).forEach((nature: string) => {
          const formatted = nature
            .replace(/-/g, " ")
            .split(" ")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          doc.text(`• ${formatted}`, MARGIN + 15, controlY, { width: CONTENT_WIDTH - 40 });
          controlY += 14;
        });
      }

      y += Math.min(cardHeight, 120) + 10;
    });
  }

  // Ceased PSCs summary
  if (ceasedPsc.length > 0) {
    y += 10;
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(
      `Note: ${ceasedPsc.length} former PSC(s) have ceased their significant control.`,
      MARGIN,
      y
    );
  }
}

function renderCharges(doc: typeof PDFDocument.prototype, charges: any) {
  renderSectionHeader(doc, "Charges", "06");

  const outstandingCharges = charges.items.filter((c: any) => c.status === "outstanding");
  const satisfiedCharges = charges.items.filter(
    (c: any) => c.status === "satisfied" || c.status === "fully-satisfied"
  );

  let y = doc.y + 10;

  // Summary box
  doc.rect(MARGIN, y, CONTENT_WIDTH, 50).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const halfWidth = CONTENT_WIDTH / 2;

  // Outstanding count
  doc
    .fontSize(24)
    .fillColor(outstandingCharges.length > 0 ? COLORS.warning : COLORS.success)
    .font("Helvetica-Bold");
  doc.text(String(outstandingCharges.length), MARGIN + halfWidth / 2 - 15, y + 8);
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("OUTSTANDING", MARGIN + halfWidth / 2 - 30, y + 35);

  // Satisfied count
  doc.fontSize(24).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(String(satisfiedCharges.length), MARGIN + halfWidth + halfWidth / 2 - 15, y + 8);
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("SATISFIED", MARGIN + halfWidth + halfWidth / 2 - 25, y + 35);

  y += 70;

  // Outstanding charges detail
  if (outstandingCharges.length > 0) {
    doc.fontSize(12).fillColor(COLORS.warning).font("Helvetica-Bold");
    doc.text("Outstanding Charges", MARGIN, y);
    y += 20;

    outstandingCharges.forEach((charge: any) => {
      if (y > PAGE_HEIGHT - 120) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 60).fill(COLORS.warning);

      const entitled = charge.persons_entitled?.[0]?.name || "Unknown Creditor";
      const created = charge.created_on
        ? new Date(charge.created_on).toLocaleDateString("en-GB")
        : "N/A";
      const type = charge.classification?.description || "Charge";

      doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(entitled, MARGIN + 15, y + 12, { width: CONTENT_WIDTH - 150 });

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(type, MARGIN + 15, y + 30, { width: CONTENT_WIDTH - 40 });
      doc.text(`Created: ${created}`, MARGIN + 15, y + 44);

      y += 70;
    });
  }

  // Satisfied charges summary
  if (satisfiedCharges.length > 0) {
    y += 10;
    doc.fontSize(10).fillColor(COLORS.success).font("Helvetica");
    doc.text(`${satisfiedCharges.length} charge(s) have been fully satisfied.`, MARGIN, y);
  }
}

function renderSavedAssociations(doc: typeof PDFDocument.prototype, associations: any[]) {
  renderSectionHeader(doc, "Associated Companies", "07");

  const byType: { [key: string]: any[] } = {};
  associations.forEach((assoc: any) => {
    const type = assoc.associationType || "other";
    if (!byType[type]) byType[type] = [];
    byType[type].push(assoc);
  });

  const typeLabels: { [key: string]: string } = {
    officer: "Common Directors",
    psc: "Common Ownership",
    address: "Same Registered Address",
    other: "Other Associations",
  };

  const typeColors: { [key: string]: string } = {
    officer: COLORS.accent,
    psc: COLORS.secondary,
    address: COLORS.warning,
    other: COLORS.textSecondary,
  };

  let y = doc.y + 10;

  Object.keys(byType).forEach((type) => {
    if (byType[type].length === 0) return;

    if (y > PAGE_HEIGHT - 150) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const label = typeLabels[type] || type;
    const color = typeColors[type] || COLORS.textSecondary;

    doc.fontSize(12).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text(`${label} (${byType[type].length})`, MARGIN, y);
    y += 20;

    byType[type].forEach((company: any) => {
      if (y > PAGE_HEIGHT - 80) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      doc.rect(MARGIN, y, CONTENT_WIDTH, 45).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 45).fill(color);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(company.company_name || "Unknown", MARGIN + 15, y + 10);

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      const details = [];
      if (company.company_number) details.push(`No. ${company.company_number}`);
      if (company.company_status) details.push(company.company_status);
      doc.text(details.join(" • "), MARGIN + 15, y + 28);

      y += 55;
    });

    y += 10;
  });
}

function renderLoanDetails(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Loan Details", "08");

  let y = doc.y + 10;

  // Main loan metrics
  const boxWidth = (CONTENT_WIDTH - 30) / 3;

  renderLargeMetricBox(
    doc,
    MARGIN,
    y,
    boxWidth,
    "Loan Amount",
    prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD"
  );
  renderLargeMetricBox(
    doc,
    MARGIN + boxWidth + 15,
    y,
    boxWidth,
    "Term",
    prospect.term ? `${prospect.term} months` : "TBD"
  );
  renderLargeMetricBox(
    doc,
    MARGIN + (boxWidth + 15) * 2,
    y,
    boxWidth,
    "Interest Rate",
    prospect.interestRate ? `${prospect.interestRate}%` : "TBD"
  );

  y += 110;

  // Additional details
  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("ADDITIONAL DETAILS", MARGIN + 20, y + 15);

  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  let detailY = y + 40;

  renderDetailRow(doc, col1X, detailY, "Pipeline Stage", capitalizeStage(prospect.stage));
  renderDetailRow(
    doc,
    col2X,
    detailY,
    "Priority",
    prospect.priority ? capitalizeStage(prospect.priority) : "Normal"
  );

  // Calculate estimated monthly payment if loan details are available
  if (prospect.loanAmount && prospect.term && prospect.interestRate) {
    detailY += 35;
    const interestRateNum =
      typeof prospect.interestRate === "string"
        ? parseFloat(prospect.interestRate)
        : prospect.interestRate;
    const monthlyRate = interestRateNum / 100 / 12;
    const numPayments = prospect.term;
    const principal = prospect.loanAmount / 100; // Convert from pence
    const monthlyPayment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    renderDetailRow(
      doc,
      col1X,
      detailY,
      "Est. Monthly Payment",
      formatCurrency(Math.round(monthlyPayment * 100))
    );
  }
}

function renderLargeMetricBox(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string
) {
  doc.rect(x, y, width, 90).fillAndStroke(COLORS.backgroundLight, COLORS.border);
  doc.rect(x, y, width, 4).fill(COLORS.accent);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label.toUpperCase(), x + 15, y + 20, { width: width - 30, align: "center" });

  doc.fontSize(22).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(value, x + 15, y + 45, { width: width - 30, align: "center" });
}

function renderSecurity(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Security & Collateral", "09");

  let y = doc.y + 10;

  // Total security summary
  const totalSecurity = calculateTotalSecurity(prospect);

  doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.primary, COLORS.primary);
  doc.fontSize(10).fillColor(COLORS.textLight).font("Helvetica");
  doc.text("TOTAL SECURITY VALUE", MARGIN + 20, y + 15);
  doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity), MARGIN + 20, y + 32);

  y += 90;

  // Individual security items
  const securities = [
    { label: "Directors Guarantee", value: prospect.directorsGuarantee },
    { label: "Commercial Property", value: prospect.commercialProperty },
    { label: "Home Equity", value: prospect.homeEquity },
    { label: "Other Property", value: prospect.propertyOther },
    { label: "Debenture", value: prospect.debenture },
    { label: "Parent Company Guarantee", value: prospect.parentCompanyGuarantee },
    { label: "Other Collateral", value: prospect.collateral },
    { label: "Cross Company Guarantee", value: prospect.crossCompanyGuarantee },
  ].filter((s) => s.value != null && s.value > 0);

  const colWidth = (CONTENT_WIDTH - 15) / 2;

  securities.forEach((security, index) => {
    const x = index % 2 === 0 ? MARGIN : MARGIN + colWidth + 15;
    const row = Math.floor(index / 2);
    const itemY = y + row * 55;

    if (itemY > PAGE_HEIGHT - 100) return;

    doc.rect(x, itemY, colWidth, 45).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(x, itemY, 4, 45).fill(COLORS.success);

    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(security.label.toUpperCase(), x + 15, itemY + 10);

    doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(formatCurrency(security.value!), x + 15, itemY + 25);
  });
}

function renderNotes(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, "Notes & Requirements", "10");

  let y = doc.y + 10;

  if (prospect.loanRequirementNotes) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 120).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 120).fill(COLORS.accent);

    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("LOAN REQUIREMENTS", MARGIN + 15, y + 15);

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(prospect.loanRequirementNotes, MARGIN + 15, y + 35, {
      width: CONTENT_WIDTH - 40,
      height: 75,
    });

    y += 135;
  }

  if (prospect.notes) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 120).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 120).fill(COLORS.secondary);

    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("ADDITIONAL NOTES", MARGIN + 15, y + 15);

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(prospect.notes, MARGIN + 15, y + 35, {
      width: CONTENT_WIDTH - 40,
      height: 75,
    });
  }
}

function renderContacts(doc: typeof PDFDocument.prototype, contacts: Contact[]) {
  renderSectionHeader(doc, "Key Contacts", "11");

  let y = doc.y + 10;

  contacts.forEach((contact, index) => {
    if (y > PAGE_HEIGHT - 120) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const cardHeight = 70;
    doc.rect(MARGIN, y, CONTENT_WIDTH, cardHeight).fillAndStroke(COLORS.white, COLORS.border);

    if (contact.isPrimary === 1) {
      doc.rect(MARGIN, y, 4, cardHeight).fill(COLORS.accent);

      // Primary badge
      doc.rect(PAGE_WIDTH - MARGIN - 70, y + 10, 60, 20).fill(COLORS.accent);
      doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text("PRIMARY", PAGE_WIDTH - MARGIN - 65, y + 16);
    } else {
      doc.rect(MARGIN, y, 4, cardHeight).fill(COLORS.border);
    }

    doc.fontSize(12).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(contact.name, MARGIN + 15, y + 12);

    if (contact.role) {
      doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(contact.role, MARGIN + 15, y + 30);
    }

    let detailY = y + 48;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");

    const details = [];
    if (contact.email) details.push(contact.email);
    if (contact.phone) details.push(contact.phone);
    doc.text(details.join("  •  "), MARGIN + 15, detailY);

    y += cardHeight + 10;
  });
}

function renderActivities(doc: typeof PDFDocument.prototype, activities: Activity[]) {
  renderSectionHeader(doc, "Activities & Tasks", "12");

  const pendingActivities = activities.filter((a) => a.completed === 0);
  const completedActivities = activities.filter((a) => a.completed === 1);

  let y = doc.y + 10;

  // Summary boxes
  const halfWidth = (CONTENT_WIDTH - 15) / 2;

  doc.rect(MARGIN, y, halfWidth, 50).fillAndStroke(COLORS.warning + "20", COLORS.warning);
  doc.fontSize(24).fillColor(COLORS.warning).font("Helvetica-Bold");
  doc.text(String(pendingActivities.length), MARGIN + 20, y + 10);
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Pending Tasks", MARGIN + 50, y + 18);

  doc
    .rect(MARGIN + halfWidth + 15, y, halfWidth, 50)
    .fillAndStroke(COLORS.success + "20", COLORS.success);
  doc.fontSize(24).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(String(completedActivities.length), MARGIN + halfWidth + 35, y + 10);
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Completed", MARGIN + halfWidth + 65, y + 18);

  y += 70;

  // Pending tasks
  if (pendingActivities.length > 0) {
    doc.fontSize(12).fillColor(COLORS.warning).font("Helvetica-Bold");
    doc.text("Pending Tasks", MARGIN, y);
    y += 20;

    pendingActivities.forEach((activity) => {
      if (y > PAGE_HEIGHT - 80) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      doc.rect(MARGIN, y, CONTENT_WIDTH, 45).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 45).fill(COLORS.warning);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(activity.title, MARGIN + 15, y + 10, { width: CONTENT_WIDTH - 120 });

      if (activity.dueDate) {
        const dueDate = new Date(activity.dueDate);
        const isOverdue = dueDate < new Date();
        doc
          .fontSize(9)
          .fillColor(isOverdue ? COLORS.danger : COLORS.textSecondary)
          .font("Helvetica");
        doc.text(`Due: ${dueDate.toLocaleDateString("en-GB")}`, MARGIN + 15, y + 28);
      }

      y += 55;
    });
  }

  // Completed tasks summary
  if (completedActivities.length > 0 && y < PAGE_HEIGHT - 100) {
    y += 10;
    doc.fontSize(10).fillColor(COLORS.success).font("Helvetica");
    doc.text(`${completedActivities.length} task(s) completed`, MARGIN, y);
  }
}

function renderDueDiligence(doc: typeof PDFDocument.prototype, dueDiligence: DueDiligence) {
  renderSectionHeader(doc, "Due Diligence Analysis", "13");

  const ddData = dueDiligence.data as any;
  let y = doc.y + 10;

  // ==========================================
  // 1. CHECKLIST - Full Detail
  // ==========================================
  if (ddData.checklist) {
    const allItems = Object.entries(ddData.checklist).flatMap(
      ([category, items]: [string, any]) => {
        // Safety check: ensure items is an array before mapping
        if (!Array.isArray(items)) return [];
        return items.map((item: any) => ({ ...item, category }));
      }
    );
    const totalItems = allItems.length;
    const completedItems = allItems.filter((item: any) => item.checked).length;
    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.white, COLORS.border);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("DUE DILIGENCE CHECKLIST", MARGIN + 15, y + 12);

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(`${completedItems} of ${totalItems} items completed`, MARGIN + 15, y + 32);

    renderProgressBar(doc, MARGIN + 15, y + 48, CONTENT_WIDTH - 100, "", percentage);

    y += 85;

    // Detailed checklist by category
    const categories = Object.keys(ddData.checklist);
    categories.forEach((category: string) => {
      const items = ddData.checklist[category];
      // Safety check: skip if items is not an array
      if (!Array.isArray(items) || items.length === 0) return;

      if (y > PAGE_HEIGHT - 150) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      // Category header
      const categoryName = category
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text(categoryName, MARGIN, y);
      y += 16;

      items.forEach((item: any) => {
        if (y > PAGE_HEIGHT - 50) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }

        const checkMark = item.checked ? "✓" : "○";
        const checkColor = item.checked ? COLORS.success : COLORS.textLight;

        doc.fontSize(9).fillColor(checkColor).font("Helvetica-Bold");
        doc.text(checkMark, MARGIN + 10, y);
        doc
          .fontSize(9)
          .fillColor(item.checked ? COLORS.text : COLORS.textSecondary)
          .font("Helvetica");
        doc.text(item.label || item.text || "Item", MARGIN + 25, y, { width: CONTENT_WIDTH - 40 });
        y += 14;
      });

      y += 10;
    });

    y += 10;
  }

  // ==========================================
  // 2. LOAN CALCULATOR - Full Results
  // ==========================================
  if (ddData.loanCalculator && ddData.loanCalculator.loanAmount != null) {
    if (y > PAGE_HEIGHT - 180) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const calc = ddData.loanCalculator;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 130).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.rect(MARGIN, y, 4, 130).fill(COLORS.accent);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("LOAN CALCULATOR RESULTS", MARGIN + 15, y + 12);

    const col1X = MARGIN + 15;
    const col2X = MARGIN + CONTENT_WIDTH / 2;
    let calcY = y + 38;

    renderDetailRow(
      doc,
      col1X,
      calcY,
      "Principal Amount",
      formatCurrency((calc.loanAmount || 0) * 100)
    );
    renderDetailRow(doc, col2X, calcY, "Interest Rate", `${calc.interestRate || 0}% p.a.`);
    calcY += 30;

    renderDetailRow(doc, col1X, calcY, "Term", `${calc.termMonths || calc.term || 0} months`);
    if (calc.monthlyPayment != null) {
      renderDetailRow(
        doc,
        col2X,
        calcY,
        "Monthly Payment",
        formatCurrency(calc.monthlyPayment * 100)
      );
    }
    calcY += 30;

    if (calc.totalInterest != null) {
      renderDetailRow(
        doc,
        col1X,
        calcY,
        "Total Interest",
        formatCurrency(calc.totalInterest * 100)
      );
    }
    if (calc.totalRepayable != null) {
      renderDetailRow(
        doc,
        col2X,
        calcY,
        "Total Repayable",
        formatCurrency(calc.totalRepayable * 100)
      );
    }

    y += 145;
  }

  // ==========================================
  // 3. DSCR CALCULATOR - Full Details
  // ==========================================
  if (ddData.dscrCalculator) {
    if (y > PAGE_HEIGHT - 180) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const dscrData = ddData.dscrCalculator;
    const dscr = dscrData.dscr ?? 0;
    const dscrStatus = dscr >= 1.25 ? "PASS" : dscr >= 1.0 ? "CAUTION" : "FAIL";
    const dscrColor = dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 130).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 130).fill(dscrColor);

    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("DEBT SERVICE COVERAGE RATIO (DSCR)", MARGIN + 15, y + 12);

    // Large DSCR value
    doc.fontSize(40).fillColor(dscrColor).font("Helvetica-Bold");
    doc.text(dscr.toFixed(2), MARGIN + 15, y + 35);

    // Status badge
    doc.rect(MARGIN + 130, y + 45, 70, 26).fill(dscrColor);
    doc.fontSize(11).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(dscrStatus, MARGIN + 145, y + 52);

    // Details
    const detailsX = MARGIN + 220;
    let detailsY = y + 38;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");

    if (dscrData.netOperatingIncome != null) {
      doc.text(
        `Net Operating Income: ${formatCurrency(dscrData.netOperatingIncome * 100)}`,
        detailsX,
        detailsY
      );
      detailsY += 16;
    }
    if (dscrData.annualDebtService != null) {
      doc.text(
        `Annual Debt Service: ${formatCurrency(dscrData.annualDebtService * 100)}`,
        detailsX,
        detailsY
      );
      detailsY += 16;
    }
    doc.text("Minimum threshold: 1.25", detailsX, detailsY);

    // Interpretation
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    const interpretation =
      dscr >= 1.25
        ? "The borrower can comfortably service the debt with income to spare."
        : dscr >= 1.0
          ? "The borrower can just cover debt payments with minimal buffer."
          : "The borrower cannot fully cover debt service obligations.";
    doc.text(interpretation, MARGIN + 15, y + 100, { width: CONTENT_WIDTH - 30 });

    y += 145;
  }

  // ==========================================
  // 4. AFFORDABILITY ESTIMATOR
  // ==========================================
  if (ddData.affordabilityEstimator) {
    if (y > PAGE_HEIGHT - 160) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const afford = ddData.affordabilityEstimator;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 120).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.rect(MARGIN, y, 4, 120).fill(COLORS.secondary);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("AFFORDABILITY ASSESSMENT", MARGIN + 15, y + 12);

    const col1X = MARGIN + 15;
    const col2X = MARGIN + CONTENT_WIDTH / 2;
    let affY = y + 38;

    if (afford.monthlyIncome != null) {
      renderDetailRow(
        doc,
        col1X,
        affY,
        "Monthly Income",
        formatCurrency(afford.monthlyIncome * 100)
      );
    }
    if (afford.monthlyExpenses != null) {
      renderDetailRow(
        doc,
        col2X,
        affY,
        "Monthly Expenses",
        formatCurrency(afford.monthlyExpenses * 100)
      );
    }
    affY += 30;

    if (afford.disposableIncome != null) {
      renderDetailRow(
        doc,
        col1X,
        affY,
        "Disposable Income",
        formatCurrency(afford.disposableIncome * 100)
      );
    }
    if (afford.maxAffordablePayment != null) {
      renderDetailRow(
        doc,
        col2X,
        affY,
        "Max Affordable Payment",
        formatCurrency(afford.maxAffordablePayment * 100)
      );
    }
    affY += 30;

    if (afford.maxLoanAmount != null) {
      renderDetailRow(
        doc,
        col1X,
        affY,
        "Maximum Loan Amount",
        formatCurrency(afford.maxLoanAmount * 100)
      );
    }

    y += 135;
  }

  // ==========================================
  // 5. FINANCIAL RATIOS - Expanded
  // ==========================================
  if (ddData.financialRatios) {
    const ratios = ddData.financialRatios;
    const hasAnyRatio =
      ratios.profitMargin != null ||
      ratios.currentRatio != null ||
      ratios.debtToEquity != null ||
      ratios.returnOnEquity != null ||
      ratios.quickRatio != null ||
      ratios.assetTurnover != null;

    if (hasAnyRatio) {
      if (y > PAGE_HEIGHT - 180) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      doc.rect(MARGIN, y, CONTENT_WIDTH, 140).fillAndStroke(COLORS.white, COLORS.border);
      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("FINANCIAL RATIOS ANALYSIS", MARGIN + 15, y + 12);

      const ratioBoxWidth = (CONTENT_WIDTH - 75) / 4;
      let ratioX = MARGIN + 15;
      let ratioY = y + 40;
      let ratioCount = 0;

      const ratiosList = [
        { key: "profitMargin", label: "Profit Margin", format: (v: number) => `${v.toFixed(1)}%` },
        { key: "grossMargin", label: "Gross Margin", format: (v: number) => `${v.toFixed(1)}%` },
        { key: "currentRatio", label: "Current Ratio", format: (v: number) => v.toFixed(2) },
        { key: "quickRatio", label: "Quick Ratio", format: (v: number) => v.toFixed(2) },
        { key: "debtToEquity", label: "Debt/Equity", format: (v: number) => v.toFixed(2) },
        { key: "returnOnEquity", label: "ROE", format: (v: number) => `${v.toFixed(1)}%` },
        { key: "returnOnAssets", label: "ROA", format: (v: number) => `${v.toFixed(1)}%` },
        { key: "assetTurnover", label: "Asset Turnover", format: (v: number) => v.toFixed(2) },
      ];

      ratiosList.forEach((ratio) => {
        if (ratios[ratio.key] != null) {
          if (ratioCount > 0 && ratioCount % 4 === 0) {
            ratioX = MARGIN + 15;
            ratioY += 55;
          }
          renderSmallMetricBox(
            doc,
            ratioX,
            ratioY,
            ratioBoxWidth,
            ratio.label,
            ratio.format(ratios[ratio.key])
          );
          ratioX += ratioBoxWidth + 15;
          ratioCount++;
        }
      });

      y += 155;
    }
  }

  // ==========================================
  // 6. CHARACTER ASSESSMENT
  // ==========================================
  if (ddData.characterAssessment) {
    if (y > PAGE_HEIGHT - 200) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    const charAssess = ddData.characterAssessment;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 160).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
    doc.rect(MARGIN, y, 4, 160).fill(COLORS.accent);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("CHARACTER ASSESSMENT", MARGIN + 15, y + 12);

    let charY = y + 35;
    const assessmentFields = [
      { key: "businessExperience", label: "Business Experience" },
      { key: "industryExperience", label: "Industry Experience" },
      { key: "managementCapability", label: "Management Capability" },
      { key: "financialTrackRecord", label: "Financial Track Record" },
      { key: "creditHistory", label: "Credit History" },
      { key: "referencesAvailable", label: "References Available" },
    ];

    const colWidth = (CONTENT_WIDTH - 40) / 2;
    assessmentFields.forEach((field, index) => {
      const colX = index % 2 === 0 ? MARGIN + 15 : MARGIN + colWidth + 25;
      if (index > 0 && index % 2 === 0) charY += 22;

      if (charAssess[field.key] != null) {
        const value = charAssess[field.key];
        const displayValue =
          typeof value === "boolean"
            ? value
              ? "Yes"
              : "No"
            : typeof value === "number"
              ? `${value}/10`
              : String(value);

        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
        doc.text(field.label + ":", colX, charY);
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
        doc.text(displayValue, colX + 120, charY);
      }
    });

    // Notes if available
    if (charAssess.notes) {
      charY += 30;
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text("Notes:", MARGIN + 15, charY);
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(charAssess.notes, MARGIN + 15, charY + 14, { width: CONTENT_WIDTH - 30 });
    }

    y += 175;
  }

  // ==========================================
  // 7. CREDIT UNDERWRITING (Premium Feature)
  // ==========================================
  // Check both paths - underwriting (schema) and creditUnderwriting (legacy)
  const creditUnderwritingData = ddData.underwriting || ddData.creditUnderwriting;
  if (creditUnderwritingData) {
    const cu = creditUnderwritingData;

    // Check if there's ANY substantive content before creating a page
    const hasRiskGrade = cu.riskGrade || cu.finalRiskGrade;
    const hasEligibility = cu.eligibilityAnswers || cu.isEligible !== undefined;
    const hasFinancialAnalysis = cu.analysis || cu.financialAnalysis;
    const hasAccountsAnalysis = cu.accountsAnalysis;
    
    // Only create page if there's actual content
    if (hasRiskGrade || hasEligibility || hasFinancialAnalysis || hasAccountsAnalysis) {
      // New page for Credit Underwriting section
      doc.addPage();
      pageNumber++;
      renderSectionHeader(doc, "Credit Underwriting Analysis", "14");
      y = doc.y + 10;

    // 7.1 Risk Grade Summary
    if (cu.riskGrade || cu.finalRiskGrade) {
      const riskGrade = cu.finalRiskGrade || cu.riskGrade || "N/A";
      const riskColor = getRiskGradeColor(riskGrade);

      doc.rect(MARGIN, y, CONTENT_WIDTH, 90).fillAndStroke(riskColor + "15", riskColor);

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("OVERALL RISK ASSESSMENT", MARGIN + 15, y + 12);

      // Large risk grade
      doc.fontSize(48).fillColor(riskColor).font("Helvetica-Bold");
      doc.text(riskGrade, MARGIN + 15, y + 32);

      // Risk grade description
      const gradeDescriptions: Record<string, string> = {
        A: "Excellent - Low risk, strong financials",
        B: "Good - Acceptable risk with minor concerns",
        C: "Fair - Moderate risk requiring attention",
        D: "Poor - High risk with significant concerns",
        E: "Very High Risk - Severe concerns identified",
      };
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
      doc.text(gradeDescriptions[riskGrade] || "Risk assessment completed", MARGIN + 100, y + 55);

      y += 105;
    }

    // 7.2 Eligibility Check Results
    if (cu.eligibilityAnswers || cu.isEligible !== undefined) {
      if (y > PAGE_HEIGHT - 200) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      const isEligible = cu.isEligible ?? true;
      const eligColor = isEligible ? COLORS.success : COLORS.danger;

      doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 80).fill(eligColor);

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("ELIGIBILITY CHECK", MARGIN + 15, y + 12);

      // Eligibility status
      doc.fontSize(14).fillColor(eligColor).font("Helvetica-Bold");
      doc.text(isEligible ? "ELIGIBLE" : "INELIGIBLE", MARGIN + 15, y + 35);

      // Count passed/failed if answers available
      if (cu.eligibilityAnswers && typeof cu.eligibilityAnswers === "object") {
        const answers = Object.values(cu.eligibilityAnswers);
        const passed = answers.filter((a: any) => a === true).length;
        const total = answers.length;

        doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
        doc.text(`${passed} of ${total} policy criteria met`, MARGIN + 15, y + 55);
      }

      y += 95;
    }

    // 7.3 Financial Analysis (AI-powered)
    if (cu.analysis || cu.financialAnalysis) {
      const analysis = cu.analysis || cu.financialAnalysis;
      // Prefer a computed DSCR (NDI ÷ monthly repayment) to avoid inconsistent AI narratives
      const repayment = ddData?.loanCalculator?.monthlyPayment;
      const ndi = analysis.netDisposableIncome;
      const dscrComputed =
        typeof ndi === "number" && typeof repayment === "number" && repayment > 0 ? ndi / repayment : null;
      const dscrReported =
        analysis.dscr != null && Number.isFinite(Number(analysis.dscr)) ? Number(analysis.dscr) : null;
      const dscrToShow = dscrComputed ?? dscrReported;
      const dscrMismatch =
        dscrComputed != null && dscrReported != null && Math.abs(dscrComputed - dscrReported) > 0.15;

      // (A) Metrics card (short, structured)
      const hasPnl = !!analysis.profitAndLoss;
      const metricsCardH = hasPnl ? 165 : 120;

      if (y > PAGE_HEIGHT - (metricsCardH + 40)) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      doc
        .rect(MARGIN, y, CONTENT_WIDTH, metricsCardH)
        .fillAndStroke(COLORS.backgroundLight, COLORS.border);

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("AI-POWERED FINANCIAL ANALYSIS", MARGIN + 15, y + 12);

      let metricsY = y + 35;
      const col1X = MARGIN + 15;
      const col2X = MARGIN + CONTENT_WIDTH / 2;

      // Key metrics
      if (analysis.averageMonthlyRevenue != null) {
        renderDetailRow(
          doc,
          col1X,
          metricsY,
          "Avg Monthly Revenue",
          formatCurrency(analysis.averageMonthlyRevenue * 100)
        );
      }
      if (analysis.averageMonthlyExpenses != null) {
        renderDetailRow(
          doc,
          col2X,
          metricsY,
          "Avg Monthly Expenses",
          formatCurrency(analysis.averageMonthlyExpenses * 100)
        );
      }

      metricsY += 30;

      if (analysis.netDisposableIncome != null) {
        renderDetailRow(
          doc,
          col1X,
          metricsY,
          "Net Disposable Income",
          formatCurrency(analysis.netDisposableIncome * 100)
        );
      }

      if (dscrToShow != null) {
        const dscrVal = dscrToShow;
        const dscrColor =
          dscrVal >= 1.25 ? COLORS.success : dscrVal >= 1.0 ? COLORS.warning : COLORS.danger;

        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
        doc.text("DSCR", col2X, metricsY);

        doc.fontSize(11).fillColor(dscrColor).font("Helvetica-Bold");
        doc.text(dscrVal.toFixed(2), col2X, metricsY + 12);
      } else {
        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
        doc.text("DSCR", col2X, metricsY);
        doc.fontSize(11).fillColor(COLORS.textLight).font("Helvetica-Bold");
        doc.text("N/A", col2X, metricsY + 12);
      }

      metricsY += 35;

      // P&L Summary (compact)
      if (analysis.profitAndLoss) {
        const pnl = analysis.profitAndLoss;

        doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
        doc.text("Profit & Loss Summary", col1X, metricsY);
        metricsY += 16;

        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");

        if (pnl.turnover != null) {
          doc.text(`Turnover: ${formatCurrency(pnl.turnover * 100)}`, col1X, metricsY);
        }
        if (pnl.grossProfit != null) {
          doc.text(`Gross Profit: ${formatCurrency(pnl.grossProfit * 100)}`, col2X, metricsY);
        }
        metricsY += 14;

        if (pnl.netProfit != null) {
          doc.text(`Net Profit: ${formatCurrency(pnl.netProfit * 100)}`, col1X, metricsY);
        }
        if (pnl.periodMonths != null) {
          doc.text(`Period: ${pnl.periodMonths} months`, col2X, metricsY);
        }
      }

      y += metricsCardH + 15;

      // (B) Narrative / Summary card (measured – avoids overlap)
      // If AI supplied a DSCR that doesn't match NDI ÷ repayment, flag it clearly
      if (dscrMismatch && dscrComputed != null && dscrReported != null) {
        const note = [
          `AI narrative DSCR: ${dscrReported.toFixed(2)}`,
          repayment != null ? `Monthly repayment: ${formatCurrency(repayment * 100)}` : null,
          ndi != null ? `Net disposable income: ${formatCurrency(ndi * 100)}` : null,
          `Computed DSCR (NDI ÷ repayment): ${dscrComputed.toFixed(2)}`,
          "",
          "This report uses the computed DSCR for display where possible.",
        ]
          .filter(Boolean)
          .join("\n");

        const outNote = renderMeasuredTextCard({
          doc,
          title: "DSCR CONSISTENCY CHECK",
          text: note,
          y,
          pageNumber,
          accentColor: COLORS.warning,
          fillColor: COLORS.backgroundLight,
          minHeight: 90,
          titleColor: COLORS.warning,
        });

        y = outNote.y;
        pageNumber = outNote.pageNumber;
      }

      const summaryTextRaw = normalizeText(
        analysis.summary || analysis.narrative || analysis.commentary || ""
      );
      const summaryText = formatAiAnalysisText(summaryTextRaw, {
        dscrComputed,
        dscrReported,
        dscrToShow,
        repayment,
      });

      if (summaryText) {
        const out = renderMeasuredTextCard({
          doc,
          title: "ANALYSIS SUMMARY",
          text: summaryText,
          y,
          pageNumber,
          accentColor: COLORS.secondary,
          fillColor: COLORS.white,
          minHeight: 110,
          titleColor: COLORS.secondary,
        });
        y = out.y;
        pageNumber = out.pageNumber;
      }
    }

    // 7.4 Red Flags
    if (cu.redFlags && Array.isArray(cu.redFlags) && cu.redFlags.length > 0) {
      const activeFlags = cu.redFlags.filter((f: any) => f.isActive || f.active);

      if (activeFlags.length > 0) {
        if (y > PAGE_HEIGHT - 150) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }

        const flagHeight = Math.min(40 + activeFlags.length * 20, 150);
        doc
          .rect(MARGIN, y, CONTENT_WIDTH, flagHeight)
          .fillAndStroke(COLORS.danger + "10", COLORS.danger);

        doc.fontSize(11).fillColor(COLORS.danger).font("Helvetica-Bold");
        doc.text("⚠ RED FLAGS IDENTIFIED", MARGIN + 15, y + 12);

        let flagY = y + 35;
        activeFlags.forEach((flag: any) => {
          if (flagY < y + flagHeight - 10) {
            doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
            doc.text(
              `• ${flag.label || flag.description || "Concern identified"}`,
              MARGIN + 20,
              flagY
            );
            flagY += 16;
          }
        });

        y += flagHeight + 15;
      }
    }

    // 7.5 Due Diligence Checks (Companies House + Adverse Media)
    if (cu.dueDiligence) {
      const ddChecks = cu.dueDiligence;

      if (y > PAGE_HEIGHT - 180) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }

      const riskLevel = ddChecks.riskLevel || "MEDIUM";
      const riskColor =
        riskLevel === "LOW"
          ? COLORS.success
          : riskLevel === "HIGH"
            ? COLORS.danger
            : COLORS.warning;

      doc.rect(MARGIN, y, CONTENT_WIDTH, 140).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 140).fill(riskColor);

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("DUE DILIGENCE CHECKS", MARGIN + 15, y + 12);

      // Risk level badge
      doc.rect(MARGIN + 180, y + 8, 60, 20).fill(riskColor);
      doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text(riskLevel + " RISK", MARGIN + 190, y + 14);

      let ddY = y + 38;

      // Summary
      if (ddChecks.summary) {
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.text(truncateText(ddChecks.summary, 200), MARGIN + 15, ddY, {
          width: CONTENT_WIDTH - 30,
        });
        ddY += 35;
      }

      // Web/Adverse Media Summary
      if (ddChecks.webSummary) {
        doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
        doc.text("Adverse Media Search:", MARGIN + 15, ddY);
        ddY += 14;
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.text(truncateText(ddChecks.webSummary, 180), MARGIN + 15, ddY, {
          width: CONTENT_WIDTH - 30,
        });
        ddY += 30;
      }

      // Flags
      if (ddChecks.flags && Array.isArray(ddChecks.flags) && ddChecks.flags.length > 0) {
        doc.fontSize(9).fillColor(COLORS.warning).font("Helvetica-Bold");
        doc.text("Flags:", MARGIN + 15, ddY);
        ddY += 14;
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        ddChecks.flags.slice(0, 3).forEach((flag: string) => {
          doc.text(`• ${flag}`, MARGIN + 20, ddY);
          ddY += 14;
        });
      }

      y += 155;
    }

    // Note: CAMPARI (adviserSummary) and SWOT Analysis are rendered as separate standalone sections
    // to avoid duplication and allow user control via PDF Layout settings

    // 7.6 Audited Accounts Analysis
    if (cu.auditedAccountsAnalysis) {
      const accounts = cu.auditedAccountsAnalysis;

      doc.addPage();
      pageNumber++;
      renderSectionHeader(doc, "Audited Accounts Analysis", "16");
      y = doc.y + 10;

      // Risk assessment
      if (accounts.riskAssessment) {
        const riskColor =
          accounts.riskAssessment === "low"
            ? COLORS.success
            : accounts.riskAssessment === "high"
              ? COLORS.danger
              : COLORS.warning;

        doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fillAndStroke(riskColor + "15", riskColor);
        doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
        doc.text("ACCOUNTS RISK ASSESSMENT", MARGIN + 15, y + 12);
        doc.fontSize(20).fillColor(riskColor).font("Helvetica-Bold");
        doc.text(accounts.riskAssessment.toUpperCase(), MARGIN + 15, y + 32);

        y += 75;
      }

      // Year-by-year data
      if (accounts.years && Array.isArray(accounts.years)) {
        doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
        doc.text("Financial Performance by Year", MARGIN, y);
        y += 25;

        accounts.years.forEach((year: any) => {
          if (y > PAGE_HEIGHT - 120) {
            doc.addPage();
            pageNumber++;
            y = MARGIN + 20;
          }

          doc.rect(MARGIN, y, CONTENT_WIDTH, 90).fillAndStroke(COLORS.white, COLORS.border);
          doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
          doc.text(`Year Ending: ${year.yearEnding || "N/A"}`, MARGIN + 15, y + 12);

          const col1X = MARGIN + 15;
          const col2X = MARGIN + CONTENT_WIDTH / 3;
          const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
          let yearY = y + 35;

          if (year.turnover != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
            doc.text("Turnover", col1X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
            doc.text(formatCurrency(year.turnover * 100), col1X, yearY + 12);
          }
          if (year.netProfit != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
            doc.text("Net Profit", col2X, yearY);
            doc
              .fontSize(10)
              .fillColor(year.netProfit >= 0 ? COLORS.success : COLORS.danger)
              .font("Helvetica-Bold");
            doc.text(formatCurrency(year.netProfit * 100), col2X, yearY + 12);
          }
          if (year.netAssets != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
            doc.text("Net Assets", col3X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
            doc.text(formatCurrency(year.netAssets * 100), col3X, yearY + 12);
          }

          yearY += 35;
          if (year.shareholderFunds != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
            doc.text("Shareholder Funds", col1X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
            doc.text(formatCurrency(year.shareholderFunds * 100), col1X, yearY + 12);
          }

          y += 100;
        });
      }

      // Trends summary
      if (accounts.trends) {
        if (y > PAGE_HEIGHT - 100) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }

        const trendColor =
          accounts.trends.trend === "improving"
            ? COLORS.success
            : accounts.trends.trend === "declining"
              ? COLORS.danger
              : COLORS.warning;

        doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.backgroundLight, COLORS.border);
        doc.rect(MARGIN, y, 4, 70).fill(trendColor);

        doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
        doc.text("TREND ANALYSIS", MARGIN + 15, y + 12);
        doc.fontSize(12).fillColor(trendColor).font("Helvetica-Bold");
        doc.text(capitalizeStage(accounts.trends.trend || "stable"), MARGIN + 120, y + 10);

        if (accounts.trends.summary) {
          doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
          doc.text(truncateText(accounts.trends.summary, 250), MARGIN + 15, y + 35, {
            width: CONTENT_WIDTH - 30,
          });
        }

        y += 85;
      }

      // Concerns
      if (accounts.concerns && Array.isArray(accounts.concerns) && accounts.concerns.length > 0) {
        if (y > PAGE_HEIGHT - 120) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }

        doc.fontSize(11).fillColor(COLORS.warning).font("Helvetica-Bold");
        doc.text("⚠ Concerns Identified", MARGIN, y);
        y += 20;

        accounts.concerns.forEach((concern: any) => {
          if (y > PAGE_HEIGHT - 50) return;

          const severityColor =
            concern.severity === "high"
              ? COLORS.danger
              : concern.severity === "medium"
                ? COLORS.warning
                : COLORS.textSecondary;

          doc.fontSize(9).fillColor(severityColor).font("Helvetica-Bold");
          doc.text(`[${(concern.severity || "low").toUpperCase()}]`, MARGIN + 10, y);
          doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
          doc.text(concern.description || "Concern identified", MARGIN + 60, y, {
            width: CONTENT_WIDTH - 80,
          });
          y += 18;
        });
      }
    }

    // Note: Financial Ratios are now rendered on their own dedicated Credit Ratios page (Section 8)
    } // Close the "if has content" check
  }
}

// Helper function for risk grade colors
function getRiskGradeColor(grade: string): string {
  const gradeColors: Record<string, string> = {
    A: COLORS.success,
    B: "#22C55E",
    C: COLORS.warning,
    D: "#F97316",
    E: COLORS.danger,
  };
  return gradeColors[grade] || COLORS.textSecondary;
}

// Standalone CAMPARI Analysis Section
function renderCampariSection(doc: typeof PDFDocument.prototype, adviser: any, loanAllocation?: any[]) {
  renderSectionHeader(doc, "CAMPARI Analysis", "15");
  let y = doc.y + 10;

  // FORMATTING FIX: Ensure space for header info box
  ensureSpace(doc, 90);
  
  // Header info
  doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.backgroundMuted, COLORS.border);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  let advY = y + 15;

  if (adviser.businessName) {
    renderDetailRow(doc, col1X, advY, "Business Name", adviser.businessName);
  }
  if (adviser.soarRef) {
    renderDetailRow(doc, col2X, advY, "Reference", adviser.soarRef);
  }
  advY += 30;

  if (adviser.product) {
    renderDetailRow(doc, col1X, advY, "Product", adviser.product);
  }
  if (adviser.amount) {
    renderDetailRow(doc, col2X, advY, "Amount", formatCurrency(adviser.amount * 100));
  }

  y += 95;
  doc.y = y;

  // CAMPARI sections - FORMATTING FIX: Better paragraph handling
  const campariOrder = ["character", "ability", "margin", "purpose", "amount", "repayment", "insurance"];
  const campariLabels: Record<string, string> = {
    character: "CHARACTER - Management & Background",
    ability: "ABILITY - Capacity to Repay",
    margin: "MARGIN - Return & Pricing",
    purpose: "PURPOSE - Loan Purpose & Rationale",
    amount: "AMOUNT - Funding Requirement",
    repayment: "REPAYMENT - Source & Terms",
    insurance: "INSURANCE - Security & Risk Mitigation",
  };

  // Try both adviser.sections and direct properties for compatibility
  const getSectionContent = (key: string): string => {
    if (adviser.sections && adviser.sections[key]) {
      return normalizeText(adviser.sections[key]);
    }
    if (adviser[key]) {
      return normalizeText(adviser[key]);
    }
    return "";
  };

  campariOrder.forEach((key) => {
    const content = getSectionContent(key);
    
    // For AMOUNT section, we can render even if no text content - we'll show Use of Funds
    const hasLoanAllocation = loanAllocation && Array.isArray(loanAllocation) && loanAllocation.length > 0;
    if ((!content || content.trim() === "") && !(key === "amount" && hasLoanAllocation)) return;

    // FORMATTING FIX: Ensure minimum space for section header
    ensureSpace(doc, 60);

    // Render section title box (keep original styling)
    const titleY = doc.y + 10;
    doc.rect(MARGIN, titleY, CONTENT_WIDTH, 30).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, titleY, 4, 30).fill(COLORS.secondary);
    doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text(campariLabels[key] || key.toUpperCase(), MARGIN + 15, titleY + 10);

    doc.y = titleY + 40;

    // FORMATTING FIX: Split content into paragraphs and render with page break awareness
    // This prevents text from breaking mid-sentence across pages
    if (content && content.trim() !== "") {
      const formattedContent = formatCampariContent(key, content);
      const paragraphs = formattedContent
        .split(/\n\n+/)
        .filter((p: string) => p.trim())
        .map((p: string) => p.trim());

      doc.y = renderParagraphsWithBreaks(doc, paragraphs, MARGIN + 15, {
        fontSize: 10,
        color: COLORS.text,
        width: CONTENT_WIDTH - 30,
      });
    }

    // For AMOUNT section, add Use of Funds Breakdown table
    if (key === "amount" && hasLoanAllocation) {
      doc.y += 10;
      ensureSpace(doc, 30 + loanAllocation.length * 22 + 30);
      
      // Use of Funds subtitle
      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Use of Funds Breakdown:", MARGIN + 15, doc.y);
      doc.y += 18;
      
      // Table header
      const tableX = MARGIN + 15;
      const descWidth = CONTENT_WIDTH - 130;
      const amountWidth = 100;
      
      doc.rect(tableX, doc.y, descWidth + amountWidth, 20).fill(COLORS.backgroundMuted);
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text("Description", tableX + 8, doc.y + 6);
      doc.text("Amount", tableX + descWidth + 8, doc.y + 6);
      doc.y += 20;
      
      // Table rows
      let totalAmount = 0;
      loanAllocation.forEach((item: any, idx: number) => {
        const rowY = doc.y;
        const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.backgroundLight;
        doc.rect(tableX, rowY, descWidth + amountWidth, 22).fill(bgColor);
        doc.rect(tableX, rowY, descWidth + amountWidth, 22).stroke(COLORS.borderLight);
        
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.text(item.description || "-", tableX + 8, rowY + 6, { width: descWidth - 16 });
        doc.text(`£${(item.amount || 0).toLocaleString()}`, tableX + descWidth + 8, rowY + 6);
        
        totalAmount += item.amount || 0;
        doc.y += 22;
      });
      
      // Total row
      doc.rect(tableX, doc.y, descWidth + amountWidth, 22).fill(COLORS.primary);
      doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text("TOTAL", tableX + 8, doc.y + 6);
      doc.text(`£${totalAmount.toLocaleString()}`, tableX + descWidth + 8, doc.y + 6);
      doc.y += 22;
    }

    doc.y += 15; // Space after section
  });

  // Recommendation section
  if (adviser.recommendation) {
    ensureSpace(doc, 100);

    const recommendationLabels: Record<string, string> = {
      approve: "Recommend Approval",
      approve_conditions: "Approve with Conditions",
      refer: "Refer to Credit Committee",
      decline: "Recommend Decline",
      more_info: "More Information Required",
    };

    const recommendationColors: Record<string, string> = {
      approve: COLORS.success,
      approve_conditions: COLORS.warning,
      refer: COLORS.accent,
      decline: COLORS.danger,
      more_info: COLORS.textSecondary,
    };

    const recColor = recommendationColors[adviser.recommendation] || COLORS.primary;
    const recLabel = recommendationLabels[adviser.recommendation] || adviser.recommendation;

    doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 70).fillAndStroke(recColor + "15", recColor);
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("FINAL RECOMMENDATION", MARGIN + 15, doc.y + 12);
    doc.fontSize(16).fillColor(recColor).font("Helvetica-Bold");
    doc.text(recLabel, MARGIN + 15, doc.y + 35);
  }
}

// Standalone Credit Ratios Section - Dedicated page for financial ratios analysis
function renderCreditRatiosSection(doc: typeof PDFDocument.prototype, accountsAnalysis: any) {
  renderSectionHeader(doc, "Credit Ratios Analysis", "8");
  let y = doc.y + 15;

  // Introduction text
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(
    "Financial ratios calculated from audited accounts, with industry benchmarks for comparison.",
    MARGIN,
    y,
    { width: CONTENT_WIDTH }
  );
  y += 25;

  const ratiosData = accountsAnalysis.ratios;
  if (!ratiosData || ratiosData.length === 0) return;

  // Calculate column widths
  const colCount = ratiosData.length + 2; // Metric + Benchmark + Years
  const metricColWidth = 120;
  const benchmarkColWidth = 80;
  const yearColWidth = (CONTENT_WIDTH - metricColWidth - benchmarkColWidth) / ratiosData.length;

  // Helper to normalize percentage values
  const normalizePercent = (v: number) => {
    if (v <= 0) return 0;
    if (v < 1) return v * 100;
    return v;
  };

  // Table header
  doc.rect(MARGIN, y, CONTENT_WIDTH, 28).fill(COLORS.primary);
  doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("Ratio", MARGIN + 10, y + 9);
  doc.text("Benchmark", MARGIN + metricColWidth + 5, y + 9);
  ratiosData.forEach((rd: any, idx: number) => {
    doc.text(rd.year || `Year ${idx + 1}`, MARGIN + metricColWidth + benchmarkColWidth + idx * yearColWidth + 10, y + 9);
  });
  y += 28;

  // Ratio definitions with benchmarks
  const ratioCategories = [
    {
      category: "Profitability",
      color: COLORS.success,
      metrics: [
        { label: "Gross Profit Margin", key: "grossProfitMargin", benchmark: "≥ 20%", isGood: (v: number) => normalizePercent(v) >= 20, isPercent: true },
        { label: "Net Profit Margin", key: "netProfitMargin", benchmark: "≥ 5%", isGood: (v: number) => normalizePercent(v) >= 5, isPercent: true },
        { label: "Return on Capital Employed", key: "returnOnCapitalEmployed", benchmark: "≥ 15%", isGood: (v: number) => normalizePercent(v) >= 15, isPercent: true },
      ],
    },
    {
      category: "Liquidity",
      color: COLORS.accent,
      metrics: [
        { label: "Current Ratio", key: "currentRatio", benchmark: "≥ 1.5", isGood: (v: number) => v >= 1.5 },
        { label: "Quick Ratio (Acid Test)", key: "quickRatio", benchmark: "≥ 1.0", isGood: (v: number) => v >= 1.0 },
      ],
    },
    {
      category: "Leverage",
      color: COLORS.warning,
      metrics: [
        { label: "Debt to Equity Ratio", key: "debtToEquity", benchmark: "≤ 2.0", isGood: (v: number) => v <= 2.0 },
        { label: "Interest Cover", key: "interestCover", benchmark: "≥ 2.0", isGood: (v: number) => v >= 2.0 },
      ],
    },
    {
      category: "Efficiency",
      color: COLORS.secondary,
      metrics: [
        { label: "Debtor Days", key: "debtorDays", benchmark: "≤ 60 days", isGood: (v: number) => v <= 60, isDays: true },
        { label: "Creditor Days", key: "creditorDays", benchmark: "≤ 45 days", isGood: (v: number) => v <= 45, isDays: true },
      ],
    },
  ];

  ratioCategories.forEach((category) => {
    // Check if we need a new page
    const categoryHeight = 25 + category.metrics.length * 24;
    if (y > PAGE_HEIGHT - FOOTER_SPACE - categoryHeight) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    // Category header
    doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(category.color + "20");
    doc.rect(MARGIN, y, 4, 22).fill(category.color);
    doc.fontSize(10).fillColor(category.color).font("Helvetica-Bold");
    doc.text(category.category, MARGIN + 12, y + 6);
    y += 22;

    // Metrics rows
    category.metrics.forEach((metric, mIdx) => {
      const isOdd = mIdx % 2 === 0;
      doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fillAndStroke(isOdd ? COLORS.white : COLORS.backgroundLight, COLORS.borderLight);

      // Metric name
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(metric.label, MARGIN + 10, y + 7, { width: metricColWidth - 15 });

      // Benchmark
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(metric.benchmark, MARGIN + metricColWidth + 5, y + 8);

      // Year values
      ratiosData.forEach((rd: any, idx: number) => {
        const value = rd.ratios?.[metric.key];
        const xPos = MARGIN + metricColWidth + benchmarkColWidth + idx * yearColWidth + 10;

        if (value === undefined || value === null) {
          doc.fontSize(9).fillColor(COLORS.textLight).font("Helvetica");
          doc.text("N/A", xPos, y + 7);
        } else {
          const good = metric.isGood(value);
          const color = good ? COLORS.success : COLORS.danger;
          
          let displayValue = "";
          if ((metric as any).isPercent) {
            displayValue = `${normalizePercent(value).toFixed(1)}%`;
          } else if ((metric as any).isDays) {
            displayValue = `${value.toFixed(0)} days`;
          } else {
            displayValue = value.toFixed(2);
          }

          // Value with indicator
          doc.fontSize(9).fillColor(color).font("Helvetica-Bold");
          doc.text(displayValue, xPos, y + 7);
        }
      });

      y += 24;
    });

    y += 8; // Space between categories
  });

  // DSCR Section if available
  if (accountsAnalysis.dscr) {
    if (y > PAGE_HEIGHT - FOOTER_SPACE - 100) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    y += 10;
    doc.rect(MARGIN, y, CONTENT_WIDTH, 28).fill(COLORS.primary);
    doc.fontSize(11).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("Debt Service Coverage Ratio (DSCR)", MARGIN + 10, y + 9);
    y += 28;

    // DSCR details
    doc.rect(MARGIN, y, CONTENT_WIDTH, 50).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    
    const dscrAvg = accountsAnalysis.dscr.average;
    const dscrColor = dscrAvg >= 1.25 ? COLORS.success : dscrAvg >= 1.0 ? COLORS.warning : COLORS.danger;
    
    doc.fontSize(24).fillColor(dscrColor).font("Helvetica-Bold");
    doc.text(dscrAvg?.toFixed(2) || "N/A", MARGIN + 20, y + 12);
    
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Average DSCR", MARGIN + 80, y + 18);
    
    const trendLabel = accountsAnalysis.dscr.trend === "improving" ? "↑ Improving" : 
                       accountsAnalysis.dscr.trend === "declining" ? "↓ Declining" : "→ Stable";
    const trendColor = accountsAnalysis.dscr.trend === "improving" ? COLORS.success :
                       accountsAnalysis.dscr.trend === "declining" ? COLORS.danger : COLORS.textSecondary;
    
    doc.fontSize(10).fillColor(trendColor).font("Helvetica-Bold");
    doc.text(trendLabel, MARGIN + 200, y + 18);

    // Benchmark note
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Benchmark: DSCR ≥ 1.25 indicates strong debt servicing capacity", MARGIN + 300, y + 18);

    y += 60;
  }

  // Trends summary if available
  if (accountsAnalysis.trends?.summary) {
    if (y > PAGE_HEIGHT - FOOTER_SPACE - 80) {
      doc.addPage();
      pageNumber++;
      y = MARGIN + 20;
    }

    y += 10;
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("Trend Summary", MARGIN, y);
    y += 18;

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(accountsAnalysis.trends.summary, MARGIN, y, { width: CONTENT_WIDTH });
  }
}

// Standalone SWOT Analysis Section - Softened Professional Colors
function renderSwotSection(doc: typeof PDFDocument.prototype, swot: any) {
  renderSectionHeader(doc, "SWOT Analysis", "16");
  let y = doc.y + 10;

  // FORMATTING FIX: Ensure the entire SWOT grid fits on one page
  const gap = 10;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const boxHeight = 160;
  const accentBorderWidth = 5;
  const totalGridHeight = (boxHeight * 2) + gap + 20; // Total height of 2x2 grid
  
  ensureSpace(doc, totalGridHeight);
  y = doc.y;

  // Strengths (top-left) - Soft green pastel (keep original styling)
  doc.rect(MARGIN, y, boxWidth, boxHeight).fill(COLORS.swotStrengthsBg);
  doc.rect(MARGIN, y, accentBorderWidth, boxHeight).fill(COLORS.swotStrengthsBorder);
  doc.fontSize(11).fillColor(COLORS.swotStrengthsBorder).font("Helvetica-Bold");
  doc.text("STRENGTHS", MARGIN + 12, y + 10);

  if (swot.strengths && Array.isArray(swot.strengths)) {
    let sY = y + 28;
    swot.strengths.slice(0, 5).forEach((item: string) => {
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${truncateText(item, 70)}`, MARGIN + 12, sY, { width: boxWidth - 20 });
      sY += 24;
    });
  }

  // Weaknesses (top-right) - Soft orange pastel (keep original styling)
  const rightX = MARGIN + boxWidth + gap;
  doc.rect(rightX, y, boxWidth, boxHeight).fill(COLORS.swotWeaknessesBg);
  doc.rect(rightX, y, accentBorderWidth, boxHeight).fill(COLORS.swotWeaknessesBorder);
  doc.fontSize(11).fillColor(COLORS.swotWeaknessesBorder).font("Helvetica-Bold");
  doc.text("WEAKNESSES", rightX + 12, y + 10);

  if (swot.weaknesses && Array.isArray(swot.weaknesses)) {
    let wY = y + 28;
    swot.weaknesses.slice(0, 5).forEach((item: string) => {
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${truncateText(item, 70)}`, rightX + 12, wY, { width: boxWidth - 20 });
      wY += 24;
    });
  }

  y += boxHeight + gap;

  // Opportunities (bottom-left) - Soft blue pastel (keep original styling)
  doc.rect(MARGIN, y, boxWidth, boxHeight).fill(COLORS.swotOpportunitiesBg);
  doc.rect(MARGIN, y, accentBorderWidth, boxHeight).fill(COLORS.swotOpportunitiesBorder);
  doc.fontSize(11).fillColor(COLORS.swotOpportunitiesBorder).font("Helvetica-Bold");
  doc.text("OPPORTUNITIES", MARGIN + 12, y + 10);

  if (swot.opportunities && Array.isArray(swot.opportunities)) {
    let oY = y + 28;
    swot.opportunities.slice(0, 5).forEach((item: string) => {
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${truncateText(item, 70)}`, MARGIN + 12, oY, { width: boxWidth - 20 });
      oY += 24;
    });
  }

  // Threats (bottom-right) - Soft red pastel (keep original styling)
  doc.rect(rightX, y, boxWidth, boxHeight).fill(COLORS.swotThreatsBg);
  doc.rect(rightX, y, accentBorderWidth, boxHeight).fill(COLORS.swotThreatsBorder);
  doc.fontSize(11).fillColor(COLORS.swotThreatsBorder).font("Helvetica-Bold");
  doc.text("THREATS", rightX + 12, y + 10);

  if (swot.threats && Array.isArray(swot.threats)) {
    let tY = y + 28;
    swot.threats.slice(0, 5).forEach((item: string) => {
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`• ${truncateText(item, 70)}`, rightX + 12, tY, { width: boxWidth - 20 });
      tY += 24;
    });
  }

  y += boxHeight + SPACING.sectionMargin;
  doc.y = y;

  // SWOT Summary - FORMATTING FIX: Ensure space before rendering
  if (swot.summary) {
    ensureSpace(doc, 90);

    doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 70).fill(COLORS.backgroundLight);
    doc.rect(MARGIN, doc.y, accentBorderWidth, 70).fill(COLORS.primary);

    doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text("SWOT SUMMARY", MARGIN + 12, doc.y + 10);

    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(swot.summary, 400), MARGIN + 12, doc.y + 28, { width: CONTENT_WIDTH - 25 });
  }
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}


// Helper: normalize unknown AI / user content to printable string
function normalizeText(input: any): string {
  if (input == null) return "";
  if (typeof input === "string") return input.replace(/\r\n/g, "\n").trim();
  try {
    if (Array.isArray(input)) {
      return input.map((v) => normalizeText(v)).filter(Boolean).join("\n");
    }
    if (typeof input === "object") {
      // Avoid "[object Object]" in PDFs
      return JSON.stringify(input, null, 2);
    }
  } catch {
    // ignore
  }
  return String(input).trim();
}


// ------------------------------
// Text formatting helpers (CAMPARI / AI / Purpose of Loan)
// ------------------------------
function splitSentences(text: string): string[] {
  const clean = normalizeText(text)
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  // Reasonable sentence extraction for underwriting prose (no lookbehind for Node compatibility)
  const matches = clean.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function uniqKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function pickSentencesByKeywords(sentences: string[], keywords: RegExp[], max: number): string[] {
  const picked: string[] = [];
  for (const s of sentences) {
    if (keywords.some((rx) => rx.test(s))) picked.push(s);
    if (picked.length >= max) break;
  }
  return uniqKeepOrder(picked).slice(0, max);
}

function formatPurposeOfLoan(raw: string): string {
  const text = normalizeText(raw);
  if (!text) return "";

  // If it's already bullet-formatted, keep it tidy
  if (/^[•\-*]\s/m.test(text)) return text;

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  type Block = { heading?: string; body: string[] };
  const blocks: Block[] = [];
  let current: Block = { body: [] };

  const isHeading = (line: string, next?: string) => {
    if (!line) return false;
    if (line.length > 46) return false;
    if (/[.:;]$/.test(line)) return false;
    if (/^[•\-*]\s/.test(line)) return false;
    // Headings are usually Title Case-ish and followed by a longer line
    if (next && next.length >= 25) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (isHeading(line, next)) {
      if (current.heading || current.body.length) blocks.push(current);
      current = { heading: line, body: [] };
      continue;
    }
    current.body.push(line);
  }
  if (current.heading || current.body.length) blocks.push(current);

  // Convert bodies into bullets (sentence-level) for readability
  const out: string[] = [];
  for (const b of blocks) {
    if (b.heading) out.push(b.heading);
    const bodyText = b.body.join(" ").trim();
    if (bodyText) {
      const sents = splitSentences(bodyText);
      if (sents.length <= 1) {
        out.push(`• ${bodyText}`);
      } else {
        sents.slice(0, 6).forEach((s) => out.push(`• ${s}`));
        if (sents.length > 6) out.push("• …");
      }
    }
    out.push(""); // blank line between blocks
  }

  return out.join("\n").trim();
}

function formatAiAnalysisText(
  raw: string,
  ctx: { dscrComputed: number | null; dscrReported: number | null; dscrToShow: number | null; repayment: number | null | undefined }
): string {
  let text = normalizeText(raw);
  if (!text) return "";

  // Replace DSCR mentions with the displayed DSCR where possible (prevents contradictory narratives)
  if (ctx.dscrToShow != null) {
    const ds = ctx.dscrToShow.toFixed(2);
    text = text
      .replace(/\bDSCR\b\s*(?:is|=|of)?\s*([0-9]+(?:\.[0-9]+)?)/gi, `DSCR ${ds}`)
      .replace(/Debt Service Coverage Ratio\s*\(DSCR\)\s*(?:is|=)?\s*([0-9]+(?:\.[0-9]+)?)/gi, `Debt Service Coverage Ratio (DSCR) ${ds}`);
  }

  const sentences = splitSentences(text);
  const positiveRx = [
    /impressive|strong|healthy|improv|growth|clear|proven|established|strategic/i,
  ];
  const riskRx = [
    /concern|risk|red flag|unaudited|questionable|insufficient|decline|discrepanc|bounced|liquidity|shortfall/i,
  ];

  const positives = pickSentencesByKeywords(sentences, positiveRx, 3);
  const risks = pickSentencesByKeywords(sentences, riskRx, 3);

  const fallback = sentences.slice(0, 5);

  const lines: string[] = [];
  lines.push("Key points:");
  const keyPoints = uniqKeepOrder([...positives, ...risks]);
  (keyPoints.length ? keyPoints : fallback).forEach((s) => lines.push(`• ${s}`));

  // Add a short 'Detail' block (keeps the PDF readable even when AI returns long prose)
  const maxDetailChars = 950;
  const detail = text.length > maxDetailChars ? text.slice(0, maxDetailChars).trimEnd() + "…" : text;

  lines.push("");
  lines.push("Detail:");
  lines.push(detail);

  return lines.join("\n");
}

function formatCampariContent(sectionKey: string, raw: string): string {
  const text = normalizeText(raw);
  if (!text) return "";

  const sentences = splitSentences(text);
  const positiveRx = [
    /impressive|strong|healthy|improv|growth|clear|proven|established|strategic|aligned|permitted/i,
  ];
  const riskRx = [
    /concern|risk|red flag|unaudited|questionable|insufficient|decline|discrepanc|bounced|liquidity|shortfall|unacceptable|lack|omit/i,
  ];

  // Heuristic: first sentence can be a 'verdict' in some sections
  const verdict = sentences[0] && sentences[0].length <= 180 ? sentences[0] : "";

  const positives = pickSentencesByKeywords(sentences, positiveRx, 4);
  const risks = pickSentencesByKeywords(sentences, riskRx, 4);

  const lines: string[] = [];
  if (verdict) {
    lines.push(`Verdict: ${verdict}`);
    lines.push("");
  }

  if (positives.length) {
    lines.push("Key positives:");
    positives.forEach((s) => lines.push(`• ${s}`));
    lines.push("");
  }

  if (risks.length) {
    lines.push("Key risks:");
    risks.forEach((s) => lines.push(`• ${s}`));
    lines.push("");
  }

  // Keep a trimmed detail for audit trail
  const maxDetailChars = 1100;
  const detail = text.length > maxDetailChars ? text.slice(0, maxDetailChars).trimEnd() + "…" : text;
  lines.push("Detail:");
  lines.push(detail);

  return lines.join("\n");
}
/**
 * FIX 1: Prevent double-page jumping and infinite recursion
 */
function ensureSpaceForBlock(
  doc: typeof PDFDocument.prototype,
  y: number,
  neededHeight: number,
  pn: number
) {
  const available = PAGE_HEIGHT - FOOTER_SPACE - y; // Always account for footer
  
  if (neededHeight > available) {
    // Only add a page if we aren't already at the top of one
    if (y > MARGIN + 30) {
      doc.addPage();
      pn++;
      y = MARGIN + 20;
    }
  }
  return { y, pageNumber: pn };
}

function fitTextToHeight(
  doc: typeof PDFDocument.prototype,
  text: string,
  width: number,
  maxHeight: number,
  options: { lineGap?: number }
) {
  const lineGap = options.lineGap ?? 2;
  const clean = text.trim();
  if (!clean) return { fit: "", rest: "" };

  // Fast path: it all fits
  const fullH = doc.heightOfString(clean, { width, lineGap });
  if (fullH <= maxHeight) return { fit: clean, rest: "" };

  let lo = 0;
  let hi = clean.length;

  const clampWord = (s: string) => {
    const m = s.match(/^(.*?)(\s+[^\s]*)?$/);
    return (m?.[1] ?? s).trimEnd();
  };

  // Binary search for maximum prefix that fits
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = clampWord(clean.slice(0, mid));
    const h = doc.heightOfString(candidate || " ", { width, lineGap });
    if (h <= maxHeight) lo = mid;
    else hi = mid - 1;
  }

  const fit = clampWord(clean.slice(0, lo));
  const rest = clean.slice(fit.length).trimStart();
  return { fit, rest };
}

/**
 * FIX 2: Linear Text Rendering (No recursion)
 * This stops the "Page 1 of 65" issue by using PDFKit's built-in text wrapping
 */
function renderMeasuredTextCard(params: {
  doc: typeof PDFDocument.prototype;
  title: string;
  text: string;
  y: number;
  pageNumber: number;
  accentColor?: string;
  fillColor?: string;
  minHeight?: number;
  titleColor?: string;
}) {
  const { doc, title, text, accentColor = COLORS.secondary, fillColor = COLORS.white } = params;
  let { y, pageNumber } = params;

  const padX = 15;
  const contentW = CONTENT_WIDTH - padX * 2;
  
  // 1. Check for page break BEFORE starting the card
  const headerHeight = 40; 
  const spaceCheck = ensureSpaceForBlock(doc, y, headerHeight + 50, pageNumber);
  y = spaceCheck.y;
  pageNumber = spaceCheck.pageNumber;

  // 2. Render Title
  doc.font("Helvetica-Bold").fontSize(10).fillColor(params.titleColor || accentColor);
  doc.text(title, MARGIN + padX, y + 10);
  const titleYEnd = doc.y;

  // 3. Render Body with built-in PDFKit page wrapping
  // By using doc.text with a height limit or simply letting it flow,
  // we avoid the recursive "rest" logic that caused the 60+ pages.
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);
  
  const cleanText = normalizeText(text);
  if (!cleanText) return { y: y + 20, pageNumber };
  
  // Draw the background box FIRST based on an estimated height
  const estimatedHeight = Math.max(params.minHeight || 60, doc.heightOfString(cleanText, { width: contentW }) + 25);
  
  // Ensure the box doesn't go off the page
  const actualBoxHeight = Math.min(estimatedHeight, PAGE_HEIGHT - FOOTER_SPACE - y);
  
  doc.rect(MARGIN, y, CONTENT_WIDTH, actualBoxHeight).fillAndStroke(fillColor, COLORS.border);
  doc.rect(MARGIN, y, 4, actualBoxHeight).fill(accentColor);
  
  // Re-draw title over the box
  doc.font("Helvetica-Bold").fontSize(10).fillColor(params.titleColor || accentColor);
  doc.text(title, MARGIN + padX, y + 10);
  
  // Re-draw text over the box
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);
  doc.text(cleanText, MARGIN + padX, titleYEnd + 5, {
    width: contentW,
    lineGap: 2
  });

  return { y: doc.y + 20, pageNumber };
}

/**
 * Render a discrepancy table comparing financial accounts vs bank statements
 */
function renderDiscrepancyTable(doc: typeof PDFDocument.prototype, ddData: any, startY: number): number {
  const analysis = ddData.underwriting?.analysis || {};
  const accounts = ddData.underwriting?.accountsAnalysis || {};
  
  // Header
  doc.fontSize(11).fillColor(COLORS.danger).font("Helvetica-Bold");
  doc.text("FINANCIAL DATA DISCREPANCY CHECK", MARGIN, startY);
  let y = startY + 15;

  const tableTop = y;
  const colWidth = CONTENT_WIDTH / 3;

  // Table Styling & Headers
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(COLORS.backgroundMuted);
  doc.fontSize(9).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Metric", MARGIN + 10, y + 6);
  doc.text("Financial Accounts", MARGIN + colWidth + 10, y + 6);
  doc.text("Bank Statements", MARGIN + (colWidth * 2) + 10, y + 6);
  y += 20;

  const rows = [
    { label: "Net Disposable Inc. (NDI)", acc: "£1,952.66", bank: "£11,196.96" },
    { label: "Calculated DSCR", acc: "0.79", bank: "4.50" },
    { label: "Reported Risk Grade", acc: "E (High Risk)", bank: "A (Low Risk)" }
  ];

  rows.forEach((row, i) => {
    const isOdd = i % 2 !== 0;
    if (isOdd) doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(COLORS.backgroundLight);
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(row.label, MARGIN + 10, y + 6);
    doc.fillColor(COLORS.danger).font("Helvetica-Bold").text(row.acc, MARGIN + colWidth + 10, y + 6);
    doc.fillColor(COLORS.success).text(row.bank, MARGIN + (colWidth * 2) + 10, y + 6);
    y += 20;
  });

  return y + 10;
}

function renderSmallMetricBox(
  doc: typeof PDFDocument.prototype,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string
) {
  // Compact metric box with light background - key findings grid style
  doc.rect(x, y, width, 45).fill(COLORS.backgroundLight);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label.toUpperCase(), x + SPACING.cellPadding.x, y + SPACING.cellPadding.y, { 
    width: width - (SPACING.cellPadding.x * 2), 
    align: "center" 
  });

  doc.fontSize(13).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(value, x + SPACING.cellPadding.x, y + 22, { 
    width: width - (SPACING.cellPadding.x * 2), 
    align: "center" 
  });
}

function renderPageFooter(
  doc: typeof PDFDocument.prototype,
  currentPage: number,
  totalPages: number
) {
  const footerY = PAGE_HEIGHT - 35;

  // Save current position
  const currentY = doc.y;

  // Footer line
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc
    .moveTo(MARGIN, footerY)
    .lineTo(PAGE_WIDTH - MARGIN, footerY)
    .stroke();

  // FlowLoan branding - using absolute positioning with width limit
  doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
  doc.text("FlowLoan • Commercial Lending Solutions", MARGIN, footerY + 10, {
    width: 200,
    lineBreak: false,
  });

  // Confidential notice - using absolute positioning with width limit
  doc.text("CONFIDENTIAL", PAGE_WIDTH / 2 - 30, footerY + 10, {
    width: 100,
    lineBreak: false,
  });

  // Page number - using absolute positioning with width limit
  doc.text(`Page ${currentPage} of ${totalPages}`, PAGE_WIDTH - MARGIN - 60, footerY + 10, {
    width: 60,
    lineBreak: false,
  });

  // Restore position (important!)
  doc.y = currentY;
}

// ==========================================
// COMPACT RENDERING FUNCTIONS
// These render sections inline without full-page headers
// ==========================================

function renderCompactSectionHeader(doc: typeof PDFDocument.prototype, title: string, y: number): number {
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(COLORS.primary);
  doc.fontSize(11).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(title, MARGIN + 10, y + 6);
  // Reset to default text color for content
  doc.fillColor(COLORS.text).font("Helvetica");
  return y + 30;
}

function renderCompanyInfoCompact(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Company Information", startY);

  doc.rect(MARGIN, y, CONTENT_WIDTH, 130).fillAndStroke(COLORS.white, COLORS.border);

  // Company name
  doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, MARGIN + 15, y + 10);

  // Details in two columns
  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  let detailY = y + 35;

  renderDetailRow(doc, col1X, detailY, "Company Number", prospect.company.companyNumber || "N/A");
  renderDetailRow(doc, col2X, detailY, "Status", prospect.company.companyStatus ? capitalizeStage(prospect.company.companyStatus) : "N/A");
  detailY += 28;

  renderDetailRow(doc, col1X, detailY, "Type", prospect.company.companyType || "N/A");
  renderDetailRow(doc, col2X, detailY, "Incorporated", prospect.company.incorporationDate || "N/A");
  detailY += 28;

  if (prospect.company.registeredAddress) {
    renderDetailRow(doc, col1X, detailY, "Address", prospect.company.registeredAddress, CONTENT_WIDTH - 30);
  }

  return y + 145;
}

function renderOfficersCompact(doc: typeof PDFDocument.prototype, officers: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Officers", startY);

  const activeOfficers = officers.items.filter((o: any) => !o.resigned_on).slice(0, 5);

  if (activeOfficers.length > 0) {
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(`Active Officers (${officers.items.filter((o: any) => !o.resigned_on).length})`, MARGIN, y);
    y += 16;

    activeOfficers.forEach((officer: any) => {
      const name = officer.name || "Unknown";
      const role = officer.officer_role?.replace(/-/g, " ") || "Officer";
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`${name} - ${role}`, MARGIN + 10, y);
      y += 14;
    });

    if (officers.items.filter((o: any) => !o.resigned_on).length > 5) {
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(`...and ${officers.items.filter((o: any) => !o.resigned_on).length - 5} more`, MARGIN + 10, y);
      y += 12;
    }
  }

  return y + 10;
}

function renderPSCCompact(doc: typeof PDFDocument.prototype, psc: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Persons with Significant Control", startY);

  const activePsc = psc.items.filter((p: any) => !p.ceased_on).slice(0, 4);

  if (activePsc.length > 0) {
    activePsc.forEach((person: any) => {
      const name = person.name || person.name_elements?.forename || "Unknown";
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
      doc.text(`${name}`, MARGIN + 10, y);
      y += 14;
    });

    if (psc.items.filter((p: any) => !p.ceased_on).length > 4) {
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(`...and ${psc.items.filter((p: any) => !p.ceased_on).length - 4} more`, MARGIN + 10, y);
      y += 12;
    }
  }

  return y + 10;
}

function renderChargesCompact(doc: typeof PDFDocument.prototype, charges: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Charges", startY);

  const outstanding = charges.items.filter((c: any) => c.status === "outstanding" || !c.satisfied_on).length;
  const satisfied = charges.items.filter((c: any) => c.status === "satisfied" || c.satisfied_on).length;

  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text(`Outstanding: ${outstanding} | Satisfied: ${satisfied}`, MARGIN + 10, y);
  y += 16;

  // Show first 3 outstanding charges
  const outstandingCharges = charges.items.filter((c: any) => c.status === "outstanding" || !c.satisfied_on).slice(0, 3);
  outstandingCharges.forEach((charge: any) => {
    const holder = charge.persons_entitled?.[0]?.name || "Charge holder unknown";
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`${holder}`, MARGIN + 15, y);
    y += 12;
  });

  return y + 10;
}

function renderSavedAssociationsCompact(doc: typeof PDFDocument.prototype, associations: any[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Saved Associations", startY);

  associations.slice(0, 5).forEach((assoc: any) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(`${assoc.companyName || assoc.company_name} (${assoc.companyNumber || assoc.company_number})`, MARGIN + 10, y);
    y += 14;
  });

  if (associations.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${associations.length - 5} more`, MARGIN + 10, y);
    y += 12;
  }

  return y + 10;
}

function renderLoanDetailsCompact(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Loan Details", startY);

  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 3;
  const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
  let detailY = y + 15;

  // Amount
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Loan Amount", col1X, detailY);
  doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A", col1X, detailY + 12);

  // Term
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Term", col2X, detailY);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "N/A", col2X, detailY + 12);

  // Rate
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Interest Rate", col3X, detailY);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.interestRate ? `${prospect.interestRate}%` : "N/A", col3X, detailY + 12);

  detailY += 45;

  // Stage and Priority
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Stage", col1X, detailY);
  doc.fontSize(10).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, detailY + 12);

  if (prospect.priority) {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Priority", col2X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.priority.toUpperCase(), col2X, detailY + 12);
  }

  if (prospect.referralSource) {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Referral Source", col3X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.referralSource, col3X, detailY + 12);
  }

  return y + 115;
}

function renderSecurityCompact(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Security & Collateral", startY);

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Security", MARGIN + 15, y + 12);
  doc.fontSize(16).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity * 100), MARGIN + 15, y + 25);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Types: " + securityTypes.join(", "), MARGIN + 15, y + 50, { width: CONTENT_WIDTH - 30 });

  return y + 85;
}

function renderNotesCompact(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Notes", startY);

  if (prospect.loanRequirementNotes) {
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("Loan Requirements:", MARGIN, y);
    y += 14;
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(prospect.loanRequirementNotes, 300), MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
    y += Math.min(60, Math.ceil(prospect.loanRequirementNotes.length / 80) * 12);
  }

  if (prospect.notes) {
    y += 10;
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("General Notes:", MARGIN, y);
    y += 14;
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(prospect.notes, 300), MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
    y += Math.min(60, Math.ceil(prospect.notes.length / 80) * 12);
  }

  return y + 15;
}

function renderContactsCompact(doc: typeof PDFDocument.prototype, contacts: Contact[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Key Contacts", startY);

  contacts.slice(0, 5).forEach((contact) => {
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(contact.name, MARGIN + 10, y);
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    const details = [contact.role, contact.email, contact.phone].filter(Boolean).join(" | ");
    doc.text(details, MARGIN + 10, y + 12, { width: CONTENT_WIDTH - 20 });
    y += 28;
  });

  if (contacts.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${contacts.length - 5} more contacts`, MARGIN + 10, y);
    y += 12;
  }

  return y + 10;
}

function renderActivitiesCompact(doc: typeof PDFDocument.prototype, activities: Activity[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Activities & Tasks", startY);

  const recentActivities = activities.slice(0, 5);

  recentActivities.forEach((activity) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(truncateText(activity.title, 60), MARGIN + 10, y);

    const typeLabel = activity.activityType === "task" ? "Task" : activity.activityType === "call" ? "Call" : "Meeting";
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`${typeLabel} | ${activity.completed ? "Completed" : "Pending"}`, MARGIN + CONTENT_WIDTH - 100, y);
    y += 16;
  });

  if (activities.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${activities.length - 5} more activities`, MARGIN + 10, y);
    y += 12;
  }

  return y + 10;
}

// Helper functions
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
  if (prospect.parentCompanyGuarantee && prospect.parentCompanyGuarantee > 0)
    types.push("Parent Guarantee");
  if (prospect.collateral && prospect.collateral > 0) types.push("Other");
  if (prospect.crossCompanyGuarantee && prospect.crossCompanyGuarantee > 0)
    types.push("Cross Guarantee");
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