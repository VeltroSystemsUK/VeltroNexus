# 🚀 Pagenti Production Configuration Report
**Generated:** 2026-02-04

## 🌍 Live URL
**https://pagenti.com**

## 🔑 Infrastructure Keys
The following keys are now configured in your Vercel Dashboard:

| Service | Environment Variable | Usage |
| :--- | :--- | :--- |
| **Google Gemini** | `VITE_GOOGLE_API_KEY` | Artificial Intelligence (Agent Brain) |
| **ElevenLabs** | `VITE_ELEVENLABS_API_KEY` | Text-to-Speech (Agent Voice) |
| **Firebase** | `VITE_FIREBASE_API_KEY` | Database (Agent Persistence) |

## 🛠️ Deployment Command
To update the live site in the future, run this command from your terminal:

```powershell
# 1. Bypass OneDrive Locks
# 2. Deploy to Vercel
cd C:\Users\Shaun\OneDrive\Desktop\Pagenti
Remove-Item -Recurse -Force C:\Pagenti_Vercel -ErrorAction SilentlyContinue
mkdir C:\Pagenti_Vercel
robocopy . C:\Pagenti_Vercel /xd node_modules .git .venv dist server /E
cd C:\Pagenti_Vercel
npx vercel --prod
```

## 📝 Maintenance
- **Directives:** Check `Firestore -> directives_logs` to see user commands.
- **Agents:** Check `Firestore -> agents` to verify created agents.
