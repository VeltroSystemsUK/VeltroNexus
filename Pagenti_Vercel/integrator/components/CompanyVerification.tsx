
import React, { useState, useEffect } from 'react';
import { Search, Building2, MapPin, Calendar, ExternalLink, ShieldCheck, CheckCircle2, Loader2, Building, Linkedin, ListFilter, PlayCircle, Trash2, Clock, Info, Cloud } from 'lucide-react';
import { Company, SocialProfile } from '../types';
import { gemini } from '../services/geminiService';
import { companyRegistryService } from '../services/companyRegistryService';

const CompanyVerification: React.FC = () => {
  const [viewMode, setViewMode] = useState<'single' | 'bulk'>('single');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [results, setResults] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingSocial, setIsSearchingSocial] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    companyRegistryService.getPersistedCompanies().then(setResults);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    setIsProcessing(true);
    const res = await companyRegistryService.searchCompany(searchTerm);
    if (res.length > 0) {
      setResults(prev => [res[0], ...prev]);
      await companyRegistryService.saveToFirestore(res[0]);
    }
    setIsProcessing(false);
  };

  const handleBulkVerify = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    
    const res = await companyRegistryService.verifyBulk(
      bulkInput, 
      (p: number) => setProgress(p),
      (msg: string) => setLogs(prev => [...prev.slice(-3), msg])
    );
    
    setResults(prev => [...res, ...prev]);
    setBulkInput('');
    setIsProcessing(false);
  };

  const handleSelectCompany = async (company: Company) => {
    setSelectedCompany(company);
    setAnalysis(null);
    setSocialProfiles([]);
    setIsAnalyzing(true);
    gemini.analyzeCompanyData(company.companyName, company.sicCodes).then(res => {
      setAnalysis(res);
      setIsAnalyzing(false);
    });
    setIsSearchingSocial(true);
    gemini.searchSocialProfiles(company.companyName).then(res => {
      setSocialProfiles(res);
      setIsSearchingSocial(false);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Entity Intelligence</h2>
          <p className="text-slate-500 text-sm mt-1">Registry verification linked with Firestore cloud storage.</p>
        </div>
        
        <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
          <button 
            onClick={() => setViewMode('single')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'single' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Single Lookup
          </button>
          <button 
            onClick={() => setViewMode('bulk')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'bulk' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Bulk Registry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          {viewMode === 'single' ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Search className="w-3.5 h-3.5 mr-2" /> Targeted Search
              </h3>
              <form onSubmit={handleSearch} className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Enter name or number..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute Search'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <ListFilter className="w-3.5 h-3.5 mr-2" /> Bulk Sync
              </h3>
              <textarea 
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Tesla Motors&#10;08247514&#10;Veltro Limited..."
                className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              />
              <button 
                onClick={handleBulkVerify}
                disabled={isProcessing || !bulkInput.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center shadow-sm"
              >
                {isProcessing ? (
                  <><Clock className="w-4 h-4 mr-2 animate-spin" /> Processing {progress}%</>
                ) : (
                  <><PlayCircle className="w-4 h-4 mr-2" /> Run Registry Engine</>
                )}
              </button>
              
              {isProcessing && logs.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-3 space-y-1 font-mono text-[10px]">
                  {logs.map((log, i) => (
                    <p key={i} className="text-emerald-400 opacity-80 truncate">{log}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Cloud className="w-3 h-3 mr-1.5 text-indigo-500" /> Cloud Cache
              </h4>
              <button onClick={() => setResults([])} className="p-1 hover:text-red-500 text-slate-300 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {results.length > 0 ? (
                results.map((c, i) => (
                  <div 
                    key={c.companyNumber + i} 
                    onClick={() => handleSelectCompany(c)}
                    className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-all ${selectedCompany?.companyNumber === c.companyNumber ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-slate-800 uppercase truncate pr-2">{c.companyName}</p>
                      <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${c.companyStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {c.companyStatus}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">{c.companyNumber}</p>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center">
                  <Building2 className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-300 font-bold uppercase">No entities synced</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          {selectedCompany ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{selectedCompany.companyName}</h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">ID: {selectedCompany.companyNumber}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider flex items-center">
                      <Cloud className="w-3 h-3 mr-1.5" /> Registry Match
                    </span>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <a 
                    href={`https://find-and-update.company-information.service.gov.uk/company/${selectedCompany.companyNumber}`} 
                    target="_blank" 
                    className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                      <p className="text-sm font-bold text-slate-800 capitalize flex items-center">
                        <CheckCircle2 className={`w-3.5 h-3.5 mr-2 ${selectedCompany.companyStatus === 'active' ? 'text-emerald-500' : 'text-red-500'}`} /> 
                        {selectedCompany.companyStatus}
                      </p>
                    </div>
                    <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Incorporated</p>
                      <p className="text-sm font-bold text-slate-800">{selectedCompany.incorporationDate}</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/50">
                    <div className="flex items-center space-x-2 mb-4">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Commercial Analysis</h4>
                    </div>
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center py-4">
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin mb-2" />
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Synthesizing...</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                        "{analysis || "Awaiting AI analysis..."}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Registered Office</h4>
                    <div className="flex items-start space-x-3 text-slate-600">
                      <MapPin className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold">{selectedCompany.registeredAddress.addressLine1}</p>
                        <p className="text-xs font-medium text-slate-500">{selectedCompany.registeredAddress.locality}</p>
                        <p className="text-xs font-bold mt-1 text-slate-900">{selectedCompany.registeredAddress.postalCode}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-indigo-600">
                      <Linkedin className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Social Layer</h4>
                    </div>
                    {isSearchingSocial ? (
                      <div className="py-6 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin mb-2" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Scanning</p>
                      </div>
                    ) : socialProfiles.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {socialProfiles.map((p, i) => (
                          <a key={p.id + i} href={p.url} target="_blank" className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:bg-indigo-50 transition-all group">
                            <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">{p.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-300" />
                          </a>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl">No profiles found.</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl opacity-60">
              <Building className="w-12 h-12 text-slate-200 mb-6" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Select Entity</h3>
              <p className="text-xs font-semibold text-slate-300 mt-2 max-w-xs leading-relaxed">
                Companies verified here are automatically synced to your shared Firebase cloud fleet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyVerification;
