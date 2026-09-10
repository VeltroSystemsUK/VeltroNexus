import { z } from "zod";

// --- Enums & Helpers ---

const dateSchema = z.union([
  z.date(),
  z.string().transform((val) => (val ? new Date(val) : null)),
  z.null()
]).optional();

const numberOrString = z.union([
  z.number().int().positive(),
  z.string().trim().regex(/^[0-9]+$/).transform(Number)
]);

const optionalNumberOrString = z.union([
  z.number().int().positive(),
  z.string().trim().regex(/^[0-9]+$/).transform(Number),
  z.null()
]).optional();

// --- Session Limits ---
export const SESSION_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  team: 5,
  lender: Infinity,
  god_mode: Infinity,
};

// --- Users ---
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  password: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
  role: z.string().default("broker"),
  subscriptionTier: z.string().default("free"),
  prospectLimit: z.number().default(10),
  gocardlessCustomerId: z.string().nullable().optional(),
  gocardlessMandateId: z.string().nullable().optional(),
  gocardlessSubscriptionId: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
  trialEndsAt: dateSchema,
  trialTier: z.string().nullable().optional(),
  currency: z.string().default("GBP"),
  timezone: z.string().default("Europe/London"),
  dateFormat: z.string().default("DD/MM/YYYY"),
  theme: z.string().default("light"),
  pipelineStageNames: z.any().optional(), // JSON
  pdfLayoutPreferences: z.any().optional(), // JSON
  brandingLogoUrl: z.string().nullable().optional(),
  brandingPrimaryColor: z.string().nullable().optional(),
  brandingAccentColor: z.string().nullable().optional(),
  brandingSidebarColor: z.string().nullable().optional(),
  brandingBackgroundColor: z.string().nullable().optional(),
  webhookApiKeyHash: z.string().nullable().optional(),
  webhookApiKeySuffix: z.string().nullable().optional(),
  webhookApiKeyCreatedAt: dateSchema,
  webhookApiKeyLastUsedAt: dateSchema,
  aiDataConsent: z.number().default(0),
  aiDataConsentAt: dateSchema,
  hasUnderwritingAccess: z.number().default(0),
  underwritingAccessExpiresAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
  lastLoginAt: dateSchema,
  lastLogoutAt: dateSchema,
  prospectsCreatedCount: z.number().default(0),
  onboardingEnabled: z.number().default(1),
  onboardingProgress: z.any().optional(), // JSON
  suspended: z.boolean().default(false),
  // Google Workspace Integration
  googleConnected: z.boolean().default(false),
  googleEmail: z.string().nullable().optional(),
  googleAccessToken: z.string().nullable().optional(),
  googleRefreshToken: z.string().nullable().optional(),
  googleTokenExpiry: dateSchema,
});

export type User = z.infer<typeof userSchema>;

export const insertUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  // Make fields explicitly optional for insert if they have defaults/nulls
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(1)
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = InsertUser; // Alias


// --- Sessions (Managed by connect-session-firestore usually, but for type ref) ---
// Not strictly needed as type for app logic usually, but here for completeness
export const sessionSchema = z.object({
  sid: z.string(),
  sess: z.any(),
  expire: dateSchema
});

// --- User Sessions ---
export const userSessionSchema = z.object({
  id: z.number().optional(), // Firestore might use string IDs, but keeping compat
  sessionId: z.string(),
  userId: z.string(),
  userAgent: z.string().nullable().optional(),
  ipHash: z.string().nullable().optional(),
  deviceInfo: z.string().nullable().optional(),
  createdAt: dateSchema,
  lastSeenAt: dateSchema,
  revokedAt: dateSchema,
  revokedReason: z.string().nullable().optional()
});
export type UserSession = z.infer<typeof userSessionSchema>;
export type InsertUserSession = z.infer<typeof userSessionSchema>; // Adjust if needed

// --- System Settings ---
export const systemSettingsSchema = z.object({
  id: z.number().optional(),
  key: z.string(),
  value: z.any(),
  updatedBy: z.string().nullable().optional(),
  updatedAt: dateSchema
});


// --- Lenders ---
export const lenderSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  institutionName: z.string(),
  contactName: z.string().nullable().optional(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lenderType: z.string().default("bank"),
  logoUrl: z.string().nullable().optional(),
  isGlobal: z.number().default(0), // 0 = false, 1 = true
  productTypes: z.array(z.string()).default([]),
  minLoanAmount: z.number().nullable().optional(),
  maxLoanAmount: z.number().nullable().optional(),
  minTermMonths: z.number().nullable().optional(),
  maxTermMonths: z.number().nullable().optional(),
  minLtv: z.number().nullable().optional(),
  maxLtv: z.number().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  portalUrl: z.string().nullable().optional(),
  typicalRateFrom: z.string().nullable().optional(),
  typicalRateTo: z.string().nullable().optional(),
  arrangementFee: z.string().nullable().optional(),
  sectors: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  securityTypes: z.array(z.string()).default([]),
  borrowerTypes: z.array(z.string()).default([]),
  minTradingYears: z.number().nullable().optional(),
  minRevenue: z.number().nullable().optional(),
  minDscr: z.string().nullable().optional(),
  acceptsStartups: z.number().default(0),
  turnaroundDays: z.number().nullable().optional(),
  panelStatus: z.string().default("market"),
  accreditationStatus: z.string().nullable().optional(),
  fcaReference: z.string().nullable().optional(), // Added for LenderFile integration
  accreditationExpiry: dateSchema,
  bdmName: z.string().nullable().optional(),
  bdmEmail: z.string().nullable().optional(),
  bdmPhone: z.string().nullable().optional(),
  underwriterEmail: z.string().nullable().optional(),
  submissionEmail: z.string().nullable().optional(),
  processingNotes: z.string().nullable().optional(),
  creditAppetite: z.string().nullable().optional(),
  keyStrengths: z.string().nullable().optional(),
  keyWeaknesses: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  isFavourite: z.number().default(0),
  introducerAgreementSigned: z.number().default(0),
  lendingPolicy: z.string().nullable().optional(),
  insights: z.string().nullable().optional(),
  tier: z.number().nullable().optional(),
  lastContactedAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema
});
export type Lender = z.infer<typeof lenderSchema>;

export const insertLenderSchema = lenderSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  productTypes: z.array(z.string()).optional().default([]),
  sectors: z.array(z.string()).optional().default([]),
  regions: z.array(z.string()).optional().default([]),
  securityTypes: z.array(z.string()).optional().default([]),
  borrowerTypes: z.array(z.string()).optional().default([]),
});
export type InsertLender = z.infer<typeof insertLenderSchema>;


