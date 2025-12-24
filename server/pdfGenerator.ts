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

// IMPROVED: More consistent spacing
const SPACING = {
  sectionMargin: 20,
  cellPadding: { x: 10, y: 8 },
  sectionPadding: 12,
  headerMargin: 12,
  paragraphSpacing: 10,
  bulletIndent: 15,
  lineHeight: 1.4,
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
  { id: "campari", label: "CAMPARI Analysis", enabled: true },
  { id: "swotAnalysis", label: "SWOT Analysis", enabled: true },
];

// Page dimensions
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 60;
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

let pageNumber = 0;

// ============================================================================
// NEW: Smart text and page management utilities
// ============================================================================

/**
 * Calculate remaining space on current page
 */
function getRemainingPageSpace(doc: typeof PDFDocument.prototype): number {
  return USABLE_HEIGHT - doc.y;
}

/**
 * Check if we need a new page for content of given height
 */
function needsNewPage(doc: typeof PDFDocument.prototype, requiredHeight: number): boolean {
  return getRemainingPageSpace(doc) < requiredHeight;
}

/**
 * Add a new page if needed, with proper page numbering
 */
function addPageIfNeeded(doc: typeof PDFDocument.prototype, requiredHeight: number): void {
  if (needsNewPage(doc, requiredHeight)) {
    doc.addPage();
    pageNumber++;
  }
}

/**
 * IMPROVED: Smart text rendering with proper line breaks and overflow handling
 */
function renderSmartText(
  doc: typeof PDFDocument.prototype,
  text: string,
  x: number,
  y: number,
  options: {
    width?: number;
    fontSize?: number;
    font?: string;
    color?: string;
    lineGap?: number;
    continued?: boolean;
    indent?: number;
  } = {}
): number {
  const {
    width = CONTENT_WIDTH,
    fontSize = 10,
    font = "Helvetica",
    color = COLORS.text,
    lineGap = 4,
    continued = false,
    indent = 0,
  } = options;

  doc.fontSize(fontSize).font(font).fillColor(color);

  // Calculate text height before rendering
  const textHeight = doc.heightOfString(text, {
    width: width - indent,
    lineGap,
  });

  // Check if we need a new page
  if (needsNewPage(doc, textHeight + 20)) {
    doc.addPage();
    pageNumber++;
    y = MARGIN;
  }

  // Render text with proper options
  doc.text(text, x + indent, y, {
    width: width - indent,
    lineGap,
    continued,
    align: "left",
  });

  return doc.y + lineGap;
}

/**
 * IMPROVED: Render bullet points with proper spacing and page break handling
 */
function renderBulletPoints(
  doc: typeof PDFDocument.prototype,
  items: string[],
  startY: number,
  options: {
    fontSize?: number;
    color?: string;
    bulletChar?: string;
    indent?: number;
  } = {}
): number {
  const {
    fontSize = 10,
    color = COLORS.text,
    bulletChar = "•",
    indent = SPACING.bulletIndent,
  } = options;

  let y = startY;

  items.forEach((item, index) => {
    // Estimate height needed for this bullet
    doc.fontSize(fontSize).font("Helvetica");
    const itemHeight = doc.heightOfString(item, {
      width: CONTENT_WIDTH - indent - 15,
      lineGap: 4,
    });

    // Add page if needed
    if (needsNewPage(doc, itemHeight + 20)) {
      doc.addPage();
      pageNumber++;
      y = MARGIN;
    }

    // Render bullet
    doc.fontSize(fontSize).fillColor(color).font("Helvetica");
    doc.text(bulletChar, MARGIN, y, { continued: false });

    // Render text
    y = renderSmartText(doc, item, MARGIN, y, {
      fontSize,
      color,
      indent: indent,
      lineGap: 4,
    });

    // Add spacing between bullets
    y += index < items.length - 1 ? SPACING.paragraphSpacing : 0;
  });

  return y;
}

/**
 * IMPROVED: Render section header with consistent styling
 */
function renderSectionHeader(
  doc: typeof PDFDocument.prototype,
  title: string,
  sectionNumber?: string
): number {
  // Ensure we have space for header
  addPageIfNeeded(doc, 40);

  let y = doc.y;

  // Add section spacing
  if (y > MARGIN + 20) {
    y += SPACING.sectionMargin;
  }

  // Background bar
  doc
    .rect(MARGIN - 10, y, CONTENT_WIDTH + 20, 28)
    .fillAndStroke(COLORS.primary, COLORS.primary);

  // Section number if provided
  let textX = MARGIN;
  if (sectionNumber) {
    doc.fontSize(14).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(sectionNumber, MARGIN, y + 7, { continued: false });
    textX = MARGIN + 25;
  }

  // Section title
  doc.fontSize(14).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(title, textX, y + 7, { width: CONTENT_WIDTH - 30 });

  doc.y = y + 28 + SPACING.headerMargin;
  return doc.y;
}

/**
 * IMPROVED: Render subsection header
 */
function renderSubsectionHeader(
  doc: typeof PDFDocument.prototype,
  title: string,
  startY?: number
): number {
  const y = startY || doc.y;

  // Ensure space
  addPageIfNeeded(doc, 30);

  doc.fontSize(12).fillColor(COLORS.secondary).font("Helvetica-Bold");
  doc.text(title, MARGIN, doc.y);

  doc.y += SPACING.headerMargin;
  return doc.y;
}

/**
 * IMPROVED: Render paragraphs with proper wrapping and page breaks
 */
