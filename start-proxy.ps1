Write-Host "Starting Cloud SQL Proxy..."
Write-Host "Please authenticate if a browser window opens."
Write-Host "Keep this window OPEN while running npm run db:push in another terminal."
Write-Host ""
.\cloud-sql-proxy.exe subtle-tooling-484906-r2:europe-west2:veltro-app-db
pause
