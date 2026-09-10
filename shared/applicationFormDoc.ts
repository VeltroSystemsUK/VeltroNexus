import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type FileChild,
} from "docx";
import {
  LENDER_LABELS,
  type ApplicationAnswers,
  type ApplicationDirector,
  type LenderCode,
} from "./applicationDataFields";
import { directorSectionsForLender, sectionsForLender } from "./sterlingApplicationPreview";

const A4_W = 11906;
const MARGIN = 900;
const CONTENT_W = A4_W - MARGIN * 2;

const BRAND: Record<LenderCode, { navy: string; ink: string; paper: string; field: string; label: string }> = {
  bcrs: { navy: "1F4E79", ink: "1A1A1A", paper: "FFFFFF", field: "F7F9FB", label: "E8EEF4" },
  cwrt: { navy: "0E5A40", ink: "1A1A1A", paper: "FFFFFF", field: "F3F8F5", label: "E3EFE8" },
  ffe: { navy: "123A66", ink: "10233F", paper: "FFFFFF", field: "F7F9FB", label: "EEF2F6" },
  firstent: { navy: "4B2E6F", ink: "1C1917", paper: "F7F4EE", field: "FFF9EC", label: "F1ECE4" },
};

function run(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: text || " ",
    font: "Arial",
    bold: opts.bold,
    size: opts.size ?? 20,
    color: opts.color,
  });
}

function cell(text: string, width: number, fill: string, color: string, bold = false): TableCell {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D0D5DD" };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [run(text, { bold, size: bold ? 18 : 20, color })] })],
  });
}

function kvTable(
  rows: { label: string; value: string }[],
  brand: (typeof BRAND)[LenderCode],
): Table {
  const c1 = 3600;
  const c2 = CONTENT_W - c1;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c1, c2],
    rows: rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell(row.label, c1, brand.label, brand.navy, true),
            cell(row.value || " ", c2, brand.field, brand.ink),
          ],
        }),
    ),
  });
}

function heading(text: string, navy: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    keepNext: true,
    children: [run(text, { bold: true, size: 24, color: navy })],
  });
}

export type ApplicationFormFill = {
  companyName: string;
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
  signedName?: string;
  signedAt?: string;
};

export async function buildApplicationFormDocx(lender: LenderCode, fill: ApplicationFormFill): Promise<Buffer> {
  const brand = BRAND[lender];
  const children: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [run("LOAN APPLICATION FORM", { bold: true, size: 36, color: brand.navy })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [run(`${LENDER_LABELS[lender]} — ${fill.companyName}`, { size: 22, color: brand.ink })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        run(
          "Pre-filled from the Nexus file. Blank lines are for the applicant to complete and e-sign. This is the form that is sent to the lender.",
          { size: 18, color: "5B6B7C" },
        ),
      ],
    }),
  ];

  for (const section of sectionsForLender(lender)) {
    children.push(heading(section.title, brand.navy));
    children.push(
      kvTable(
        section.fields.map((field) => ({ label: field.label, value: fill.answers[field.id] || "" })),
        brand,
      ),
    );
  }

  const directorList = fill.directors.length ? fill.directors : [{ id: "none" } as ApplicationDirector];
  directorList.forEach((director, index) => {
    children.push(heading(`Director / applicant ${index + 1}${director.fullName ? ` — ${director.fullName}` : ""}`, brand.navy));
    for (const section of directorSectionsForLender(lender)) {
      children.push(heading(section.title, brand.navy));
      children.push(
        kvTable(
          section.fields.map((field) => ({ label: field.label, value: director[field.id] || "" })),
          brand,
        ),
      );
    }
  });

  children.push(heading("Signature", brand.navy));
  children.push(
    kvTable(
      [
        { label: "Signed by", value: fill.signedName || "" },
        { label: "Date", value: fill.signedAt ? fill.signedAt.slice(0, 10) : "" },
      ],
      brand,
    ),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: 16838 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children,
      },
    ],
  });
  const out = await Packer.toBuffer(doc);
  return Buffer.from(out);
}