function renderParagraphs(
  doc: typeof PDFDocument.prototype,
  paragraphs: string[],
  startY?: number,
  options: {
    fontSize?: number;
    color?: string;
  } = {}
): number {
  let y = startY || doc.y;
  const { fontSize = 10, color = COLORS.text } = options;

  paragraphs.forEach((para, index) => {
    if (!para || para.trim() === "") return;

    y = renderSmartText(doc, para, MARGIN, y, {
      fontSize,
      color,
      lineGap: 5,
    });

    // Add paragraph spacing (except after last paragraph)
    if (index < paragraphs.length - 1) {
      y += SPACING.paragraphSpacing;
    }
  });

  return y;
}

// ============================================================================
// Cover Page
// ============================================================================

function renderCoverPage(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany): void {
  // Header Section
  doc.fontSize(24).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("FLOWLOAN", MARGIN, 100);

  doc.fontSize(12).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Commercial Lending Solutions", MARGIN, 130);

  doc.moveTo(MARGIN, 155).lineTo(MARGIN + CONTENT_WIDTH, 155).stroke(COLORS.border);

  // Report Title
  doc.fontSize(18).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text("Credit Assessment", MARGIN, 180);
  doc.text("Report", MARGIN, 205);

  // Company Name
  doc.fontSize(20).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.company.companyName.toUpperCase(), MARGIN, 260, {
    width: CONTENT_WIDTH,
  });

  // Company Details
  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica");
  const companyDetailsY = 310;

  if (prospect.company.companyNumber) {
    doc.text(`Company Registration: ${prospect.company.companyNumber}`, MARGIN, companyDetailsY);
  }

  if (prospect.company.registeredAddress) {
    doc.text(
      `Registered Address: ${prospect.company.registeredAddress}`,
      MARGIN,
      companyDetailsY + 15,
      { width: CONTENT_WIDTH }
    );
  }

  // Key Metrics Box
  const metricsY = 400;
  doc.rect(MARGIN, metricsY, CONTENT_WIDTH, 150).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  let labelY = metricsY + 20;

  // Loan Amount
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("LOAN AMOUNT", col1X, labelY);
  doc.fontSize(20).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(
    prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A",
    col1X,
    labelY + 15
  );

  // Term
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("TERM", col2X, labelY);
  doc.fontSize(20).fillColor(COLORS.text).font("Helvetica-Bold");
  doc.text(prospect.term ? `${prospect.term} months` : "N/A", col2X, labelY + 15);

  labelY += 60;

  // Stage
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("PIPELINE STAGE", col1X, labelY);
  doc.fontSize(14).fillColor(getStageColor(prospect.stage)).font("Helvetica-Bold");
  doc.text(capitalizeStage(prospect.stage), col1X, labelY + 15);

  // Report Date
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Report Date:", MARGIN + 20, metricsY + 135);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
  doc.text(new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }), MARGIN + 90, metricsY + 135);

  // Footer Confidentiality Notice
  doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(
    "CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. Unauthorized distribution, copying, or disclosure is strictly prohibited.",
    MARGIN,
    PAGE_HEIGHT - 100,
    {
      width: CONTENT_WIDTH,
      align: "center",
      lineGap: 3,
    }
  );
}

// ============================================================================
// Executive Summary
// ============================================================================

