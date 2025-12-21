# Technical Debt Tracker

This document tracks known technical debt that should be addressed over time.

## TypeScript Strict Type Errors

**Priority: Medium**
**Status: Open**
**Created: December 2025**

### Issue Summary
There are approximately 133 TypeScript type errors when running `npm run check` (strict `tsc`). These don't prevent the application from building or running, but represent type-safety gaps. The count is tracked in `.ts-error-baseline` and CI will fail if errors increase.

### Key Problem Areas

1. **shared/schema.ts (20+ errors)**
   - `createInsertSchema().omit()` generates "Type 'boolean' is not assignable to type 'never'" errors
   - This appears to be a type inference issue with drizzle-zod generics
   - Workaround: Consider using type assertions or explicit schema definitions

2. **client/src/pages/Lenders.tsx (100+ errors)**
   - react-hook-form resolver type inference issues
   - `useForm` with `zodResolver` has complex generic type mismatches
   - Workaround: Add explicit type parameters to `useForm<FormType>()`

3. **client/src/pages/Leads.tsx**
   - API response type not properly typed
   - Fixed: Added type assertion for `prospect` response

4. **client/src/components/DueDiligenceTools.tsx**
   - `null` vs `undefined` type mismatches for optional number fields
   - Fixed: Changed `null` to `undefined` to match schema expectations

### Recommended Actions

1. Gradually fix type errors file by file
2. Start with highest-impact files (Lenders.tsx)
3. Consider updating drizzle-zod or using different patterns for schema generation
4. Add explicit type annotations where inference fails

### CI Behavior

The CI currently uses a lenient TypeScript check that warns about errors but doesn't fail the build. This allows development to continue while type issues are addressed.

To see all type errors:
```bash
npm run check
```
