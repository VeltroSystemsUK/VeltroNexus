import PDFDocument from "pdfkit";
import type { ReportTask, ReportSettings } from "@shared/schema";

const MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter, pdfkit default
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  navy: "#1e3a5f",
  accent: "#2563eb",
  text: "#333333",
  muted: "#6b7280",
  border: "#dfe6e9",
  bgLight: "#f0f4f8",
  danger: "#c0392b",
};

function bufferFromDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtLong(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.navy).text(title);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2).strokeColor(COLORS.border).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.text);
}

// --- Weekly Worksheet (forward-looking, sent Monday) ---

export interface WorksheetData {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  settings: ReportSettings;
  tasks: ReportTask[]; // tasks due within the week
}

export async function generateWorksheetPdf(data: WorksheetData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const { settings, tasks, weekNumber, weekStart, weekEnd } = data;

  // Header bar
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.navy).text("VELTRO NEXUS", MARGIN, MARGIN);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff");
  const tagW = 80;
  doc.rect(MARGIN + CONTENT_WIDTH - tagW, MARGIN, tagW, 18).fill(COLORS.danger);
  doc.fillColor("#fff").fontSize(8).text("CONFIDENTIAL", MARGIN + CONTENT_WIDTH - tagW, MARGIN + 5, { width: tagW, align: "center" });

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.muted)
    .text(`OPERATIONAL WORK SHEET — WEEK ${weekNumber}`, MARGIN, MARGIN + 28);

  // Meta box
  const metaY = MARGIN + 52;
  doc.rect(MARGIN, metaY, CONTENT_WIDTH, 34).fillOpacity(1).fill(COLORS.bgLight);
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(7);
  const cols = [MARGIN + 10, MARGIN + 160, MARGIN + 300, MARGIN + 420];
  const labels = ["PROJECT CODE", "DATE", "VERSION", "PREPARED BY"];
  const values = [settings.projectCode, fmtLong(new Date()), "Auto-generated", settings.preparedByName];
  labels.forEach((l, i) => doc.text(l, cols[i], metaY + 6));
  doc.font("Helvetica").fontSize(9);
  values.forEach((v, i) => doc.text(v || "", cols[i], metaY + 18));

  doc.y = metaY + 46;

  sectionHeader(doc, "1. EXECUTIVE SUMMARY");
  doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text)
    .text(settings.executiveSummary || `Week ${weekNumber} covers the objectives and daily schedule below, generated from the active task board.`, { width: CONTENT_WIDTH, align: "justify" });

  const weekTasks = tasks.slice().sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate as any).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate as any).getTime() : Infinity;
    return da - db;
  });

  sectionHeader(doc, "2. WEEK OBJECTIVES");
  if (weekTasks.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No tasks scheduled for this week yet.");
  } else {
    weekTasks.forEach((t, i) => {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.text).text(`Objective ${i + 1}: `, { continued: true });
      doc.font("Helvetica").text(t.title);
    });
  }

  sectionHeader(doc, "3. DAILY BREAKDOWN");
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) days.push(new Date(weekStart.getTime() + i * 86400000));

  let anyDay = false;
  for (const day of days) {
    const dayTasks = weekTasks.filter((t) => t.dueDate && sameDay(new Date(t.dueDate as any), day));
    if (dayTasks.length === 0) continue;
    anyDay = true;
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.accent).text(fmtDay(day));
    doc.moveDown(0.2);
    drawTable(
      doc,
      ["TIME", "ACTIVITY", "DESCRIPTION"],
      dayTasks.map((t) => [t.timeSlot || "—", t.title, t.notes || ""]),
      [70, 160, CONTENT_WIDTH - 230]
    );
  }
  if (!anyDay) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No day-specific tasks scheduled — add a due date to a task to place it here.");
  }

  sectionHeader(doc, "4. WEEK DELIVERABLES TO-DO LIST");
  if (weekTasks.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No deliverables logged for this week.");
  } else {
    drawChecklist(doc, weekTasks);
  }

  sectionHeader(doc, "5. ENGAGEMENT TERMS");
  drawTable(
    doc,
    ["WEEKLY HOURS", "MONTHLY FEE", "WEEKLY PAYMENT"],
    [[settings.weeklyHours, settings.monthlyFee, settings.weeklyPayment]],
    [CONTENT_WIDTH / 3, CONTENT_WIDTH / 3, CONTENT_WIDTH / 3]
  );

  addFooter(doc, `CONFIDENTIAL — ${settings.recipientName}`);
  return bufferFromDoc(doc);
}

