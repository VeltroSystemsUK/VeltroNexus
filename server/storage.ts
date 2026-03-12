import {
  User,
  InsertUser,
  UpsertUser,
  Company,
  InsertCompany,
  Prospect,
  InsertProspect,
  ProspectWithCompany,
  UpdateProspectStage,
  Contact,
  InsertContact,
  Activity,
  InsertActivity,
  Lender,
  InsertLender,
  LenderProduct,
  InsertLenderProduct,
  LenderWithProducts,
  LenderInteraction,
  InsertLenderInteraction,
  ApplicationSubmission,
  InsertApplicationSubmission,
  UserSession,
  InsertUserSession,
  EmailInbox,
  InsertEmailInbox,
  EmailMessage,
  InsertEmailMessage,
  LeadUpload,
  InsertLeadUpload,
  Lead,
  InsertLead,
  UpdateLead,
  UnderwritingSubmission,
  InsertUnderwritingSubmission,
  UpdateUnderwritingSubmission,
  UnderwritingActivity,
  InsertUnderwritingActivity,
  ProspectDocument,
  InsertProspectDocument,
  Team,
  InsertTeam,
  TeamMember,
  InsertTeamMember,
  AddOnProduct,
  InsertAddOnProduct,
  UpdateAddOnProduct,
  AddOnPurchase,
  InsertAddOnPurchase,
  TimeEntry,
  InsertTimeEntry,
  DueDiligence,
  InsertDueDiligence,
  DueDiligenceData,
  Channel,
  InsertChannel,
  ChannelMember,
  InsertChannelMember,
  Message,
  InsertMessage,
  CommunicationIntegration,
  InsertCommunicationIntegration,
  CommunicationTemplate,
  InsertCommunicationTemplate,
  CommunicationLog,
  InsertCommunicationLog,
  LenderNote,
  InsertLenderNote,
  InternalLead,
  InsertInternalLead,
  Commission,
  InsertCommission,
  MarketingContact,
  InsertMarketingContact,
  SESSION_LIMITS,
  systemSettingsSchema,
  ScrapedLead,
  InsertScrapedLead,
  Campaign,
  InsertCampaign,
  BrokerLead,
  InsertBrokerLead,
  BrokerCommission,
  InsertBrokerCommission,
  BrokerCampaign,
  InsertBrokerCampaign,
  BrokerScrapedLead,
  InsertBrokerScrapedLead,
  Invoice,
  InsertInvoice,
  Expense,
  InsertExpense,
  EmailTemplate,
  InsertEmailTemplate,
  EmailCampaign,
  InsertEmailCampaign,
  CampaignRecipient,
  InsertCampaignRecipient,
  WaitlistEntry,
  InsertWaitlistEntry,
} from "@shared/schema";
import { DigitalAssociate, AgentSession, MissionDeviation, AgentChatMessage } from "@shared/agents";
import type * as ExpressSession from "express-session";
import { db } from "./firebase";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const session = require("express-session");

// --- Helper: Atomic Counters for Numeric IDs ---
async function getNextId(counterName: string): Promise<number> {
  const counterRef = db.collection("counters").doc(counterName);
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
    if (res[key] && typeof res[key].toDate === "function") {
      res[key] = res[key].toDate();
    } else if (res[key] && typeof res[key] === "object" && !Array.isArray(res[key])) {
      // Shallow handling for nested objects if needed, but risky for JSON fields
      // Skipping deep recursion for JSON fields to avoid overhead
    }
  }
  // Specific fix for known date fields if they are missing or null
  return res;
}

// DEV ADMIN MOCK USER
export const MOCK_DEV_ADMIN_ID = "dev-admin-id";
const MOCK_DEV_ADMIN: User = {
  id: MOCK_DEV_ADMIN_ID,
  email: "admin@veltro.com",
  role: "super_admin",
  password: "mock-hash-ignored",
  firstName: "Dev",
  lastName: "Admin",
  subscriptionTier: "lender",
  prospectLimit: 1000000,
  hasUnderwritingAccess: 1,
  onboardingEnabled: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  suspended: false,
  // Required fields from schema
  brandingLogoUrl: null,
  brandingPrimaryColor: null,
  brandingAccentColor: null,
  brandingBackgroundColor: null,
  brandingSidebarColor: null,
  gocardlessCustomerId: null,
  gocardlessMandateId: null,
  gocardlessSubscriptionId: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  trialEndsAt: null,
  trialTier: null,
  currency: "GBP",
  timezone: "Europe/London",
  dateFormat: "DD/MM/YYYY",
  theme: "light",
  webhookApiKeyHash: null,
  webhookApiKeySuffix: null,
  webhookApiKeyCreatedAt: null,
  webhookApiKeyLastUsedAt: null,
  aiDataConsent: 0,
  aiDataConsentAt: null,
  prospectsCreatedCount: 0,
  googleConnected: false,
  googleEmail: null,
  googleAccessToken: null,
  googleRefreshToken: null,
  googleTokenExpiry: null,
  onboardingProgress: null,
  lastLoginAt: new Date(),
  lastLogoutAt: null,
  underwritingAccessExpiresAt: null,
  pipelineStageNames: null,
  pdfLayoutPreferences: null,
  profileImageUrl: null,
};

// Mock Data for Dev Admin
const MOCK_PROSPECTS: any[] = [];

export interface IStorage {
  sessionStore: ExpressSession.Store;
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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

  // Leads
  listLeads(userId: string, filters: any): Promise<Lead[]>;
  createLeadUpload(upload: any, userId?: string): Promise<LeadUpload>;
  updateLeadUpload(id: number, userId: string, upload: Partial<LeadUpload>): Promise<LeadUpload>;

  // Prospects
  listProspects(userId: string, status?: string): Promise<ProspectWithCompany[]>; // Added for Pipeline Driver
  countProspects(userId: string): Promise<number>;
  getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined>;
  getProspectById(id: number): Promise<ProspectWithCompany | undefined>;
  createProspect(prospect: InsertProspect, userId: string): Promise<Prospect>;
  updateProspectStage(
    prospectId: number,
    userId: string,
    stage: string
  ): Promise<Prospect | undefined>;
  updateProspect(
    id: number,
    userId: string,
    updates: Partial<InsertProspect>
  ): Promise<Prospect | undefined>;
  deleteProspect(id: number, userId: string): Promise<void>;
  reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void>;

  // Contacts
  listContacts(prospectId: number, userId: string): Promise<Contact[]>;
  getContact(id: number, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, userId: string): Promise<Contact | undefined>;
  updateContact(
    id: number,
    userId: string,
    updates: Partial<InsertContact>
  ): Promise<Contact | undefined>;
  deleteContact(id: number, userId: string): Promise<boolean>;

  // Activities
  listActivities(prospectId: number, userId: string): Promise<Activity[]>;
  listAllUserActivities(userId: string): Promise<Activity[]>;
  getActivity(id: number, userId: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity, userId: string): Promise<Activity | undefined>;
  updateActivity(
    id: number,
    userId: string,
    updates: Partial<InsertActivity>
  ): Promise<Activity | undefined>;
  deleteActivity(id: number, userId: string): Promise<boolean>;

  // Due Diligence
  getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined>;
  getAllDueDiligenceSummaries(userId: string): Promise<any[]>;
  upsertDueDiligence(
    prospectId: number,
    userId: string,
    data: DueDiligenceData
  ): Promise<DueDiligence | undefined>;

  // Lenders
  listLenders(filters: any): Promise<Lender[]>;
  getLender(id: number): Promise<Lender | undefined>;
  getLenderWithProducts(id: number): Promise<LenderWithProducts | undefined>;
  createLender(lender: InsertLender, userId: string): Promise<Lender>;
  updateLender(
    id: number,
    userId: string,
    updates: Partial<InsertLender>,
    isAdmin?: boolean
  ): Promise<Lender | undefined>;
  adminBulkUpdateLenders(ids: number[], updates: Partial<Lender>): Promise<void>;
  adminBulkDeleteLenders(ids: number[]): Promise<void>;
  deleteLender(id: number, userId: string, isAdmin?: boolean): Promise<void>;
  adminDeleteLender(id: number): Promise<void>;

  // Email
  createEmailInbox(data: InsertEmailInbox, userId?: string): Promise<EmailInbox>;
  getEmailInbox(id: number): Promise<EmailInbox | undefined>;
  listEmailMessages(inboxId: number): Promise<EmailMessage[]>;
  getEmailMessagesByInbox(inboxId: number): Promise<EmailMessage[]>;
  getEmailMessage(id: number): Promise<EmailMessage | undefined>;
  getEmailMessageByMessageId(messageId: string): Promise<EmailMessage | undefined>;
  createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage>;
  markEmailAsRead(id: number): Promise<void>;
  updateEmailMessageLink(
    id: number,
    prospectId: number | null,
    contactId: number | null,
    userId?: string
  ): Promise<void>;
  getEmailMessagesForContact(contactId: number, userId?: string): Promise<EmailMessage[]>;
  getEmailMessagesForProspect(prospectId: number, userId?: string): Promise<EmailMessage[]>;

