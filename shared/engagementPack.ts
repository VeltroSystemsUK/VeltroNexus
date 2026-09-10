/**
 * Client e-sign pack — Privacy Notice + Terms of Business.
 * Sent populated before any file goes to David at Sterling.
 * Version bump voids prior signatures; the client re-signs.
 */

export const ENGAGEMENT_PACK_VERSION = "2026-09-v1";

export const BROKER_LEGAL_NAME = "Sterling Commercial Finance Limited trading as Strata Finance";
export const BROKER_ADDRESS_LINES = [
  "Unit 3 Sterling House, Wheatcroft Business Park",
  "Edwalton, Nottingham NG12 4DG",
];
export const BROKER_EMAIL = "info@sterlingcommercialfinance.co.uk";
export const BROKER_PHONE = "0115 984 9800";
export const BROKER_FRN = "733615";
export const BROKER_ICO = "Z7480727";
export const BROKER_DPO = "David Griffiths";

export type EngagementFill = {
  clientName: string;
  clientAddress: string;
  amount: string;
  purpose: string;
  term: string;
  rate: string;
  security: string;
  date: string;
};

export type EngagementState = {
  status: "not_sent" | "sent" | "signed" | "void";
  version: string;
  sentAt?: string;
  signedAt?: string;
  signedName?: string;
  signedTitle?: string;
  signedIp?: string;
  privacyAccepted?: boolean;
  termsAccepted?: boolean;
};

export type SignPayload = {
  name: string;
  title?: string;
  privacyAccepted: boolean;
  termsAccepted: boolean;
};

export type DealFillSource = {
  companyName?: string;
  placeAddress?: string;
  loanAmount?: number | null;
  fundingReason?: string;
  contactName?: string;
  termMonths?: number | null;
  term?: string | number | null;
};

export type DocBlock =
  | { type: "kicker"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "para"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "kv"; rows: { label: string; value: string }[] }
  | { type: "callout"; title: string; body: string }
  | { type: "note"; text: string };

const TOKEN = /\{\{(clientName|clientAddress|amount|purpose|term|rate|security|date)\}\}/g;

export function populateText(text: string, fill: EngagementFill): string {
  return text.replace(TOKEN, (_, key: keyof EngagementFill) => fill[key] || "");
}

function populateValue(value: string, fill: EngagementFill): string {
  return populateText(value, fill);
}

export function populateBlocks(blocks: DocBlock[], fill: EngagementFill): DocBlock[] {
  return blocks.map((block) => {
    if (block.type === "kv") {
      return {
        ...block,
        rows: block.rows.map((row) => ({
          label: populateValue(row.label, fill),
          value: populateValue(row.value, fill),
        })),
      };
    }
    if (block.type === "list") {
      return { ...block, items: block.items.map((item) => populateValue(item, fill)) };
    }
    if (block.type === "callout") {
      return { ...block, title: populateValue(block.title, fill), body: populateValue(block.body, fill) };
    }
    if ("text" in block) return { ...block, text: populateValue(block.text, fill) };
    return block;
  });
}

function gbpFromDealAmount(raw?: number | null): number | undefined {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return undefined;
  if (raw >= 10_000_000) return Math.round(raw / 100);
  return raw;
}

function formatGbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function formatUkDate(iso = new Date().toISOString()): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function termFromDeal(deal: DealFillSource): string {
  if (typeof deal.term === "string" && deal.term.trim()) return deal.term.trim();
  const months = typeof deal.term === "number" ? deal.term : deal.termMonths;
  if (months && months > 0) {
    if (months % 12 === 0) {
      const years = months / 12;
      return years === 1 ? "1 year" : `Up to ${years} years`;
    }
    return `Up to ${months} months`;
  }
  return "Up to 5 years";
}

export function fillFromDeal(deal: DealFillSource): EngagementFill {
  const amount = gbpFromDealAmount(deal.loanAmount);
  const purpose = String(deal.fundingReason || "").trim();
  const address = String(deal.placeAddress || "").trim();
  return {
    clientName: String(deal.companyName || "").trim() || "The Client",
    clientAddress: address || "As on file",
    amount: amount ? formatGbp(amount) : "To be confirmed",
    purpose: purpose || "Business Loan",
    term: termFromDeal(deal),
    rate: "To be confirmed",
    security: "Directors Personal Guarantees. Debenture may be required.",
    date: formatUkDate(),
  };
}

export function validateSignPayload(payload: SignPayload): { ok: true } | { ok: false; error: string } {
  if (!String(payload.name || "").trim()) {
    return { ok: false, error: "Type your full name to sign." };
  }
  if (!payload.privacyAccepted) {
    return { ok: false, error: "Please confirm you have read the Privacy Notice." };
  }
  if (!payload.termsAccepted) {
    return { ok: false, error: "Please confirm you have read the Terms of Business." };
  }
  return { ok: true };
}

export function applySignature(
  current: Pick<EngagementState, "status" | "version" | "sentAt">,
  payload: SignPayload,
  meta: { at: string; ip?: string },
): EngagementState {
  const check = validateSignPayload(payload);
  if (!check.ok) {
    return {
      status: current.status === "signed" ? "sent" : current.status,
      version: ENGAGEMENT_PACK_VERSION,
      sentAt: current.sentAt,
    };
  }
  return {
    status: "signed",
    version: ENGAGEMENT_PACK_VERSION,
    sentAt: current.sentAt,
    signedAt: meta.at,
    signedName: payload.name.trim(),
    signedTitle: payload.title?.trim() || undefined,
    signedIp: meta.ip,
    privacyAccepted: true,
    termsAccepted: true,
  };
}

