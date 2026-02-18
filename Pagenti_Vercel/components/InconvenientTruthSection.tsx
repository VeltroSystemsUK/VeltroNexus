
import React from 'react';
import { TriangleAlert, TrendingUp, Users, Lock, Zap, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../I18nContext';

export const InconvenientTruthSection: React.FC = () => {
    const { t } = useI18n();

    return (
        <section className="bg-slate-950 py-32 text-white relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-slate-800/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20 mb-6">
                        <TriangleAlert size={14} className="text-red-500" />
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">Private Briefing</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 font-heading tracking-tight">The Inconvenient Truth</h2>
                    <p className="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
                        In the next 18 months, the gap between the "Automated" and the "Extinct" will become unbridgeable.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
                    {/* Point 1 */}
                    <div className="glass-dark border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-all duration-500 reveal">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <Clock size={28} />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">1. The Efficiency Paradox</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Your competitors aren't just working harder; they are <strong>manufacturing time</strong>. While your team is buried in CRM data entry, they have deployed Digital Associates to handle the drudgery.
                        </p>
                        <div className="text-xs font-extra-bold text-indigo-400 uppercase tracking-widest pt-4 border-t border-white/10">
                            Result: Faster & cheaper.
                        </div>
                    </div>

                    {/* Point 2 */}
                    <div className="glass-dark border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-all duration-500 reveal" style={{ animationDelay: '0.2s' }}>
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">2. Skill Barrier Removal</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            "Advanced Technology" used to be a game for giants with $100k budgets. That era is over. With Forward Development Engineering, complex scalability is now immediate.
                        </p>
                        <div className="text-xs font-extra-bold text-indigo-400 uppercase tracking-widest pt-4 border-t border-white/10">
                            Warning: Competition is accelerating.
                        </div>
                    </div>

                    {/* Point 3 */}
                    <div className="glass-dark border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-all duration-500 reveal" style={{ animationDelay: '0.4s' }}>
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <Users size={28} />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">3. Hidden Talent Scarcity</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            You cannot hire your way out with humans alone. Labor costs are rising while availability shrinks. Digital Associates protect your best people from burnout.
                        </p>
                        <div className="text-xs font-extra-bold text-indigo-400 uppercase tracking-widest pt-4 border-t border-white/10">
                            Strategy: Hybrid Workforce.
                        </div>
                    </div>
                </div>

                {/* Comparison Chart */}
                <div className="glass-dark border border-white/10 rounded-[3rem] p-8 md:p-12 mb-20 reveal">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6 reveal">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8 text-center border-b border-white/5 pb-4">The Old Way (Linear Growth)</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 opacity-40">
                                    <span className="text-sm font-medium text-slate-300">Human Latency (9-5)</span>
                                    <Clock size={16} className="text-slate-500" />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 opacity-40">
                                    <span className="text-sm font-medium text-slate-300">Headcount Constraints</span>
                                    <Users size={16} className="text-slate-500" />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 opacity-40">
                                    <span className="text-sm font-medium text-slate-300">45-Day Recruitment Cycle</span>
                                    <TriangleAlert size={16} className="text-slate-500" />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 opacity-40">
                                    <span className="text-sm font-medium text-slate-300">High Overheads & Benefits</span>
                                    <TrendingUp size={16} className="text-slate-500" />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 opacity-40">
                                    <span className="text-sm font-medium text-slate-300">Fragile Knowledge Retention</span>
                                    <ShieldAlert size={16} className="text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 relative reveal">
                            {/* Glow effect for "The Pagenti Way" */}
                            <div className="absolute inset-0 bg-indigo-600/20 blur-3xl rounded-full animate-pulse"></div>
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-8 text-center border-b border-indigo-500/20 pb-4 relative z-10">The Pagenti Way (Exponential)</h3>
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between p-5 bg-indigo-900/60 rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight">24/7 Execution</span>
                                    <Zap size={16} className="text-indigo-400" />
                                </div>
                                <div className="flex items-center justify-between p-5 bg-indigo-900/60 rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight">Infinite Scalability</span>
                                    <TrendingUp size={16} className="text-indigo-400" />
                                </div>
                                <div className="flex items-center justify-between p-5 bg-indigo-900/60 rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight">Instant Deployment</span>
                                    <Zap size={16} className="text-indigo-400" />
                                </div>
                                <div className="flex items-center justify-between p-5 bg-indigo-900/60 rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight">Flat-Fee Subscription</span>
                                    <Lock size={16} className="text-indigo-400" />
                                </div>
                                <div className="flex items-center justify-between p-5 bg-indigo-900/60 rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight">Immutable Business Logic</span>
                                    <Zap size={16} className="text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Warning Block */}
                <div className="glass-dark border border-red-500/20 rounded-2xl p-6 md:p-10 flex items-start gap-6 max-w-4xl mx-auto mb-20 reveal">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0">
                        <TriangleAlert size={28} />
                    </div>
                    <div>
                        <h4 className="text-red-400 font-extrabold uppercase tracking-widest text-xs mb-3">Competitive Lock-In Warning</h4>
                        <p className="text-slate-300 text-base leading-relaxed">
                            "AI is not a tool you 'plug in' later. It is a system that learns your business logic. The longer you wait, the more 'data-debt' you accrue. Your competitors' agents are getting smarter every day."
                        </p>
                    </div>
                </div>

                <div className="text-center reveal">
                    <Link to="/audit" className="inline-flex items-center gap-4 bg-white text-slate-950 px-12 py-5 rounded-full font-black uppercase tracking-widest text-sm hover:scale-110 transition-all shadow-2xl hover:shadow-indigo-500/20">
                        Adapt Now <Zap size={18} fill="currentColor" />
                    </Link>
                    <p className="text-slate-500 text-[10px] mt-6 font-bold uppercase tracking-[0.3em]">15 Minute Talent Audit • Immediate Insights</p>
                </div>

            </div>
        </section>
    );
};
