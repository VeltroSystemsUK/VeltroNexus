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

// Improved Layout Constants
const SPACING = {
  sectionMargin: 12, // Reduced from 15
  cellPadding: { x: 8, y: 5 }, // Slightly tighter
  sectionPadding: 8, // Reduced from 10
  headerMargin: 8, // Reduced from 10
  paragraphGap: 8, // Space between paragraphs
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

// Page dimensions - IMPROVED
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 40; // Reduced from 60 - more efficient use of space
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT; // Total usable content area

let pageNumber = 0;

// ============================================================================
// IMPROVED: Smart Page Break Management
// ============================================================================

/**
 * Calculate remaining space on current page
 */
function getRemainingSpace(doc: typeof PDFDocument.prototype): number {
  return USABLE_HEIGHT - doc.y;
}

/**
 * Check if content will fit on current page
 */
function willFitOnPage(doc: typeof PDFDocument.prototype, requiredHeight: number): boolean {
  return getRemainingSpace(doc) >= requiredHeight;
}

/**
 * IMPROVED: Add page break with better logic
 */
function ensureSpace(doc: typeof PDFDocument.prototype, requiredHeight: number): void {
  // If we don't have enough space, add a new page
  if (!willFitOnPage(doc, requiredHeight)) {
    addNewPage(doc);
  }
}

/**
 * Centralized new page function
 */
function addNewPage(doc: typeof PDFDocument.prototype): void {
  doc.addPage();
  pageNumber++;
  doc.y = MARGIN;
}

/**
 * IMPROVED: Smart text rendering with better page break handling
 */
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
    align?: string;
  } = {}
): number {
  const {
    width = CONTENT_WIDTH - 20,
    fontSize = 10,
    font = "Helvetica",
    color = COLORS.text,
    lineGap = 4,
    align = "left",
  } = options;

  doc.fontSize(fontSize).font(font).fillColor(color);

  // Calculate text height
  const textHeight = doc.heightOfString(text, { width, lineGap, align });

  // Check if we need a new page
  if (!willFitOnPage(doc, textHeight + 5)) {
    addNewPage(doc);
  }

  const startY = doc.y;
  
  // Render text
  doc.text(text, x, startY, { width, lineGap, align });

  return doc.y;
}

/**
 * IMPROVED: Render paragraphs with proper spacing
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

    // Add spacing between paragraphs (but not after last)
    if (index < paragraphs.length - 1) {
      doc.y += SPACING.paragraphGap;
    }
  });

  return doc.y;
}

/**
 * IMPROVED: Keep section together - prevents orphaned headers
 */
