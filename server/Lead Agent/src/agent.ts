/**
 * agent.ts
 * Lead Finder Agent — Gemini reasoning layer over LeadFinderAPI.
 *
 * Handles: ambiguous instructions, search widening decisions,
 * tool sequencing, Strategy Agent reporting.
 *
 * Usage:
 *   const agent = new LeadFinderAgent();
 *   const result = await agent.run("Find manufacturing SMEs in Leicester");
 */

import 'dotenv/config';
import { GoogleGenerativeAI, Tool, FunctionDeclarationSchemaType } from '@google/generative-ai';
import { LeadFinderAPI, LEAD_FINDER_TOOLS } from './api.js';
import { SearchFilters } from './models/business.js';
import { Ollama } from './ollama.js';

const BROKER_QUERY_RE =
  /\b(nacfb|fiba|loan packagers?|finance brokers?|commercial finance brokers?|broker lists?|introducer networks?|independent brokers?)\b/i;

const SYSTEM_PROMPT = `You are the Lead Finder Agent for Strata Finance origination inside Nexus.

Your sole responsibility is discovering and enriching UK leads from Google Maps for TWO streams only:

STREAM A — Direct UK SME directors: trading companies (18+ months) likely carrying high-cost debt, merchant cash advances, or HMRC arrears. Typical niches: manufacturing, construction trades, hospitality, wholesale, haulage, engineering. Turnover roughly £250k–£5m.
STREAM B — Professional introducers: chartered accountancy practices (ICAEW/ACCA), fractional CFOs, turnaround / insolvency advisers. Never pitch a loan to the practice itself.

CHANNEL EXCLUSION (HARD):
- Commercial finance brokers, NACFB/FIBA members, independent loan packagers, and broker lists are STRICTLY forbidden.
- If Shaun asks for brokers, refuse and offer Stream A or Stream B instead.
- Do not ingest or persist broker-looking results.

BEHAVIOUR RULES:
1. Parse niche and location from the instruction clearly. If either is ambiguous, ask once for clarification before proceeding.
2. Apply sensible defaults unless explicitly overridden:
   - minRating: 4.0
   - minReviews: 5
   - operationalOnly: true
   - enrich: true (find emails immediately)
3. If a search returns fewer than 20 results, widen the search radius and retry once (e.g. add "or surrounding areas" to query).
4. After every search, call lead_finder_status to confirm results were persisted.
5. Report a concise structured summary at the end of every run.

STRICT BOUNDARIES — you NEVER:
- Contact leads or draft outreach messages
- Search for or store commercial finance brokers
- Run multiple large searches autonomously without instruction
- Store or transmit data outside the local database

OUTPUT FORMAT:
After every completed run, return this JSON summary block:
{
  "status": "complete",
  "searchQuery": "...",
  "totalScraped": N,
  "highQualityLeads": N,
  "emailsFound": N,
  "pecrEligible": N,
  "recommendation": "...",
  "readyFor": "Strategy Agent"
}

You report to the Strategy Agent. Shaun triggers you manually.`;

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
   * @param instruction - e.g. "Find manufacturing SMEs in Leicester, minimum 4 stars"
   * @returns Final structured summary for Strategy Agent
   */
  async run(instruction: string): Promise<{ agentResponse: string }> {
    if (BROKER_QUERY_RE.test(instruction)) {
      return {
        agentResponse: JSON.stringify({
          status: "blocked",
          searchQuery: instruction,
          totalScraped: 0,
          highQualityLeads: 0,
          emailsFound: 0,
          pecrEligible: 0,
          recommendation:
            "Refused: commercial finance brokers, NACFB/FIBA members, and loan packagers are excluded from Strata origination. Search Stream A (UK SME directors with high-cost debt / HMRC pressure) or Stream B (accountants, fractional CFOs, turnaround advisers) instead.",
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
