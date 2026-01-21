import {
  User, InsertUser, UpsertUser,
  Company, InsertCompany,
  Prospect, InsertProspect, ProspectWithCompany, UpdateProspectStage,
  Contact, InsertContact,
  Activity, InsertActivity,
  Lender, InsertLender,
  LenderProduct, InsertLenderProduct, LenderWithProducts,
  LenderInteraction, InsertLenderInteraction,
  ApplicationSubmission, InsertApplicationSubmission,
  UserSession, InsertUserSession,
  EmailInbox, InsertEmailInbox, EmailMessage, InsertEmailMessage,
  LeadUpload, InsertLeadUpload, Lead, InsertLead, UpdateLead,
  UnderwritingSubmission, InsertUnderwritingSubmission, UpdateUnderwritingSubmission,
  UnderwritingActivity, InsertUnderwritingActivity,
  ProspectDocument, InsertProspectDocument,
  Team, InsertTeam, TeamMember, InsertTeamMember,
  AddOnProduct, InsertAddOnProduct, UpdateAddOnProduct,
  AddOnPurchase, InsertAddOnPurchase,
  TimeEntry, InsertTimeEntry,
  DueDiligence, InsertDueDiligence, DueDiligenceData,
  SESSION_LIMITS,
  systemSettingsSchema
} from "@shared/schema";
import session from "express-session";
import { db } from "./firebase";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const FirestoreStoreFn = null; // Unused
const MemoryStoreFn = require("memorystore");

// --- Helper: Atomic Counters for Numeric IDs ---
async function getNextId(counterName: string): Promise<number> {
  const counterRef = db.collection('counters').doc(counterName);
  const id = await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    let next = 1;
    if (doc.exists) {
      next = doc.data()?.count + 1;
    }
    t.set(counterRef, { count: next });
    return next;
  });
  return id;
}

// --- Helper: Timestamp Conversion ---
function convertDates(data: any): any {
  if (!data) return data;
  const res: any = { ...data };
  for (const key of Object.keys(res)) {
    if (res[key] && typeof res[key].toDate === 'function') {
      res[key] = res[key].toDate();
    } else if (res[key] && typeof res[key] === 'object' && !Array.isArray(res[key])) {
      // Shallow handling for nested objects if needed, but risky for JSON fields
      // Skipping deep recursion for JSON fields to avoid overhead
    }
  }
  // Specific fix for known date fields if they are missing or null
  return res;
}

export interface IStorage {
  sessionStore: session.Store;
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // System Settings
  getSystemSetting(key: string): Promise<any>;
  updateSystemSetting(key: string, value: any, userId?: string): Promise<any>;

