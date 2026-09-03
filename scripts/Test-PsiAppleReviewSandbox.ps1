# Tests and seeds the isolated review project only. No production URL is accepted.
param([switch]$UploadDemoDocuments, [switch]$TestOperations, [switch]$TestDeletionOnly)
$ErrorActionPreference = 'Stop'
if ([Security.Principal.WindowsIdentity]::GetCurrent().Name -match 'codexsandbox') { throw 'Run as the Windows owner to read encrypted sandbox credentials.' }
$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$reviewBase = 'https://jwikoldibbpxyhbdrsow.supabase.co'
# Publishable, not privileged. Keep in sync with mobile/review-environment.cjs.
$reviewPublicKey = 'sb_publishable_ehO9_cXAkXQ6fffoDmzvZA_c8erSaqP'
$reviewCredentials = @(Import-Clixml -LiteralPath (Join-Path $reviewRoot 'artifacts/apple-review-private/PSI-APPLE-REVIEW-SANDBOX-credentials.clixml'))
$reviewChecks = [Collections.Generic.List[string]]::new()
$reviewSessions = @{}

function Assert-Review($Condition, [string]$Label) {
  if (-not $Condition) { throw "FAILED: $Label" }
  $reviewChecks.Add($Label)
  Write-Output "PASS: $Label"
}
function Invoke-ReviewApi([string]$Path, [hashtable]$Headers, [string]$Method = 'GET', $Body = $null) {
  if (-not $Path.StartsWith('/')) { throw 'Relative sandbox path required.' }
  $reviewArgs = @{ Uri = "$reviewBase$Path"; Method = $Method; Headers = $Headers }
  if ($null -ne $Body) { $reviewArgs.ContentType = 'application/json'; $reviewArgs.Body = ConvertTo-Json -InputObject $Body -Depth 10 -Compress }
  $reviewResponse = Invoke-RestMethod @reviewArgs
  return $reviewResponse
}
function Assert-ReviewDenied([scriptblock]$Action, [string]$Label) {
  $denied = $false
  try { $null = & $Action } catch { $denied = [int]$_.Exception.Response.StatusCode -in @(400,401,403,404) }
  Assert-Review $denied $Label
}

