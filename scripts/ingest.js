const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const PROMPTS_DIR = 'C:/Users/Jerome/AppData/Roaming/Code - Insiders/User/prompts';
// We need to find where the DB is. Based on previous logs:
// Global storage path: c:\Users\Jerome\AppData\Roaming\Code - Insiders\User\globalStorage\whytcard.whytcard-brain
const DB_PATH =
  'c:/Users/Jerome/AppData/Roaming/Code - Insiders/User/globalStorage/whytcard.whytcard-brain/brain.db';
const WASM_PATH = path.join(__dirname, '../dist/sql-wasm.wasm');

async function ingest() {
  console.log('Loading SQL.js...');
  const SQL = await initSqlJs({
    locateFile: () => WASM_PATH,
  });

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found at:', DB_PATH);
    return;
  }

  console.log('Opening database...');
  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);

  // Ensure category column exists (migration might not have run if extension wasn't reloaded properly)
  try {
    db.run("ALTER TABLE docs ADD COLUMN category TEXT DEFAULT 'documentation'");
    console.log('Added category column to docs table');
  } catch (e) {
    // Column likely exists
  }

  const files = fs.readdirSync(PROMPTS_DIR).filter((f) => f.endsWith('.instructions.md'));

  console.log(`Found ${files.length} instruction files.`);

  const stmt = db.prepare(`
    INSERT INTO docs (library, version, topic, title, content, source, url, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const content = fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8');

    // Parse filename: type.subtype.instructions.md
    const parts = file.replace('.instructions.md', '').split('.');
    let library = 'General';
    let topic = 'Instructions';

    if (parts.length >= 2) {
      library = parts[0].charAt(0).toUpperCase() + parts[0].slice(1); // e.g. Core, Infra, Lang
      topic = parts[1].charAt(0).toUpperCase() + parts[1].slice(1); // e.g. Coding, Docker, Python
    } else if (parts.length === 1) {
      library = 'General';
      topic = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }

    const title = `${library} • ${topic}`;

    try {
      // Check if exists
      const existing = db.exec(
        `SELECT id FROM docs WHERE title = '${title}' AND category = 'instruction'`
      );
      if (existing.length > 0 && existing[0].values.length > 0) {
        console.log(`  Skipping ${title} (already exists)`);
        continue;
      }

      stmt.run([library, null, topic, title, content, 'auto-ingest', file, 'instruction']);
      console.log(`  Ingested: ${title}`);
    } catch (e) {
      console.error(`  Error ingesting ${file}:`, e);
    }
  }

  stmt.free();

  console.log('Saving database...');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  db.close();
  console.log('Done!');
}

ingest();
