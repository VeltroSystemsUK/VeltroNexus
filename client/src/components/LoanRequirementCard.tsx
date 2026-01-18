import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckSquare, Plus, Trash2, PoundSterling, Calculator } from "lucide-react";

// Product type enum matching backend schema
type ProductType =
    | "BUSINESS_LOAN"
    | "SECURED_LOAN"
    | "ASSET_FINANCE"
    | "EQUIPMENT_LEASING"
    | "INVOICE_FINANCE"
    | "BRIDGING_LOAN"
    | "COMMERCIAL_MORTGAGE"
    | "BUY_TO_LET";

const PRODUCT_OPTIONS: { value: ProductType; label: string }[] = [
    { value: "BUSINESS_LOAN", label: "Business Loan (Unsecured/Secured)" },
    { value: "ASSET_FINANCE", label: "Asset Finance" },
    { value: "EQUIPMENT_LEASING", label: "Equipment Leasing" },
    { value: "INVOICE_FINANCE", label: "Invoice Financing" },
    { value: "BRIDGING_LOAN", label: "Bridging Loan" },
    { value: "COMMERCIAL_MORTGAGE", label: "Commercial Mortgage" },
    { value: "BUY_TO_LET", label: "Buy To Let" },
    { value: "SECURED_LOAN", label: "Secured Loan" },
];

// Type definitions for product_details based on product_type
interface BusinessLoanDetails {
    loan_amount: number;
    term_months: number;
    target_interest_rate_percent: number;
}

interface AssetFinanceDetails {
    asset_description: string;
    supplier_name: string;
    purchase_price: number;
    deposit_amount: number;
    finance_amount: number;
    term_months: number;
}

interface InvoiceFinanceDetails {
    annual_turnover: number;
    current_ledger_value: number;
    number_of_live_debtors: number;
    required_facility_limit: number;
}

interface BridgingLoanDetails {
    net_loan_amount: number;
    security_value_open_market: number;
    ltv_percentage: number;
    term_months: number;
    exit_strategy: "SALE" | "REFINANCE" | "CASH";
}

interface CommercialMortgageDetails {
    property_value: number;
    mortgage_amount: number;
    term_years: number;
    repayment_type: "INTEREST_ONLY" | "CAPITAL_AND_INTEREST";
    projected_monthly_rental?: number;
}

interface SecurityOffered {
    directors_guarantee: boolean;
    debenture: boolean;
    commercial_property: boolean;
    parent_company_guarantee: boolean;
    home_equity: boolean;
    collateral: boolean;
    other_property: boolean;
    cross_company_guarantee: boolean;
}

interface UseOfFundsBreakdown {
    id: string;
    description: string;
    amount: number;
}

interface UseOfFunds {
    total_request_amount: number;
    breakdown: UseOfFundsBreakdown[];
}

interface Summary {
    estimated_facility_fee: number;
    estimated_monthly_payment: number;
}

// Complete loan requirement structure
interface LoanRequirementData {
    product_type: ProductType | "";
    product_details: Record<string, any>;
    security_offered: SecurityOffered;
    use_of_funds: UseOfFunds;
    summary: Summary;
    notes: string;
}

interface LoanRequirementCardProps {
    prospect: any;
}

