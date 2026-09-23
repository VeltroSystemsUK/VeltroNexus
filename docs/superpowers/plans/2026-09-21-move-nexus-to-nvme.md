# Move NEXUS onto the Dev NVMe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this ops cutover) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. Do not start until Shaun has approved this plan in chat.

**Goal:** Run the live NexusApp tree from the Fanxiang 1 TB NVMe (`A:`) instead of the Seagate 500 GB SATA HDD (`F:`), without touching the Cloudflare tunnel services or their tokens.

**Architecture:** Copy the live tree to `A:\Projects\Nexus` while NexusApp is still serving `:5000`, stop only NexusApp, delta-sync SQLite/JSON, replace `F:\Shaun\Desktop\NEXUS` with a directory junction to the NVMe path, retarget NSSM `AppDirectory` / log paths to `A:\Projects\Nexus`, then start NexusApp again. Both `Cloudflared` services stay running on `C:` and keep proxying hostnames to `127.0.0.1:5000`.

**Tech Stack:** Windows NSSM (`NexusApp`), Node `dist/index.js` on port 5000, SQLite `veltro.db`, Cloudflare named tunnels (token mode), NTFS→ReFS directory junction.

**Spec:** This plan. No separate design doc. Constraint from Shaun: the Cloudflare tunnel must not be affected.

## Global Constraints

- Never stop, restart, or edit `Cloudflared` or `CloudflaredStrataNexus`. Never pass `--token`. Never change ingress.
- NexusApp must keep binding `PORT=5000` (`0.0.0.0:5000` / `127.0.0.1:5000`). `APP_BASE_URL`, `PUBLIC_APP_URL`, `HELLO_PUBLIC_URL`, `BROKER_PORTAL_URL` stay as they are in `.env.production`.
- Do not `npm install`, rebuild, or migrate data. Copy the live tree byte-for-byte.
- Do not boot from the existing stale tree at `A:\Projects\Nexus` (last write 14/09/2026, `veltro.db` 4.3 MB vs live 22.7 MB). Rename it aside first.
- SQLite (`veltro.db`, `-wal`, `-shm`) is copied only after NexusApp is stopped.
- Origin will 502 through Cloudflare for the stop window (target ≤ 3 minutes). The tunnel *process* stays up; that is not a tunnel change.
- Mail backups stay on `F:\Shaun\Backups\nexus-mail`. Out of scope.
- Elevation is required for `Stop-Service` / `nssm set` / `mklink` / `Start-Service`. Use the same elevation pattern as `scripts/restart-nexus.bat`.

## Frozen inventory (21/09/2026)

| Thing | Live value | Touch? |
|---|---|---|
| NexusApp NSSM `Application` | `C:\nvm4w\nodejs\node.exe` | No |
| NexusApp `AppParameters` | `--env-file=.env.production dist/index.js` | No |
| NexusApp `AppDirectory` | `F:\Shaun\Desktop\NEXUS` | Yes → `A:\Projects\Nexus` |
| NexusApp stdout/stderr | `F:\Shaun\Desktop\NEXUS\logs\service.log` | Yes → `A:\Projects\Nexus\logs\service.log` |
| Listen | `0.0.0.0:5000` (node PID under NSSM) | No |
| `Cloudflared` | `C:\Program Files (x86)\cloudflared\cloudflared.exe tunnel run --token …` | **No** |
| `CloudflaredStrataNexus` `AppDirectory` | `C:\Program Files (x86)\cloudflared` | **No** |
| Public Nexus host (confirmed CF) | `https://leads.stratanexus.co.uk/api/health` → 200, `cf-ray` LHR | Probe only |
| `https://stratafinance.co.uk` | IONOS Apache 301 to `www.` — **not** the tunnel | Do not use as tunnel proof |
| Scheduled task `NexusAgentMailBackup` | `F:\Shaun\Desktop\NEXUS\scripts\backup_agent_mail.bat` | Covered by junction |
| Stale dest | `A:\Projects\Nexus` (14/09 copy) | Rename aside |

Live tree size ~3.3 GB (`node_modules` 878 MB, `uploads` 324 MB, `logs` 70 MB, `veltro.db` 23 MB).

---

### Task 1: Preflight — record tunnel PIDs and refuse if they change

**Files:**
- None in the repo. Run on Morpheus as Shaun, elevated when noted.
- After cutover, update: `C:\Users\Shaun\.grok\memory-v2\workspaces\veltronexus-05b1b43a\topics\nexus-deploy.md`

