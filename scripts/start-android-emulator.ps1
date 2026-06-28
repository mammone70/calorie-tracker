# Ensures the Pixel_7_API_35 emulator is running and ready before Expo connects.
$ErrorActionPreference = 'Stop'

$AvdName = 'Pixel_7_API_35'
$sdkRoot = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $sdkRoot) {
  $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$adb = Join-Path $sdkRoot 'platform-tools\adb.exe'
$emulator = Join-Path $sdkRoot 'emulator\emulator.exe'

if (-not (Test-Path $adb)) {
  throw "adb not found at $adb. Run: pnpm setup:android"
}
if (-not (Test-Path $emulator)) {
  throw "emulator not found at $emulator. Run: pnpm setup:android"
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')

& $adb start-server | Out-Null

function Test-EmulatorReady {
  $devices = & $adb devices 2>&1 | Select-String 'emulator-\d+\s+device'
  if (-not $devices) { return $false }
  $booted = & $adb shell getprop sys.boot_completed 2>$null
  return ($booted -match '1')
}

if (Test-EmulatorReady) {
  Write-Host "Android emulator is already running."
  exit 0
}

Write-Host "Starting Android emulator ($AvdName)..."
$emuProcess = Start-Process -FilePath $emulator -ArgumentList @('-avd', $AvdName, '-no-snapshot-load') -PassThru -WindowStyle Normal

Write-Host "Waiting for emulator to boot (this can take 30-60 seconds)..."
& $adb wait-for-device

$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  if (Test-EmulatorReady) {
    Write-Host "Emulator is ready."
    exit 0
  }
  Start-Sleep -Seconds 2
}

if ($emuProcess -and -not $emuProcess.HasExited) {
  Stop-Process -Id $emuProcess.Id -Force -ErrorAction SilentlyContinue
}

throw "Emulator failed to become ready within 3 minutes."
