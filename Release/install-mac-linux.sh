#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         🧠 WhytCard Brain - Installation Mac/Linux           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VSIX_FILE="$SCRIPT_DIR/whytcard-brain-1.1.2.vsix"
MCP_CONFIG="$SCRIPT_DIR/mcp_config.json"

# Check if VSIX exists
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}❌ Erreur: whytcard-brain-1.1.2.vsix non trouvé!${NC}"
    echo "   Assurez-vous que le fichier VSIX est dans le même dossier."
    exit 1
fi

# Detect installed editors
VSCODE_FOUND=0
CURSOR_FOUND=0
WINDSURF_FOUND=0

command -v code &> /dev/null && VSCODE_FOUND=1
command -v cursor &> /dev/null && CURSOR_FOUND=1
command -v windsurf &> /dev/null && WINDSURF_FOUND=1

echo "Éditeurs détectés:"
[ $VSCODE_FOUND -eq 1 ] && echo -e "  ${GREEN}✅ VS Code${NC}"
[ $CURSOR_FOUND -eq 1 ] && echo -e "  ${GREEN}✅ Cursor${NC}"
[ $WINDSURF_FOUND -eq 1 ] && echo -e "  ${GREEN}✅ Windsurf${NC}"

if [ $VSCODE_FOUND -eq 0 ] && [ $CURSOR_FOUND -eq 0 ] && [ $WINDSURF_FOUND -eq 0 ]; then
    echo -e "  ${RED}❌ Aucun éditeur trouvé!${NC}"
    echo "  Installez VS Code, Cursor ou Windsurf d'abord."
    exit 1
fi
echo ""

# Install extension
echo "══════════════════════════════════════════════════════════════"
echo " ÉTAPE 1: Installation de l'extension"
echo "══════════════════════════════════════════════════════════════"

if [ $VSCODE_FOUND -eq 1 ]; then
    echo ""
    echo "Installation pour VS Code..."
    if code --install-extension "$VSIX_FILE" --force; then
        echo -e "${GREEN}✅ VS Code: Extension installée${NC}"
    else
        echo -e "${YELLOW}⚠️ VS Code: Erreur d'installation${NC}"
    fi
fi

if [ $CURSOR_FOUND -eq 1 ]; then
    echo ""
    echo "Installation pour Cursor..."
    if cursor --install-extension "$VSIX_FILE" --force; then
        echo -e "${GREEN}✅ Cursor: Extension installée${NC}"
    else
        echo -e "${YELLOW}⚠️ Cursor: Erreur d'installation${NC}"
    fi
fi

if [ $WINDSURF_FOUND -eq 1 ]; then
    echo ""
    echo "Installation pour Windsurf..."
    if windsurf --install-extension "$VSIX_FILE" --force; then
        echo -e "${GREEN}✅ Windsurf: Extension installée${NC}"
    else
        echo -e "${YELLOW}⚠️ Windsurf: Erreur d'installation${NC}"
    fi
fi

# Configure MCP for Cursor
if [ $CURSOR_FOUND -eq 1 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo " ÉTAPE 2: Configuration MCP pour Cursor"
    echo "══════════════════════════════════════════════════════════════"
    
    CURSOR_MCP="$HOME/.cursor/mcp.json"
    mkdir -p "$HOME/.cursor"
    
    if [ -f "$CURSOR_MCP" ]; then
        echo ""
        echo -e "${YELLOW}⚠️ Un fichier mcp.json existe déjà pour Cursor.${NC}"
        read -p "Voulez-vous le remplacer? (o/n): " OVERWRITE
        if [ "$OVERWRITE" = "o" ] || [ "$OVERWRITE" = "O" ]; then
            cp "$MCP_CONFIG" "$CURSOR_MCP"
            echo -e "${GREEN}✅ Cursor MCP configuré${NC}"
        else
            echo "⏭️ Configuration Cursor ignorée"
        fi
    else
        cp "$MCP_CONFIG" "$CURSOR_MCP"
        echo -e "${GREEN}✅ Cursor MCP configuré${NC}"
    fi
fi

# Configure MCP for Windsurf
if [ $WINDSURF_FOUND -eq 1 ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo " ÉTAPE 3: Configuration MCP pour Windsurf"
    echo "══════════════════════════════════════════════════════════════"
    
    # Try both possible Windsurf paths
    WINDSURF_MCP=""
    if [ -d "$HOME/.codeium/windsurf" ]; then
        WINDSURF_MCP="$HOME/.codeium/windsurf/mcp_config.json"
    elif [ -d "$HOME/.codeium/windsurf-next" ]; then
        WINDSURF_MCP="$HOME/.codeium/windsurf-next/mcp_config.json"
    else
        mkdir -p "$HOME/.codeium/windsurf"
        WINDSURF_MCP="$HOME/.codeium/windsurf/mcp_config.json"
    fi
    
    if [ -f "$WINDSURF_MCP" ]; then
        echo ""
        echo -e "${YELLOW}⚠️ Un fichier mcp_config.json existe déjà pour Windsurf.${NC}"
        read -p "Voulez-vous le remplacer? (o/n): " OVERWRITE
        if [ "$OVERWRITE" = "o" ] || [ "$OVERWRITE" = "O" ]; then
            cp "$MCP_CONFIG" "$WINDSURF_MCP"
            echo -e "${GREEN}✅ Windsurf MCP configuré${NC}"
        else
            echo "⏭️ Configuration Windsurf ignorée"
        fi
    else
        cp "$MCP_CONFIG" "$WINDSURF_MCP"
        echo -e "${GREEN}✅ Windsurf MCP configuré${NC}"
    fi
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo -e " ${GREEN}✅ INSTALLATION TERMINÉE!${NC}"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "Prochaines étapes:"
echo "  1. Redémarrez votre éditeur"
echo "  2. Ouvrez un projet/workspace"
echo "  3. Les règles Brain seront auto-installées"
echo ""
echo "Pour vérifier: Cmd+Shift+P → \"Brain: Show Installed Rules\""
echo ""
