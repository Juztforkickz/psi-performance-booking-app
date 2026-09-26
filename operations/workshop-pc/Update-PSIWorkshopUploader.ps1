param(
  [switch]$CheckOnly,
  [switch]$Install,
  [switch]$NonInteractive,
  [string]$ManifestUrl = 'https://raw.githubusercontent.com/Juztforkickz/psi-performance-booking-app/main/operations/workshop-pc/workshop-update.json'
)

$ErrorActionPreference = 'Stop'
$InstallRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$ExpectedRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PSI Performance\Workshop Uploader'))
if ($InstallRoot.TrimEnd('\') -ne $ExpectedRoot.TrimEnd('\')) {
  throw 'Run the updater only from the installed PSI Workshop Uploader folder.'
}
if ($CheckOnly -and $Install) { throw 'Choose either CheckOnly or Install.' }
if (-not $CheckOnly -and -not $Install) { $CheckOnly = $true }

$StatusPath = Join-Path $InstallRoot 'update-status.json'
$LocalManifestPath = Join-Path $InstallRoot 'workshop-update.json'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$ErrorLog = Join-Path $InstallRoot 'last-update-error.log'
$AllowedFiles = @(
  'psi_uploads.py',
  'requirements.txt',
  'Start-PSIWorkshopUploader.ps1',
  'Start-PSIWorkshopWatcher.ps1',
  'Start-PSIWorkshopTray.ps1',
  'Update-PSIWorkshopUploader.ps1'
)
$UpdaterMutex = New-Object System.Threading.Mutex($false, 'Local\PSIWorkshopUpdater')
$UpdaterLockHeld = $false
$WatcherMutex = $null
$WatcherLockHeld = $false
$StagingRoot = $null
$BackupRoot = $null

function Get-PSIManifest {
  $manifest = Invoke-RestMethod -Uri $ManifestUrl -TimeoutSec 20 -Headers @{ 'Cache-Control' = 'no-cache' }
  if ($manifest.schema -ne 1) { throw 'The workshop update manifest is not supported.' }
  [void][version]$manifest.version
  if ($manifest.baseUrl -notmatch '^https://raw\.githubusercontent\.com/Juztforkickz/psi-performance-booking-app/[A-Za-z0-9._/-]+/operations/workshop-pc/$') {
    throw 'The workshop update source is not approved.'
  }
  $names = @($manifest.files | ForEach-Object { $_.name })
  if ($names.Count -ne $AllowedFiles.Count -or @($names | Where-Object { $_ -notin $AllowedFiles }).Count -gt 0) {
    throw 'The workshop update file list is not approved.'
  }
  foreach ($file in $manifest.files) {
    if ($file.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'The workshop update contains an invalid file hash.' }
  }
  return $manifest
}

function Get-LocalVersion {
  if (-not (Test-Path -LiteralPath $LocalManifestPath)) { return [version]'0.0.0' }
  try {
    return [version]((Get-Content -LiteralPath $LocalManifestPath -Raw | ConvertFrom-Json).version)
  } catch {
    return [version]'0.0.0'
  }
}

function Write-UpdateStatus($manifest, [bool]$available, [string]$message) {
  @{
    schema = 1
    checkedAt = [DateTime]::UtcNow.ToString('o')
    localVersion = (Get-LocalVersion).ToString()
    remoteVersion = ([version]$manifest.version).ToString()
    updateAvailable = $available
    message = $message
  } | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8
}

function Stop-PSIWatcherSafely {
  Set-Content -LiteralPath $StopFile -Value 'stop' -Encoding ASCII
  $script:WatcherMutex = New-Object System.Threading.Mutex($false, 'Local\PSIWorkshopAutomaticUploader')
  for ($attempt = 0; $attempt -lt 45 -and -not $script:WatcherLockHeld; $attempt++) {
    try { $script:WatcherLockHeld = $script:WatcherMutex.WaitOne(1000) }
    catch [System.Threading.AbandonedMutexException] { $script:WatcherLockHeld = $true }
  }
  if (-not $script:WatcherLockHeld) { throw 'Background syncing did not pause safely. Try the update again after the current upload finishes.' }
}

function Start-PSIComponents {
  Remove-Item -LiteralPath $StopFile -Force -ErrorAction SilentlyContinue
  $watcher = Join-Path $InstallRoot 'Start-PSIWorkshopWatcher.ps1'
  $tray = Join-Path $InstallRoot 'Start-PSIWorkshopTray.ps1'
  if (Test-Path -LiteralPath (Join-Path $InstallRoot 'session.dpapi')) {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $watcher + '"') | Out-Null
  }
  Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $tray + '"') | Out-Null
}

