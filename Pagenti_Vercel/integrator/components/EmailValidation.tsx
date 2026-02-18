
import React, { useState } from 'react';
import { CheckCircle2, Search, Trash2, Clock, MailSearch, Plus, Activity, Terminal, Shield } from 'lucide-react';
import { EmailValidationResult } from '../types';
import { verificationService } from '../services/verificationService';

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
      
      newResults.push(validated);
      setProgress(Math.round(((i + 1) / emailsToProcess.length) * 100));
    }

    setResults(prev => [...newResults, ...prev]);
    setManualInput('');
    setIsProcessing(false);
  };

  const filteredResults = results.filter(r => 
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Email Validation</h2>
          <p className="text-slate-500 text-sm mt-1">Multi-step verification including SMTP handshake simulation.</p>
        </div>
        <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <Shield className={`w-4 h-4 ${isDeepMode ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className="text-xs font-bold text-slate-600">Deep SMTP Check</span>
          <button 
            onClick={() => setIsDeepMode(!isDeepMode)}
            className={`w-10 h-5 rounded-full relative transition-colors ${isDeepMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDeepMode ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center">
              <Plus className="w-4 h-4 mr-2 text-indigo-600" /> New Verification
            </h3>
            <textarea 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="user@example.com&#10;admin@company.co.uk..."
              className="w-full h-32 p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
              disabled={isProcessing}
            />
            <button 
              onClick={handleStartVerification}
              disabled={isProcessing || !manualInput.trim()}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm shadow-sm transition-all flex items-center justify-center"
            >
              {isProcessing ? (
                <><Clock className="w-4 h-4 mr-2 animate-spin" /> {progress}%</>
              ) : (
                'Run Engine'
              )}
            </button>
          </div>

          {isDeepMode && isProcessing && handshakeLogs.length > 0 && (
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Handshake Logs</span>
              </div>
              <div className="space-y-1 font-mono">
                {handshakeLogs.map((log, i) => (
                  <p key={i} className="text-[10px] text-emerald-400 opacity-80 leading-tight">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
              <Activity className="w-3 h-3 mr-2 text-indigo-600" /> System Integrity
            </h4>
            <div className="space-y-3">
              {[
                { label: 'DNS MX Resolver', status: 'Online' },
                { label: 'Greylist Probe', status: 'Active' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-semibold">{item.label}</span>
                  <span className="text-emerald-600 font-bold flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search results..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              onClick={() => setResults([])}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-[400px]">
            {filteredResults.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3 text-center">Grade</th>
                    <th className="px-6 py-3 text-center">Score</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">{item.email}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.qualityGrade === 'A' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {item.qualityGrade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-indigo-600 font-bold">{item.deliverabilityScore}%</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-xs font-bold ${item.status === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-300">
                <MailSearch className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold text-sm">No verification results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailValidation;
