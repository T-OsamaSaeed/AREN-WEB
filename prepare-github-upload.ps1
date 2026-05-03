$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetRoot = Join-Path $projectRoot "_github-upload"

if (Test-Path -LiteralPath $targetRoot) {
  Remove-Item -LiteralPath $targetRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $targetRoot | Out-Null

$rootFiles = @(
  ".env.example",
  ".gitignore",
  "index.html",
  "package-lock.json",
  "package.json",
  "prepare-github-upload.ps1",
  "README.md",
  "vite.config.js"
)

foreach ($fileName in $rootFiles) {
  $sourcePath = Join-Path $projectRoot $fileName

  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $targetRoot $fileName) -Force
  }
}

$sourceDirectories = @(
  "public",
  "src",
  "supabase"
)

foreach ($directoryName in $sourceDirectories) {
  $sourcePath = Join-Path $projectRoot $directoryName
  $destinationPath = Join-Path $targetRoot $directoryName

  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
  }
}

Write-Output "Vite source GitHub upload folder created at: $targetRoot"
Write-Output "Upload this folder to GitHub so Vercel can run npm install and npm run build."
