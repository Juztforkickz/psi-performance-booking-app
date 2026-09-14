$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$Config = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json
$Python = Join-Path $InstallRoot '.venv\Scripts\python.exe'
$Uploader = Join-Path $InstallRoot 'psi_uploads.py'
$Watcher = Join-Path $InstallRoot 'Start-PSIWorkshopWatcher.ps1'
$SessionFile = Join-Path $InstallRoot 'session.dpapi'
$StopFile = Join-Path $InstallRoot 'watcher.stop'

Write-Host ''
Write-Host 'PSI Workshop Uploads'
Write-Host '1. Sign in and start automatic watching'
Write-Host '2. Create a phone / walk-in job'
Write-Host '3. Add a downloaded job folder file (fallback)'
Write-Host '4. Upload and sync once'
Write-Host '5. Forget the remembered staff sign-in'
$Choice = Read-Host 'Choose 1, 2, 3, 4 or 5'

if ($Choice -eq '1') {
  & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --stop-file $StopFile --manifest-inbox $Config.manifestInbox
  if ($LASTEXITCODE -eq 0) {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Watcher)
    Write-Host 'Automatic watching is running in the background and will start with Windows.'
  }
} elseif ($Choice -eq '2') {
  & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --manual-job
} elseif ($Choice -eq '3') {
  Add-Type -AssemblyName System.Windows.Forms
  $Picker = New-Object System.Windows.Forms.OpenFileDialog
  $Picker.Title = 'Choose the PSI job file downloaded from the staff portal'
  $Picker.Filter = 'PSI job files (*.json)|*.json'
  if ($Picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
  & $Python $Uploader --root $Config.uploadRoot --add-job $Picker.FileName
} elseif ($Choice -eq '4') {
  & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --session-file $SessionFile --manifest-inbox $Config.manifestInbox
} elseif ($Choice -eq '5') {
  & $Python $Uploader --root $Config.uploadRoot --session-file $SessionFile --stop-file $StopFile --forget-session
} else {
  throw 'Choose 1, 2, 3, 4 or 5.'
}

Read-Host 'Press Enter to close'