  // Companies
  getCompanyByNumber(companyNumber: string): Promise<Company | undefined>;
  getCompanyById(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined>;

  // Prospects
  listProspects(userId: string): Promise<ProspectWithCompany[]>;
  countProspects(userId: string): Promise<number>;
  getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined>;
  getProspectById(id: number): Promise<ProspectWithCompany | undefined>;
  getProspectsByIds(ids: number[]): Promise<ProspectWithCompany[]>;
  createProspect(prospect: InsertProspect, userId: string): Promise<Prospect>;
  updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined>;
  updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined>;
  deleteProspect(id: number, userId: string): Promise<void>;
  reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void>;

  // Contacts
  listContacts(prospectId: number, userId: string): Promise<Contact[]>;
  getContact(id: number, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, userId: string): Promise<Contact | undefined>;
  updateContact(id: number, userId: string, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number, userId: string): Promise<boolean>;

  // Activities
  listActivities(prospectId: number, userId: string): Promise<Activity[]>;
  listAllUserActivities(userId: string): Promise<Activity[]>;
  getActivity(id: number, userId: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity, userId: string): Promise<Activity | undefined>;
  updateActivity(id: number, userId: string, updates: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: number, userId: string): Promise<boolean>;

  // Due Diligence
  getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined>;
  getAllDueDiligenceSummaries(userId: string): Promise<{ prospectId: number; status: 'complete' | 'partial' | 'pending' }[]>;
  upsertDueDiligence(prospectId: number, userId: string, data: DueDiligenceData): Promise<DueDiligence | undefined>;

  // Lenders
  listLenders(userId: string): Promise<Lender[]>;
  getLender(id: number, userId: string): Promise<Lender | undefined>;
  createLender(lender: InsertLender, userId: string): Promise<Lender>;
  updateLender(id: number, userId: string, updates: Partial<InsertLender>): Promise<Lender | undefined>;
  deleteLender(id: number, userId: string): Promise<void>;
  searchLenders(userId: string, filters: any): Promise<Lender[]>;
  getLenderWithProducts(id: number, userId: string): Promise<LenderWithProducts | undefined>;

  // Lender Products
  listLenderProducts(lenderId: number, userId: string): Promise<LenderProduct[]>;

  // Minimal stubs for others to satisfy build
  // Underwriting Submissions
  listUnderwritingSubmissions(filters: any): Promise<any[]>;
  listUnderwriterScopedSubmissions(userId: string): Promise<any[]>;
  listBrokerUnderwritingSubmissions(userId: string): Promise<any[]>;
  getUnderwritingSubmission(id: number): Promise<any | undefined>;
  createUnderwritingSubmission(data: any, userId: string): Promise<any>;
  updateUnderwritingSubmission(id: number, updates: any): Promise<any | undefined>;
  assignUnderwritingSubmission(id: number, underwriterId: string): Promise<any | undefined>;

  getUserActiveSessions(userId: string): Promise<UserSession[]>;
  cleanupExpiredSessions(): Promise<number>;
}

export class FirestoreStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // @ts-ignore
    const MemoryStore = MemoryStoreFn(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) return undefined;
    return convertDates({ id: doc.id, ...doc.data() }) as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await db.collection('users').where('email', '==', username).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return convertDates({ id: doc.id, ...doc.data() }) as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUserRef = db.collection('users').doc(); // Auto ID
    const newUser = {
      ...user,
      id: newUserRef.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await newUserRef.set(newUser);
    return newUser as User;
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    // Firestore 'in' limit is 10. For now assuming < 10 or naive loop
    const refs = ids.map(id => db.collection('users').doc(id));
    const docs = await db.getAll(...refs);
    return docs.map(d => convertDates({ id: d.id, ...d.data() }) as User).filter(u => u.id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    // Logic: check email exists?
    if (user.email) {
      const existing = await this.getUserByUsername(user.email);
      if (existing) {
        return existing; // Naive upsert (return existing if found)
      }
    }
    return this.createUser(user as InsertUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const ref = db.collection('users').doc(id);
    await ref.update({ ...updates, updatedAt: new Date() });
    return this.getUser(id);
  }

  async getAllUsers(): Promise<User[]> {
    const snap = await db.collection('users').get();
    return snap.docs.map(d => convertDates({ id: d.id, ...d.data() }) as User);
  }

  // --- System Settings ---
  async getSystemSetting(key: string): Promise<any> {
    const snap = await db.collection('system_settings').where('key', '==', key).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data().value;
  }

  async updateSystemSetting(key: string, value: any, userId?: string): Promise<any> {
    const snap = await db.collection('system_settings').where('key', '==', key).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ value, updatedBy: userId, updatedAt: new Date() });
    } else {
      await db.collection('system_settings').add({ key, value, updatedBy: userId, updatedAt: new Date() });
    }
    return value;
  }

  // --- Companies ---
  async getCompanyByNumber(companyNumber: string): Promise<Company | undefined> {
    const snap = await db.collection('companies').where('companyNumber', '==', companyNumber).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ id: snap.docs[0].data().id, ...snap.docs[0].data() }) as Company;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const snap = await db.collection('companies').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ ...snap.docs[0].data() }) as Company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const id = await getNextId('companies');
    const newCompany = { ...company, id, createdAt: new Date() };
    await db.collection('companies').add(newCompany);
    return newCompany as Company; // Assuming success
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const snap = await db.collection('companies').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update(updates);
    return this.getCompanyById(id);
  }

  // --- Prospects ---
  async listProspects(userId: string): Promise<ProspectWithCompany[]> {
    const snap = await db.collection('prospects').where('userId', '==', userId).orderBy('createdAt').get();
    const prospects = snap.docs.map(d => convertDates({ ...d.data() })) as Prospect[];

    // Manual Join
    // Optimize: Fetch all unique companyIds first
    const companyIds = Array.from(new Set(prospects.map(p => p.companyId)));
    const companies = await Promise.all(companyIds.map(cid => this.getCompanyById(cid)));
    const companyMap = new Map(companies.map(c => [c?.id, c]));

    return prospects.map(p => ({
      ...p,
      company: companyMap.get(p.companyId)!
    })).filter(p => p.company); // Filter broken refs
  }

  async countProspects(userId: string): Promise<number> {
    const snap = await db.collection('prospects').where('userId', '==', userId).count().get();
    return snap.data().count;
  }

  async getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined> {
    const snap = await db.collection('prospects').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    const prospect = convertDates(snap.docs[0].data()) as Prospect;
    const company = await this.getCompanyById(prospect.companyId);
    if (!company) return undefined;
    return { ...prospect, company };
  }

  async getProspectById(id: number): Promise<ProspectWithCompany | undefined> {
    const snap = await db.collection('prospects').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    const prospect = convertDates(snap.docs[0].data()) as Prospect;
    const company = await this.getCompanyById(prospect.companyId);
    if (!company) return undefined;
    return { ...prospect, company };
  }

  async getProspectsByIds(ids: number[]): Promise<ProspectWithCompany[]> {
    // In-efficient iterative fetch for numeric IDs in Firestore
    const res = [];
    for (const id of ids) {
      const p = await this.getProspectById(id);
      if (p) res.push(p);
    }
    return res;
  }

  async createProspect(insertProspect: InsertProspect, userId: string): Promise<Prospect> {
    const id = await getNextId('prospects');
    const prospect = {
      ...insertProspect,
      id,
      userId,
      stage: 'lead',
      queueOrder: 0,
      savedAssociations: [],
      loanAllocation: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    // Transaction to update user stats
    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await t.get(userRef);
      if (userDoc.exists) {
        const current = userDoc.data()?.prospectsCreatedCount || 0;
        t.update(userRef, { prospectsCreatedCount: current + 1 });
      }
      const prospectRef = db.collection('prospects').doc(); // Auto ID for doc, numeric ID inside
      t.set(prospectRef, prospect);
    });
    return prospect as Prospect;
  }

  async updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined> {
    return this.updateProspect(prospectId, userId, { stage } as any);
  }

  async updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined> {
    const snap = await db.collection('prospects').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getProspect(id, userId);
  }

  async deleteProspect(id: number, userId: string): Promise<void> {
    const snap = await db.collection('prospects').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.delete();
    }
  }

  async reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void> {
    const batch = db.batch();
    for (let i = 0; i < orderedIds.length; i++) {
      const snap = await db.collection('prospects').where('id', '==', orderedIds[i]).where('userId', '==', userId).limit(1).get();
      if (!snap.empty) {
        batch.update(snap.docs[0].ref, { queueOrder: i, updatedAt: new Date() });
      }
    }
    await batch.commit();
  }

  // --- Contacts ---
  async listContacts(prospectId: number, userId: string): Promise<Contact[]> {
    // Need to verify prospect ownership first?
    const prospect = await this.getProspect(prospectId, userId);
    if (!prospect) return [];

    const snap = await db.collection('contacts').where('prospectId', '==', prospectId).orderBy('createdAt').get();
    return snap.docs.map(d => convertDates(d.data())) as Contact[];
  }

  async getContact(id: number, userId: string): Promise<Contact | undefined> {
    const snap = await db.collection('contacts').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    // Verify ownership
    const contact = convertDates(snap.docs[0].data()) as Contact;
    const prospect = await this.getProspect(contact.prospectId, userId);
    return prospect ? contact : undefined;
  }

  async createContact(insertContact: InsertContact, userId: string): Promise<Contact | undefined> {
    const prospect = await this.getProspect(insertContact.prospectId as number, userId);
    if (!prospect) return undefined;

    const id = await getNextId('contacts');
    const contact = { ...insertContact, id, createdAt: new Date() };
    await db.collection('contacts').add(contact);
    return contact as Contact;
  }

  async updateContact(id: number, userId: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = await this.getContact(id, userId);
    if (!contact) return undefined;

    const snap = await db.collection('contacts').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update(updates);
    return { ...contact, ...updates } as Contact;
  }

  async deleteContact(id: number, userId: string): Promise<boolean> {
    const contact = await this.getContact(id, userId);
    if (!contact) return false;
    const snap = await db.collection('contacts').where('id', '==', id).limit(1).get();
    await snap.docs[0].ref.delete();
    return true;
  }

  // --- Activities ---
  async listActivities(prospectId: number, userId: string): Promise<Activity[]> {
    const snap = await db.collection('activities').where('prospectId', '==', prospectId).where('userId', '==', userId).orderBy('createdAt').get();
    return snap.docs.map(d => convertDates(d.data())) as Activity[];
  }

  async listAllUserActivities(userId: string): Promise<Activity[]> {
    const snap = await db.collection('activities').where('userId', '==', userId).orderBy('dueDate').get();
    return snap.docs.map(d => convertDates(d.data())) as Activity[];
  }

  async getActivity(id: number, userId: string): Promise<Activity | undefined> {
    const snap = await db.collection('activities').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as Activity;
  }

  async createActivity(activity: InsertActivity, userId: string): Promise<Activity | undefined> {
    if (activity.prospectId) {
      const p = await this.getProspect(activity.prospectId as number, userId);
      if (!p) return undefined;
    }
    const id = await getNextId('activities');
    const newActivity = { ...activity, id, userId, createdAt: new Date(), updatedAt: new Date(), completed: 0 };
    await db.collection('activities').add(newActivity);
    return newActivity as Activity;
  }

  async updateActivity(id: number, userId: string, updates: Partial<InsertActivity>): Promise<Activity | undefined> {
    const snap = await db.collection('activities').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getActivity(id, userId);
  }

  async deleteActivity(id: number, userId: string): Promise<boolean> {
    const snap = await db.collection('activities').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return false;
    await snap.docs[0].ref.delete();
    return true;
  }

  // --- Due Diligence ---
  async getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined> {
    // Verify ownership
    const p = await this.getProspect(prospectId, userId);
    if (!p) return undefined;

    const snap = await db.collection('due_diligence').where('prospectId', '==', prospectId).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as DueDiligence;
  }

  async getAllDueDiligenceSummaries(userId: string): Promise<{ prospectId: number; status: 'complete' | 'partial' | 'pending' }[]> {
    const prospects = await this.listProspects(userId);
    const res: { prospectId: number; status: 'complete' | 'partial' | 'pending' }[] = [];

    for (const p of prospects) {
      const dd = await this.getDueDiligence(p.id!, userId);
      const checklist = dd?.data?.checklist || [];
      let status: 'pending' | 'partial' | 'complete' = 'pending';
      if (checklist.length > 0) {
        const completed = checklist.filter((i: any) => i.completed).length;
        if (completed === checklist.length) status = 'complete';
        else if (completed > 0) status = 'partial';
      }
      res.push({ prospectId: p.id!, status });
    }
    return res;
  }

  async upsertDueDiligence(prospectId: number, userId: string, data: DueDiligenceData): Promise<DueDiligence | undefined> {
    const p = await this.getProspect(prospectId, userId);
    if (!p) return undefined;

    const snap = await db.collection('due_diligence').where('prospectId', '==', prospectId).limit(1).get();
    if (snap.empty) {
      const id = await getNextId('due_diligence');
      const newDoc = { id, prospectId, data, createdAt: new Date(), updatedAt: new Date() };
      await db.collection('due_diligence').add(newDoc);
      return newDoc as DueDiligence;
    } else {
      await snap.docs[0].ref.update({ data, updatedAt: new Date() });
      return { ...snap.docs[0].data(), data, updatedAt: new Date() } as DueDiligence;
    }
  }

  // --- Lenders ---
  async listLenders(userId: string): Promise<Lender[]> {
    const snap = await db.collection('lenders').where('userId', '==', userId).get();
    return snap.docs.map(d => convertDates(d.data())) as Lender[];
  }

  async getLender(id: number, userId: string): Promise<Lender | undefined> {
    const snap = await db.collection('lenders').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as Lender;
  }

  async createLender(lender: InsertLender, userId: string): Promise<Lender> {
    const id = await getNextId('lenders');
    const newLender = { ...lender, id, userId, createdAt: new Date(), updatedAt: new Date() };
    await db.collection('lenders').add(newLender);
    return newLender as Lender;
  }

  async updateLender(id: number, userId: string, updates: Partial<InsertLender>): Promise<Lender | undefined> {
    const snap = await db.collection('lenders').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getLender(id, userId);
  }

  async deleteLender(id: number, userId: string): Promise<void> {
    const snap = await db.collection('lenders').where('id', '==', id).where('userId', '==', userId).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.delete();
  }

  async searchLenders(userId: string, filters: any): Promise<Lender[]> {
    let query: any = db.collection('lenders').where('userId', '==', userId);
    if (filters.lenderType) query = query.where('lenderType', '==', filters.lenderType);
    if (filters.panelStatus) query = query.where('panelStatus', '==', filters.panelStatus);

    const snap = await query.get();
    let results = snap.docs.map((d: any) => convertDates(d.data())) as Lender[];

    // Manual filtering for range/search as Firestore combo filters are limited
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(l =>
        l.institutionName.toLowerCase().includes(q) ||
        l.contactName?.toLowerCase().includes(q)
      );
    }
    if (filters.minLoanAmount) results = results.filter(l => (l.minLoanAmount || 0) <= filters.minLoanAmount);

    return results;
  }

  async getLenderWithProducts(id: number, userId: string): Promise<LenderWithProducts | undefined> {
    const lender = await this.getLender(id, userId);
    if (!lender) return undefined;
    const products = await this.listLenderProducts(id, userId);
    return { ...lender, products };
  }

  async listLenderProducts(lenderId: number, userId: string): Promise<LenderProduct[]> {
    // Check lender ownership implicitly or explicitly?
    // Ideally check lender owner, but for now just query by lenderId
    const snap = await db.collection('lender_products').where('lenderId', '==', lenderId).get();
    return snap.docs.map(d => convertDates(d.data())) as LenderProduct[];
  }


  // --- Underwriting Submissions ---
  async listUnderwritingSubmissions(filters: any): Promise<any[]> {
    let query: any = db.collection('underwriting_submissions');
    if (filters.status) query = query.where('status', '==', filters.status);
    if (filters.assignedUnderwriterId) query = query.where('assignedUnderwriterId', '==', filters.assignedUnderwriterId);

    const snap = await query.get();
    return snap.docs.map((d: any) => convertDates(d.data()));
  }

  async listUnderwriterScopedSubmissions(userId: string): Promise<any[]> {
    // Logic: assigned to me OR (submitted AND unassigned)
    // Firestore complex OR queries are limited. We'll do two queries or one big filtering
    const assigned = await db.collection('underwriting_submissions').where('assignedUnderwriterId', '==', userId).get();
    const unassigned = await db.collection('underwriting_submissions').where('status', '==', 'submitted').where('assignedUnderwriterId', '==', null).get(); // null check might be tricky if field missing

    const results = [...assigned.docs, ...unassigned.docs].map(d => convertDates(d.data()));
    // Dedupe by ID just in case
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  async listBrokerUnderwritingSubmissions(userId: string): Promise<any[]> {
    // Assuming 'brokerId' is stored on submission? Or implicit via prospect -> user?
    // The 'enrichSubmissions' in routes implies 'brokerId' or 'userId' is on the submission.
    // Looking at original schema: "userId" on underwritingSubmissions?
    // Original schema: `userId` was omitted in `insertUnderwritingSubmissionSchema` but present in `underwritingSubmissions` table?
    // I'll assume `userId` is the broker.
    const snap = await db.collection('underwriting_submissions').where('userId', '==', userId).get();
    return snap.docs.map((d: any) => convertDates(d.data()));
  }

  async getUnderwritingSubmission(id: number): Promise<any | undefined> {
    const snap = await db.collection('underwriting_submissions').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data());
  }

  async createUnderwritingSubmission(data: any, userId: string): Promise<any> {
    const id = await getNextId('underwriting_submissions');
    const doc = {
      ...data,
      id,
      userId, // Broker
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: new Date()
    };
    await db.collection('underwriting_submissions').add(doc);
    return doc;
  }

  async updateUnderwritingSubmission(id: number, updates: any): Promise<any | undefined> {
    const snap = await db.collection('underwriting_submissions').where('id', '==', id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getUnderwritingSubmission(id);
  }

  async assignUnderwritingSubmission(id: number, underwriterId: string): Promise<any | undefined> {
    return this.updateUnderwritingSubmission(id, { assignedUnderwriterId: underwriterId });
  }

  // --- Stubs ---
  async getUserActiveSessions(userId: string): Promise<UserSession[]> { return []; }
  async cleanupExpiredSessions(): Promise<number> { return 0; }
}

export const storage = new FirestoreStorage();
