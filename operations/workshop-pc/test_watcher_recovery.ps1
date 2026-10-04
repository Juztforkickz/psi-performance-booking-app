$ErrorActionPreference = 'Stop'
$SourceRoot = $PSScriptRoot
$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('PSIWatcherTest-' + [Guid]::NewGuid().ToString('N'))
$ResolvedTestRoot = [System.IO.Path]::GetFullPath($TestRoot)
$ResolvedTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $ResolvedTestRoot.StartsWith($ResolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The watcher test directory must stay inside Windows temporary storage.'
}

$previousPython = $env:PSI_WORKSHOP_TEST_PYTHON
$previousUploader = $env:PSI_WORKSHOP_TEST_UPLOADER
$previousMutex = $env:PSI_WORKSHOP_TEST_MUTEX
$previousRetry = $env:PSI_WORKSHOP_TEST_RETRY_SECONDS
$previousRoot = $env:PSI_WATCHER_TEST_ROOT

try {
  New-Item -ItemType Directory -Path $TestRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $SourceRoot 'Start-PSIWorkshopWatcher.ps1') -Destination $TestRoot
  @{
    uploadRoot = $TestRoot
    projectUrl = 'https://example.supabase.co'
    publishableKey = 'test-publishable-key'
    staffEmail = 'staff@example.invalid'
    manifestInbox = $TestRoot
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $TestRoot 'config.json') -Encoding UTF8

  $fakePython = Join-Path $TestRoot 'fake-python.cmd'
  @'
@echo off
if not exist "%PSI_WATCHER_TEST_ROOT%\attempt.txt" (
  >"%PSI_WATCHER_TEST_ROOT%\attempt.txt" echo 1
  >"%PSI_WORKSHOP_ERROR_LOG%" echo PSI Workshop Uploads: simulated temporary connection failure
  exit /b 1
)
>"%PSI_WATCHER_TEST_ROOT%\attempt.txt" echo 2
>"%PSI_WATCHER_TEST_ROOT%\watcher.stop" echo stop
exit /b 0
'@ | Set-Content -LiteralPath $fakePython -Encoding ASCII

  $env:PSI_WORKSHOP_TEST_PYTHON = $fakePython
  $env:PSI_WORKSHOP_TEST_UPLOADER = (Join-Path $TestRoot 'fake-uploader.py')
  $env:PSI_WORKSHOP_TEST_MUTEX = 'Local\PSIWorkshopWatcherTest' + [Guid]::NewGuid().ToString('N')
  $env:PSI_WORKSHOP_TEST_RETRY_SECONDS = '0'
  $env:PSI_WATCHER_TEST_ROOT = $TestRoot

  & (Join-Path $TestRoot 'Start-PSIWorkshopWatcher.ps1')

  $attempt = (Get-Content -LiteralPath (Join-Path $TestRoot 'attempt.txt') -Raw).Trim()
  if ($attempt -ne '2') { throw 'The watcher did not restart after the simulated temporary failure.' }
  if (Test-Path -LiteralPath (Join-Path $TestRoot 'last-error.log')) { throw 'A recovered temporary failure still shows as active.' }
  $detail = Get-Content -LiteralPath (Join-Path $TestRoot 'last-recovered-error.log') -Raw
  if ($detail -notmatch 'simulated temporary connection failure') { throw 'The exact uploader failure was not preserved.' }
  Write-Output 'Watcher recovery test passed.'
} finally {
  $env:PSI_WORKSHOP_TEST_PYTHON = $previousPython
  $env:PSI_WORKSHOP_TEST_UPLOADER = $previousUploader
  $env:PSI_WORKSHOP_TEST_MUTEX = $previousMutex
  $env:PSI_WORKSHOP_TEST_RETRY_SECONDS = $previousRetry
  $env:PSI_WATCHER_TEST_ROOT = $previousRoot
  if (Test-Path -LiteralPath $ResolvedTestRoot) {
    Remove-Item -LiteralPath $ResolvedTestRoot -Recurse -Force
  }
}
