export interface DocumentRequirement {
    id: string;
    label: string;
    description: string;
    longDescription?: string; // Enhanced description for user guidance
    category: "financial" | "legal" | "identity" | "property" | "application";
    required: boolean;
}

export const DOCUMENT_REQUIREMENTS: Record<string, DocumentRequirement[]> = {
    // Refinance & Business Loans
    "refinance": [
        {
            id: "bank_statements_6m",
            label: "Business Bank Statements (Last 6 Months)",
            description: "Recent statements for all business accounts",
            longDescription: "Please provide PDF copies of the last 6 months of statements for your primary business trading account. Ensure the company name, account number, and sort code are visible.",
            category: "financial",
            required: true
        },
        {
            id: "accounts_3yr",
            label: "Audited Accounts (Last 3 Years)",
            description: "Full filed accounts",
            longDescription: "Complete set of filed accounts for the last 3 financial years. This should include the P&L and Balance Sheet.",
            category: "financial",
            required: true
        },
        {
            id: "aged_debtor_creditor",
            label: "Aged Debtor & Creditor Book",
            description: "Current snapshot of who owes you and who you owe",
            longDescription: "A detailed report showing outstanding invoices owed to you (Debtors) and bills you owe (Creditors), ideally exported from Xero/Sage/Quickbooks.",
            category: "financial",
            required: true
        },
        {
            id: "management_accounts",
            label: "Management Accounts",
            description: "Up-to-date P&L and Balance Sheet",
            longDescription: "Current financial year-to-date Profit & Loss and Balance Sheet. Required if your last filed accounts are more than 9 months old.",
            category: "financial",
            required: true
        },
        {
            id: "application_form",
            label: "Application Form",
            description: "Completed and signed application",
            category: "application",
            required: true
        },
        {
            id: "liabilities_form",
            label: "Business Liabilities Form",
            description: "List of all current business debts",
            longDescription: "A schedule of all current business loans, leases, and credit cards, including lender names, outstanding balances, and monthly payments.",
            category: "financial",
            required: true
        },
        {
            id: "cashflow_forecast",
            label: "Cashflow Forecast",
            description: "Forward-looking cashflow projections",
            longDescription: "A 12-month projection of expected income and expenses.",
            category: "financial",
            required: true
        },
    ],

    // Asset Finance
    "asset_finance": [
        {
            id: "bank_statements_6m",
            label: "Business Bank Statements (Last 6 Months)",
            description: "Recent statements for all business accounts",
            longDescription: "Please provide PDF copies of the last 6 months of statements for your primary business trading account.",
            category: "financial",
            required: true
        },
        {
            id: "accounts_2yr",
            label: "Audited Accounts (Last 2 Years)",
            description: "Full filed accounts",
            category: "financial",
            required: true
        },
        {
            id: "asset_details",
            label: "Asset Details (Quotation)",
            description: "Supplier invoice or quotation for the asset",
            longDescription: "Official supplier quote or invoice describing the asset (Make, Model, Year, Serial Number) and the purchase price.",
            category: "financial",
            required: true
        },
        {
            id: "af_application_form",
            label: "AF Application Form",
            description: "Specific Asset Finance application",
            category: "application",
            required: true
        },
    ],

    // Invoice Discounting
    "invoice_finance": [
        {
            id: "bank_statements_6m",
            label: "Business Bank Statements (Last 6 Months)",
            description: "Recent statements for all business accounts",
            category: "financial",
            required: true
        },
        {
            id: "accounts_3yr",
            label: "Audited Accounts (Last 3 Years)",
            description: "Full filed accounts",
            category: "financial",
            required: true
        },
        {
            id: "aged_debtor_creditor",
            label: "Aged Debtor & Creditor Book",
            description: "Current snapshot",
            longDescription: "Detailed report of all outstanding invoices. This is critical for Invoice Finance.",
            category: "financial",
            required: true
        },
        {
            id: "management_accounts",
            label: "Management Accounts",
            description: "Up-to-date P&L and Balance Sheet",
            category: "financial",
            required: true
        },
        {
            id: "application_form",
            label: "Application Form",
            description: "Completed application",
            category: "application",
            required: true
        },
    ],

    // Commercial Mortgages & Bridging
    "commercial_mortgage": [
        {
            id: "bank_statements_6m",
            label: "Business Bank Statements (Last 6 Months)",
            description: "Recent statements for all business accounts",
            category: "financial",
            required: true
        },
        {
            id: "accounts_2yr",
            label: "Audited Accounts (Last 2 Years)",
            description: "Full filed accounts",
            category: "financial",
            required: true
        },
        {
            id: "property_details",
            label: "Property Details",
            description: "Details of the security property",
            longDescription: "Full address, independent valuation (if available), lease details (if tenanted), and photos.",
            category: "property",
            required: true
        },
        {
            id: "prop_application_form",
            label: "Commercial Property Application Form",
            description: "Property-specific application",
            category: "application",
            required: true
        },
    ],

    // Fallback / General
    "general": [
        {
            id: "bank_statements_3m",
            label: "Bank Statements (Last 3 Months)",
            description: "Recent business bank statements",
            longDescription: "Please provide PDF copies of the last 3 months of statements for your primary business trading account.",
            category: "financial",
            required: true
        },
        {
            id: "accounts_latest",
            label: "Latest Accounts",
            description: "Most recent filed accounts",
            category: "financial",
            required: true
        },
        {
            id: "id_proof",
            label: "Director ID Proof",
            description: "Passport or Driving Licence",
            longDescription: "Clear color copy of current Passport or Driving Licence for all directors/shareholders >25%.",
            category: "identity",
            required: true
        },
    ]
};

export function getRequirementsForProduct(productType: string): DocumentRequirement[] {
    // Normalize input
    const type = (productType || "").toLowerCase().replace(/\s+/g, "_");

    if (type.includes("refinance") || type.includes("loan") || type.includes("unsecured")) return DOCUMENT_REQUIREMENTS["refinance"];
    if (type.includes("asset")) return DOCUMENT_REQUIREMENTS["asset_finance"];
    if (type.includes("invoice") || type.includes("factoring")) return DOCUMENT_REQUIREMENTS["invoice_finance"];
    if (type.includes("mortgage") || type.includes("bridging") || type.includes("property")) return DOCUMENT_REQUIREMENTS["commercial_mortgage"];

    return DOCUMENT_REQUIREMENTS["general"];
}

export function getDocumentRequirements(stage: string | null = "lead", companyType: string = "limited"): DocumentRequirement[] {
    // Default to 'refinance' requirements for now as it's the main flow
    // In future, this could switch based on 'dealType' or 'stage'
    const baseRequirements = DOCUMENT_REQUIREMENTS["refinance"] || [];

    // Filter based on company type if needed (currently returns all)
    // Could add logic like: if (companyType === 'sole_trader') filter...

    return baseRequirements;
}
