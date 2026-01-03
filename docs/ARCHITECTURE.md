# Architecture & Technical Stack - WhytCard Brain

## 🏗️ Architecture

WhytCard Brain is designed as a local knowledge base that integrates with multiple AI assistants (Copilot, Windsurf Cascade, Cursor).

### Components

1.  **Core Service (`src/services/brainService.ts`)**
    - Central SQLite database manager via `sql.js` (WASM).
    - Handles CRUD, Full-text Search, and Schema Migrations.
    - File watcher for multi-instance synchronization.

2.  **VS Code Extension (`src/extension.ts`)**
    - **UI:** Sidebar views (TreeDataProviders), Settings Webview.
    - **Copilot Integration:** `LanguageModelTools` API implementation.
    - **Chat Participant:** `@brain` participant handler.
    - **Auto-Setup:** Manages rule files (`.windsurf/rules/brain.md`, etc.).

3.  **MCP Server (`src/mcp-server.ts`)**
    - Standalone server implementing Model Context Protocol.
    - Exposes Brain tools (`brainConsult`, `brainSave`, etc.) to Windsurf/Cursor.
    - Shares the same SQLite database as the extension.

## 🛠️ Technical Stack

- **Runtime:** Node.js / Electron (VS Code).
- **Language:** TypeScript (Strict).
- **Database:** SQLite (via `sql.js` WASM) - Zero native dependencies for portability.
- **Protocol:** MCP (Model Context Protocol) SDK.
- **UI:** React + Vite (for Webviews).
- **Validation:** Zod.

## 📂 Project Structure

```
.
├── src/
│   ├── chat/           # Copilot Chat Participant
│   ├── core/           # Shared DB Logic (Types, SQL)
│   ├── mcp-server.ts   # MCP Server Entrypoint
│   ├── extension.ts    # Extension Entrypoint
│   ├── services/       # Business Logic
│   ├── tools/          # VS Code LM Tools
│   ├── providers/      # Sidebar Data Providers
│   └── views/          # React Webviews
├── media/              # Static Assets
└── docs/               # Documentation
```

## 📏 Development Guidelines

- **Tools Duplication:** Tools are defined twice (once for VS Code LM API, once for MCP). Changes must be synced.
- **Linting:** ESLint + Prettier mandatory. No `any` allowed without explicit justification.
- **Database:** Always use `BrainService` singleton. WASM file must be in `dist/`.
