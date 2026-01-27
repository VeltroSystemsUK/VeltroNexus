# Veltro Authentication Diagnostic & Fix Tools

These tools help diagnose and fix authentication issues in your Veltro application.

## Quick Start

### 1. Run Diagnostics

First, check what's wrong:

```bash
node diagnose-auth.js
```

This will check:
- Node.js version compatibility
- Environment file configuration
- Google Cloud credentials setup
- Firebase configuration
- Session settings
- Required npm packages

### 2. Run Auto-Fix

Then fix common issues automatically:

```bash
node fix-auth.js
```

This interactive tool will:
- Create/update your `.env` file
- Setup Firebase credentials
- Fix session configuration issues
- Add helpful npm scripts

## Common Issues & Solutions

### Issue: "invalid_grant" or "reauth related error"

**Problem:** Your Google Cloud credentials are invalid or expired.

**Solutions:**

#### Option A: Use Service Account Key (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save the JSON file as `serviceAccountKey.json` in your project root
5. Add to `.env`:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
   ```

#### Option B: Use gcloud CLI
```bash
# Install gcloud CLI first: https://cloud.google.com/sdk/docs/install
gcloud auth application-default login
```

#### Option C: Use Environment Variables
Add to `.env`:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Issue: Session ID keeps changing

**Problem:** Session cookies aren't being set/read properly.

**Solution:**

In `server/auth.ts`, ensure cookie settings are correct:

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // NOT hardcoded true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax", // Important for CSRF protection
  },
  store: sessionStore,
}));
```

### Issue: Missing SESSION_SECRET

**Problem:** No session secret configured.

**Solution:**

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
SESSION_SECRET=<generated-secret>
```

## Manual Setup Guide

If you prefer manual setup:

### 1. Create `.env` file

```env
# Server
NODE_ENV=development
PORT=5000

# Session (REQUIRED)
SESSION_SECRET=<generate-with-crypto>

# Google Cloud / Firebase (REQUIRED - Choose one method)

# Method A: Service Account File
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Method B: Environment Variables
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=your-sa@project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Companies House API
# COMPANIES_HOUSE_API_KEY=your-api-key

# Optional: Email
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASS=your-app-password

# Optional: Stripe
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Add to `.gitignore`

```
# Environment
.env
.env.local

# Firebase
serviceAccountKey.json
firebase-credentials.json

# Session stores
sessions/
*.db
```

### 3. Verify Configuration

```bash
node diagnose-auth.js
```

### 4. Start Development

```bash
npm run dev
```

## Troubleshooting

### Still getting authentication errors?

1. **Check your Firebase project settings:**
   - Ensure Firestore is enabled
   - Verify service account has correct permissions

2. **Verify your credentials file:**
   ```bash
   cat serviceAccountKey.json | python -m json.tool
   ```
   Should show valid JSON with `type: "service_account"`

3. **Check Node.js version:**
   ```bash
   node --version  # Should be >= 18
   ```

4. **Clear old sessions:**
   ```bash
   rm -rf sessions/
   rm -rf dist/
   npm run dev:clean
   ```

5. **Check firewall/antivirus:**
   - May block Google Cloud API requests
   - Temporarily disable to test

### Getting CORS errors?

Add to your server configuration:
```typescript
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
```

### Session not persisting?

Check browser developer tools:
- Application/Storage → Cookies
- Should see `__session` cookie
- Check `Secure` flag matches your environment

## Environment-Specific Settings

### Development
```env
NODE_ENV=development
# Cookie secure should be false
```

### Production
```env
NODE_ENV=production
# Cookie secure should be true
# Use HTTPS
```

## Getting Help

If these tools don't resolve your issue:

1. Run diagnostics and save output:
   ```bash
   node diagnose-auth.js > diagnostic-report.txt
   ```

2. Check server logs for specific errors

3. Review [Firebase Admin SDK docs](https://firebase.google.com/docs/admin/setup)

4. Check [Express Session docs](https://github.com/expressjs/session)

## Security Notes

⚠️ **Never commit these files:**
- `.env`
- `serviceAccountKey.json`
- Any file containing credentials

✅ **Always:**
- Use `.gitignore` to exclude sensitive files
- Use strong, random SESSION_SECRET (32+ characters)
- Use HTTPS in production
- Rotate credentials periodically
