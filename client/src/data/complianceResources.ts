export const complianceResources = {
    "document_module": "Mandatory Compliance Documentation",
    "version": "2026.01",
    "document_categories": [
        {
            "category_name": "Customer Facing (The 'shop window')",
            "description": "Documents that must be given to or seen by the client.",
            "documents": [
                {
                    "id": "DOC_001",
                    "title": "Initial Disclosure Document (IDD) / Terms of Business",
                    "regulatory_source": "CONC 4.4 / CONC 3.7",
                    "mandatory_for": ["broker", "lender"],
                    "key_content_requirements": [
                        "Statutory Status Disclosure ('We are a broker...')",
                        "Scope of Service (Do you search the whole market?)",
                        "Fees & Charges (Must be £0.00 or explicitly stated)",
                        "Commission Disclosure (Existence & Nature)",
                        "Complaints handling summary"
                    ],
                    "retention_period": "Duration of relationship + 6 years",
                    "update_trigger": "Any change in fees, address, or permission status"
                },
                {
                    "id": "DOC_002",
                    "title": "Privacy Notice (GDPR)",
                    "regulatory_source": "UK GDPR / Data Protection Act 2018",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "Identity of Data Controller",
                        "Lawful basis for processing (e.g., 'Contract' or 'Consent')",
                        "Credit Reference Agency (CRA) data sharing clause",
                        "Data retention periods",
                        "Right to complain to ICO"
                    ],
                    "retention_period": "Always current (Review annually)",
                    "update_trigger": "Change in data processing vendors (e.g., new CRM)"
                },
                {
                    "id": "DOC_003",
                    "title": "Adequate Explanations (Pre-Contract Info)",
                    "regulatory_source": "CONC 4.2",
                    "mandatory_for": ["lender", "broker"],
                    "key_content_requirements": [
                        "Features of the product",
                        "Total cost of credit",
                        "Consequences of non-payment (Missed payments impact credit file)",
                        "Right of Withdrawal explanation"
                    ],
                    "retention_period": "6 years after agreement ends",
                    "update_trigger": "New product launch"
                }
            ]
        },
        {
            "category_name": "Internal Governance (The 'back office')",
            "description": "Policies that prove you are running the business correctly.",
            "documents": [
                {
                    "id": "DOC_004",
                    "title": "Complaints Handling Policy",
                    "regulatory_source": "DISP 1.3",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "Definition of a complaint (Written or Oral)",
                        "Timeline: Acknowledgement (Promptly) -> Final Response (8 weeks)",
                        "Forwarding rules (if the complaint is the lender's fault)",
                        "Financial Ombudsman Service (FOS) referral rights",
                        "Root Cause Analysis procedure"
                    ],
                    "retention_period": "3 years (Complaint files)",
                    "update_trigger": "Change in FOS limits or rules"
                },
                {
                    "id": "DOC_005",
                    "title": "Vulnerable Customer Policy",
                    "regulatory_source": "PRIN 2A (Consumer Duty) / FG21/1",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "Definition of vulnerability (Health, Life Event, Resilience, Capability)",
                        "IDEA protocol (Identify, Determine, Execute, Assess)",
                        "How to record vulnerability (TEXAS model)",
                        "Staff training requirements"
                    ],
                    "retention_period": "Permanent policy",
                    "update_trigger": "Consumer Duty annual review"
                },
                {
                    "id": "DOC_006",
                    "title": "AML / Financial Crime Policy",
                    "regulatory_source": "SYSC 6.3 / MLR 2017",
                    "mandatory_for": ["lender", "broker_processing_money"],
                    "key_content_requirements": [
                        "Nominated Officer / MLRO details",
                        "CDD (Customer Due Diligence) procedures",
                        "PEPs (Politically Exposed Persons) checking",
                        "SAR (Suspicious Activity Report) process",
                        "Sanctions screening process"
                    ],
                    "retention_period": "5 years after relationship ends (CDD files)",
                    "update_trigger": "New Treasury sanctions or legislation"
                },
                {
                    "id": "DOC_007",
                    "title": "Compliance Monitoring Programme (CMP)",
                    "regulatory_source": "SYSC 6.1",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "A schedule of checks (e.g., 'Check 5 client files every month')",
                        "Who performs the check",
                        "Pass/Fail criteria",
                        "Remedial action log"
                    ],
                    "retention_period": "Records of checks: 3+ years",
                    "update_trigger": "Annual plan refresh"
                },
                {
                    "id": "DOC_008",
                    "title": "Conflicts of Interest Policy",
                    "regulatory_source": "SYSC 10",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "Identification of conflicts (e.g., Higher commission = higher risk)",
                        "Management strategy (Disclosure vs Avoidance)",
                        "Gifts & Hospitality log rules"
                    ],
                    "retention_period": "Permanent policy",
                    "update_trigger": "Change in business model"
                }
            ]
        },
        {
            "category_name": "Staff & Training",
            "description": "Proof that your people are competent.",
            "documents": [
                {
                    "id": "DOC_009",
                    "title": "Fit & Proper Assessments",
                    "regulatory_source": "FIT / SM&CR",
                    "mandatory_for": ["all_certified_staff"],
                    "key_content_requirements": [
                        "Honesty, Integrity & Reputation check",
                        "Competence & Capability check",
                        "Financial Soundness check (Credit check)"
                    ],
                    "retention_period": "6 years after staff leaves",
                    "update_trigger": "Annual assessment"
                },
                {
                    "id": "DOC_010",
                    "title": "Training Logs (CPD)",
                    "regulatory_source": "TC (Training & Competence)",
                    "mandatory_for": ["all_client_facing_staff"],
                    "key_content_requirements": [
                        "Date of training",
                        "Topic (e.g., 'Vulnerable Customers')",
                        "Test score / Verification of understanding",
                        "Total hours completed"
                    ],
                    "retention_period": "3 years",
                    "update_trigger": "Ongoing"
                }
            ]
        },
        {
            "category_name": "Regulatory Perimeter & Authorisation Scope",
            "description": "Which activities this firm carries out are FCA-regulated vs exempt — structural reference only. The firm's actual FCA register entry and permission scope must be confirmed against this by a compliance adviser; this is not a substitute for that check.",
            "documents": [
                {
                    "id": "DOC_011",
                    "title": "Regulated vs Exempt Introducer/Broking Activity",
                    "regulatory_source": "FSMA 2000 (Regulated Activities Order) Art 36A / PERG 2.7",
                    "mandatory_for": ["broker"],
                    "key_content_requirements": [
                        "Credit broking to limited companies/LLPs is commercial lending and generally falls outside FCA regulation (business-to-business, not a 'regulated credit agreement')",
                        "Credit broking to sole traders or partnerships of ≤3 partners not all corporate can fall within scope of a regulated credit agreement under CONC — treat these as regulated by default unless confirmed otherwise",
                        "Introducing a client to a lender for a fee is 'credit broking' under Art 36A RAO and needs FCA permission whenever the underlying agreement is/would be regulated",
                        "Mixed portfolios (some regulated, some exempt clients) need the borrower's legal entity type checked at intake, before any fee-earning introduction is made"
                    ],
                    "retention_period": "Always current (review on any change to client base or product mix)",
                    "update_trigger": "New client entity type, new product line, or FCA guidance update"
                },
                {
                    "id": "DOC_012",
                    "title": "FCA Authorisation & Permissions Held",
                    "regulatory_source": "FCA Register / FSMA 2000 Part 4A",
                    "mandatory_for": ["all"],
                    "key_content_requirements": [
                        "Record this firm's actual FCA reference number and the exact permission(s) held (e.g., credit broking) as shown on the FCA Register",
                        "Confirm whether the firm operates under its own authorisation or as an Appointed Representative of a principal firm",
                        "State explicitly which activities are covered by that authorisation and which are carried out on an exempt/unregulated basis",
                        "This entry is a placeholder — populate it from the firm's actual FCA Register entry, not from this template"
                    ],
                    "retention_period": "Always current",
                    "update_trigger": "Any change in permissions, principal firm, or FCA Register status"
                }
            ]
        }
    ],
    "reporting_schedule": [
        {
            "id": "RPT_001",
            "form_code": "CCR007",
            "title": "Key Data for Consumer Credit Firms",
            "frequency": "Annually",
            "deadline_logic": "within 30 business days of accounting reference date",
            "applicability": {
                "role": ["broker"],
                "firm_size": ["limited_scope", "full_permission"],
                "revenue_source": ["credit_broking"]
            },
            "data_points_required": [
                "Total Revenue from Credit Broking",
                "Total Revenue from All Sources"
            ],
            "submission_system": "RegData (Connect)",
            "risk_penalty": "£250 late return fee + potential enforcement"
        },
        {
            "id": "RPT_002",
            "form_code": "CCR001",
            "title": "Financial Data for Consumer Credit Firms",
            "frequency": "Annually",
            "deadline_logic": "within 30 business days of accounting reference date",
            "applicability": {
                "role": ["lender", "broker"],
                "firm_size": ["full_permission"],
                "notes": "Limited Scope brokers are usually exempt from CCR001 if revenue < £250k"
            },
            "data_points_required": [
                "Balance Sheet",
                "Profit & Loss",
                "Capital Resources"
            ],
            "submission_system": "RegData"
        },
        {
            "id": "RPT_003",
            "form_code": "DISP 1 Ann 1R",
            "title": "Complaints Return",
            "frequency": "Bi-Annually (Every 6 months)",
            "deadline_logic": "30 business days after reporting period end",
            "applicability": {
                "role": ["lender", "broker"],
                "condition": "ALWAYS_REQUIRED (even if 0 complaints received)"
            },
            "data_points_required": [
                "Number of complaints opened",
                "Number of complaints closed",
                "Amount of redress paid"
            ],
            "submission_system": "RegData"
        }
    ],
    "governance_protocols": [
        {
            "id": "SMCR_001",
            "title": "Senior Management Functions (SMF)",
            "regulation_source": "SM&CR",
            "applicability": {
                "firm_type": "Limited Scope"
            },
            "requirements": [
                {
                    "role": "SMF29 (Limited Scope Function)",
                    "description": "Person responsible for apportionment and oversight.",
                    "action": "Must be approved by FCA via Form A."
                }
            ]
        },
        {
            "id": "SMCR_002",
            "title": "Certification Regime (Fit & Proper)",
            "regulation_source": "SM&CR",
            "applicability": {
                "firm_type": "Core Firm",
                "employee_role": ["sales_staff", "managers"]
            },
            "requirements": [
                {
                    "action": "Annual Fit & Proper Assessment",
                    "criteria": ["Honesty & Integrity", "Competence & Capability", "Financial Soundness"],
                    "output": "Certificate issued by the Firm (not FCA)"
                }
            ]
        },
        {
            "id": "SMCR_003",
            "title": "Conduct Rules Training",
            "regulation_source": "COCON",
            "applicability": {
                "role": ["all_staff"],
                "frequency": "Annually"
            },
            "trigger_logic": "IF employee_start_date > 0",
            "action_required": "Staff must be trained on the 5 Individual Conduct Rules (e.g., 'You must act with integrity')."
        }
    ],
    "financial_crime_protocols": [
        {
            "id": "AML_001",
            "title": "Customer Due Diligence (KYC)",
            "regulation_source": "MLR 2017 / SYSC",
            "applicability": {
                "role": ["lender"],
                "transaction_type": ["lending_agreement"]
            },
            "trigger_logic": "BEFORE payout",
            "data_requirements": [
                "Verified Identity (Passport/Driver License)",
                "Verified Address (Utility Bill)",
                "UBO (Ultimate Beneficial Owner) Check for Ltd Co"
            ],
            "risk_level": "CRITICAL"
        },
        {
            "id": "AML_002",
            "title": "Sanctions Screening",
            "regulation_source": "Treasury Sanctions List",
            "applicability": {
                "role": ["broker", "lender"],
                "customer_type": ["all"]
            },
            "trigger_logic": "ON client_onboarding",
            "action_required": "Screen client name against HM Treasury Sanctions List.",
            "failure_consequence": "Criminal prosecution"
        },
        {
            "id": "AML_003",
            "title": "Suspicious Activity Report (SAR)",
            "regulation_source": "Proceeds of Crime Act",
            "applicability": {
                "role": ["all_staff"]
            },
            "trigger_logic": "IF suspicion_of_money_laundering == TRUE",
            "action_required": "Submit SAR to the MLRO (Money Laundering Reporting Officer). MLRO submits to NCA.",
            "tipping_off_warning": "Strictly illegal to tell the client a report was made."
        }
    ],
    "root_cause_taxonomy": {
        "version": "1.2",
        "description": "Standardised list of failure reasons for compliance reporting.",
        "categories": [
            {
                "id": "CAT_PEOPLE",
                "label": "People & Culture",
                "sub_causes": [
                    {
                        "id": "PPL_001",
                        "label": "Human Error (Slips/Lapses)",
                        "description": "Unintentional error by competent staff (e.g., typo, forgot attachment).",
                        "recommended_action": "Implement '4-Eyes Check' (peer review) for this task."
                    },
                    {
                        "id": "PPL_002",
                        "label": "Training / Competence Gap",
                        "description": "Staff member did not understand the process or rule.",
                        "recommended_action": "Schedule refresher training and update CPD log."
                    },
                    {
                        "id": "PPL_003",
                        "label": "Key Person Dependency",
                        "description": "Process failed because the usual owner was absent.",
                        "recommended_action": "Cross-train a deputy for this role."
                    },
                    {
                        "id": "PPL_004",
                        "label": "Conduct / Behavioural Issue",
                        "description": "Deliberate non-compliance or negligence.",
                        "recommended_action": "Initiate HR disciplinary process and review SM&CR status."
                    }
                ]
            },
            {
                "id": "CAT_PROCESS",
                "label": "Process & Procedure",
                "sub_causes": [
                    {
                        "id": "PRC_001",
                        "label": "Process Design Flaw",
                        "description": "The process is logical but results in non-compliance (e.g., steps in wrong order).",
                        "recommended_action": "Redesign workflow and update Operations Manual."
                    },
                    {
                        "id": "PRC_002",
                        "label": "Outdated Documentation",
                        "description": "Staff followed an old version of the policy.",
                        "recommended_action": "Archive old docs and issue 'New Process' memo."
                    },
                    {
                        "id": "PRC_003",
                        "label": "Missing Procedure",
                        "description": "No formal process existed for this scenario.",
                        "recommended_action": "Draft and publish a new Standard Operating Procedure (SOP)."
                    }
                ]
            },
            {
                "id": "CAT_SYSTEMS",
                "label": "Systems & IT",
                "sub_causes": [
                    {
                        "id": "SYS_001",
                        "label": "Software Logic Error / Bug",
                        "description": "System calculated incorrectly or failed to trigger.",
                        "recommended_action": "Log ticket with IT Vendor and implement manual workaround."
                    },
                    {
                        "id": "SYS_002",
                        "label": "Data Integrity Issue",
                        "description": "Input data was corrupt or missing.",
                        "recommended_action": "Run data cleanse and add 'Mandatory Fields' validation."
                    },
                    {
                        "id": "SYS_003",
                        "label": "Integration Failure",
                        "description": "Two systems failed to talk to each other (e.g., CRM to Accounting).",
                        "recommended_action": "Review API logs and reconcile data manually."
                    }
                ]
            },
            {
                "id": "CAT_EXTERNAL",
                "label": "External Factors",
                "sub_causes": [
                    {
                        "id": "EXT_001",
                        "label": "Third Party / Vendor Failure",
                        "description": "Outsourced provider (e.g., hosting, ID checker) failed.",
                        "recommended_action": "Review Service Level Agreement (SLA) and request incident report."
                    },
                    {
                        "id": "EXT_002",
                        "label": "Lender Error",
                        "description": "Information provided by the lender was incorrect.",
                        "recommended_action": "Log complaint with Lender and note on client file."
                    },
                    {
                        "id": "EXT_003",
                        "label": "Fraud / Cyber Attack",
                        "description": "External bad actor caused the breach.",
                        "recommended_action": "Trigger Cyber Incident Response Plan immediately."
                    }
                ]
            }
        ]
    }
};
