# Quick Fix Instructions for geminiService.ts

## IMMEDIATE ACTION REQUIRED

Open `services/geminiService.ts` and make these exact changes:

---

## Fix #1: Line 314-315 (Remove Backslashes)

**FIND THIS (lines 314-315):**
```typescript
        TARGET AGENT: \${agentName} (\${role})
        CLIENT DNA: \${JSON.stringify(companyDNA)}
```

**REPLACE WITH:**
```typescript
        TARGET AGENT: ${agentName} (${role})
        COMPANY DATA: ${JSON.stringify(companyDNA)}
```

---

## Fix #2: Line 324 (Fix Malformed Newline)

**FIND THIS (line 324):**
```typescript
        Return ONLY valid JSON following the AresTrainingManifest interface. NO PREAMBLE. NO CONVERSATIONAL FILLER. NO MARKDOWN.`n        `n        CRITICAL: Your response must START with { and END with }. No text before or after.
```

**REPLACE WITH:**
```typescript
        Return ONLY valid JSON following the AresTrainingManifest interface.
        
        CRITICAL INSTRUCTION: Your response MUST start with { and end with }. 
        NO conversational text. NO preamble. NO markdown blocks. NO explanations.
        ONLY pure JSON matching the structure shown below.
```

---

## Fix #3: Lines 325-332 (Update to New Schema)

**FIND THIS (lines 325-332):**
```typescript
        {
          "ecosystemLayer": { "softwareSystems": [], "logicFlow": "" },
          "linguisticLayer": { "brandTone": "", "uvp": "", "jargon": [] },
          "workflowLayer": { "procedures": [{ "process": "", "steps": [] }] },
          "edgeCaseLayer": { "knowledgeGaps": [] },
          "firstPrinciples": ["Specific core beliefs/constraints"],
          "systemMastery": "Consolidated high-level directive for the agent"
        }
```

**REPLACE WITH:**
```typescript
        {
          "agent_metadata": {
            "designation": "${agentName}",
            "role_id": "role-slug",
            "version": "1.0.0-Ares",
            "timestamp": "ISO-8601-timestamp"
          },
          "identity_matrix": {
            "role_function": "Role description",
            "hourly_rate": "$XX.XX",
            "authority_level": "Tier_1_Information_Scheduling"
          },
          "tech_stack_mapping": {
            "crm": { "provider": "CRM-name", "authorized_actions": [], "api_status": "active" }
          },
          "knowledge_dna": {
            "base_id": "company-id",
            "pricing_logic": "Pricing explanation",
            "escalation_path": "contact-email",
            "capabilities": [],
            "procedures": [],
            "knowledge_gaps": []
          }
        }
```

---

## Fix #4: Lines 317-321 (Update Instructions)

**FIND THIS (lines 317-321):**
```typescript
        INSTRUCTIONS (THE KNOWLEDGE ENCODING PROTOCOL):
        1. Ecosystem Layer: Identify every software system mentioned (CRMs, ERPs, Communication tools). Map the "Logic Flow" of how data moves between them.
        2. Linguistic Layer: Analyze the "Brand Tone" and "Brochure" data to extract specific industry jargon and the company's "Unique Value Proposition" (UVP).
        3. Workflow Layer: Deconstruct the "Core Products & Services" into step-by-step procedures. If a customer asks for X, the agent must know the exact internal process for Y.
        4. Edge-Case Layer: Anticipate where the "Brochure" data is thin. If the user hasn't specified a price for a certain service, you must flag this as a "Missing Knowledge Variable."
```

**REPLACE WITH:**
```typescript
        ARES DIRECTIVE:
        Analyze the company data and extract:
        1. Agent metadata: Name, slugified role ID, version "1.0.0-Ares", current ISO timestamp
        2. Identity matrix: Detailed role function, market hourly rate, authority tier
        3. Tech stack: Map mentioned tools to categories (crm, communication, scheduling, storage)
        4. Knowledge DNA: Company identifier, pricing logic, escalation contact, capabilities list
        5. Procedures: Step-by-step workflows for core services
        6. Knowledge gaps: List anything missing (prices, contacts, procedures, etc.)
        
        CRITICAL: Use REAL data from the company input. Do NOT use placeholder variables.
```

---

## After Making Changes

Save the file and restart the dev server:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

You should see NO errors about escaped characters or template variables.

---

## Quick Test

After fixing, try training an agent in the Agent Forge. You should see:
- ✅ No more "Okay, I understand..." errors
- ✅ Valid JSON with agent_metadata, identity_matrix, etc.
- ✅ Real data instead of {{placeholders}}

If it still fails, check the console for the actual Gemini response and verify all backslashes are removed.
