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

  console.log("--- Searching for 'middleware' ---");
  const stmt = db.prepare(
    "SELECT title, content FROM docs WHERE content LIKE '%middleware%' OR title LIKE '%middleware%'"
  );
  while (stmt.step()) {
    const row = stmt.getAsObject();
    console.log(`\n[${row.title}]`);
    console.log(row.content.substring(0, 200) + '...');
  }
  stmt.free();

  console.log("\n--- Searching for 'proxy' ---");
  const stmt2 = db.prepare(
    "SELECT title, content FROM docs WHERE content LIKE '%proxy%' OR title LIKE '%proxy%'"
  );
  while (stmt2.step()) {
    const row = stmt2.getAsObject();
    console.log(`\n[${row.title}]`);
    console.log(row.content.substring(0, 200) + '...');
  }
  stmt2.free();
}

check();
