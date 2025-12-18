const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH =
  'c:/Users/Jerome/AppData/Roaming/Code - Insiders/User/globalStorage/whytcard.whytcard-brain/brain.db';
const WASM_PATH = path.join(__dirname, '../dist/sql-wasm.wasm');

async function check() {
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);

  console.log('--- Schema ---');
  const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='docs'");
  if (schema.length > 0 && schema[0].values.length > 0) {
    console.log(schema[0].values[0][0]);
  }

  console.log("--- Searching for 'middleware' ---");
  // const stmt = db.prepare("SELECT title, content, category FROM docs WHERE content LIKE '%middleware%' OR title LIKE '%middleware%'");
  const stmt = db.prepare(
    "SELECT * FROM docs WHERE content LIKE '%middleware%' OR title LIKE '%middleware%'"
  );
  while (stmt.step()) {
    const row = stmt.getAsObject();
    console.log(`\n[${row.category}] ${row.title}`);
  }
  stmt.free();
}

check();