function renderExecutiveSummary(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  dueDiligence?: DueDiligence,
  companiesHouseData?: CompaniesHouseData | null
): void {
  renderSectionHeader(doc, "EXECUTIVE SUMMARY", "01");

  // Business Overview
  renderSubsectionHeader(doc, "BUSINESS OVERVIEW");

  const overviewData = [
    ["Company", prospect.company.companyName],
    ["Sector/Industry", prospect.company.sicDescription || "N/A"],
    ["Pipeline Stage", capitalizeStage(prospect.stage)],
    ["Referral Source", prospect.referralSource || "Direct"],
  ];

  renderKeyValueTable(doc, overviewData);

  // Key Findings
  renderSubsectionHeader(doc, "KEY FINDINGS");

  const companyStatus = companiesHouseData?.officers ? "Active" : "N/A";
  const activeOfficers = companiesHouseData?.officers?.items?.filter((o: any) => !o.resigned_on)
    .length || 0;
  const outstandingCharges = companiesHouseData?.charges?.total_count || 0;

  const findings = [
    `Company Status: ${companyStatus}`,
    `Active Officers: ${activeOfficers}`,
    `Outstanding Charges: ${outstandingCharges}`,
  ];

  renderBulletPoints(doc, findings, doc.y, { fontSize: 10 });

  doc.y += SPACING.sectionMargin;

  // Loan Purpose & Requirements
  renderSubsectionHeader(doc, "LOAN PURPOSE & REQUIREMENTS");

  if (prospect.loanPurpose) {
    renderSmartText(doc, prospect.loanPurpose, MARGIN, doc.y, { fontSize: 10 });
    doc.y += SPACING.paragraphSpacing;
  }

  // Loan Details Grid
  const loanDetailsY = doc.y;
  doc.rect(MARGIN, loanDetailsY, CONTENT_WIDTH, 120).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const gridCol1 = MARGIN + 20;
  const gridCol2 = MARGIN + CONTENT_WIDTH / 2 + 10;
  let gridY = loanDetailsY + 15;

  // Row 1
  renderLabelValue(doc, "LOAN AMOUNT", prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A", gridCol1, gridY, 16);
  renderLabelValue(doc, "TERM", prospect.term ? `${prospect.term} months` : "N/A", gridCol2, gridY, 14);

  gridY += 50;

  // Row 2
  renderLabelValue(doc, "INTEREST RATE", prospect.interestRate ? `${prospect.interestRate}%` : "N/A", gridCol1, gridY, 14);
  renderLabelValue(doc, "PRIORITY", prospect.priority ? prospect.priority.toUpperCase() : "N/A", gridCol2, gridY, 14);

  doc.y = loanDetailsY + 135;

  // Security Position
  renderSubsectionHeader(doc, "SECURITY POSITION");

  const totalSecurity = calculateTotalSecurity(prospect);
  const securityTypes = getSecurityTypes(prospect);

  const securityY = doc.y;
  doc.rect(MARGIN, securityY, CONTENT_WIDTH, 70).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  renderLabelValue(doc, "Total Security", formatCurrency(totalSecurity * 100), MARGIN + 20, securityY + 15, 18, COLORS.success);

  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Security Types", MARGIN + 20, securityY + 50);
  doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
  doc.text(securityTypes.join(", ") || "None", MARGIN + 20, securityY + 63, { width: CONTENT_WIDTH - 40 });

  doc.y = securityY + 85;

  // Assessment Status
  if (dueDiligence?.data) {
    renderSubsectionHeader(doc, "ASSESSMENT STATUS");
    
    const ddData = dueDiligence.data as any;
    const checklist = ddData.checklist;
    
    if (checklist) {
      const totalItems = checklist.length || 0;
      const completedItems = checklist.filter((item: any) => item.checked).length || 0;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const statusY = doc.y;
      doc.rect(MARGIN, statusY, CONTENT_WIDTH, 60).fillAndStroke(COLORS.backgroundLight, COLORS.border);

      renderLabelValue(doc, "Progress", `${progress}%`, MARGIN + 20, statusY + 15, 16, progress >= 80 ? COLORS.success : progress >= 50 ? COLORS.warning : COLORS.danger);

      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(`${completedItems} of ${totalItems} items completed`, MARGIN + 20, statusY + 45);

      doc.y = statusY + 70;
    }
  }
}

// ============================================================================
// Helper function for label/value pairs
// ============================================================================

function renderLabelValue(
  doc: typeof PDFDocument.prototype,
  label: string,
  value: string,
  x: number,
  y: number,
  valueFontSize: number = 14,
  valueColor: string = COLORS.text
): void {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text(label, x, y);
  doc.fontSize(valueFontSize).fillColor(valueColor).font("Helvetica-Bold");
  doc.text(value, x, y + 15);
}

// ============================================================================
// Key-Value Table
// ============================================================================

function renderKeyValueTable(
  doc: typeof PDFDocument.prototype,
  data: [string, string][],
  startY?: number
): number {
  let y = startY || doc.y;

  // Ensure space
  const tableHeight = data.length * 25 + 10;
  addPageIfNeeded(doc, tableHeight);

  data.forEach(([key, value]) => {
    doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica-Bold");
    doc.text(key, MARGIN, y, { width: 150 });
    
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
    doc.text(value, MARGIN + 160, y, { width: CONTENT_WIDTH - 160 });
    
    y += 25;
  });

  doc.y = y + 10;
  return doc.y;
}

// ============================================================================
// Company Information Section
// ============================================================================

function renderCompanyInfoConsolidated(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  companiesHouseData?: CompaniesHouseData | null,
  contacts?: Contact[]
): void {
  renderSectionHeader(doc, "COMPANY INFORMATION", "02");

  // Company Header
  doc.fontSize(16).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(prospect.company.companyName.toUpperCase(), MARGIN, doc.y);
  doc.y += 20;

  // Basic Details
  const basicData: [string, string][] = [];
  
  if (prospect.company.companyNumber) {
    basicData.push(["Company Number:", prospect.company.companyNumber]);
  }
  if (prospect.company.status) {
    basicData.push(["Status:", prospect.company.status]);
  }
  if (prospect.company.companyType) {
    basicData.push(["Type:", prospect.company.companyType]);
  }
  if (prospect.company.incorporationDate) {
    basicData.push(["Incorporated:", prospect.company.incorporationDate]);
  }

  if (basicData.length > 0) {
    renderKeyValueTable(doc, basicData);
  }

  doc.y += SPACING.sectionMargin;

  // Officers
  if (companiesHouseData?.officers?.items?.length > 0) {
    renderSubsectionHeader(doc, "Officers");
    
    const activeOfficers = companiesHouseData.officers.items.filter((o: any) => !o.resigned_on);
    
    activeOfficers.forEach((officer: any) => {
      // Check if we need space for officer entry
      addPageIfNeeded(doc, 40);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(officer.name || "N/A", MARGIN + 10, doc.y);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(officer.officer_role || "N/A", MARGIN + 10, doc.y + 13);
      
      if (officer.appointed_on) {
        doc.text(`Appointed: ${officer.appointed_on}`, MARGIN + 10, doc.y + 26);
      }
      
      doc.y += 45;
    });

    doc.y += SPACING.sectionMargin;
  }

  // Key Contacts
  if (contacts && contacts.length > 0) {
    renderSubsectionHeader(doc, "Key Contacts");
    
    contacts.slice(0, 5).forEach((contact) => {
      addPageIfNeeded(doc, 35);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(contact.name, MARGIN + 10, doc.y);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      const details = [contact.role, contact.email, contact.phone].filter(Boolean).join(" | ");
      doc.text(details, MARGIN + 10, doc.y + 13, { width: CONTENT_WIDTH - 20 });
      
      doc.y += 35;
    });

    if (contacts.length > 5) {
      doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
      doc.text(`...and ${contacts.length - 5} more contacts`, MARGIN + 10, doc.y);
      doc.y += 20;
    }

    doc.y += SPACING.sectionMargin;
  }

  // Persons of Significant Control
  if (companiesHouseData?.psc?.items?.length > 0) {
    renderSubsectionHeader(doc, "Persons of Significant Control");
    
    companiesHouseData.psc.items.forEach((psc: any) => {
      addPageIfNeeded(doc, 40);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(psc.name || "N/A", MARGIN + 10, doc.y);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      
      if (psc.natures_of_control && psc.natures_of_control.length > 0) {
        doc.text(psc.natures_of_control.join(", "), MARGIN + 10, doc.y + 13, {
          width: CONTENT_WIDTH - 20,
        });
      }
      
      doc.y += 40;
    });
  }
}

// ============================================================================
// Loan Details with Due Diligence
// ============================================================================

function renderLoanDetailsWithDueDiligence(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany,
  dueDiligence?: DueDiligence
): void {
  renderSectionHeader(doc, "LOAN DETAILS", "03");

  // Loan metrics
  const metricsY = doc.y;
  doc.rect(MARGIN, metricsY, CONTENT_WIDTH, 110).fillAndStroke(COLORS.backgroundLight, COLORS.border);

  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 3;
  const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
  let rowY = metricsY + 15;

  // Amount
  renderLabelValue(doc, "Loan Amount", prospect.loanAmount ? formatCurrency(prospect.loanAmount * 100) : "N/A", col1X, rowY, 16, COLORS.primary);

  // Term
  renderLabelValue(doc, "Term", prospect.term ? `${prospect.term} months` : "N/A", col2X, rowY, 16);

  // Rate
  renderLabelValue(doc, "Interest Rate", prospect.interestRate ? `${prospect.interestRate}%` : "N/A", col3X, rowY, 16);

  doc.y = metricsY + 125;

  // Purpose of Loan
  if (prospect.loanPurpose) {
    renderSubsectionHeader(doc, "Purpose of Loan");
    
    // Split into paragraphs and render
    const purposeParagraphs = prospect.loanPurpose.split('\n').filter(p => p.trim());
    renderParagraphs(doc, purposeParagraphs);
    
    doc.y += SPACING.sectionMargin;
  }

  // Due Diligence Overview
  if (dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    const checklist = ddData.checklist;

    if (checklist && Array.isArray(checklist)) {
      renderSubsectionHeader(doc, "Due Diligence Overview");

      const totalItems = checklist.length;
      const completedItems = checklist.filter((item: any) => item.checked).length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
      doc.text(`Checklist Progress: ${completedItems}/${totalItems} items completed`, MARGIN, doc.y);
      doc.y += 25;

      // Progress bar
      const barY = doc.y;
      const barWidth = CONTENT_WIDTH - 100;
      const barHeight = 20;

      // Background
      doc.rect(MARGIN, barY, barWidth, barHeight).fillAndStroke(COLORS.borderLight, COLORS.border);

      // Progress fill
      const progressWidth = (barWidth * progress) / 100;
      const progressColor = progress >= 80 ? COLORS.success : progress >= 50 ? COLORS.warning : COLORS.danger;
      doc.rect(MARGIN, barY, progressWidth, barHeight).fill(progressColor);

      // Percentage text
      doc.fontSize(12).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text(`${progress}%`, MARGIN + barWidth + 10, barY + 3);

      doc.y = barY + 35;
    }
  }
}

// ============================================================================
// Security, Collateral & Notes
// ============================================================================

function renderSecurityCollateralNotes(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany
): void {
  renderSectionHeader(doc, "SECURITY & COLLATERAL", "04");

  // Security Types
  const securityItems = [];

  if (prospect.directorsGuarantee && prospect.directorsGuarantee > 0) {
    securityItems.push([
      "Directors Guarantee",
      formatCurrency(prospect.directorsGuarantee * 100),
    ]);
  }

  if (prospect.debenture && prospect.debenture > 0) {
    securityItems.push(["Debenture", formatCurrency(prospect.debenture * 100)]);
  }

  if (prospect.commercialProperty && prospect.commercialProperty > 0) {
    securityItems.push([
      "Commercial Property",
      formatCurrency(prospect.commercialProperty * 100),
    ]);
  }

  if (prospect.homeEquity && prospect.homeEquity > 0) {
    securityItems.push(["Home Equity", formatCurrency(prospect.homeEquity * 100)]);
  }

  if (prospect.propertyOther && prospect.propertyOther > 0) {
    securityItems.push(["Other Property", formatCurrency(prospect.propertyOther * 100)]);
  }

  if (prospect.parentCompanyGuarantee && prospect.parentCompanyGuarantee > 0) {
    securityItems.push([
      "Parent Company Guarantee",
      formatCurrency(prospect.parentCompanyGuarantee * 100),
    ]);
  }

  if (prospect.crossCompanyGuarantee && prospect.crossCompanyGuarantee > 0) {
    securityItems.push([
      "Cross Company Guarantee",
      formatCurrency(prospect.crossCompanyGuarantee * 100),
    ]);
  }

  if (prospect.collateral && prospect.collateral > 0) {
    securityItems.push(["Other Collateral", formatCurrency(prospect.collateral * 100)]);
  }

  if (securityItems.length > 0) {
    renderSubsectionHeader(doc, "Security Types");

    securityItems.forEach(([type, amount]) => {
      addPageIfNeeded(doc, 25);

      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
      doc.text(type, MARGIN + 10, doc.y, { width: 250 });
      
      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text(amount, MARGIN + 280, doc.y, { width: 150, align: "right" });
      
      doc.y += 25;
    });

    // Total
    const totalSecurity = calculateTotalSecurity(prospect);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).stroke(COLORS.border);
    doc.y += 10;

    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text("Total Security:", MARGIN + 10, doc.y, { width: 250 });
    
    doc.fontSize(14).fillColor(COLORS.success).font("Helvetica-Bold");
    doc.text(formatCurrency(totalSecurity * 100), MARGIN + 280, doc.y, {
      width: 150,
      align: "right",
    });

    doc.y += 35;
  }

  // Notes
  const hasNotes = prospect.loanRequirementNotes || prospect.notes;

  if (hasNotes) {
    renderSubsectionHeader(doc, "Notes");

    if (prospect.loanRequirementNotes) {
      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("Loan Requirements:", MARGIN, doc.y);
      doc.y += 15;

      const requirementParagraphs = prospect.loanRequirementNotes.split('\n').filter(p => p.trim());
      renderParagraphs(doc, requirementParagraphs, doc.y, { fontSize: 9 });
      
      doc.y += SPACING.paragraphSpacing;
    }

    if (prospect.notes) {
      doc.fontSize(10).fillColor(COLORS.secondary).font("Helvetica-Bold");
      doc.text("General Notes:", MARGIN, doc.y);
      doc.y += 15;

      const noteParagraphs = prospect.notes.split('\n').filter(p => p.trim());
      renderParagraphs(doc, noteParagraphs, doc.y, { fontSize: 9 });
    }
  }

  if (!securityItems.length && !hasNotes) {
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
    doc.text("Working Capital", MARGIN, doc.y);
  }
}

