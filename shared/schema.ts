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
  subscriptionTier: varchar("subscription_tier").notNull().default("free"),
  prospectLimit: integer("prospect_limit").notNull().default(10),
  gocardlessCustomerId: varchar("gocardless_customer_id"),
  gocardlessMandateId: varchar("gocardless_mandate_id"),
  gocardlessSubscriptionId: varchar("gocardless_subscription_id"),
  currency: varchar("currency").notNull().default("GBP"),
  timezone: varchar("timezone").notNull().default("Europe/London"),
  dateFormat: varchar("date_format").notNull().default("DD/MM/YYYY"),
  theme: varchar("theme").notNull().default("light"),
  pipelineStageNames: jsonb("pipeline_stage_names").default(sql`'{"lead":"Lead","contacted":"Contacted","qualified":"Qualified","proposal":"Proposal","dueDiligence":"Due Diligence","approval":"Approval","approved":"Approved","declined":"Declined","withdrawn":"Withdrawn"}'::jsonb`),
  pdfLayoutPreferences: jsonb("pdf_layout_preferences").default(sql`'{"sections":[{"id":"companyInfo","label":"Company Information","enabled":true},{"id":"officers","label":"Officers","enabled":true},{"id":"psc","label":"Persons with Significant Control","enabled":true},{"id":"charges","label":"Charges","enabled":true},{"id":"loanDetails","label":"Loan Details","enabled":true},{"id":"security","label":"Security & Collateral","enabled":true},{"id":"notes","label":"Notes","enabled":true},{"id":"contacts","label":"Key Contacts","enabled":true},{"id":"activities","label":"Activities & Tasks","enabled":true},{"id":"dueDiligence","label":"Due Diligence","enabled":true}]}'::jsonb`),
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
  term: integer("term"),
  interestRate: text("interest_rate"),
  directorsGuarantee: integer("directors_guarantee").default(0),
  commercialProperty: integer("commercial_property").default(0),
  homeEquity: integer("home_equity").default(0),
  propertyOther: integer("property_other").default(0),
  debenture: integer("debenture").default(0),
  parentCompanyGuarantee: integer("parent_company_guarantee").default(0),
  collateral: integer("collateral").default(0),
  crossCompanyGuarantee: integer("cross_company_guarantee").default(0),
  loanRequirementNotes: text("loan_requirement_notes"),
  priority: text("priority"),
  notes: text("notes"),
  savedAssociations: jsonb("saved_associations").default('[]'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  role: text("role"),
  isPrimary: integer("is_primary").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  activityType: text("activity_type").notNull().default("task"),
  dueDate: timestamp("due_date"),
  completed: integer("completed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dueDiligence = pgTable("due_diligence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().unique().references(() => prospects.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  user: one(users, {
    fields: [prospects.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [prospects.companyId],
    references: [companies.id],
  }),
  contacts: many(contacts),
  activities: many(activities),
  dueDiligence: one(dueDiligence, {
    fields: [prospects.id],
    references: [dueDiligence.prospectId],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  prospect: one(prospects, {
    fields: [contacts.prospectId],
    references: [prospects.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  prospect: one(prospects, {
    fields: [activities.prospectId],
    references: [prospects.id],
  }),
}));

export const dueDiligenceRelations = relations(dueDiligence, ({ one }) => ({
  prospect: one(prospects, {
    fields: [dueDiligence.prospectId],
    references: [prospects.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  prospects: many(prospects),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  prospects: many(prospects),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true as const,
  createdAt: true as const,
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
  id: true as const,
  userId: true as const,
  createdAt: true as const,
  updatedAt: true as const,
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

export const insertContactSchema = createInsertSchema(contacts, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
}).omit({
  id: true as const,
  createdAt: true as const,
});

export const insertActivitySchema = createInsertSchema(activities, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
}).omit({
  id: true as const,
  createdAt: true as const,
  updatedAt: true as const,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type ProspectWithCompany = Prospect & { company: Company };
export type UpdateProspectStage = z.infer<typeof updateProspectStageSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export const checklistItemSchema = z.object({
  sectionId: z.string(),
  itemId: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  notes: z.string().default(""),
});

export const dueDiligenceDataSchema = z.object({
  checklist: z.array(checklistItemSchema).default([]),
  loanCalculator: z.object({
    loanAmount: z.number().optional(),
    interestRate: z.number().optional(),
    term: z.number().optional(),
  }).optional(),
  dscr: z.object({
    annualNetOperatingIncome: z.number().optional(),
    annualDebtService: z.number().optional(),
    sensitivityRevenue: z.number().optional(),
  }).optional(),
  affordability: z.object({
    personalIncome: z.number().optional(),
    monthlyCommitments: z.number().optional(),
    loanPayment: z.number().optional(),
  }).optional(),
  financialRatios: z.object({
    revenue: z.number().optional(),
    costs: z.number().optional(),
    currentAssets: z.number().optional(),
    currentLiabilities: z.number().optional(),
    totalAssets: z.number().optional(),
    totalLiabilities: z.number().optional(),
    equity: z.number().optional(),
  }).optional(),
  character: z.object({
    managementExperience: z.number().min(1).max(5).optional(),
    creditHistory: z.number().min(1).max(5).optional(),
    bankConduct: z.number().min(1).max(5).optional(),
    contracts: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
  }).optional(),
});

export const insertDueDiligenceSchema = createInsertSchema(dueDiligence).omit({
  id: true as const,
  createdAt: true as const,
  updatedAt: true as const,
});

export const updateDueDiligenceSchema = z.object({
  data: dueDiligenceDataSchema.partial(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type DueDiligenceData = z.infer<typeof dueDiligenceDataSchema>;
export type DueDiligence = typeof dueDiligence.$inferSelect;
export type InsertDueDiligence = z.infer<typeof insertDueDiligenceSchema>;
export type UpdateDueDiligence = z.infer<typeof updateDueDiligenceSchema>;
