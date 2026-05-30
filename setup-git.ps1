# One-shot setup: initialize the repo and push to GitHub.
# Run this from PowerShell inside this folder:
#   .\setup-git.ps1
#
# It is idempotent — safe to re-run. If the repo is already initialized it
# skips the init step and only commits/pushes new changes.

$ErrorActionPreference = "Stop"

# Identify yourself once (no-op if already configured globally)
git config user.email "sahajgaur2005@gmail.com"
git config user.name  "sahaj"

if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repo..." -ForegroundColor Cyan
    git init -b main | Out-Null
} else {
    Write-Host "Repo already initialized." -ForegroundColor DarkGray
}

# Wire up the remote (replace if it points elsewhere)
$existing = git remote get-url origin 2>$null
if (-not $existing) {
    git remote add origin https://github.com/sahaj645/cystar.git
    Write-Host "Added origin -> sahaj645/cystar" -ForegroundColor Cyan
} elseif ($existing -ne "https://github.com/sahaj645/cystar.git") {
    git remote set-url origin https://github.com/sahaj645/cystar.git
    Write-Host "Updated origin -> sahaj645/cystar" -ForegroundColor Yellow
}

# Stage everything respected by .gitignore
git add .

# Only commit if something actually changed
$staged = git diff --cached --name-only
if ($staged) {
    $msg = "feat: complete selective disclosure module

Backend (FastAPI):
  - Ed25519 signatures + salted SHA-256 Merkle trees
  - JWT auth (register, login, /me), bcrypt hashing
  - Credential issuance, listing, selective sharing with expiring tokens
  - Public verification endpoint, rate-limited via slowapi
  - 67/67 tests passing (49 crypto + 18 API integration)

Frontend (Next.js 14 + TypeScript + Tailwind + shadcn UI):
  - Landing, login, register, dashboard
  - Dynamic-row credential issuance
  - Selective disclosure with checkboxes, expiry presets, QR-code share modal
  - Public verification page with verdict + crypto explainer

Infrastructure:
  - Dockerfiles + docker-compose for full-stack local dev
  - GitHub Actions CI: pytest, ruff, type-check, Next build
  - Docs: README, crypto-design.md, api.md, architecture.md, deployment.md"

    git commit -m $msg
    Write-Host ""
    Write-Host "Commit created." -ForegroundColor Green
} else {
    Write-Host "Nothing new to commit." -ForegroundColor DarkGray
}

# Push (Git Credential Manager will pop up if needed)
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "Done. See it live at: https://github.com/sahaj645/cystar" -ForegroundColor Green
