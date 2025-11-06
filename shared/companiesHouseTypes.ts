// Types for Companies House API responses
// Based on official specification: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/resources/companyprofile

export interface CompanyAddress {
  address_line_1?: string;
  address_line_2?: string;
  care_of?: string;
  country?: string;
  locality?: string;
  po_box?: string;
  postal_code?: string;
  premises?: string;
  region?: string;
}

export interface PreviousCompanyName {
  name: string;
  effective_from: string;
  ceased_on: string;
}

export interface AccountingReferenceDate {
  day: number;
  month: number;
}

export interface LastAccounts {
  made_up_to?: string;
  type?: string;
  period_start_on?: string;
  period_end_on?: string;
}

export interface NextAccounts {
  period_start_on?: string;
  period_end_on?: string;
  due_on?: string;
  overdue?: boolean;
}

export interface Accounts {
  accounting_reference_date?: AccountingReferenceDate;
  last_accounts?: LastAccounts;
  next_accounts?: NextAccounts;
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
}

export interface ConfirmationStatement {
  last_made_up_to?: string;
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
}

export interface CompanyLinks {
  self?: string;
  filing_history?: string;
  officers?: string;
  persons_with_significant_control?: string;
  registers?: string;
  charges?: string;
  insolvency?: string;
}

export interface BranchCompanyDetails {
  business_activity?: string;
  parent_company_name?: string;
  parent_company_number?: string;
}

export interface OriginatingRegistry {
  country?: string;
  name?: string;
}

export interface ForeignCompanyDetails {
  accounting_requirement?: {
    foreign_account_type?: string;
    terms_of_account_publication?: string;
  };
  accounts?: Accounts;
  business_activity?: string;
  company_type?: string;
  governed_by?: string;
  is_a_credit_finance_institution?: boolean;
  originating_registry?: OriginatingRegistry;
  registration_number?: string;
}

export interface CompanyProfile {
  company_name: string;
  company_number: string;
  company_status: string;
  company_status_detail?: string;
  type: string;
  date_of_creation: string;
  date_of_cessation?: string;
  jurisdiction: string;
  etag?: string;
  
  registered_office_address?: CompanyAddress;
  registered_office_is_in_dispute?: boolean;
  undeliverable_registered_office_address?: boolean;
  
  previous_company_names?: PreviousCompanyName[];
  
  accounts?: Accounts;
  confirmation_statement?: ConfirmationStatement;
  annual_return?: ConfirmationStatement; // Legacy field
  
  sic_codes?: string[];
  has_super_secure_pscs?: boolean;
  has_charges?: boolean;
  has_been_liquidated?: boolean;
  has_insolvency_history?: boolean;
  
  branch_company_details?: BranchCompanyDetails;
  foreign_company_details?: ForeignCompanyDetails;
  
  service_address?: CompanyAddress;
  
  can_file?: boolean;
  is_community_interest_company?: boolean;
  subtype?: string;
  partial_data_available?: string;
  external_registration_number?: string;
  last_full_members_list_date?: string;
  
  links?: CompanyLinks;
}

// Officers Types
export interface DateOfBirth {
  month: number;
  year: number;
}

export interface FormerName {
  forenames?: string;
  surname?: string;
}

export interface OfficerIdentification {
  identification_type?: string;
  legal_authority?: string;
  legal_form?: string;
  place_registered?: string;
  registration_number?: string;
}

export interface Officer {
  address: CompanyAddress;
  appointed_on: string;
  resigned_on?: string;
  country_of_residence?: string;
  date_of_birth?: DateOfBirth;
  former_names?: FormerName[];
  identification?: OfficerIdentification;
  name: string;
  nationality?: string;
  occupation?: string;
  officer_role: string;
  responsibilities?: string;
  links?: {
    officer?: {
      appointments?: string;
    };
  };
}

export interface OfficersResponse {
  etag?: string;
  items_per_page?: number;
  start_index?: number;
  total_results: number;
  active_count?: number;
  resigned_count?: number;
  items: Officer[];
  links?: {
    self?: string;
  };
}

// PSC Types
export interface PSC {
  name?: string;
  name_elements?: {
    title?: string;
    forename?: string;
    surname?: string;
  };
  kind: string;
  notified_on: string;
  ceased_on?: string;
  address?: CompanyAddress;
  country_of_residence?: string;
  date_of_birth?: DateOfBirth;
  nationality?: string;
  natures_of_control: string[];
  links?: {
    self?: string;
  };
  etag?: string;
}

export interface PSCResponse {
  items: PSC[];
  active_count?: number;
  ceased_count?: number;
  items_per_page?: number;
  start_index?: number;
  total_results: number;
  links?: {
    self?: string;
  };
}

// Charges Types
export interface ChargeClassification {
  type?: string;
  description?: string;
}

export interface ChargeTransaction {
  filing_type?: string;
  delivered_on?: string;
  insolvency_case_number?: number;
  links?: {
    filing?: string;
  };
}

export interface PersonEntitled {
  name: string;
}

export interface SecuredDetails {
  type?: string;
  description?: string;
}

export interface ChargeParticulars {
  type?: string;
  description?: string;
  contains_floating_charge?: boolean;
  contains_fixed_charge?: boolean;
  contains_negative_pledge?: boolean;
  floating_charge_covers_all?: boolean;
  chargor_acting_as_bare_trustee?: boolean;
}

export interface ScottishAlterations {
  has_alterations_to_order?: boolean;
  has_alterations_to_prohibitions?: boolean;
  has_restricting_provisions?: boolean;
}

export interface InsolvencyCase {
  case_number?: number;
  transaction_id?: number;
  links?: {
    case?: string;
  };
}

export interface Charge {
  etag?: string;
  charge_code?: string;
  charge_number?: number;
  classification?: ChargeClassification;
  status: string;
  acquired_on?: string;
  delivered_on?: string;
  created_on?: string;
  satisfied_on?: string;
  covering_instrument_date?: string;
  transactions?: ChargeTransaction[];
  persons_entitled?: PersonEntitled[];
  secured_details?: SecuredDetails;
  particulars?: ChargeParticulars;
  scottish_alterations?: ScottishAlterations;
  assets_ceased_released?: string;
  insolvency_cases?: InsolvencyCase[];
  links?: {
    self?: string;
  };
}

export interface ChargesResponse {
  etag?: string;
  total_count: number;
  unfiltered_count?: number;
  satisfied_count?: number;
  part_satisfied_count?: number;
  items: Charge[];
}
