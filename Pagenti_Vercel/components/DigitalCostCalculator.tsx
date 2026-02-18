
import React, { useState, useMemo } from 'react';
import { Calculator, Users, TrendingDown, ArrowRight, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../I18nContext';

export const DigitalCostCalculator: React.FC = () => {
    const { t, currencySymbol, formatPrice, convertPrice } = useI18n();
    const [employeeCount, setEmployeeCount] = useState(5);
    const [avgSalary, setAvgSalary] = useState(35000);

    const humanOverheadRate = 1.25; // 20-25% overheads + NI/Pension
    const digitalAnnualCost = 5400; // $450/mo * 12 = $5400

    const calculations = useMemo(() => {
        const humanAnnual = avgSalary * humanOverheadRate * employeeCount;
        const digitalAnnual = digitalAnnualCost * employeeCount;
        const savings = humanAnnual - digitalAnnual;
        const savingsPercent = Math.round((savings / humanAnnual) * 100);
        return { humanAnnual, digitalAnnual, savings, savingsPercent };
    }, [employeeCount, avgSalary]);

    return (
        <div className="glass-dark rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full mb-6 border border-white/10 backdrop-blur-sm">
                        <Calculator size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-200">ROI Projector</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 font-heading">Why Hire Digital?</h2>
                    <p className="text-indigo-200 text-lg md:text-xl max-w-2xl mx-auto">
                        Drastically reduce overheads while increasing availability. Compare the cost of traditional staffing vs. Pagenti Digital Associates.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Controls */}
                    <div className="space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={16} /> Number of Roles
                                </label>
                                <span className="text-2xl font-bold font-mono">{employeeCount}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={employeeCount}
                                onChange={(e) => setEmployeeCount(parseInt(e.target.value))}
                                className="w-full h-3 bg-indigo-900 rounded-full appearance-none accent-emerald-400 cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-indigo-400 mt-2 font-mono">
                                <span>1 Role</span>
                                <span>50 Roles</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-2">
                                    <DollarSign size={16} /> Avg. Human Salary
                                </label>
                                <div className="flex items-center bg-indigo-900/50 rounded-lg border border-indigo-500/30 px-3 py-2">
                                    <span className="text-gray-400 mr-1">{currencySymbol}</span>
                                    <input
                                        type="number"
                                        value={avgSalary}
                                        onChange={(e) => setAvgSalary(parseInt(e.target.value) || 0)}
                                        className="bg-transparent text-white font-mono font-bold w-24 outline-none text-right"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-indigo-400 leading-relaxed">
                                *Includes estimated 25% overheads (Benefits, Insurance, Equipment, Office Space).
                            </p>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="space-y-6">
                        <div className="bg-white text-indigo-950 p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest">Projected Annual Savings</h3>
                                <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                                    SAVE {calculations.savingsPercent}%
                                </div>
                            </div>
                            <div className="text-5xl md:text-6xl font-black mb-4 tracking-tight text-emerald-600">
                                {currencySymbol}{Math.floor(convertPrice(calculations.savings)).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                                <TrendingDown size={18} />
                                <span>Immediate Bottom Line Impact</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-indigo-900/40 p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Traditional Cost</p>
                                <p className="text-2xl font-bold text-white opacity-60 line-through decoration-red-500/50">
                                    {currencySymbol}{Math.floor(convertPrice(calculations.humanAnnual)).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-indigo-900/40 p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-1">Digital Cost</p>
                                <p className="text-2xl font-bold text-white">
                                    {currencySymbol}{Math.floor(convertPrice(calculations.digitalAnnual)).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <Link to="/roi" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20">
                            Calculate Your Full ROI <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
