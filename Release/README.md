# WhytCard Brain - Release v1.1.2

> **Local knowledge base for AI assistants** — Works with VS Code, Cursor, and Windsurf

---

## Prerequisites

- **Node.js 18+**: [nodejs.org](https://nodejs.org/) (required for MCP)
- **VS Code 1.89+**, **Cursor 0.45+**, or **Windsurf**

Verify Node.js:

```bash
node --version  # Should display v18.x.x or higher
```

---

## Folder Contents

```
release/
├── whytcard-brain-1.1.2.vsix    # VS Code/Cursor/Windsurf extension
├── mcp_config.json              # MCP config (uses npx)
├── install-windows.bat          # Automatic Windows installation
├── install-mac-linux.sh         # Automatic Mac/Linux installation
├── QUICK-START.md               # Quick start guide
├── TROUBLESHOOTING.md           # Troubleshooting guide
└── README.md                    # This file
```

---

## Quick Installation

### Option 1: Automatic Script (Recommended)

**Windows:** Double-click `install-windows.bat`

**Mac/Linux:**

```bash
chmod +x install-mac-linux.sh
./install-mac-linux.sh
```

The script will:

1. Detect your installed editors
2. Install the VSIX extension
3. Configure MCP for Cursor/Windsurf
4. Guide you through next steps

### Option 2: Manual Installation

#### Step 1: Install the Extension

**VS Code:**

```bash
code --install-extension whytcard-brain-1.1.2.vsix
```

**Cursor:**

```bash
cursor --install-extension whytcard-brain-1.1.2.vsix
```

**Windsurf:**

```bash
windsurf --install-extension whytcard-brain-1.1.2.vsix
```

#### Step 2: Configure MCP (Cursor/Windsurf only)

> **Note:** VS Code does not need this step — the extension works directly with GitHub Copilot.

Copy `mcp_config.json` to:

| Editor       | Windows                                  | Mac/Linux                    |
| ------------ | ---------------------------------------- | ---------------------------- |
| **Cursor**   | `%USERPROFILE%\.cursor\mcp.json`         | `~/.cursor/mcp.json`         |
| **Windsurf** | `%USERPROFILE%\.codeium\mcp_config.json` | `~/.codeium/mcp_config.json` |

> **Tip:** Create the folder if it doesn't exist.

---

## Configuration

### VS Code/Cursor/Windsurf Settings

Open Settings → search for "**Brain**":

| Setting            | Options                      | Description          |
| ------------------ | ---------------------------- | -------------------- |
| `strictMode`       | off / moderate / strict      | Strictness level     |
| `autoSave`         | off / ask / always           | Auto-save new docs   |
| `instructionStyle` | minimal / standard / verbose | Instruction length   |
| `language`         | auto / en / fr               | Instruction language |

### MCP Environment Variables

In `mcp_config.json`, you can customize:

| Variable                       | Default      | Description                                 |
| ------------------------------ | ------------ | ------------------------------------------- |
| `BRAIN_DB_PATH`                | (empty=auto) | Path to brain.db                            |
| `BRAIN_REQUIRE_CONSULT`        | `1`          | AI must call brainConsult before responding |
| `BRAIN_STRICT_MODE`            | `0`          | Strict mode (0=disabled, 1=enabled)         |
| `BRAIN_STRICT_REQUIRE_SOURCES` | `0`          | Require source URLs (0=no, 1=yes)           |

> **Tip:** Start with default values, then enable strict mode once familiar.

---

## Auto-Generated Files

The extension automatically creates these files in your workspace:

| Editor          | File                              |
| --------------- | --------------------------------- |
| VS Code/Copilot | `.github/copilot-instructions.md` |
| Cursor          | `.cursor/rules/brain.mdc`         |
| Windsurf        | `.windsurf/rules/brain.md`        |

These files instruct the AI to:

1. Consult Brain before responding
2. Never hallucinate
3. Save new knowledge
4. Cite sources

---

## Usage

**You don't need to do anything special!** Simply ask your AI:

```
"How do I do X with React?"
```

The AI will automatically:

1. Call `brainConsult` to check local docs
2. Search official documentation if needed
3. Save useful info with `brainSave`
4. Cite sources in its response

---

## Available Tools

| Tool                  | Description                              |
| --------------------- | ---------------------------------------- |
| `brainConsult`        | Load instructions + context + local docs |
| `brainSave`           | Store new documentation                  |
| `brainBug`            | Record bugs and their solutions          |
| `brainSession`        | Log session summaries for continuity     |
| `brainSearch`         | Search the knowledge base                |
| `brainValidate`       | Validate response is grounded in docs    |
| `brainTemplateSave`   | Save reusable code/templates             |
| `brainTemplateSearch` | Search saved templates                   |
| `brainTemplateApply`  | Apply a saved template                   |

---

## Troubleshooting

### Extension won't install

```bash
# Check VS Code/Cursor version
code --version  # Must be >= 1.89.0
```

### MCP not working (Cursor/Windsurf)

1. Verify `mcp_config.json` is in the correct location
2. Restart the editor
3. Check logs: `Ctrl+Shift+U` → Output → "WhytCard Brain"

### Rules not applying

1. Open a workspace (not just a single file)
2. Verify rule files exist
3. Run command: `Brain: Show Installed Rules`

See `TROUBLESHOOTING.md` for more details.

---

## Support

- **GitHub Issues**: [github.com/WhytcardAI/vscode-whytcard-brain/issues](https://github.com/WhytcardAI/vscode-whytcard-brain/issues)
- **Documentation**: [github.com/WhytcardAI/vscode-whytcard-brain](https://github.com/WhytcardAI/vscode-whytcard-brain)

---

**Version:** 1.1.2  
**Date:** 2024-12-25  
**License:** MIT
