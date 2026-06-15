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

  // Commissions
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
  updateEmailCampaign(id: number, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined>;
  deleteEmailCampaign(id: number, userId: string): Promise<void>;

  // Campaign Recipients
  listCampaignRecipients(campaignId: number, userId: string): Promise<CampaignRecipient[]>;
  addCampaignRecipients(recipients: InsertCampaignRecipient[]): Promise<CampaignRecipient[]>;
  getCampaignRecipientById(id: number): Promise<CampaignRecipient | undefined>;
  updateCampaignRecipient(id: number, updates: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined>;
  clearCampaignRecipients(campaignId: number, userId: string): Promise<void>;
}

export type UnderwritingSummary = any;
export const lenderEnquiries = { id: "lenderEnquiries" };

import { SQLiteStorage } from "./sqliteStorage";
export const storage: IStorage = new SQLiteStorage();
