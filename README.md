# WhytCard Brain

**Local knowledge base for AI assistants** — Store instructions, documentation, and project context to supercharge your AI-assisted development.

Works with **GitHub Copilot** (VS Code) and **Cascade** (Windsurf).

## Features

### 🧠 AI Integration

WhytCard Brain registers **Language Model Tools** that Copilot automatically uses during conversations:

| Tool                   | Description                                  |
| ---------------------- | -------------------------------------------- |
| `#brainInstructions`   | Load mandatory project rules and conventions |
| `#brainContext`        | Load project architecture and decisions      |
| `#brain`               | Search documentation and known solutions     |
| `#brainConsult`        | Load instructions + context + local docs     |
| `#brainSave`           | Store new documentation locally              |
| `#brainBug`            | Record bugs and their solutions              |
| `#brainSession`        | Log session summaries for continuity         |
| `#brainValidate`       | Validate answers are grounded in sources     |
| `#brainTemplateSave`   | Save reusable code/templates (agent-driven)  |
| `#brainTemplateSearch` | Search saved templates                       |
| `#brainTemplateApply`  | Apply a template (for reuse)                 |

### 📚 Organized Knowledge

Content is organized into **5 categories** visible in the sidebar:

- **Instructions** — Coding rules, conventions, mandatory guidelines
- **Documentation** — Framework docs, API references, code examples
- **Context** — Project architecture, tech stack, design decisions
- **Templates** — Reusable snippets/files/multi-file scaffolds (agent-driven)
- **Stats** — Usage statistics and database info

### 🗂️ Domain Grouping

Documentation is automatically grouped by domain:

- 🌐 **Website** — React, Next.js, Tailwind, shadcn, etc.
- 📱 **Mobile** — React Native, Expo, Flutter
- ⚙️ **Backend** — Node.js, Express, Prisma, databases
- ☁️ **DevOps** — Docker, Vercel, AWS, CI/CD
- 📦 **General** — TypeScript, Zod, utilities

### 🔄 Auto-Sync

- Database reloads automatically every 30 seconds
- File watcher detects external changes
- Manual refresh available via toolbar

## Installation

### Quick Install

1. **One-command setup (from source):**

   ```bash
   npm run setup:cursor
   ```

   This will: install deps, run quality checks, package the VSIX, install it in Cursor, and configure MCP.

2. **Auto-configure MCP (Windsurf/Cursor only):**
   - A notification will appear after 3 seconds
   - Click **"Configure Now"** to auto-setup the MCP server
   - Restart your editor when prompted
   - ✅ Done! Brain is ready to use

**VS Code users:** No additional setup needed - Brain works via Language Model Tools with GitHub Copilot.

📖 **Detailed instructions:** See [INSTALL.md](./INSTALL.md) for manual configuration, troubleshooting, and platform-specific details.

## Usage

### With Copilot Chat

Copilot automatically uses Brain tools. You can also reference them explicitly:

```
#brain Search for Next.js routing patterns
```

```
#brainInstructions Load the coding rules
```

```
#brainConsult Next.js App Router async params
```

### Without `@brain` (recommended)

To make **default Copilot Chat** consult Brain automatically (no need to type `@brain` or `#brain...`):

1. Run the command: **Brain: Install Copilot Chat Instructions**
2. This creates `.github/copilot-instructions.md` in your workspace and enables the setting:
   - `github.copilot.chat.codeGeneration.useInstructionFiles`

The instructions file references Brain tools via `#tool:brainConsult`, `#tool:brainSave`, and `#tool:brainBug`.

### With Chat Participant

WhytCard Brain also provides a chat participant:

```
@brain nextjs async params
```

### Sidebar Panel

Click the **Brain** icon in the Activity Bar to:

- Browse all stored knowledge
- Search across all entries
- View docs and templates in a rich webview

> Note: this repository is configured for an **agent-driven workflow**.
> Manual “Add/Edit/Delete” actions are intentionally removed from the UI.

### Commands

| Command                                    | Description                                                           |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `Brain: Install Copilot Chat Instructions` | Create `.github/copilot-instructions.md` and enable instruction files |
| `Brain: Search`                            | Search the knowledge base                                             |
| `Brain: Refresh`                           | Reload from database                                                  |
| `Brain: Configure MCP Server`              | Write MCP config (Cursor/Windsurf)                                    |
| `Brain: Show MCP Status`                   | Show MCP config + DB path                                             |

## Database

WhytCard Brain uses **SQLite** (via sql.js WASM) for local storage:

- Location: `~/.vscode/globalStorage/whytcard.whytcard-brain/brain.db`
- Fully local — no cloud sync, no API calls
- Export/import is handled by the agent tools (and can be scripted)

## Windsurf / Cascade Integration

WhytCard Brain includes an **MCP server** for Windsurf Cascade.

### Quick Setup (npm)

```bash
npx whytcard-brain-mcp
```

Add to `~/.codeium/windsurf-next/mcp_config.json`:

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "node",
      "args": ["<path-to-extension>/dist/mcp-server.cjs"],
      "env": {
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

### Manual Setup (from source)

1. Build: `npm run build`
2. Add to your MCP config (`~/.cursor/mcp.json` for Cursor, `~/.codeium/windsurf-next/mcp_config.json` for Windsurf):

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "node",
      "args": ["path/to/vscode-whytcard-brain/dist/mcp-server.cjs"],
      "env": {
        "BRAIN_DB_PATH": "path/to/brain.db"
      }
    }
  }
}
```

### Strict Mode

Enable strict mode to ensure AI responses are grounded in official documentation:

| Variable                       | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| `BRAIN_REQUIRE_CONSULT`        | Require `brainConsult` before other tools (default: `1`) |
| `BRAIN_STRICT_MODE`            | Block if no docs found (default: `0`)                    |
| `BRAIN_STRICT_REQUIRE_SOURCES` | Require docs with source URLs (default: `1`)             |
| `BRAIN_CONSULT_TTL_MS`         | Consult validity in ms (default: `1200000` = 20min)      |

### MCP Tools

| Tool            | Description                               |
| --------------- | ----------------------------------------- |
| `brainConsult`  | Load instructions + context + search docs |
| `brainSave`     | Store new documentation                   |
| `brainBug`      | Record bugs and solutions                 |
| `brainSession`  | Log session summaries                     |
| `brainSearch`   | Search the knowledge base                 |
| `brainValidate` | Validate response is grounded in docs     |

## Requirements

- VS Code 1.89.0+ or Windsurf
- GitHub Copilot (VS Code) or Cascade (Windsurf)

## Contributing

This repository is public for transparency and distribution, but it is **not open to external contributions**.

- Please do not open Pull Requests.
- For support or requests, use: https://whytcard.com/contact

## License

MIT © WhytCard
