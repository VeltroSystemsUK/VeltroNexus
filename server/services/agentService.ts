import { storage } from "../storage";
import { DigitalAssociate, AssociateStatus } from "@shared/agents";
import { MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import { MARKET_RESEARCHER_PROMPT } from "@shared/craftScout";
import { MEDIA_CURATOR_PROMPT } from "@shared/mediaCurator";

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
    description: "Opens a deal file for every stratafinance.co.uk enquiry, matches Companies House (you pick if ambiguous), and sends the inbound ack with the pack link. Elena owns Places and contact fill.",
    hourlyRate: 0,
    scores: [
      { subject: "Match accuracy", A: 97, fullMark: 100 },
      { subject: "Speed to pipeline", A: 99, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 97 },
    workflow: {
      jobDescription:
        "Stage 1 of the agentic deal file. Reviews inbound company details from stratafinance.co.uk, searches Companies House, asks a human when the match is ambiguous, and sends the inbound ack with the pack portal link. Contact enrichment is Elena's desk.",
      responsibilities: [
        "Open a deal file for each Strata inbound enquiry",
        "Search Companies House and select the correct business",
        "Escalate ambiguous matches to the Deal files queue",
        "Send the inbound ack and pack link once the file is matched",
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
            "Hand to Elena for Places / scrape / officers",
            "Create Prospect Pipeline Lead with referralSource Strata",
            "Send inbound ack with the pack upload link",
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
    description: "Runs after every Companies House match on inbound and introducer files: Google Places, site scrape, and officers. Harper owns the SME no-email harvest, including quarantine.",
    hourlyRate: 0,
    scores: [
      { subject: "Email recovery", A: 94, fullMark: 100 },
      { subject: "Phone recovery", A: 91, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 94 },
    workflow: {
      jobDescription:
        "Runs after every match. Uses Google Places, the company website, and Companies House officers. Retries next day on introducers with no contact so Tom's finds are never dropped.",
      responsibilities: [
        "Always enrich after Maya/Daniel/Tom match a company",
        "Pull phone and website from Google Places details",
        "Scrape the company site and match officers",
        "Retry tomorrow when an introducer still has no email or phone",
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
    id: "harvest",
    name: "Harper Cole",
    email: "harper.cole@stratanexus.co.uk",
    role: "Harvest Agent",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    expertise: ["Company-domain harvest", "SMTP mailbox verify", "Director pattern match"],
    tools: ["Company website domain", "SMTP RCPT TO", "Companies House officers", "Website scrape"],
    description:
      "Owns every real SME lead without an email. Scrapes the company site, locks to that domain, SMTP-verifies patterned director inboxes. Never invents info@, never sends, never treats a registry page as the company.",
    hourlyRate: 0,
    scores: [
      { subject: "Mailbox verify", A: 97, fullMark: 100 },
      { subject: "Domain lock", A: 99, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 97 },
    workflow: {
      jobDescription:
        "Harvest Agent. Works quarantine and empty hopper files. Domain from the company website only. Patterned guesses only after a catch-all probe fails. SMTP must pass or the address is not attached.",
      responsibilities: [
        "Run harvest on every real SME lead without an email, including quarantine",
        "Lock harvest to the company website domain",
        "SMTP-verify patterned director inboxes before attach",
        "Skip test companies and inbound files",
        "Never send mail — James sends after a verified mailbox is on the file",
      ],
      tasks: [
        {
          id: "harvest-mailboxes",
          name: "Harvest mailboxes",
          description: "Find and verify company mailboxes on leads with no email.",
          trigger: "on_event",
          steps: [
            "Take gated, hunt-contact, quarantine, and empty-hopper SME files without an email",
            "Skip Pack Upload Test and other noise",
            "Scrape /contact first, lock to the company domain",
            "Probe catch-all, then SMTP-check director patterns",
            "Attach a verified mailbox or hold the file for a day",
          ],
          expectedOutput: "Deal file with a verified company mailbox, or quarantine with a next-day retry",
        },
      ],
    },
  },
  {
    id: "database-builder-se",
    name: "Tom Brennan",
    email: "tom.brennan@stratanexus.co.uk",
    role: "Refer Agent — finds introducers (accountants, CFOs, turnaround advisers)",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar:
      "https://images.unsplash.com/photo-1531746790731-6c087fecd05a?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Chartered accountancy practices (ICAEW/ACCA)",
      "Fractional CFOs and turnaround / insolvency advisers",
      "Introducer relationship sourcing",
    ],
    tools: ["Companies House API", "ICAEW/ACCA directory", "Deal files"],
    description:
      "Refer Agent. Finds Stream B introducer candidates only — accountancy practices, fractional CFOs, turnaround advisers. Elena retries contact; once reachable they enter Identified → James contacts → Approved. Never the SME pack or Sterling path.",
    hourlyRate: 0,
    scores: [
      { subject: "Accuracy", A: 99, fullMark: 100 },
      { subject: "Coverage", A: 98, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Refer Agent under the Nexus Sales OS. Stream B only: ICAEW/ACCA practices, fractional CFOs, turnaround advisers. Never opens a direct-SME or commercial-finance-broker file. A find with no email/phone stays on the contact gate and is retried — it is never dropped and never emailed as a borrower.",
      responsibilities: [
        "Score introducer fit via SIG-05. Never scores or opens a direct-SME (Stream A) file",
        "Never ingest commercial finance brokers or excluded sectors (property development, gambling, tobacco)",
        "Open Introducer pipeline entries (broker_leads) as Identified only when email or phone exists",
        "Hand reachable partners to James for Stream B cadence (Contacted → Approved)",
      ],
      tasks: [
        {
          id: "identify-regional-opportunities",
          name: "Identify introducer candidates",
          description:
            "Find accountancy practices, fractional CFOs, and turnaround advisers who could refer Strata Finance business.",
          trigger: "scheduled",
          steps: [
            "Scan the ICAEW/ACCA directory and Companies House for Stream B-shaped firms",
            "Drop brokers, excluded sectors, and names already on the book",
            "Open Introducer pipeline entries only when the introducer-fit gate passes",
          ],
          expectedOutput: "Introducer candidates in the Introducer pipeline, ready for relationship outreach",
        },
      ],
    },
  },
  {
    id: "database-builder",
    name: "Daniel Crowe",
    email: "daniel.crowe@stratanexus.co.uk",
    role: "Client Agent — finds direct SME borrowers",
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
      "Client Agent. Finds Stream A direct SME borrowers only — directors with stacked MCA / high-cost debt or HMRC TTP. Never ingests commercial finance brokers or introducer candidates (that's the Refer Agent's job). Opens a deal file for CDFI consolidation packaging.",
    hourlyRate: 0,
    scores: [
      { subject: "Opportunity recognition", A: 98, fullMark: 100 },
      { subject: "Strata fit", A: 96, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 99 },
    workflow: {
      jobDescription:
        "Client Agent under the Nexus Sales OS. Stream A only: 18+ months trading, turnover £250k–£5m, facility £25k–£250k, and at least one high-cost item (MCA, short-term, daily debit, or HMRC arrears). Consolidation facilities route to the CDFI panel (FFE, BCRS, CWRT, SWIG, LDBF, ART, BEF, DBW). Brokers and introducer candidates are excluded — those route to the Refer Agent instead.",
      responsibilities: [
        "Apply SIG-01 to SIG-06. Multiple MCA/alt charges and HMRC TTP are P0",
        "Reject brokers, property development, gambling, tobacco, consumer/sub-£100k files (SIG-06)",
        "Reject anything below the Strata fit gate — do not open or email a weak file",
        "Open a deal file in the main Pipeline and hand it to Contact Finder + Sales Outreach only when it's a clear Stream A case",
      ],
      tasks: [
        {
          id: "identify-opportunities",
          name: "Identify Strata-fit businesses",
          description:
            "Find UK SMEs that need distress-refinance or CDFI funding as described at stratafinance.co.uk.",
          trigger: "scheduled",
          steps: [
            "Scan Companies House for active trading companies at least 12 months old",
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
      "Runs hunt cadences only. Stream A SME: 14-day Email → LinkedIn → Email → Phone. Stream B introducer: 10-day Email → LinkedIn → Phone once Tom has a reachable partner. Inbound ack is Maya; inbound chase is Sophie.",
    hourlyRate: 0,
    scores: [
      { subject: "Engagement Rate", A: 92, fullMark: 100 },
      { subject: "Speed to Lead", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 95 },
    workflow: {
      jobDescription:
        "Hunt email desk. Stream A uses the 14-day SME playbook. Stream B uses the 10-day introducer playbook only after the Refer Agent has a reachable contact — those files stay on the Introducer pipeline, never the SME pack. PECR stop line on every cold email. SMTP must deliver or the file holds.",
      responsibilities: [
        "Run Stream A and Stream B OS cadences — do not invent copy",
        "Never email an introducer that still has no corporate contact",
        "Stage LinkedIn copy and wait for the director to post",
        "Include a stop line on cold email",
        "Hold on PECR personal mailboxes and failed SMTP — retry the same touch, not day 1",
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
    id: "mailbox-clerk",
    name: "Rowan Vale",
    email: "rowan.vale@stratanexus.co.uk",
    role: "Inbox Agent",
    department: "Sales & Growth",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&q=80&w=400",
    expertise: ["Opt-out / STOP", "Bounce diagnosis", "Spam purge", "Live-reply triage"],
    tools: ["IONOS IMAP", "Agent Mail", "Suppression list", "Deal files"],
    description:
      "Owns the shared inbox. Permanently suppresses STOP/unsubscribe, diagnoses delivery failures, deletes spam, and puts a live customer reply in front of Shaun immediately.",
    hourlyRate: 0,
    scores: [
      { subject: "Opt-out hygiene", A: 99, fullMark: 100 },
      { subject: "Triage speed", A: 97, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 97 },
    workflow: {
      jobDescription:
        "Inbox Agent. Reads every inbound on enquiries@stratafinance.co.uk. STOP is law. Bounces get a reason. Spam is deleted. A real customer reply is Shaun's, now.",
      responsibilities: [
        "Permanently suppress STOP/unsubscribe addresses and delete their deal files",
        "Parse delivery-failure mail and stop mailing dead addresses",
        "Delete spam and mail unrelated to Strata",
        "Escalate responsive customer replies to Shaun immediately",
      ],
      tasks: [
        {
          id: "triage-inbox",
          name: "Triage inbox",
          description: "Classify each new inbound on the shared mailbox.",
          trigger: "on_event",
          steps: [
            "Read the new IMAP message",
            "STOP → suppress + delete deal",
            "Bounce → reason on file, suppress if hard",
            "Spam → delete from Agent Mail",
            "Customer reply → waiting_human + Copilot attention",
          ],
          expectedOutput: "Clean inbox, suppression list honoured, live replies in front of Shaun",
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
      "Owns the chase timer. Names pack gaps on PARTIAL SFPs, keeps inbound files open until the pack lands, runs remaining Stream A/B cadence steps, and queues Shaun's calls. Never parks a live pack opportunity.",
    hourlyRate: 0,
    scores: [
      { subject: "Response Time", A: 96, fullMark: 100 },
      { subject: "Collection Rate", A: 98, fullMark: 100 },
    ],
    voiceEnabled: true,
    aresCertification: { status: "certified", score: 96 },
    workflow: {
      jobDescription:
        "Stage 4 of the agentic deal file. Fires when the timer ends. New files go to Priya. PARTIAL SFPs get a named-gap chase, not a stall. Inbound files stay in chase until the pack lands or Shaun stops them. Hunt cadence continues until the close call.",
      responsibilities: [
        "Watch the collection timer",
        "If new documents arrived, pass the file to Processing",
        "If SFP is PARTIAL, chase the named gaps and keep the file open",
        "Inbound: keep chasing after the warm call if the pack is still missing",
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
  {
    id: "marketing-manager",
    name: "Isla Quinn",
    email: "isla.quinn@stratanexus.co.uk",
    role: "Marketing Director",
    department: "Marketing",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Thumb-stopping hooks",
      "Art direction",
      "Visual curation",
      "LinkedIn-first packs",
      "Introducer and SME tracks",
    ],
    tools: ["Craft desk", "Week queue", "Channel handles", "Media Gallery", "Kit curator", "Grok Images", "Email templates", "Creative Ammo Briefs"],
    description:
      "MKT-2 Marketing Director. Writes the line, hangs Kit or Grok stills, composes email in Craft. LinkedIn-first packs for SME directors and introducers. Never posts. Never buys ads. Never invents rates.",
    hourlyRate: 0,
    scores: [
      { subject: "Brand voice", A: 96, fullMark: 100 },
      { subject: "Art direction", A: 94, fullMark: 100 },
      { subject: "Compliance of claims", A: 99, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 96 },
    workflow: {
      jobDescription: MARKETING_DIRECTOR_PROMPT,
      responsibilities: [
        "Translate Casey Wren's Creative Ammo Briefs into hook, body, CTA, hashtags and links inside Craft limits",
        "Art-direct each board: weekday frame, shadow, motion, Strata type, logo at true proportions",
        "Hang a Kit still from My Uploads, a stock pick, or a Grok Imagine still from Casey's prompt — never a grey box",
        "Compose email templates in the same Craft engine with merge tags",
        "Stay inside house claims: we package, we do not lend, we do not decide credit",
        "Never auto-publish, never store social passwords, never spend on ads",
      ],
      tasks: [
        {
          id: "queue-week",
          name: "Queue next week's posts",
          description: "Turn Content Scout ammo into a Monday–Sunday pack of copy plus matching visuals.",
          trigger: "on_instruction",
          steps: [
            "Scan if Casey's briefs are stale — rejected cards are not held",
            "Read the Creative Ammo Briefs from Casey Wren",
            "Write LinkedIn-first drafts (borrower and introducer) from the social angle and SME impact",
            "Pair each draft with a Kit, Grok, or stock still and weekday art direction",
            "Leave every card as draft for marketing approve, then compliance, then Shaun",
          ],
          expectedOutput: "Week queue on /craft with copy and visuals, nothing posted",
          x: 0,
          y: 80,
        },
        {
          id: "compose-email-template",
          name: "Compose email template",
          description: "Build a marketing email in Craft with merge tags and a still from My Uploads.",
          trigger: "on_instruction",
          steps: [
            "Open Email Templates in the Craft engine",
            "Hang a still Kit saved to My Uploads",
            "Insert house merge tags",
            "Leave the template as draft until Shaun sends the campaign",
          ],
          expectedOutput: "Email template on /email-templates, not sent",
          x: 0,
          y: 240,
        },
      ],
      edges: [{ id: "e-isla-week-email", source: "queue-week", target: "compose-email-template", label: "same engine" }],
    },
  },
  {
    id: "content-scout",
    name: "Casey Wren",
    email: "casey.wren@stratanexus.co.uk",
    role: "Content Scout",
    department: "Marketing",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Strata-desk scan (stacked debt, HMRC TTP, CDFI)",
      "Relevant UK press only",
      "SME impact translation",
      "Straight briefs, no tangents",
      "Creative Ammo Briefs",
    ],
    tools: ["Craft Content aid", "Scan API", "Firecrawl", "Anthropic", "xAI", "BoE / FCA / ONS / NACFB / BBB / Gazette"],
    description:
      "MKT-3 Content Scout. Harvests only Strata-desk intelligence (stratafinance.co.uk) plus relevant public news for Isla. Never writes final ad copy. Never invents rates. Never posts. No tangents.",
    hourlyRate: 0,
    scores: [
      { subject: "Signal quality", A: 95, fullMark: 100 },
      { subject: "UK context", A: 97, fullMark: 100 },
      { subject: "House policy", A: 99, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 95 },
    workflow: {
      jobDescription: MARKET_RESEARCHER_PROMPT,
      responsibilities: [
        "Scan only the Strata desk: stacked short-term loans, HMRC TTP, CDFI / BBB, cashflow, bank declines",
        "Let in public news only when it changes cost, speed, or availability of that capital",
        "Translate each finding into a Creative Ammo Brief for Isla Quinn — one fact, no tangent",
        "Mark missing numbers as missing — never invent rates or insolvency counts",
        "Stay inside house claims: packager, not lender",
        "Never write final ad copy, never auto-publish, never buy ads",
      ],
      tasks: [
        {
          id: "scan-week",
          name: "Scan week for Creative Ammo",
          description: "Fill Craft Content aid with seven Creative Ammo Briefs Isla can turn into posts.",
          trigger: "on_instruction",
          steps: [
            "Firecrawl official UK sources on stacked refinance, HMRC TTP, CDFI",
            "Drop notes and briefs that are not Strata-desk",
            "Filter bank PR puffery",
            "Write seven Creative Ammo Briefs (borrower + introducer) — one fact each, no tangent",
            "Hand off to Isla on /craft — she writes the copy",
          ],
          expectedOutput: "Seven Creative Ammo Briefs on the Craft desk, no posts published",
          x: 0,
          y: 80,
          shape: "circle",
        },
      ],
    },
  },
  {
    id: "media-curator",
    name: "Kit Lang",
    email: "kit.lang@stratanexus.co.uk",
    role: "Media Curator",
    department: "Marketing",
    status: AssociateStatus.AVAILABLE,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
    expertise: [
      "Ingestion and dedupe",
      "Licence and attribution",
      "Social presets",
      "Tagging and alt text",
      "Hybrid search",
    ],
    tools: ["Media Gallery", "Unsplash", "Pexels", "Openverse", "Firecrawl", "Curator index", "Craft", "Email templates"],
    description:
      "MKT-4 Media Curator. Ingests, hashes, tags, and indexes stills for Isla and campaigns. Never posts. Never strips credits.",
    hourlyRate: 0,
    scores: [
      { subject: "Index quality", A: 94, fullMark: 100 },
      { subject: "Licence hygiene", A: 98, fullMark: 100 },
      { subject: "Retrieval", A: 93, fullMark: 100 },
    ],
    voiceEnabled: false,
    aresCertification: { status: "certified", score: 94 },
    workflow: {
      jobDescription: MEDIA_CURATOR_PROMPT,
      responsibilities: [
        "Hunt Unsplash, Pexels, Openverse and Firecrawl image search on allowlisted hosts",
        "Dedupe by content hash and perceptual hash",
        "Tag, caption, and index for Craft and email",
        "Save a clicked still into My Uploads so Isla and campaigns can pick it",
        "Keep photographer credit and licence on the record",
        "Never auto-publish, never buy ads, never invent rates on a caption",
      ],
      tasks: [
        {
          id: "curate-gallery",
          name: "Hunt stills",
          description: "Fill the Curated index from Unsplash, Pexels, Openverse and Firecrawl.",
          trigger: "on_instruction",
          steps: [
            "Run curator or accept a URL",
            "Fetch, hash, skip near-duplicates",
            "Record aspect, licence, attribution, tags",
            "Keep only allowlisted hosts",
          ],
          expectedOutput: "Curated assets on /media, nothing posted",
          x: 0,
          y: 80,
          shape: "circle",
        },
        {
          id: "save-uploads",
          name: "Save to My Uploads",
          description: "Click a curated still so Email Templates and Craft can pick it.",
          trigger: "on_instruction",
          steps: [
            "Click the still in Curated",
            "Copy it into My Uploads",
            "Log usage against the gallery",
          ],
          expectedOutput: "Still on My Uploads tab",
          x: 280,
          y: 80,
        },
      ],
      edges: [{ id: "e-kit-hunt-save", source: "curate-gallery", target: "save-uploads", label: "click" }],
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
