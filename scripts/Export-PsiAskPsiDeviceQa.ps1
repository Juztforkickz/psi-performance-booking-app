# Local bundle preparation only. No native build upload, OTA or submission.
param([ValidateSet('ios','android','all')][string]$Platform = 'all')
$ErrorActionPreference = 'Stop'
$qaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qaMobile = Join-Path $qaRoot 'mobile'
$qaProfiles = (Get-Content -LiteralPath (Join-Path $qaMobile 'eas.json') -Raw | ConvertFrom-Json).build
$qaEnvironment = @{}
foreach ($qaProfile in @($qaProfiles.'apple-review', $qaProfiles.'ask-psi-device-test')) {
  foreach ($qaEntry in $qaProfile.env.PSObject.Properties) { $qaEnvironment[$qaEntry.Name] = $qaEntry.Value }
}
if ($qaProfiles.'ask-psi-device-test'.extends -ne 'apple-review' -or $qaEnvironment.EXPO_PUBLIC_SUPABASE_URL -ne 'https://jwikoldibbpxyhbdrsow.supabase.co') { throw 'Pinned private sandbox profile required.' }
$qaSavedEnvironment = @{}
try {
  foreach ($qaEntry in Get-ChildItem Env: | Where-Object Name -like 'EXPO_PUBLIC_*') {
    $qaSavedEnvironment[$qaEntry.Name] = $qaEntry.Value
    [Environment]::SetEnvironmentVariable($qaEntry.Name, $null, 'Process')
  }
  $qaEnvironment.EXPO_NO_DOTENV = '1'
  $qaEnvironment.EAS_BUILD_PROFILE = 'ask-psi-device-test'
  foreach ($qaEntry in $qaEnvironment.GetEnumerator()) {
    if (-not $qaSavedEnvironment.ContainsKey($qaEntry.Key)) { $qaSavedEnvironment[$qaEntry.Key] = [Environment]::GetEnvironmentVariable($qaEntry.Key, 'Process') }
    [Environment]::SetEnvironmentVariable($qaEntry.Key, $qaEntry.Value, 'Process')
  }
  Push-Location -LiteralPath $qaMobile
  try {
    & node -e "const config=require('./app.config.js')({config:require('./app.json').expo}); if(config.runtimeVersion!=='1.0.0-ask-psi-device-test-1'||config.extra.psiAskPsiDeviceQa!==true)throw Error('Private runtime missing'); console.log('Private sandbox and runtime verified');"
    if ($LASTEXITCODE -ne 0) { throw 'Private configuration validation failed.' }
    & pnpm exec expo export --platform $Platform --output-dir '../artifacts/ask-psi-private-review/device-qa'
    if ($LASTEXITCODE -ne 0) { throw 'Private bundle export failed.' }
  } finally { Pop-Location }
} finally {
  foreach ($qaEntry in $qaSavedEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($qaEntry.Key, $qaEntry.Value, 'Process') }
}
