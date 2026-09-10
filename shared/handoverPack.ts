import { CHECKLIST_SECTIONS } from "./checklistData";
import { STERLING_PAPER_CSS } from "./sterlingPaper";

export type HandoverAnswer = "yes" | "no" | "na" | "";

export type HandoverItem = {
  id: string;
  question: string;
  answer: HandoverAnswer;
  notes: string;
};

export type HandoverSection = {
  id: string;
  name: string;
  items: HandoverItem[];
};

export type HandoverPack = {
  sections: HandoverSection[];
  answered: number;
  total: number;
};

function normalizeAnswer(row: any): HandoverAnswer {
  if (!row || typeof row !== "object") return "";
  if (row.answer === "yes" || row.answer === "no" || row.answer === "na" || row.answer === "") {
    return row.answer;
  }
  if (row.completed === true) return "yes";
  return "";
}

export function resolveHandoverPack(saved: unknown): HandoverPack {
  const byId = new Map<string, any>();
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (row && typeof row === "object" && typeof row.itemId === "string") {
        byId.set(row.itemId, row);
      }
    }
  }

  const sections = CHECKLIST_SECTIONS.map((section) => ({
    id: section.id,
    name: section.name,
    items: section.items.map((item) => {
      const row = byId.get(item.id);
      return {
        id: item.id,
        question: item.description,
        answer: normalizeAnswer(row),
        notes: typeof row?.notes === "string" ? row.notes : "",
      };
    }),
  }));

  const items = sections.flatMap((section) => section.items);
  return {
    sections,
    answered: items.filter((item) => item.answer).length,
    total: items.length,
  };
}

export function handoverAnswerLabel(answer: HandoverAnswer): string {
  if (answer === "yes") return "Yes";
  if (answer === "no") return "No";
  if (answer === "na") return "N/A";
  return "Unanswered";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function handoverPackHtml(pack: HandoverPack, opts: { companyName: string }): string {
  const sections = pack.sections
    .map((section) => {
      const rows = section.items
        .map((item) => {
          const notes = item.notes.trim()
            ? `<div class="note">${escapeHtml(item.notes)}</div>`
            : "";
          return `<tr>
            <td>${escapeHtml(item.question)}</td>
            <td class="ans ${item.answer || "blank"}">${handoverAnswerLabel(item.answer)}</td>
          </tr>${notes ? `<tr><td colspan="2">${notes}</td></tr>` : ""}`;
        })
        .join("");
      return `<h2>${escapeHtml(section.name)}</h2>
        <table>${rows}</table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <title>Handover pack — ${escapeHtml(opts.companyName)}</title>
  <style>
    html, body { margin: 0; padding: 0; }
    body { font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif; color: #10233f; }
    .bar { height: 3px; background: #123a66; margin: 0 0 20px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #5b6b7c; font-size: 13px; margin-bottom: 24px; }
    h2 { font-size: 15px; letter-spacing: .04em; text-transform: uppercase; color: #123a66; margin: 28px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 8px 0; border-bottom: 1px solid #eef2f6; font-size: 13.5px; }
    td.ans { width: 110px; font-weight: 700; text-align: right; }
    .yes { color: #0e7a4b; }
    .no { color: #b42318; }
    .na { color: #7a5b12; }
    .blank { color: #8a96a3; font-weight: 600; }
    .note { font-size: 12.5px; color: #3d4d5c; padding: 0 0 10px; }
    ${STERLING_PAPER_CSS}
  </style>
</head>
<body>
  <div class="doc">
  <div class="bar"></div>
  <h1>Handover pack</h1>
  <p class="meta">${escapeHtml(opts.companyName)} · ${pack.answered} of ${pack.total} questions answered</p>
  ${sections}
  </div>
</body>
</html>`;
}
