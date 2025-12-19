#!/usr/bin/env node
/**
 * WhytCard Brain - MCP Server (stdio)
 * Exposes Brain tools for Windsurf/Cascade integration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

// =====================
// Types (same as brainService.ts)
// =====================

interface Doc {
  id?: number;
  library: string;
  version?: string;
  topic: string;
  title: string;
  content: string;
  source?: string;
  url?: string;
  category?: string;
  domain?: string;
  created_at?: string;
}

interface Pitfall {
  id?: number;
  symptom: string;
  solution: string;
  error?: string;
  library?: string;
  code?: string;
  count?: number;
  created_at?: string;
}

// =====================
// Database Path Resolution
// =====================

function getDefaultDbPath(): string {
  // VS Code extension stores DB in globalStorage: ~/<appdata>/whytcard.whytcard-brain/brain.db
  // We support multiple locations for flexibility
  const candidates = [
    // Windows: %APPDATA%\Code\User\globalStorage\whytcard.whytcard-brain\brain.db
    path.join(
      process.env.APPDATA || "",
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // macOS: ~/Library/Application Support/Code/User/globalStorage/whytcard.whytcard-brain/brain.db
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // Linux: ~/.config/Code/User/globalStorage/whytcard.whytcard-brain/brain.db
    path.join(
      os.homedir(),
      ".config",
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // Windsurf (Codeium) paths
    path.join(
      process.env.APPDATA || "",
      "Windsurf",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Windsurf",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    path.join(
      os.homedir(),
      ".config",
      "Windsurf",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
  ];

  // Check env override first
  if (process.env.BRAIN_DB_PATH) {
    return process.env.BRAIN_DB_PATH;
  }

  // Find first existing DB
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Default to first candidate (will be created)
  return candidates[0];
}

// =====================
// Brain Database Service (standalone for MCP)
// =====================

class BrainDbService {
  private db: Database | null = null;
  private dbPath: string;
  private SQL: SqlJsStatic | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<boolean> {
    try {
      // Locate WASM file - check multiple locations
      const wasmCandidates = [
        path.join(__dirname, "sql-wasm.wasm"),
        path.join(__dirname, "..", "dist", "sql-wasm.wasm"),
        path.join(
          __dirname,
          "..",
          "node_modules",
          "sql.js",
          "dist",
          "sql-wasm.wasm",
        ),
      ];

      let wasmPath: string | undefined;
      for (const p of wasmCandidates) {
        if (fs.existsSync(p)) {
          wasmPath = p;
          break;
        }
      }

      if (!wasmPath) {
        // Use CDN fallback (works for Node.js)
        this.SQL = await initSqlJs();
      } else {
        this.SQL = await initSqlJs({
          locateFile: () => wasmPath!,
        });
      }

      // Create directory if needed
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(filebuffer);
      } else {
        this.db = new this.SQL.Database();
        this.initSchema();
        this.saveDatabase();
      }

      return true;
    } catch (error) {
      console.error("[BrainMCP] Failed to connect:", error);
      return false;
    }
  }

  private saveDatabase(): void {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error("[BrainMCP] Error saving database:", error);
    }
  }

  private initSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library TEXT NOT NULL,
        version TEXT,
        topic TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        url TEXT,
        category TEXT DEFAULT 'documentation',
        domain TEXT DEFAULT 'general',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pitfalls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symptom TEXT NOT NULL,
        solution TEXT NOT NULL,
        error TEXT,
        library TEXT,
        code TEXT,
        count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_docs_library ON docs(library);
      CREATE INDEX IF NOT EXISTS idx_pitfalls_library ON pitfalls(library);
    `);
  }

  private query<T>(sql: string, params?: any[]): T[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params);
    }

    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  private queryOne<T>(sql: string, params?: any[]): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  // =====================
  // Public API
  // =====================

  getAllInstructions(): Doc[] {
    return this.query<Doc>(
      `SELECT * FROM docs WHERE category = 'instruction' ORDER BY library, topic`,
    );
  }

  getProjectContext(): Doc[] {
    return this.query<Doc>(
      `SELECT * FROM docs WHERE category = 'project' ORDER BY library, topic`,
    );
  }

  searchDocs(query: string, library?: string, category?: string): Doc[] {
    try {
      const likePattern = `%${query}%`;
      let sql = `SELECT * FROM docs WHERE (title LIKE ? OR content LIKE ? OR topic LIKE ?)`;
      const params: any[] = [likePattern, likePattern, likePattern];

      if (library) {
        const normalized = library.toLowerCase().replace(/[.\s]+/g, "");
        sql += ` AND (library LIKE ? OR REPLACE(REPLACE(LOWER(library), '.', ''), ' ', '') LIKE ?)`;
        params.push(`%${library}%`, `%${normalized}%`);
      }

      if (category) {
        sql += ` AND category = ?`;
        params.push(category);
      }

      sql += ` ORDER BY library, topic LIMIT 20`;
      return this.query<Doc>(sql, params);
    } catch (error) {
      console.error("[BrainMCP] Error searching docs:", error);
      return [];
    }
  }

  searchPitfalls(query: string): Pitfall[] {
    try {
      const likePattern = `%${query}%`;
      return this.query<Pitfall>(
        `
        SELECT * FROM pitfalls
        WHERE symptom LIKE ? OR solution LIKE ? OR error LIKE ? OR library LIKE ?
        ORDER BY count DESC
        LIMIT 10
      `,
        [likePattern, likePattern, likePattern, likePattern],
      );
    } catch (error) {
      console.error("[BrainMCP] Error searching pitfalls:", error);
      return [];
    }
  }

  addDoc(doc: Omit<Doc, "id" | "created_at">): number | null {
    if (!this.db) return null;

    try {
      this.db.run(
        `
        INSERT INTO docs (library, version, topic, title, content, source, url, category, domain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          doc.library,
          doc.version || null,
          doc.topic,
          doc.title,
          doc.content,
          doc.source || "mcp",
          doc.url || null,
          doc.category || "documentation",
          doc.domain || "general",
        ],
      );

      const result = this.queryOne<{ id: number }>(
        "SELECT last_insert_rowid() as id",
      );
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      console.error("[BrainMCP] Error adding doc:", error);
      return null;
    }
  }

  addPitfall(
    pitfall: Omit<Pitfall, "id" | "count" | "created_at">,
  ): number | null {
    if (!this.db) return null;

    try {
      this.db.run(
        `
        INSERT INTO pitfalls (symptom, solution, error, library, code)
        VALUES (?, ?, ?, ?, ?)
      `,
        [
          pitfall.symptom,
          pitfall.solution,
          pitfall.error || null,
          pitfall.library || null,
          pitfall.code || null,
        ],
      );

      const result = this.queryOne<{ id: number }>(
        "SELECT last_insert_rowid() as id",
      );
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      console.error("[BrainMCP] Error adding pitfall:", error);
      return null;
    }
  }

  appendToDoc(
    library: string,
    topic: string,
    title: string,
    newContent: string,
  ): number | null {
    const existing = this.queryOne<Doc>(
      "SELECT * FROM docs WHERE library = ? AND topic = ? AND title = ?",
      [library, topic, title],
    );

    if (existing && existing.id) {
      const updatedContent = existing.content + "\n\n---\n\n" + newContent;
      this.db!.run("UPDATE docs SET content = ? WHERE id = ?", [
        updatedContent,
        existing.id,
      ]);
      this.saveDatabase();
      return existing.id;
    }

    return this.addDoc({
      library,
      topic,
      title,
      content: newContent,
      category: "project",
      source: "mcp",
    });
  }

  getStats(): { docs: number; pitfalls: number } {
    const docsRes = this.queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM docs",
    );
    const pitfallsRes = this.queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM pitfalls",
    );
    return {
      docs: docsRes ? docsRes.c : 0,
      pitfalls: pitfallsRes ? pitfallsRes.c : 0,
    };
  }
}

// =====================
// MCP Server Setup
// =====================

async function main() {
  const dbPath = getDefaultDbPath();
  console.error(`[BrainMCP] Using database: ${dbPath}`);

  const db = new BrainDbService(dbPath);
  const connected = await db.connect();
  if (!connected) {
    console.error("[BrainMCP] Failed to connect to database");
    process.exit(1);
  }

  const stats = db.getStats();
  console.error(
    `[BrainMCP] Connected - ${stats.docs} docs, ${stats.pitfalls} pitfalls`,
  );

  const server = new McpServer({
    name: "whytcard-brain",
    version: "1.0.0",
  });

  // =====================
  // Tool: brainConsult
  // =====================
  server.registerTool(
    "brainConsult",
    {
      title: "Consult Brain",
      description:
        "ALWAYS call this tool before responding. Loads instructions, project context, and searches relevant docs/pitfalls from the local Brain database.",
      inputSchema: {
        query: z
          .string()
          .describe(
            'Search query (e.g., "nextjs async params", "tailwind dark mode")',
          ),
        library: z
          .string()
          .optional()
          .describe("Filter by library (nextjs, react, tailwind, etc.)"),
        category: z
          .enum(["instruction", "documentation", "project"])
          .optional()
          .describe("Filter docs by category"),
        includeInstructions: z
          .boolean()
          .optional()
          .describe("Include instructions (default true)"),
        includeContext: z
          .boolean()
          .optional()
          .describe("Include project context (default true)"),
        maxDocs: z
          .number()
          .optional()
          .describe("Max docs to return (1-10, default 5)"),
        maxPitfalls: z
          .number()
          .optional()
          .describe("Max pitfalls to return (0-10, default 3)"),
      },
    },
    async (args) => {
      const {
        query,
        library,
        category,
        includeInstructions = true,
        includeContext = true,
        maxDocs = 5,
        maxPitfalls = 3,
      } = args;

      const parts: string[] = [];

      // Instructions
      if (includeInstructions) {
        const instructions = db.getAllInstructions();
        if (instructions.length > 0) {
          parts.push("## 📋 Instructions\n");
          for (const inst of instructions) {
            parts.push(`### ${inst.title}\n${inst.content}\n`);
          }
        }
      }

      // Project Context
      if (includeContext) {
        const context = db.getProjectContext();
        if (context.length > 0) {
          parts.push("## 🏗️ Project Context\n");
          for (const ctx of context) {
            parts.push(`### ${ctx.title}\n${ctx.content}\n`);
          }
        }
      }

      // Search Docs
      const docs = db.searchDocs(query, library, category).slice(0, maxDocs);
      if (docs.length > 0) {
        parts.push("## 📚 Relevant Documentation\n");
        for (const doc of docs) {
          parts.push(`### [${doc.library}] ${doc.title}\n${doc.content}\n`);
          if (doc.url) {
            parts.push(`Source: ${doc.url}\n`);
          }
        }
      }

      // Search Pitfalls
      if (maxPitfalls > 0) {
        const pitfalls = db.searchPitfalls(query).slice(0, maxPitfalls);
        if (pitfalls.length > 0) {
          parts.push("## ⚠️ Known Pitfalls\n");
          for (const p of pitfalls) {
            parts.push(`### ${p.symptom}\n**Solution:** ${p.solution}\n`);
            if (p.error) {
              parts.push(`**Error:** \`${p.error}\`\n`);
            }
            if (p.code) {
              parts.push(`\`\`\`\n${p.code}\n\`\`\`\n`);
            }
          }
        }
      }

      const result =
        parts.length > 0 ?
          parts.join("\n")
        : "No relevant information found in Brain.";

      return {
        content: [{ type: "text", text: result }],
      };
    },
  );

  // =====================
  // Tool: brainSave
  // =====================
  server.registerTool(
    "brainSave",
    {
      title: "Save to Brain",
      description:
        "Store new documentation in the local Brain database. Use AFTER finding useful info from external sources.",
      inputSchema: {
        library: z
          .string()
          .describe("Library name (nextjs, react, tailwind, etc.)"),
        topic: z.string().describe("Topic (routing, hooks, styling, etc.)"),
        title: z.string().describe("Documentation title"),
        content: z.string().describe("Documentation content"),
        url: z.string().optional().describe("Source URL"),
        category: z
          .enum(["instruction", "documentation", "project"])
          .optional()
          .describe("Category (default: documentation)"),
      },
    },
    async (args) => {
      const { library, topic, title, content, url, category } = args;

      const id = db.addDoc({
        library,
        topic,
        title,
        content,
        url,
        category: category || "documentation",
        source: "mcp",
      });

      if (id) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Documentation saved to Brain (ID: ${id})\n- Library: ${library}\n- Topic: ${topic}\n- Title: ${title}`,
            },
          ],
        };
      } else {
        return {
          content: [
            { type: "text", text: "❌ Failed to save documentation to Brain." },
          ],
        };
      }
    },
  );

  // =====================
  // Tool: brainBug
  // =====================
  server.registerTool(
    "brainBug",
    {
      title: "Save Bug/Pitfall",
      description:
        "Store a known bug/error and its solution. Use when you solve an error to avoid encountering it again.",
      inputSchema: {
        symptom: z.string().describe("Problem description"),
        solution: z.string().describe("How to solve the problem"),
        error: z.string().optional().describe("Error message"),
        library: z.string().optional().describe("Related library"),
        code: z.string().optional().describe("Fix code snippet"),
      },
    },
    async (args) => {
      const { symptom, solution, error, library, code } = args;

      const id = db.addPitfall({
        symptom,
        solution,
        error,
        library,
        code,
      });

      if (id) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Pitfall saved to Brain (ID: ${id})\n- Symptom: ${symptom}\n- Solution: ${solution}`,
            },
          ],
        };
      } else {
        return {
          content: [
            { type: "text", text: "❌ Failed to save pitfall to Brain." },
          ],
        };
      }
    },
  );

  // =====================
  // Tool: brainSession
  // =====================
  server.registerTool(
    "brainSession",
    {
      title: "Log Session",
      description:
        "Record a summary of the current work session. Use at end of conversation to save progress.",
      inputSchema: {
        project: z.string().describe("Project name"),
        summary: z.string().describe("Summary of what was done"),
        decisions: z.string().optional().describe("Technical decisions made"),
        nextSteps: z.string().optional().describe("Planned next steps"),
      },
    },
    async (args) => {
      const { project, summary, decisions, nextSteps } = args;

      const date = new Date().toISOString().split("T")[0];
      let content = `## Session ${date}\n\n${summary}`;

      if (decisions) {
        content += `\n\n### Decisions\n${decisions}`;
      }
      if (nextSteps) {
        content += `\n\n### Next Steps\n${nextSteps}`;
      }

      const id = db.appendToDoc(
        project,
        "session-log",
        `Session Log - ${project}`,
        content,
      );

      if (id) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Session logged for project "${project}" (Doc ID: ${id})`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text", text: "❌ Failed to log session." }],
        };
      }
    },
  );

  // =====================
  // Tool: brainSearch
  // =====================
  server.registerTool(
    "brainSearch",
    {
      title: "Search Brain",
      description:
        "Search the local Brain database for documentation and pitfalls.",
      inputSchema: {
        query: z.string().describe("Search query"),
        library: z.string().optional().describe("Filter by library"),
        category: z
          .enum(["instruction", "documentation", "project"])
          .optional()
          .describe("Filter by category"),
      },
    },
    async (args) => {
      const { query, library, category } = args;

      const docs = db.searchDocs(query, library, category);
      const pitfalls = db.searchPitfalls(query);

      const parts: string[] = [];

      if (docs.length > 0) {
        parts.push("## 📚 Documentation\n");
        for (const doc of docs) {
          parts.push(`### [${doc.library}] ${doc.title}\n${doc.content}\n`);
        }
      }

      if (pitfalls.length > 0) {
        parts.push("## ⚠️ Pitfalls\n");
        for (const p of pitfalls) {
          parts.push(`### ${p.symptom}\n${p.solution}\n`);
        }
      }

      const result = parts.length > 0 ? parts.join("\n") : "No results found.";

      return {
        content: [{ type: "text", text: result }],
      };
    },
  );

  // =====================
  // Start Server
  // =====================
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[BrainMCP] Server started on stdio");
}

main().catch((error) => {
  console.error("[BrainMCP] Fatal error:", error);
  process.exit(1);
});
