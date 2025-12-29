# Troubleshooting - WhytCard Brain

## Common Issues

### Extension won't install

**Check editor version:**

```bash
code --version    # VS Code >= 1.89.0
cursor --version  # Cursor >= 0.45
```

**Solution:** Update your editor.

---

### MCP not working (Cursor/Windsurf)

**1. Verify config file location:**

| Editor   | Windows                                  | Mac/Linux                    |
| -------- | ---------------------------------------- | ---------------------------- |
| Cursor   | `%USERPROFILE%\.cursor\mcp.json`         | `~/.cursor/mcp.json`         |
| Windsurf | `%USERPROFILE%\.codeium\mcp_config.json` | `~/.codeium/mcp_config.json` |

**2. Verify Node.js is installed:**

```bash
node --version  # Should display v18+
npx --version
```

**3. Test MCP server manually:**

```bash
npx -y whytcard-brain-mcp
```

**4. If npx doesn't work, use absolute path:**

Edit `mcp_config.json`:

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js",
        "-y",
        "whytcard-brain-mcp"
      ]
    }
  }
}
```

---

### Rules not applying

**1. Open a workspace (not a single file)**

The extension only creates rules in an open workspace.

**2. Verify files are created:**

- VS Code: `.github/copilot-instructions.md`
- Cursor: `.cursor/rules/brain.mdc`
- Windsurf: `.windsurf/rules/brain.md`

**3. Force recreation:**

```
Ctrl+Shift+P → "Developer: Reload Window"
```

---

### AI not using Brain

**1. Verify tools are available:**

In chat, type: `@brain` or mention `brainConsult`

**2. Check settings:**

```
Settings → "whytcard-brain.strictMode" → "moderate" or "strict"
```

**3. Check logs:**

```
Ctrl+Shift+U → Output → "WhytCard Brain"
```

---

### Error "Cannot find module 'vscode'"

This is normal if you're trying to run the MCP server directly. The MCP server uses a different file (`mcp-server.cjs`).

---

### Database not found

**Default brain.db paths:**

| Editor   | Windows                                                                  | Mac/Linux                                                  |
| -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| VS Code  | `%APPDATA%\Code\User\globalStorage\whytcard.whytcard-brain\brain.db`     | `~/.vscode/globalStorage/whytcard.whytcard-brain/brain.db` |
| Cursor   | `%APPDATA%\Cursor\User\globalStorage\whytcard.whytcard-brain\brain.db`   | `~/Library/Application Support/Cursor/.../brain.db`        |
| Windsurf | `%APPDATA%\Windsurf\User\globalStorage\whytcard.whytcard-brain\brain.db` | `~/Library/Application Support/Windsurf/.../brain.db`      |

**Force a custom path:**

In `mcp_config.json`:

```json
"env": {
  "BRAIN_DB_PATH": "C:/path/to/brain.db"
}
```

---

## Logs and Debug

### Enable detailed logs

1. Open Settings
2. Search for "whytcard-brain"
3. Enable debug mode if available

### View MCP logs

```bash
# Run server in debug mode
BRAIN_DEBUG=1 npx -y whytcard-brain-mcp
```

---

## Complete Reset

```bash
# 1. Uninstall extension
code --uninstall-extension whytcard.whytcard-brain

# 2. Remove config files
rm ~/.cursor/mcp.json
rm ~/.codeium/mcp_config.json

# 3. Reinstall
./install-mac-linux.sh  # or install-windows.bat
```

---

## Support

If the issue persists:

1. Open a GitHub issue with logs
2. Include: editor version, OS, complete error message

**GitHub Issues:** [github.com/WhytcardAI/vscode-whytcard-brain/issues](https://github.com/WhytcardAI/vscode-whytcard-brain/issues)
