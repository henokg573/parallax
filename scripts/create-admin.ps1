$ErrorActionPreference = 'Stop'

$email = (Read-Host 'Admin email').Trim().ToLowerInvariant()
$displayName = (Read-Host 'Display name').Trim()
$securePassword = Read-Host 'Temporary password (minimum 12 characters)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$exitCode = 1

try {
  $env:PARALLAX_ADMIN_EMAIL = $email
  $env:PARALLAX_ADMIN_DISPLAY_NAME = $displayName
  $env:PARALLAX_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  node --env-file-if-exists=.env scripts/create-admin.mjs
  $exitCode = $LASTEXITCODE
} finally {
  Remove-Item Env:PARALLAX_ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:PARALLAX_ADMIN_DISPLAY_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:PARALLAX_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $securePassword.Dispose()
}

exit $exitCode