/* eslint-disable no-console */
/**
 * Brain DB audit (read-only).
 *
 * Prints:
 * - docs count
 * - docs by category
 * - docs with URL (strict-mode readiness)
 *
 * Usage:
 *   node scripts/brain-db-audit.js --db "C:\\path\\to\\brain.db"
 *   # or use env:
 *   set BRAIN_DB_PATH=...
 *   node scripts/brain-db-audit.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const initSqlJs = require("sql.js");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function getDefaultDbPath() {
  const appData =
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

  const candidates = [
    // Windsurf - Next
    path.join(
      appData,
      "Windsurf - Next",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // Windsurf
    path.join(
      appData,
      "Windsurf",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // Cursor
    path.join(
      appData,
      "Cursor",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
    // VS Code
    path.join(
      appData,
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const ok = stmt.step();
  const row = ok ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  const dbPath = args.db || process.env.BRAIN_DB_PATH || getDefaultDbPath();

  console.log("🧠 Brain DB audit");
  console.log(`DB: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.log("❌ DB file not found (it will be created on first use).");
    process.exit(1);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "..", "dist", file),
  });

  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  const docsCount = queryOne(db, "SELECT COUNT(*) AS c FROM docs")?.c ?? 0;
  const pitfallsCount =
    queryOne(db, "SELECT COUNT(*) AS c FROM pitfalls")?.c ?? 0;
  const templatesCount =
    queryOne(db, "SELECT COUNT(*) AS c FROM templates")?.c ?? 0;

  const byCategory = queryAll(
    db,
    "SELECT COALESCE(category,'(null)') AS category, COUNT(*) AS c FROM docs GROUP BY category ORDER BY c DESC",
  );

  const docsWithUrl =
    queryOne(
      db,
      "SELECT COUNT(*) AS c FROM docs WHERE url IS NOT NULL AND TRIM(url) <> ''",
    )?.c ?? 0;

  const topUrlLibraries = queryAll(
    db,
    "SELECT library, COUNT(*) AS c FROM docs WHERE url IS NOT NULL AND TRIM(url) <> '' GROUP BY library ORDER BY c DESC LIMIT 10",
  );

  console.log("\n=== Counts ===");
  console.log(`docs: ${docsCount}`);
  console.log(`pitfalls: ${pitfallsCount}`);
  console.log(`templates: ${templatesCount}`);

  console.log("\n=== Docs by category ===");
  for (const row of byCategory) {
    console.log(`- ${row.category}: ${row.c}`);
  }

  console.log("\n=== Strict-mode readiness (URLs) ===");
  console.log(`docs_with_url: ${docsWithUrl}`);
  if (topUrlLibraries.length > 0) {
    console.log("top_libraries_with_url:");
    for (const row of topUrlLibraries) {
      console.log(`- ${row.library}: ${row.c}`);
    }
  } else {
    console.log("top_libraries_with_url: (none)");
  }

  db.close();
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});


