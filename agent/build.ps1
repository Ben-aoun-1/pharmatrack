# PharmTrack Agent — Build Script
# Run this from the agent/ directory in PowerShell
# Requires: Python 3.11+ installed and on PATH

Write-Host "=== PharmTrack Agent Builder ===" -ForegroundColor Cyan

# Step 1: Create virtual environment
Write-Host "`n[1/5] Creating virtual environment..." -ForegroundColor Yellow
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Step 2: Upgrade pip
Write-Host "`n[2/5] Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Step 3: Install dependencies
Write-Host "`n[3/5] Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
pip install pyinstaller==6.10.0

# Step 4: Clean previous build
Write-Host "`n[4/5] Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }

# Step 5: Build
Write-Host "`n[5/5] Building PharmTrack.exe..." -ForegroundColor Yellow
pyinstaller pharmtrack.spec --clean

# Result
if (Test-Path "dist\PharmTrack.exe") {
    $size = (Get-Item "dist\PharmTrack.exe").length / 1MB
    Write-Host "`n✅ Build successful!" -ForegroundColor Green
    Write-Host "   Output: agent\dist\PharmTrack.exe" -ForegroundColor Green
    Write-Host ("   Size: {0:N1} MB" -f $size) -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Test by running dist\PharmTrack.exe on this machine" -ForegroundColor White
    Write-Host "  2. Upload dist\PharmTrack.exe to Supabase Storage" -ForegroundColor White
    Write-Host "  3. Share the download link with pharmacies" -ForegroundColor White
} else {
    Write-Host "`n❌ Build failed — check errors above" -ForegroundColor Red
}
