# 🚀 Pagenti Deployment Guide - Vercel

## Quick Deploy (5 Minutes)

### Prerequisites
- [ ] GitHub account
- [ ] Vercel account (sign up at vercel.com with GitHub)
- [ ] Your `VITE_GOOGLE_API_KEY` environment variable

---

## Step-by-Step Deployment

### 1. Push to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/pagenti.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your `pagenti` repository
4. Vercel will auto-detect the Vite configuration
5. **Important:** Add Environment Variable:
   - Key: `VITE_GOOGLE_API_KEY`
   - Value: Your Gemini API key
6. Click "Deploy"
7. ✅ Done! Your site will be live in ~2 minutes

**Option B: Via Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts, it will:
# - Link to your Vercel account
# - Create a new project
# - Deploy automatically

# Add environment variable
vercel env add VITE_GOOGLE_API_KEY

# Redeploy with env
vercel --prod
```

---

## Post-Deployment Checklist

### ✅ Verify Everything Works
- [ ] Frontend loads at your-app.vercel.app
- [ ] Navigation works (Browse, ARES Controls)
- [ ] ARES Chat responds (test: "Hello ARES")
- [ ] Agent browsing displays correctly
- [ ] Theme changes work via ARES Uplink

### ⚠️ Known Limitations (Without Backend)
- **Voice Features**: TTS server runs locally only (not deployed yet)
- **Data Persistence**: Agent creations saved to localStorage (browser-specific)
- **Authentication**: Currently using mock auth

---

## Environment Variables Required

Add these in Vercel Dashboard → Project Settings → Environment Variables:

```env
VITE_GOOGLE_API_KEY=your_gemini_api_key_here
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

**Optional (if you add backend later):**
```env
VITE_API_URL=https://your-backend.railway.app
```

---

## Custom Domain (Optional)

In Vercel Dashboard:
1. Go to Project Settings → Domains
2. Add your custom domain (e.g., pagenti.com)
3. Update DNS records as instructed
4. SSL certificate auto-generated

---

## Continuous Deployment

✨ **Automatic!** Every push to `main` branch will trigger a new deployment.

To deploy a different branch:
- Push to a new branch → Vercel creates a preview URL
- Preview: `your-app-git-branch-name.vercel.app`

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify `npm run build` works locally

### API Key Not Working
- Ensure environment variable is named `VITE_GOOGLE_API_KEY` (with VITE_ prefix)
- Redeploy after adding env vars

### 404 on Routes
- `vercel.json` handles this with rewrite rules
- If still issues, check that `dist/index.html` exists after build

---

## Next Steps (Backend Migration)

When ready to add Railway for backend:
1. Create `server/index.js` with Express
2. Deploy to Railway
3. Update `VITE_API_URL` in Vercel
4. Migrate localStorage to API calls

---

## Monitoring & Analytics

**Vercel provides:**
- Real-time logs
- Performance metrics
- Error tracking
- Bandwidth usage

Access via: Dashboard → Your Project → Analytics

---

## Support

- Vercel Docs: https://vercel.com/docs
- Deploy Issues: Check Vercel Dashboard → Deployments → Build Logs
- This project uses Vite + React + Tailwind CDN
