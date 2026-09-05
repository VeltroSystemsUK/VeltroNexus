@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -Command "$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File \"F:\Shaun\Desktop\NEXUS\scripts\start-docker-and-firecrawl.ps1\"'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10); Unregister-ScheduledTask -TaskName 'StartFirecrawlOnLogin' -Confirm:$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName 'StartFirecrawlOnLogin' -Action $action -Trigger $trigger -Settings $settings -Description 'Launches Docker Desktop (if needed) and starts the local Firecrawl+SearXNG stack for NEXUS Craft research.' | Out-Null; Write-Host 'StartFirecrawlOnLogin task registered.'"
echo Done.
pause