try {
  $UpdaterLockHeld = $UpdaterMutex.WaitOne(0)
  if (-not $UpdaterLockHeld) { exit 0 }
  $manifest = Get-PSIManifest
  $localVersion = Get-LocalVersion
  $remoteVersion = [version]$manifest.version
  $available = $remoteVersion -gt $localVersion

  if ($CheckOnly) {
    Write-UpdateStatus $manifest $available $(if ($available) { 'An approved workshop app update is available.' } else { 'The workshop app is up to date.' })
    if ($available) { exit 10 }
    exit 0
  }

  if (-not $available) {
    Write-Host 'PSI Workshop Uploads is already up to date.'
    Write-UpdateStatus $manifest $false 'The workshop app is up to date.'
    if (-not $NonInteractive) { Read-Host 'Press Enter to close' }
    exit 0
  }
  if (-not $NonInteractive) {
    $confirmation = Read-Host ('Type UPDATE to install PSI Workshop version ' + $remoteVersion)
    if ($confirmation -ne 'UPDATE') { Write-Host 'Update cancelled.'; exit 0 }
  }

  $StagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('PSIWorkshopUpdate-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $StagingRoot | Out-Null
  foreach ($file in $manifest.files) {
    $destination = Join-Path $StagingRoot $file.name
    Invoke-WebRequest -Uri ($manifest.baseUrl + $file.name) -OutFile $destination -TimeoutSec 30 -Headers @{ 'Cache-Control' = 'no-cache' }
    $actualHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $file.sha256) { throw ('Update verification failed for ' + $file.name + '.') }
  }

  Stop-PSIWatcherSafely
  $BackupRoot = Join-Path $InstallRoot ('.update-backup\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $localVersion)
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
  foreach ($name in $AllowedFiles) {
    $current = Join-Path $InstallRoot $name
    if (Test-Path -LiteralPath $current) { Copy-Item -LiteralPath $current -Destination $BackupRoot -Force }
  }
  if (Test-Path -LiteralPath $LocalManifestPath) { Copy-Item -LiteralPath $LocalManifestPath -Destination $BackupRoot -Force }

  foreach ($name in $AllowedFiles) {
    Copy-Item -LiteralPath (Join-Path $StagingRoot $name) -Destination (Join-Path $InstallRoot $name) -Force
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $LocalManifestPath -Encoding UTF8

  $python = Join-Path $InstallRoot '.venv\Scripts\python.exe'
  & $python -m pip install --disable-pip-version-check -r (Join-Path $InstallRoot 'requirements.txt')
  if ($LASTEXITCODE -ne 0) { throw 'The updated workshop dependencies could not be installed.' }
  & $python -m py_compile (Join-Path $InstallRoot 'psi_uploads.py')
  if ($LASTEXITCODE -ne 0) { throw 'The updated workshop uploader did not pass its startup check.' }
  foreach ($name in @('Start-PSIWorkshopUploader.ps1', 'Start-PSIWorkshopWatcher.ps1', 'Start-PSIWorkshopTray.ps1', 'Update-PSIWorkshopUploader.ps1')) {
    $parseTokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $InstallRoot $name), [ref]$parseTokens, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) { throw ('The updated ' + $name + ' did not pass its startup check.') }
  }

  Remove-Item -LiteralPath $ErrorLog -Force -ErrorAction SilentlyContinue
  Write-UpdateStatus $manifest $false ('PSI Workshop version ' + $remoteVersion + ' was installed successfully.')
  Write-Host ('PSI Workshop version ' + $remoteVersion + ' installed successfully.') -ForegroundColor Green
} catch {
  $message = 'PSI Workshop update failed: ' + $_.Exception.Message
  Set-Content -LiteralPath $ErrorLog -Value $message -Encoding UTF8
  if ($BackupRoot -and (Test-Path -LiteralPath $BackupRoot)) {
    foreach ($name in $AllowedFiles + @('workshop-update.json')) {
      $backup = Join-Path $BackupRoot $name
      if (Test-Path -LiteralPath $backup) { Copy-Item -LiteralPath $backup -Destination (Join-Path $InstallRoot $name) -Force }
    }
  }
  Write-Host $message -ForegroundColor Red
  if (-not $NonInteractive) { Read-Host 'Press Enter to close' }
  exit 1
} finally {
  if ($WatcherLockHeld -and $WatcherMutex) { $WatcherMutex.ReleaseMutex(); $WatcherLockHeld = $false }
  if ($WatcherMutex) { $WatcherMutex.Dispose() }
  if ($UpdaterLockHeld -and $UpdaterMutex) { $UpdaterMutex.ReleaseMutex(); $UpdaterLockHeld = $false }
  if ($UpdaterMutex) { $UpdaterMutex.Dispose() }
  if ($StagingRoot) {
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $resolvedStage = [System.IO.Path]::GetFullPath($StagingRoot)
    if ($resolvedStage.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) {
      Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  if ($Install) { Start-PSIComponents }
}
