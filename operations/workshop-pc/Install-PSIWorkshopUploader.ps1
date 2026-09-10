param(
  [Parameter(Mandatory = $true)][string]$ProjectUrl,
  [Parameter(Mandatory = $true)][string]$PublishableKey,
  [Parameter(Mandatory = $true)][string]$StaffEmail,
  [string]$UploadRoot = 'C:\PSI Uploads'
)

$ErrorActionPreference = 'Stop'
if ($ProjectUrl -notmatch '^https://[a-z0-9]+\.supabase\.co/?$') { throw 'Use the exact HTTPS Supabase project URL.' }
if ($PublishableKey.StartsWith('sb_secret_')) { throw 'Use the publishable key. Never install a secret or service-role key.' }
if ($StaffEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Enter the PSI staff email address.' }

$InstallRoot = Join-Path $env:LOCALAPPDATA 'PSI Performance\Workshop Uploader'
New-Item -ItemType Directory -Force -Path $InstallRoot, $UploadRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'psi_uploads.py') -Destination $InstallRoot -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'requirements.txt') -Destination $InstallRoot -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-PSIWorkshopUploader.ps1') -Destination $InstallRoot -Force

$Python = (Get-Command python -ErrorAction Stop).Source
& $Python -m venv (Join-Path $InstallRoot '.venv')
$VenvPython = Join-Path $InstallRoot '.venv\Scripts\python.exe'
& $VenvPython -m pip install --disable-pip-version-check -r (Join-Path $InstallRoot 'requirements.txt')

@{
  projectUrl = $ProjectUrl.TrimEnd('/')
  publishableKey = $PublishableKey
  staffEmail = $StaffEmail.Trim().ToLowerInvariant()
  uploadRoot = [System.IO.Path]::GetFullPath($UploadRoot)
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'config.json') -Encoding utf8

$Desktop = [Environment]::GetFolderPath('Desktop')
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut((Join-Path $Desktop 'PSI Workshop Uploads.lnk'))
$Shortcut.TargetPath = (Get-Command powershell.exe).Source
$Shortcut.Arguments = '-NoProfile -File "' + (Join-Path $InstallRoot 'Start-PSIWorkshopUploader.ps1') + '"'
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = 'Add verified PSI jobs and upload workshop files'
$Shortcut.Save()

Write-Host 'PSI Workshop Uploads is installed for this Windows user.'
Write-Host 'Use the desktop shortcut. Login still requires the PSI email code and authenticator.'
