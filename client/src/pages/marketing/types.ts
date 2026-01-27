export type EmailQuality = 'A' | 'B' | 'C' | 'D' | 'F';

export interface EmailValidationResult {
    email: string;
    syntaxValid: boolean;
    domainValid: boolean;
    isFreeMail: boolean;
    isRoleBased: boolean;
    isDisposable: boolean;
    deliverabilityScore: number;
    qualityGrade: EmailQuality;
    status: 'valid' | 'invalid' | 'risky';
    explanation: string;
    synced?: boolean;
    logs?: string[];
}

export interface Company {
    companyNumber: string;
    companyName: string;
    companyStatus: 'active' | 'dissolved' | 'liquidation' | 'administration';
    incorporationDate: string;
    registeredAddress: {
        addressLine1: string;
        locality: string;
        postalCode: string;
    };
    sicCodes: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

export interface SocialProfile {
    name: string;
    url: string;
    id: string;
}

export interface Contact {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    companyNumber?: string;
    qualityGrade: EmailQuality;
    deliverabilityScore: number;
    status: 'valid' | 'invalid' | 'risky';
    tags: string[];
    unsubscribed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Campaign {
    id: string;
    name: string;
    status: 'draft' | 'scheduled' | 'sent';
    subject: string;
    sentAt?: string;
    recipientsCount: number;
    openRate: number;
    clickRate: number;
}