// ============================================================================
// CAMPARI Analysis - IMPROVED VERSION
// ============================================================================

function renderCampariSection(
  doc: typeof PDFDocument.prototype,
  adviserSummary: any
): void {
  renderSectionHeader(doc, "CAMPARI ANALYSIS", "06");

  // Business name and product
  if (adviserSummary.businessName) {
    renderSubsectionHeader(doc, "BUSINESS NAME");
    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(adviserSummary.businessName, MARGIN, doc.y);
    doc.y += 25;
  }

  if (adviserSummary.product) {
    renderSubsectionHeader(doc, "PRODUCT");
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(adviserSummary.product, MARGIN, doc.y);
    doc.y += 25;
  }

  if (adviserSummary.amount) {
    renderSubsectionHeader(doc, "AMOUNT");
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold");
    doc.text(adviserSummary.amount, MARGIN, doc.y);
    doc.y += 30;
  }

  // CAMPARI sections
  const campariSections = [
    { key: "character", title: "CHARACTER - Management & Background" },
    { key: "ability", title: "ABILITY - Capacity to Repay" },
    { key: "purpose", title: "PURPOSE - Loan Purpose & Rationale" },
    { key: "amount", title: "AMOUNT - Funding Requirement" },
    { key: "repayment", title: "REPAYMENT - Source & Terms" },
    { key: "insurance", title: "INSURANCE - Security & Risk Mitigation" },
  ];

  campariSections.forEach((section) => {
    const content = adviserSummary[section.key];
    
    if (content && content.trim()) {
      // Add page if section header won't fit
      addPageIfNeeded(doc, 50);

      renderSubsectionHeader(doc, section.title);

      // Split content into paragraphs
      const paragraphs = content
        .split('\n\n')
        .filter((p: string) => p.trim())
        .map((p: string) => p.trim());

      // Render paragraphs with smart wrapping
      renderParagraphs(doc, paragraphs, doc.y, {
        fontSize: 10,
        color: COLORS.text,
      });

      doc.y += SPACING.sectionMargin;
    }
  });
}

