
import React from 'react';
import { Mail, MessageSquare, HelpCircle, ArrowRight, Phone } from 'lucide-react';
import { useI18n } from '../I18nContext';

export const SupportView: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('supportTitle')}</h1>
        <p className="text-gray-500 max-w-xl mx-auto">{t('supportSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
            <Mail size={24} />
          </div>
          <h3 className="text-xl font-bold mb-2">Client Support</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">Dedicated assistance for active placements and technical integration.</p>
          <a href="mailto:support@forwardtalent.ai" className="text-indigo-600 font-bold flex items-center gap-1 group">
            Email Support <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6">
            <MessageSquare size={24} />
          </div>
          <h3 className="text-xl font-bold mb-2">Talent Audit</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">Book a session with a Forward Development Engineer for a stack audit.</p>
          <button onClick={() => window.location.hash = '/audit'} className="text-emerald-600 font-bold flex items-center gap-1 group">
            Book Audit <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-6">
            <HelpCircle size={24} />
          </div>
          <h3 className="text-xl font-bold mb-2">Knowledge Base</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">Read our documentation on Digital Associate onboarding and training.</p>
          <a href="#" className="text-amber-600 font-bold flex items-center gap-1 group">
            Browse Docs <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>

      <div className="bg-indigo-600 rounded-[2.5rem] p-12 flex flex-col lg:flex-row items-center gap-12 text-white">
        <div className="lg:w-1/2">
          <h2 className="text-3xl font-bold mb-4">Urgent technical issue?</h2>
          <p className="text-indigo-100 mb-8 leading-relaxed">Standard support responds within 2 hours. Enterprise clients have access to our hotline.</p>
          <div className="flex items-center gap-2 bg-indigo-500/30 px-4 py-2 rounded-full text-sm font-bold">
            <Phone size={16} /> +1 (800) FORWARD
          </div>
        </div>
        <div className="lg:w-1/2 w-full">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 text-white">
            <h4 className="font-bold mb-6">Send a Message</h4>
            <div className="space-y-4 text-gray-900">
              <input type="text" placeholder="Name" className="w-full bg-white/20 border-white/30 rounded-xl px-4 py-3 text-white placeholder:text-white/60 outline-none" />
              <textarea placeholder="Message" className="w-full bg-white/20 border-white/30 rounded-xl px-4 py-3 text-white placeholder:text-white/60 outline-none h-24"></textarea>
              <button className="w-full bg-white text-indigo-600 py-4 rounded-xl font-bold">Submit Ticket</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