**Interfaces:**
- Consumes: running services `NexusApp`, `Cloudflared`, `CloudflaredStrataNexus`
- Produces: a PID snapshot used as the tunnel-untouched gate in Task 5

- [ ] **Step 1: Snapshot services and public health (do not elevate yet)**

```powershell
$nssm = "C:\Users\Shaun\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
Get-CimInstance Win32_Service -Filter "Name='NexusApp' OR Name='Cloudflared' OR Name='CloudflaredStrataNexus'" |
  Select-Object Name, State, ProcessId | Format-Table -AutoSize
Get-Process cloudflared | Select-Object Id, StartTime
& $nssm get NexusApp AppDirectory
& $nssm get CloudflaredStrataNexus AppDirectory
& $nssm get CloudflaredStrataNexus Application
curl.exe -sI --max-time 20 https://leads.stratanexus.co.uk/api/health
```

Expected:
- All three services `Running`
- `CloudflaredStrataNexus` AppDirectory = `C:\Program Files (x86)\cloudflared`
- `leads.stratanexus.co.uk` headers include `cf-ray` and HTTP 200 (slow is OK)
- Write down `Cloudflared` PID and `CloudflaredStrataNexus` PID (parent NSSM) plus both `cloudflared.exe` PIDs

- [ ] **Step 2: Abort conditions**

Stop the whole move (do not copy) if any of these is true:
- `A:` free space &lt; 20 GB
- `Cloudflared` or `CloudflaredStrataNexus` is not Running
- Someone has already changed NexusApp `AppDirectory` to `A:\Projects\Nexus` while the stale 14/09 tree is still there

- [ ] **Step 3: Park the stale `A:\Projects\Nexus` tree**

```powershell
Rename-Item "A:\Projects\Nexus" "Nexus.stale-2026-09-14"
Test-Path "A:\Projects\Nexus"   # must be False
Test-Path "A:\Projects\Nexus.stale-2026-09-14"  # must be True
```

Do not delete it in this task. It is a 14/09 snapshot, not live data.

---

### Task 2: Live copy onto NVMe (origin stays up)

**Files:**
- Create: `A:\Projects\Nexus\` (new tree, copy of live)
- Do not modify NSSM or Cloudflare

**Interfaces:**
- Consumes: `F:\Shaun\Desktop\NEXUS` (live, service still running)
- Produces: a near-complete copy at `A:\Projects\Nexus` with origin still on `:5000`

- [ ] **Step 1: Robocopy while NexusApp is running**

```powershell
robocopy "F:\Shaun\Desktop\NEXUS" "A:\Projects\Nexus" /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /MT:8 /NFL /NDL /NP
```

Expected: exit code 0–3 (Windows robocopy success). 4+ is failure — stop. Budget 10–20 minutes (HDD random reads of `node_modules`).

- [ ] **Step 2: Confirm dest exists and is not the stale tree**

```powershell
(Get-Item "A:\Projects\Nexus\veltro.db").Length
(Get-Item "F:\Shaun\Desktop\NEXUS\veltro.db").Length
Get-CimInstance Win32_Service -Filter "Name='Cloudflared' OR Name='CloudflaredStrataNexus'" | Select-Object Name, State, ProcessId
```

Expected: dest `veltro.db` is the live size (~22.7 MB at planning time, may have grown). Cloudflare PIDs **identical** to Task 1 snapshot.

---

### Task 3: Stop only NexusApp, delta-sync, junction, retarget NSSM

This is the only origin-down window. Target ≤ 3 minutes. Cloudflare services stay Running.

**Files:**
- Modify (NSSM): `NexusApp` `AppDirectory`, `AppStdout`, `AppStderr`
- Create: junction `F:\Shaun\Desktop\NEXUS` → `A:\Projects\Nexus`
- Rename: live HDD folder → `F:\Shaun\Desktop\NEXUS.hdd-backup`
- Modify: `scripts/backup_agent_mail.bat` working directory still works via junction; optional later cleanup, not required for cutover

**Interfaces:**
- Consumes: Task 2 copy + live WAL/JSON after stop
- Produces: NexusApp cwd on NVMe; old path still resolves

- [ ] **Step 1: Elevated stop of NexusApp only**

```powershell
# In an elevated PowerShell. Do NOT Stop-Service Cloudflared*
$cf = Get-CimInstance Win32_Service -Filter "Name='Cloudflared' OR Name='CloudflaredStrataNexus'"
$cf | Select-Object Name, State, ProcessId
Stop-Service -Name NexusApp -Force
Get-Service NexusApp   # Stopped
$cf2 = Get-CimInstance Win32_Service -Filter "Name='Cloudflared' OR Name='CloudflaredStrataNexus'"
$cf2 | Select-Object Name, State, ProcessId
# PIDs must match Task 1. If either Cloudflared service is Stopped, start it back immediately and abort the move.
```

- [ ] **Step 2: Delta copy including SQLite after the process has released the files**

```powershell
robocopy "F:\Shaun\Desktop\NEXUS" "A:\Projects\Nexus" /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /MT:8 /NFL /NDL /NP
# Confirm WAL copied:
Get-Item "A:\Projects\Nexus\veltro.db","A:\Projects\Nexus\veltro.db-wal","A:\Projects\Nexus\uploads\agent_mail.json" |
  Select-Object Name, Length, LastWriteTime
