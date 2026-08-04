# Deployment

This document previously described deploying to Google Cloud Run + Firestore. That is **not** how this app is run and should not be revisited — there is a firm decision against any Google Cloud Platform usage for this project.

Nexus runs on a local machine only, with its SQLite database (`better-sqlite3`) stored locally. There is no cloud hosting requirement. See `README.md` for the real setup (`npm install`, configure `.env.local`, `npm run dev` for development or `npm run build && npm start` for a local production run).
