
export interface Enquiry {
    id: string;
    jobTitle: string;
    primaryDuty: string;
    fullName: string;
    email: string;
    stack: string;
    metric: string;
    departments: string[];
    access: { email: boolean; crm: boolean; db: boolean };
    quote: number;
    status: 'Pending' | 'Ares Review' | 'Reviewing' | 'Technical Audit' | 'Approved' | 'Rejected';
    timestamp: Date;
    generatedAgentId?: string;
}

const STORAGE_KEY = 'pagenti_enquiries';

export const enquiryService = {
    getEnquiries: (): Enquiry[] => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return [];
            return JSON.parse(stored, (key, value) => {
                if (key === 'timestamp') return new Date(value);
                return value;
            });
        } catch (e) {
            console.error('Failed to parse enquiries', e);
            return [];
        }
    },

    addEnquiry: (enquiry: Omit<Enquiry, 'id' | 'timestamp' | 'status'>): Enquiry => {
        const existing = enquiryService.getEnquiries();
        const newEnquiry: Enquiry = {
            ...enquiry,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            status: 'Pending'
        };

        // Add to beginning of list
        const updated = [newEnquiry, ...existing];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Auto-trigger Ares Build Protocol
        enquiryService.initiateAresBuild(newEnquiry.id);

        return newEnquiry;
    },

    updateStatus: (id: string, status: Enquiry['status']) => {
        const existing = enquiryService.getEnquiries();
        const updated = existing.map(e => e.id === id ? { ...e, status } : e);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },

    deleteEnquiry: (id: string) => {
        const existing = enquiryService.getEnquiries();
        const updated = existing.filter(e => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },

    initiateAresBuild: (id: string) => {
        const enquiries = enquiryService.getEnquiries();
        const enquiry = enquiries.find(e => e.id === id);
        if (!enquiry) return;

        // Simulate a delay for "Ares Reasoning"
        setTimeout(() => {
            // Update status to 'Ares Review'
            enquiryService.updateStatus(id, 'Ares Review');

            // Create a generated agent ID (mock)
            const generatedId = `ares-draft-${Math.random().toString(36).substr(2, 5)}`;
            const updated = enquiryService.getEnquiries().map(e =>
                e.id === id ? { ...e, generatedAgentId: generatedId } : e
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

            // In a real app, we'd also trigger agent creation in agentService here
        }, 3000);
    },

    // Seed some dummy data if empty for demo purposes
    seedDemoData: () => {
        if (enquiryService.getEnquiries().length === 0) {
            const demo: Enquiry = {
                id: 'demo-1',
                jobTitle: 'Head of Data Entry',
                primaryDuty: 'Process 500 invoices daily from PDF to Xero',
                fullName: 'Sarah Jenkins',
                email: 'sarah.j@acmecorp.com',
                stack: 'Xero, Outlook, Excel',
                metric: 'Zero errors, <30s processing time',
                departments: ['Finance', 'Operations'],
                access: { email: true, crm: false, db: true },
                quote: 3250, // 2000 setup + 1250 modules
                status: 'Reviewing',
                timestamp: new Date(Date.now() - 86400000 * 2) // 2 days ago
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify([demo]));
        }
    }
};
