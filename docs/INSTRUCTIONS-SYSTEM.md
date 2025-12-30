# WhytCard Brain - Instructions System

## Overview

The Brain instructions system generates editor-specific rule files that guide AI assistants (Copilot, Windsurf, Cursor) to use the Brain knowledge base effectively.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Brain Database                            │
│  (Documentation, Templates, Bugs, Sessions)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              regenerate-instructions.js                      │
│  - Themes (base, nextjs-site, nextjs-app, react-app, etc.)  │
│  - Stack-specific rules (nextjs16, react19, tailwind4...)   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Windsurf      │ │    Cursor       │ │  VS Code/Copilot│
│ .windsurf/rules │ │ .cursor/rules   │ │ .github/        │
│   /brain.md     │ │   /brain.mdc    │ │ copilot-        │
│                 │ │                 │ │ instructions.md │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Themes

| Theme | Description | Stacks Included |
|-------|-------------|-----------------|
| `base` | Core Brain rules only | None |
| `nextjs-site` | Next.js 16 website | nextjs16, react19, tailwind4, i18n, performance, accessibility, seo |
| `nextjs-app` | Next.js 16 application | nextjs16, react19, typescript, tailwind4, performance |
| `react-app` | React 19 SPA | react19, typescript, tailwind4 |
| `node-api` | Node.js backend | typescript, nodejs |

## Usage

### Generate Instructions

```bash
# Base rules only
node scripts/regenerate-instructions.js

# With theme
node scripts/regenerate-instructions.js --theme=nextjs-site
```

### Files Generated

| File | Editor | Format |
|------|--------|--------|
| `.windsurf/rules/brain.md` | Windsurf, Windsurf Next | YAML frontmatter + Markdown |
| `.cursor/rules/brain.mdc` | Cursor | MDC format |
| `.github/copilot-instructions.md` | VS Code, VS Code Insiders, GitHub Copilot | Markdown |

## How the Chat Agent Should Use This

### 1. Agent Checks for Instructions

When the agent starts working on a project, it should:

1. Call `brainConsult` to check if project-specific instructions exist
2. If instructions are missing, detect project type from `package.json`
3. Suggest generating appropriate instructions

### 2. Agent Detects Project Type

```javascript
// Pseudo-code for project detection
function detectProjectType(packageJson) {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['next']) {
    if (deps['next-intl']) return 'nextjs-site';
    return 'nextjs-app';
  }
  if (deps['react'] && !deps['next']) return 'react-app';
  if (deps['express'] || deps['fastify']) return 'node-api';
  
  return 'base';
}
```

### 3. Agent Imports from Brain

The agent should NOT auto-generate instructions. Instead:

1. Check Brain DB for existing instructions
2. If found → use them
3. If not found → ask user which theme to use
4. Generate and save to Brain

### 4. Example Agent Workflow

```
User: "Help me with this Next.js project"

Agent:
1. brainConsult({ query: "project instructions" })
2. No instructions found
3. Detect: package.json has "next" + "next-intl" → nextjs-site
4. Ask: "I detected a Next.js 16 website. Should I set up instructions for this project type?"
5. User confirms
6. Generate instructions with theme=nextjs-site
7. brainSave({ title: "Project Instructions", content: "...", category: "instruction" })
```

## Adding New Stacks

1. Add stack to `STACK_INSTRUCTIONS` in `regenerate-instructions.js`
2. Add theme to `THEMES` with stack list
3. Run `node scripts/regenerate-instructions.js --theme=<new-theme>`

## Stack Instruction Format

Each stack should provide concise, actionable rules:

```javascript
const STACK_INSTRUCTIONS = {
  mystack: `
## MyStack Rules

### Key Points
| Feature | Requirement |
|---------|-------------|
| X | Do Y |
| A | Use B |

### Code Example
\`\`\`typescript
// Example code
\`\`\`
`,
};
```

## Best Practices

1. **Tables over prose** - Quick reference format
2. **Code examples** - Real patterns, not abstract descriptions
3. **DO/DON'T format** - Clear actionable guidance
4. **Version-specific** - Include breaking changes for major versions
5. **Concise** - Each stack block should be < 50 lines

