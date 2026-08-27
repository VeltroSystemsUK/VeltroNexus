import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { assessBbbEligibility, BBB_QUESTIONS, BBB_SCHEME_NAME } from "@shared/bbbEligibility";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Building2,
  PoundSterling,
  User,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ArrowRight,
  ArrowLeft,
  FileText,
  Shield,
  Share2,
  Copy,
  MessageSquare,
  Check,
  RefreshCw,
  FileSignature,
  Sparkles
} from "lucide-react";

interface CompanySearchResult {
  title: string;
  company_number: string;
  address_snippet?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
}

interface ExistingDebt {
  id: string;
  lender: string;
  balance: number;
  rate: number;
  monthlyPayment: number;
}

export default function IntroductionPortal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Wizard Steps:
  // 1. Gateway (User & Loan type)
  // 2. Contact & Company Intake (with autocomplete & mock map verification)
  // 3. Pre-qualification BBB Checklist
  // 4. Factfind (Refinance details vs. New Loan amount)
  // 5. Pricing Indication (19% APR 60 months standard)
  // 6. Fee Disclosure & Client Agreement Share
  // 7. Signature & Engagement Letter
  // 8. Success Screen
  const [step, setStep] = useState<number>(1);
  const totalSteps = 7; // Steps 1 to 7. Step 8 is the success dashboard.

  // --- Step 1 State: Gateway Selection ---
  const [userType, setUserType] = useState<"customer" | "introducer">("customer");
  const [requestType, setRequestType] = useState<"refinance" | "new_loan">("refinance");

  // --- Step 2 State: Contact & Company Intake ---
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([]);
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [customPostcode, setCustomPostcode] = useState("");
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [isLocationVerified, setIsLocationVerified] = useState(false);

  // Debouncing for Companies House Search
  useEffect(() => {
    if (!companySearchQuery || companySearchQuery.trim().length < 3 || selectedCompany) {
      setCompanyResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingCompany(true);
      try {
        const res = await fetch(`/api/inbound/companies-house/search?q=${encodeURIComponent(companySearchQuery)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setCompanyResults(data.items || []);
        }
      } catch (err) {
        console.error("Error fetching companies:", err);
      } finally {
        setIsSearchingCompany(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [companySearchQuery, selectedCompany]);

  const handleSelectCompany = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setCompanySearchQuery(company.title);
    setCompanyResults([]);
    
    // Extract postcode from address snippet if present
    const snippet = company.address_snippet || "";
    setCustomAddress(snippet);
    const postcodeMatch = snippet.match(/([A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2})/i);
    if (postcodeMatch) {
      setCustomPostcode(postcodeMatch[1].toUpperCase());
    }

    // Trigger mock location verification
    setIsVerifyingLocation(true);
    setIsLocationVerified(false);
    setTimeout(() => {
      setIsVerifyingLocation(false);
      setIsLocationVerified(true);
      toast({
        title: "Trading Location Verified",
        description: "Google Maps mock verification checks complete for business trading address.",
      });
    }, 1500);
  };

  const handleClearCompany = () => {
    setSelectedCompany(null);
    setCompanySearchQuery("");
    setCustomAddress("");
    setCustomPostcode("");
    setIsLocationVerified(false);
  };

  // --- Step 3 State: British Business Bank eligibility ---
  const [bbbAnswers, setBbbAnswers] = useState<Record<string, boolean | undefined>>({});
  const [showIneligibleStop, setShowIneligibleStop] = useState(false);

  const handleChecklistChange = (key: string, val: boolean) => {
    setBbbAnswers((prev) => ({ ...prev, [key]: val }));
  };

  // --- Step 4 State: Factfind ---
  const [existingDebts, setExistingDebts] = useState<ExistingDebt[]>([
    { id: "1", lender: "Lloyds Bank", balance: 45000, rate: 12.5, monthlyPayment: 1050 }
  ]);
  const [newLender, setNewLender] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [isEstimate, setIsEstimate] = useState(false);
  
  const [requestedAmount, setRequestedAmount] = useState<string>("50000");
  const [requestedTerm, setRequestedTerm] = useState<number>(60);

  // Prefill from stratafinance.co.uk (and introducer share links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return;

    const name = (params.get("name") || params.get("contactName") || "").trim();
    const emailParam = (params.get("email") || "").trim();
    const phoneParam = (params.get("phone") || "").trim();
    const company = (params.get("company") || params.get("compName") || "").trim();
    const amount = Number(params.get("amount") || "");
    const monthly = Number(params.get("monthly") || "");
    const type = params.get("type");
    const ref = params.get("ref");

    if (ref === "introducer") setUserType("introducer");
    if (type === "new_loan" || type === "refinance") setRequestType(type);
    if (name) setContactName(name);
    if (emailParam) setEmail(emailParam);
    if (phoneParam) setPhone(phoneParam);
    if (company) setCompanySearchQuery(company);

    if (Number.isFinite(amount) && amount > 0) {
      if (type === "new_loan") {
        setRequestedAmount(String(Math.round(amount)));
      } else {
        setExistingDebts([{
          id: "1",
          lender: "Existing facility",
          balance: amount,
          rate: 15,
          monthlyPayment: Number.isFinite(monthly) && monthly > 0 ? monthly : 0,
        }]);
      }
    }

    if (name || emailParam || company || (Number.isFinite(amount) && amount > 0)) {
      setStep(2);
    }
  }, []);

  const handleAddDebt = () => {
    if (!newLender || !newBalance) {
      toast({
        title: "Invalid Debt Entry",
        description: "Please provide a lender name and balance amount.",
        variant: "destructive"
      });
      return;
    }
    const balanceVal = parseFloat(newBalance) || 0;
    const rateVal = parseFloat(newRate) || 15;
    const monthlyVal = parseFloat(newMonthly) || 0;

    const newDebtObj: ExistingDebt = {
      id: Math.random().toString(),
      lender: newLender,
      balance: balanceVal,
      rate: rateVal,
      monthlyPayment: monthlyVal
    };

    setExistingDebts([...existingDebts, newDebtObj]);
    setNewLender("");
    setNewBalance("");
    setNewRate("");
    setNewMonthly("");
  };

  const handleRemoveDebt = (id: string) => {
    setExistingDebts(existingDebts.filter(d => d.id !== id));
  };

  const totalRefinanceRequired = existingDebts.reduce((sum, d) => sum + d.balance, 0);
  const currentTotalMonthly = existingDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const bbbAssessment = assessBbbEligibility({
    answers: bbbAnswers,
    address: customAddress || selectedCompany?.address_snippet,
    loanAmountGbp: requestType === "refinance" ? totalRefinanceRequired : (parseFloat(requestedAmount) || undefined),
  });
  const isEligible = bbbAssessment.status === "pass";

  // --- Step 5 State: Pricing Indication ---
  const standardApr = 19.0;
  const getPrincipal = () => {
    return requestType === "refinance" ? totalRefinanceRequired : (parseFloat(requestedAmount) || 0);
  };
  
  const calculateMonthlyPaymentForApr = (principal: number, apr: number, termMonths: number) => {
    if (principal <= 0) return 0;
    const monthlyRate = (apr / 12) / 100;
    if (monthlyRate === 0) return principal / termMonths;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  const calculatedMonthly = calculateMonthlyPaymentForApr(getPrincipal(), standardApr, requestedTerm);

  const getRegionText = () => {
    if (!customPostcode) return "United Kingdom (National)";
    const prefix = customPostcode.trim().substring(0, 2).toUpperCase();
    if (["EH", "G", "AB", "DD", "IV"].some(p => prefix.startsWith(p))) return "Scotland Region";
    if (["CF", "SA", "LL"].some(p => prefix.startsWith(p))) return "Wales Region";
    if (["BT"].some(p => prefix.startsWith(p))) return "Northern Ireland Region";
    if (["M", "OL", "BL", "WN", "WA", "PR", "LA", "FY", "L"].some(p => prefix.startsWith(p))) return "North West Region";
    if (["LS", "BD", "HD", "HX", "WF", "S", "DN", "HU", "YO"].some(p => prefix.startsWith(p))) return "Yorkshire & Humber Region";
    if (["B", "CV", "DY", "ST", "TF", "WR", "WV"].some(p => prefix.startsWith(p))) return "West Midlands Region";
    if (["NG", "DE", "LE", "LN", "NN"].some(p => prefix.startsWith(p))) return "East Midlands Region";
    if (["CB", "IP", "NR", "CO", "CM", "SS"].some(p => prefix.startsWith(p))) return "East of England Region";
    if (["EC", "WC", "W", "NW", "N", "E", "SE", "SW", "CR", "HA", "IG", "UB", "EN", "KT", "RM", "SM", "TW", "WD"].some(p => prefix.startsWith(p))) return "London Greater Metro Region";
    return "South East / South West England Region";
  };

  const getCDFILenders = () => {
    const region = getRegionText();
    if (region.includes("Scotland")) return ["BCF (Business Loans Scotland)", "Responsible Finance Scotland"];
    if (region.includes("Wales")) return ["Development Bank of Wales", "Responsible Finance Wales"];
    if (region.includes("North West")) return ["GC Business Finance", "Enterprise Answers"];
    if (region.includes("Yorkshire")) return ["Key Fund", "Finance Yorkshire"];
    if (region.includes("Midlands")) return ["BCF (Midlands Enterprise)", "ART Business Loans"];
    if (region.includes("London")) return ["Fair Finance (London)", "Responsible Finance Capital"];
    return ["ART Business Loans", "Responsible Finance Capital", "Enterprise Answers"];
  };

  const matchedCDFIs = getCDFILenders();

  const [callbackMedium, setCallbackMedium] = useState<"whatsapp" | "phone" | "email">("whatsapp");
  const [isCallbackInitiated, setIsCallbackInitiated] = useState(false);

  const handleInitiateCallback = () => {
    setIsCallbackInitiated(true);
    if (callbackMedium === "whatsapp") {
      const waText = encodeURIComponent(`Hi Veltro, I am interested in the ${requestType === "refinance" ? "Refinance" : "Business Loan"} indicative quote of £${getPrincipal().toLocaleString()} with a monthly cost of £${Math.round(calculatedMonthly).toLocaleString()} / month. Let's discuss!`);
      const waUrl = `https://wa.me/447700900077?text=${waText}`;
      window.open(waUrl, "_blank");
    } else if (callbackMedium === "phone") {
      toast({
        title: "Callback Requested",
        description: "An adviser will call you shortly on your provided phone number.",
      });
    } else {
      toast({
        title: "Information Package Emailed",
        description: `We have dispatched the loan calculation details to ${email}.`,
      });
    }
  };

  // --- Step 6 State: Disclosure ---
  const [disclosureChecked, setDisclosureChecked] = useState(false);
  const [introducerAgreementUrl, setIntroducerAgreementUrl] = useState("");

  useEffect(() => {
    if (step === 6) {
      const shareUrl = `${window.location.origin}/introduction-portal?ref=introducer&compName=${encodeURIComponent(companySearchQuery)}&amount=${getPrincipal()}&email=${encodeURIComponent(email)}`;
      setIntroducerAgreementUrl(shareUrl);
    }
  }, [step]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(introducerAgreementUrl);
    toast({
      title: "Agreement Link Copied!",
      description: "Send this link to the customer so they can directly approve the 1% fee and sign the Engagement Letter.",
    });
  };

  // --- Step 7 State: Handover & Signature ---
  const [signatureName, setSignatureName] = useState("");
  const [signatureTitle, setSignatureTitle] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState("");

  const handleSubmitPortal = async () => {
    if (bbbAssessment.status !== "pass") {
      toast({
        title: "Not eligible",
        description: "British Business Bank eligibility must pass before we can consider this application.",
        variant: "destructive"
      });
      setShowIneligibleStop(true);
      return;
    }

    if (!signatureName || !termsAccepted) {
      toast({
        title: "Action Required",
        description: "Please sign the document and accept the terms to submit your application.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        // Contact Info
        contactName,
        email,
        phone: phone || null,

        // Company Info
        companyName: selectedCompany ? selectedCompany.title : companySearchQuery,
        companyNumber: selectedCompany ? selectedCompany.company_number : "00000000",
        registeredAddress: customAddress || (selectedCompany ? selectedCompany.address_snippet : null),
        postcode: customPostcode || null,
        incorporationDate: selectedCompany ? selectedCompany.date_of_creation : null,
        companyStatus: selectedCompany ? selectedCompany.company_status : "active",
        companyType: selectedCompany ? selectedCompany.company_type : "ltd",

        // Application Details
        gatewaySelection: { userType, requestType },
        loanAmount: getPrincipal(),
        term: requestedTerm,
        monthlyPayment: parseFloat(calculatedMonthly.toFixed(2)),
        matchedLender: matchedCDFIs[0] || "Regional CDFI Pool",
        region: getRegionText(),

        // Eligibility & Docs
        checklistAnswers: bbbAnswers,
        bbbEligibility: bbbAssessment,
        factfindData: requestType === "refinance" ? { existingDebts, isEstimate } : { requestedAmount },
        disclosuresAgreed: disclosureChecked,

        // Signature
        signatureName,
        signatureDate: new Date().toLocaleDateString("en-GB"),

        // Metadata
        source: "introduction-portal",
        stage: "lead"
      };

      // Submit to inbound API to create prospect
      const res = await apiRequest("/api/inbound/portal-submit", "POST", payload);

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success || data.prospectId) {
        setSubmissionId(data.prospectId || "NEW-PROSPECT");
        setStep(8);
        toast({
          title: "Application submitted",
          description: "You'll appear on the dashboard within moments.",
        });
      } else {
        throw new Error(data.error || "Submission failed");
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      toast({
        title: "Couldn't submit",
        description: err.message || "Check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 2) {
      if (!contactName || !email) {
        toast({
          title: "Missing Information",
          description: "Please fill in your contact name and email.",
          variant: "destructive"
        });
        return;
      }
      if (!companySearchQuery) {
        toast({
          title: "Company Not Selected",
          description: "Please search and select your company.",
          variant: "destructive"
        });
        return;
      }
    }

    if (step === 3) {
      if (bbbAssessment.status !== "pass") {
        setShowIneligibleStop(true);
        return;
      }
    }

    if (step === 4) {
      if (requestType === "refinance" && existingDebts.length === 0) {
        toast({
          title: "Debt Ledger Empty",
          description: "Please add at least one existing debt profile to refinance.",
          variant: "destructive"
        });
        return;
      }
      if (requestType === "new_loan" && getPrincipal() <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid loan amount.",
          variant: "destructive"
        });
        return;
      }
    }

    if (step === 6) {
      if (!disclosureChecked) {
        toast({
          title: "Disclosure Unaccepted",
          description: "You must review and check the disclosure agreement box to continue.",
          variant: "destructive"
        });
        return;
      }
    }

    setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-600 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-600 rounded-full opacity-5 blur-3xl"></div>
      </div>
      <div className="relative z-10">

      <header className="max-w-4xl w-full mx-auto flex items-center justify-between mb-6 pb-4 border-b border-emerald-900/30">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Veltro
            </h1>
            <p className="text-xs text-slate-400">Get funding fast</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-800/50">
          <Shield className="h-3.5 w-3.5" /> Secure
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center max-w-4xl w-full mx-auto mb-8">
        
        {showIneligibleStop ? (
          <Card className="w-full border-amber-800/50 shadow-2xl bg-slate-800/50 overflow-hidden animate-in fade-in duration-300 backdrop-blur">
            <div className="bg-amber-950/50 border-b border-amber-800/50 p-6 flex items-start gap-4">
              <div className="bg-amber-800 text-amber-100 p-3 rounded-full">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-amber-100">Not right now</h2>
                <p className="text-sm text-amber-200/70 mt-1">
                  We can only consider applications that are eligible for {BBB_SCHEME_NAME}.
                </p>
              </div>
            </div>
            <CardContent className="p-8 space-y-6">
              <div>
                <h3 className="font-semibold text-white text-base mb-3">What needs to change:</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {bbbAssessment.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2"><span className="text-amber-400">•</span> {reason}</li>
                  ))}
                </ul>
              </div>

              <div className="p-5 bg-slate-700/20 rounded-xl border border-slate-700">
                <h4 className="font-semibold text-slate-100 text-sm mb-3">Other funding options:</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <h5 className="font-semibold text-white">British Business Bank</h5>
                    <p className="text-xs text-slate-400 mt-1">Find government-backed lenders and grants</p>
                    <a href="https://www.british-business-bank.co.uk/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold mt-1.5 inline-block">Visit →</a>
                  </div>
                  <div className="pt-2 border-t border-slate-700">
                    <h5 className="font-semibold text-white">Business Debtline</h5>
                    <p className="text-xs text-slate-400 mt-1">Free advice on debt and finances</p>
                    <a href="https://www.businessdebtline.org/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold mt-1.5 inline-block">Visit →</a>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-800/30 border-t border-slate-700 p-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowIneligibleStop(false);
                setStep(1);
              }} className="border-slate-600 text-slate-300 hover:bg-slate-700/30">Try again</Button>
              <Button onClick={() => setLocation("/")} className="bg-emerald-600 hover:bg-emerald-700 font-semibold">Back</Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="w-full">
            {step <= totalSteps && (
              <div className="mb-6">
                <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-3">
                  <span>Step {step} of {totalSteps}</span>
                  <span className="text-emerald-400 font-semibold">
                    {step === 1 && "Start"}
                    {step === 2 && "Your details"}
                    {step === 3 && "Eligibility"}
                    {step === 4 && "Finances"}
                    {step === 5 && "Quote"}
                    {step === 6 && "Terms"}
                    {step === 7 && "Sign"}
                  </span>
                </div>
                <div className="w-full bg-slate-700/40 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 h-full transition-all duration-300" style={{width: `${(step / totalSteps) * 100}%`}}></div>
                </div>
              </div>
            )}

            {step === 1 && (
              <Card className="w-full bg-slate-800/40 border border-emerald-800/40 shadow-2xl backdrop-blur-xl animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 via-transparent to-transparent pointer-events-none"></div>
                <CardHeader className="text-center pb-8 border-b border-emerald-800/30 relative z-10">
                  <CardTitle className="text-4xl font-bold text-white tracking-tight animate-in slide-in-from-top-2 duration-700 delay-100">Get funded</CardTitle>
                  <CardDescription className="text-slate-300 text-base mt-3 animate-in slide-in-from-top-2 duration-700 delay-200">Quick application. Real terms in minutes.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-200">Who are you?</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setUserType("customer")}
                        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                          userType === "customer"
                            ? "border-emerald-600 bg-emerald-950/40"
                            : "border-slate-700 hover:border-slate-600 bg-slate-700/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg ${userType === "customer" ? "bg-emerald-600 text-white" : "bg-slate-600 text-slate-300"}`}>
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white text-base">Business owner</h4>
                            <p className="text-xs text-slate-400 mt-0.5">Apply for myself</p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => setUserType("introducer")}
                        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                          userType === "introducer"
                            ? "border-emerald-600 bg-emerald-950/40"
                            : "border-slate-700 hover:border-slate-600 bg-slate-700/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg ${userType === "introducer" ? "bg-emerald-600 text-white" : "bg-slate-600 text-slate-300"}`}>
                            <Share2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white text-base">Broker</h4>
                            <p className="text-xs text-slate-400 mt-0.5">Introducing a client</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-200">What do you need?</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setRequestType("refinance")}
                        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                          requestType === "refinance"
                            ? "border-emerald-600 bg-emerald-950/40"
                            : "border-slate-700 hover:border-slate-600 bg-slate-700/20"
                        }`}
                      >
                        <h4 className="font-semibold text-white text-base">
                          {userType === "customer" ? "Refinance existing debt" : "Refinance for a client"}
                        </h4>
                        <p className="text-xs text-slate-400 mt-2">Consolidate debt at better rates</p>
                      </button>
                      <button
                        onClick={() => setRequestType("new_loan")}
                        className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 text-left ${
                          requestType === "new_loan"
                            ? "border-emerald-600 bg-emerald-950/40"
                            : "border-slate-700 hover:border-slate-600 bg-slate-700/20"
                        }`}
                      >
                        <h4 className="font-semibold text-white text-base">
                          {userType === "customer" ? "New working capital" : "New loan for a client"}
                        </h4>
                        <p className="text-xs text-slate-400 mt-2">Growth capital or business funding</p>
                      </button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-800/30 border-t border-emerald-800/30 p-6 flex justify-end">
                  <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8 font-semibold shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:scale-105 active:scale-95">
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 2 && (
              <Card className="w-full bg-slate-800/40 border border-emerald-800/40 shadow-2xl backdrop-blur-xl animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 via-transparent to-transparent pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-2xl font-bold text-white animate-in slide-in-from-top-2 duration-700">Your details</CardTitle>
                  <CardDescription className="text-slate-300 animate-in slide-in-from-top-2 duration-700 delay-100">Let's verify your business and contact info</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-700 delay-300">
                    <div className="space-y-2">
                      <Label htmlFor="contactName" className="text-slate-200 text-sm font-semibold">Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="contactName"
                          placeholder="Your name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="pl-9 bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-200 text-sm font-semibold">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.co.uk"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9 bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-200 text-sm font-semibold">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <Input
                          id="phone"
                          placeholder="07700 000000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-9 bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="companySearch" className="text-slate-200 text-sm font-semibold">Your company</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="companySearch"
                        placeholder="Company name or number..."
                        value={companySearchQuery}
                        onChange={(e) => {
                          setCompanySearchQuery(e.target.value);
                          if (selectedCompany) handleClearCompany();
                        }}
                        className="pl-9 pr-10 bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                      />
                      {selectedCompany && (
                        <button
                          onClick={handleClearCompany}
                          className="absolute right-3 top-3.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          Clear
                        </button>
                      )}
                      {isSearchingCompany && (
                        <RefreshCw className="absolute right-10 top-3 h-4 w-4 animate-spin text-emerald-600" />
                      )}
                    </div>

                    {companyResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 mt-1 max-h-60 overflow-y-auto divide-y divide-slate-600">
                        {companyResults.map((company) => (
                          <button
                            key={company.company_number}
                            onClick={() => handleSelectCompany(company)}
                            className="w-full p-3.5 hover:bg-slate-600/50 cursor-pointer transition-colors duration-150 flex flex-col text-left"
                          >
                            <span className="font-semibold text-white text-sm">{company.title}</span>
                            <div className="flex gap-4 text-xs text-slate-400 mt-1">
                              <span>Reg: {company.company_number}</span>
                              {company.address_snippet && (
                                <span className="truncate max-w-[400px]">{company.address_snippet}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedCompany && (
                    <div className="border border-emerald-800/50 rounded-xl bg-emerald-950/30 p-5 mt-4 space-y-4 transition-all duration-300">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <h4 className="font-semibold text-emerald-300 text-sm">Verified</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs">Address</p>
                          <p className="text-white font-medium">{customAddress}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Postcode</p>
                          <p className="text-white font-medium">{customPostcode || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Incorporated</p>
                          <p className="text-white font-medium">{selectedCompany.date_of_creation || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Status</p>
                          <p className="text-emerald-400 font-medium uppercase text-xs">{selectedCompany.company_status}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-800/20 border-t border-emerald-800/30 p-6 flex justify-between relative z-10">
                  <Button variant="ghost" onClick={prevStep} className="gap-2 text-slate-300 hover:text-white hover:bg-slate-700/30">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-6 font-semibold shadow-lg shadow-emerald-600/20">
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 3 && (
              <Card className="w-full bg-slate-800/40 border border-emerald-800/40 shadow-2xl backdrop-blur-xl animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 via-transparent to-transparent pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-2xl font-bold text-white">British Business Bank eligibility</CardTitle>
                  <CardDescription className="text-slate-300">
                    We can only consider applications that meet {BBB_SCHEME_NAME} criteria. Every answer is required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4 relative z-10">
                  {BBB_QUESTIONS.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-700/20 hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex-1 pr-4">
                        <h4 className="font-semibold text-white text-sm">{question.text}</h4>
                        <p className="text-xs text-slate-400 mt-1">{question.help}</p>
                      </div>
                      <RadioGroup
                        value={bbbAnswers[question.id] === true ? "yes" : bbbAnswers[question.id] === false ? "no" : ""}
                        onValueChange={(val) => handleChecklistChange(question.id, val === "yes")}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id={`${question.id}-yes`} className="border-emerald-600 text-emerald-600" />
                          <Label htmlFor={`${question.id}-yes`} className="text-xs cursor-pointer text-slate-300">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id={`${question.id}-no`} className="border-slate-600 text-slate-600" />
                          <Label htmlFor={`${question.id}-no`} className="text-xs cursor-pointer text-slate-300">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}

                  {bbbAssessment.status !== "pass" && Object.keys(bbbAnswers).length > 0 && (
                    <div className="p-4 bg-amber-950/50 border border-amber-800/50 rounded-xl flex gap-3 text-amber-200 text-xs items-start">
                      <AlertCircle className="h-4.5 w-4.5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">Can't consider this application yet:</span>{" "}
                        {bbbAssessment.status === "incomplete"
                          ? "Answer every question."
                          : "It does not meet British Business Bank eligibility."}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-800/20 border-t border-emerald-800/30 p-6 flex justify-between relative z-10">
                  <Button variant="ghost" onClick={prevStep} className="gap-2 text-slate-300 hover:text-white hover:bg-slate-700/30">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={nextStep}
                    className={`gap-2 px-6 font-semibold shadow-lg ${isEligible ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"}`}
                  >
                    {isEligible ? "Looks good" : "Can't proceed"} {isEligible ? <ArrowRight className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 4 && (
              <Card className="w-full bg-slate-800/50 border-emerald-800/30 shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">
                    {requestType === "refinance" ? "Current debt" : "How much do you need?"}
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    {requestType === "refinance"
                      ? "List existing loans to consolidate into one"
                      : "Tell us the amount and term"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {requestType === "refinance" ? (
                    <div className="space-y-6">
                      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                              <th className="p-3">Existing Lender</th>
                              <th className="p-3 text-right">Outstanding Balance</th>
                              <th className="p-3 text-right">Current APR (%)</th>
                              <th className="p-3 text-right">Monthly Payment</th>
                              <th className="p-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingDebts.map((d) => (
                              <tr key={d.id} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                <td className="p-3 font-semibold text-gray-950">{d.lender}</td>
                                <td className="p-3 text-right font-mono">£{d.balance.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono">{d.rate}%</td>
                                <td className="p-3 text-right font-mono">£{d.monthlyPayment.toLocaleString()}</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleRemoveDebt(d.id)}
                                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {existingDebts.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 italic">No existing debts listed yet. Add a debt below to calculate your refinance rate.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl space-y-4">
                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider text-indigo-700">Add Existing Loan Profile</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="dLender" className="text-[10px]">Lender Name</Label>
                            <Input
                              id="dLender"
                              placeholder="e.g. Funding Circle"
                              value={newLender}
                              onChange={(e) => setNewLender(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="dBalance" className="text-[10px]">Outstanding Balance (£)</Label>
                            <Input
                              id="dBalance"
                              type="number"
                              placeholder="45000"
                              value={newBalance}
                              onChange={(e) => setNewBalance(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="dRate" className="text-[10px]">Current APR % (Approx)</Label>
                            <Input
                              id="dRate"
                              type="number"
                              placeholder="12.5"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="dMonthly" className="text-[10px]">Monthly Payment (£)</Label>
                            <Input
                              id="dMonthly"
                              type="number"
                              placeholder="1200"
                              value={newMonthly}
                              onChange={(e) => setNewMonthly(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button onClick={handleAddDebt} className="bg-[#4F46E5] hover:bg-[#4338CA] text-xs h-8 px-4">
                            Add to Refinance List
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-4 rounded-xl bg-gray-50 border border-gray-150">
                        <div className="space-y-0.5">
                          <span className="text-xs text-gray-400">TOTAL CONSOLIDATING BALANCE</span>
                          <h3 className="text-xl font-extrabold text-[#1F2937] font-mono">£{totalRefinanceRequired.toLocaleString()}</h3>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-xs text-gray-400 font-medium">CURRENT TOTAL MONTHLY COST</span>
                          <h3 className="text-xl font-bold text-gray-700 font-mono">£{currentTotalMonthly.toLocaleString()} / mo</h3>
                        </div>
                      </div>

                      {userType === "introducer" && (
                        <div className="flex items-center space-x-2.5 p-3 border border-amber-100 bg-amber-50/20 rounded-xl">
                          <Checkbox
                            id="roughEstimate"
                            checked={isEstimate}
                            onCheckedChange={(checked) => setIsEstimate(!!checked)}
                          />
                          <Label htmlFor="roughEstimate" className="text-xs text-amber-800 cursor-pointer font-medium">
                            I do not know the exact figures; these values represent a rough estimate of my client's liabilities.
                          </Label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="reqAmount" className="text-sm font-semibold">How much capital does the business require?</Label>
                        <div className="relative">
                          <PoundSterling className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
                          <Input
                            id="reqAmount"
                            type="number"
                            placeholder="50000"
                            value={requestedAmount}
                            onChange={(e) => setRequestedAmount(e.target.value)}
                            className="pl-10 text-lg py-6 font-mono font-bold"
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">Min: £10,000 | Max: £250,000 (CDFI Accredited Limit)</span>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Choose Preferred Term Structure</Label>
                        <RadioGroup
                          value={requestedTerm.toString()}
                          onValueChange={(val) => setRequestedTerm(parseInt(val))}
                          className="grid grid-cols-3 gap-2"
                        >
                          {[12, 24, 36, 48, 60].map((t) => (
                            <div key={t} className="flex">
                              <RadioGroupItem value={t.toString()} id={`term-${t}`} className="peer sr-only" />
                              <Label
                                htmlFor={`term-${t}`}
                                className={`flex-1 text-center p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                                  requestedTerm === t
                                    ? "border-[#4F46E5] bg-indigo-50/30 font-bold text-[#4F46E5]"
                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                }`}
                              >
                                {t} Mo
                                {t === 60 && <span className="block text-[8px] uppercase tracking-wider text-indigo-500 font-bold mt-0.5">Typical</span>}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-800/20 border-t border-emerald-800/30 p-6 flex justify-between relative z-10">
                  <Button variant="ghost" onClick={prevStep} className="gap-2 text-slate-300 hover:text-white hover:bg-slate-700/30">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-6 font-semibold shadow-lg shadow-emerald-600/20">
                    Get quote <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 5 && (
              <Card className="w-full bg-slate-800/50 border-emerald-800/30 shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Your quote</CardTitle>
                  <CardDescription className="text-slate-300">Here's what we can offer you</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border border-emerald-800/50 rounded-xl bg-emerald-950/20 p-6">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">quote</span>
                        <h3 className="text-xl font-bold text-white mt-2">Your terms</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">Amount</p>
                          <p className="font-bold text-white text-lg">£{getPrincipal().toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Repay over</p>
                          <p className="font-bold text-white text-lg">{requestedTerm} months</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Region</p>
                          <p className="font-semibold text-white">{getRegionText().split(" ")[0]}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">How many months left?</p>
                          <p className="font-semibold text-emerald-400">{requestedTerm} <span className="text-xs text-slate-400">(Optional)</span></p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 text-white rounded-xl p-5 flex flex-col justify-between items-center text-center shadow-lg border border-slate-800">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">monthly payment</span>
                        <h2 className="text-3xl font-extrabold font-mono mt-2 text-emerald-400">£{Math.round(calculatedMonthly).toLocaleString()}</h2>
                        <span className="text-[10px] text-slate-500 block mt-0.5">per month</span>
                      </div>

                      {requestType === "refinance" && currentTotalMonthly > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-700 w-full text-center">
                          <span className="text-[9px] text-emerald-400 block font-semibold uppercase">saves you</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            £{Math.max(0, Math.round(currentTotalMonthly - calculatedMonthly)).toLocaleString()} / mo
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lenders we'll approach</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {matchedCDFIs.map((cdfi, idx) => (
                        <div key={idx} className="p-4 border border-slate-700 rounded-xl bg-slate-700/20 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-950 rounded-lg text-emerald-600">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h5 className="font-semibold text-white text-sm">{cdfi}</h5>
                              <p className="text-[10px] text-slate-400">Accredited lender</p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">Matched</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 border border-emerald-800/50 rounded-xl bg-emerald-950/20 space-y-4">
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                      Next steps
                    </h4>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="flex-1 w-full">
                        <Label className="text-xs text-slate-400">How should we contact you?</Label>
                        <RadioGroup
                          value={callbackMedium}
                          onValueChange={(val: any) => setCallbackMedium(val)}
                          className="flex gap-4 mt-3"
                        >
                          <div className="flex items-center space-x-2 cursor-pointer">
                            <RadioGroupItem value="whatsapp" id="cb-wa" className="border-emerald-600 text-emerald-600" />
                            <Label htmlFor="cb-wa" className="text-xs cursor-pointer font-medium text-slate-300">WhatsApp</Label>
                          </div>
                          <div className="flex items-center space-x-2 cursor-pointer">
                            <RadioGroupItem value="phone" id="cb-phone" className="border-emerald-600 text-emerald-600" />
                            <Label htmlFor="cb-phone" className="text-xs cursor-pointer font-medium text-slate-300">Phone</Label>
                          </div>
                          <div className="flex items-center space-x-2 cursor-pointer">
                            <RadioGroupItem value="email" id="cb-email" className="border-emerald-600 text-emerald-600" />
                            <Label htmlFor="cb-email" className="text-xs cursor-pointer font-medium text-slate-300">Email</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="w-full md:w-auto flex gap-2">
                        <Button
                          onClick={handleInitiateCallback}
                          variant="outline"
                          className="flex-1 md:flex-initial gap-1.5 text-xs font-semibold h-10 border-emerald-600 text-emerald-400 hover:bg-emerald-950/40"
                        >
                          <MessageSquare className="h-4 w-4" /> Chat
                        </Button>
                        <Button
                          onClick={nextStep}
                          className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-6 h-10 shadow-lg shadow-emerald-600/20"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-between">
                  <Button variant="ghost" onClick={prevStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 6 && (
              <Card className="w-full bg-slate-800/50 border-emerald-800/30 shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Costs & terms</CardTitle>
                  <CardDescription className="text-slate-300">Here's what you'll pay</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700 bg-slate-700/20">
                    <div className="p-4 bg-slate-700/40 flex justify-between items-center">
                      <h4 className="font-semibold text-white text-sm">Fees</h4>
                      <span className="text-xs font-semibold text-slate-400">GBP</span>
                    </div>

                    <div className="p-4 flex justify-between gap-4">
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white text-sm">Application fee</h5>
                        <p className="text-xs text-slate-400">
                          1% of the loan amount. Only payable if we approve you. No fee if you're turned down.
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-white text-base">
                          £{Math.round(getPrincipal() * 0.01).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">1.0%</span>
                      </div>
                    </div>

                    <div className="p-4 flex justify-between gap-4">
                      <div className="space-y-2">
                        <h5 className="font-semibold text-white text-sm">Completion fee</h5>
                        <p className="text-xs text-slate-400">
                          1% when your loan funds. Covers our brokerage, negotiation, and document work.
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-emerald-400 text-base">
                          £{Math.round(getPrincipal() * 0.01).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">1.0%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border border-amber-800/50 rounded-xl bg-amber-950/30 space-y-2">
                    <h5 className="font-semibold text-amber-200 text-sm flex items-center gap-1.5">
                      <AlertCircle className="h-4.5 w-4.5 text-amber-400" /> Be honest
                    </h5>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Everything you tell us must be accurate. If we find you've hidden material information, we can't help you. That's on you, not us.
                    </p>
                  </div>

                  {userType === "introducer" && (
                    <div className="p-5 border border-emerald-800/50 rounded-xl bg-emerald-950/20 space-y-3">
                      <div>
                        <h5 className="font-semibold text-white text-sm flex items-center gap-1.5">
                          <Share2 className="h-4.5 w-4.5 text-emerald-400" /> Your client needs to sign
                        </h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Send them this link so they can review and sign the terms.
                        </p>
                      </div>

                      <div className="flex gap-2 items-center">
                        <Input
                          readOnly
                          value={introducerAgreementUrl}
                          className="bg-slate-700/40 border-slate-600 text-xs text-slate-400 font-mono select-all"
                        />
                        <Button onClick={handleCopyLink} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs font-semibold shrink-0 h-10 px-4 shadow-lg shadow-emerald-600/20">
                          <Copy className="h-4 w-4" /> Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-2.5 p-3 bg-slate-700/20 rounded-xl border border-slate-700">
                    <Checkbox
                      id="acceptFees"
                      checked={disclosureChecked}
                      onCheckedChange={(checked) => setDisclosureChecked(!!checked)}
                      className="mt-1"
                    />
                    <Label htmlFor="acceptFees" className="text-xs text-slate-300 cursor-pointer font-medium leading-relaxed">
                      I understand the fees (1% application, 1% completion) and confirm everything I've told you is accurate.
                    </Label>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-between">
                  <Button variant="ghost" onClick={prevStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={nextStep} className="bg-[#4F46E5] hover:bg-[#4338CA] gap-2 px-6">
                    Agree & Proceed <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 7 && (
              <Card className="w-full bg-slate-800/50 border-emerald-800/30 shadow-2xl backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Sign and submit</CardTitle>
                  <CardDescription className="text-slate-300">Review our terms, then sign to apply</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="h-56 overflow-y-auto p-4 border border-slate-700 rounded-xl bg-slate-700/20 text-[11px] text-slate-400 space-y-4 font-mono leading-relaxed">
                    <p className="font-semibold text-center border-b border-slate-700 pb-2 text-white text-xs">VELTRO TERMS OF REPRESENTATION</p>
                    <p>
                      <strong className="text-slate-300">1. Service.</strong> We'll arrange a loan with a lender matched to your region and needs.
                    </p>
                    <p>
                      <strong className="text-slate-300">2. No guarantee.</strong> We get approved lenders ready, but they make the final yes or no call.
                    </p>
                    <p>
                      <strong className="text-slate-300">3. Fees.</strong> 1% application fee (after pre-approval), 1% completion fee (when you get the money).
                    </p>
                    <p>
                      <strong className="text-slate-300">4. Your responsibility.</strong> Tell us the truth. If you hide something and get turned down, that's on you.
                    </p>
                    <p>
                      <strong className="text-slate-300">5. Law.</strong> English and Welsh law applies.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sigName" className="text-slate-200 text-sm font-semibold">Your name</Label>
                      <Input
                        id="sigName"
                        placeholder="Your full name"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        className="text-base font-semibold bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sigTitle" className="text-slate-200 text-sm font-semibold">Your role</Label>
                      <Input
                        id="sigTitle"
                        placeholder="e.g. Director"
                        value={signatureTitle}
                        onChange={(e) => setSignatureTitle(e.target.value)}
                        className="text-xs bg-slate-700/40 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-600 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {signatureName.trim().length > 0 && (
                    <div className="p-4 border-2 border-dashed border-emerald-800/50 rounded-xl bg-emerald-950/20 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Signed</span>
                        <div className="signature-font text-3xl text-emerald-400 tracking-wide select-none py-1">
                          {signatureName}
                        </div>
                        <span className="text-[9px] text-slate-500 block font-mono">ID: {Math.random().toString(36).substring(2, 12).toUpperCase()}</span>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <p><strong>Date:</strong> {new Date().toLocaleDateString("en-GB")}</p>
                        <p><strong>Status:</strong> Ready</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-2.5 p-3 bg-slate-700/20 rounded-xl border border-slate-700">
                    <Checkbox
                      id="acceptTerms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                      className="mt-1"
                    />
                    <Label htmlFor="acceptTerms" className="text-xs text-slate-300 cursor-pointer font-medium leading-relaxed">
                      I read the terms, I'll give correct information, and I'm ready to apply.
                    </Label>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-between">
                  <Button variant="ghost" onClick={prevStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={handleSubmitPortal}
                    disabled={isSubmitting}
                    className="bg-[#4F46E5] hover:bg-[#4338CA] gap-2 px-8 font-extrabold shadow-md h-11"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Submitting Application...
                      </>
                    ) : (
                      <>
                        <FileSignature className="h-4 w-4" /> Submit Application &rarr;
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {step === 8 && (
              <Card className="w-full bg-slate-800/40 border border-emerald-800/40 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 backdrop-blur-xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-transparent pointer-events-none"></div>
                <div className="bg-emerald-950/40 border-b border-emerald-800/50 p-8 flex flex-col items-center text-center relative z-10">
                  <div className="bg-emerald-900/40 text-emerald-400 p-4 rounded-full mb-4 animate-in scale-in duration-500 delay-200">
                    <CheckCircle2 className="h-12 w-12 animate-pulse" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-emerald-300 tracking-tight animate-in slide-in-from-top-2 duration-700 delay-300">You're in</h2>
                  <p className="text-sm text-emerald-200/70 mt-2 max-w-lg animate-in slide-in-from-top-2 duration-700 delay-400">
                    Your application's queued. We'll review it and be in touch in the next 4 hours.
                  </p>
                </div>
                <CardContent className="p-8 space-y-6 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 border border-emerald-800/40 bg-emerald-950/20 rounded-xl space-y-3 animate-in slide-in-from-left-2 duration-700 delay-500 backdrop-blur-sm">
                      <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-emerald-400 animate-spin-slow" /> What's next
                      </h4>
                      <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-400 leading-relaxed">
                        <li><strong className="text-slate-300">Review</strong>: Our underwriter checks your application</li>
                        <li><strong className="text-slate-300">Approval</strong>: We confirm if we can proceed</li>
                        <li><strong className="text-slate-300">Fee & lender</strong>: Payment link and lender details come via email</li>
                      </ol>
                    </div>

                    <div className="p-5 border border-emerald-800/40 bg-emerald-950/20 rounded-xl space-y-3 animate-in slide-in-from-right-2 duration-700 delay-500 backdrop-blur-sm">
                      <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-emerald-400" /> Your reference
                      </h4>
                      <div className="space-y-2 text-xs text-slate-400">
                        <p><strong className="text-slate-300">Reference:</strong> <span className="text-white">#VL-{submissionId || "PORTAL-APP"}</span></p>
                        <p><strong className="text-slate-300">Check in:</strong> 4 hours</p>
                        <p><strong className="text-slate-300">Status:</strong> <span className="text-emerald-400">Submitted</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 justify-center pt-2">
                    <Button variant="outline" onClick={() => {
                      setStep(1);
                      setSelectedCompany(null);
                      setCompanySearchQuery("");
                      setContactName("");
                      setEmail("");
                      setPhone("");
                      setSignatureName("");
                      setTermsAccepted(false);
                      setDisclosureChecked(false);
                    }} className="h-11 px-6 font-semibold border-slate-600 text-slate-300 hover:bg-slate-700/30">
                      New application
                    </Button>
                    <Button onClick={() => setLocation("/")} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 font-bold shadow-lg shadow-emerald-600/20">
                      Back to dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      </div>
      <footer className="max-w-4xl w-full mx-auto text-center py-4 border-t border-slate-700 mt-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 gap-2 relative z-10">
        <p>&copy; 2026 Veltro Systems UK. FCA registered.</p>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-slate-400 transition">Privacy</a>
          <a href="/terms" className="hover:text-slate-400 transition">Terms</a>
        </div>
      </footer>
    </div>
  );
}
