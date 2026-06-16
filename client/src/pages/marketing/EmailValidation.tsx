
import React, { useState } from 'react';
import { CheckCircle2, Search, Trash2, Clock, MailSearch, Plus, Activity, Terminal, Shield } from 'lucide-react';
import { EmailValidationResult, EmailQuality } from './types';
import { verificationService } from './services/verificationService';

const EmailValidation: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<EmailValidationResult[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDeepMode, setIsDeepMode] = useState(false);
  const [handshakeLogs, setHandshakeLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setHandshakeLogs(prev => [...prev.slice(-4), msg]);

  const handleStartVerification = async () => {
    const emailsToProcess = manualInput
      .split(/[\n,;]/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emailsToProcess.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    const newResults: EmailValidationResult[] = [];

    for (let i = 0; i < emailsToProcess.length; i++) {
      if (isDeepMode) setHandshakeLogs([]);
      const validated = await verificationService.verifyEmail(
        emailsToProcess[i],
        isDeepMode,
        isDeepMode ? addLog : undefined
      );

      let synced = false;
      // Auto-sync high quality emails to marketing contacts
      if (['A', 'B'].includes(validated.qualityGrade)) {
        try {
          const syncRes = await fetch('/api/marketing/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: validated.email,
              qualityGrade: validated.qualityGrade,
              deliverabilityScore: validated.deliverabilityScore,
              status: validated.status,
              tags: ['verified-sync']
            }),
          });
          if (syncRes.ok) synced = true;
        } catch (err) {
          console.error("Failed to sync contact:", err);
        }
      }

      newResults.push({ ...validated, synced });
      setProgress(Math.round(((i + 1) / emailsToProcess.length) * 100));
    }

    setResults(prev => [...newResults, ...prev]);
    setManualInput('');
    setIsProcessing(false);
  };

  const filteredResults = results.filter(r =>
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Email Verification</h2>
          <p className="text-slate-400 mt-1">Multi-step validation including simulated SMTP handshake logic.</p>
        </div>
        <div className="flex items-center space-x-3 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          <Shield className={`w-4 h-4 ${isDeepMode ? 'text-emerald-400' : 'text-white/20'}`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deep SMTP Protocol</span>
          <button
            onClick={() => setIsDeepMode(!isDeepMode)}
            className={`w-10 h-5 rounded-full relative transition-colors ${isDeepMode ? 'bg-emerald-600' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDeepMode ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="antigravity-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center space-x-2 mb-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <h3 className="font-black text-white text-xs uppercase tracking-widest">Verify Batch</h3>
            </div>
            <textarea
              id="batch-emails"
              name="batch-emails"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter emails (comma or newline separated)..."
              className="w-full h-32 p-4 text-sm bg-black/40 border border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all resize-none font-bold text-white placeholder:text-white/20"
              disabled={isProcessing}
            />
            <button
              onClick={handleStartVerification}
              disabled={isProcessing || !manualInput.trim()}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-2xl hover:scale-[1.02] disabled:opacity-30 font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center"
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 animate-spin" /> {progress}% Synthesizing
                </span>
              ) : (
                'Run Validation Engine'
              )}
            </button>
          </div>

          {isDeepMode && isProcessing && handshakeLogs.length > 0 && (
            <div className="bg-black/80 rounded-3xl p-6 border border-emerald-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center space-x-2 mb-4 border-b border-white/5 pb-3">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Protocol Handshake Console</span>
              </div>
              <div className="space-y-1.5 font-mono">
                {handshakeLogs.map((log, i) => (
                  <p key={i} className="text-[10px] text-emerald-400/80 leading-tight truncate">
                    {log}
                  </p>
                ))}
                <div className="w-1.5 h-3 bg-emerald-500 animate-pulse inline-block ml-1"></div>
              </div>
            </div>
          )}

          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center">
              <Activity className="w-3 h-3 mr-2" /> Signal Integrity
            </h4>
            <div className="space-y-4">
              {[
                { label: 'DNS MX Lookup', status: 'Active' },
                { label: 'SMTP Handshake', status: isDeepMode ? 'Deep' : 'Standard' },
                { label: 'Greylist Probe', status: 'Online' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                  <span className={`${item.status === 'Deep' ? 'text-emerald-400' : 'text-emerald-400'} font-black flex items-center`}>
                    <CheckCircle2 className="w-3 h-3 mr-1.5" /> {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="antigravity-card rounded-3xl overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  id="filter-results"
                  name="filter-results"
                  placeholder="Filter results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 pr-6 py-2.5 bg-black/20 border border-white/5 rounded-xl text-xs w-72 focus:ring-1 focus:ring-emerald-500 outline-none text-white font-bold"
                />
              </div>
              <button
                onClick={() => setResults([])}
                className="p-2.5 text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1">
              {filteredResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-black/20 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <tr>
                        <th className="px-8 py-5">Packet Address</th>
                        <th className="px-8 py-5 text-center">Grade</th>
                        <th className="px-8 py-5 text-center">Integrity</th>
                        <th className="px-8 py-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredResults.map((item, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-white">{item.email}</span>
                              <span className="text-[10px] text-slate-500 font-bold mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
                                {item.explanation}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter ${item.qualityGrade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                              item.qualityGrade === 'F' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                              {item.qualityGrade}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center font-mono text-[11px] font-black text-emerald-400">{item.deliverabilityScore}%</td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'valid' ? 'text-emerald-500' : item.status === 'invalid' ? 'text-red-500' : 'text-amber-500'}`}>
                                {item.status}
                              </span>
                              {item.synced && (
                                <span className="flex items-center text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 animate-in fade-in zoom-in duration-500">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> DATABASE SYNCED
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[450px] text-white/10">
                  <MailSearch className="w-16 h-16 mb-6 opacity-5" />
                  <p className="font-black text-sm uppercase tracking-[0.3em]">No Packets Found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailValidation;
