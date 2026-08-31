/// <reference path="./types.d.ts" />
import { 
  User, InsertUser, UpsertUser, Company, InsertCompany, Prospect, InsertProspect, 
  ProspectWithCompany, InternalLead, InsertInternalLead, BrokerLead, InsertBrokerLead,
  Lender, InsertLender, LenderProduct, InsertLenderProduct, LenderWithProducts,
  LenderInteraction, InsertLenderInteraction, LenderNote, InsertLenderNote,
  ApplicationSubmission, InsertApplicationSubmission, Activity, InsertActivity,
  Contact, InsertContact, EmailTemplate, InsertEmailTemplate, ScrapedLead, InsertScrapedLead,
  MarketingContact, InsertMarketingContact, WaitlistEntry, InsertWaitlistEntry,
  Campaign, InsertCampaign, BrokerCommission, InsertBrokerCommission,
  BrokerScrapedLead, InsertBrokerScrapedLead, BrokerCampaign, InsertBrokerCampaign,
  Invoice, InsertInvoice, Expense, InsertExpense, EmailCampaign, InsertEmailCampaign,
  CampaignRecipient, InsertCampaignRecipient, EditorialPiece, InsertEditorialPiece,
  TimeEntry, InsertTimeEntry,
  ProspectDocument, InsertProspectDocument, Channel, InsertChannel, ChannelMember,
  InsertChannelMember, Message, InsertMessage, CommunicationIntegration,
  InsertCommunicationIntegration, CommunicationTemplate, InsertCommunicationTemplate,
  CommunicationLog, InsertCommunicationLog, Commission, InsertCommission,
  EmailInbox, InsertEmailInbox, EmailMessage, InsertEmailMessage,
  LeadUpload, InsertLeadUpload, Lead, InsertLead, UnderwritingSubmission,
  InsertUnderwritingSubmission, UnderwritingActivity, InsertUnderwritingActivity,
  DueDiligence, InsertDueDiligence, DueDiligenceData, AddOnProduct, InsertAddOnProduct,
  AddOnPurchase, Team, InsertTeam, TeamMember, InsertTeamMember
} from "@shared/schema";
import { DigitalAssociate, MissionDeviation, AgentChatMessage } from "@shared/agents";
import { IStorage } from "./storage";
import { 
  db, users, companies, prospects, internalLeads, systemSettings,
  lenders, brokerLeads, marketingContacts, activities, contacts,
  emailTemplates, scrapedLeads
} from "./db/schema";
import { eq, inArray, and, desc } from "drizzle-orm";
import { applyEditorialPatch } from "@shared/editorial";
import { remapSavedPipelineStages, STAGE_ID_ALIASES } from "@shared/pipelineStages";
import session from "express-session";
import createBetterSqlite3Store from "better-sqlite3-session-store";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const SqliteStore = createBetterSqlite3Store(session);
const sessionDb = new Database("sessions.db");

// Helper: JSON Store for Schema-less Collections
const COLLECTIONS_STORE_PATH = path.resolve(process.cwd(), "uploads", "local_collections_store.json");
const EMAIL_STORE_PATH = path.resolve(process.cwd(), "uploads", "local_email_store.json");

function getStoreData(filePath = COLLECTIONS_STORE_PATH): Record<string, any[]> {
  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({}));
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeStoreData(data: Record<string, any[]>, filePath = COLLECTIONS_STORE_PATH) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getCollection(name: string, filePath = COLLECTIONS_STORE_PATH): any[] {
  const data = getStoreData(filePath);
  return data[name] || [];
}

function setCollection(name: string, list: any[], filePath = COLLECTIONS_STORE_PATH) {
  const data = getStoreData(filePath);
  data[name] = list;
  writeStoreData(data, filePath);
}

