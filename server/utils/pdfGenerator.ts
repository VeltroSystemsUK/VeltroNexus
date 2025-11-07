import PDFDocument from 'pdfkit';
import type { ProspectWithCompany, Contact, Activity, DueDiligence } from '@shared/schema';

interface ProspectReportData {
  prospect: ProspectWithCompany;
  contacts: Contact[];
  activities: Activity[];
  dueDiligence?: DueDiligence;
}

export function generateProspectReport(data: ProspectReportData): PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const { prospect, contacts, activities, dueDiligence } = data;

  const headerColor = '#3b82f6';
  const textColor = '#1f2937';
  const mutedColor = '#6b7280';

  doc.fontSize(24).fillColor(headerColor).text('Prospect Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor(mutedColor).text(new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(18).fillColor(headerColor).text('Company Information');
  doc.moveDown(0.5);
  addLine(doc);
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor(textColor);
  addField(doc, 'Company Name:', prospect.company.companyName);
  addField(doc, 'Company Number:', prospect.company.companyNumber);
  if (prospect.company.registeredAddress) {
    addField(doc, 'Registered Address:', prospect.company.registeredAddress);
  }
  if (prospect.company.incorporationDate) {
    addField(doc, 'Incorporation Date:', prospect.company.incorporationDate);
  }
  if (prospect.company.companyStatus) {
    addField(doc, 'Company Status:', prospect.company.companyStatus);
  }
  if (prospect.company.companyType) {
    addField(doc, 'Company Type:', prospect.company.companyType);
  }
  doc.moveDown(2);

  doc.fontSize(18).fillColor(headerColor).text('Loan Details');
  doc.moveDown(0.5);
  addLine(doc);
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor(textColor);
  addField(doc, 'Current Stage:', capitalizeStage(prospect.stage));
  if (prospect.loanAmount) {
    addField(doc, 'Loan Amount:', formatCurrency(prospect.loanAmount));
  }
  if (prospect.term) {
    addField(doc, 'Term:', `${prospect.term} months`);
  }
  if (prospect.interestRate) {
    addField(doc, 'Interest Rate:', `${prospect.interestRate}%`);
  }
  if (prospect.priority) {
    addField(doc, 'Priority:', capitalizeStage(prospect.priority));
  }
  doc.moveDown(2);

  const hasCollateral = prospect.directorsGuarantee || prospect.commercialProperty || 
    prospect.homeEquity || prospect.propertyOther || prospect.debenture || 
    prospect.parentCompanyGuarantee || prospect.collateral || prospect.crossCompanyGuarantee;

  if (hasCollateral) {
    doc.fontSize(18).fillColor(headerColor).text('Security & Collateral');
    doc.moveDown(0.5);
    addLine(doc);
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(textColor);

    if (prospect.directorsGuarantee) {
      addField(doc, 'Directors Guarantee:', formatCurrency(prospect.directorsGuarantee));
    }
    if (prospect.commercialProperty) {
      addField(doc, 'Commercial Property:', formatCurrency(prospect.commercialProperty));
    }
    if (prospect.homeEquity) {
      addField(doc, 'Home Equity:', formatCurrency(prospect.homeEquity));
    }
    if (prospect.propertyOther) {
      addField(doc, 'Other Property:', formatCurrency(prospect.propertyOther));
    }
    if (prospect.debenture) {
      addField(doc, 'Debenture:', formatCurrency(prospect.debenture));
    }
    if (prospect.parentCompanyGuarantee) {
      addField(doc, 'Parent Company Guarantee:', formatCurrency(prospect.parentCompanyGuarantee));
    }
    if (prospect.collateral) {
      addField(doc, 'Other Collateral:', formatCurrency(prospect.collateral));
    }
    if (prospect.crossCompanyGuarantee) {
      addField(doc, 'Cross Company Guarantee:', formatCurrency(prospect.crossCompanyGuarantee));
    }
    doc.moveDown(2);
  }

  if (prospect.loanRequirementNotes || prospect.notes) {
    doc.fontSize(18).fillColor(headerColor).text('Notes');
    doc.moveDown(0.5);
    addLine(doc);
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(textColor);
    
    if (prospect.loanRequirementNotes) {
      addField(doc, 'Loan Requirements:', prospect.loanRequirementNotes, true);
    }
    if (prospect.notes) {
      addField(doc, 'Additional Notes:', prospect.notes, true);
    }
    doc.moveDown(2);
  }

  if (contacts.length > 0) {
    doc.fontSize(18).fillColor(headerColor).text('Key Contacts');
    doc.moveDown(0.5);
    addLine(doc);
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(textColor);

    contacts.forEach((contact, index) => {
      if (index > 0) doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text(contact.name, { continued: contact.isPrimary === 1 });
      if (contact.isPrimary === 1) {
        doc.font('Helvetica').fillColor(headerColor).text(' (Primary)', { continued: false });
        doc.fillColor(textColor);
      } else {
        doc.font('Helvetica');
      }
      if (contact.role) {
        doc.fontSize(10).fillColor(mutedColor).text(`Role: ${contact.role}`);
      }
      if (contact.email) {
        doc.fontSize(10).fillColor(mutedColor).text(`Email: ${contact.email}`);
      }
      if (contact.phone) {
        doc.fontSize(10).fillColor(mutedColor).text(`Phone: ${contact.phone}`);
      }
      doc.fontSize(12).fillColor(textColor);
    });
    doc.moveDown(2);
  }

  if (activities.length > 0) {
    doc.fontSize(18).fillColor(headerColor).text('Activities & Tasks');
    doc.moveDown(0.5);
    addLine(doc);
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(textColor);

    const pendingActivities = activities.filter(a => a.completed === 0);
    const completedActivities = activities.filter(a => a.completed === 1);

    if (pendingActivities.length > 0) {
      doc.font('Helvetica-Bold').text('Pending Tasks:');
      doc.font('Helvetica').moveDown(0.3);
      pendingActivities.forEach((activity) => {
        doc.text(`• ${activity.title}`, { indent: 10 });
        if (activity.description) {
          doc.fontSize(10).fillColor(mutedColor).text(activity.description, { indent: 20 });
          doc.fontSize(12).fillColor(textColor);
        }
        if (activity.dueDate) {
          doc.fontSize(10).fillColor(mutedColor).text(
            `Due: ${new Date(activity.dueDate).toLocaleDateString('en-GB')}`,
            { indent: 20 }
          );
          doc.fontSize(12).fillColor(textColor);
        }
        doc.moveDown(0.3);
      });
      doc.moveDown(0.5);
    }

    if (completedActivities.length > 0) {
      doc.font('Helvetica-Bold').text('Completed Tasks:');
      doc.font('Helvetica').moveDown(0.3);
      completedActivities.forEach((activity) => {
        doc.text(`✓ ${activity.title}`, { indent: 10 });
        if (activity.description) {
          doc.fontSize(10).fillColor(mutedColor).text(activity.description, { indent: 20 });
          doc.fontSize(12).fillColor(textColor);
        }
        doc.moveDown(0.3);
      });
    }
    doc.moveDown(2);
  }

  if (dueDiligence?.data) {
    const ddData = dueDiligence.data as any;
    
    if (ddData.checklist) {
      doc.fontSize(18).fillColor(headerColor).text('Due Diligence Checklist');
      doc.moveDown(0.5);
      addLine(doc);
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(textColor);
      
      const totalItems = Object.values(ddData.checklist).flat().length;
      const completedItems = Object.values(ddData.checklist).flat().filter((item: any) => item.checked).length;
      const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      addField(doc, 'Progress:', `${completedItems} of ${totalItems} items (${percentage}%)`);
      doc.moveDown(1);
    }

    if (ddData.loanCalculator) {
      const calc = ddData.loanCalculator;
      if (calc.loanAmount && calc.interestRate && calc.term) {
        doc.fontSize(18).fillColor(headerColor).text('Loan Calculator Results');
        doc.moveDown(0.5);
        addLine(doc);
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor(textColor);
        
        addField(doc, 'Principal:', formatCurrency(calc.loanAmount * 100));
        addField(doc, 'Interest Rate:', `${calc.interestRate}%`);
        addField(doc, 'Term:', `${calc.term} months`);
        if (calc.monthlyPayment) {
          addField(doc, 'Monthly Payment:', formatCurrency(calc.monthlyPayment * 100));
        }
        if (calc.totalInterest) {
          addField(doc, 'Total Interest:', formatCurrency(calc.totalInterest * 100));
        }
        doc.moveDown(2);
      }
    }

    if (ddData.dscrCalculator) {
      const dscr = ddData.dscrCalculator;
      if (dscr.dscr) {
        doc.fontSize(18).fillColor(headerColor).text('DSCR Analysis');
        doc.moveDown(0.5);
        addLine(doc);
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor(textColor);
        
        addField(doc, 'DSCR Ratio:', dscr.dscr.toFixed(2));
        addField(doc, 'Status:', dscr.dscr >= 1.25 ? 'PASS' : dscr.dscr >= 1.0 ? 'WARNING' : 'FAIL');
        doc.moveDown(2);
      }
    }

    if (ddData.financialRatios) {
      const ratios = ddData.financialRatios;
      if (ratios.profitMargin || ratios.currentRatio || ratios.debtToEquity || ratios.returnOnEquity || ratios.assetTurnover) {
        doc.fontSize(18).fillColor(headerColor).text('Financial Ratios');
        doc.moveDown(0.5);
        addLine(doc);
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor(textColor);
        
        if (ratios.profitMargin) addField(doc, 'Profit Margin:', `${ratios.profitMargin.toFixed(2)}%`);
        if (ratios.currentRatio) addField(doc, 'Current Ratio:', ratios.currentRatio.toFixed(2));
        if (ratios.debtToEquity) addField(doc, 'Debt-to-Equity:', ratios.debtToEquity.toFixed(2));
        if (ratios.returnOnEquity) addField(doc, 'Return on Equity:', `${ratios.returnOnEquity.toFixed(2)}%`);
        if (ratios.assetTurnover) addField(doc, 'Asset Turnover:', ratios.assetTurnover.toFixed(2));
        doc.moveDown(2);
      }
    }
  }

  doc.fontSize(10).fillColor(mutedColor).text(
    `Generated by FlowLoan on ${new Date().toLocaleString('en-GB')}`,
    50,
    doc.page.height - 50,
    { align: 'center' }
  );

  return doc;
}

function addField(doc: PDFDocument, label: string, value: string, multiline = false) {
  const labelWidth = 150;
  if (multiline) {
    doc.font('Helvetica-Bold').text(label, { continued: false });
    doc.font('Helvetica').text(value, { indent: 10 });
    doc.moveDown(0.5);
  } else {
    doc.font('Helvetica-Bold').text(label, { continued: true, width: labelWidth });
    doc.font('Helvetica').text(value, { continued: false });
    doc.moveDown(0.3);
  }
}

function addLine(doc: PDFDocument) {
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
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
