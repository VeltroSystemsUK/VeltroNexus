import {
  companies,
  prospects,
  type Company,
  type InsertCompany,
  type Prospect,
  type InsertProspect,
  type ProspectWithCompany,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Companies
  getCompanyByNumber(companyNumber: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;

  // Prospects
  listProspects(): Promise<ProspectWithCompany[]>;
  getProspect(id: number): Promise<ProspectWithCompany | undefined>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspectStage(prospectId: number, stage: string): Promise<Prospect | undefined>;
  updateProspect(id: number, updates: Partial<InsertProspect>): Promise<Prospect | undefined>;
}

export class DatabaseStorage implements IStorage {
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

  async listProspects(): Promise<ProspectWithCompany[]> {
    const results = await db
      .select()
      .from(prospects)
      .leftJoin(companies, eq(prospects.companyId, companies.id))
      .orderBy(prospects.createdAt);

    return results.map((row) => ({
      ...row.prospects,
      company: row.companies!,
    }));
  }

  async getProspect(id: number): Promise<ProspectWithCompany | undefined> {
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

  async createProspect(insertProspect: InsertProspect): Promise<Prospect> {
    const [prospect] = await db
      .insert(prospects)
      .values(insertProspect)
      .returning();
    return prospect;
  }

  async updateProspectStage(prospectId: number, stage: string): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ stage, updatedAt: sql`now()` })
      .where(eq(prospects.id, prospectId))
      .returning();
    return prospect || undefined;
  }

  async updateProspect(id: number, updates: Partial<InsertProspect>): Promise<Prospect | undefined> {
    const [prospect] = await db
      .update(prospects)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(prospects.id, id))
      .returning();
    return prospect || undefined;
  }
}

export const storage = new DatabaseStorage();