export function isLiveSigned(engagement?: Partial<EngagementState> | null): boolean {
  if (!engagement) return false;
  return (
    engagement.status === "signed" &&
    engagement.version === ENGAGEMENT_PACK_VERSION &&
    Boolean(String(engagement.signedName || "").trim()) &&
    engagement.privacyAccepted === true &&
    engagement.termsAccepted === true
  );
}

export function sterlingSendBlockedByEngagement(engagement?: Partial<EngagementState> | null): string | null {
  if (isLiveSigned(engagement)) return null;
  return "Engagement Letter not signed";
}

export function privacyNoticeBlocks(): DocBlock[] {
  return [
    { type: "kicker", text: "To be signed before the file is sent to Sterling" },
    { type: "heading", level: 1, text: "Privacy Notice" },
    {
      type: "callout",
      title: "What you need to do",
      body: "Read this notice. It explains how Strata Finance uses your personal data. At the end, confirm you consent to us sharing your details with lenders so they can consider your application. This is one of two documents to sign — the Terms of Business is the other.",
    },
    { type: "heading", level: 2, text: "Who we are" },
    {
      type: "para",
      text: "Strata Finance is a trading style of Sterling Commercial Finance Limited, and we can be contacted using the following details:",
    },
    {
      type: "kv",
      rows: [
        { label: "Telephone", value: BROKER_PHONE },
        { label: "Registered address", value: BROKER_ADDRESS_LINES.join(", ") },
        { label: "Email", value: BROKER_EMAIL },
        { label: "Data Protection Officer", value: BROKER_DPO },
        { label: "ICO registration", value: BROKER_ICO },
      ],
    },
    {
      type: "para",
      text: "We act as a Commercial Finance Broker for our clients. Sterling Commercial Finance Limited trading as Strata Finance are Authorised and Regulated by the Financial Conduct Authority, FRN 733615.",
    },
    { type: "heading", level: 2, text: "Our legal grounds for holding your data" },
    {
      type: "para",
      text: "The UK’s data protection laws allow us to use your personal data provided we have a lawful basis to do so. This includes sharing it in certain circumstances, as described below.",
    },
    {
      type: "para",
      text: "We consider we have the following reasons (legal bases) to use your personal data:",
    },
    {
      type: "list",
      items: [
        "Performance of contract with you: we need to use your personal data to be able to successfully legally contract with you.",
        "Compliance with our legal obligations: we need to use your personal data so as to comply with certain legislation such as financial crime legislation.",
        "Legitimate interests: these are our business and commercial reasons for using your data, which we have balanced against your interests. We have certain legitimate interests in using your data which are not outweighed by your interests, fundamental rights or freedoms. These legitimate interests are to help prevent and detect financial crime, fraud and money laundering, to promote responsible lending, to support our tracing, collection and litigation procedures and to assist our compliance with the legal and regulatory requirements placed upon us.",
        "Your consent: You can withdraw this consent at any time, in which case we will cease to use it, unless we have a right and a need to continue processing it for one of the other reasons set out above.",
      ],
    },
    {
      type: "para",
      text: "More information on how we use your personal data and for what purposes is set out below.",
    },
    { type: "heading", level: 2, text: "What data do we collect?" },
    { type: "heading", level: 3, text: "Data provided by you" },
    {
      type: "list",
      items: [
        "Funder application details: for example but not limited to, your name, national insurance number, postal address, your email address, your IP address, telephone numbers, date of birth, bank account details, equipment requirement details, home ownership details, reason for borrowing, your assets and liabilities, details of your proof of identity documentation, proof of address documentation, evidence of additional equity available and evidence of any other business interests.",
        "In writing: for example letters, emails, texts and other electronic communications.",
        "Online: for example when you use our website or mobile app.",
        "In financial reviews, for renewals and in any surveys etc.",
      ],
    },
    { type: "heading", level: 3, text: "Data we collect when you use our services" },
    {
      type: "list",
      items: [
        "Transaction data: for example what sort of products you are selecting, the length of term, the types of asset you are looking at financing, business type and geographical location.",
        "Payment data: for example, the amount, origin, frequency, history and method of your payments.",
        "Voluntarily complete a customer survey or provide feedback on any of our message boards or via email.",
        "Use or view our website via your browser’s cookies.",
      ],
    },
    { type: "heading", level: 3, text: "Data provided to and by third parties" },
    {
      type: "list",
      items: [
        "Data from persons that introduce you to us: for example brokers, product suppliers, financial advisers, agents, finance providers or other third parties.",
        "Data from credit reference agencies, most likely to be either Experian, Creditsafe, Equifax or CallCredit.",
        "Data from fraud prevention agencies.",
        "Publicly available information: for example, from the land registry, companies house, the electoral register, other information available online or in the media, including social media.",
        "Data from your representatives where relevant: for example your legal and financial advisers such as lawyers and accountants.",
      ],
    },
    {
      type: "note",
      text: "We may also require a statement signed by an independent qualified accountant as to your financial worth which may include information such as your gross and net worth, your assets and liabilities and information as to your available collateral or security. You will be asked to consent to the provision of this information.",
    },
    { type: "heading", level: 2, text: "Special Category Data" },
    {
      type: "para",
      text: "In the course of your interactions with Strata Finance you may share information that is classified as ‘Special Category Data’. This could include data about:",
    },
    {
      type: "para",
      text: "Race; Ethnic origin; Politics; Religion; Trade union membership; Genetics; Biometrics; Health; Sex life; Sexual orientation.",
    },
    {
      type: "para",
      text: "Where you do share information relating to any of these categories e.g., when you may share information about your health or a characteristic of vulnerability Strata Finance will always seek explicit consent from you to store and process such information.",
    },
    { type: "heading", level: 2, text: "Why is personal data collected by us?" },
    { type: "para", text: "Strata Finance collect personal data for a number of reasons." },
    {
      type: "para",
      text: "From time to time, we may contact you to ask for your consent to use your personal data for other purposes. Your personal data may also be used for other purposes where required or permitted by law.",
    },
    {
      type: "para",
      text: "When we and fraud prevention agencies process your personal data, we do so on the basis that we have a legitimate interest in preventing fraud and money laundering, and to verify identity, in order to protect our business and to comply with laws that apply to us. Such processing is also a contractual requirement of the services or financing you have requested. We, and fraud prevention agencies, may also enable law enforcement agencies to access and use your personal data to detect, investigate and prevent crime. Fraud prevention agencies can hold your personal data for different periods of time, and if you are considered to pose a fraud or money laundering risk, your data can be held for up to six years.",
    },
    {
      type: "para",
      text: "In order to process your application, we may supply your personal information to credit reference agencies (CRAs) in which case they will give us information about you, such as about your financial history. We do this to assess your creditworthiness and product suitability, check your identity, manage your account, trace and recover debts and prevent criminal activity. When CRAs receive a search from us they may place a search footprint on your credit file that may be seen by other lenders and used to assess applications for finance from you and members of your household. The CRA may also share your personal information with other organisations. We may also continue to exchange information about you with CRAs on an ongoing basis, including about your settled accounts and any debts not fully repaid on time. CRAs will share your information with other organisations. Your data will also be linked to the data of your spouse, any joint applicants or other financial associates. We can provide you with the identities of the CRAs and the ways in which they use and share personal information upon your request.",
    },
    {
      type: "para",
      text: "From time to time, we may provide your information to our partners, third parties and customer service agencies for research and analysis purposes so that we can monitor and improve the services (or as the case may be) we provide. We may contact you by post, e-mail or telephone (or as required) to ask you for your feedback and comments on our services (or as the case may be).",
    },
    { type: "heading", level: 2, text: "How will we use your data?" },
    { type: "para", text: "Strata Finance collects your data so that we can:" },
    {
      type: "list",
      items: [
        "Process your application and manage your request.",
        "Approach Third Party Lenders on your behalf to obtain quotations for Commercial Finance Products.",
        "Complete Third-Party Lender’s Applications Forms on your behalf.",
        "Keep you up to date with our services and the latest finance products available in the Market.",
        "Invite you to seminars held by Strata Finance.",
        "Email you with special offers on other products and services we think you might like.",
        "To monitor the performance of our products and services to ensure consumer outcomes are being achieved.",
      ],
    },
    {
      type: "para",
      text: "We may pass your data to Lenders, such as Banks and Credit Unions etc, to provide you with offers of products suitable to meet your customer requirements.",
    },
    {
      type: "para",
      text: "When Our Company processes your data, it may send your data to, and also use the resulting information from, credit reference agencies to prevent fraudulent purchases.",
    },
    {
      type: "para",
      text: "We will not disclose your information to any company outside of Strata Finance except for the above purposes and to help prevent fraud or if required by law to do so.",
    },
    { type: "heading", level: 2, text: "When Personal Data is shared" },
    {
      type: "para",
      text: "Your personal details may be shared with Third-Party Lenders and third parties who we believe will be able to assist us with your enquiry or application, or who are able to support your needs as identified. These third parties will include but may not be limited to providers of legal services such as Solicitors, conveyancers, surveyors and valuers and in each case only where we believe this to be required due to your particular circumstances. In each case, your data will only be shared for the purposes set out in this customer privacy notice, i.e., to progress your finance requirements enquiry and to provide you with our professional services. Please note that this sharing of data does not entitle such third parties to send you marketing or promotional messages. Data is shared to ensure we can adequately fulfil our responsibilities to you.",
    },
    {
      type: "para",
      text: "We may also share your personal data with CRAs, fraud prevention agencies, law enforcement agencies, regulators and other authorities, the UK Financial Services Compensation Scheme, any agent that you have given us authority to communicate with and persons you ask us to share your data with, companies that we introduce you to, for the purposes set out above. These agencies and firms may also share your personal data with others.",
    },
    { type: "heading", level: 2, text: "What are your data protection rights and choices?" },
    { type: "para", text: "Your personal data is protected by legal rights, which include:" },
    {
      type: "list",
      items: [
        "Right to be informed – Individuals have the right to be informed about the collection and use of their personal data.",
        "The right of access to your personal data – Individuals have the right to access and receive a copy of their personal data and other supplementary information.",
        "The right to rectification – Individuals have the right to have inaccurate personal data rectified or completed if incomplete.",
        "The right to erasure – Individuals have the right to have their personal data erased.",
        "The right to restrict processing – Individuals have the right to request the restriction or suppression of their personal data.",
        "The right to portability – This allows individuals to obtain and reuse their personal data for their own purposes across different services.",
        "The right to object – this gives individuals the right to object to the processing of their personal data in certain circumstances, it also gives individuals the absolute right to stop their data being used for direct marketing.",
        "The right in relation to automated decision making and profiling – this allows individuals to object to their data being used in an automated individual decision-making process (making a decision solely by automated means without any human involvement) and profiling (automated processing of personal data to evaluate certain things about an individual). Profiling can be part of an automated decision-making process.",
      ],
    },
    {
      type: "para",
      text: "There may be reasons why we need to keep or use your data, but please tell us if you think we should not be processing your data.",
    },
    {
      type: "para",
      text: `If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us at ${BROKER_EMAIL}.`,
    },
    {
      type: "para",
      text: `For further information on how your information is used, how we maintain the security of your information and your rights in relation to it, please contact us via email ${BROKER_EMAIL} or call us on ${BROKER_PHONE}.`,
    },
    { type: "heading", level: 2, text: "How long is your data kept?" },
    {
      type: "para",
      text: "We will retain your personal data as long as you are a customer with us. We may retain your personal data beyond this date for the purposes mentioned above and will in any case at all times retain your personal data for the minimum period required by law. We may also retain your data to deal with any disputes, to maintain records and to show we have dealt with you fairly.",
    },
    {
      type: "para",
      text: "We may also retain your data for research and statistical purposes in which case we will ensure it is kept private and used only for these purposes.",
    },
    {
      type: "para",
      text: "Data about live and settled accounts is kept on credit files for six years from the date they are settled or closed. If the account is recorded as defaulted, the data is kept for six years from the date of the default.",
    },
    { type: "heading", level: 2, text: "Marketing" },
    {
      type: "para",
      text: "Strata Finance understands that with the introduction of the Consumer Duty, it is likely the level of communications issued by our business will increase. This will be necessary to support customers to understand the products and services offered and to provide support to customer throughout the lifecycle of the relationship.",
    },
    {
      type: "para",
      text: "If you have agreed to receive marketing, you may always opt out at a later date.",
    },
    {
      type: "para",
      text: "You have the right at any time to stop Strata Finance from contacting you for marketing purposes.",
    },
    { type: "heading", level: 2, text: "Cookies" },
    {
      type: "para",
      text: "Strata Finance uses cookies to track and test customer engagement and actions throughout the customer journey or customer communications. Strata Finance understand that under the Privacy and Electronic Communications Regulation (PECR) opt-in consent is required when these types of cookies are used.",
    },
    {
      type: "para",
      text: "Cookies are text files placed on your computer to collect standard Internet log information and visitor behaviour information. When you visit our websites, we may collect information from you automatically through cookies or similar technology.",
    },
    { type: "para", text: "For further information, visit www.allaboutcookies.org." },
    { type: "heading", level: 3, text: "How do we use cookies?" },
    {
      type: "para",
      text: "Our Company uses cookies in a range of ways to improve your experience on our website, including:",
    },
    { type: "list", items: ["Keeping you signed in", "Understanding how you use our website"] },
    { type: "heading", level: 3, text: "What types of cookies do we use?" },
    {
      type: "para",
      text: "There are a number of different types of cookies, however, our website uses:",
    },
    {
      type: "list",
      items: [
        "Functionality – Our Company uses these cookies so that we recognize you on our website and remember your previously selected preferences. These could include what language you prefer and location you are in. A mix of first-party and third-party cookies are used.",
        "Advertising – Our Company uses these cookies to collect information about your visit to our website, the content you viewed, the links you followed and information about your browser, device, and your IP address. Our Company sometimes shares some limited aspects of this data with third parties for advertising purposes. We may also share online data collected through cookies with our advertising partners. This means that when you visit another website, you may be shown advertising based on your browsing patterns on our website.",
      ],
    },
    { type: "heading", level: 3, text: "How to manage cookies" },
    {
      type: "para",
      text: "You can set your browser not to accept cookies, and the above website tells you how to remove cookies from your browser. However, in a few cases, some of our website features may not function as a result.",
    },
    { type: "heading", level: 2, text: "Privacy policies of other websites" },
    {
      type: "para",
      text: "Strata Finance website contains links to other websites. If you click on a link to another website, our privacy policy no longer applies, and we recommend you review that site’s privacy policy to establish how they will process your data.",
    },
    { type: "heading", level: 2, text: "Changes to our privacy policy" },
    {
      type: "para",
      text: "Our Company keeps its privacy policy under regular review and places any updates on this web page. This privacy policy was last updated on 7th September 2026.",
    },
    { type: "heading", level: 2, text: "How to contact us" },
    {
      type: "para",
      text: "If you have any questions about Our Company’s Privacy Policy, the data we hold on you, or you would like to exercise one of your data protection rights, please do not hesitate to contact us.",
    },
    {
      type: "kv",
      rows: [
        { label: "Email", value: BROKER_EMAIL },
        { label: "Telephone", value: BROKER_PHONE },
        { label: "Write to us", value: BROKER_ADDRESS_LINES.join(", ") },
      ],
    },
    { type: "heading", level: 2, text: "How to make a complaint and contact the appropriate authority" },
    {
      type: "para",
      text: "If you are unhappy about how your personal data has been used by us, please contact us and we will be happy to register a complaint.",
    },
    {
      type: "para",
      text: "You also have a right to complain to the Information Commissioner’s Office which regulates the processing of personal data. You can contact them at Information Commissioner’s Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF, on 0303 123 1113 or by email to casework@ico.org.uk. See also https://ico.org.uk/global/contact-us/.",
    },
    { type: "heading", level: 2, text: "Lender sharing consent" },
    {
      type: "para",
      text: "Strata Finance will share your details with Lenders, such as Banks and Credit Unions etc so that they can process your information, allowing suitable and sustainable products to be offered. If you consent to us passing your details for that purpose, please sign to confirm.",
    },
    {
      type: "kv",
      rows: [
        { label: "Print name", value: " " },
        { label: "Signed", value: " " },
        { label: "For and on behalf of", value: "{{clientName}}" },
        { label: "Date", value: "{{date}}" },
      ],
    },
  ];
}

