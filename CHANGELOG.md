# Changelog

All notable changes to WhytCard Brain will be documented in this file.

## [1.1.0] - 2024-12-19

### Added

- **Windsurf/Cascade Support** - MCP server for Windsurf integration (`dist/mcp-server.cjs`)
- **Multi-language support** - English and French translations (package.nls.json)
- **Environment variable** - `BRAIN_DB_PATH` to specify custom database location
- **New MCP tools** - `brainConsult`, `brainSave`, `brainBug`, `brainSession`, `brainSearch`

### Changed

- Lowered VS Code engine requirement to `^1.89.0` for Windsurf compatibility
- Guarded VS Code-specific APIs (`vscode.lm`, `vscode.chat`) for cross-platform support
- Updated README with Windsurf setup instructions

### Fixed

- Extension no longer crashes in hosts without `vscode.lm` API
- Copilot instructions auto-setup only runs when Copilot is installed

## [1.0.0] - 2024-12-01

### Added

- Initial release
- SQLite database via sql.js (WASM)
- Language Model Tools for GitHub Copilot
- Chat participant `@brain`
- Sidebar views for Instructions, Documentation, Context, Stats
- Auto-sync with file watcher
- Export/import functionality
