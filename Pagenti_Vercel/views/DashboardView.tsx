
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Mail, Check, X, Edit2, TrendingUp, Clock, Target, Send, Loader2, Cpu, BrainCircuit, Database, Workflow } from 'lucide-react';
import { generateAgentDraft } from '../services/geminiService';
import { DraftMessage } from '../types';
import { useI18n } from '../I18nContext';

const PERFORMANCE_DATA = [
  { name: 'Mon', hours: 24, leads: 12 },
  { name: 'Tue', hours: 24, leads: 18 },
  { name: 'Wed', hours: 24, leads: 15 },
  { name: 'Thu', hours: 24, leads: 22 },
  { name: 'Fri', hours: 24, leads: 19 },
  { name: 'Sat', hours: 24, leads: 8 },
  { name: 'Sun', hours: 24, leads: 10 },
];

export const DashboardView: React.FC = () => {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<DraftMessage[]>([
    {
      id: '1',
      associateName: 'Maya',
      to: 'Sarah Jenkins (Apex Corp)',
      subject: 'Follow-up on Q4 Growth Strategy',
      content: 'Hello Sarah, I noticed you expressed interest in our automation suite. Would you like to hop on a quick 5-minute call tomorrow at 10 AM?',
      status: 'pending',
      timestamp: '10:42 AM'
    }
  ]);

  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleAction = (id: string, action: 'approved' | 'rejected') => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: action } : d));
  };

  const generateNewDraft = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    try {
      const draft = await generateAgentDraft(promptInput, 'Maya');
      const newDraft: DraftMessage = {
        id: Date.now().toString(),
        associateName: 'Maya',
        to: 'New Prospect',
        subject: draft.subject,
        content: draft.body,
        status: 'pending',
        timestamp: 'Just now'
      };
      setDrafts([newDraft, ...drafts]);
      setPromptInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('managerDashboard')}</h1>
          <p className="text-gray-500">{t('managing')} <span className="font-bold text-indigo-600">Maya</span> • Lead Gen Specialist</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Clock size={20} /></div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('hoursReclaimed')}</p>
              <p className="text-xl font-bold text-gray-900">168.0</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><Target size={20} /></div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('leadsQualified')}</p>
              <p className="text-xl font-bold text-gray-900">104</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Mail size={18} className="text-indigo-600" />{t('approvalDesk')}</h3>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{t('actionRequired')}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {drafts.map((draft) => (
                <div key={draft.id} className={`p-6 ${draft.status === 'pending' ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">{draft.to}</span>
                        <span className="text-xs text-gray-400">• {draft.timestamp}</span>
                      </div>
                      <h4 className="text-sm font-medium text-indigo-600">{draft.subject}</h4>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{draft.content}</p>
                </div>
              ))}
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Tell Maya to draft an email..."
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none"
                />
                <button 
                  onClick={generateNewDraft}
                  disabled={isGenerating || !promptInput}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {t('recruit')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
             <div className="relative z-10">
                <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-3"><Workflow size={20} className="text-indigo-400" />Associate "Depth" Architecture</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                      <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest font-mono mb-2">Episodic Memory</p>
                      <p className="text-gray-400 text-xs font-mono">Real-time state tracking of the current user session.</p>
                   </div>
                   <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                      <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest font-mono mb-2">Semantic Memory</p>
                      <p className="text-gray-400 text-xs font-mono">RAG-powered access to Client SOPs and Handbooks.</p>
                   </div>
                   <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                      <p className="text-rose-400 text-[10px] font-bold uppercase tracking-widest font-mono mb-2">Procedural Logic</p>
                      <p className="text-gray-400 text-xs font-mono">Instructional set for Tool Usage and API connectivity.</p>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-600" />{t('efficiencyTrend')}</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={PERFORMANCE_DATA}>
                  <defs><linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="leads" stroke="#4f46e5" fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Edit2 size={18} className="text-indigo-600" />{t('trainingFeedback')}</h3>
            <p className="text-xs text-gray-400 mb-4 uppercase font-bold tracking-widest">{t('updateSystemPrompt')}</p>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Maya, be a bit more casual..." className="w-full h-32 bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm outline-none mb-4" />
            <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">{t('updateAssoc')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
