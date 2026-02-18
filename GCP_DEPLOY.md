# Deploying to Google Cloud Run

This guide explains how to deploy the Veltro application to Google Cloud Platform (GCP) using **Cloud Run** and **Firestore**.

## Prerequisites

1. **Google Cloud Project**: Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. **Billing Enabled**: Ensure billing is enabled for your project.
3. **gcloud CLI**: Install and initialize the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

## 1. Database Setup (Firestore)

Veltro uses **Google Cloud Firestore** (Native Mode) for its database.

1. Go to **Firestore** in the Google Cloud Console.
2. Click **Create Database**.
3. Select **Native Mode**.
4. Name the database: **`veltrodb`** (Important: The app expects this specific name).
5. Select a location (e.g., `europe-west2` for London).
6. Click **Create**.

## 2. Secret Management

Securely store your API keys using **Secret Manager**.

1. Go to **Secret Manager** in the Google Cloud Console.
2. Create the following secrets (names must match exactly):

    * `GEMINI_API_KEY`
    * `EXA_API_KEY`
    * `APOLLO_API_KEY`
    * `COMPANIES_HOUSE_API_KEY`
    * `SESSION_SECRET` (A long random string for session cookies)

## 3. Deployment

We use **Cloud Build** to build the container and deploy it to Cloud Run.

### Step 1: Submit Build & Deploy

Run the following command in your terminal:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

This command will:

1. Build the Docker image.
2. Push it to the Artifact Registry.
3. Deploy the service to Cloud Run.
4. Mount the secrets automatically as environment variables (configured in `cloudbuild.yaml`).

### Step 2: Verify Deployment

After the build completes, Cloud Run will provide a URL (e.g., `https://veltro-app-xyz.a.run.app`).

1. Visit the URL.
2. Check the logs in the GCP Console to ensure the application connected to Firestore successfully (`[Firebase] Firestore (veltrodb) and Auth initialized successfully`).

## Troubleshooting

* **Build Fails**: Check local `npm run build` works first.
* **Database Connection**: Ensure the Cloud Run service account has **Cloud Datastore User** role.
* **"Initializing..." Hangs**: Verify `GEMINI_API_KEY` is correct in Secret Manager.
