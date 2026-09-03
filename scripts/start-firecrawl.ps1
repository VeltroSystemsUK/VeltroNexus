$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "docker\firecrawl-src"
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
"@ | Set-Content -Path $envFile -Encoding ascii
}

Push-Location $src
try {
  docker compose up --build -d
  docker compose ps --all
  Write-Host ""
  Write-Host "Firecrawl scrape API: http://127.0.0.1:3002"
  Write-Host "Nexus FIRECRAWL_API_URL is already set to that in .env.local. Restart Nexus after the stack is healthy."
} finally {
  Pop-Location
}
