# Environment Variables

This document lists all environment variables used by FlowLoan.

## Required in Production

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret for session encryption (32+ chars) | `your-secure-random-string-here` |
| `REDIS_URL` | Redis connection for rate limiting | `redis://user:pass@host:6379/0` |
| `WEBHOOK_KEY_SECRET` | Secret for HMAC hashing API keys (32+ chars) | `another-secure-random-string` |

## Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://...` |
| `PGHOST` | PostgreSQL host | `localhost` |
| `PGPORT` | PostgreSQL port | `5432` |
| `PGUSER` | PostgreSQL username | `postgres` |
| `PGPASSWORD` | PostgreSQL password | `password` |
| `PGDATABASE` | PostgreSQL database name | `flowloan` |

Note: `DATABASE_URL` takes precedence if set.

## Object Storage

| Variable | Description | Example |
|----------|-------------|---------|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Bucket ID for file storage | `bucket-abc123` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Paths for public file access | `branding/` |
| `PRIVATE_OBJECT_DIR` | Directory for private files | `.private` |

## Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Session encryption secret — required in production, no fallback | 32+ character random string |

## External Services

### Standalone Strata (lender pack)
| Variable | Description | Example |
|----------|-------------|---------|
| `STRATA_ENABLED` | Start Strata packaging when a file is sent to underwriting | `true` |
| `STRATA_API_URL` | Standalone Strata API | `http://127.0.0.1:8000` |
| `STRATA_WEB_URL` | Standalone Strata workspace | `http://127.0.0.1:3000` |
| `STRATA_INTEGRATION_TOKEN` | Must match Strata `env.local` | long random string |

### Companies House
| Variable | Description | Example |
|----------|-------------|---------|
| `COMPANIES_HOUSE_API_KEY` | API key for UK Companies House | `your-api-key` |

### GoCardless (Open Banking)
| Variable | Description | Example |
|----------|-------------|---------|
| `GOCARDLESS_ACCESS_TOKEN` | GoCardless API token | `access-token` |
| `GOCARDLESS_ENVIRONMENT` | Environment (sandbox/live) | `sandbox` |

### Email (Resend)
| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key | `re_abc123` |
| `RESEND_FROM_EMAIL` | Sender email address | `noreply@example.com` |

### AI Services
| Variable | Description | Example |
|----------|-------------|---------|
| `XAI_API_KEY` | xAI / Grok key for Company Deep Research, Associations AI Web Search, and BBB business-plan generation (`xai-…` console key) | `xai-...` |
| `XAI_MODEL` | Optional Grok model. Deep Research, Associations search, and business plans default to `grok-4.6` | `grok-4.6` |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini AI API key | `AIza...` |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini API base URL | `https://...` |

### Search
| Variable | Description | Example |
|----------|-------------|---------|
| `TAVILY_API_KEY` | Optional Tavily fallback if Grok Associations web search fails | `tvly-...` |
| `FIRECRAWL_API_KEY` | Cloud Firecrawl key for Casey/Craft **search** only. Harper does not scrape the cloud | `fc-...` |
| `FIRECRAWL_API_URL` | Optional self-hosted Firecrawl (needs ~8GB Docker RAM). If unset, Harper fetches contact pages directly | `http://127.0.0.1:3002` |

### Telnyx Voice
| Variable | Description | Example |
|----------|-------------|---------|
| `TELNYX_API_KEY` | API key that can see this account (rotate if the old key returns empty numbers) | `KEY...` |
| `TELNYX_PUBLIC_KEY` | Ed25519 public key PEM for webhooks | `-----BEGIN PUBLIC KEY-----...` |
| `TELNYX_TOOL_SECRET` | Shared secret for assistant tool POSTs (`x-telnyx-tool-secret` or `Authorization: Bearer`) | long random string |
| `TELNYX_CONNECTION_ID` | Voice connection id | |
| `TELNYX_VOICE_APP_ID` | Call control / Voice AI app id | |
| `TELNYX_DID` | `+441156611616` | |
| `TELNYX_SOPHIE_ASSISTANT_ID` | Sophie assistant id | |
| `TELNYX_JAMES_ASSISTANT_ID` | James assistant id | |
| `TELNYX_TRANSFER_NUMBER` | `+447898789313` | |
| `TELNYX_INBOUND_ENABLED` | `true` only when DID is Active | `false` |
| `TELNYX_CLICK_TO_CALL_ENABLED` | keep `false` this slice | `false` |
| `TELNYX_WHATSAPP_ENABLED` | keep `false` | `false` |
| `TELNYX_WARM_AUTODIAL_ENABLED` | keep `false` | `false` |

Do not set `TELNYX_INBOUND_ENABLED=true` until Telnyx marks DID `+441156611616` **Active**. Click-to-call, WhatsApp, and warm auto-dial stay `false` for this slice. Never commit real keys.

## Rate Limiting

All rate limit values are optional with sensible defaults.

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WEBHOOK` | Webhook requests per window | `60` |
| `RATE_LIMIT_WEBHOOK_WINDOW_MS` | Webhook window in ms | `60000` |
| `RATE_LIMIT_PDF_PARSE` | PDF parse requests per window | `30` |
| `RATE_LIMIT_PDF_PARSE_WINDOW_MS` | PDF parse window in ms | `60000` |
| `RATE_LIMIT_AI` | AI requests per window | `20` |
| `RATE_LIMIT_AI_WINDOW_MS` | AI window in ms | `60000` |
| `RATE_LIMIT_AUTH` | Auth requests per window | `10` |
| `RATE_LIMIT_AUTH_WINDOW_MS` | Auth window in ms | `60000` |
| `RATE_LIMIT_UPLOAD` | Upload requests per window | `30` |
| `RATE_LIMIT_UPLOAD_WINDOW_MS` | Upload window in ms | `60000` |

## Application

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |

## Security Considerations

### Secrets Management
- Never commit secrets to version control
- Use environment variables or secret management service
- Rotate secrets regularly
- Use unique secrets per environment

### Minimum Secret Lengths
- `SESSION_SECRET`: 32+ characters
- `WEBHOOK_KEY_SECRET`: 32+ characters

### Production Checklist
- [ ] All required variables are set
- [ ] Secrets are cryptographically random
- [ ] `REDIS_URL` points to production Redis
- [ ] `DATABASE_URL` points to production database
- [ ] `NODE_ENV` is set to `production`
