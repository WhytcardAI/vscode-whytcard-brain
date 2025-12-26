/**
 * WhytCard Brain - Core Database Types and Utilities
 * Shared between extension (brainService.ts) and MCP server (mcp-server.ts)
 */

// =====================
// Types
// =====================

export interface Doc {
  id?: number;
  library: string;
  version?: string;
  topic: string;
  title: string;
  content: string;
  source?: string;
  url?: string;
  category?: string; // 'instruction' | 'documentation' | 'project'
  domain?: string; // 'website' | 'mobile' | 'backend' | 'devops' | 'general'
  created_at?: string;
}

export interface Pitfall {
  id?: number;
  symptom: string;
  solution: string;
  error?: string;
  library?: string;
  code?: string;
  count?: number;
  created_at?: string;
}

export interface Template {
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

export interface BrainStats {
  docs: number;
  pitfalls: number;
  templates: number;
  dbSizeKb?: number;
}

export type BrainCategory = "instruction" | "documentation" | "project";

// =====================
// Domain Mapping
// =====================

const LIBRARY_DOMAIN_MAP: Record<string, string> = {
  // Website / Frontend
  nextjs: "website",
  react: "website",
  vue: "website",
  angular: "website",
  svelte: "website",
  tailwind: "website",
  shadcn: "website",
  "next-intl": "website",
  motion: "website",
  framer: "website",
  css: "website",
  html: "website",
  // Mobile
  "react-native": "mobile",
  expo: "mobile",
  flutter: "mobile",
  swift: "mobile",
  kotlin: "mobile",
  // Backend
  node: "backend",
  express: "backend",
  fastify: "backend",
  nest: "backend",
  prisma: "backend",
  drizzle: "backend",
  postgres: "backend",
  mongodb: "backend",
  redis: "backend",
  // DevOps
  docker: "devops",
  kubernetes: "devops",
  vercel: "devops",
  aws: "devops",
  github: "devops",
  // General
  typescript: "general",
  javascript: "general",
  zod: "general",
  copilot: "general",
};

/**
 * Normalize string for search (lowercase, remove dots/spaces)
 */
export function normalizeForSearch(value: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, "")
    .replace(/^nextjs$/, "nextjs");
}

/**
 * Infer domain from library name
 */
export function inferDomain(library: string): string {
  const key = normalizeForSearch(library);
  return LIBRARY_DOMAIN_MAP[key] || "general";
}

// =====================
// SQL Schema
// =====================

export const SCHEMA_SQL = `
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
`;

// =====================
// Migration Helpers
// =====================

export interface MigrationColumn {
  table: string;
  column: string;
  ddl: string;
}

export const MIGRATIONS: MigrationColumn[] = [
  { table: "docs", column: "version", ddl: "ALTER TABLE docs ADD COLUMN version TEXT;" },
  { table: "docs", column: "source", ddl: "ALTER TABLE docs ADD COLUMN source TEXT;" },
  { table: "docs", column: "url", ddl: "ALTER TABLE docs ADD COLUMN url TEXT;" },
  { table: "docs", column: "category", ddl: "ALTER TABLE docs ADD COLUMN category TEXT;" },
  { table: "docs", column: "domain", ddl: "ALTER TABLE docs ADD COLUMN domain TEXT;" },
  { table: "docs", column: "created_at", ddl: "ALTER TABLE docs ADD COLUMN created_at TEXT;" },
  { table: "pitfalls", column: "error", ddl: "ALTER TABLE pitfalls ADD COLUMN error TEXT;" },
  { table: "pitfalls", column: "library", ddl: "ALTER TABLE pitfalls ADD COLUMN library TEXT;" },
  { table: "pitfalls", column: "code", ddl: "ALTER TABLE pitfalls ADD COLUMN code TEXT;" },
  {
    table: "pitfalls",
    column: "count",
    ddl: "ALTER TABLE pitfalls ADD COLUMN count INTEGER DEFAULT 1;",
  },
  {
    table: "pitfalls",
    column: "created_at",
    ddl: "ALTER TABLE pitfalls ADD COLUMN created_at TEXT;",
  },
  {
    table: "templates",
    column: "created_at",
    ddl: "ALTER TABLE templates ADD COLUMN created_at TEXT;",
  },
  {
    table: "templates",
    column: "updated_at",
    ddl: "ALTER TABLE templates ADD COLUMN updated_at TEXT;",
  },
];

// =====================
// Query Builders
// =====================

export interface SearchDocsParams {
  query: string;
  library?: string;
  category?: string;
  limit?: number;
}

export function buildSearchDocsQuery(params: SearchDocsParams): {
  sql: string;
  sqlParams: (string | number)[];
} {
  const { query, library, category, limit = 20 } = params;
  const likePattern = `%${query}%`;

  let sql = `SELECT * FROM docs WHERE (title LIKE ? OR content LIKE ? OR topic LIKE ?)`;
  const sqlParams: (string | number)[] = [likePattern, likePattern, likePattern];

  if (library) {
    const normalized = normalizeForSearch(library);
    sql += ` AND (library LIKE ? OR REPLACE(REPLACE(LOWER(library), '.', ''), ' ', '') LIKE ?)`;
    sqlParams.push(`%${library}%`, `%${normalized}%`);
  }

  if (category) {
    sql += ` AND category = ?`;
    sqlParams.push(category);
  }

  sql += ` ORDER BY library, topic LIMIT ?`;
  sqlParams.push(limit);

  return { sql, sqlParams };
}

export function buildSearchPitfallsQuery(
  query: string,
  limit = 10,
): {
  sql: string;
  sqlParams: string[];
} {
  const likePattern = `%${query}%`;
  return {
    sql: `
      SELECT * FROM pitfalls
      WHERE symptom LIKE ? OR solution LIKE ? OR error LIKE ? OR library LIKE ?
      ORDER BY count DESC
      LIMIT ?
    `,
    sqlParams: [likePattern, likePattern, likePattern, likePattern, String(limit)],
  };
}

export function buildSearchTemplatesQuery(
  query: string,
  framework?: string,
  type?: string,
  limit = 10,
): { sql: string; sqlParams: string[] } {
  const likePattern = `%${query}%`;
  let sql = `SELECT * FROM templates WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)`;
  const sqlParams: string[] = [likePattern, likePattern, likePattern];

  if (framework) {
    sql += ` AND framework = ?`;
    sqlParams.push(framework);
  }

  if (type) {
    sql += ` AND type = ?`;
    sqlParams.push(type);
  }

  sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
  sqlParams.push(String(limit));

  return { sql, sqlParams };
}
