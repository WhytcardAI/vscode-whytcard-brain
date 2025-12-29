#!/usr/bin/env node
/**
 * WhytCard Brain - MCP Server (stdio)
 * Exposes Brain tools for Windsurf/Cascade integration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { inferDomain, normalizeForSearch } from "./core/brainDbCore";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// SQL parameter types for type safety
type SqlValue = string | number | null | Uint8Array;
type SqlParams = SqlValue[];

type BrainCategory = "instruction" | "documentation" | "project";

type BrainConsultArgs = {
  query: string;
  library?: string;
  category?: BrainCategory;
  includeInstructions?: boolean;
  includeContext?: boolean;
  maxDocs?: number;
  maxPitfalls?: number;
};

type BrainSaveArgs = {
  library: string;
  topic: string;
  title: string;
  content: string;
  url?: string;
  category?: BrainCategory;
};

type BrainBugArgs = {
  symptom: string;
  solution: string;
  error?: string;
  library?: string;
  code?: string;
};

type BrainSessionArgs = {
  project: string;
  summary: string;
  decisions?: string;
  nextSteps?: string;
};

type BrainSearchArgs = {
  query: string;
  library?: string;
  category?: BrainCategory;
};

type BrainValidateArgs = {
  draft: string;
};

type BrainTemplateSaveArgs = {
  name: string;
  description: string;
  type: "snippet" | "file" | "multifile";
  content: string;
  framework?: string;
  language?: string;
  tags?: string[];
};

type BrainTemplateSearchArgs = {
  query: string;
  framework?: string;
  type?: "snippet" | "file" | "multifile";
};

type BrainTemplateApplyArgs = {
  name: string;
};

const sessionState: {
  consultedAtMs: number | null;
  lastConsultQuery: string | null;
  lastConsultDocsCount: number;
  lastConsultDocsWithUrlCount: number;
} = {
  consultedAtMs: null,
  lastConsultQuery: null,
  lastConsultDocsCount: 0,
  lastConsultDocsWithUrlCount: 0,
};

function isStrictModeEnabled(): boolean {
  const raw = process.env.BRAIN_STRICT_MODE;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "no";
}

function isStrictSourcesRequired(): boolean {
  const raw = process.env.BRAIN_STRICT_REQUIRE_SOURCES;
  if (!raw) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "no";
}

function isConsultEnforced(): boolean {
  const raw = process.env.BRAIN_REQUIRE_CONSULT;
  if (!raw) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "no";
}

function isConsultRequiredEveryToolCall(): boolean {
  const raw = process.env.BRAIN_REQUIRE_CONSULT_EVERY_TOOL;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "no";
}

function clearConsultState(): void {
  sessionState.consultedAtMs = null;
  sessionState.lastConsultQuery = null;
  sessionState.lastConsultDocsCount = 0;
  sessionState.lastConsultDocsWithUrlCount = 0;
}

function getConsultTtlMs(): number {
  const raw = process.env.BRAIN_CONSULT_TTL_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 20 * 60 * 1000;
}

function hasFreshConsult(nowMs: number): boolean {
  if (sessionState.consultedAtMs === null) {
    return false;
  }
  return nowMs - sessionState.consultedAtMs <= getConsultTtlMs();
}

function hasSatisfiedConsult(nowMs: number): boolean {
  if (!hasFreshConsult(nowMs)) {
    return false;
  }

  if (!isStrictModeEnabled()) {
    return true;
  }

  if (sessionState.lastConsultDocsCount <= 0) {
    return false;
  }

  if (isStrictSourcesRequired() && sessionState.lastConsultDocsWithUrlCount <= 0) {
    return false;
  }

  return true;
}

function consultRequiredResult(toolName: string): ToolResult {
  const ttlMinutes = Math.max(1, Math.round(getConsultTtlMs() / 60000));
  const strictHint = isStrictModeEnabled()
    ? `\n\nStrict mode: brainConsult must return at least one documentation entry` +
      `${isStrictSourcesRequired() ? " with a source URL" : ""}. ` +
      `If none, fetch official docs (Context7/Tavily), store them with brainSave (include url), then retry brainConsult.`
    : "";
  return {
    content: [
      {
        type: "text",
        text:
          `❌ Brain policy: call brainConsult before using "${toolName}".\n\n` +
          `Call brainConsult with the user's request as query, then retry.\n` +
          `(brainConsult is required at least once every ~${ttlMinutes} minutes.)` +
          strictHint,
      },
    ],
    isError: true,
  };
}

type ConsultRequirement = "fresh" | "satisfied";

function enforceConsult<TArgs extends Record<string, unknown>>(
  toolName: string,
  handler: (args: TArgs) => Promise<ToolResult>,
  options?: { requirement?: ConsultRequirement },
): (args: TArgs) => Promise<ToolResult> {
  return async (args: TArgs) => {
    if (!isConsultEnforced()) {
      return handler(args);
    }

    const requirement = options?.requirement ?? "satisfied";

    const nowMs = Date.now();
    const ok = requirement === "fresh" ? hasFreshConsult(nowMs) : hasSatisfiedConsult(nowMs);
    if (!ok) {
      return consultRequiredResult(toolName);
    }

    const result = await handler(args);

    if (isConsultRequiredEveryToolCall()) {
      clearConsultState();
    }

    return result;
  };
}

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

interface Template {
  id?: number;
  name: string;
  description: string;
  language?: string;
  framework?: string;
  tags?: string;
  type: "snippet" | "file" | "multifile";
  content: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

// =====================
// Database Path Resolution
// =====================

function getDefaultDbPath(): string {
  // VS Code extension stores DB in globalStorage: ~/<appdata>/whytcard.whytcard-brain/brain.db
  // We support multiple locations for flexibility
  // Priority: Windsurf - Next > Windsurf > Code (most users use Windsurf)
  const candidates = [
    // Windsurf - Next (highest priority)
    path.join(
      process.env.APPDATA || "",
      "Windsurf - Next",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Windsurf - Next",
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
    // VS Code paths (lower priority)
    path.join(
      process.env.APPDATA || "",
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
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
    path.join(
      os.homedir(),
      ".config",
      "Code",
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
  private lastError: string | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<boolean> {
    try {
      this.lastError = null;
      // Locate WASM file - check multiple locations
      const wasmCandidates = [
        path.join(__dirname, "sql-wasm.wasm"),
        path.join(__dirname, "..", "dist", "sql-wasm.wasm"),
        path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
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

      const existed = fs.existsSync(this.dbPath);
      if (existed) {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(filebuffer);
      } else {
        this.db = new this.SQL.Database();
      }

      const mutated = this.initSchema();
      if (!existed || mutated) {
        this.saveDatabase();
      }

      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[BrainMCP] Failed to connect:", error);
      return false;
    }
  }

  getLastError(): string | null {
    return this.lastError;
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

  private initSchema(): boolean {
    if (!this.db) return false;

    let mutated = false;

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

      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        language TEXT,
        framework TEXT,
        tags TEXT,
        type TEXT NOT NULL DEFAULT 'snippet',
        content TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_docs_library ON docs(library);
      CREATE INDEX IF NOT EXISTS idx_pitfalls_library ON pitfalls(library);
      CREATE INDEX IF NOT EXISTS idx_templates_framework ON templates(framework);
      CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
    `);

    const getColumns = (table: string): Set<string> => {
      try {
        const res = this.db!.exec(`PRAGMA table_info(${table});`);
        if (!res || res.length === 0) return new Set();
        const columns = res[0].columns;
        const values = res[0].values;
        const nameIdx = columns.indexOf("name");
        if (nameIdx === -1) return new Set();
        const names = values.map((row) => String(row[nameIdx] ?? "").trim()).filter(Boolean);
        return new Set(names);
      } catch {
        return new Set();
      }
    };

    const ensureColumn = (table: string, column: string, ddl: string) => {
      const cols = getColumns(table);
      if (cols.size === 0 || cols.has(column)) {
        return;
      }
      try {
        this.db!.run(ddl);
        mutated = true;
      } catch (error) {
        console.error(`[BrainMCP] Schema migration failed for ${table}.${column}:`, error);
      }
    };

    ensureColumn("docs", "version", "ALTER TABLE docs ADD COLUMN version TEXT;");
    ensureColumn("docs", "source", "ALTER TABLE docs ADD COLUMN source TEXT;");
    ensureColumn("docs", "url", "ALTER TABLE docs ADD COLUMN url TEXT;");
    ensureColumn("docs", "category", "ALTER TABLE docs ADD COLUMN category TEXT;");
    ensureColumn("docs", "domain", "ALTER TABLE docs ADD COLUMN domain TEXT;");
    ensureColumn("docs", "created_at", "ALTER TABLE docs ADD COLUMN created_at TEXT;");

    ensureColumn("pitfalls", "error", "ALTER TABLE pitfalls ADD COLUMN error TEXT;");
    ensureColumn("pitfalls", "library", "ALTER TABLE pitfalls ADD COLUMN library TEXT;");
    ensureColumn("pitfalls", "code", "ALTER TABLE pitfalls ADD COLUMN code TEXT;");
    ensureColumn("pitfalls", "count", "ALTER TABLE pitfalls ADD COLUMN count INTEGER DEFAULT 1;");
    ensureColumn("pitfalls", "created_at", "ALTER TABLE pitfalls ADD COLUMN created_at TEXT;");

    ensureColumn("templates", "created_at", "ALTER TABLE templates ADD COLUMN created_at TEXT;");
    ensureColumn("templates", "updated_at", "ALTER TABLE templates ADD COLUMN updated_at TEXT;");

    return mutated;
  }

  private query<T>(sql: string, params?: SqlParams): T[] {
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

  private queryOne<T>(sql: string, params?: SqlParams): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  private getEffectiveDomain(doc: Pick<Doc, "domain" | "library">): string {
    const raw = (doc.domain || "").trim();
    if (!raw || raw === "general") {
      return inferDomain(doc.library);
    }
    return raw;
  }

  private findDoc(library: string, topic: string, title: string): Doc | null {
    const normalized = normalizeForSearch(library);
    return this.queryOne<Doc>(
      `
      SELECT * FROM docs
      WHERE topic = ?
        AND title = ?
        AND (
          library = ?
          OR REPLACE(REPLACE(LOWER(library), '.', ''), ' ', '') = ?
        )
      `,
      [topic, title, library, normalized],
    );
  }

  private updateDoc(id: number, updates: Omit<Doc, "id" | "created_at">): boolean {
    if (!this.db) return false;

    try {
      this.lastError = null;
      const domain = this.getEffectiveDomain(updates);

      this.db.run(
        `
        UPDATE docs
        SET library = ?,
            version = ?,
            topic = ?,
            title = ?,
            content = ?,
            source = ?,
            url = ?,
            category = ?,
            domain = ?
        WHERE id = ?
      `,
        [
          updates.library,
          updates.version || null,
          updates.topic,
          updates.title,
          updates.content,
          updates.source || "mcp",
          updates.url || null,
          updates.category || "documentation",
          domain,
          id,
        ],
      );

      this.saveDatabase();
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[BrainMCP] Error updating doc:", error);
      return false;
    }
  }

  upsertDoc(doc: Omit<Doc, "id" | "created_at">): number | null {
    const existing = this.findDoc(doc.library, doc.topic, doc.title);
    if (existing?.id) {
      this.updateDoc(existing.id, doc);
      return existing.id;
    }
    return this.addDoc(doc);
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
    return this.query<Doc>(`SELECT * FROM docs WHERE category = 'project' ORDER BY library, topic`);
  }

  searchDocs(query: string, library?: string, category?: string): Doc[] {
    try {
      const rawQuery = typeof query === "string" ? query.trim() : "";
      if (!rawQuery) {
        return [];
      }

      const likePattern = `%${rawQuery}%`;

      const buildWhere = (where: string) => {
        let sql = `SELECT * FROM docs WHERE ${where}`;
        const params: SqlParams = [];

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
        return { sql, params };
      };

      const phrase = buildWhere(`(title LIKE ? OR content LIKE ? OR topic LIKE ?)`);
      const phraseParams = [likePattern, likePattern, likePattern, ...phrase.params];
      const phraseResults = this.query<Doc>(phrase.sql, phraseParams);
      if (phraseResults.length > 0) {
        return phraseResults;
      }

      const tokens = rawQuery
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .slice(0, 8);

      if (tokens.length === 0) {
        return [];
      }

      const tokenWhere = tokens
        .map(() => `(title LIKE ? OR content LIKE ? OR topic LIKE ?)`)
        .join(" OR ");

      const tokenQuery = buildWhere(`(${tokenWhere})`);
      const tokenParams: SqlParams = [];
      for (const token of tokens) {
        const p = `%${token}%`;
        tokenParams.push(p, p, p);
      }

      return this.query<Doc>(tokenQuery.sql, [...tokenParams, ...tokenQuery.params]);
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
      this.lastError = null;
      const domain = this.getEffectiveDomain(doc);
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
          domain,
        ],
      );

      const result = this.queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[BrainMCP] Error adding doc:", error);
      return null;
    }
  }

  addPitfall(pitfall: Omit<Pitfall, "id" | "count" | "created_at">): number | null {
    if (!this.db) return null;

    try {
      this.lastError = null;
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

      const result = this.queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[BrainMCP] Error adding pitfall:", error);
      return null;
    }
  }

  appendToDoc(library: string, topic: string, title: string, newContent: string): number | null {
    const existing = this.findDoc(library, topic, title);

    if (existing && existing.id) {
      const updatedContent = existing.content + "\n\n---\n\n" + newContent;
      this.db!.run("UPDATE docs SET content = ? WHERE id = ?", [updatedContent, existing.id]);
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

  getStats(): { docs: number; pitfalls: number; templates: number } {
    const docsRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM docs");
    const pitfallsRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM pitfalls");
    const templatesRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM templates");
    return {
      docs: docsRes ? docsRes.c : 0,
      pitfalls: pitfallsRes ? pitfallsRes.c : 0,
      templates: templatesRes ? templatesRes.c : 0,
    };
  }

  // =====================
  // TEMPLATES METHODS
  // =====================

  searchTemplates(query: string, framework?: string, type?: string): Template[] {
    try {
      const likePattern = `%${query}%`;
      let sql = `SELECT * FROM templates WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)`;
      const params: SqlParams = [likePattern, likePattern, likePattern];

      if (framework) {
        sql += ` AND framework = ?`;
        params.push(framework);
      }

      if (type) {
        sql += ` AND type = ?`;
        params.push(type);
      }

      sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT 10`;

      return this.query<Template>(sql, params);
    } catch (error) {
      console.error("[BrainMCP] Error searching templates:", error);
      return [];
    }
  }

  addTemplate(template: Omit<Template, "id" | "created_at" | "updated_at">): number | null {
    if (!this.db) return null;

    try {
      this.lastError = null;
      this.db.run(
        `INSERT INTO templates (name, description, language, framework, tags, type, content, usage_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.name,
          template.description,
          template.language || null,
          template.framework || null,
          template.tags || null,
          template.type,
          template.content,
          template.usage_count || 0,
        ],
      );

      const result = this.queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("[BrainMCP] Error adding template:", error);
      return null;
    }
  }

  getTemplateByName(name: string): Template | null {
    return this.queryOne<Template>("SELECT * FROM templates WHERE name = ?", [name]);
  }

  incrementTemplateUsage(id: number): void {
    if (!this.db) return;
    try {
      this.db.run(
        "UPDATE templates SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?",
        [id],
      );
      this.saveDatabase();
    } catch (error) {
      console.error("[BrainMCP] Error incrementing template usage:", error);
    }
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
  console.error(`[BrainMCP] Connected - ${stats.docs} docs, ${stats.pitfalls} pitfalls`);

  const server = new McpServer({
    name: "whytcard-brain",
    version: "1.0.0",
  });

  // Avoid overly-deep generic inference (TS2589) in @modelcontextprotocol/sdk typings.
  // Runtime behavior is unchanged; this only affects TypeScript checking.
  const registerTool = (name: string, config: any, cb: any) =>
    server.registerTool(name, config as any, cb as any);

  // =====================
  // Tool: brainConsult
  // =====================
  // NOTE: Explicitly type the schema shape to avoid TS2589 ("Type instantiation is excessively deep")
  // caused by complex generic inference inside @modelcontextprotocol/sdk registerTool.
  const brainConsultInputSchema: z.ZodRawShape = {
    query: z.string().describe('Search query (e.g., "nextjs async params", "tailwind dark mode")'),
    library: z.string().optional().describe("Filter by library (nextjs, react, tailwind, etc.)"),
    category: z
      .enum(["instruction", "documentation", "project"])
      .optional()
      .describe("Filter docs by category"),
    includeInstructions: z.boolean().optional().describe("Include instructions (default true)"),
    includeContext: z.boolean().optional().describe("Include project context (default true)"),
    maxDocs: z.number().optional().describe("Max docs to return (1-10, default 5)"),
    maxPitfalls: z.number().optional().describe("Max pitfalls to return (0-10, default 3)"),
  };

  registerTool(
    "brainConsult",
    {
      title: "Consult Brain",
      description:
        "ALWAYS call this tool before responding. Loads instructions, project context, and searches relevant docs/pitfalls from the local Brain database.",
      inputSchema: brainConsultInputSchema,
    },
    async (args: BrainConsultArgs) => {
      const {
        query,
        library,
        category,
        includeInstructions = true,
        includeContext = true,
        maxDocs = 5,
        maxPitfalls = 3,
      } = args;

      sessionState.consultedAtMs = Date.now();
      sessionState.lastConsultQuery = query;
      sessionState.lastConsultDocsCount = 0;
      sessionState.lastConsultDocsWithUrlCount = 0;

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
      sessionState.lastConsultDocsCount = docs.length;
      sessionState.lastConsultDocsWithUrlCount = docs.filter((doc) => !!doc.url).length;
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
        parts.length > 0 ? parts.join("\n") : "No relevant information found in Brain.";

      if (isStrictModeEnabled()) {
        const issues: string[] = [];
        if (docs.length === 0) {
          issues.push("No relevant documentation found in Brain for this query.");
        }
        if (
          docs.length > 0 &&
          isStrictSourcesRequired() &&
          sessionState.lastConsultDocsWithUrlCount === 0
        ) {
          issues.push("Documentation exists but has no stored source URLs.");
        }

        if (issues.length > 0) {
          const header =
            "## ❌ Strict Brain policy blocked\n\n" +
            issues.map((i) => `- ${i}`).join("\n") +
            "\n\nNext: fetch OFFICIAL docs (Context7/Tavily), then store them with brainSave (include url), then retry brainConsult.";
          return {
            content: [{ type: "text", text: `${header}\n\n---\n\n${result}` }],
          };
        }
      }

      return {
        content: [{ type: "text", text: result }],
      };
    },
  );

  // =====================
  // Tool: brainSave
  // =====================
  registerTool(
    "brainSave",
    {
      title: "Save to Brain",
      description:
        "Store new documentation in the local Brain database. Use AFTER finding useful info from external sources.",
      inputSchema: {
        library: z.string().describe("Library name (nextjs, react, tailwind, etc.)"),
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
    enforceConsult(
      "brainSave",
      async (args: BrainSaveArgs) => {
        const { library, topic, title, content, url, category } = args;

        if (isStrictModeEnabled() && isStrictSourcesRequired() && !url) {
          return {
            content: [
              {
                type: "text",
                text:
                  "❌ Strict Brain policy: brainSave requires a source URL.\n" +
                  "Provide `url` (official documentation link) and retry.",
              },
            ],
            isError: true,
          };
        }

        const id = db.upsertDoc({
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
          const dbErr = db.getLastError();
          return {
            content: [
              {
                type: "text",
                text:
                  "❌ Failed to save documentation to Brain." +
                  (dbErr ? `\n\nDB error: ${dbErr}` : ""),
              },
            ],
            isError: true,
          };
        }
      },
      { requirement: "fresh" },
    ),
  );

  // =====================
  // Tool: brainBug
  // =====================
  registerTool(
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
    enforceConsult<BrainBugArgs>("brainBug", async (args) => {
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
          content: [{ type: "text", text: "❌ Failed to save pitfall to Brain." }],
          isError: true,
        };
      }
    }),
  );

  // =====================
  // Tool: brainSession
  // =====================
  registerTool(
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
    enforceConsult<BrainSessionArgs>("brainSession", async (args) => {
      const { project, summary, decisions, nextSteps } = args;

      const date = new Date().toISOString().split("T")[0];
      let content = `## Session ${date}\n\n${summary}`;

      if (decisions) {
        content += `\n\n### Decisions\n${decisions}`;
      }
      if (nextSteps) {
        content += `\n\n### Next Steps\n${nextSteps}`;
      }

      const id = db.appendToDoc(project, "session-log", `Session Log - ${project}`, content);

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
          isError: true,
        };
      }
    }),
  );

  // =====================
  // Tool: brainSearch
  // =====================
  registerTool(
    "brainSearch",
    {
      title: "Search Brain",
      description: "Search the local Brain database for documentation and pitfalls.",
      inputSchema: {
        query: z.string().describe("Search query"),
        library: z.string().optional().describe("Filter by library"),
        category: z
          .enum(["instruction", "documentation", "project"])
          .optional()
          .describe("Filter by category"),
      },
    },
    enforceConsult<BrainSearchArgs>("brainSearch", async (args) => {
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
    }),
  );

  registerTool(
    "brainValidate",
    {
      title: "Validate Against Brain Policy",
      description:
        "Validate a draft answer/plan against Brain policy (no speculation, grounded in Brain docs).",
      inputSchema: {
        draft: z.string().describe("Draft answer/plan to validate"),
      },
    },
    enforceConsult<BrainValidateArgs>("brainValidate", async (args) => {
      const { draft } = args;
      const issues: string[] = [];

      const trimmed = draft.trim();
      const head = trimmed.slice(0, 400).toLowerCase();

      if (isStrictModeEnabled()) {
        if (!head.includes("basé sur") && !head.includes("based on")) {
          issues.push('Draft should start with sources (e.g., "Basé sur ..." / "Based on ...").');
        }

        if (isStrictSourcesRequired() && sessionState.lastConsultDocsWithUrlCount <= 0) {
          issues.push(
            "Strict mode requires at least one documentation source URL from brainConsult.",
          );
        }

        const urlRegex = /https?:\/\/\S+/i;
        if (isStrictSourcesRequired() && !urlRegex.test(trimmed)) {
          issues.push("Draft must include at least one URL to the official documentation used.");
        }

        const hedgeRegexes = [
          /\bje\s+crois\b/i,
          /\bje\s+pense\b/i,
          /\bpeut[- ]?être\b/i,
          /\bprobablement\b/i,
          /\bpas\s+grave\b/i,
          /\bi\s+think\b/i,
          /\bmaybe\b/i,
          /\bmight\b/i,
          /\bnot\s+sure\b/i,
          /\bshould\s+work\b/i,
        ];

        for (const re of hedgeRegexes) {
          if (re.test(trimmed)) {
            issues.push(
              "Draft contains speculative/uncertain language. Remove it and rely on documented facts.",
            );
            break;
          }
        }
      }

      if (issues.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: "❌ Brain validation failed:\n\n" + issues.map((i) => `- ${i}`).join("\n"),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "✅ Brain validation passed.",
          },
        ],
      };
    }),
  );

  // =====================
  // Tool: brainTemplateSave
  // =====================
  const brainTemplateSaveInputSchema: z.ZodRawShape = {
    name: z.string().describe("Unique template name (e.g., 'react-component', 'api-route')"),
    description: z.string().describe("What this template does"),
    type: z
      .enum(["snippet", "file", "multifile"])
      .describe(
        "Type: snippet (code block), file (single file), multifile (multiple files with structure)",
      ),
    content: z
      .string()
      .describe("Template content - code for snippet/file, JSON structure for multifile"),
    framework: z.string().optional().describe("Framework (e.g., 'nextjs', 'react', 'express')"),
    language: z
      .string()
      .optional()
      .describe("Programming language (e.g., 'typescript', 'javascript')"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  };

  registerTool(
    "brainTemplateSave",
    {
      title: "Save Code Template",
      description:
        "Save a reusable code template (snippet, file, or multi-file structure) to Brain for future use by the agent.",
      inputSchema: brainTemplateSaveInputSchema,
    },
    async (args: BrainTemplateSaveArgs) => {
      const { name, description, type, content, framework, language, tags } = args;

      const existing = db.getTemplateByName(name);
      if (existing) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Template "${name}" already exists. Use a different name or delete the existing one first.`,
            },
          ],
          isError: true,
        };
      }

      const tagsJson = tags ? JSON.stringify(tags) : undefined;

      const id = db.addTemplate({
        name,
        description,
        type,
        content,
        framework,
        language,
        tags: tagsJson,
      });

      if (id) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Template "${name}" saved (ID: ${id})\nType: ${type}\nFramework: ${framework || "N/A"}\nYou can now search and reuse this template with brainTemplateSearch.`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text", text: "❌ Failed to save template." }],
          isError: true,
        };
      }
    },
  );

  // =====================
  // Tool: brainTemplateSearch
  // =====================
  const brainTemplateSearchInputSchema: z.ZodRawShape = {
    query: z.string().describe("Search query (template name, description, or tag)"),
    framework: z.string().optional().describe("Filter by framework"),
    type: z.enum(["snippet", "file", "multifile"]).optional().describe("Filter by type"),
  };

  registerTool(
    "brainTemplateSearch",
    {
      title: "Search Code Templates",
      description:
        "Search saved code templates by name, description, or tags. Returns reusable code patterns.",
      inputSchema: brainTemplateSearchInputSchema,
    },
    async (args: BrainTemplateSearchArgs) => {
      const { query, framework, type } = args;

      const templates = db.searchTemplates(query, framework, type);

      if (templates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No templates found for "${query}". You can create one with brainTemplateSave.`,
            },
          ],
        };
      }

      const parts: string[] = [`## 📄 Templates Found (${templates.length})\n`];

      for (const t of templates) {
        parts.push(`### ${t.name} (${t.type})`);
        parts.push(`**Description:** ${t.description}`);
        if (t.framework) parts.push(`**Framework:** ${t.framework}`);
        if (t.language) parts.push(`**Language:** ${t.language}`);
        if (t.tags) {
          try {
            const tags = JSON.parse(t.tags);
            parts.push(`**Tags:** ${tags.join(", ")}`);
          } catch {
            // Ignore JSON parse errors for tags
          }
        }
        parts.push(`**Used:** ${t.usage_count || 0} times`);
        parts.push(
          `**Content Preview:**\n\`\`\`\n${t.content.substring(0, 200)}${t.content.length > 200 ? "..." : ""}\n\`\`\``,
        );
        parts.push(`\nUse brainTemplateApply with name="${t.name}" to apply this template.\n`);
      }

      return {
        content: [{ type: "text", text: parts.join("\n") }],
      };
    },
  );

  // =====================
  // Tool: brainTemplateApply
  // =====================
  registerTool(
    "brainTemplateApply",
    {
      title: "Apply Code Template",
      description: "Get the full content of a template to apply it. Increments usage count.",
      inputSchema: {
        name: z.string().describe("Template name to apply"),
      },
    },
    async (args: BrainTemplateApplyArgs) => {
      const { name } = args;

      const template = db.getTemplateByName(name);

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Template "${name}" not found. Use brainTemplateSearch to find available templates.`,
            },
          ],
          isError: true,
        };
      }

      // Increment usage
      if (template.id) {
        db.incrementTemplateUsage(template.id);
      }

      const parts: string[] = [
        `## ✅ Template: ${template.name}`,
        `**Type:** ${template.type}`,
        `**Description:** ${template.description}`,
      ];

      if (template.framework) parts.push(`**Framework:** ${template.framework}`);
      if (template.language) parts.push(`**Language:** ${template.language}`);

      parts.push(`\n### Content\n`);

      if (template.type === "multifile") {
        parts.push(
          `This is a multi-file template. Structure:\n\`\`\`json\n${template.content}\n\`\`\``,
        );
        parts.push(`\nParse this JSON and create the files accordingly.`);
      } else {
        parts.push(`\`\`\`\n${template.content}\n\`\`\``);
      }

      return {
        content: [{ type: "text", text: parts.join("\n") }],
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
