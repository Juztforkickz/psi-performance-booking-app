param([switch]$ReadForAutomation, [string]$TransportPublicKeyXml)

$ErrorActionPreference = 'Stop'
if ([Security.Principal.WindowsIdentity]::GetCurrent().Name -match 'codexsandbox') {
  throw 'Run as the signed-in Windows owner so DPAPI encryption is recoverable. No secrets were generated.'
}
$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$reviewDirectory = Join-Path $reviewRoot 'artifacts/apple-review-private'
$reviewFile = Join-Path $reviewDirectory 'PSI-APPLE-REVIEW-SANDBOX-credentials.clixml'

if ($ReadForAutomation) {
  # Private automation pipe only. Never send this output to chat or a public log.
  $saved = Import-Clixml -LiteralPath $reviewFile
  if (-not $TransportPublicKeyXml) { throw 'An ephemeral public encryption key is required; plaintext output is prohibited.' }
  $reviewTransport = [Security.Cryptography.RSA]::Create()
  try {
    $reviewTransport.FromXmlString($TransportPublicKeyXml)
    $saved | ForEach-Object {
      $reviewPlainBytes = [Text.Encoding]::UTF8.GetBytes($_.Credential.GetNetworkCredential().Password)
      $reviewCipher = $reviewTransport.Encrypt($reviewPlainBytes, [Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)
      [pscustomobject]@{ role = $_.Role; email = $_.Credential.UserName; encryptedPassword = [Convert]::ToBase64String($reviewCipher) }
      [Array]::Clear($reviewPlainBytes, 0, $reviewPlainBytes.Length)
    } | ConvertTo-Json -Compress
  } finally { $reviewTransport.Dispose() }
  exit
}

if (Test-Path -LiteralPath $reviewFile) { throw 'Credentials already exist. Refusing to overwrite or rotate them.' }
New-Item -ItemType Directory -Path $reviewDirectory -Force | Out-Null
$reviewIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $reviewDirectory /inheritance:r /grant:r "${reviewIdentity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the private credential directory.' }

$reviewRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $reviewCredentials = foreach ($reviewAccount in @(
    @{ Role = 'Customer'; Email = 'psiappreview@gmail.com' },
    @{ Role = 'Staff'; Email = 'psiappreview+staff@gmail.com' },
    @{ Role = 'Isolation test'; Email = 'psiappreview+isolation@gmail.com' }
  )) {
    $reviewBytes = New-Object byte[] 24
    $reviewRandom.GetBytes($reviewBytes)
    $reviewPassword = 'Ps!7' + [Convert]::ToBase64String($reviewBytes)
    [pscustomobject]@{
      Role = $reviewAccount.Role
      Project = 'jwikoldibbpxyhbdrsow'
      Credential = New-Object Management.Automation.PSCredential($reviewAccount.Email, (ConvertTo-SecureString $reviewPassword -AsPlainText -Force))
    }
  }
  # Windows DPAPI encryption ties these secrets to this Windows user and machine.
  $reviewCredentials | Export-Clixml -LiteralPath $reviewFile
} finally {
  $reviewRandom.Dispose()
  $reviewPassword = $null
  $reviewCredentials = $null
}
Write-Output 'Created three separate, strong sandbox credentials, encrypted for this Windows account. No passwords printed.'
Write-Output $reviewFile
