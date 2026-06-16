import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Sparkles,
    User,
    DollarSign,
    Briefcase,
    Target,
    CreditCard,
    Shield,
    Building2,
    Car,
    FileText,
    Home,
    BarChart3,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Search
} from "lucide-react";

// Type definitions based on research_schema.json
interface CAMPARIModule {
    character: {
        management_experience_years: number;
        credit_history_summary: string;
    };
    affordability: {
        last_ebitda: number;
        debt_service_coverage_ratio: number;
    };
    means: {
        tangible_net_worth: number;
        liquidity_position: string;
    };
    purpose: {
        validation_comment: string;
    };
    repayment: {
        primary_source: string;
        secondary_source: string;
    };
    insurance: {
        keyman_insurance_active: boolean;
        indemnity_cover: number;
    };
}

interface AssetModule {
    identification: {
        make: string;
        model: string;
        year: number;
        serial_number: string;
        supplier_verification: string;
    };
    valuation: {
        supplier_quote_price: number;
        market_average_price: number;
        forced_sale_value: number;
    };
    security: {
        asset_location: string;
        title_check_status: string;
    };
}

interface LedgerModule {
    book_summary: {
        total_debtors: number;
        total_outstanding: number;
    };
    risk_factors: {
        concentration_limit_percent: number;
        top_debtor_exposure: string;
        foreign_debt_percentage: number;
        dilution_rate_percent: number;
    };
    audit: {
        last_audit_date: string;
        verification_method: string;
    };
}

interface PropertyModule {
    property_details: {
        address: string;
        title_number: string;
        tenure: string;
        property_type: string;
    };
    valuation_metrics: {
        purchase_price: number;
        red_book_valuation: number;
        vacant_possession_value: number;
        ninety_day_sale_value: number;
        current_ltv_percent: number;
    };
    income_yield: {
        current_rental_income: number;
        gross_yield_percent: number;
        occupancy_status: string;
    };
}

interface ResearchData {
    status: string;
    last_updated: string;
    active_module: string;
    campari_module: CAMPARIModule;
    asset_module: AssetModule;
    ledger_module: LedgerModule;
    property_module: PropertyModule;
}

interface ResearchTabProps {
    prospect: any;
}

// Module mapping based on product type
const getActiveModule = (productType: string): string => {
    switch (productType) {
        case "BUSINESS_LOAN":
        case "SECURED_LOAN":
            return "campari";
        case "ASSET_FINANCE":
        case "EQUIPMENT_LEASING":
            return "asset";
        case "INVOICE_FINANCE":
            return "ledger";
        case "BRIDGING_LOAN":
        case "COMMERCIAL_MORTGAGE":
        case "BUY_TO_LET":
            return "property";
        default:
            return "";
    }
};

// AI Action Button Component
function AIActionButton({ action, label }: { action: string; label: string }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        toast.info(`AI Agent: ${label}`, {
            description: "This feature will be available soon.",
        });
        setTimeout(() => setLoading(false), 1000);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={loading}
            className="gap-1 text-xs h-7 px-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        >
            <Sparkles className="h-3 w-3" />
            {loading ? "Processing..." : label}
        </Button>
    );
}

// Default empty data structures
const getDefaultCAMPARI = (): CAMPARIModule => ({
    character: { management_experience_years: 0, credit_history_summary: "" },
    affordability: { last_ebitda: 0, debt_service_coverage_ratio: 0 },
    means: { tangible_net_worth: 0, liquidity_position: "" },
    purpose: { validation_comment: "" },
    repayment: { primary_source: "", secondary_source: "" },
    insurance: { keyman_insurance_active: false, indemnity_cover: 0 },
});

const getDefaultAsset = (): AssetModule => ({
    identification: { make: "", model: "", year: new Date().getFullYear(), serial_number: "", supplier_verification: "" },
    valuation: { supplier_quote_price: 0, market_average_price: 0, forced_sale_value: 0 },
    security: { asset_location: "", title_check_status: "" },
});

const getDefaultLedger = (): LedgerModule => ({
    book_summary: { total_debtors: 0, total_outstanding: 0 },
    risk_factors: { concentration_limit_percent: 0, top_debtor_exposure: "", foreign_debt_percentage: 0, dilution_rate_percent: 0 },
    audit: { last_audit_date: "", verification_method: "" },
});