// ============================================================================
// SWOT Analysis - IMPROVED VERSION
// ============================================================================

function renderSwotSection(
  doc: typeof PDFDocument.prototype,
  swotAnalysis: any
): void {
  renderSectionHeader(doc, "SWOT ANALYSIS", "07");

  const swotCategories = [
    {
      key: "strengths",
      title: "STRENGTHS",
      bgColor: COLORS.swotStrengthsBg,
      borderColor: COLORS.swotStrengthsBorder,
    },
    {
      key: "weaknesses",
      title: "WEAKNESSES",
      bgColor: COLORS.swotWeaknessesBg,
      borderColor: COLORS.swotWeaknessesBorder,
    },
    {
      key: "opportunities",
      title: "OPPORTUNITIES",
      bgColor: COLORS.swotOpportunitiesBg,
      borderColor: COLORS.swotOpportunitiesBorder,
    },
    {
      key: "threats",
      title: "THREATS",
      bgColor: COLORS.swotThreatsBg,
      borderColor: COLORS.swotThreatsBorder,
    },
  ];

  swotCategories.forEach((category) => {
    const items = swotAnalysis[category.key];
    
    if (items && Array.isArray(items) && items.length > 0) {
      // Check if we have space for category header and at least first item
      addPageIfNeeded(doc, 80);

      // Category header box
      const headerY = doc.y;
      doc
        .rect(MARGIN, headerY, CONTENT_WIDTH, 30)
        .fillAndStroke(category.bgColor, category.borderColor);

      doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
      doc.text(category.title, MARGIN + 10, headerY + 10);

      doc.y = headerY + 40;

      // Render bullet points
      renderBulletPoints(doc, items, doc.y, {
        fontSize: 10,
        color: COLORS.text,
        bulletChar: "•",
        indent: 15,
      });

      doc.y += SPACING.sectionMargin;
    }
  });

  // SWOT Summary
  if (swotAnalysis.summary && swotAnalysis.summary.trim()) {
    addPageIfNeeded(doc, 80);

    renderSubsectionHeader(doc, "SWOT SUMMARY");

    const summaryParagraphs = swotAnalysis.summary
      .split('\n\n')
      .filter((p: string) => p.trim())
      .map((p: string) => p.trim());

    renderParagraphs(doc, summaryParagraphs, doc.y, {
      fontSize: 10,
      color: COLORS.text,
    });
  }
}

// ============================================================================
// Activities
// ============================================================================

