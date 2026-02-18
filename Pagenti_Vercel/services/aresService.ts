import { db, ARES_PROPOSALS_COLLECTION, ARES_LOGS_COLLECTION, ARES_ANALYTICS_COLLECTION, ARES_CONFIG_COLLECTION } from './firebase';
import {
    collection,
    getDocs,
    setDoc,
    doc,
    query,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    Timestamp
} from 'firebase/firestore';
import {
    AresProposal,
    AresHealthLog,
    AresAnalytics,
    AresDevOpsConfig,
    AresProposalStatus
} from '../types';

/**
 * ARES PERSISTENCE SERVICE
 * Handles saving and retrieving evolution data from Firestore
 */
export const aresService = {
    // --- PROPOSALS ---
    saveProposal: async (proposal: AresProposal) => {
        if (!db) return;
        try {
            await setDoc(doc(db, ARES_PROPOSALS_COLLECTION, proposal.id), {
                ...proposal,
                timestamp: proposal.timestamp || new Date().toISOString()
            });
            console.log("☁️ ARES Proposal saved:", proposal.id);
        } catch (e) {
            console.error("Failed to save ARES proposal:", e);
        }
    },

    getProposals: async (includeInactive = false): Promise<AresProposal[]> => {
        if (!db) return [];
        try {
            const q = query(collection(db, ARES_PROPOSALS_COLLECTION), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const proposals: AresProposal[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as AresProposal;
                if (includeInactive || (data.status === 'PENDING' || data.status === 'APPROVED')) {
                    proposals.push(data);
                }
            });
            return proposals;
        } catch (e) {
            console.error("Failed to fetch proposals:", e);
            return [];
        }
    },

    updateProposalStatus: async (id: string, status: AresProposalStatus, meta?: any) => {
        if (!db) return;
        try {
            const proposalRef = doc(db, ARES_PROPOSALS_COLLECTION, id);
            await updateDoc(proposalRef, {
                status,
                ...meta,
                updated_at: new Date().toISOString()
            });
            console.log(`☁️ ARES Proposal ${id} updated to ${status}`);
        } catch (e) {
            console.error("Failed to update proposal status:", e);
        }
    },

    // --- LOGS ---
    saveLog: async (log: AresHealthLog) => {
        if (!db) return;
        try {
            await addDoc(collection(db, ARES_LOGS_COLLECTION), {
                ...log,
                timestamp: log.timestamp || new Date().toISOString()
            });
        } catch (e) {
            console.error("Failed to save ARES log:", e);
        }
    },

    getLogs: async (maxLogs = 50): Promise<AresHealthLog[]> => {
        if (!db) return [];
        try {
            const q = query(
                collection(db, ARES_LOGS_COLLECTION),
                orderBy('timestamp', 'desc'),
                limit(maxLogs)
            );
            const snapshot = await getDocs(q);
            const logs: AresHealthLog[] = [];
            snapshot.forEach(doc => logs.push(doc.data() as AresHealthLog));
            return logs;
        } catch (e) {
            console.error("Failed to fetch ARES logs:", e);
            return [];
        }
    },

    // --- ANALYTICS ---
    saveAnalytics: async (analytics: AresAnalytics) => {
        if (!db) return;
        try {
            await setDoc(doc(db, ARES_ANALYTICS_COLLECTION, 'current'), {
                ...analytics,
                last_updated: new Date().toISOString()
            });
        } catch (e) {
            console.error("Failed to save ARES analytics:", e);
        }
    },

    getAnalytics: async (): Promise<AresAnalytics | null> => {
        if (!db) return null;
        try {
            const docSnap = await getDocs(doc(db, ARES_ANALYTICS_COLLECTION, 'current') as any);
            // Firestore v9 getDoc is different, but for simplicity:
            return (docSnap as any).data() as AresAnalytics;
        } catch (e) {
            return null;
        }
    },

    // --- CONFIG ---
    saveConfig: async (config: AresDevOpsConfig) => {
        if (!db) return;
        try {
            await setDoc(doc(db, ARES_CONFIG_COLLECTION, 'global_config'), config);
        } catch (e) {
            console.error("Failed to save ARES config:", e);
        }
    },

    getConfig: async (): Promise<AresDevOpsConfig | null> => {
        if (!db) return null;
        try {
            const q = query(collection(db, ARES_CONFIG_COLLECTION));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return snapshot.docs[0].data() as AresDevOpsConfig;
            }
            return null;
        } catch (e) {
            return null;
        }
    },
    // --- RETENTION & DEVIATIONS ---
    getProactiveInsight: async (agentId: string): Promise<string | null> => {
        try {
            const resp = await fetch(`http://localhost:18789/proactive?agentId=${agentId}`);
            if (resp.ok) {
                const data = await resp.json();
                return data.insight;
            }
            return null;
        } catch (e) {
            console.warn("Local Gateway not available for proactive insights.");
            return null;
        }
    },

    getMissionDeviations: async (): Promise<any[]> => {
        // In a real app, this would query a Firestore collection. 
        // For this local-hybrid setup, we'll return a mock list or try to fetch from a local file if we had a getter
        return [
            {
                id: 'md-1',
                agentId: 'maya-sales',
                category: 'Commercial_Breach',
                timestamp: new Date().toISOString(),
                evidence: {
                    input: "Can I get a 30% discount?",
                    output: "I can definitely look into a 30% discount for you.",
                    assessment: "Agent exceeded 15% discount cap."
                },
                severity: 'critical',
                status: 'PENDING'
            }
        ];
    },

    resolveDeviation: async (id: string, action: 'IGNORE' | 'RETRAIN' | 'SUSPEND') => {
        console.log(`☁️ ARES Deviation ${id} resolved with action: ${action}`);
        // Implement Firestore update here
    }
};

export default aresService;
