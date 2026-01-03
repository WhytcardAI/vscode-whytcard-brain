# WhytCard Brain

**Local knowledge base for AI assistants**. Store instructions, documentation, and project context to keep your assistant grounded in sources.

Works with **GitHub Copilot** (VS Code), **Windsurf Cascade**, and **Cursor**.

## Features

- **Local knowledge base:** Store docs, rules, and project context locally (SQLite).
- **AI integration:** Enforce a strict workflow so the assistant does not answer without official sources.
- **Multi-editor:** Supports VS Code (Language Model Tools + chat participant) and Windsurf/Cursor via MCP.
- **Auto-rules:** Automatically installs/updates AI instruction files (`.windsurf/rules/brain.md`, etc.).

## Installation

### VS Code Marketplace

Install the extension from the VS Code Marketplace.

### Offline install (.vsix)

You can package the extension into a `.vsix` with `vsce` (official VS Code guidance):

- Source: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

From this repository:

```bash
npm install
npm run build
npm run package:vsix
```

Then install the `.vsix` in VS Code.

## Default behavior (strict mode)

The extension defaults to `strict` mode.

In strict mode:

- The assistant must consult Brain first.
- If Brain has no relevant documentation with source URLs, the workflow is blocked and you must import official docs (Context7/Tavily) and store them with a URL.

This is designed to prevent answers that are not grounded in official documentation.

## Usage

### VS Code

- Use the Brain sidebar to browse docs/instructions/context.
- Copilot can use the `@brain` chat participant and the Brain tools.

### Windsurf / Cursor (MCP)

Open the Brain sidebar and use **Settings** to run MCP setup.

See: `docs/SETUP.md`

## Commands

Available commands include:

- `Brain: Refresh`
- `Brain: Search`
- `Brain: Deduplicate Docs`
- `Brain: Getting Started Guide`
- `Brain: Show Installed AI Rules`

## Documentation

- [Setup & Troubleshooting](docs/SETUP.md)
- [Architecture & Stack](docs/ARCHITECTURE.md)
- [Instruction System Internals](docs/INSTRUCTIONS-SYSTEM.md)

## Development

- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Run full checks:** `npm run check`
- **Package (.vsix):** `npm run package:vsix`

## License

MIT © WhytCard
