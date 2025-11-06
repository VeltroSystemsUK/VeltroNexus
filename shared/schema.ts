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
  dueDate: timestamp("due_date"),
  completed: integer("completed").default(0),
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

export const insertContactSchema = createInsertSchema(contacts, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
}).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
