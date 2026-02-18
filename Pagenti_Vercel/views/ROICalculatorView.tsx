
import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingDown, Building2, Briefcase, Coffee, ShieldCheck, PieChart, Info, Pencil } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { Link } from 'react-router-dom';

export const ROICalculatorView: React.FC = () => {
    const { t, currencySymbol, formatPrice, convertPrice } = useI18n();

    // Inputs
    const [baseSalary, setBaseSalary] = useState(35000);
    const [recruitFee, setRecruitFee] = useState(15); // %
    const [bonuses, setBonuses] = useState(5); // %
    const [headcount, setHeadcount] = useState(1);

    // Jurisdiction - Auto-detect default or fallback to UK
    const [isUK, setIsUK] = useState(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/London';
        } catch (e) {
            return true;
        }
    });

    // Editable Overheads (Annual)
    const [officeSpace, setOfficeSpace] = useState(6000);
    const [equipment, setEquipment] = useState(2000);
    const [insuranceBenefits, setInsuranceBenefits] = useState(1500);
    const [training, setTraining] = useState(1000);
    // Global Healthcare Override
    const [globalHealthcare, setGlobalHealthcare] = useState(3000);

    // Digital Cost (Fixed)
    const digitalAnnualCost = 5400; // $450/mo * 12

    // Employment Cost Model
    const calculations = useMemo(() => {
        // 1. Direct Compensation (Additive)
        const annualBonus = baseSalary * (bonuses / 100);
        const totalEarnings = baseSalary + annualBonus;

        // 2. Statutory Costs
        let employerNI = 0;
        let pension = 0;
        let healthcareCost = 0;

        if (isUK) {
            // UK: NI + Pension
            employerNI = Math.max(0, (totalEarnings - 9100) * 0.138);
            pension = Math.max(0, (totalEarnings - 6240) * 0.03);
        } else {
            // Global: Healthcare instead of NI
            healthcareCost = globalHealthcare;
        }

        // 3. Overhead Costs (Per Head Annual) - From State
        const recruitment = (baseSalary * (recruitFee / 100)); // One-off amortized

        const hiddenCosts = employerNI + pension + healthcareCost + recruitment + officeSpace + equipment + insuranceBenefits + training;
        const humanTotal = totalEarnings + hiddenCosts;

        // Totals
        const humanGrandTotal = humanTotal * headcount;
        const digitalGrandTotal = digitalAnnualCost * headcount;
        const totalSavings = humanGrandTotal - digitalGrandTotal;
        const savingsPercent = Math.round((totalSavings / humanGrandTotal) * 100);

        return {
            human: {
                totalEarnings,
                employerNI,
                pension,
                healthcareCost,
                recruitment,
                officeSpace,
                equipment,
                insuranceBenefits,
                training,
                hiddenCosts,
                totalPerHead: humanTotal
            },
            grandTotals: {
                human: humanGrandTotal,
                digital: digitalGrandTotal,
                savings: totalSavings,
                savingsPercent
            }
        };
    }, [baseSalary, recruitFee, bonuses, headcount, officeSpace, equipment, insuranceBenefits, training, isUK, globalHealthcare]);

    const StatRow = ({ label, value, subtext, highlight = false, onEdit }: any) => (
        <div className={`flex justify-between items-center py-3 border-b border-gray-100 ${highlight ? 'bg-indigo-50/50 -mx-4 px-4 rounded-lg' : ''}`}>
            <div>
                <span className={`text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
                {subtext && <p className="text-[10px] text-gray-400">{subtext}</p>}
            </div>
            {onEdit ? (
                <div className="relative group">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currencySymbol}</span>
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onEdit(Number(e.target.value))}
                        className="w-24 text-right bg-white border border-gray-200 rounded-lg py-1 pr-2 pl-6 font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all hover:border-indigo-300"
                    />
                    <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-300 pointer-events-none">
                        <Pencil size={12} />
                    </div>
                </div>
            ) : (
                <span className={`font-mono ${highlight ? 'font-bold text-indigo-600' : 'text-gray-900'}`}>
                    {currencySymbol}{Math.floor(convertPrice(value)).toLocaleString()}
                </span>
            )}
        </div>
    );

    return (
        <div className="bg-gray-50 min-h-screen py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">The True Cost of Employment</h1>
                    <p className="text-xl text-gray-500 max-w-3xl mx-auto">
                        Salary is just the tip of the iceberg. Analyze the hidden overheads that drain your operational budget.
                    </p>

                    {/* Jurisdiction Toggle */}
                    <div className="flex justify-center mt-6">
                        <div className="bg-white p-1 rounded-full border border-gray-200 inline-flex shadow-sm">
                            <button
                                onClick={() => setIsUK(true)}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${isUK ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                UK (GBP)
                            </button>
                            <button
                                onClick={() => setIsUK(false)}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${!isUK ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                Global (USD/EUR)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Controls Panel */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-8 flex items-center gap-2">
                                <Calculator className="text-indigo-600" size={20} /> Configuration
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Base Salary (Annual)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbol}</span>
                                        <input type="number" value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value))} className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Recruitment Fee (%)</label>
                                    <input type="range" min="0" max="30" value={recruitFee} onChange={(e) => setRecruitFee(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-full appearance-none accent-indigo-600" />
                                    <div className="text-right text-xs font-bold text-indigo-600 mt-1">{recruitFee}%</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bonus / Comm. (%)</label>
                                    <input type="range" min="0" max="50" value={bonuses} onChange={(e) => setBonuses(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-full appearance-none accent-indigo-600" />
                                    <div className="text-right text-xs font-bold text-indigo-600 mt-1">{bonuses}%</div>
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Headcount</label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setHeadcount(Math.max(1, headcount - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200">-</button>
                                        <span className="text-2xl font-black text-gray-900 w-12 text-center">{headcount}</span>
                                        <button onClick={() => setHeadcount(headcount + 1)} className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 hover:bg-indigo-200">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-950 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-indigo-200 uppercase tracking-widest text-xs mb-2">Digital Flat Rate</h3>
                                <div className="text-4xl font-black mb-1">{currencySymbol}{Math.floor(convertPrice(digitalAnnualCost)).toLocaleString()}</div>
                                <p className="text-indigo-400 text-xs mb-8">Per Associate / Year</p>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-indigo-200">
                                        <ShieldCheck size={16} className="text-emerald-400" /> No Recruitment Fees
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-indigo-200">
                                        <ShieldCheck size={16} className="text-emerald-400" /> {isUK ? 'No Employers NI' : 'No Healthcare Costs'}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-indigo-200">
                                        <ShieldCheck size={16} className="text-emerald-400" /> No Office Overhead
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-indigo-200">
                                        <ShieldCheck size={16} className="text-emerald-400" /> {isUK ? 'No Pension Contrib.' : 'No Benefits Pkg.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Panel */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-200 flex flex-col md:flex-row">

                            {/* Visual Chart Area */}
                            <div className="md:w-1/2 bg-gray-50 p-10 flex flex-col justify-center relative">
                                <h3 className="text-center font-bold text-gray-900 mb-8">Asset Cost Comparison</h3>
                                <div className="flex justify-center items-end gap-12 h-80 px-8 pb-4 relative">
                                    {/* Human Bar */}
                                    <div className="w-24 bg-rose-500 rounded-t-2xl relative group transition-all duration-500" style={{ height: '90%' }}>
                                        <div className="absolute -top-10 w-full text-center font-bold text-gray-900 text-sm">
                                            {currencySymbol}{Math.floor(convertPrice(calculations.human.totalPerHead)).toLocaleString()}
                                        </div>
                                        <div className="absolute inset-0 flex flex-col justify-end p-2 overflow-hidden rounded-t-2xl">
                                            <div className="bg-rose-600/20 text-[10px] text-white flex items-center justify-center font-bold h-1/4">Overheads</div>
                                        </div>
                                        <div className="absolute bottom-0 w-full text-center pb-2 text-white font-bold opacity-50 z-10">Human</div>
                                    </div>

                                    {/* Digital Bar */}
                                    <div className="w-24 bg-emerald-500 rounded-t-2xl relative group transition-all duration-500" style={{ height: `${(digitalAnnualCost / calculations.human.totalPerHead) * 90}%` }}>
                                        <div className="absolute -top-10 w-full text-center font-bold text-gray-900 text-sm">
                                            {currencySymbol}{Math.floor(convertPrice(digitalAnnualCost)).toLocaleString()}
                                        </div>
                                        <div className="absolute bottom-0 w-full text-center pb-2 text-white font-bold opacity-50 z-10">Digital</div>
                                    </div>
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-4">Per Annual Head</p>
                            </div>

                            {/* Receipt Breakdown */}
                            <div className="md:w-1/2 p-10 bg-white relative">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-gray-50 rounded-bl-[4rem]"></div>

                                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Briefcase size={20} className="text-gray-400" /> Expense Breakdown
                                </h3>

                                <div className="space-y-1 mb-8">
                                    <StatRow label="Gross Salary" value={baseSalary} highlight />
                                    <StatRow label="Bonus / Commission" value={calculations.human.totalEarnings - baseSalary} />

                                    <div className="py-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mandatory Costs</h4>
                                        {isUK ? (
                                            <>
                                                <StatRow label="Employers NI (13.8%)" value={calculations.human.employerNI} subtext="Above secondary threshold" />
                                                <StatRow label="Pension (3%)" value={calculations.human.pension} subtext="Auto-enrolment min" />
                                            </>
                                        ) : (
                                            <StatRow label="Healthcare / Insurance" value={globalHealthcare} onEdit={setGlobalHealthcare} subtext="Mandatory cover / Medical" />
                                        )}
                                        <StatRow label="Recruitment Fee" value={calculations.human.recruitment} subtext="Agency fee (amortized)" />

                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6 mb-2">Operating Overheads</h4>
                                        <StatRow label="Office Space & Utilities" value={officeSpace} onEdit={setOfficeSpace} subtext="Rent, rates, heating" />
                                        <StatRow label="Equipment & IT" value={equipment} onEdit={setEquipment} subtext="Hardware, software licenses" />
                                        <StatRow label="Insurance & Liability" value={insuranceBenefits} onEdit={setInsuranceBenefits} subtext="Employers liability, health" />
                                    </div>

                                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 mt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-rose-900">Total Human Cost</span>
                                            <span className="font-black text-rose-600 text-lg">
                                                {currencySymbol}{Math.floor(convertPrice(calculations.human.totalPerHead)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-right text-[10px] text-rose-400 mt-1">
                                            +{Math.round((calculations.human.hiddenCosts / calculations.human.totalEarnings) * 100)}% over salary
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grand Total Savings Banner */}
                        <div className="mt-8 bg-indigo-600 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between shadow-2xl">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Total Projected Impact</h2>
                                <p className="text-indigo-200">Based on a team of <span className="font-bold text-white">{headcount}</span></p>
                            </div>
                            <div className="text-center md:text-right mt-6 md:mt-0">
                                <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Annual Savings</div>
                                <div className="text-6xl font-black text-white">{currencySymbol}{Math.floor(convertPrice(calculations.grandTotals.savings)).toLocaleString()}</div>
                                <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold mt-2">
                                    {calculations.grandTotals.savingsPercent}% Efficiency Gain
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-12">
                            <Link to="/audit" className="inline-flex bg-gray-900 text-white px-10 py-4 rounded-full font-bold hover:bg-gray-800 transition-all shadow-lg">
                                Audit Your Workforce
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
