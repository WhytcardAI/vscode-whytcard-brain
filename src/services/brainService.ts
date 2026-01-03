/**
 * WhytCard Brain - SQLite Service (WASM version)
 * Database stored in extension's globalStorage
 */

import * as fs from "fs";
import * as path from "path";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

// Re-export types from core module
export {
  type Doc,
  type Pitfall,
  type Template,
  type BrainStats,
  type BrainCategory,
  inferDomain,
  normalizeForSearch,
} from "../core/brainDbCore";

import {
  type Doc,
  type Pitfall,
  type Template,
  type BrainStats,
  inferDomain,
  normalizeForSearch,
  buildSearchDocsQuery,
  buildSearchPitfallsQuery,
  buildSearchTemplatesQuery,
} from "../core/brainDbCore";

// SQL parameter types for type safety
type SqlValue = string | number | null | Uint8Array;
type SqlParams = SqlValue[];

export interface UsageStats {
  searchCount: number;
  storeDocCount: number;
  storePitfallCount: number;
  getInstructionsCount: number;
  getContextCount: number;
  policyBlockCount: number;
  lastUsed: string | null;
  errors: string[];
}

// Usage tracking (in-memory, persisted to DB)
const usageStats: UsageStats = {
  searchCount: 0,
  storeDocCount: 0,
  storePitfallCount: 0,
  getInstructionsCount: 0,
  getContextCount: 0,
  policyBlockCount: 0,
  lastUsed: null,
  errors: [],
};

export function trackUsage(tool: keyof Omit<UsageStats, "lastUsed" | "errors">): void {
  usageStats[tool]++;
  usageStats.lastUsed = new Date().toISOString();
}

export function trackError(error: string): void {
  usageStats.errors.push(`[${new Date().toISOString()}] ${error}`);
  if (usageStats.errors.length > 50) {
    usageStats.errors.shift();
  }
}

export function getUsageStats(): UsageStats {
  return { ...usageStats };
}

// Global storage path
let storagePath: string | null = null;

export function setStoragePath(path: string): void {
  storagePath = path;
}

export function getStoragePath(): string | null {
  return storagePath;
}

export class BrainService {
  private db: Database | null = null;
  private dbPath: string = "";
  private SQL: SqlJsStatic | null = null;
  private lastLoadedMtimeMs: number | null = null;

  constructor() {}

  /**
   * Initialize database connection (creates if doesn't exist)
   */
  public async connect(): Promise<boolean> {
    try {
      if (!storagePath) {
        console.error("[BrainService] Storage path not set");
        return false;
      }

      this.dbPath = path.join(storagePath, "brain.db");
      console.log("[BrainService] DB path:", this.dbPath);

      // Create directory if needed
      if (!fs.existsSync(storagePath)) {
        console.log("[BrainService] Creating storage directory:", storagePath);
        fs.mkdirSync(storagePath, { recursive: true });
      }

      console.log("[BrainService] Loading sql.js WASM...");

      // Locate the WASM file relative to the extension root
      // The build script copies sql-wasm.wasm to dist/
      // Since extension.js is in dist/, __dirname is dist/
      const wasmPath = path.join(__dirname, "sql-wasm.wasm");
      console.log("[BrainService] WASM path:", wasmPath);

      this.SQL = await initSqlJs({
        locateFile: () => wasmPath,
      });

      if (fs.existsSync(this.dbPath)) {
        console.log("[BrainService] Loading existing database...");
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(filebuffer);
      } else {
        console.log("[BrainService] Creating new database...");
        this.db = new this.SQL.Database();
        this.saveDatabase();
      }

      this.lastLoadedMtimeMs = this.getDbMtimeMs();

      console.log("[BrainService] Initializing schema...");
      this.initSchema();
      console.log("[BrainService] Brain DB connected");
      return true;
    } catch (error) {
      console.error("[BrainService] Failed to connect to database:", error);
      if (error instanceof Error) {
        console.error("[BrainService] Error stack:", error.stack);
      }
      return false;
    }
  }

