param(
  [string]$DataDir = "./emulator-data"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$config = Get-Content (Join-Path $repoRoot "firebase.json") -Raw | ConvertFrom-Json

$ports = [ordered]@{
  Auth      = [int]$config.emulators.auth.port
  Functions = [int]$config.emulators.functions.port
  Firestore = [int]$config.emulators.firestore.port
  UI        = [int]$config.emulators.ui.port
}

function Get-PortOwner([int]$Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) {
    return $null
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
  return [pscustomobject]@{
    Port        = $Port
    ProcessId   = [int]$connection.OwningProcess
    Name        = $process.Name
    CommandLine = $process.CommandLine
  }
}

$occupied = @()
foreach ($entry in $ports.GetEnumerator()) {
  $owner = Get-PortOwner $entry.Value
  if ($owner) {
    $occupied += [pscustomobject]@{
      Service     = $entry.Key
      Port        = $entry.Value
      ProcessId   = $owner.ProcessId
      Name        = $owner.Name
      CommandLine = $owner.CommandLine
    }
  }
}

if ($occupied.Count -gt 1) {
  Write-Host "Multiple configured emulator ports are already listening." -ForegroundColor Yellow
  Write-Host "This usually means an emulator suite is already running, so nothing will be killed."
  $occupied | Format-Table Service, Port, ProcessId, Name -AutoSize
  exit 1
}

if ($occupied.Count -eq 1) {
  $owner = $occupied[0]

  $isStaleFirestore =
    $owner.Service -eq "Firestore" -and
    $owner.Name -match "^java(w)?\.exe$" -and
    $owner.CommandLine -match "cloud-firestore-emulator"

  if ($isStaleFirestore) {
    Write-Host "Found orphaned Firestore emulator on port $($owner.Port) (PID $($owner.ProcessId))." -ForegroundColor Yellow
    Write-Host "Stopping only that Firestore emulator process..."
    Stop-Process -Id $owner.ProcessId -Force
    Start-Sleep -Milliseconds 750

    if (Get-PortOwner $owner.Port) {
      throw "Port $($owner.Port) is still occupied after stopping the stale Firestore emulator."
    }

    Write-Host "Stale Firestore emulator cleared." -ForegroundColor Green
  }
  else {
    Write-Host "Configured emulator port $($owner.Port) is occupied by another process." -ForegroundColor Red
    Write-Host "Refusing to kill it automatically."
    $owner | Format-List Service, Port, ProcessId, Name, CommandLine
    exit 1
  }
}

$resolvedDataDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $DataDir))
$importArgs = @()

if (Test-Path $resolvedDataDir) {
  $importArgs += "--import=$resolvedDataDir"
  Write-Host "Emulator data will be imported from: $resolvedDataDir"
}
else {
  Write-Host "No existing emulator data directory found; starting with a clean local database."
}

Write-Host "Starting Firebase emulators with automatic export on exit..." -ForegroundColor Cyan
& firebase emulators:start @importArgs "--export-on-exit=$resolvedDataDir"
exit $LASTEXITCODE
