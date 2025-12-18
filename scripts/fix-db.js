const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH =
  'c:/Users/Jerome/AppData/Roaming/Code - Insiders/User/globalStorage/whytcard.whytcard-brain/brain.db';
const WASM_PATH = path.join(__dirname, '../dist/sql-wasm.wasm');

async function fix() {
  console.log('Loading SQL.js...');
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });

  if (!fs.existsSync(DB_PATH)) {
    console.error('DB not found');
    return;
  }

  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);

  console.log('Checking schema...');
  try {
    db.run("ALTER TABLE docs ADD COLUMN category TEXT DEFAULT 'documentation'");
    console.log('Added category column.');
  } catch (e) {
    console.log('Category column might already exist or error:', e.message);
  }

  console.log('Updating categories...');
  // Update all docs that were ingested from instructions to have category='instruction'
  // We can identify them by source='auto-ingest' or title pattern
  db.run("UPDATE docs SET category = 'instruction' WHERE source = 'auto-ingest'");

  // Also specifically for the proxy doc if it wasn't auto-ingested (just in case)
  db.run("UPDATE docs SET category = 'instruction' WHERE title LIKE '%proxy.ts%'");

  console.log('Verifying...');
  const stmt = db.prepare("SELECT title, category FROM docs WHERE category = 'instruction'");
  while (stmt.step()) {
    const row = stmt.getAsObject();
    console.log(`- ${row.title} [${row.category}]`);
  }
  stmt.free();

  console.log('Saving database...');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  db.close();
  console.log('Done.');
}

fix();
