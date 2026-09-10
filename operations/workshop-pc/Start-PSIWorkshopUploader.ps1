$ErrorActionPreference = 'Stop'
$InstallRoot = $PSScriptRoot
$Config = Get-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json
$Python = Join-Path $InstallRoot '.venv\Scripts\python.exe'
$Uploader = Join-Path $InstallRoot 'psi_uploads.py'

Write-Host ''
Write-Host 'PSI Workshop Uploads'
Write-Host '1. Add a confirmed job folder'
Write-Host '2. Upload once'
Write-Host '3. Keep watching for new files'
$Choice = Read-Host 'Choose 1, 2 or 3'

if ($Choice -eq '1') {
  Add-Type -AssemblyName System.Windows.Forms
  $Picker = New-Object System.Windows.Forms.OpenFileDialog
  $Picker.Title = 'Choose the PSI job file downloaded from the staff portal'
  $Picker.Filter = 'PSI job files (*.json)|*.json'
  if ($Picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
  & $Python $Uploader --root $Config.uploadRoot --add-job $Picker.FileName
} elseif ($Choice -eq '2') {
  & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail
} elseif ($Choice -eq '3') {
  & $Python $Uploader --root $Config.uploadRoot --url $Config.projectUrl --key $Config.publishableKey --email $Config.staffEmail --watch
} else {
  throw 'Choose 1, 2 or 3.'
}

Read-Host 'Press Enter to close'
