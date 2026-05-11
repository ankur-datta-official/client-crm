param(
  [string]$OutputDir = "deploy-upload-ready",
  [string]$DateStamp = $(Get-Date -Format "yyyy-MM-dd")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot $OutputDir
$stagingRoot = Join-Path $outputRoot "staging"
$zipPath = Join-Path $outputRoot "crm-next-deploy-$DateStamp.zip"

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null

$excludeDirs = @(
  ".git",
  ".next",
  ".vscode",
  "deploy-upload-ready",
  "node_modules"
)

$excludeFiles = @(
  ".env.local",
  "*.log",
  "tsconfig.tsbuildinfo"
)

$robocopyArgs = @(
  $projectRoot,
  $stagingRoot,
  "/MIR",
  "/R:1",
  "/W:1",
  "/NFL",
  "/NDL",
  "/NJH",
  "/NJS",
  "/NP",
  "/XD"
) + $excludeDirs + @(
  "/XF"
) + $excludeFiles

& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

$archiveItems = Get-ChildItem -LiteralPath $stagingRoot -Force
if (-not $archiveItems) {
  throw "No files were staged for the deploy archive."
}

Compress-Archive -LiteralPath $archiveItems.FullName -DestinationPath $zipPath -Force

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $badEntries = $zip.Entries | Where-Object {
    $_.FullName -eq "." -or
    $_.FullName -like "./*" -or
    $_.FullName -like ".\\*"
  }

  if ($badEntries) {
    throw "Zip archive contains invalid dot-path entries."
  }
}
finally {
  $zip.Dispose()
}

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Output "Created deploy archive: $zipPath"
