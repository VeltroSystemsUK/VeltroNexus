import { Headphones, TrendingUp, Database, Calendar, Briefcase, PoundSterling, Users, Sparkles } from 'lucide-react';

export interface RoleTemplate {
    id: string;
    icon: any; // lucide icon component
    title: string;
    description: string;
    defaultName: string;
    defaultGoal: string;
    department: string;
    skills: string[];
    hourlyRate: number;
}

export interface IndustryTemplate {
    id: string;
    title: string;
    description: string;
    toneGuidance: string;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
    {
        id: 'customer-support',
        icon: Headphones,
        title: 'Customer Support Agent',
        description: 'Handle inquiries, resolve issues, and provide 24/7 customer assistance.',
        defaultName: 'Support Agent',
        defaultGoal: 'Respond to customer inquiries quickly and helpfully, resolve common issues, and escalate complex problems to human agents.',
        department: 'Customer Support',
        skills: ['Customer Service', 'Issue Resolution', 'FAQ Handling', 'Ticket Management'],
        hourlyRate: 0.65
    },
    {
        id: 'sales-dev',
        icon: TrendingUp,
        title: 'Sales Development Rep',
        description: 'Qualify leads, schedule demos, and nurture prospects through the pipeline.',
        defaultName: 'Sales Agent',
        defaultGoal: 'Qualify inbound leads, book discovery calls, and follow up with prospects to move them through the sales pipeline.',
        department: 'Sales & Growth',
        skills: ['Lead Qualification', 'Outreach', 'CRM Management', 'Demo Scheduling'],
        hourlyRate: 0.85
    },
    {
        id: 'data-entry',
        icon: Database,
        title: 'Data Entry Specialist',
        description: 'Process forms, extract data, and maintain database accuracy.',
        defaultName: 'Data Agent',
        defaultGoal: 'Accurately process incoming forms, extract key information, and update databases with minimal errors.',
        department: 'Operations & Finance',
        skills: ['Data Processing', 'Form Handling', 'Database Management', 'Quality Control'],
        hourlyRate: 0.55
    },
    {
        id: 'scheduling',
        icon: Calendar,
        title: 'Scheduling Coordinator',
        description: 'Manage calendars, book appointments, and coordinate meetings.',
        defaultName: 'Scheduler',
        defaultGoal: 'Efficiently manage appointment scheduling, handle calendar conflicts, and send reminders to all participants.',
        department: 'Operations & Finance',
        skills: ['Calendar Management', 'Appointment Booking', 'Reminders', 'Conflict Resolution'],
        hourlyRate: 0.60
    },
    {
        id: 'executive-assistant',
        icon: Briefcase,
        title: 'Executive Assistant',
        description: 'Support executives with email triage, scheduling, and task management.',
        defaultName: 'EA Agent',
        defaultGoal: 'Triage emails, manage executive calendars, prepare briefings, and handle administrative tasks efficiently.',
        department: 'Operations & Finance',
        skills: ['Email Management', 'Executive Support', 'Travel Coordination', 'Meeting Prep'],
        hourlyRate: 1.10
    },
    {
        id: 'finance-processor',
        icon: PoundSterling,
        title: 'Finance Processor',
        description: 'Process invoices, reconcile accounts, and handle financial documentation.',
        defaultName: 'Finance Agent',
        defaultGoal: 'Process invoices accurately, reconcile transactions, and maintain financial records with full audit trails.',
        department: 'Operations & Finance',
        skills: ['Invoice Processing', 'Reconciliation', 'Financial Reporting', 'Compliance'],
        hourlyRate: 0.95
    },
    {
        id: 'hr-coordinator',
        icon: Users,
        title: 'HR Coordinator',
        description: 'Screen applications, schedule interviews, and manage onboarding tasks.',
        defaultName: 'HR Agent',
        defaultGoal: 'Screen candidate applications, coordinate interview scheduling, and guide new hires through onboarding.',
        department: 'Operations & Finance',
        skills: ['Candidate Screening', 'Interview Scheduling', 'Onboarding', 'Policy Guidance'],
        hourlyRate: 0.75
    },
    {
        id: 'custom',
        icon: Sparkles,
        title: 'Custom Agent',
        description: 'Start from scratch and build a completely custom agent.',
        defaultName: 'Custom Agent',
        defaultGoal: '',
        department: 'Operations',
        skills: [],
        hourlyRate: 0.50
    }
];

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
    {
        id: 'finance',
        title: 'Finance & Banking',
        description: 'Financial services, investment, insurance',
        toneGuidance: 'Professional, precise, compliant'
    },
    {
        id: 'healthcare',
        title: 'Healthcare & Medical',
        description: 'Hospitals, clinics, medical practices',
        toneGuidance: 'Empathetic, clear, HIPAA-aware'
    },
    {
        id: 'retail',
        title: 'Retail & E-commerce',
        description: 'Online stores, retail chains, marketplaces',
        toneGuidance: 'Friendly, helpful, sales-focused'
    },
    {
        id: 'professional-services',
        title: 'Professional Services',
        description: 'Consulting, accounting, legal support',
        toneGuidance: 'Expert, thorough, client-focused'
    },
    {
        id: 'tech',
        title: 'Technology & Software',
        description: 'SaaS, IT services, startups',
        toneGuidance: 'Technical, innovative, efficient'
    },
    {
        id: 'real-estate',
        title: 'Real Estate',
        description: 'Property management, agents, development',
        toneGuidance: 'Knowledgeable, responsive, personable'
    },
    {
        id: 'legal',
        title: 'Legal Services',
        description: 'Law firms, legal departments, compliance',
        toneGuidance: 'Precise, confidential, professional'
    },
    {
        id: 'hospitality',
        title: 'Hospitality & Travel',
        description: 'Hotels, restaurants, travel agencies',
        toneGuidance: 'Warm, accommodating, service-oriented'
    },
    {
        id: 'other',
        title: 'Other Industry',
        description: 'General purpose, flexible configuration',
        toneGuidance: 'Adaptable, professional'
    }
];
