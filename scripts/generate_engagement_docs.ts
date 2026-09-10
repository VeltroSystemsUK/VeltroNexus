import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
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
  ENGAGEMENT_PACK_VERSION,
  BROKER_FRN,
  engagementLetterBlocks,
  fillFromDeal,
  populateBlocks,
  privacyNoticeBlocks,
  type DocBlock,
  type EngagementFill,
} from "../shared/engagementPack";

const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 900;
const CONTENT_W = A4_W - MARGIN * 2;
const PURPLE = "4B2E6F";
const GOLD = "C9A227";
const INK = "1C1917";
const MUTED = "5A5148";
const PAPER = "F7F4EE";
const FIELD = "FFF9EC";
const LABEL_BG = "F1ECE4";
const THIN = { style: BorderStyle.SINGLE, size: 4, color: "E6DFD4" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const logoPath = path.resolve("client/public/images/strata-finance-logo.png");
const logoData = fs.readFileSync(logoPath);
const logoWidth = 150;
const logoHeight = Math.round(150 * (60 / 230));

function run(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({
    text,
    font: "Arial",
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size ?? 20,
    color: opts.color ?? INK,
  });
}

function heading(text: string, level: 1 | 2 | 3): Paragraph {
  const size = level === 1 ? 32 : level === 2 ? 24 : 22;
  const before = level === 1 ? 40 : level === 2 ? 240 : 160;
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before, after: 80 },
    keepNext: true,
    children: [run(text, { bold: true, size, color: level === 1 ? "2C1B45" : PURPLE })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [run(text, { size: 20 })],
  });
}

function cell(text: string, width: number, fill: string, bold = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    borders: BORDERS,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [run(text, { bold, size: bold ? 18 : 20, color: bold ? MUTED : INK })],
      }),
    ],
  });
}

function kvTable(rows: { label: string; value: string }[]): Table {
  const c1 = 3400;
  const c2 = CONTENT_W - c1;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c1, c2],
    rows: rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: [cell(row.label, c1, LABEL_BG, true), cell(row.value, c2, FIELD)],
        }),
    ),
  });
}

function callout(title: string, bodyText: string): FileChild[] {
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: "FBF6E8", type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: GOLD },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD },
                left: { style: BorderStyle.SINGLE, size: 16, color: PURPLE },
                right: { style: BorderStyle.SINGLE, size: 4, color: GOLD },
              },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({ spacing: { after: 40 }, children: [run(title, { bold: true, size: 20, color: PURPLE })] }),
                new Paragraph({ children: [run(bodyText, { size: 20 })] }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

function blocksToChildren(blocks: DocBlock[]): FileChild[] {
  const out: FileChild[] = [];
  for (const block of blocks) {
    if (block.type === "kicker") {
      out.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [run(block.text.toUpperCase(), { bold: true, size: 16, color: "8A6A1A" })],
        }),
      );
    } else if (block.type === "heading") {
      out.push(heading(block.text, block.level));
    } else if (block.type === "para") {
      out.push(body(block.text));
    } else if (block.type === "note") {
      out.push(
        new Paragraph({
          spacing: { after: 140 },
          indent: { left: 180 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 8 } },
          children: [run(block.text, { italics: true, size: 19, color: MUTED })],
        }),
      );
    } else if (block.type === "callout") {
      out.push(...callout(block.title, block.body));
    } else if (block.type === "list") {
      for (const item of block.items) {
        out.push(
          new Paragraph({
            numbering: { reference: block.ordered ? "numbers" : "bullets", level: 0 },
            spacing: { after: 60, line: 276 },
            children: [run(item, { size: 20 })],
          }),
        );
      }
    } else if (block.type === "kv") {
      out.push(kvTable(block.rows));
      out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
    }
  }
  return out;
}

function makeDoc(title: string, blocks: DocBlock[]): Document {
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20, color: INK } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: "2C1B45" },
          paragraph: { spacing: { before: 40, after: 80 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: PURPLE },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 22, bold: true, font: "Arial", color: PURPLE },
          paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 240 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H },
            margin: { top: 1100, right: MARGIN, bottom: 1100, left: MARGIN, header: 360, footer: 360 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: CONTENT_W }],
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PURPLE, space: 6 } },
                spacing: { after: 80 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoData,
                    transformation: { width: logoWidth, height: logoHeight },
                    altText: { name: "Strata Finance", description: "Strata Finance logo", title: "Strata Finance" },
                  }),
                  new TextRun({ children: ["\t"] }),
                  run("Private and confidential", { size: 16, color: MUTED, italics: true }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: CONTENT_W }],
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: "D9D1C5", space: 8 } },
                spacing: { before: 60 },
                children: [
                  run(`Strata Finance  ·  FCA FRN ${BROKER_FRN}  ·  ${title}  ·  ${ENGAGEMENT_PACK_VERSION}`, {
                    size: 14,
                    color: MUTED,
                  }),
                  new TextRun({ children: ["\t"] }),
                  run("Page ", { size: 14, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 14, color: MUTED }),
                  run(" of ", { size: 14, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 14, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: blocksToChildren(blocks),
      },
    ],
  });
}

async function writeDoc(filename: string, title: string, blocks: DocBlock[]) {
  const dir = path.resolve("server/templates/sterling/esign");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, filename);
  const buf = await Packer.toBuffer(makeDoc(title, blocks));
  fs.writeFileSync(out, buf);
  console.log("wrote", out, buf.length);
}

const fill: EngagementFill = fillFromDeal({
  companyName: "{{clientName}}",
  placeAddress: "{{clientAddress}}",
  fundingReason: "{{purpose}}",
});
fill.clientName = "{{clientName}}";
fill.clientAddress = "{{clientAddress}}";
fill.amount = "{{amount}}";
fill.purpose = "{{purpose}}";
fill.term = "{{term}}";
fill.rate = "{{rate}}";
fill.security = "{{security}}";
fill.date = "{{date}}";

await writeDoc(
  "Strata-Finance-Privacy-Notice-2026-09.docx",
  "Privacy Notice",
  populateBlocks(privacyNoticeBlocks(), fill),
);
await writeDoc(
  "Strata-Finance-Engagement-Letter-2026-09.docx",
  "Terms of Business",
  populateBlocks(engagementLetterBlocks(), fill),
);

const sample = fillFromDeal({
  companyName: "Hartley Joinery Ltd",
  placeAddress: "14 Mill Lane, Nottingham, NG1 1AA",
  loanAmount: 250000,
  fundingReason: "Refinance stacked MCA",
  contactName: "Jane Hartley",
});
const qaDir = path.resolve("tmp/esign-qa");
fs.mkdirSync(qaDir, { recursive: true });
const qaPrivacy = path.join(qaDir, "privacy-sample.docx");
const qaLetter = path.join(qaDir, "engagement-sample.docx");
fs.writeFileSync(qaPrivacy, await Packer.toBuffer(makeDoc("Privacy Notice", populateBlocks(privacyNoticeBlocks(), sample))));
fs.writeFileSync(qaLetter, await Packer.toBuffer(makeDoc("Terms of Business", populateBlocks(engagementLetterBlocks(), sample))));
console.log("qa", qaPrivacy, qaLetter);
