# Exercises every selectable garage illustration against the isolated review project.
# The original selection is restored and all sessions are signed out.
$ErrorActionPreference = 'Stop'
if ([Security.Principal.WindowsIdentity]::GetCurrent().Name -match 'codexsandbox') { throw 'Run as the Windows owner to read encrypted sandbox credentials.' }

$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$reviewBase = 'https://jwikoldibbpxyhbdrsow.supabase.co'
$reviewPublicKey = 'sb_publishable_ehO9_cXAkXQ6fffoDmzvZA_c8erSaqP'
$credentials = @(Import-Clixml -LiteralPath (Join-Path $reviewRoot 'artifacts/apple-review-private/PSI-APPLE-REVIEW-SANDBOX-credentials.clixml'))
$sessions = @()
$customer = $null
$vehicleId = $null
$originalId = $null
$writeHeaders = $null

function Invoke-ReviewApi([string]$Path, [hashtable]$Headers, [string]$Method = 'GET', $Body = $null) {
  if (-not $Path.StartsWith('/')) { throw 'Relative sandbox path required.' }
  $arguments = @{ Uri = "$reviewBase$Path"; Method = $Method; Headers = $Headers }
  if ($null -ne $Body) {
    $arguments.ContentType = 'application/json'
    $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 5 -Compress
  }
  Invoke-RestMethod @arguments
}

function Open-ReviewSession([string]$Role) {
  $account = @($credentials | Where-Object Role -eq $Role)[0]
  if (-not $account -or $account.Project -ne 'jwikoldibbpxyhbdrsow') { throw "Missing $Role sandbox credentials." }
  $login = Invoke-ReviewApi '/auth/v1/token?grant_type=password' @{ apikey = $reviewPublicKey } 'POST' @{
    email = $account.Credential.UserName
    password = $account.Credential.GetNetworkCredential().Password
  }
  if (-not $login.access_token) { throw "$Role sandbox sign-in failed." }
  $session = @{ Id = $login.user.id; Headers = @{ apikey = $reviewPublicKey; Authorization = "Bearer $($login.access_token)" } }
  $script:sessions += $session
  $session
}

try {
  $customer = Open-ReviewSession 'Customer'
  $other = Open-ReviewSession 'Isolation test'
  $vehicles = @(Invoke-ReviewApi '/rest/v1/customer_vehicles?select=id,customer_id,registration&order=registration.asc' $customer.Headers)
  $vehicleIds = @($vehicles.id)
  $vehicleOwners = @($vehicles.customer_id)
  if ($vehicleIds.Count -lt 1 -or @($vehicleOwners | Where-Object { $_ -ne $customer.Id }).Count -ne 0) { throw 'A bounded customer-owned demo vehicle could not be verified.' }
  $vehicleId = $vehicleIds[0]

  $catalog = Get-Content -LiteralPath (Join-Path $reviewRoot 'mobile/src/lib/garage-art-catalog.ts') -Raw
  $illustrationIds = @([regex]::Matches($catalog, "id:\s*'([^']+)'\s*,\s*make") | ForEach-Object { $_.Groups[1].Value })
  if ($illustrationIds.Count -eq 0 -or @($illustrationIds | Group-Object | Where-Object Count -gt 1).Count -ne 0) { throw 'Garage illustration catalog IDs are invalid.' }

  $existing = @(Invoke-ReviewApi "/rest/v1/vehicle_display_preferences?select=vehicle_id,illustration_id&vehicle_id=eq.$vehicleId" $customer.Headers)
  $existingIds = @($existing.illustration_id | Where-Object { $_ })
  $originalId = if ($existingIds.Count -eq 1) { $existingIds[0] } else { 'porsche' }
  $writeHeaders = @{} + $customer.Headers
  $writeHeaders.Prefer = 'resolution=merge-duplicates,return=representation'

  foreach ($illustrationId in $illustrationIds) {
    $saved = @(Invoke-ReviewApi '/rest/v1/vehicle_display_preferences?on_conflict=vehicle_id&select=vehicle_id,illustration_id' $writeHeaders 'POST' @{
      vehicle_id = $vehicleId
      customer_id = $customer.Id
      illustration_id = $illustrationId
    })
    $savedVehicleIds = @($saved.vehicle_id | Where-Object { $_ })
    $savedIllustrationIds = @($saved.illustration_id | Where-Object { $_ })
    if ($savedVehicleIds.Count -ne 1 -or $savedVehicleIds[0] -ne $vehicleId -or $savedIllustrationIds.Count -ne 1 -or $savedIllustrationIds[0] -ne $illustrationId) {
      throw "Illustration '$illustrationId' did not save and read back exactly."
    }
  }

  $hidden = @(Invoke-ReviewApi "/rest/v1/vehicle_display_preferences?select=vehicle_id&vehicle_id=eq.$vehicleId" $other.Headers)
  if (@($hidden.vehicle_id | Where-Object { $_ }).Count -ne 0) { throw 'Another customer could read the selected illustration.' }

  $restored = @(Invoke-ReviewApi '/rest/v1/vehicle_display_preferences?on_conflict=vehicle_id&select=vehicle_id,illustration_id' $writeHeaders 'POST' @{
    vehicle_id = $vehicleId
    customer_id = $customer.Id
    illustration_id = $originalId
  })
  $restoredIds = @($restored.illustration_id | Where-Object { $_ })
  if ($restoredIds.Count -ne 1 -or $restoredIds[0] -ne $originalId) { throw 'The original illustration was not restored.' }

  Write-Output "PASS: all $($illustrationIds.Count) garage illustrations saved and read back in the isolated sandbox."
  Write-Output 'PASS: cross-account illustration access remained blocked.'
  Write-Output 'PASS: the original sandbox illustration was restored.'
} finally {
  if ($customer -and $vehicleId -and $originalId -and $writeHeaders) {
    try {
      $null = Invoke-ReviewApi '/rest/v1/vehicle_display_preferences?on_conflict=vehicle_id' $writeHeaders 'POST' @{
        vehicle_id = $vehicleId
        customer_id = $customer.Id
        illustration_id = $originalId
      }
    } catch { Write-Warning 'The original sandbox illustration could not be restored during cleanup.' }
  }
  foreach ($session in $sessions) {
    try { $null = Invoke-ReviewApi '/auth/v1/logout?scope=local' $session.Headers 'POST' } catch { Write-Warning 'A test session could not be signed out.' }
  }
  $credentials = $null
  $sessions = @()
}