// --- CDFIs (Community Development Financial Institutions) ---
export const cdfiSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  website: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  postalAddress: z.string().nullable().optional(),
  lendingMinQuantum: z.number().nullable().optional(),
  lendingMaxQuantum: z.number().nullable().optional(),
  geographicalScope: z.array(z.string()).default([]),
  preferredClientTypes: z.array(z.string()).default([]),
  backgroundInfo: z.string().nullable().optional(),
  // Document/application requirements for this specific CDFI. Defaults to the
  // generic borrower checklist until real per-lender requirements are supplied.
  applicationRequirements: z.array(z.string()).default([]),
  lastContacted: dateSchema,
  contactOutcome: z.enum(["not_contacted", "no_answer", "interested", "not_interested", "negotiating"]).default("not_contacted"),
  agreementStatus: z.enum(["unsigned", "in_progress", "signed"]).default("unsigned"),
  agreementSignedDate: dateSchema,
  notes: z.string().nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type CDFI = z.infer<typeof cdfiSchema>;

export const insertCdfiSchema = cdfiSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  id: z.string().optional(),
});
export type InsertCDFI = z.infer<typeof insertCdfiSchema>;

export const updateCdfiSchema = cdfiSchema.partial().omit({
  userId: true,
  createdAt: true,
});
export type UpdateCDFI = z.infer<typeof updateCdfiSchema>;


// --- Lender Products ---
export const lenderProductSchema = z.object({
  id: z.number().optional(),
  lenderId: z.number(),
  productName: z.string(),
  productType: z.string(),
  description: z.string().nullable().optional(),
  minLoanAmount: z.number().nullable().optional(),
  maxLoanAmount: z.number().nullable().optional(),
  minTermMonths: z.number().nullable().optional(),
  maxTermMonths: z.number().nullable().optional(),
  minLtv: z.number().nullable().optional(),
  maxLtv: z.number().nullable().optional(),
  rateType: z.string().nullable().optional(),
  minRate: z.string().nullable().optional(),
  maxRate: z.string().nullable().optional(),
  typicalRate: z.string().nullable().optional(),
  arrangementFee: z.string().nullable().optional(),
  exitFee: z.string().nullable().optional(),
  securityRequirements: z.string().nullable().optional(),
  eligibilityCriteria: z.record(z.unknown()).default({}),
  features: z.array(z.string()).default([]),
  isActive: z.number().default(1),
  notes: z.string().nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type LenderProduct = z.infer<typeof lenderProductSchema>;

export const insertLenderProductSchema = lenderProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  eligibilityCriteria: z.record(z.any()).optional().default({}),
  features: z.array(z.string()).optional().default([]),
});
export type InsertLenderProduct = z.infer<typeof insertLenderProductSchema>;
export type LenderWithProducts = Lender & { products: LenderProduct[] };


// --- Companies ---
export const companySchema = z.object({
  id: z.number().optional(),
  companyName: z.string(),
  companyNumber: z.string(),
  registeredAddress: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  incorporationDate: z.string().nullable().optional(),
  companyStatus: z.string().nullable().optional(),
  companyType: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  sicCode: z.string().nullable().optional(),
  sicDescription: z.string().nullable().optional(),
  creditsafeId: z.string().nullable().optional(),
  creditsafeScore: z.string().nullable().optional(),
  creditsafeRatingDescription: z.string().nullable().optional(),
  creditsafeCreditLimit: z.number().nullable().optional(),
  creditsafeCheckedAt: dateSchema.nullable().optional(),
  creditsafeReport: z.string().nullable().optional(),
  createdAt: dateSchema,
  lastCheckedAt: z.string().nullable().optional(),
  companiesHouseSnapshot: z.record(z.any()).nullable().optional(),
});
export type Company = z.infer<typeof companySchema>;
export const insertCompanySchema = companySchema.omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// --- Verification exceptions (Companies House monitoring, Google Places address
// checks, due-diligence flags — e.g. HMRC Time To Pay — all file into this) ---
export const verificationExceptionSchema = z.object({
  id: z.number().optional(),
  prospectId: z.number(),
  source: z.enum(["companies_house", "google_places", "due_diligence"]),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  message: z.string(),
  status: z.enum(["open", "acknowledged", "resolved"]).default("open"),
  createdAt: dateSchema,
});
export type VerificationException = z.infer<typeof verificationExceptionSchema>;
export const insertVerificationExceptionSchema = verificationExceptionSchema.omit({
  id: true,
  createdAt: true,
  status: true,
});
export type InsertVerificationException = z.infer<typeof insertVerificationExceptionSchema>;


// --- Prospects ---
export const prospectSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  teamId: z.number().nullable().optional(),
  companyId: z.number(),
  stage: z.string().default("lead"),
  loanAmount: z.number().nullable().optional(),
  term: z.number().nullable().optional(),
  interestRate: z.string().nullable().optional(),
  directorsGuarantee: z.number().default(0),
  commercialProperty: z.number().default(0),
  homeEquity: z.number().default(0),
  propertyOther: z.number().default(0),
  debenture: z.number().default(0),
  parentCompanyGuarantee: z.number().default(0),
  collateral: z.number().default(0),
  crossCompanyGuarantee: z.number().default(0),
  loanRequirementNotes: z.string().nullable().optional(),
  loanAllocation: z.any().default([]),
  priority: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  savedAssociations: z.any().default([]),
  queueOrder: z.number().default(0),
  referralSource: z.string().nullable().optional(),
  background: z.string().nullable().optional(),
  adviserRecommendation: z.string().nullable().optional(),
  adviserRecommendationSignedBy: z.string().nullable().optional(),
  adviserRecommendationSignedAt: dateSchema,
  loanRequirementData: z.any().optional(),
  researchData: z.any().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Prospect = z.infer<typeof prospectSchema>;
export type ProspectWithCompany = Prospect & { company: Company };

export const insertProspectSchema = prospectSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  companyId: numberOrString,
  loanAmount: optionalNumberOrString
});
export type InsertProspect = z.infer<typeof insertProspectSchema>;

export const updateProspectStageSchema = z.object({
  prospectId: z.number(),
  stage: z.string().min(1),
});


