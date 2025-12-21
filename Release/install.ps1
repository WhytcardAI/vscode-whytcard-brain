# WhytCard Brain - Installation Script (PowerShell)
# For Windows users with Windsurf, Cursor, or VS Code

param(
    [string]$Editor = "auto"
)

Write-Host "🧠 WhytCard Brain Installer" -ForegroundColor Cyan
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host ""

# Detect editor
$detectedEditor = $Editor
if ($Editor -eq "auto") {
    Write-Host "🔍 Detecting editor..." -ForegroundColor Yellow
    
    $editors = @{
        "windsurf" = "C:\Users\$env:USERNAME\AppData\Local\Programs\Windsurf\Windsurf.exe"
        "cursor" = "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor\Cursor.exe"
        "vscode" = "C:\Users\$env:USERNAME\AppData\Local\Programs\Microsoft VS Code\Code.exe"
    }
    
    foreach ($ed in $editors.GetEnumerator()) {
        if (Test-Path $ed.Value) {
            $detectedEditor = $ed.Key
            Write-Host "✅ Found: $($ed.Key)" -ForegroundColor Green
            break
        }
    }
    
    if ($detectedEditor -eq "auto") {
        Write-Host "❌ No editor detected. Please specify: -Editor windsurf|cursor|vscode" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📦 Installing WhytCard Brain for $detectedEditor..." -ForegroundColor Cyan

# Check if VSIX exists
$vsixPath = Join-Path $PSScriptRoot "whytcard-brain.vsix"
if (-not (Test-Path $vsixPath)) {
    Write-Host "❌ Extension package not found: $vsixPath" -ForegroundColor Red
    exit 1
}

# Install extension
Write-Host ""
Write-Host "Installing extension..." -ForegroundColor Yellow

try {
    $command = switch ($detectedEditor) {
        "windsurf" { "windsurf" }
        "cursor" { "cursor" }
        "vscode" { "code" }
    }
    
    # Try to install
    & $command --install-extension $vsixPath 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Extension installed successfully!" -ForegroundColor Green
    } else {
        throw "Installation failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Failed to install extension: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "1. Open $detectedEditor" -ForegroundColor White
    Write-Host "2. Go to Extensions panel (Ctrl+Shift+X)" -ForegroundColor White
    Write-Host "3. Click '...' menu → Install from VSIX..." -ForegroundColor White
    Write-Host "4. Select: $vsixPath" -ForegroundColor White
    exit 1
}

# Post-installation instructions
Write-Host ""
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host ""

if ($detectedEditor -in @("windsurf", "cursor")) {
    Write-Host "Next Steps (Automatic Configuration):" -ForegroundColor Cyan
    Write-Host "1. Restart $detectedEditor" -ForegroundColor White
    Write-Host "2. Wait 3 seconds for the configuration prompt" -ForegroundColor White
    Write-Host "3. Click 'Configure Now' when prompted" -ForegroundColor White
    Write-Host "4. Click 'Restart Now' to complete setup" -ForegroundColor White
    Write-Host "5. ✅ You're ready to use Brain with Cascade!" -ForegroundColor Green
} else {
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Restart VS Code" -ForegroundColor White
    Write-Host "2. Ensure GitHub Copilot is installed" -ForegroundColor White
    Write-Host "3. Use @brain in Copilot Chat" -ForegroundColor White
    Write-Host "4. Or run: Brain: Install Copilot Chat Instructions" -ForegroundColor White
}

Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   - Quick Start: $PSScriptRoot\QUICKSTART.md" -ForegroundColor White
Write-Host "   - Full Guide: $PSScriptRoot\INSTALL.md" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Run 'Brain: Show MCP Status' to verify configuration" -ForegroundColor Yellow
Write-Host ""
