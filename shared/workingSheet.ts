export type WorkingSheetKind = "quote" | "fact" | "flag" | "draft";

export type WorkingSheetItem = {
  id: string;
  section: string;
  kind: WorkingSheetKind;
  label: string;
  text: string;
  copyable: boolean;
};

export type WorkingSheetInput = {
  companyName: string;
  application?: {
    signedName?: string;
    signedAt?: string;
    loanPurpose?: string;
    natureOfBusiness?: string;
    declineReasons?: string;
    jobsCreated?: string;
    jobsProtected?: string;
  };
  facts?: Array<{ label: string; value: string }>;
  flags?: string[];
  fileResearch?: string[];
  historicCommentary?: string[];
  drafts?: Array<{ label: string; lines: string[] }>;
};

export function isWorkingSheetCopyable(kind: WorkingSheetKind): boolean {
  return kind !== "draft";
}

function push(
  items: WorkingSheetItem[],
  item: Omit<WorkingSheetItem, "id" | "copyable">,
) {
  if (!item.text.trim()) return;
  items.push({
    ...item,
    id: `${item.kind}-${items.length}`,
    copyable: isWorkingSheetCopyable(item.kind),
  });
}

function quoteAttribution(application: NonNullable<WorkingSheetInput["application"]>): string {
  const who = application.signedName?.trim();
  const when = application.signedAt?.trim()?.slice(0, 10);
  if (who && when) return `${who} (signed application, ${when})`;
  if (who) return `${who} (signed application)`;
  return "Director (application)";
}

export function buildWorkingSheet(input: WorkingSheetInput): { items: WorkingSheetItem[] } {
  const items: WorkingSheetItem[] = [];
  const application = input.application || {};
  const who = quoteAttribution(application);

  if (application.loanPurpose) {
    push(items, {
      section: "Customer",
      kind: "quote",
      label: `Purpose — ${who}`,
      text: application.loanPurpose.trim(),
    });
  }
  if (application.natureOfBusiness) {
    push(items, {
      section: "Customer",
      kind: "quote",
      label: `What the business does — ${who}`,
      text: application.natureOfBusiness.trim(),
    });
  }
  if (application.declineReasons) {
    push(items, {
      section: "Customer",
      kind: "quote",
      label: `Bank decline — ${who}`,
      text: application.declineReasons.trim(),
    });
  }
  if (application.jobsProtected) {
    push(items, {
      section: "Customer",
      kind: "fact",
      label: "Jobs protected",
      text: application.jobsProtected.trim(),
    });
  }
  if (application.jobsCreated) {
    push(items, {
      section: "Customer",
      kind: "fact",
      label: "Jobs created",
      text: application.jobsCreated.trim(),
    });
  }

  for (const fact of input.facts || []) {
    push(items, { section: "File facts", kind: "fact", label: fact.label, text: fact.value });
  }
  for (const flag of input.flags || []) {
    push(items, { section: "Statement flags", kind: "flag", label: "Flag", text: flag });
  }
  for (const line of input.fileResearch || []) {
    push(items, { section: "On file", kind: "fact", label: "File research", text: line });
  }
  for (const line of input.historicCommentary || []) {
    push(items, { section: "Historic", kind: "fact", label: "Accounts", text: line });
  }
  for (const draft of input.drafts || []) {
    for (const line of draft.lines) {
      push(items, { section: "Draft notes — do not send", kind: "draft", label: draft.label, text: line });
    }
  }

  return { items };
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function workingSheetHtml(input: WorkingSheetInput): string {
  const { items } = buildWorkingSheet(input);
  const sections: string[] = [];
  let current = "";
  let body = "";
  const flush = () => {
    if (!current) return;
    sections.push(`<h2>${esc(current)}</h2>${body}`);
    body = "";
  };
  for (const item of items) {
    if (item.section !== current) {
      flush();
      current = item.section;
    }
    const copy = item.copyable ? ` data-copy="1" data-copy-text="${esc(item.text)}"` : "";
    const draft = item.kind === "draft" ? ` <span class="draft">do not send</span>` : "";
    body += `<div class="row"${copy}><div class="lbl">${esc(item.label)}${draft}</div><div class="txt">${esc(item.text)}</div></div>`;
  }
  flush();

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <title>Working sheet — ${esc(input.companyName)}</title>
  <style>
    body { font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif; color: #10233f; margin: 0; }
    .banner { background: #123a66; color: #fff; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 8px 16px; }
    h1 { font-size: 22px; margin: 16px 16px 4px; }
    .meta { color: #5b6b7c; font-size: 13px; margin: 0 16px 20px; }
    h2 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: #123a66; margin: 22px 16px 8px; }
    .row { padding: 8px 16px; border-bottom: 1px solid #eef2f6; }
    .lbl { font-size: 11px; color: #5b6b7c; font-weight: 600; }
    .txt { font-size: 14px; margin-top: 2px; }
    .draft { color: #b42318; font-weight: 700; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="banner">INTERNAL — not for lenders</div>
  <h1>Working sheet</h1>
  <p class="meta">${esc(input.companyName)} · pick facts and customer quotes for your version of the report</p>
  ${sections.join("")}
</body>
</html>`;
}