  private saveDatabase(): void {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
      this.lastLoadedMtimeMs = this.getDbMtimeMs();
    } catch (error) {
      console.error("[BrainService] Error saving database:", error);
    }
  }

  private getDbMtimeMs(): number | null {
    if (!this.dbPath) {
      return null;
    }
    try {
      if (!fs.existsSync(this.dbPath)) {
        return null;
      }
      return fs.statSync(this.dbPath).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Reload database from disk (for external changes sync)
   */
  public reloadFromDisk(): boolean {
    if (!this.SQL || !this.dbPath) {
      console.warn("[BrainService] Cannot reload: not initialized");
      return false;
    }

    try {
      if (fs.existsSync(this.dbPath)) {
        const filebuffer = fs.readFileSync(this.dbPath);
        // Close old DB instance
        if (this.db) {
          this.db.close();
        }
        // Create new instance from file
        this.db = new this.SQL.Database(filebuffer);
        this.lastLoadedMtimeMs = this.getDbMtimeMs();
        console.log("[BrainService] Reloaded database from disk");
        return true;
      }
    } catch (error) {
      console.error("[BrainService] Error reloading database:", error);
    }
    return false;
  }

  public reloadFromDiskIfChanged(): boolean {
    const mtimeMs = this.getDbMtimeMs();
    if (mtimeMs === null) {
      return false;
    }
    if (this.lastLoadedMtimeMs !== null && mtimeMs <= this.lastLoadedMtimeMs) {
      return false;
    }
    return this.reloadFromDisk();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    if (!this.db) {
      return;
    }

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

    // Templates table for code snippets and multi-file templates
    this.db.run(`
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
      CREATE INDEX IF NOT EXISTS idx_templates_framework ON templates(framework);
      CREATE INDEX IF NOT EXISTS idx_templates_language ON templates(language);
      CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
    `);

    // Compatibility table used by external tooling (e.g. MCP servers).
    // Safe to create even if unused by the extension.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
    `);

    // Migration: Add category column if it doesn't exist
    try {
      this.db.run("ALTER TABLE docs ADD COLUMN category TEXT DEFAULT 'documentation'");
      console.log("[BrainService] Added category column to docs table");
    } catch {
      // Column likely exists, ignore
    }

    // Migration: Add domain column if it doesn't exist
    try {
      this.db.run("ALTER TABLE docs ADD COLUMN domain TEXT DEFAULT 'general'");
      console.log("[BrainService] Added domain column to docs table");
      // Auto-fill domain for existing docs
      this.migrateDomainsForExistingDocs();
    } catch {
      // Column likely exists, ignore
    }

    this.saveDatabase();
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Migrate domains for existing docs
   */
  private migrateDomainsForExistingDocs(): void {
    if (!this.db) return;
    const docs = this.query<{ id: number; library: string }>(
      "SELECT id, library FROM docs WHERE domain IS NULL OR domain = 'general'",
    );
    for (const doc of docs) {
      const domain = inferDomain(doc.library);
      if (domain !== "general") {
        this.db.run("UPDATE docs SET domain = ? WHERE id = ?", [domain, doc.id]);
      }
    }
  }

  /**
   * Ensure database is connected
   */
  private ensureConnection(): boolean {
    if (!this.db) {
      console.error("[BrainService] Database not connected. Call connect() first.");
      return false;
    }

    this.reloadFromDiskIfChanged();
    return true;
  }

  // Helper to execute query and return objects
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

  // Helper to execute query and return single object
  private queryOne<T>(sql: string, params?: SqlParams): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  // =====================
  // DOCS
  // =====================

  public getAllDocs(): Doc[] {
    if (!this.ensureConnection()) return [];
    return this.query<Doc>(`SELECT * FROM docs ORDER BY library, topic`);
  }

  public getDocsByLibrary(library: string): Doc[] {
    if (!this.ensureConnection()) return [];
    return this.query<Doc>(`SELECT * FROM docs WHERE library = ? ORDER BY topic`, [library]);
  }

  public getDocById(id: number): Doc | null {
    if (!this.ensureConnection()) return null;
    return this.queryOne<Doc>("SELECT * FROM docs WHERE id = ?", [id]);
  }

  public addDoc(doc: Omit<Doc, "id" | "created_at">): number | null {
    if (!this.ensureConnection()) return null;

    try {
      const domain = doc.domain || inferDomain(doc.library);
      this.db!.run(
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
          doc.source || "manual",
          doc.url || null,
          doc.category || "documentation",
          domain,
        ],
      );

      // Get last ID
      const result = this.queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
      this.saveDatabase();
      return result ? result.id : null;
    } catch (error) {
      console.error("Error adding doc:", error);
      return null;
    }
  }

  public deleteDoc(id: number): boolean {
    if (!this.ensureConnection()) return false;

    try {
      this.db!.run("DELETE FROM docs WHERE id = ?", [id]);
      this.saveDatabase();
      return true;
    } catch (error) {
      console.error("Error deleting doc:", error);
      return false;
    }
  }

  /**
   * Update an existing doc
   */
  public updateDoc(id: number, updates: Partial<Omit<Doc, "id" | "created_at">>): boolean {
    if (!this.ensureConnection()) return false;

    try {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];

      if (updates.title !== undefined) {
        fields.push("title = ?");
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        fields.push("content = ?");
        values.push(updates.content);
      }
      if (updates.library !== undefined) {
        fields.push("library = ?");
        values.push(updates.library);
      }
      if (updates.topic !== undefined) {
        fields.push("topic = ?");
        values.push(updates.topic);
      }
      if (updates.version !== undefined) {
        fields.push("version = ?");
        values.push(updates.version);
      }
      if (updates.url !== undefined) {
        fields.push("url = ?");
        values.push(updates.url);
      }
      if (updates.category !== undefined) {
        fields.push("category = ?");
        values.push(updates.category || null);
      }
      if (updates.source !== undefined) {
        fields.push("source = ?");
        values.push(updates.source || null);
      }
      if (updates.domain !== undefined) {
        fields.push("domain = ?");
        values.push(updates.domain || null);
      }

      if (fields.length === 0) return false;

      values.push(id);
      this.db!.run(
        `UPDATE docs SET ${fields.join(", ")} WHERE id = ?`,
        values as (string | number | null)[],
      );
      this.saveDatabase();
      return true;
    } catch (error) {
      console.error("Error updating doc:", error);
      return false;
    }
  }

  /**
   * Find doc by library, topic, and title (for upsert logic)
   */
  public findDoc(library: string, topic: string, title: string): Doc | null {
    if (!this.ensureConnection()) return null;
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

  /**
   * Upsert: Update if exists, insert if not
   */
  public upsertDoc(doc: Omit<Doc, "id" | "created_at">): number | null {
    const existing = this.findDoc(doc.library, doc.topic, doc.title);
    if (existing && existing.id) {
      this.updateDoc(existing.id, doc);
      return existing.id;
    }
    return this.addDoc(doc);
  }

  /**
   * Append content to existing doc (for session logs)
   */
  public appendToDoc(
    library: string,
    topic: string,
    title: string,
    newContent: string,
  ): number | null {
    const existing = this.findDoc(library, topic, title);
    if (existing && existing.id) {
      const updatedContent = existing.content + "\n\n---\n\n" + newContent;
      this.updateDoc(existing.id, { content: updatedContent });
      return existing.id;
    }
    // Create new if doesn't exist
    return this.addDoc({
      library,
      topic,
      title,
      content: newContent,
      category: "project",
      source: "copilot",
    });
  }

  public searchDocs(query: string, library?: string, category?: string): Doc[] {
    if (!this.ensureConnection()) return [];

    try {
      const { sql, sqlParams } = buildSearchDocsQuery({ query, library, category });
      return this.query<Doc>(sql, sqlParams);
    } catch (error) {
      console.error("Error searching docs:", error);
      return [];
    }
  }

  public getDocLibraries(): string[] {
    if (!this.ensureConnection()) return [];
    const rows = this.query<{ library: string }>(
      "SELECT DISTINCT library FROM docs ORDER BY library",
    );
    return rows.map((r) => r.library);
  }

  /**
   * Get all instructions (category = 'instruction')
   */
  public getAllInstructions(): Doc[] {
    if (!this.ensureConnection()) return [];
    return this.query<Doc>(
      `SELECT * FROM docs WHERE category = 'instruction' ORDER BY library, topic`,
    );
  }

  /**
   * Get project context docs (category = 'project')
   */
  public getProjectContext(_projectPath?: string): Doc[] {
    if (!this.ensureConnection()) return [];
    // For now, return all project docs. Could filter by path later.
    return this.query<Doc>(`SELECT * FROM docs WHERE category = 'project' ORDER BY library, topic`);
  }

  /**
   * Get docs by category
   */
  public getDocsByCategory(category: string): Doc[] {
    if (!this.ensureConnection()) return [];
    return this.query<Doc>(`SELECT * FROM docs WHERE category = ? ORDER BY library, topic`, [
      category,
    ]);
  }

  // =====================
  // PITFALLS
  // =====================

  public getAllPitfalls(): Pitfall[] {
    if (!this.ensureConnection()) return [];
    return this.query<Pitfall>(`SELECT * FROM pitfalls ORDER BY count DESC, created_at DESC`);
  }

  public getPitfallById(id: number): Pitfall | null {
    if (!this.ensureConnection()) return null;
    return this.queryOne<Pitfall>("SELECT * FROM pitfalls WHERE id = ?", [id]);
  }

  public addPitfall(pitfall: Omit<Pitfall, "id" | "count" | "created_at">): number | null {
    if (!this.ensureConnection()) return null;

    try {
      this.db!.run(
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
      console.error("Error adding pitfall:", error);
      return null;
    }
  }

  public deletePitfall(id: number): boolean {
    if (!this.ensureConnection()) return false;

    try {
      this.db!.run("DELETE FROM pitfalls WHERE id = ?", [id]);
      this.saveDatabase();
      return true;
    } catch (error) {
      console.error("Error deleting pitfall:", error);
      return false;
    }
  }

  public searchPitfalls(query: string): Pitfall[] {
    if (!this.ensureConnection()) return [];

    try {
      const { sql, sqlParams } = buildSearchPitfallsQuery(query);
      return this.query<Pitfall>(sql, sqlParams);
    } catch (error) {
      console.error("Error searching pitfalls:", error);
      return [];
    }
  }

  public incrementPitfallCount(id: number): void {
    if (!this.ensureConnection()) return;

    try {
      this.db!.run("UPDATE pitfalls SET count = count + 1 WHERE id = ?", [id]);
      this.saveDatabase();
    } catch (error) {
      console.error("Error incrementing pitfall count:", error);
    }
  }

  // ====== TEMPLATES METHODS ======

  public getAllTemplates(): Template[] {
    if (!this.ensureConnection()) return [];

    try {
      return this.query<Template>(
        "SELECT * FROM templates ORDER BY usage_count DESC, created_at DESC",
      );
    } catch (error) {
      console.error("Error getting all templates:", error);
      return [];
    }
  }

  public getTemplateById(id: number): Template | null {
    if (!this.ensureConnection()) return null;

    try {
      const results = this.query<Template>("SELECT * FROM templates WHERE id = ?", [id]);
      return results[0] || null;
    } catch (error) {
      console.error("Error getting template:", error);
      return null;
    }
  }

  public getTemplateByName(name: string): Template | null {
    if (!this.ensureConnection()) return null;

    try {
      const results = this.query<Template>("SELECT * FROM templates WHERE name = ?", [name]);
      return results[0] || null;
    } catch (error) {
      console.error("Error getting template by name:", error);
      return null;
    }
  }

  public searchTemplates(query: string, framework?: string, type?: string): Template[] {
    if (!this.ensureConnection()) return [];

    try {
      const { sql, sqlParams } = buildSearchTemplatesQuery(query, framework, type);
      return this.query<Template>(sql, sqlParams);
    } catch (error) {
      console.error("Error searching templates:", error);
      return [];
    }
  }

  public addTemplate(
    template: Omit<Template, "id" | "created_at" | "updated_at">,
  ): Template | null {
    if (!this.ensureConnection()) return null;

    try {
      const { name, description, language, framework, tags, type, content, usage_count } = template;

      this.db!.run(
        `INSERT INTO templates (name, description, language, framework, tags, type, content, usage_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description,
          language || null,
          framework || null,
          tags || null,
          type,
          content,
          usage_count || 0,
        ],
      );

      this.saveDatabase();

      const results = this.query<Template>("SELECT * FROM templates WHERE name = ?", [name]);
      return results[0] || null;
    } catch (error) {
      console.error("Error adding template:", error);
      return null;
    }
  }

  public updateTemplate(id: number, updates: Partial<Template>): boolean {
    if (!this.ensureConnection()) return false;

    try {
      const fields: string[] = [];
      const values: SqlParams = [];

      if (updates.name !== undefined) {
        fields.push("name = ?");
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push("description = ?");
        values.push(updates.description);
      }
      if (updates.language !== undefined) {
        fields.push("language = ?");
        values.push(updates.language);
      }
      if (updates.framework !== undefined) {
        fields.push("framework = ?");
        values.push(updates.framework);
      }
      if (updates.tags !== undefined) {
        fields.push("tags = ?");
        values.push(updates.tags);
      }
      if (updates.type !== undefined) {
        fields.push("type = ?");
        values.push(updates.type);
      }
      if (updates.content !== undefined) {
        fields.push("content = ?");
        values.push(updates.content);
      }

      fields.push("updated_at = datetime('now')");

      if (fields.length === 1) return false; // Only updated_at, no real changes

      values.push(id);

      this.db!.run(`UPDATE templates SET ${fields.join(", ")} WHERE id = ?`, values);

      this.saveDatabase();
      return true;
    } catch (error) {
      console.error("Error updating template:", error);
      return false;
    }
  }

  public deleteTemplate(id: number): boolean {
    if (!this.ensureConnection()) return false;

    try {
      this.db!.run("DELETE FROM templates WHERE id = ?", [id]);
      this.saveDatabase();
      return true;
    } catch (error) {
      console.error("Error deleting template:", error);
      return false;
    }
  }

  public incrementTemplateUsage(id: number): void {
    if (!this.ensureConnection()) return;

    try {
      this.db!.run(
        "UPDATE templates SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?",
        [id],
      );
      this.saveDatabase();
    } catch (error) {
      console.error("Error incrementing template usage:", error);
    }
  }

  public getTemplatesByFramework(framework: string): Template[] {
    if (!this.ensureConnection()) return [];

    try {
      return this.query<Template>(
        "SELECT * FROM templates WHERE framework = ? ORDER BY usage_count DESC",
        [framework],
      );
    } catch (error) {
      console.error("Error getting templates by framework:", error);
      return [];
    }
  }

  public getTemplatesByType(type: Template["type"]): Template[] {
    if (!this.ensureConnection()) return [];

    try {
      return this.query<Template>(
        "SELECT * FROM templates WHERE type = ? ORDER BY usage_count DESC",
        [type],
      );
    } catch (error) {
      console.error("Error getting templates by type:", error);
      return [];
    }
  }

  // =====================
  // STATS
  // =====================

  public getStats(): BrainStats {
    if (!this.ensureConnection()) {
      return { docs: 0, pitfalls: 0, templates: 0, dbSizeKb: 0 };
    }

    try {
      const docsRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM docs");
      const pitfallsRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM pitfalls");
      const templatesRes = this.queryOne<{ c: number }>("SELECT COUNT(*) as c FROM templates");

      const docs = docsRes ? docsRes.c : 0;
      const pitfalls = pitfallsRes ? pitfallsRes.c : 0;
      const templates = templatesRes ? templatesRes.c : 0;

      // Get file size
      let dbSizeKb = 0;
      try {
        if (fs.existsSync(this.dbPath)) {
          const stats = fs.statSync(this.dbPath);
          dbSizeKb = Math.round(stats.size / 1024);
        }
      } catch {
        // Ignore file stat errors
      }

      return { docs, pitfalls, templates, dbSizeKb };
    } catch (error) {
      console.error("Error getting stats:", error);
      return { docs: 0, pitfalls: 0, templates: 0, dbSizeKb: 0 };
    }
  }

  public getDbPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
let brainService: BrainService | null = null;

export function getBrainService(): BrainService {
  if (!brainService) {
    brainService = new BrainService();
  }
  return brainService;
}

export function disposeBrainService(): void {
  if (brainService) {
    brainService.close();
    brainService = null;
  }
}
