---
description: Agentic workflow for enriching lender data with AI-powered research
---

# Data Enrichment Workflow

Run from the **Workforce** page to enrich lender data using AI agents with specialized research capabilities.

## Quick Start from Workforce UI

### Step 1: Navigate to Workforce
Go to the **Workforce** page where all your AI agents are listed.

### Step 2: Select an Enrichment Agent
Choose an agent with enrichment capabilities (any agent can access the enrichment tools).

### Step 3: Give Natural Language Instructions

**Example commands to try:**

```
"Find all lenders that are missing contact information"
```

```
"Research basic information for Metro Bank Finance"
```

```  
"Enrich the lending criteria for Shawbrook Bank"
```

```
"Find BDM contact details for Octopus Property"
```

The agent will automatically use the appropriate tools and track progress in real-time.

## Prerequisites

- Active lender record (or prospect name/website)
- User authentication
- Google Cloud credentials configured (`gcloud auth application-default login`)
- Environment variables set:
  - `TAVILY_API_KEY` - For web research
  - `GEMINI_API_KEY` - For AI analysis
  - `GOOGLE_CLOUD_PROJECT` - Firebase project ID

## How It Works

When you give enrichment instructions to an agent in Workforce, the agent automatically:

1. **Detects Intent** - Understands you want to enrich lender data
2. **Selects Tools** - Chooses appropriate tools from:
   - `listLendersNeedingEnrichment` - Find lenders with missing data
   - `getLenderDetails` - Get current lender information
   - `researchLenderData` - Research using Tavily + Exa
   - `updateLenderRecord` - Apply enrichment updates
3. **Creates Job** - Tracks progress in Workforce UI
4. **Executes Research** - Gathers data from multiple sources
5. **Returns Results** - Provides findings for your review

## Enrichment Modules

The system supports four specialized enrichment modules:

### 1. **Basic Info** (`basic`)
- Institution name verification
- Lender classification (bank, specialist, etc.)
- Product types offered
- Market focus

**Example:** *"Research basic information for Metro Bank Finance"*

---

### 2. **Lending Criteria** (`criteria`)
- Loan amount ranges (min/max)
- LTV ranges
- Interest rates
- Turnaround times
- Geographic coverage
- Sector appetite

**Example:** *"Find lending criteria for Shawbrook Bank"*

---

### 3. **Contacts** (`contacts`)
- BDM names and emails
- Phone numbers
- LinkedIn profiles
- Application portal URLs

**Example:** *"Get BDM contact details for Octopus Property"*

---

### 4. **Strategic Insights** (`notes`)
- Key strengths and weaknesses
- Lending policy highlights
- Market positioning
- Broker tips

**Example:** *"Give me strategic insights on United Trust Bank"*

## Automated Workflow (Agent-Triggered)

// turbo-all

**API Endpoint:**
```http
POST /api/lenders/:lenderId/enrich/:module
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Optional override name",
  "website": "Optional override website"
}
```

**Example using fetch:**
```typescript
const response = await fetch(`/api/lenders/${lenderId}/enrich/basic`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: lender.institutionName,
    website: lender.website
  })
});

const enrichedData = await response.json();
```

### 4. Review Proposed Updates

The enrichment service operates under **Managed Autonomy** - it returns proposed updates for human review:

```typescript
// Example enrichedData response for 'basic' module
{
  "institutionName": "Example Finance Ltd",
  "lenderType": "specialist_lender",
  "productTypes": ["Bridging Finance", "Development Finance", "Asset Finance"]
}
```

### 5. Apply or Reject Updates

**Review the data carefully before applying:**

```typescript
// If approved, update the lender
await fetch(`/api/lenders/${lenderId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(enrichedData)
});
```

**If rejected, discard and try again or manually edit.**

### 6. Progress Through Modules

Follow this recommended sequence:

```
Basic Info → Lending Criteria → Contacts → Strategic Insights
```

Each module builds context for the next, improving AI accuracy.

## Module Details

### Basic Info Module (`basic`)

**What it researches:**
- Institution name verification
- Lender classification (bank, specialist, etc.)
- Product types offered
- Primary market focus

**Use when:**
- Adding a new lender
- Verifying existing classification
- Need quick overview

**Typical research sources:**
- Company website
- Industry directories
- News articles

---

### Lending Criteria Module (`criteria`)

**What it researches:**
- Minimum/maximum loan amounts
- LTV ranges
- Interest rate ranges
- Turnaround time
- Geographic coverage
- Sector appetite

**Use when:**
- Matching deals to lenders
- Updating pricing information
- Assessing lender appetite

**Typical research sources:**
- Product pages
- Rate sheets
- Broker portals

---

### Contacts Module (`contacts`)

**What it researches:**
- BDM names and contact details
- Email addresses
- Phone numbers
- LinkedIn profiles
- Application portal URLs

**Use when:**
- Need to contact lender
- Building broker relationships
- Updating stale contacts

**Typical research sources:**
- LinkedIn
- Company contact pages
- Broker resources

---

### Strategic Insights Module (`notes`)

**What it researches:**
- Key strengths
- Key weaknesses
- Lending policy highlights
- Strategic positioning
- Broker-relevant insights

**Use when:**
- Need qualitative analysis
- Preparing pitch to lender
- Understanding lender strategy

**Typical research sources:**
- Industry analysis
- Lender publications
- Market commentary

## Agent Job Tracking

All enrichment operations create tracked jobs visible in the Workforce UI:

```typescript
// Jobs are automatically created with metadata
{
  "id": "uuid",
  "agentId": "lender-enrichment-agent",
  "userId": "user123",
  "type": "data_enrichment",
  "status": "running" | "completed" | "failed",
  "title": "Enriching Example Finance Ltd - Basic Info",
  "progress": {
    "currentStep": "Analyzing research results...",
    "completedSteps": 2,
    "totalSteps": 4
  }
}
```

**View jobs:**
- Navigate to Workforce page in UI
- Check "Running Jobs" section
- Review completed jobs in history

## Best Practices

### 1. Start with Basic ✅
Always enrich basic info first - it provides context for other modules.

### 2. Review Before Applying ⚠️
Never blindly apply AI-generated data. Always review for accuracy.

### 3. Use Context Override 💡
If the lender's website or name has changed, override in the request:
```typescript
{
  "name": "Updated Legal Name",
  "website": "https://newsite.com"
}
```

### 4. Sequential Enrichment 📈
Run modules in sequence rather than parallel for better results.

### 5. Handle Failures Gracefully ❌
If enrichment fails:
- Check server logs for errors
- Verify API keys are valid
- Ensure target website is accessible
- Try again with different module

## Troubleshooting

### "Failed to fetch enrichment data"

**Cause:** Tavily API error or network issue

**Solution:**
1. Check `TAVILY_API_KEY` in `.env`
2. Verify internet connectivity
3. Check Tavily API quota

### "AI analysis failed"

**Cause:** Gemini API error or malformed response

**Solution:**
1. Check `GEMINI_API_KEY` in `.env`
2. Review server logs for specific error
3. Retry the enrichment

### "No data found for lender"

**Cause:** Lender website offline or no public information

**Solution:**
1. Verify website URL is correct
2. Try manual research
3. Use alternative sources

## Future Enhancements

- [ ] Bulk enrichment for multiple lenders
- [ ] Scheduled re-enrichment for data freshness
- [ ] Confidence scores for AI-generated data
- [ ] Source citation tracking
- [ ] Auto-approval for high-confidence updates
