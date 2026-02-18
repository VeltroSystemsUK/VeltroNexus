# ARES Manifest Schema Update - Implementation Guide

## ✅ What's Been Done

### 1. TypeScript Interface Updated (`types.ts`)
The `AresTrainingManifest` interface has been completely restructured with:

**New Primary Structure:**
- `agent_metadata`: Version, timestamp, designation, role_id
- `identity_matrix`: Role function, hourly rate, authority level
- `tech_stack_mapping`: CRM, communication, scheduling, storage integrations
- `knowledge_dna`: Base ID, pricing logic, escalation path, capabilities, procedures, gaps

**Backwards Compatibility:**
- Old fields (ecosystemLayer, linguisticLayer, etc.) are now optional
- Existing code won't break, but new code should use the new structure

---

## ⚠️ What Needs Manual Update

Due to file access restrictions, TWO functions in `services/geminiService.ts` need manual replacement:

### Function 1: `trainAgentWithAres`
**Location:** Line ~304 in `geminiService.ts`
**Replacement:** Copy from `ARES_TRAINING_FUNCTION_UPDATE.ts`

**What it does:**
- Generates manifests in the new structure
- Fills real data from company DNA (no placeholders)
- Maps tools to tech_stack_mapping categories
- Identifies knowledge gaps automatically

---

### Function 2: ` aresDirectPatchKnowledgeGaps`
**Location:** Line ~462 in `geminiService.ts`
**Replacement:** Copy from `ARES_PATCHING_FUNCTION_UPDATE.ts`

**What it does:**
- Patches knowledge_dna.knowledge_gaps
- Adds missing capabilities and procedures
- Upgrades authority levels if needed
- Returns complete, deployment-ready manifest

---

## 🔧 Manual Steps Required

### Step 1: Open `services/geminiService.ts`

### Step 2: Find and Replace `trainAgentWithAres`
1. Search for `export const trainAgentWithAres`
2. Delete the ENTIRE function (from `export const` to the closing `};`)
3. Copy the function from `ARES_TRAINING_FUNCTION_UPDATE.ts`
4. Paste it in the same location

**Critical fixes this addresses:**
- ✅ Removes escaped backslashes (`\${variable}` → `${variable}`)
- ✅ Fixes template literal interpolation
- ✅ Adds explicit "NO PREAMBLE" instructions
- ✅ Uses new manifest structure

### Step 3: Find and Replace `aresDirectPatchKnowledgeGaps`
1. Search for `export const aresDirectPatchKnowledgeGaps`
2. Delete the ENTIRE function
3. Copy from `ARES_PATCHING_FUNCTION_UPDATE.ts`  
4. Paste it in the same location

### Step 4: Save and Test
```bash
npm run dev
```

The dev server should restart without errors.

---

## 🎯 Expected Behavior After Update

### Training Flow:
1. User uploads company data
2. Ares extracts real information:
   ```json
   {
     "agent_metadata": {
       "designation": "Maya",
       "role_id": "sales-closer",
       "version": "1.0.0-Ares",
       "timestamp": "2026-02-03T16:40:00Z"
     },
     "tech_stack_mapping": {
       "crm": {
         "provider": "HubSpot",
         "authorized_actions": ["Lead_Lookup", "Activity_Logging"],
         "api_status": "active"
       }
     },
     ...
   }
   ```

3. If gaps detected → Ares autonomously patches
4. Manifest is complete and deployment-ready

### No More Issues:
- ❌ "Okay, I understand..." preamble errors
- ❌ Escaped template variables
- ❌ Manual interview processes
- ✅ Clean JSON output
- ✅ Real data, no placeholders
- ✅ Autonomous gap filling

---

## 📋 Verification Checklist

After making changes:
- [ ] Dev server starts without errors
- [ ] Can initiate Ares training
- [ ] Gemini returns valid JSON (not conversational text)
- [ ] Manifest has agent_metadata, identity_matrix, tech_stack_mapping, knowledge_dna
- [ ] Gaps are patched autonomously (no interview needed)
- [ ] Deployment report generates successfully

---

## 🆘 Troubleshooting

**If you still get "Okay, I understand..." errors:**
- Check that template variables don't have backslashes: `${agentName}` not `\${agentName}`
- Verify the CRITICAL instruction is present in the prompt

**If TypeError about missing fields:**
- The new manifest structure is backwards compatible
- But ensure you're reading from `knowledge_dna` not old `ecosystemLayer`

**If rate limiting continues:**
- System will retry automatically with exponential backoff
- Wait 2-3 minutes between training attempts
- Consider upgrading to paid Gemini API key

---

## 📚 New Manifest Schema Reference

```typescript
{
  agent_metadata: {
    designation: "Agent Name",
    role_id: "kebab-case-role",
    version: "1.0.0-Ares",
    timestamp: "ISO 8601"
  },
  identity_matrix: {
    role_function: "What the agent does",
    hourly_rate: "$XX.XX",
    authority_level: "Tier_1_Information_Scheduling" | "Tier_2_Transaction_Authority" | "Tier_3_Master_Admin"
  },
  tech_stack_mapping: {
    crm?: { provider, authorized_actions[], api_status },
    communication?: { provider, channel_id, alert_protocol },
    scheduling?: { provider, booking_link, buffer_time_minutes },
    storage?: { provider, access_level }
  },
  knowledge_dna: {
    base_id: "company-identifier",
    pricing_logic: "How pricing works",
    escalation_path: "contact@email.com",
    capabilities: ["What agent can do"],
    procedures: [{ process, steps[] }],
    knowledge_gaps?: ["What's missing"]
  }
}
```

---

**Ready to deploy once these manual updates are complete!** 🚀
