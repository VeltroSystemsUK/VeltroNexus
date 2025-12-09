import PDFDocument from 'pdfkit';
import type { ProspectWithCompany, Contact, Activity, DueDiligence } from '@shared/schema';

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

// Big 4 Consultancy Color Palette
const COLORS = {
  primary: '#0D2137',      // Deep navy - main headers
  secondary: '#1B365D',    // Navy blue - secondary elements
  accent: '#2563EB',       // Bright blue - highlights
  success: '#059669',      // Green - positive indicators
  warning: '#D97706',      // Amber - warnings
  danger: '#DC2626',       // Red - alerts
  text: '#1F2937',         // Dark gray - body text
  textSecondary: '#6B7280', // Medium gray - secondary text
  textLight: '#9CA3AF',    // Light gray - captions
  border: '#E5E7EB',       // Light border
  backgroundLight: '#F9FAFB', // Light background for boxes
  backgroundMuted: '#F3F4F6', // Muted background
  white: '#FFFFFF',
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
];

// Page dimensions
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

let pageNumber = 0;

export function generateProspectReport(data: ProspectReportData): typeof PDFDocument.prototype {
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Credit Assessment Report - ${data.prospect.company.companyName}`,
      Author: 'FlowLoan',
      Subject: 'Commercial Lending Credit Assessment',
      Keywords: 'credit, assessment, lending, commercial',
    }
  });
  
  const { prospect, contacts, activities, dueDiligence, companiesHouseData, pdfLayoutPreferences } = data;
  pageNumber = 0;

  // Cover Page
  renderCoverPage(doc, prospect);
  
  // Executive Summary Page
  doc.addPage();
  pageNumber++;
  renderExecutiveSummary(doc, prospect, dueDiligence, companiesHouseData);
  
  // Table of Contents
  doc.addPage();
  pageNumber++;
  renderTableOfContents(doc, pdfLayoutPreferences?.sections || DEFAULT_SECTIONS, companiesHouseData, prospect, contacts, activities, dueDiligence);

  // Content sections
  const sections = pdfLayoutPreferences?.sections || DEFAULT_SECTIONS;

  sections.forEach((section) => {
    if (!section.enabled) return;

    switch (section.id) {
      case 'companyInfo':
        doc.addPage();
        pageNumber++;
        renderCompanyInfo(doc, prospect);
        break;
      case 'officers':
        if (companiesHouseData?.officers?.items?.length > 0) {
          doc.addPage();
          pageNumber++;
          renderOfficers(doc, companiesHouseData!.officers);
        }
        break;
      case 'psc':
        if (companiesHouseData?.psc?.items?.length > 0) {
          doc.addPage();
          pageNumber++;
          renderPSC(doc, companiesHouseData!.psc);
        }
        break;
      case 'charges':
        if (companiesHouseData?.charges?.items?.length > 0) {
          doc.addPage();
          pageNumber++;
          renderCharges(doc, companiesHouseData!.charges);
        }
        break;
      case 'savedAssociations':
        if (prospect.savedAssociations && Array.isArray(prospect.savedAssociations) && prospect.savedAssociations.length > 0) {
          doc.addPage();
          pageNumber++;
          renderSavedAssociations(doc, prospect.savedAssociations as any[]);
        }
        break;
      case 'loanDetails':
        doc.addPage();
        pageNumber++;
        renderLoanDetails(doc, prospect);
        break;
      case 'security':
        const hasCollateral = checkHasCollateral(prospect);
        if (hasCollateral) {
          doc.addPage();
          pageNumber++;
          renderSecurity(doc, prospect);
        }
        break;
      case 'notes':
        if (prospect.loanRequirementNotes || prospect.notes) {
          doc.addPage();
          pageNumber++;
          renderNotes(doc, prospect);
        }
        break;
      case 'contacts':
        if (contacts.length > 0) {
          doc.addPage();
          pageNumber++;
          renderContacts(doc, contacts);
        }
        break;
      case 'activities':
        if (activities.length > 0) {
          doc.addPage();
          pageNumber++;
          renderActivities(doc, activities);
        }
        break;
      case 'dueDiligence':
        if (dueDiligence?.data) {
          doc.addPage();
          pageNumber++;
          renderDueDiligence(doc, dueDiligence);
        }
        break;
    }
  });

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
  doc.fontSize(14).fillColor(COLORS.white).font('Helvetica');
  doc.text('FLOWLOAN', MARGIN, 40);
  doc.fontSize(10).fillColor(COLORS.textLight);
  doc.text('Commercial Lending Solutions', MARGIN, 58);
  
  // Main title
  doc.fontSize(36).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text('Credit Assessment', MARGIN, 120);
  doc.text('Report', MARGIN, 165);
  
  // Subtitle line
  doc.rect(MARGIN, 220, 80, 3).fill(COLORS.accent);
  
  // Company name prominently displayed
  doc.fontSize(24).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(prospect.company.companyName, MARGIN, 320);
  
  // Company details
  doc.fontSize(12).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(`Company Registration: ${prospect.company.companyNumber || 'N/A'}`, MARGIN, 360);
  
  if (prospect.company.registeredAddress) {
    doc.text(`Registered Address: ${prospect.company.registeredAddress}`, MARGIN, 380);
  }
  
  // Key metrics boxes
  const boxY = 440;
  const boxHeight = 70;
  const boxWidth = (CONTENT_WIDTH - 30) / 3;
  
  // Loan Amount Box
  renderMetricBox(doc, MARGIN, boxY, boxWidth, boxHeight, 'Loan Amount', 
    prospect.loanAmount ? formatCurrency(prospect.loanAmount) : 'TBD', COLORS.accent);
  
  // Term Box
  renderMetricBox(doc, MARGIN + boxWidth + 15, boxY, boxWidth, boxHeight, 'Term', 
    prospect.term ? `${prospect.term} months` : 'TBD', COLORS.secondary);
  
  // Stage Box
  renderMetricBox(doc, MARGIN + (boxWidth + 15) * 2, boxY, boxWidth, boxHeight, 'Pipeline Stage', 
    capitalizeStage(prospect.stage), getStageColor(prospect.stage));
  
  // Report date
  doc.fontSize(11).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text('Report Date:', MARGIN, 560);
  doc.font('Helvetica-Bold').fillColor(COLORS.text);
  doc.text(new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), MARGIN, 578);
  
  // Confidentiality notice at bottom
  doc.fontSize(9).fillColor(COLORS.textLight).font('Helvetica');
  const confidentialText = 'CONFIDENTIAL - This document contains proprietary information intended solely for the recipient. ' +
    'Unauthorized distribution, copying, or disclosure is strictly prohibited.';
  doc.text(confidentialText, MARGIN, PAGE_HEIGHT - 80, { 
    width: CONTENT_WIDTH,
    align: 'center'
  });
  
  // Bottom accent bar
  doc.rect(0, PAGE_HEIGHT - 30, PAGE_WIDTH, 30).fill(COLORS.primary);
}

function renderMetricBox(doc: typeof PDFDocument.prototype, x: number, y: number, width: number, height: number, label: string, value: string, accentColor: string) {
  // Box with subtle border
  doc.rect(x, y, width, height).fillAndStroke(COLORS.backgroundLight, COLORS.border);
  
  // Accent bar on left
  doc.rect(x, y, 4, height).fill(accentColor);
  
  // Label
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label.toUpperCase(), x + 15, y + 12, { width: width - 20 });
  
  // Value
  doc.fontSize(16).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(value, x + 15, y + 32, { width: width - 20 });
}

function renderExecutiveSummary(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany, dueDiligence?: DueDiligence, companiesHouseData?: CompaniesHouseData | null) {
  renderSectionHeader(doc, 'Executive Summary', '01');
  
  let y = doc.y + 20;
  
  // Key Findings Box
  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('KEY FINDINGS', MARGIN + 15, y + 15);
  
  doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
  let findingsY = y + 35;
  
  // Company status
  const status = prospect.company.companyStatus || 'Unknown';
  doc.text(`• Company Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`, MARGIN + 15, findingsY);
  findingsY += 18;
  
  // Active officers count
  if (companiesHouseData?.officers?.items) {
    const activeOfficers = companiesHouseData.officers.items.filter((o: any) => !o.resigned_on).length;
    doc.text(`• Active Directors/Officers: ${activeOfficers}`, MARGIN + 15, findingsY);
    findingsY += 18;
  }
  
  // Outstanding charges
  if (companiesHouseData?.charges?.items) {
    const outstanding = companiesHouseData.charges.items.filter((c: any) => c.status === 'outstanding').length;
    doc.text(`• Outstanding Charges: ${outstanding}`, MARGIN + 15, findingsY);
  }
  
  y += 120;
  
  // Financial Overview in two columns
  const colWidth = (CONTENT_WIDTH - 20) / 2;
  
  // Left column - Loan Details
  doc.rect(MARGIN, y, colWidth, 140).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('LOAN DETAILS', MARGIN + 15, y + 12);
  
  doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
  let leftY = y + 35;
  
  renderKeyValue(doc, MARGIN + 15, leftY, 'Requested Amount', prospect.loanAmount ? formatCurrency(prospect.loanAmount) : 'TBD', colWidth - 30);
  leftY += 22;
  renderKeyValue(doc, MARGIN + 15, leftY, 'Term', prospect.term ? `${prospect.term} months` : 'TBD', colWidth - 30);
  leftY += 22;
  renderKeyValue(doc, MARGIN + 15, leftY, 'Interest Rate', prospect.interestRate ? `${prospect.interestRate}%` : 'TBD', colWidth - 30);
  leftY += 22;
  renderKeyValue(doc, MARGIN + 15, leftY, 'Priority', prospect.priority ? capitalizeStage(prospect.priority) : 'Normal', colWidth - 30);
  
  // Right column - Security Position
  doc.rect(MARGIN + colWidth + 20, y, colWidth, 140).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('SECURITY POSITION', MARGIN + colWidth + 35, y + 12);
  
  let rightY = y + 35;
  const totalSecurity = calculateTotalSecurity(prospect);
  
  renderKeyValue(doc, MARGIN + colWidth + 35, rightY, 'Total Security', formatCurrency(totalSecurity), colWidth - 30);
  rightY += 22;
  
  if (prospect.loanAmount && totalSecurity > 0) {
    const ltv = ((prospect.loanAmount / totalSecurity) * 100).toFixed(1);
    renderKeyValue(doc, MARGIN + colWidth + 35, rightY, 'Loan-to-Value', `${ltv}%`, colWidth - 30);
    rightY += 22;
  }
  
  const securityTypes = getSecurityTypes(prospect);
  renderKeyValue(doc, MARGIN + colWidth + 35, rightY, 'Security Types', securityTypes.length > 0 ? securityTypes.join(', ') : 'None', colWidth - 30);
  
  y += 160;
  
  // Risk Assessment Box (if due diligence data exists)
  if (dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    
    doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.white, COLORS.border);
    doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('ASSESSMENT STATUS', MARGIN + 15, y + 12);
    
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
    let statusY = y + 35;
    
    // Checklist progress
    if (ddData.checklist) {
      const totalItems = Object.values(ddData.checklist).flat().length;
      const completedItems = Object.values(ddData.checklist).flat().filter((item: any) => item.checked).length;
      const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      renderProgressBar(doc, MARGIN + 15, statusY, 200, 'Due Diligence Progress', percentage);
    }
    
    // DSCR if available
    if (ddData.dscrCalculator?.dscr != null) {
      const dscr = ddData.dscrCalculator.dscr;
      const dscrStatus = dscr >= 1.25 ? 'PASS' : dscr >= 1.0 ? 'CAUTION' : 'FAIL';
      const dscrColor = dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;
      
      doc.fontSize(10).font('Helvetica');
      doc.text('DSCR: ', MARGIN + 240, statusY, { continued: true });
      doc.fillColor(dscrColor).font('Helvetica-Bold');
      doc.text(`${dscr.toFixed(2)} (${dscrStatus})`, { continued: false });
    }
  }
}

function renderProgressBar(doc: typeof PDFDocument.prototype, x: number, y: number, width: number, label: string, percentage: number) {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label, x, y);
  
  // Background bar
  doc.rect(x, y + 14, width, 8).fill(COLORS.backgroundMuted);
  
  // Progress bar
  const progressWidth = (width * percentage) / 100;
  const progressColor = percentage >= 80 ? COLORS.success : percentage >= 50 ? COLORS.warning : COLORS.accent;
  doc.rect(x, y + 14, progressWidth, 8).fill(progressColor);
  
  // Percentage text
  doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold');
  doc.text(`${percentage}%`, x + width + 10, y + 12);
}

function renderKeyValue(doc: typeof PDFDocument.prototype, x: number, y: number, label: string, value: string, width: number) {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label, x, y);
  doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
  doc.text(value, x, y + 12, { width: width });
}

function renderTableOfContents(doc: typeof PDFDocument.prototype, sections: PDFSection[], companiesHouseData: CompaniesHouseData | null | undefined, prospect: ProspectWithCompany, contacts: Contact[], activities: Activity[], dueDiligence?: DueDiligence) {
  renderSectionHeader(doc, 'Table of Contents', '02');
  
  let y = doc.y + 30;
  let pageNum = 3;
  
  doc.fontSize(11).font('Helvetica');
  
  const tocItems: { label: string; page: number }[] = [];
  
  sections.forEach((section) => {
    if (!section.enabled) return;
    
    let shouldInclude = false;
    switch (section.id) {
      case 'companyInfo':
        shouldInclude = true;
        break;
      case 'officers':
        shouldInclude = (companiesHouseData?.officers?.items?.length ?? 0) > 0;
        break;
      case 'psc':
        shouldInclude = (companiesHouseData?.psc?.items?.length ?? 0) > 0;
        break;
      case 'charges':
        shouldInclude = (companiesHouseData?.charges?.items?.length ?? 0) > 0;
        break;
      case 'savedAssociations':
        shouldInclude = Array.isArray(prospect.savedAssociations) && prospect.savedAssociations.length > 0;
        break;
      case 'loanDetails':
        shouldInclude = true;
        break;
      case 'security':
        shouldInclude = checkHasCollateral(prospect);
        break;
      case 'notes':
        shouldInclude = !!(prospect.loanRequirementNotes || prospect.notes);
        break;
      case 'contacts':
        shouldInclude = contacts.length > 0;
        break;
      case 'activities':
        shouldInclude = activities.length > 0;
        break;
      case 'dueDiligence':
        shouldInclude = !!dueDiligence?.data;
        break;
    }
    
    if (shouldInclude) {
      tocItems.push({ label: section.label, page: pageNum });
      pageNum++;
    }
  });
  
  tocItems.forEach((item, index) => {
    const sectionNum = String(index + 3).padStart(2, '0');
    
    // Section number
    doc.fillColor(COLORS.accent).font('Helvetica-Bold');
    doc.text(sectionNum, MARGIN, y);
    
    // Section label
    doc.fillColor(COLORS.text).font('Helvetica');
    doc.text(item.label, MARGIN + 35, y);
    
    // Dotted line
    const labelWidth = doc.widthOfString(item.label);
    const dotsStart = MARGIN + 35 + labelWidth + 10;
    const dotsEnd = PAGE_WIDTH - MARGIN - 30;
    
    doc.fillColor(COLORS.textLight);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      doc.text('.', dotX, y);
      dotX += 5;
    }
    
    // Page number
    doc.fillColor(COLORS.text).font('Helvetica-Bold');
    doc.text(String(item.page), PAGE_WIDTH - MARGIN - 20, y);
    
    y += 28;
  });
}

function renderSectionHeader(doc: typeof PDFDocument.prototype, title: string, sectionNumber?: string) {
  // Header bar
  doc.rect(0, MARGIN, PAGE_WIDTH, 50).fill(COLORS.primary);
  
  // Section number (if provided)
  if (sectionNumber) {
    doc.fontSize(12).fillColor(COLORS.accent).font('Helvetica');
    doc.text(`Section ${sectionNumber}`, MARGIN, MARGIN + 8);
  }
  
  // Title
  doc.fontSize(20).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text(title, MARGIN, sectionNumber ? MARGIN + 22 : MARGIN + 15);
  
  doc.y = MARGIN + 70;
}

function renderCompanyInfo(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, 'Company Information', '03');
  
  let y = doc.y + 10;
  
  // Main company info card
  doc.rect(MARGIN, y, CONTENT_WIDTH, 180).fillAndStroke(COLORS.white, COLORS.border);
  
  // Company name prominently
  doc.fontSize(18).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(prospect.company.companyName, MARGIN + 20, y + 20);
  
  // Company details in two columns
  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  let detailY = y + 55;
  
  renderDetailRow(doc, col1X, detailY, 'Company Number', prospect.company.companyNumber || 'N/A');
  renderDetailRow(doc, col2X, detailY, 'Company Status', prospect.company.companyStatus ? capitalizeStage(prospect.company.companyStatus) : 'N/A');
  detailY += 35;
  
  renderDetailRow(doc, col1X, detailY, 'Company Type', prospect.company.companyType || 'N/A');
  renderDetailRow(doc, col2X, detailY, 'Incorporation Date', prospect.company.incorporationDate || 'N/A');
  detailY += 35;
  
  if (prospect.company.registeredAddress) {
    renderDetailRow(doc, col1X, detailY, 'Registered Address', prospect.company.registeredAddress, CONTENT_WIDTH - 40);
  }
  
  y += 200;
  
  // SIC Codes section if available (cast to any as sicCodes may come from extended data)
  const companyData = prospect.company as any;
  if (companyData.sicCodes && Array.isArray(companyData.sicCodes) && companyData.sicCodes.length > 0) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.backgroundLight, COLORS.border);
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('SIC CODES', MARGIN + 20, y + 15);
    
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
    let sicY = y + 35;
    companyData.sicCodes.forEach((code: string) => {
      doc.text(`• ${code}`, MARGIN + 20, sicY);
      sicY += 16;
    });
  }
}

function renderDetailRow(doc: typeof PDFDocument.prototype, x: number, y: number, label: string, value: string, width?: number) {
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label.toUpperCase(), x, y);
  doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
  doc.text(value, x, y + 14, { width: width || 220 });
}

function renderOfficers(doc: typeof PDFDocument.prototype, officers: any) {
  renderSectionHeader(doc, 'Officers', '04');
  
  const activeOfficers = officers.items.filter((o: any) => !o.resigned_on);
  const resignedOfficers = officers.items.filter((o: any) => o.resigned_on);
  
  let y = doc.y + 10;
  
  // Active Officers
  if (activeOfficers.length > 0) {
    doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold');
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
      
      const name = officer.name || 'Unknown';
      const role = officer.officer_role?.replace(/-/g, ' ') || 'Officer';
      const appointed = officer.appointed_on ? new Date(officer.appointed_on).toLocaleDateString('en-GB') : 'N/A';
      
      doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
      doc.text(name, MARGIN + 15, y + 10);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
      doc.text(role.charAt(0).toUpperCase() + role.slice(1), MARGIN + 15, y + 28);
      
      doc.text(`Appointed: ${appointed}`, MARGIN + CONTENT_WIDTH - 150, y + 28);
      
      y += 60;
    });
  }
  
  // Resigned Officers (condensed)
  if (resignedOfficers.length > 0) {
    y += 10;
    doc.fontSize(12).fillColor(COLORS.textSecondary).font('Helvetica-Bold');
    doc.text(`Former Officers (${resignedOfficers.length})`, MARGIN, y);
    y += 20;
    
    doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
    resignedOfficers.slice(0, 10).forEach((officer: any) => {
      if (y > PAGE_HEIGHT - 60) return;
      const name = officer.name || 'Unknown';
      const resigned = officer.resigned_on ? new Date(officer.resigned_on).toLocaleDateString('en-GB') : '';
      doc.text(`• ${name} (resigned ${resigned})`, MARGIN + 10, y);
      y += 14;
    });
    
    if (resignedOfficers.length > 10) {
      doc.text(`... and ${resignedOfficers.length - 10} more former officers`, MARGIN + 10, y);
    }
  }
}

function renderPSC(doc: typeof PDFDocument.prototype, psc: any) {
  renderSectionHeader(doc, 'Persons with Significant Control', '05');
  
  const activePsc = psc.items.filter((p: any) => !p.ceased_on);
  const ceasedPsc = psc.items.filter((p: any) => p.ceased_on);
  
  let y = doc.y + 10;
  
  if (activePsc.length > 0) {
    doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text(`Active PSCs (${activePsc.length})`, MARGIN, y);
    y += 20;
    
    activePsc.forEach((person: any) => {
      if (y > PAGE_HEIGHT - 150) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      
      const name = person.name || 'Unknown Entity';
      const kind = person.kind?.replace(/-/g, ' ') || '';
      
      // PSC card
      const cardHeight = 60 + (person.natures_of_control?.length || 0) * 14;
      doc.rect(MARGIN, y, CONTENT_WIDTH, Math.min(cardHeight, 120)).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, Math.min(cardHeight, 120)).fill(COLORS.accent);
      
      doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
      doc.text(name, MARGIN + 15, y + 12);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
      doc.text(kind.charAt(0).toUpperCase() + kind.slice(1), MARGIN + 15, y + 28);
      
      if (person.natures_of_control && person.natures_of_control.length > 0) {
        let controlY = y + 44;
        doc.fontSize(8).fillColor(COLORS.textLight);
        person.natures_of_control.slice(0, 4).forEach((nature: string) => {
          const formatted = nature.replace(/-/g, ' ').split(' ').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');
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
    doc.fontSize(10).fillColor(COLORS.textSecondary).font('Helvetica');
    doc.text(`Note: ${ceasedPsc.length} former PSC(s) have ceased their significant control.`, MARGIN, y);
  }
}

function renderCharges(doc: typeof PDFDocument.prototype, charges: any) {
  renderSectionHeader(doc, 'Charges', '06');
  
  const outstandingCharges = charges.items.filter((c: any) => c.status === 'outstanding');
  const satisfiedCharges = charges.items.filter((c: any) => c.status === 'satisfied' || c.status === 'fully-satisfied');
  
  let y = doc.y + 10;
  
  // Summary box
  doc.rect(MARGIN, y, CONTENT_WIDTH, 50).fillAndStroke(COLORS.backgroundLight, COLORS.border);
  
  const halfWidth = CONTENT_WIDTH / 2;
  
  // Outstanding count
  doc.fontSize(24).fillColor(outstandingCharges.length > 0 ? COLORS.warning : COLORS.success).font('Helvetica-Bold');
  doc.text(String(outstandingCharges.length), MARGIN + halfWidth / 2 - 15, y + 8);
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text('OUTSTANDING', MARGIN + halfWidth / 2 - 30, y + 35);
  
  // Satisfied count
  doc.fontSize(24).fillColor(COLORS.success).font('Helvetica-Bold');
  doc.text(String(satisfiedCharges.length), MARGIN + halfWidth + halfWidth / 2 - 15, y + 8);
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text('SATISFIED', MARGIN + halfWidth + halfWidth / 2 - 25, y + 35);
  
  y += 70;
  
  // Outstanding charges detail
  if (outstandingCharges.length > 0) {
    doc.fontSize(12).fillColor(COLORS.warning).font('Helvetica-Bold');
    doc.text('Outstanding Charges', MARGIN, y);
    y += 20;
    
    outstandingCharges.forEach((charge: any) => {
      if (y > PAGE_HEIGHT - 120) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 60).fill(COLORS.warning);
      
      const entitled = charge.persons_entitled?.[0]?.name || 'Unknown Creditor';
      const created = charge.created_on ? new Date(charge.created_on).toLocaleDateString('en-GB') : 'N/A';
      const type = charge.classification?.description || 'Charge';
      
      doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
      doc.text(entitled, MARGIN + 15, y + 12, { width: CONTENT_WIDTH - 150 });
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
      doc.text(type, MARGIN + 15, y + 30, { width: CONTENT_WIDTH - 40 });
      doc.text(`Created: ${created}`, MARGIN + 15, y + 44);
      
      y += 70;
    });
  }
  
  // Satisfied charges summary
  if (satisfiedCharges.length > 0) {
    y += 10;
    doc.fontSize(10).fillColor(COLORS.success).font('Helvetica');
    doc.text(`${satisfiedCharges.length} charge(s) have been fully satisfied.`, MARGIN, y);
  }
}

function renderSavedAssociations(doc: typeof PDFDocument.prototype, associations: any[]) {
  renderSectionHeader(doc, 'Associated Companies', '07');
  
  const byType: { [key: string]: any[] } = {};
  associations.forEach((assoc: any) => {
    const type = assoc.associationType || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(assoc);
  });
  
  const typeLabels: { [key: string]: string } = {
    officer: 'Common Directors',
    psc: 'Common Ownership',
    address: 'Same Registered Address',
    other: 'Other Associations'
  };
  
  const typeColors: { [key: string]: string } = {
    officer: COLORS.accent,
    psc: COLORS.secondary,
    address: COLORS.warning,
    other: COLORS.textSecondary
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
    
    doc.fontSize(12).fillColor(COLORS.primary).font('Helvetica-Bold');
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
      
      doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
      doc.text(company.company_name || 'Unknown', MARGIN + 15, y + 10);
      
      doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
      const details = [];
      if (company.company_number) details.push(`No. ${company.company_number}`);
      if (company.company_status) details.push(company.company_status);
      doc.text(details.join(' • '), MARGIN + 15, y + 28);
      
      y += 55;
    });
    
    y += 10;
  });
}

function renderLoanDetails(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, 'Loan Details', '08');
  
  let y = doc.y + 10;
  
  // Main loan metrics
  const boxWidth = (CONTENT_WIDTH - 30) / 3;
  
  renderLargeMetricBox(doc, MARGIN, y, boxWidth, 'Loan Amount', 
    prospect.loanAmount ? formatCurrency(prospect.loanAmount) : 'TBD');
  renderLargeMetricBox(doc, MARGIN + boxWidth + 15, y, boxWidth, 'Term', 
    prospect.term ? `${prospect.term} months` : 'TBD');
  renderLargeMetricBox(doc, MARGIN + (boxWidth + 15) * 2, y, boxWidth, 'Interest Rate', 
    prospect.interestRate ? `${prospect.interestRate}%` : 'TBD');
  
  y += 110;
  
  // Additional details
  doc.rect(MARGIN, y, CONTENT_WIDTH, 100).fillAndStroke(COLORS.white, COLORS.border);
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('ADDITIONAL DETAILS', MARGIN + 20, y + 15);
  
  const col1X = MARGIN + 20;
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  let detailY = y + 40;
  
  renderDetailRow(doc, col1X, detailY, 'Pipeline Stage', capitalizeStage(prospect.stage));
  renderDetailRow(doc, col2X, detailY, 'Priority', prospect.priority ? capitalizeStage(prospect.priority) : 'Normal');
  
  // Calculate estimated monthly payment if loan details are available
  if (prospect.loanAmount && prospect.term && prospect.interestRate) {
    detailY += 35;
    const interestRateNum = typeof prospect.interestRate === 'string' ? parseFloat(prospect.interestRate) : prospect.interestRate;
    const monthlyRate = interestRateNum / 100 / 12;
    const numPayments = prospect.term;
    const principal = prospect.loanAmount / 100; // Convert from pence
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    renderDetailRow(doc, col1X, detailY, 'Est. Monthly Payment', formatCurrency(Math.round(monthlyPayment * 100)));
  }
}

function renderLargeMetricBox(doc: typeof PDFDocument.prototype, x: number, y: number, width: number, label: string, value: string) {
  doc.rect(x, y, width, 90).fillAndStroke(COLORS.backgroundLight, COLORS.border);
  doc.rect(x, y, width, 4).fill(COLORS.accent);
  
  doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label.toUpperCase(), x + 15, y + 20, { width: width - 30, align: 'center' });
  
  doc.fontSize(22).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(value, x + 15, y + 45, { width: width - 30, align: 'center' });
}

function renderSecurity(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, 'Security & Collateral', '09');
  
  let y = doc.y + 10;
  
  // Total security summary
  const totalSecurity = calculateTotalSecurity(prospect);
  
  doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.primary, COLORS.primary);
  doc.fontSize(10).fillColor(COLORS.textLight).font('Helvetica');
  doc.text('TOTAL SECURITY VALUE', MARGIN + 20, y + 15);
  doc.fontSize(28).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text(formatCurrency(totalSecurity), MARGIN + 20, y + 32);
  
  y += 90;
  
  // Individual security items
  const securities = [
    { label: 'Directors Guarantee', value: prospect.directorsGuarantee },
    { label: 'Commercial Property', value: prospect.commercialProperty },
    { label: 'Home Equity', value: prospect.homeEquity },
    { label: 'Other Property', value: prospect.propertyOther },
    { label: 'Debenture', value: prospect.debenture },
    { label: 'Parent Company Guarantee', value: prospect.parentCompanyGuarantee },
    { label: 'Other Collateral', value: prospect.collateral },
    { label: 'Cross Company Guarantee', value: prospect.crossCompanyGuarantee },
  ].filter(s => s.value != null && s.value > 0);
  
  const colWidth = (CONTENT_WIDTH - 15) / 2;
  
  securities.forEach((security, index) => {
    const x = index % 2 === 0 ? MARGIN : MARGIN + colWidth + 15;
    const row = Math.floor(index / 2);
    const itemY = y + row * 55;
    
    if (itemY > PAGE_HEIGHT - 100) return;
    
    doc.rect(x, itemY, colWidth, 45).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(x, itemY, 4, 45).fill(COLORS.success);
    
    doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
    doc.text(security.label.toUpperCase(), x + 15, itemY + 10);
    
    doc.fontSize(14).fillColor(COLORS.text).font('Helvetica-Bold');
    doc.text(formatCurrency(security.value!), x + 15, itemY + 25);
  });
}

function renderNotes(doc: typeof PDFDocument.prototype, prospect: ProspectWithCompany) {
  renderSectionHeader(doc, 'Notes & Requirements', '10');
  
  let y = doc.y + 10;
  
  if (prospect.loanRequirementNotes) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 120).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 120).fill(COLORS.accent);
    
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('LOAN REQUIREMENTS', MARGIN + 15, y + 15);
    
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
    doc.text(prospect.loanRequirementNotes, MARGIN + 15, y + 35, { 
      width: CONTENT_WIDTH - 40,
      height: 75
    });
    
    y += 135;
  }
  
  if (prospect.notes) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 120).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 120).fill(COLORS.secondary);
    
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('ADDITIONAL NOTES', MARGIN + 15, y + 15);
    
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
    doc.text(prospect.notes, MARGIN + 15, y + 35, { 
      width: CONTENT_WIDTH - 40,
      height: 75
    });
  }
}

function renderContacts(doc: typeof PDFDocument.prototype, contacts: Contact[]) {
  renderSectionHeader(doc, 'Key Contacts', '11');
  
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
      doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold');
      doc.text('PRIMARY', PAGE_WIDTH - MARGIN - 65, y + 16);
    } else {
      doc.rect(MARGIN, y, 4, cardHeight).fill(COLORS.border);
    }
    
    doc.fontSize(12).fillColor(COLORS.text).font('Helvetica-Bold');
    doc.text(contact.name, MARGIN + 15, y + 12);
    
    if (contact.role) {
      doc.fontSize(10).fillColor(COLORS.textSecondary).font('Helvetica');
      doc.text(contact.role, MARGIN + 15, y + 30);
    }
    
    let detailY = y + 48;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
    
    const details = [];
    if (contact.email) details.push(contact.email);
    if (contact.phone) details.push(contact.phone);
    doc.text(details.join('  •  '), MARGIN + 15, detailY);
    
    y += cardHeight + 10;
  });
}

function renderActivities(doc: typeof PDFDocument.prototype, activities: Activity[]) {
  renderSectionHeader(doc, 'Activities & Tasks', '12');
  
  const pendingActivities = activities.filter(a => a.completed === 0);
  const completedActivities = activities.filter(a => a.completed === 1);
  
  let y = doc.y + 10;
  
  // Summary boxes
  const halfWidth = (CONTENT_WIDTH - 15) / 2;
  
  doc.rect(MARGIN, y, halfWidth, 50).fillAndStroke(COLORS.warning + '20', COLORS.warning);
  doc.fontSize(24).fillColor(COLORS.warning).font('Helvetica-Bold');
  doc.text(String(pendingActivities.length), MARGIN + 20, y + 10);
  doc.fontSize(10).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text('Pending Tasks', MARGIN + 50, y + 18);
  
  doc.rect(MARGIN + halfWidth + 15, y, halfWidth, 50).fillAndStroke(COLORS.success + '20', COLORS.success);
  doc.fontSize(24).fillColor(COLORS.success).font('Helvetica-Bold');
  doc.text(String(completedActivities.length), MARGIN + halfWidth + 35, y + 10);
  doc.fontSize(10).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text('Completed', MARGIN + halfWidth + 65, y + 18);
  
  y += 70;
  
  // Pending tasks
  if (pendingActivities.length > 0) {
    doc.fontSize(12).fillColor(COLORS.warning).font('Helvetica-Bold');
    doc.text('Pending Tasks', MARGIN, y);
    y += 20;
    
    pendingActivities.forEach((activity) => {
      if (y > PAGE_HEIGHT - 80) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 45).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 45).fill(COLORS.warning);
      
      doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
      doc.text(activity.title, MARGIN + 15, y + 10, { width: CONTENT_WIDTH - 120 });
      
      if (activity.dueDate) {
        const dueDate = new Date(activity.dueDate);
        const isOverdue = dueDate < new Date();
        doc.fontSize(9).fillColor(isOverdue ? COLORS.danger : COLORS.textSecondary).font('Helvetica');
        doc.text(`Due: ${dueDate.toLocaleDateString('en-GB')}`, MARGIN + 15, y + 28);
      }
      
      y += 55;
    });
  }
  
  // Completed tasks summary
  if (completedActivities.length > 0 && y < PAGE_HEIGHT - 100) {
    y += 10;
    doc.fontSize(10).fillColor(COLORS.success).font('Helvetica');
    doc.text(`${completedActivities.length} task(s) completed`, MARGIN, y);
  }
}

function renderDueDiligence(doc: typeof PDFDocument.prototype, dueDiligence: DueDiligence) {
  renderSectionHeader(doc, 'Due Diligence Analysis', '13');
  
  const ddData = dueDiligence.data as any;
  let y = doc.y + 10;
  
  // ==========================================
  // 1. CHECKLIST - Full Detail
  // ==========================================
  if (ddData.checklist) {
    const allItems = Object.entries(ddData.checklist).flatMap(([category, items]: [string, any]) => {
      // Safety check: ensure items is an array before mapping
      if (!Array.isArray(items)) return [];
      return items.map((item: any) => ({ ...item, category }));
    });
    const totalItems = allItems.length;
    const completedItems = allItems.filter((item: any) => item.checked).length;
    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.white, COLORS.border);
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('DUE DILIGENCE CHECKLIST', MARGIN + 15, y + 12);
    
    doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
    doc.text(`${completedItems} of ${totalItems} items completed`, MARGIN + 15, y + 32);
    
    renderProgressBar(doc, MARGIN + 15, y + 48, CONTENT_WIDTH - 100, '', percentage);
    
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
      const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica-Bold');
      doc.text(categoryName, MARGIN, y);
      y += 16;
      
      items.forEach((item: any) => {
        if (y > PAGE_HEIGHT - 50) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }
        
        const checkMark = item.checked ? '✓' : '○';
        const checkColor = item.checked ? COLORS.success : COLORS.textLight;
        
        doc.fontSize(9).fillColor(checkColor).font('Helvetica-Bold');
        doc.text(checkMark, MARGIN + 10, y);
        doc.fontSize(9).fillColor(item.checked ? COLORS.text : COLORS.textSecondary).font('Helvetica');
        doc.text(item.label || item.text || 'Item', MARGIN + 25, y, { width: CONTENT_WIDTH - 40 });
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
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('LOAN CALCULATOR RESULTS', MARGIN + 15, y + 12);
    
    const col1X = MARGIN + 15;
    const col2X = MARGIN + CONTENT_WIDTH / 2;
    let calcY = y + 38;
    
    renderDetailRow(doc, col1X, calcY, 'Principal Amount', formatCurrency((calc.loanAmount || 0) * 100));
    renderDetailRow(doc, col2X, calcY, 'Interest Rate', `${calc.interestRate || 0}% p.a.`);
    calcY += 30;
    
    renderDetailRow(doc, col1X, calcY, 'Term', `${calc.termMonths || calc.term || 0} months`);
    if (calc.monthlyPayment != null) {
      renderDetailRow(doc, col2X, calcY, 'Monthly Payment', formatCurrency(calc.monthlyPayment * 100));
    }
    calcY += 30;
    
    if (calc.totalInterest != null) {
      renderDetailRow(doc, col1X, calcY, 'Total Interest', formatCurrency(calc.totalInterest * 100));
    }
    if (calc.totalRepayable != null) {
      renderDetailRow(doc, col2X, calcY, 'Total Repayable', formatCurrency(calc.totalRepayable * 100));
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
    const dscrStatus = dscr >= 1.25 ? 'PASS' : dscr >= 1.0 ? 'CAUTION' : 'FAIL';
    const dscrColor = dscr >= 1.25 ? COLORS.success : dscr >= 1.0 ? COLORS.warning : COLORS.danger;
    
    doc.rect(MARGIN, y, CONTENT_WIDTH, 130).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(MARGIN, y, 4, 130).fill(dscrColor);
    
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('DEBT SERVICE COVERAGE RATIO (DSCR)', MARGIN + 15, y + 12);
    
    // Large DSCR value
    doc.fontSize(40).fillColor(dscrColor).font('Helvetica-Bold');
    doc.text(dscr.toFixed(2), MARGIN + 15, y + 35);
    
    // Status badge
    doc.rect(MARGIN + 130, y + 45, 70, 26).fill(dscrColor);
    doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold');
    doc.text(dscrStatus, MARGIN + 145, y + 52);
    
    // Details
    const detailsX = MARGIN + 220;
    let detailsY = y + 38;
    doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
    
    if (dscrData.netOperatingIncome != null) {
      doc.text(`Net Operating Income: ${formatCurrency(dscrData.netOperatingIncome * 100)}`, detailsX, detailsY);
      detailsY += 16;
    }
    if (dscrData.annualDebtService != null) {
      doc.text(`Annual Debt Service: ${formatCurrency(dscrData.annualDebtService * 100)}`, detailsX, detailsY);
      detailsY += 16;
    }
    doc.text('Minimum threshold: 1.25', detailsX, detailsY);
    
    // Interpretation
    doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
    const interpretation = dscr >= 1.25 
      ? 'The borrower can comfortably service the debt with income to spare.'
      : dscr >= 1.0 
        ? 'The borrower can just cover debt payments with minimal buffer.'
        : 'The borrower cannot fully cover debt service obligations.';
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
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('AFFORDABILITY ASSESSMENT', MARGIN + 15, y + 12);
    
    const col1X = MARGIN + 15;
    const col2X = MARGIN + CONTENT_WIDTH / 2;
    let affY = y + 38;
    
    if (afford.monthlyIncome != null) {
      renderDetailRow(doc, col1X, affY, 'Monthly Income', formatCurrency(afford.monthlyIncome * 100));
    }
    if (afford.monthlyExpenses != null) {
      renderDetailRow(doc, col2X, affY, 'Monthly Expenses', formatCurrency(afford.monthlyExpenses * 100));
    }
    affY += 30;
    
    if (afford.disposableIncome != null) {
      renderDetailRow(doc, col1X, affY, 'Disposable Income', formatCurrency(afford.disposableIncome * 100));
    }
    if (afford.maxAffordablePayment != null) {
      renderDetailRow(doc, col2X, affY, 'Max Affordable Payment', formatCurrency(afford.maxAffordablePayment * 100));
    }
    affY += 30;
    
    if (afford.maxLoanAmount != null) {
      renderDetailRow(doc, col1X, affY, 'Maximum Loan Amount', formatCurrency(afford.maxLoanAmount * 100));
    }
    
    y += 135;
  }
  
  // ==========================================
  // 5. FINANCIAL RATIOS - Expanded
  // ==========================================
  if (ddData.financialRatios) {
    const ratios = ddData.financialRatios;
    const hasAnyRatio = ratios.profitMargin != null || ratios.currentRatio != null || 
                        ratios.debtToEquity != null || ratios.returnOnEquity != null ||
                        ratios.quickRatio != null || ratios.assetTurnover != null;
    
    if (hasAnyRatio) {
      if (y > PAGE_HEIGHT - 180) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 140).fillAndStroke(COLORS.white, COLORS.border);
      doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
      doc.text('FINANCIAL RATIOS ANALYSIS', MARGIN + 15, y + 12);
      
      const ratioBoxWidth = (CONTENT_WIDTH - 75) / 4;
      let ratioX = MARGIN + 15;
      let ratioY = y + 40;
      let ratioCount = 0;
      
      const ratiosList = [
        { key: 'profitMargin', label: 'Profit Margin', format: (v: number) => `${v.toFixed(1)}%` },
        { key: 'grossMargin', label: 'Gross Margin', format: (v: number) => `${v.toFixed(1)}%` },
        { key: 'currentRatio', label: 'Current Ratio', format: (v: number) => v.toFixed(2) },
        { key: 'quickRatio', label: 'Quick Ratio', format: (v: number) => v.toFixed(2) },
        { key: 'debtToEquity', label: 'Debt/Equity', format: (v: number) => v.toFixed(2) },
        { key: 'returnOnEquity', label: 'ROE', format: (v: number) => `${v.toFixed(1)}%` },
        { key: 'returnOnAssets', label: 'ROA', format: (v: number) => `${v.toFixed(1)}%` },
        { key: 'assetTurnover', label: 'Asset Turnover', format: (v: number) => v.toFixed(2) },
      ];
      
      ratiosList.forEach((ratio) => {
        if (ratios[ratio.key] != null) {
          if (ratioCount > 0 && ratioCount % 4 === 0) {
            ratioX = MARGIN + 15;
            ratioY += 55;
          }
          renderSmallMetricBox(doc, ratioX, ratioY, ratioBoxWidth, ratio.label, ratio.format(ratios[ratio.key]));
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
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('CHARACTER ASSESSMENT', MARGIN + 15, y + 12);
    
    let charY = y + 35;
    const assessmentFields = [
      { key: 'businessExperience', label: 'Business Experience' },
      { key: 'industryExperience', label: 'Industry Experience' },
      { key: 'managementCapability', label: 'Management Capability' },
      { key: 'financialTrackRecord', label: 'Financial Track Record' },
      { key: 'creditHistory', label: 'Credit History' },
      { key: 'referencesAvailable', label: 'References Available' },
    ];
    
    const colWidth = (CONTENT_WIDTH - 40) / 2;
    assessmentFields.forEach((field, index) => {
      const colX = index % 2 === 0 ? MARGIN + 15 : MARGIN + colWidth + 25;
      if (index > 0 && index % 2 === 0) charY += 22;
      
      if (charAssess[field.key] != null) {
        const value = charAssess[field.key];
        const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                            typeof value === 'number' ? `${value}/10` : String(value);
        
        doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
        doc.text(field.label + ':', colX, charY);
        doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold');
        doc.text(displayValue, colX + 120, charY);
      }
    });
    
    // Notes if available
    if (charAssess.notes) {
      charY += 30;
      doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
      doc.text('Notes:', MARGIN + 15, charY);
      doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
      doc.text(charAssess.notes, MARGIN + 15, charY + 14, { width: CONTENT_WIDTH - 30 });
    }
    
    y += 175;
  }
  
  // ==========================================
  // 7. CREDIT UNDERWRITING (Premium Feature)
  // ==========================================
  if (ddData.creditUnderwriting) {
    const cu = ddData.creditUnderwriting;
    
    // New page for Credit Underwriting section
    doc.addPage();
    pageNumber++;
    renderSectionHeader(doc, 'Credit Underwriting Analysis', '14');
    y = doc.y + 10;
    
    // 7.1 Risk Grade Summary
    if (cu.riskGrade || cu.finalRiskGrade) {
      const riskGrade = cu.finalRiskGrade || cu.riskGrade || 'N/A';
      const riskColor = getRiskGradeColor(riskGrade);
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 90).fillAndStroke(riskColor + '15', riskColor);
      
      doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
      doc.text('OVERALL RISK ASSESSMENT', MARGIN + 15, y + 12);
      
      // Large risk grade
      doc.fontSize(48).fillColor(riskColor).font('Helvetica-Bold');
      doc.text(riskGrade, MARGIN + 15, y + 32);
      
      // Risk grade description
      const gradeDescriptions: Record<string, string> = {
        'A': 'Excellent - Low risk, strong financials',
        'B': 'Good - Acceptable risk with minor concerns',
        'C': 'Fair - Moderate risk requiring attention',
        'D': 'Poor - High risk with significant concerns',
        'E': 'Very High Risk - Severe concerns identified',
      };
      doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
      doc.text(gradeDescriptions[riskGrade] || 'Risk assessment completed', MARGIN + 100, y + 55);
      
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
      
      doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
      doc.text('ELIGIBILITY CHECK', MARGIN + 15, y + 12);
      
      // Eligibility status
      doc.fontSize(14).fillColor(eligColor).font('Helvetica-Bold');
      doc.text(isEligible ? 'ELIGIBLE' : 'INELIGIBLE', MARGIN + 15, y + 35);
      
      // Count passed/failed if answers available
      if (cu.eligibilityAnswers && typeof cu.eligibilityAnswers === 'object') {
        const answers = Object.values(cu.eligibilityAnswers);
        const passed = answers.filter((a: any) => a === true).length;
        const total = answers.length;
        
        doc.fontSize(10).fillColor(COLORS.textSecondary).font('Helvetica');
        doc.text(`${passed} of ${total} policy criteria met`, MARGIN + 15, y + 55);
      }
      
      y += 95;
    }
    
    // 7.3 Financial Analysis (AI-powered)
    if (cu.analysis || cu.financialAnalysis) {
      const analysis = cu.analysis || cu.financialAnalysis;
      
      if (y > PAGE_HEIGHT - 250) {
        doc.addPage();
        pageNumber++;
        y = MARGIN + 20;
      }
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 200).fillAndStroke(COLORS.backgroundLight, COLORS.border);
      doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
      doc.text('AI-POWERED FINANCIAL ANALYSIS', MARGIN + 15, y + 12);
      
      let analysisY = y + 35;
      const col1X = MARGIN + 15;
      const col2X = MARGIN + CONTENT_WIDTH / 2;
      
      // Key metrics
      if (analysis.averageMonthlyRevenue != null) {
        renderDetailRow(doc, col1X, analysisY, 'Avg Monthly Revenue', formatCurrency(analysis.averageMonthlyRevenue * 100));
      }
      if (analysis.averageMonthlyExpenses != null) {
        renderDetailRow(doc, col2X, analysisY, 'Avg Monthly Expenses', formatCurrency(analysis.averageMonthlyExpenses * 100));
      }
      analysisY += 30;
      
      if (analysis.netDisposableIncome != null) {
        renderDetailRow(doc, col1X, analysisY, 'Net Disposable Income', formatCurrency(analysis.netDisposableIncome * 100));
      }
      if (analysis.dscr != null) {
        const dscrVal = analysis.dscr;
        const dscrColor = dscrVal >= 1.25 ? COLORS.success : dscrVal >= 1.0 ? COLORS.warning : COLORS.danger;
        doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
        doc.text('DSCR', col2X, analysisY);
        doc.fontSize(11).fillColor(dscrColor).font('Helvetica-Bold');
        doc.text(dscrVal.toFixed(2), col2X, analysisY + 12);
      }
      analysisY += 35;
      
      // P&L Summary
      if (analysis.profitAndLoss) {
        const pnl = analysis.profitAndLoss;
        doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica-Bold');
        doc.text('Profit & Loss Summary', col1X, analysisY);
        analysisY += 18;
        
        if (pnl.turnover != null) {
          doc.fontSize(9).fillColor(COLORS.textSecondary).font('Helvetica');
          doc.text(`Turnover: ${formatCurrency(pnl.turnover * 100)}`, col1X, analysisY);
        }
        if (pnl.grossProfit != null) {
          doc.text(`Gross Profit: ${formatCurrency(pnl.grossProfit * 100)}`, col2X, analysisY);
        }
        analysisY += 14;
        
        if (pnl.netProfit != null) {
          doc.text(`Net Profit: ${formatCurrency(pnl.netProfit * 100)}`, col1X, analysisY);
        }
        if (pnl.periodMonths != null) {
          doc.text(`Period: ${pnl.periodMonths} months`, col2X, analysisY);
        }
      }
      
      // Summary text
      if (analysis.summary) {
        analysisY += 25;
        doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
        doc.text(truncateText(analysis.summary, 300), col1X, analysisY, { width: CONTENT_WIDTH - 30 });
      }
      
      y += 215;
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
        doc.rect(MARGIN, y, CONTENT_WIDTH, flagHeight).fillAndStroke(COLORS.danger + '10', COLORS.danger);
        
        doc.fontSize(11).fillColor(COLORS.danger).font('Helvetica-Bold');
        doc.text('⚠ RED FLAGS IDENTIFIED', MARGIN + 15, y + 12);
        
        let flagY = y + 35;
        activeFlags.forEach((flag: any) => {
          if (flagY < y + flagHeight - 10) {
            doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
            doc.text(`• ${flag.label || flag.description || 'Concern identified'}`, MARGIN + 20, flagY);
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
      
      const riskLevel = ddChecks.riskLevel || 'MEDIUM';
      const riskColor = riskLevel === 'LOW' ? COLORS.success : riskLevel === 'HIGH' ? COLORS.danger : COLORS.warning;
      
      doc.rect(MARGIN, y, CONTENT_WIDTH, 140).fillAndStroke(COLORS.white, COLORS.border);
      doc.rect(MARGIN, y, 4, 140).fill(riskColor);
      
      doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
      doc.text('DUE DILIGENCE CHECKS', MARGIN + 15, y + 12);
      
      // Risk level badge
      doc.rect(MARGIN + 180, y + 8, 60, 20).fill(riskColor);
      doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold');
      doc.text(riskLevel + ' RISK', MARGIN + 190, y + 14);
      
      let ddY = y + 38;
      
      // Summary
      if (ddChecks.summary) {
        doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
        doc.text(truncateText(ddChecks.summary, 200), MARGIN + 15, ddY, { width: CONTENT_WIDTH - 30 });
        ddY += 35;
      }
      
      // Web/Adverse Media Summary
      if (ddChecks.webSummary) {
        doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica-Bold');
        doc.text('Adverse Media Search:', MARGIN + 15, ddY);
        ddY += 14;
        doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
        doc.text(truncateText(ddChecks.webSummary, 180), MARGIN + 15, ddY, { width: CONTENT_WIDTH - 30 });
        ddY += 30;
      }
      
      // Flags
      if (ddChecks.flags && Array.isArray(ddChecks.flags) && ddChecks.flags.length > 0) {
        doc.fontSize(9).fillColor(COLORS.warning).font('Helvetica-Bold');
        doc.text('Flags:', MARGIN + 15, ddY);
        ddY += 14;
        doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
        ddChecks.flags.slice(0, 3).forEach((flag: string) => {
          doc.text(`• ${flag}`, MARGIN + 20, ddY);
          ddY += 14;
        });
      }
      
      y += 155;
    }
    
    // 7.6 Adviser Summary (CAMPARI Framework)
    if (cu.adviserSummary) {
      const adviser = cu.adviserSummary;
      
      doc.addPage();
      pageNumber++;
      renderSectionHeader(doc, 'Adviser Summary - CAMPARI Framework', '15');
      y = doc.y + 10;
      
      // Header info
      doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
      
      const col1X = MARGIN + 15;
      const col2X = MARGIN + CONTENT_WIDTH / 2;
      let advY = y + 15;
      
      if (adviser.businessName) {
        renderDetailRow(doc, col1X, advY, 'Business Name', adviser.businessName);
      }
      if (adviser.soarRef) {
        renderDetailRow(doc, col2X, advY, 'Reference', adviser.soarRef);
      }
      advY += 30;
      
      if (adviser.product) {
        renderDetailRow(doc, col1X, advY, 'Product', adviser.product);
      }
      if (adviser.amount) {
        renderDetailRow(doc, col2X, advY, 'Amount', formatCurrency(adviser.amount * 100));
      }
      
      y += 95;
      
      // CAMPARI sections
      if (adviser.sections && typeof adviser.sections === 'object') {
        const campariOrder = ['character', 'ability', 'margin', 'purpose', 'amount', 'repayment', 'insurance'];
        const campariLabels: Record<string, string> = {
          character: 'CHARACTER - Management & Background',
          ability: 'ABILITY - Capacity to Repay',
          margin: 'MARGIN - Return & Pricing',
          purpose: 'PURPOSE - Loan Purpose & Rationale',
          amount: 'AMOUNT - Funding Requirement',
          repayment: 'REPAYMENT - Source & Terms',
          insurance: 'INSURANCE - Security & Risk Mitigation',
        };
        
        campariOrder.forEach((key) => {
          const content = adviser.sections[key];
          if (!content) return;
          
          if (y > PAGE_HEIGHT - 120) {
            doc.addPage();
            pageNumber++;
            y = MARGIN + 20;
          }
          
          doc.rect(MARGIN, y, CONTENT_WIDTH, 80).fillAndStroke(COLORS.white, COLORS.border);
          doc.rect(MARGIN, y, 4, 80).fill(COLORS.secondary);
          
          doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica-Bold');
          doc.text(campariLabels[key] || key.toUpperCase(), MARGIN + 15, y + 12);
          
          doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
          doc.text(truncateText(content, 400), MARGIN + 15, y + 30, { width: CONTENT_WIDTH - 30 });
          
          y += 90;
        });
      }
      
      // Questionnaire
      if (adviser.questionnaire && typeof adviser.questionnaire === 'object') {
        if (y > PAGE_HEIGHT - 150) {
          doc.addPage();
          pageNumber++;
          y = MARGIN + 20;
        }
        
        doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
        doc.text('Credit Committee Questionnaire', MARGIN, y);
        y += 25;
        
        const questions = Object.entries(adviser.questionnaire);
        questions.forEach(([question, answer]) => {
          if (y > PAGE_HEIGHT - 40) {
            doc.addPage();
            pageNumber++;
            y = MARGIN + 20;
          }
          
          const ansColor = answer === 'Yes' ? COLORS.success : answer === 'No' ? COLORS.danger : COLORS.textSecondary;
          doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
          doc.text(`• ${question}`, MARGIN + 10, y, { width: CONTENT_WIDTH - 80 });
          doc.fontSize(9).fillColor(ansColor).font('Helvetica-Bold');
          doc.text(String(answer || 'N/A'), PAGE_WIDTH - MARGIN - 50, y);
          y += 20;
        });
      }
    }
    
    // 7.7 Audited Accounts Analysis
    if (cu.auditedAccountsAnalysis) {
      const accounts = cu.auditedAccountsAnalysis;
      
      doc.addPage();
      pageNumber++;
      renderSectionHeader(doc, 'Audited Accounts Analysis', '16');
      y = doc.y + 10;
      
      // Risk assessment
      if (accounts.riskAssessment) {
        const riskColor = accounts.riskAssessment === 'low' ? COLORS.success : 
                         accounts.riskAssessment === 'high' ? COLORS.danger : COLORS.warning;
        
        doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fillAndStroke(riskColor + '15', riskColor);
        doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
        doc.text('ACCOUNTS RISK ASSESSMENT', MARGIN + 15, y + 12);
        doc.fontSize(20).fillColor(riskColor).font('Helvetica-Bold');
        doc.text(accounts.riskAssessment.toUpperCase(), MARGIN + 15, y + 32);
        
        y += 75;
      }
      
      // Year-by-year data
      if (accounts.years && Array.isArray(accounts.years)) {
        doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
        doc.text('Financial Performance by Year', MARGIN, y);
        y += 25;
        
        accounts.years.forEach((year: any) => {
          if (y > PAGE_HEIGHT - 120) {
            doc.addPage();
            pageNumber++;
            y = MARGIN + 20;
          }
          
          doc.rect(MARGIN, y, CONTENT_WIDTH, 90).fillAndStroke(COLORS.white, COLORS.border);
          doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica-Bold');
          doc.text(`Year Ending: ${year.yearEnding || 'N/A'}`, MARGIN + 15, y + 12);
          
          const col1X = MARGIN + 15;
          const col2X = MARGIN + CONTENT_WIDTH / 3;
          const col3X = MARGIN + (CONTENT_WIDTH / 3) * 2;
          let yearY = y + 35;
          
          if (year.turnover != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font('Helvetica');
            doc.text('Turnover', col1X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
            doc.text(formatCurrency(year.turnover * 100), col1X, yearY + 12);
          }
          if (year.netProfit != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font('Helvetica');
            doc.text('Net Profit', col2X, yearY);
            doc.fontSize(10).fillColor(year.netProfit >= 0 ? COLORS.success : COLORS.danger).font('Helvetica-Bold');
            doc.text(formatCurrency(year.netProfit * 100), col2X, yearY + 12);
          }
          if (year.netAssets != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font('Helvetica');
            doc.text('Net Assets', col3X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
            doc.text(formatCurrency(year.netAssets * 100), col3X, yearY + 12);
          }
          
          yearY += 35;
          if (year.shareholderFunds != null) {
            doc.fontSize(8).fillColor(COLORS.textSecondary).font('Helvetica');
            doc.text('Shareholder Funds', col1X, yearY);
            doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold');
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
        
        const trendColor = accounts.trends.trend === 'improving' ? COLORS.success :
                          accounts.trends.trend === 'declining' ? COLORS.danger : COLORS.warning;
        
        doc.rect(MARGIN, y, CONTENT_WIDTH, 70).fillAndStroke(COLORS.backgroundLight, COLORS.border);
        doc.rect(MARGIN, y, 4, 70).fill(trendColor);
        
        doc.fontSize(10).fillColor(COLORS.secondary).font('Helvetica-Bold');
        doc.text('TREND ANALYSIS', MARGIN + 15, y + 12);
        doc.fontSize(12).fillColor(trendColor).font('Helvetica-Bold');
        doc.text(capitalizeStage(accounts.trends.trend || 'stable'), MARGIN + 120, y + 10);
        
        if (accounts.trends.summary) {
          doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
          doc.text(truncateText(accounts.trends.summary, 250), MARGIN + 15, y + 35, { width: CONTENT_WIDTH - 30 });
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
        
        doc.fontSize(11).fillColor(COLORS.warning).font('Helvetica-Bold');
        doc.text('⚠ Concerns Identified', MARGIN, y);
        y += 20;
        
        accounts.concerns.forEach((concern: any) => {
          if (y > PAGE_HEIGHT - 50) return;
          
          const severityColor = concern.severity === 'high' ? COLORS.danger :
                               concern.severity === 'medium' ? COLORS.warning : COLORS.textSecondary;
          
          doc.fontSize(9).fillColor(severityColor).font('Helvetica-Bold');
          doc.text(`[${(concern.severity || 'low').toUpperCase()}]`, MARGIN + 10, y);
          doc.fontSize(9).fillColor(COLORS.text).font('Helvetica');
          doc.text(concern.description || 'Concern identified', MARGIN + 60, y, { width: CONTENT_WIDTH - 80 });
          y += 18;
        });
      }
    }
  }
}

// Helper function for risk grade colors
function getRiskGradeColor(grade: string): string {
  const gradeColors: Record<string, string> = {
    'A': COLORS.success,
    'B': '#22C55E',
    'C': COLORS.warning,
    'D': '#F97316',
    'E': COLORS.danger,
  };
  return gradeColors[grade] || COLORS.textSecondary;
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function renderSmallMetricBox(doc: typeof PDFDocument.prototype, x: number, y: number, width: number, label: string, value: string) {
  doc.rect(x, y, width, 50).fillAndStroke(COLORS.backgroundMuted, COLORS.border);
  
  doc.fontSize(8).fillColor(COLORS.textSecondary).font('Helvetica');
  doc.text(label.toUpperCase(), x + 8, y + 8, { width: width - 16, align: 'center' });
  
  doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text(value, x + 8, y + 26, { width: width - 16, align: 'center' });
}

function renderPageFooter(doc: typeof PDFDocument.prototype, currentPage: number, totalPages: number) {
  const footerY = PAGE_HEIGHT - 35;
  
  // Footer line
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN, footerY).lineTo(PAGE_WIDTH - MARGIN, footerY).stroke();
  
  // FlowLoan branding
  doc.fontSize(8).fillColor(COLORS.textLight).font('Helvetica');
  doc.text('FlowLoan • Commercial Lending Solutions', MARGIN, footerY + 10);
  
  // Confidential notice
  doc.text('CONFIDENTIAL', PAGE_WIDTH / 2 - 30, footerY + 10);
  
  // Page number
  doc.text(`Page ${currentPage} of ${totalPages}`, PAGE_WIDTH - MARGIN - 50, footerY + 10);
}

// Helper functions
function checkHasCollateral(prospect: ProspectWithCompany): boolean {
  return (prospect.directorsGuarantee != null && prospect.directorsGuarantee > 0) || 
    (prospect.commercialProperty != null && prospect.commercialProperty > 0) || 
    (prospect.homeEquity != null && prospect.homeEquity > 0) || 
    (prospect.propertyOther != null && prospect.propertyOther > 0) || 
    (prospect.debenture != null && prospect.debenture > 0) || 
    (prospect.parentCompanyGuarantee != null && prospect.parentCompanyGuarantee > 0) || 
    (prospect.collateral != null && prospect.collateral > 0) || 
    (prospect.crossCompanyGuarantee != null && prospect.crossCompanyGuarantee > 0);
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
  if (prospect.directorsGuarantee && prospect.directorsGuarantee > 0) types.push('PG');
  if (prospect.commercialProperty && prospect.commercialProperty > 0) types.push('Commercial');
  if (prospect.homeEquity && prospect.homeEquity > 0) types.push('Residential');
  if (prospect.propertyOther && prospect.propertyOther > 0) types.push('Other Property');
  if (prospect.debenture && prospect.debenture > 0) types.push('Debenture');
  if (prospect.parentCompanyGuarantee && prospect.parentCompanyGuarantee > 0) types.push('Parent Guarantee');
  if (prospect.collateral && prospect.collateral > 0) types.push('Other');
  if (prospect.crossCompanyGuarantee && prospect.crossCompanyGuarantee > 0) types.push('Cross Guarantee');
  return types;
}

function getStageColor(stage: string): string {
  const stageColors: { [key: string]: string } = {
    'lead': '#6B7280',
    'contacted': '#3B82F6',
    'qualified': '#8B5CF6',
    'proposal': '#F59E0B',
    'due-diligence': '#EC4899',
    'approval': '#10B981',
    'approved': '#059669',
    'declined': '#DC2626',
    'withdrawn': '#6B7280',
  };
  return stageColors[stage] || COLORS.textSecondary;
}

function formatCurrency(amountInPence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInPence / 100);
}

function capitalizeStage(stage: string): string {
  return stage
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