```

Expected: `veltro.db-wal` LastWriteTime matches the HDD file. robocopy exit 0–3.

- [ ] **Step 3: Swap HDD folder for a junction**

```powershell
Rename-Item "F:\Shaun\Desktop\NEXUS" "NEXUS.hdd-backup"
cmd /c mklink /J "F:\Shaun\Desktop\NEXUS" "A:\Projects\Nexus"
cmd /c dir /AL "F:\Shaun\Desktop"
(Get-Item "F:\Shaun\Desktop\NEXUS").LinkType
(Get-Item "F:\Shaun\Desktop\NEXUS\veltro.db").Length
(Get-Item "A:\Projects\Nexus\veltro.db").Length
```

Expected: `LinkType` = `Junction`. Both length values equal. Explorer / this Grok workspace path `F:\Shaun\Desktop\NEXUS` still opens the NVMe files.

- [ ] **Step 4: Point NSSM at the NVMe path (still elevated)**

```powershell
$nssm = "C:\Users\Shaun\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
& $nssm set NexusApp AppDirectory "A:\Projects\Nexus"
& $nssm set NexusApp AppStdout "A:\Projects\Nexus\logs\service.log"
& $nssm set NexusApp AppStderr "A:\Projects\Nexus\logs\service.log"
& $nssm get NexusApp AppDirectory
& $nssm get NexusApp AppStdout
& $nssm get NexusApp AppParameters
# Must still be: --env-file=.env.production dist/index.js
```

Do **not** `nssm set` anything on `CloudflaredStrataNexus`.

- [ ] **Step 5: Start NexusApp**

```powershell
Start-Service NexusApp
Get-Service NexusApp   # Running
Start-Sleep -Seconds 8
Get-NetTCPConnection -LocalPort 5000 -State Listen |
  Select-Object LocalAddress, OwningProcess
```

Expected: listen on `0.0.0.0:5000` from a **new** node PID. Cloudflare PIDs still the Task 1 snapshot.

---

### Task 4: Verify origin + tunnel (tunnel PIDs unchanged)

**Files:**
- Modify: `C:\Users\Shaun\.grok\memory-v2\workspaces\veltronexus-05b1b43a\topics\nexus-deploy.md` (layout path only)

**Interfaces:**
- Consumes: Task 3 cutover
- Produces: written confirmation that Cloudflare PIDs and AppDirectory are untouched

- [ ] **Step 1: Local origin**

```powershell
curl.exe -sS --max-time 30 http://127.0.0.1:5000/api/health
# If this times out, wait 30s and retry once — harvest/IMAP can block the event loop
# even on NVMe. Check logs\service.log last 30 lines rather than restarting Cloudflare.
Get-Content "A:\Projects\Nexus\logs\service.log" -Tail 30
```

Expected: HTTP 200, or a documented harvest-block timeout **with node still listening on 5000**. Listening on 5000 is the pass for “origin is where the tunnel expects”.

- [ ] **Step 2: Cloudflare must be bitwise-untouched**

```powershell
$nssm = "C:\Users\Shaun\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
Get-CimInstance Win32_Service -Filter "Name='Cloudflared' OR Name='CloudflaredStrataNexus'" |
  Select-Object Name, State, ProcessId
