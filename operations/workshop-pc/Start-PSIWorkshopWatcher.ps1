$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$Config = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json
$Python = if ($env:PSI_WORKSHOP_TEST_PYTHON) { $env:PSI_WORKSHOP_TEST_PYTHON } else { Join-Path $InstallRoot '.venv\Scripts\python.exe' }
$Uploader = if ($env:PSI_WORKSHOP_TEST_UPLOADER) { $env:PSI_WORKSHOP_TEST_UPLOADER } else { Join-Path $InstallRoot 'psi_uploads.py' }
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$StopFile = Join-Path $InstallRoot 'watcher.stop'
$ErrorLog = Join-Path $InstallRoot 'last-error.log'
$DetailLog = Join-Path $InstallRoot 'last-uploader-error.log'
$RecoveredErrorLog = Join-Path $InstallRoot 'last-recovered-error.log'
$MutexName = if ($env:PSI_WORKSHOP_TEST_MUTEX) { $env:PSI_WORKSHOP_TEST_MUTEX } else { 'Local\PSIWorkshopAutomaticUploader' }
$Mutex = New-Object System.Threading.Mutex($false, $MutexName)
$MutexHeld = $false
$PreviousErrorTarget = $env:PSI_WORKSHOP_ERROR_LOG
$RetrySchedule = @(5, 15, 30, 60, 120, 300)
$ConsecutiveFailures = 0

function Get-PSIRetrySeconds([int]$failureCount) {
  if ($env:PSI_WORKSHOP_TEST_RETRY_SECONDS -match '^\d+$') {
    return [Math]::Min([int]$env:PSI_WORKSHOP_TEST_RETRY_SECONDS, 300)
  }
  $index = [Math]::Min([Math]::Max($failureCount - 1, 0), $RetrySchedule.Count - 1)
  return $RetrySchedule[$index]
}

function Get-PSIUploaderError([int]$exitCode) {
  if (Test-Path -LiteralPath $DetailLog) {
    try {
      $detail = (Get-Content -LiteralPath $DetailLog -Raw).Trim()
      if ($detail.Length -gt 1200) { return $detail.Substring(0, 1200) }
      if ($detail) { return $detail }
    } catch {}
  }
  return "The uploader exited with code $exitCode without a detailed message."
}

function Wait-PSIRetry([int]$seconds) {
  for ($remaining = $seconds; $remaining -gt 0; $remaining--) {
    if (Test-Path -LiteralPath $StopFile) { return }
    Start-Sleep -Seconds 1
  }
}

try {
  $MutexHeld = $Mutex.WaitOne(0)
  if (-not $MutexHeld) { exit 0 }
  $env:PSI_WORKSHOP_ERROR_LOG = $DetailLog

  while (-not (Test-Path -LiteralPath $StopFile)) {
    if (Test-Path -LiteralPath $DetailLog) {
      Copy-Item -LiteralPath $DetailLog -Destination $RecoveredErrorLog -Force
      Remove-Item -LiteralPath $DetailLog -Force
    }
    Remove-Item -LiteralPath $ErrorLog -Force -ErrorAction SilentlyContinue
    $startedAt = [DateTime]::UtcNow
    $uploaderExitCode = 1

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
      $uploaderExitCode = if ($null -eq $LASTEXITCODE) { 1 } else { $LASTEXITCODE }
    } catch {
      Set-Content -LiteralPath $DetailLog -Value ('PSI Workshop watcher could not start the uploader: ' + $_.Exception.Message) -Encoding UTF8
      $uploaderExitCode = 1
    }

    if (Test-Path -LiteralPath $StopFile) { break }

    if ($uploaderExitCode -eq 3) {
      Set-Content -LiteralPath $ErrorLog -Value 'PSI automatic uploads need a fresh staff sign-in. Open PSI Workshop Uploads and choose Sign in and start automatic watching.' -Encoding UTF8
      break
    }

    $runtime = [DateTime]::UtcNow - $startedAt
    if ($runtime.TotalMinutes -ge 5) { $ConsecutiveFailures = 0 }
    $ConsecutiveFailures++
    $retrySeconds = Get-PSIRetrySeconds $ConsecutiveFailures
    $detail = Get-PSIUploaderError $uploaderExitCode
    $message = "PSI automatic uploads had a temporary error and will retry automatically in $retrySeconds seconds.`r`n$detail"
    Set-Content -LiteralPath $ErrorLog -Value $message -Encoding UTF8
    Wait-PSIRetry $retrySeconds
  }
} catch {
  Set-Content -LiteralPath $ErrorLog -Value ('PSI automatic upload supervisor stopped: ' + $_.Exception.Message) -Encoding UTF8
} finally {
  if ($null -eq $PreviousErrorTarget) {
    Remove-Item Env:PSI_WORKSHOP_ERROR_LOG -ErrorAction SilentlyContinue
  } else {
    $env:PSI_WORKSHOP_ERROR_LOG = $PreviousErrorTarget
  }
  if ($MutexHeld) { $Mutex.ReleaseMutex() }
  $Mutex.Dispose()
}
