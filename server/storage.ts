import {
  companies,
  prospects,
  users,
  type Company,
  type InsertCompany,
  type Prospect,
  type InsertProspect,
  type ProspectWithCompany,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";

export interface IStorage {
  // Users - required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Companies
  getCompanyByNumber(companyNumber: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;

  // Prospects
  listProspects(userId: string): Promise<ProspectWithCompany[]>;
  getProspect(id: number, userId: string): Promise<ProspectWithCompany | undefined>;
  createProspect(prospect: InsertProspect, userId: string): Promise<Prospect>;
  updateProspectStage(prospectId: number, userId: string, stage: string): Promise<Prospect | undefined>;
  updateProspect(id: number, userId: string, updates: Partial<InsertProspect>): Promise<Prospect | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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
      .values(insertCompany)
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
}

export const storage = new DatabaseStorage();
