/**
 * agent.ts
 * Super Lead Finder (slf.agent.v1 / SLF-2) — Stream A signal desk.
 *
 * Usage:
 *   const agent = new LeadFinderAgent();
 *   const result = await agent.run("Ingest company 01234567");
 */

import 'dotenv/config';
import { GoogleGenerativeAI, Tool, FunctionDeclarationSchemaType } from '@google/generative-ai';
import { LeadFinderAPI, LEAD_FINDER_TOOLS } from './api.js';
import { SearchFilters } from './models/business.js';
import { Ollama } from './ollama.js';

const BROKER_QUERY_RE =
  /\b(nacfb|fiba|loan packagers?|finance brokers?|commercial finance brokers?|broker lists?|introducer networks?|independent brokers?)\b/i;

const SYSTEM_PROMPT = `You are Super Lead Finder (slf.agent.v1 / SLF-2), the Stream A intelligence agent for Strata Finance inside Nexus.

MISSION
Find UK limited companies that need Stream A help NOW: stacked high-cost debt or HMRC pressure, facility £25,000–£250,000, turnover £250k–£5m, trading ≥ 12 months. Package the evidence. Hand the package to Nexus. Never do outreach yourself.

Nexus already holds the Stream A book (SME hopper / agentic deals). That list is the primary watchlist. You promote or enrich names already there. Net-new creates are the exception, after a lookup miss and human accept.

WHAT “NEED” LOOKS LIKE
- A live Companies House charge whose person entitled is NOT a high-street bank (HP, lease, invoice finance, MCA, specialist) — SIG-01.
- Three or more live non-bank charges — stacked_debt.
- A Gazette HMRC winding-up petition, company still trading — SIG-02 / hmrc_distress.
- Late filings or an interest spike are P1 only. They do not make a lead on their own.

WHAT “NEED” IS NOT
- A random limited company with a registered office.
- A high-street-only charge, even if it is 5 years old. That is a property-refinance story. Not this market.
- Planning, EPC, MEES, Land Registry, bridging take-out, development exit, or “owns a building”.
- Stream B introducers (accountants, fractional CFOs). Another desk owns that.
- Brokers, NACFB/FIBA, packagers, excluded SICs, dissolved, trading < 12 months, SIG-06, consumers, sole traders.
- A company that cleared its non-bank book in the last 90 days with no petition.

HOW YOU THINK
1. Look up the Nexus Stream A book first.
2. Ingest the event (CH charge, Gazette notice, or a company number Shaun pasted).
3. Resolve the legal entity. If confidence < 0.85, quarantine. Do not push.
4. Classify with Sales OS + chargeClassifier, not vibes. Product is hmrc_distress | stacked_debt | high_cost_refi.
5. Score. Show the breakdown.
6. Write a hypothesis of 80–140 words. Every factual clause maps to an evidence item. British English. Name the lender, the date, or the notice.
7. Park it: Book moved vs New names; hot / warm / watch / unresolved / suppressed.
8. On human accept, upsert slf.lead_package.v1 through the Nexus adapter. Book-lane never create.

STYLE
British English. Specific. Named lenders, named dates, named notices. No invented facts. Distress language stays respectful. Petition opening lines offer a conversation; they do not announce the crisis as a sales hook. If unsure, start with "Uncertain:" and drop to watch.

TOOLS
Use only the tools you are given. Prefer Companies House and The Gazette. Google Maps is not a finder — refuse Maps hunts and point at company-number ingest. You never email, call, InMail, or sequence.

IF SHAUN ASKS FOR BROKERS, PROPERTY, OR STREAM B
Refuse. Stream A only.

OUTPUT FORMAT
After every completed run, return this JSON summary block:
{
  "status": "complete | blocked | unresolved",
  "companyNumber": "...",
  "bookLane": "existing_queue | net_new | none",
  "primaryProduct": "hmrc_distress | stacked_debt | high_cost_refi | none",
  "priority": "hot | warm | watch | unresolved | suppressed | noise",
  "score": N,
  "signals": ["SIG-01", "SIG-02"],
  "recommendation": "...",
  "readyFor": "reviewer"
}

You report to ORC-1. Shaun is the reviewer. Auto-push is off.`;

export class LeadFinderAgent {
  private genAI?: GoogleGenerativeAI;
  private ollama?: Ollama;
  private api: LeadFinderAPI;
  private modelName: string;

