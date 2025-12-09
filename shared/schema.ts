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
  role: varchar("role").notNull().default("broker"), // broker or underwriter
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
  profilePicture: text("profile_picture"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  activityType: text("activity_type").notNull().default("task"),
  priority: text("priority").notNull().default("medium"),
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

export const lenders = pgTable("lenders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  institutionName: text("institution_name").notNull(),
  contactName: text("contact_name"),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  address: text("address"),
  website: varchar("website"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applicationSubmissions = pgTable("application_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  lenderId: integer("lender_id").notNull().references(() => lenders.id, { onDelete: "restrict" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentary: text("commentary"),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  responseNotes: text("response_notes"),
  attachments: jsonb("attachments").default('[]'),
  emailSent: integer("email_sent").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Inboxes - Each user gets their own AgentMail inbox
export const emailInboxes = pgTable("email_inboxes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inboxId: varchar("inbox_id").notNull().unique(),
  emailAddress: varchar("email_address").notNull(),
  displayName: varchar("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Messages - Stored locally for quick access
export const emailMessages = pgTable("email_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  inboxId: integer("inbox_id").notNull().references(() => emailInboxes.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").notNull().unique(),
  threadId: varchar("thread_id"),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  fromAddress: varchar("from_address").notNull(),
  toAddresses: jsonb("to_addresses").notNull().default('[]'),
  ccAddresses: jsonb("cc_addresses").default('[]'),
  subject: text("subject"),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  direction: varchar("direction").notNull().default("inbound"),
  isRead: integer("is_read").default(0),
  attachments: jsonb("attachments").default('[]'),
  sentAt: timestamp("sent_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  applicationSubmissions: many(applicationSubmissions),
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

export const lendersRelations = relations(lenders, ({ one, many }) => ({
  user: one(users, {
    fields: [lenders.userId],
    references: [users.id],
  }),
  applicationSubmissions: many(applicationSubmissions),
}));

export const applicationSubmissionsRelations = relations(applicationSubmissions, ({ one }) => ({
  prospect: one(prospects, {
    fields: [applicationSubmissions.prospectId],
    references: [prospects.id],
  }),
  lender: one(lenders, {
    fields: [applicationSubmissions.lenderId],
    references: [lenders.id],
  }),
  user: one(users, {
    fields: [applicationSubmissions.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  prospects: many(prospects),
  lenders: many(lenders),
  applicationSubmissions: many(applicationSubmissions),
  emailInboxes: many(emailInboxes),
}));

export const emailInboxesRelations = relations(emailInboxes, ({ one, many }) => ({
  user: one(users, {
    fields: [emailInboxes.userId],
    references: [users.id],
  }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  inbox: one(emailInboxes, {
    fields: [emailMessages.inboxId],
    references: [emailInboxes.id],
  }),
  contact: one(contacts, {
    fields: [emailMessages.contactId],
    references: [contacts.id],
  }),
  prospect: one(prospects, {
    fields: [emailMessages.prospectId],
    references: [prospects.id],
  }),
}));

// Lead Uploads - Track CSV upload history
export const leadUploads = pgTable("lead_uploads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  status: varchar("status").notNull().default("processing"),
  totalRows: integer("total_rows").default(0),
  successRows: integer("success_rows").default(0),
  errorRows: integer("error_rows").default(0),
  errors: jsonb("errors").default('[]'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leads - Imported company leads from CSVs
export const leads = pgTable("leads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  uploadId: integer("upload_id").references(() => leadUploads.id, { onDelete: "set null" }),
  companyName: text("company_name").notNull(),
  companyNumber: varchar("company_number", { length: 20 }),
  tradingName: text("trading_name"),
  website: varchar("website"),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  postcode: varchar("postcode"),
  sicCode: varchar("sic_code"),
  contactName: text("contact_name"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  notes: text("notes"),
  rawData: jsonb("raw_data").default('{}'),
  matchStatus: varchar("match_status").notNull().default("pending"),
  matchedCompanyNumber: varchar("matched_company_number"),
  matchConfidence: integer("match_confidence"),
  linkedProspectId: integer("linked_prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadUploadsRelations = relations(leadUploads, ({ one, many }) => ({
  user: one(users, {
    fields: [leadUploads.userId],
    references: [users.id],
  }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  user: one(users, {
    fields: [leads.userId],
    references: [users.id],
  }),
  upload: one(leadUploads, {
    fields: [leads.uploadId],
    references: [leadUploads.id],
  }),
  linkedProspect: one(prospects, {
    fields: [leads.linkedProspectId],
    references: [prospects.id],
  }),
}));

// Underwriting Submissions - Credit underwriter review queue
export const underwritingSubmissions = pgTable("underwriting_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  brokerId: varchar("broker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedUnderwriterId: varchar("assigned_underwriter_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status").notNull().default("submitted"), // submitted, in_review, queried, approved, declined, withdrawn
  priority: varchar("priority").notNull().default("normal"), // low, normal, high, urgent
  brokerComments: text("broker_comments"),
  underwriterNotes: text("underwriter_notes"),
  decisionReason: text("decision_reason"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Underwriting Activity - Track all activity on a submission
export const underwritingActivity = pgTable("underwriting_activity", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  submissionId: integer("submission_id").notNull().references(() => underwritingSubmissions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityType: varchar("activity_type").notNull(), // submitted, claimed, queried, responded, approved, declined, withdrawn, comment
  content: text("content"),
  attachments: jsonb("attachments").default('[]'), // Array of {fileName, fileType, fileSize, storagePath, uploadedAt}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const underwritingSubmissionsRelations = relations(underwritingSubmissions, ({ one, many }) => ({
  prospect: one(prospects, {
    fields: [underwritingSubmissions.prospectId],
    references: [prospects.id],
  }),
  broker: one(users, {
    fields: [underwritingSubmissions.brokerId],
    references: [users.id],
  }),
  assignedUnderwriter: one(users, {
    fields: [underwritingSubmissions.assignedUnderwriterId],
    references: [users.id],
  }),
  activities: many(underwritingActivity),
}));

export const underwritingActivityRelations = relations(underwritingActivity, ({ one }) => ({
  submission: one(underwritingSubmissions, {
    fields: [underwritingActivity.submissionId],
    references: [underwritingSubmissions.id],
  }),
  user: one(users, {
    fields: [underwritingActivity.userId],
    references: [users.id],
  }),
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
    "submission",
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
    z.null(),
  ]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.union([
    z.date(),
    z.string().transform((val) => (val ? new Date(val) : null)),
    z.null(),
  ]).optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLenderSchema = createInsertSchema(lenders).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSubmissionSchema = createInsertSchema(applicationSubmissions, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
  lenderId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
  status: z.enum(["pending", "sent", "approved", "declined", "withdrawn"]).default("pending"),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
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
export type InsertLender = z.infer<typeof insertLenderSchema>;
export type Lender = typeof lenders.$inferSelect;
export type InsertApplicationSubmission = z.infer<typeof insertApplicationSubmissionSchema>;
export type ApplicationSubmission = typeof applicationSubmissions.$inferSelect;

export const insertEmailInboxSchema = createInsertSchema(emailInboxes).omit({
  id: true,
  createdAt: true,
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailInbox = z.infer<typeof insertEmailInboxSchema>;
export type EmailInbox = typeof emailInboxes.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;

export const insertLeadUploadSchema = createInsertSchema(leadUploads).omit({
  id: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateLeadSchema = z.object({
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
  tradingName: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  sicCode: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  matchStatus: z.enum(["pending", "matched", "prospect_created", "ignored"]).optional(),
  matchedCompanyNumber: z.string().optional(),
  matchConfidence: z.number().optional(),
  linkedProspectId: z.number().optional(),
});

export type InsertLeadUpload = z.infer<typeof insertLeadUploadSchema>;
export type LeadUpload = typeof leadUploads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type UpdateLead = z.infer<typeof updateLeadSchema>;

// Underwriting submission schemas
export const insertUnderwritingSubmissionSchema = createInsertSchema(underwritingSubmissions, {
  prospectId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
  status: z.enum(["submitted", "in_review", "queried", "approved", "declined", "withdrawn"]).default("submitted"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
}).omit({
  id: true,
  brokerId: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
});

export const updateUnderwritingSubmissionSchema = z.object({
  status: z.enum(["submitted", "in_review", "queried", "approved", "declined", "withdrawn"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedUnderwriterId: z.string().nullable().optional(),
  underwriterNotes: z.string().optional(),
  decisionReason: z.string().optional(),
});

export const insertUnderwritingActivitySchema = createInsertSchema(underwritingActivity, {
  submissionId: z.union([
    z.number().int().positive(),
    z.string().trim().regex(/^[0-9]+$/).transform(Number),
  ]),
  activityType: z.enum(["submitted", "claimed", "queried", "responded", "approved", "declined", "withdrawn", "comment"]),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertUnderwritingSubmission = z.infer<typeof insertUnderwritingSubmissionSchema>;
export type UnderwritingSubmission = typeof underwritingSubmissions.$inferSelect;
export type UpdateUnderwritingSubmission = z.infer<typeof updateUnderwritingSubmissionSchema>;
export type InsertUnderwritingActivity = z.infer<typeof insertUnderwritingActivitySchema>;
export type UnderwritingActivity = typeof underwritingActivity.$inferSelect;

export const underwritingAttachmentSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  storagePath: z.string(),
  uploadedAt: z.string(),
});

export type UnderwritingAttachment = z.infer<typeof underwritingAttachmentSchema>;

export const queryResponseSchema = z.object({
  submissionId: z.number(),
  message: z.string().min(1, "Please provide a response message"),
  attachments: z.array(underwritingAttachmentSchema).default([]),
});

export type QueryResponse = z.infer<typeof queryResponseSchema>;

export const checklistItemSchema = z.object({
  sectionId: z.string(),
  itemId: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  notes: z.string().default(""),
});

export const underwritingEligibilitySchema = z.object({
  answers: z.record(z.string(), z.boolean()).optional(),
  isEligible: z.boolean().optional(),
  ineligibilityReasons: z.array(z.string()).optional(),
});

export const underwritingFinancialAnalysisSchema = z.object({
  averageMonthlyRevenue: z.number().optional(),
  averageMonthlyExpenses: z.number().optional(),
  netDisposableIncome: z.number().optional(),
  dscr: z.number().optional(),
  riskScore: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  summary: z.string().optional(),
  monthlyBreakdown: z.array(z.object({
    month: z.string(),
    income: z.number(),
    expenses: z.number(),
    net: z.number(),
    closingBalance: z.number(),
  })).optional(),
  transactionCount: z.number().optional(),
  profitAndLoss: z.object({
    turnover: z.number().optional(),
    costOfSales: z.number().optional(),
    grossProfit: z.number().optional(),
    expenses: z.record(z.string(), z.number()).optional(),
    totalExpenses: z.number().optional(),
    netProfit: z.number().optional(),
    periodMonths: z.number().optional(),
  }).optional(),
  excludedTransferValue: z.number().optional(),
  excludedTransferCount: z.number().optional(),
  scenarioModeling: z.object({
    refinanceAddBack: z.number().optional(),
    projectedNewRevenue: z.number().optional(),
  }).optional(),
  redFlags: z.array(z.object({
    label: z.string(),
    isActive: z.boolean(),
  })).optional(),
  preliminaryFindings: z.object({
    loans: z.array(z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      type: z.string(),
      details: z.string(),
    })).optional(),
    transfers: z.array(z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      type: z.string(),
      details: z.string(),
    })).optional(),
    anomalies: z.array(z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      type: z.string(),
      details: z.string(),
    })).optional(),
  }).optional(),
});

export const underwritingAdverseMediaSchema = z.object({
  query: z.string().optional(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number(),
  })).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  flags: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const underwritingAdviserSummarySchema = z.object({
  soarRef: z.string().optional(),
  businessName: z.string().optional(),
  product: z.string().optional(),
  amount: z.number().optional(),
  term: z.number().optional(),
  region: z.string().optional(),
  legalStructure: z.string().optional(),
  sector: z.string().optional(),
  purpose: z.string().optional(),
  sections: z.record(z.string(), z.string()).optional(),
  questionnaire: z.record(z.string(), z.enum(['Yes', 'No', 'N/A'])).optional(),
  recommendation: z.string().optional(),
  nextActions: z.array(z.string()).optional(),
});

export const accountsPdfSchema = z.object({
  year: z.string(),
  fileName: z.string(),
  text: z.string(),
  pages: z.number().optional(),
});

export const accountsAnalysisSchema = z.object({
  years: z.array(z.object({
    yearEnding: z.string(),
    turnover: z.number(),
    grossProfit: z.number(),
    netProfit: z.number(),
    totalAssets: z.number(),
    totalLiabilities: z.number(),
    netAssets: z.number(),
    shareholderFunds: z.number(),
    cashAndEquivalents: z.number(),
    debtors: z.number(),
    creditors: z.number(),
    bankLoans: z.number(),
  })).optional(),
  ratios: z.array(z.object({
    year: z.string(),
    ratios: z.object({
      grossProfitMargin: z.number(),
      netProfitMargin: z.number(),
      currentRatio: z.number(),
      quickRatio: z.number(),
      debtToEquity: z.number(),
      interestCover: z.number(),
      debtorDays: z.number(),
      creditorDays: z.number(),
      returnOnCapitalEmployed: z.number(),
    }),
  })).optional(),
  trends: z.object({
    turnoverGrowth: z.array(z.number()).optional(),
    profitGrowth: z.array(z.number()).optional(),
    netAssetGrowth: z.array(z.number()).optional(),
    trend: z.enum(['improving', 'stable', 'declining']).optional(),
    summary: z.string().optional(),
  }).optional(),
  dscr: z.object({
    historical: z.array(z.number()).optional(),
    average: z.number().optional(),
    trend: z.enum(['improving', 'stable', 'declining']).optional(),
  }).optional(),
  concerns: z.array(z.object({
    category: z.enum(['going_concern', 'contingent_liability', 'related_party', 'auditor_opinion', 'subsequent_event', 'other']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    yearEnding: z.string(),
  })).optional(),
  auditorOpinion: z.string().optional(),
  summary: z.string().optional(),
  riskAssessment: z.enum(['low', 'medium', 'high']).optional(),
});

export const swotAnalysisSchema = z.object({
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  threats: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const underwritingDataSchema = z.object({
  eligibility: underwritingEligibilitySchema.optional(),
  loanDetails: z.object({
    amount: z.number().optional(),
    termMonths: z.number().optional(),
    interestRate: z.number().optional(),
    monthlyRepayment: z.number().optional(),
  }).optional(),
  financialAnalysis: underwritingFinancialAnalysisSchema.optional(),
  csvFileName: z.string().optional(),
  analyzedAt: z.string().optional(),
  adverseMedia: underwritingAdverseMediaSchema.optional(),
  adverseMediaSearchedAt: z.string().optional(),
  accountsPdfs: z.array(accountsPdfSchema).optional(),
  accountsAnalysis: accountsAnalysisSchema.optional(),
  accountsAnalyzedAt: z.string().optional(),
  swotAnalysis: swotAnalysisSchema.optional(),
  swotAnalyzedAt: z.string().optional(),
  adviserSummary: underwritingAdviserSummarySchema.optional(),
  riskGrade: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  completedAt: z.string().optional(),
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
  underwriting: underwritingDataSchema.optional(),
});

export const insertDueDiligenceSchema = createInsertSchema(dueDiligence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDueDiligenceSchema = z.object({
  data: dueDiligenceDataSchema.partial(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type DueDiligenceData = z.infer<typeof dueDiligenceDataSchema>;
export type DueDiligence = typeof dueDiligence.$inferSelect;
export type InsertDueDiligence = z.infer<typeof insertDueDiligenceSchema>;
export type UpdateDueDiligence = z.infer<typeof updateDueDiligenceSchema>;
export type UnderwritingData = z.infer<typeof underwritingDataSchema>;
export type UnderwritingEligibility = z.infer<typeof underwritingEligibilitySchema>;
export type UnderwritingFinancialAnalysis = z.infer<typeof underwritingFinancialAnalysisSchema>;
export type UnderwritingAdverseMedia = z.infer<typeof underwritingAdverseMediaSchema>;
export type UnderwritingAdviserSummary = z.infer<typeof underwritingAdviserSummarySchema>;
