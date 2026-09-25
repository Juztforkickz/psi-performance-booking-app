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

  $UploaderExitCode = $LASTEXITCODE
  if (-not (Test-Path -LiteralPath $StopFile)) {
    $Message = if ($UploaderExitCode -eq 3) {
      'PSI automatic uploads need a fresh staff sign-in. Open PSI Workshop Uploads and choose Sign in and start automatic watching.'
    } else {
      "PSI automatic uploads stopped unexpectedly (exit code $UploaderExitCode). Open PSI Workshop Uploads and restart background sync."
    }
    Set-Content -LiteralPath (Join-Path $InstallRoot 'last-error.log') -Value $Message -Encoding UTF8
  }
} finally {
  $Mutex.ReleaseMutex()
  $Mutex.Dispose()
}
