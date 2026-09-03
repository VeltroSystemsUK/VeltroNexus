# Self-hosted Firecrawl (optional)

Harper does **not** need this. By default she fetches `/contact`, `/`, `/about`, `/team` herself — no Docker, no Firecrawl Cloud scrape credits.

Casey / Craft **search** stays on `https://api.firecrawl.dev`.

The official Firecrawl Compose stack wants ~8–12 GB Docker RAM (Postgres, RabbitMQ, Playwright, FoundationDB). Skip it unless you can give Docker that memory.

If you can:

```powershell
.\scripts\start-firecrawl.ps1
```

Then set `FIRECRAWL_API_URL=http://127.0.0.1:3002` in `.env.local` and restart Nexus.

Look in Docker Desktop **Containers** for the `firecrawl-src` group (api, playwright, redis, …). There is no Firecrawl app in the Hub store.