export function engagementLetterBlocks(): DocBlock[] {
  return [
    { type: "kicker", text: "To be signed before the file is sent to Sterling" },
    { type: "heading", level: 1, text: "Terms of Business" },
    {
      type: "callout",
      title: "What you need to do",
      body: "Check the details in the boxes below — they are filled from your file. Read the fees, the Confirmation of Instructions, and the Brokers’ Terms and Conditions. Sign only if you agree. Nothing is sent to Sterling until this letter and the Privacy Notice are both signed.",
    },
    { type: "heading", level: 2, text: "An agreement between" },
    {
      type: "kv",
      rows: [
        { label: "The Broker (“we”, “us”, “our”)", value: BROKER_LEGAL_NAME },
        { label: "Broker address", value: BROKER_ADDRESS_LINES.join(", ") },
        { label: "The Client (“you”, “your”)", value: "{{clientName}}" },
        { label: "Client address", value: "{{clientAddress}}" },
      ],
    },
    { type: "heading", level: 2, text: "Schedule 1 — Confirmation of Instructions Letter" },
    {
      type: "para",
      text: "This Confirmation of Instructions Letter is made pursuant to and incorporates all provisions and terms of the Terms of Business agreement made between the Broker and the Client (“Terms of Business”). All terms defined in the Terms of Business shall bear the same meanings where used in this Confirmation of Instructions Letter. By signing this Confirmation of Instructions Letter, the Client agrees that they have read and approved the Terms of Business and all Schedules incorporated thereto, including this Confirmation of Instructions Letter and the Brokers’ Terms and Conditions.",
    },
    {
      type: "para",
      text: "The following terms are those advised by us as likely to apply to any Finance Offer. They are subject to your acceptance of the Agreement. When the Agreement has been signed, the Confirmation of Instructions Letter will form a contractual part of the Agreement.",
    },
    {
      type: "kv",
      rows: [
        { label: "Required amount", value: "{{amount}}" },
        { label: "Purpose", value: "{{purpose}}" },
        { label: "Term", value: "{{term}}" },
        { label: "Interest rate", value: "{{rate}}" },
        { label: "Security", value: "{{security}}" },
        { label: "Lender’s fees and disbursements", value: "To be confirmed (payable by the Client)" },
      ],
    },
    {
      type: "note",
      text: "The Broker cannot guarantee that these terms will be achieved.",
    },
    {
      type: "para",
      text: "Any Lender selected by the Broker will undertake a thorough examination of the Client’s ability to service the Finance Product. This will include approval of accounting and financial information and a valuation for bank purposes of any property offered as security. Approval of this information is at the sole discretion of the Lender (and not the Broker). Several factors, beyond the control of the Broker, may emerge during this process and cause the Lender to weight, or vary, the terms indicated in this letter which will be revised accordingly.",
    },
    { type: "para", text: "In addition, the Lenders may require some or all the following:" },
    {
      type: "list",
      items: [
        "Suitable insurance on, for example, Buildings, Plant, Machinery and Stock.",
        "Appropriate life or term assurance, including keyman insurance.",
        "Directors guarantees.",
        "An independent survey or valuation, for bank purposes, of any security.",
        "Detailed financial and accounting information including bank statements, projections and accounts.",
        "Independent solicitors to prepare and complete the loan and security documents.",
        "Any other information as necessary to show the viability of the application e.g. business plan.",
      ],
    },
    {
      type: "para",
      text: "In this Agreement unless otherwise specified and the context otherwise requires:",
    },
    {
      type: "list",
      items: [
        "references to statutes and subordinate legislation shall be construed as references to those statutes or that subordinate legislation as respectively replaced, amended or re-enacted from time to time; and",
        "references to this Agreement or any other document or to any specified provision of this Agreement or any other document are to this Agreement, that document or that provision as in force for the time being and as amended from time to time in accordance with the terms of this Agreement or that document and with the consent of the Broker in writing, as the case may be.",
      ],
    },
    { type: "heading", level: 2, text: "1. Appointment of the Broker" },
    {
      type: "para",
      text: "1.1 This Agreement sets out how we will deal with you in the provision of Credit Broking Services. We will start providing Credit Broking Services to you from the Commencement Date.",
    },
    { type: "heading", level: 2, text: "2. Standards Statement" },
    {
      type: "para",
      text: `2.1 ${BROKER_LEGAL_NAME} is authorised and regulated by the FCA with reference number (FRN: ${BROKER_FRN}). ${BROKER_LEGAL_NAME}’s authorisation and permitted activities can be viewed on the Financial Services Register by visiting the FCA’s website https://register.fca.org.uk/.`,
    },
    {
      type: "para",
      text: `2.2 ${BROKER_LEGAL_NAME} is a member of the National Association of Commercial Finance Brokers (“NACFB”). We adopt the Code and Minimum Standards set by the NACFB. You can check Our membership status by contacting the NACFB on https://www.nacfb.org/.`,
    },
    { type: "heading", level: 2, text: "3. Fees" },
    { type: "heading", level: 3, text: "3.1 Time to Pay Arrangements" },
    {
      type: "para",
      text: "These can be sourced through a third-party provider if necessary, costs for which are typically £2,750 plus an additional £100 for each month achieved in excess of 24 months.",
    },
    { type: "heading", level: 3, text: "3.2 Forecast Fee" },
    {
      type: "para",
      text: "Strata Finance can prepare any necessary forecasts which are required to accompany a submission to a Lender. The Forecast Fee is £1,000.",
    },
    { type: "heading", level: 3, text: "3.3 Arrangement Fee" },
    {
      type: "para",
      text: "At the point of Completion of the Finance Offer made by the Lender to whom we presented the Lending Proposal, you will pay to us, in addition to any Forecast Fee in clause 3.2, an Arrangement Fee of £5,000 for the first £100,000 of the Finance Product Amount, and a further 2.5% for any monies over £100,000.",
    },
    {
      type: "para",
      text: "In some cases, the Broker will receive a Commission from the Lender upon Completion of the Finance Offer and the following will apply:",
    },
    {
      type: "list",
      items: [
        "Commission in respect of loan finance will be deducted from the Arrangement Fee in clause 3.3.",
        "Commission in respect of any other finance including, but not limited to, invoice finance, trade finance and asset finance, will be retained by the Broker.",
      ],
    },
    {
      type: "para",
      text: "Payment of the Arrangement Fee shall be made by you to us within 14 days of the date of Completion of the Finance Offer by that Lender.",
    },
    { type: "heading", level: 2, text: "4. Client Acknowledgement" },
    { type: "para", text: "4.1 By executing this Agreement, you acknowledge that:" },
    {
      type: "para",
      text: "4.1.1 You have been urged to seek such independent advice as you consider necessary before signing this Agreement.",
    },
    {
      type: "para",
      text: "4.1.2 We source Finance Offers from our preferred panel of lenders, whose names will be supplied upon request. If none of our preferred panel of lenders are suitable for your requirements, then we will broaden our search to source an appropriate Finance Offer. In this role, we are doing no more than effecting an introduction between you and the Lender(s) to enable you to choose a Finance Product which, in your sole opinion, is suitable for you. We are not your agent or otherwise acting on your behalf, and there is no duty upon us to provide you with impartial advice, information or any recommendation relating to a Finance Product.",
    },
    {
      type: "para",
      text: "4.1.3 We usually receive a Commission from the Lender for introducing you to them in relation to the funding set out in the Finance Offer, as well as receiving Fees separately from you pursuant to clauses 3.1 and 3.2 of this Agreement. For the avoidance of doubt any payment of Commission is subject to the terms of our arrangements with the Lender who pays that Commission. Different lenders pay different amounts. For transparency, the commission we receive is usually a percentage of the amount you borrow. Under some commission models we operate under, the more that you pay to the lender, the more we may receive by way of commission.",
    },
    {
      type: "para",
      text: "4.1.4 We may pay a Commission to the introducer if you have been introduced to us. Any payment will be made by us and will be subject to the terms of our arrangements with the introducer. This will not affect the amount of any fees you or the Lender pay to us.",
    },
    {
      type: "para",
      text: "4.1.5 You have read the Broker’s Terms and Conditions set out in Schedule 2 and agree that they form part of this Agreement.",
    },
    {
      type: "para",
      text: "4.2 You consent that you agree to pay the Fees in accordance with the terms of this Agreement.",
    },
    {
      type: "para",
      text: "4.3 You are aware that we are required to disclose the nature of the payment of any Commission in our communications, as well as when making a recommendation to you. The existence and nature of commission arrangements where the Commission varies depending on the Lender, product or other permissible factors will always be disclosed. The disclosure will also cover how the arrangements could affect our recommendations to you. Such disclosures will be made in our Suitability Letter issued to you.",
    },
    {
      type: "para",
      text: "4.4 We will look to disclose where we will benefit from any fees from the lender (for example but not limited, to administration fees, split fees and panel fees) and disclose the existence, along with the nature, calculation and amount of any Commission within our Commission Disclosure Document.",
    },
    {
      type: "para",
      text: "4.5 You are aware that we may receive Commission from referring you to an Ancillary Service for introducing you to them, and you have no objections to us receiving this amount. If you wish to receive any further information concerning any Commission paid to us by any third-party Ancillary Service, please let us know in writing.",
    },
    {
      type: "para",
      text: "4.6 Commission paid to us may vary in amount depending on the Lender or product. Where the nature of any financial arrangement, including the amount of any Commission or any other type of remuneration is known, in advance of us promoting or recommending a particular Lender or Finance Product, this information will be disclosed to you.",
    },
    {
      type: "para",
      text: "4.7 Having acknowledged the matters set out under this clause 4, you hereby consent to us receiving and retaining any Commission paid.",
    },
    { type: "heading", level: 2, text: "Schedule 2 — Brokers’ Terms and Conditions" },
    { type: "heading", level: 3, text: "Confirmation of Instructions" },
    {
      type: "para",
      text: "Before signing the Agreement, the Broker will complete a Confirmation of Instructions Letter which shall be read and take effect as if they form part of the Agreement. The Confirmation of Instructions Letter will take effect on the date that it is signed by the Client.",
    },
    {
      type: "para",
      text: "Any change to or variation of the Confirmation of Instructions Letter will not affect the liability of the Client to pay any Fees pursuant to the Agreement.",
    },
    { type: "heading", level: 3, text: "Your duty to Us" },
    {
      type: "para",
      text: "The Client agrees to act with utmost good faith in the provision of information to the Broker. This duty is continuous and applies to all information the Client provides to the Broker, whether the Broker has requested it or whether the Client has provided it voluntarily. The Client agrees not to withhold information from the Broker.",
    },
    {
      type: "para",
      text: "The Client agrees to take all reasonable steps and use all reasonable endeavours to comply with and satisfy any condition imposed by the Lender who has made a Finance Offer that accords with the requirements set out in the Confirmation of Instructions Letter.",
    },
    {
      type: "para",
      text: "The Client agrees to notify the Broker if at any time, they intend to appoint an additional or alternate broker or intermediary to obtain an offer of finance for them whereupon the Broker may, subject to any exclusivity arrangements and/or the nature of the Finance Product, be entitled to terminate this Agreement forthwith and the Client shall pay to the Broker any Fee incurred for any Credit Broking Services carried out up to the date of termination, save where such Fees cannot be charged to the Client by law.",
    },
    {
      type: "para",
      text: "If the Client fails to notify the Broker that they intend to appoint an alternate or additional broker or intermediary prior to doing so and if a Finance Offer is subsequently obtained from any Lender the Client will pay the Success Fee calculated by reference to the Finance Offer made but otherwise in accordance clause 3.3 of the Agreement to the Broker.",
    },
    { type: "heading", level: 3, text: "Termination" },
    {
      type: "para",
      text: "The Broker may terminate the Agreement by giving 14 days written notice to the Client and the Client may be required to pay to the Broker any Fee incurred for any Credit Broking Services carried out up to the date of termination, as shall be notified by the Broker to the Client within 14 days of termination.",
    },
    { type: "heading", level: 3, text: "National Association of Commercial Finance Brokers – The Code" },
    {
      type: "para",
      text: "The Broker agrees to act on behalf of the Client in accordance with the terms of the Code.",
    },
    {
      type: "para",
      text: "The Broker will investigate and deal with any complaints raised by the Client concerning the Credit Brokering Services provided by the Broker under the Agreement, promptly and reasonably, but if the Broker is unable to resolve any complaint to the Client’s satisfaction the Code stipulates the procedures available to the Client including NACFB Mediation.",
    },
    {
      type: "para",
      text: "If the Client is unhappy with the Broker’s response to their complaint, and the complainant falls within the regulated activities, they may be able to complain to the Ombudsman at:",
    },
    {
      type: "kv",
      rows: [
        { label: "Address", value: "Financial Ombudsman Service, Exchange Tower, London, E14 9SR" },
        { label: "Contact", value: "0800 0234567, 0300 1239123" },
        { label: "Website", value: "www.financial-ombudsman.org.uk" },
      ],
    },
    {
      type: "para",
      text: "The Ombudsman will be able to confirm whether it can look at the complaint. If the Client is entitled to make a complaint to the Ombudsman, then they are not bound to follow any alternative procedure and can make their complaint to the Ombudsman within the timescales set down by the rules applicable to that scheme, details of which will be provided to the Client by the Broker on request.",
    },
    { type: "heading", level: 3, text: "Amendments" },
    {
      type: "para",
      text: "Any amendment to this Agreement, whether proposed by the Broker or the Client shall be notified in writing to the other Party no less than 30 days prior to such amendment taking effect. Any amendment proposed by the Broker shall take effect on the date specified in the notice unless in the meantime the Client notifies the Broker to the contrary or requests an extension of time. Any amendment proposed by the Client shall take effect when accepted by the Broker in writing.",
    },
    { type: "heading", level: 3, text: "Privacy Notice and Data Protection" },
    {
      type: "para",
      text: "A Privacy Notice has been issued by the Broker to the Client separately from the Agreement, further details of which (and a copy of the same) is available upon request. Being transparent and providing accessible information to individuals about how the Broker will use the Client’s personal data is a key element of the General Data Protection Regulation (GDPR).",
    },
    {
      type: "para",
      text: "The Privacy Notice details lawful bases for processing data, who we are, how we use the information about you, marketing consent, what information is collected, why the personal data is required, our data retention periods and individuals’ rights to personal data. More detailed information can be obtained on request.",
    },
    {
      type: "para",
      text: "You must be confident you understand how your data will be processed. If you require further clarification, please contact us before entering into the Agreement.",
    },
    { type: "heading", level: 3, text: "Assignments and third-party rights" },
    {
      type: "para",
      text: "This Agreement is personal to the Client and a person who is not a party to this Agreement may not enforce any of its terms under the Contracts (Rights of Third Parties) Act 1999.",
    },
    {
      type: "para",
      text: "The Broker may assign, in whole or in part, this Agreement or any of its rights, liabilities or obligations under it, as it thinks fit.",
    },
    { type: "heading", level: 3, text: "Professional Indemnity" },
    {
      type: "para",
      text: "The Broker will maintain professional indemnity insurance cover in respect of its business with and on standard terms offered by reputable insurers.",
    },
    { type: "heading", level: 3, text: "Exclusions" },
    {
      type: "para",
      text: "The Client accepts that the Broker shall have no liability for any economic loss suffered or incurred by the Client (whether direct, indirect or consequential) insofar as it relates in any way to loss of business, loss of Client data, interruption of business or loss of profits or goodwill because of the manner of performance by the Broker of any obligations arising under the Agreement.",
    },
    { type: "para", text: "Nothing in the Agreement shall limit either Party’s liability in respect of any claims:" },
    {
      type: "list",
      items: [
        "for death or personal injury caused by the negligence of such party;",
        "resulting from any fraud including, without limitation, fraudulent misrepresentation made by such party; or",
        "for which liability may not otherwise lawfully be limited or excluded.",
      ],
    },
    { type: "heading", level: 3, text: "Choice of Law" },
    {
      type: "para",
      text: "The Agreement shall be governed by and construed in accordance with English Law. All claims and disputes (including non-contractual claims and disputes) arising out of or in connection with the Agreement, its subject matter, negotiation or formation will be determined in accordance with English law.",
    },
    {
      type: "para",
      text: "The Parties irrevocably agree to submit to the exclusive jurisdiction of the English Courts.",
    },
    { type: "heading", level: 2, text: "Signing" },
    {
      type: "para",
      text: `For and on behalf of Strata Finance (The Broker): ${BROKER_DPO}, Managing Director.`,
    },
    {
      type: "para",
      text: "We understand and agree to the Terms of Business and Brokers Terms and Conditions.",
    },
    {
      type: "kv",
      rows: [
        { label: "Signed for and on behalf of (The Client)", value: "{{clientName}}" },
        { label: "Date", value: "{{date}}" },
      ],
    },
    { type: "heading", level: 2, text: "Defined terms" },
    {
      type: "kv",
      rows: [
        {
          label: "Agreement",
          value:
            "Means the agreement by and between the Broker and the Client, that comprises these Terms of Business, the Broker’s Terms and Conditions (set out in Schedule 2) and any Confirmation of Instructions Letter entered into in connection with the same.",
        },
        {
          label: "Ancillary Service",
          value:
            "Means any service provided by a third-party engaged by the Broker in connection with the Credit Broking Services, which could include (but is not limited to) the services of solicitors or valuers.",
        },
        { label: "Arrangement Fee", value: "Means the Arrangement Fee set out in clause 3.3." },
        {
          label: "Code",
          value:
            "Means the code of practice of the NACFB which applies to all members of the association, as published by the NACFB (available on request from the NACFB or on the NACFB website www.nacfb.org) and as may be amended from time to time.",
        },
        { label: "Commencement Date", value: "Means the date of this Agreement once it has been executed by both Parties." },
        { label: "Commission", value: "Means a sum of money that is paid to us by a Lender in connection with a Lending Proposal." },
        {
          label: "Commission Disclosure Document",
          value: "Means a disclosure of the existence, nature, calculation and amount of any Commission from Lenders.",
        },
        {
          label: "Completion",
          value:
            "Means the date that a Finance Agreement between the Client and a Lender becomes effective following the submission of a Lending Proposal.",
        },
        {
          label: "Confirmation of Instructions Letter",
          value:
            "Means a confirmation of instructions letter, executed by the Client, in substantially the form set out in the Schedule 1.",
        },
        {
          label: "Credit Broking Services",
          value: "Means the credit brokering services which we agree to provide to you under this Agreement.",
        },
        { label: "FCA", value: "Means the Financial Conduct Authority." },
        { label: "Fee", value: "Means the Forecast Fee or Arrangement Fee as the case may be." },
        { label: "Finance Agreement", value: "Means an Agreement to finance a Finance Product." },
        {
          label: "Finance Offer",
          value:
            "Means a written offer setting out the proposed terms of finance issued to you by the Lender (whether such offer is conditional or unconditional) or any replacement thereof.",
        },
        {
          label: "Finance Product",
          value:
            "Means an instrument in which a person can either borrow money, or enter into a finance arrangement for the provision, purchase or refinancing of goods or services.",
        },
        {
          label: "Finance Product Amount",
          value:
            "Means the sum advanced by the Lender to you following the issue of a Finance Offer by that Lender which has been accepted by you.",
        },
        {
          label: "Financial Services Register",
          value:
            "Means the register which helps consumers to confirm the authenticity and contact details of regulated financial services firms.",
        },
        { label: "Forecast Fee", value: "Means the Forecast Fee set out in Clause 3.2." },
        { label: "Introducer", value: "Means any person who may have introduced the Client to the Broker." },
        { label: "Lender", value: "Means any lender to whom the Lending Proposal is presented by us." },
        {
          label: "Lending Proposal",
          value:
            "Means a funding proposal prepared by us and submitted to the Lender setting out, amongst other things, the requirements recorded in the Confirmation of Instructions Letter.",
        },
        {
          label: "Minimum Standards",
          value:
            "Means the minimum standards of the NACFB, as published by the NACFB (available on request from the NACFB or on the NACFB website www.nacfb.org) and as may be amended from time to time.",
        },
        { label: "NACFB", value: "Means the National Association of Commercial Finance Brokers." },
        { label: "Ombudsman", value: "Means the Financial Ombudsman Service, Exchange Tower, London, E14 9SR." },
        { label: "Parties", value: "Means together the Broker and the Client, each being a “Party”." },
        { label: "Privacy Notice", value: "Means the privacy notice provided to You about how we process your Personal Data." },
        {
          label: "Regulated Activities Order",
          value: "Means the Financial Services and Markets Act 2000 (Regulated Activities) Order 2001.",
        },
        {
          label: "Suitability Letter",
          value:
            "Means a report outlining our recommendations to you as to which Lender we feel is most suitable in submitting a Finance Offer to you.",
        },
      ],
    },
  ];
}
