/** Sections a British Business Bank / CDFI accredited lender expects in a business plan. */
export const BBB_BUSINESS_PLAN_SECTIONS = [
  { id: "executive-summary", heading: "1. Executive summary" },
  { id: "business-overview", heading: "2. Business overview" },
  { id: "history-current-position", heading: "3. History and current position" },
  { id: "products-market", heading: "4. Products, customers and market" },
  { id: "management-ownership", heading: "5. Management and ownership" },
  { id: "operations", heading: "6. Operations" },
  { id: "use-of-funds", heading: "7. Use of funds" },
  { id: "repayment-affordability", heading: "8. Repayment and affordability" },
  { id: "risks-mitigants", heading: "9. Risks and mitigants" },
  { id: "financial-highlights", heading: "10. Financial highlights from the file" },
  { id: "declaration", heading: "11. Compiler declaration" },
] as const;

export type BbbBusinessPlanSectionId = (typeof BBB_BUSINESS_PLAN_SECTIONS)[number]["id"];

export type BbbBusinessPlanSection = {
  id: string;
  heading: string;
  body: string;
};

export const BBB_PLAN_DISCLAIMER =
  "Compiled by Strata Finance from information on the client file for a British Business Bank Growth Guarantee Scheme / CDFI accredited lender. Unknowns are stated as unknown. No turnover, profit, or repayment figures have been invented. Directors must review and confirm this plan before it is sent to a lender. Strata Finance arranges non-regulated commercial B2B finance and is not a lender.";
