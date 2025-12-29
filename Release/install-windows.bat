@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         🧠 WhytCard Brain - Installation Windows             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check prerequisites
echo Vérification des prérequis...
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js non trouvé!
    echo    Installez Node.js 18+ depuis: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node --version') do set NODE_VERSION=%%v
echo   ✅ Node.js %NODE_VERSION%

:: Check if VSIX exists
if not exist "%~dp0whytcard-brain-1.1.2.vsix" (
    echo.
    echo ❌ Erreur: whytcard-brain-1.1.2.vsix non trouvé!
    echo    Assurez-vous que le fichier VSIX est dans le même dossier.
    pause
    exit /b 1
)

:: Detect installed editors
set "VSCODE_FOUND=0"
set "CURSOR_FOUND=0"
set "WINDSURF_FOUND=0"

where code >nul 2>&1 && set "VSCODE_FOUND=1"
where cursor >nul 2>&1 && set "CURSOR_FOUND=1"
where windsurf >nul 2>&1 && set "WINDSURF_FOUND=1"

echo Éditeurs détectés:
if "%VSCODE_FOUND%"=="1" echo   ✅ VS Code
if "%CURSOR_FOUND%"=="1" echo   ✅ Cursor
if "%WINDSURF_FOUND%"=="1" echo   ✅ Windsurf
if "%VSCODE_FOUND%"=="0" if "%CURSOR_FOUND%"=="0" if "%WINDSURF_FOUND%"=="0" (
    echo   ❌ Aucun éditeur trouvé!
    echo   Installez VS Code, Cursor ou Windsurf d'abord.
    pause
    exit /b 1
)
echo.

:: Install extension
echo ══════════════════════════════════════════════════════════════
echo  ÉTAPE 1: Installation de l'extension
echo ══════════════════════════════════════════════════════════════

if "%VSCODE_FOUND%"=="1" (
    echo.
    echo Installation pour VS Code...
    code --install-extension "%~dp0whytcard-brain-1.1.2.vsix" --force
    if !errorlevel! equ 0 (
        echo ✅ VS Code: Extension installée
    ) else (
        echo ⚠️ VS Code: Erreur d'installation
    )
)

if "%CURSOR_FOUND%"=="1" (
    echo.
    echo Installation pour Cursor...
    cursor --install-extension "%~dp0whytcard-brain-1.1.2.vsix" --force
    if !errorlevel! equ 0 (
        echo ✅ Cursor: Extension installée
    ) else (
        echo ⚠️ Cursor: Erreur d'installation
    )
)

if "%WINDSURF_FOUND%"=="1" (
    echo.
    echo Installation pour Windsurf...
    windsurf --install-extension "%~dp0whytcard-brain-1.1.2.vsix" --force
    if !errorlevel! equ 0 (
        echo ✅ Windsurf: Extension installée
    ) else (
        echo ⚠️ Windsurf: Erreur d'installation
    )
)

:: Configure MCP for Cursor
if "%CURSOR_FOUND%"=="1" (
    echo.
    echo ══════════════════════════════════════════════════════════════
    echo  ÉTAPE 2: Configuration MCP pour Cursor
    echo ══════════════════════════════════════════════════════════════
    
    set "CURSOR_MCP=%USERPROFILE%\.cursor\mcp.json"
    
    if not exist "%USERPROFILE%\.cursor" mkdir "%USERPROFILE%\.cursor"
    
    if exist "!CURSOR_MCP!" (
        echo.
        echo ⚠️ Un fichier mcp.json existe déjà pour Cursor.
        set /p "OVERWRITE=Voulez-vous le remplacer? (o/n): "
        if /i "!OVERWRITE!"=="o" (
            copy /y "%~dp0mcp_config.json" "!CURSOR_MCP!" >nul
            echo ✅ Cursor MCP configuré
        ) else (
            echo ⏭️ Configuration Cursor ignorée
        )
    ) else (
        copy "%~dp0mcp_config.json" "!CURSOR_MCP!" >nul
        echo ✅ Cursor MCP configuré
    )
)

:: Configure MCP for Windsurf
if "%WINDSURF_FOUND%"=="1" (
    echo.
    echo ══════════════════════════════════════════════════════════════
    echo  ÉTAPE 3: Configuration MCP pour Windsurf
    echo ══════════════════════════════════════════════════════════════
    
    :: Try both possible Windsurf paths
    set "WINDSURF_MCP="
    if exist "%USERPROFILE%\.codeium\windsurf" (
        set "WINDSURF_MCP=%USERPROFILE%\.codeium\windsurf\mcp_config.json"
    )
    if exist "%USERPROFILE%\.codeium\windsurf-next" (
        set "WINDSURF_MCP=%USERPROFILE%\.codeium\windsurf-next\mcp_config.json"
    )
    
    if not defined WINDSURF_MCP (
        mkdir "%USERPROFILE%\.codeium\windsurf" 2>nul
        set "WINDSURF_MCP=%USERPROFILE%\.codeium\windsurf\mcp_config.json"
    )
    
    if exist "!WINDSURF_MCP!" (
        echo.
        echo ⚠️ Un fichier mcp_config.json existe déjà pour Windsurf.
        set /p "OVERWRITE=Voulez-vous le remplacer? (o/n): "
        if /i "!OVERWRITE!"=="o" (
            copy /y "%~dp0mcp_config.json" "!WINDSURF_MCP!" >nul
            echo ✅ Windsurf MCP configuré
        ) else (
            echo ⏭️ Configuration Windsurf ignorée
        )
    ) else (
        copy "%~dp0mcp_config.json" "!WINDSURF_MCP!" >nul
        echo ✅ Windsurf MCP configuré
    )
)

echo.
echo ══════════════════════════════════════════════════════════════
echo  ✅ INSTALLATION TERMINÉE!
echo ══════════════════════════════════════════════════════════════
echo.
echo Prochaines étapes:
echo   1. Redémarrez votre éditeur
echo   2. Ouvrez un projet/workspace
echo   3. Les règles Brain seront auto-installées
echo.
echo Pour vérifier: Ctrl+Shift+P → "Brain: Show Installed Rules"
echo.
pause
