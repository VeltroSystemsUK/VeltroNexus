
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, FileSearch, Globe, Coins, ChevronDown, Check, Cpu } from 'lucide-react';
import { useI18n, Language, Currency } from '../I18nContext';

const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'en-GB', label: 'UK English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'it', label: 'Italiano', flag: '🇮🇹' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
];

const CURRENCIES: { id: Currency; label: string; symbol: string }[] = [
  { id: 'USD', label: 'US Dollar', symbol: '$' },
  { id: 'EUR', label: 'Euro', symbol: '€' },
  { id: 'GBP', label: 'Brit Pound', symbol: '£' },
  { id: 'JPY', label: 'Yen', symbol: '¥' },
  { id: 'CAD', label: 'Can Dollar', symbol: 'C$' },
  { id: 'AUD', label: 'Aus Dollar', symbol: 'A$' },
  { id: 'CHF', label: 'Swiss Franc', symbol: 'Fr' },
];

import { useAuth } from '../contexts/AuthContext';

export const Navigation: React.FC = () => {
  const location = useLocation();
  const { language, setLanguage, currency, setCurrency, t } = useI18n();
  const { user, isAuthenticated, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const activeLang = LANGUAGES.find(l => l.id === language);
  const activeCurr = CURRENCIES.find(c => c.id === currency);

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:rotate-12 transition-transform duration-300">
              <Zap className="text-white" size={24} fill="currentColor" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight font-heading">
              Pagenti
            </span>
          </Link>

          {/* Links for Logged Out or Public */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              to="/browse"
              className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center gap-1.5 ${location.pathname === '/browse' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
            >
              <FileSearch size={14} /> {t('roster')}
            </Link>

            {/* Admin Links */}
            {isAuthenticated && user?.role === 'ADMIN' && (
              <>
                <Link
                  to="/dashboard"
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center gap-1.5 ${location.pathname === '/dashboard' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                >
                  <Globe size={14} /> Command Center
                </Link>
                <Link
                  to="/ares-architect"
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center gap-1.5 ${location.pathname === '/ares-architect' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                >
                  <Cpu size={14} /> ARES Controls
                </Link>
              </>
            )}

            {/* Employer Links */}
            {isAuthenticated && user?.role === 'EMPLOYER' && (
              <>
                <Link
                  to="/dashboard/client"
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center gap-1.5 ${location.pathname === '/dashboard/client' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                >
                  <Globe size={14} /> My Portal
                </Link>
              </>
            )}

            {/* Enhanced Regional Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all group ${showSettings ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              >
                <span className={`text-lg transition-transform duration-300 group-hover:scale-110 ${showSettings ? 'text-white' : 'text-gray-400'}`}>
                  {activeLang?.flag}
                </span>
                <div className="flex flex-col items-start leading-none h-6 justify-center">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${showSettings ? 'text-indigo-200' : 'text-gray-400'}`}>{activeLang?.id === 'en-GB' ? 'UK' : activeLang?.id.toUpperCase()}</span>
                  <span className={`text-[11px] font-bold font-mono ${showSettings ? 'text-white' : 'text-gray-900'}`}>{activeCurr?.symbol}</span>
                </div>
                <ChevronDown size={14} className={`ml-1 transition-transform duration-300 ${showSettings ? 'rotate-180 text-white' : 'text-gray-400'}`} />
              </button>

              {showSettings && (
                <div className="absolute top-full right-0 mt-4 w-[520px] bg-white border border-gray-100 rounded-[2rem] shadow-2xl p-6 animate-in fade-in slide-in-from-top-4 duration-300 z-50 overflow-hidden ring-1 ring-black/5">
                  <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">

                    {/* Language Module */}
                    <div className="pr-6 relative">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Globe size={12} className="text-indigo-600" /> Locale
                        </p>
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{activeLang?.id}</span>
                      </div>

                      <div className="h-64 overflow-y-auto pr-2 custom-scrollbar space-y-1 relative">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.id}
                            onClick={() => { setLanguage(lang.id); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${language === lang.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span className="flex items-center gap-3">
                              <span className={`text-xl transition-transform duration-300 ${language === lang.id ? 'scale-110' : 'group-hover:scale-125 group-hover:-rotate-12'}`}>{lang.flag}</span>
                              <span>{lang.label}</span>
                            </span>
                            {language === lang.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                          </button>
                        ))}
                        {/* Fade Out Mask */}
                        <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                      </div>
                    </div>

                    {/* Currency Module */}
                    <div className="pl-6 relative">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Coins size={12} className="text-emerald-600" /> Currency
                        </p>
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-mono">{activeCurr?.id}</span>
                      </div>

                      <div className="h-64 overflow-y-auto pr-2 custom-scrollbar space-y-1 relative">
                        {CURRENCIES.map(curr => (
                          <button
                            key={curr.id}
                            onClick={() => { setCurrency(curr.id); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${currency === curr.id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm transition-colors ${currency === curr.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                                {curr.symbol}
                              </span>
                              <span>{curr.label}</span>
                            </span>
                            {currency === curr.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                          </button>
                        ))}
                        {/* Fade Out Mask */}
                        <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                      </div>
                    </div>

                  </div>

                  {/* Footer of Dropdown */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
                    <button onClick={() => setShowSettings(false)} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest transition-colors">
                      Close Settings
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="bg-gray-100 text-gray-600 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                Log Out
              </button>
            ) : (
              <Link to="/login" className="bg-gray-900 text-white px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl hover:shadow-indigo-500/10 flex items-center gap-2">
                Sign In
              </Link>
            )}

          </div>

          <button className="md:hidden p-2 text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </div>
      {showSettings && <div className="fixed inset-0 bg-black/5 z-40 backdrop-blur-[1px]" onClick={() => setShowSettings(false)}></div>}
    </nav>
  );
};
