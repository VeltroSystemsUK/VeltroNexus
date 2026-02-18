import React, { useState } from 'react';
import { ShieldCheck, Send, Loader2, Sparkles, Building2, Users, Target, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../I18nContext';
import { CANDIDATES } from '../constants';

export const TalentAuditView: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // `submitted` state is removed as navigation handles the outcome

  // Form State
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [customToolInput, setCustomToolInput] = useState("");
  const [industry, setIndustry] = useState("SaaS / Tech Software");

  const INDUSTRIES = [
    "Legal & Professional Services",
    "Construction & Engineering",
    "Real Estate & Property Management",
    "Logistics & Supply Chain",
    "Manufacturing & Industrial",
    "Private Healthcare / Clinics",
    "Wealth Management & Accounting",
    "Insurance Brokerage",
    "Recruitment & Staffing",
    "Hospitality & Events",
    "Automotive Dealerships",
    "Agriculture & Farming",
    "Other Traditional Sector"
  ];

  const TECH_STACK_CATEGORIES = [
    { name: "CRM & Sales", tools: ["Salesforce", "HubSpot", "Pipedrive", "Zoho", "ActiveCampaign"] },
    { name: "Communication", tools: ["Slack", "Microsoft Teams", "Zoom", "Google Workspace", "Notion"] },
    { name: "Project Mgmt", tools: ["Jira", "Asana", "Trello", "Monday.com", "Linear"] },
    { name: "Support & CX", tools: ["Zendesk", "Intercom", "Front", "Freshdesk"] },
    { name: "Finance & Ops", tools: ["Xero", "QuickBooks", "Stripe", "Netsuite", "Excel / Sheets"] }
  ];

  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const removeTool = (tool: string) => {
    setSelectedTools(prev => prev.filter(t => t !== tool));
  };

  const addCustomTool = (e: React.KeyboardEvent | React.MouseEvent) => {
    // Prevent form submission if triggered by Enter key
    e.preventDefault();
    if (customToolInput.trim() && !selectedTools.includes(customToolInput.trim())) {
      setSelectedTools([...selectedTools, customToolInput.trim()]);
      setCustomToolInput("");
    }
  };

  const findBestCandidate = (industry: string): string | null => {
    // Audit Mapping Logic
    switch (industry) {
      case "Legal & Corporate Services":
        return CANDIDATES.find(c => c.name.includes("Hugo"))?.id || null;
      case "Marketing & Agency":
      case "E-commerce & Retail":
        return CANDIDATES.find(c => c.name.includes("Ava"))?.id || null;
      case "SaaS / Tech Software":
        return CANDIDATES.find(c => c.name.includes("Liam"))?.id || null;
      case "FinTech & Banking":
        return CANDIDATES.find(c => c.name.includes("Noah"))?.id || null; // Finance
      case "Real Estate & Property Management":
        return CANDIDATES.find(c => c.name.includes("Lucas"))?.id || null;
      case "Healthcare & MedTech":
        return CANDIDATES.find(c => c.name.includes("Sophie"))?.id || null;
      case "Logistics & Supply Chain":
        return CANDIDATES.find(c => c.name.includes("Emma"))?.id || null; // Ops
      // Fallback logic could go here
      default:
        return null;
    }
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsAnalyzing(true);

      // Simulate analysis delay
      setTimeout(() => {
        const matchedCandidateId = findBestCandidate(industry);

        setIsAnalyzing(false);

        if (matchedCandidateId) {
          navigate(`/candidate/${matchedCandidateId}`);
        } else {
          navigate('/custom-build');
        }
      }, 2500);
    }
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 font-heading">{t('auditTitle')}</h1>
        <p className="text-gray-500 max-w-xl mx-auto font-medium">
          Protocol: <span className="text-indigo-600 font-bold">Operational Latency Analysis (OLA) v2.4</span>
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar */}
        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 md:w-1/3 p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-[60px]"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-indigo-400 rounded-full blur-[80px]"></div>
          </div>

          <div className="relative z-10">
            <div className="mb-12">
              <div className="text-indigo-200 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">Analysis Progress</div>
              <div className="h-1.5 w-full bg-indigo-950/50 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-indigo-200 shadow-[0_0_10px_rgba(199,210,254,0.5)] transition-all duration-500 ease-out"
                  style={{ width: `${(step / 3) * 100}%` }}
                ></div>
              </div>
            </div>

            <ul className="space-y-8">
              <li className={`flex items-center gap-4 transition-all duration-300 ${step === 1 ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${step === 1 ? 'bg-white text-indigo-900 border-white' : 'border-white/30'}`}>1</div>
                <div>
                  <p className="font-bold">{t('step1')}</p>
                  <p className="text-xs text-indigo-200/80 mt-0.5">Business Fundamentals</p>
                </div>
              </li>
              <li className={`flex items-center gap-4 transition-all duration-300 ${step === 2 ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${step === 2 ? 'bg-white text-indigo-900 border-white' : 'border-white/30'}`}>2</div>
                <div>
                  <p className="font-bold">{t('step2')}</p>
                  <p className="text-xs text-indigo-200/80 mt-0.5">Tech Stack Integration</p>
                </div>
              </li>
              <li className={`flex items-center gap-4 transition-all duration-300 ${step === 3 ? 'opacity-100 scale-105' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${step === 3 ? 'bg-white text-indigo-900 border-white' : 'border-white/30'}`}>3</div>
                <div>
                  <p className="font-bold">{t('step3')}</p>
                  <p className="text-xs text-indigo-200/80 mt-0.5">Process Analysis</p>
                </div>
              </li>
            </ul>

            {/* Live Insight Block */}
            <div className="mt-12 bg-white/10 p-5 rounded-xl border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-2 mb-2 text-emerald-300 text-xs font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> Live Insight
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {step === 1 && "Sector benchmarks indicate legal firms waste 22% of billable hours on admin."}
                {step === 2 && "Disconnected tools add ~4 minutes of context-switching tax per task transition."}
                {step === 3 && "Manual data entry is the #1 cause of revenue leakage in professional services."}
              </p>
            </div>
          </div>

          <div className="relative z-10 text-xs text-indigo-200/60 font-mono">
            ID: AUDIT-GEN-2X
          </div>
        </div>

        {/* Main Content */}
        <div className="p-10 md:w-2/3 bg-white flex flex-col">
          <form onSubmit={handleNext} className="flex-1 flex flex-col justify-between">
            <div className="flex-1">
              {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-3 text-indigo-600 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg"><Building2 size={24} /></div>
                    <h3 className="font-bold text-xl font-heading">{t('step1')}</h3>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Company Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter company name"
                        defaultValue={isAuthenticated && user ? user.orgName || user.name : ''}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                      />
                      {isAuthenticated && (
                        <p className="mt-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Pre-filled from profile</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Industry Focus</label>
                      <div className="relative">
                        <select
                          value={industry}
                          onChange={(e) => setIndustry(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none font-medium text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          {INDUSTRIES.map(ind => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <Target size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-3 text-indigo-600 mb-2">
                    <div className="p-2 bg-indigo-50 rounded-lg"><Target size={24} /></div>
                    <div>
                      <h3 className="font-bold text-xl font-heading">{t('step2')}</h3>
                      <p className="text-sm text-gray-400">Select all software currently in use.</p>
                    </div>
                  </div>

                  <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-8">
                    {/* Categories */}
                    {TECH_STACK_CATEGORIES.map(cat => (
                      <div key={cat.name}>
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">{cat.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          {cat.tools.map(tool => (
                            <button
                              type="button"
                              key={tool}
                              onClick={() => toggleTool(tool)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${selectedTools.includes(tool) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                            >
                              {tool}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Custom Tool Input */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Other Software</h4>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedTools.filter(t => !TECH_STACK_CATEGORIES.some(c => c.tools.includes(t))).map(tool => (
                          <div key={tool} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-2">
                            {tool}
                            <button onClick={() => removeTool(tool)} className="hover:text-indigo-900"><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customToolInput}
                          onChange={(e) => setCustomToolInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTool(e))}
                          placeholder="Type and press Enter to add..."
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={addCustomTool}
                          className="bg-gray-900 text-white px-4 rounded-xl hover:bg-black transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-3 text-indigo-600 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg"><Sparkles size={24} /></div>
                    <h3 className="font-bold text-xl font-heading">{t('step3')}</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800 text-sm font-medium">
                      <Sparkles size={18} className="shrink-0 mt-0.5" />
                      <p>Tip: Describe your most repetitive, manual tasks. Example: "I copy data from emails to Excel manually for 2 hours a day."</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Process Bottlenecks</label>
                      <textarea
                        rows={6}
                        placeholder="Describe the workflows you want to automate..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder:text-gray-400 resize-none"
                      ></textarea>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 mt-4 border-t border-gray-100 flex justify-between items-center">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-gray-600 transition-colors">Back</button>
              ) : <div></div>}

              <button
                type="submit"
                disabled={isAnalyzing}
                className={`bg-indigo-600 text-white pl-8 pr-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 ${isAnalyzing ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isAnalyzing ? (
                  <>Analyzing Stack <Loader2 size={18} className="animate-spin ml-2" /></>
                ) : (
                  step === 3 ? 'Generate Strategy' : 'Continue'
                )}
                {!isAnalyzing && step < 3 && <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
