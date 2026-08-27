import { storage } from "../storage";
import { DigitalAssociate, AssociateStatus } from "@shared/agents";

const CORE_WORKFORCE: DigitalAssociate[] = [
  {
    id: "inbound-intake",
    name: "Maya Hart",
    email: "maya.hart@stratanexus.co.uk",
    role: "New Business Administrator",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=400",
    expertise: ["Companies House Search", "Google Places Enrichment", "Deal File Opening"],
    tools: ["Companies House API", "Google Places", "Prospect Pipeline"],
    description: "Opens a deal file for every stratafinance.co.uk enquiry, matches Companies House, enriches via Places, and lands a Lead marked Strata on the Prospect Pipeline.",
    hourlyRate: 0,
    scores: [
      { subject: "Match accuracy", A: 97, fullMark: 100 },
      { subject: "Speed to pipeline", A: 99, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 97 },
    workflow: {
      jobDescription:
        "Stage 1 of the agentic deal file. Reviews inbound company details from stratafinance.co.uk, searches Companies House, asks a human when the match is ambiguous, enriches with Google Places, and creates the pipeline Lead with referral source Strata.",
      responsibilities: [
        "Open a deal file for each Strata inbound enquiry",
        "Search Companies House and select the correct business",
        "Escalate ambiguous matches to the Deal files queue",
        "Enrich with Google Places and hunt missing email/phone before the file moves on",
        "Create the pipeline Lead marked Strata",
      ],
      tasks: [
        {
          id: "open-strata-file",
          name: "Open Strata deal file",
          description: "Review inbound company/contact details and start the deal file.",
          trigger: "on_event",
          steps: [
            "Read inbound company name, contact, email, phone, and loan amount",
            "Create deal file sourced as strata_inbound",
            "Search Companies House",
            "Auto-select a single active match or wait for human pick",
            "Google Places enrich (address, website, phone)",
            "If email or phone is missing, run Contact Finder (Places details, site scrape, officers)",
            "Create Prospect Pipeline Lead with referralSource Strata",
          ],
          expectedOutput: "Pipeline Lead marked Strata, ready for outreach",
        },
      ],
    },
  },
  {
    id: "contact-finder",
    name: "Elena Ward",
    email: "elena.ward@stratanexus.co.uk",
    role: "Contact Enrichment Agent",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400",
    expertise: ["Email discovery", "Phone lookup", "Website scrape"],
    tools: ["Google Places Details", "Website scraper", "Companies House officers"],
    description: "Fills missing email and phone on a deal file before outreach so the pack request has somewhere to go.",
    hourlyRate: 0,
    scores: [
      { subject: "Email recovery", A: 94, fullMark: 100 },
      { subject: "Phone recovery", A: 91, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 94 },
    workflow: {
      jobDescription:
        "Runs whenever a deal file is missing email or phone. Uses Places details, the company website, and Companies House officers. Writes whatever it finds back onto the deal file and the pipeline contact.",
      responsibilities: [
        "Detect missing email or phone on the deal file",
        "Pull phone and website from Google Places details",
        "Scrape the company site and match officers",
        "Update the deal file and CRM contact",
      ],
      tasks: [
        {
          id: "complete-contact",
          name: "Complete contact details",
          description: "Find missing email and phone for outreach.",
          trigger: "on_event",
          steps: [
            "Check deal file for email and phone",
            "Places details for phone/website",
            "Scrape website + officer match",
            "Write results onto the deal file and prospect contact",
          ],
          expectedOutput: "Deal file with the best available email and phone",
        },
      ],
    },
  },
  {
    id: "database-builder-se",
    name: "Tom Brennan",
    email: "tom.brennan@stratanexus.co.uk",
    role: "Finds regional businesses that need Strata Finance",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1531746790731-6c087fecd05a?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Stacked short-term loan refinance",
      "HMRC arrears / Time to Pay path",
      "CDFI and distress-refinance fit",
    ],
    tools: ["Companies House API", "Charge Scanner", "Deal files"],
    description:
      "Regional hunter for Stream A (SME directors with stacked MCA / HMRC pressure) and Stream B (accountants, fractional CFOs, turnaround advisers) in Northampton, Coventry, Peterborough, and Milton Keynes. Never ingests commercial finance brokers.",
    hourlyRate: 0,
    scores: [
      { subject: "Accuracy", A: 99, fullMark: 100 },
      { subject: "Coverage", A: 98, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Regional hunter under the Nexus Sales OS. Stream A: UK SMEs 18+ months, turnover £250k–£5m, high-cost / MCA / HMRC pressure. Stream B: ICAEW/ACCA practices, fractional CFOs, turnaround advisers. Brokers (NACFB, FIBA, packagers) are excluded.",
      responsibilities: [
        "Score SIG-01 to SIG-06. P0 stacks and HMRC TTP first. SIG-06 is an instant disqualify",
        "Never ingest commercial finance brokers or excluded sectors (property development, gambling, tobacco)",
        "Open deal files — do not ask Shaun to prospect",
      ],
      tasks: [
        {
          id: "identify-regional-opportunities",
          name: "Identify Strata-fit opportunities",
          description:
            "Find SE Midlands businesses that need distress-refinance or CDFI funding as described at stratafinance.co.uk.",
          trigger: "scheduled",
          steps: [
            "Scan active companies in the four hubs, 18+ months old",
            "Drop brokers, finance, property development, gambling, tobacco, SPVs, and names already on the book",
            "Open Stream A (high-cost SME) or Stream B (introducer) files only when the gate passes",
          ],
          expectedOutput: "Regional deal files that need Strata's help, ready for agent outreach",
        },
      ],
    },
  },
  {
    id: "database-builder",
    name: "Daniel Crowe",
    email: "daniel.crowe@stratanexus.co.uk",
    role: "Finds businesses that need Strata Finance",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Stacked short-term loan refinance",
      "HMRC arrears and Time to Pay path",
      "Bank / mainstream-broker declines",
      "CDFI and distress-refinance fit",
    ],
    tools: ["Companies House API", "Charge Scanner", "Contact Finder", "Deal files"],
    description:
      "Opportunity hunter for the Nexus Sales OS. Stream A: UK SME directors with stacked MCA / high-cost debt or HMRC TTP. Stream B: accountancy partners, fractional CFOs, turnaround advisers. Never ingests commercial finance brokers. Opens a deal file for CDFI consolidation packaging.",
    hourlyRate: 0,
    scores: [
      { subject: "Opportunity recognition", A: 98, fullMark: 100 },
      { subject: "Strata fit", A: 96, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Specialist hunter under the Nexus Sales OS. Stream A needs 18+ months trading, turnover £250k–£5m, facility £25k–£250k, and at least one high-cost item (MCA, short-term, daily debit, or HMRC arrears). Stream B is introducers. Consolidation facilities route to the CDFI panel (FFE, BCRS, CWRT, SWIG, LDBF, ART, BEF, DBW). Brokers are excluded.",
      responsibilities: [
        "Apply SIG-01 to SIG-06. Multiple MCA/alt charges and HMRC TTP are P0",
        "Reject brokers, property development, gambling, tobacco, consumer/sub-£100k files (SIG-06)",
        "Reject anything below the Strata fit gate — do not open or email a weak file",
        "Open a deal file and hand it to Contact Finder + Sales Outreach only when the public file is a clear Stream A or Stream B case",
      ],
      tasks: [
        {
          id: "identify-opportunities",
          name: "Identify Strata-fit businesses",
          description:
            "Find UK SMEs that need distress-refinance or CDFI funding as described at stratafinance.co.uk.",
          trigger: "scheduled",
          steps: [
            "Scan Companies House for active trading companies at least 18 months old",
            "Drop finance, property, SPV, strike-off, and names already on the book",
            "Read charges — only MCA, high-cost alternative, or a real stack passes",
            "Score fit. Below 70/100 is not contacted",
            "Open a deal file and pass to outreach only when the gate passes",
          ],
          expectedOutput: "High-confidence deal files that need Strata's help, ready for agent outreach",
        },
      ],
    },
  },
  {
    id: "outreach-sales",
    name: "James Hale",
    email: "james.hale@stratanexus.co.uk",
    role: "Business Consultant",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
    expertise: ["Lead Generation", "Personalized Outreach", "Meeting Booking"],
    tools: ["Email Synthesizer", "LinkedIn Profiler", "BANT Scorer"],
    description:
      "Runs the Nexus Sales OS cadences. Stream A: 14-day Email → LinkedIn → Email → Phone. Stream B: 10-day Email → LinkedIn → Phone. Inbound: thank them and request the pack, then a warm call.",
    hourlyRate: 0,
    scores: [
      { subject: "Engagement Rate", A: 92, fullMark: 100 },
      { subject: "Speed to Lead", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 95 },
    workflow: {
      jobDescription:
        "Stage 3 of the agentic deal file. Stream A uses the 14-day SME playbook (debt-service reduction → LinkedIn → case study → close + call). Stream B uses the 10-day introducer playbook. Inbound files get a thank-you and a three-item pack request. PECR stop line on every cold email.",
      responsibilities: [
        "Run the OS cadence for the deal's stream — do not invent copy",
        "Inbound: request six months of bank statements, two years of audited accounts, and why funding is needed",
        "Stream A/B: auto-send emails, stage LinkedIn copy, queue the OS voice script on the close touch",
        "Include a stop line on cold email",
        "Log the outreach on the pipeline lead",
      ],
      tasks: [
        {
          id: "send-outreach",
          name: "Send first engagement email",
          description: "Use the Strata script for inbound ack or cold touch 1.",
          trigger: "on_event",
          steps: [
            "Pick inbound ack, Stream A day-1 email, or Stream B day-1 partner email",
            "Use the OS template — named sender, PECR stop line on cold",
            "Set the cadence timer to the next OS step (Day 4 LinkedIn / Day 3 inbound chase)",
          ],
          expectedOutput: "First email sent from the Strata script, timer running",
        },
      ],
    },
  },
  {
    id: "deal-processing-underwriter",
    name: "Priya Shah",
    email: "priya.shah@stratanexus.co.uk",
    role: "Process Manager",
    department: "Operations",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400",
    expertise: ["Credit Assessment", "Lender Matching", "Financial Analysis"],
    tools: ["Bank Statement OCR", "Companies House Crawler", "Risk Scorer"],
    description:
      "Processing then underwriting on a collected pack. After judgement the file waits on you before anything goes to David at Sterling.",
    hourlyRate: 0,
    scores: [
      { subject: "Matching Accuracy", A: 95, fullMark: 100 },
      { subject: "Plausability Check", A: 96, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 98 },
    workflow: {
      jobDescription:
        "Stages 6–7 of the agentic deal file. Processing reviews everything collected. Underwriting writes a considered judgement. The file then stops for your full review before Sterling.",
      responsibilities: [
        "Analyse the collected pack (statements, accounts, purpose)",
        "Write a processing summary on the deal file",
        "Write an underwriting judgement",
        "Hold the file for human review before David at Sterling",
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
            "Route debt consolidation to the CDFI panel (FFE, BCRS, CWRT, SWIG, LDBF, ART, BEF, DBW)",
            "Rank matched CDFIs by geography, loan size, and fit",
            "Produce lender shortlist with rationale for each recommendation",
            "Note any lenders to avoid (recent declines, relationship issues)",
          ],
          expectedOutput:
            "Ranked CDFI shortlist with match rationale and suggested approach order",
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
    name: "Oliver Grant",
    email: "oliver.grant@stratanexus.co.uk",
    role: "Accounts Agent",
    department: "Finance",
    status: AssociateStatus.HIBERNATION,
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
    name: "Nathan Cole",
    email: "nathan.cole@stratanexus.co.uk",
    role: "Strategic Capital Advisor",
    department: "Advisory",
    status: AssociateStatus.HIBERNATION,
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
    name: "Sophie Reed",
    email: "sophie.reed@stratanexus.co.uk",
    role: "New Business Manager",
    department: "Operations",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
    expertise: ["Client Onboarding", "Document Collection", "Pipeline Management", "Customer Support"],
    tools: ["Document Chaser Bot", "Welcome Pack Generator", "Upload Validator", "Prospect Requirement Analyzer"],
    description:
      "Runs the remaining OS cadence. Stream A: LinkedIn day 4, case study day 8, close email + SME call day 14. Stream B: LinkedIn day 5, partner email + call day 10. Inbound: one pack chase, then the warm-call script.",
    hourlyRate: 0,
    scores: [
      { subject: "Response Time", A: 96, fullMark: 100 },
      { subject: "Collection Rate", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 96 },
    workflow: {
      jobDescription:
        "Stage 4 of the agentic deal file. Fires when the timer ends. If the pack arrived, hand to Processing. Otherwise fire the next OS cadence step: LinkedIn copy, email, or queue the matching voice script (SME, introducer, or inbound).",
      responsibilities: [
        "Watch the collection timer",
        "If documents arrived, pass the file to Processing",
        "Inbound: chase the pack once, then queue the warm-call script",
        "Hunt: execute the next Stream A or Stream B step from the Sales OS",
      ],
      tasks: [
        {
          id: "chase-documents",
          name: "Next engagement touch",
          description: "Fire when the timer ends.",
          trigger: "no_response_alert",
          steps: [
            "Check whether documents landed on the pipeline lead",
            "If yes, hand to Processing",
            "If inbound, send the pack chase and open the warm-call script",
            "If hunt, send or stage the next OS touch and queue the close call when due",
          ],
          expectedOutput: "Next script sent, or warm call queued, or file parked",
          escalationRule: "Inbound pack-chase calls and OS close-call scripts land in the call queue",
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
        const hibernated = agent.id === "accounts-monitor" || agent.id === "capital-strategist";
        const updatedAgent = {
          ...agent,
          status: hibernated ? AssociateStatus.HIBERNATION : existing.status,
        };
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
