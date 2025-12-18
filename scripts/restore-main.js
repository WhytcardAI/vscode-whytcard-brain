const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH =
  'c:/Users/Jerome/AppData/Roaming/Code - Insiders/User/globalStorage/whytcard.whytcard-brain/brain.db';
const WASM_PATH = path.join(__dirname, '../dist/sql-wasm.wasm');

async function restore() {
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);

  console.log("--- Searching for 'Core • Coding' ---");
  const stmt = db.prepare("SELECT title FROM docs WHERE title = 'Core • Coding'");
  if (stmt.step()) {
    console.log('Found: ' + stmt.getAsObject().title);
  } else {
    console.log('Not found.');
  }
  stmt.free();
}

restore();
