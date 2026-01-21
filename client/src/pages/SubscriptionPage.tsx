import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { Check, ShieldCheck, Lock, CreditCard, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import logoChrome from "@assets/logo-chrome.png";
import TermsAcceptance, { TermsAcceptanceData } from '@/components/TermsAcceptance';

// Make sure to call loadStripe outside of a component’s render
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_live_51Sh2YC3waJs9NQ1uDgAk6YSwo0dBVKwV1k2GMaYZKD0FPUjz1aV8rM8Mv8Jf9ejOo7tqvuHZ3VehGyP1hB0FYRRw00D6DVxhK5";
if (!stripeKey) {
    console.error("Stripe publishable key is missing!");
}
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const CARD_ELEMENT_OPTIONS = {
    style: {
        base: {
            fontSize: '15px',
            fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: '#1A1F36',
            '::placeholder': {
                color: '#697386',
            },
        },
        invalid: {
            color: '#C00',
        },
    },
};

// Define add-ons per plan to handle different pricing and credit amounts
const PLAN_ADDONS: Record<string, Array<{ id: string; name: string; price: number; type: 'recurring' | 'one-off' }>> = {
    broker: [
        { id: 'ai_underwriting', name: 'AI Underwriting', price: 49, type: 'recurring' },
        { id: 'compliance_hub', name: 'Compliance Hub', price: 49, type: 'recurring' },
        { id: 'prospect_package_1', name: 'Prospect Package 1 (100 credits)', price: 50, type: 'one-off' },
        { id: 'prospect_package_2', name: 'Prospect Package 2 (300 credits)', price: 100, type: 'one-off' }
    ],
    team: [
        { id: 'ai_underwriting', name: 'AI Underwriting', price: 149, type: 'recurring' },
        { id: 'compliance_hub', name: 'Compliance Hub', price: 149, type: 'recurring' },
        { id: 'prospect_package_team_1', name: 'Prospect Package 1 (500 credits)', price: 249, type: 'one-off' },
        { id: 'prospect_package_team_2', name: 'Prospect Package 2 (1000 credits)', price: 499, type: 'one-off' }
    ]
};

interface SubscriptionFormProps {
    plan: string;
    interval: string;
    currentPlan: any;
    selectedAddOns: string[];
    toggleAddOn: (id: string, isOneOff: boolean) => void;
    isValuePack: boolean;
}

const SubscriptionForm = ({ plan, interval, currentPlan, selectedAddOns, toggleAddOn, isValuePack }: SubscriptionFormProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const { user } = useAuth();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Get relevant add-ons for the selected plan
    const currentAddOns = PLAN_ADDONS[plan] || PLAN_ADDONS['broker'];

    const isAnnual = interval === 'annual';
    const multiplier = isAnnual ? 12 : 1;

    // Calculate totals
    const recurringAddOnsTotal = selectedAddOns.reduce((sum, id) => {
        const addon = currentAddOns.find(a => a.id === id);
        if (addon?.type === 'recurring') {
            return sum + ((addon.price || 0) * multiplier);
        }
        return sum;
    }, 0);

    const oneOffAddOnsTotal = selectedAddOns.reduce((sum, id) => {
        const addon = currentAddOns.find(a => a.id === id);
        if (addon?.type === 'one-off') {
            return sum + (addon.price || 0);
        }
        return sum;
    }, 0);

    const basePrice = parseFloat(currentPlan.billingPrice);

    let subtotal = basePrice + recurringAddOnsTotal;

    if (isValuePack) {
        // Value Pack Pricing: Broker £199, Team £699 (Monthly base)
        // 20% discount for annual billing
        const valuePackPriceMonthly = plan === 'team' ? 699 : 199;
        const discountedMonthly = isAnnual ? valuePackPriceMonthly * 0.8 : valuePackPriceMonthly;
        subtotal = isAnnual ? discountedMonthly * 12 : discountedMonthly;
    }

    // Add one-offs on top
    subtotal += oneOffAddOnsTotal;

    const vat = subtotal * 0.2;
    const total = subtotal + vat;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);
        setErrorMsg(null);

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) return;

        try {
            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
                billing_details: {
                    email: user?.email,
                    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                }
            });

            if (pmError) throw new Error(pmError.message);

            const response = await fetch('/api/stripe/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: paymentMethod.id,
                    email: user?.email,
                    plan,
                    interval,
                    addOns: selectedAddOns
                }),
            });

            const result = await response.json();

            if (result.error) throw new Error(result.error);

            if (result.status === 'requires_action') {
                const { error: confirmError } = await stripe.confirmCardPayment(result.clientSecret);
                if (confirmError) throw new Error(confirmError.message);
            }

            toast({
                title: "Subscription Active",
                description: "Welcome to Veltro! Your account has been upgraded."
            });
            setLocation('/subscription/complete?session_id=custom_flow');

        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full">
            {/* User Info */}
            <div className="bg-secondary/50 rounded-xl p-4 mb-6 flex items-center justify-between border border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                        {user?.firstName?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-foreground">{user?.email}</div>
                        <div className="text-xs text-muted-foreground">Logged in</div>
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 mb-6 flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {errorMsg}
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground/80">Card Information</label>
                    <div className="p-3.5 border border-input rounded-lg bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm">
                        <CardElement options={{
                            style: {
                                base: {
                                    fontSize: '16px',
                                    color: '#0f172a',
                                    '::placeholder': { color: '#94a3b8' },
                                },
                            }
                        }} />
                    </div>
                </div>

                {/* Add-ons Section */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-foreground/80">Additional Services</label>
                    {currentAddOns.map((addon) => {
                        const isSelected = selectedAddOns.includes(addon.id);
                        const disabled = isValuePack && addon.type === 'recurring'; // Cannot deselect recurring if Value Pack active

                        return (
                            <div
                                key={addon.id}
                                onClick={() => !disabled && toggleAddOn(addon.id, addon.type === 'one-off')}
                                className={`p-3 rounded-lg border transition-all flex items-center justify-between 
                                ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                                ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium">{addon.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {addon.type === 'one-off'
                                        ? `+£${addon.price} (one-off)`
                                        : (isValuePack && addon.type === 'recurring')
                                            ? <span className="text-green-600 font-bold">Included</span>
                                            : `+£${addon.price * multiplier}/${isAnnual ? 'yr' : 'mo'}`}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Summary */}
                <div className="bg-muted/30 rounded-xl p-5 border border-border">
                    <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-muted-foreground">Veltro {currentPlan.name} ({interval})</span>
                        <span className="font-medium">
                            {isValuePack ? <span className="line-through text-muted-foreground mr-2">£{basePrice.toFixed(2)}</span> : null}
                            £{(isValuePack ? (plan === 'team' ? 699 : 199) * (isAnnual ? 12 : 1) : basePrice).toFixed(2)}
                        </span>
                    </div>
                    {isValuePack && (
                        <div className="flex justify-between items-center mb-2 text-sm text-green-600">
                            <span className="font-medium">Value Pack Savings</span>
                            <span className="font-bold">Applied</span>
                        </div>
                    )}
                    {!isValuePack && recurringAddOnsTotal > 0 && (
                        <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-muted-foreground">Recurring Add-ons ({isAnnual ? 'Annual' : 'Monthly'})</span>
                            <span className="font-medium">£{recurringAddOnsTotal.toFixed(2)}</span>
                        </div>
                    )}
                    {oneOffAddOnsTotal > 0 && (
                        <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-muted-foreground">One-off Packages</span>
                            <span className="font-medium">£{oneOffAddOnsTotal.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center mb-3 text-sm">
                        <span className="text-muted-foreground">VAT (20%)</span>
                        <span className="font-medium">£{vat.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-3 mt-3 flex justify-between items-center text-base font-semibold">
                        <span>Total due today</span>
                        <span className="text-primary">£{total.toFixed(2)}</span>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={!stripe || loading}
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                    {loading ? <span className="animate-spin mr-2">⏳</span> : <Sparkles className="mr-2 h-4 w-4" />}
                    {loading ? 'Processing...' : 'Subscribe Now'}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
                    <ShieldCheck className="h-3 w-3 opacity-60" />
                    Payments secured by Stripe. Your card details are never stored.
                </div>
            </div>
        </form>
    );
};

export default function SubscriptionPage() {
    // Get plan from URL or default to broker annual
    const urlParams = new URLSearchParams(window.location.search);
    const plan = (urlParams.get("plan") as "broker" | "team") || "broker";
    const interval = (urlParams.get("interval") as "monthly" | "annual") || "annual";

    // Lifted State
    const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
    const [isValuePack, setIsValuePack] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [acceptanceData, setAcceptanceData] = useState<TermsAcceptanceData | null>(null);
    const { user } = useAuth();

    const handleTermsAccept = (data: TermsAcceptanceData) => {
        setAcceptanceData(data);
        setTermsAccepted(true);
    };

    const toggleAddOn = (id: string, isOneOff: boolean) => {
        setSelectedAddOns(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const activateValuePack = () => {
        setIsValuePack(true);
        const currentAddOns = PLAN_ADDONS[plan] || PLAN_ADDONS['broker'];
        const recurringIds = currentAddOns.filter(a => a.type === 'recurring').map(a => a.id);
        setSelectedAddOns(prev => {
            const oneOffs = prev.filter(id => {
                const finding = currentAddOns.find(a => a.id === id);
                return finding?.type === 'one-off';
            });
            return Array.from(new Set([...oneOffs, ...recurringIds]));
        });
    };

    const planConfig = {
        broker: {
            name: "Broker Plan",
            // billingPrice is what is charged today
            billingPrice: interval === "annual" ? "1428" : "149",
            // displayPrice is the per-month equivalent shown on left
            displayPrice: interval === "annual" ? "119" : "149",
        },
        team: {
            name: "Team Plan",
            billingPrice: interval === "annual" ? "5268" : "549",
            displayPrice: interval === "annual" ? "439" : "549",
        }
    };

    const currentPlan = planConfig[plan];

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-8 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1B4361 100%)' }}>

            {/* Animated Grid Background */}
            <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <div className="container max-w-[1200px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 relative z-10">

                {/* Left Panel: Features */}
                <div className="bg-[#0f172a]/80 backdrop-blur-md rounded-3xl p-8 lg:p-12 border border-white/10 flex flex-col justify-between h-full min-h-[600px] shadow-2xl">
                    <div>
                        <div className="mb-6">
                            <img src={logoChrome} alt="Veltro" className="h-10 object-contain" />
                        </div>
                        <h2 className="text-lg text-[#D97706] font-light mb-12">
                            Professional Lending Infrastructure
                        </h2>

                        <div className="mb-10">
                            <div className="text-sm uppercase tracking-widest text-[#D97706] font-semibold mb-2">{currentPlan.name}</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl lg:text-6xl font-bold tracking-tight text-white mb-2">£{currentPlan.displayPrice}</span>
                                <span className="text-xl text-[#D97706]">/month</span>
                            </div>
                            {interval === "annual" && (
                                <div className="text-sm text-green-400 mt-2 font-medium">
                                    Billed annually as £{currentPlan.billingPrice}
                                </div>
                            )}
                        </div>

                        <ul className="space-y-6 mb-12">
                            {[
                                "Unlimited Loan Applications",
                                "Credit Bureau Integration",
                                "Automated Decision Engine",
                                "Document Generation",
                                "Priority Support",
                                "White-Label Ready"
                            ].map((feature, i) => (
                                <li key={i} className="flex gap-4 items-start animate-in slide-in-from-left-4 fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5 shrink-0">
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-white/90 text-sm">{feature}</div>
                                        {/* Optional descriptions could go here */}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Value Pack Upgrade Card */}
                    <div
                        onClick={activateValuePack}
                        className={`mt-4 p-5 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden group
                        ${isValuePack ? 'bg-[#D97706]/10 border-[#D97706] shadow-[0_0_20px_rgba(217,119,6,0.2)]' : 'bg-white/5 border-white/10 hover:border-[#D97706]/50 hover:bg-white/10'}`}
                    >
                        {isValuePack && (
                            <div className="absolute top-3 right-3 text-[#D97706]">
                                <Check className="w-5 h-5" />
                            </div>
                        )}
                        <h3 className={`text-base font-bold mb-1 ${isValuePack ? 'text-[#D97706]' : 'text-white'}`}>
                            Upgrade to {plan === 'team' ? 'Team' : 'Broker'} Value Pack
                        </h3>
                        <div className="text-sm text-white/70 mb-3">
                            Includes <strong>All Features</strong> (AI Underwriting + Compliance Hub)
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-xl font-bold text-white">
                                {interval === 'annual' ? (
                                    <>
                                        <span className="line-through text-white/50 text-base mr-2">£{plan === 'team' ? '699' : '199'}</span>
                                        £{plan === 'team' ? '559' : '159'}
                                    </>
                                ) : (
                                    <>£{plan === 'team' ? '699' : '199'}</>
                                )}
                                <span className="text-sm font-normal text-muted-foreground"> /month</span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {interval === 'annual' && (
                                    <span className="text-xs text-green-400 font-semibold">Save 20%</span>
                                )}
                                <Button size="sm" variant={isValuePack ? "default" : "secondary"} className={isValuePack ? "bg-[#D97706] hover:bg-[#D97706]/90 text-white" : ""}>
                                    {isValuePack ? 'Selected' : 'Upgrade Now'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 mt-6 border-t border-white/10 flex gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" /> Bank-grade security
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" /> GDPR compliant
                        </div>
                    </div>
                </div>

                {/* Right Panel: Terms or Checkout Form */}
                <div className="bg-card text-card-foreground rounded-3xl p-8 lg:p-12 shadow-xl border border-border relative overflow-hidden">
                    {/* Top decoration line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-green-500" />

                    {!termsAccepted ? (
                        /* Step 1: Terms Acceptance */
                        <>
                            <div className="mb-6">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
                                    <span>Step 1 of 2</span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight mb-1">Accept Terms</h1>
                                <p className="text-sm text-muted-foreground">Review and accept to continue</p>
                            </div>
                            <TermsAcceptance
                                onAccept={handleTermsAccept}
                                userEmail={user?.email || ''}
                                userName={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''}
                            />
                        </>
                    ) : (
                        /* Step 2: Payment Form */
                        <>
                            <div className="mb-6">
                                <button
                                    onClick={() => setTermsAccepted(false)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                                >
                                    <ArrowLeft className="w-3 h-3" /> Back to terms
                                </button>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                    </span>
                                    <span className="text-green-600">Terms accepted</span>
                                    <span className="mx-1">•</span>
                                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
                                    <span>Step 2 of 2</span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight mb-1">Complete Payment</h1>
                                <p className="text-sm text-muted-foreground">Start processing loans in minutes</p>
                            </div>

                            <Elements stripe={stripePromise}>
                                <SubscriptionForm
                                    plan={plan}
                                    interval={interval}
                                    currentPlan={currentPlan}
                                    selectedAddOns={selectedAddOns}
                                    toggleAddOn={toggleAddOn}
                                    isValuePack={isValuePack}
                                />
                            </Elements>

                            <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
                                Your subscription will automatically renew. You can cancel anytime.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
