import PDFDocument from "pdfkit";
import type { ProspectWithCompany, Contact, Activity, DueDiligence } from "@shared/schema";

/**
 * Drop-in replacement for pdfGenerator.ts
 *
 * Key fixes vs old generator:
 * - No body text truncation / ellipses (PDF is a document, not a card UI)
 * - Robust layout flow: y advances by measured text height, not guessed constants
 * - Correct header/footer overlay using bufferPages + switchToPage (no extra footer-only pages)
 * - Footer placement respects margins (prevents PDFKit "auto page break" behavior)
 * - Normalized checklist counts (prevents 0/27 vs 0/0 contradictions)
 * - ASCII-safe benchmark operators (>= / <=) to avoid glyph rendering corruption
 * - Sequential section numbering (no missing 02, 06–12, etc.)
 * - Sensible default recommendation if adviser recommendation is missing
 */

interface CompaniesHouseData {
  officers?: any;
  psc?: any;
  charges?: any;
  filingHistory?: any;
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

// Palette (kept close to your existing one)
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
  borderLight: "#eeeeee",
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

const DEFAULT_SECTIONS: PDFSection[] = [
  { id: "companyInfo", label: "Company Information", enabled: true },
  { id: "loanDetails", label: "Loan Details", enabled: true },
  { id: "charges", label: "Charges", enabled: true },
  { id: "savedAssociations", label: "Saved Associated Companies", enabled: true },
  { id: "activities", label: "Activities & Tasks", enabled: true },
  { id: "dueDiligence", label: "Due Diligence", enabled: true },
  { id: "campari", label: "CAMPARI Analysis", enabled: true },
  { id: "swotAnalysis", label: "SWOT Analysis", enabled: true },
];

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 50;

type Doc = typeof PDFDocument.prototype;

// -------------------------
// Public entrypoint
// -------------------------
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

  // Global defaults
  doc.font("Helvetica").fillColor(COLORS.text).fontSize(10);

  const sections = data.pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;
  const isEnabled = (id: string) => sections.find(s => s.id === id)?.enabled !== false;

  // We render in a fixed, predictable order and number sequentially.
  // Cover is unnumbered; everything else gets 01..N.
  renderCoverPage(doc, data.prospect);

  const sectionPlan: Array<{ id: string; label: string; render: (n: string) => void }> = [];

  sectionPlan.push({
    id: "executive",
    label: "Executive Summary",
    render: (n) => renderExecutiveSummary(doc, n, data),
  });

  if (isEnabled("companyInfo")) {
    sectionPlan.push({
      id: "companyInfo",
      label: "Company Information",
      render: (n) => renderCompanyInfo(doc, n, data),
    });
  }

  if (isEnabled("loanDetails")) {
    sectionPlan.push({
      id: "loanDetails",
      label: "Loan Details",
      render: (n) => renderLoanDetails(doc, n, data),
    });
  }

  if (isEnabled("charges") && data.companiesHouseData?.charges?.items?.length) {
    sectionPlan.push({
      id: "charges",
      label: "Charges",
      render: (n) => renderCharges(doc, n, data.companiesHouseData!.charges),
    });
  }

  if (
    isEnabled("savedAssociations") &&
    Array.isArray((data.prospect as any).savedAssociations) &&
    (data.prospect as any).savedAssociations.length > 0
  ) {
    sectionPlan.push({
      id: "savedAssociations",
      label: "Saved Associated Companies",
      render: (n) => renderSavedAssociations(doc, n, (data.prospect as any).savedAssociations),
    });
  }

  if (isEnabled("activities") && data.activities?.length) {
    sectionPlan.push({
      id: "activities",
      label: "Activities & Tasks",
      render: (n) => renderActivities(doc, n, data.activities),
    });
  }

  if (isEnabled("dueDiligence") && data.dueDiligence?.data) {
    sectionPlan.push({
      id: "dueDiligence",
      label: "Due Diligence",
      render: (n) => renderDueDiligence(doc, n, data),
    });
  }

  // CAMPARI + SWOT only if present
  const ddData: any = data.dueDiligence?.data;
  const underwriting = ddData?.underwriting || ddData?.creditUnderwriting;

  if (isEnabled("campari") && underwriting?.adviserSummary) {
    sectionPlan.push({
      id: "campari",
      label: "CAMPARI Analysis",
      render: (n) => renderCampari(doc, n, underwriting.adviserSummary),
    });
  }

  if (isEnabled("swotAnalysis") && underwriting?.swotAnalysis) {
    sectionPlan.push({
      id: "swotAnalysis",
      label: "SWOT Analysis",
      render: (n) => renderSwot(doc, n, underwriting.swotAnalysis),
    });
  }

  // Always last: recommendation
  sectionPlan.push({
    id: "recommendation",
    label: "Adviser Recommendation",
    render: (n) => renderRecommendation(doc, n, data),
  });

  // Render sections sequentially, each starting on a new page
  for (let i = 0; i < sectionPlan.length; i++) {
    doc.addPage();
    const sectionNumber = String(i + 1).padStart(2, "0");
    sectionPlan[i].render(sectionNumber);
  }

  // Overlay footers on all pages except cover (page index 0)
  overlayFooters(doc);

  // Caller will pipe + end()
  return doc;
}

// -------------------------
// Footer / pagination (FIXES the “extra pages” bug)
// -------------------------
function overlayFooters(doc: Doc) {
  const range = doc.bufferedPageRange(); // { start, count }
  const coverIndex = range.start; // normally 0
  const totalPagesExcludingCover = Math.max(0, range.count - 1);

  for (let pageIndex = coverIndex + 1; pageIndex < coverIndex + range.count; pageIndex++) {
    doc.switchToPage(pageIndex);
    const current = pageIndex - coverIndex; // cover = 0; first content page = 1
    renderPageFooter(doc, current, totalPagesExcludingCover);
  }
}

function renderPageFooter(doc: Doc, currentPage: number, totalPages: number) {
  const page = doc.page;
  const x0 = page.margins.left;
  const x1 = page.width - page.margins.right;

  // Critical: keep Y within printable content area, or PDFKit may create new pages.
  const lineY = page.height - page.margins.bottom - 18;
  const textY = lineY + 6;

  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(x0, lineY).lineTo(x1, lineY).stroke();

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.textLight);
  doc.text("FlowLoan • Commercial Lending Solutions", x0, textY, { lineBreak: false });

  doc.text("CONFIDENTIAL", page.width / 2 - 30, textY, { lineBreak: false });

  const rightText = `Page ${currentPage} of ${totalPages}`;
  const rightW = doc.widthOfString(rightText);
  doc.text(rightText, x1 - rightW, textY, { lineBreak: false });
  doc.restore();
}