// --- Contacts ---
export const contactSchema = z.object({
  id: z.number().optional(),
  prospectId: z.number(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  isPrimary: z.number().default(0),
  profilePicture: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: dateSchema,
});
export type Contact = z.infer<typeof contactSchema>;

export const insertContactSchema = contactSchema.omit({
  id: true,
  createdAt: true
}).extend({
  prospectId: numberOrString
});
export type InsertContact = z.infer<typeof insertContactSchema>;


// --- Activities ---
export const activitySchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  prospectId: z.number().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  activityType: z.string().default("task"),
  priority: z.string().default("medium"),
  dueDate: dateSchema,
  completed: z.number().default(0),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Activity = z.infer<typeof activitySchema>;

export const insertActivitySchema = activitySchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  prospectId: optionalNumberOrString,
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.union([z.date(), z.string().transform((val) => (val ? new Date(val) : null)), z.null()]).optional(),
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;


// --- Due Diligence ---
// Keep pure Zod schemas as they were
export const checklistItemSchema = z.object({
  sectionId: z.string(),
  itemId: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  answer: z.enum(["yes", "no", "na", ""]).optional(),
  notes: z.string().default(""),
});

export const underwritingAttachmentSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  storagePath: z.string(),
  uploadedAt: z.string(),
});
export type UnderwritingAttachment = z.infer<typeof underwritingAttachmentSchema>;

// ... (Complex nested schemas from original file) ...
// For brevity, I will copy the critical nested schemas but assume 'any' for very complex nested structures if they aren't critical for initial port, 
// OR simpler: Copy them exactly.
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
  riskScore: z.enum(["A", "B", "C", "D", "E"]).optional(),
  summary: z.string().optional(),
  monthlyBreakdown: z.array(z.any()).optional(), // Simplified for now
  transactionCount: z.number().optional(),
  profitAndLoss: z.object({
    periodMonths: z.number().optional(),
    turnover: z.number().optional(),
    costOfSales: z.number().optional(),
    grossProfit: z.number().optional(),
    totalExpenses: z.number().optional(),
    netProfit: z.number().optional(),
  }).optional(),
  excludedTransferValue: z.number().optional(),
  excludedTransferCount: z.number().optional(),
  scenarioModeling: z.any().optional(),
  redFlags: z.array(z.string()).optional(),
  preliminaryFindings: z.record(z.unknown()).optional(),
});