// --- Weekly Progress Report (backward-looking, sent Friday) ---

export interface ProgressReportData {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  settings: ReportSettings;
  completedPlanned: ReportTask[]; // done, had a due date this week
  completedExtra: ReportTask[]; // done, no due date (unplanned wins)
  upcoming: ReportTask[]; // open tasks due next week — for priorities
  summaryText?: string;
}

export async function generateProgressReportPdf(data: ProgressReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const { settings, weekNumber, weekEnd, completedPlanned, completedExtra, upcoming, summaryText } = data;

  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.text).text(`Week ${weekNumber} Progress Report`);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
    .text(`Prepared for ${settings.recipientName} | Week ending ${fmtLong(weekEnd)}`);
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Completed Tasks");
  doc.moveDown(0.2);
  if (completedPlanned.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No planned tasks were marked done this week.");
  } else {
    completedPlanned.forEach((t) => checkBullet(doc, t));
  }

  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Additional Activity");
  doc.moveDown(0.2);
  if (completedExtra.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No additional unplanned activity logged.");
  } else {
    completedExtra.forEach((t) => checkBullet(doc, t));
  }

  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text("Summary");
  doc.moveDown(0.2);
  const summaryLines = (summaryText || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (summaryLines.length > 0) {
    summaryLines.forEach((line) => bullet(doc, line));
  } else if (upcoming.length > 0) {
    bullet(doc, `Week ${weekNumber + 1} priorities: ${upcoming.map((t) => t.title).join(", ")}.`);
  } else {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(COLORS.muted).text("No summary notes added for this week.");
  }

  addFooter(doc, `CONFIDENTIAL — ${settings.recipientName}`);
  return bufferFromDoc(doc);
}

// --- shared drawing helpers ---

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function checkBullet(doc: PDFKit.PDFDocument, t: ReportTask) {
  const day = t.dueDate ? fmtDay(new Date(t.dueDate as any)) : t.completedAt ? fmtDay(new Date(t.completedAt as any)) : "";
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.accent).text("✓ ", { continued: true });
  doc.font("Helvetica").fillColor(COLORS.text).text(`${t.title}${day ? ` — ${day}` : ""}`);
  if (t.notes) {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(t.notes, { indent: 14 });
  }
  doc.moveDown(0.15);
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text(`•  ${text}`);
  doc.moveDown(0.15);
}

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]) {
  const startX = MARGIN;
  let y = doc.y;
  const rowPad = 5;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff");
  const headerH = 18;
  doc.rect(startX, y, CONTENT_WIDTH, headerH).fill(COLORS.navy);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor("#fff").text(h, x + rowPad, y + 5, { width: colWidths[i] - rowPad * 2 });
    x += colWidths[i];
  });
  y += headerH;

  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.text);
  rows.forEach((row, rIdx) => {
    const heights = row.map((cell, i) => doc.heightOfString(cell || "", { width: colWidths[i] - rowPad * 2 }));
    const rowH = Math.max(...heights, 14) + rowPad * 2;

    if (y + rowH > doc.page.height - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }

    if (rIdx % 2 === 1) {
      doc.rect(startX, y, CONTENT_WIDTH, rowH).fill(COLORS.bgLight);
      doc.fillColor(COLORS.text);
    }
    x = startX;
    row.forEach((cell, i) => {
      doc.text(cell || "", x + rowPad, y + rowPad, { width: colWidths[i] - rowPad * 2 });
      x += colWidths[i];
    });
    doc.moveTo(startX, y + rowH).lineTo(startX + CONTENT_WIDTH, y + rowH).strokeColor(COLORS.border).stroke();
    y += rowH;
  });

  doc.y = y + 6;
}

function drawChecklist(doc: PDFKit.PDFDocument, tasks: ReportTask[]) {
  const boxSize = 9;
  tasks.forEach((t) => {
    const y = doc.y;
    doc.rect(MARGIN, y + 1, boxSize, boxSize).strokeColor(COLORS.border).stroke();
    if (t.status === "done") {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.accent).text("X", MARGIN + 1.5, y + 1);
    }
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text(t.title, MARGIN + boxSize + 8, y, { width: CONTENT_WIDTH - boxSize - 8 });
    doc.moveDown(0.25);
  });
}

function addFooter(doc: PDFKit.PDFDocument, text: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted)
      .text(text, MARGIN, doc.page.height - 30, { width: CONTENT_WIDTH, align: "center" });
  }
}
