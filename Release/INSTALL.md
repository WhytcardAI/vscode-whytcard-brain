# WhytCard Brain - Installation Guide

## Quick Install (Automatic)

### 1. Install the Extension

**Option A: From VSIX (Recommended for testing)**

```bash
# Build the extension
npm run build

# Package the extension
npx vsce package

# Install in Windsurf/VS Code/Cursor
code --install-extension whytcard-brain-1.1.0.vsix
```

**Option B: From Marketplace** (when published)

- Search for "WhytCard Brain" in the Extensions marketplace
- Click Install

### 2. Automatic MCP Configuration (Windsurf/Cursor only)

After installing the extension:

1. **Wait 3 seconds** - A notification will appear asking if you want to configure the MCP server
2. **Click "Configure Now"** - The extension will automatically:
   - Detect your environment (Windsurf or Cursor)
   - Find your `mcp_config.json` file
   - Detect Node.js installation
   - Add WhytCard Brain to your MCP configuration
   - Set up the database path
3. **Restart** your editor when prompted

That's it! WhytCard Brain is now fully configured.

---

## Manual Configuration

If automatic setup fails or you prefer manual configuration:

### For Windsurf

1. Locate your MCP config file:

   ```
   Windows: %USERPROFILE%\.codeium\windsurf-next\mcp_config.json
   macOS/Linux: ~/.codeium/windsurf-next/mcp_config.json
   ```

2. Add this configuration:

   ```json
   {
     "mcpServers": {
       "whytcard-brain": {
         "command": "node",
         "args": ["<path-to-extension>/dist/mcp-server.cjs"],
         "env": {
           "BRAIN_DB_PATH": "<appdata>/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db",
           "BRAIN_REQUIRE_CONSULT": "1",
           "BRAIN_CONSULT_TTL_MS": "1200000",
           "BRAIN_STRICT_MODE": "1",
           "BRAIN_STRICT_REQUIRE_SOURCES": "1"
         },
         "alwaysAllow": [
           "brainConsult",
           "brainSearch",
           "brainSave",
           "brainBug",
           "brainSession"
         ],
         "disabled": false
       }
     }
   }
   ```

3. Replace `<path-to-extension>` with the actual extension path
4. Replace `<appdata>` with your AppData path (Windows: `%APPDATA%`)

### For Cursor

Similar to Windsurf, but:

- Config file: `~/.cursor/mcp_config.json`
- DB path: `<appdata>/Cursor/User/globalStorage/whytcard.whytcard-brain/brain.db`

### For VS Code

VS Code doesn't support MCP natively yet. WhytCard Brain will work via **Language Model Tools** (requires GitHub Copilot):

- No additional configuration needed
- Works with GitHub Copilot Chat
- Use the sidebar panel for managing your Brain database

---

## Verification

### Check MCP Status

Run the command: **Brain: Show MCP Status**

This will show:

- Current environment (Windsurf/Cursor/VS Code)
- MCP support status
- Configuration status
- Database path

### Test the Integration

1. Open Cascade/Chat in Windsurf or Cursor
2. Type a query and use `@whytcard-brain`
3. Or just ask a question - the AI should automatically call `brainConsult`

---

## Troubleshooting

### "Node.js not found"

**Solution:** Install Node.js from [nodejs.org](https://nodejs.org)

After installation:

- **Windows:** Restart your editor or add Node.js to PATH
- **macOS/Linux:** Node.js should be automatically in PATH

### "MCP server not found"

**Solution:** Rebuild the extension

```bash
cd vscode-whytcard-brain
npm run build
```

Then run: **Brain: Configure MCP Server**

### "Database connection failed"

The database is created automatically on first use. If you see this error:

1. Check the database path via **Brain: Show MCP Status**
2. Ensure the folder exists (it should be created automatically)
3. Check file permissions

### MCP tools not appearing in Cascade

1. Verify configuration: **Brain: Show MCP Status**
2. Check `mcp_config.json` manually
3. Restart your editor
4. Check Windsurf/Cursor logs for MCP errors

---

## Environment-Specific Paths

### Windows

- **Windsurf:** `%APPDATA%\Windsurf - Next\User\globalStorage\whytcard.whytcard-brain\brain.db`
- **Cursor:** `%APPDATA%\Cursor\User\globalStorage\whytcard.whytcard-brain\brain.db`
- **VS Code:** `%APPDATA%\Code\User\globalStorage\whytcard.whytcard-brain\brain.db`

### macOS

- **Windsurf:** `~/Library/Application Support/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db`
- **Cursor:** `~/Library/Application Support/Cursor/User/globalStorage/whytcard.whytcard-brain/brain.db`
- **VS Code:** `~/Library/Application Support/Code/User/globalStorage/whytcard.whytcard-brain/brain.db`

### Linux

- **Windsurf:** `~/.config/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db`
- **Cursor:** `~/.config/Cursor/User/globalStorage/whytcard.whytcard-brain/brain.db`
- **VS Code:** `~/.config/Code/User/globalStorage/whytcard.whytcard-brain/brain.db`

---

## Features After Installation

### Automatic Features

- ✅ Language Model Tools registered (for GitHub Copilot)
- ✅ MCP tools exposed (for Windsurf/Cursor Cascade)
- ✅ Database created automatically
- ✅ Sidebar views available
- ✅ Status bar indicator

### Available Commands

- **Brain: Configure MCP Server** - Run auto-configuration
- **Brain: Show MCP Status** - Check configuration
- **Brain: Refresh** - Reload database
- **Brain: Search** - Search your knowledge base
- **Brain: Export** - Export your data
- **Brain: Add** - Add documentation manually
- **Brain: Install Copilot Chat Instructions** - Set up Copilot integration

---

## Next Steps

1. **Add your first documentation:**
   - Use the sidebar panel
   - Or use `brainSave` tool via Cascade/Copilot

2. **Try asking questions:**
   - In Windsurf Cascade: Questions automatically use Brain
   - In VS Code Copilot: Ask about your documented topics

3. **Explore the docs:**
   - Check the main [README.md](./README.md)
   - See [MCP Tools documentation](./mcp-server/README.md)

---

## Uninstall

1. Uninstall the extension via your editor's Extensions panel
2. (Optional) Delete the database file to remove all data
3. (Optional) Remove the `whytcard-brain` entry from `mcp_config.json`
