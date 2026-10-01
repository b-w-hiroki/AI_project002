$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputRoot = Join-Path $repoRoot "dist-local"
if (-not $outputRoot.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe local portal output: $outputRoot"
}

if (Test-Path -LiteralPath $outputRoot) {
  Remove-Item -LiteralPath $outputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $outputRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot "index.html") -Destination (Join-Path $outputRoot "index.html")

$games = @(
  "potion-workshop",
  "side-scroller",
  "sangoku-tap",
  "fist-legend",
  "karma-quest",
  "color-match"
)

foreach ($game in $games) {
  $gameRoot = Join-Path $repoRoot "games\$game"
  Push-Location $gameRoot
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "$game build failed" }
  } finally {
    Pop-Location
  }

  $destination = Join-Path $outputRoot $game
  New-Item -ItemType Directory -Path $destination | Out-Null
  Copy-Item -Path (Join-Path $gameRoot "dist\*") -Destination $destination -Recurse -Force
}

Write-Output "Local six-game portal: $outputRoot"
