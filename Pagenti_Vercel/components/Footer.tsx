
import React from 'react';
import { useI18n } from '../I18nContext';

export const Footer: React.FC = () => {
    const { t } = useI18n();

    return (
        <footer className="border-t border-gray-200 pt-16 pb-12 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-indigo-600 p-1.5 rounded-lg">
                                <span className="text-white font-bold text-xs">FT</span>
                            </div>
                            <span className="text-xl font-bold text-gray-900 tracking-tight font-heading">
                                Forward<span className="text-indigo-600">Talent</span>
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-8">
                            {t('heroDescription')}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
                        <div className="space-y-4">
                            <p className="font-bold text-gray-900">{t('footer_platform')}</p>
                            <ul className="space-y-2 text-gray-500">
                                <li><a href="#/browse" className="hover:text-indigo-600 transition-colors">{t('roster')}</a></li>
                                <li><a href="#/audit" className="hover:text-indigo-600 transition-colors">{t('talentAudit')}</a></li>
                                <li><a href="#/dashboard" className="hover:text-indigo-600 transition-colors">{t('managerPortal')}</a></li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <p className="font-bold text-gray-900">{t('footer_company')}</p>
                            <ul className="space-y-2 text-gray-500">
                                <li><a href="#/privacy" className="hover:text-indigo-600 transition-colors">{t('footer_privacy')}</a></li>
                                <li><a href="#/terms" className="hover:text-indigo-600 transition-colors">{t('footer_terms')}</a></li>
                                <li><a href="#/support" className="hover:text-indigo-600 transition-colors">{t('footer_contact')}</a></li>
                            </ul>
                        </div>
                        <div className="space-y-4 hidden md:block">
                            <p className="font-bold text-gray-900">{t('footer_engineering')}</p>
                            <ul className="space-y-2 text-gray-500 font-mono text-[10px] uppercase tracking-wider">
                                <li>{t('footer_status')}: 99.9% Up</li>
                                <li>{t('footer_api')}: v2.4.0</li>
                                <li>{t('footer_nodes')}: Isolated</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-400 text-sm">{t('footer_copyright')}</p>
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center opacity-40">
                            <span className="text-[10px] font-bold">X</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center opacity-40">
                            <span className="text-[10px] font-bold">LI</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
