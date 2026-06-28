# Installs Android SDK command-line tools, platform-tools (adb), and user env vars.
# Requires: network access, ~500MB download. Run from an elevated shell only if
# setting machine-wide env vars; user-scope vars work without elevation.
$ErrorActionPreference = 'Stop'

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$cmdlineToolsDir = Join-Path $sdkRoot 'cmdline-tools\latest'
$platformTools = Join-Path $sdkRoot 'platform-tools\adb.exe'

function Write-Step($message) {
  Write-Host "==> $message"
}

function Ensure-Java {
  $java = Get-Command java -ErrorAction SilentlyContinue
  if ($java) {
    Write-Step "Java found at $($java.Source)"
    return
  }

  Write-Step 'Java not found. Installing Microsoft OpenJDK 17 via winget...'
  winget install --id Microsoft.OpenJDK.17 `
    --accept-source-agreements `
    --accept-package-agreements `
    --disable-interactivity

  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $java = Get-Command java -ErrorAction SilentlyContinue
  if (-not $java) {
    throw 'Java installation finished but java is still not on PATH. Restart your terminal and run this script again.'
  }
  Write-Step "Java installed at $($java.Source)"
}

function Ensure-CommandLineTools {
  if (Test-Path (Join-Path $cmdlineToolsDir 'bin\sdkmanager.bat')) {
    Write-Step 'Android command-line tools already installed'
    return
  }

  Write-Step "Creating SDK directory at $sdkRoot"
  New-Item -ItemType Directory -Force -Path $cmdlineToolsDir | Out-Null

  $zipPath = Join-Path $env:TEMP 'android-cmdline-tools.zip'
  $extractRoot = Join-Path $env:TEMP 'android-cmdline-tools-extract'
  $url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'

  Write-Step 'Downloading Android command-line tools...'
  Invoke-WebRequest -Uri $url -OutFile $zipPath

  if (Test-Path $extractRoot) {
    Remove-Item -Recurse -Force $extractRoot
  }
  Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

  $inner = Get-ChildItem -Path $extractRoot -Directory | Select-Object -First 1
  Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $cmdlineToolsDir -Recurse -Force

  Remove-Item -Force $zipPath
  Remove-Item -Recurse -Force $extractRoot
  Write-Step 'Command-line tools installed'
}

function Install-SdkPackages {
  $sdkmanager = Join-Path $cmdlineToolsDir 'bin\sdkmanager.bat'
  $packages = @(
    'platform-tools',
    'platforms;android-35',
    'build-tools;35.0.0',
    'emulator',
    'system-images;android-35;google_apis;x86_64'
  )

  Write-Step 'Accepting Android SDK licenses...'
  1..100 | ForEach-Object { 'y' } | & $sdkmanager --sdk_root=$sdkRoot --licenses | Out-Null

  Write-Step 'Installing Android SDK packages (this may take a few minutes)...'
  & $sdkmanager --sdk_root=$sdkRoot @packages
}

function Ensure-Avd {
  $avdManager = Join-Path $cmdlineToolsDir 'bin\avdmanager.bat'
  $avdName = 'Pixel_7_API_35'
  $avdList = & $avdManager list avd 2>$null
  if ($avdList -match $avdName) {
    Write-Step "AVD '$avdName' already exists"
    return
  }

  Write-Step "Creating Android emulator '$avdName'..."
  'no' | & $avdManager create avd `
    -n $avdName `
    -k 'system-images;android-35;google_apis;x86_64' `
    -d 'pixel_7' | Out-Null
}

function Set-AndroidEnvVars {
  Write-Step 'Setting ANDROID_HOME and PATH (user scope)...'
  [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkRoot, 'User')
  [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdkRoot, 'User')

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $pathsToAdd = @(
    (Join-Path $sdkRoot 'platform-tools'),
    (Join-Path $sdkRoot 'emulator'),
    (Join-Path $cmdlineToolsDir 'bin')
  )

  foreach ($entry in $pathsToAdd) {
    if ($userPath -notlike "*$entry*") {
      if ($userPath) { $userPath += ";$entry" } else { $userPath = $entry }
    }
  }

  [Environment]::SetEnvironmentVariable('Path', $userPath, 'User')

  $env:ANDROID_HOME = $sdkRoot
  $env:ANDROID_SDK_ROOT = $sdkRoot
  $env:Path = $userPath + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')
}

Ensure-Java
Ensure-CommandLineTools
Install-SdkPackages
Ensure-Avd
Set-AndroidEnvVars

if (-not (Test-Path $platformTools)) {
  throw "adb was not installed at $platformTools"
}

Write-Host ''
Write-Host 'Android SDK setup complete.' -ForegroundColor Green
Write-Host "ANDROID_HOME=$sdkRoot"
Write-Host "adb: $platformTools"
Write-Host ''
Write-Host 'Restart your terminal (or Cursor), then run:'
Write-Host '  pnpm dev:mobile'
Write-Host 'Press a in Expo to launch the Pixel_7_API_35 emulator.'