export const underwritingAdverseMediaSchema = z.object({
  query: z.string().optional(),
  results: z.array(z.any()).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  flags: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const underwritingAdviserSummarySchema = z.object({
  recommendation: z.string().optional(),
  // Allow other fields loosely
}).catchall(z.unknown());

export const accountsPdfSchema = z.object({
  year: z.string(),
  fileName: z.string(),
  text: z.string(),
  pages: z.number().optional(),
});

export const accountsAnalysisSchema = z.object({
  years: z.array(z.any()).optional(),
  ratios: z.array(z.any()).optional(),
  trends: z.any().optional(),
  dscr: z.number().optional(),
  concerns: z.array(z.string()).optional(),
  notesToAccounts: z.array(z.any()).optional(),
  auditorOpinion: z.string().optional(),
  summary: z.string().optional(),
  riskAssessment: z.enum(["low", "medium", "high"]).optional(),
});

export const swotAnalysisSchema = z.object({
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  threats: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const openBankingSchema = z.object({
  status: z.enum(["not_sent", "invited", "connected", "expired", "error"]).default("not_sent"),
  invitedAt: z.string().optional(),
  connectedAt: z.string().optional(),
  customerEmail: z.string().optional(),
  linkId: z.string().optional(),
});

export const managementAccountsSchema = z.object({
  files: z.array(z.any()).optional(),
  analysis: z.any().optional(),
}).catchall(z.unknown());

export const accountingSoftwareSchema = z.object({
  status: z.string().optional(),
}).catchall(z.unknown());

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
  riskGrade: z.enum(["A", "B", "C", "D", "E"]).optional(),
  completedAt: z.string().optional(),
  openBanking: openBankingSchema.optional(),
  bankPdfFiles: z.array(z.any()).optional(),
  analysisSource: z.enum(["csv", "pdf", "openbanking"]).optional(),
  managementAccounts: managementAccountsSchema.optional(),
  accountingSoftware: accountingSoftwareSchema.optional(),
});

export const proposalGradeSchema = z.enum(["A", "B", "C", "D", "E"]);
export const proposalOverridesSchema = z.object({
  gradeNow: proposalGradeSchema.nullable().optional(),
  gradeAfter: proposalGradeSchema.nullable().optional(),
  by: z.string().nullable().optional(),
  at: z.string().optional().nullable(),
});
export const proposalSlotsSchema = z.object({
  background: z.array(z.string()).optional(),
  theBusiness: z.array(z.string()).optional(),
  campari: z.record(z.string(), z.array(z.string())).optional(),
  swot: z
    .object({
      strengths: z.array(z.string()).optional(),
      weaknesses: z.array(z.string()).optional(),
      opportunities: z.array(z.string()).optional(),
      threats: z.array(z.string()).optional(),
    })
    .optional(),
  bankFindings: z.array(z.string()).optional(),
  recommendation: z.array(z.string()).optional(),
});

export const dueDiligenceDataSchema = z.object({
  checklist: z.array(checklistItemSchema).default([]),
  attachmentsChecklist: z
    .array(
      z.object({
        id: z.string(),
        attached: z.boolean(),
      })
    )
    .optional(),
  loanCalculator: z.any().optional(),
  hirePurchase: z.any().optional(), // Added
  dscr: z.any().optional(),
  affordability: z.any().optional(),
  financialRatios: z.any().optional(),
  character: z.any().optional(),
  underwriting: underwritingDataSchema.optional(),
  // Self-reported by the adviser during intake — there is no public HMRC API
  // for this, it is not a live lookup.
  hmrcTimeToPay: z.enum(["none", "active", "historic"]).optional(),
  // Link to the standalone Strata lender-pack app (not a copy of that product).
  strataPackaging: z.any().optional(),
  proposal: z
    .object({
      overrides: proposalOverridesSchema.optional(),
      slots: proposalSlotsSchema.optional(),
    })
    .optional(),
  cashflowForecast: z.any().optional(),
  applicationData: z.any().optional(),
});

export const dueDiligenceSchema = z.object({
  id: z.number().optional(),
  prospectId: z.number(),
  data: dueDiligenceDataSchema.default({}),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type DueDiligence = z.infer<typeof dueDiligenceSchema>;

export const insertDueDiligenceSchema = dueDiligenceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertDueDiligence = z.infer<typeof insertDueDiligenceSchema>;
export type DueDiligenceData = z.infer<typeof dueDiligenceDataSchema>;

export const updateDueDiligenceSchema = z.object({
  data: dueDiligenceDataSchema.partial(),
});
export type UpdateDueDiligence = z.infer<typeof updateDueDiligenceSchema>;


// --- Lender Interactions ---
export const lenderInteractionSchema = z.object({
  id: z.number().optional(),
  lenderId: z.number(),
  prospectId: z.number().nullable().optional(),
  userId: z.string(),
  interactionType: z.string(),
  channel: z.string().default("email"),
  subject: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().default("sent"),
  sentAt: dateSchema,
  respondedAt: dateSchema,
  outcome: z.string().nullable().optional(),
  followUpDate: dateSchema,
  attachments: z.any().default([]),
  createdAt: dateSchema,
  updatedAt: dateSchema
});
export type LenderInteraction = z.infer<typeof lenderInteractionSchema>;
export const insertLenderInteractionSchema = lenderInteractionSchema.omit({
  id: true, createdAt: true, updatedAt: true
}).extend({
  attachments: z.array(z.any()).optional().default([])
});
export type InsertLenderInteraction = z.infer<typeof insertLenderInteractionSchema>;

// --- Lender Notes (Diary) ---
export const lenderNoteSchema = z.object({
  id: z.number().optional(),
  lenderId: z.number(),
  userId: z.string(),
  content: z.string().min(1, "Note content cannot be empty"),
  createdAt: dateSchema,
  updatedAt: dateSchema
});
export type LenderNote = z.infer<typeof lenderNoteSchema>;

export const insertLenderNoteSchema = lenderNoteSchema.omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertLenderNote = z.infer<typeof insertLenderNoteSchema>;


// --- Application Submissions ---
export const applicationSubmissionSchema = z.object({
  id: z.number().optional(),
  prospectId: z.number(),
  lenderId: z.number(),
  userId: z.string(),
  commentary: z.string().nullable().optional(),
  status: z.string().default("pending"),
  sentAt: dateSchema,
  responseNotes: z.string().nullable().optional(),
  attachments: z.any().default([]),
  emailSent: z.number().default(0),
  createdAt: dateSchema,
  updatedAt: dateSchema
});
export type ApplicationSubmission = z.infer<typeof applicationSubmissionSchema>;
export const insertApplicationSubmissionSchema = applicationSubmissionSchema.omit({
  id: true, userId: true, createdAt: true, updatedAt: true, sentAt: true
}).extend({
  prospectId: numberOrString,
  lenderId: numberOrString,
  status: z.enum(["pending", "sent", "approved", "declined", "withdrawn"]).default("pending")
});
export type InsertApplicationSubmission = z.infer<typeof insertApplicationSubmissionSchema>;


// --- Email Types (Stubbed for now) ---
export type EmailInbox = any;
export type EmailMessage = any;


// --- Lead Types ---
// Minimal strict typing for now since they are less critical for core flow
export const leadUploadSchema = z.object({
  id: z.number(),
  userId: z.string(),
  fileName: z.string(),
  status: z.string().default("pending"),
  totalRows: z.number().default(0),
  successRows: z.number().default(0),
  errorRows: z.number().default(0),
  errors: z.array(z.any()).default([]),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type LeadUpload = z.infer<typeof leadUploadSchema>;
export const insertLeadUploadSchema = z.any();

export const leadSchema = z.object({
  id: z.number(),
  companyName: z.string(),
  companyNumber: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  matchStatus: z.string().default("pending"),
  matchedCompanyNumber: z.string().nullable().optional(),
  linkedProspectId: z.number().nullable().optional(),
});
export type Lead = z.infer<typeof leadSchema>;
export const insertLeadSchema = leadSchema.omit({ id: true });
export const updateLeadSchema = leadSchema.partial();

// --- Additional Exports for Type Compatibility ---
export type DocumentCategory = "general" | "financial" | "legal" | "identity" | "property" | "insurance" | "correspondence" | "other";

// --- Communications Module ---

export const communicationIntegrationSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  provider: z.enum(["sendgrid", "twilio", "whatsapp"]),
  credentials: z.any().optional(), // Encrypted JSON - Optional for updates
  isEnabled: z.number().default(1),
  createdAt: dateSchema,
});
export type CommunicationIntegration = z.infer<typeof communicationIntegrationSchema>;
export const insertCommunicationIntegrationSchema = communicationIntegrationSchema.omit({
  id: true, createdAt: true
});
export type InsertCommunicationIntegration = z.infer<typeof insertCommunicationIntegrationSchema>;

export const communicationTemplateSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  name: z.string(),
  channel: z.enum(["email", "sms", "whatsapp"]),
  subject: z.string().nullable().optional(),
  content: z.string(),
  createdAt: dateSchema,
});
export type CommunicationTemplate = z.infer<typeof communicationTemplateSchema>;
export const insertCommunicationTemplateSchema = communicationTemplateSchema.omit({
  id: true, createdAt: true
});
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;

export const communicationLogSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  prospectId: z.number(),
  contactId: z.number().nullable().optional(),
  channel: z.enum(["email", "sms", "whatsapp"]),
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  status: z.enum(["sent", "delivered", "failed", "received"]).default("sent"),
  subject: z.string().nullable().optional(),
  content: z.string(),
  metadata: z.any().optional(),
  sentAt: dateSchema,
});
export type CommunicationLog = z.infer<typeof communicationLogSchema>;
export const insertCommunicationLogSchema = communicationLogSchema.omit({
  id: true, sentAt: true
});
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;

