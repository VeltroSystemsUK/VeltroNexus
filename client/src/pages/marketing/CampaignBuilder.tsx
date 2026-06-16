
import React, { useState } from 'react';
import { Sparkles, Send, Eye, Mail, ChevronRight, ShieldCheck, Zap } from 'lucide-react';
import { gemini } from './services/geminiService';
import { useQuery } from '@tanstack/react-query';
import { Contact } from './types';

const CampaignBuilder: React.FC = () => {
  const [step, setStep] = useState(1);
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/marketing/contacts'],
  });

  const verifiedCount = contacts.filter(c => ['A', 'B'].includes(c.qualityGrade)).length;

  const [isGenerating, setIsGenerating] = useState(false);
  const [campaign, setCampaign] = useState({
    name: '',
    subject: '',
    content: '',
    fromName: 'User',
    fromEmail: 'user@veltro.co.uk',
    legalBasis: 'legitimate_interest'
  });

  const handleAiDraft = async () => {
    setIsGenerating(true);
    const draft = await gemini.generateEmailDraft({
      topic: "Refinancing business loans at lower interest rates",
      companyName: "{{companyName}}",
      contactName: "{{firstName}}",
      tone: "professional"
    });
    setCampaign({ ...campaign, content: draft || '' });
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom-12 duration-1000 pb-20">
      {/* HUD Progress Bar */}
      <div className="flex items-center justify-center space-x-12">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center group cursor-pointer" onClick={() => step > s && setStep(s)}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all duration-500 border-2 ${step === s ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_30px_rgba(16, 185, 129,0.5)] scale-110' :
              step > s ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/20 border-white/10'
              }`}>
              {s}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-3 transition-colors ${step === s ? 'text-white' : 'text-slate-500'}`}>
              {s === 1 ? 'Configure' : s === 2 ? 'Synthesis' : 'Launch'}
            </span>
          </div>
        ))}
      </div>

      <div className="antigravity-card rounded-[3rem] overflow-hidden border border-white/10">
        {step === 1 && (
          <div className="p-16 space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-black text-white tracking-tighter">Mission Parameters</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Define the primary objectives for this communication sequence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Campaign Designation</label>
                  <input
                    type="text"
                    id="campaign-name"
                    name="campaign-name"
                    value={campaign.name}
                    onChange={e => setCampaign({ ...campaign, name: e.target.value })}
                    className="w-full px-6 py-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-black"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Signal Subject</label>
                  <input
                    type="text"
                    id="campaign-subject"
                    name="campaign-subject"
                    value={campaign.subject}
                    onChange={e => setCampaign({ ...campaign, subject: e.target.value })}
                    className="w-full px-6 py-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-black"
                  />
                </div>
              </div>
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Source Identity</label>
                  <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-bold">{campaign.fromName}</div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Source Protocol</label>
                  <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-bold">{campaign.fromEmail}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={() => setStep(2)}
                className="px-12 py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)] flex items-center"
              >
                Proceed to Synthesis <ChevronRight className="ml-3 w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col lg:flex-row h-[750px]">
            <div className="w-full lg:w-[400px] border-r border-white/5 p-10 space-y-10 bg-white/2 backdrop-blur-2xl overflow-y-auto">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-6 flex items-center">
                  <Zap className="w-4 h-4 mr-3 text-emerald-400" /> AI Core
                </h3>
                <button
                  onClick={handleAiDraft}
                  disabled={isGenerating}
                  className="w-full py-5 px-6 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-30"
                >
                  {isGenerating ? "Synthesizing Draft..." : "Generate Neural Template"}
                </button>
              </div>

              <div className="h-px bg-white/5"></div>

              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Variable Injection</h4>
                <div className="grid grid-cols-2 gap-3">
                  {['firstName', 'companyName', 'sector'].map(tag => (
                    <button
                      key={tag}
                      className="px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-[10px] font-black text-white/60 hover:border-emerald-500 hover:text-emerald-400 transition-all"
                      onClick={() => setCampaign({ ...campaign, content: campaign.content + ` {{${tag}}}` })}
                    >
                      {`{{${tag}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 p-12 bg-black/20 flex flex-col">
              <div className="bg-white/5 rounded-[2rem] border border-white/10 shadow-2xl flex-1 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
                <div className="px-8 py-6 bg-white/5 border-b border-white/5 flex items-center space-x-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject:</span>
                  <span className="text-sm font-black text-white">{campaign.subject}</span>
                </div>
                <textarea
                  id="campaign-content"
                  name="campaign-content"
                  value={campaign.content}
                  onChange={e => setCampaign({ ...campaign, content: e.target.value })}
                  className="flex-1 p-10 outline-none bg-transparent text-slate-300 font-bold leading-loose resize-none text-sm placeholder:text-white/5"
                  placeholder="Initiate terminal text input..."
                />
              </div>
              <div className="flex justify-between items-center mt-8 max-w-3xl mx-auto w-full">
                <button onClick={() => setStep(1)} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Abort</button>
                <button onClick={() => setStep(3)} className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">Final Sequence</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-20 text-center space-y-12">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-24 h-24 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Send className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter">Ready for Orbit</h2>
              <p className="text-slate-400 font-bold text-sm">Targeting {verifiedCount} verified B2B entities via standard secure UK SMTP protocols.</p>
            </div>

            <div className="flex justify-center space-x-6">
              <button className="px-12 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs hover:shadow-[0_0_60px_rgba(16, 185, 129,0.6)] transition-all">
                Execute Launch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignBuilder;
