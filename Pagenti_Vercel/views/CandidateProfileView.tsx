
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CANDIDATES, DEPARTMENT_COLORS } from '../constants';
import { agentService } from '../services/agentService';
import { ChevronLeft, Calendar, Zap, Layers, Bolt, Clock, TrendingDown, MessageCircle, Send, Slack, MessageSquare, Mic, ShieldCheck, Search, Cpu, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AssociateStatus } from '../types';
import { useI18n } from '../I18nContext';
import { LiveTerminal } from '../components/LiveTerminal';

export const CandidateProfileView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatPrice, t, tl, convertPrice, currencySymbol } = useI18n();
  const [engagementModel, setEngagementModel] = useState<'recruit' | 'temp'>('recruit');
  const [monthlyHours, setMonthlyHours] = useState(160);
  const [showDnaManifest, setShowDnaManifest] = useState(false);

  // Use service to find candidate (handles merged overrides)
  const candidate = useMemo(() => id ? agentService.getAgentById(id) : undefined, [id]);

  if (!candidate) return <div className="p-20 text-center">Candidate not found.</div>;

  const isDraft = id?.startsWith('draft-');
  const isAvailable = candidate.status === AssociateStatus.AVAILABLE;
  // Default to Legal color if not found, but handle case where dynamic agent has a valid department
  const deptStyle = DEPARTMENT_COLORS[candidate.department] || DEPARTMENT_COLORS["Legal & Compliance"];

  const localizedRole = tl(candidate.role);
  const localizedDesc = tl(candidate.description);

  const baseRate = candidate.hourlyRate;
  const maxRate = baseRate * 10;
  const minHours = 10;
  const maxHours = 720;

  const currentHourlyRate = useMemo(() => {
    if (engagementModel === 'temp') return maxRate;
    const progress = (monthlyHours - minHours) / (maxHours - minHours);
    return maxRate - ((maxRate - baseRate) * progress);
  }, [engagementModel, monthlyHours, baseRate, maxRate]);

  const totalCost = engagementModel === 'temp' ? maxRate * 8 : currentHourlyRate * monthlyHours;
  const humanCostForSameHours = 28.50 * monthlyHours;
  const capitalReclaimed = Math.max(0, humanCostForSameHours - (currentHourlyRate * monthlyHours));

  const getCapacityTier = (h: number) => {
    if (h <= 40) return { label: t('pilotProgram'), color: "text-blue-500", bg: "bg-blue-50" };
    if (h <= 160) return { label: t('standardPlacement'), color: "text-indigo-500", bg: "bg-indigo-50" };
    return { label: t('enterpriseScale'), color: "text-emerald-500", bg: "bg-emerald-50" };
  };

  const tier = getCapacityTier(monthlyHours);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <button onClick={() => navigate('/browse')} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 mb-8 font-bold uppercase tracking-widest text-xs">
        <ChevronLeft size={16} /> {t('roster')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white border border-gray-200 rounded-[2.5rem] p-8 text-center shadow-sm relative overflow-hidden">
            {candidate.status === AssociateStatus.HIBERNATION && (
              <div className="absolute inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4 animate-pulse" />
                <h3 className="text-white font-bold text-xl mb-2">System Hibernation</h3>
                <p className="text-gray-400 text-sm mb-6">Payment delinquency detected. Operations suspended.</p>
                <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest">Settle Balance</button>
              </div>
            )}

            <div className={`absolute top-0 left-0 w-full h-2 ${candidate.status === AssociateStatus.HIBERNATION ? 'bg-red-600' : deptStyle.bg}`}></div>
            {isDraft && (
              <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse border border-amber-500/20">
                Draft Mode
              </div>
            )}

            {candidate.commercial_integrity_layer?.payment_status === 'DELINQUENT' && (
              <div className="absolute top-4 left-4 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg border border-red-400/20 flex items-center gap-1.5">
                <TrendingDown size={10} />
                Revenue Risk
              </div>
            )}

            <div className="w-32 h-32 rounded-[2rem] mx-auto mb-6 bg-gray-900 digital-portrait overflow-hidden shadow-lg relative">
              <div className={`absolute inset-0 z-10 opacity-60 ${candidate.status === AssociateStatus.HIBERNATION ? 'bg-red-900' : deptStyle.tint}`}></div>
              <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
            </div>

            {candidate.aresCertification?.status === 'certified' && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="bg-indigo-600 text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-indigo-400/20">
                  <ShieldCheck size={12} className="text-indigo-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {candidate.status === AssociateStatus.LIVE_DEPLOYMENT ? 'Live Deployment' : 'Ares Certified'}
                  </span>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold text-gray-900 mb-1">{candidate.name}</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 font-mono">{t(deptStyle.key)}</p>

            <div className="flex flex-col gap-2 mb-6">
              {candidate.status === AssociateStatus.HIBERNATION ? (
                <div className="flex items-center justify-center gap-2 bg-red-50 text-red-700 py-2 px-4 rounded-xl border border-red-100 mx-auto">
                  <Zap size={14} className="opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-widest">All API Keys Revoked</span>
                </div>
              ) : candidate.voiceEnabled === false ? (
                <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-2 px-4 rounded-xl border border-emerald-100 mx-auto">
                  <MessageSquare size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Text Only - 25% Optimized</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 px-4 rounded-xl border border-indigo-100 mx-auto">
                  <Mic size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Voice & Text Capable</span>
                </div>
              )}
            </div>

            {candidate.communicationConfig?.channels.some(c => c.connected) && (
              <div className="flex justify-center gap-3 mb-6">
                {candidate.communicationConfig.channels.filter(c => c.connected).map(channel => (
                  <div key={channel.type} className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${channel.type === 'whatsapp' ? 'bg-green-50 text-green-600 border-green-100' :
                    channel.type === 'telegram' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                      'bg-purple-50 text-purple-600 border-purple-100'
                    }`} title={`${channel.type} connected`}>
                    {channel.type === 'whatsapp' && <MessageCircle size={18} />}
                    {channel.type === 'telegram' && <Send size={18} />}
                    {channel.type === 'slack' && <Slack size={18} />}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100 mb-8 flex gap-1">
              <button onClick={() => setEngagementModel('recruit')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${engagementModel === 'recruit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>{t('recruit')}</button>
              <button onClick={() => setEngagementModel('temp')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${engagementModel === 'temp' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}>{t('tempTask')}</button>
            </div>

            <button disabled={candidate.status === AssociateStatus.HIBERNATION} className={`w-full ${candidate.status === AssociateStatus.HIBERNATION ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600'} text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 mb-3`}>
              <Zap size={18} /> {candidate.status === AssociateStatus.LIVE_DEPLOYMENT ? 'Manage Deployment' : (engagementModel === 'temp' ? 'Initiate Task' : t('recruit'))}
            </button>
            <button className="w-full bg-gray-50 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-gray-100">
              <Calendar size={18} /> {t('bookAudit')}
            </button>
          </div>

          <div className="h-64 relative">
            <LiveTerminal candidate={candidate} colorClass={deptStyle.bg} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={`${deptStyle.light} p-2 rounded-xl ${deptStyle.text}`}><Layers size={20} /></div>
                <h2 className="text-2xl font-bold text-gray-900">Deployment Config</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Effective Rate</p>
                <p className="text-4xl font-bold text-gray-900">{formatPrice(currentHourlyRate)}<span className="text-sm font-normal text-gray-400">/hr</span></p>
              </div>
            </div>

            <div className="mb-10">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{localizedRole}</h3>
              <p className="text-gray-500 leading-relaxed">{localizedDesc}</p>
            </div>

            {engagementModel === 'recruit' && (
              <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 mb-10">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.bg} ${tier.color}`}>{tier.label}</div>
                      <h4 className="text-sm font-bold text-gray-900">{t('availLabel')}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-indigo-600 font-mono">{monthlyHours}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase"> hrs/mo</span>
                  </div>
                </div>
                <input type="range" min={minHours} max={maxHours} step="10" value={monthlyHours} onChange={(e) => setMonthlyHours(parseInt(e.target.value))} className="w-full h-3 bg-gray-200 rounded-full appearance-none accent-indigo-600" />
              </div>
            )}

            <div className={`rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden ${engagementModel === 'temp' ? 'bg-amber-600' : 'bg-indigo-950'}`}>
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h4 className="font-bold text-2xl uppercase">{engagementModel === 'temp' ? t('tempTask') : 'Deployment Investment'}</h4>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-black">{currencySymbol}{Math.floor(convertPrice(totalCost)).toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-10 p-6 bg-white/5 rounded-2xl border border-white/10">
                <div>
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2">VS Human Alternative</p>
                  <p className="text-xl font-bold line-through opacity-40">{formatPrice(humanCostForSameHours)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Net Reclaimed Capital</p>
                  <p className="text-2xl font-black text-emerald-400">+{currencySymbol}{Math.floor(convertPrice(capitalReclaimed)).toLocaleString()}/mo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ares Certification DNA Manifest */}
          {candidate.aresCertification?.status === 'certified' && candidate.aresCertification.trainingManifest && (
            <div className="mt-8">
              <div className="bg-gray-900 rounded-[2rem] overflow-hidden border border-gray-800 shadow-2xl">
                <div className="p-8 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl">
                      <Cpu size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">ARES DNA Manifest</h3>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Vetted Operational logic</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Fidelity Score</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono">{candidate.aresCertification.score}/100</p>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {candidate.aresCertification.trainingManifest.ecosystemLayer && (
                      <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Layers size={12} /> Ecosystem Layer
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {candidate.aresCertification.trainingManifest.ecosystemLayer.softwareSystems.map((s, i) => (
                            <span key={i} className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-gray-700">{s}</span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{candidate.aresCertification.trainingManifest.ecosystemLayer.logicFlow}</p>
                      </div>
                    )}

                    {candidate.aresCertification.trainingManifest.linguisticLayer && (
                      <div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <MessageSquare size={12} /> Linguistic Layer
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Tone Analysis</p>
                            <p className="text-xs text-white font-bold">{candidate.aresCertification.trainingManifest.linguisticLayer.brandTone}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Unique Value Prop</p>
                            <p className="text-xs text-white font-bold">{candidate.aresCertification.trainingManifest.linguisticLayer.uvp}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {candidate.aresCertification.trainingManifest.firstPrinciples && (
                    <div className="pt-8 border-t border-gray-800">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Zap size={12} /> Operational First Principles
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {candidate.aresCertification.trainingManifest.firstPrinciples.map((fp, i) => (
                          <div key={i} className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700 flex gap-3 items-start">
                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5" />
                            <p className="text-xs text-gray-300 font-medium">{fp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate.aresCertification.uselessnessReport && (
                    <div className="pt-8 border-t border-gray-800">
                      <div className="bg-indigo-950/50 border border-indigo-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-2 text-indigo-400 mb-3">
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest italic">Ares Logic Diagnostic Report</span>
                        </div>
                        <p className="text-sm text-indigo-100/90 font-bold leading-relaxed">
                          {candidate.aresCertification.uselessnessReport.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
