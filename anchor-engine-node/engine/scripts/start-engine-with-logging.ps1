$env:Path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User) + ";" + [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
Set-Location "C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node\engine"
Write-Host "Starting engine..." -ForegroundColor Green
pnpm start | Out-File "C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node\engine\logs\engine-startup.log" -Append
