/** Screen CSS so Sterling HTML previews sit on A4 paper instead of stretching. */
export const STERLING_PAPER_CSS = `
@media screen {
  html, body { background: #cfd6de !important; }
  .doc {
    width: 210mm;
    max-width: 210mm;
    min-height: 297mm;
    margin: 18px auto;
    padding: 14mm 16mm;
    background: #fff;
    box-shadow: 0 1px 4px rgba(16,35,63,0.12), 0 8px 24px rgba(16,35,63,0.12);
  }
}
@media print {
  html, body { background: #fff !important; }
  .doc { width: auto; max-width: none; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
}
`;
