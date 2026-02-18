
import { AssociateStatus, DigitalAssociate } from './types';


export const HUMAN_HOURLY_RATE = 28.50;
export const HUMAN_HOURS_PER_MONTH = 160;
export const DIGITAL_HOURS_PER_MONTH = 720;

export const DEPARTMENTS = [
  "Legal & Compliance",
  "Sales & Growth",
  "Operations & Finance",
  "Creative & Media Production",
  "Business Intelligence & Strategy",
];

export const DEPARTMENT_COLORS: Record<string, { bg: string, text: string, border: string, light: string, hex: string, tint: string, key: string }> = {
  "Legal & Compliance": { bg: "bg-slate-600", text: "text-slate-600", border: "border-slate-200", light: "bg-slate-50", hex: "f8fafc", tint: "digital-tint-slate", key: "dept_legal" },
  "Sales & Growth": { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-200", light: "bg-emerald-50", hex: "ecfdf5", tint: "digital-tint-emerald", key: "dept_sales" },
  "Operations & Finance": { bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-200", light: "bg-amber-50", hex: "fffbeb", tint: "digital-tint-amber", key: "dept_ops" },
  "Creative & Media Production": { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-200", light: "bg-rose-50", hex: "fff1f2", tint: "digital-tint-rose", key: "dept_creative" },
  "Business Intelligence & Strategy": { bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-200", light: "bg-violet-50", hex: "f5f3ff", tint: "digital-tint-violet", key: "dept_bi" },
};

const DEFAULT_SCORES = [
  { subject: 'Accuracy', A: 96, fullMark: 100 },
  { subject: 'Speed', A: 99, fullMark: 100 },
  { subject: 'Tone', A: 88, fullMark: 100 },
  { subject: 'Integration', A: 94, fullMark: 100 },
  { subject: 'Logic', A: 91, fullMark: 100 },
];

export const CANDIDATES: DigitalAssociate[] = [
  {
    id: 'hugo', name: 'Hugo', department: 'Legal & Compliance',
    status: AssociateStatus.ON_TRIAL, avatar: '/avatars/agent_profile_3.png',
    role: {
      en: 'Legal Document Analyst', 'en-GB': 'Legal Document Analyst', es: 'Analista de Documentos Legales', fr: 'Analyste de Documents Juridiques',
      de: 'Rechtsdokumenten-Analyst', it: 'Analista Documenti Legali', pt: 'Analista de Documentos Jurídicos', ja: '法務ドキュメントアナリスト'
    },
    expertise: {
      en: ['Contract Review', 'Compliance'], 'en-GB': ['Contract Audit', 'Statutory Compliance'], es: ['Revisión de Contratos', 'Cumplimiento'], fr: ['Révision de Contrat', 'Conformité'],
      de: ['Vertragsprüfung', 'Compliance'], it: ['Revisione Contratti', 'Compliance'], pt: ['Revisão de Contratos', 'Compliance'], ja: ['契約レビュー', 'コンプライアンス']
    },
    tools: ['Ironclad', 'DocuSign'],
    description: {
      en: 'Audits complex legal agreements for risk and missing clauses with 99.9% precision.',
      'en-GB': 'Audits complex legal agreements for risk and missing clauses with 99.9% precision.',
      es: 'Audita acuerdos legales complejos en busca de riesgos y cláusulas faltantes con un 99,9% de precisión.',
      fr: 'Audite les accords juridiques complexes pour les risques et les clauses manquantes avec une précision de 99,9%.',
      de: 'Prüft komplexe Rechtsvereinbarungen mit 99,9%iger Präzision auf Risiken und fehlende Klauseln.',
      it: 'Controlla accordi legali complessi per rischi e clausole mancanti con una precisione del 99,9%.',
      pt: 'Audita acordos jurídicos complexos em busca de riscos e cláusulas faltantes com 99,9% de precisão.',
      ja: '複雑な法的合意を99.9%の精度でリスクや欠落条項について監査します。'
    },
    hourlyRate: 1.25, voiceEnabled: true, voiceId: '', scores: DEFAULT_SCORES, demoVideo: '',
    terminalLogs: {
      en: ["Ingesting PDF...", "Scanning Indemnity clauses...", "Cross-referencing legal precedence...", "Drafting risk summary."],
      'en-GB': ["Ingesting PDF...", "Scanning Indemnity clauses...", "Cross-referencing legal precedence...", "Drafting risk summary."],
      es: ["Ingiriendo PDF...", "Escaneando cláusulas de indemnización...", "Cruzando precedentes legales...", "Redactando resumen de riesgos."],
      fr: ["Ingestion du PDF...", "Analyse des clauses d'indemnisation...", "Référence croisée des précédents...", "Rédaction du résumé des risques."],
      de: ["PDF einlesen...", "Haftungsklauseln scannen...", "Rechtliche Präzedenzfälle prüfen...", "Risiko-Zusammenfassung erstellen."],
      it: ["Ingestione PDF...", "Scansione clausole di indennizzo...", "Riferimento incrociato precedenti...", "Bozza sintesi dei rischi."],
      pt: ["Ingerindo PDF...", "Escanendo cláusulas de indenização...", "Cruzando precedentes legales...", "Redigindo resumo de riscos."],
      ja: ["PDFを取り込み中...", "補償条項をスキャン中...", "法的判例を照合中...", "リスク概要を作成中。"]
    }
  },
  {
    id: 'maya', name: 'Maya', department: 'Sales & Growth',
    status: AssociateStatus.AVAILABLE, avatar: '/avatars/agent_profile_1.png',
    role: {
      en: 'Lead Intake Specialist', 'en-GB': 'Lead Intake Specialist', es: 'Especialista en Captación de Leads', fr: 'Spécialiste de la Réception de Leads',
      de: 'Lead-Intake-Spezialist', it: 'Specialista Acquisizione Lead', pt: 'Especialista em Captação de Leads', ja: 'リード受付スペシャリスト'
    },
    expertise: {
      en: ['Lead Qual', '24/7 Outreach'], 'en-GB': ['Lead Qual', '24/7 Outreach'], es: ['Calificación de Leads', 'Alcance 24/7'], fr: ['Qualif de Leads', 'Prospection 24/7'],
      de: ['Lead-Qualifizierung', '24/7 Outreach'], it: ['Qualifica Lead', 'Outreach 24/7'], pt: ['Qualificação de Leads', 'Prospecção 24/7'], ja: ['リード資格確認', '24時間365日のアウトリーチ']
    },
    tools: ['HubSpot', 'Salesforce'],
    description: {
      en: 'High-volume lead intake specialist trained in multi-channel prospect qualification.',
      'en-GB': 'High-volume lead intake specialist trained in multi-channel prospect qualification.',
      es: 'Especialista en captación de leads de alto volumen entrenada en calificación de prospectos multicanal.',
      fr: 'Spécialiste de la réception de leads à haut volume formée à la qualification de prospects multicanaux.',
      de: 'Spezialist für Lead-Eingang mit hohem Volumen, geschult in Multikanal-Qualifizierung.',
      it: 'Specialista in acquisizione lead ad alto volume formata nella qualifica prospect multicanale.',
      pt: 'Especialista em captación de leads de alto volumen treinada em qualificação de prospectos multicanal.',
      ja: 'マルチチャネルでの見込み客資格確認を専門とする、高ボリュームのリード受付スペシャリスト。'
    },
    hourlyRate: 0.83, voiceEnabled: true, voiceId: '', scores: DEFAULT_SCORES, demoVideo: '',
    terminalLogs: {
      en: ["Scanning LinkedIn...", "Qualifying leads...", "Syncing with HubSpot...", "Scheduling discovery calls."],
      'en-GB': ["Scanning LinkedIn...", "Qualifying leads...", "Syncing with HubSpot...", "Scheduling discovery calls."],
      es: ["Escaneando LinkedIn...", "Calificando leads...", "Sincronizando con HubSpot...", "Programando llamadas de descubrimiento."],
      fr: ["Scan de LinkedIn...", "Qualification des leads...", "Sync avec HubSpot...", "Programmation des appels."],
      de: ["LinkedIn scannen...", "Leads qualifizieren...", "Mit HubSpot synchronisieren...", "Discovery-Calls planen."],
      it: ["Scansione LinkedIn...", "Qualifica lead...", "Sincronizzazione HubSpot...", "Pianificazione chiamate."],
      pt: ["Escanendo LinkedIn...", "Qualificando leads...", "Sincronizando with HubSpot...", "Agendando chamadas de descoberta."],
      ja: ["LinkedInをスキャン中...", "リードを選別中...", "HubSpotと同期中...", "ディスカバリーコールを予約中。"]
    }
  },
  {
    id: 'ava', name: 'Ava', department: 'Operations & Finance',
    status: AssociateStatus.AVAILABLE, avatar: '/avatars/agent_profile_5.png',
    role: {
      en: 'Digital Intake Specialist', 'en-GB': 'Digital Intake Specialist', es: 'Especialista en Admisión Digital', fr: 'Spécialiste de l\'Admission Numérique',
      de: 'Digitaler Aufnahme-Spezialist', it: 'Specialista Ammissione Digitale', pt: 'Especialista em Admissão Digital', ja: 'デジタル受付スペシャリスト'
    },
    expertise: {
      en: ['Instant Triage', 'Deep Research', 'Calendar Mgmt'], 'en-GB': ['Instant Triage', 'Deep Research', 'Calendar Mgmt'], es: ['Triaje Instantáneo', 'Investigación Profunda', 'Gestión de Calendario'], fr: ['Triage Instantané', 'Recherche Approfondie', 'Gestion de Calendrier'],
      de: ['Sofortige Triage', 'Tiefenrecherche', 'Kalendermanagement'], it: ['Triage Istantaneo', 'Ricerca Approfondita', 'Gestione Calendario'], pt: ['Triagem Instantânea', 'Pesquisa Profunda', 'Gestão de Calendário'], ja: ['即時トリアージ', '詳細調査', 'カレンダー管理']
    },
    tools: ['Outlook', 'Google Calendar', 'LinkedIn Recruiter'],
    description: {
      en: 'Monitors forms and emails, distinguishing leads from spam in 3 seconds. Pre-researches every contact.',
      'en-GB': 'Monitors forms and emails, distinguishing leads from spam in 3 seconds. Pre-researches every contact.',
      es: 'Monitorea formularios y correos, distinguiendo leads de spam en 3 segundos. Pre-investiga cada contacto.',
      fr: 'Surveille les formulaires et emails, distinguant les pistes du spam en 3 secondes. Pré-recherche chaque contact.',
      de: 'Überwacht Formulare und E-Mails, unterscheidet Leads von Spam in 3 Sekunden. Recherchiert jeden Kontakt vor.',
      it: 'Monitora moduli ed e-mail, distinguendo i lead dallo spam in 3 secondi. Pre-ricerca ogni contatto.',
      pt: 'Monitora formulários e e-mails, distinguindo leads de spam em 3 segundos. Pré-pesquisa cada contato.',
      ja: 'フォームとメールを監視し、3秒でリードとスパムを区別します。すべての連絡先を事前に調査します。'
    },
    hourlyRate: 0.62, voiceEnabled: true, voiceId: '', scores: DEFAULT_SCORES, demoVideo: '',
    terminalLogs: {
      en: ["Reading Info@ Email...", "Classifying: HOT LEAD...", "Fetching Company Size...", "Booking Discovery Slot."],
      'en-GB': ["Reading Info@ Email...", "Classifying: HOT LEAD...", "Fetching Company Size...", "Booking Discovery Slot."],
      es: ["Leyendo correo Info@...", "Clasificando: HOT LEAD...", "Obteniendo tamaño de empresa...", "Reservando cita."],
      fr: ["Lecture de l'email Info@...", "Classification: HOT LEAD...", "Récupération taille entreprise...", "Réservation créneau."],
      de: ["Info@-E-Mail lesen...", "Klassifizierung: HOT LEAD...", "Firmengröße abrufen...", "Entdeckungstermin buchen."],
      it: ["Lettura email Info@...", "Classificazione: HOT LEAD...", "Recupero dimensioni azienda...", "Prenotazione slot."],
      pt: ["Lendo e-mail Info@...", "Classificando: HOT LEAD...", "Buscando tamanho da empresa...", "Agendando horário."],
      ja: ["Info@メールを読み込み中...", "分類中: ホットリード...", "企業規模を取得中...", "ディスカバリー枠を予約中。"]
    }
  }
];

export const TRUST_LOGOS = [
  { name: 'Apple', icon: 'https://cdn.worldvectorlogo.com/logos/apple-14.svg' },
  { name: 'HubSpot', icon: 'https://cdn.worldvectorlogo.com/logos/hubspot.svg' },
  { name: 'Slack', icon: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg' },
  { name: 'Gmail', icon: 'https://cdn.worldvectorlogo.com/logos/gmail-icon.svg' },
  { name: 'Salesforce', icon: 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg' },
];
