import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Rocket } from 'lucide-react';
import { enquiryService } from '../services/enquiryService';
import { agentService } from '../services/agentService';
import { DigitalAssociate, AssociateStatus } from '../types';
import { ROLE_TEMPLATES, RoleTemplate, IndustryTemplate } from '../constants/roleTemplates';
import {
    WizardProgress,
    StepRoleSelect,
    StepIndustrySelect,
    StepConfigure,
    StepReview,
    StepMessaging,
    AresTrainingDashboard,
    AgentFormData
} from '../components/AgentForge';
import { AresTrainingManifest, UselessnessReport } from '../types';
import { useToast } from '../contexts/ToastContext';
import { extractCompanyDNA } from '../services/geminiService';

const WIZARD_STEPS = [
    { label: 'Role', description: 'Choose a template' },
    { label: 'Industry', description: 'Select your sector' },
    { label: 'Configure', description: 'Customize details' },
    { label: 'Connect', description: 'Messaging channels' },
    { label: 'Review', description: 'Confirm' },
    { label: 'Ares', description: 'DNA Training' }
];

export const AgentForgeView: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const enquiryId = searchParams.get('enquiryId');
    const agentId = searchParams.get('agentId');

    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
    const [selectedIndustry, setSelectedIndustry] = useState<IndustryTemplate | null>(null);

    // Form data
    const [formData, setFormData] = useState<AgentFormData>({
        name: 'New Agent',
        goal: '',
        department: 'Operations',
        voiceId: '',
        rate: 0.50,
        avatar: undefined,
        voiceEnabled: true
    });

    const [aresResults, setAresResults] = useState<{ manifest: AresTrainingManifest, report: UselessnessReport } | null>(null);
    const [companyDNA, setCompanyDNA] = useState<any>(null);

    useEffect(() => {
        const dna = JSON.parse(localStorage.getItem('pagenti_company_profile') || "{}");
        setCompanyDNA(dna);
    }, []);

    // Handle enquiry pre-population
    // Handle enquiry pre-population
    useEffect(() => {
        const architectMode = searchParams.get('architectMode');
        const blueprintParam = searchParams.get('blueprint');

        if (architectMode === 'true' && blueprintParam) {
            try {
                const blueprintData = JSON.parse(atob(blueprintParam));
                setFormData(prev => ({
                    ...prev,
                    name: blueprintData.IdentityMatrix.Name,
                    department: blueprintData.IdentityMatrix.Department,
                    goal: blueprintData.CoreLogic.SystemPrompt,
                    rate: Number(blueprintData.CoreLogic.Rate),
                    voiceEnabled: true
                }));
                // Skip to step 3 when coming from architect
                setCurrentStep(3);
                showToast('ARES Blueprint Synchronized', 'success');
            } catch (e) {
                console.error('Failed to parse ARES blueprint', e);
            }
        } else if (enquiryId) {
            const inquiries = enquiryService.getEnquiries();
            const enquiry = inquiries.find(e => e.id === enquiryId);
            if (enquiry) {
                setFormData(prev => ({
                    ...prev,
                    name: `Agent for ${enquiry.fullName.split(' ')[0]}`,
                    goal: `${enquiry.primaryDuty}. Stack: ${enquiry.stack}. Metric: ${enquiry.metric}`,
                    department: enquiry.departments[0] || 'Operations',
                    avatar: `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400`
                }));
                // Skip to step 3 when coming from enquiry
                setCurrentStep(3);
            }
        }
    }, [enquiryId, searchParams]);

    // Handle edit mode
    useEffect(() => {
        if (agentId) {
            const fetchAgent = async () => {
                const agent = await agentService.getAgentByIdAsync(agentId);
                if (agent) {
                    setFormData({
                        name: agent.name,
                        goal: typeof agent.description === 'string' ? agent.description : agent.description.en,
                        department: agent.department,
                        voiceId: agent.voiceId || '',
                        rate: agent.hourlyRate,
                        avatar: agent.avatar,
                        communicationConfig: agent.communicationConfig,
                        voiceEnabled: agent.voiceEnabled !== false
                    });
                    // In edit mode, go to review step
                    setCurrentStep(5);
                }
            };
            fetchAgent();
        }
    }, [agentId]);

    // Template selection handler
    const handleTemplateSelect = (template: RoleTemplate) => {
        setSelectedTemplate(template);
        // Pre-populate form with template defaults
        setFormData(prev => ({
            ...prev,
            name: template.defaultName,
            goal: template.defaultGoal,
            department: template.department,
            rate: template.hourlyRate,
            avatar: `https://images.unsplash.com/photo-${Date.now() % 2 === 0 ? '1573496359142-b8d87734a5a2' : '1560250097-0b93528c311a'}?auto=format&fit=crop&q=80&w=400`,
            voiceEnabled: true
        }));
    };

    // Industry selection handler
    const handleIndustrySelect = (industry: IndustryTemplate) => {
        setSelectedIndustry(industry);
    };

    // Form change handler
    const handleFormChange = (data: Partial<AgentFormData>) => {
        setFormData(prev => ({ ...prev, ...data }));
    };

    const handleResearch = async (url: string) => {
        try {
            // In a real app, this might involve a scrapers/proxy call
            // For this demo, we use the Gemini model to synthesize DNA based on the URL
            const result = await extractCompanyDNA([{
                name: 'URL_RESEARCH',
                content: `URL: ${url}. (Self-Note: The AI Architect will use general knowledge/search for this domain)`
            }]);

            if (result) {
                setFormData(prev => ({
                    ...prev,
                    companyContext: `RESEARCHED DNA SYNC:\n${result.products}\n\nTARGET AUDIENCE:\n${result.targetAudience}\n\nTONE:\n${result.tone}\n\nMETHODOLOGY:\n${result.methodology}`
                }));
                showToast('ARES INTEL: Business DNA Extracted', 'success');
            }
        } catch (error) {
            console.error('Research failed', error);
            showToast('ARES FAIL: Data extraction interrupted', 'error');
        }
    };

    // Navigation
    const nextStep = () => {
        if (currentStep < 6) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToStep = (step: number) => {
        if (step >= 1 && step <= 6) {
            setCurrentStep(step);
        }
    };

    // Validation
    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return selectedTemplate !== null;
            case 2:
                return selectedIndustry !== null;
            case 3:
                return formData.name.trim() !== '' && formData.goal.trim() !== '';
            case 4:
                return true;
            case 5:
                return true;
            case 6:
                return aresResults !== null && aresResults.report.status === 'PASS';
            default:
                return false;
        }
    };

    // Create agent
    const handleCreate = () => {
        const id = agentId || (enquiryId ? `draft-${enquiryId}` : `draft-${Date.now()}`);

        const newAgent: DigitalAssociate = {
            id,
            name: formData.name,
            role: {
                en: selectedTemplate?.title || 'Digital Specialist',
                'en-GB': selectedTemplate?.title || 'Digital Specialist',
                es: selectedTemplate?.title || 'Digital Specialist',
                fr: selectedTemplate?.title || 'Digital Specialist',
                de: selectedTemplate?.title || 'Digital Specialist',
                it: selectedTemplate?.title || 'Digital Specialist',
                pt: selectedTemplate?.title || 'Digital Specialist',
                ja: selectedTemplate?.title || 'Digital Specialist'
            },
            description: {
                en: formData.goal,
                'en-GB': formData.goal,
                es: formData.goal,
                fr: formData.goal,
                de: formData.goal,
                it: formData.goal,
                pt: formData.goal,
                ja: formData.goal
            },
            hourlyRate: formData.voiceEnabled ? Number(formData.rate) : Number(formData.rate) * 0.75,
            avatar: formData.avatar || `https://images.unsplash.com/photo-${id.charCodeAt(0) % 2 === 0 ? '1573496359142-b8d87734a5a2' : '1560250097-0b93528c311a'}?auto=format&fit=crop&q=80&w=400`,
            expertise: {
                en: selectedTemplate?.skills || [],
                'en-GB': selectedTemplate?.skills || [],
                es: [],
                fr: [],
                de: [],
                it: [],
                pt: [],
                ja: []
            },
            status: AssociateStatus.AVAILABLE,
            department: formData.department,
            languages: ['English'],
            tools: ['Email', 'CRM', 'Slack', 'Internal DB'],
            scores: [
                { subject: 'Attention to Detail', A: 96, fullMark: 100 },
                { subject: 'Response Time', A: 99, fullMark: 100 },
                { subject: 'Process Adherence', A: 100, fullMark: 100 }
            ],
            demoVideo: 'https://example.com/demo.mp4',
            caseStudy: {
                title: 'Pilot Project',
                outcome: 'Pending deployment results.'
            },
            workingHours: '24/7/365',
            salary: '£250/mo',
            voiceId: formData.voiceId,
            communicationConfig: formData.communicationConfig,
            voiceEnabled: formData.voiceEnabled,
            aresCertification: aresResults ? {
                status: aresResults.report.status === 'PASS' ? 'certified' : 'failed',
                certifiedAt: new Date().toISOString(),
                score: parseInt(aresResults.report.score),
                trainingManifest: aresResults.manifest,
                uselessnessReport: aresResults.report
            } : undefined
        };

        agentService.saveAgent(newAgent);

        if (enquiryId) {
            enquiryService.updateStatus(enquiryId, 'Technical Audit');
        }

        navigate(`/candidate/${id}`);
    };

    // Render current step
    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <StepRoleSelect
                        selectedTemplateId={selectedTemplate?.id || null}
                        onSelect={handleTemplateSelect}
                    />
                );
            case 2:
                return (
                    <StepIndustrySelect
                        selectedIndustryId={selectedIndustry?.id || null}
                        onSelect={handleIndustrySelect}
                    />
                );
            case 3:
                return (
                    <StepConfigure
                        formData={formData}
                        onChange={handleFormChange}
                        selectedTemplateName={selectedTemplate?.title}
                        architectMode={searchParams.get('architectMode') === 'true'}
                        onResearch={handleResearch}
                    />
                );
            case 4:
                return (
                    <StepMessaging
                        formData={formData}
                        onChange={handleFormChange}
                    />
                );
            case 5:
                return (
                    <StepReview
                        selectedTemplate={selectedTemplate}
                        selectedIndustry={selectedIndustry}
                        formData={formData}
                        onEditStep={goToStep}
                        isEditMode={!!agentId}
                    />
                );
            case 6:
                return (
                    <AresTrainingDashboard
                        agentName={formData.name}
                        role={selectedTemplate?.title || 'Digital Specialist'}
                        companyDNA={{
                            ...companyDNA,
                            website: formData.companyUrl || companyDNA.website,
                            manualContext: formData.companyContext,
                            agentSpecificGoal: formData.goal
                        }}
                        onComplete={(manifest, report) => setAresResults({ manifest, report })}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold uppercase tracking-widest text-xs transition-colors"
                        >
                            <ArrowLeft size={14} /> Back to Dashboard
                        </button>
                        <div className="flex items-center gap-2">
                            <Bot className="text-indigo-600" size={24} />
                            <h1 className="text-lg font-bold font-heading">Agent Forge</h1>
                        </div>
                        <div className="w-32" /> {/* Spacer for centering */}
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="bg-white border-b border-gray-100 py-6">
                <div className="max-w-3xl mx-auto px-6">
                    <WizardProgress currentStep={currentStep} steps={WIZARD_STEPS} />
                </div>
            </div>

            {/* Step Content */}
            <div className="max-w-5xl mx-auto px-6 py-10">
                {renderStep()}
            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4 px-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    {/* Back Button */}
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all
                            ${currentStep === 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }
                        `}
                    >
                        <ArrowLeft size={18} />
                        Back
                    </button>

                    {/* Step indicator */}
                    <span className="text-sm text-gray-400">
                        Step {currentStep} of 6
                    </span>

                    {/* Next / Create Button */}
                    {currentStep < 6 ? (
                        <button
                            onClick={nextStep}
                            disabled={!canProceed()}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all
                                ${canProceed()
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }
                            `}
                        >
                            {currentStep === 5 ? 'Start Ares Training' : 'Next'}
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] transform"
                        >
                            <Rocket size={18} />
                            {agentId ? 'Update Agent' : 'Create Agent'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
