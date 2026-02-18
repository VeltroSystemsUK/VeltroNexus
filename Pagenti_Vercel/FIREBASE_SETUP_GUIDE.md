# 🔥 Firebase Setup Guide

To enable shared persistence (so everyone sees the same data), you need to connect Pagenti to Firebase.

## 1. Create a Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com/).
2. Click **Create a project**.
3. Name it `pagenti` (or similar).
4. Disable Google Analytics (optional, makes setup faster).
5. Click **Create Project**.

## 2. Create the Database
1. In the left sidebar, click **Build** -> **Firestore Database**.
2. Click **Create database**.
3. **Location:** Choose strictly `nam5` (us-central) or `eur3` (europe-west) depending on where you are.
4. **Security Rules:** Select **Start in test mode** (Upgrade securely later).
5. Click **Create**.

## 3. Get Your API Keys
1. Click the **Gear Icon** (Project Settings) at the top left.
2. Scroll down to the "Your apps" section.
3. Click the `</>` (Web) icon.
4. App nickname: `pagenti-web`.
5. Click **Register app**.
6. You will see a `const firebaseConfig = { ... }` block. Keep this tab open.

## 4. Connect to Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select your `pagenti` project.
3. Go to **Settings** -> **Environment Variables**.
4. Add the following keys (copy values from the Firebase Config user step 3):

| Key | Value Source |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

5. **Redeploy** your app (Go to Deployments -> Redeploy) for changes to take effect.

## ✅ Done!
Your app will now sync Agents and Directives to the cloud!