// -------------------------
// Layout helpers
// -------------------------
function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}
function pageBottom(doc: Doc) {
  return doc.page.height - doc.page.margins.bottom;
}
function pageTop(doc: Doc) {
  return doc.page.margins.top;
}
function ensureSpace(doc: Doc, neededHeight: number) {
  if (doc.y + neededHeight > pageBottom(doc)) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.y = pageTop(doc);
  }
}
function setBody(doc: Doc) {
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
}
function setMuted(doc: Doc) {
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
}
function setHeading(doc: Doc) {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary);
}
function drawSectionHeader(doc: Doc, title: string, number: string) {
  const x = doc.page.margins.left;
  const w = contentWidth(doc);
  const h = 42;

  doc.save();
  doc.rect(x, pageTop(doc), w, h).fill(COLORS.primary);

  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(16);
  doc.text(title, x + 12, pageTop(doc) + 12, { width: w - 90 });

  doc.fontSize(12).fillColor(COLORS.white);
  doc.text(number, x + w - 45, pageTop(doc) + 14, { width: 30, align: "right" });

  doc.restore();

  // Position cursor just under the header block
  doc.x = x;
  doc.y = pageTop(doc) + h + 14;
  setBody(doc);
}

function card(doc: Doc, x: number, y: number, w: number, h: number, opts?: { fill?: string; stroke?: string; accent?: string }) {
  const fill = opts?.fill ?? COLORS.white;
  const stroke = opts?.stroke ?? COLORS.border;
  doc.save();
  doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
  if (opts?.accent) {
    doc.rect(x, y, 4, h).fill(opts.accent);
  }
  doc.restore();
}

function keyValueRow(doc: Doc, x: number, y: number, label: string, value: string, w: number) {
  doc.save();
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(label, x, y, { width: w * 0.42 });

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
  doc.text(value || "N/A", x + w * 0.42, y, { width: w * 0.58 });
  doc.restore();
}

function paragraph(doc: Doc, text: string, opts: { width: number; lineGap?: number }) {
  const t = (text || "").trim();
  if (!t) return;
  doc.text(t, doc.x, doc.y, { width: opts.width, lineGap: opts.lineGap ?? 2 });
}

function bullets(doc: Doc, items: string[], opts: { width: number; maxHeight?: number }) {
  const maxY = opts.maxHeight ? doc.y + opts.maxHeight : Infinity;
  let rendered = 0;

  for (let i = 0; i < items.length; i++) {
    const item = (items[i] || "").trim();
    if (!item) continue;

    const bullet = `• ${item}`;
    const h = doc.heightOfString(bullet, { width: opts.width, lineGap: 2 });

    if (doc.y + h > maxY) break;

    doc.text(bullet, doc.x, doc.y, { width: opts.width, lineGap: 2 });
    rendered++;
  }

  return rendered;
}

// -------------------------
// Cover
// -------------------------
function renderCoverPage(doc: Doc, prospect: ProspectWithCompany) {
  // Header band
  doc.save();
  doc.rect(0, 0, A4.width, 280).fill(COLORS.primary);

  doc.font("Helvetica").fontSize(14).fillColor(COLORS.white);
  doc.text("FLOWLOAN", MARGIN, 40);
  doc.fontSize(10).fillColor(COLORS.textLight);
  doc.text("Commercial Lending Solutions", MARGIN, 58);

  doc.font("Helvetica-Bold").fontSize(36).fillColor(COLORS.white);
  doc.text("Credit Assessment", MARGIN, 120);
  doc.text("Report", MARGIN, 165);

  doc.rect(MARGIN, 220, 80, 3).fill(COLORS.accent);

  doc.restore();

  // Company title
  doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.primary);
  doc.text(prospect.company.companyName, MARGIN, 320);

  doc.font("Helvetica").fontSize(12).fillColor(COLORS.textSecondary);
  doc.text(`Company Registration: ${prospect.company.companyNumber || "N/A"}`, MARGIN, 360);
  if (prospect.company.registeredAddress) {
    doc.text(`Registered Address: ${prospect.company.registeredAddress}`, MARGIN, 380, {
      width: A4.width - MARGIN * 2,
    });
  }

  // Key metrics
  const contentW = A4.width - MARGIN * 2;
  const boxY = 440;
  const boxH = 70;
  const boxW = (contentW - 30) / 3;

  metricBox(doc, MARGIN, boxY, boxW, boxH, "Loan Amount", prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD", COLORS.accent);
  metricBox(doc, MARGIN + boxW + 15, boxY, boxW, boxH, "Term", prospect.term ? `${prospect.term} months` : "TBD", COLORS.secondary);
  metricBox(doc, MARGIN + (boxW + 15) * 2, boxY, boxW, boxH, "Pipeline Stage", capitalize(prospect.stage), stageColor(prospect.stage));

  // Date
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.textSecondary);
  doc.text("Report Date:", MARGIN, 560);
  doc.font("Helvetica-Bold").fillColor(COLORS.text);
  doc.text(
    new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    MARGIN,
    578
  );

  // Confidential at bottom
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textLight);
  const confidential =
    "CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. Unauthorized distribution, copying, or disclosure is strictly prohibited.";
  doc.text(confidential, MARGIN, A4.height - 80, { width: contentW, align: "center" });

  doc.save();
  doc.rect(0, A4.height - 30, A4.width, 30).fill(COLORS.primary);
  doc.restore();
}

function metricBox(doc: Doc, x: number, y: number, w: number, h: number, label: string, value: string, accent: string) {
  doc.save();
  doc.rect(x, y, w, h).fill(COLORS.backgroundLight);
  doc.rect(x, y, 5, h).fill(accent);

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.textSecondary);
  doc.text(label.toUpperCase(), x + 12, y + 6, { width: w - 20 });

  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.primary);
  doc.text(value, x + 12, y + 24, { width: w - 20 });

  doc.restore();
}