function renderActivities(doc: typeof PDFDocument.prototype, activities: Activity[]): void {
  renderSectionHeader(doc, "ACTIVITIES & TASKS", "Activities");

  if (activities.length === 0) {
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
    doc.text("No activities recorded", MARGIN, doc.y);
    return;
  }

  activities.forEach((activity, index) => {
    addPageIfNeeded(doc, 50);

    // Activity header
    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(activity.title, MARGIN + 10, doc.y, { width: CONTENT_WIDTH - 120 });

    // Type and status on right
    const typeLabel =
      activity.activityType === "task"
        ? "Task"
        : activity.activityType === "call"
        ? "Call"
        : "Meeting";
    const statusLabel = activity.completed ? "Completed" : "Pending";
    const statusColor = activity.completed ? COLORS.success : COLORS.warning;

    doc.fontSize(9).fillColor(statusColor).font("Helvetica");
    doc.text(`${typeLabel} | ${statusLabel}`, MARGIN + CONTENT_WIDTH - 100, doc.y);

    doc.y += 20;

    // Description if available
    if (activity.description) {
      doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
      doc.text(activity.description, MARGIN + 10, doc.y, {
        width: CONTENT_WIDTH - 20,
      });
      doc.y += 15;
    }

    // Date
    if (activity.dueDate) {
      doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
      doc.text(`Due: ${new Date(activity.dueDate).toLocaleDateString()}`, MARGIN + 10, doc.y);
      doc.y += 15;
    }

    // Separator
    if (index < activities.length - 1) {
      doc
        .moveTo(MARGIN + 10, doc.y)
        .lineTo(MARGIN + CONTENT_WIDTH - 10, doc.y)
        .stroke(COLORS.borderLight);
      doc.y += 15;
    }
  });
}

// ============================================================================
// Due Diligence
// ============================================================================

function renderDueDiligence(doc: typeof PDFDocument.prototype, dueDiligence: DueDiligence): void {
  renderSectionHeader(doc, "DUE DILIGENCE ANALYSIS", "05");

  const ddData = dueDiligence.data as any;

  // Checklist
  if (ddData.checklist && Array.isArray(ddData.checklist)) {
    renderSubsectionHeader(doc, "DUE DILIGENCE CHECKLIST");

    const total = ddData.checklist.length;
    const completed = ddData.checklist.filter((item: any) => item.checked).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    doc.fontSize(10).fillColor(COLORS.text).font("Helvetica");
    doc.text(`${completed} of ${total} items completed`, MARGIN, doc.y);
    doc.y += 20;

    // Progress bar
    const barY = doc.y;
    const barWidth = 200;
    const barHeight = 20;

    doc.rect(MARGIN, barY, barWidth, barHeight).fillAndStroke(COLORS.borderLight, COLORS.border);

    const progressWidth = (barWidth * progress) / 100;
    const progressColor =
      progress >= 80 ? COLORS.success : progress >= 50 ? COLORS.warning : COLORS.danger;
    doc.rect(MARGIN, barY, progressWidth, barHeight).fill(progressColor);

    doc.fontSize(12).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text(`${progress}%`, MARGIN + barWidth + 15, barY + 3);

    doc.y = barY + 40;
  }

  // Financial Analysis
  const creditUnderwriting = ddData.underwriting || ddData.creditUnderwriting;
  
  if (creditUnderwriting) {
    addPageIfNeeded(doc, 100);

    renderSubsectionHeader(doc, "AI-POWERED FINANCIAL ANALYSIS");

    const bankStatementSummary = creditUnderwriting.bankStatementSummary;
    
    if (bankStatementSummary) {
      // Key metrics box
      const metricsY = doc.y;
      doc
        .rect(MARGIN, metricsY, CONTENT_WIDTH, 90)
        .fillAndStroke(COLORS.backgroundLight, COLORS.border);

      const col1 = MARGIN + 20;
      const col2 = MARGIN + CONTENT_WIDTH / 3;
      const col3 = MARGIN + (CONTENT_WIDTH / 3) * 2;

      let rowY = metricsY + 12;

      // Monthly revenue
      if (bankStatementSummary.avgMonthlyRevenue !== undefined) {
        renderLabelValue(
          doc,
          "AVG MONTHLY REVENUE",
          formatCurrency(bankStatementSummary.avgMonthlyRevenue * 100),
          col1,
          rowY,
          12
        );
      }

      // Monthly expenses
      if (bankStatementSummary.avgMonthlyExpenses !== undefined) {
        renderLabelValue(
          doc,
          "AVG MONTHLY EXPENSES",
          formatCurrency(bankStatementSummary.avgMonthlyExpenses * 100),
          col2,
          rowY,
          12
        );
      }

      // Net disposable income
      if (bankStatementSummary.netDisposableIncome !== undefined) {
        renderLabelValue(
          doc,
          "NET DISPOSABLE INCOME",
          formatCurrency(bankStatementSummary.netDisposableIncome * 100),
          col3,
          rowY,
          12
        );
      }

      rowY += 55;

      // DSCR
      if (bankStatementSummary.dscr !== undefined) {
        renderLabelValue(
          doc,
          "DSCR",
          bankStatementSummary.dscr.toFixed(2),
          col1,
          rowY,
          14,
          bankStatementSummary.dscr >= 1.25
            ? COLORS.success
            : bankStatementSummary.dscr >= 1.0
            ? COLORS.warning
            : COLORS.danger
        );
      }

      doc.y = metricsY + 105;

      // Analysis text
      if (bankStatementSummary.analysisText) {
        const analysisParagraphs = bankStatementSummary.analysisText
          .split('\n\n')
          .filter((p: string) => p.trim());

        renderParagraphs(doc, analysisParagraphs, doc.y, { fontSize: 10 });
        
        doc.y += SPACING.sectionMargin;
      }

      // P&L Summary
      if (bankStatementSummary.turnover !== undefined) {
        addPageIfNeeded(doc, 80);

        renderSubsectionHeader(doc, "Profit & Loss Summary");

        const plData: [string, string][] = [];
        
        if (bankStatementSummary.turnover !== undefined) {
          plData.push(["Turnover:", formatCurrency(bankStatementSummary.turnover * 100)]);
        }
        if (bankStatementSummary.grossProfit !== undefined) {
          plData.push(["Gross Profit:", formatCurrency(bankStatementSummary.grossProfit * 100)]);
        }
        if (bankStatementSummary.netProfit !== undefined) {
          plData.push(["Net Profit:", formatCurrency(bankStatementSummary.netProfit * 100)]);
        }
        if (bankStatementSummary.period) {
          plData.push(["Period:", bankStatementSummary.period]);
        }

        renderKeyValueTable(doc, plData);
      }
    }

    // Financial Ratios
    const financialRatios = creditUnderwriting.financialRatios;
    
    if (financialRatios && financialRatios.calculatedRatios) {
      addPageIfNeeded(doc, 100);

      renderSubsectionHeader(doc, "Calculated Financial Ratios");

      // Create ratios table
      const ratios = financialRatios.calculatedRatios;
      const years = Object.keys(ratios).filter((k) => k !== "metric" && k !== "benchmark");

      // Table header
      const tableStartY = doc.y;
      const colWidth = (CONTENT_WIDTH - 150) / years.length;
      let tableY = tableStartY;

      // Header row
      doc.fontSize(9).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.rect(MARGIN, tableY, 150, 25).fill(COLORS.primary);
      doc.text("Metric", MARGIN + 5, tableY + 8);

      years.forEach((year, index) => {
        const x = MARGIN + 150 + index * colWidth;
        doc.rect(x, tableY, colWidth, 25).fill(COLORS.primary);
        doc.text(year, x + 5, tableY + 8);
      });

      tableY += 25;

      // Data rows
      const metrics = [
        { key: "currentRatio", label: "Current Ratio" },
        { key: "quickRatio", label: "Quick Ratio" },
        { key: "debtToEquity", label: "Debt to Equity" },
        { key: "grossProfitPercent", label: "Gross Profit %" },
        { key: "netProfitPercent", label: "Net Profit %" },
        { key: "interestCover", label: "Interest Cover" },
        { key: "roce", label: "ROCE" },
        { key: "debtorDays", label: "Debtor Days" },
        { key: "creditorDays", label: "Creditor Days" },
      ];

      metrics.forEach((metric, rowIndex) => {
        const bgColor = rowIndex % 2 === 0 ? COLORS.white : COLORS.backgroundMuted;

        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica");
        doc.rect(MARGIN, tableY, 150, 20).fill(bgColor);
        doc.fillColor(COLORS.text).text(metric.label, MARGIN + 5, tableY + 6);

        years.forEach((year, colIndex) => {
          const x = MARGIN + 150 + colIndex * colWidth;
          doc.rect(x, tableY, colWidth, 20).fill(bgColor);

          const value = ratios[year]?.[metric.key];
          const displayValue = value !== undefined && value !== null ? value.toString() : "N/A";

          doc.fillColor(COLORS.text).text(displayValue, x + 5, tableY + 6, {
            width: colWidth - 10,
            align: "right",
          });
        });

        tableY += 20;
      });

      doc.y = tableY + 20;
    }
  }
}

