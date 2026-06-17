import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { 
  sqliteTable, text, integer, real, blob, index, uniqueIndex 
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Users ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  profileImageUrl: text('profile_image_url'),
  role: text('role').default('broker'),
  subscriptionTier: text('subscription_tier').default('free'),
  prospectLimit: integer('prospect_limit').default(10),
  gocardlessCustomerId: text('gocardless_customer_id'),
  gocardlessMandateId: text('gocardless_mandate_id'),
  gocardlessSubscriptionId: text('gocardless_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  trialEndsAt: integer('trial_ends_at', { mode: 'timestamp' }),
  trialTier: text('trial_tier'),
  currency: text('currency').default('GBP'),
  timezone: text('timezone').default('Europe/London'),
  dateFormat: text('date_format').default('DD/MM/YYYY'),
  theme: text('theme').default('light'),
  pipelineStageNames: text('pipeline_stage_names'), // JSON
  pdfLayoutPreferences: text('pdf_layout_preferences'), // JSON
  brandingLogoUrl: text('branding_logo_url'),
  brandingPrimaryColor: text('branding_primary_color'),
  brandingAccentColor: text('branding_accent_color'),
  brandingSidebarColor: text('branding_sidebar_color'),
  brandingBackgroundColor: text('branding_background_color'),
  webhookApiKeyHash: text('webhook_api_key_hash'),
  webhookApiKeySuffix: text('webhook_api_key_suffix'),
  webhookApiKeyCreatedAt: integer('webhook_api_key_created_at', { mode: 'timestamp' }),
  webhookApiKeyLastUsedAt: integer('webhook_api_key_last_used_at', { mode: 'timestamp' }),
  aiDataConsent: integer('ai_data_consent').default(0),
  aiDataConsentAt: integer('ai_data_consent_at', { mode: 'timestamp' }),
  hasUnderwritingAccess: integer('has_underwriting_access').default(0),
  underwritingAccessExpiresAt: integer('underwriting_access_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  lastLogoutAt: integer('last_logout_at', { mode: 'timestamp' }),
  prospectsCreatedCount: integer('prospects_created_count').default(0),
  onboardingEnabled: integer('onboarding_enabled').default(1),
  onboardingProgress: text('onboarding_progress'), // JSON
  suspended: integer('suspended', { mode: 'boolean' }).default(false),
  googleConnected: integer('google_connected', { mode: 'boolean' }).default(false),
  googleEmail: text('google_email'),
  googleAccessToken: text('google_access_token'),
  googleRefreshToken: text('google_refresh_token'),
  googleTokenExpiry: integer('google_token_expiry', { mode: 'timestamp' }),
});

// --- Companies ---
export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  companyNumber: text('company_number').notNull(),
  registeredAddress: text('registered_address'),
  postcode: text('postcode'),
  incorporationDate: text('incorporation_date'),
  companyStatus: text('company_status'),
  companyType: text('company_type'),
  website: text('website'),
  sicCode: text('sic_code'),
  sicDescription: text('sic_description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Prospects ---
export const prospects = sqliteTable('prospects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  teamId: integer('team_id'),
  companyId: integer('company_id').notNull(),
  stage: text('stage').default('lead'),
  loanAmount: integer('loan_amount'),
  term: integer('term'),
  interestRate: text('interest_rate'),
  directorsGuarantee: integer('directors_guarantee').default(0),
  commercialProperty: integer('commercial_property').default(0),
  homeEquity: integer('home_equity').default(0),
  propertyOther: integer('property_other').default(0),
  debenture: integer('debenture').default(0),
  parentCompanyGuarantee: integer('parent_company_guarantee').default(0),
  collateral: integer('collateral').default(0),
  crossCompanyGuarantee: integer('cross_company_guarantee').default(0),
  loanRequirementNotes: text('loan_requirement_notes'),
  loanAllocation: text('loan_allocation'), // JSON
  priority: text('priority'),
  notes: text('notes'),
  savedAssociations: text('saved_associations'), // JSON
  queueOrder: integer('queue_order').default(0),
  referralSource: text('referral_source'),
  background: text('background'),
  adviserRecommendation: text('adviser_recommendation'),
  adviserRecommendationSignedBy: text('adviser_recommendation_signed_by'),
  adviserRecommendationSignedAt: integer('adviser_recommendation_signed_at', { mode: 'timestamp' }),
  loanRequirementData: text('loan_requirement_data'), // JSON
  researchData: text('research_data'), // JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Lenders ---
export const lenders = sqliteTable('lenders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  institutionName: text('institution_name').notNull(),
  contactName: text('contact_name'),
  email: text('email').notNull(),
  phone: text('phone'),
  address: text('address'),
  website: text('website'),
  notes: text('notes'),
  lenderType: text('lender_type').default('bank'),
  logoUrl: text('logo_url'),
  isGlobal: integer('is_global').default(0),
  productTypes: text('product_types'), // JSON array
  minLoanAmount: integer('min_loan_amount'),
  maxLoanAmount: integer('max_loan_amount'),
  minTermMonths: integer('min_term_months'),
  maxTermMonths: integer('max_term_months'),
  minLtv: real('min_ltv'),
  maxLtv: real('max_ltv'),
  linkedinUrl: text('linkedin_url'),
  portalUrl: text('portal_url'),
  typicalRateFrom: text('typical_rate_from'),
  typicalRateTo: text('typical_rate_to'),
  arrangementFee: text('arrangement_fee'),
  sectors: text('sectors'), // JSON array
  regions: text('regions'), // JSON array
  securityTypes: text('security_types'), // JSON array
  borrowerTypes: text('borrower_types'), // JSON array
  minTradingYears: integer('min_trading_years'),
  minRevenue: integer('min_revenue'),
  minDscr: text('min_dscr'),
  acceptsStartups: integer('accepts_startups').default(0),
  turnaroundDays: integer('turnaround_days'),
  panelStatus: text('panel_status').default('market'),
  accreditationStatus: text('accreditation_status'),
  fcaReference: text('fca_reference'),
  accreditationExpiry: integer('accreditation_expiry', { mode: 'timestamp' }),
  bdmName: text('bdm_name'),
  bdmEmail: text('bdm_email'),
  bdmPhone: text('bdm_phone'),
  underwriterEmail: text('underwriter_email'),
  submissionEmail: text('submission_email'),
  processingNotes: text('processing_notes'),
  creditAppetite: text('credit_appetite'),
  keyStrengths: text('key_strengths'),
  keyWeaknesses: text('key_weaknesses'),
  rating: real('rating'),
  isFavourite: integer('is_favourite').default(0),
  introducerAgreementSigned: integer('introducer_agreement_signed').default(0),
  lendingPolicy: text('lending_policy'),
  insights: text('insights'),
  tier: real('tier'),
  lastContactedAt: integer('last_contacted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- CDFIs (Community Development Financial Institutions Panel) ---
export const cdfis = sqliteTable('cdfis', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  website: text('website'),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  postalAddress: text('postal_address'),
  lendingMinQuantum: integer('lending_min_quantum'),
  lendingMaxQuantum: integer('lending_max_quantum'),
  geographicalScope: text('geographical_scope'), // JSON array
  preferredClientTypes: text('preferred_client_types'), // JSON array
  backgroundInfo: text('background_info'),
  lastContacted: integer('last_contacted', { mode: 'timestamp' }),
  contactOutcome: text('contact_outcome').default('not_contacted'), // not_contacted|no_answer|interested|not_interested|negotiating
  agreementStatus: text('agreement_status').default('unsigned'), // unsigned|in_progress|signed
  agreementSignedDate: integer('agreement_signed_date', { mode: 'timestamp' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- System Settings ---
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON
  updatedBy: text('updated_by'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Internal Leads ---
export const internalLeads = sqliteTable('internal_leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  companyNumber: text('company_number'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  status: text('status').default('new'),
  assignedAgentId: text('assigned_agent_id'),
  commissionRate: real('commission_rate').default(0.1),
  notes: text('notes'),
  estimatedValue: integer('estimated_value'),
  address: text('address'),
  city: text('city'),
  hasCharges: integer('has_charges', { mode: 'boolean' }).default(false),
  identifiedLender: text('identified_lender'),
  chargeDate: text('charge_date'),
  chargeAmount: integer('charge_amount'),
  chargeStatus: text('charge_status'),
  totalChargesCount: integer('total_charges_count').default(0),
  satisfiedChargesCount: integer('satisfied_charges_count').default(0),
  companyType: text('company_type'),
  sicCode: text('sic_code'),
  incorporationDate: text('incorporation_date'),
  website: text('website'),
  linkedinUrl: text('linkedin_url'),
  contacts: text('contacts'), // JSON
  possibleDuplicate: integer('possible_duplicate', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Broker Leads (Prospective Brokers) ---
export const brokerLeads = sqliteTable('broker_leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  companyNumber: text('company_number'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  status: text('status').default('new'),
  assignedAgentId: text('assigned_agent_id'),
  notes: text('notes'),
  source: text('source'),
  contacts: text('contacts'), // JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Marketing Contacts (Client CRM) ---
export const marketingContacts = sqliteTable('marketing_contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  status: text('status').default('active'),
  lifecycleStage: text('lifecycle_stage').default('lead'),
  leadSource: text('lead_source'),
  tags: text('tags'), // JSON
  notes: text('notes'),
  lastContactedAt: integer('last_contacted_at', { mode: 'timestamp' }),
  unsubscribed: integer('unsubscribed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Activities ---
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  prospectId: integer('prospect_id'),
  title: text('title').notNull(),
  description: text('description'),
  activityType: text('activity_type').default('task'),
  priority: text('priority').default('medium'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  completed: integer('completed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Contacts ---
export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prospectId: integer('prospect_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  role: text('role'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  profilePicture: text('profile_picture'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Email Templates ---
export const emailTemplates = sqliteTable('email_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  isGlobal: integer('is_global', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// --- Scraped Leads ---
export const scrapedLeads = sqliteTable('scraped_leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  companyNumber: text('company_number').notNull(),
  email: text('email'),
  website: text('website'),
  phone: text('phone'),
  address: text('address'),
  status: text('status').default('new'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Create the database and drizzle instance
const sqlite = new Database('veltro.db');
sqlite.pragma('journal_mode = WAL'); // Enable high-performance WAL mode
export const db = drizzle(sqlite);
