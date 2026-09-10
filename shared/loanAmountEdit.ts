export function poundsFromPence(pence: number | null | undefined): number {
  const n = Number(pence);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n) / 100;
}

export function penceFromPounds(pounds: number | string | null | undefined): number | null {
  const n = typeof pounds === "string" ? Number(pounds) : Number(pounds);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return null;
  return Math.round(n * 100);
}

export function applyLoanAmountToRequirementData(data: unknown, pounds: number): Record<string, any> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const current = data as Record<string, any>;
  const details = { ...(current.product_details || {}) };
  const type = String(current.product_type || "");
  if (!type || type === "BUSINESS_LOAN" || type === "SECURED_LOAN") details.loan_amount = pounds;
  if (type === "BRIDGING_LOAN") details.net_loan_amount = pounds;
  if (type === "ASSET_FINANCE" || type === "EQUIPMENT_LEASING") details.finance_amount = pounds;
  if (type === "INVOICE_FINANCE") details.required_facility_limit = pounds;
  if (type === "COMMERCIAL_MORTGAGE" || type === "BUY_TO_LET") details.mortgage_amount = pounds;
  const funds = { ...(current.use_of_funds || {}) };
  funds.total_request_amount = pounds;
  return {
    ...current,
    product_details: details,
    use_of_funds: funds,
  };
}

export function applyLoanAmountToUnderwriting(underwriting: unknown, pounds: number): Record<string, any> {
  const current = underwriting && typeof underwriting === "object" ? (underwriting as Record<string, any>) : {};
  return {
    ...current,
    loanDetails: {
      ...(current.loanDetails || {}),
      amount: pounds,
    },
  };
}
