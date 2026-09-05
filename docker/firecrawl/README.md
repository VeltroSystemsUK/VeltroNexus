# Self-hosted Firecrawl

Runs both scrape and search locally (via a bundled SearXNG instance), so nothing
hits Firecrawl Cloud or bills against its API credits.

```powershell
.\scripts\start-firecrawl.ps1
```

Then set `FIRECRAWL_API_URL=http://127.0.0.1:3002` in `.env.production` and
restart NexusApp (`npm run build` auto-restarts it).

Look in Docker Desktop **Containers** for the `firecrawl-src` group (api,
playwright, redis, rabbitmq, nuq-postgres, searxng). There is no Firecrawl app
in the Hub store — `docker/firecrawl-src` is a shallow clone of the upstream
repo, kept out of git via `.gitignore`.

The official Compose stack wants ~8–12 GB Docker RAM under heavy crawl load;
at idle it's much lighter. If Docker is memory-constrained, drop
`FIRECRAWL_API_URL` from `.env.production` to fall back to Firecrawl Cloud —
Harper doesn't need this either way; she fetches `/contact`, `/`, `/about`,
`/team` herself with no Firecrawl credits.

SearXNG (`docker/firecrawl-src/searxng/settings.yml`) is configured with
`search.formats: [html, json]` and no rate limiter — it's only ever reached
from the `api` container over the internal Docker network
(`SEARXNG_ENDPOINT=http://searxng:8080` in `docker/firecrawl-src/.env`), never
exposed publicly. Its host port (`127.0.0.1:8081`) is for local debugging
only (`curl "http://127.0.0.1:8081/search?q=test&format=json"`).
