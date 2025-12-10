import {
  companies,
  prospects,
  users,
  contacts,
  activities,
  dueDiligence,
  lenders,
  applicationSubmissions,
  emailInboxes,
  emailMessages,
  leadUploads,
  leads,
  underwritingSubmissions,
  underwritingActivity,
  prospectDocuments,
  teams,
  teamMembers,
  type Company,
  type InsertCompany,
  type Prospect,
  type InsertProspect,
  type ProspectWithCompany,
  type User,
  type UpsertUser,
  type Contact,
  type InsertContact,
  type Activity,
  type InsertActivity,
  type DueDiligence,
  type DueDiligenceData,
  type Lender,
  type InsertLender,
  type ApplicationSubmission,
  type InsertApplicationSubmission,
  type EmailInbox,
  type InsertEmailInbox,
  type EmailMessage,
  type InsertEmailMessage,
  type LeadUpload,
  type InsertLeadUpload,
  type Lead,
  type InsertLead,
  type UpdateLead,
  type UnderwritingSubmission,
  type InsertUnderwritingSubmission,
  type UpdateUnderwritingSubmission,
  type UnderwritingActivity,
  type InsertUnderwritingActivity,
  type ProspectDocument,
  type InsertProspectDocument,
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type AddOnProduct,
  type InsertAddOnProduct,
  type UpdateAddOnProduct,
  type AddOnPurchase,
  type InsertAddOnPurchase,
  addOnProducts,
  addOnPurchases,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";

export interface IStorage {
  // Users - required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Companies
  getCompanyByNumber(companyNumber: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined>;

  // Prospects
  listProspects(userId: string): Promise<ProspectWithCompany[]>;
  getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined>;
  getProspectById(id: number): Promise<ProspectWithCompany | undefined>;
  createProspect(prospect: InsertProspect, userId: string): Promise<Prospect>;
  updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined>;
  updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined>;
  deleteProspect(id: number, userId: string): Promise<void>;

  // Contacts
  listContacts(prospectId: number): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;

  // Activities
  listActivities(prospectId: number): Promise<Activity[]>;
  listAllUserActivities(userId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, updates: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: number): Promise<void>;

  // Due Diligence
  getDueDiligence(prospectId: number): Promise<DueDiligence | undefined>;
  upsertDueDiligence(prospectId: number, data: DueDiligenceData): Promise<DueDiligence>;

  // Lenders
  listLenders(userId: string): Promise<Lender[]>;
  getLender(id: number, userId: string): Promise<Lender | undefined>;
  createLender(lender: InsertLender, userId: string): Promise<Lender>;
  updateLender(id: number, userId: string, updates: Partial<InsertLender>): Promise<Lender | undefined>;
  deleteLender(id: number, userId: string): Promise<void>;

  // Application Submissions
  listApplicationSubmissions(userId: string): Promise<ApplicationSubmission[]>;
  getApplicationSubmission(id: number, userId: string): Promise<ApplicationSubmission | undefined>;
  createApplicationSubmission(submission: InsertApplicationSubmission, userId: string): Promise<ApplicationSubmission>;
  updateApplicationSubmission(id: number, userId: string, updates: Partial<InsertApplicationSubmission>): Promise<ApplicationSubmission | undefined>;
  deleteApplicationSubmission(id: number, userId: string): Promise<void>;

  // Email Inboxes
  getEmailInbox(userId: string): Promise<EmailInbox | undefined>;
  createEmailInbox(inbox: InsertEmailInbox): Promise<EmailInbox>;

  // Email Messages
  listEmailMessages(inboxId: number): Promise<EmailMessage[]>;
  getEmailMessagesByInbox(inboxId: number): Promise<EmailMessage[]>;
  getEmailMessage(id: number): Promise<EmailMessage | undefined>;
  getEmailMessageByMessageId(messageId: string): Promise<EmailMessage | undefined>;
  createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage>;
  markEmailAsRead(id: number): Promise<void>;
  updateEmailMessageLink(id: number, updates: { contactId?: number | null; prospectId?: number | null }): Promise<EmailMessage | undefined>;
  getEmailMessagesForContact(inboxId: number, contactId: number): Promise<EmailMessage[]>;
  getEmailMessagesForProspect(inboxId: number, prospectId: number): Promise<EmailMessage[]>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;

  // Lead Uploads
  listLeadUploads(userId: string): Promise<LeadUpload[]>;
  getLeadUpload(id: number, userId: string): Promise<LeadUpload | undefined>;
  createLeadUpload(upload: InsertLeadUpload): Promise<LeadUpload>;
  updateLeadUpload(id: number, userId: string, updates: Partial<InsertLeadUpload>): Promise<LeadUpload | undefined>;

  // Leads
  listLeads(userId: string, filters?: { uploadId?: number; matchStatus?: string; search?: string }): Promise<Lead[]>;
  getLead(id: number, userId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead, userId: string): Promise<Lead>;
  createLeadsBulk(leads: InsertLead[], userId: string): Promise<Lead[]>;
  updateLead(id: number, userId: string, updates: UpdateLead): Promise<Lead | undefined>;
  deleteLead(id: number, userId: string): Promise<void>;
  deleteLeadsByUpload(uploadId: number, userId: string): Promise<void>;

  // Underwriting Submissions
  listUnderwritingSubmissions(filters?: { status?: string; assignedUnderwriterId?: string }): Promise<UnderwritingSubmission[]>;
  listBrokerUnderwritingSubmissions(brokerId: string): Promise<UnderwritingSubmission[]>;
  getUnderwritingSubmission(id: number): Promise<UnderwritingSubmission | undefined>;
  createUnderwritingSubmission(submission: InsertUnderwritingSubmission, brokerId: string): Promise<UnderwritingSubmission>;
  updateUnderwritingSubmission(id: number, updates: UpdateUnderwritingSubmission): Promise<UnderwritingSubmission | undefined>;
  claimUnderwritingSubmission(id: number, underwriterId: string): Promise<UnderwritingSubmission | undefined>;
  getUnderwritingSubmissionByProspect(prospectId: number): Promise<UnderwritingSubmission | undefined>;

  // Underwriting Activity
  listUnderwritingActivities(submissionId: number): Promise<UnderwritingActivity[]>;
  createUnderwritingActivity(activity: InsertUnderwritingActivity, userId: string): Promise<UnderwritingActivity>;

  // Prospect Documents
  listProspectDocuments(prospectId: number): Promise<ProspectDocument[]>;
  getProspectDocument(id: number): Promise<ProspectDocument | undefined>;
  createProspectDocument(document: InsertProspectDocument): Promise<ProspectDocument>;
  deleteProspectDocument(id: number): Promise<void>;

  // Teams
  getTeams(adminUserId?: string): Promise<Team[]>;
  getTeamWithMembers(teamId: number): Promise<(Team & { members: (TeamMember & { user: User })[] }) | undefined>;
  createTeam(team: InsertTeam, createdBy: string): Promise<Team>;
  updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<void>;

  // Team Members
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: number, userId: string): Promise<void>;
  getUserTeams(userId: string): Promise<Team[]>;
  getTeamMembers(teamId: number): Promise<(TeamMember & { user: User })[]>;

  // Add-On Products
  listAddOnProducts(activeOnly?: boolean): Promise<AddOnProduct[]>;
  getAddOnProduct(id: number): Promise<AddOnProduct | undefined>;
  createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct>;
  updateAddOnProduct(id: number, updates: UpdateAddOnProduct): Promise<AddOnProduct | undefined>;

  // Add-On Purchases
  listUserAddOnPurchases(userId: string): Promise<(AddOnPurchase & { product: AddOnProduct })[]>;
  getAddOnPurchase(id: number): Promise<AddOnPurchase | undefined>;
  getAddOnPurchaseByIdempotencyKey(key: string): Promise<AddOnPurchase | undefined>;
  createAddOnPurchase(purchase: InsertAddOnPurchase): Promise<AddOnPurchase>;
  updateAddOnPurchase(id: number, updates: Partial<AddOnPurchase>): Promise<AddOnPurchase | undefined>;
  getUserProspectCredits(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      // If there's a duplicate email error, fetch and return the existing user
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email));
        if (existingUser) {
          return existingUser;
        }
      }
      // Re-throw if it's a different error
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getCompanyByNumber(companyNumber: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.companyNumber, companyNumber));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(insertCompany as any)
      .returning();
    return company;
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set(updates as any)
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async listProspects(userId: string): Promise<ProspectWithCompany[]> {
    const results = await db
      .select()
      .from(prospects)
      .leftJoin(companies, eq(prospects.companyId, companies.id))
      .where(eq(prospects.userId, userId))
      .orderBy(prospects.createdAt);

    return results.map((row) => ({
      ...row.prospects,
      company: row.companies!,
    }));
  }

  async getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined> {
    const [result] = await db
      .select()
      .from(prospects)
      .leftJoin(companies, eq(prospects.companyId, companies.id))
      .where(and(eq(prospects.id, id), eq(prospects.userId, userId)));

    if (!result) return undefined;

    return {
      ...result.prospects,
      company: result.companies!,
    };
  }

  async getProspectById(id: number): Promise<ProspectWithCompany | undefined> {
    const [result] = await db
      .select()
      .from(prospects)
      .leftJoin(companies, eq(prospects.companyId, companies.id))
      .where(eq(prospects.id, id));

    if (!result) return undefined;

    return {
      ...result.prospects,
      company: result.companies!,
    };
  }

  async createProspect(insertProspect: InsertProspect, userId: string): Promise<Prospect> {
    const [prospect] = await db
      .insert(prospects)
      .values({ 
        ...insertProspect,
        userId,
      } as any)
      .returning();
    return prospect;
  }

  async updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ stage, updatedAt: sql`now()` })
      .where(and(eq(prospects.id, prospectId), eq(prospects.userId, userId)))
      .returning();
    return prospect || undefined;
  }

  async updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(prospects.id, id), eq(prospects.userId, userId)))
      .returning();
    return prospect || undefined;
  }

  async deleteProspect(id: number, userId: string): Promise<void> {
    await db
      .delete(prospects)
      .where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
  }

  async listContacts(prospectId: number): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.prospectId, prospectId))
      .orderBy(contacts.createdAt);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact as any)
      .returning();
    return contact;
  }

  async updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async listActivities(prospectId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.prospectId, prospectId))
      .orderBy(activities.createdAt);
  }

  async listAllUserActivities(userId: string): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(activities.dueDate);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity as any)
      .returning();
    return activity;
  }

  async updateActivity(id: number, updates: Partial<InsertActivity>): Promise<Activity | undefined> {
    const [activity] = await db
      .update(activities)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(activities.id, id))
      .returning();
    return activity || undefined;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getDueDiligence(prospectId: number): Promise<DueDiligence | undefined> {
    const [result] = await db
      .select()
      .from(dueDiligence)
      .where(eq(dueDiligence.prospectId, prospectId));
    return result || undefined;
  }

  async upsertDueDiligence(prospectId: number, data: DueDiligenceData): Promise<DueDiligence> {
    const [result] = await db
      .insert(dueDiligence)
      .values({
        prospectId,
        data: data as any,
      })
      .onConflictDoUpdate({
        target: dueDiligence.prospectId,
        set: {
          data: data as any,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return result;
  }

  async listLenders(userId: string): Promise<Lender[]> {
    return await db
      .select()
      .from(lenders)
      .where(eq(lenders.userId, userId))
      .orderBy(lenders.institutionName);
  }

  async getLender(id: number, userId: string): Promise<Lender | undefined> {
    const [lender] = await db
      .select()
      .from(lenders)
      .where(and(eq(lenders.id, id), eq(lenders.userId, userId)));
    return lender || undefined;
  }

  async createLender(insertLender: InsertLender, userId: string): Promise<Lender> {
    const [lender] = await db
      .insert(lenders)
      .values({ ...insertLender, userId } as any)
      .returning();
    return lender;
  }

  async updateLender(id: number, userId: string, updates: Partial<InsertLender>): Promise<Lender | undefined> {
    // Filter out undefined values to preserve existing data
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ) as Partial<InsertLender>;
    
    const [lender] = await db
      .update(lenders)
      .set({ ...cleanedUpdates, updatedAt: sql`now()` })
      .where(and(eq(lenders.id, id), eq(lenders.userId, userId)))
      .returning();
    return lender || undefined;
  }

  async deleteLender(id: number, userId: string): Promise<void> {
    await db
      .delete(lenders)
      .where(and(eq(lenders.id, id), eq(lenders.userId, userId)));
  }

  async listApplicationSubmissions(userId: string): Promise<ApplicationSubmission[]> {
    return await db
      .select()
      .from(applicationSubmissions)
      .where(eq(applicationSubmissions.userId, userId))
      .orderBy(applicationSubmissions.sentAt);
  }

  async getApplicationSubmission(id: number, userId: string): Promise<ApplicationSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(applicationSubmissions)
      .where(and(eq(applicationSubmissions.id, id), eq(applicationSubmissions.userId, userId)));
    return submission || undefined;
  }

  async createApplicationSubmission(insertSubmission: InsertApplicationSubmission, userId: string): Promise<ApplicationSubmission> {
    const [submission] = await db
      .insert(applicationSubmissions)
      .values({ ...insertSubmission, userId } as any)
      .returning();
    return submission;
  }

  async updateApplicationSubmission(id: number, userId: string, updates: Partial<InsertApplicationSubmission>): Promise<ApplicationSubmission | undefined> {
    const [submission] = await db
      .update(applicationSubmissions)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(applicationSubmissions.id, id), eq(applicationSubmissions.userId, userId)))
      .returning();
    return submission || undefined;
  }

  async deleteApplicationSubmission(id: number, userId: string): Promise<void> {
    await db
      .delete(applicationSubmissions)
      .where(and(eq(applicationSubmissions.id, id), eq(applicationSubmissions.userId, userId)));
  }

  // Email Inboxes
  async getEmailInbox(userId: string): Promise<EmailInbox | undefined> {
    const [inbox] = await db
      .select()
      .from(emailInboxes)
      .where(eq(emailInboxes.userId, userId));
    return inbox || undefined;
  }

  async createEmailInbox(inbox: InsertEmailInbox): Promise<EmailInbox> {
    const [newInbox] = await db
      .insert(emailInboxes)
      .values(inbox as any)
      .returning();
    return newInbox;
  }

  // Email Messages
  async listEmailMessages(inboxId: number): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.inboxId, inboxId))
      .orderBy(sql`${emailMessages.sentAt} DESC`);
  }

  async getEmailMessage(id: number): Promise<EmailMessage | undefined> {
    const [message] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, id));
    return message || undefined;
  }

  async getEmailMessageByMessageId(messageId: string): Promise<EmailMessage | undefined> {
    const [message] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.messageId, messageId));
    return message || undefined;
  }

  async createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    const [newMessage] = await db
      .insert(emailMessages)
      .values(message as any)
      .returning();
    return newMessage;
  }

  async markEmailAsRead(id: number): Promise<void> {
    await db
      .update(emailMessages)
      .set({ isRead: 1 })
      .where(eq(emailMessages.id, id));
  }

  async updateEmailMessageLink(id: number, updates: { contactId?: number | null; prospectId?: number | null }): Promise<EmailMessage | undefined> {
    const [message] = await db
      .update(emailMessages)
      .set(updates as any)
      .where(eq(emailMessages.id, id))
      .returning();
    return message || undefined;
  }

  async getEmailMessagesForContact(inboxId: number, contactId: number): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(and(eq(emailMessages.inboxId, inboxId), eq(emailMessages.contactId, contactId)))
      .orderBy(sql`${emailMessages.sentAt} DESC`);
  }

  async getEmailMessagesForProspect(inboxId: number, prospectId: number): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(and(eq(emailMessages.inboxId, inboxId), eq(emailMessages.prospectId, prospectId)))
      .orderBy(sql`${emailMessages.sentAt} DESC`);
  }

  async getEmailMessagesByInbox(inboxId: number): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.inboxId, inboxId))
      .orderBy(sql`${emailMessages.sentAt} DESC`);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    return company || undefined;
  }

  // Lead Uploads
  async listLeadUploads(userId: string): Promise<LeadUpload[]> {
    return await db
      .select()
      .from(leadUploads)
      .where(eq(leadUploads.userId, userId))
      .orderBy(sql`${leadUploads.createdAt} DESC`);
  }

  async getLeadUpload(id: number, userId: string): Promise<LeadUpload | undefined> {
    const [upload] = await db
      .select()
      .from(leadUploads)
      .where(and(eq(leadUploads.id, id), eq(leadUploads.userId, userId)));
    return upload || undefined;
  }

  async createLeadUpload(upload: InsertLeadUpload): Promise<LeadUpload> {
    const [newUpload] = await db
      .insert(leadUploads)
      .values(upload as any)
      .returning();
    return newUpload;
  }

  async updateLeadUpload(id: number, userId: string, updates: Partial<InsertLeadUpload>): Promise<LeadUpload | undefined> {
    const [upload] = await db
      .update(leadUploads)
      .set(updates as any)
      .where(and(eq(leadUploads.id, id), eq(leadUploads.userId, userId)))
      .returning();
    return upload || undefined;
  }

  // Leads
  async listLeads(userId: string, filters?: { uploadId?: number; matchStatus?: string; search?: string }): Promise<Lead[]> {
    let query = db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .$dynamic();

    if (filters?.uploadId) {
      query = query.where(and(eq(leads.userId, userId), eq(leads.uploadId, filters.uploadId)));
    }
    if (filters?.matchStatus) {
      query = query.where(and(eq(leads.userId, userId), eq(leads.matchStatus, filters.matchStatus)));
    }

    const allLeads = await query.orderBy(sql`${leads.createdAt} DESC`);
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      return allLeads.filter(lead => 
        lead.companyName.toLowerCase().includes(searchLower) ||
        lead.companyNumber?.toLowerCase().includes(searchLower) ||
        lead.contactName?.toLowerCase().includes(searchLower)
      );
    }
    
    return allLeads;
  }

  async getLead(id: number, userId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return lead || undefined;
  }

  async createLead(lead: InsertLead, userId: string): Promise<Lead> {
    const [newLead] = await db
      .insert(leads)
      .values({ ...lead, userId } as any)
      .returning();
    return newLead;
  }

  async createLeadsBulk(leadsData: InsertLead[], userId: string): Promise<Lead[]> {
    if (leadsData.length === 0) return [];
    
    const leadsWithUserId = leadsData.map(lead => ({ ...lead, userId }));
    const newLeads = await db
      .insert(leads)
      .values(leadsWithUserId as any)
      .returning();
    return newLeads;
  }

  async updateLead(id: number, userId: string, updates: UpdateLead): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return lead || undefined;
  }

  async deleteLead(id: number, userId: string): Promise<void> {
    await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
  }

  async deleteLeadsByUpload(uploadId: number, userId: string): Promise<void> {
    await db
      .delete(leads)
      .where(and(eq(leads.uploadId, uploadId), eq(leads.userId, userId)));
  }

  // Underwriting Submissions
  async listUnderwritingSubmissions(filters?: { status?: string; assignedUnderwriterId?: string }): Promise<UnderwritingSubmission[]> {
    let query = db.select().from(underwritingSubmissions);
    
    if (filters?.status) {
      query = query.where(eq(underwritingSubmissions.status, filters.status)) as any;
    }
    if (filters?.assignedUnderwriterId) {
      query = query.where(eq(underwritingSubmissions.assignedUnderwriterId, filters.assignedUnderwriterId)) as any;
    }
    
    return await query.orderBy(underwritingSubmissions.submittedAt);
  }

  async listBrokerUnderwritingSubmissions(brokerId: string): Promise<UnderwritingSubmission[]> {
    return await db
      .select()
      .from(underwritingSubmissions)
      .where(eq(underwritingSubmissions.brokerId, brokerId))
      .orderBy(underwritingSubmissions.submittedAt);
  }

  async getUnderwritingSubmission(id: number): Promise<UnderwritingSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(underwritingSubmissions)
      .where(eq(underwritingSubmissions.id, id));
    return submission || undefined;
  }

  async createUnderwritingSubmission(submission: InsertUnderwritingSubmission, brokerId: string): Promise<UnderwritingSubmission> {
    const [newSubmission] = await db
      .insert(underwritingSubmissions)
      .values({ ...submission, brokerId } as any)
      .returning();
    return newSubmission;
  }

  async updateUnderwritingSubmission(id: number, updates: UpdateUnderwritingSubmission): Promise<UnderwritingSubmission | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    // Set timestamps based on status
    if (updates.status === 'in_review' && !updateData.claimedAt) {
      updateData.claimedAt = new Date();
    }
    if (['approved', 'declined', 'withdrawn'].includes(updates.status || '')) {
      updateData.decidedAt = new Date();
    }
    
    const [submission] = await db
      .update(underwritingSubmissions)
      .set(updateData)
      .where(eq(underwritingSubmissions.id, id))
      .returning();
    return submission || undefined;
  }

  async claimUnderwritingSubmission(id: number, underwriterId: string): Promise<UnderwritingSubmission | undefined> {
    const [submission] = await db
      .update(underwritingSubmissions)
      .set({
        assignedUnderwriterId: underwriterId,
        status: 'in_review',
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(underwritingSubmissions.id, id))
      .returning();
    return submission || undefined;
  }

  async getUnderwritingSubmissionByProspect(prospectId: number): Promise<UnderwritingSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(underwritingSubmissions)
      .where(eq(underwritingSubmissions.prospectId, prospectId))
      .orderBy(underwritingSubmissions.submittedAt);
    return submission || undefined;
  }

  // Underwriting Activity
  async listUnderwritingActivities(submissionId: number): Promise<UnderwritingActivity[]> {
    return await db
      .select()
      .from(underwritingActivity)
      .where(eq(underwritingActivity.submissionId, submissionId))
      .orderBy(underwritingActivity.createdAt);
  }

  async createUnderwritingActivity(activity: InsertUnderwritingActivity, userId: string): Promise<UnderwritingActivity> {
    const [newActivity] = await db
      .insert(underwritingActivity)
      .values({ ...activity, userId } as any)
      .returning();
    return newActivity;
  }

  // Prospect Documents
  async listProspectDocuments(prospectId: number): Promise<ProspectDocument[]> {
    return await db
      .select()
      .from(prospectDocuments)
      .where(eq(prospectDocuments.prospectId, prospectId))
      .orderBy(prospectDocuments.createdAt);
  }

  async getProspectDocument(id: number): Promise<ProspectDocument | undefined> {
    const [document] = await db
      .select()
      .from(prospectDocuments)
      .where(eq(prospectDocuments.id, id));
    return document || undefined;
  }

  async createProspectDocument(document: InsertProspectDocument): Promise<ProspectDocument> {
    const [newDocument] = await db
      .insert(prospectDocuments)
      .values(document as any)
      .returning();
    return newDocument;
  }

  async deleteProspectDocument(id: number): Promise<void> {
    await db.delete(prospectDocuments).where(eq(prospectDocuments.id, id));
  }

  // Teams
  async getTeams(adminUserId?: string): Promise<Team[]> {
    if (adminUserId) {
      // For sales_admin, only return teams they created or are admin members of
      const memberTeams = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(and(eq(teamMembers.userId, adminUserId), eq(teamMembers.memberRole, 'admin')));
      
      const memberTeamIds = memberTeams.map(t => t.teamId);
      
      return await db
        .select()
        .from(teams)
        .where(
          sql`${teams.createdBy} = ${adminUserId} OR ${teams.id} = ANY(${memberTeamIds})`
        )
        .orderBy(teams.name);
    }
    // Super admin gets all teams
    return await db.select().from(teams).orderBy(teams.name);
  }

  async getTeamWithMembers(teamId: number): Promise<(Team & { members: (TeamMember & { user: User })[] }) | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return undefined;

    const members = await this.getTeamMembers(teamId);
    return { ...team, members };
  }

  async createTeam(team: InsertTeam, createdBy: string): Promise<Team> {
    const [newTeam] = await db
      .insert(teams)
      .values({ ...team, createdBy } as any)
      .returning();
    return newTeam;
  }

  async updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const [team] = await db
      .update(teams)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    return team || undefined;
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Team Members
  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db
      .insert(teamMembers)
      .values(member as any)
      .returning();
    return newMember;
  }

  async removeTeamMember(teamId: number, userId: string): Promise<void> {
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    const userTeamMemberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    
    if (userTeamMemberships.length === 0) return [];
    
    const teamIds = userTeamMemberships.map(m => m.teamId);
    return await db
      .select()
      .from(teams)
      .where(sql`${teams.id} = ANY(${teamIds})`)
      .orderBy(teams.name);
  }

  async getTeamMembers(teamId: number): Promise<(TeamMember & { user: User })[]> {
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        return { ...member, user };
      })
    );
    
    return membersWithUsers;
  }

  // Add-On Products
  async listAddOnProducts(activeOnly: boolean = true): Promise<AddOnProduct[]> {
    if (activeOnly) {
      return await db
        .select()
        .from(addOnProducts)
        .where(eq(addOnProducts.isActive, 1))
        .orderBy(addOnProducts.displayOrder, addOnProducts.title);
    }
    return await db.select().from(addOnProducts).orderBy(addOnProducts.displayOrder, addOnProducts.title);
  }

  async getAddOnProduct(id: number): Promise<AddOnProduct | undefined> {
    const [product] = await db.select().from(addOnProducts).where(eq(addOnProducts.id, id));
    return product;
  }

  async createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct> {
    const [newProduct] = await db.insert(addOnProducts).values(product as any).returning();
    return newProduct;
  }

  async updateAddOnProduct(id: number, updates: UpdateAddOnProduct): Promise<AddOnProduct | undefined> {
    const [product] = await db
      .update(addOnProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addOnProducts.id, id))
      .returning();
    return product || undefined;
  }

  // Add-On Purchases
  async listUserAddOnPurchases(userId: string): Promise<(AddOnPurchase & { product: AddOnProduct })[]> {
    const purchases = await db
      .select()
      .from(addOnPurchases)
      .where(eq(addOnPurchases.userId, userId))
      .orderBy(addOnPurchases.createdAt);
    
    const purchasesWithProducts = await Promise.all(
      purchases.map(async (purchase) => {
        const product = await this.getAddOnProduct(purchase.addOnProductId);
        return { ...purchase, product: product! };
      })
    );
    
    return purchasesWithProducts;
  }

  async getAddOnPurchase(id: number): Promise<AddOnPurchase | undefined> {
    const [purchase] = await db.select().from(addOnPurchases).where(eq(addOnPurchases.id, id));
    return purchase;
  }

  async getAddOnPurchaseByIdempotencyKey(key: string): Promise<AddOnPurchase | undefined> {
    const [purchase] = await db.select().from(addOnPurchases).where(eq(addOnPurchases.idempotencyKey, key));
    return purchase;
  }

  async createAddOnPurchase(purchase: InsertAddOnPurchase): Promise<AddOnPurchase> {
    const [newPurchase] = await db.insert(addOnPurchases).values(purchase as any).returning();
    return newPurchase;
  }

  async updateAddOnPurchase(id: number, updates: Partial<AddOnPurchase>): Promise<AddOnPurchase | undefined> {
    const [purchase] = await db
      .update(addOnPurchases)
      .set(updates)
      .where(eq(addOnPurchases.id, id))
      .returning();
    return purchase || undefined;
  }

  async getUserProspectCredits(userId: string): Promise<number> {
    // Sum up all completed purchases of prospect packs for this user
    const purchases = await db
      .select()
      .from(addOnPurchases)
      .where(and(
        eq(addOnPurchases.userId, userId),
        eq(addOnPurchases.status, "completed")
      ));
    
    let totalCredits = 0;
    for (const purchase of purchases) {
      const product = await this.getAddOnProduct(purchase.addOnProductId);
      if (product && product.category === "prospects" && product.quantityIncluded) {
        totalCredits += product.quantityIncluded * purchase.quantity;
      }
    }
    return totalCredits;
  }
}

export const storage = new DatabaseStorage();
