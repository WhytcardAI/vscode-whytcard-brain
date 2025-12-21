#!/bin/bash
# WhytCard Brain - Installation Script
# For macOS/Linux users with Windsurf, Cursor, or VS Code

set -e

EDITOR=${1:-auto}

echo "🧠 WhytCard Brain Installer"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Detect editor
DETECTED_EDITOR="$EDITOR"
if [ "$EDITOR" = "auto" ]; then
    echo -e "${YELLOW}🔍 Detecting editor...${NC}"
    
    if command -v windsurf &> /dev/null; then
        DETECTED_EDITOR="windsurf"
        echo -e "${GREEN}✅ Found: windsurf${NC}"
    elif command -v cursor &> /dev/null; then
        DETECTED_EDITOR="cursor"
        echo -e "${GREEN}✅ Found: cursor${NC}"
    elif command -v code &> /dev/null; then
        DETECTED_EDITOR="vscode"
        echo -e "${GREEN}✅ Found: vscode${NC}"
    else
        echo -e "${RED}❌ No editor detected. Please specify: ./install.sh [windsurf|cursor|vscode]${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}📦 Installing WhytCard Brain for $DETECTED_EDITOR...${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VSIX_PATH="$SCRIPT_DIR/whytcard-brain.vsix"

# Check if VSIX exists
if [ ! -f "$VSIX_PATH" ]; then
    echo -e "${RED}❌ Extension package not found: $VSIX_PATH${NC}"
    exit 1
fi

# Install extension
echo ""
echo -e "${YELLOW}Installing extension...${NC}"

case "$DETECTED_EDITOR" in
    windsurf)
        COMMAND="windsurf"
        ;;
    cursor)
        COMMAND="cursor"
        ;;
    vscode)
        COMMAND="code"
        ;;
    *)
        echo -e "${RED}❌ Unknown editor: $DETECTED_EDITOR${NC}"
        exit 1
        ;;
esac

if $COMMAND --install-extension "$VSIX_PATH" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Extension installed successfully!${NC}"
else
    echo -e "${RED}❌ Failed to install extension${NC}"
    echo ""
    echo -e "${YELLOW}Manual installation:${NC}"
    echo "1. Open $DETECTED_EDITOR"
    echo "2. Go to Extensions panel (Cmd+Shift+X / Ctrl+Shift+X)"
    echo "3. Click '...' menu → Install from VSIX..."
    echo "4. Select: $VSIX_PATH"
    exit 1
fi

# Post-installation instructions
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo "=================================================="
echo ""

if [ "$DETECTED_EDITOR" = "windsurf" ] || [ "$DETECTED_EDITOR" = "cursor" ]; then
    echo -e "${CYAN}Next Steps (Automatic Configuration):${NC}"
    echo "1. Restart $DETECTED_EDITOR"
    echo "2. Wait 3 seconds for the configuration prompt"
    echo "3. Click 'Configure Now' when prompted"
    echo "4. Click 'Restart Now' to complete setup"
    echo -e "${GREEN}5. ✅ You're ready to use Brain with Cascade!${NC}"
else
    echo -e "${CYAN}Next Steps:${NC}"
    echo "1. Restart VS Code"
    echo "2. Ensure GitHub Copilot is installed"
    echo "3. Use @brain in Copilot Chat"
    echo "4. Or run: Brain: Install Copilot Chat Instructions"
fi

echo ""
echo -e "${CYAN}📖 Documentation:${NC}"
echo "   - Quick Start: $SCRIPT_DIR/QUICKSTART.md"
echo "   - Full Guide: $SCRIPT_DIR/INSTALL.md"
echo ""
echo -e "${YELLOW}💡 Tip: Run 'Brain: Show MCP Status' to verify configuration${NC}"
echo ""
