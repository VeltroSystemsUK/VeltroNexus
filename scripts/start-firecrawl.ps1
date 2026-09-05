$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "docker\firecrawl-src"
$overrideFile = Join-Path $root "docker\firecrawl\docker-compose.override.yaml"
$tag = "v2.11.162"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is not on PATH. Install Docker Desktop, then re-run."
}

if (-not (Test-Path $src)) {
  Write-Host "Cloning Firecrawl $tag..."
  git clone --depth 1 --branch $tag https://github.com/firecrawl/firecrawl.git $src
}

$envFile = Join-Path $src ".env"
if (-not (Test-Path $envFile)) {
  $password = -join ((1..40) | ForEach-Object { Get-Random -InputObject ([char[]]"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") })
  @"
USE_DB_AUTHENTICATION=false
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$password
POSTGRES_DB=postgres
SEARXNG_ENDPOINT=http://searxng:8080
"@ | Set-Content -Path $envFile -Encoding ascii
} elseif (-not (Select-String -Path $envFile -Pattern "^SEARXNG_ENDPOINT=" -Quiet)) {
  Add-Content -Path $envFile -Value "SEARXNG_ENDPOINT=http://searxng:8080"
}

Push-Location $src
try {
  docker compose -f docker-compose.yaml -f $overrideFile up --build -d
  docker compose -f docker-compose.yaml -f $overrideFile ps --all
  Write-Host ""
  Write-Host "Firecrawl API (scrape + search, via local SearXNG): http://127.0.0.1:3002"
  Write-Host "SearXNG (debug only): http://127.0.0.1:8081"
  Write-Host "Set FIRECRAWL_API_URL=http://127.0.0.1:3002 in .env.production and restart NexusApp."
} finally {
  Pop-Location
}