function keepSectionTogether(
  doc: typeof PDFDocument.prototype,
  estimatedHeight: number,
  renderFunction: () => number
): number {
  // If section won't fit, move to new page
  if (!willFitOnPage(doc, estimatedHeight)) {
    addNewPage(doc);
  }
  
  return renderFunction();
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

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
  addNewPage(doc);
  renderExecutiveSummary(doc, prospect);

  // Get enabled sections
  const sections = pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;
  const enabledSections = sections.filter((s) => s.enabled);

  // Add new page for main content
  addNewPage(doc);

  // Track if we need spacing
  let needsSectionSpacing = false;

  // Render enabled sections with improved spacing
  enabledSections.forEach((section) => {
    // Add spacing between sections (but not before first section)
    if (needsSectionSpacing) {
      doc.y += SPACING.sectionMargin;
    }

    switch (section.id) {
      case "companyInfo":
        if (companiesHouseData) {
          doc.y = renderCompanyInfoCompact(doc, prospect, companiesHouseData, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "officers":
        if (companiesHouseData?.officers?.items?.length > 0) {
          doc.y = renderOfficersCompact(doc, companiesHouseData.officers.items, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "psc":
        if (companiesHouseData?.psc?.items?.length > 0) {
          doc.y = renderPSCCompact(doc, companiesHouseData.psc.items, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "charges":
        if (companiesHouseData?.charges) {
          doc.y = renderChargesCompact(doc, companiesHouseData.charges, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "savedAssociations":
        if (prospect.savedAssociatedCompanies?.length > 0) {
          doc.y = renderSavedAssociationsCompact(doc, prospect.savedAssociatedCompanies, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "loanDetails":
        doc.y = renderLoanDetailsCompact(doc, prospect, doc.y);
        needsSectionSpacing = true;
        break;

      case "security":
        if (checkHasCollateral(prospect)) {
          doc.y = renderSecurityCompact(doc, prospect, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "notes":
        if (prospect.loanRequirementNotes || prospect.notes) {
          doc.y = renderNotesCompact(doc, prospect, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "contacts":
        if (contacts.length > 0) {
          doc.y = renderContactsCompact(doc, contacts, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "activities":
        if (activities.length > 0) {
          doc.y = renderActivitiesCompact(doc, activities, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "dueDiligence":
        if (dueDiligence) {
          doc.y = renderDueDiligenceCompact(doc, dueDiligence, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "creditRatios":
        if (dueDiligence?.financialData) {
          doc.y = renderCreditRatios(doc, dueDiligence.financialData, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "campari":
        if (dueDiligence?.campariAnalysis) {
          doc.y = renderCAMPARIAnalysis(doc, dueDiligence.campariAnalysis, doc.y);
          needsSectionSpacing = true;
        }
        break;

      case "swotAnalysis":
        if (dueDiligence?.swotAnalysis) {
          doc.y = renderSWOTAnalysis(doc, dueDiligence.swotAnalysis, doc.y);
          needsSectionSpacing = true;
        }
        break;
    }
  });

  // Final page - Signature section
  ensureSpace(doc, 150);
  doc.y += 20;
  renderSignatureSection(doc, doc.y);

  // Add footers to all pages
  addFootersToAllPages(doc, prospect);

  return doc;
}

// ============================================================================
// COVER PAGE
// ============================================================================

function renderCoverPage(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany): void {
  const centerX = PAGE_WIDTH / 2;

  // Header with accent bar
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);
  
  doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("FLOWLOAN", centerX - 80, 30);
  
  doc.fontSize(11).fillColor(COLORS.white).font("Helvetica");
  doc.text("Commercial Lending Solutions", centerX - 80, 62);

  // Main title
  doc.y = 160;
  doc.fontSize(32).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Credit Assessment", 0, doc.y, { align: "center", width: PAGE_WIDTH });
  
  doc.y += 40;
  doc.fontSize(28).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Report", 0, doc.y, { align: "center", width: PAGE_WIDTH });

  // Company name box
  doc.y += 60;
  const boxWidth = 400;
  const boxX = (PAGE_WIDTH - boxWidth) / 2;
  
  doc.roundedRect(boxX, doc.y, boxWidth, 80, 5).fillAndStroke(COLORS.backgroundLight, COLORS.border);
  
  doc.fontSize(20).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyName, boxX + 20, doc.y + 25, {
    width: boxWidth - 40,
    align: "center",
  });

  // Company details
  doc.y += 100;
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  
  const details = [
    `Company Registration: ${prospect.company.companyNumber}`,
    `Registered Address: ${prospect.company.registeredAddress}`,
  ];

  details.forEach((detail) => {
    doc.text(detail, 0, doc.y, { align: "center", width: PAGE_WIDTH });
    doc.y += 18;
  });

  // Loan summary box
  doc.y += 40;
  const summaryBoxWidth = 450;
  const summaryBoxX = (PAGE_WIDTH - summaryBoxWidth) / 2;
  
  doc.roundedRect(summaryBoxX, doc.y, summaryBoxWidth, 100, 5)
     .fillAndStroke(COLORS.white, COLORS.border);

  const col1X = summaryBoxX + 30;
  const col2X = summaryBoxX + summaryBoxWidth / 2 + 15;
  let infoY = doc.y + 20;

  // Column 1
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("LOAN AMOUNT", col1X, infoY);
  doc.fontSize(16).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "TBD", col1X, infoY + 12);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("PIPELINE STAGE", col1X, infoY + 50);
  doc.fontSize(12).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, infoY + 62);

  // Column 2
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("TERM", col2X, infoY);
  doc.fontSize(16).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "TBD", col2X, infoY + 12);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("REFERRAL SOURCE", col2X, infoY + 50);
  doc.fontSize(12).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.referralSource || "Direct", col2X, infoY + 62);

  // Report date at bottom
  doc.y = PAGE_HEIGHT - 120;
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(`Report Date:`, 0, doc.y, { align: "center", width: PAGE_WIDTH });
  doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(new Date().toLocaleDateString("en-GB", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  }), 0, doc.y + 15, { align: "center", width: PAGE_WIDTH });

  // Confidentiality notice
  doc.y = PAGE_HEIGHT - 70;
  doc.fontSize(7).fillColor(COLORS.textLight).font("Helvetica");
  doc.text(
    "CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. Unauthorized distribution, copying, or disclosure is strictly prohibited.",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, align: "center", lineGap: 2 }
  );
}

// ============================================================================
// EXECUTIVE SUMMARY
// ============================================================================

function renderExecutiveSummary(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany): void {
  // Section header
  doc.fontSize(22).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("01 EXECUTIVE SUMMARY", MARGIN, MARGIN);
  
  doc.moveTo(MARGIN, MARGIN + 32)
     .lineTo(MARGIN + CONTENT_WIDTH, MARGIN + 32)
     .strokeColor(COLORS.accent)
     .lineWidth(2)
     .stroke();

  doc.y = MARGIN + 50;

  // Business Overview Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 180, 5)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let contentY = doc.y + 15;
  
  doc.fontSize(11).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("BUSINESS OVERVIEW", MARGIN + 15, contentY);
  
  contentY += 25;

  // Two-column layout
  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  const colWidth = (CONTENT_WIDTH / 2) - 25;

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
    doc.text(item.value, col1X, contentY + 10, { width: colWidth });
    contentY += 30;
  });

  // Right column
  contentY = doc.y + 40;
  
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
    doc.text(item.value, col2X, contentY + 10, { width: colWidth });
    contentY += 30;
  });

  doc.y += 190;

  // Security Position Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 90, 5)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 15;
  
  doc.fontSize(11).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("SECURITY POSITION", MARGIN + 15, contentY);
  
  contentY += 25;

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Security", col1X, contentY);
  doc.fontSize(14).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity * 100), col1X, contentY + 12);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Security Types", col2X, contentY);
  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text(securityTypes.length > 0 ? securityTypes.join(", ") : "None", col2X, contentY + 12, {
    width: colWidth,
  });

  doc.y += 100;

  // Assessment Status Box
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 70, 5)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 15;
  
  doc.fontSize(11).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("ASSESSMENT STATUS", MARGIN + 15, contentY);
  
  contentY += 25;

  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text(prospect.assessmentStatus || "Due diligence not yet started", MARGIN + 15, contentY, {
    width: CONTENT_WIDTH - 30,
  });

  doc.y += 80;

  // Key Findings
  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 90, 5)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  contentY = doc.y + 15;
  
  doc.fontSize(11).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text("KEY FINDINGS", MARGIN + 15, contentY);
  
  contentY += 25;

  const keyFindings = [
    `Company Status: ${prospect.company.companyStatus || "Active"}`,
    `Active Officers: ${prospect.company.numActiveOfficers || 0}`,
    `Outstanding Charges: ${prospect.company.numOutstandingCharges || 0}`,
    `Incorporated: ${prospect.company.dateOfIncorporation ? new Date(prospect.company.dateOfIncorporation).toLocaleDateString("en-GB") : "N/A"}`,
    `Location: ${prospect.company.postcode || "N/A"}`,
  ];

  keyFindings.forEach((finding) => {
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(`• ${finding}`, MARGIN + 15, contentY);
    contentY += 14;
  });
}

// ============================================================================
// SECTION HEADER (Compact)
// ============================================================================

function renderCompactSectionHeader(doc: typeof PDFDocument.prototype, title: string, startY: number): number {
  // Ensure minimum space for header + some content
  ensureSpace(doc, 60);
  
  doc.y = startY;
  
  // Draw accent line and title
  doc.moveTo(MARGIN, doc.y)
     .lineTo(MARGIN + 4, doc.y)
     .strokeColor(COLORS.accent)
     .lineWidth(3)
     .stroke();

  doc.fontSize(13).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(title, MARGIN + 12, doc.y - 2);

  doc.y += 22;
  
  return doc.y;
}

// ============================================================================
// COMPANY INFO SECTION
// ============================================================================

function renderCompanyInfoCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  companiesHouseData: CompaniesHouseData,
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Company Information", startY);

  const company = prospect.company;

  // Estimate height for this section
  const estimatedHeight = 120;
  ensureSpace(doc, estimatedHeight);

  // Company details box
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 100, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let detailY = y + 12;
  const labelX = MARGIN + 12;
  const valueX = MARGIN + 130;
  const maxWidth = CONTENT_WIDTH - 145;

  const details = [
    { label: "Company Number:", value: company.companyNumber },
    { label: "Status:", value: company.companyStatus || "Active" },
    { label: "Type:", value: company.companyType || "ltd" },
    { label: "Incorporated:", value: company.dateOfIncorporation ? new Date(company.dateOfIncorporation).toLocaleDateString("en-GB") : "N/A" },
  ];

  details.forEach((detail) => {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(detail.label, labelX, detailY);
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(detail.value, valueX, detailY, { width: maxWidth });
    
    detailY += 18;
  });

  return y + 110;
}

// ============================================================================
// OFFICERS SECTION
// ============================================================================

function renderOfficersCompact(doc: typeof PDFDocument.prototype, officers: any[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Officers", startY);

  // Estimate height
  const itemHeight = 28;
  const maxItems = Math.min(officers.length, 5);
  const estimatedHeight = maxItems * itemHeight + 30;
  
  ensureSpace(doc, estimatedHeight);

  officers.slice(0, 5).forEach((officer) => {
    // Check space for each officer entry
    ensureSpace(doc, 35);
    
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(officer.name, MARGIN + 10, y);

    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    const details = [
      officer.officer_role,
      officer.appointed_on ? `Appointed: ${new Date(officer.appointed_on).toLocaleDateString("en-GB")}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    
    doc.text(details, MARGIN + 10, y + 13, { width: CONTENT_WIDTH - 20 });
    y += itemHeight;
  });

  if (officers.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${officers.length - 5} more officers`, MARGIN + 10, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// PSC SECTION
// ============================================================================

function renderPSCCompact(doc: typeof PDFDocument.prototype, pscList: any[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Persons with Significant Control", startY);

  const itemHeight = 28;
  const maxItems = Math.min(pscList.length, 5);
  const estimatedHeight = maxItems * itemHeight + 30;
  
  ensureSpace(doc, estimatedHeight);

  pscList.slice(0, 5).forEach((psc) => {
    ensureSpace(doc, 35);
    
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(psc.name, MARGIN + 10, y);

    const natures = psc.natures_of_control?.join(", ") || "Not specified";
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(natures, MARGIN + 10, y + 13, { width: CONTENT_WIDTH - 20 });
    
    y += itemHeight;
  });

  if (pscList.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${pscList.length - 5} more PSCs`, MARGIN + 10, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// CHARGES SECTION
// ============================================================================

function renderChargesCompact(doc: typeof PDFDocument.prototype, chargesData: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Charges", startY);

  ensureSpace(doc, 80);

  const charges = chargesData.items || [];
  const totalCharges = chargesData.total_count || 0;
  const satisfied = chargesData.satisfied_count || 0;
  const outstanding = chargesData.outstanding_count || totalCharges - satisfied;

  // Summary box
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 60, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 3;
  const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
  let summaryY = y + 15;

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Charges", col1X, summaryY);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(totalCharges.toString(), col1X, summaryY + 12);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Outstanding", col2X, summaryY);
  doc.fontSize(14)
     .fillColor(outstanding > 0 ? COLORS.warning : COLORS.success)
     .font("Helvetica-Bold");
  doc.text(outstanding.toString(), col2X, summaryY + 12);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Satisfied", col3X, summaryY);
  doc.fontSize(14).fillColor(COLORS.textSecondary).font("Helvetica-Bold");
  doc.text(satisfied.toString(), col3X, summaryY + 12);

  y += 70;

  // List recent charges (if any)
  if (charges.length > 0) {
    y += 5;
    const maxCharges = Math.min(charges.length, 3);
    
    charges.slice(0, maxCharges).forEach((charge: any) => {
      ensureSpace(doc, 30);
      
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(charge.classification?.description || "Charge", MARGIN + 10, y);
      
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      const chargeDetails = [
        charge.status,
        charge.created_on ? `Created: ${new Date(charge.created_on).toLocaleDateString("en-GB")}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      
      doc.text(chargeDetails, MARGIN + 10, y + 12);
      y += 28;
    });

    if (charges.length > 3) {
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(`...and ${charges.length - 3} more charges`, MARGIN + 10, y);
      y += 12;
    }
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SAVED ASSOCIATIONS SECTION
// ============================================================================

function renderSavedAssociationsCompact(
  doc: typeof PDFDocument.prototype,
  associations: any[],
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Saved Associated Companies", startY);

  const itemHeight = 18;
  const maxItems = Math.min(associations.length, 5);
  const estimatedHeight = maxItems * itemHeight + 30;
  
  ensureSpace(doc, estimatedHeight);

  associations.slice(0, 5).forEach((assoc: any) => {
    ensureSpace(doc, 20);
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(
      `${assoc.companyName || assoc.company_name} (${assoc.companyNumber || assoc.company_number})`,
      MARGIN + 10,
      y
    );
    y += itemHeight;
  });

  if (associations.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${associations.length - 5} more`, MARGIN + 10, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// LOAN DETAILS SECTION
// ============================================================================

function renderLoanDetailsCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Loan Details", startY);

  ensureSpace(doc, 110);

  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 95, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 3;
  const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
  let detailY = y + 12;

  // Row 1: Amount, Term, Rate
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Loan Amount", col1X, detailY);
  doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A", col1X, detailY + 12);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Term", col2X, detailY);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "N/A", col2X, detailY + 12);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Interest Rate", col3X, detailY);
  doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.interestRate ? `${prospect.interestRate}%` : "N/A", col3X, detailY + 12);

  detailY += 42;

  // Row 2: Stage, Priority, Referral
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Stage", col1X, detailY);
  doc.fontSize(10).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, detailY + 12);

  if (prospect.priority) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Priority", col2X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.priority.toUpperCase(), col2X, detailY + 12);
  }

  if (prospect.referralSource) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Referral Source", col3X, detailY);
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(prospect.referralSource, col3X, detailY + 12);
  }

  return y + 105;
}

// ============================================================================
// SECURITY SECTION
// ============================================================================

function renderSecurityCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Security & Collateral", startY);

  ensureSpace(doc, 75);

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 65, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Total Security", MARGIN + 15, y + 12);
  doc.fontSize(16).fillColor(COLORS.success).font("Helvetica-Bold");
  doc.text(formatCurrency(totalSecurity * 100), MARGIN + 15, y + 25);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Types: " + securityTypes.join(", "), MARGIN + 15, y + 48, { width: CONTENT_WIDTH - 30 });

  return y + 75;
}

// ============================================================================
// NOTES SECTION
// ============================================================================

function renderNotesCompact(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Notes", startY);

  if (prospect.loanRequirementNotes) {
    ensureSpace(doc, 70);
    
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("Loan Requirements:", MARGIN, y);
    y += 14;
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    const noteText = truncateText(prospect.loanRequirementNotes, 300);
    doc.text(noteText, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
    
    // Calculate actual height used
    const textHeight = doc.heightOfString(noteText, { width: CONTENT_WIDTH - 20 });
    y += textHeight + 5;
  }

  if (prospect.notes) {
    y += 10;
    ensureSpace(doc, 70);
    
    doc.fontSize(9).fillColor(COLORS.secondary).font("Helvetica-Bold");
    doc.text("General Notes:", MARGIN, y);
    y += 14;
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    const noteText = truncateText(prospect.notes, 300);
    doc.text(noteText, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
    
    const textHeight = doc.heightOfString(noteText, { width: CONTENT_WIDTH - 20 });
    y += textHeight + 5;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// CONTACTS SECTION
// ============================================================================

function renderContactsCompact(doc: typeof PDFDocument.prototype, contacts: Contact[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Key Contacts", startY);

  const itemHeight = 28;
  const maxItems = Math.min(contacts.length, 5);
  const estimatedHeight = maxItems * itemHeight + 30;
  
  ensureSpace(doc, estimatedHeight);

  contacts.slice(0, 5).forEach((contact) => {
    ensureSpace(doc, 35);
    
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(contact.name, MARGIN + 10, y);
    
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
    const details = [contact.role, contact.email, contact.phone].filter(Boolean).join(" | ");
    doc.text(details, MARGIN + 10, y + 13, { width: CONTENT_WIDTH - 20 });
    
    y += itemHeight;
  });

  if (contacts.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${contacts.length - 5} more contacts`, MARGIN + 10, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// ACTIVITIES SECTION
// ============================================================================

function renderActivitiesCompact(doc: typeof PDFDocument.prototype, activities: Activity[], startY: number): number {
  let y = renderCompactSectionHeader(doc, "Activities & Tasks", startY);

  const itemHeight = 20;
  const maxItems = Math.min(activities.length, 5);
  const estimatedHeight = maxItems * itemHeight + 30;
  
  ensureSpace(doc, estimatedHeight);

  const recentActivities = activities.slice(0, 5);

  recentActivities.forEach((activity) => {
    ensureSpace(doc, 25);
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(truncateText(activity.title, 60), MARGIN + 10, y);

    const typeLabel =
      activity.activityType === "task" ? "Task" : activity.activityType === "call" ? "Call" : "Meeting";
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(
      `${typeLabel} | ${activity.completed ? "Completed" : "Pending"}`,
      MARGIN + CONTENT_WIDTH - 100,
      y
    );
    
    y += itemHeight;
  });

  if (activities.length > 5) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text(`...and ${activities.length - 5} more activities`, MARGIN + 10, y);
    y += 12;
  }

  return y + SPACING.sectionMargin;
}

// ============================================================================
// DUE DILIGENCE SECTION
// ============================================================================

function renderDueDiligenceCompact(
  doc: typeof PDFDocument.prototype,
  dueDiligence: DueDiligence,
  startY: number
): number {
  let y = renderCompactSectionHeader(doc, "Due Diligence", startY);

  ensureSpace(doc, 100);

  // Status box
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 85, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let contentY = y + 12;
  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;

  // Left column
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Status", col1X, contentY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(dueDiligence.status || "Not Started", col1X, contentY + 12);

  // Right column
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Last Updated", col2X, contentY);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
  doc.text(
    dueDiligence.updatedAt ? new Date(dueDiligence.updatedAt).toLocaleDateString("en-GB") : "N/A",
    col2X,
    contentY + 12
  );

  contentY += 42;

  // Summary if available
  if (dueDiligence.summary) {
    doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
    doc.text("Summary", col1X, contentY);
    
    contentY += 14;
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(truncateText(dueDiligence.summary, 150), col1X, contentY, {
      width: CONTENT_WIDTH - 30,
    });
  }

  return y + 95;
}

// ============================================================================
// CREDIT RATIOS SECTION
// ============================================================================

function renderCreditRatios(doc: typeof PDFDocument.prototype, financialData: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "Credit Ratios", startY);

  ensureSpace(doc, 120);

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
      const x = MARGIN + 15 + col * (CONTENT_WIDTH / 2);
      const ratioY = y + row * 45;

      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(ratio.label, x, ratioY);
      
      doc.fontSize(14).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(ratio.format(ratio.value), x, ratioY + 12);
    }
  });

  return y + 100;
}

// ============================================================================
// CAMPARI ANALYSIS
// ============================================================================

function renderCAMPARIAnalysis(doc: typeof PDFDocument.prototype, campari: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "CAMPARI Analysis", startY);

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
      // Estimate height for this sub-section
      const textHeight = doc.heightOfString(content, { width: CONTENT_WIDTH - 20 });
      const sectionHeight = textHeight + 35;
      
      ensureSpace(doc, sectionHeight);

      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text(section.label, MARGIN, y);
      y += 16;

      doc.y = renderTextWithPageBreaks(doc, content, MARGIN + 10, {
        fontSize: 9,
        color: COLORS.text,
        width: CONTENT_WIDTH - 20,
      });
      
      y = doc.y + 12;
    }
  });

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SWOT ANALYSIS
// ============================================================================

function renderSWOTAnalysis(doc: typeof PDFDocument.prototype, swot: any, startY: number): number {
  let y = renderCompactSectionHeader(doc, "SWOT Analysis", startY);

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

  quadrants.forEach((quad, index) => {
    const items = swot[quad.key];
    if (items && items.length > 0) {
      // Calculate height needed
      const itemsHeight = items.length * 16;
      const quadHeight = itemsHeight + 50;
      
      ensureSpace(doc, quadHeight);

      // Draw quadrant box
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, itemsHeight + 40, 3)
         .fillAndStroke(quad.bg, quad.border);

      // Quadrant label
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(quad.label, MARGIN + 12, y + 10);

      let itemY = y + 28;

      // List items
      items.forEach((item: string) => {
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.text(`• ${item}`, MARGIN + 12, itemY, { width: CONTENT_WIDTH - 24 });
        itemY += 16;
      });

      y = itemY + 12;
    }
  });

  return y + SPACING.sectionMargin;
}

// ============================================================================
// SIGNATURE SECTION
// ============================================================================

function renderSignatureSection(doc: typeof PDFDocument.prototype, startY: number): void {
  ensureSpace(doc, 140);

  doc.y = startY;

  doc.roundedRect(MARGIN, doc.y, CONTENT_WIDTH, 120, 3)
     .fillAndStroke(COLORS.backgroundLight, COLORS.border);

  let sigY = doc.y + 15;

  doc.fontSize(12).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("ADVISER RECOMMENDATION", MARGIN + 15, sigY);

  sigY += 25;

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Recommendation", MARGIN + 15, sigY);
  
  sigY += 14;
  doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
  doc.text("No recommendation provided.", MARGIN + 15, sigY);

  sigY += 25;

  // Signature fields
  const col1X = MARGIN + 15;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;

  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Signature: _________________________________", col1X, sigY);
  doc.text("Date: _________________________________", col2X, sigY);

  sigY += 20;

  doc.text("Name: _________________________________", col1X, sigY);
}

// ============================================================================
// FOOTER
// ============================================================================

function addFootersToAllPages(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany): void {
  const pages = doc.bufferedPageRange();
  
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    const footerY = PAGE_HEIGHT - 35;

    // Left side - Company name
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
    doc.text(prospect.company.companyName, MARGIN, footerY, {
      width: CONTENT_WIDTH / 2 - 10,
      align: "left",
    });

    // Center - Confidential
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica-Bold");
    doc.text("CONFIDENTIAL", PAGE_WIDTH / 2 - 40, footerY);

    // Right side - Page number
    doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN + CONTENT_WIDTH / 2 + 10, footerY, {
      width: CONTENT_WIDTH / 2 - 10,
      align: "right",
    });

    // Top of footer - FlowLoan branding
    doc.fontSize(7).fillColor(COLORS.textLight).font("Helvetica");
    doc.text("FlowLoan • Commercial Lending Solutions", MARGIN, footerY + 12, {
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