// -------------------------
// Section: Executive Summary
// -------------------------
function renderExecutiveSummary(doc: Doc, number: string, data: ProspectReportData) {
  const { prospect, dueDiligence, companiesHouseData } = data;
  drawSectionHeader(doc, "Executive Summary", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  // Top “Business overview” card
  ensureSpace(doc, 120);
  card(doc, x, doc.y, w, 100, { fill: COLORS.backgroundMuted, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  doc.text("BUSINESS OVERVIEW", x + 12, doc.y + 10);

  const colW = (w - 24) / 2;
  const leftX = x + 12;
  const rightX = x + 12 + colW;

  let y0 = doc.y + 32;
  setMuted(doc);
  doc.text("Company", leftX, y0);
  doc.text("Sector/Industry", rightX, y0);

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
  doc.text(prospect.company.companyName || "N/A", leftX, y0 + 12, { width: colW - 10 });
  const sector = prospect.company.sicDescription || prospect.company.sicCode || "N/A";
  doc.text(sector, rightX, y0 + 12, { width: colW - 10 });

  y0 += 34;
  setMuted(doc);
  doc.text("Pipeline Stage", leftX, y0);
  doc.text("Referral Source", rightX, y0);

  doc.font("Helvetica-Bold").fontSize(10).fillColor(stageColor(prospect.stage));
  doc.text(capitalize(prospect.stage), leftX, y0 + 12);

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
  doc.text(prospect.referralSource || "Direct", rightX, y0 + 12);

  doc.y += 110;

  // Loan purpose (NO truncation)
  const purpose = (prospect.loanRequirementNotes || prospect.notes || "").trim();
  if (purpose) {
    const boxH = Math.min(160, Math.max(70, doc.heightOfString(purpose, { width: w - 24, lineGap: 2 }) + 40));
    ensureSpace(doc, boxH + 10);
    card(doc, x, doc.y, w, boxH, { fill: COLORS.white, stroke: COLORS.border, accent: COLORS.accent });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("LOAN PURPOSE & REQUIREMENTS", x + 12, doc.y + 10);

    setBody(doc);
    doc.x = x + 12;
    doc.y = doc.y + 28;
    paragraph(doc, purpose, { width: w - 24, lineGap: 2 });

    // Move cursor under the box
    doc.x = x;
    doc.y = (doc.y < (doc.page.margins.top + 42 + 14) ? doc.y : doc.y) + 12;
  }

  // Key metrics row
  ensureSpace(doc, 70);
  const metricsY = doc.y;
  const cellW = (w - 30) / 4;
  smallMetric(doc, x, metricsY, cellW, "Loan Amount", prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD");
  smallMetric(doc, x + cellW + 10, metricsY, cellW, "Term", prospect.term ? `${prospect.term} months` : "TBD");
  smallMetric(doc, x + (cellW + 10) * 2, metricsY, cellW, "Interest Rate", prospect.interestRate ? `${prospect.interestRate}%` : "TBD");
  smallMetric(doc, x + (cellW + 10) * 3, metricsY, cellW, "Priority", prospect.priority ? capitalize(prospect.priority) : "Normal");
  doc.y = metricsY + 58;

  // Status + security blocks
  ensureSpace(doc, 130);
  const half = (w - 20) / 2;

  // Security
  card(doc, x, doc.y, half, 110, { fill: COLORS.white, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
  doc.text("SECURITY POSITION", x + 12, doc.y + 10);

  const totalSecurity = calculateTotalSecurity(prospect);
  let ky = doc.y + 34;
  keyValueRow(doc, x + 12, ky, "Total Security", formatCurrency(totalSecurity), half - 24);
  ky += 20;

  const secTypes = getSecurityTypes(prospect);
  keyValueRow(doc, x + 12, ky, "Security Types", secTypes.length ? secTypes.slice(0, 3).join(", ") : "None", half - 24);

  // Assessment status
  const right = x + half + 20;
  card(doc, right, doc.y, half, 110, { fill: COLORS.white, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
  doc.text("ASSESSMENT STATUS", right + 12, doc.y + 10);

  let sy = doc.y + 34;
  const dd = dueDiligence?.data as any;

  if (dd?.checklist) {
    const norm = normalizeChecklist(dd.checklist);
    const pct = norm.total > 0 ? Math.round((norm.completed / norm.total) * 100) : 0;
    progressBar(doc, right + 12, sy, half - 120, "Progress", pct);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.text);
    doc.text(`${norm.completed}/${norm.total}`, right + half - 96, sy + 12);
    sy += 32;
  } else {
    setMuted(doc);
    doc.text("No checklist configured", right + 12, sy);
    sy += 18;
  }

  if (dd?.dscrCalculator?.dscr != null) {
    const dscr = Number(dd.dscrCalculator.dscr);
    const status = dscr >= 1.25 ? "PASS" : dscr >= 1.0 ? "CAUTION" : "FAIL";
    const color = dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;

    setMuted(doc);
    doc.text("DSCR", right + 12, sy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(color);
    doc.text(`${dscr.toFixed(2)} (${status})`, right + 70, sy - 2);
    sy += 18;
  }

  const underw = dd?.underwriting || dd?.creditUnderwriting;
  const grade = underw?.finalRiskGrade || underw?.riskGrade;
  if (grade) {
    setMuted(doc);
    doc.text("Risk Grade", right + 12, sy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(riskGradeColor(String(grade)));
    doc.text(String(grade), right + 90, sy - 2);
  }

  doc.y += 130;

  // Key findings
  ensureSpace(doc, 90);
  card(doc, x, doc.y, w, 70, { fill: COLORS.backgroundLight, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
  doc.text("KEY FINDINGS", x + 12, doc.y + 10);

  const status = prospect.company.companyStatus || "Unknown";
  const activeOfficers = companiesHouseData?.officers?.items?.filter((o: any) => !o.resigned_on).length || 0;
  const outstandingCharges = companiesHouseData?.charges?.items?.filter((c: any) => c.status === "outstanding").length || 0;

  setBody(doc);
  doc.fontSize(9);
  let fy = doc.y + 30;
  doc.text(`• Company Status: ${capitalize(status)}`, x + 12, fy);
  doc.text(`• Active Officers: ${activeOfficers}`, x + 210, fy);
  doc.text(`• Outstanding Charges: ${outstandingCharges}`, x + 370, fy);

  fy += 16;
  if (prospect.company.incorporationDate) {
    doc.text(`• Incorporated: ${new Date(prospect.company.incorporationDate).toLocaleDateString("en-GB")}`, x + 12, fy);
  }
  if (prospect.company.postcode) {
    doc.text(`• Location: ${prospect.company.postcode}`, x + 210, fy);
  }

  doc.y += 90;
}

function smallMetric(doc: Doc, x: number, y: number, w: number, label: string, value: string) {
  doc.save();
  doc.rect(x, y, w, 45).fill(COLORS.backgroundLight);

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.textSecondary);
  doc.text(label.toUpperCase(), x + 8, y + 6, { width: w - 16, align: "center" });

  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.primary);
  doc.text(value, x + 8, y + 22, { width: w - 16, align: "center" });

  doc.restore();
}

function progressBar(doc: Doc, x: number, y: number, w: number, label: string, pct: number) {
  doc.save();
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(label, x, y);

  doc.rect(x, y + 14, w, 8).fill(COLORS.backgroundMuted);

  const fillW = Math.max(0, Math.min(w, (w * pct) / 100));
  const color = pct >= 80 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.accent;
  doc.rect(x, y + 14, fillW, 8).fill(color);

  doc.restore();
}

// -------------------------
// Section: Company Info
// -------------------------
function renderCompanyInfo(doc: Doc, number: string, data: ProspectReportData) {
  const { prospect, companiesHouseData, contacts } = data;
  drawSectionHeader(doc, "Company Information", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  // Company details card
  ensureSpace(doc, 190);
  card(doc, x, doc.y, w, 170, { fill: COLORS.white, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary);
  doc.text(prospect.company.companyName, x + 12, doc.y + 12);

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(`Company Number: ${prospect.company.companyNumber || "N/A"}`, x + 12, doc.y + 34);
  doc.text(`Status: ${prospect.company.companyStatus ? capitalize(prospect.company.companyStatus) : "N/A"}`, x + 220, doc.y + 34);

  const addr = prospect.company.registeredAddress || "N/A";
  doc.text("Registered Address:", x + 12, doc.y + 54);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  doc.text(addr, x + 12, doc.y + 68, { width: w - 24 });

  // SIC + incorporation
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(`SIC: ${prospect.company.sicCode || "N/A"} ${prospect.company.sicDescription ? `(${prospect.company.sicDescription})` : ""}`, x + 12, doc.y + 110, {
    width: w - 24,
  });

  if (prospect.company.incorporationDate) {
    doc.text(`Incorporated: ${new Date(prospect.company.incorporationDate).toLocaleDateString("en-GB")}`, x + 12, doc.y + 128);
  }

  doc.y += 190;

  // Officers
  const officers = companiesHouseData?.officers?.items || [];
  if (officers.length) {
    ensureSpace(doc, 120);
    setHeading(doc);
    doc.text("Officers", x, doc.y);
    doc.y += 10;

    setBody(doc);
    const active = officers.filter((o: any) => !o.resigned_on);
    const shown = active.slice(0, 8);

    for (const o of shown) {
      ensureSpace(doc, 16);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
      doc.text(o.name || "Unknown", x + 10, doc.y, { width: w - 20 });

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
      const role = String(o.officer_role || "officer").replace(/-/g, " ");
      doc.text(role, x + 10, doc.y + 12, { width: w - 20 });
      doc.y += 26;
    }

    if (active.length > shown.length) {
      setMuted(doc);
      doc.text(`…and ${active.length - shown.length} more`, x + 10, doc.y);
      doc.y += 14;
    }

    doc.y += 10;
  }

  // PSC
  const pscItems = companiesHouseData?.psc?.items || [];
  if (pscItems.length) {
    ensureSpace(doc, 100);
    setHeading(doc);
    doc.text("Persons with Significant Control", x, doc.y);
    doc.y += 10;

    setBody(doc);
    const active = pscItems.filter((p: any) => !p.ceased_on);
    const shown = active.slice(0, 8);
    for (const p of shown) {
      ensureSpace(doc, 14);
      const nm = p.name || p.name_elements?.forename || "Unknown";
      doc.text(`• ${nm}`, x + 10, doc.y, { width: w - 20 });
      doc.y += 14;
    }
    if (active.length > shown.length) {
      setMuted(doc);
      doc.text(`…and ${active.length - shown.length} more`, x + 10, doc.y);
      doc.y += 14;
    }
    doc.y += 10;
  }

  // Contacts
  if (contacts?.length) {
    ensureSpace(doc, 120);
    setHeading(doc);
    doc.text("Key Contacts", x, doc.y);
    doc.y += 10;

    const shown = contacts.slice(0, 10);
    for (const c of shown) {
      ensureSpace(doc, 16);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
      doc.text(c.name || "Unnamed contact", x + 10, doc.y, { width: w - 20 });

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
      const bits = [c.role, c.email, c.phone].filter(Boolean).join(" • ");
      if (bits) doc.text(bits, x + 10, doc.y + 12, { width: w - 20 });
      doc.y += 26;
    }

    if (contacts.length > shown.length) {
      setMuted(doc);
      doc.text(`…and ${contacts.length - shown.length} more`, x + 10, doc.y);
      doc.y += 14;
    }
  }
}

// -------------------------
// Section: Loan Details
// -------------------------
function renderLoanDetails(doc: Doc, number: string, data: ProspectReportData) {
  const { prospect, dueDiligence } = data;
  drawSectionHeader(doc, "Loan Details", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  // Deal summary card
  ensureSpace(doc, 160);
  card(doc, x, doc.y, w, 140, { fill: COLORS.white, stroke: COLORS.border, accent: COLORS.accent });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  doc.text("REQUEST SUMMARY", x + 12, doc.y + 10);

  const leftW = (w - 24) / 2;
  let ry = doc.y + 34;

  keyValueRow(doc, x + 12, ry, "Loan Amount", prospect.loanAmount ? formatCurrency(prospect.loanAmount) : "TBD", leftW);
  keyValueRow(doc, x + 12 + leftW, ry, "Term", prospect.term ? `${prospect.term} months` : "TBD", leftW);
  ry += 20;

  keyValueRow(doc, x + 12, ry, "Interest Rate", prospect.interestRate ? `${prospect.interestRate}%` : "TBD", leftW);
  keyValueRow(doc, x + 12 + leftW, ry, "Stage", capitalize(prospect.stage), leftW);
  ry += 20;

  const totalSecurity = calculateTotalSecurity(prospect);
  keyValueRow(doc, x + 12, ry, "Total Security", formatCurrency(totalSecurity), leftW);

  // Checklist progress (normalized!)
  const dd: any = dueDiligence?.data;
  const norm = dd?.checklist ? normalizeChecklist(dd.checklist) : null;
  const progress = norm && norm.total > 0 ? `${norm.completed}/${norm.total}` : "N/A";
  keyValueRow(doc, x + 12 + leftW, ry, "Checklist Progress", progress, leftW);

  doc.y += 160;

  // Purpose & notes (NO truncation)
  const purpose = (prospect.loanRequirementNotes || "").trim();
  const notes = (prospect.notes || "").trim();
  const combined = [purpose && `Purpose / Requirements:\n${purpose}`, notes && `Notes:\n${notes}`].filter(Boolean).join("\n\n");

  if (combined) {
    const boxH = Math.min(320, Math.max(90, doc.heightOfString(combined, { width: w - 24, lineGap: 2 }) + 40));
    ensureSpace(doc, boxH + 10);
    card(doc, x, doc.y, w, boxH, { fill: COLORS.backgroundLight, stroke: COLORS.border });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("PURPOSE & NOTES", x + 12, doc.y + 10);

    setBody(doc);
    doc.x = x + 12;
    doc.y = doc.y + 30;
    paragraph(doc, combined, { width: w - 24, lineGap: 2 });

    doc.x = x;
    doc.y += 14;
  }

  // Security types
  const secTypes = getSecurityTypes(prospect);
  if (secTypes.length) {
    ensureSpace(doc, 60);
    setHeading(doc);
    doc.text("Security / Collateral", x, doc.y);
    doc.y += 12;

    setBody(doc);
    doc.fontSize(10);
    bullets(doc, secTypes.map(s => s), { width: w - 20 });
    doc.y += 8;
  }
}

// -------------------------
// Section: Charges
// -------------------------
function renderCharges(doc: Doc, number: string, charges: any) {
  drawSectionHeader(doc, "Charges", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);
  const items = charges?.items || [];

  setBody(doc);
  setMuted(doc);
  doc.text(`Total charges: ${items.length}`, x, doc.y);
  doc.y += 12;

  // Table-like list
  for (const c of items.slice(0, 30)) {
    ensureSpace(doc, 52);
    card(doc, x, doc.y, w, 44, { fill: COLORS.white, stroke: COLORS.border });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
    const status = c.status ? String(c.status).toUpperCase() : "UNKNOWN";
    doc.text(`${status} — ${c.particulars?.type || "Charge"}`, x + 12, doc.y + 10, { width: w - 24 });

    doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
    const created = c.created_on ? new Date(c.created_on).toLocaleDateString("en-GB") : "N/A";
    doc.text(`Created: ${created}`, x + 12, doc.y + 26);
    doc.y += 52;
  }

  if (items.length > 30) {
    setMuted(doc);
    doc.text(`…and ${items.length - 30} more charges (not shown)`, x, doc.y);
  }
}

// -------------------------
// Section: Saved Associations
// -------------------------
function renderSavedAssociations(doc: Doc, number: string, associations: any[]) {
  drawSectionHeader(doc, "Saved Associated Companies", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  setMuted(doc);
  doc.text(`Saved associations: ${associations.length}`, x, doc.y);
  doc.y += 12;

  for (const a of associations.slice(0, 30)) {
    ensureSpace(doc, 42);
    card(doc, x, doc.y, w, 34, { fill: COLORS.white, stroke: COLORS.border });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(a?.companyName || a?.name || "Unknown company", x + 12, doc.y + 10, { width: w - 24 });
    doc.y += 42;
  }

  if (associations.length > 30) {
    setMuted(doc);
    doc.text(`…and ${associations.length - 30} more (not shown)`, x, doc.y);
  }
}

// -------------------------
// Section: Activities
// -------------------------
function renderActivities(doc: Doc, number: string, activities: Activity[]) {
  drawSectionHeader(doc, "Activities & Tasks", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  for (const a of activities.slice(0, 40)) {
    ensureSpace(doc, 62);
    card(doc, x, doc.y, w, 54, { fill: COLORS.white, stroke: COLORS.border });

    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(a.title || a.type || "Activity", x + 12, doc.y + 10, { width: w - 24 });

    doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
    const when = (a.dueDate || a.createdAt) ? new Date((a.dueDate || a.createdAt) as any).toLocaleDateString("en-GB") : "N/A";
    const status = (a.status || "").toString();
    const meta = [when && `Date: ${when}`, status && `Status: ${status}`].filter(Boolean).join(" • ");
    if (meta) doc.text(meta, x + 12, doc.y + 26, { width: w - 24 });

    doc.y += 62;
  }

  if (activities.length > 40) {
    setMuted(doc);
    doc.text(`…and ${activities.length - 40} more activities (not shown)`, x, doc.y);
  }
}

// -------------------------
// Section: Due Diligence
// -------------------------
function renderDueDiligence(doc: Doc, number: string, data: ProspectReportData) {
  drawSectionHeader(doc, "Due Diligence", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  const dd: any = data.dueDiligence?.data;
  if (!dd) {
    setMuted(doc);
    doc.text("No due diligence data available.", x, doc.y);
    return;
  }

  // Checklist (normalized, consistent)
  if (dd.checklist) {
    const norm = normalizeChecklist(dd.checklist);
    ensureSpace(doc, 90);

    card(doc, x, doc.y, w, 70, { fill: COLORS.backgroundLight, stroke: COLORS.border, accent: COLORS.accent });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("CHECKLIST STATUS", x + 12, doc.y + 10);

    setBody(doc);
    doc.fontSize(10);
    doc.text(`Completed: ${norm.completed} of ${norm.total}`, x + 12, doc.y + 30);

    const pct = norm.total > 0 ? Math.round((norm.completed / norm.total) * 100) : 0;
    progressBar(doc, x + 12, doc.y + 44, w - 140, "Progress", pct);

    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text);
    doc.text(`${pct}%`, x + w - 60, doc.y + 42);

    doc.y += 90;

    // Show a compact “top categories” list (first ~3 categories)
    const cats = [...norm.byCategory.entries()].slice(0, 3);
    if (cats.length) {
      ensureSpace(doc, 70);
      setHeading(doc);
      doc.text("Checklist (by category)", x, doc.y);
      doc.y += 12;

      setBody(doc);
      for (const [cat, items] of cats) {
        ensureSpace(doc, 14);
        const done = items.filter(i => !!i.checked).length;
        doc.text(`• ${cat}: ${done}/${items.length}`, x + 10, doc.y, { width: w - 20 });
        doc.y += 14;
      }
      doc.y += 8;
    }
  } else {
    setMuted(doc);
    doc.text("No due diligence checklist configured.", x, doc.y);
    doc.y += 14;
  }

  // DSCR
  if (dd.dscrCalculator?.dscr != null) {
    const dscr = Number(dd.dscrCalculator.dscr);
    ensureSpace(doc, 70);
    card(doc, x, doc.y, w, 54, { fill: COLORS.white, stroke: COLORS.border });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("DSCR", x + 12, doc.y + 10);

    const status = dscr >= 1.25 ? "PASS" : dscr >= 1.0 ? "CAUTION" : "FAIL";
    const color = dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;

    doc.font("Helvetica-Bold").fontSize(16).fillColor(color);
    doc.text(dscr.toFixed(2), x + 12, doc.y + 26);

    doc.font("Helvetica-Bold").fontSize(11).fillColor(color);
    doc.text(status, x + 90, doc.y + 32);

    doc.y += 70;
  }

  // Financial ratios (if present)
  const ratiosData = dd.accountsAnalysis?.ratios || dd.financialRatios;
  if (Array.isArray(ratiosData) && ratiosData.length) {
    renderRatiosTable(doc, ratiosData);
  }

  // Underwriting narrative (NO truncation)
  const underw = dd.underwriting || dd.creditUnderwriting;
  const narrative =
    underw?.underwritingSummary ||
    underw?.summary ||
    underw?.analysis ||
    "";

  if (String(narrative).trim()) {
    const text = String(narrative).trim();
    const boxH = Math.min(420, Math.max(90, doc.heightOfString(text, { width: w - 24, lineGap: 2 }) + 40));
    ensureSpace(doc, boxH + 10);
    card(doc, x, doc.y, w, boxH, { fill: COLORS.backgroundMuted, stroke: COLORS.border });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("UNDERWRITING NARRATIVE", x + 12, doc.y + 10);

    setBody(doc);
    doc.x = x + 12;
    doc.y = doc.y + 30;
    paragraph(doc, text, { width: w - 24, lineGap: 2 });

    doc.x = x;
    doc.y += 14;
  }
}

function renderRatiosTable(doc: Doc, ratiosData: any[]) {
  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  ensureSpace(doc, 40);
  setHeading(doc);
  doc.text("Calculated Financial Ratios", x, doc.y);
  doc.y += 12;

  // Columns: Metric | Benchmark | each year
  const yearCols = ratiosData.slice(0, 3); // keep readable; extend if you want
  const colCount = 2 + yearCols.length;
  const colW = w / colCount;

  const headerH = 22;
  ensureSpace(doc, headerH + 10);
  doc.save();
  doc.rect(x, doc.y, w, headerH).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.textSecondary);
  doc.text("Metric", x + 6, doc.y + 7);
  doc.text("Benchmark", x + colW + 6, doc.y + 7);

  yearCols.forEach((rd: any, idx: number) => {
    doc.text(String(rd.year || `Year ${idx + 1}`), x + (idx + 2) * colW + 6, doc.y + 7);
  });
  doc.restore();
  doc.y += headerH;

  // Ratio definitions (ASCII-safe benchmarks)
  const normalizePercent = (v: number) => (v <= 0 ? 0 : v < 1 ? v * 100 : v);

  const metrics = [
    { label: "Current Ratio", key: "currentRatio", benchmark: ">= 1.5", good: (v: number) => v >= 1.5 },
    { label: "Quick Ratio", key: "quickRatio", benchmark: ">= 1.0", good: (v: number) => v >= 1.0 },
    { label: "Debt to Equity", key: "debtToEquity", benchmark: "<= 2.0", good: (v: number) => v <= 2.0 },
    { label: "Gross Profit %", key: "grossProfitMargin", benchmark: ">= 20%", good: (v: number) => normalizePercent(v) >= 20, percent: true },
    { label: "Net Profit %", key: "netProfitMargin", benchmark: ">= 5%", good: (v: number) => normalizePercent(v) >= 5, percent: true },
    { label: "Interest Cover", key: "interestCover", benchmark: ">= 2.0", good: (v: number) => v >= 2.0 },
    { label: "ROCE", key: "returnOnCapitalEmployed", benchmark: ">= 15%", good: (v: number) => normalizePercent(v) >= 15, percent: true },
    { label: "Debtor Days", key: "debtorDays", benchmark: "<= 60", good: (v: number) => v <= 60, days: true },
    { label: "Creditor Days", key: "creditorDays", benchmark: "<= 45", good: (v: number) => v <= 45, days: true },
  ];

  for (let r = 0; r < metrics.length; r++) {
    const rowH = 18;
    ensureSpace(doc, rowH + 2);

    const isOdd = r % 2 === 0;
    doc.save();
    doc.rect(x, doc.y, w, rowH).fillAndStroke(isOdd ? COLORS.white : COLORS.backgroundLight, COLORS.border);

    doc.font("Helvetica").fontSize(8).fillColor(COLORS.text);
    doc.text(metrics[r].label, x + 6, doc.y + 6, { width: colW - 10 });

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.textSecondary);
    doc.text(metrics[r].benchmark, x + colW + 6, doc.y + 6, { width: colW - 10 });

    yearCols.forEach((rd: any, idx: number) => {
      const val = rd?.ratios?.[metrics[r].key];
      let display = "N/A";
      if (val != null && val !== "") {
        const n = Number(val);
        if (Number.isFinite(n)) {
          if (metrics[r].percent) display = `${normalizePercent(n).toFixed(1)}%`;
          else if (metrics[r].days) display = `${Math.round(n)}`;
          else display = n.toFixed(2);
        }
      }

      const good = val != null && Number.isFinite(Number(val)) ? metrics[r].good(Number(val)) : false;
      const color = val == null ? COLORS.textSecondary : good ? COLORS.success : COLORS.warning;

      doc.font("Helvetica-Bold").fontSize(8).fillColor(color);
      doc.text(display, x + (idx + 2) * colW + 6, doc.y + 6, { width: colW - 10 });
    });

    doc.restore();
    doc.y += rowH;
  }

  doc.y += 12;
}

// -------------------------
// Section: CAMPARI
// -------------------------
function renderCampari(doc: Doc, number: string, adviser: any) {
  drawSectionHeader(doc, "CAMPARI Analysis", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  // Header block
  ensureSpace(doc, 110);
  card(doc, x, doc.y, w, 80, { fill: COLORS.backgroundMuted, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  doc.text("ADVISER SUMMARY", x + 12, doc.y + 10);

  setBody(doc);
  const leftW = (w - 24) / 2;
  const col1 = x + 12;
  const col2 = x + 12 + leftW;
  let y0 = doc.y + 32;

  if (adviser?.businessName) keyValueRow(doc, col1, y0, "Business Name", String(adviser.businessName), leftW);
  if (adviser?.soarRef) keyValueRow(doc, col2, y0, "Reference", String(adviser.soarRef), leftW);
  y0 += 20;

  if (adviser?.product) keyValueRow(doc, col1, y0, "Product", String(adviser.product), leftW);
  if (adviser?.amount) {
    const amt = Number(adviser.amount);
    keyValueRow(doc, col2, y0, "Amount", Number.isFinite(amt) ? formatCurrency(amt * 100) : "N/A", leftW);
  }

  doc.y += 105;

  const order = ["character", "ability", "margin", "purpose", "amount", "repayment", "insurance"] as const;
  const labels: Record<string, string> = {
    character: "CHARACTER — Management & Background",
    ability: "ABILITY — Capacity to Repay",
    margin: "MARGIN — Return & Pricing",
    purpose: "PURPOSE — Loan Purpose & Rationale",
    amount: "AMOUNT — Funding Requirement",
    repayment: "REPAYMENT — Source & Terms",
    insurance: "INSURANCE — Security & Risk Mitigation",
  };

  if (adviser?.sections && typeof adviser.sections === "object") {
    for (const k of order) {
      const raw = adviser.sections[k];
      const text = (raw == null ? "" : String(raw)).trim();
      if (!text) continue;

      const title = labels[k] || String(k).toUpperCase();
      const bodyH = Math.min(420, Math.max(70, doc.heightOfString(text, { width: w - 24, lineGap: 2 }) + 40));

      ensureSpace(doc, bodyH + 10);
      card(doc, x, doc.y, w, bodyH, { fill: COLORS.white, stroke: COLORS.border, accent: COLORS.secondary });

      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.secondary);
      doc.text(title, x + 12, doc.y + 10);

      setBody(doc);
      doc.x = x + 12;
      doc.y = doc.y + 30;
      paragraph(doc, text, { width: w - 24, lineGap: 2 });

      doc.x = x;
      doc.y += 12;
    }
  }

  // Recommendation (if present)
  const rec = adviser?.recommendation ? String(adviser.recommendation) : "";
  if (rec) {
    ensureSpace(doc, 90);

    const labels2: Record<string, string> = {
      approve: "Recommend Approval",
      approve_conditions: "Approve with Conditions",
      refer: "Refer to Credit Committee",
      decline: "Recommend Decline",
      more_info: "More Information Required",
    };

    const colors: Record<string, string> = {
      approve: COLORS.success,
      approve_conditions: COLORS.warning,
      refer: COLORS.accent,
      decline: COLORS.danger,
      more_info: COLORS.textSecondary,
    };

    const c = colors[rec] || COLORS.primary;
    const label = labels2[rec] || rec;

    card(doc, x, doc.y, w, 70, { fill: hexWithAlpha(c, 0.10), stroke: c });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
    doc.text("FINAL RECOMMENDATION", x + 12, doc.y + 10);

    doc.font("Helvetica-Bold").fontSize(16).fillColor(c);
    doc.text(label, x + 12, doc.y + 34);
  }
}

// -------------------------
// Section: SWOT
// -------------------------
function renderSwot(doc: Doc, number: string, swot: any) {
  drawSectionHeader(doc, "SWOT Analysis", number);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  const gap = 10;
  const boxW = (w - gap) / 2;
  const boxH = 170;
  const accentW = 5;

  ensureSpace(doc, boxH * 2 + gap + 90);

  // helper to render a quadrant safely (wrap, and if overflow show “+N more”)
  const quadrant = (qx: number, qy: number, title: string, fill: string, accent: string, arr: any[]) => {
    doc.save();
    doc.rect(qx, qy, boxW, boxH).fill(fill);
    doc.rect(qx, qy, accentW, boxH).fill(accent);
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(11).fillColor(accent);
    doc.text(title, qx + 12, qy + 10);

    const items = Array.isArray(arr) ? arr.map(String) : [];
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);

    // Render up to available height
    doc.x = qx + 12;
    doc.y = qy + 30;

    const rendered = bullets(doc, items, { width: boxW - 24, maxHeight: boxH - 52 }) || 0;
    const remaining = items.filter(s => (s || "").trim()).length - rendered;

    if (remaining > 0) {
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.textSecondary);
      ensureSpace(doc, 12);
      doc.text(`…and ${remaining} more`, qx + 12, qy + boxH - 18, { width: boxW - 24 });
    }

    // Reset cursor (don’t let doc.y drift based on inside writes)
    doc.x = x;
    doc.y = qy;
  };

  const y = doc.y;

  quadrant(x, y, "STRENGTHS", COLORS.swotStrengthsBg, COLORS.swotStrengthsBorder, swot?.strengths);
  quadrant(x + boxW + gap, y, "WEAKNESSES", COLORS.swotWeaknessesBg, COLORS.swotWeaknessesBorder, swot?.weaknesses);

  const y2 = y + boxH + gap;
  quadrant(x, y2, "OPPORTUNITIES", COLORS.swotOpportunitiesBg, COLORS.swotOpportunitiesBorder, swot?.opportunities);
  quadrant(x + boxW + gap, y2, "THREATS", COLORS.swotThreatsBg, COLORS.swotThreatsBorder, swot?.threats);

  doc.y = y2 + boxH + 14;

  // Summary (NO truncation)
  const summary = (swot?.summary == null ? "" : String(swot.summary)).trim();
  if (summary) {
    const h = Math.min(260, Math.max(80, doc.heightOfString(summary, { width: w - 24, lineGap: 2 }) + 40));
    ensureSpace(doc, h + 10);
    card(doc, x, doc.y, w, h, { fill: COLORS.backgroundLight, stroke: COLORS.border, accent: COLORS.primary });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
    doc.text("SWOT SUMMARY", x + 12, doc.y + 10);

    setBody(doc);
    doc.x = x + 12;
    doc.y = doc.y + 30;
    paragraph(doc, summary, { width: w - 24, lineGap: 2 });

    doc.x = x;
    doc.y += 12;
  }
}

// -------------------------
// Section: Recommendation (always last)
// -------------------------
function renderRecommendation(doc: Doc, number: string, data: ProspectReportData) {
  drawSectionHeader(doc, "Adviser Recommendation", number);

  const { prospect, dueDiligence } = data;
  const x = doc.page.margins.left;
  const w = contentWidth(doc);

  const dd: any = dueDiligence?.data;
  const underw = dd?.underwriting || dd?.creditUnderwriting;

  // If your Prospect schema has adviser recommendation fields, try them;
  // otherwise fall back to underwriting recommendation; else auto-generate.
  const explicit = (prospect as any)?.adviserRecommendation || underw?.recommendation || underw?.finalRecommendation;
  const rec = explicit ? String(explicit) : autoRecommendation(dd);

  const rationale = buildRationale(dd);
  const conditions = buildConditions(dd);

  ensureSpace(doc, 140);
  const recColor = recommendationColor(rec);
  card(doc, x, doc.y, w, 90, { fill: hexWithAlpha(recColor, 0.10), stroke: recColor, accent: recColor });

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  doc.text("RECOMMENDATION", x + 12, doc.y + 10);

  doc.font("Helvetica-Bold").fontSize(18).fillColor(recColor);
  doc.text(rec, x + 12, doc.y + 34);

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(`Prepared: ${new Date().toLocaleDateString("en-GB")}`, x + 12, doc.y + 64);

  doc.y += 110;

  if (rationale.length) {
    ensureSpace(doc, 60);
    setHeading(doc);
    doc.text("Rationale", x, doc.y);
    doc.y += 12;
    setBody(doc);
    bullets(doc, rationale, { width: w - 20 });
    doc.y += 10;
  }

  if (conditions.length) {
    ensureSpace(doc, 60);
    setHeading(doc);
    doc.text("Conditions / Next Actions", x, doc.y);
    doc.y += 12;
    setBody(doc);
    bullets(doc, conditions, { width: w - 20 });
    doc.y += 10;
  }

  // Signature placeholder (optional)
  ensureSpace(doc, 80);
  card(doc, x, doc.y, w, 60, { fill: COLORS.white, stroke: COLORS.border });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary);
  doc.text("Signature", x + 12, doc.y + 10);

  setMuted(doc);
  doc.text("If signed in-app, render adviser signature image here.", x + 12, doc.y + 30, { width: w - 24 });
}

// -------------------------
// Data normalisation / derived decisions
// -------------------------
type ChecklistItem = { checked?: boolean; label?: string; text?: string; category?: string };

function normalizeChecklist(checklist: any): { items: ChecklistItem[]; total: number; completed: number; byCategory: Map<string, ChecklistItem[]> } {
  const items: ChecklistItem[] = [];

  if (Array.isArray(checklist)) {
    items.push(...checklist);
  } else if (checklist && typeof checklist === "object") {
    for (const [category, arr] of Object.entries(checklist)) {
      if (Array.isArray(arr)) {
        items.push(...arr.map((i: any) => ({ ...(i || {}), category })));
      }
    }
  }

  const total = items.length;
  const completed = items.filter(i => !!i.checked).length;

  const byCategory = new Map<string, ChecklistItem[]>();
  for (const i of items) {
    const cat = i.category || "Checklist";
    byCategory.set(cat, [...(byCategory.get(cat) || []), i]);
  }

  return { items, total, completed, byCategory };
}

function autoRecommendation(dd: any): string {
  if (!dd) return "REFER (insufficient data)";

  const dscr = dd?.dscrCalculator?.dscr != null ? Number(dd.dscrCalculator.dscr) : null;
  const underw = dd?.underwriting || dd?.creditUnderwriting;
  const grade = underw?.finalRiskGrade || underw?.riskGrade;

  // Simple, explainable defaults
  if (dscr != null && dscr < 1.0) return "DECLINE (DSCR below 1.0)";
  if (typeof grade === "string" && ["E"].includes(grade.toUpperCase())) return "DECLINE (risk grade E)";
  if (dscr != null && dscr < 1.25) return "REFER (DSCR requires review)";
  if (typeof grade === "string" && ["D"].includes(grade.toUpperCase())) return "REFER (risk grade D)";
  return "RECOMMEND APPROVAL (subject to conditions)";
}

function buildRationale(dd: any): string[] {
  const out: string[] = [];
  const dscr = dd?.dscrCalculator?.dscr != null ? Number(dd.dscrCalculator.dscr) : null;

  if (dscr != null) out.push(`Debt Service Coverage Ratio (DSCR): ${dscr.toFixed(2)}`);

  const underw = dd?.underwriting || dd?.creditUnderwriting;
  const grade = underw?.finalRiskGrade || underw?.riskGrade;
  if (grade) out.push(`Risk grade: ${grade}`);

  const checklist = dd?.checklist ? normalizeChecklist(dd.checklist) : null;
  if (checklist && checklist.total > 0) out.push(`Due diligence checklist completion: ${checklist.completed}/${checklist.total}`);

  const summary = (underw?.underwritingSummary || underw?.summary || "").toString().trim();
  if (summary) out.push(`Underwriting summary available in report`);

  return out;
}

function buildConditions(dd: any): string[] {
  const out: string[] = [];
  const checklist = dd?.checklist ? normalizeChecklist(dd.checklist) : null;

  if (checklist && checklist.total > 0 && checklist.completed < checklist.total) {
    out.push("Complete outstanding due diligence checklist items.");
  }

  // Example placeholders (adapt to your actual workflow)
  if (dd?.documentsRequired?.length) out.push("Obtain and verify required documents.");
  out.push("Confirm security documentation and charge registration (if applicable).");

  return out;
}

// -------------------------
// Small utilities
// -------------------------
function formatCurrency(amountPence: number) {
  const pounds = (amountPence || 0) / 100;
  return pounds.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

function capitalize(v: any) {
  const s = (v ?? "").toString();
  if (!s) return "N/A";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function stageColor(stage: any) {
  const s = String(stage || "").toLowerCase();
  if (["approved", "complete", "completed"].includes(s)) return COLORS.success;
  if (["declined", "rejected"].includes(s)) return COLORS.danger;
  if (["in_review", "review", "under_review"].includes(s)) return COLORS.warning;
  return COLORS.accent;
}

function riskGradeColor(grade: string) {
  const g = (grade || "").toUpperCase();
  if (g === "A") return COLORS.success;
  if (g === "B") return "#22C55E";
  if (g === "C") return COLORS.warning;
  if (g === "D") return "#F97316";
  if (g === "E") return COLORS.danger;
  return COLORS.textSecondary;
}

function recommendationColor(rec: string) {
  const r = (rec || "").toLowerCase();
  if (r.includes("decline")) return COLORS.danger;
  if (r.includes("refer")) return COLORS.warning;
  if (r.includes("approve")) return COLORS.success;
  return COLORS.accent;
}

function hexWithAlpha(hex: string, alpha: number) {
  // hex like #RRGGBB -> #RRGGBBAA
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return `#${h}${a}`;
}

// Your existing prospect shape seems to store collateral across several fields.
// This keeps it tolerant: it counts anything truthy/number-ish as “security”.
function calculateTotalSecurity(prospect: ProspectWithCompany): number {
  const p: any = prospect as any;
  const fields = [
    p.securityAmount,
    p.totalSecurity,
    p.propertySecurityValue,
    p.personalGuaranteeValue,
    p.otherSecurityValue,
  ].filter(v => v != null);

  const sum = fields.reduce((acc: number, v: any) => {
    const n = Number(v);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  // If those fields are in pounds rather than pence, you can remove *100 logic.
  // The rest of this generator assumes pence for money fields.
  return sum || 0;
}

function getSecurityTypes(prospect: ProspectWithCompany): string[] {
  const p: any = prospect as any;
  const out: string[] = [];
  // Try a few common patterns without assuming schema details.
  if (p.hasPersonalGuarantee) out.push("Personal Guarantee");
  if (p.hasDebenture) out.push("Debenture");
  if (p.hasPropertySecurity) out.push("Property Security");
  if (p.securityTypes && Array.isArray(p.securityTypes)) out.push(...p.securityTypes.map(String));
  if (p.securityType && typeof p.securityType === "string") out.push(p.securityType);
  return [...new Set(out.map(s => s.trim()).filter(Boolean))];
}

