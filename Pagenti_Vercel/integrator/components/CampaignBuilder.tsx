
import React, { useState } from 'react';
import { Send, ChevronRight, Zap, Loader2 } from 'lucide-react';
import { gemini } from '../services/geminiService';
import { campaignService } from '../services/campaignService';
import { useNavigate } from 'react-router-dom';

const CampaignBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [campaign, setCampaign] = useState({
    name: 'Q1 Refinancing Drive',
    subject: 'New Loan Rates for {{companyName}}',
    content: '',
    fromName: 'Shaun Williams',
    fromEmail: 'shaun@veltro.co.uk',
  });

  const handleAiDraft = async () => {
    setIsGenerating(true);
    const draft = await gemini.generateEmailDraft({
      topic: "Lowering loan repayments via refinancing",
      companyName: "{{companyName}}",
      contactName: "{{firstName}}",
      tone: "professional"
    });
    setCampaign({ ...campaign, content: draft || '' });
    setIsGenerating(false);
  };

  const handleFinalLaunch = async () => {
    setIsLaunching(true);
    const newCampaign = await campaignService.createCampaign({
      name: campaign.name,
      subject: campaign.subject,
      recipientsCount: 245
    });
    await campaignService.launchCampaign(newCampaign.id);
    setIsLaunching(false);
    navigate('/analytics');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Professional Progress Steps */}
      <div className="flex items-center justify-center space-x-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center space-x-3 group">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
              step === s ? 'bg-indigo-600 text-white border-indigo-600' : 
              step > s ? 'bg-emerald-100 text-emerald-700 border-emerald-100' : 'bg-white text-slate-300 border-slate-200'
            }`}>
              {s}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${step === s ? 'text-slate-900' : 'text-slate-400'}`}>
              {s === 1 ? 'Configure' : s === 2 ? 'Content' : 'Launch'}
            </span>
            {s < 3 && <div className="w-12 h-px bg-slate-200 ml-4"></div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {step === 1 && (
          <div className="p-10 space-y-10">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Campaign Configuration</h2>
              <p className="text-slate-500 text-sm">Define the core parameters for your outreach sequence.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Internal Name</label>
                  <input 
                    type="text" 
                    value={campaign.name}
                    onChange={e => setCampaign({...campaign, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject Line</label>
                  <input 
                    type="text" 
                    value={campaign.subject}
                    onChange={e => setCampaign({...campaign, subject: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sender Identity</label>
                  <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-semibold text-sm">{campaign.fromName}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sender Protocol</label>
                  <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-semibold text-sm">{campaign.fromEmail}</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-6 border-t border-slate-100">
              <button 
                onClick={() => setStep(2)}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm flex items-center"
              >
                Next Step <ChevronRight className="ml-2 w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col lg:flex-row min-h-[600px]">
            <div className="w-full lg:w-72 border-r border-slate-100 p-8 space-y-8 bg-slate-50">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI Writer</h3>
                <button 
                  onClick={handleAiDraft}
                  disabled={isGenerating}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  <Zap className="w-3.5 h-3.5 mr-2" /> {isGenerating ? "Drafting..." : "Generate AI Draft"}
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase">Insert Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {['firstName', 'companyName'].map(tag => (
                    <button 
                      key={tag}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition-all"
                      onClick={() => setCampaign({...campaign, content: campaign.content + ` {{${tag}}}`})}
                    >
                      {`{{${tag}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col">
              <div className="bg-slate-50 rounded-lg border border-slate-200 flex-1 flex flex-col">
                <div className="px-6 py-3 border-b border-slate-200 text-xs font-bold text-slate-500 bg-white">
                  Subject: <span className="text-slate-900">{campaign.subject}</span>
                </div>
                <textarea 
                  value={campaign.content}
                  onChange={e => setCampaign({...campaign, content: e.target.value})}
                  className="flex-1 p-8 outline-none bg-transparent text-slate-700 leading-relaxed resize-none text-sm font-medium"
                  placeholder="Draft your professional communication here..."
                />
              </div>
              <div className="flex justify-between items-center mt-6">
                <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">Back</button>
                <button onClick={() => setStep(3)} className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700">Preview & Send</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-20 text-center space-y-8">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Send className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Platform Ready</h2>
              <p className="text-slate-500 text-sm font-medium">Your campaign is configured to reach 245 verified SME contacts via our secure UK server bank.</p>
            </div>
            
            <button 
              onClick={handleFinalLaunch}
              disabled={isLaunching}
              className="px-12 py-4 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center mx-auto min-w-[200px] shadow-md"
            >
              {isLaunching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</> : 'Send Campaign'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignBuilder;
