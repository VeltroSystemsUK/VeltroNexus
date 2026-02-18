import { UserRegistration } from '../types';

const REGISTRATIONS_KEY = 'pagenti_registrations';

export const userService = {
    getRegistrations: (): UserRegistration[] => {
        try {
            const stored = localStorage.getItem(REGISTRATIONS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to parse registrations', e);
            return [];
        }
    },

    addRegistration: (reg: Omit<UserRegistration, 'id' | 'status' | 'timestamp'>) => {
        const existing = userService.getRegistrations();
        const newReg: UserRegistration = {
            ...reg,
            id: `reg-${Math.random().toString(36).substr(2, 9)}`,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        const updated = [newReg, ...existing];
        localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(updated));
        return newReg;
    },

    updateRegistrationStatus: (id: string, status: UserRegistration['status']) => {
        const existing = userService.getRegistrations();
        const updated = existing.map(r => r.id === id ? { ...r, status } : r);
        localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(updated));
    },

    deleteRegistration: (id: string) => {
        const existing = userService.getRegistrations();
        const updated = existing.filter(r => r.id !== id);
        localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(updated));
    },

    seedDemoData: () => {
        if (userService.getRegistrations().length === 0) {
            const demoRequests: UserRegistration[] = [
                {
                    id: 'reg-demo-1',
                    name: 'Marcus Aurelius',
                    company: 'Roman Empire Inc',
                    email: 'marcus@paxromana.com',
                    status: 'pending',
                    reason: 'Looking for digital associates to automate legion logistics.',
                    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
                },
                {
                    id: 'reg-demo-2',
                    name: 'Ada Lovelace',
                    company: 'Analytical Engines',
                    email: 'ada@computing.org',
                    status: 'approved',
                    reason: 'Synthesizing poetic science agents.',
                    timestamp: new Date(Date.now() - 86400000).toISOString()
                }
            ];
            localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(demoRequests));
        }
    }
};
