import { db, AGENTS_COLLECTION } from "./firebase";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { DigitalAssociate, AssociateStatus } from "../types";
import { CANDIDATES } from "../constants"; // Fallback / Base

const ARES_AGENT: DigitalAssociate = {
  id: "ares-architect",
  name: "Ares",
  role: {
    en: "The Architect",
    "en-GB": "The Architect",
    es: "El Arquitecto",
    fr: "L'Architecte",
    de: "Der Architekt",
    it: "L'Architetto",
    pt: "O Arquiteto",
    ja: "建築家",
  },
  description: {
    en: "Master builder of Digital Associates. Translates messy client briefs into structured deployment blueprints.",
    "en-GB": "Master builder of Digital Associates.",
    es: "",
    fr: "",
    de: "",
    it: "",
    pt: "",
    ja: "",
  },
  hourlyRate: 0,
  avatar:
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400",
  status: AssociateStatus.AVAILABLE,
  department: "Software Engineering",
  expertise: {
    en: ["DNA Synthesis", "Neural Architecture", "Blueprint Logic"],
    "en-GB": ["DNA Synthesis"],
    es: [],
    fr: [],
    de: [],
    it: [],
    pt: [],
    ja: [],
  },
  scores: [
    { subject: "Architectural Integrity", A: 100, fullMark: 100 },
    { subject: "Synthesis Speed", A: 98, fullMark: 100 },
  ],
  voiceEnabled: false,
  languages: ["English", "Python", "JSON"],
  tools: ["Forge Controller", "DNA Synthesizer", "CoT Reasoning Engine"],
  demoVideo: "",
};

const AGENT_STORAGE_KEY = "pagenti_agents";

export const agentService = {
  getAgents: (): DigitalAssociate[] => {
    try {
      // 1. Get static candidates (Base)
      const baseAgents = [...CANDIDATES, ARES_AGENT];

      // 2. Get stored agents (Overrides & Drafts)
      const stored = localStorage.getItem(AGENT_STORAGE_KEY);
      const localAgents: DigitalAssociate[] = stored ? JSON.parse(stored) : [];

      // 3. Merge: Local overrides take precedence over static base if ID matches
      // Also include purely local agents (drafts)
      const merged = [...localAgents];

      // Add base agents that aren't overridden
      baseAgents.forEach((base) => {
        if (!merged.some((m) => m.id === base.id)) {
          merged.push(base);
        }
      });

      return merged;
    } catch (e) {
      console.error("Failed to parse agents", e);
      return [...CANDIDATES];
    }
  },

  getAgentById: (id: string): DigitalAssociate | undefined => {
    return agentService.getAgents().find((a) => a.id === id);
  },

  getAgentByIdAsync: async (id: string): Promise<DigitalAssociate | undefined> => {
    const agents = await agentService.getAllAgents();
    return agents.find((a) => a.id === id);
  },

  saveAgent: async (agent: DigitalAssociate) => {
    // 1. Local Update (Optimistic UI)
    const existing = agentService.getAgents();
    const updated = [agent, ...existing.filter((a) => a.id !== agent.id)];
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(updated));

    // 2. Cloud Update
    if (db) {
      try {
        // Sanitize: Firebase doesn't allow 'undefined' fields
        const sanitize = (obj: any): any => {
          if (Array.isArray(obj)) return obj.map(sanitize);
          if (obj !== null && typeof obj === "object") {
            return Object.fromEntries(
              Object.entries(obj)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, sanitize(v)])
            );
          }
          return obj;
        };

        const cleanAgent = sanitize(agent);
        await setDoc(doc(db, AGENTS_COLLECTION, agent.id), cleanAgent);
        console.log("☁️ Agent saved to cloud:", agent.name);
      } catch (e) {
        console.error("Cloud save failed:", e);
      }
    }
  },

  deleteAgent: async (id: string) => {
    const existing = agentService.getAgents();
    const updated = existing.filter((a) => a.id !== id);
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(updated));

    if (db) {
      try {
        await deleteDoc(doc(db, AGENTS_COLLECTION, id));
        console.log("☁️ Agent deleted from cloud:", id);
      } catch (e) {
        console.error("Cloud delete failed:", e);
      }
    }
  },

  // ASYNC Fetcher for Components
  getAllAgents: async (): Promise<DigitalAssociate[]> => {
    const local = agentService.getAgents(); // Base + Local

    if (!db) return local;

    try {
      const querySnapshot = await getDocs(collection(db, AGENTS_COLLECTION));
      const cloudAgents: DigitalAssociate[] = [];
      querySnapshot.forEach((doc) => {
        cloudAgents.push(doc.data() as DigitalAssociate);
      });

      // Merge: Cloud overrides Base/Local if exists
      const mergedMap = new Map<string, DigitalAssociate>();

      // Seed with local (which includes base)
      local.forEach((a) => mergedMap.set(a.id, a));

      // Override with Cloud
      cloudAgents.forEach((a) => mergedMap.set(a.id, a));

      return Array.from(mergedMap.values());
    } catch (e) {
      console.error("Cloud fetch failed:", e);
      return local;
    }
  },
};
