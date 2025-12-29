# Changelog

All notable changes to WhytCard Brain will be documented in this file.

## [1.1.2] - 2024-12-25

### Added

- **Marketplace icon** - Added 128x128 PNG icon for VS Code Marketplace
- **Template tools** - `brainTemplateSave`, `brainTemplateSearch`, `brainTemplateApply` for reusable code patterns
- **Strict mode validation** - `brainValidate` tool to check answers are grounded in sources
- **One-click setup scripts** - `npm run setup:cursor` and `npm run setup:windsurf`
- **Auto-install rules for all editors** - Automatically creates instruction files for:
  - VS Code/Copilot: `.github/copilot-instructions.md`
  - Cursor: `.cursor/rules/brain.mdc` (v0.45+ MDC format, legacy `.cursorrules` deprecated)
  - Windsurf: `.windsurf/rules/brain.md`
- **Configurable settings** - Customize Brain behavior:
  - `strictMode`: off/moderate/strict
  - `autoSave`: off/ask/always
  - `instructionStyle`: minimal/standard/verbose
  - `enabledTools`: enable/disable individual tools
  - `language`: auto/en/fr
- **ESLint + Prettier** - Added linting and formatting configuration
- **SECURITY.md** - Security policy documentation
- **Dependabot** - Automated dependency updates
- **Release folder** - Complete standalone installation package with scripts

### Changed

- Improved MCP server strict mode with configurable environment variables
- Enhanced CI pipeline with multi-OS matrix (Ubuntu + Windows) and VSIX artifact upload
- Optimized `.vscodeignore` to exclude dev config files from VSIX
- **MCP config path** - Windsurf now uses `~/.codeium/mcp_config.json` (official location)
- **Idempotent rule updates** - Rules files update without duplication on repeated activations

### Fixed

- TypeScript TS2589 error in MCP server (ZodRawShape types)
- MCP config paths for Windows environments
- 25 ESLint errors (unused imports, empty blocks, case declarations)
- Duplicated YAML frontmatter in Windsurf/Cursor rules files
- Brain DB path resolution for Windsurf - Next vs Windsurf directories

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
