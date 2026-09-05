$root = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $root "uploads\start-docker-and-firecrawl.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $logFile -Value $line -Encoding utf8
}

Log "start-docker-and-firecrawl: run begins"

if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
  $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dockerDesktop) {
    Log "Launching Docker Desktop"
    Start-Process -FilePath $dockerDesktop
  } else {
    Log "Docker Desktop.exe not found at $dockerDesktop - aborting"
    exit 1
  }
} else {
  Log "Docker Desktop process already running"
}

$ready = $false
for ($i = 0; $i -lt 36; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  Log "Docker engine did not become ready within 3 minutes - aborting"
  exit 1
}

Log "Docker engine ready after $($i * 5)s - starting Firecrawl stack"

# start-firecrawl.ps1 writes its own progress to stdout/stderr; native-command stderr under
# PS 5.1 turns into a terminating error if redirected while $ErrorActionPreference is Stop,
# so just let it run normally (its own console output, not piped into this script's log) and
# verify success afterward by polling the API port instead of trusting its exit behavior.
& (Join-Path $PSScriptRoot "start-firecrawl.ps1")

$apiUp = $false
for ($i = 0; $i -lt 12; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:3002/v2/scrape" -Method GET -TimeoutSec 3 -ErrorAction Stop
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      $apiUp = $true
      break
    }
  }
  Start-Sleep -Seconds 5
}

if ($apiUp) {
  Log "Firecrawl API responding on 127.0.0.1:3002"
} else {
  Log "Firecrawl API did not respond on 127.0.0.1:3002 after starting the stack"
  exit 1
}
