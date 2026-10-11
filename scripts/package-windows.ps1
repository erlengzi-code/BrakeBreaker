$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stage = Join-Path ([IO.Path]::GetTempPath()) ('brake-lab-package-' + [Guid]::NewGuid().ToString('N'))
$releaseDir = Join-Path $projectRoot 'release'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $releaseDir "BrakeLab-Windows-$stamp.zip"
Push-Location $projectRoot
try {
    Write-Host 'Running logic tests...' -ForegroundColor Cyan
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed; package was not created.' }
    Write-Host 'Building production files...' -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed; package was not created.' }
    $gameDir = Join-Path $stage 'game'
    New-Item -ItemType Directory -Path $gameDir -Force | Out-Null
    Copy-Item -Path (Join-Path $projectRoot 'dist\*') -Destination $gameDir -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-game.bat') -Destination $stage
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server.ps1') -Destination $stage
    $instructions = @'
Brake Lab - Windows standalone package

Start: double-click start-game.bat.
The launcher uses built-in Windows PowerShell to host the game locally, then opens your default browser. Windows 10/11 and a modern browser such as Edge or Chrome are required.

Quit: return to the launcher window and press Ctrl+C, or close that window.

All game files are included. Node.js, npm, and an internet connection are not required.
'@
    Set-Content -LiteralPath (Join-Path $stage 'README.txt') -Value $instructions -Encoding UTF8
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
    $sizeMB = [Math]::Round((Get-Item -LiteralPath $archive).Length / 1MB, 2)
    Write-Host "`nPackage created: $archive ($sizeMB MB)" -ForegroundColor Green
} finally {
    Pop-Location
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