try {
  foreach ($reviewAccount in $reviewCredentials) {
    if ($reviewAccount.Project -ne 'jwikoldibbpxyhbdrsow') { throw 'Credential project mismatch.' }
    $reviewLogin = Invoke-ReviewApi '/auth/v1/token?grant_type=password' @{ apikey = $reviewPublicKey } 'POST' @{
      email = $reviewAccount.Credential.UserName; password = $reviewAccount.Credential.GetNetworkCredential().Password
    }
    Assert-Review ([bool]$reviewLogin.access_token -and $reviewLogin.user.email -eq $reviewAccount.Credential.UserName) "$($reviewAccount.Role) fresh password sign-in"
    $reviewSessions[$reviewAccount.Role] = @{ Id = $reviewLogin.user.id; Headers = @{ apikey = $reviewPublicKey; Authorization = "Bearer $($reviewLogin.access_token)" } }
  }
  $customer = $reviewSessions['Customer']; $staff = $reviewSessions['Staff']; $other = $reviewSessions['Isolation test']
  if ($TestDeletionOnly) {
    $deletionTarget = @(Invoke-ReviewApi '/rest/v1/customer_profiles?select=user_id,email&email=eq.demo5%40example.invalid' $staff.Headers)
    Assert-Review ($deletionTarget.Count -eq 1 -and $deletionTarget[0].email -eq 'demo5@example.invalid') 'Deletion target is the disposable fictional customer only'
    $deletionId = $deletionTarget[0].user_id
    $deletionVehicles = @(Invoke-ReviewApi "/rest/v1/customer_vehicles?select=id&customer_id=eq.$deletionId" $staff.Headers)
    Assert-Review ($deletionVehicles.Count -eq 1) 'Disposable deletion fixture has one vehicle'
    $deletionPath = "$deletionId/vehicles/$($deletionVehicles[0].id)/deletion-rehearsal.jpg"
    $deletionFile = Join-Path $reviewRoot 'output/pdf/apple-review/demo-workshop-inspection.jpg'
    $existingDeletionFile = @(Invoke-ReviewApi "/rest/v1/vehicle_files?select=id&object_path=eq.$deletionPath" $staff.Headers)
    if ($existingDeletionFile.Count -eq 0) {
      $null = Invoke-RestMethod -Uri "$reviewBase/storage/v1/object/vehicle-documents/$deletionPath" -Method Post -Headers $staff.Headers -ContentType 'image/jpeg' -InFile $deletionFile
      $null = Invoke-ReviewApi '/rest/v1/vehicle_files' $staff.Headers 'POST' @{ customer_id=$deletionId; vehicle_id=$deletionVehicles[0].id; file_kind='repair_document'; record_source='psi_record'; bucket_id='vehicle-documents'; object_path=$deletionPath; mime_type='image/jpeg'; file_size_bytes=(Get-Item -LiteralPath $deletionFile).Length; created_by=$staff.Id }
    }
    $completion = Invoke-ReviewApi '/functions/v1/complete-account-deletion' $staff.Headers 'POST' @{ userId=$deletionId; confirmationEmail='demo5@example.invalid'; retentionReviewConfirmed=$true; staffNote='Synthetic deletion rehearsal only. No real records existed.' }
    Assert-Review ($completion.completed -eq $true -and $completion.auditWarning -eq $false) 'Sandbox account deletion completed with audit confirmation'
    Assert-Review ($completion.storageObjectsRemoved -eq 1 -and $completion.databaseSummary.vehiclesRemoved -eq 1 -and $completion.databaseSummary.databaseFilesRemoved -eq 1) 'Disposable vehicle, private file and metadata were removed'
    $remaining = @(Invoke-ReviewApi "/rest/v1/customer_profiles?select=user_id&user_id=eq.$deletionId" $staff.Headers)
    Assert-Review ($remaining.Count -eq 0) 'Deleted sandbox customer profile is no longer visible'
    Assert-ReviewDenied { Invoke-WebRequest -Uri "$reviewBase/storage/v1/object/authenticated/vehicle-documents/$deletionPath" -Headers $staff.Headers } 'Deleted private file is no longer available to staff'
    @{ Project='jwikoldibbpxyhbdrsow'; TestedAt=(Get-Date).ToUniversalTime().ToString('o'); Checks=@($reviewChecks); DeletedFixture='demo5@example.invalid' } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reviewRoot 'artifacts/apple-review-private/DELETION-acceptance-report.json')
    return
  }
  $vehicles = @(Invoke-ReviewApi '/rest/v1/customer_vehicles?select=*' $customer.Headers)
  Assert-Review ($vehicles.Count -eq 2 -and @($vehicles | Where-Object customer_id -ne $customer.Id).Count -eq 0) 'Customer sees only their two fictional vehicles'
  $otherVehicles = @(Invoke-ReviewApi '/rest/v1/customer_vehicles?select=*' $other.Headers)
  Assert-Review ($otherVehicles.Count -eq 1 -and $otherVehicles[0].registration -eq 'DEMOISO') 'Second customer sees only their own vehicle'
  $customerStaffRows = @(Invoke-ReviewApi '/rest/v1/staff_members?select=*' $customer.Headers)
  Assert-Review ($customerStaffRows.Count -eq 0) 'Customer cannot read the staff allowlist'
  $staffVehicles = @(Invoke-ReviewApi '/rest/v1/customer_vehicles?select=*' $staff.Headers)
  Assert-Review ($staffVehicles.Count -eq 3) 'Dedicated sandbox staff can access the fictional workshop records'
  $profiles = @(Invoke-ReviewApi '/rest/v1/customer_profiles?select=user_id' $customer.Headers)
  Assert-Review ($profiles.Count -eq 1 -and $profiles[0].user_id -eq $customer.Id) 'Customer profile ownership is enforced by RLS'
  $invoices = @(Invoke-ReviewApi '/rest/v1/invoices?select=*' $customer.Headers)
  Assert-Review ($invoices.Count -eq 1 -and $invoices[0].amount_cents -eq 0 -and $invoices[0].currency -eq 'AUD') 'Demo invoice is zero AUD and belongs to the reviewer'
  $otherInvoices = @(Invoke-ReviewApi '/rest/v1/invoices?select=*' $other.Headers)
  Assert-Review ($otherInvoices.Count -eq 0) 'Second customer cannot see reviewer invoices'
  Assert-ReviewDenied { Invoke-ReviewApi '/rest/v1/customer_profiles?select=*' @{ apikey = $reviewPublicKey } } 'Anonymous access to customer data is denied'
  $authSettings = Invoke-ReviewApi '/auth/v1/settings' @{ apikey = $reviewPublicKey }
  Assert-Review ($authSettings.disable_signup -eq $true -and $authSettings.external.anonymous_users -ne $true) 'Server settings keep public and anonymous registration disabled'

  if ($TestOperations) {
    foreach ($function in @('invite-customer', 'complete-account-deletion', 'process-booking-integrations')) {
      Assert-ReviewDenied { Invoke-ReviewApi "/functions/v1/$function" @{ apikey = $reviewPublicKey } 'POST' @{} } "Anonymous $function request is denied"
      Assert-ReviewDenied { Invoke-ReviewApi "/functions/v1/$function" @{ apikey = $reviewPublicKey; Authorization = 'Bearer invalid-token' } 'POST' @{} } "Invalid token cannot call $function"
    }
    Assert-ReviewDenied { Invoke-ReviewApi '/functions/v1/invite-customer' $customer.Headers 'POST' @{ email = 'demo5@example.invalid' } } 'Customer cannot approve invitations'
    Assert-ReviewDenied { Invoke-ReviewApi '/functions/v1/complete-account-deletion' $customer.Headers 'POST' @{} } 'Customer cannot perform staff account deletion'
    Assert-ReviewDenied { Invoke-ReviewApi '/functions/v1/invite-customer' $staff.Headers 'POST' @{ email = 'not-a-review-address@gmail.com' } } 'Sandbox staff cannot invite real external addresses'
    $invited = Invoke-ReviewApi '/functions/v1/invite-customer' $staff.Headers 'POST' @{ email = 'demo5@example.invalid' }
    Assert-Review ($invited.invitation.email -eq 'demo5@example.invalid') 'Sandbox staff can approve a bounded fictional invitation'
    $reviewBookings = @(Invoke-ReviewApi '/rest/v1/booking_requests?select=id' $customer.Headers)
    $delivery = Invoke-ReviewApi '/functions/v1/process-booking-integrations' $customer.Headers 'POST' @{ bookingId = $reviewBookings[0].id }
    Assert-Review ($delivery.reviewSandbox -eq $true -and $delivery.processed -eq 0 -and $delivery.readiness.emailConfigured -eq $false -and $delivery.readiness.calendarConfigured -eq $false) 'Customer workflow explicitly blocks external email and Calendar delivery'
    Assert-ReviewDenied { Invoke-ReviewApi '/functions/v1/process-booking-integrations' $other.Headers 'POST' @{ bookingId = $reviewBookings[0].id } } 'Another customer cannot operate on the reviewer booking'
    $staffDelivery = Invoke-ReviewApi '/functions/v1/process-booking-integrations' $staff.Headers 'POST' @{ limit = 10 }
    Assert-Review ($staffDelivery.reviewSandbox -eq $true -and $staffDelivery.processed -eq 0) 'Sandbox staff queue never claims real delivery'
  }

  if ($UploadDemoDocuments) {
    $vehicle = @($vehicles | Where-Object registration -eq 'DEMO001')[0]
    $dyno = @(Invoke-ReviewApi '/rest/v1/dyno_records?select=*' $customer.Headers)[0]
    $documentSpecs = @(
      @{ File = 'demo-workshop-inspection.jpg'; Kind = 'repair_document' },
      @{ File = 'demo-dyno-graph.jpg'; Kind = 'dyno_graph'; Dyno = $dyno.id },
      @{ File = 'demo-invoice-not-payable.jpg'; Kind = 'invoice'; Invoice = $invoices[0].id }
    )
    foreach ($spec in $documentSpecs) {
      $path = "$($customer.Id)/vehicles/$($vehicle.id)/apple-review/$($spec.File)"
      $local = Join-Path $reviewRoot "output/pdf/apple-review/$($spec.File)"
      $existing = @(Invoke-ReviewApi "/rest/v1/vehicle_files?select=id&object_path=eq.$path" $staff.Headers)
      if ($existing.Count -eq 0) {
        $null = Invoke-RestMethod -Uri "$reviewBase/storage/v1/object/vehicle-documents/$path" -Method Post -Headers $staff.Headers -ContentType 'image/jpeg' -InFile $local
        $metadata = @{ customer_id = $customer.Id; vehicle_id = $vehicle.id; file_kind = $spec.Kind; record_source = 'psi_record'; bucket_id = 'vehicle-documents'; object_path = $path; mime_type = 'image/jpeg'; file_size_bytes = (Get-Item -LiteralPath $local).Length; created_by = $staff.Id }
        if ($spec.Dyno) { $metadata.dyno_record_id = $spec.Dyno }
        if ($spec.Invoice) { $metadata.invoice_id = $spec.Invoice }
        $null = Invoke-ReviewApi '/rest/v1/vehicle_files' $staff.Headers 'POST' $metadata
      }
      $imageResponse = Invoke-WebRequest -Uri "$reviewBase/storage/v1/object/authenticated/vehicle-documents/$path" -Headers $customer.Headers
      Assert-Review ($imageResponse.StatusCode -eq 200 -and $imageResponse.RawContentLength -gt 1000) "Reviewer can open private $($spec.Kind)"
      Assert-ReviewDenied { Invoke-WebRequest -Uri "$reviewBase/storage/v1/object/authenticated/vehicle-documents/$path" -Headers $other.Headers } "Other customer cannot open private $($spec.Kind)"
      Assert-ReviewDenied { Invoke-WebRequest -Uri "$reviewBase/storage/v1/object/public/vehicle-documents/$path" } "No public URL for $($spec.Kind)"
    }
  }
  $report = @{ Project = 'jwikoldibbpxyhbdrsow'; TestedAt = (Get-Date).ToUniversalTime().ToString('o'); Checks = @($reviewChecks); LiveProjectChanged = $false }
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reviewRoot 'artifacts/apple-review-private/SANDBOX-acceptance-report.json')
} finally {
  foreach ($session in $reviewSessions.Values) {
    try { $null = Invoke-ReviewApi '/auth/v1/logout?scope=local' $session.Headers 'POST' } catch { Write-Warning 'A test session could not be signed out; review before sharing credentials.' }
  }
  $reviewSessions.Clear()
  $reviewCredentials = $null
  $reviewLogin = $null
}
