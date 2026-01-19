import {
  sessions,
  companies,
  prospects,
  users,
  contacts,
  activities,
  dueDiligence,
  lenders,
  lenderProducts,
  lenderInteractions,
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
  timeEntries,
  type Company,
  type InsertCompany,
  type Prospect,
  type InsertProspect,
  type ProspectWithCompany,
  type User,

  type InsertUser,
  type UpsertUser,
  type Contact,
  type InsertContact,
  type Activity,
  type InsertActivity,
  type DueDiligence,
  type DueDiligenceData,
  type Lender,
  type InsertLender,
  type LenderProduct,
  type InsertLenderProduct,
  type LenderInteraction,
  type InsertLenderInteraction,
  type LenderWithProducts,
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
  type TimeEntry,
  type InsertTimeEntry,
  addOnProducts,
  addOnPurchases,
  userSessions,
  type UserSession,
  type InsertUserSession,
  SESSION_LIMITS,
  systemSettings,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, sql, and, or, ilike, gte, lte, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  // Users - required for auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // System Settings (SLA, etc)
  getSystemSetting(key: string): Promise<any>;
  updateSystemSetting(key: string, value: any, userId?: string): Promise<any>;
}



export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool: pool as any,
      createTableIfMissing: false,
      tableName: 'sessions',
    });
  }
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const result = await db.select().from(users).where(inArray(users.id, ids));
    return result;
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
      if (error.code === "23505" && error.constraint === "users_email_unique") {
        const [existingUser] = await db.select().from(users).where(eq(users.email, userData.email as string));
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

  // System Settings
  async getSystemSetting(key: string): Promise<any> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting?.value;
  }

  async updateSystemSetting(key: string, value: any, userId?: string): Promise<any> {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));

    if (existing) {
      const [updated] = await db
        .update(systemSettings)
        .set({ value, updatedBy: userId, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated.value;
    } else {
      const [created] = await db
        .insert(systemSettings)
        .values({ key, value, updatedBy: userId })
        .returning();
      return created.value;
    }
  }


  // User Sessions - for concurrent login limiting
  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [created] = await db.insert(userSessions).values(session).returning();
    return created;
  }

  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    return await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .orderBy(userSessions.createdAt);
  }

  async getSessionBySessionId(sessionId: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId));
    return session;
  }

  async updateSessionLastSeen(sessionId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(userSessions.sessionId, sessionId));
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(eq(userSessions.sessionId, sessionId));
  }

  async revokeOldestSession(userId: string, reason: string): Promise<UserSession | undefined> {
    const activeSessions = await this.getUserActiveSessions(userId);
    if (activeSessions.length === 0) return undefined;

    // Revoke the oldest session (first in the list, ordered by createdAt)
    const oldest = activeSessions[0];
    await this.revokeSession(oldest.sessionId, reason);
    // Also destroy the express session to immediately invalidate the cookie
    await this.destroyExpressSession(oldest.sessionId);
    return oldest;
  }

  async destroyExpressSession(sessionId: string): Promise<void> {
    // Delete from the express-session sessions table to immediately invalidate the cookie
    await db.delete(sessions).where(eq(sessions.sid, sessionId));
  }

  async cleanupExpiredSessions(): Promise<number> {
    // Remove user_sessions entries where the session was revoked more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(userSessions)
      .where(
        and(
          isNotNull(userSessions.revokedAt),
          lte(userSessions.revokedAt, thirtyDaysAgo)
        )
      );
    return 0; // Drizzle doesn't return affected count easily
  }

  getSessionLimit(subscriptionTier: string): number {
    return SESSION_LIMITS[subscriptionTier] ?? SESSION_LIMITS.free;
  }

  async getCompanyByNumber(companyNumber: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.companyNumber, companyNumber));
    return company || undefined;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
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

  async countProspects(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(eq(prospects.userId, userId));
    return result?.count ?? 0;
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

  async getProspectsByIds(ids: number[]): Promise<ProspectWithCompany[]> {
    if (ids.length === 0) return [];
    const results = await db
      .select()
      .from(prospects)
      .leftJoin(companies, eq(prospects.companyId, companies.id))
      .where(inArray(prospects.id, ids));

    return results.map((row) => ({
      ...row.prospects,
      company: row.companies!,
    }));
  }

  async createProspect(insertProspect: InsertProspect, userId: string): Promise<Prospect> {
    const [prospect] = await db.transaction(async (tx) => {
      const [newProspect] = await tx
        .insert(prospects)
        .values({
          ...insertProspect,
          userId,
        } as any)
        .returning();

      await tx
        .update(users)
        .set({
          prospectsCreatedCount: sql`${users.prospectsCreatedCount} + 1`,
        })
        .where(eq(users.id, userId));

      return [newProspect];
    });

    return prospect;
  }

  async updateProspectStage(
    prospectId: number,
    userId: string,
    stage: string
  ): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ stage, updatedAt: sql`now()` })
      .where(and(eq(prospects.id, prospectId), eq(prospects.userId, userId)))
      .returning();
    return prospect || undefined;
  }

  async updateProspect(
    id: number,
    userId: string,
    updates: Partial<InsertProspect>
  ): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(prospects.id, id), eq(prospects.userId, userId)))
      .returning();
    return prospect || undefined;
  }

  async deleteProspect(id: number, userId: string): Promise<void> {
    await db.delete(prospects).where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
  }

  async reorderProspects(userId: string, stage: string, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(prospects)
        .set({ queueOrder: i, updatedAt: sql`now()` })
        .where(
          and(
            eq(prospects.id, orderedIds[i]),
            eq(prospects.userId, userId),
            eq(prospects.stage, stage)
          )
        );
    }
  }

  async listContacts(prospectId: number, userId: string): Promise<Contact[]> {
    return await db
      .select({
        id: contacts.id,
        prospectId: contacts.prospectId,
        name: contacts.name,
        role: contacts.role,
        email: contacts.email,
        phone: contacts.phone,
        notes: contacts.notes,
        isPrimary: contacts.isPrimary,
        profilePicture: contacts.profilePicture,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(prospects, eq(contacts.prospectId, prospects.id))
      .where(and(eq(contacts.prospectId, prospectId), eq(prospects.userId, userId)))
      .orderBy(contacts.createdAt);
  }

  async getContact(id: number, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select({
        id: contacts.id,
        prospectId: contacts.prospectId,
        name: contacts.name,
        role: contacts.role,
        email: contacts.email,
        phone: contacts.phone,
        notes: contacts.notes,
        isPrimary: contacts.isPrimary,
        profilePicture: contacts.profilePicture,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(prospects, eq(contacts.prospectId, prospects.id))
      .where(and(eq(contacts.id, id), eq(prospects.userId, userId)));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact, userId: string): Promise<Contact | undefined> {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, insertContact.prospectId), eq(prospects.userId, userId)));
    if (!prospect) return undefined;

    const [contact] = await db
      .insert(contacts)
      .values(insertContact as any)
      .returning();
    return contact;
  }

  async updateContact(
    id: number,
    userId: string,
    updates: Partial<InsertContact>
  ): Promise<Contact | undefined> {
    const existingContact = await this.getContact(id, userId);
    if (!existingContact) return undefined;

    const [contact] = await db.update(contacts).set(updates).where(eq(contacts.id, id)).returning();
    return contact || undefined;
  }

  async deleteContact(id: number, userId: string): Promise<boolean> {
    const existingContact = await this.getContact(id, userId);
    if (!existingContact) return false;

    await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  async listActivities(prospectId: number, userId: string): Promise<Activity[]> {
    return await db
      .select({
        id: activities.id,
        prospectId: activities.prospectId,
        userId: activities.userId,
        activityType: activities.activityType,
        priority: activities.priority,
        title: activities.title,
        description: activities.description,
        dueDate: activities.dueDate,
        completed: activities.completed,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
      })
      .from(activities)
      .innerJoin(prospects, eq(activities.prospectId, prospects.id))
      .where(and(eq(activities.prospectId, prospectId), eq(prospects.userId, userId)))
      .orderBy(activities.createdAt);
  }

  async listAllUserActivities(userId: string): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(activities.dueDate);
  }

  async getActivity(id: number, userId: string): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)));
    return activity || undefined;
  }

  async createActivity(
    insertActivity: InsertActivity,
    userId: string
  ): Promise<Activity | undefined> {
    // SECURITY: Verify prospect belongs to user before creating activity
    if (insertActivity.prospectId) {
      const [prospect] = await db
        .select()
        .from(prospects)
        .where(and(eq(prospects.id, insertActivity.prospectId), eq(prospects.userId, userId)));
      if (!prospect) return undefined;
    }

    const [activity] = await db
      .insert(activities)
      .values({ ...insertActivity, userId } as any)
      .returning();
    return activity;
  }

  async updateActivity(
    id: number,
    userId: string,
    updates: Partial<InsertActivity>
  ): Promise<Activity | undefined> {
    const [activity] = await db
      .update(activities)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(activities.id, id), eq(activities.userId, userId)))
      .returning();
    return activity || undefined;
  }

  async deleteActivity(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(activities)
      .where(and(eq(activities.id, id), eq(activities.userId, userId)));
    return true;
  }

  async getDueDiligence(prospectId: number, userId: string): Promise<DueDiligence | undefined> {
    const [result] = await db
      .select({
        id: dueDiligence.id,
        prospectId: dueDiligence.prospectId,
        data: dueDiligence.data,
        createdAt: dueDiligence.createdAt,
        updatedAt: dueDiligence.updatedAt,
      })
      .from(dueDiligence)
      .innerJoin(prospects, eq(dueDiligence.prospectId, prospects.id))
      .where(and(eq(dueDiligence.prospectId, prospectId), eq(prospects.userId, userId)));
    return result || undefined;
  }

  async getAllDueDiligenceSummaries(userId: string): Promise<{ prospectId: number; status: 'complete' | 'partial' | 'pending' }[]> {
    const results = await db
      .select({
        prospectId: dueDiligence.prospectId,
        data: dueDiligence.data,
      })
      .from(dueDiligence)
      .innerJoin(prospects, eq(dueDiligence.prospectId, prospects.id))
      .where(eq(prospects.userId, userId));

    return results.map(row => {
      const data = row.data as DueDiligenceData;
      const checklist = data?.checklist || [];

      if (checklist.length === 0) {
        return { prospectId: row.prospectId, status: 'pending' as const };
      }

      const completedCount = checklist.filter(item => item.completed).length;

      if (completedCount === 0) {
        return { prospectId: row.prospectId, status: 'pending' as const };
      } else if (completedCount === checklist.length) {
        return { prospectId: row.prospectId, status: 'complete' as const };
      } else {
        return { prospectId: row.prospectId, status: 'partial' as const };
      }
    });
  }

  async upsertDueDiligence(
    prospectId: number,
    userId: string,
    data: DueDiligenceData
  ): Promise<DueDiligence | undefined> {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), eq(prospects.userId, userId)));
    if (!prospect) return undefined;

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

  async updateLender(
    id: number,
    userId: string,
    updates: Partial<InsertLender>
  ): Promise<Lender | undefined> {
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
    await db.delete(lenders).where(and(eq(lenders.id, id), eq(lenders.userId, userId)));
  }

  async getLenderWithProducts(id: number, userId: string): Promise<LenderWithProducts | undefined> {
    const [lender] = await db
      .select()
      .from(lenders)
      .where(and(eq(lenders.id, id), eq(lenders.userId, userId)));
    if (!lender) return undefined;

    const products = await db.select().from(lenderProducts).where(eq(lenderProducts.lenderId, id));

    return { ...lender, products };
  }

  async searchLenders(
    userId: string,
    filters: {
      search?: string;
      lenderType?: string;
      productType?: string;
      minLoanAmount?: number;
      maxLoanAmount?: number;
      sector?: string;
      region?: string;
      panelStatus?: string;
    }
  ): Promise<Lender[]> {
    const conditions = [eq(lenders.userId, userId)];

    if (filters.search) {
      conditions.push(
        or(
          ilike(lenders.institutionName, `%${filters.search}%`),
          ilike(lenders.contactName, `%${filters.search}%`),
          ilike(lenders.bdmName, `%${filters.search}%`)
        ) as any
      );
    }

    if (filters.lenderType) {
      conditions.push(eq(lenders.lenderType, filters.lenderType));
    }

    if (filters.panelStatus) {
      conditions.push(eq(lenders.panelStatus, filters.panelStatus));
    }

    if (filters.minLoanAmount) {
      conditions.push(gte(lenders.minLoanAmount, filters.minLoanAmount));
    }

    if (filters.maxLoanAmount) {
      conditions.push(lte(lenders.maxLoanAmount, filters.maxLoanAmount));
    }

    return await db
      .select()
      .from(lenders)
      .where(and(...conditions))
      .orderBy(lenders.institutionName);
  }

  // Lender Products (user-scoped via lender ownership)
  async listLenderProducts(lenderId: number, userId: string): Promise<LenderProduct[]> {
    return await db
      .select({
        id: lenderProducts.id,
        lenderId: lenderProducts.lenderId,
        productName: lenderProducts.productName,
        productType: lenderProducts.productType,
        description: lenderProducts.description,
        minLoanAmount: lenderProducts.minLoanAmount,
        maxLoanAmount: lenderProducts.maxLoanAmount,
        minTermMonths: lenderProducts.minTermMonths,
        maxTermMonths: lenderProducts.maxTermMonths,
        minLtv: lenderProducts.minLtv,
        maxLtv: lenderProducts.maxLtv,
        rateType: lenderProducts.rateType,
        typicalRate: lenderProducts.typicalRate,
        minRate: lenderProducts.minRate,
        maxRate: lenderProducts.maxRate,
        arrangementFee: lenderProducts.arrangementFee,
        exitFee: lenderProducts.exitFee,
        securityRequirements: lenderProducts.securityRequirements,
        eligibilityCriteria: lenderProducts.eligibilityCriteria,
        features: lenderProducts.features,
        isActive: lenderProducts.isActive,
        notes: lenderProducts.notes,
        createdAt: lenderProducts.createdAt,
        updatedAt: lenderProducts.updatedAt,
      })
      .from(lenderProducts)
      .innerJoin(lenders, eq(lenderProducts.lenderId, lenders.id))
      .where(and(eq(lenderProducts.lenderId, lenderId), eq(lenders.userId, userId)))
      .orderBy(lenderProducts.productName);
  }

  async getLenderProduct(id: number, userId: string): Promise<LenderProduct | undefined> {
    const [product] = await db
      .select({
        id: lenderProducts.id,
        lenderId: lenderProducts.lenderId,
        productName: lenderProducts.productName,
        productType: lenderProducts.productType,
        description: lenderProducts.description,
        minLoanAmount: lenderProducts.minLoanAmount,
        maxLoanAmount: lenderProducts.maxLoanAmount,
        minTermMonths: lenderProducts.minTermMonths,
        maxTermMonths: lenderProducts.maxTermMonths,
        minLtv: lenderProducts.minLtv,
        maxLtv: lenderProducts.maxLtv,
        rateType: lenderProducts.rateType,
        typicalRate: lenderProducts.typicalRate,
        minRate: lenderProducts.minRate,
        maxRate: lenderProducts.maxRate,
        arrangementFee: lenderProducts.arrangementFee,
        exitFee: lenderProducts.exitFee,
        securityRequirements: lenderProducts.securityRequirements,
        eligibilityCriteria: lenderProducts.eligibilityCriteria,
        features: lenderProducts.features,
        isActive: lenderProducts.isActive,
        notes: lenderProducts.notes,
        createdAt: lenderProducts.createdAt,
        updatedAt: lenderProducts.updatedAt,
      })
      .from(lenderProducts)
      .innerJoin(lenders, eq(lenderProducts.lenderId, lenders.id))
      .where(and(eq(lenderProducts.id, id), eq(lenders.userId, userId)));
    return product || undefined;
  }

  async createLenderProduct(
    product: InsertLenderProduct,
    userId: string
  ): Promise<LenderProduct | undefined> {
    const [lender] = await db
      .select()
      .from(lenders)
      .where(and(eq(lenders.id, product.lenderId), eq(lenders.userId, userId)));
    if (!lender) return undefined;

    const [created] = await db
      .insert(lenderProducts)
      .values(product as any)
      .returning();
    return created;
  }

  async updateLenderProduct(
    id: number,
    userId: string,
    updates: Partial<InsertLenderProduct>
  ): Promise<LenderProduct | undefined> {
    const existingProduct = await this.getLenderProduct(id, userId);
    if (!existingProduct) return undefined;

    const [product] = await db
      .update(lenderProducts)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(lenderProducts.id, id))
      .returning();
    return product || undefined;
  }

  async deleteLenderProduct(id: number, userId: string): Promise<boolean> {
    const existingProduct = await this.getLenderProduct(id, userId);
    if (!existingProduct) return false;

    await db.delete(lenderProducts).where(eq(lenderProducts.id, id));
    return true;
  }

  // Lender Interactions (user-scoped via lender ownership)
  async listLenderInteractions(lenderId: number, userId: string): Promise<LenderInteraction[]> {
    return await db
      .select({
        id: lenderInteractions.id,
        lenderId: lenderInteractions.lenderId,
        userId: lenderInteractions.userId,
        prospectId: lenderInteractions.prospectId,
        interactionType: lenderInteractions.interactionType,
        channel: lenderInteractions.channel,
        subject: lenderInteractions.subject,
        summary: lenderInteractions.summary,
        status: lenderInteractions.status,
        notes: lenderInteractions.notes,
        outcome: lenderInteractions.outcome,
        followUpDate: lenderInteractions.followUpDate,
        sentAt: lenderInteractions.sentAt,
        respondedAt: lenderInteractions.respondedAt,
        attachments: lenderInteractions.attachments,
        createdAt: lenderInteractions.createdAt,
        updatedAt: lenderInteractions.updatedAt,
      })
      .from(lenderInteractions)
      .innerJoin(lenders, eq(lenderInteractions.lenderId, lenders.id))
      .where(and(eq(lenderInteractions.lenderId, lenderId), eq(lenders.userId, userId)))
      .orderBy(desc(lenderInteractions.createdAt));
  }

  async listUserLenderInteractions(userId: string): Promise<LenderInteraction[]> {
    return await db
      .select()
      .from(lenderInteractions)
      .where(eq(lenderInteractions.userId, userId))
      .orderBy(desc(lenderInteractions.createdAt));
  }

  async getLenderInteraction(id: number, userId: string): Promise<LenderInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(lenderInteractions)
      .where(and(eq(lenderInteractions.id, id), eq(lenderInteractions.userId, userId)));
    return interaction || undefined;
  }

  async createLenderInteraction(
    interaction: InsertLenderInteraction,
    userId: string
  ): Promise<LenderInteraction | undefined> {
    if (interaction.lenderId) {
      const [lender] = await db
        .select()
        .from(lenders)
        .where(and(eq(lenders.id, interaction.lenderId), eq(lenders.userId, userId)));
      if (!lender) return undefined;
    }

    const [created] = await db
      .insert(lenderInteractions)
      .values({ ...interaction, userId } as any)
      .returning();
    return created;
  }

  async updateLenderInteraction(
    id: number,
    userId: string,
    updates: Partial<InsertLenderInteraction>
  ): Promise<LenderInteraction | undefined> {
    const [interaction] = await db
      .update(lenderInteractions)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(lenderInteractions.id, id), eq(lenderInteractions.userId, userId)))
      .returning();
    return interaction || undefined;
  }

  async deleteLenderInteraction(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(lenderInteractions)
      .where(and(eq(lenderInteractions.id, id), eq(lenderInteractions.userId, userId)));
    return true;
  }

  async listApplicationSubmissions(userId: string): Promise<ApplicationSubmission[]> {
    return await db
      .select()
      .from(applicationSubmissions)
      .where(eq(applicationSubmissions.userId, userId))
      .orderBy(applicationSubmissions.sentAt);
  }

  async getApplicationSubmission(
    id: number,
    userId: string
  ): Promise<ApplicationSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(applicationSubmissions)
      .where(and(eq(applicationSubmissions.id, id), eq(applicationSubmissions.userId, userId)));
    return submission || undefined;
  }

  async createApplicationSubmission(
    insertSubmission: InsertApplicationSubmission,
    userId: string
  ): Promise<ApplicationSubmission> {
    const [submission] = await db
      .insert(applicationSubmissions)
      .values({ ...insertSubmission, userId } as any)
      .returning();
    return submission;
  }

  async updateApplicationSubmission(
    id: number,
    userId: string,
    updates: Partial<InsertApplicationSubmission>
  ): Promise<ApplicationSubmission | undefined> {
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
    const [inbox] = await db.select().from(emailInboxes).where(eq(emailInboxes.userId, userId));
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
    const [message] = await db.select().from(emailMessages).where(eq(emailMessages.id, id));
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
    await db.update(emailMessages).set({ isRead: 1 }).where(eq(emailMessages.id, id));
  }

  async updateEmailMessageLink(
    id: number,
    updates: { contactId?: number | null; prospectId?: number | null }
  ): Promise<EmailMessage | undefined> {
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
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
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

  async updateLeadUpload(
    id: number,
    userId: string,
    updates: Partial<InsertLeadUpload>
  ): Promise<LeadUpload | undefined> {
    const [upload] = await db
      .update(leadUploads)
      .set(updates as any)
      .where(and(eq(leadUploads.id, id), eq(leadUploads.userId, userId)))
      .returning();
    return upload || undefined;
  }

  // Leads
  async listLeads(
    userId: string,
    filters?: { uploadId?: number; matchStatus?: string; search?: string }
  ): Promise<Lead[]> {
    let query = db.select().from(leads).where(eq(leads.userId, userId)).$dynamic();

    if (filters?.uploadId) {
      query = query.where(and(eq(leads.userId, userId), eq(leads.uploadId, filters.uploadId)));
    }
    if (filters?.matchStatus) {
      query = query.where(
        and(eq(leads.userId, userId), eq(leads.matchStatus, filters.matchStatus))
      );
    }

    const allLeads = await query.orderBy(sql`${leads.createdAt} DESC`);

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      return allLeads.filter(
        (lead) =>
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

    const leadsWithUserId = leadsData.map((lead) => ({ ...lead, userId }));
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
    await db.delete(leads).where(and(eq(leads.id, id), eq(leads.userId, userId)));
  }

  async deleteLeadsByUpload(uploadId: number, userId: string): Promise<void> {
    await db.delete(leads).where(and(eq(leads.uploadId, uploadId), eq(leads.userId, userId)));
  }

  // Underwriting Submissions
  async listUnderwritingSubmissions(filters?: {
    status?: string;
    assignedUnderwriterId?: string;
  }): Promise<UnderwritingSubmission[]> {
    let query = db.select().from(underwritingSubmissions);

    if (filters?.status) {
      query = query.where(eq(underwritingSubmissions.status, filters.status)) as any;
    }
    if (filters?.assignedUnderwriterId) {
      query = query.where(
        eq(underwritingSubmissions.assignedUnderwriterId, filters.assignedUnderwriterId)
      ) as any;
    }

    return await query.orderBy(underwritingSubmissions.submittedAt);
  }

  async listUnderwriterScopedSubmissions(underwriterId: string): Promise<UnderwritingSubmission[]> {
    // Returns: queue (status='submitted' AND unassigned) + underwriter's assigned submissions
    return await db
      .select()
      .from(underwritingSubmissions)
      .where(
        or(
          and(
            eq(underwritingSubmissions.status, "submitted"),
            isNull(underwritingSubmissions.assignedUnderwriterId)
          ),
          eq(underwritingSubmissions.assignedUnderwriterId, underwriterId)
        )
      )
      .orderBy(underwritingSubmissions.submittedAt);
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

  async createUnderwritingSubmission(
    submission: InsertUnderwritingSubmission,
    brokerId: string
  ): Promise<UnderwritingSubmission> {
    const [newSubmission] = await db
      .insert(underwritingSubmissions)
      .values({ ...submission, brokerId } as any)
      .returning();
    return newSubmission;
  }

  async updateUnderwritingSubmission(
    id: number,
    updates: UpdateUnderwritingSubmission
  ): Promise<UnderwritingSubmission | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };

    // Set timestamps based on status
    if (updates.status === "in_review" && !updateData.claimedAt) {
      updateData.claimedAt = new Date();
    }
    if (["approved", "declined", "withdrawn"].includes(updates.status || "")) {
      updateData.decidedAt = new Date();
    }

    const [submission] = await db
      .update(underwritingSubmissions)
      .set(updateData)
      .where(eq(underwritingSubmissions.id, id))
      .returning();
    return submission || undefined;
  }

  async claimUnderwritingSubmission(
    id: number,
    underwriterId: string
  ): Promise<UnderwritingSubmission | undefined> {
    const [submission] = await db
      .update(underwritingSubmissions)
      .set({
        assignedUnderwriterId: underwriterId,
        status: "in_review",
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(underwritingSubmissions.id, id),
          eq(underwritingSubmissions.status, "submitted"),
          sql`${underwritingSubmissions.assignedUnderwriterId} is null`
        )
      )
      .returning();
    return submission || undefined;
  }

  async getUnderwritingSubmissionByProspect(
    prospectId: number
  ): Promise<UnderwritingSubmission | undefined> {
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

  async createUnderwritingActivity(
    activity: InsertUnderwritingActivity,
    userId: string
  ): Promise<UnderwritingActivity> {
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
        .where(and(eq(teamMembers.userId, adminUserId), eq(teamMembers.memberRole, "admin")));

      const memberTeamIds = memberTeams.map((t) => t.teamId);

      return await db
        .select()
        .from(teams)
        .where(sql`${teams.createdBy} = ${adminUserId} OR ${teams.id} = ANY(${memberTeamIds})`)
        .orderBy(teams.name);
    }
    // Super admin gets all teams
    return await db.select().from(teams).orderBy(teams.name);
  }

  async getTeamWithMembers(
    teamId: number
  ): Promise<(Team & { members: (TeamMember & { user: User })[] }) | undefined> {
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

    const teamIds = userTeamMemberships.map((m) => m.teamId);
    return await db
      .select()
      .from(teams)
      .where(sql`${teams.id} = ANY(${teamIds})`)
      .orderBy(teams.name);
  }

  async getTeamMembers(teamId: number): Promise<(TeamMember & { user: User })[]> {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));

    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        return { ...member, user };
      })
    );

    return membersWithUsers;
  }

  // Time Entries
  async listTimeEntries(prospectId: number, userId: string): Promise<TimeEntry[]> {
    const prospect = await this.getProspect(prospectId, userId);
    if (!prospect) return [];

    return await db
      .select()
      .from(timeEntries)
      .where(and(
        eq(timeEntries.prospectId, prospectId),
        eq(timeEntries.userId, userId)
      ))
      .orderBy(desc(timeEntries.createdAt));
  }

  async createTimeEntry(entry: InsertTimeEntry, userId: string): Promise<TimeEntry> {
    const prospect = await this.getProspect(entry.prospectId, userId);
    if (!prospect) {
      throw new Error("Access denied - prospect not found or not owned by user");
    }

    const [newEntry] = await db
      .insert(timeEntries)
      .values({ ...entry, userId } as any)
      .returning();
    return newEntry;
  }

  async updateTimeEntry(id: number, userId: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [existing] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));

    if (!existing) return undefined;

    const safeUpdates: Partial<InsertTimeEntry> = {};
    if (updates.description !== undefined) safeUpdates.description = updates.description;
    if (updates.durationMinutes !== undefined && updates.durationMinutes > 0) {
      safeUpdates.durationMinutes = updates.durationMinutes;
    }

    const [updated] = await db
      .update(timeEntries)
      .set(safeUpdates)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTimeEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
  }

  async getProspectTotalTime(prospectId: number, userId: string): Promise<number> {
    const prospect = await this.getProspect(prospectId, userId);
    if (!prospect) return 0;

    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)` })
      .from(timeEntries)
      .where(and(
        eq(timeEntries.prospectId, prospectId),
        eq(timeEntries.userId, userId)
      ));

    return result[0]?.total ?? 0;
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
    return await db
      .select()
      .from(addOnProducts)
      .orderBy(addOnProducts.displayOrder, addOnProducts.title);
  }

  async getAddOnProduct(id: number): Promise<AddOnProduct | undefined> {
    const [product] = await db.select().from(addOnProducts).where(eq(addOnProducts.id, id));
    return product;
  }

  async createAddOnProduct(product: InsertAddOnProduct): Promise<AddOnProduct> {
    const [newProduct] = await db
      .insert(addOnProducts)
      .values(product as any)
      .returning();
    return newProduct;
  }

  async updateAddOnProduct(
    id: number,
    updates: UpdateAddOnProduct
  ): Promise<AddOnProduct | undefined> {
    const [product] = await db
      .update(addOnProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addOnProducts.id, id))
      .returning();
    return product || undefined;
  }

  // Add-On Purchases
  async listUserAddOnPurchases(
    userId: string
  ): Promise<(AddOnPurchase & { product: AddOnProduct })[]> {
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
    const [purchase] = await db
      .select()
      .from(addOnPurchases)
      .where(eq(addOnPurchases.idempotencyKey, key));
    return purchase;
  }

  async createAddOnPurchase(purchase: InsertAddOnPurchase): Promise<AddOnPurchase> {
    const [newPurchase] = await db
      .insert(addOnPurchases)
      .values(purchase as any)
      .returning();
    return newPurchase;
  }

  async updateAddOnPurchase(
    id: number,
    updates: Partial<AddOnPurchase>
  ): Promise<AddOnPurchase | undefined> {
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
      .where(and(eq(addOnPurchases.userId, userId), eq(addOnPurchases.status, "completed")));

    let totalCredits = 0;
    for (const purchase of purchases) {
      const product = await this.getAddOnProduct(purchase.addOnProductId);
      if (product && product.category === "prospects" && product.quantityIncluded) {
        totalCredits += product.quantityIncluded * purchase.quantity;
      }
    }
    return totalCredits;
  }

  // Webhook API - stores only hashed keys for security
  async getUserByWebhookApiKeyHash(keyHash: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.webhookApiKeyHash, keyHash));
    return user;
  }

  async getUserByWebhookApiKey(apiKey: string): Promise<User | undefined> {
    const { hashWebhookApiKey } = await import("./utils/webhookKeyHash");
    const keyHash = hashWebhookApiKey(apiKey);
    return this.getUserByWebhookApiKeyHash(keyHash);
  }

  async generateWebhookApiKey(userId: string): Promise<string> {
    const { generateWebhookApiKey, hashWebhookApiKey, getApiKeySuffix } =
      await import("./utils/webhookKeyHash");

    const rawApiKey = `flwh_${generateWebhookApiKey()}`;
    const keyHash = hashWebhookApiKey(rawApiKey);
    const keySuffix = getApiKeySuffix(rawApiKey);

    await db
      .update(users)
      .set({
        webhookApiKeyHash: keyHash,
        webhookApiKeySuffix: keySuffix,
        webhookApiKeyCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return rawApiKey;
  }

  async updateWebhookApiKeyLastUsed(userId: string): Promise<void> {
    await db.update(users).set({ webhookApiKeyLastUsedAt: new Date() }).where(eq(users.id, userId));
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }

  async updateUserSubscription(
    userId: string,
    data: {
      stripeSubscriptionId: string | null;
      subscriptionTier: string;
      prospectLimit: number;
    }
  ): Promise<void> {
    await db
      .update(users)
      .set({
        stripeSubscriptionId: data.stripeSubscriptionId,
        subscriptionTier: data.subscriptionTier,
        prospectLimit: data.prospectLimit,
      })
      .where(eq(users.id, userId));
  }

  // Underwriting Access Methods
  async hasUnderwritingAccess(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Lender tier always has access
    if (user.subscriptionTier === 'lender') return true;

    // Underwriter role always has access
    if (user.role === 'underwriter') return true;

    // Check if user has explicitly granted access
    if (user.hasUnderwritingAccess === 1) {
      // Check if access hasn't expired
      if (!user.underwritingAccessExpiresAt) return true;
      return new Date() < new Date(user.underwritingAccessExpiresAt);
    }

    return false;
  }

  async grantUnderwritingAccess(userId: string, expiresAt?: Date): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        hasUnderwritingAccess: 1,
        underwritingAccessExpiresAt: expiresAt || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async revokeUnderwritingAccess(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        hasUnderwritingAccess: 0,
        underwritingAccessExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