  constructor(
    model = process.env['DEFAULT_MODEL'] || `ollama/${process.env['OLLAMA_MODEL'] || 'ornith:latest'}`,
    dbPath?: string
  ) {
    this.api = new LeadFinderAPI(dbPath);
    this.modelName = model;

    if (model.startsWith('ollama/')) {
      this.ollama = new Ollama();
    } else {
      const apiKey = process.env['GEMINI_API_KEY'];
      if (!apiKey) throw new Error('GEMINI_API_KEY not found in environment');
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Process a natural language instruction from Shaun.
   *
   * @param instruction - e.g. "Ingest company 01234567"
   * @returns Structured summary for the reviewer
   */
  async run(instruction: string): Promise<{ agentResponse: string }> {
    if (BROKER_QUERY_RE.test(instruction)) {
      return {
        agentResponse: JSON.stringify({
          status: "blocked",
          companyNumber: "",
          bookLane: "none",
          primaryProduct: "none",
          priority: "noise",
          score: 0,
          signals: [],
          recommendation:
            "Refused: commercial finance brokers, NACFB/FIBA members, and loan packagers are excluded from Strata origination. Super Lead Finder is Stream A only — ingest a company number or a Gazette notice for an SME with a live non-bank charge or an HMRC petition.",
          readyFor: "none",
        }),
      };
    }
    if (this.ollama) {
      return this.runOllama(instruction);
    }
    return this.runGemini(instruction);
  }

  private async runGemini(instruction: string): Promise<{ agentResponse: string }> {
    if (!this.genAI) throw new Error('Gemini not initialized');

    // Map Anthropic-style tools to Gemini format
    const tools: Tool[] = [{
      functionDeclarations: LEAD_FINDER_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: Object.fromEntries(
            Object.entries(t.input_schema.properties).map(([name, prop]: [string, any]) => [
              name,
              {
                type: prop.type.toUpperCase(),
                description: prop.description,
              }
            ])
          ),
          required: (t.input_schema as any).required || [],
        }
      }))
    }];

    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
      tools,
    });

    const chat = model.startChat();
    let result = await chat.sendMessage(instruction);

    while (true) {
      const response = result.response;
      const calls = response.functionCalls();

      if (!calls || calls.length === 0) {
        return { agentResponse: response.text() };
      }

      console.log(`[agent] Gemini requested ${calls.length} tool calls`);

      const toolResults = [];
      for (const call of calls) {
        console.log(`[agent] Calling tool: ${call.name}`, call.args);

        try {
          const output = await this.dispatchTool(call.name, call.args as Record<string, unknown>);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { result: output }
            }
          });
        } catch (error) {
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { error: String(error) }
            }
          });
        }
      }

      // Send results back to continue the loop
      result = await chat.sendMessage(toolResults);
    }
  }

  private async runOllama(instruction: string): Promise<{ agentResponse: string }> {
    if (!this.ollama) throw new Error('Ollama not initialized');

    console.log(`[agent] Running with local Ollama model: ${this.modelName}`);

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT + "\n\nAvailable tools:\n" + JSON.stringify(LEAD_FINDER_TOOLS, null, 2) + "\n\nIf you need to use a tool, return only a JSON object like: {\"tool\": \"tool_name\", \"args\": {...}}. Otherwise, return your text response." },
      { role: 'user', content: instruction }
    ];

    while (true) {
      const responseText = await this.ollama.chat(messages, { 
        model: this.modelName.replace('ollama/', ''),
        temperature: 0.2
      });

      // Try to parse tool call from response
      let toolCall = null;
      try {
        const potentialJson = responseText.match(/\{.*\}/s);
        if (potentialJson) {
          const parsed = JSON.parse(potentialJson[0]);
          if (parsed.tool && parsed.args) {
            toolCall = parsed;
          }
        }
      } catch (e) {
        // Not a tool call or malformed
      }

      if (!toolCall) {
        return { agentResponse: responseText };
      }

      console.log(`[agent] Ollama requested tool call: ${toolCall.tool}`, toolCall.args);
      messages.push({ role: 'assistant', content: responseText });

      try {
        const output = await this.dispatchTool(toolCall.tool, toolCall.args);
        messages.push({ role: 'user', content: `Tool result for ${toolCall.tool}: ${JSON.stringify(output)}` });
      } catch (error) {
        messages.push({ role: 'user', content: `Tool error for ${toolCall.tool}: ${String(error)}` });
      }
    }
  }

  private async dispatchTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case 'lead_finder_search': {
        console.log("[agent] Dispatching search with inputs:", input);
        const filters: Partial<SearchFilters> = {};
        if (typeof input['minRating'] === 'number') filters.minRating = input['minRating'];
        if (typeof input['minReviews'] === 'number') filters.minReviews = input['minReviews'];

        const result = await this.api.search({
          query: input['query'] as string,
          maxResults: (input['maxResults'] as number | undefined) ?? 50,
          filters,
          enrich: (input['enrich'] as boolean | undefined) ?? true,
        });

        return {
          summary: result.summary,
          leadsCount: result.leads.length,
          highQualityCount: result.highQuality.length,
        };
      }

      case 'lead_finder_enrich': {
        return this.api.enrich({
          batchSize: input['batchSize'] as number | undefined,
          limit: input['limit'] as number | undefined,
        });
      }

      case 'lead_finder_export': {
        const filters: Partial<SearchFilters> = {};
        if (typeof input['requireEmail'] === 'boolean') {
          filters.requireEmail = input['requireEmail'];
        }
        return this.api.export({
          filters,
          outputPath: (input['outputPath'] as string | undefined) ?? 'leads.csv',
          minLeadScore: (input['minLeadScore'] as number | undefined) ?? 0,
        });
      }

      case 'lead_finder_status': {
        return this.api.status(input['searchQuery'] as string | undefined);
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

// ─────────────────────────────────────────────
// Entry point for direct invocation
// ─────────────────────────────────────────────

if (process.argv[1]?.endsWith('agent.ts') || process.argv[1]?.endsWith('agent.js') || process.argv[1]?.endsWith('tsx')) {
  const instruction = process.argv[2] ?? 'Find manufacturing SMEs in Leicester, UK. Minimum 4 stars.';

  const agent = new LeadFinderAgent();
  agent
    .run(instruction)
    .then((result) => {
      console.log('\n[Lead Finder Agent]\n');
      console.log(result.agentResponse);
    })
    .catch(console.error);
}
