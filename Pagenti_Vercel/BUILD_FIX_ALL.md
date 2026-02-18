# BUILD FIX GUIDE - Complete Steps

## Current Build Errors:

1. ❌ `extractCompanyDNA` is not exported
2. ⚠️ `generateDeploymentReport` returns wrong structure (lint warning)

---

## FIX #1: Add extractCompanyDNA Function

**File:** `services/geminiService.ts`
**Location:** End of file (after line 571)
**Source:** See `ADD_EXTRACT_COMPANY_DNA.ts`

**Steps:**
1. Open `services/geminiService.ts`
2. Scroll to the end (line 571)
3. Copy the entire function from `ADD_EXTRACT_COMPANY_DNA.ts`
4. Paste it at the end of the file

---

## FIX #2: Fix generateDeploymentReport

**File:** `services/geminiService.ts`
**Location:** Lines 517-571
**Source:** See `FIXED_DEPLOYMENT_REPORT_FUNCTION.ts`

**Current Problem:**
Function returns:
```typescript
{
  status: "CONDITIONAL",  // ❌ Wrong field
  readinessScore: 75,     // ❌ Wrong field
  ...
}
```

**Should Return:**
```typescript
{
  executiveSummary: "string",     // ✅ Correct
  masteredDomains: [...],          // ✅ Correct
  guardrailManifesto: [...],       // ✅ Correct
  ...
}
```

**Steps:**
1. Open `services/geminiService.ts`
2. Find `generateDeploymentReport` function (line ~517)
3. Delete the entire function
4. Copy replacement from `FIXED_DEPLOYMENT_REPORT_FUNCTION.ts`
5. Paste in the same location

---

## FIX #3: Add ARES Architect Route

**File:** `App.tsx`
**Location:** After line 94 (after `/architect` route)
**Source:** See `ADD_ARES_ROUTE.txt`

**Steps:**
1. Open `App.tsx`
2. Find the `/architect` route (line ~90-94)
3. Add this route right after it:

```tsx
<Route path="/ares-architect" element={
  <ProtectedRoute roles={['ADMIN']}>
    <AresArchitectView />
  </ProtectedRoute>
} />
```

---

## After Fixing - Run Build:

```bash
npm run build
```

### Expected Result:
```
✓ 2406 modules transformed
✓ Build successful
```

---

## Test the Dashboard:

1. Make sure fixes are applied
2. Build completes successfully  
3. Navigate to: `http://localhost:5173/#/ares-architect`
4. Log in as ADMIN
5. You should see the ARES Architect Dashboard!

---

## Quick Checklist:

- [ ] Add `extractCompanyDNA` to geminiService.ts
- [ ] Replace `generateDeploymentReport` function
- [ ] Add `/ares-architect` route to App.tsx
- [ ] Run `npm run build`
- [ ] Build succeeds ✓
- [ ] Test dashboard at `/ares-architect`

---

## Files Reference:

| Fix | File to Edit | Reference File |
|-----|--------------|----------------|
| extractCompanyDNA | geminiService.ts | ADD_EXTRACT_COMPANY_DNA.ts |
| generateDeploymentReport | geminiService.ts | FIXED_DEPLOYMENT_REPORT_FUNCTION.ts |
| Route | App.tsx | ADD_ARES_ROUTE.txt |

---

**Estimated Time:** 5 minutes

**Once complete, ARES Self-Healing Infrastructure will be fully operational!** 🚀