function insertItem(collectionName: string, item: any, filePath = COLLECTIONS_STORE_PATH): any {
  const list = getCollection(collectionName, filePath);
  const newItem = {
    ...item,
    id: item.id || (list.length > 0 ? Math.max(...list.map(i => typeof i.id === 'number' ? i.id : 0)) + 1 : 1),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  list.push(newItem);
  setCollection(collectionName, list, filePath);
  return newItem;
}

function updateItem(collectionName: string, id: any, updates: any, filePath = COLLECTIONS_STORE_PATH): any {
  const list = getCollection(collectionName, filePath);
  const idx = list.findIndex(i => i.id === id || String(i.id) === String(id));
  if (idx === -1) return undefined;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  setCollection(collectionName, list, filePath);
  return list[idx];
}

function deleteItem(collectionName: string, id: any, filePath = COLLECTIONS_STORE_PATH): boolean {
  const list = getCollection(collectionName, filePath);
  const filtered = list.filter(i => i.id !== id && String(i.id) !== String(id));
  if (filtered.length === list.length) return false;
  setCollection(collectionName, filtered, filePath);
  return true;
}

function parseJsonField(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function parseUser(user: any): User {
  if (!user) return user;
  return {
    ...user,
    pipelineStageNames: remapSavedPipelineStages(parseJsonField(user.pipelineStageNames)),
    pdfLayoutPreferences: parseJsonField(user.pdfLayoutPreferences),
    onboardingProgress: parseJsonField(user.onboardingProgress),
  };
}

function stringifyUserFields(userData: any): any {
  const formatted = { ...userData };
  if ('pipelineStageNames' in formatted && formatted.pipelineStageNames !== undefined) {
    formatted.pipelineStageNames = formatted.pipelineStageNames !== null && typeof formatted.pipelineStageNames === 'object' ? JSON.stringify(formatted.pipelineStageNames) : formatted.pipelineStageNames;
  }
  if ('pdfLayoutPreferences' in formatted && formatted.pdfLayoutPreferences !== undefined) {
    formatted.pdfLayoutPreferences = formatted.pdfLayoutPreferences !== null && typeof formatted.pdfLayoutPreferences === 'object' ? JSON.stringify(formatted.pdfLayoutPreferences) : formatted.pdfLayoutPreferences;
  }
  if ('onboardingProgress' in formatted && formatted.onboardingProgress !== undefined) {
    formatted.onboardingProgress = formatted.onboardingProgress !== null && typeof formatted.onboardingProgress === 'object' ? JSON.stringify(formatted.onboardingProgress) : formatted.onboardingProgress;
  }
  return formatted;
}

function parseJsonArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      if (val.trim().startsWith('[') && val.trim().endsWith(']')) {
        return [];
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseLender(lender: any): Lender {
  if (!lender) return lender;
  return {
    ...lender,
    productTypes: parseJsonArray(lender.productTypes),
    sectors: parseJsonArray(lender.sectors),
    regions: parseJsonArray(lender.regions),
    securityTypes: parseJsonArray(lender.securityTypes),
    borrowerTypes: parseJsonArray(lender.borrowerTypes),
  };
}

function stringifyLenderFields(lenderData: any): any {
  const formatted = { ...lenderData };
  if ('productTypes' in formatted && formatted.productTypes !== undefined) {
    formatted.productTypes = Array.isArray(formatted.productTypes) ? JSON.stringify(formatted.productTypes) : formatted.productTypes;
  }
  if ('sectors' in formatted && formatted.sectors !== undefined) {
    formatted.sectors = Array.isArray(formatted.sectors) ? JSON.stringify(formatted.sectors) : formatted.sectors;
  }
  if ('regions' in formatted && formatted.regions !== undefined) {
    formatted.regions = Array.isArray(formatted.regions) ? JSON.stringify(formatted.regions) : formatted.regions;
  }
  if ('securityTypes' in formatted && formatted.securityTypes !== undefined) {
    formatted.securityTypes = Array.isArray(formatted.securityTypes) ? JSON.stringify(formatted.securityTypes) : formatted.securityTypes;
  }
  if ('borrowerTypes' in formatted && formatted.borrowerTypes !== undefined) {
    formatted.borrowerTypes = Array.isArray(formatted.borrowerTypes) ? JSON.stringify(formatted.borrowerTypes) : formatted.borrowerTypes;
  }
  return formatted;
}

function parseProspect(prospect: any): any {
  if (!prospect) return prospect;
  return {
    ...prospect,
    loanAllocation: parseJsonField(prospect.loanAllocation),
    savedAssociations: parseJsonField(prospect.savedAssociations),
    loanRequirementData: parseJsonField(prospect.loanRequirementData),
    researchData: parseJsonField(prospect.researchData),
  };
}

export class SQLiteStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new SqliteStore({
      client: sessionDb,
      expired: {
        clear: true,
        intervalMs: 900000 // 15 minutes
      }
    });
    this.migrateLegacyPipelineStages().catch((error) => {
      console.error("[storage] Failed to remap legacy pipeline stages:", error);
    });
  }

  private async migrateLegacyPipelineStages(): Promise<void> {
    for (const [from, to] of Object.entries(STAGE_ID_ALIASES)) {
      await db.update(prospects).set({ stage: to }).where(eq(prospects.stage, from));
    }
  }

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ? parseUser(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username.toLowerCase()));
    return user ? parseUser(user) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.getUserByUsername(email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const formatted = stringifyUserFields(user);
    const newUser = { 
      ...formatted, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    await db.insert(users).values(newUser as any);
    return parseUser(newUser);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const list = await db.select().from(users).where(inArray(users.id, ids));
    return list.map(parseUser);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const existing = await this.getUserByEmail(user.email!);
    const formatted = stringifyUserFields(user);
    if (existing) {
      await db.update(users).set(formatted as any).where(eq(users.id, existing.id));
      return parseUser({ ...existing, ...formatted });
    }
    return this.createUser(user as InsertUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const formatted = stringifyUserFields(updates);
    await db.update(users).set({ ...formatted, updatedAt: new Date() } as any).where(eq(users.id, id));
    return this.getUser(id);
  }

  async getAllUsers(): Promise<User[]> {
    const list = await db.select().from(users);
    return list.map(parseUser);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // --- System Settings ---
  async getSystemSetting(key: string): Promise<any> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting ? JSON.parse(setting.value) : undefined;
  }

  async updateSystemSetting(key: string, value: any, userId?: string): Promise<any> {
    const existing = await this.getSystemSetting(key);
    const valueStr = JSON.stringify(value);
    if (existing !== undefined) {
      await db.update(systemSettings).set({ value: valueStr, updatedBy: userId, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value: valueStr, updatedBy: userId, updatedAt: new Date() });
    }
    return value;
  }

  // --- Companies ---
  async getCompanyByNumber(companyNumber: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.companyNumber, companyNumber));
    return company as Company | undefined;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company as Company | undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values({ ...company, createdAt: new Date() } as any).returning();
    return newCompany as Company;
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    await db.update(companies).set(updates as any).where(eq(companies.id, id));
    return this.getCompanyById(id);
  }

  // --- Prospects ---
  async listProspects(userId: string, status?: string): Promise<ProspectWithCompany[]> {
    let query = db.select().from(prospects).where(eq(prospects.userId, userId));
    if (status) {
      query = db.select().from(prospects).where(and(eq(prospects.userId, userId), eq(prospects.stage, status)));
    }
    const results = await query;
    return Promise.all(results.map(async (p) => {
      const company = await this.getCompanyById(p.companyId);
      return { ...parseProspect(p), company } as ProspectWithCompany;
    }));
  }

  async countProspects(userId: string): Promise<number> {
    const results = await db.select().from(prospects).where(eq(prospects.userId, userId));
    return results.length;
  }

  async getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined> {
    const [prospect] = await db.select().from(prospects).where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
    if (!prospect) return undefined;
    const company = await this.getCompanyById(prospect.companyId);
    return { ...parseProspect(prospect), company } as ProspectWithCompany;
  }

  async getProspectById(id: number): Promise<ProspectWithCompany | undefined> {
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
    if (!prospect) return undefined;
    const company = await this.getCompanyById(prospect.companyId);
    return { ...parseProspect(prospect), company } as ProspectWithCompany;
  }

  async createProspect(prospect: InsertProspect, userId: string): Promise<Prospect> {
    const formatted = { ...prospect };
    if (prospect.loanAllocation) (formatted as any).loanAllocation = JSON.stringify(prospect.loanAllocation);
    if (prospect.savedAssociations) (formatted as any).savedAssociations = JSON.stringify(prospect.savedAssociations);
    if (prospect.loanRequirementData) (formatted as any).loanRequirementData = JSON.stringify(prospect.loanRequirementData);
    if (prospect.researchData) (formatted as any).researchData = JSON.stringify(prospect.researchData);

    const [newProspect] = await db.insert(prospects).values({ 
      ...formatted, 
      userId, 
      createdAt: new Date(), 
      updatedAt: new Date(),
    } as any).returning();
    return parseProspect(newProspect) as Prospect;
  }

  async updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined> {
    await db.update(prospects).set({ stage, updatedAt: new Date() }).where(and(eq(prospects.id, prospectId), eq(prospects.userId, userId)));
    return this.getProspectById(prospectId);
  }

  async updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined> {
    const formatted = { ...updates };
    if (updates.loanAllocation) (formatted as any).loanAllocation = JSON.stringify(updates.loanAllocation);
    if (updates.savedAssociations) (formatted as any).savedAssociations = JSON.stringify(updates.savedAssociations);
    if (updates.loanRequirementData) (formatted as any).loanRequirementData = JSON.stringify(updates.loanRequirementData);
    if (updates.researchData) (formatted as any).researchData = JSON.stringify(updates.researchData);
    
    await db.update(prospects).set({ ...formatted, updatedAt: new Date() } as any).where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
    return this.getProspectById(id);
  }


  async deleteProspect(id: number, userId: string): Promise<void> {
    await db.delete(prospects).where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
  }

  async reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
        await db.update(prospects).set({ queueOrder: i }).where(and(eq(prospects.id, orderedIds[i]), eq(prospects.userId, userId)));
    }
  }

  // --- Internal Leads ---
  async listInternalLeads(): Promise<InternalLead[]> {
    return await db.select().from(internalLeads) as InternalLead[];
  }

  async getInternalLead(id: number): Promise<InternalLead | undefined> {
    const [lead] = await db.select().from(internalLeads).where(eq(internalLeads.id, id));
    return lead as InternalLead | undefined;
  }

  async getInternalLeadByCompanyNumber(companyNumber: string): Promise<InternalLead | undefined> {
    const [lead] = await db.select().from(internalLeads).where(eq(internalLeads.companyNumber, companyNumber));
    return lead as InternalLead | undefined;
  }

  async createInternalLead(lead: InsertInternalLead): Promise<InternalLead> {
    const [newLead] = await db.insert(internalLeads).values({
        ...lead,
        contacts: JSON.stringify(lead.contacts || []),
        createdAt: new Date(),
        updatedAt: new Date()
    } as any).returning();
    return newLead as InternalLead;
  }

  async updateInternalLead(id: number, updates: Partial<InsertInternalLead>): Promise<InternalLead | undefined> {
    const formatted = { ...updates };
    if (updates.contacts) (formatted as any).contacts = JSON.stringify(updates.contacts);
    
    await db.update(internalLeads).set({ ...formatted, updatedAt: new Date() } as any).where(eq(internalLeads.id, id));
    return this.getInternalLead(id);
  }

  async deleteInternalLead(id: number): Promise<void> {
    await db.delete(internalLeads).where(eq(internalLeads.id, id));
  }

  async clearAllInternalLeads(): Promise<void> {
    await db.delete(internalLeads);
  }

  // --- Broker Leads ---
  async listBrokerLeads(): Promise<BrokerLead[]> {
    return await db.select().from(brokerLeads) as unknown as BrokerLead[];
  }

  async getBrokerLead(id: number): Promise<BrokerLead | undefined> {
    const [lead] = await db.select().from(brokerLeads).where(eq(brokerLeads.id, id));
    return lead as unknown as BrokerLead | undefined;
  }

  async getBrokerLeadByCompanyNumber(companyNumber: string): Promise<BrokerLead | undefined> {
    const [lead] = await db.select().from(brokerLeads).where(eq(brokerLeads.companyNumber, companyNumber));
    return lead as unknown as BrokerLead | undefined;
  }

  async createBrokerLead(lead: InsertBrokerLead): Promise<BrokerLead> {
    const [newLead] = await db.insert(brokerLeads).values({
      ...lead,
      contacts: JSON.stringify(lead.contacts || []),
      createdAt: new Date(),
      updatedAt: new Date()
    } as any).returning();
    return newLead as unknown as BrokerLead;
  }

  async updateBrokerLead(id: number, updates: Partial<InsertBrokerLead>): Promise<BrokerLead | undefined> {
    const formatted = { ...updates };
    if (updates.contacts) (formatted as any).contacts = JSON.stringify(updates.contacts);
    await db.update(brokerLeads).set({ ...formatted, updatedAt: new Date() } as any).where(eq(brokerLeads.id, id));
    return this.getBrokerLead(id);
  }

  async deleteBrokerLead(id: number): Promise<void> {
    await db.delete(brokerLeads).where(eq(brokerLeads.id, id));
  }

  async clearAllBrokerLeads(): Promise<void> {
    await db.delete(brokerLeads);
  }

  // --- Marketing Contacts ---
  async listMarketingContacts(userId: string): Promise<MarketingContact[]> {
    return await db.select().from(marketingContacts).where(eq(marketingContacts.userId, userId)) as unknown as MarketingContact[];
  }

  async getMarketingContactByEmail(email: string, userId: string): Promise<MarketingContact | undefined> {
    const [c] = await db.select().from(marketingContacts).where(and(eq(marketingContacts.email, email), eq(marketingContacts.userId, userId)));
    return c as unknown as MarketingContact | undefined;
  }

  async createOrUpdateMarketingContact(contact: InsertMarketingContact, userId: string): Promise<MarketingContact> {
    const existing = await this.getMarketingContactByEmail(contact.email, userId);
    if (existing) {
      await db.update(marketingContacts).set({ ...contact, updatedAt: new Date() } as any).where(eq(marketingContacts.id, existing.id));
      return { ...existing, ...contact } as unknown as MarketingContact;
    }
    const [newC] = await db.insert(marketingContacts).values({ ...contact, userId, createdAt: new Date(), updatedAt: new Date() } as any).returning();
    return newC as unknown as MarketingContact;
  }

  // --- Lenders ---
  async listLenders(filters: any): Promise<Lender[]> {
    const list = await db.select().from(lenders);
    return list.map(parseLender);
  }

  async getLender(id: number): Promise<Lender | undefined> {
    const [l] = await db.select().from(lenders).where(eq(lenders.id, id));
    return l ? parseLender(l) : undefined;
  }

  async getLenderWithProducts(id: number): Promise<LenderWithProducts | undefined> {
    const lender = await this.getLender(id);
    if (!lender) return undefined;
    const products = await this.listLenderProducts(id);
    return { ...lender, products } as unknown as LenderWithProducts;
  }

  async createLender(lenderData: InsertLender, userId: string): Promise<Lender> {
    const formatted = stringifyLenderFields(lenderData);
    const [newLender] = await db.insert(lenders).values({ 
      ...formatted, 
      userId, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    } as any).returning();
    return parseLender(newLender);
  }

  async updateLender(id: number, userId: string, updates: Partial<InsertLender>, isAdmin?: boolean): Promise<Lender | undefined> {
    const formatted = stringifyLenderFields(updates);
    await db.update(lenders).set({ ...formatted, updatedAt: new Date() } as any).where(eq(lenders.id, id));
    return this.getLender(id);
  }

  async adminBulkUpdateLenders(ids: number[], updates: Partial<Lender>): Promise<void> {
    if (ids.length === 0) return;
    const formatted = stringifyLenderFields(updates);
    await db.update(lenders).set({ ...formatted, updatedAt: new Date() } as any).where(inArray(lenders.id, ids));
  }

  async adminBulkDeleteLenders(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(lenders).where(inArray(lenders.id, ids));
  }

  async deleteLender(id: number, userId: string, isAdmin?: boolean): Promise<void> {
    await db.delete(lenders).where(eq(lenders.id, id));
  }

  async adminDeleteLender(id: number): Promise<void> {
    await db.delete(lenders).where(eq(lenders.id, id));
  }

  // --- Activities ---
  async listActivities(prospectId: number, userId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(and(eq(activities.prospectId, prospectId), eq(activities.userId, userId))) as unknown as Activity[];
  }

  async listAllUserActivities(userId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.userId, userId)) as unknown as Activity[];
  }

  async getActivity(id: number, userId: string): Promise<Activity | undefined> {
    const [act] = await db.select().from(activities).where(and(eq(activities.id, id), eq(activities.userId, userId)));
    return act as unknown as Activity | undefined;
  }

  async createActivity(activity: InsertActivity, userId: string): Promise<Activity | undefined> {
    const [newAct] = await db.insert(activities).values({ ...activity, userId, createdAt: new Date(), updatedAt: new Date() } as any).returning();
    return newAct as unknown as Activity;
  }

  async updateActivity(id: number, userId: string, updates: Partial<InsertActivity>): Promise<Activity | undefined> {
    await db.update(activities).set({ ...updates, updatedAt: new Date() } as any).where(and(eq(activities.id, id), eq(activities.userId, userId)));
    return this.getActivity(id, userId);
  }

  async deleteActivity(id: number, userId: string): Promise<boolean> {
    await db.delete(activities).where(and(eq(activities.id, id), eq(activities.userId, userId)));
    return true;
  }

  // --- Contacts ---
  async listContacts(prospectId: number, userId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.prospectId, prospectId)) as unknown as Contact[];
  }

  async getContact(id: number, userId: string): Promise<Contact | undefined> {
    const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
    return c as unknown as Contact | undefined;
  }

  async createContact(contact: InsertContact, userId: string): Promise<Contact | undefined> {
    const [newC] = await db.insert(contacts).values({ ...contact, createdAt: new Date() } as any).returning();
    return newC as unknown as Contact;
  }

  async updateContact(id: number, userId: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    await db.update(contacts).set(updates as any).where(eq(contacts.id, id));
    return this.getContact(id, userId);
  }

  async deleteContact(id: number, userId: string): Promise<boolean> {
    await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  // --- Email Templates ---
  async listEmailTemplates(userId: string): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.userId, userId)) as unknown as EmailTemplate[];
  }

  async getEmailTemplate(id: number, userId: string): Promise<EmailTemplate | undefined> {
    const [t] = await db.select().from(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return t as unknown as EmailTemplate | undefined;
  }

  async createEmailTemplate(template: InsertEmailTemplate, userId: string): Promise<EmailTemplate> {
    const [newT] = await db.insert(emailTemplates).values({ ...template, userId, createdAt: new Date(), updatedAt: new Date() } as any).returning();
    return newT as unknown as EmailTemplate;
  }

  async updateEmailTemplate(id: number, userId: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    await db.update(emailTemplates).set({ ...updates, updatedAt: new Date() } as any).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return this.getEmailTemplate(id, userId);
  }

  async deleteEmailTemplate(id: number, userId: string): Promise<void> {
    await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
  }

  async duplicateEmailTemplate(id: number, userId: string): Promise<EmailTemplate> {
    const original = await this.getEmailTemplate(id, userId);
    if (!original) throw new Error("Template not found");
    return this.createEmailTemplate({
      ...original,
      name: `${original.name} (Copy)`,
    } as any, userId);
  }

  // --- Scraped Leads ---
  async createScrapedLead(lead: InsertScrapedLead): Promise<ScrapedLead> {
    const [newL] = await db.insert(scrapedLeads).values({ ...lead, createdAt: new Date(), updatedAt: new Date() } as any).returning();
    return newL as ScrapedLead;
  }

  async listScrapedLeads(status?: string): Promise<ScrapedLead[]> {
    let query = db.select().from(scrapedLeads);
    if (status) {
      return await query.where(eq(scrapedLeads.status, status)) as ScrapedLead[];
    }
    return await query as ScrapedLead[];
  }

  async getScrapedLead(id: number): Promise<ScrapedLead | undefined> {
    const [l] = await db.select().from(scrapedLeads).where(eq(scrapedLeads.id, id));
    return l as ScrapedLead | undefined;
  }

  async updateScrapedLead(id: number, updates: Partial<InsertScrapedLead>): Promise<ScrapedLead> {
    await db.update(scrapedLeads).set({ ...updates, updatedAt: new Date() } as any).where(eq(scrapedLeads.id, id));
    const updated = await this.getScrapedLead(id);
    if (!updated) throw new Error("Scraped lead not found after update");
    return updated;
  }

  // --- Local Email Storage (backed by JSON file) ---
  async createEmailInbox(data: InsertEmailInbox, userId?: string): Promise<EmailInbox> {
    return insertItem("inboxes", { ...data, userId }, EMAIL_STORE_PATH);
  }

  async getEmailInbox(id: number): Promise<EmailInbox | undefined> {
    const list = getCollection("inboxes", EMAIL_STORE_PATH);
    // Find by numeric ID or by string userId (passed as id)
    return list.find(i => i.id === id || i.userId === String(id)) as EmailInbox | undefined;
  }

  async listEmailMessages(inboxId: number): Promise<EmailMessage[]> {
    return getCollection("messages", EMAIL_STORE_PATH).filter(m => m.inboxId === inboxId || String(m.inboxId) === String(inboxId)) as EmailMessage[];
  }

  async getEmailMessagesByInbox(inboxId: number): Promise<EmailMessage[]> {
    return this.listEmailMessages(inboxId);
  }

  async getEmailMessage(id: number): Promise<EmailMessage | undefined> {
    const list = getCollection("messages", EMAIL_STORE_PATH);
    return list.find(m => m.id === id) as EmailMessage | undefined;
  }

  async getEmailMessageByMessageId(messageId: string): Promise<EmailMessage | undefined> {
    const list = getCollection("messages", EMAIL_STORE_PATH);
    return list.find(m => m.messageId === messageId) as EmailMessage | undefined;
  }

  async createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    return insertItem("messages", message, EMAIL_STORE_PATH);
  }

  async markEmailAsRead(id: number): Promise<void> {
    updateItem("messages", id, { isRead: 1 }, EMAIL_STORE_PATH);
  }

  async updateEmailMessageLink(id: number, prospectId: number | null, contactId: number | null, userId?: string): Promise<void> {
    updateItem("messages", id, { prospectId, contactId }, EMAIL_STORE_PATH);
  }

  async getEmailMessagesForContact(contactId: number, userId?: string): Promise<EmailMessage[]> {
    return getCollection("messages", EMAIL_STORE_PATH).filter(m => m.contactId === contactId) as EmailMessage[];
  }

  async getEmailMessagesForProspect(prospectId: number, userId?: string): Promise<EmailMessage[]> {
    return getCollection("messages", EMAIL_STORE_PATH).filter(m => m.prospectId === prospectId) as EmailMessage[];
  }

  // --- NoSQL Schema-less Helper Backed Collection Methods ---
  async listLeads(userId: string, filters: any): Promise<Lead[]> {
    return getCollection("leads").filter(l => l.userId === userId) as Lead[];
  }

  async createLeadUpload(upload: any, userId?: string): Promise<LeadUpload> {
    return insertItem("lead_uploads", { ...upload, userId }) as LeadUpload;
  }

  async updateLeadUpload(id: number, userId: string, upload: Partial<LeadUpload>): Promise<LeadUpload> {
    return updateItem("lead_uploads", id, upload) as LeadUpload;
  }

  async listLeadUploads(userId: string): Promise<LeadUpload[]> {
    return getCollection("lead_uploads").filter(u => u.userId === userId) as LeadUpload[];
  }

  async getLeadUpload(id: number, userId?: string): Promise<LeadUpload | undefined> {
    return getCollection("lead_uploads").find(u => u.id === id) as LeadUpload | undefined;
  }

  async getLead(id: number, userId?: string): Promise<Lead | undefined> {
    return getCollection("leads").find(l => l.id === id) as Lead | undefined;
  }

  async updateLead(id: number, userId: string, lead: Partial<Lead>): Promise<Lead> {
    const updated = updateItem("leads", id, lead);
    if (!updated) throw new Error("Lead not found");
    return updated as Lead;
  }

  async deleteLead(id: number, userId: string): Promise<boolean> {
    return deleteItem("leads", id);
  }

  async createLeadsBulk(leadsList: InsertLead[], userId?: string): Promise<Lead[]> {
    return leadsList.map(l => insertItem("leads", { ...l, userId }));
  }

  async deleteLeadsByUpload(uploadId: number, userId: string): Promise<boolean> {
    const list = getCollection("leads");
    const filtered = list.filter(l => l.uploadId !== uploadId);
    setCollection("leads", filtered);
    return true;
  }

  async getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined> {
    return getCollection("due_diligence").find(d => d.prospectId === prospectId) as DueDiligence | undefined;
  }

  async getAllDueDiligenceSummaries(userId: string): Promise<any[]> {
    return getCollection("due_diligence");
  }

  async upsertDueDiligence(prospectId: number, userId: string, data: DueDiligenceData): Promise<DueDiligence | undefined> {
    const list = getCollection("due_diligence");
    const existing = list.find(d => d.prospectId === prospectId);

    // Pre-filter rule: a newly-flagged active HMRC Time To Pay arrangement
    // auto-files a risk exception. Self-reported at intake, not a live HMRC lookup.
    const wasActive = existing?.data?.hmrcTimeToPay === "active";
    if (data.hmrcTimeToPay === "active" && !wasActive) {
      await this.createException({
        prospectId,
        source: "due_diligence",
        severity: "high",
        message: "Borrower has an active HMRC Time To Pay arrangement (self-reported)",
      });
    }

    if (existing) {
      return updateItem("due_diligence", existing.id, { data, userId }) as DueDiligence;
    }
    return insertItem("due_diligence", { prospectId, userId, data }) as DueDiligence;
  }

  async listTimeEntries(prospectId: number, userId?: string): Promise<TimeEntry[]> {
    return getCollection("time_entries").filter(t => t.prospectId === prospectId) as TimeEntry[];
  }

  async getProspectTotalTime(prospectId: number, userId?: string): Promise<number> {
    const entries = await this.listTimeEntries(prospectId);
    return entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  }

  async createTimeEntry(entry: InsertTimeEntry, userId?: string): Promise<TimeEntry> {
    return insertItem("time_entries", { ...entry, userId }) as TimeEntry;
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>, userId?: string): Promise<TimeEntry> {
    const updated = updateItem("time_entries", id, entry);
    if (!updated) throw new Error("Time entry not found");
    return updated as TimeEntry;
  }

  async deleteTimeEntry(id: number, userId?: string): Promise<void> {
    deleteItem("time_entries", id);
  }

  async listProspectDocuments(prospectId: number, userId?: string): Promise<ProspectDocument[]> {
    return getCollection("prospect_documents").filter(d => d.prospectId === prospectId) as ProspectDocument[];
  }

  async getProspectDocument(id: number, userId?: string): Promise<ProspectDocument | undefined> {
    return getCollection("prospect_documents").find(d => d.id === id) as ProspectDocument | undefined;
  }

  async createProspectDocument(doc: InsertProspectDocument, userId?: string): Promise<ProspectDocument> {
    return insertItem("prospect_documents", { ...doc, userId }) as ProspectDocument;
  }

  async updateProspectDocument(id: number, updates: Partial<ProspectDocument>, userId?: string): Promise<ProspectDocument | undefined> {
    return updateItem("prospect_documents", id, updates) as ProspectDocument;
  }

  async deleteProspectDocument(id: number, userId?: string): Promise<void> {
    deleteItem("prospect_documents", id);
  }

  async listAddOnProducts(onlyActive?: boolean): Promise<AddOnProduct[]> {
    return getCollection("addon_products") as AddOnProduct[];
  }

  async listUserAddOnPurchases(userId: string): Promise<AddOnPurchase[]> {
    return getCollection("addon_purchases").filter(p => p.userId === userId) as AddOnPurchase[];
  }

  async getUserProspectCredits(userId: string): Promise<number> {
    return 1000; // Unlimited for local CRM
  }

  async createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct> {
    return insertItem("addon_products", product) as AddOnProduct;
  }

  async listLenderInteractions(prospectId: number, userId?: string): Promise<LenderInteraction[]> {
    return getCollection("lender_interactions").filter(i => i.prospectId === prospectId) as LenderInteraction[];
  }

  async listUserLenderInteractions(userId: string): Promise<LenderInteraction[]> {
    return getCollection("lender_interactions");
  }

  async createLenderInteraction(interaction: InsertLenderInteraction, userId?: string): Promise<LenderInteraction> {
    return insertItem("lender_interactions", { ...interaction, userId }) as LenderInteraction;
  }

  async updateLenderInteraction(id: number, interaction: Partial<InsertLenderInteraction>, userId?: string): Promise<LenderInteraction> {
    const updated = updateItem("lender_interactions", id, interaction);
    if (!updated) throw new Error("Interaction not found");
    return updated as LenderInteraction;
  }

  async deleteLenderInteraction(id: number, userId: string): Promise<boolean> {
    return deleteItem("lender_interactions", id);
  }

  async listLenderProducts(lenderId: number): Promise<LenderProduct[]> {
    return getCollection("lender_products").filter(p => p.lenderId === lenderId) as LenderProduct[];
  }

  async createLenderProduct(product: InsertLenderProduct): Promise<LenderProduct> {
    return insertItem("lender_products", product) as LenderProduct;
  }

  async updateLenderProduct(id: number, userId: string, product: Partial<InsertLenderProduct>): Promise<LenderProduct> {
    const updated = updateItem("lender_products", id, product);
    if (!updated) throw new Error("Product not found");
    return updated as LenderProduct;
  }

  async deleteLenderProduct(id: number, userId: string): Promise<boolean> {
    return deleteItem("lender_products", id);
  }

  async listLenderNotes(lenderId: number): Promise<LenderNote[]> {
    return getCollection("lender_notes").filter(n => n.lenderId === lenderId) as LenderNote[];
  }

  async createLenderNote(note: InsertLenderNote): Promise<LenderNote> {
    return insertItem("lender_notes", note) as LenderNote;
  }

  async deleteLenderNote(id: number, userId: string): Promise<boolean> {
    return deleteItem("lender_notes", id);
  }

  async listApplicationSubmissions(prospectId: number, userId?: string): Promise<ApplicationSubmission[]> {
    return getCollection("application_submissions").filter(s => s.prospectId === prospectId) as ApplicationSubmission[];
  }

  async getApplicationSubmission(id: number, userId?: string): Promise<ApplicationSubmission | undefined> {
    return getCollection("application_submissions").find(s => s.id === id) as ApplicationSubmission | undefined;
  }

  async createApplicationSubmission(submission: InsertApplicationSubmission, userId?: string): Promise<ApplicationSubmission> {
    return insertItem("application_submissions", { ...submission, userId }) as ApplicationSubmission;
  }

  async updateApplicationSubmission(id: number, userId: string, submission: Partial<ApplicationSubmission>): Promise<ApplicationSubmission> {
    const updated = updateItem("application_submissions", id, submission);
    if (!updated) throw new Error("Submission not found");
    return updated as ApplicationSubmission;
  }

  async deleteApplicationSubmission(id: number, userId: string): Promise<boolean> {
    return deleteItem("application_submissions", id);
  }

  async listUnderwritingSubmissions(filters: any): Promise<any[]> {
    return getCollection("underwriting_submissions");
  }

  async listUnderwriterScopedSubmissions(userId: string): Promise<any[]> {
    // Queue (submitted + unclaimed) plus whatever this underwriter already holds.
    return getCollection("underwriting_submissions").filter(
      s => s.underwriterId === userId || (s.status === "submitted" && !s.underwriterId)
    );
  }

  async listBrokerUnderwritingSubmissions(userId: string): Promise<any[]> {
    return getCollection("underwriting_submissions").filter(s => s.brokerId === userId);
  }

  async getUnderwritingSubmission(id: number): Promise<any | undefined> {
    return getCollection("underwriting_submissions").find(s => s.id === id);
  }

  async createUnderwritingSubmission(data: any, userId: string): Promise<any> {
    return insertItem("underwriting_submissions", { ...data, brokerId: userId });
  }

  async updateUnderwritingSubmission(id: number, updates: any): Promise<any | undefined> {
    return updateItem("underwriting_submissions", id, updates);
  }

  async assignUnderwritingSubmission(id: number, underwriterId: string): Promise<any | undefined> {
    return updateItem("underwriting_submissions", id, { underwriterId, assignedAt: new Date().toISOString() });
  }

  async getUnderwritingSubmissionByProspect(prospectId: number, userId?: string): Promise<UnderwritingSubmission | undefined> {
    return getCollection("underwriting_submissions").find(s => s.prospectId === prospectId) as UnderwritingSubmission | undefined;
  }

  async claimUnderwritingSubmission(id: number, userId?: string): Promise<UnderwritingSubmission> {
    const updated = updateItem("underwriting_submissions", id, { underwriterId: userId, status: "in_review" });
    if (!updated) throw new Error("Submission not found");
    return updated as UnderwritingSubmission;
  }

  async createUnderwritingActivity(activity: InsertUnderwritingActivity, userId?: string): Promise<UnderwritingActivity> {
    return insertItem("underwriting_activities", { ...activity, userId }) as UnderwritingActivity;
  }

  async listUnderwritingActivities(submissionId: number, userId?: string): Promise<UnderwritingActivity[]> {
    return getCollection("underwriting_activities").filter(a => a.submissionId === submissionId) as UnderwritingActivity[];
  }

  async createBrokerHandoff(data: { submissionId: number; prospectId: number; externalUserId: string; sentByUserId: string; expiresAt: string; status?: string }): Promise<any> {
    return insertItem("broker_handoffs", { status: "awaiting_recommendation", ...data });
  }

  async getBrokerHandoff(id: number): Promise<any | undefined> {
    return getCollection("broker_handoffs").find(h => h.id === id);
  }

  async listBrokerHandoffsForUser(externalUserId: string): Promise<any[]> {
    return getCollection("broker_handoffs").filter(h => h.externalUserId === externalUserId);
  }

  async listAllBrokerHandoffs(): Promise<any[]> {
    return getCollection("broker_handoffs");
  }

  async getBrokerHandoffBySubmission(submissionId: number): Promise<any | undefined> {
    return getCollection("broker_handoffs").find(h => h.submissionId === submissionId);
  }

  async getBrokerHandoffByProspect(prospectId: number): Promise<any | undefined> {
    const matches = getCollection("broker_handoffs").filter((h) => h.prospectId === prospectId);
    return matches.sort((a, b) => Number(b.id) - Number(a.id))[0];
  }

  async updateBrokerHandoff(id: number, updates: Record<string, unknown>): Promise<any | undefined> {
    return updateItem("broker_handoffs", id, updates);
  }

  async createException(data: { prospectId: number; source: "companies_house" | "google_places" | "due_diligence"; severity?: "low" | "medium" | "high"; message: string }): Promise<any> {
    return insertItem("verification_exceptions", { ...data, severity: data.severity || "medium", status: "open" });
  }

  async listExceptionsForProspect(prospectId: number): Promise<any[]> {
    return getCollection("verification_exceptions").filter(e => e.prospectId === prospectId);
  }

  async listOpenExceptions(): Promise<any[]> {
    return getCollection("verification_exceptions").filter(e => e.status === "open");
  }

  async resolveException(id: number): Promise<any | undefined> {
    return updateItem("verification_exceptions", id, { status: "resolved" });
  }

  async listAgenticDeals() {
    return getCollection("agentic_deals").sort((a, b) => Number(b.id) - Number(a.id));
  }

  async getAgenticDeal(id: number) {
    return getCollection("agentic_deals").find((deal) => deal.id === id || String(deal.id) === String(id));
  }

  async getAgenticDealByUploadToken(token: string) {
    const value = String(token || "").trim();
    if (!value) return undefined;
    return getCollection("agentic_deals").find((deal) => deal.uploadToken === value);
  }

  async createAgenticDeal(deal: any) {
    return insertItem("agentic_deals", {
      events: [],
      packDocuments: [],
      ...deal,
      uploadToken: deal.uploadToken || crypto.randomBytes(24).toString("base64url"),
    });
  }

  async updateAgenticDeal(id: number, updates: any) {
    const updated = updateItem("agentic_deals", id, updates);
    if (!updated) throw new Error("Deal file not found");
    return updated;
  }

  async deleteAgenticDeal(id: number): Promise<void> {
    const existing = getCollection("agentic_deals").find((deal) => deal.id === id || String(deal.id) === String(id));
    if (!existing) throw new Error("Deal file not found");
    deleteItem("agentic_deals", existing.id);
  }

  async getTeams(userId?: string): Promise<Team[]> {
    return getCollection("teams") as Team[];
  }

  async createTeam(team: InsertTeam, userId?: string): Promise<Team> {
    return insertItem("teams", { ...team, creatorId: userId }) as Team;
  }

  async getTeamWithMembers(id: number, userId?: string): Promise<Team & { members: TeamMember[] }> {
    const team = getCollection("teams").find(t => t.id === id);
    if (!team) throw new Error("Team not found");
    const members = getCollection("team_members").filter(m => m.teamId === id);
    return { ...team, members };
  }

  async addTeamMember(member: InsertTeamMember, userId?: string): Promise<TeamMember> {
    return insertItem("team_members", member) as TeamMember;
  }

  async removeTeamMember(id: number, userId?: string): Promise<void> {
    deleteItem("team_members", id);
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    return getCollection("teams") as Team[];
  }

  // --- Webhook Keys (implemented using Users table) ---
  async generateWebhookApiKey(userId: string): Promise<{ apiKey: string; hash: string; suffix: string }> {
    const rawKey = "vlt_" + crypto.randomBytes(24).toString("hex");
    const suffix = rawKey.slice(-6);
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    await db.update(users).set({ 
      webhookApiKeyHash: hash, 
      webhookApiKeySuffix: suffix, 
      webhookApiKeyCreatedAt: new Date() 
    } as any).where(eq(users.id, userId));
    return { apiKey: rawKey, hash, suffix };
  }

  async getUserByWebhookApiKeyHash(hash: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.webhookApiKeyHash, hash));
    return user ? parseUser(user) : undefined;
  }

  async updateWebhookApiKeyLastUsed(hash: string): Promise<void> {
    await db.update(users).set({ webhookApiKeyLastUsedAt: new Date() } as any).where(eq(users.webhookApiKeyHash, hash));
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0; // Handled by sessionDb automatically
  }

  async createLenderEnquiry(data: any): Promise<any> {
    return insertItem("lender_enquiries", data);
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    return insertItem("channels", channel) as Channel;
  }

  async getChannel(channelId: number): Promise<Channel | undefined> {
    return getCollection("channels").find(c => c.id === channelId) as Channel | undefined;
  }

  async getChannelsForUser(userId: string): Promise<Channel[]> {
    const members = getCollection("channel_members").filter(m => m.userId === userId);
    const channelIds = members.map(m => m.channelId);
    return getCollection("channels").filter(c => channelIds.includes(c.id)) as Channel[];
  }

  async addChannelMember(member: InsertChannelMember): Promise<void> {
    insertItem("channel_members", member);
  }

  async listChannelMembers(channelId: number): Promise<ChannelMember[]> {
    return getCollection("channel_members").filter(m => m.channelId === channelId) as ChannelMember[];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    return insertItem("messages", message) as Message;
  }

  async getMessages(channelId: number): Promise<Message[]> {
    return getCollection("messages").filter(m => m.channelId === channelId) as Message[];
  }

  async getCommunicationIntegrations(userId: string): Promise<CommunicationIntegration[]> {
    return getCollection("communication_integrations").filter(i => i.userId === userId) as CommunicationIntegration[];
  }

  async saveCommunicationIntegration(integration: InsertCommunicationIntegration): Promise<CommunicationIntegration> {
    const list = getCollection("communication_integrations");
    const existing = list.find(i => i.userId === integration.userId && i.provider === integration.provider);
    if (existing) {
      return updateItem("communication_integrations", existing.id, integration) as CommunicationIntegration;
    }
    return insertItem("communication_integrations", integration) as CommunicationIntegration;
  }

  async getCommunicationTemplates(userId: string): Promise<CommunicationTemplate[]> {
    return getCollection("communication_templates").filter(t => t.userId === userId) as CommunicationTemplate[];
  }

  async createCommunicationTemplate(template: InsertCommunicationTemplate): Promise<CommunicationTemplate> {
    return insertItem("communication_templates", template) as CommunicationTemplate;
  }

  async updateCommunicationTemplate(id: number, template: Partial<InsertCommunicationTemplate>): Promise<CommunicationTemplate> {
    const updated = updateItem("communication_templates", id, template);
    if (!updated) throw new Error("Template not found");
    return updated as CommunicationTemplate;
  }

  async logCommunication(log: InsertCommunicationLog): Promise<CommunicationLog> {
    return insertItem("communication_logs", log) as CommunicationLog;
  }

  async getCommunicationHistory(prospectId: number): Promise<CommunicationLog[]> {
    return getCollection("communication_logs").filter(l => l.prospectId === prospectId) as CommunicationLog[];
  }

  async listCommissions(): Promise<Commission[]> {
    return getCollection("commissions") as Commission[];
  }

  async getAgentCommissions(agentId: string): Promise<Commission[]> {
    return getCollection("commissions").filter(c => c.agentId === agentId) as Commission[];
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    return insertItem("commissions", commission) as Commission;
  }

  async updateCommission(id: number, updates: Partial<InsertCommission>): Promise<Commission | undefined> {
    return updateItem("commissions", id, updates) as Commission;
  }

  async listWaitlistEntries(): Promise<WaitlistEntry[]> {
    return getCollection("waitlist_entries") as WaitlistEntry[];
  }

  async getWaitlistEntryByEmail(email: string): Promise<WaitlistEntry | undefined> {
    return getCollection("waitlist_entries").find(w => w.email === email) as WaitlistEntry | undefined;
  }

  async createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    return insertItem("waitlist_entries", entry) as WaitlistEntry;
  }

  async updateWaitlistEntryStatus(id: number, status: string): Promise<void> {
    updateItem("waitlist_entries", id, { status });
  }

  async unsubscribeWaitlistEntry(email: string): Promise<boolean> {
    const entry = getCollection("waitlist_entries").find(w => w.email === email);
    if (!entry) return false;
    updateItem("waitlist_entries", entry.id, { unsubscribed: true });
    return true;
  }

  async getAgents(): Promise<DigitalAssociate[]> {
    return getCollection("digital_associates") as DigitalAssociate[];
  }

  async getAgentById(id: string): Promise<DigitalAssociate | undefined> {
    return getCollection("digital_associates").find(a => a.id === id) as DigitalAssociate | undefined;
  }

  async updateAgent(id: string, updates: Partial<DigitalAssociate>): Promise<DigitalAssociate> {
    let updated = updateItem("digital_associates", id, updates);
    if (!updated) {
      const newItem = { id, ...updates };
      updated = insertItem("digital_associates", newItem);
    }
    return updated as DigitalAssociate;
  }

  async deleteAgent(id: string): Promise<void> {
    deleteItem("digital_associates", id);
  }

  async logMissionDeviation(deviation: Omit<MissionDeviation, "id">): Promise<MissionDeviation> {
    return insertItem("mission_deviations", deviation) as MissionDeviation;
  }

  async getMissionDeviations(agentId?: string): Promise<MissionDeviation[]> {
    const list = getCollection("mission_deviations");
    if (agentId) return list.filter(d => d.agentId === agentId) as MissionDeviation[];
    return list as MissionDeviation[];
  }

  async saveAgentChatMessage(agentId: string, userId: string, message: Omit<AgentChatMessage, "id">): Promise<AgentChatMessage> {
    return insertItem("agent_chat_messages", { ...message, agentId, userId }) as AgentChatMessage;
  }

  async getAgentChatHistory(agentId: string, userId: string, limit?: number): Promise<AgentChatMessage[]> {
    const history = getCollection("agent_chat_messages").filter(m => m.agentId === agentId && m.userId === userId) as AgentChatMessage[];
    history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return limit ? history.slice(-limit) : history;
  }

  async clearAgentChatHistory(agentId: string, userId: string): Promise<void> {
    const filtered = getCollection("agent_chat_messages").filter(m => m.agentId !== agentId || m.userId !== userId);
    setCollection("agent_chat_messages", filtered);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    return insertItem("campaigns", campaign) as Campaign;
  }

  async listCampaigns(): Promise<Campaign[]> {
    return getCollection("campaigns") as Campaign[];
  }

  async updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign> {
    const updated = updateItem("campaigns", id, updates);
    if (!updated) throw new Error("Campaign not found");
    return updated as Campaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    deleteItem("campaigns", id);
  }

  async listBrokerCommissions(): Promise<BrokerCommission[]> {
    return getCollection("broker_commissions") as BrokerCommission[];
  }

  async getBrokerAgentCommissions(agentId: string): Promise<BrokerCommission[]> {
    return getCollection("broker_commissions").filter(c => c.agentId === agentId) as BrokerCommission[];
  }

  async createBrokerCommission(commission: InsertBrokerCommission): Promise<BrokerCommission> {
    return insertItem("broker_commissions", commission) as BrokerCommission;
  }

  async updateBrokerCommission(id: number, updates: Partial<InsertBrokerCommission>): Promise<BrokerCommission | undefined> {
    return updateItem("broker_commissions", id, updates) as BrokerCommission;
  }

  async createBrokerScrapedLead(lead: InsertBrokerScrapedLead): Promise<BrokerScrapedLead> {
    return insertItem("broker_scraped_leads", lead) as BrokerScrapedLead;
  }

  async listBrokerScrapedLeads(status?: string): Promise<BrokerScrapedLead[]> {
    const list = getCollection("broker_scraped_leads");
    if (status) return list.filter(l => l.status === status) as BrokerScrapedLead[];
    return list as BrokerScrapedLead[];
  }

  async getBrokerScrapedLead(id: number): Promise<BrokerScrapedLead | undefined> {
    return getCollection("broker_scraped_leads").find(l => l.id === id) as BrokerScrapedLead | undefined;
  }

  async updateBrokerScrapedLead(id: number, updates: Partial<InsertBrokerScrapedLead>): Promise<BrokerScrapedLead> {
    const updated = updateItem("broker_scraped_leads", id, updates);
    if (!updated) throw new Error("Broker scraped lead not found");
    return updated as BrokerScrapedLead;
  }

  async createBrokerCampaign(campaign: InsertBrokerCampaign): Promise<BrokerCampaign> {
    return insertItem("broker_campaigns", campaign) as BrokerCampaign;
  }

  async listBrokerCampaigns(): Promise<BrokerCampaign[]> {
    return getCollection("broker_campaigns") as BrokerCampaign[];
  }

  async updateBrokerCampaign(id: number, updates: Partial<BrokerCampaign>): Promise<BrokerCampaign> {
    const updated = updateItem("broker_campaigns", id, updates);
    if (!updated) throw new Error("Broker campaign not found");
    return updated as BrokerCampaign;
  }

  async deleteBrokerCampaign(id: number): Promise<void> {
    deleteItem("broker_campaigns", id);
  }

  async listInvoices(userId: string): Promise<Invoice[]> {
    return getCollection("invoices").filter(i => i.userId === userId) as Invoice[];
  }

  async getInvoice(id: number, userId: string): Promise<Invoice | undefined> {
    return getCollection("invoices").find(i => i.id === id && i.userId === userId) as Invoice | undefined;
  }

  async createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice> {
    return insertItem("invoices", { ...invoice, userId }) as Invoice;
  }

  async updateInvoice(id: number, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    return updateItem("invoices", id, updates) as Invoice;
  }

  async deleteInvoice(id: number, userId: string): Promise<void> {
    deleteItem("invoices", id);
  }

  async getNextInvoiceNumber(userId: string): Promise<string> {
    const invoicesList = await this.listInvoices(userId);
    const count = invoicesList.length + 1;
    return `INV-${String(count).padStart(4, "0")}`;
  }

  async listExpenses(userId: string): Promise<Expense[]> {
    return getCollection("expenses").filter(e => e.userId === userId) as Expense[];
  }

  async getExpense(id: number, userId: string): Promise<Expense | undefined> {
    return getCollection("expenses").find(e => e.id === id && e.userId === userId) as Expense | undefined;
  }

  async createExpense(expense: InsertExpense, userId: string): Promise<Expense> {
    return insertItem("expenses", { ...expense, userId }) as Expense;
  }

  async updateExpense(id: number, userId: string, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    return updateItem("expenses", id, updates) as Expense;
  }

  async deleteExpense(id: number, userId: string): Promise<void> {
    deleteItem("expenses", id);
  }

  async listCampaignRecipients(campaignId: number, userId: string): Promise<CampaignRecipient[]> {
    return getCollection("campaign_recipients").filter(r => r.campaignId === campaignId) as CampaignRecipient[];
  }

  async addCampaignRecipients(recipients: InsertCampaignRecipient[]): Promise<CampaignRecipient[]> {
    return recipients.map(r => insertItem("campaign_recipients", r));
  }

  async getCampaignRecipientById(id: number): Promise<CampaignRecipient | undefined> {
    return getCollection("campaign_recipients").find(r => r.id === id) as CampaignRecipient | undefined;
  }

  async updateCampaignRecipient(id: number, updates: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined> {
    return updateItem("campaign_recipients", id, updates) as CampaignRecipient;
  }

  async clearCampaignRecipients(campaignId: number, userId: string): Promise<void> {
    const filtered = getCollection("campaign_recipients").filter(r => r.campaignId !== campaignId);
    setCollection("campaign_recipients", filtered);
  }

  // --- Email Campaigns ---
  async listEmailCampaigns(userId: string): Promise<EmailCampaign[]> {
    return getCollection("email_campaigns").filter(c => c.userId === userId) as EmailCampaign[];
  }

  async getEmailCampaign(id: number, userId: string): Promise<EmailCampaign | undefined> {
    const list = getCollection("email_campaigns");
    return list.find(c => c.id === id && c.userId === userId) as EmailCampaign | undefined;
  }

  async createEmailCampaign(campaign: InsertEmailCampaign, userId: string): Promise<EmailCampaign> {
    return insertItem("email_campaigns", { ...campaign, userId }) as EmailCampaign;
  }

  async updateEmailCampaign(id: number, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined> {
    const updated = updateItem("email_campaigns", id, updates);
    return updated as EmailCampaign | undefined;
  }

  async deleteEmailCampaign(id: number, userId: string): Promise<void> {
    deleteItem("email_campaigns", id);
  }

  async listEditorialPieces(userId: string): Promise<EditorialPiece[]> {
    return (getCollection("editorial_pieces") as EditorialPiece[])
      .filter((row) => row.userId === userId)
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  }

  async getEditorialPiece(id: number, userId: string): Promise<EditorialPiece | undefined> {
    return (getCollection("editorial_pieces") as EditorialPiece[]).find(
      (row) => row.id === id && row.userId === userId,
    );
  }

  async createEditorialPiece(piece: InsertEditorialPiece, userId: string): Promise<EditorialPiece> {
    return insertItem("editorial_pieces", {
      type: piece.type,
      title: piece.title,
      topic: piece.topic,
      body: "",
      notes: [],
      engine: null,
      status: "draft",
      compliance: "pending",
      autoPublish: false,
      exportedAt: null,
      userId,
    }) as EditorialPiece;
  }

  async updateEditorialPiece(
    id: number,
    userId: string,
    updates: Partial<EditorialPiece>,
  ): Promise<EditorialPiece | undefined> {
    const existing = await this.getEditorialPiece(id, userId);
    if (!existing) return undefined;
    const content = applyEditorialPatch(existing, {
      title: updates.title,
      topic: updates.topic,
      body: updates.body,
    });
    const next = {
      ...content,
      notes: updates.notes ?? content.notes,
      engine: updates.engine === undefined ? content.engine : updates.engine,
      status: updates.status ?? content.status,
      compliance: updates.compliance ?? content.compliance,
      exportedAt: updates.exportedAt === undefined ? content.exportedAt : updates.exportedAt,
      autoPublish: false as const,
    };
    // If title/topic/body changed, applyEditorialPatch already reset status/compliance.
    // Action endpoints pass status/compliance without those fields, so they stick.
    if (updates.title !== undefined || updates.topic !== undefined || updates.body !== undefined) {
      next.status = content.status;
      next.compliance = content.compliance;
    }
    return updateItem("editorial_pieces", id, next) as EditorialPiece;
  }

  async deleteEditorialPiece(id: number, userId: string): Promise<void> {
    const existing = await this.getEditorialPiece(id, userId);
    if (!existing) return;
    deleteItem("editorial_pieces", id);
  }
}
