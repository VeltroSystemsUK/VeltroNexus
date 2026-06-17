/**
 * strategyAgent.ts
 * Stage 2 Agent: Strategic Outreach & CFO Analysis
 * Uses local Ollama to draft personalized refinancing strategies.
 */

import { Ollama } from './ollama.js';
import { Business } from './models/business.js';
import { getHighQualityLeadsForStrategy, upsertBusiness } from './database/db.js';

export interface StrategyResult {
    analysis: string;
    email: string;
}

export class StrategyAgent {
    private ollama: Ollama;
    private model: string;

    constructor(model = process.env['DEFAULT_MODEL'] || 'ollama/llama3') {
        this.ollama = new Ollama();
        this.model = model.replace('ollama/', '');
    }

    /**
     * Process a batch of leads
     */
    async processLeads(limit = 10): Promise<number> {
        const leads = getHighQualityLeadsForStrategy(limit);
        
        if (leads.length === 0) {
            console.log('[strategy] No new high-quality leads found for analysis.');
            return 0;
        }

        console.log(`[strategy] Analyzing ${leads.length} leads using ${this.model}...`);
        
        let processed = 0;
        for (const lead of leads) {
            try {
                const result = await this.analyzeLead(lead);
                
                lead.strategyAnalysis = result.analysis;
                lead.strategyEmail = result.email;
                
                upsertBusiness(lead);
                processed++;
                console.log(`   ✓ Strategy generated for: ${lead.name}`);
            } catch (error) {
                console.error(`   ✗ Failed to analyze ${lead.name}:`, error instanceof Error ? error.message : error);
            }
        }

        return processed;
    }

    /**
     * Run analysis for a single business
     */
    private async analyzeLead(business: Business): Promise<StrategyResult> {
        const systemPrompt = `You are The Capital Strategist, a Fractional CFO specializing in UK business refinancing.
- You are NOT a broker - you are a peer-to-peer capital advisor.
- Your goal: replace high-interest short-term debt with predictable 5-year facilities.
- communication style: peer-to-peer, data-driven, empathetic but candid.`;

        const userPrompt = `I have found a high-quality lead for a UK business. Analyze them and draft an outreach email.

BUSINESS DATA:
- Name: ${business.name}
- Industry: ${business.searchQuery}
- Location: ${business.address}
- Website: ${business.website || 'N/A'}
- Reviews: ${business.rating} stars (${business.reviewCount} reviews)
- Companies House: ${business.companyNumber ? `Registered (#${business.companyNumber})` : 'Not linked'}
- Lenders: ${business.lenderNames?.length ? business.lenderNames.join(', ') : 'Unknown'}

TASK:
1. Short Analysis: Explain the "Cash Flow Gap" opportunity for this business in 2026. (3-4 sentences)
2. Outreach Email: Draft a peer-to-peer outreach email from a Fractional CFO perspective. Use real numbers if possible.

Return your response in this JSON format:
{
  "analysis": "...",
  "email": "..."
}`;

        const response = await this.ollama.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            { model: this.model, format: 'json' }
        );
        
        try {
            // Extract JSON from response
            const jsonStart = response.indexOf('{');
            const jsonEnd = response.lastIndexOf('}') + 1;
            const jsonStr = response.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonStr);
        } catch {
            // Fallback for non-JSON responses
            return {
                analysis: "Manual review required. AI response was not in expected format.",
                email: response
            };
        }
    }
}
