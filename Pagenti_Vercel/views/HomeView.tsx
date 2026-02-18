import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TRUST_LOGOS } from '../constants';
import { agentService } from '../services/agentService';
import { DigitalAssociate } from '../types';
import { CandidateCard } from '../components/CandidateCard';
import { DigitalCostCalculator } from '../components/DigitalCostCalculator';
import { InconvenientTruthSection } from '../components/InconvenientTruthSection';
import { InteractiveHeroBackground } from '../components/InteractiveHeroBackground';
import { ArrowRight, Zap } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useScrollReveal } from '../hooks/useScrollReveal';

export const HomeView: React.FC = () => {
  const { t } = useI18n();
  const scrollLogos = [...TRUST_LOGOS, ...TRUST_LOGOS, ...TRUST_LOGOS];
  const [candidates, setCandidates] = useState<DigitalAssociate[]>([]);

  useScrollReveal();

  useEffect(() => {
    // Filter out Ares - internal system agent not shown to users
    const userFacingAgents = agentService.getAgents().filter(agent => agent.id !== 'ares-architect');
    setCandidates(userFacingAgents);
  }, []);

  return (
    <div className="flex flex-col gap-16 pb-20 relative overflow-hidden">
      {/* Background Blobs (Global) */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-20 overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-indigo-100/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-[25%] right-[-10%] w-[40%] h-[40%] bg-violet-100/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute bottom-[15%] left-[5%] w-[35%] h-[35%] bg-blue-100/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-16 pb-10 overflow-visible animate-morph-bg border-b border-indigo-50/50">
        <InteractiveHeroBackground />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 reveal">
          <div className="inline-block glass px-4 py-2 rounded-full border border-indigo-100/50 mb-10 animate-fade-in shadow-sm">
            <p className="text-[10px] md:text-xs font-bold text-indigo-600 tracking-[0.3em] uppercase font-mono">
              {t('heroTagline')}
            </p>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-10 tracking-tight leading-[0.9] reveal">
            {t('heroTitle')}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-gray-900 via-gray-800 to-indigo-600">
              {t('heroSubtitle')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mx-auto mb-16 leading-relaxed font-medium reveal">
            {t('heroDescription')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center reveal">
            <Link to="/audit" className="bg-indigo-600 text-white px-14 py-6 rounded-full font-bold text-lg hover:bg-indigo-700 transition-all shadow-2xl hover:shadow-indigo-500/40 hover:scale-105 transform flex items-center justify-center gap-3 group">
              {t('bookAudit')}
              <Zap size={20} className="group-hover:fill-current" />
            </Link>
            <Link to="/browse" className="glass border border-white/80 text-gray-900 px-14 py-6 rounded-full font-bold text-lg hover:bg-white/50 transition-all hover:scale-105 transform shadow-sm">
              {t('viewRoster')}
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="glass border-y border-white/40 py-4 overflow-hidden reveal">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center gap-12">
          <div className="flex-shrink-0 flex items-center gap-4 border-r border-gray-100 pr-12">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <p className="text-[10px] font-black text-gray-500 tracking-[0.3em] uppercase font-mono whitespace-nowrap">
              Ecosystem Mastery
            </p>
          </div>

          <div className="relative flex-grow overflow-hidden">
            <div className="animate-marquee-horizontal flex items-center gap-16 md:gap-24">
              {scrollLogos.map((logo, idx) => (
                <div key={idx} className="flex items-center gap-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-crosshair">
                  <img src={logo.icon} alt={logo.name} className="h-7 object-contain" />
                  <span className="text-[11px] font-bold text-gray-400 hover:text-gray-900 uppercase tracking-tight">{logo.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cost Calculator Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal">
        <div className="glass-card p-3 rounded-[4rem] shadow-2xl">
          <div className="bg-white/40 backdrop-blur-sm rounded-[3.5rem] p-4">
            <DigitalCostCalculator />
          </div>
        </div>
      </section>

      {/* Talent Pool Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 reveal">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="reveal">
            <h2 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">{t('roster')}</h2>
            <p className="text-xl text-gray-500 font-medium max-w-2xl leading-relaxed">Top-tier digital talent ready for immediate integration into your workflow ecosystem.</p>
          </div>
          <Link to="/browse" className="group glass px-10 py-5 rounded-2xl text-indigo-600 font-bold flex items-center gap-3 hover:bg-white transition-all shadow-sm reveal">
            {t('viewRoster')} <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-10 reveal">
          {candidates.slice(0, 4).map((c, i) => (
            <div key={c.id} className="reveal" style={{ animationDelay: `${i * 0.15}s` }}>
              <CandidateCard candidate={c} viewMode="list" />
            </div>
          ))}
        </div>
      </section>

      {/* Inconvenient Truth Section */}
      <div className="reveal">
        <InconvenientTruthSection />
      </div>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 w-full py-24 reveal">
        <div className="glass-dark border border-white/10 rounded-[5rem] p-24 text-center text-white relative overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-violet-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <div className="relative z-10 reveal">
            <h2 className="text-6xl font-black mb-8 tracking-tight">{t('deploy')}</h2>
            <p className="text-indigo-100 text-2xl mb-14 max-w-3xl mx-auto font-medium leading-relaxed">
              Standardise your operational excellence. Join 1,000+ industry leaders scaling with digital workforce.
            </p>
            <Link to="/audit" className="bg-white text-indigo-600 px-16 py-6 rounded-full font-black text-2xl hover:scale-110 transition-all shadow-2xl hover:shadow-white/30 inline-block">
              {t('bookAudit')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