// ============================================================================
// Charges
// ============================================================================

function renderCharges(doc: typeof PDFDocument.prototype, charges: any): void {
  renderSectionHeader(doc, "CHARGES", "Charges");

  if (!charges.items || charges.items.length === 0) {
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
    doc.text("No outstanding charges", MARGIN, doc.y);
    return;
  }

  charges.items.forEach((charge: any, index: number) => {
    addPageIfNeeded(doc, 80);

    // Charge header
    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(`Charge ${index + 1}`, MARGIN, doc.y);
    doc.y += 20;

    // Charge details
    const chargeData: [string, string][] = [];

    if (charge.charge_code) {
      chargeData.push(["Charge Code:", charge.charge_code]);
    }
    if (charge.status) {
      chargeData.push(["Status:", charge.status]);
    }
    if (charge.created_on) {
      chargeData.push(["Created:", charge.created_on]);
    }
    if (charge.delivered_on) {
      chargeData.push(["Delivered:", charge.delivered_on]);
    }
    if (charge.persons_entitled && charge.persons_entitled.length > 0) {
      chargeData.push([
        "Persons Entitled:",
        charge.persons_entitled.map((p: any) => p.name).join(", "),
      ]);
    }

    renderKeyValueTable(doc, chargeData);

    if (index < charges.items.length - 1) {
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
        .stroke(COLORS.borderLight);
      doc.y += 15;
    }
  });
}

// ============================================================================
// Saved Associations
// ============================================================================

