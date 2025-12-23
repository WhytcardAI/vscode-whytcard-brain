# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in WhytCard Brain, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

## Security Considerations

### Data Storage

- All data is stored locally in a SQLite database
- No data is sent to external servers by the extension itself
- Database location: `~/.vscode/globalStorage/whytcard.whytcard-brain/brain.db`

### MCP Server

- The MCP server runs locally and communicates via stdio
- No network ports are opened by the extension
- Environment variables can be used to configure paths

### Workspace Trust

- The extension respects VS Code's Workspace Trust settings
- Sensitive operations are guarded in untrusted workspaces

## Dependencies

We regularly audit dependencies for known vulnerabilities using `npm audit`.
