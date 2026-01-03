# Setup & Troubleshooting - WhytCard Brain

## Installation

### Automatic (recommended)

**Windsurf / Cursor:**

1. Install the extension (Marketplace or .vsix).
2. Open the Brain sidebar.
3. Go to **Settings** and run MCP setup.
4. Restart Windsurf/Cursor.

### Manual Configuration

If automatic setup fails, configure the MCP server manually in your config file.

**Config Locations:**

- **Windsurf:** `~/.codeium/windsurf-next/mcp_config.json` (or `%USERPROFILE%\.codeium\...` on Windows)
- **Cursor:** `~/.cursor/mcp.json`
- **Claude Desktop:** `claude_desktop_config.json`

**Configuration Block:**

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "node",
      "args": ["<PATH_TO_EXTENSION>/dist/mcp-server.cjs"],
      "env": {
        "BRAIN_DB_PATH": "<PATH_TO_DB>/brain.db",
        "BRAIN_REQUIRE_CONSULT": "1",
        "BRAIN_STRICT_MODE": "1",
        "BRAIN_STRICT_REQUIRE_SOURCES": "1"
      },
      "alwaysAllow": [
        "brainConsult",
        "brainSearch",
        "brainSave",
        "brainBug",
        "brainSession",
        "brainValidate",
        "brainTemplateSave",
        "brainTemplateSearch",
        "brainTemplateApply"
      ]
    }
  }
}
```

> **Note:** Replace `<PATH_TO_EXTENSION>` with the absolute path to the extension folder.
> Replace `<PATH_TO_DB>` with your desired database location.

### Default database paths

- **Windows:** `%APPDATA%\Windsurf - Next\User\globalStorage\whytcard.whytcard-brain\brain.db`
- **macOS:** `~/Library/Application Support/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db`
- **Linux:** `~/.config/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db`

---

## Troubleshooting

### MCP Server Not Working

1. **Check Node.js:** Ensure Node.js 18+ is installed (`node -v`).
2. **Check Paths:** Verify paths in `mcp_config.json` are absolute and exist.
3. **Logs:** Check "Output" > "WhytCard Brain" in VS Code/Windsurf.
4. **Debug Mode:** Add `"BRAIN_DEBUG": "1"` to `env` in config.

### Database Issues

- **"Database not found":** The extension attempts to create it automatically. Ensure the parent folder exists and has write permissions.
- **Sync:** The database reloads automatically on external changes.

### AI Not Using Brain

1. **Check Rules:** Ensure `.windsurf/rules/brain.md` (or equivalent) exists in your workspace.
2. **Strict mode:**
   - VS Code: check `whytcard-brain.strictMode`.
   - MCP (Windsurf/Cursor): check `BRAIN_STRICT_MODE` and `BRAIN_STRICT_REQUIRE_SOURCES` in your MCP config.
3. **Explicit Call:** Try asking the AI to "Consult Brain explicitly".

---

## Advanced

### Environment Variables

| Variable                       | Description                   | Default       |
| ------------------------------ | ----------------------------- | ------------- |
| `BRAIN_DB_PATH`                | Path to SQLite DB             | Auto-detected |
| `BRAIN_STRICT_MODE`            | 1 = Force consulting brain    | 0             |
| `BRAIN_STRICT_REQUIRE_SOURCES` | 1 = Require URLs for new docs | 0             |
| `BRAIN_CONSULT_TTL_MS`         | Cache duration for consult    | 1200000 (20m) |

Notes:

- When using the one-click MCP setup from the Brain Settings view, strict mode is derived from the VS Code setting `whytcard-brain.strictMode`.
