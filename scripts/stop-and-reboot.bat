@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
nssm stop NexusApp
sc stop NexusApp
timeout /t 2 /nobreak >nul
shutdown.exe /r /t 8 /c "Nexus stopped. Rebooting."
