import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyName: text("company_name").notNull(),
  companyNumber: varchar("company_number", { length: 20 }).notNull().unique(),
  registeredAddress: text("registered_address"),
  incorporationDate: text("incorporation_date"),
  companyStatus: text("company_status"),
  companyType: text("company_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prospects = pgTable("prospects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  stage: text("stage").notNull().default("lead"),
  loanAmount: integer("loan_amount"),
  priority: text("priority"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prospectsRelations = relations(prospects, ({ one }) => ({
  user: one(users, {
    fields: [prospects.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [prospects.companyId],
    references: [companies.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  prospects: many(prospects),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  prospects: many(prospects),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertProspectSchema = createInsertSchema(prospects, {
  companyId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
  loanAmount: z.union([
    z.number().int().min(0),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
    z.null(),
  ]).optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProspectStageSchema = z.object({
  prospectId: z.number(),
  stage: z.enum([
    "lead",
    "contacted",
    "qualified",
    "proposal",
    "due-diligence",
    "approval",
    "approved",
    "declined",
    "withdrawn",
  ]),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type ProspectWithCompany = Prospect & { company: Company };
export type UpdateProspectStage = z.infer<typeof updateProspectStageSchema>;
