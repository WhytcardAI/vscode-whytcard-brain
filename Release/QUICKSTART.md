# WhytCard Brain - Quick Start Guide

Get up and running with WhytCard Brain in 5 minutes!

---

## Step 1: Install the Extension

### Windsurf / Cursor / VS Code

**Option A: Via Command Line**

```bash
code --install-extension whytcard-brain.vsix
```

**Option B: Via GUI**

1. Open Extensions panel (Ctrl/Cmd+Shift+X)
2. Click `...` menu → `Install from VSIX...`
3. Select `whytcard-brain.vsix`
4. Reload/Restart your editor

✅ Extension installed!

---

## Step 2: Configure (Automatic)

### For Windsurf/Cursor Users

After installation:

1. **Wait 3 seconds** - A notification appears:

   > "WhytCard Brain can integrate with Windsurf Cascade via MCP..."

2. **Click "Configure Now"**
   - ✅ Environment detected automatically
   - ✅ Node.js found
   - ✅ MCP config written
   - ✅ Database path set

3. **Click "Restart Now"**

🎉 **Done!** Brain is now integrated with Cascade/Cursor AI.

### For VS Code Users

No additional setup needed! Brain works via **GitHub Copilot Language Model Tools**.

Just make sure you have **GitHub Copilot** installed.

---

## Step 3: First Use

### Test the Integration

**In Windsurf/Cursor Cascade:**

```
Ask any question, Brain is automatically consulted!
```

**In VS Code Copilot Chat:**

```
@brain What is React Server Components?
```

Or enable automatic Brain consultation:

1. Run command: **Brain: Install Copilot Chat Instructions**
2. Now Copilot always uses Brain automatically!

---

## Step 4: Add Your First Documentation

### Via Sidebar

1. Click the **Brain icon** in the Activity Bar (left sidebar)
2. Click the **+ (Add)** button
3. Fill in:
   - **Library:** e.g., "nextjs"
   - **Topic:** e.g., "server-components"
   - **Title:** e.g., "React Server Components Guide"
   - **Content:** Your documentation
   - **URL:** (optional) Source URL
   - **Category:** `documentation` (default)
4. Save

### Via AI Commands

**In Windsurf Cascade:**

```
Save this documentation about Next.js App Router:
[paste your content]
```

Brain will automatically use `brainSave` tool to store it.

**In VS Code Copilot:**

```
@brain save this doc about TypeScript...
```

---

## Step 5: Use Brain in Your Workflow

### Automatic Consultation

When you ask questions, the AI automatically:

1. Calls `brainConsult` to search local knowledge
2. Uses your stored docs to answer
3. Avoids hallucinations by using your verified docs

### Manual Queries

**Search your Brain:**

```bash
# Run command (Ctrl/Cmd+Shift+P)
Brain: Search
```

**View a document:**

- Click any item in the sidebar
- View in a rich webview panel

**Export your knowledge:**

```bash
Brain: Export
```

---

## Common Workflows

### 1. Save External Documentation

When you find useful docs online:

```
# In Cascade/Copilot:
Save this Next.js documentation:

Library: nextjs
Topic: data-fetching
Title: Server Actions in Next.js 15
URL: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions
Content: [paste the key information]
```

### 2. Define Project Rules

Create mandatory instructions:

```bash
# Via sidebar: Category = "instruction"
Title: Code Style Rules
Content:
- Always use TypeScript strict mode
- Use Prettier for formatting
- Max line length: 100 characters
- No console.log in production
```

Now the AI will **always** follow these rules!

### 3. Document Project Architecture

Store your project context:

```bash
# Via sidebar: Category = "project"
Title: App Architecture
Content:
Tech Stack:
- Next.js 15 (App Router)
- React 19
- TailwindCSS + shadcn/ui
- Prisma + PostgreSQL
- Deployed on Vercel

Project Structure:
- /app - Next.js app directory
- /components - React components
- /lib - Utilities and helpers
```

### 4. Record Bug Solutions

When you fix a bug:

```bash
# Via AI or sidebar
Store this bug solution:

Symptom: "use client" directive causes hydration error
Solution: Move client components to separate files
Library: nextjs
Error: Error: Hydration failed because the initial UI...
```

Next time you encounter it, Brain will suggest the solution!

---

## Pro Tips

### ✨ Tip 1: Use Categories Wisely

- **instruction** → Mandatory rules (always shown to AI)
- **documentation** → Reference material (searchable)
- **project** → Current project context (always shown)

### ✨ Tip 2: Add Source URLs

Always include URLs when saving external docs:

- Enables strict mode validation
- Provides source attribution
- Allows easy reference

### ✨ Tip 3: Check MCP Status

Verify everything is working:

```bash
Brain: Show MCP Status
```

### ✨ Tip 4: Use the Status Bar

Click the Brain status bar item (bottom right) to quickly search your knowledge base.

---

## Verification

### Test 1: Check the Sidebar

✅ You should see 4 views:

- Instructions
- Documentation
- Context
- Stats

### Test 2: Query Brain

In Cascade/Copilot:

```
What instructions are in Brain?
```

Should show your stored instructions.

### Test 3: Check MCP (Windsurf/Cursor)

Run: **Brain: Show MCP Status**

Should show:

```
Environment: windsurf (or cursor)
MCP Supported: Yes
Configured: Yes
```

---

## Next Steps

1. **Populate your Brain:**
   - Add your project's coding standards
   - Store frequently used documentation
   - Document your architecture

2. **Enable auto-consultation:**
   - Run: **Brain: Install Copilot Chat Instructions**
   - Now Copilot always uses Brain by default

3. **Explore the docs:**
   - Read `INSTALL.md` for advanced configuration
   - Check main `README.md` for all features

---

## Troubleshooting

### Issue: "MCP not configured"

**Solution:**

```bash
Brain: Configure MCP Server (Windsurf/Cursor)
```

### Issue: "@brain not working in Copilot"

**Solution:**

1. Verify GitHub Copilot is installed
2. Try `#brain` instead of `@brain`
3. Use commands via sidebar instead

### Issue: "No documentation found"

**Solution:**
Add some docs first! Click the **+ button** in the sidebar.

---

**You're all set! Start using WhytCard Brain to supercharge your AI development workflow! 🚀**

For more help, see `INSTALL.md` or the main documentation.