Get-Process cloudflared | Select-Object Id, StartTime
& $nssm get CloudflaredStrataNexus AppDirectory
& $nssm get CloudflaredStrataNexus Application
& $nssm get CloudflaredStrataNexus AppParameters
```

Expected:
- Same PIDs as Task 1
- AppDirectory still `C:\Program Files (x86)\cloudflared`
- Application still `C:\Program Files (x86)\cloudflared\cloudflared.exe`
- AppParameters still the existing `tunnel run --token …` string (do not print the token into chat or commits)

If a Cloudflare PID changed, the move *did* affect the tunnel — treat as a failed cutover even if Nexus is up. Restart nothing; report to Shaun.

- [ ] **Step 3: Public hostname through the existing tunnel**

```powershell
curl.exe -sI --max-time 30 https://leads.stratanexus.co.uk/api/health
curl.exe -sI --max-time 30 https://stratanexus.co.uk/api/health
```

Expected: `cf-ray` present, HTTP 200 (or the same status that host returned in Task 1). Do **not** treat `https://stratafinance.co.uk` as proof — that host is IONOS Apache, not this tunnel.

- [ ] **Step 4: Confirm I/O is on A:**

```powershell
$p = (Get-NetTCPConnection -LocalPort 5000 -State Listen).OwningProcess | Select-Object -First 1
Get-CimInstance Win32_Process -Filter "ProcessId=$p" | Select-Object ProcessId, ExecutablePath
# cwd via handle is optional; NSSM AppDirectory is the source of truth:
$nssm = "C:\Users\Shaun\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
& $nssm get NexusApp AppDirectory
# Must be A:\Projects\Nexus
```

- [ ] **Step 5: Update deploy memory**

In `nexus-deploy.md`, change live path lines from `F:\Shaun\Desktop\NEXUS` to `A:\Projects\Nexus`, and note that `F:\Shaun\Desktop\NEXUS` is a junction. Do not commit secrets.

---

### Task 5: Rollback (only if Task 4 fails)

**Files:**
- NSSM NexusApp paths back to the HDD folder
- Junction removed; `NEXUS.hdd-backup` restored to `NEXUS`

- [ ] **Step 1: Fail back without touching Cloudflare**

```powershell
# elevated
Stop-Service -Name NexusApp -Force
$nssm = "C:\Users\Shaun\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
cmd /c rmdir "F:\Shaun\Desktop\NEXUS"   # removes junction only
Rename-Item "F:\Shaun\Desktop\NEXUS.hdd-backup" "NEXUS"
& $nssm set NexusApp AppDirectory "F:\Shaun\Desktop\NEXUS"
& $nssm set NexusApp AppStdout "F:\Shaun\Desktop\NEXUS\logs\service.log"
& $nssm set NexusApp AppStderr "F:\Shaun\Desktop\NEXUS\logs\service.log"
Start-Service NexusApp
Get-CimInstance Win32_Service -Filter "Name='Cloudflared' OR Name='CloudflaredStrataNexus'" |
  Select-Object Name, State, ProcessId
```

`rmdir` on a junction deletes the link, not `A:\Projects\Nexus`. Leave the NVMe copy in place for inspection.

---

### Task 6: After Shaun confirms (not same day unless asked)

- [ ] Keep `F:\Shaun\Desktop\NEXUS.hdd-backup` for at least one quiet day, then delete it to free ~3.3 GB on `F:`.
- [ ] Keep `A:\Projects\Nexus.stale-2026-09-14` until Shaun says it can go (old 14/09 snapshot, not live).
- [ ] Optional: change `NexusAgentMailBackup` / `scripts/backup_agent_mail.bat` `cd` to `A:\Projects\Nexus`. The junction already makes the old path work.
- [ ] Do not move `F:\Shaun\Backups\nexus-mail` in this work.

## Why the tunnel survives this

1. Both tunnel services run `cloudflared.exe` from `C:\Program Files (x86)\cloudflared` with dashboard tokens. There is no `config.yml` under the NEXUS tree. User `.cloudflared` is empty.
2. Ingress is hostname → `127.0.0.1:5000`, not a filesystem path. Moving files cannot change Cloudflare routing.
3. The plan never stops those services. The only downtime is NexusApp itself, which already 502s whenever node is down, on any disk.

## Out of scope

- Fixing harvest CH 429s / event-loop health timeouts (those remain after the move).
- Moving Firecrawl, Ollama, or IONOS DNS.
- Changing public URLs or mail domains.
