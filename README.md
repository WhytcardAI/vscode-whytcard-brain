# WhytCard Brain

**Local knowledge base for AI assistants** — Store instructions, documentation, and project context to supercharge your AI-assisted development.

Works with **GitHub Copilot** (VS Code) and **Cascade** (Windsurf).

## Features

### 🧠 AI Integration

WhytCard Brain registers **Language Model Tools** that Copilot automatically uses during conversations:

| Tool                 | Description                                  |
| -------------------- | -------------------------------------------- |
| `#brainInstructions` | Load mandatory project rules and conventions |
| `#brainContext`      | Load project architecture and decisions      |
| `#brain`             | Search documentation and known solutions     |
| `#brainConsult`      | Load instructions + context + local docs     |
| `#brainSave`         | Store new documentation locally              |
| `#brainBug`          | Record bugs and their solutions              |
| `#brainSession`      | Log session summaries for continuity         |

### 📚 Organized Knowledge

Content is organized into **4 categories** visible in the sidebar:

- **Instructions** — Coding rules, conventions, mandatory guidelines
- **Documentation** — Framework docs, API references, code examples
- **Context** — Project architecture, tech stack, design decisions
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

1. Download the `.vsix` file
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Reload VS Code

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
- Add new documentation manually
- Search across all entries
- Export the database

### Commands

| Command                                    | Description                                                           |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `Brain: Install Copilot Chat Instructions` | Create `.github/copilot-instructions.md` and enable instruction files |
| `Brain: Search`                            | Search the knowledge base                                             |
| `Brain: Add`                               | Add new documentation                                                 |
| `Brain: Refresh`                           | Reload from database                                                  |
| `Brain: Export`                            | Export database as JSON                                               |

## Database

WhytCard Brain uses **SQLite** (via sql.js WASM) for local storage:

- Location: `~/.vscode/globalStorage/whytcard.whytcard-brain/brain.db`
- Fully local — no cloud sync, no API calls
- Export/import via JSON

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
      "command": "npx",
      "args": ["-y", "whytcard-brain-mcp"],
      "env": {
        "BRAIN_STRICT_MODE": "1",
        "BRAIN_STRICT_REQUIRE_SOURCES": "1"
      },
      "alwaysAllow": [
        "brainConsult",
        "brainSearch",
        "brainSave",
        "brainBug",
        "brainSession"
      ]
    }
  }
}
```

### Manual Setup (from source)

1. Build: `npm run build`
2. Add to `mcp_config.json`:

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

Contributions are welcome! Please open an issue or pull request on GitHub.

## License

MIT © WhytCard
