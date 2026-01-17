# Deploying to Google Cloud

This guide explains how to deploy the Veltro application to Google Cloud Platform (GCP) using **Cloud Run** and **Cloud SQL**.

## Prerequisites

1.  **Google Cloud Project**: Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Billing Enabled**: Ensure billing is enabled for your project.
3.  **gcloud CLI**: Install and initialize the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

## 1. Setup Database (Cloud SQL)

Since Veltro requires a PostgreSQL database, you should set up a Cloud SQL instance.

1.  Go to **Cloud SQL** in the Google Cloud Console.
2.  Create a **PostgreSQL** instance.
    *   **Version**: PostgreSQL 15 or higher recommended.
    *   **Region**: Choose a region close to your users (e.g., `europe-west2` for London).
3.  Create a **User** (e.g., `veltro_user`) and **Password**.
4.  Create a **Database** (e.g., `veltro_db`).
5.  **Connection**:
    *   For Cloud Run to connect, you don't necessarily need a public IP. You can use the **Cloud SQL Auth Proxy** or **Private IP** (if in same VPC).
    *   However, the easiest way for Cloud Run is to use the **Instance Connection Name** (found in Overview page: `project:region:instance`).

## 2. Deploy to Cloud Run

We will build the container and deploy it to Cloud Run in one step (or two).

### Option A: Build and Deploy from Source (Easiest)

Run the following command in your terminal (make sure you are in the project root):

```bash
gcloud run deploy veltro-app \
  --source . \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=PROJECT_SECRET_NAME:latest"
```

*Note: The above assumes you stored your `DATABASE_URL` in **Secret Manager**.*

### Configuration Details

You need to provide the environment variables defined in `.env`. It is **highly recommended** to use [Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets) for sensitive values like `DATABASE_URL` and `SESSION_SECRET`.

**Recommended Secrets to Create:**
*   `DATABASE_URL`: `postgres://user:password@/dbname?host=/cloudsql/project:region:instance`
    *   Note the socket path format for Cloud Run + Cloud SQL.
*   `SESSION_SECRET`: A long random string.
*   `COMPANIES_HOUSE_API_KEY`: Your real API key.

**Environment Variables (Non-sensitive):**
*   `NODE_ENV`: `production`
*   `GOCARDLESS_ENVIRONMENT`: `live` (or `sandbox`)

### Step-by-Step Command

1.  **Build the container image**:
    ```bash
    gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/veltro-app
    ```

2.  **Deploy the container**:
    ```bash
    gcloud run deploy veltro-app \
      --image gcr.io/YOUR_PROJECT_ID/veltro-app \
      --platform managed \
      --region europe-west2 \
      --allow-unauthenticated \
      --add-cloudsql-instances PROJECT:REGION:INSTANCE \
      --set-env-vars "NODE_ENV=production" \
      --set-env-vars "GOCARDLESS_ENVIRONMENT=sandbox" \
      --set-secrets "DATABASE_URL=projects/YOUR_PROJECT_ID/secrets/DATABASE_URL/versions/1" \
      --set-secrets "SESSION_SECRET=projects/YOUR_PROJECT_ID/secrets/SESSION_SECRET/versions/1"
    ```

*Replace `YOUR_PROJECT_ID` and connection strings with your actual values.*

## 3. Database Migration

After deployment, the application needs to push its schema to the production database.

You can run a one-off job or connect locally using Cloud SQL Auth Proxy to run migrations.

**Using Cloud SQL Proxy (Local Machine):**
1.  Download Cloud SQL Auth Proxy.
2.  Start it: `./cloud_sql_proxy -instances=project:region:instance=tcp:5432`
3.  In another terminal, update your local `.env` to point to `postgres://user:pass@localhost:5432/veltro_db`.
4.  Run:
    ```bash
    npm run db:push
    ```

## 4. Verification

After deployment, Cloud Run will provide a URL (e.g., `https://veltro-app-xyz.a.run.app`). Visit this URL to ensure the application is running.

## Troubleshooting

*   **Logs**: Check Cloud Run logs in the GCP Console for startup errors.
*   **Database**: Ensure the service account used by Cloud Run has "Cloud SQL Client" role.
