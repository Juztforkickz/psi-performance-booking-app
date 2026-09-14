$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$Config = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json
$Python = Join-Path $InstallRoot '.venv\Scripts\python.exe'
$Uploader = Join-Path $InstallRoot 'psi_uploads.py'
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$Mutex = New-Object System.Threading.Mutex($false, 'Local\PSIWorkshopAutomaticUploader')
if (-not $Mutex.WaitOne(0)) { exit 0 }

try {
  & $Python $Uploader `
    --root $Config.uploadRoot `
    --url $Config.projectUrl `
    --key $Config.publishableKey `
    --email $Config.staffEmail `
    --session-file $SessionFile `
    --manifest-inbox $Config.manifestInbox `
    --stop-file $StopFile `
    --non-interactive `
    --watch
} finally {
  $Mutex.ReleaseMutex()
  $Mutex.Dispose()
}