  // Time Tracking
  listTimeEntries(prospectId: number, userId?: string): Promise<TimeEntry[]>;
  getProspectTotalTime(prospectId: number, userId?: string): Promise<number>;
  createTimeEntry(entry: InsertTimeEntry, userId?: string): Promise<TimeEntry>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>, userId?: string): Promise<TimeEntry>;
  deleteTimeEntry(id: number, userId?: string): Promise<void>;

  // Documents
  listProspectDocuments(prospectId: number, userId?: string): Promise<ProspectDocument[]>;
  getProspectDocument(id: number, userId?: string): Promise<ProspectDocument | undefined>;
  createProspectDocument(doc: InsertProspectDocument, userId?: string): Promise<ProspectDocument>;
  updateProspectDocument(id: number, updates: Partial<ProspectDocument>, userId?: string): Promise<ProspectDocument | undefined>;
  deleteProspectDocument(id: number, userId?: string): Promise<void>;

  // Add-Ons
  listAddOnProducts(onlyActive?: boolean): Promise<AddOnProduct[]>;
  listUserAddOnPurchases(userId: string): Promise<AddOnPurchase[]>;
  getUserProspectCredits(userId: string): Promise<number>;
  createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct>;

  // Lender Interactions & Products
  listLenderInteractions(prospectId: number, userId?: string): Promise<LenderInteraction[]>;
  listUserLenderInteractions(userId: string): Promise<LenderInteraction[]>;
  createLenderInteraction(
    interaction: InsertLenderInteraction,
    userId?: string
  ): Promise<LenderInteraction>;
  updateLenderInteraction(
    id: number,
    interaction: Partial<InsertLenderInteraction>,
    userId?: string
  ): Promise<LenderInteraction>;
  deleteLenderInteraction(id: number, userId: string): Promise<boolean>;
  listLenderProducts(lenderId: number): Promise<LenderProduct[]>;
  createLenderProduct(product: InsertLenderProduct): Promise<LenderProduct>;
  updateLenderProduct(
    id: number,
    userId: string,
    product: Partial<InsertLenderProduct>
  ): Promise<LenderProduct>;
  deleteLenderProduct(id: number, userId: string): Promise<boolean>;

  // Lender Notes
  listLenderNotes(lenderId: number): Promise<LenderNote[]>;
  createLenderNote(note: InsertLenderNote): Promise<LenderNote>;
  deleteLenderNote(id: number, userId: string): Promise<boolean>;

  // Applications
  listApplicationSubmissions(prospectId: number, userId?: string): Promise<ApplicationSubmission[]>;
  getApplicationSubmission(id: number, userId?: string): Promise<ApplicationSubmission | undefined>;
  createApplicationSubmission(
    submission: InsertApplicationSubmission,
    userId?: string
  ): Promise<ApplicationSubmission>;
  updateApplicationSubmission(
    id: number,
    userId: string,
    submission: Partial<ApplicationSubmission>
  ): Promise<ApplicationSubmission>;
  deleteApplicationSubmission(id: number, userId: string): Promise<boolean>;

  // Leads
  listLeadUploads(userId: string): Promise<LeadUpload[]>;
  getLeadUpload(id: number, userId?: string): Promise<LeadUpload | undefined>;
  createLeadUpload(upload: any, userId?: string): Promise<LeadUpload>;
  updateLeadUpload(id: number, userId: string, upload: Partial<LeadUpload>): Promise<LeadUpload>;
  listLeads(userId: string, filters: any): Promise<Lead[]>;
  getLead(id: number, userId?: string): Promise<Lead | undefined>;
  updateLead(id: number, userId: string, lead: Partial<Lead>): Promise<Lead>;
  deleteLead(id: number, userId: string): Promise<boolean>;
  createLeadsBulk(leads: InsertLead[], userId?: string): Promise<Lead[]>;
  createLeadsBulk(leads: InsertLead[], userId?: string): Promise<Lead[]>;
  deleteLeadsByUpload(uploadId: number, userId: string): Promise<boolean>;

  // Scraped Leads (Auto-Qualified)
  createScrapedLead(lead: InsertScrapedLead): Promise<ScrapedLead>;
  listScrapedLeads(status?: string): Promise<ScrapedLead[]>;
  getScrapedLead(id: number): Promise<ScrapedLead | undefined>;
  updateScrapedLead(id: number, updates: Partial<InsertScrapedLead>): Promise<ScrapedLead>;

  // Underwriting
  listUnderwritingSubmissions(filters: any): Promise<any[]>;
  listUnderwriterScopedSubmissions(userId: string): Promise<any[]>;
  listBrokerUnderwritingSubmissions(userId: string): Promise<any[]>;
  getUnderwritingSubmission(id: number): Promise<any | undefined>;
  createUnderwritingSubmission(data: any, userId: string): Promise<any>;
  updateUnderwritingSubmission(id: number, updates: any): Promise<any | undefined>;
  assignUnderwritingSubmission(id: number, underwriterId: string): Promise<any | undefined>;
  getUnderwritingSubmissionByProspect(
    prospectId: number,
    userId?: string
  ): Promise<UnderwritingSubmission | undefined>;
  claimUnderwritingSubmission(id: number, userId?: string): Promise<UnderwritingSubmission>;
  createUnderwritingActivity(
    activity: InsertUnderwritingActivity,
    userId?: string
  ): Promise<UnderwritingActivity>;
  listUnderwritingActivities(
    submissionId: number,
    userId?: string
  ): Promise<UnderwritingActivity[]>;

  // Teams
  getTeams(userId?: string): Promise<Team[]>;
  createTeam(team: InsertTeam, userId?: string): Promise<Team>;
  getTeamWithMembers(id: number, userId?: string): Promise<Team & { members: TeamMember[] }>;
  addTeamMember(member: InsertTeamMember, userId?: string): Promise<TeamMember>;
  removeTeamMember(id: number, userId?: string): Promise<void>;
  getUserTeams(userId: string): Promise<Team[]>;

  // Webhook Keys
  generateWebhookApiKey(userId: string): Promise<{ apiKey: string; hash: string; suffix: string }>;
  getUserByWebhookApiKeyHash(hash: string): Promise<User | undefined>;
  updateWebhookApiKeyLastUsed(hash: string): Promise<void>;

  // Session
  cleanupExpiredSessions(): Promise<number>;

  // Enquiries
  createLenderEnquiry(data: any): Promise<any>;

  // Chat
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(channelId: number): Promise<Channel | undefined>;
  getChannelsForUser(userId: string): Promise<Channel[]>;
  addChannelMember(member: InsertChannelMember): Promise<void>;
  listChannelMembers(channelId: number): Promise<ChannelMember[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(channelId: number): Promise<Message[]>;

  // Communications Module
  getCommunicationIntegrations(userId: string): Promise<CommunicationIntegration[]>;
  saveCommunicationIntegration(
    integration: InsertCommunicationIntegration
  ): Promise<CommunicationIntegration>;
  getCommunicationTemplates(userId: string): Promise<CommunicationTemplate[]>;
  createCommunicationTemplate(
    template: InsertCommunicationTemplate
  ): Promise<CommunicationTemplate>;
  updateCommunicationTemplate(
    id: number,
    template: Partial<InsertCommunicationTemplate>
  ): Promise<CommunicationTemplate>;
  logCommunication(log: InsertCommunicationLog): Promise<CommunicationLog>;
  getCommunicationHistory(prospectId: number): Promise<CommunicationLog[]>;

  // --- External Sales CRM (God Mode) ---
  listInternalLeads(): Promise<InternalLead[]>;
  getInternalLead(id: number): Promise<InternalLead | undefined>;
  getInternalLeadByCompanyNumber(companyNumber: string): Promise<InternalLead | undefined>;
  createInternalLead(lead: InsertInternalLead): Promise<InternalLead>;
  updateInternalLead(
    id: number,
    updates: Partial<InsertInternalLead>
  ): Promise<InternalLead | undefined>;
  deleteInternalLead(id: number): Promise<void>;
  clearAllInternalLeads(): Promise<void>;

  listCommissions(): Promise<Commission[]>;
  getAgentCommissions(agentId: string): Promise<Commission[]>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: number, updates: Partial<InsertCommission>): Promise<Commission | undefined>;

  deleteUser(id: string): Promise<void>;

  // Marketing Contacts
  listMarketingContacts(userId: string): Promise<MarketingContact[]>;
  getMarketingContactByEmail(email: string, userId: string): Promise<MarketingContact | undefined>;
  createOrUpdateMarketingContact(
    contact: InsertMarketingContact,
    userId: string
  ): Promise<MarketingContact>;

  // Waitlist
  listWaitlistEntries(): Promise<WaitlistEntry[]>;
  getWaitlistEntryByEmail(email: string): Promise<WaitlistEntry | undefined>;
  createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;
  updateWaitlistEntryStatus(id: number, status: string): Promise<void>;
  unsubscribeWaitlistEntry(email: string): Promise<boolean>;

  // Agents
  getAgents(): Promise<DigitalAssociate[]>;
  getAgentById(id: string): Promise<DigitalAssociate | undefined>;
  updateAgent(id: string, updates: Partial<DigitalAssociate>): Promise<DigitalAssociate>;
  deleteAgent(id: string): Promise<void>;
  logMissionDeviation(deviation: Omit<MissionDeviation, "id">): Promise<MissionDeviation>;
  getMissionDeviations(agentId?: string): Promise<MissionDeviation[]>;

  // Scraped Leads (Auto-Qualified)
  createScrapedLead(lead: InsertScrapedLead): Promise<ScrapedLead>;
  listScrapedLeads(status?: string): Promise<ScrapedLead[]>;
  getScrapedLead(id: number): Promise<ScrapedLead | undefined>;
  updateScrapedLead(id: number, updates: Partial<InsertScrapedLead>): Promise<ScrapedLead>;

  // Agent Chat History
  saveAgentChatMessage(
    agentId: string,
    userId: string,
    message: Omit<AgentChatMessage, "id">
  ): Promise<AgentChatMessage>;
  getAgentChatHistory(agentId: string, userId: string, limit?: number): Promise<AgentChatMessage[]>;
  clearAgentChatHistory(agentId: string, userId: string): Promise<void>;

  // Campaigns
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  listCampaigns(): Promise<Campaign[]>;
  updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

  // --- Broker CRM ---
  listBrokerLeads(): Promise<BrokerLead[]>;
  getBrokerLead(id: number): Promise<BrokerLead | undefined>;
  getBrokerLeadByCompanyNumber(companyNumber: string): Promise<BrokerLead | undefined>;
  createBrokerLead(lead: InsertBrokerLead): Promise<BrokerLead>;
  updateBrokerLead(
    id: number,
    updates: Partial<InsertBrokerLead>
  ): Promise<BrokerLead | undefined>;
  deleteBrokerLead(id: number): Promise<void>;
  clearAllBrokerLeads(): Promise<void>;

  listBrokerCommissions(): Promise<BrokerCommission[]>;
  getBrokerAgentCommissions(agentId: string): Promise<BrokerCommission[]>;
  createBrokerCommission(commission: InsertBrokerCommission): Promise<BrokerCommission>;
  updateBrokerCommission(id: number, updates: Partial<InsertBrokerCommission>): Promise<BrokerCommission | undefined>;

  createBrokerScrapedLead(lead: InsertBrokerScrapedLead): Promise<BrokerScrapedLead>;
  listBrokerScrapedLeads(status?: string): Promise<BrokerScrapedLead[]>;
  getBrokerScrapedLead(id: number): Promise<BrokerScrapedLead | undefined>;
  updateBrokerScrapedLead(id: number, updates: Partial<InsertBrokerScrapedLead>): Promise<BrokerScrapedLead>;

  createBrokerCampaign(campaign: InsertBrokerCampaign): Promise<BrokerCampaign>;
  listBrokerCampaigns(): Promise<BrokerCampaign[]>;
  updateBrokerCampaign(id: number, updates: Partial<BrokerCampaign>): Promise<BrokerCampaign>;
  deleteBrokerCampaign(id: number): Promise<void>;

  // --- Invoices ---
  listInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: number, userId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice>;
  updateInvoice(id: number, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number, userId: string): Promise<void>;
  getNextInvoiceNumber(userId: string): Promise<string>;

  // Expenses
  listExpenses(userId: string): Promise<Expense[]>;
  getExpense(id: number, userId: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense, userId: string): Promise<Expense>;
  updateExpense(id: number, userId: string, updates: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number, userId: string): Promise<void>;

  // Email Templates
  listEmailTemplates(userId: string): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, userId: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate, userId: string): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, userId: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number, userId: string): Promise<void>;
  duplicateEmailTemplate(id: number, userId: string): Promise<EmailTemplate>;

  // Email Campaigns
  listEmailCampaigns(userId: string): Promise<EmailCampaign[]>;
  getEmailCampaign(id: number, userId: string): Promise<EmailCampaign | undefined>;
  createEmailCampaign(campaign: InsertEmailCampaign, userId: string): Promise<EmailCampaign>;
  updateEmailCampaign(id: number, userId: string, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined>;
  deleteEmailCampaign(id: number, userId: string): Promise<void>;

  // Campaign Recipients
  listCampaignRecipients(campaignId: number, userId: string): Promise<CampaignRecipient[]>;
  addCampaignRecipients(recipients: InsertCampaignRecipient[]): Promise<CampaignRecipient[]>;
  getCampaignRecipientById(id: number): Promise<CampaignRecipient | undefined>;
  updateCampaignRecipient(id: number, updates: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined>;
  clearCampaignRecipients(campaignId: number, userId: string): Promise<void>;
}

export class FirestoreStorage implements IStorage {
  sessionStore: ExpressSession.Store;

  constructor() {
    // Use Firestore for session storage (Persistent)
    const { FirestoreStore } = require("@google-cloud/connect-firestore");

    this.sessionStore = new FirestoreStore({
      dataset: db, // Use the existing initialized Firestore instance
      kind: "express-sessions",
    });
  }

  // --- Users ---
  async getUser(id: string): Promise<User | undefined> {
    if (id === MOCK_DEV_ADMIN_ID) return MOCK_DEV_ADMIN;
    try {
      const doc = await db.collection("users").doc(id).get();
      if (!doc.exists) return undefined;
      return convertDates({ id: doc.id, ...doc.data() }) as User;
    } catch (e) {
      console.error("DB Error getUser", e);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await db.collection("users").where("email", "==", username).limit(1).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return convertDates({ id: doc.id, ...doc.data() }) as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.getUserByUsername(email);
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const snapshot = await db
      .collection("users")
      .where("stripeCustomerId", "==", stripeCustomerId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return convertDates({ id: doc.id, ...doc.data() }) as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUserRef = db.collection("users").doc(); // Auto ID
    const newUser = {
      ...user,
      id: newUserRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await newUserRef.set(newUser);
    return newUser as User;
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    // Firestore 'in' limit is 10. For now assuming < 10 or naive loop
    const refs = ids.map((id) => db.collection("users").doc(id));
    const docs = await db.getAll(...refs);
    return docs.map((d) => convertDates({ id: d.id, ...d.data() }) as User).filter((u) => u.id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    if (user.email) {
      const existing = await this.getUserByUsername(user.email);
      if (existing) {
        return existing;
      }
    }
    return this.createUser(user as InsertUser);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const doc = await db.collection("companies").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const ref = db.collection("users").doc(id);
    await ref.update({ ...updates, updatedAt: new Date() });
    return this.getUser(id);
  }

  async deleteUser(id: string): Promise<void> {
    await db.collection("users").doc(id).delete();
  }

  async getAllUsers(): Promise<User[]> {
    try {
      console.log("[Storage] getAllUsers: Fetching users from DB...");
      const snap = await db.collection("users").get();
      console.log(`[Storage] getAllUsers: Found ${snap.size} user documents.`);

      const users = snap.docs
        .map((d) => {
          try {
            const data = d.data();
            return convertDates({ id: d.id, ...data }) as User;
          } catch (err) {
            console.error(`[Storage] Failed to parse user ${d.id}:`, err);
            return null;
          }
        })
        .filter((u) => u !== null) as User[];

      console.log(
        `[Storage] getAllUsers: Returning ${users.length + 1} users (including mock admin).`
      );
      return [MOCK_DEV_ADMIN, ...users];
    } catch (e) {
      console.error("DB Error getAllUsers", e);
      return [MOCK_DEV_ADMIN];
    }
  }

  // --- System Settings ---
  async getSystemSetting(key: string): Promise<any> {
    const snap = await db.collection("system_settings").where("key", "==", key).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data().value;
  }

  async updateSystemSetting(key: string, value: any, userId?: string): Promise<any> {
    const snap = await db.collection("system_settings").where("key", "==", key).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ value, updatedBy: userId, updatedAt: new Date() });
    } else {
      await db
        .collection("system_settings")
        .add({ key, value, updatedBy: userId, updatedAt: new Date() });
    }
    return value;
  }

  // --- Companies ---
  async getCompanyByNumber(companyNumber: string): Promise<Company | undefined> {
    try {
      const snap = await db
        .collection("companies")
        .where("companyNumber", "==", companyNumber)
        .limit(1)
        .get();
      if (snap.empty) return undefined;
      return convertDates({ id: snap.docs[0].data().id, ...snap.docs[0].data() }) as Company;
    } catch (e) {
      console.error("DB Error getCompanyByNumber", e);
      return undefined;
    }
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const snap = await db.collection("companies").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ ...snap.docs[0].data() }) as Company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    try {
      const id = await getNextId("companies");
      const newCompany = { ...company, id, createdAt: new Date() };
      await db.collection("companies").add(newCompany);
      return newCompany as Company;
    } catch (e) {
      console.error("DB Error createCompany - using mock fallback", e);
      // Fallback for dev mode when DB is broken
      return {
        ...company,
        id: 999,
        createdAt: new Date(),
      } as Company;
    }
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const snap = await db.collection("companies").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update(updates);
    return this.getCompanyById(id);
  }

  // --- Prospects ---
  async listProspects(userId: string, status?: string): Promise<ProspectWithCompany[]> {
    if (userId === MOCK_DEV_ADMIN_ID) {
      // Hydrate companies if missing
      return Promise.all(
        MOCK_PROSPECTS.map(async (p) => {
          if ((p as any).company) return p as any;
          const company = (await this.getCompanyById(p.companyId)) || {
            id: p.companyId,
            companyName: "Mock Company",
            companyNumber: "00000000",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return { ...p, company } as any;
        })
      );
    }

    try {
      if (!userId) {
        return [];
      }

      let query = db.collection("prospects").where("userId", "==", userId);

      if (status) {
        query = query.where("status", "==", status);
      }

      const snap = await query.orderBy("createdAt", "desc").get();

      const prospects = await Promise.all(
        snap.docs.map(async (doc) => {
          const p = convertDates({ id: Number(doc.id), ...doc.data() }) as Prospect;
          const company = await this.getCompanyById(p.companyId);
          if (!company) return null;
          return { ...p, company };
        })
      );

      return prospects.filter((p): p is ProspectWithCompany => p !== null);
    } catch (err) {
      console.error(`[ERROR] listProspects failed:`, err);
      return [];
    }
  }

  async countProspects(userId: string): Promise<number> {
    if (userId === MOCK_DEV_ADMIN_ID) return MOCK_PROSPECTS.length;
    try {
      const snap = await db.collection("prospects").where("userId", "==", userId).count().get();
      return snap.data().count;
    } catch (e) {
      console.error("DB Error countProspects", e);
      return 0;
    }
  }

  async getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined> {
    if (userId === MOCK_DEV_ADMIN_ID) {
      const p = MOCK_PROSPECTS.find((p) => p.id === id);
      return p as any;
    }
    try {
      if (!userId) {
        return undefined;
      }

      const snap = await db
        .collection("prospects")
        .where("id", "==", id)
        .where("userId", "==", userId)
        .limit(1)
        .get();
      if (snap.empty) {
        return undefined;
      }

      const prospectData = snap.docs[0].data();
      const prospect = convertDates(prospectData) as Prospect;

      const company = await this.getCompanyById(prospect.companyId);

      if (!company) {
        return undefined;
      }
      return { ...prospect, company };
    } catch (err) {
      console.error(`[ERROR] getProspect failed for ${id}:`, err);
      return undefined;
    }
  }

  async getProspectById(id: number): Promise<ProspectWithCompany | undefined> {
    const snap = await db.collection("prospects").where("id", "==", id).limit(1).get();
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
    if (userId === MOCK_DEV_ADMIN_ID) {
      const id = Date.now(); // Simple numeric ID for mock
      const company = (await this.getCompanyById(insertProspect.companyId)) || {
        id: insertProspect.companyId,
        companyName: "Mock Company",
        companyNumber: "00000000",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const prospect = {
        ...insertProspect,
        id,
        userId,
        stage: "lead",
        queueOrder: 0,
        savedAssociations: [],
        loanAllocation: [],
        company: company,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      MOCK_PROSPECTS.push(prospect as any);
      return prospect as Prospect;
    }
    const id = await getNextId("prospects");
    const prospect = {
      ...insertProspect,
      id,
      userId,
      stage: "lead",
      queueOrder: 0,
      savedAssociations: [],
      loanAllocation: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Transaction to update user stats
    await db.runTransaction(async (t) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await t.get(userRef);
      if (userDoc.exists) {
        const current = userDoc.data()?.prospectsCreatedCount || 0;
        t.update(userRef, { prospectsCreatedCount: current + 1 });
      }
      const prospectRef = db.collection("prospects").doc(); // Auto ID for doc, numeric ID inside
      t.set(prospectRef, prospect);
    });
    return prospect as Prospect;
  }

  async updateProspectStage(
    prospectId: number,
    userId: string,
    stage: string
  ): Promise<Prospect | undefined> {
    return this.updateProspect(prospectId, userId, { stage } as any);
  }

  async updateProspect(
    id: number,
    userId: string,
    updates: Partial<InsertProspect>
  ): Promise<Prospect | undefined> {
    if (userId === MOCK_DEV_ADMIN_ID) {
      const pIndex = MOCK_PROSPECTS.findIndex((p) => p.id === id);
      if (pIndex === -1) return undefined;
      MOCK_PROSPECTS[pIndex] = { ...MOCK_PROSPECTS[pIndex], ...updates, updatedAt: new Date() };
      return MOCK_PROSPECTS[pIndex] as Prospect;
    }
    const snap = await db
      .collection("prospects")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getProspect(id, userId);
  }

  async deleteProspect(id: number, userId: string): Promise<void> {
    const snap = await db
      .collection("prospects")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.delete();
    }
  }

  async reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void> {
    const batch = db.batch();
    for (let i = 0; i < orderedIds.length; i++) {
      const snap = await db
        .collection("prospects")
        .where("id", "==", orderedIds[i])
        .where("userId", "==", userId)
        .limit(1)
        .get();
      if (!snap.empty) {
        batch.update(snap.docs[0].ref, { queueOrder: i, updatedAt: new Date() });
      }
    }
    await batch.commit();
  }

  // --- Contacts ---
  async listContacts(prospectId: number, userId: string): Promise<Contact[]> {
    try {
      if (!userId) return [];
      const prospect = await this.getProspect(prospectId, userId);
      if (!prospect) return [];

      const snap = await db
        .collection("contacts")
        .where("prospectId", "==", prospectId)
        .orderBy("createdAt", "asc")
        .get();
      return snap.docs.map((d) => convertDates(d.data())) as Contact[];
    } catch (err) {
      console.error(`[ERROR] listContacts failed for prospect ${prospectId}:`, err);
      return [];
    }
  }

  async getContact(id: number, userId: string): Promise<Contact | undefined> {
    const snap = await db.collection("contacts").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    // Verify ownership
    const contact = convertDates(snap.docs[0].data()) as Contact;
    const prospect = await this.getProspect(contact.prospectId, userId);
    return prospect ? contact : undefined;
  }

  async createContact(insertContact: InsertContact, userId: string): Promise<Contact | undefined> {
    const prospect = await this.getProspect(insertContact.prospectId as number, userId);
    if (!prospect) return undefined;

    const id = await getNextId("contacts");
    const contact = { ...insertContact, id, createdAt: new Date() };
    await db.collection("contacts").add(contact);
    return contact as Contact;
  }

  async updateContact(
    id: number,
    userId: string,
    updates: Partial<InsertContact>
  ): Promise<Contact | undefined> {
    const contact = await this.getContact(id, userId);
    if (!contact) return undefined;

    const snap = await db.collection("contacts").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update(updates);
    return { ...contact, ...updates } as Contact;
  }

  async deleteContact(id: number, userId: string): Promise<boolean> {
    const contact = await this.getContact(id, userId);
    if (!contact) return false;
    const snap = await db.collection("contacts").where("id", "==", id).limit(1).get();
    await snap.docs[0].ref.delete();
    return true;
  }

  // --- Activities ---
  async listActivities(prospectId: number, userId: string): Promise<Activity[]> {
    try {
      if (!userId) return [];
      const snap = await db
        .collection("activities")
        .where("prospectId", "==", prospectId)
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((d) => convertDates(d.data())) as Activity[];
    } catch (error) {
      console.error(`[ERROR] listActivities failed for prospect ${prospectId}:`, error);
      return [];
    }
  }

  async listAllUserActivities(userId: string): Promise<Activity[]> {
    try {
      const snap = await db
        .collection("activities")
        .where("userId", "==", userId)
        .orderBy("dueDate", "asc")
        .get();
      return snap.docs.map((d) => convertDates(d.data())) as Activity[];
    } catch (e) {
      console.error("DB Error listAllUserActivities", e);
      return [];
    }
  }

  async getActivity(id: number, userId: string): Promise<Activity | undefined> {
    const snap = await db
      .collection("activities")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as Activity;
  }

  async createActivity(activity: InsertActivity, userId: string): Promise<Activity | undefined> {
    if (activity.prospectId) {
      const p = await this.getProspect(activity.prospectId as number, userId);
      if (!p) return undefined;
    }
    const id = await getNextId("activities");
    const newActivity = {
      ...activity,
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      completed: 0,
    };
    await db.collection("activities").add(newActivity);
    return newActivity as Activity;
  }

  async updateActivity(
    id: number,
    userId: string,
    updates: Partial<InsertActivity>
  ): Promise<Activity | undefined> {
    const snap = await db
      .collection("activities")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getActivity(id, userId);
  }

  async deleteActivity(id: number, userId: string): Promise<boolean> {
    const snap = await db
      .collection("activities")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return false;
    await snap.docs[0].ref.delete();
    return true;
  }

  // --- Due Diligence ---
  async getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined> {
    // Verify ownership
    const p = await this.getProspect(prospectId, userId);
    if (!p) return undefined;

    const snap = await db
      .collection("due_diligence")
      .where("prospectId", "==", prospectId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as DueDiligence;
  }

  async getAllDueDiligenceSummaries(
    userId: string
  ): Promise<{ prospectId: number; status: "complete" | "partial" | "pending" }[]> {
    if (userId === MOCK_DEV_ADMIN_ID) return [];
    try {
      const prospects = await this.listProspects(userId);
      const res: { prospectId: number; status: "complete" | "partial" | "pending" }[] = [];

      for (const p of prospects) {
        // Mock for dev
        if (userId === MOCK_DEV_ADMIN_ID) {
          res.push({ prospectId: p.id!, status: "pending" });
          continue;
        }
        const dd = await this.getDueDiligence(p.id!, userId);
        const checklist = dd?.data?.checklist || [];
        let status: "pending" | "partial" | "complete" = "pending";
        if (checklist.length > 0) {
          const completed = checklist.filter((i: any) => i.completed).length;
          if (completed === checklist.length) status = "complete";
          else if (completed > 0) status = "partial";
        }
        res.push({ prospectId: p.id!, status });
      }
      return res;
    } catch (e) {
      console.error("DB Error getAllDueDiligenceSummaries", e);
      return [];
    }
  }

  async upsertDueDiligence(
    prospectId: number,
    userId: string,
    data: DueDiligenceData
  ): Promise<DueDiligence | undefined> {
    const p = await this.getProspect(prospectId, userId);
    if (!p) return undefined;

    const snap = await db
      .collection("due_diligence")
      .where("prospectId", "==", prospectId)
      .limit(1)
      .get();
    if (snap.empty) {
      const id = await getNextId("due_diligence");
      const newDoc = { id, prospectId, data, createdAt: new Date(), updatedAt: new Date() };
      await db.collection("due_diligence").add(newDoc);
      return newDoc as DueDiligence;
    } else {
      await snap.docs[0].ref.update({ data, updatedAt: new Date() });
      return { ...snap.docs[0].data(), data, updatedAt: new Date() } as DueDiligence;
    }
  }

  // --- Lenders ---
  // --- Lenders ---
  async listLenders(filters: any): Promise<Lender[]> {
    try {
      let results: Lender[] = [];
      const collection = db.collection("lenders");

      if (filters.includeGlobal) {
        // Strategy: Fetch User's Private Lenders AND Global Lenders in parallel
        // Then merge and apply other filters in-memory (or we'd need complex composite indexes)

        const queries = [];

        // 1. Global Lenders
        queries.push(collection.where("isGlobal", "==", 1).get());

        // 2. User's Private Lenders (if userId provided)
        if (filters.userId) {
          queries.push(collection.where("userId", "==", filters.userId).get());
        }

        const snapshots = await Promise.all(queries);
        const docsMap = new Map<string, Lender>();

        snapshots.forEach((snap) => {
          snap.docs.forEach((d) => {
            const data = d.data();
            const id = data.id || Number(d.id); // Fallback to d.id check if numeric id is missing
            // Use numeric ID as key to deduplicate
            docsMap.set(id.toString(), convertDates({ ...data, id }) as Lender);
          });
        });

        results = Array.from(docsMap.values());
      } else {
        // Legacy/Single query path
        let query: any = collection;
        if (filters.userId) query = query.where("userId", "==", filters.userId);

        // Apply strictly indexed filters here if likely to be efficient
        if (filters.lenderType) query = query.where("lenderType", "==", filters.lenderType);
        if (filters.panelStatus) query = query.where("panelStatus", "==", filters.panelStatus);

        const snap = await query.get();
        results = snap.docs.map((d: any) => {
          const data = d.data();
          const id = data.id || Number(d.id);
          return convertDates({ ...data, id });
        }) as Lender[];
      }

      // --- In-Memory Filtering (Common for both paths to ensure consistency) ---
      // Note: If dataset grows huge, we might need to move common filters back to DB queries where possible.

      if (filters.includeGlobal) {
        // Apply filters that we skipped in the global query path
        if (filters.lenderType)
          results = results.filter((l) => l.lenderType === filters.lenderType);
        if (filters.panelStatus)
          results = results.filter((l) => l.panelStatus === filters.panelStatus);
      }

      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (l) =>
            l.institutionName.toLowerCase().includes(q) ||
            l.notes?.toLowerCase().includes(q) ||
            l.contactName?.toLowerCase().includes(q)
        );
      }

      if (filters.minLoanAmount) {
        results = results.filter((l) => (l.minLoanAmount || 0) <= filters.minLoanAmount);
      }

      return results;
    } catch (e) {
      console.error("DB Error listLenders", e);
      return [];
    }
  }

  async getLender(id: number): Promise<Lender | undefined> {
    const snap = await db.collection("lenders").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data()) as Lender;
  }

  async createLender(lender: InsertLender, userId: string): Promise<Lender> {
    const id = await getNextId("lenders");
    const newLender = { ...lender, id, userId, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("lenders").add(newLender);
    return newLender as Lender;
  }

  async updateLender(
    id: number,
    userId: string,
    updates: Partial<InsertLender>,
    isAdmin?: boolean
  ): Promise<Lender | undefined> {
    let query = db.collection("lenders").where("id", "==", id);
    if (!isAdmin) {
      query = query.where("userId", "==", userId);
    }
    const snap = await query.limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getLender(id);
  }

  async adminBulkUpdateLenders(ids: number[], updates: Partial<Lender>): Promise<void> {
    const batch = db.batch();
    for (const id of ids) {
      const snap = await db.collection("lenders").where("id", "==", id).limit(1).get();
      if (!snap.empty) {
        batch.update(snap.docs[0].ref, { ...updates, updatedAt: new Date() });
      }
    }
    await batch.commit();
  }

  async adminBulkDeleteLenders(ids: number[]): Promise<void> {
    const batch = db.batch();
    for (const id of ids) {
      const snap = await db.collection("lenders").where("id", "==", id).limit(1).get();
      if (!snap.empty) {
        batch.delete(snap.docs[0].ref);
      }
    }
    await batch.commit();
  }

  async deleteLender(id: number, userId: string, isAdmin: boolean = false): Promise<void> {
    let query = db.collection("lenders").where("id", "==", id);
    if (!isAdmin) {
      query = query.where("userId", "==", userId);
    }
    const snap = await query.limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.delete();
  }

  async adminDeleteLender(id: number): Promise<void> {
    const snap = await db.collection("lenders").where("id", "==", id).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.delete();
  }

  async getLenderWithProducts(id: number): Promise<LenderWithProducts | undefined> {
    const lender = await this.getLender(id);
    if (!lender) return undefined;
    const products = await this.listLenderProducts(id);
    return { ...lender, products };
  }

  async listLenderProducts(lenderId: number): Promise<LenderProduct[]> {
    const snap = await db.collection("lender_products").where("lenderId", "==", lenderId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() })) as LenderProduct[];
  }

  // --- Underwriting Submissions ---
  async listUnderwritingSubmissions(filters: any): Promise<any[]> {
    try {
      // Mock result for dev admin (or empty if using filters)
      // Since filters are often specific, we might just return empty if real DB fails
      let query: any = db.collection("underwriting_submissions");
      if (filters.status) query = query.where("status", "==", filters.status);
      if (filters.assignedUnderwriterId)
        query = query.where("assignedUnderwriterId", "==", filters.assignedUnderwriterId);

      const snap = await query.get();
      return snap.docs.map((d: any) => convertDates(d.data()));
    } catch (e) {
      console.error("DB Error listUnderwritingSubmissions", e);
      return [];
    }
  }

  async listUnderwriterScopedSubmissions(userId: string): Promise<any[]> {
    // Logic: assigned to me OR (submitted AND unassigned)
    // Firestore complex OR queries are limited. We'll do two queries or one big filtering
    const assigned = await db
      .collection("underwriting_submissions")
      .where("assignedUnderwriterId", "==", userId)
      .get();
    const unassigned = await db
      .collection("underwriting_submissions")
      .where("status", "==", "submitted")
      .where("assignedUnderwriterId", "==", null)
      .get(); // null check might be tricky if field missing

    const results = [...assigned.docs, ...unassigned.docs].map((d) => convertDates(d.data()));
    // Dedupe by ID just in case
    const seen = new Set();
    return results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  async listBrokerUnderwritingSubmissions(userId: string): Promise<any[]> {
    try {
      const snap = await db
        .collection("underwriting_submissions")
        .where("userId", "==", userId)
        .get();
      return snap.docs.map((d: any) => convertDates(d.data()));
    } catch (e) {
      console.error("DB Error listBrokerUnderwritingSubmissions", e);
      return [];
    }
  }

  async getUnderwritingSubmission(id: number): Promise<any | undefined> {
    const snap = await db
      .collection("underwriting_submissions")
      .where("id", "==", id)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    return convertDates(snap.docs[0].data());
  }

  async createUnderwritingSubmission(data: any, userId: string): Promise<any> {
    const id = await getNextId("underwriting_submissions");
    const doc = {
      ...data,
      id,
      userId, // Broker
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: new Date(),
    };
    await db.collection("underwriting_submissions").add(doc);
    return doc;
  }

  async updateUnderwritingSubmission(id: number, updates: any): Promise<any | undefined> {
    const snap = await db
      .collection("underwriting_submissions")
      .where("id", "==", id)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getUnderwritingSubmission(id);
  }

  async assignUnderwritingSubmission(id: number, underwriterId: string): Promise<any | undefined> {
    return this.updateUnderwritingSubmission(id, { assignedUnderwriterId: underwriterId });
  }

  async updateUserSubscription(userId: string, updates: Partial<User>): Promise<User | undefined> {
    return this.updateUser(userId, updates);
  }

  async listEmailMessages(inboxId: number): Promise<EmailMessage[]> {
    const snap = await db.collection("email_messages").where("inboxId", "==", inboxId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  // --- Stubs ---
  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    return [];
  }

  async createEmailInbox(data: InsertEmailInbox, userId?: string): Promise<EmailInbox> {
    const id = await getNextId("email_inboxes");
    const newInbox = { ...data, id, userId, createdAt: new Date() };
    await db.collection("email_inboxes").doc(id.toString()).set(newInbox);
    return newInbox as EmailInbox;
  }

  async getEmailInbox(id: number): Promise<EmailInbox | undefined> {
    const doc = await db.collection("email_inboxes").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async getEmailMessagesByInbox(inboxId: number): Promise<EmailMessage[]> {
    const snap = await db.collection("email_messages").where("inboxId", "==", inboxId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getEmailMessage(id: number): Promise<EmailMessage | undefined> {
    const doc = await db.collection("email_messages").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async getEmailMessageByMessageId(messageId: string): Promise<EmailMessage | undefined> {
    const snap = await db
      .collection("email_messages")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() });
  }

  async createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    const id = await getNextId("email_messages");
    const newMessage = { ...message, id, createdAt: new Date() };
    await db.collection("email_messages").doc(id.toString()).set(newMessage);
    return newMessage as EmailMessage;
  }

  async markEmailAsRead(id: number): Promise<void> {
    await db.collection("email_messages").doc(id.toString()).update({ read: 1 });
  }

  async updateEmailMessageLink(
    id: number,
    prospectId: number | null,
    contactId: number | null,
    userId?: string
  ): Promise<void> {
    await db.collection("email_messages").doc(id.toString()).update({ prospectId, contactId });
  }

  async getEmailMessagesForContact(contactId: number, userId?: string): Promise<EmailMessage[]> {
    const snap = await db.collection("email_messages").where("contactId", "==", contactId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getEmailMessagesForProspect(prospectId: number, userId?: string): Promise<EmailMessage[]> {
    const snap = await db.collection("email_messages").where("prospectId", "==", prospectId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async listTimeEntries(prospectId: number, userId?: string): Promise<TimeEntry[]> {
    const snap = await db.collection("time_entries").where("prospectId", "==", prospectId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getProspectTotalTime(prospectId: number, userId?: string): Promise<number> {
    const entries = await this.listTimeEntries(prospectId);
    return entries.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  }

  async createTimeEntry(entry: InsertTimeEntry, userId?: string): Promise<TimeEntry> {
    const id = await getNextId("time_entries");
    const newEntry = { ...entry, id, userId, createdAt: new Date() };
    await db.collection("time_entries").doc(id.toString()).set(newEntry);
    return newEntry as TimeEntry;
  }

  async updateTimeEntry(
    id: number,
    entry: Partial<InsertTimeEntry>,
    userId?: string
  ): Promise<TimeEntry> {
    const ref = db.collection("time_entries").doc(id.toString());
    await ref.update({ ...entry, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as TimeEntry;
  }

  async deleteTimeEntry(id: number, userId?: string): Promise<void> {
    await db.collection("time_entries").doc(id.toString()).delete();
  }



  async listAddOnProducts(onlyActive?: boolean): Promise<AddOnProduct[]> {
    const snap = await db.collection("addon_products").get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async listUserAddOnPurchases(userId: string): Promise<AddOnPurchase[]> {
    if (userId === MOCK_DEV_ADMIN_ID) return [];
    const snap = await db.collection("addon_purchases").where("userId", "==", userId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getUserProspectCredits(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    return user?.prospectLimit || 0;
  }

  async createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct> {
    const id = await getNextId("addon_products");
    const newProduct = { ...product, id, createdAt: new Date() };
    await db.collection("addon_products").doc(id.toString()).set(newProduct);
    return newProduct as AddOnProduct;
  }

  async listLenderInteractions(prospectId: number, userId?: string): Promise<LenderInteraction[]> {
    const snap = await db
      .collection("lender_interactions")
      .where("prospectId", "==", prospectId)
      .get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async listUserLenderInteractions(userId: string): Promise<LenderInteraction[]> {
    if (userId === MOCK_DEV_ADMIN_ID) return [];
    const snap = await db.collection("lender_interactions").where("userId", "==", userId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async createLenderInteraction(
    interaction: InsertLenderInteraction,
    userId?: string
  ): Promise<LenderInteraction> {
    const id = await getNextId("lender_interactions");
    const newInteraction = { ...interaction, id, userId, createdAt: new Date() };
    await db.collection("lender_interactions").doc(id.toString()).set(newInteraction);
    return newInteraction as LenderInteraction;
  }

  async updateLenderInteraction(
    id: number,
    interaction: Partial<InsertLenderInteraction>,
    userId?: string
  ): Promise<LenderInteraction> {
    const ref = db.collection("lender_interactions").doc(id.toString());
    await ref.update({ ...interaction, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as LenderInteraction;
  }

  async deleteLenderInteraction(id: number, userId: string): Promise<boolean> {
    await db.collection("lender_interactions").doc(id.toString()).delete();
    return true;
  }

  async createLenderProduct(product: InsertLenderProduct): Promise<LenderProduct> {
    const id = await getNextId("lender_products");
    const newProduct = { ...product, id, createdAt: new Date() };
    await db.collection("lender_products").doc(id.toString()).set(newProduct);
    return newProduct as LenderProduct;
  }

  async updateLenderProduct(
    id: number,
    userId: string,
    product: Partial<InsertLenderProduct>
  ): Promise<LenderProduct> {
    const ref = db.collection("lender_products").doc(id.toString());
    await ref.update({ ...product, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as LenderProduct;
  }

  async deleteLenderProduct(id: number, userId: string): Promise<boolean> {
    await db.collection("lender_products").doc(id.toString()).delete();
    return true;
  }

  // --- Lender Notes ---
  async listLenderNotes(lenderId: number): Promise<LenderNote[]> {
    try {
      const snap = await db
        .collection("lender_notes")
        .where("lenderId", "==", lenderId)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((d) => convertDates(d.data())) as LenderNote[];
    } catch (e) {
      console.error("DB Error listLenderNotes", e);
      return [];
    }
  }

  async createLenderNote(note: InsertLenderNote): Promise<LenderNote> {
    const id = await getNextId("lender_notes");
    const newNote = { ...note, id, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("lender_notes").add(newNote);
    return newNote as LenderNote;
  }

  async deleteLenderNote(id: number, userId: string): Promise<boolean> {
    const snap = await db
      .collection("lender_notes")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return false;
    await snap.docs[0].ref.delete();
    return true;
  }

  async listApplicationSubmissions(
    prospectId: number,
    userId?: string
  ): Promise<ApplicationSubmission[]> {
    const snap = await db
      .collection("application_submissions")
      .where("prospectId", "==", prospectId)
      .get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getApplicationSubmission(
    id: number,
    userId?: string
  ): Promise<ApplicationSubmission | undefined> {
    const doc = await db.collection("application_submissions").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async createApplicationSubmission(
    submission: InsertApplicationSubmission,
    userId?: string
  ): Promise<ApplicationSubmission> {
    const id = await getNextId("application_submissions");
    const newSubmission = { ...submission, id, userId, createdAt: new Date() };
    await db.collection("application_submissions").doc(id.toString()).set(newSubmission);
    return newSubmission as ApplicationSubmission;
  }

  async updateApplicationSubmission(
    id: number,
    userId: string,
    submission: Partial<ApplicationSubmission>
  ): Promise<ApplicationSubmission> {
    const ref = db.collection("application_submissions").doc(id.toString());
    await ref.update({ ...submission, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as ApplicationSubmission;
  }

  async deleteApplicationSubmission(id: number, userId: string): Promise<boolean> {
    await db.collection("application_submissions").doc(id.toString()).delete();
    return true;
  }

  async listLeadUploads(userId: string): Promise<LeadUpload[]> {
    const snap = await db.collection("lead_uploads").where("userId", "==", userId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getLeadUpload(id: number, userId?: string): Promise<LeadUpload | undefined> {
    const doc = await db.collection("lead_uploads").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async createLeadUpload(upload: any, userId?: string): Promise<LeadUpload> {
    const id = await getNextId("lead_uploads");
    const newUpload = { ...upload, id, userId: userId || upload.userId, createdAt: new Date() };
    await db.collection("lead_uploads").doc(id.toString()).set(newUpload);
    return newUpload as LeadUpload;
  }

  async updateLeadUpload(
    id: number,
    userId: string,
    upload: Partial<LeadUpload>
  ): Promise<LeadUpload> {
    const ref = db.collection("lead_uploads").doc(id.toString());
    await ref.update({ ...upload, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as LeadUpload;
  }

  async listLeads(userId: string, filters: any): Promise<Lead[]> {
    let query: any = db.collection("leads").where("userId", "==", userId);
    if (filters.uploadId) query = query.where("uploadId", "==", filters.uploadId);
    if (filters.matchStatus) query = query.where("matchStatus", "==", filters.matchStatus);

    const snap = await query.get();
    let results = snap.docs.map((d: any) =>
      convertDates({ id: Number(d.id), ...d.data() })
    ) as Lead[];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.contactName?.toLowerCase().includes(q)
      );
    }
    return results;
  }

  async getLead(id: number, userId?: string): Promise<Lead | undefined> {
    const doc = await db.collection("leads").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async updateLead(id: number, userId: string, lead: Partial<Lead>): Promise<Lead> {
    const ref = db.collection("leads").doc(id.toString());
    await ref.update({ ...lead, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as Lead;
  }

  async deleteLead(id: number, userId: string): Promise<boolean> {
    await db.collection("leads").doc(id.toString()).delete();
    return true;
  }

  async createLeadsBulk(leads: InsertLead[], userId?: string): Promise<Lead[]> {
    const batch = db.batch();
    const results: Lead[] = [];
    for (const lead of leads) {
      const id = await getNextId("leads");
      const newLead = { ...lead, id, userId: userId || lead.userId, createdAt: new Date() };
      const ref = db.collection("leads").doc(id.toString());
      batch.set(ref, newLead);
      results.push(newLead as Lead);
    }
    await batch.commit();
    return results;
  }

  async deleteLeadsByUpload(uploadId: number, userId: string): Promise<boolean> {
    const snap = await db.collection("leads").where("uploadId", "==", uploadId).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  }

  async getUnderwritingSubmissionByProspect(
    prospectId: number,
    userId?: string
  ): Promise<UnderwritingSubmission | undefined> {
    try {
      const snap = await db
        .collection("underwriting_submissions")
        .where("prospectId", "==", prospectId)
        .limit(1)
        .get();
      return snap.empty
        ? undefined
        : convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() });
    } catch (e) {
      console.error("DB Error getUnderwritingSubmissionByProspect", e);
      return undefined;
    }
  }

  async claimUnderwritingSubmission(id: number, userId?: string): Promise<UnderwritingSubmission> {
    const ref = db.collection("underwriting_submissions").doc(id.toString());
    await ref.update({ userId, status: "in_review", updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() });
  }

  async createUnderwritingActivity(
    activity: InsertUnderwritingActivity,
    userId?: string
  ): Promise<UnderwritingActivity> {
    const id = await getNextId("underwriting_activities");
    const newActivity = { ...activity, id, userId, createdAt: new Date() };
    await db.collection("underwriting_activities").doc(id.toString()).set(newActivity);
    return newActivity;
  }

  async listUnderwritingActivities(
    submissionId: number,
    userId?: string
  ): Promise<UnderwritingActivity[]> {
    const snap = await db
      .collection("underwriting_activities")
      .where("submissionId", "==", submissionId)
      .get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async getTeams(userId?: string): Promise<Team[]> {
    const snap = await db.collection("teams").get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async createTeam(team: InsertTeam, userId?: string): Promise<Team> {
    const id = await getNextId("teams");
    const newTeam = { ...team, id, userId, createdAt: new Date() };
    await db.collection("teams").doc(id.toString()).set(newTeam);
    return newTeam;
  }

  async getTeamWithMembers(id: number, userId?: string): Promise<Team & { members: TeamMember[] }> {
    const teamDoc = await db.collection("teams").doc(id.toString()).get();
    const membersSnap = await db.collection("team_members").where("teamId", "==", id).get();
    const members = membersSnap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
    return { ...convertDates({ id: Number(teamDoc.id), ...teamDoc.data() }), members };
  }

  async addTeamMember(member: InsertTeamMember, userId?: string): Promise<TeamMember> {
    const id = await getNextId("team_members");
    const newMember = { ...member, id, createdAt: new Date() };
    await db.collection("team_members").doc(id.toString()).set(newMember);
    return newMember;
  }

  async removeTeamMember(id: number, userId?: string): Promise<void> {
    await db.collection("team_members").doc(id.toString()).delete();
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    const snap = await db.collection("team_members").where("userId", "==", userId).get();
    const teamIds = Array.from(new Set(snap.docs.map((d) => d.data().teamId)));
    const teams: Team[] = [];
    for (const tid of teamIds) {
      if (typeof tid === "number" || typeof tid === "string") {
        const tdoc = await db.collection("teams").doc(tid.toString()).get();
        if (tdoc.exists) teams.push(convertDates({ id: Number(tdoc.id), ...tdoc.data() }));
      }
    }
    return teams;
  }

  async generateWebhookApiKey(
    userId: string
  ): Promise<{ apiKey: string; hash: string; suffix: string }> {
    const apiKey = `sk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const hash = apiKey; // Stub: use actual hash in production
    const suffix = apiKey.slice(-4);
    await db.collection("users").doc(userId).update({
      webhookApiKeyHash: hash,
      webhookApiKeySuffix: suffix,
      webhookApiKeyCreatedAt: new Date(),
    });
    return { apiKey, hash, suffix };
  }

  async getUserByWebhookApiKeyHash(hash: string): Promise<User | undefined> {
    const snap = await db.collection("users").where("webhookApiKeyHash", "==", hash).limit(1).get();
    return snap.empty ? undefined : convertDates({ id: snap.docs[0].id, ...snap.docs[0].data() });
  }

  async updateWebhookApiKeyLastUsed(hash: string): Promise<void> {
    const snap = await db.collection("users").where("webhookApiKeyHash", "==", hash).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ webhookApiKeyLastUsedAt: new Date() });
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0;
  }

  async createLenderEnquiry(data: any): Promise<any> {
    const id = await getNextId("lender_enquiries");
    const enquiry = { ...data, id, createdAt: new Date() };
    await db.collection("lender_enquiries").doc(id.toString()).set(enquiry);
    return enquiry;
  }

  // --- Chat ---
  async createChannel(channel: InsertChannel): Promise<Channel> {
    const id = await getNextId("channels");
    const newChannel = {
      ...channel,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    };
    await db.collection("channels").doc(id.toString()).set(newChannel);
    return newChannel as Channel;
  }

  async getChannel(channelId: number): Promise<Channel | undefined> {
    const doc = await db.collection("channels").doc(channelId.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) : undefined;
  }

  async getChannelsForUser(userId: string): Promise<Channel[]> {
    // 1. Get channel IDs from members
    const memberSnap = await db.collection("channel_members").where("userId", "==", userId).get();
    const channelIds = memberSnap.docs.map((d) => d.data().channelId);

    if (channelIds.length === 0) return [];

    // 2. Fetch channels (chunking if needed, but assuming small scale for now)
    // Firestore 'in' limitation: max 10. We'll fetch individually or batch if needed.
    // For simplicity/speed in MVP, let's fetch individually in parallel.
    const channels = await Promise.all(channelIds.map((cid) => this.getChannel(cid)));
    // Sort by lastMessageAt descending
    return (channels.filter((c) => c !== undefined) as Channel[]).sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  }

  async addChannelMember(member: InsertChannelMember): Promise<void> {
    const id = await getNextId("channel_members");
    const newMember = { ...member, id, joinedAt: new Date(), lastReadAt: new Date() };
    await db.collection("channel_members").doc(id.toString()).set(newMember);
  }

  async listChannelMembers(channelId: number): Promise<ChannelMember[]> {
    const snap = await db.collection("channel_members").where("channelId", "==", channelId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = await getNextId("messages");
    const newMessage = { ...message, id, createdAt: new Date() };

    await db.runTransaction(async (t) => {
      // Create message
      const msgRef = db.collection("messages").doc(id.toString());
      t.set(msgRef, newMessage);

      // Update channel last message time
      const channelRef = db.collection("channels").doc(message.channelId.toString());
      t.update(channelRef, { lastMessageAt: new Date() });
    });

    return newMessage as Message;
  }

  async getMessages(channelId: number): Promise<Message[]> {
    const snap = await db
      .collection("messages")
      .where("channelId", "==", channelId)
      .orderBy("createdAt", "asc")
      .limit(50) // Pagination later
      .get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  // --- Communications Module ---

  async getCommunicationIntegrations(userId: string): Promise<CommunicationIntegration[]> {
    const snap = await db
      .collection("communication_integrations")
      .where("userId", "==", userId)
      .get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async saveCommunicationIntegration(
    integration: InsertCommunicationIntegration
  ): Promise<CommunicationIntegration> {
    const snap = await db
      .collection("communication_integrations")
      .where("userId", "==", integration.userId)
      .where("provider", "==", integration.provider)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      // Simple merge update
      const updates = { ...integration };
      delete (updates as any).createdAt; // Scan schema to be sure, but safe to delete

      await doc.ref.update(updates);
      const currentData = convertDates({ id: Number(doc.id), ...doc.data() });
      return { ...currentData, ...updates } as CommunicationIntegration;
    }

    const id = await getNextId("communication_integrations");
    const newIntegration = { ...integration, id, createdAt: new Date() };
    await db.collection("communication_integrations").doc(id.toString()).set(newIntegration);
    return newIntegration as CommunicationIntegration;
  }

  async getCommunicationTemplates(userId: string): Promise<CommunicationTemplate[]> {
    const snap = await db.collection("communication_templates").where("userId", "==", userId).get();
    return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }));
  }

  async createCommunicationTemplate(
    template: InsertCommunicationTemplate
  ): Promise<CommunicationTemplate> {
    const id = await getNextId("communication_templates");
    const newTemplate = { ...template, id, createdAt: new Date() };
    await db.collection("communication_templates").doc(id.toString()).set(newTemplate);
    return newTemplate as CommunicationTemplate;
  }

  async updateCommunicationTemplate(
    id: number,
    template: Partial<InsertCommunicationTemplate>
  ): Promise<CommunicationTemplate> {
    const ref = db.collection("communication_templates").doc(id.toString());
    await ref.update({ ...template });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as CommunicationTemplate;
  }

  async logCommunication(log: InsertCommunicationLog): Promise<CommunicationLog> {
    const id = await getNextId("communication_logs");
    const newLog = { ...log, id, sentAt: new Date() };
    await db.collection("communication_logs").doc(id.toString()).set(newLog);
    return newLog as CommunicationLog;
  }

  async getCommunicationHistory(prospectId: number): Promise<CommunicationLog[]> {
    const snap = await db
      .collection("communication_logs")
      .where("prospectId", "==", prospectId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map(
      (d) => convertDates({ id: Number(d.id), ...d.data() }) as CommunicationLog
    );
  }

  // --- External Sales CRM (God Mode) ---

  async listInternalLeads(): Promise<InternalLead[]> {
    try {
      const snap = await db.collection("internal_leads").orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }) as InternalLead);
    } catch (e) {
      console.error("DB Error listInternalLeads", e);
      return [];
    }
  }

  async getInternalLead(id: number): Promise<InternalLead | undefined> {
    const snap = await db.collection("internal_leads").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() }) as InternalLead;
  }

  async getInternalLeadByCompanyNumber(companyNumber: string): Promise<InternalLead | undefined> {
    const snap = await db.collection("internal_leads").where("companyNumber", "==", companyNumber).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() }) as InternalLead;
  }

  async createInternalLead(lead: InsertInternalLead): Promise<InternalLead> {
    const id = await getNextId("internal_leads");
    const newLead = { ...lead, id, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("internal_leads").doc(id.toString()).set(newLead);
    return newLead as InternalLead;
  }

  async updateInternalLead(
    id: number,
    updates: Partial<InsertInternalLead>
  ): Promise<InternalLead | undefined> {
    const snap = await db.collection("internal_leads").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return this.getInternalLead(id);
  }

  async deleteInternalLead(id: number): Promise<void> {
    const snap = await db.collection("internal_leads").where("id", "==", id).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.delete();
    }
  }

  async clearAllInternalLeads(): Promise<void> {
    const snap = await db.collection("internal_leads").get();
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  async listCommissions(): Promise<Commission[]> {
    try {
      const snap = await db.collection("commissions").orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }) as Commission);
    } catch (e) {
      console.error("DB Error listCommissions", e);
      return [];
    }
  }

  async getAgentCommissions(agentId: string): Promise<Commission[]> {
    try {
      const snap = await db
        .collection("commissions")
        .where("agentId", "==", agentId)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map((d) => convertDates({ id: Number(d.id), ...d.data() }) as Commission);
    } catch (e) {
      console.error("DB Error getAgentCommissions", e);
      return [];
    }
  }

  async createCommission(commission: InsertCommission): Promise<Commission> {
    const id = await getNextId("commissions");
    const newCommission = { ...commission, id, createdAt: new Date() };
    await db.collection("commissions").doc(id.toString()).set(newCommission);
    return newCommission as Commission;
  }

  async updateCommission(
    id: number,
    updates: Partial<InsertCommission>
  ): Promise<Commission | undefined> {
    const snap = await db.collection("commissions").where("id", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    await snap.docs[0].ref.update({ ...updates });
    // Refetch
    const updatedSnap = await db.collection("commissions").where("id", "==", id).limit(1).get();
    return updatedSnap.empty
      ? undefined
      : (convertDates({
        id: Number(updatedSnap.docs[0].id),
        ...updatedSnap.docs[0].data(),
      }) as Commission);
  }

  // Marketing Contacts
  async listMarketingContacts(userId: string): Promise<MarketingContact[]> {
    try {
      const snap = await db
        .collection("marketing_contacts")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
      return snap.docs.map(
        (d) => convertDates({ id: Number(d.id), ...d.data() }) as MarketingContact
      );
    } catch (e) {
      console.error("DB Error listMarketingContacts", e);
      return [];
    }
  }

  async getMarketingContactByEmail(
    email: string,
    userId: string
  ): Promise<MarketingContact | undefined> {
    try {
      const snap = await db
        .collection("marketing_contacts")
        .where("userId", "==", userId)
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();
      if (snap.empty) return undefined;
      return convertDates({
        id: Number(snap.docs[0].id),
        ...snap.docs[0].data(),
      }) as MarketingContact;
    } catch (e) {
      console.error("DB Error getMarketingContactByEmail", e);
      return undefined;
    }
  }

  async createOrUpdateMarketingContact(
    contact: InsertMarketingContact,
    userId: string
  ): Promise<MarketingContact> {
    const existing = await this.getMarketingContactByEmail(contact.email, userId);

    if (existing) {
      const updates = {
        ...contact,
        updatedAt: new Date(),
      };
      await db.collection("marketing_contacts").doc(existing.id.toString()).update(updates);
      return { ...existing, ...updates } as MarketingContact;
    }

    const id = await getNextId("marketing_contacts");
    const newContact = {
      ...contact,
      id,
      userId,
      email: contact.email.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("marketing_contacts").doc(id.toString()).set(newContact);
    return newContact as MarketingContact;
  }

  // --- Waitlist ---

  async listWaitlistEntries(): Promise<WaitlistEntry[]> {
    try {
      const snap = await db.collection("waitlist").orderBy("createdAt", "desc").get();
      return snap.docs.map(
        (d) => convertDates({ id: Number(d.id), ...d.data() }) as WaitlistEntry
      );
    } catch (e) {
      console.error("DB Error listWaitlistEntries", e);
      return [];
    }
  }

  async getWaitlistEntryByEmail(email: string): Promise<WaitlistEntry | undefined> {
    try {
      const snap = await db.collection("waitlist").where("email", "==", email.toLowerCase()).limit(1).get();
      if (snap.empty) return undefined;
      const d = snap.docs[0];
      return convertDates({ id: Number(d.id), ...d.data() }) as WaitlistEntry;
    } catch (e) {
      console.error("DB Error getWaitlistEntryByEmail", e);
      return undefined;
    }
  }

  async createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const id = await getNextId("waitlist");
    const newEntry = {
      ...entry,
      id,
      email: entry.email.toLowerCase(),
      status: entry.status || "pending",
      source: entry.source || "landing",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("waitlist").doc(id.toString()).set(newEntry);
    return newEntry as WaitlistEntry;
  }

  async updateWaitlistEntryStatus(id: number, status: string): Promise<void> {
    await db.collection("waitlist").doc(id.toString()).update({ status, updatedAt: new Date() });
  }

  async unsubscribeWaitlistEntry(email: string): Promise<boolean> {
    const entry = await this.getWaitlistEntryByEmail(email.toLowerCase());
    if (!entry) return false;
    await db.collection("waitlist").doc(entry.id.toString()).update({ unsubscribed: true, updatedAt: new Date() });
    return true;
  }

  // --- Agents ---
  async getAgents(): Promise<DigitalAssociate[]> {
    try {
      const snap = await db.collection("agents").get();
      return snap.docs.map(
        (doc: any) => convertDates({ id: doc.id, ...doc.data() }) as DigitalAssociate
      );
    } catch (e) {
      console.error("DB Error getAgents", e);
      return [];
    }
  }

  async getAgentById(id: string): Promise<DigitalAssociate | undefined> {
    try {
      const doc = await db.collection("agents").doc(id).get();
      if (!doc.exists) return undefined;
      return convertDates({ id: doc.id, ...doc.data() }) as DigitalAssociate;
    } catch (e) {
      console.error("DB Error getAgentById", e);
      return undefined;
    }
  }

  async updateAgent(id: string, updates: Partial<DigitalAssociate>): Promise<DigitalAssociate> {
    const ref = db.collection("agents").doc(id);
    await ref.set({ ...updates, updatedAt: new Date() }, { merge: true });
    const updated = await this.getAgentById(id);
    if (!updated) throw new Error("Failed to fetch updated agent");
    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.collection("agents").doc(id).delete();
  }

  async logMissionDeviation(deviation: Omit<MissionDeviation, "id">): Promise<MissionDeviation> {
    const ref = db.collection("mission_deviations").doc();
    const newDeviation = {
      ...deviation,
      id: ref.id,
      timestamp: deviation.timestamp || new Date(),
    };
    await ref.set(newDeviation);
    return newDeviation as MissionDeviation;
  }

  async getMissionDeviations(agentId?: string): Promise<MissionDeviation[]> {
    try {
      let query: any = db.collection("mission_deviations");
      if (agentId) {
        query = query.where("agentId", "==", agentId);
      }
      const snap = await query.orderBy("timestamp", "desc").get();
      return snap.docs.map(
        (doc: any) => convertDates({ id: doc.id, ...doc.data() }) as MissionDeviation
      );
    } catch (e) {
      console.error("DB Error getMissionDeviations", e);
      return [];
    }
  }

  // --- Agent Chat History ---
  async saveAgentChatMessage(
    agentId: string,
    userId: string,
    message: Omit<AgentChatMessage, "id">
  ): Promise<AgentChatMessage> {
    const ref = db.collection("agent_chats").doc();
    const newMessage: AgentChatMessage = {
      ...message,
      id: ref.id,
      timestamp: message.timestamp || new Date(),
    };
    await ref.set({
      ...newMessage,
      agentId,
      userId,
    });
    console.log(`[Chat] Saved message for agent ${agentId}, user ${userId}`);
    return newMessage;
  }

  async getAgentChatHistory(
    agentId: string,
    userId: string,
    limit: number = 50
  ): Promise<AgentChatMessage[]> {
    try {
      const snap = await db
        .collection("agent_chats")
        .where("agentId", "==", agentId)
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const messages = snap.docs
        .map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            metadata: data.metadata,
          } as AgentChatMessage;
        })
        .reverse(); // Return in chronological order

      console.log(
        `[Chat] Retrieved ${messages.length} messages for agent ${agentId}, user ${userId}`
      );
      return messages;
    } catch (e) {
      console.error("DB Error getAgentChatHistory", e);
      return [];
    }
  }

  async clearAgentChatHistory(agentId: string, userId: string): Promise<void> {
    try {
      const snap = await db
        .collection("agent_chats")
        .where("agentId", "==", agentId)
        .where("userId", "==", userId)
        .get();

      const batch = db.batch();
      snap.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      console.log(`[Chat] Cleared history for agent ${agentId}, user ${userId}`);
    } catch (e) {
      console.error("DB Error clearAgentChatHistory", e);
      throw e;
    }
  }

  // --- Scraped Leads ---
  async createScrapedLead(lead: InsertScrapedLead): Promise<ScrapedLead> {
    const id = await getNextId("scraped_leads");
    const newLead = {
      ...lead,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection("scraped_leads").doc(id.toString()).set(newLead);
    return newLead as ScrapedLead;
  }

  async listScrapedLeads(status?: string): Promise<ScrapedLead[]> {
    let query = db.collection("scraped_leads").orderBy("score", "desc"); // Show highest score first

    if (status) {
      query = query.where("status", "==", status);
    }

    // Limit to latest 50 for dashboard performance
    const snap = await query.limit(50).get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as ScrapedLead);
  }

  async getScrapedLead(id: number): Promise<ScrapedLead | undefined> {
    const doc = await db.collection("scraped_leads").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) as ScrapedLead : undefined;
  }

  async updateScrapedLead(id: number, updates: Partial<InsertScrapedLead>): Promise<ScrapedLead> {
    const ref = db.collection("scraped_leads").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as ScrapedLead;
  }

  // --- Campaigns ---
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const id = await getNextId("campaigns");
    const newCampaign = {
      ...campaign,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      leadsFound: 0,
      lastRun: null
    };
    await db.collection("campaigns").doc(id.toString()).set(newCampaign);
    return newCampaign as Campaign;
  }

  async listCampaigns(): Promise<Campaign[]> {
    const snap = await db.collection("campaigns").orderBy("priority", "desc").get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as Campaign);
  }

  async updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign> {
    const ref = db.collection("campaigns").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    const doc = await ref.get();
    return convertDates({ id: Number(doc.id), ...doc.data() }) as Campaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    await db.collection("campaigns").doc(id.toString()).delete();
  }

  // --- Prospect Documents ---
  async listProspectDocuments(prospectId: number, userId?: string): Promise<ProspectDocument[]> {
    try {
      let query = db.collection("prospect_documents").where("prospectId", "==", prospectId);
      // userId check optional depending on ACL needs, but good for security
      // if (userId) query = query.where("userId", "==", userId);

      const snap = await query.orderBy("createdAt", "desc").get();
      return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as ProspectDocument);
    } catch (e) {
      console.error("DB Error listProspectDocuments", e);
      return [];
    }
  }

  async getProspectDocument(id: number, userId?: string): Promise<ProspectDocument | undefined> {
    const doc = await db.collection("prospect_documents").doc(id.toString()).get();
    if (!doc.exists) return undefined;
    // Optional userId check
    // const data = doc.data();
    // if (userId && data?.userId !== userId) return undefined;
    return convertDates({ id: Number(doc.id), ...doc.data() }) as ProspectDocument;
  }

  async createProspectDocument(doc: InsertProspectDocument, userId?: string): Promise<ProspectDocument> {
    const id = await getNextId("prospect_documents");
    const newDoc = {
      ...doc,
      id,
      userId: userId || doc.userId,
      uploadedAt: new Date(),
      createdAt: new Date(),
      status: "pending"
    };
    await db.collection("prospect_documents").doc(id.toString()).set(newDoc);
    return newDoc as ProspectDocument;
  }

  async updateProspectDocument(id: number, updates: Partial<ProspectDocument>, userId?: string): Promise<ProspectDocument | undefined> {
    const ref = db.collection("prospect_documents").doc(id.toString());
    const snap = await ref.get();
    if (!snap.exists) return undefined;

    // Optional: verify user ownership if userId provided

    await ref.update({ ...updates, updatedAt: new Date() }); // Assume updatedAt not in schema but good practice
    const updated = await ref.get();
    return convertDates({ id: Number(updated.id), ...updated.data() }) as ProspectDocument;
  }

  async deleteProspectDocument(id: number, userId?: string): Promise<void> {
    // Optional userId check first
    await db.collection("prospect_documents").doc(id.toString()).delete();
  }

  // --- Broker CRM ---
  async listBrokerLeads(): Promise<BrokerLead[]> {
    try {
      const snap = await db.collection("broker_leads").orderBy("createdAt", "desc").get();
      return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as BrokerLead);
    } catch (e) {
      console.error("DB Error listBrokerLeads", e);
      return [];
    }
  }

  async getBrokerLead(id: number): Promise<BrokerLead | undefined> {
    const doc = await db.collection("broker_leads").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) as BrokerLead : undefined;
  }

  async getBrokerLeadByCompanyNumber(companyNumber: string): Promise<BrokerLead | undefined> {
    const snap = await db.collection("broker_leads").where("companyNumber", "==", companyNumber).limit(1).get();
    if (snap.empty) return undefined;
    return convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() }) as BrokerLead;
  }

  async createBrokerLead(lead: InsertBrokerLead): Promise<BrokerLead> {
    const id = await getNextId("broker_leads");
    const newLead = { ...lead, id, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("broker_leads").doc(id.toString()).set(newLead);
    return newLead as BrokerLead;
  }

  async updateBrokerLead(id: number, updates: Partial<InsertBrokerLead>): Promise<BrokerLead | undefined> {
    const ref = db.collection("broker_leads").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return this.getBrokerLead(id);
  }

  async deleteBrokerLead(id: number): Promise<void> {
    await db.collection("broker_leads").doc(id.toString()).delete();
  }

  async clearAllBrokerLeads(): Promise<void> {
    const batch = db.batch();
    const snap = await db.collection("broker_leads").get();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async listBrokerCommissions(): Promise<BrokerCommission[]> {
    const snap = await db.collection("broker_commissions").orderBy("createdAt", "desc").get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as BrokerCommission);
  }

  async getBrokerAgentCommissions(agentId: string): Promise<BrokerCommission[]> {
    const snap = await db.collection("broker_commissions").where("agentId", "==", agentId).orderBy("createdAt", "desc").get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as BrokerCommission);
  }

  async createBrokerCommission(commission: InsertBrokerCommission): Promise<BrokerCommission> {
    const id = await getNextId("broker_commissions");
    const newCommission = { ...commission, id, createdAt: new Date() };
    await db.collection("broker_commissions").doc(id.toString()).set(newCommission);
    return newCommission as BrokerCommission;
  }

  async updateBrokerCommission(id: number, updates: Partial<InsertBrokerCommission>): Promise<BrokerCommission | undefined> {
    const ref = db.collection("broker_commissions").doc(id.toString());
    await ref.update(updates);
    return convertDates({ id, ...(await ref.get()).data() }) as BrokerCommission;
  }

  async createBrokerScrapedLead(lead: InsertBrokerScrapedLead): Promise<BrokerScrapedLead> {
    const id = await getNextId("broker_scraped_leads");
    const newLead = { ...lead, id, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("broker_scraped_leads").doc(id.toString()).set(newLead);
    return newLead as BrokerScrapedLead;
  }

  async listBrokerScrapedLeads(status?: string): Promise<BrokerScrapedLead[]> {
    let query: any = db.collection("broker_scraped_leads");
    if (status) query = query.where("status", "==", status);
    const snap = await query.orderBy("createdAt", "desc").get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as BrokerScrapedLead);
  }

  async getBrokerScrapedLead(id: number): Promise<BrokerScrapedLead | undefined> {
    const doc = await db.collection("broker_scraped_leads").doc(id.toString()).get();
    return doc.exists ? convertDates({ id: Number(doc.id), ...doc.data() }) as BrokerScrapedLead : undefined;
  }

  async updateBrokerScrapedLead(id: number, updates: Partial<InsertBrokerScrapedLead>): Promise<BrokerScrapedLead> {
    const ref = db.collection("broker_scraped_leads").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return this.getBrokerScrapedLead(id) as Promise<BrokerScrapedLead>;
  }

  async createBrokerCampaign(campaign: InsertBrokerCampaign): Promise<BrokerCampaign> {
    const id = await getNextId("broker_campaigns");
    const newCampaign = { ...campaign, id, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("broker_campaigns").doc(id.toString()).set(newCampaign);
    return newCampaign as BrokerCampaign;
  }

  async listBrokerCampaigns(): Promise<BrokerCampaign[]> {
    const snap = await db.collection("broker_campaigns").orderBy("createdAt", "desc").get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as BrokerCampaign);
  }

  async updateBrokerCampaign(id: number, updates: Partial<BrokerCampaign>): Promise<BrokerCampaign> {
    const ref = db.collection("broker_campaigns").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return convertDates({ id, ...(await ref.get()).data() }) as BrokerCampaign;
  }

  async deleteBrokerCampaign(id: number): Promise<void> {
    await db.collection("broker_campaigns").doc(id.toString()).delete();
  }

  // --- Invoices ---

  async listInvoices(userId: string): Promise<Invoice[]> {
    const snap = await db.collection("invoices")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as Invoice);
  }

  async getInvoice(id: number, userId: string): Promise<Invoice | undefined> {
    const snap = await db.collection("invoices")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    return convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() }) as Invoice;
  }

  async createInvoice(invoice: InsertInvoice, userId: string): Promise<Invoice> {
    const id = await getNextId("invoices");
    const newInvoice = {
      ...invoice,
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("invoices").doc(id.toString()).set(newInvoice);
    return newInvoice as Invoice;
  }

  async updateInvoice(id: number, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const existing = await this.getInvoice(id, userId);
    if (!existing) return undefined;
    const ref = db.collection("invoices").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return convertDates({ id, ...(await ref.get()).data() }) as Invoice;
  }

  async deleteInvoice(id: number, userId: string): Promise<void> {
    const existing = await this.getInvoice(id, userId);
    if (!existing) return;
    await db.collection("invoices").doc(id.toString()).delete();
  }

  async getNextInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const snap = await db.collection("invoices")
      .where("userId", "==", userId)
      .orderBy("id", "desc")
      .limit(1)
      .get();
    const lastNum = snap.empty ? 0 : (snap.docs[0].data().id || 0);
    const seq = (lastNum % 1000) + 1;
    return `INV-${year}-${String(seq).padStart(3, "0")}`;
  }

  // --- Expenses ---

  async listExpenses(userId: string): Promise<Expense[]> {
    const snap = await db.collection("expenses")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .get();
    return snap.docs.map((d: any) => convertDates({ id: Number(d.id), ...d.data() }) as Expense);
  }

  async getExpense(id: number, userId: string): Promise<Expense | undefined> {
    const snap = await db.collection("expenses")
      .where("id", "==", id)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    return convertDates({ id: Number(snap.docs[0].id), ...snap.docs[0].data() }) as Expense;
  }

  async createExpense(expense: InsertExpense, userId: string): Promise<Expense> {
    const id = await getNextId("expenses");
    const newExpense = {
      ...expense,
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("expenses").doc(id.toString()).set(newExpense);
    return newExpense as Expense;
  }

  async updateExpense(id: number, userId: string, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const existing = await this.getExpense(id, userId);
    if (!existing) return undefined;
    const ref = db.collection("expenses").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return convertDates({ id, ...(await ref.get()).data() }) as Expense;
  }

  async deleteExpense(id: number, userId: string): Promise<void> {
    const existing = await this.getExpense(id, userId);
    if (!existing) return;
    await db.collection("expenses").doc(id.toString()).delete();
  }

  // ---- Email Templates ----

  async listEmailTemplates(userId: string): Promise<EmailTemplate[]> {
    try {
      const snap = await db
        .collection("email_templates")
        .where("userId", "==", userId)
        .get();
      const templates = snap.docs.map(
        (d) => convertDates({ id: Number(d.id), ...d.data() }) as EmailTemplate
      );
      return templates.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return dateB - dateA;
      });
    } catch (e) {
      console.error("DB Error listEmailTemplates", e);
      return [];
    }
  }

  async getEmailTemplate(id: number, userId: string): Promise<EmailTemplate | undefined> {
    try {
      const doc = await db.collection("email_templates").doc(id.toString()).get();
      if (!doc.exists) return undefined;
      const data = convertDates({ id: Number(doc.id), ...doc.data() }) as EmailTemplate;
      if (data.userId !== userId) return undefined;
      return data;
    } catch (e) {
      console.error("DB Error getEmailTemplate", e);
      return undefined;
    }
  }

  async createEmailTemplate(template: InsertEmailTemplate, userId: string): Promise<EmailTemplate> {
    const id = await getNextId("email_templates");
    const now = new Date();
    const newTemplate = {
      ...template,
      id,
      userId,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("email_templates").doc(id.toString()).set(newTemplate);
    return newTemplate as EmailTemplate;
  }

  async updateEmailTemplate(id: number, userId: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const existing = await this.getEmailTemplate(id, userId);
    if (!existing) return undefined;
    const ref = db.collection("email_templates").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return convertDates({ id, ...(await ref.get()).data() }) as EmailTemplate;
  }

  async deleteEmailTemplate(id: number, userId: string): Promise<void> {
    const existing = await this.getEmailTemplate(id, userId);
    if (!existing) return;
    await db.collection("email_templates").doc(id.toString()).delete();
  }

  async duplicateEmailTemplate(id: number, userId: string): Promise<EmailTemplate> {
    const original = await this.getEmailTemplate(id, userId);
    if (!original) throw new Error("Template not found");
    const newId = await getNextId("email_templates");
    const now = new Date();
    const duplicate = {
      ...original,
      id: newId,
      name: `Copy of ${original.name}`,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("email_templates").doc(newId.toString()).set(duplicate);
    return duplicate as EmailTemplate;
  }

  // ---- Email Campaigns ----

  async listEmailCampaigns(userId: string): Promise<EmailCampaign[]> {
    try {
      const snap = await db
        .collection("email_campaigns")
        .where("userId", "==", userId)
        .get();
      const campaigns = snap.docs.map(
        (d) => convertDates({ id: Number(d.id), ...d.data() }) as EmailCampaign
      );
      return campaigns.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return dateB - dateA;
      });
    } catch (e) {
      console.error("DB Error listEmailCampaigns", e);
      return [];
    }
  }

  async getEmailCampaign(id: number, userId: string): Promise<EmailCampaign | undefined> {
    try {
      const doc = await db.collection("email_campaigns").doc(id.toString()).get();
      if (!doc.exists) return undefined;
      const data = convertDates({ id: Number(doc.id), ...doc.data() }) as EmailCampaign;
      if (data.userId !== userId) return undefined;
      return data;
    } catch (e) {
      console.error("DB Error getEmailCampaign", e);
      return undefined;
    }
  }

  async createEmailCampaign(campaign: InsertEmailCampaign, userId: string): Promise<EmailCampaign> {
    const id = await getNextId("email_campaigns");
    const now = new Date();
    const newCampaign = {
      ...campaign,
      id,
      userId,
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      totalUnsubscribed: 0,
      totalFailed: 0,
      sentAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("email_campaigns").doc(id.toString()).set(newCampaign);
    return newCampaign as EmailCampaign;
  }

  async updateEmailCampaign(id: number, userId: string, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined> {
    const existing = await this.getEmailCampaign(id, userId);
    if (!existing) return undefined;
    const ref = db.collection("email_campaigns").doc(id.toString());
    await ref.update({ ...updates, updatedAt: new Date() });
    return convertDates({ id, ...(await ref.get()).data() }) as EmailCampaign;
  }

  async deleteEmailCampaign(id: number, userId: string): Promise<void> {
    const existing = await this.getEmailCampaign(id, userId);
    if (!existing) return;
    await db.collection("email_campaigns").doc(id.toString()).delete();
  }

  // ---- Campaign Recipients ----

  async listCampaignRecipients(campaignId: number, userId: string): Promise<CampaignRecipient[]> {
    try {
      const snap = await db
        .collection("campaign_recipients")
        .where("campaignId", "==", campaignId)
        .where("userId", "==", userId)
        .get();
      const recipients = snap.docs.map(
        (d) => convertDates({ id: Number(d.id), ...d.data() }) as CampaignRecipient
      );
      return recipients.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return dateB - dateA;
      });
    } catch (e) {
      console.error("DB Error listCampaignRecipients", e);
      return [];
    }
  }

  async addCampaignRecipients(recipients: InsertCampaignRecipient[]): Promise<CampaignRecipient[]> {
    const results: CampaignRecipient[] = [];
    const batchSize = 500;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = db.batch();
      const chunk = recipients.slice(i, i + batchSize);
      for (const recipient of chunk) {
        const id = await getNextId("campaign_recipients");
        const now = new Date();
        const newRecipient = {
          ...recipient,
          id,
          sentAt: null,
          openedAt: null,
          clickedAt: null,
          bouncedAt: null,
          createdAt: now,
        };
        batch.set(db.collection("campaign_recipients").doc(id.toString()), newRecipient);
        results.push(newRecipient as CampaignRecipient);
      }
      await batch.commit();
    }
    return results;
  }

  async getCampaignRecipientById(id: number): Promise<CampaignRecipient | undefined> {
    try {
      const doc = await db.collection("campaign_recipients").doc(id.toString()).get();
      if (!doc.exists) return undefined;
      return convertDates({ id, ...doc.data() }) as CampaignRecipient;
    } catch (e) {
      console.error("DB Error getCampaignRecipientById", e);
      return undefined;
    }
  }

  async updateCampaignRecipient(id: number, updates: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined> {
    try {
      const ref = db.collection("campaign_recipients").doc(id.toString());
      const doc = await ref.get();
      if (!doc.exists) return undefined;
      await ref.update(updates);
      return convertDates({ id, ...(await ref.get()).data() }) as CampaignRecipient;
    } catch (e) {
      console.error("DB Error updateCampaignRecipient", e);
      return undefined;
    }
  }

  async clearCampaignRecipients(campaignId: number, userId: string): Promise<void> {
    try {
      const snap = await db
        .collection("campaign_recipients")
        .where("campaignId", "==", campaignId)
        .where("userId", "==", userId)
        .get();
      const batchSize = 500;
      for (let i = 0; i < snap.docs.length; i += batchSize) {
        const batch = db.batch();
        snap.docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (e) {
      console.error("DB Error clearCampaignRecipients", e);
    }
  }
}

export type UnderwritingSummary = any;

export const lenderEnquiries = {
  id: "lenderEnquiries", // Stub for now
};

export const storage = new FirestoreStorage();
