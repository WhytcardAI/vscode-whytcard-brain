# Changelog

All notable changes to WhytCard Brain will be documented in this file.

## [1.1.0] - 2025-12-21

### 🎉 Major Features

#### Auto-Configuration System

- **Automatic MCP Setup**: Extension now automatically detects and configures MCP server for Windsurf and Cursor
- **Environment Detection**: Smart detection of Windsurf, Cursor, or VS Code environments
- **Node.js Detection**: Automatic Node.js path detection across Windows, macOS, and Linux
- **User Prompts**: Friendly notifications guide users through setup process
- **One-Click Configuration**: Single button to configure everything automatically

#### New Commands

- `Brain: Configure MCP Server (Windsurf/Cursor)` - Manually trigger MCP configuration
- `Brain: Show MCP Status` - Display current configuration status and environment details

#### Templates/Snippets

- **New Template View**: New view in the sidebar with organization by framework and type
- **3 types of templates**: snippet (code), file (single file), multifile (complete structure)
- **MCP Tools**: `brainTemplateSave`, `brainTemplateSearch`, `brainTemplateApply`
- **Brain Tools**: `whytcard-brain_templateSearch`, `templateSave`, `templateApply`
- **UI Commands**: Add Template, View Template, Delete Template, Apply Template
- **Enriched Webview**: Visualize templates with metadata
- **Usage Counter**: Statistics for each template
- **Tag Support**: Filter by framework/language/type
- **Total Autonomy**: Agent can manage its own reusable templates

### 🔧 Improvements

#### Developer Experience

- **Simplified Installation**: From 10+ manual steps to 2 simple steps
- **Cross-Platform Support**: Works on any PC with zero manual configuration
- **Comprehensive Documentation**: New INSTALL.md with detailed troubleshooting
- **Quick Start Guide**: Get started in 5 minutes with QUICKSTART.md

#### Technical Improvements

- **Activation Events Cleanup**: Removed redundant activation events (Windsurf handles these automatically)
- **Service Architecture**: New `McpSetupService` for modular configuration management
- **Error Handling**: Better error messages and recovery suggestions
- **Path Resolution**: Improved database and config path detection across platforms

### 📚 Documentation

- Added `INSTALL.md` - Comprehensive installation guide
- Added `QUICKSTART.md` - 5-minute quick start guide
- Updated `README.md` - Simplified installation instructions
- Added Release package documentation

### 🧪 Testing

- Added `test-auto-setup.js` - Automated testing for auto-configuration
- Added `test-mcp-fixed.js` - MCP server integration tests
- Added `test-extension.js` - Extension component tests
- All tests passing (24/24 for auto-setup, 7/7 for integration)

### 🐛 Bug Fixes

- Fixed activation events causing lint warnings
- Improved MCP config path detection for Windsurf - Next
- Better handling of missing Node.js installations

---

## [1.0.0] - Previous Release

### Initial Release Features

#### Core Functionality

- **Language Model Tools**: 9 tools for GitHub Copilot integration
  - `brainConsult` - Load instructions + context + search docs
  - `brainSave` - Store new documentation
  - `brainSearch` - Search local knowledge base
  - `brainBug` - Record bug solutions
  - `brainSession` - Log session summaries
  - `brainInstructions` - Load coding rules
  - `brainContext` - Load project context
  - `brainInit` - Initialize Brain for project
  - `brainDebug` - Analyze errors

#### MCP Server

- **Windsurf/Cursor Support**: MCP server for Cascade integration
- **Strict Mode**: Enforce grounded, documented responses
- **Policy Enforcement**: Require sources, consult TTL, etc.
- **6 MCP Tools**: brainConsult, brainSave, brainBug, brainSession, brainSearch, brainValidate

#### Knowledge Management

- **SQLite Database**: Local storage using sql.js (WASM)
- **4 Categories**: Instructions, Documentation, Context, Stats
- **Domain Grouping**: Website, Mobile, Backend, DevOps, General
- **Full-Text Search**: Search across all stored knowledge
- **Export/Import**: JSON export for backup and sharing

#### UI/UX

- **Sidebar Views**: 4 tree views for browsing knowledge
- **Webview Panel**: Rich document viewer with markdown support
- **Status Bar**: Quick access to search
- **Commands**: 11+ commands for managing Brain
- **Chat Participant**: `@brain` for interactive queries

#### Auto-Sync

- **Database Watcher**: Detects external changes
- **Periodic Refresh**: Auto-reload every 30 seconds
- **Multi-Window Support**: Sync across VS Code windows

#### Copilot Integration

- **Auto-Setup**: Automatic `.github/copilot-instructions.md` creation
- **Tool References**: Copilot automatically uses Brain tools
- **Instruction Files**: Enable via setting

---

## Release Notes

### What's Coming Next

- **Template System**: Store and reuse code snippets and multi-file templates
- **Cloud Sync**: Optional cloud backup and team sharing
- **VS Code Marketplace**: Official marketplace release
- **npm Package**: Published MCP server package

### Breaking Changes

None in this release. Fully backward compatible with v1.0.0.

### Migration Guide

If upgrading from v1.0.0:

1. Uninstall old version
2. Install v1.1.0
3. Follow the auto-configuration prompt
4. Your database is automatically preserved
5. No manual configuration changes needed

### Known Issues

- **MCP Auto-Config**: May require manual Node.js PATH configuration on some Windows systems
- **VS Code**: Native MCP support not yet available (use Language Model Tools instead)
- **Beta Features**: Template system not yet released (coming soon)

---

## Support

For issues, questions, or feature requests:

- 📝 Check [INSTALL.md](./INSTALL.md) for troubleshooting
- 🐛 Report bugs on GitHub
- 💬 Join discussions

---

## License

MIT License - See LICENSE file for details