const getDefaultProperty = (): PropertyModule => ({
    property_details: { address: "", title_number: "", tenure: "", property_type: "" },
    valuation_metrics: { purchase_price: 0, red_book_valuation: 0, vacant_possession_value: 0, ninety_day_sale_value: 0, current_ltv_percent: 0 },
    income_yield: { current_rental_income: 0, gross_yield_percent: 0, occupancy_status: "" },
});

export default function ResearchTab({ prospect }: ResearchTabProps) {
    const queryClient = useQueryClient();

    // Get product type from loan requirement data
    const loanRequirementData = prospect.loanRequirementData || {};
    const productType = loanRequirementData.product_type || "";
    const activeModule = getActiveModule(productType);

    // Parse existing research data
    const existingResearch = prospect.researchData || {};

    const [campariData, setCampariData] = useState<CAMPARIModule>(
        existingResearch.campari_module || getDefaultCAMPARI()
    );
    const [assetData, setAssetData] = useState<AssetModule>(
        existingResearch.asset_module || getDefaultAsset()
    );
    const [ledgerData, setLedgerData] = useState<LedgerModule>(
        existingResearch.ledger_module || getDefaultLedger()
    );
    const [propertyData, setPropertyData] = useState<PropertyModule>(
        existingResearch.property_module || getDefaultProperty()
    );

    // Update state when prospect changes
    useEffect(() => {
        const research = prospect.researchData || {};
        setCampariData(research.campari_module || getDefaultCAMPARI());
        setAssetData(research.asset_module || getDefaultAsset());
        setLedgerData(research.ledger_module || getDefaultLedger());
        setPropertyData(research.property_module || getDefaultProperty());
    }, [prospect]);

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
            toast.success("Research data saved");
        },
    });

    const handleSave = () => {
        const researchData: ResearchData = {
            status: "IN_PROGRESS",
            last_updated: new Date().toISOString(),
            active_module: activeModule,
            campari_module: campariData,
            asset_module: assetData,
            ledger_module: ledgerData,
            property_module: propertyData,
        };

        saveMutation.mutate({ researchData });
    };

    // No product selected message
    if (!productType || !activeModule) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        <Search className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Product Selected</h3>
                        <p className="text-sm">
                            Please select a Financial Product in the Requirements tab first.
                            <br />
                            The Research module will adapt based on the product type.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Research Hub
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Due diligence and case building for {productType.replace(/_/g, " ").toLowerCase()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        In Progress
                    </Badge>
                </div>
            </div>

            {/* CAMPARI Module */}
            {activeModule === "campari" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Character */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-600" />
                                Character
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Management Experience (Years)</Label>
                                <Input
                                    type="number"
                                    value={campariData.character.management_experience_years || ""}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        character: { ...prev.character, management_experience_years: parseInt(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Credit History Summary</Label>
                                    <AIActionButton action="check_directors_bureau" label="Check Directors" />
                                </div>
                                <Textarea
                                    value={campariData.character.credit_history_summary}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        character: { ...prev.character, credit_history_summary: e.target.value }
                                    }))}
                                    placeholder="e.g., Clean - No CCJs in last 3 years"
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ability/Affordability */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                Affordability
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Last EBITDA (£)</Label>
                                    <AIActionButton action="analyse_bank_statements" label="Analyse Statements" />
                                </div>
                                <Input
                                    type="number"
                                    value={campariData.affordability.last_ebitda || ""}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        affordability: { ...prev.affordability, last_ebitda: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Debt Service Coverage Ratio</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={campariData.affordability.debt_service_coverage_ratio || ""}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        affordability: { ...prev.affordability, debt_service_coverage_ratio: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Means */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-amber-600" />
                                Means
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tangible Net Worth (£)</Label>
                                <Input
                                    type="number"
                                    value={campariData.means.tangible_net_worth || ""}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        means: { ...prev.means, tangible_net_worth: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Liquidity Position</Label>
                                <Select
                                    value={campariData.means.liquidity_position}
                                    onValueChange={val => setCampariData(prev => ({
                                        ...prev,
                                        means: { ...prev.means, liquidity_position: val }
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select position" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Strong">Strong</SelectItem>
                                        <SelectItem value="Moderate">Moderate</SelectItem>
                                        <SelectItem value="Weak">Weak</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Purpose */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Target className="h-4 w-4 text-emerald-600" />
                                Purpose
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Purpose Validation</Label>
                                <Textarea
                                    value={campariData.purpose.validation_comment}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        purpose: { ...prev.purpose, validation_comment: e.target.value }
                                    }))}
                                    placeholder="e.g., Growth capital for verified contract with NHS"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Repayment */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-emerald-600" />
                                Repayment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Primary Source</Label>
                                <Input
                                    value={campariData.repayment.primary_source}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        repayment: { ...prev.repayment, primary_source: e.target.value }
                                    }))}
                                    placeholder="e.g., Trading Cashflow"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Secondary Source</Label>
                                <Input
                                    value={campariData.repayment.secondary_source}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        repayment: { ...prev.repayment, secondary_source: e.target.value }
                                    }))}
                                    placeholder="e.g., Refinance of assets"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Insurance */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="h-4 w-4 text-teal-600" />
                                Insurance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="keyman"
                                    checked={campariData.insurance.keyman_insurance_active}
                                    onCheckedChange={checked => setCampariData(prev => ({
                                        ...prev,
                                        insurance: { ...prev.insurance, keyman_insurance_active: !!checked }
                                    }))}
                                />
                                <label htmlFor="keyman" className="text-sm cursor-pointer">
                                    Keyman Insurance Active
                                </label>
                            </div>
                            <div className="space-y-2">
                                <Label>Indemnity Cover (£)</Label>
                                <Input
                                    type="number"
                                    value={campariData.insurance.indemnity_cover || ""}
                                    onChange={e => setCampariData(prev => ({
                                        ...prev,
                                        insurance: { ...prev.insurance, indemnity_cover: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Asset Validator Module */}
            {activeModule === "asset" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Identification */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Car className="h-4 w-4 text-blue-600" />
                                Asset Identification
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Make</Label>
                                    <Input
                                        value={assetData.identification.make}
                                        onChange={e => setAssetData(prev => ({
                                            ...prev,
                                            identification: { ...prev.identification, make: e.target.value }
                                        }))}
                                        placeholder="e.g., Tesla"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <Input
                                        value={assetData.identification.model}
                                        onChange={e => setAssetData(prev => ({
                                            ...prev,
                                            identification: { ...prev.identification, model: e.target.value }
                                        }))}
                                        placeholder="e.g., Model Y"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input
                                        type="number"
                                        value={assetData.identification.year || ""}
                                        onChange={e => setAssetData(prev => ({
                                            ...prev,
                                            identification: { ...prev.identification, year: parseInt(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Serial/VIN Number</Label>
                                    <Input
                                        value={assetData.identification.serial_number}
                                        onChange={e => setAssetData(prev => ({
                                            ...prev,
                                            identification: { ...prev.identification, serial_number: e.target.value }
                                        }))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Supplier Verification</Label>
                                <Select
                                    value={assetData.identification.supplier_verification}
                                    onValueChange={val => setAssetData(prev => ({
                                        ...prev,
                                        identification: { ...prev.identification, supplier_verification: val }
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Verified Dealer">Verified Dealer</SelectItem>
                                        <SelectItem value="Private Sale">Private Sale</SelectItem>
                                        <SelectItem value="Auction">Auction</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Valuation - Key comparison section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-green-600" />
                                    Market Valuation
                                </span>
                                <AIActionButton action="fetch_market_comparables" label="Get Comparables" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Supplier Quote Price (£)</Label>
                                <Input
                                    type="number"
                                    value={assetData.valuation.supplier_quote_price || ""}
                                    onChange={e => setAssetData(prev => ({
                                        ...prev,
                                        valuation: { ...prev.valuation, supplier_quote_price: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Market Average Price (£)</Label>
                                <Input
                                    type="number"
                                    value={assetData.valuation.market_average_price || ""}
                                    onChange={e => setAssetData(prev => ({
                                        ...prev,
                                        valuation: { ...prev.valuation, market_average_price: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Forced Sale Value (£)</Label>
                                <Input
                                    type="number"
                                    value={assetData.valuation.forced_sale_value || ""}
                                    onChange={e => setAssetData(prev => ({
                                        ...prev,
                                        valuation: { ...prev.valuation, forced_sale_value: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>

                            {/* Price Comparison Visual */}
                            {assetData.valuation.supplier_quote_price > 0 && assetData.valuation.market_average_price > 0 && (
                                <div className="pt-4 border-t">
                                    <Label className="text-xs text-muted-foreground">Price Comparison</Label>
                                    <div className="flex items-center gap-2 mt-2">
                                        {assetData.valuation.supplier_quote_price <= assetData.valuation.market_average_price ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                <span className="text-sm text-green-600">
                                                    Supplier price is at or below market ({((1 - assetData.valuation.supplier_quote_price / assetData.valuation.market_average_price) * 100).toFixed(1)}% below)
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                <span className="text-sm text-amber-600">
                                                    Supplier price is above market (+{((assetData.valuation.supplier_quote_price / assetData.valuation.market_average_price - 1) * 100).toFixed(1)}%)
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Security */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="h-4 w-4 text-emerald-600" />
                                Security Position
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Asset Location</Label>
                                    <Input
                                        value={assetData.security.asset_location}
                                        onChange={e => setAssetData(prev => ({
                                            ...prev,
                                            security: { ...prev.security, asset_location: e.target.value }
                                        }))}
                                        placeholder="e.g., Nottingham Warehouse"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Title Check Status</Label>
                                    <Select
                                        value={assetData.security.title_check_status}
                                        onValueChange={val => setAssetData(prev => ({
                                            ...prev,
                                            security: { ...prev.security, title_check_status: val }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Clear">Clear</SelectItem>
                                            <SelectItem value="Outstanding Finance">Outstanding Finance</SelectItem>
                                            <SelectItem value="Pending Check">Pending Check</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Ledger Analyser Module */}
            {activeModule === "ledger" && (
                <div className="space-y-6">
                    {/* Dashboard Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-blue-700">
                                    {ledgerData.book_summary.total_debtors || 0}
                                </div>
                                <p className="text-sm text-blue-600">Total Debtors</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-200">
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-green-700">
                                    £{(ledgerData.book_summary.total_outstanding || 0).toLocaleString()}
                                </div>
                                <p className="text-sm text-green-600">Outstanding Value</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-amber-200">
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-amber-700">
                                    {ledgerData.risk_factors.concentration_limit_percent || 0}%
                                </div>
                                <p className="text-sm text-amber-600">Concentration Limit</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50 border-emerald-200">
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-emerald-700">
                                    {ledgerData.risk_factors.dilution_rate_percent || 0}%
                                </div>
                                <p className="text-sm text-emerald-600">Dilution Rate</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Book Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        Book Summary
                                    </span>
                                    <AIActionButton action="upload_and_scan_ledger" label="Scan Ledger" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Total Debtors</Label>
                                    <Input
                                        type="number"
                                        value={ledgerData.book_summary.total_debtors || ""}
                                        onChange={e => setLedgerData(prev => ({
                                            ...prev,
                                            book_summary: { ...prev.book_summary, total_debtors: parseInt(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Outstanding (£)</Label>
                                    <Input
                                        type="number"
                                        value={ledgerData.book_summary.total_outstanding || ""}
                                        onChange={e => setLedgerData(prev => ({
                                            ...prev,
                                            book_summary: { ...prev.book_summary, total_outstanding: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Risk Factors */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    Risk Factors
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Concentration Limit (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={ledgerData.risk_factors.concentration_limit_percent || ""}
                                        onChange={e => setLedgerData(prev => ({
                                            ...prev,
                                            risk_factors: { ...prev.risk_factors, concentration_limit_percent: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Top Debtor Exposure</Label>
                                    <Input
                                        value={ledgerData.risk_factors.top_debtor_exposure}
                                        onChange={e => setLedgerData(prev => ({
                                            ...prev,
                                            risk_factors: { ...prev.risk_factors, top_debtor_exposure: e.target.value }
                                        }))}
                                        placeholder="e.g., Tesco PLC (15%)"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Foreign Debt (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={ledgerData.risk_factors.foreign_debt_percentage || ""}
                                            onChange={e => setLedgerData(prev => ({
                                                ...prev,
                                                risk_factors: { ...prev.risk_factors, foreign_debt_percentage: parseFloat(e.target.value) || 0 }
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Dilution Rate (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={ledgerData.risk_factors.dilution_rate_percent || ""}
                                            onChange={e => setLedgerData(prev => ({
                                                ...prev,
                                                risk_factors: { ...prev.risk_factors, dilution_rate_percent: parseFloat(e.target.value) || 0 }
                                            }))}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Audit */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    Audit Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Last Audit Date</Label>
                                        <Input
                                            type="date"
                                            value={ledgerData.audit.last_audit_date}
                                            onChange={e => setLedgerData(prev => ({
                                                ...prev,
                                                audit: { ...prev.audit, last_audit_date: e.target.value }
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Verification Method</Label>
                                        <Select
                                            value={ledgerData.audit.verification_method}
                                            onValueChange={val => setLedgerData(prev => ({
                                                ...prev,
                                                audit: { ...prev.audit, verification_method: val }
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select method" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Phone Audit">Phone Audit</SelectItem>
                                                <SelectItem value="Site Visit">Site Visit</SelectItem>
                                                <SelectItem value="Document Review">Document Review</SelectItem>
                                                <SelectItem value="Third Party">Third Party</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Real Estate Module */}
            {activeModule === "property" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Property Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Home className="h-4 w-4 text-blue-600" />
                                    Property Details
                                </span>
                                <AIActionButton action="land_registry_lookup" label="Land Registry" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Textarea
                                    value={propertyData.property_details.address}
                                    onChange={e => setPropertyData(prev => ({
                                        ...prev,
                                        property_details: { ...prev.property_details, address: e.target.value }
                                    }))}
                                    placeholder="Full property address"
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Title Number</Label>
                                    <Input
                                        value={propertyData.property_details.title_number}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            property_details: { ...prev.property_details, title_number: e.target.value }
                                        }))}
                                        placeholder="e.g., NT123456"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tenure</Label>
                                    <Select
                                        value={propertyData.property_details.tenure}
                                        onValueChange={val => setPropertyData(prev => ({
                                            ...prev,
                                            property_details: { ...prev.property_details, tenure: val }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select tenure" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FREEHOLD">Freehold</SelectItem>
                                            <SelectItem value="LEASEHOLD">Leasehold</SelectItem>
                                            <SelectItem value="COMMONHOLD">Commonhold</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Property Type</Label>
                                <Input
                                    value={propertyData.property_details.property_type}
                                    onChange={e => setPropertyData(prev => ({
                                        ...prev,
                                        property_details: { ...prev.property_details, property_type: e.target.value }
                                    }))}
                                    placeholder="e.g., Retail with uppers"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Valuation Metrics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-green-600" />
                                    Valuation Metrics
                                </span>
                                <AIActionButton action="fetch_zoopla_estimates" label="Get Estimates" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Purchase Price (£)</Label>
                                    <Input
                                        type="number"
                                        value={propertyData.valuation_metrics.purchase_price || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            valuation_metrics: { ...prev.valuation_metrics, purchase_price: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Red Book Valuation (£)</Label>
                                    <Input
                                        type="number"
                                        value={propertyData.valuation_metrics.red_book_valuation || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            valuation_metrics: { ...prev.valuation_metrics, red_book_valuation: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Vacant Possession Value (£)</Label>
                                    <Input
                                        type="number"
                                        value={propertyData.valuation_metrics.vacant_possession_value || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            valuation_metrics: { ...prev.valuation_metrics, vacant_possession_value: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>90-Day Sale Value (£)</Label>
                                    <Input
                                        type="number"
                                        value={propertyData.valuation_metrics.ninety_day_sale_value || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            valuation_metrics: { ...prev.valuation_metrics, ninety_day_sale_value: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Current LTV (%)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={propertyData.valuation_metrics.current_ltv_percent || ""}
                                    onChange={e => setPropertyData(prev => ({
                                        ...prev,
                                        valuation_metrics: { ...prev.valuation_metrics, current_ltv_percent: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Income Yield */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                Income & Yield
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Current Rental Income (£/year)</Label>
                                    <Input
                                        type="number"
                                        value={propertyData.income_yield.current_rental_income || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            income_yield: { ...prev.income_yield, current_rental_income: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Gross Yield (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={propertyData.income_yield.gross_yield_percent || ""}
                                        onChange={e => setPropertyData(prev => ({
                                            ...prev,
                                            income_yield: { ...prev.income_yield, gross_yield_percent: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Occupancy Status</Label>
                                    <Select
                                        value={propertyData.income_yield.occupancy_status}
                                        onValueChange={val => setPropertyData(prev => ({
                                            ...prev,
                                            income_yield: { ...prev.income_yield, occupancy_status: val }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Fully Let">Fully Let</SelectItem>
                                            <SelectItem value="Partially Let">Partially Let</SelectItem>
                                            <SelectItem value="Vacant">Vacant</SelectItem>
                                            <SelectItem value="Owner Occupied">Owner Occupied</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                    {saveMutation.isPending ? "Saving..." : "Save Research Data"}
                </Button>
            </div>
        </div>
    );
}
