# WhytCard Brain MCP Server

MCP (Model Context Protocol) server for WhytCard Brain - a local knowledge base for AI assistants.

## Installation

```bash
npx whytcard-brain-mcp
```

Or install globally:

```bash
npm install -g whytcard-brain-mcp
```

## Configuration

### Windsurf Cascade

Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "npx",
      "args": ["-y", "whytcard-brain-mcp"],
      "env": {
        "BRAIN_DB_PATH": "",
        "BRAIN_REQUIRE_CONSULT": "1",
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

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "npx",
      "args": ["-y", "whytcard-brain-mcp"]
    }
  }
}
```

## Environment Variables

| Variable                           | Default     | Description                             |
| ---------------------------------- | ----------- | --------------------------------------- |
| `BRAIN_DB_PATH`                    | Auto-detect | Path to brain.db SQLite database        |
| `BRAIN_REQUIRE_CONSULT`            | `1`         | Require brainConsult before other tools |
| `BRAIN_CONSULT_TTL_MS`             | `1200000`   | Consult validity (20 min)               |
| `BRAIN_STRICT_MODE`                | `0`         | Block if brainConsult finds no docs     |
| `BRAIN_STRICT_REQUIRE_SOURCES`     | `1`         | Require docs with source URLs           |
| `BRAIN_REQUIRE_CONSULT_EVERY_TOOL` | `0`         | Force consult before every tool call    |

## Available Tools

### brainConsult

**Always call first.** Loads instructions, project context, and searches documentation.

### brainSearch

Search the local Brain knowledge base for documentation.

### brainSave

Store new documentation (requires source URL in strict mode).

### brainBug

Record a bug/error and its solution.

### brainSession

Log a work session summary.

### brainValidate

Validate that a response is grounded in Brain documentation (strict mode).

## Strict Mode

Enable strict mode to ensure AI responses are always grounded in official documentation:

```json
"env": {
  "BRAIN_STRICT_MODE": "1",
  "BRAIN_STRICT_REQUIRE_SOURCES": "1"
}
```

With strict mode:

- `brainConsult` must find at least one document
- Documents must have source URLs
- `brainSave` requires a URL
- `brainValidate` checks for speculative language

## License

MIT