// Channels
export const channelSchema = z.object({
  id: z.number().optional(),
  type: z.enum(["direct", "group", "prospect"]).default("direct"),
  name: z.string().nullable().optional(), // For group chats
  contextId: z.number().nullable().optional(), // e.g. linked prospect ID
  lastMessageAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Channel = z.infer<typeof channelSchema>;
export const insertChannelSchema = channelSchema.omit({
  id: true, createdAt: true, updatedAt: true, lastMessageAt: true
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export const channelMemberSchema = z.object({
  id: z.number().optional(),
  channelId: z.number(),
  userId: z.string(),
  lastReadAt: dateSchema,
  joinedAt: dateSchema,
});
export type ChannelMember = z.infer<typeof channelMemberSchema>;
export const insertChannelMemberSchema = channelMemberSchema.omit({
  id: true, joinedAt: true
});
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;

export const messageSchema = z.object({
  id: z.number().optional(),
  channelId: z.number(),
  senderId: z.string(),
  content: z.string(),
  attachments: z.any().default([]),
  readBy: z.any().default([]), // simple array of userIds
  createdAt: dateSchema,
});
export type Message = z.infer<typeof messageSchema>;
export const insertMessageSchema = messageSchema.omit({
  id: true, createdAt: true, readBy: true
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;


// Teams
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  createdBy: z.string().optional()
});
export type Team = z.infer<typeof teamSchema>;
export const insertTeamSchema = teamSchema.omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export const teamMemberSchema = z.object({ id: z.number(), teamId: z.number(), userId: z.string(), memberRole: z.string() });
export type TeamMember = z.infer<typeof teamMemberSchema>;
export const insertTeamMemberSchema = teamMemberSchema.omit({ id: true });
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Underwriting Submissions
export type UnderwritingSubmission = any;
export type InsertUnderwritingSubmission = any;
export type UnderwritingActivity = any;


// Add Ons
export type AddOnProduct = any;
export type AddOnPurchase = any;
export const insertAddOnProductSchema = z.any();
export const insertAddOnPurchaseSchema = z.any();

// Webhooks
export const webhookProspectSchema = z.object({
  loanAmount: z.number().positive().optional(),
  term: z.number().positive().optional(),
}).catchall(z.unknown());

export const webhookCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyNumber: z.string().optional(),
}).catchall(z.unknown());

// --- Missing Exports for Compatibility ---
export type UpdateProspectStage = z.infer<typeof updateProspectStageSchema>;

export type InsertEmailInbox = any;
export type InsertEmailMessage = any;

export type InsertLead = any;
export type UpdateLead = any;
export type InsertLeadUpload = any;

export type UpdateUnderwritingSubmission = any;
export type InsertUnderwritingActivity = any;

// --- Document Management ---
export const prospectDocumentSchema = z.object({
  id: z.number().optional(),
  prospectId: z.number(),
  userId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  storagePath: z.string(),
  category: z.string().default("general"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  notes: z.string().nullable().optional(),
  uploadedAt: dateSchema,
  createdAt: dateSchema
});
export type ProspectDocument = z.infer<typeof prospectDocumentSchema>;
export const insertProspectDocumentSchema = prospectDocumentSchema.omit({
  id: true, createdAt: true, uploadedAt: true
});
export type InsertProspectDocument = z.infer<typeof insertProspectDocumentSchema>;


export type InsertAddOnProduct = any;
export type UpdateAddOnProduct = any;

export type TimeEntry = any;
export type InsertTimeEntry = any;
export type InsertAddOnPurchase = any;

export const insertTimeEntrySchema = z.any();
export const queryResponseSchema = z.any();
export const webhookProspectPayloadSchema = z.any();
export type WebhookProspect = any;
export type UnderwritingData = any;
export type ChecklistItem = any;
export type UnderwritingSummary = any;

export const lenderEnquiries = {
  id: "lenderEnquiries" // Stub for now
};

// --- Session Limits ---
// Re-exporting/Modifying here if needed, or just relying on what's defined earlier.
// Actually SESSION_LIMITS is defined at line 23. Let's find it and add god_mode.


// --- Constants ---
export const LENDER_TIERS = [
  { value: 1.0, label: "Tier 1.0 - Major Banks" },
  { value: 1.5, label: "Tier 1.5 - Challenger & Vendor" },
  { value: 2.0, label: "Tier 2.0 - Alternative & CDFI" },
  { value: 2.5, label: "Tier 2.5 - Specialised Lenders" },
  { value: 3.0, label: "Tier 3.0 - Sub Prime Lenders" },
];

export const LENDER_TYPES = [
  { value: "tier1.0", label: "Tier 1.0 - Major Banks" },
  { value: "tier1.5", label: "Tier 1.5 - Challenger & Vendor" },
  { value: "tier2.0", label: "Tier 2.0 - Alternative & CDFI" },
  { value: "tier2.5", label: "Tier 2.5 - Specialised Lenders" },
  { value: "tier3.0", label: "Tier 3.0 - Sub Prime Lenders" },
];

export const PRODUCT_TYPES = [
  "Term Loan",
  "Revolving Credit",
  "Asset Finance",
  "Invoice Finance",
  "Merchant Cash Advance",
  "Commercial Mortgages",
  "Bridging",
  "Trade Finance",
  "Development Finance",
  "Buy-to-Let",
  "Mezzanine",
  "Equity Release",
  "Working Capital",
  "Vehicle Finance", // Added
  "Equipment Leasing", // Added
  "Stock Finance", // Added
  "Supply Chain Finance", // Added
  "Export Finance", // Added
  "Import Finance", // Added
  "Litigation Funding", // Added
  "VAT Loans", // Added
  "Tax Loans", // Added
  "Unsecured Business Loans", // Added
];

export const SECTORS = [
  "Manufacturing",
  "Retail",
  "Technology",
  "Healthcare",
  "Construction",
  "Real Estate",
  "Hospitality",
  "Transport",
  "Agriculture",
  "Energy",
  "Professional Services",
  "Wholesale",
];

export const REGIONS = [
  "National",
  "London",
  "South East",
  "South West",
  "East of England",
  "Midlands",
  "North West",
  "North East",
  "Yorkshire",
  "Scotland",
  "Wales",
  "Northern Ireland",
];

export const PANEL_STATUSES = [
  { value: "panel", label: "On Panel", color: "default" as const },
  { value: "preferred", label: "Preferred", color: "default" as const },
  { value: "market", label: "Whole of Market", color: "secondary" as const },
  { value: "restricted", label: "Restricted", color: "destructive" as const },
];

// --- Internal Sales CRM (Veltro God Mode) ---
export const internalLeadSchema = z.object({
  id: z.number(),
  companyName: z.string(),
  companyNumber: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.string().default("new"), // new, contacted, demo_booked, trial, subscribed, churned
  assignedAgentId: z.string().optional(), // User ID of the sales agent
  commissionRate: z.number().default(0.1), // e.g. 10%
  notes: z.string().optional(),
  estimatedValue: z.number().optional(),

  // Rich Data Fields
  address: z.string().optional(),
  city: z.string().optional(),
  hasCharges: z.boolean().optional().default(false),
  identifiedLender: z.string().optional(), // The Registered Charge holder
  chargeDate: z.string().optional(),
  chargeAmount: z.number().optional(),
  chargeStatus: z.string().optional(), // active, satisfied, none
  totalChargesCount: z.number().optional().default(0),
  satisfiedChargesCount: z.number().optional().default(0),
  companyType: z.string().optional(),
  sicCode: z.string().optional(),
  incorporationDate: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(), // Company LinkedIn Page

  // JSON field for contacts array [{ name, role, email, phone, linkedinUrl }]
  contacts: z.any().default([]),

  // Duplicate detection
  possibleDuplicate: z.boolean().optional().default(false),
  duplicateOf: z.number().nullable().optional(), // ID of the existing record this may be a duplicate of

  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const insertInternalLeadSchema = internalLeadSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InternalLead = z.infer<typeof internalLeadSchema>;
export type InsertInternalLead = z.infer<typeof insertInternalLeadSchema>;

export const commissionSchema = z.object({
  id: z.number(),
  agentId: z.string(),
  leadId: z.number(), // ID from internalLeadSchema
  amount: z.number(),
  status: z.string().default("pending"), // pending, paid, cancelled
  paidAt: dateSchema.nullable().optional(),
  createdAt: dateSchema,
});

export const insertCommissionSchema = commissionSchema.omit({
  id: true,
  createdAt: true,
});

export type Commission = z.infer<typeof commissionSchema>;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;

export const SALES_AGENT_ROLE = "sales_agent";

// --- Media Assets ---
export const MEDIA_CATEGORIES = [
  { value: "business_corporate", label: "Business & Corporate" },
  { value: "finance_banking", label: "Finance & Banking" },
  { value: "property_real_estate", label: "Property & Real Estate" },
  { value: "professional_people", label: "Professional People" },
  { value: "technology_digital", label: "Technology & Digital" },
  { value: "charts_data", label: "Charts & Data" },
  { value: "city_architecture", label: "City & Architecture" },
  { value: "abstract_backgrounds", label: "Abstract & Backgrounds" },
  { value: "uncategorised", label: "Uncategorised" },
] as const;

export const mediaAssetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  filename: z.string(),
  url: z.string(),
  size: z.number(),
  mimeType: z.string(),
  category: z.string().optional(),
  isStock: z.boolean().optional(),
  credit: z.string().optional(),
  createdAt: dateSchema,
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

// --- Marketing Contacts ---
export const marketingContactSchema = z.object({
  id: z.number(),
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
  qualityGrade: z.enum(["A", "B", "C", "D", "F"]).default("A"),
  deliverabilityScore: z.number().default(100),
  status: z.enum(["valid", "invalid", "risky"]).default("valid"),
  tags: z.array(z.string()).default([]),
  unsubscribed: z.boolean().default(false),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const insertMarketingContactSchema = marketingContactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingContact = z.infer<typeof marketingContactSchema>;
export type InsertMarketingContact = z.infer<typeof insertMarketingContactSchema>;

// --- Waitlist ---

export const waitlistEntrySchema = z.object({
  id: z.number(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().default("landing"),
  trialInterest: z.boolean().default(false),
  status: z.enum(["pending", "contacted", "converted"]).default("pending"),
  unsubscribed: z.boolean().default(false),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const insertWaitlistEntrySchema = waitlistEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;
export type InsertWaitlistEntry = z.infer<typeof insertWaitlistEntrySchema>;

// --- Email Marketing Templates ---
export const emailTemplateCategoryEnum = z.enum([
  "cold_outreach",
  "follow_up",
  "newsletter",
  "announcement",
  "onboarding",
  "re_engagement",
  "custom",
]);
export type EmailTemplateCategory = z.infer<typeof emailTemplateCategoryEnum>;

export const emailTemplateSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject line is required"),
  content: z.string(),
  designJson: z.any().optional(),
  previewText: z.string().nullable().optional(),
  category: emailTemplateCategoryEnum.default("custom"),
  tags: z.array(z.string()).default([]),
  thumbnailColor: z.string().default("#D4A843"),
  isArchived: z.boolean().default(false),
  lastUsedAt: dateSchema,
  useCount: z.number().default(0),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export const insertEmailTemplateSchema = emailTemplateSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
  useCount: true,
});
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// --- Email Marketing Campaigns ---
export const emailCampaignStatusEnum = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "cancelled",
]);
export type EmailCampaignStatus = z.infer<typeof emailCampaignStatusEnum>;

export const emailCampaignSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  name: z.string().min(1, "Campaign name is required"),
  subject: z.string().min(1, "Subject line is required"),
  templateId: z.number().nullable().optional(),
  content: z.string(),
  designJson: z.any().optional(),
  status: emailCampaignStatusEnum.default("draft"),
  recipientSource: z.enum(["manual", "marketing_contacts", "prospects", "leads", "mixed"]).default("manual"),
  recipientFilter: z.any().optional(),
  recipientCount: z.number().default(0),
  scheduledAt: dateSchema,
  sentAt: dateSchema,
  completedAt: dateSchema,
  totalSent: z.number().default(0),
  totalDelivered: z.number().default(0),
  totalOpened: z.number().default(0),
  totalClicked: z.number().default(0),
  totalBounced: z.number().default(0),
  totalUnsubscribed: z.number().default(0),
  totalFailed: z.number().default(0),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type EmailCampaign = z.infer<typeof emailCampaignSchema>;
export const insertEmailCampaignSchema = emailCampaignSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  completedAt: true,
  totalSent: true,
  totalDelivered: true,
  totalOpened: true,
  totalClicked: true,
  totalBounced: true,
  totalUnsubscribed: true,
  totalFailed: true,
});
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

// --- Campaign Recipients ---
export const campaignRecipientStatusEnum = z.enum([
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "failed",
  "unsubscribed",
]);

export const campaignRecipientSchema = z.object({
  id: z.number().optional(),
  campaignId: z.number(),
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  sourceType: z.enum(["marketing_contact", "prospect", "lead", "manual"]),
  sourceId: z.number().nullable().optional(),
  status: campaignRecipientStatusEnum.default("pending"),
  sentAt: dateSchema,
  openedAt: dateSchema,
  clickedAt: dateSchema,
  bouncedAt: dateSchema,
  errorMessage: z.string().nullable().optional(),
  verificationStatus: z.enum(["unverified", "valid", "risky", "invalid"]).default("unverified"),
  verificationGrade: z.enum(["A", "B", "C", "D", "F"]).nullable().optional(),
  verificationScore: z.number().nullable().optional(),
  createdAt: dateSchema,
});
export type CampaignRecipient = z.infer<typeof campaignRecipientSchema>;
export const insertCampaignRecipientSchema = campaignRecipientSchema.omit({
  id: true,
  createdAt: true,
  sentAt: true,
  openedAt: true,
  clickedAt: true,
  bouncedAt: true,
});
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// --- Email Marketing Constants ---
export const EMAIL_MERGE_TAGS = [
  { tag: "{{firstName}}", description: "Recipient first name" },
  { tag: "{{lastName}}", description: "Recipient last name" },
  { tag: "{{companyName}}", description: "Recipient company name" },
  { tag: "{{email}}", description: "Recipient email address" },
  { tag: "{{senderName}}", description: "James Hale" },
  { tag: "{{senderCompany}}", description: "Strata Finance" },
  { tag: "{{unsubscribeLink}}", description: "Unsubscribe link" },
  { tag: "{{currentDate}}", description: "Current date" },
] as const;

export const EMAIL_TEMPLATE_CATEGORIES = [
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "follow_up", label: "Follow Up" },
  { value: "newsletter", label: "Newsletter" },
  { value: "announcement", label: "Announcement" },
  { value: "onboarding", label: "Onboarding" },
  { value: "re_engagement", label: "Re-engagement" },
  { value: "custom", label: "Custom" },
] as const;

export const editorialTypeEnum = z.enum(["blog", "press_release", "news"]);
export const editorialStatusEnum = z.enum(["draft", "approved", "rejected", "exported"]);
export const editorialComplianceEnum = z.enum(["pending", "cleared", "blocked"]);

export const caseyNoteSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const editorialEngineSchema = z
  .object({
    provider: z.enum(["anthropic", "xai"]),
    model: z.string(),
  })
  .nullable();

export const editorialLinkedInPackSchema = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const editorialPieceSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  type: editorialTypeEnum,
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  body: z.string().default(""),
  notes: z.array(caseyNoteSchema).default([]),
  engine: editorialEngineSchema.default(null),
  status: editorialStatusEnum.default("draft"),
  compliance: editorialComplianceEnum.default("pending"),
  autoPublish: z.literal(false).default(false),
  heroImageUrl: z.string().nullable().optional().default(null),
  linkedinPack: editorialLinkedInPackSchema.nullable().optional().default(null),
  exportedAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type EditorialPiece = z.infer<typeof editorialPieceSchema>;
export const insertEditorialPieceSchema = editorialPieceSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  exportedAt: true,
});
export type InsertEditorialPiece = z.infer<typeof insertEditorialPieceSchema>;
export const createEditorialPieceSchema = editorialPieceSchema.pick({
  type: true,
  title: true,
  topic: true,
});

export const learnVideoSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  title: z.string().min(1),
  topic: z.string().min(1),
  description: z.string().default(""),
  transcript: z.string().default(""),
  videoUrl: z.string().default(""),
  excerpt: z.string().default(""),
  heroImageUrl: z.string().nullable().optional().default(null),
  durationLabel: z.string().default(""),
  pathPosition: z.number().int().min(1).max(6).nullable().optional().default(null),
  notes: z.array(caseyNoteSchema).default([]),
  engine: editorialEngineSchema.default(null),
  status: editorialStatusEnum.default("draft"),
  compliance: editorialComplianceEnum.default("pending"),
  autoPublish: z.literal(false).default(false),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type LearnVideo = z.infer<typeof learnVideoSchema>;
export const createLearnVideoSchema = learnVideoSchema.pick({ title: true, topic: true });

export const learnPieceSourceSchema = z.object({
  desk: z.enum(["editorial", "learn-video", "craft"]),
  id: z.union([z.number(), z.string()]),
});
export const learnNewsCategoryEnum = z.enum(["uk_commercial_finance", "uk_economy", "uk_politics"]);
export const learnPieceSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  slug: z.string().min(1),
  kind: z.enum(["article", "video", "news"]),
  title: z.string().min(1),
  excerpt: z.string().default(""),
  heroImageUrl: z.string().nullable().optional().default(null),
  body: z.string().default(""),
  videoUrl: z.string().default(""),
  transcript: z.string().default(""),
  pathPosition: z.number().int().min(1).max(6).nullable().optional().default(null),
  durationLabel: z.string().default(""),
  thisHelped: z.number().int().nonnegative().default(0),
  thisNotHelped: z.number().int().nonnegative().default(0),
  source: learnPieceSourceSchema,
  category: learnNewsCategoryEnum.nullable().optional().default(null),
  live: z.boolean().default(false),
  publishedAt: dateSchema,
  unpublishedAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type LearnPiece = z.infer<typeof learnPieceSchema>;

export const learnBotLogSchema = z.object({
  id: z.number().optional(),
  createdAt: dateSchema,
  slug: z.string().nullable().optional().default(null),
  question: z.string(),
  handoff: z.boolean(),
  retrievedIds: z.array(z.number()).default([]),
});
export type LearnBotLog = z.infer<typeof learnBotLogSchema>;

export const learnNewsCommentSchema = z.object({
  id: z.number().optional(),
  pieceId: z.number(),
  name: z.string().min(2).max(80),
  emailHash: z.string().min(1),
  body: z.string().min(20).max(800),
  marketingOptIn: z.boolean().default(false),
  live: z.boolean().default(true),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type LearnNewsComment = z.infer<typeof learnNewsCommentSchema>;

// --- Scraped Leads (Auto-Qualified) ---
export const scrapedLeadSchema = z.object({
  id: z.number().optional(),
  companyName: z.string(),
  companyNumber: z.string(),
  sicCode: z.string().nullable().optional(),
  incorporationDate: z.string().nullable().optional(),

  // Google Maps Data
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  reviewCount: z.number().nullable().optional(),
  googlePlaceId: z.string().nullable().optional(),

  // Scoring
  score: z.number().default(0),
  priority: z.enum(["low", "medium", "high"]).default("low"),
  recommendedApproach: z.string().nullable().optional(),

  // Debt Markers
  identifiedLender: z.string().nullable().optional(),
  chargeDate: dateSchema,
  chargeAmount: z.number().nullable().optional(),

  // Financial Audit
  cashAtBank: z.number().nullable().optional(),
  creditorsDue: z.number().nullable().optional(),
  netAssets: z.number().nullable().optional(),
  crisisRatio: z.number().nullable().optional(),

  // Status
  status: z.enum(["new", "contacted", "converted", "rejected"]).default("new"),
  emailDraftId: z.number().nullable().optional(), // Link to Generated Email

  createdAt: dateSchema,
  updatedAt: dateSchema
});
export type ScrapedLead = z.infer<typeof scrapedLeadSchema>;
export const insertScrapedLeadSchema = scrapedLeadSchema.omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertScrapedLead = z.infer<typeof insertScrapedLeadSchema>;

// --- ARES Campaigns (Regional & Sector Targeting) ---
export const campaignsSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Name is required"), // e.g. "Manchester M3"
  type: z.enum(["region", "sector"]).default("region"),
  value: z.string().min(1, "Value is required"), // e.g. "M3", "41202"
  status: z.enum(["active", "paused", "completed"]).default("active"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),

  // Performance Metrics
  lastRun: dateSchema.nullable().optional(),
  leadsFound: z.number().default(0),

  createdAt: dateSchema,
  updatedAt: dateSchema
});

export type Campaign = z.infer<typeof campaignsSchema>;
export const insertCampaignSchema = campaignsSchema.omit({
  id: true, createdAt: true, updatedAt: true, lastRun: true, leadsFound: true
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
// --- Broker Sales CRM (Prospective Brokers) ---
export const brokerLeadSchema = internalLeadSchema.extend({});
export type BrokerLead = z.infer<typeof brokerLeadSchema>;
export const insertBrokerLeadSchema = brokerLeadSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBrokerLead = z.infer<typeof insertBrokerLeadSchema>;

export const brokerCommissionSchema = commissionSchema.extend({});
export type BrokerCommission = z.infer<typeof brokerCommissionSchema>;
export const insertBrokerCommissionSchema = brokerCommissionSchema.omit({
  id: true,
  createdAt: true,
});
export type InsertBrokerCommission = z.infer<typeof insertBrokerCommissionSchema>;

export const brokerCampaignSchema = campaignsSchema.extend({});
export type BrokerCampaign = z.infer<typeof brokerCampaignSchema>;
export const insertBrokerCampaignSchema = brokerCampaignSchema.omit({
  id: true, createdAt: true, updatedAt: true, lastRun: true, leadsFound: true
});
export type InsertBrokerCampaign = z.infer<typeof insertBrokerCampaignSchema>;

export const brokerScrapedLeadSchema = scrapedLeadSchema.extend({});
export type BrokerScrapedLead = z.infer<typeof brokerScrapedLeadSchema>;
export const insertBrokerScrapedLeadSchema = brokerScrapedLeadSchema.omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertBrokerScrapedLead = z.infer<typeof insertBrokerScrapedLeadSchema>;

// --- Invoices ---

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(), // in pence
  total: z.number(), // quantity * unitPrice, in pence
});
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

export const invoiceStatusEnum = z.enum(["draft", "sent", "paid", "overdue", "cancelled"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;

export const invoiceSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  prospectId: z.number(),
  invoiceNumber: z.string(),
  clientName: z.string(),
  amount: z.number(), // total in pence
  currency: z.string().default("GBP"),
  status: invoiceStatusEnum.default("draft"),
  issueDate: dateSchema,
  dueDate: dateSchema,
  paidDate: dateSchema,
  lineItems: z.array(invoiceLineItemSchema).default([]),
  notes: z.string().nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const insertInvoiceSchema = invoiceSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  prospectId: numberOrString,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// --- Expenses ---

export const expenseCategoryEnum = z.enum([
  "travel_mileage",
  "office_supplies",
  "telecoms",
  "professional_services",
  "marketing_advertising",
  "insurance",
  "training_development",
  "meals_entertainment",
  "rent_utilities",
  "bank_finance",
  "other",
]);
export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>;

export const expenseStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type ExpenseStatus = z.infer<typeof expenseStatusEnum>;

export const mileageDetailSchema = z.object({
  miles: z.number().positive(),
  ratePerMile: z.number(), // in pence
  from: z.string(),
  to: z.string(),
  vehicleType: z.enum(["car", "motorcycle", "bicycle"]).default("car"),
});
export type MileageDetail = z.infer<typeof mileageDetailSchema>;

export const expenseSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  date: dateSchema,
  category: expenseCategoryEnum,
  description: z.string().min(1),
  amount: z.number(), // in pence
  currency: z.string().default("GBP"),
  status: expenseStatusEnum.default("pending"),
  vendor: z.string().nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  mileageDetails: mileageDetailSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Expense = z.infer<typeof expenseSchema>;

export const insertExpenseSchema = expenseSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// --- Reporting: task board + auto-generated weekly reports ---

export const reportTaskStatusEnum = z.enum(["todo", "doing", "done"]);

export const reportTaskSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  timeSlot: z.string().nullable().optional(), // e.g. "09:00 - 11:00"; display only
  dueDate: dateSchema.nullable().optional(),
  status: reportTaskStatusEnum.default("todo"),
  completedAt: dateSchema.nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type ReportTask = z.infer<typeof reportTaskSchema>;

export const insertReportTaskSchema = reportTaskSchema.omit({
  id: true,
  userId: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReportTask = z.infer<typeof insertReportTaskSchema>;

export const reportTypeEnum = z.enum(["worksheet", "progress"]);

export const reportLogSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  type: reportTypeEnum,
  weekLabel: z.string(),
  recipient: z.string(),
  taskCount: z.number().default(0),
  status: z.enum(["sent", "failed", "skipped"]).default("sent"),
  sentAt: dateSchema.nullable().optional(),
  pdfFile: z.string().nullable().optional(), // filename under uploads/reports/ for "open doc"
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type ReportLog = z.infer<typeof reportLogSchema>;

export const reportSettingsSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  recipientName: z.string().default("David Griffiths"),
  recipientEmail: z.string().default(""),
  preparedByName: z.string().default("Shaun Tuhey"),
  projectCode: z.string().default("STRATA-NEXUS-INT-001"),
  executiveSummary: z.string().default(""),
  weekAnchorDate: z.string().default(""), // ISO date (any day) of a known week, e.g. "2026-08-31"
  weekAnchorNumber: z.number().default(1), // the week number that date falls in, e.g. 5
  monthlyFee: z.string().default("£2,500.00"),
  weeklyPayment: z.string().default("£625.00"),
  weeklyHours: z.string().default("30 hours (6 hours/day, 5 days/week)"),
  autoSendWorksheet: z.boolean().default(true),
  autoSendProgress: z.boolean().default(true),
  skipNextWorksheet: z.boolean().default(false),
  skipNextProgress: z.boolean().default(false),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type ReportSettings = z.infer<typeof reportSettingsSchema>;

export const updateReportSettingsSchema = reportSettingsSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type UpdateReportSettings = z.infer<typeof updateReportSettingsSchema>;