function renderSavedAssociations(doc: typeof PDFDocument.prototype, associations: any[]): void {
  renderSectionHeader(doc, "SAVED ASSOCIATED COMPANIES", "Associations");

  if (associations.length === 0) {
    doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
    doc.text("No saved associations", MARGIN, doc.y);
    return;
  }

  associations.forEach((assoc, index) => {
    addPageIfNeeded(doc, 60);

    doc.fontSize(11).fillColor(COLORS.text).font("Helvetica-Bold");
    doc.text(assoc.companyName || "Unnamed Company", MARGIN + 10, doc.y);
    doc.y += 18;

    const assocData: [string, string][] = [];

    if (assoc.companyNumber) {
      assocData.push(["Company Number:", assoc.companyNumber]);
    }
    if (assoc.status) {
      assocData.push(["Status:", assoc.status]);
    }
    if (assoc.relationshipType) {
      assocData.push(["Relationship:", assoc.relationshipType]);
    }

    renderKeyValueTable(doc, assocData);

    if (index < associations.length - 1) {
      doc
        .moveTo(MARGIN + 10, doc.y)
        .lineTo(MARGIN + CONTENT_WIDTH - 10, doc.y)
        .stroke(COLORS.borderLight);
      doc.y += 15;
    }
  });
}

// ============================================================================
// Adviser Recommendation (Final Page)
// ============================================================================

function renderAdviserRecommendation(
  doc: typeof PDFDocument.prototype,
  prospect: ProspectWithCompany
): void {
  renderSectionHeader(doc, "ADVISER RECOMMENDATION", "08");

  // Recommendation text area
  renderSubsectionHeader(doc, "Recommendation");

  doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica-Oblique");
  doc.text("No recommendation provided.", MARGIN, doc.y);
  doc.y += 60;

  // Signature section
  renderSubsectionHeader(doc, "Signature");

  const signatureY = doc.y;
  const fieldWidth = (CONTENT_WIDTH - 40) / 2;

  // Signature line
  doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica");
  doc.text("Signature:", MARGIN, signatureY);
  doc.moveTo(MARGIN, signatureY + 40).lineTo(MARGIN + fieldWidth, signatureY + 40).stroke(COLORS.border);
  doc.text("_________________________________", MARGIN, signatureY + 30);

  // Name line
  doc.text("Name:", MARGIN, signatureY + 60);
  doc.moveTo(MARGIN, signatureY + 100).lineTo(MARGIN + fieldWidth, signatureY + 100).stroke(COLORS.border);
  doc.text("_________________________________", MARGIN, signatureY + 90);

  // Date line
  doc.text("Date:", MARGIN, signatureY + 120);
  doc.moveTo(MARGIN, signatureY + 160).lineTo(MARGIN + fieldWidth, signatureY + 160).stroke(COLORS.border);
  doc.text("_________________________________", MARGIN, signatureY + 150);

  // Disclaimer at bottom
  doc.fontSize(8).fillColor(COLORS.textLight).font("Helvetica");
  doc.text(
    "This report is confidential and intended for internal use only. The information contained herein has been prepared based on data provided and should be verified independently.",
    MARGIN,
    PAGE_HEIGHT - 80,
    {
      width: CONTENT_WIDTH,
      align: "center",
      lineGap: 3,
    }
  );
}

// ============================================================================
// Helper functions
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

// ============================================================================
// Main export function
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
  doc.addPage();
  pageNumber++;
  renderExecutiveSummary(doc, prospect, dueDiligence, companiesHouseData);

  // Content sections
  const sections = pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;
  const isSectionEnabled = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    return section?.enabled !== false;
  };

  // Company Information
  if (isSectionEnabled("companyInfo")) {
    doc.addPage();
    pageNumber++;
    renderCompanyInfoConsolidated(doc, prospect, companiesHouseData, contacts);
  }

  // Loan Details
  if (isSectionEnabled("loanDetails")) {
    doc.addPage();
    pageNumber++;
    renderLoanDetailsWithDueDiligence(doc, prospect, dueDiligence);
  }

  // Security & Collateral
  const hasCollateral = checkHasCollateral(prospect);
  const hasNotes = !!(prospect.loanRequirementNotes || prospect.notes);
  if ((isSectionEnabled("security") || isSectionEnabled("notes")) && (hasCollateral || hasNotes)) {
    doc.addPage();
    pageNumber++;
    renderSecurityCollateralNotes(doc, prospect);
  }

  // Charges
  if (isSectionEnabled("charges") && companiesHouseData?.charges?.items?.length > 0) {
    doc.addPage();
    pageNumber++;
    renderCharges(doc, companiesHouseData!.charges);
  }

  // Saved Associations
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

  // Activities
  if (isSectionEnabled("activities") && activities.length > 0) {
    doc.addPage();
    pageNumber++;
    renderActivities(doc, activities);
  }

  // Due Diligence Tools
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

  // CAMPARI Analysis
  if (isSectionEnabled("campari") && dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    const adviserSummary =
      ddData.underwriting?.adviserSummary || ddData.creditUnderwriting?.adviserSummary;
    if (adviserSummary) {
      doc.addPage();
      pageNumber++;
      renderCampariSection(doc, adviserSummary);
    }
  }

  // SWOT Analysis
  if (isSectionEnabled("swotAnalysis") && dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    const swotAnalysis = ddData.underwriting?.swotAnalysis || ddData.creditUnderwriting?.swotAnalysis;
    if (swotAnalysis) {
      doc.addPage();
      pageNumber++;
      renderSwotSection(doc, swotAnalysis);
    }
  }

  // Adviser Recommendation (always last page)
  doc.addPage();
  pageNumber++;
  renderAdviserRecommendation(doc, prospect);

  // Add page numbers to all pages except cover
  const totalPages = doc.bufferedPageRange();
  for (let i = 1; i < totalPages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(9).fillColor(COLORS.textLight).font("Helvetica");
    doc.text(
      `FlowLoan • Commercial Lending Solutions`,
      MARGIN,
      PAGE_HEIGHT - 40,
      { continued: true }
    );
    doc.text("CONFIDENTIAL", { align: "center", continued: true });
    doc.text(`Page ${i} of ${totalPages.count - 1}`, { align: "right" });
  }

  return doc;
}
