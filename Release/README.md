# WhytCard Brain - Release Package

**Local knowledge base for AI assistants** — Store instructions, documentation, and project context to supercharge your AI-assisted development.

Works with **GitHub Copilot** (VS Code), **Cascade** (Windsurf), and **Cursor AI**.

---

## 📦 Package Contents

- `whytcard-brain.vsix` - Extension package (ready to install)
- `INSTALL.md` - Detailed installation guide
- `QUICKSTART.md` - Quick start guide
- `CHANGELOG.md` - Version history

---

## 🚀 Quick Installation

### For Windsurf / Cursor Users (Recommended)

1. **Install the extension:**

   ```bash
   code --install-extension whytcard-brain.vsix
   ```

   Or use your editor's Extensions panel → Install from VSIX

2. **Wait for auto-configuration:**
   - A notification will appear after 3 seconds
   - Click **"Configure Now"**
   - Restart when prompted
   - ✅ Done! Brain is ready to use with Cascade AI

### For VS Code Users

1. **Install the extension:**

   ```bash
   code --install-extension whytcard-brain.vsix
   ```

2. **Install GitHub Copilot** (if not already installed)

3. **Start using Brain:**
   - Use `@brain` in Copilot Chat
   - Or run: **Brain: Install Copilot Chat Instructions** for automatic Brain consultation

---

## ✨ Key Features

### 🤖 AI Integration

- **6 Language Model Tools** automatically used by Copilot/Cascade
- **MCP Server** for Windsurf and Cursor (auto-configured)
- **Chat Participant** (`@brain`) for interactive queries
- **Strict Mode** to enforce grounded, documented responses

### 📚 Knowledge Management

- **5 Views:** Instructions, Documentation, Context, Templates, Stats
- **Domain Grouping:** Website, Mobile, Backend, DevOps, General
- **Auto-Sync:** Real-time updates across windows
- **Search:** Full-text search across stored entries

### 🛠️ Developer Experience

- **Sidebar Panel** for browsing knowledge (agent-driven workflow)
- **Webview Display** for rich document viewing
- **Copilot Instructions** integration
- **Status Bar** indicator

---

## 📖 Documentation

- **[INSTALL.md](./INSTALL.md)** - Detailed installation guide with troubleshooting
- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and updates

For the full README and development guide, visit:
https://github.com/WhytCard/vscode-whytcard-brain

---

## 🔐 Verification

To verify the integrity of the extension package:

```bash
# Windows (PowerShell)
Get-FileHash whytcard-brain.vsix -Algorithm SHA256

# macOS/Linux
shasum -a 256 whytcard-brain.vsix
```

Compare the output with the hash in `checksums.txt`.

---

## 🆘 Support

### Common Issues

**"MCP not configured"**
→ Run: **Brain: Configure MCP Server (Windsurf/Cursor)**

**"Node.js not found"**
→ Install Node.js from [nodejs.org](https://nodejs.org) and restart

**"Database connection failed"**
→ Check: **Brain: Show MCP Status** for database path

### Get Help

- 📝 Read [INSTALL.md](./INSTALL.md) for detailed troubleshooting
- 🐛 Report issues on GitHub
- 💬 Check existing discussions

---

## 📋 System Requirements

- **Editor:** VS Code 1.89.0+, Windsurf, or Cursor
- **Node.js:** v18+ (for MCP server)
- **Copilot:** GitHub Copilot (optional, for VS Code)
- **OS:** Windows 10+, macOS 10.15+, Linux

---

## 📄 License

MIT License - See LICENSE file for details

---

## What's New

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

Enjoy using WhytCard Brain!
