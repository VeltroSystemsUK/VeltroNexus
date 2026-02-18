import { storage } from "../storage";
import { DigitalAssociate, AssociateStatus } from "@shared/agents";

const CORE_WORKFORCE: DigitalAssociate[] = [
  {
    id: "database-builder-se",
    name: "Database Builder SE",
    role: "Internal Lead Researcher",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1531746790731-6c087fecd05a?auto=format&fit=crop&q=80&w=400",
    expertise: ["Companies House Search", "Town Hub Targeting", "Data Harvesting"],
    tools: ["Advanced Search", "Sector Filter"],
    description: "Specialized discovery agent targeting Northampton, Coventry, Peterborough, and Milton Keynes for sales pipeline growth.",
    hourlyRate: 0,
    scores: [
      { subject: "Accuracy", A: 99, fullMark: 100 },
      { subject: "Coverage", A: 98, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Harvests active business data from South & East Midlands hubs (Northampton, Coventry, Peterborough, Milton Keynes) and feeds the God Mode CRM system.",
      responsibilities: [
        "Monitor Northampton, Coventry, Peterborough, and Milton Keynes for new businesses",
        "Normalize and deduplicate harvested company data",
        "Automate lead population for regional sales desks",
      ],
      tasks: [
        {
          id: "discover-regional-leads",
          name: "Regional Discovery",
          description: "Scan Northampton, Coventry, Peterborough, and Milton Keynes for active business entities.",
          trigger: "scheduled",
          steps: [
            "Initialize multi-location search session",
            "Iterate through target town hubs",
            "Filter for active Ltd/Plc status and SIC relevancy",
            "Populate CRM database",
          ],
          expectedOutput: "New regional business leads added to CRM",
        },
      ],
    },
  },
  {
    id: "database-builder",
    name: "Database Builder",
    role: "Internal Lead Researcher",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=400",
    expertise: ["Companies House Search", "Town Hub Targeting", "Data Collection"],
    tools: ["Advanced Search", "Regional Filter"],
    description: "Targeting Leicester, Nottingham, Derby, and Lincoln to populate the sales CRM with high-quality regional leads.",
    hourlyRate: 0,
    scores: [
      { subject: "Accuracy", A: 100, fullMark: 100 },
      { subject: "Coverage", A: 96, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Responsible for automated discovery of active UK companies within specific town hubs. Populates the Internal Leads CRM with fresh data for sales agents.",
      responsibilities: [
        "Monitor Leicester, Nottingham, Derby, and Lincoln for new/active businesses",
        "Retrieve company data via Companies House API",
        "Deduplicate and clean discovered lead data",
        "Populate internal CRM with new leads",
      ],
      tasks: [
        {
          id: "discover-companies",
          name: "Discover Region Companies",
          description: "Scan target towns (Leicester, Nottingham, Derby, Lincoln) for active businesses.",
          trigger: "scheduled",
          steps: [
            "Initialize Companies House advanced search session",
            "Iterate through target town list",
            "Filter for active Ltd/Plc company status",
            "Save results to internal leads database",
          ],
          expectedOutput: "Populated CRM with new, active business leads from target regions",
        },
      ],
    },
  },
  {
    id: "outreach-sales",
    name: "Outreach",
    role: "Sales Agent",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
    expertise: ["Lead Generation", "Personalized Outreach", "Meeting Booking"],
    tools: ["Email Synthesizer", "LinkedIn Profiler", "BANT Scorer"],
    description: "Generates qualified conversations with SMEs actively seeking commercial finance.",
    hourlyRate: 0,
    scores: [
      { subject: "Engagement Rate", A: 92, fullMark: 100 },
      { subject: "Speed to Lead", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 95 },
    workflow: {
      jobDescription:
        "Responsible for generating qualified leads and booking meetings with SME decision-makers seeking commercial finance solutions. Operates across email, LinkedIn, and phone channels to build a pipeline of prospects for the brokerage.",
      responsibilities: [
        "Identify and research target SMEs via Companies House and LinkedIn",
        "Craft personalised outreach sequences per prospect",
        "Qualify inbound and outbound leads using BANT framework",
        "Book discovery calls with qualified prospects",
        "Maintain CRM records with accurate lead status and notes",
      ],
      tasks: [
        {
          id: "qualify-lead",
          name: "Qualify Lead",
          description:
            "Assess an inbound or outbound lead against BANT criteria to determine fit for commercial finance products.",
          trigger: "on_instruction",
          steps: [
            "Retrieve lead data from CRM (company name, sector, turnover)",
            "Check Companies House for filing history and director info",
            "Score against BANT: Budget (likely loan size), Authority (decision-maker?), Need (finance requirement), Timeline (urgency)",
            "Assign qualification status: Hot / Warm / Cold",
            "Update CRM record with qualification notes",
          ],
          expectedOutput: "Lead qualification summary with BANT scores and recommended next action",
        },
        {
          id: "send-outreach",
          name: "Send Outreach Email",
          description: "Draft and send a personalised cold outreach email to a target prospect.",
          trigger: "on_instruction",
          steps: [
            "Research prospect company and identify relevant finance needs",
            "Select appropriate email template based on sector and deal size",
            "Personalise subject line, opening hook, and value proposition",
            "Include clear CTA (book a call / reply with requirements)",
            "Log outreach activity in CRM",
          ],
          expectedOutput: "Drafted email ready for review or sent confirmation with tracking link",
        },
        {
          id: "book-meeting",
          name: "Book Discovery Call",
          description: "Schedule a discovery call between a qualified lead and a broker.",
          trigger: "on_instruction",
          steps: [
            "Confirm lead qualification status is Hot or Warm",
            "Check broker calendar availability",
            "Propose 2-3 time slots to the prospect",
            "Send calendar invite with meeting agenda",
            "Set reminder for broker with prospect brief",
          ],
          expectedOutput: "Calendar invite sent with meeting confirmation details",
          escalationRule:
            "Escalate to Director if prospect requests specific product expertise beyond standard brokerage scope",
        },
        {
          id: "nurture-prospect",
          name: "Nurture Prospect",
          description:
            "Follow up with a prospect who has received information but not yet booked a call.",
          trigger: "no_response_alert",
          steps: [
            "Check if 'Recovery Report' or 'Proposal' email was opened",
            "If OPENED: Call to answer questions ('I saw you reviewed the report...')",
            "If NOT OPENED: Send 'Bump' email with value-add resource",
            "Update CRM with interaction status",
          ],
          expectedOutput: "Prospect re-engaged or marked for long-term nurture",
        },
      ],
    },
  },
  {
    id: "deal-processing-underwriter",
    name: "Underwriter",
    role: "Deal Processing Agent",
    department: "Operations",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400",
    expertise: ["Credit Assessment", "Lender Matching", "Financial Analysis"],
    tools: ["Bank Statement OCR", "Companies House Crawler", "Risk Scorer"],
    description:
      "Assesses applications, matches to lenders, prepares credit packs, and manages the deal pipeline.",
    hourlyRate: 0,
    scores: [
      { subject: "Matching Accuracy", A: 95, fullMark: 100 },
      { subject: "Plausability Check", A: 96, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 98 },
    workflow: {
      jobDescription:
        "Processes deal applications from initial submission through to lender packaging. Performs credit assessment, matches applications to suitable lenders, prepares credit packs, and manages deal progression through the pipeline.",
      responsibilities: [
        "Assess incoming applications for plausibility and completeness",
        "Extract and analyse financial data from bank statements and accounts",
        "Match deals to appropriate lenders based on criteria and appetite",
        "Prepare professional credit packs for lender submission",
        "Track deal pipeline stages and flag stalled applications",
      ],
      tasks: [
        {
          id: "assess-application",
          name: "Assess Application",
          description:
            "Review a new deal submission for completeness and initial credit viability.",
          trigger: "on_instruction",
          steps: [
            "Verify all required documents are present (bank statements, accounts, ID)",
            "Run Companies House check on applicant business",
            "Extract key financials: turnover, net profit, existing debt",
            "Perform initial plausibility check (can the business service this debt?)",
            "Flag any red flags: CCJs, late filings, adverse credit markers",
            "Produce initial assessment summary",
          ],
          expectedOutput:
            "Application assessment report with viability rating (Green/Amber/Red) and identified issues",
          escalationRule:
            "Escalate to Director for any application over £500k or with critical red flags",
        },
        {
          id: "match-lenders",
          name: "Match to Lenders",
          description:
            "Identify the best-fit lenders for an assessed application based on lender appetite and deal criteria.",
          trigger: "on_instruction",
          steps: [
            "Review application assessment and key deal parameters",
            "Query lender panel for matching criteria (sector, loan size, security type)",
            "Rank matched lenders by likelihood of approval and commercial terms",
            "Produce lender shortlist with rationale for each recommendation",
            "Note any lenders to avoid (recent declines, relationship issues)",
          ],
          expectedOutput:
            "Ranked lender shortlist (top 3-5) with match rationale and suggested approach order",
        },
        {
          id: "prepare-credit-pack",
          name: "Prepare Credit Pack",
          description: "Compile a professional credit pack for submission to selected lenders.",
          trigger: "on_instruction",
          steps: [
            "Compile all supporting documents into structured format",
            "Write executive summary covering deal rationale and borrower profile",
            "Include financial analysis with key metrics highlighted",
            "Attach security details and valuation information if applicable",
            "Quality-check the pack against lender-specific requirements",
            "Generate PDF credit pack ready for submission",
          ],
          expectedOutput: "Complete credit pack document ready for lender submission",
        },
      ],
    },
  },
  {
    id: "accounts-monitor",
    name: "Finance Monitor",
    role: "Accounts Agent",
    department: "Finance",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
    expertise: ["Cashflow Tracking", "Commission Reconciliation", "Invoicing"],
    tools: ["Xero Connector", "Bank Feed Monitor", "Commission Tracker"],
    description:
      "Monitors cashflow, tracks commissions, manages invoicing, and flags financial risks.",
    hourlyRate: 0,
    scores: [
      { subject: "Accuracy", A: 99, fullMark: 100 },
      { subject: "Filing Integrity", A: 100, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Oversees all financial operations for the brokerage including cashflow monitoring, commission tracking and reconciliation, client invoicing, and financial risk flagging. Ensures accurate financial records and timely collections.",
      responsibilities: [
        "Monitor daily cashflow and flag anomalies",
        "Track commissions owed by lenders on completed deals",
        "Reconcile commission payments against expected amounts",
        "Generate and send invoices to clients and lender partners",
        "Produce weekly financial summary reports",
      ],
      tasks: [
        {
          id: "track-commission",
          name: "Track Commission",
          description: "Monitor and reconcile commission payments from lenders on completed deals.",
          trigger: "on_instruction",
          steps: [
            "Identify deals that have completed and are eligible for commission",
            "Calculate expected commission based on deal value and lender rate",
            "Check bank feeds for received commission payments",
            "Flag any discrepancies between expected and received amounts",
            "Update commission ledger with payment status",
          ],
          expectedOutput:
            "Commission reconciliation report showing expected vs received amounts with discrepancies flagged",
        },
        {
          id: "generate-invoice",
          name: "Generate Invoice",
          description: "Create and send an invoice for brokerage fees or commission.",
          trigger: "on_instruction",
          steps: [
            "Retrieve deal details and agreed fee structure",
            "Calculate invoice amount including any VAT",
            "Generate professional invoice document with correct references",
            "Send invoice to client/lender via email",
            "Log invoice in accounts system with payment due date",
          ],
          expectedOutput:
            "Invoice generated and sent with confirmation and payment tracking reference",
        },
        {
          id: "cashflow-report",
          name: "Cashflow Report",
          description: "Produce a cashflow summary for a given period.",
          trigger: "on_instruction",
          steps: [
            "Pull transaction data from bank feeds for the specified period",
            "Categorise transactions: income, expenses, commissions, fees",
            "Calculate net cashflow and running balance",
            "Compare against previous period and highlight trends",
            "Flag any concerning patterns (declining income, rising costs)",
          ],
          expectedOutput:
            "Cashflow summary with categorised transactions, net position, and trend analysis",
          escalationRule:
            "Escalate to Director if net cashflow is negative for two consecutive weeks",
        },
      ],
    },
  },
  {
    id: "capital-strategist",
    name: "Capital Strategist",
    role: "Strategic Capital Advisor",
    department: "Advisory",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400",
    expertise: ["Long-Term Capital Strategy", "Debt Structure Optimization", "Cash Flow Forecasting", "Strategic Financial Alignment"],
    tools: ["Companies House API", "Debt Audit Calculator", "Cash Flow Recovery Report", "Lender Displacement Scripts", "Proposal Sender"],
    description: "Acts as a Fractional CFO, helping businesses optimize their balance sheet for long-term stability and growth.",
    hourlyRate: 0,
    scores: [
      { subject: "Strategic Clarity", A: 98, fullMark: 100 },
      { subject: "Financial Engineering", A: 96, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 97 },
    workflow: {
      jobDescription: "Provides high-level financial counsel to business owners. Identifies structural inefficiencies in debt and proposes long-term optimizations using a 'Positive Cash Flow' framework. Tone is consultative, educational, and patient—never pushy.",
      responsibilities: [
        "Audit Companies House for structural debt inefficiencies",
        "Calculate 'Cash Flow Delta' between current position and optimal structure",
        "Address concerns with data-driven clarity and empathy",
        "Generate Cash Flow Recovery Reports",
        "Guide clients towards 'Future-Proofing' milestones",
      ],
      tasks: [
        {
          id: "identify-prospects",
          name: "Identify Refinancing Prospects",
          description: "Scan Companies House for businesses with high-interest debt markers approaching maturity.",
          trigger: "scheduled", // or on_instruction
          steps: [
            "Scan for charges from Blacklist Lenders (Iwoca, YouLend, Together)",
            "Filter for charges created in 2023-2024 (Maturity Cliff)",
            "Check for 'Debt Stacking' (multiple high-rate charges)",
            "Analyze liquidity ratio (Creditors < 1yr vs Cash)",
            "Score lead based on 'Pain Level' (0-100)",
          ],
          expectedOutput: "List of high-priority leads with identified debt stack and potential savings",
        },
        {
          id: "run-opportunity-analysis",
          name: "Run Opportunity Analysis",
          description: "Calculate the exact monthly savings and valuation impact of refinancing.",
          trigger: "on_instruction",
          steps: [
            "Execute '3-Question Delta' calculator with prospect",
            "Calculate monthly cash flow difference",
            "Project 5-year capital gain",
            "Estimate valuation boost based on EBITDA multiple",
            "Prepare side-by-side comparison data",
          ],
          expectedOutput: "Opportunity Analysis showing current options vs 5-year refinancing delta",
        },
        {
          id: "address-strategic-concerns",
          name: "Address Strategic Concerns",
          description: "Provide clarity on financial implications to resolve hesitancy.",
          trigger: "on_instruction",
          steps: [
            "Validate the client's perspective with empathy",
            "Provide comparative data (Current vs Proposed)",
            "Highlight the 'Cost of Stagnation' vs 'Benefit of Stability'",
            "Pivot to 'Cash Flow Freedom' framework",
            "Ensure client feels empowered, not sold to",
          ],
          expectedOutput: "Client concerns addressed with data and strategic clarity",
        },
        {
          id: "generate-recovery-report",
          name: "Generate Cash Flow Recovery Report",
          description: "Create a one-page PDF visualizing the financial impact of refinancing.",
          trigger: "on_instruction",
          steps: [
            "Format 'Executive Delta' summary",
            "Generate 'Cash Burn vs Surplus' charts",
            "Include 'Hidden 2026 Benefits' (EBITDA, Credit Score)",
            "Apply 2026 Market Context data",
            "Generate PDF document",
          ],
          expectedOutput: "Professional PDF report ready for email delivery",
        },
        {
          id: "close-refinancing",
          name: "Close Refinancing Deal",
          description: "Secure commitment for the 5-year facility.",
          trigger: "on_instruction",
          steps: [
            "Position refinance as 'Balance Sheet Milestone'",
            "Highlight protection against 2026/27 rate volatility",
            "Confirm 'Low Friction' next steps (Open Banking)",
            "Send agreement for signature",
          ],
          expectedOutput: "Deal closed and submitted to Underwriting",
        },
        {
          id: "review-send-proposal",
          name: "Review & Send Proposal",
          description: "Review the Zeus-drafted lender submission and send to the bank.",
          trigger: "proposal_draft_ready",
          steps: [
            "Retrieve 'proposal_draft' activity from CRM",
            "Present drafted email content to Director for 'One-Click' approval",
            "Make any requested edits to the copy",
            "Send email to Lender Contact via secure gateway",
            "Log submission timestamp in Deal Pipeline",
          ],
          expectedOutput: "Proposal sent to lender and deal stage updated to 'Submitted'",
        },
      ],
    },
  },
  {
    id: "fulfilment-manager",
    name: "Fulfilment Manager",
    role: "Onboarding Specialist",
    department: "Operations",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
    expertise: ["Client Onboarding", "Document Collection", "Pipeline Management", "Customer Support"],
    tools: ["Document Chaser Bot", "Welcome Pack Generator", "Upload Validator", "Prospect Requirement Analyzer"],
    description: "Ensures closed deals reach submission by actively managing client onboarding and document collection.",
    hourlyRate: 0,
    scores: [
      { subject: "Response Time", A: 96, fullMark: 100 },
      { subject: "Collection Rate", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 96 },
    workflow: {
      jobDescription: "Bridging the gap between 'Closed Won' and 'Lender Submission'. Responsible for sending welcome packs, chasing missing documents via multi-channel outreach, and validating uploads before passing to Underwriting.",
      responsibilities: [
        "Send welcome packs to new clients immediately after deal close",
        "Monitor document upload portals daily",
        "Chase missing items via scheduled email and SMS nudges",
        "Perform first-line validation on uploaded files (dates, names, clarity)",
        "Escalate non-responsive clients to a 'Blocker Call'",
      ],
      tasks: [
        {
          id: "onboard-client",
          name: "Onboard New Client",
          description: "Initiate the onboarding process for a newly signed deal.",
          trigger: "deal_closed",
          steps: [
            "Generate Welcome Pack with customised document checklist",
            "Send Welcome Email with secure upload link",
            "Schedule 'Introduction Call' if deal size > £100k",
            "Set automated chaser sequence (Day 2, Day 5)",
            "Log onboarding start in CRM",
          ],
          expectedOutput: "Welcome pack sent and chaser sequence activated",
        },
        {
          id: "chase-documents",
          name: "Chase Missing Documents",
          description: "Actively pursue outstanding documents to unblock the deal.",
          trigger: "missing_docs_alert",
          steps: [
            "Identify specific missing items using 'getProspectRequirementStatus' tool",
            "Select appropriate nudge channel (Email -> SMS -> Call)",
            "Send reminder with clear list of MISSING items and upload link",
            "If unresponsive for 5 days, schedule 'Blocker Call' task",
            "Update CRM with chase activity",
          ],
          expectedOutput: "Client contact made and document status updated",
        },
        {
          id: "validate-upload",
          name: "Validate Uploads",
          description: "Check uploaded documents for basic validity before Underwriting.",
          trigger: "file_uploaded",
          steps: [
            "Open uploaded file",
            "Verify document type matches request (e.g. is it actually a Bank Statement?)",
            "Check dates are within required range (last 3 months)",
            "Confirm entity name matches application",
            "Approve for Underwriter or Reject with feedback to client",
          ],
          expectedOutput: "Document marked as 'Verified' or 'Rejected' with reason",
        },
      ],
    },
  },
];

export const agentService = {
  /**
   * Initializes the core workforce if not already present in storage.
   */
  async initializeWorkforce() {
    console.log("[AgentService] Initializing core workforce...");
    for (const agent of CORE_WORKFORCE) {
      const existing = await storage.getAgentById(agent.id);

      if (!existing) {
        console.log(`[AgentService] Deploying ${agent.name} (${agent.role})...`);
        await storage.updateAgent(agent.id, agent);
      } else {
        // Force update definition to sync code changes (workflow, tools etc)
        // BUT preserve dynamic state like status
        console.log(`[AgentService] Syncing definition for ${agent.name}...`);
        const updatedAgent = { ...agent, status: existing.status };
        await storage.updateAgent(agent.id, updatedAgent);
      }
    }
    console.log("[AgentService] Workforce initialization complete.");
  },

  /**
   * Returns the full roster of agent "Employees".
   */
  async getRoster(): Promise<DigitalAssociate[]> {
    return storage.getAgents();
  },

  /**
   * Retrieves a specific agent by ID.
   */
  async getAgent(id: string): Promise<DigitalAssociate | undefined> {
    return storage.getAgentById(id);
  },
};