export default function LoanRequirementCard({ prospect }: LoanRequirementCardProps) {
    const queryClient = useQueryClient();

    // Parse existing data from prospect
    const parseExistingData = (): LoanRequirementData => {
        const existing = prospect.loanRequirementData;
        if (existing && typeof existing === "object") {
            return {
                product_type: existing.product_type || "",
                product_details: existing.product_details || {},
                security_offered: existing.security_offered || getDefaultSecurity(),
                use_of_funds: existing.use_of_funds || { total_request_amount: 0, breakdown: [] },
                summary: existing.summary || { estimated_facility_fee: 0, estimated_monthly_payment: 0 },
                notes: existing.notes || prospect.loanRequirementNotes || "",
            };
        }
        // Fallback to legacy fields
        return {
            product_type: "",
            product_details: {
                loan_amount: prospect.loanAmount ? prospect.loanAmount / 100 : 0,
                term_months: prospect.term || 0,
                target_interest_rate_percent: parseFloat(prospect.interestRate) || 0,
            },
            security_offered: {
                directors_guarantee: !!prospect.directorsGuarantee,
                debenture: !!prospect.debenture,
                commercial_property: !!prospect.commercialProperty,
                parent_company_guarantee: !!prospect.parentCompanyGuarantee,
                home_equity: !!prospect.homeEquity,
                collateral: !!prospect.collateral,
                other_property: !!prospect.propertyOther,
                cross_company_guarantee: !!prospect.crossCompanyGuarantee,
            },
            use_of_funds: {
                total_request_amount: prospect.loanAmount ? prospect.loanAmount / 100 : 0,
                breakdown: Array.isArray(prospect.loanAllocation) ? prospect.loanAllocation : [],
            },
            summary: { estimated_facility_fee: 0, estimated_monthly_payment: 0 },
            notes: prospect.loanRequirementNotes || "",
        };
    };

    const getDefaultSecurity = (): SecurityOffered => ({
        directors_guarantee: false,
        debenture: false,
        commercial_property: false,
        parent_company_guarantee: false,
        home_equity: false,
        collateral: false,
        other_property: false,
        cross_company_guarantee: false,
    });

    const [formData, setFormData] = useState<LoanRequirementData>(parseExistingData);
    const [newDescription, setNewDescription] = useState("");
    const [newAmount, setNewAmount] = useState("");

    // Update form when prospect changes
    useEffect(() => {
        setFormData(parseExistingData());
    }, [prospect]);

    // Update product type
    const setProductType = (type: ProductType) => {
        setFormData(prev => ({
            ...prev,
            product_type: type,
            product_details: getDefaultProductDetails(type),
        }));
    };

    // Get default product details for a type
    const getDefaultProductDetails = (type: ProductType): Record<string, any> => {
        switch (type) {
            case "BUSINESS_LOAN":
            case "SECURED_LOAN":
                return { loan_amount: 0, term_months: 0, target_interest_rate_percent: 0 };
            case "ASSET_FINANCE":
            case "EQUIPMENT_LEASING":
                return { asset_description: "", supplier_name: "", purchase_price: 0, deposit_amount: 0, finance_amount: 0, term_months: 0 };
            case "INVOICE_FINANCE":
                return { annual_turnover: 0, current_ledger_value: 0, number_of_live_debtors: 0, required_facility_limit: 0 };
            case "BRIDGING_LOAN":
                return { net_loan_amount: 0, security_value_open_market: 0, ltv_percentage: 0, term_months: 0, exit_strategy: "" };
            case "COMMERCIAL_MORTGAGE":
                return { property_value: 0, mortgage_amount: 0, term_years: 0, repayment_type: "" };
            case "BUY_TO_LET":
                return { property_value: 0, mortgage_amount: 0, term_years: 0, repayment_type: "", projected_monthly_rental: 0 };
            default:
                return {};
        }
    };

    // Update product detail field
    const updateProductDetail = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            product_details: { ...prev.product_details, [field]: value },
        }));
    };

    // Update security field
    const updateSecurity = (field: keyof SecurityOffered, value: boolean) => {
        setFormData(prev => ({
            ...prev,
            security_offered: { ...prev.security_offered, [field]: value },
        }));
    };

    // Get primary amount for calculations
    const getPrimaryAmount = (): number => {
        const details = formData.product_details;
        switch (formData.product_type) {
            case "BUSINESS_LOAN":
            case "SECURED_LOAN":
                return details.loan_amount || 0;
            case "ASSET_FINANCE":
            case "EQUIPMENT_LEASING":
                return details.finance_amount || (details.purchase_price - details.deposit_amount) || 0;
            case "INVOICE_FINANCE":
                return details.required_facility_limit || 0;
            case "BRIDGING_LOAN":
                return details.net_loan_amount || 0;
            case "COMMERCIAL_MORTGAGE":
            case "BUY_TO_LET":
                return details.mortgage_amount || 0;
            default:
                return 0;
        }
    };

    const primaryAmount = getPrimaryAmount();

    // Auto-calculate LTV for bridging loan
    useEffect(() => {
        if (formData.product_type === "BRIDGING_LOAN") {
            const loan = formData.product_details.net_loan_amount || 0;
            const security = formData.product_details.security_value_open_market || 0;
            if (security > 0) {
                const ltv = (loan / security) * 100;
                if (ltv !== formData.product_details.ltv_percentage) {
                    updateProductDetail("ltv_percentage", parseFloat(ltv.toFixed(1)));
                }
            }
        }
    }, [formData.product_details.net_loan_amount, formData.product_details.security_value_open_market]);

    // Auto-calculate finance amount for asset finance
    useEffect(() => {
        if (formData.product_type === "ASSET_FINANCE" || formData.product_type === "EQUIPMENT_LEASING") {
            const purchase = formData.product_details.purchase_price || 0;
            const deposit = formData.product_details.deposit_amount || 0;
            const finance = purchase - deposit;
            if (finance !== formData.product_details.finance_amount) {
                updateProductDetail("finance_amount", finance);
            }
        }
    }, [formData.product_details.purchase_price, formData.product_details.deposit_amount]);

    // Update use of funds total when primary amount changes
    useEffect(() => {
        if (primaryAmount !== formData.use_of_funds.total_request_amount) {
            setFormData(prev => ({
                ...prev,
                use_of_funds: { ...prev.use_of_funds, total_request_amount: primaryAmount },
            }));
        }
    }, [primaryAmount]);

    // Allocation management
    const totalAllocated = formData.use_of_funds.breakdown.reduce((sum, item) => sum + item.amount, 0);
    const remainingToAllocate = primaryAmount - totalAllocated;

    const addAllocationItem = () => {
        const amount = parseFloat(newAmount);
        if (!newDescription.trim() || isNaN(amount) || amount <= 0) return;

        const newItem: UseOfFundsBreakdown = {
            id: Date.now().toString(),
            description: newDescription.trim(),
            amount: amount,
        };

        setFormData(prev => ({
            ...prev,
            use_of_funds: {
                ...prev.use_of_funds,
                breakdown: [...prev.use_of_funds.breakdown, newItem],
            },
        }));
        setNewDescription("");
        setNewAmount("");
    };

    const removeAllocationItem = (id: string) => {
        setFormData(prev => ({
            ...prev,
            use_of_funds: {
                ...prev.use_of_funds,
                breakdown: prev.use_of_funds.breakdown.filter(item => item.id !== id),
            },
        }));
    };

    const updateAllocationItem = (id: string, field: "description" | "amount", value: string) => {
        setFormData(prev => ({
            ...prev,
            use_of_funds: {
                ...prev.use_of_funds,
                breakdown: prev.use_of_funds.breakdown.map(item => {
                    if (item.id !== id) return item;
                    if (field === "amount") return { ...item, amount: parseFloat(value) || 0 };
                    return { ...item, description: value };
                }),
            },
        }));
    };

    // Calculate summary
    const calculatedSummary = useMemo((): Summary => {
        const facilityFee = primaryAmount * 0.035;

        let monthlyPayment = 0;
        const details = formData.product_details;

        if (formData.product_type === "BUSINESS_LOAN" || formData.product_type === "SECURED_LOAN") {
            const rate = details.target_interest_rate_percent || 0;
            const months = details.term_months || 0;
            if (rate > 0 && months > 0 && primaryAmount > 0) {
                const monthlyRate = rate / 100 / 12;
                monthlyPayment = (primaryAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
            } else if (months > 0) {
                monthlyPayment = primaryAmount / months;
            }
        } else if (formData.product_type === "COMMERCIAL_MORTGAGE" || formData.product_type === "BUY_TO_LET") {
            const months = (details.term_years || 0) * 12;
            if (months > 0 && primaryAmount > 0) {
                const assumedRate = 0.05 / 12; // 5% assumed
                monthlyPayment = (primaryAmount * assumedRate * Math.pow(1 + assumedRate, months)) / (Math.pow(1 + assumedRate, months) - 1);
            }
        }

        return {
            estimated_facility_fee: Math.round(facilityFee * 100) / 100,
            estimated_monthly_payment: Math.round(monthlyPayment * 100) / 100,
        };
    }, [primaryAmount, formData.product_type, formData.product_details]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: (updates: any) =>
            fetch(`/api/prospects/${prospect.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(updates),
            }).then(r => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospect.id}`] });
            toast.success("Loan requirements saved");
        },
    });

    const handleSave = () => {
        // Build the complete data structure
        const loanRequirementData = {
            product_type: formData.product_type,
            product_details: formData.product_details,
            security_offered: formData.security_offered,
            use_of_funds: formData.use_of_funds,
            summary: calculatedSummary,
            notes: formData.notes,
        };

        // Also update legacy fields for backward compatibility
        const updates: any = {
            loanRequirementData,
            loanRequirementNotes: formData.notes,
            loanAllocation: formData.use_of_funds.breakdown,
            // Legacy field mappings
            loanAmount: primaryAmount * 100,
            directorsGuarantee: formData.security_offered.directors_guarantee ? 1 : 0,
            debenture: formData.security_offered.debenture ? 1 : 0,
            commercialProperty: formData.security_offered.commercial_property ? 1 : 0,
            parentCompanyGuarantee: formData.security_offered.parent_company_guarantee ? 1 : 0,
            homeEquity: formData.security_offered.home_equity ? 1 : 0,
            collateral: formData.security_offered.collateral ? 1 : 0,
            propertyOther: formData.security_offered.other_property ? 1 : 0,
            crossCompanyGuarantee: formData.security_offered.cross_company_guarantee ? 1 : 0,
        };

        if (formData.product_type === "BUSINESS_LOAN" || formData.product_type === "SECURED_LOAN") {
            updates.term = formData.product_details.term_months;
            updates.interestRate = formData.product_details.target_interest_rate_percent?.toString();
        }

        saveMutation.mutate(updates);
    };

    // Render product-specific fields
    const renderProductFields = () => {
        const product = formData.product_type;
        const details = formData.product_details;

        if (!product) {
            return (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Calculator className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p>Select a financial product to see the relevant fields</p>
                </div>
            );
        }

        // Business Loan or Secured Loan
        if (product === "BUSINESS_LOAN" || product === "SECURED_LOAN") {
            return (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Loan Amount (£)</Label>
                        <Input
                            type="number"
                            value={details.loan_amount || ""}
                            onChange={e => updateProductDetail("loan_amount", parseFloat(e.target.value) || 0)}
                            placeholder="150000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Term (Months)</Label>
                        <Input
                            type="number"
                            value={details.term_months || ""}
                            onChange={e => updateProductDetail("term_months", parseInt(e.target.value) || 0)}
                            placeholder="60"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Target Interest Rate (%)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            value={details.target_interest_rate_percent || ""}
                            onChange={e => updateProductDetail("target_interest_rate_percent", parseFloat(e.target.value) || 0)}
                            placeholder="12.5"
                        />
                    </div>
                </div>
            );
        }

        // Asset Finance or Equipment Leasing
        if (product === "ASSET_FINANCE" || product === "EQUIPMENT_LEASING") {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                        <Label>Asset Description</Label>
                        <Input
                            type="text"
                            value={details.asset_description || ""}
                            onChange={e => updateProductDetail("asset_description", e.target.value)}
                            placeholder="e.g., 2024 Heidelberg Printing Press"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Purchase Price (£)</Label>
                        <Input
                            type="number"
                            value={details.purchase_price || ""}
                            onChange={e => updateProductDetail("purchase_price", parseFloat(e.target.value) || 0)}
                            placeholder="75000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Deposit Amount (£)</Label>
                        <Input
                            type="number"
                            value={details.deposit_amount || ""}
                            onChange={e => updateProductDetail("deposit_amount", parseFloat(e.target.value) || 0)}
                            placeholder="7500"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Finance Amount (£)</Label>
                        <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                            £{(details.finance_amount || 0).toLocaleString()}
                            <span className="text-xs text-muted-foreground ml-2">(Auto-calculated)</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Supplier Name</Label>
                        <Input
                            type="text"
                            value={details.supplier_name || ""}
                            onChange={e => updateProductDetail("supplier_name", e.target.value)}
                            placeholder="Press Machines Ltd"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Term (Months)</Label>
                        <Input
                            type="number"
                            value={details.term_months || ""}
                            onChange={e => updateProductDetail("term_months", parseInt(e.target.value) || 0)}
                            placeholder="48"
                        />
                    </div>
                </div>
            );
        }

        // Invoice Financing
        if (product === "INVOICE_FINANCE") {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Annual Turnover (£)</Label>
                        <Input
                            type="number"
                            value={details.annual_turnover || ""}
                            onChange={e => updateProductDetail("annual_turnover", parseFloat(e.target.value) || 0)}
                            placeholder="1200000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Current Ledger Value (£)</Label>
                        <Input
                            type="number"
                            value={details.current_ledger_value || ""}
                            onChange={e => updateProductDetail("current_ledger_value", parseFloat(e.target.value) || 0)}
                            placeholder="350000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Number of Live Debtors</Label>
                        <Input
                            type="number"
                            value={details.number_of_live_debtors || ""}
                            onChange={e => updateProductDetail("number_of_live_debtors", parseInt(e.target.value) || 0)}
                            placeholder="45"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Required Facility Limit (£)</Label>
                        <Input
                            type="number"
                            value={details.required_facility_limit || ""}
                            onChange={e => updateProductDetail("required_facility_limit", parseFloat(e.target.value) || 0)}
                            placeholder="250000"
                        />
                    </div>
                </div>
            );
        }

        // Bridging Loan
        if (product === "BRIDGING_LOAN") {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Net Loan Amount (£)</Label>
                        <Input
                            type="number"
                            value={details.net_loan_amount || ""}
                            onChange={e => updateProductDetail("net_loan_amount", parseFloat(e.target.value) || 0)}
                            placeholder="500000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Security Value (Open Market) (£)</Label>
                        <Input
                            type="number"
                            value={details.security_value_open_market || ""}
                            onChange={e => updateProductDetail("security_value_open_market", parseFloat(e.target.value) || 0)}
                            placeholder="850000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>LTV %</Label>
                        <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                            {details.ltv_percentage ? `${details.ltv_percentage}%` : "—"}
                            <span className="text-xs text-muted-foreground ml-2">(Auto-calculated)</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Term (Months)</Label>
                        <Input
                            type="number"
                            value={details.term_months || ""}
                            onChange={e => updateProductDetail("term_months", parseInt(e.target.value) || 0)}
                            placeholder="12"
                        />
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label>Exit Strategy</Label>
                        <Select value={details.exit_strategy || ""} onValueChange={val => updateProductDetail("exit_strategy", val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select exit strategy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SALE">Sale of Property</SelectItem>
                                <SelectItem value="REFINANCE">Refinance</SelectItem>
                                <SelectItem value="CASH">Cash Redemption</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        // Commercial Mortgage or Buy To Let
        if (product === "COMMERCIAL_MORTGAGE" || product === "BUY_TO_LET") {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Property Value (£)</Label>
                        <Input
                            type="number"
                            value={details.property_value || ""}
                            onChange={e => updateProductDetail("property_value", parseFloat(e.target.value) || 0)}
                            placeholder="450000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Mortgage Amount (£)</Label>
                        <Input
                            type="number"
                            value={details.mortgage_amount || ""}
                            onChange={e => updateProductDetail("mortgage_amount", parseFloat(e.target.value) || 0)}
                            placeholder="300000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Term (Years)</Label>
                        <Input
                            type="number"
                            value={details.term_years || ""}
                            onChange={e => updateProductDetail("term_years", parseInt(e.target.value) || 0)}
                            placeholder="25"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Repayment Type</Label>
                        <Select value={details.repayment_type || ""} onValueChange={val => updateProductDetail("repayment_type", val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select repayment type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="INTEREST_ONLY">Interest Only</SelectItem>
                                <SelectItem value="CAPITAL_AND_INTEREST">Capital & Interest</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {product === "BUY_TO_LET" && (
                        <div className="space-y-2 col-span-2">
                            <Label>Projected Monthly Rental Income (£)</Label>
                            <Input
                                type="number"
                                value={details.projected_monthly_rental || ""}
                                onChange={e => updateProductDetail("projected_monthly_rental", parseFloat(e.target.value) || 0)}
                                placeholder="3500"
                            />
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const securityFields: { key: keyof SecurityOffered; label: string }[] = [
        { key: "directors_guarantee", label: "Director's Guarantee" },
        { key: "debenture", label: "Debenture" },
        { key: "commercial_property", label: "Commercial Property" },
        { key: "parent_company_guarantee", label: "Parent Company Guarantee" },
        { key: "home_equity", label: "Home Equity" },
        { key: "collateral", label: "Collateral" },
        { key: "other_property", label: "Property (Other)" },
        { key: "cross_company_guarantee", label: "Cross Company Guarantee" },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Loan Requirement</CardTitle>
                <CardDescription>Specify the loan details for this prospect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Financial Product Selector */}
                <div className="space-y-2">
                    <Label className="text-base font-semibold">Financial Product</Label>
                    <Select
                        value={formData.product_type}
                        onValueChange={val => setProductType(val as ProductType)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a financial product" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRODUCT_OPTIONS.map(p => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Dynamic Product Fields */}
                {renderProductFields()}

                {/* Security Section */}
                {formData.product_type && (
                    <div>
                        <Label className="mb-3 block text-base font-semibold">Security</Label>
                        <div className="grid grid-cols-2 gap-4">
                            {securityFields.map(item => (
                                <div key={item.key} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={item.key}
                                        checked={formData.security_offered[item.key]}
                                        onCheckedChange={checked => updateSecurity(item.key, !!checked)}
                                    />
                                    <label htmlFor={item.key} className="text-sm cursor-pointer text-blue-600 hover:underline">
                                        {item.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Purpose / Notes */}
                {formData.product_type && (
                    <div className="space-y-2">
                        <Label>Purpose of Loan</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="e.g., Looking to refinance existing debt and fund expansion"
                            rows={3}
                        />
                    </div>
                )}

                {/* Use of Funds Breakdown */}
                {formData.product_type && primaryAmount > 0 && (
                    <Card className="border-2 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="h-5 w-5 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-sm">£</span>
                                Use of Funds Breakdown
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Allocate how the loan will be used. Total must equal the loan amount.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="flex items-center gap-2">
                                    <PoundSterling className="h-5 w-5 text-amber-600" />
                                    <span className="font-medium">Loan Amount:</span>
                                </div>
                                <span className="text-lg font-bold">£{primaryAmount.toLocaleString()}</span>
                            </div>

                            {formData.use_of_funds.breakdown.length > 0 && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                                        <span className="col-span-6">Description</span>
                                        <span className="col-span-4 text-right">Amount (£)</span>
                                        <span className="col-span-2"></span>
                                    </div>
                                    {formData.use_of_funds.breakdown.map(item => (
                                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-muted/50 rounded-md">
                                            <Input
                                                className="col-span-6 h-8 text-sm"
                                                value={item.description}
                                                onChange={e => updateAllocationItem(item.id, "description", e.target.value)}
                                            />
                                            <div className="col-span-4 flex items-center">
                                                <span className="text-sm text-muted-foreground mr-1">£</span>
                                                <Input
                                                    className="h-8 text-sm text-right"
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={e => updateAllocationItem(item.id, "amount", e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAllocationItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2 items-end">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Description</Label>
                                    <Input placeholder="e.g., Working Capital" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="h-9" />
                                </div>
                                <div className="w-32 space-y-1">
                                    <Label className="text-xs">Amount (£)</Label>
                                    <Input type="number" placeholder="0" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="h-9" />
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addAllocationItem} disabled={!newDescription.trim() || !newAmount || parseFloat(newAmount) <= 0} className="h-9">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                            </div>

                            <div className="border-t pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-700">Total Allocated:</span>
                                    <span className="font-medium text-amber-700">£{totalAllocated.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-700">Remaining to Allocate:</span>
                                    <span className={`font-medium ${remainingToAllocate === 0 ? "text-green-600" : remainingToAllocate < 0 ? "text-destructive" : "text-amber-600"}`}>
                                        £{remainingToAllocate.toLocaleString()}
                                    </span>
                                </div>
                                {primaryAmount > 0 && (
                                    <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${remainingToAllocate === 0 ? "bg-green-500" : remainingToAllocate < 0 ? "bg-destructive" : "bg-amber-500"}`}
                                            style={{ width: `${Math.min(100, (totalAllocated / primaryAmount) * 100)}%` }}
                                        />
                                    </div>
                                )}
                                {remainingToAllocate === 0 && primaryAmount > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <CheckSquare className="h-4 w-4" />
                                        <span>Funds fully allocated</span>
                                    </div>
                                )}
                                {remainingToAllocate < 0 && (
                                    <div className="flex items-center gap-2 text-sm text-destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>Over-allocated by £{Math.abs(remainingToAllocate).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Calculated Summary */}
                {formData.product_type && primaryAmount > 0 && (
                    <Card className="bg-muted/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Calculated Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Facility Fee (3.5%):</span>
                                <span className="font-semibold">£{calculatedSummary.estimated_facility_fee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Estimated Monthly Payment:</span>
                                <span className="font-semibold">£{calculatedSummary.estimated_monthly_payment.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Save Button */}
                <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                    {saveMutation.isPending ? "Saving..." : "Save Loan Requirements"}
                </Button>
            </CardContent>
        </Card>
    );
}
