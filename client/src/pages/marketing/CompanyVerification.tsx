
import React, { useState } from 'react';
import { Search, Building2, MapPin, Calendar, ExternalLink, ShieldCheck, CheckCircle2, Loader2, Building, Linkedin, Users } from 'lucide-react';
import { Company, SocialProfile } from './types';
import { gemini } from './services/geminiService';

const CH_API_KEY = '8ed22a93-0deb-41e1-9122-851eeb3f0365';
const PROXY_URL = 'https://corsproxy.io/?';

const CompanyVerification: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingSocial, setIsSearchingSocial] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const auth = btoa(`${CH_API_KEY}:`);
      const targetUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(`${PROXY_URL}${encodeURIComponent(targetUrl)}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      if (!response.ok) throw new Error('Registry Connection Failed');

      const data = await response.json();
      const mappedResults: Company[] = (data.items || []).map((item: any) => ({
        companyNumber: item.company_number,
        companyName: item.title,
        companyStatus: item.company_status as any,
        incorporationDate: item.date_of_creation || 'Unknown',
        registeredAddress: {
          addressLine1: item.address?.address_line_1 || 'No address',
          locality: item.address?.locality || 'N/A',
          postalCode: item.address?.postal_code || ''
        },
        sicCodes: item.sic_codes || [],
        riskLevel: item.company_status === 'active' ? 'low' : 'high'
      }));

      setResults(mappedResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
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
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Entity Intelligence</h2>
          <p className="text-slate-400 mt-1">Direct synchronization with Companies House and Neural Social Graphing.</p>
        </div>
        <form onSubmit={handleSearch} className="flex-1 max-w-xl flex items-center bg-black/40 border border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-2xl">
          <div className="pl-5 pr-2">
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : <Search className="w-5 h-5 text-white/20" />}
          </div>
          <input
            type="text"
            id="company-search"
            name="company-search"
            placeholder="Search entity name or registration number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 py-4 px-3 outline-none bg-transparent text-white font-bold placeholder:text-white/20"
          />
          <button type="submit" className="bg-indigo-600 text-white px-8 py-4 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 transition-colors">
            Scan Registry
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-4 max-h-[65vh] overflow-y-auto pr-3 scrollbar-hide">
          {results.map(c => (
            <div
              key={c.companyNumber}
              onClick={() => handleSelectCompany(c)}
              className={`p-6 rounded-3xl border cursor-pointer transition-all duration-500 ${selectedCompany?.companyNumber === c.companyNumber
                ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.02]'
                : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-black text-white uppercase tracking-tight truncate">{c.companyName}</h4>
                  <p className="text-[10px] text-slate-500 font-black tracking-widest mt-1">ID: {c.companyNumber}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${c.companyStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                  {c.companyStatus}
                </span>
              </div>
              <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider space-x-4">
                <div className="flex items-center"><MapPin className="w-3 h-3 mr-1.5 opacity-50" /> {c.registeredAddress.locality}</div>
                <div className="flex items-center"><Calendar className="w-3 h-3 mr-1.5 opacity-50" /> {c.incorporationDate.split('-')[0]}</div>
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div className="text-center py-24 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center">
              <Building className="w-12 h-12 text-white/5 mb-4" />
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No Active Results</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {selectedCompany ? (
            <div className="antigravity-card rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="p-10 bg-indigo-600/10 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter text-white">{selectedCompany.companyName}</h3>
                  <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mt-1">Entity Verification Record</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${selectedCompany.riskLevel === 'low' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                    {selectedCompany.riskLevel} Risk Signal
                  </span>
                  <a href={`https://find-and-update.company-information.service.gov.uk/company/${selectedCompany.companyNumber}`} target="_blank" className="text-white/40 hover:text-white flex items-center text-[9px] font-black uppercase tracking-widest transition-colors">
                    Registry Details <ExternalLink className="w-2.5 h-2.5 ml-1.5" />
                  </a>
                </div>
              </div>

              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-10">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Core Telemetry</h4>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</p>
                        <p className="text-white font-black uppercase flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-400" /> {selectedCompany.companyStatus}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inc. Date</p>
                        <p className="text-white font-black">{selectedCompany.incorporationDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                    <div className="flex items-center space-x-3 mb-6">
                      <Linkedin className="w-5 h-5 text-indigo-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Neural Graph Findings</h4>
                    </div>
                    {isSearchingSocial ? (
                      <div className="flex flex-col items-center py-8"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
                    ) : socialProfiles.length > 0 ? (
                      <div className="space-y-3">
                        {socialProfiles.map((p, i) => (
                          <a key={i} href={p.url} target="_blank" className="flex items-center justify-between p-3.5 bg-black/40 border border-white/5 rounded-2xl hover:border-indigo-400/50 transition-all group">
                            <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">{p.name}</span>
                            <ExternalLink className="w-3 h-3 text-white/20" />
                          </a>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">No profiles indexed.</p>}
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="bg-gradient-to-br from-indigo-500/10 to-transparent p-8 rounded-3xl border border-indigo-500/20">
                    <div className="flex items-center space-x-3 mb-6">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Signal Synthesis</h4>
                    </div>
                    {isAnalyzing ? (
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                    ) : (
                      <p className="text-sm text-slate-300 leading-relaxed font-bold italic opacity-80">
                        {analysis || "Select an entity for automated financial capability analysis."}
                      </p>
                    )}
                  </div>
                  <button className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    Inject into Target List
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-white/5 border-2 border-dashed border-white/10 rounded-[3rem] opacity-40">
              <Building2 className="w-24 h-24 text-white/10 mb-8" />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Intelligence HUD</h3>
              <p className="text-slate-500 mt-4 max-w-sm text-xs font-bold leading-relaxed">
                Connect to the registry to begin multi-spectral business verification and social indexing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyVerification;
