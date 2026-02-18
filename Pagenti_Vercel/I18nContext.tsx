
import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'en-GB' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF';

interface Translations {
  [key: string]: {
    [K in Language]: string;
  };
}

const translations: Translations = {
  // Navigation
  roster: { en: 'The Candidates', 'en-GB': 'The Candidates', es: 'Los Candidatos', fr: "Les Candidats", de: 'Die Kandidaten', it: 'I Candidati', pt: 'Os Candidatos', ja: '候補者' },
  managerPortal: { en: 'Manager Portal', 'en-GB': 'Director Portal', es: 'Portal de Gestión', fr: 'Portail Manager', de: 'Manager-Portal', it: 'Portale Manager', pt: 'Painel do Gestor', ja: '管理者ポータル' },
  talentAudit: { en: 'Talent Audit', 'en-GB': 'Talent Audit', es: 'Auditoría de Talento', fr: 'Audit de Talent', de: 'Talent-Audit', it: 'Audit dei Talenti', pt: 'Auditoria de Talentos', ja: 'タレント監査' },
  auditTitle: { en: 'Talent Audit Protocol', 'en-GB': 'Talent Audit Protocol', es: 'Protocolo de Auditoría', fr: 'Protocole d\'Audit', de: 'Audit-Protokoll', it: 'Protocollo Audit', pt: 'Protocolo de Auditoria', ja: '監査プロトコル' },
  step1: { en: 'Sector Benchmarking', 'en-GB': 'Sector Benchmarking', es: 'Benchmarking Sectorial', fr: 'Analyse Sectorielle', de: 'Sektor-Benchmarking', it: 'Benchmarking di Settore', pt: 'Benchmarking Setorial', ja: 'セクター分析' },
  step2: { en: 'Integration Vectors', 'en-GB': 'Integration Vectors', es: 'Vectores de Integración', fr: 'Vecteurs d\'Intégration', de: 'Integrationsvektoren', it: 'Vettori di Integrazione', pt: 'Vetores de Integração', ja: '統合ベクター' },
  step3: { en: 'Latency Calculation', 'en-GB': 'Latency Calculation', es: 'Cálculo de Latencia', fr: 'Calcul de Latence', de: 'Latenzberechnung', it: 'Calcolo Latenza', pt: 'Cálculo de Latência', ja: 'レイテンシ計算' },

  // Hero
  heroTitle: {
    en: 'Your Future Workforce is Here!',
    'en-GB': 'Your Future Workforce is Here!',
    es: 'Tu Fuerza Laboral del Futuro está Aquí!',
    fr: "Votre Main-d'œuvre du Futur est Ici!",
    de: 'Ihre Belegschaft der Zukunft ist da!',
    it: 'La Tua Forza Lavoro del Futuro è Qui!',
    pt: 'Sua Força de Trabalho do Futuro chegou!',
    ja: 'あなたの未来の労働力がここに！'
  },
  heroSubtitle: {
    en: 'Hire Employees that never sleep...',
    'en-GB': 'Hire Employees that never sleep...',
    es: 'Contrata asociados que nunca duermen.',
    fr: 'Recrutez des associés qui ne dorment jamais.',
    de: 'Stellen Sie Mitarbeiter ein, die niemals schlafen.',
    it: 'Assumi collaboratori che non dormono mai.',
    pt: 'Contrate associados que nunca dormem.',
    ja: '眠らないアソシエイトを。'
  },
  heroDescription: {
    en: "We don't offer software. We provide real-time solutions. Digital Employees to enhance your existing team, not replace them. Hire, Train and Deploy new employees in minutes, not weeks.",
    'en-GB': "We don't offer software. We provide real-time solutions. Digital Employees to enhance your existing team, not replace them. Hire, Train and Deploy new employees in minutes, not weeks.",
    es: 'No vendemos software. Colocamos Asociados Digitales especializados en su equipo. Contrate empleados pre-entrenados en minutos.',
    fr: 'Nous ne vendons pas de logiciels. Nous plaçons des Associés Numériques spécialisés dans votre équipe. Embauchez des employés pré-formés en quelques minutes.',
    de: 'Wir verkaufen keine Software. Wir vermitteln spezialisierte digitale Mitarbeiter in Ihr Team. Stellen Sie geschulte Mitarbeiter in Minuten ein.',
    it: 'Non vendiamo software. Inseriamo Collaboratori Digitali specializzati nel tuo team. Assumi personale già formato in pochi minuti.',
    pt: 'Não vendemos software. Alocamos Associados Digitais especializados em sua equipe. Contrate funcionários pré-treinados em minutos.',
    ja: 'ソフトウェアを売るのではなく、専門的なデジタルアソシエイトをチームに配置します。数分で即戦力を雇用。'
  },
  heroTagline: {
    en: 'Stop Hiring for Tasks. Start Deploying Capacity.',
    'en-GB': 'Stop Hiring for Tasks. Start Deploying Capacity.',
    es: 'Deja de contratar para tareas. Empieza a desplegar capacidad.',
    fr: "Arrêtez d'embaucher pour des tâches. Commencez à déployer de la capacité.",
    de: 'Hören Sie auf, Aufgaben zu besetzen. Starten Sie Kapazitäten.',
    it: 'Smetti di assumere per task. Inizia a distribuire capacità.',
    pt: 'Pare de contratar para tarefas. Comece a implantar capacidade.',
    ja: 'タスクの雇用をやめ、キャパシティを配置しましょう。'
  },
  viewRoster: { en: 'View Our Employees', 'en-GB': 'View Our Employees', es: 'Ver a Nuestros Empleados', fr: "Voir Nos Employés", de: 'Unsere Mitarbeiter ansehen', it: 'Vedi i Nostri Dipendenti', pt: 'Ver Nossos Funcionários', ja: '従業員を見る' },

  // Labels
  recruit: { en: 'Recruit', 'en-GB': 'Recruit', es: 'Contratar', fr: 'Recruter', de: 'Einstellen', it: 'Assumi', pt: 'Recrutar', ja: '採用' },
  tempTask: { en: 'Temp Task', 'en-GB': 'Temp Task', es: 'Tarea Temporal', fr: 'Tâche Temporaire', de: 'Kurzaufgabe', it: 'Task Temporaneo', pt: 'Tarefa Temporária', ja: '短期タスク' },
  reclaim: { en: 'Reclaim', 'en-GB': 'Reclaim', es: 'Recuperar', fr: 'Récupérer', de: 'Rückgewinnung', it: 'Recupera', pt: 'Recuperar', ja: '還元' },
  activeSearch: { en: 'Active Search', 'en-GB': 'Active Search', es: 'Búsqueda Activa', fr: 'Recherche Active', de: 'Aktive Suche', it: 'Ricerca Attiva', pt: 'Busca Ativa', ja: 'アクティブ検索' },
  bookAudit: { en: 'Discover How', 'en-GB': 'Discover How', es: 'Descubre Cómo', fr: 'Découvrir Comment', de: 'Entdecken Sie wie', it: 'Scopri Come', pt: 'Descubra Como', ja: '方法を見る' },
  customBuild: { en: 'Request Custom Build', 'en-GB': 'Request Custom Build', es: 'Solicitar Versión Personalizada', fr: 'Demander une Version Personnalisée', de: 'Sonderanfertigung', it: 'Richiedi Custom Build', pt: 'Solicitar Versão Customizada', ja: 'カスタム構築を依頼' },
  deploy: { en: 'Ready to Recruit?', 'en-GB': 'Ready to Recruit?', es: '¿Listo para reclutar?', fr: 'Prêt à recruter ?', de: 'Bereit zum Rekrutieren?', it: 'Pronto a reclutare?', pt: 'Pronto para recrutar?', ja: '採用の準備はできていますか？' },

  // ROI Section
  roiTitle: { en: 'Digital ROI vs. Human Overhead.', 'en-GB': 'Digital ROI vs. Human Overhead.', es: 'ROI Digital vs. Gastos de Personal.', fr: 'ROI Numérique vs Frais de Personnel.', de: 'Digitaler ROI vs. Personalnebenkosten.', it: 'ROI Digitale vs Spese Personale.', pt: 'ROI Digital vs Custos Humanos.', ja: 'デジタルROI vs 人件費' },
  roiSubtitle: {
    en: 'Traditional hiring takes 45 days. Pagenti placement takes 45 minutes. Our associates operate with zero overhead, zero downtime, and instant scalability.',
    'en-GB': 'Traditional hiring takes 45 days. Pagenti placement takes 45 minutes. Our associates operate with zero overhead, zero downtime, and instant scalability.',
    es: 'La contratación tradicional tarda 45 días. La colocación de Pagenti tarda 45 minutos. Nuestros asociados operan sin gastos generales, sin tiempo de inactividad y con escalabilidad instantánea.',
    fr: 'Le recrutement traditionnel prend 45 jours. Le placement Pagenti prend 45 minutes. Nos associés fonctionnent sans frais généraux, sans interruption et avec une évolutivité instantanée.',
    de: 'Traditionelle Einstellungen dauern 45 Tage. Pagenti braucht 45 Minuten. Unsere Mitarbeiter arbeiten ohne Overhead, ohne Ausfallzeiten und mit sofortiger Skalierbarkeit.',
    it: 'Le assunzioni tradizionali richiedono 45 giorni. Pagenti impiega 45 minuti. I nostri collaboratori operano con zero spese generali, zero tempi morti e scalabilità istantanea.',
    pt: 'Contratações tradicionais levam 45 dias. O placement da Pagenti leva 45 minutos. Nossos associados operam com zero overhead, zero inatividade e escalabilidade instantânea.',
    ja: '従来の採用には45日かかりますが、Pagentiなら45分。オーバーヘッドゼロ、ダウンタイムゼロ、即時のスケーラビリティ。'
  },
  responseLabel: { en: 'Lead Response Time', 'en-GB': 'Lead Response Time', es: 'Tiempo de Respuesta', fr: 'Temps de Réponse', de: 'Reaktionszeit', it: 'Tempo di Risposta', pt: 'Tempo de Resposta', ja: 'リード応答時間' },
  availLabel: { en: 'Monthly Availability', 'en-GB': 'Monthly Availability', es: 'Disponibilidad Mensual', fr: 'Disponibilité Mensuelle', de: 'Monatliche Verfügbarkeit', it: 'Disponibilità Mensile', pt: 'Disponibilità Mensal', ja: '月間稼働時間' },
  reliabilityLabel: { en: 'Data Reliability', 'en-GB': 'Data Reliability', es: 'Fiabilidad de Datos', fr: 'Fiabilité des Données', de: 'Datensicherheit', it: 'Affidabilità Dati', pt: 'Confiabilidade de Datos', ja: 'データ信頼性' },
  humanJunior: { en: 'Human Junior', 'en-GB': 'Human Junior', es: 'Junior Humano', fr: 'Junior Humain', de: 'Junior-Angestellter', it: 'Junior Umano', pt: 'Junior Humano', ja: '新人スタッフ' },
  digitalAssoc: { en: 'Digital Associate', 'en-GB': 'Digital Associate', es: 'Asociado Digital', fr: 'Associé Numérique', de: 'Digitaler Mitarbeiter', it: 'Collaboratore Digitale', pt: 'Associado Digital', ja: 'デジタルアソシエイト' },

  // Departments
  dept_legal: { en: "Legal & Compliance", 'en-GB': "Legal & Compliance", es: "Legal y Cumplimiento", fr: "Juridique et Conformité", de: "Recht & Compliance", it: "Legale e Compliance", pt: "Jurídico e Compliance", ja: "法務・コンプライアンス" },
  dept_sales: { en: "Sales & Growth", 'en-GB': "Sales & Growth", es: "Ventas y Crecimiento", fr: "Ventes et Croissance", de: "Vertrieb & Wachstum", it: "Vendite e Crescita", pt: "Vendas e Crescimento", ja: "営業・成長" },
  dept_ops: { en: "Operations & Finance", 'en-GB': "Operations & Finance", es: "Operaciones y Finanzas", fr: "Opérations et Finance", de: "Betrieb & Finanzen", it: "Operazioni e Finanza", pt: "Operações e Finanças", ja: "運用・財務" },
  dept_creative: { en: "Creative & Media Production", 'en-GB': "Creative & Media Production", es: "Creatividad y Medios", fr: "Création et Médias", de: "Kreativität & Medien", it: "Creatività e Media", pt: "Criativo e Mídia", ja: "クリエイティブ・メディア制作" },
  dept_bi: { en: "Business Intelligence & Strategy", 'en-GB': "Business Intelligence & Strategy", es: "BI y Estrategia", fr: "BI et Stratégie", de: "Business Intelligence", it: "BI e Strategia", pt: "BI e Estratégia", ja: "BI・戦略" },

  // Footer
  footer_platform: { en: "Platform", 'en-GB': "Platform", es: "Plataforma", fr: "Plateforme", de: "Plattform", it: "Piattaforma", pt: "Plataforma", ja: "プラットフォーム" },
  footer_company: { en: "Company", 'en-GB': "Company", es: "Empresa", fr: "Entreprise", de: "Firma", it: "Azienda", pt: "Empresa", ja: "会社" },
  footer_engineering: { en: "Engineering", 'en-GB': "Engineering", es: "Ingeniería", fr: "Ingénierie", de: "Ingenieurwesen", it: "Ingegneria", pt: "Engenharia", ja: "エンジニアリング" },
  footer_privacy: { en: "Privacy Policy", 'en-GB': "Privacy Policy", es: "Política de Privacidad", fr: "Politique de Confidentialité", de: "Datenschutzerklärung", it: "Privacy Policy", pt: "Política de Privacidade", ja: "プライバシーポリシー" },
  footer_terms: { en: "Terms of Service", 'en-GB': "Terms of Service", es: "Términos de Servicio", fr: "Conditions d'Utilisation", de: "Nutzungsbedingungen", it: "Termini di Servizio", pt: "Termos de Serviço", ja: "利用規約" },
  footer_contact: { en: "Contact", 'en-GB': "Contact", es: "Contacto", fr: "Contact", de: "Kontakt", it: "Contatto", pt: "Contato", ja: "お問い合わせ" },
  footer_status: { en: "Status", 'en-GB': "Status", es: "Estado", fr: "État", de: "Status", it: "Stato", pt: "Status", ja: "ステータス" },
  footer_api: { en: "API", 'en-GB': "API", es: "API", fr: "API", de: "API", it: "API", pt: "API", ja: "API" },
  footer_nodes: { en: "Nodes", 'en-GB': "Nodes", es: "Nodos", fr: "Nœuds", de: "Knoten", it: "Nodi", pt: "Nós", ja: "ノード" },
  footer_copyright: {
    en: "Pagenti Platform © 2025 • Secured by Pagenti Dev Protocol",
    'en-GB': "Pagenti Platform © 2025 • Secured by Pagenti Dev Protocol",
    es: "Plataforma Pagenti © 2025 • Asegurada por Pagenti Dev Protocol",
    fr: "Plateforme Pagenti © 2025 • Sécurisé par le Protocole Pagenti Dev",
    de: "Pagenti Plattform © 2025 • Gesichert durch Pagenti Dev Protokoll",
    it: "Piattaforma Pagenti © 2025 • Protetta da Protocollo Pagenti Dev",
    pt: "Plataforma Pagenti © 2025 • Protegida pelo Protocolo Pagenti Dev",
    ja: "Pagenti Platform © 2025 • Pagenti Dev Protocolにより保護されています"
  }
};

