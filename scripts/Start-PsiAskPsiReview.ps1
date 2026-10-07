# Runs the existing app locally against the isolated review sandbox only.
param([switch]$Build)
$ErrorActionPreference = 'Stop'
$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$reviewMobile = Join-Path $reviewRoot 'mobile'
$reviewOutput = Join-Path $reviewRoot 'artifacts/ask-psi-private-review'
if ($Build) {
  $reviewProfile = (Get-Content -LiteralPath (Join-Path $reviewMobile 'eas.json') -Raw | ConvertFrom-Json).build.'apple-review'.env
  if ($reviewProfile.EXPO_PUBLIC_SUPABASE_URL -ne 'https://jwikoldibbpxyhbdrsow.supabase.co' -or $reviewProfile.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW -ne 'true') { throw 'Private sandbox profile required.' }
  $reviewSavedEnvironment = @{}
  try {
    foreach ($entry in Get-ChildItem Env: | Where-Object Name -like 'EXPO_PUBLIC_*') {
      $reviewSavedEnvironment[$entry.Name] = $entry.Value
      [Environment]::SetEnvironmentVariable($entry.Name, $null, 'Process')
    }
    foreach ($entry in $reviewProfile.PSObject.Properties) {
      if (-not $reviewSavedEnvironment.ContainsKey($entry.Name)) { $reviewSavedEnvironment[$entry.Name] = [Environment]::GetEnvironmentVariable($entry.Name, 'Process') }
      [Environment]::SetEnvironmentVariable($entry.Name, $entry.Value, 'Process')
    }
    foreach ($entry in @{ EXPO_PUBLIC_PSI_GOOGLE_REVIEW='false'; EXPO_PUBLIC_PSI_DEMO_MODE_ENABLED='false'; EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST='false'; EXPO_NO_DOTENV='1' }.GetEnumerator()) {
      if (-not $reviewSavedEnvironment.ContainsKey($entry.Key)) { $reviewSavedEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process') }
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
    Push-Location -LiteralPath $reviewMobile
    try {
      & pnpm exec expo export --platform web --output-dir '../artifacts/ask-psi-private-review/web'
      if ($LASTEXITCODE -ne 0) { throw 'Private web export failed.' }
    } finally { Pop-Location }
    @{ project='jwikoldibbpxyhbdrsow'; privatePreview=$true; builtAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reviewOutput 'review-build.json')
  } finally {
    foreach ($entry in $reviewSavedEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $reviewOutput 'review-build.json'))) { throw 'Run with -Build once to prepare the private preview.' }
$reviewCredentials = @(Import-Clixml -LiteralPath (Join-Path $reviewRoot 'artifacts/apple-review-private/PSI-APPLE-REVIEW-SANDBOX-credentials.clixml'))
$reviewAccounts = @($reviewCredentials | Where-Object Role -in @('Customer','Staff') | ForEach-Object {
  if ($_.Project -ne 'jwikoldibbpxyhbdrsow') { throw 'Sandbox credential project mismatch.' }
  @{ Project=$_.Project; Role=$_.Role; Email=$_.Credential.UserName; Password=$_.Credential.GetNetworkCredential().Password }
})
try {
  ConvertTo-Json -InputObject $reviewAccounts -Compress | & node (Join-Path $PSScriptRoot 'serve-ask-psi-review.mjs')
} finally { $reviewAccounts = $null; $reviewCredentials = $null }
