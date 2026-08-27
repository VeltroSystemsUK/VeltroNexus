/**
 * Walkthrough for David Griffiths — Sterling Commercial Finance portal.
 * Palette matches the live portal (navy #123a66, paper #f4f6f8).
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOGO_STERLING = path.join(ROOT, "client/public/images/sterling-commercial-finance-logo.png");
const LOGO_CWRT = path.join(ROOT, "client/public/images/sterling-lenders/cwrt.png");
const LOGO_BCRS = path.join(ROOT, "client/public/images/sterling-lenders/bcrs.png");
const LOGO_FFE = path.join(ROOT, "client/public/images/sterling-lenders/ffe.png");
const LOGO_FE = path.join(ROOT, "client/public/images/sterling-lenders/firstent.png");

const C = {
  navy: "123A66",
  navyDeep: "0C2A4C",
  wave: "1B5F9E",
  paper: "F4F6F8",
  white: "FFFFFF",
  ink: "10233F",
  muted: "5B6B7C",
  line: "D8DEE6",
  ok: "0E7A4B",
  warn: "9A6408",
  danger: "B42318",
  gold: "C49212",
};

const FONT = "Calibri";
const TOTAL = 11;
const makeShadow = () => ({
  type: "outer",
  blur: 8,
  offset: 2,
  angle: 135,
  color: "10233F",
  opacity: 0.08,
});

function footer(slide, n) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.28, w: 10, h: 0.345,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  slide.addText("STERLING COMMERCIAL FINANCE  ·  Confidential", {
    x: 0.4, y: 5.28, w: 7, h: 0.345,
    fontSize: 10, fontFace: FONT, color: "C8D3E0", valign: "middle", margin: 0,
  });
  slide.addText(`${n}  /  ${TOTAL}`, {
    x: 8.2, y: 5.28, w: 1.4, h: 0.345,
    fontSize: 10, fontFace: FONT, color: "C8D3E0", align: "right", valign: "middle", margin: 0,
  });
}

function titleBar(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.08,
    fill: { color: C.navy }, line: { color: C.navy },
  });
}

function h1(slide, text, y = 0.28) {
  slide.addText(text, {
    x: 0.45, y, w: 9.1, h: 0.48,
    fontSize: 26, bold: true, color: C.navy, fontFace: FONT, margin: 0,
  });
}

function lede(slide, text, y = 0.76) {
  slide.addText(text, {
    x: 0.45, y, w: 9.1, h: 0.4,
    fontSize: 14, color: C.muted, fontFace: FONT, margin: 0,
  });
}

function card(slide, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: C.white },
    line: { color: C.line, pt: 1 },
    shadow: makeShadow(),
  });
}

let pres;

async function build() {
  pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Sterling Commercial Finance Limited";
  pres.title = "Your Nexus portal — a walkthrough for David";
  pres.subject = "How the Sterling file portal works";

  // 1 Title
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.08, fill: { color: C.navy }, line: { color: C.navy },
    });
    s.addImage({
      path: LOGO_STERLING,
      x: 0.5, y: 1.05, w: 3.6, h: 0.9,
      sizing: { type: "contain", w: 3.6, h: 0.9 },
    });
    s.addText("Your file portal", {
      x: 0.5, y: 2.2, w: 9, h: 0.7,
      fontSize: 36, bold: true, color: C.navy, fontFace: FONT, margin: 0,
    });
    s.addText("A short walkthrough for David Griffiths.\nRecommend. Check. Send. Nothing else.", {
      x: 0.5, y: 3.0, w: 8.5, h: 0.8,
      fontSize: 16, color: C.muted, fontFace: FONT, margin: 0,
    });
    s.addText("Sterling Commercial Finance Limited  ·  Confidential", {
      x: 0.5, y: 5.15, w: 8, h: 0.28,
      fontSize: 11, color: C.muted, fontFace: FONT, margin: 0,
    });
  }

  // 2 Job
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "Your job, in three words");
    lede(s, "Nexus packages the file. You are the last human in the loop.");
    const steps = [
      ["1", "Recommend", "Write the adviser commentary on the file. It lives only in this portal — not in the main Nexus credit studio."],
      ["2", "Check", "Read the compiled funding proposal. See every document. Missing items are flagged. You decide whether to proceed."],
      ["3", "Send", "Pick FFE, CWRT, BCRS or First Enterprise. Download the completed pack. You email the lender."],
    ];
    steps.forEach((row, i) => {
      const x = 0.45 + i * 3.1;
      card(s, x, 1.4, 2.95, 3.4);
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.4, w: 2.95, h: 0.08, fill: { color: C.navy }, line: { color: C.navy },
      });
      s.addText(row[0], {
        x: x + 0.2, y: 1.65, w: 2.5, h: 0.55,
        fontSize: 28, bold: true, color: C.navy, fontFace: FONT, margin: 0,
      });
      s.addText(row[1], {
        x: x + 0.2, y: 2.25, w: 2.5, h: 0.4,
        fontSize: 18, bold: true, color: C.ink, fontFace: FONT, margin: 0,
      });
      s.addText(row[2], {
        x: x + 0.2, y: 2.75, w: 2.55, h: 1.7,
        fontSize: 13, color: C.muted, fontFace: FONT, margin: 0,
      });
    });
    footer(s, 2);
  }

  // 3 Arrival
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "How a file lands on your desk");
    lede(s, "You do not wait for someone to email you a PDF. When the pack is ready, it appears.");
    const flow = [
      ["Nexus", "The file is compiled: report, accounts, statements, checklist."],
      ["Automatic handoff", "The moment packaging is ready, the file is created for you. No extra click."],
      ["Your dashboard", "You sign in. The company is on the cases list, with flags if anything is missing."],
    ];
    flow.forEach((row, i) => {
      const y = 1.35 + i * 1.15;
      card(s, 0.45, y, 9.1, 1.02);
      s.addShape(pres.shapes.OVAL, {
        x: 0.65, y: y + 0.26, w: 0.5, h: 0.5,
        fill: { color: C.navy }, line: { color: C.navy },
      });
      s.addText(String(i + 1), {
        x: 0.65, y: y + 0.26, w: 0.5, h: 0.5,
        fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", fontFace: FONT, margin: 0,
      });
      s.addText(row[0], {
        x: 1.4, y: y + 0.14, w: 7.8, h: 0.32,
        fontSize: 16, bold: true, color: C.navy, fontFace: FONT, margin: 0,
      });
      s.addText(row[1], {
        x: 1.4, y: y + 0.48, w: 7.8, h: 0.38,
        fontSize: 13, color: C.muted, fontFace: FONT, margin: 0,
      });
    });
    footer(s, 3);
  }

  // 4 Dashboard
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "After login: Cases");
    lede(s, "Same Sterling look as today. No new case, no rename, no delete. Open a file and work it.");
    card(s, 0.45, 1.35, 9.1, 3.5);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: 1.35, w: 9.1, h: 0.08, fill: { color: C.navy }, line: { color: C.navy },
    });
    s.addText("Cases", {
      x: 0.7, y: 1.6, w: 8.5, h: 0.4,
      fontSize: 18, bold: true, color: C.navy, fontFace: FONT, margin: 0,
    });
    const rows = [
      ["Harbour Bakery Ltd", "Awaiting recommendation  ·  2 flags  ·  26 Aug 2026"],
      ["Northridge Haulage Ltd", "Sent to FFE  ·  25 Aug 2026"],
      ["Elm & River Ltd", "Returned to Nexus  ·  chasing proof of address"],
    ];
    rows.forEach((r, i) => {
      const y = 2.15 + i * 0.75;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y, w: 8.6, h: 0.65,
        fill: { color: C.paper }, line: { color: C.line, pt: 1 },
      });
      s.addText(r[0], {
        x: 0.9, y: y + 0.06, w: 6.5, h: 0.28,
        fontSize: 14, bold: true, color: C.navy, fontFace: FONT, margin: 0,
      });
      s.addText(r[1], {
        x: 0.9, y: y + 0.32, w: 6.5, h: 0.24,
        fontSize: 12, color: C.muted, fontFace: FONT, margin: 0,
      });
      s.addText("Open", {
        x: 7.7, y: y + 0.16, w: 1.3, h: 0.32,
        fontSize: 13, bold: true, color: C.wave, align: "right", fontFace: FONT, margin: 0,
      });
    });
    footer(s, 4);
  }

  // 5 File
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "Inside a file");
    lede(s, "Your work on the left. The real Nexus funding proposal on the right.");
    card(s, 0.45, 1.35, 3.35, 3.5);
    s.addText("LEFT — your job", {
      x: 0.65, y: 1.5, w: 3, h: 0.28,
      fontSize: 11, bold: true, color: C.wave, fontFace: FONT, charSpacing: 1, margin: 0,
    });
    s.addText([
      { text: "Flags for anything missing", options: { bullet: true, breakLine: true } },
      { text: "Full document checklist", options: { bullet: true, breakLine: true } },
      { text: "Recommendation box (yours alone)", options: { bullet: true, breakLine: true } },
      { text: "Approve", options: { bullet: true, breakLine: true } },
      { text: "Return to Nexus, if the file is not ready", options: { bullet: true } },
    ], {
      x: 0.65, y: 1.9, w: 2.95, h: 2.6,
      fontSize: 13, color: C.ink, fontFace: FONT, paraSpaceAfter: 8,
    });
    card(s, 4.0, 1.35, 5.55, 3.5);
    s.addText("RIGHT — the compiled report", {
      x: 4.2, y: 1.5, w: 5.15, h: 0.28,
      fontSize: 11, bold: true, color: C.wave, fontFace: FONT, charSpacing: 1, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 4.25, y: 1.95, w: 5.1, h: 0.42,
      fill: { color: C.navy }, line: { color: C.navy },
    });
    s.addText("FUNDING PROPOSAL", {
      x: 4.35, y: 1.95, w: 4.9, h: 0.42,
      fontSize: 12, bold: true, color: C.white, valign: "middle", fontFace: FONT, margin: 0,
    });
    s.addText("Same report Nexus produces: company facts, CAMPARI, bank conduct, historic numbers.\n\nSection 8 stays “Awaiting recommendation” until you write it. You never type inside the report body.", {
      x: 4.25, y: 2.5, w: 5.1, h: 2.0,
      fontSize: 13, color: C.ink, fontFace: FONT, margin: 0,
    });
    footer(s, 5);
  }

  // 6 Flags
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "Missing items are flagged — not blocking");
    lede(s, "You can still Approve. Gaps ride with the pack so the lender (and you) can see them.");
    card(s, 0.45, 1.35, 4.4, 3.5);
    s.addText("On the file", {
      x: 0.65, y: 1.5, w: 4, h: 0.3,
      fontSize: 14, bold: true, color: C.navy, fontFace: FONT, margin: 0,
    });
    [
      ["Last 3 years accounts", true],
      ["6 months bank statements", true],
      ["Photo ID — directors", true],
      ["Proof of address", false],
      ["Insurance certificates", false],
    ].forEach((row, i) => {
      const y = 1.95 + i * 0.5;
      s.addText(row[0], {
        x: 0.7, y, w: 2.75, h: 0.38,
        fontSize: 13, color: C.ink, fontFace: FONT, valign: "middle", margin: 0,
      });
      s.addText(row[1] ? "On file" : "MISSING", {
        x: 3.5, y, w: 1.15, h: 0.38,
        fontSize: 11, bold: true, color: row[1] ? C.ok : C.danger, align: "right", valign: "middle", fontFace: FONT, margin: 0,
      });
    });
    card(s, 5.1, 1.35, 4.45, 3.5);
    s.addText("If it is not worth sending", {
      x: 5.3, y: 1.5, w: 4.05, h: 0.3,
      fontSize: 14, bold: true, color: C.navy, fontFace: FONT, margin: 0,
    });
    s.addText("Use Return to Nexus. Add a short note — for example “need proof of address and insurance.” The file goes back. When the pack is complete again, it reappears on your list as awaiting recommendation.", {
      x: 5.3, y: 2.0, w: 4.05, h: 2.4,
      fontSize: 14, color: C.ink, fontFace: FONT, margin: 0,
    });
    footer(s, 6);
  }

  // 7 Recommendation
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "The recommendation is yours");
    lede(s, "Typed only in this portal. Not stored on the main Nexus credit file.");
    card(s, 0.45, 1.35, 9.1, 3.5);
    s.addText("Recommendation", {
      x: 0.7, y: 1.55, w: 8.6, h: 0.28,
      fontSize: 12, bold: true, color: C.navy, fontFace: FONT, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.95, w: 8.6, h: 1.35,
      fill: { color: C.paper }, line: { color: C.line, pt: 1 },
    });
    s.addText("Supportable subject to updated proof of address. Serviceability is adequate on current bank conduct. Recommend proceed to FFE.", {
      x: 0.9, y: 2.1, w: 8.2, h: 1.05,
      fontSize: 14, italic: true, color: C.ink, fontFace: FONT, margin: 0,
    });
    s.addText("When you Approve, this text is stamped into section 8 of the PDF that goes in the lender zip. It is not written back into Nexus Credit Studio.", {
      x: 0.7, y: 3.5, w: 8.6, h: 1.0,
      fontSize: 14, color: C.muted, fontFace: FONT, margin: 0,
    });
    footer(s, 7);
  }

  // 8 Send
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "Approve → pick a lender → download");
    lede(s, "Four cards. Same checklist on each. One 220px Send button.");
    const lenders = [
      { name: "Finance for Enterprise", path: LOGO_FFE, w: 1.85, h: 0.42 },
      { name: "CWRT", path: LOGO_CWRT, w: 0.72, h: 0.72 },
      { name: "BCRS", path: LOGO_BCRS, w: 1.85, h: 0.45 },
      { name: "First Enterprise", path: LOGO_FE, w: 1.9, h: 0.48 },
    ];
    const cardW = 2.22;
    const gap = 0.16;
    const startX = 0.4;
    const y = 1.28;
    lenders.forEach((L, i) => {
      const x = startX + i * (cardW + gap);
      card(s, x, y, cardW, 3.55);
      try {
        s.addImage({
          path: L.path,
          x: x + 0.16, y: y + 0.22, w: L.w, h: L.h,
          sizing: { type: "contain", w: L.w, h: L.h },
        });
      } catch (e) {
        s.addText(L.name, {
          x: x + 0.12, y: y + 0.22, w: cardW - 0.24, h: 0.7,
          fontSize: 12, bold: true, color: C.navy, fontFace: FONT, margin: 0,
        });
      }
      s.addText("Completed Loan Application", {
        x: x + 0.14, y: y + 1.15, w: cardW - 0.28, h: 0.5,
        fontSize: 12, color: C.ink, fontFace: FONT, margin: 0,
      });
      s.addText("Funding proposal stamped", {
        x: x + 0.14, y: y + 1.65, w: cardW - 0.28, h: 0.4,
        fontSize: 12, color: C.ink, fontFace: FONT, margin: 0,
      });
      s.addText("11 supporting files", {
        x: x + 0.14, y: y + 2.05, w: cardW - 0.28, h: 0.35,
        fontSize: 12, color: C.ink, fontFace: FONT, margin: 0,
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.18, y: y + 2.9, w: 1.85, h: 0.38,
        fill: { color: C.navy }, line: { color: C.navy },
      });
      s.addText("Send", {
        x: x + 0.18, y: y + 2.9, w: 1.85, h: 0.38,
        fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle", fontFace: FONT, margin: 0,
      });
    });
    footer(s, 8);
  }

  // 9 Zip
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "What you download");
    lede(s, "A zip for that lender. You email it. Nexus does not mail the lender yet — emails and APIs will sit in Settings.");
    const bits = [
      ["Completed application", "FFE Word, CWRT Excel, BCRS PDF, or First Enterprise v10 + plan + cash-flow. Filled from the Nexus file. Blank stays blank."],
      ["Funding proposal.pdf", "The compiled report with your recommendation stamped in section 8, for that copy only."],
      ["Supporting files", "Everything already uploaded: accounts, statements, ID, and the rest."],
      ["STILL-MISSING.txt", "Only if flags remain. So you and the lender can see the gaps."],
    ];
    bits.forEach((row, i) => {
      const y = 1.3 + i * 0.9;
      card(s, 0.45, y, 9.1, 0.8);
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.45, y, w: 0.1, h: 0.8, fill: { color: C.navy }, line: { color: C.navy },
      });
      s.addText(row[0], {
        x: 0.8, y: y + 0.08, w: 8.5, h: 0.28,
        fontSize: 14, bold: true, color: C.navy, fontFace: FONT, margin: 0,
      });
      s.addText(row[1], {
        x: 0.8, y: y + 0.38, w: 8.5, h: 0.32,
        fontSize: 12, color: C.muted, fontFace: FONT, margin: 0,
      });
    });
    footer(s, 9);
  }

  // 10 Settings
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "Settings — later wiring, ready now");
    lede(s, "Each lender has a contact email and optional API. Saved in this module. Send still downloads a zip until we connect them.");
    ["Finance for Enterprise", "CWRT", "BCRS", "First Enterprise"].forEach((name, i) => {
      const cardW = 2.22;
      const x = 0.4 + i * (cardW + 0.16);
      const y = 1.4;
      card(s, x, y, cardW, 3.4);
      s.addText(name, {
        x: x + 0.14, y: y + 0.2, w: cardW - 0.28, h: 0.7,
        fontSize: 14, bold: true, color: C.navy, fontFace: FONT, margin: 0,
      });
      s.addText("Email", {
        x: x + 0.14, y: y + 1.05, w: cardW - 0.28, h: 0.22,
        fontSize: 11, color: C.muted, fontFace: FONT, margin: 0,
      });
      s.addText("enquiries@…", {
        x: x + 0.14, y: y + 1.28, w: cardW - 0.28, h: 0.35,
        fontSize: 13, color: C.ink, fontFace: FONT, margin: 0,
      });
      s.addText("API URL / key", {
        x: x + 0.14, y: y + 1.85, w: cardW - 0.28, h: 0.22,
        fontSize: 11, color: C.muted, fontFace: FONT, margin: 0,
      });
      s.addText("Optional — not live yet", {
        x: x + 0.14, y: y + 2.1, w: cardW - 0.28, h: 0.7,
        fontSize: 13, color: C.muted, fontFace: FONT, margin: 0,
      });
    });
    footer(s, 10);
  }

  // 11 What you never see
  {
    const s = pres.addSlide();
    s.background = { color: C.paper };
    titleBar(s);
    h1(s, "What you will not see");
    lede(s, "This is not the whole of Nexus. After login you only have this portal.");
    const no = [
      "Pipeline, leads, or the underwriting studio",
      "Editing the borrower’s numbers or the CAMPARI write-up",
      "Creating or deleting cases",
      "Uploading missing documents (Nexus chases those)",
    ];
    no.forEach((t, i) => {
      const y = 1.35 + i * 0.7;
      card(s, 0.45, y, 9.1, 0.6);
      s.addText(t, {
        x: 0.7, y, w: 8.6, h: 0.6,
        fontSize: 16, color: C.ink, valign: "middle", fontFace: FONT, margin: 0,
      });
    });
    footer(s, 11);
  }

  const out = path.join(ROOT, "docs", "Sterling-Portal-for-David.pptx");
  await pres.writeFile({ fileName: out });
  console.log("Wrote", out);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