const currencyRates: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 151.20,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.90,
};

const currencySymbols: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr',
};

interface I18nContextType {
  language: Language;
  currency: Currency;
  setLanguage: (lang: Language) => void;
  setCurrency: (curr: Currency) => void;
  t: (key: string) => string;
  tl: <T>(obj: Record<Language, T>) => T;
  formatPrice: (usdPrice: number) => string;
  convertPrice: (usdPrice: number) => number;
  currencySymbol: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('USD');

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  /**
   * Fixed tl: Using function declaration instead of arrow function for generic type parameters 
   * to avoid parsing ambiguity with JSX tags in .tsx files.
   */
  function tl<T>(obj: Record<Language, T>): T {
    return obj[language];
  }

  const convertPrice = (usdPrice: number) => {
    return usdPrice * currencyRates[currency];
  };

  const formatPrice = (usdPrice: number) => {
    const converted = convertPrice(usdPrice);
    const symbol = currencySymbols[currency];
    const isYen = currency === 'JPY';
    return `${symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: isYen ? 0 : 2,
      maximumFractionDigits: isYen ? 0 : 2
    })}`;
  };

  return (
    <I18nContext.Provider value={{
      language,
      currency,
      setLanguage,
      setCurrency,
      t,
      tl,
      formatPrice,
      convertPrice,
      currencySymbol: currencySymbols[currency]
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};
