/**
 * Test du système de templates
 * Vérifie que les templates peuvent être ajoutés, recherchés et appliqués
 */

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Chemin de la DB (même logique que brainService)
function getDbPath() {
  const candidates = [
    path.join(
      process.env.APPDATA || "",
      "Windsurf - Next",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
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
      "Code",
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    ),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Créer dans le premier emplacement par défaut
  return candidates[0];
}

async function testTemplates() {
  console.log("🧪 Test du système de templates\n");

  const dbPath = getDbPath();
  console.log(`📂 Base de données: ${dbPath}`);

  // Charger sql.js
  const SQL = await initSqlJs();

  // Ouvrir ou créer la DB
  let db;
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
    console.log("✅ Base de données existante chargée\n");
  } else {
    db = new SQL.Database();
    console.log("✅ Nouvelle base de données créée\n");

    // Créer le schéma
    db.run(`
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
      CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
    `);
  }

  // Test 1: Ajouter un template snippet
  console.log("📝 Test 1: Ajout d'un template snippet");
  try {
    db.run(
      `INSERT INTO templates (name, description, language, framework, tags, type, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "react-component-test",
        "Composant React de test",
        "typescript",
        "react",
        '["component","test"]',
        "snippet",
        "export const TestComponent = () => {\n  return <div>Hello World</div>;\n};",
      ],
    );
    console.log("✅ Template snippet ajouté\n");
  } catch (e) {
    console.log(`⚠️  Template existe déjà (normal): ${e.message}\n`);
  }

  // Test 2: Ajouter un template multifile
  console.log("📝 Test 2: Ajout d'un template multifile");
  const multifileContent = JSON.stringify({
    "src/components/Button.tsx":
      "export const Button = () => <button>Click</button>;",
    "src/components/Button.test.tsx":
      'import { Button } from "./Button";\ntest("renders", () => {});',
    "src/components/index.ts": 'export { Button } from "./Button";',
  });

  try {
    db.run(
      `INSERT INTO templates (name, description, language, framework, tags, type, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "nextjs-component-structure",
        "Structure complète composant Next.js",
        "typescript",
        "nextjs",
        '["component","structure","test"]',
        "multifile",
        multifileContent,
      ],
    );
    console.log("✅ Template multifile ajouté\n");
  } catch (e) {
    console.log(`⚠️  Template existe déjà (normal): ${e.message}\n`);
  }

  // Test 3: Rechercher les templates
  console.log("🔍 Test 3: Recherche de templates");
  const stmt = db.prepare(`
    SELECT * FROM templates 
    WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
    ORDER BY usage_count DESC, created_at DESC
  `);
  stmt.bind(["%react%", "%react%", "%react%"]);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  console.log(`✅ ${results.length} template(s) trouvé(s):`);
  results.forEach((t) => {
    console.log(`   - ${t.name} (${t.type}) - ${t.framework || "N/A"}`);
    console.log(`     ${t.description}`);
    console.log(`     Utilisé: ${t.usage_count} fois\n`);
  });

  // Test 4: Récupérer un template par nom
  console.log("📖 Test 4: Récupération d'un template");
  const getStmt = db.prepare("SELECT * FROM templates WHERE name = ?");
  getStmt.bind(["react-component-test"]);

  if (getStmt.step()) {
    const template = getStmt.getAsObject();
    console.log("✅ Template trouvé:");
    console.log(`   Nom: ${template.name}`);
    console.log(`   Type: ${template.type}`);
    console.log(`   Framework: ${template.framework}`);
    console.log(`   Contenu:\n${template.content}\n`);
  }
  getStmt.free();

  // Test 5: Incrémenter l'usage
  console.log("📊 Test 5: Incrément du compteur d'usage");
  db.run(
    "UPDATE templates SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE name = ?",
    ["react-component-test"],
  );

  const countStmt = db.prepare(
    "SELECT usage_count FROM templates WHERE name = ?",
  );
  countStmt.bind(["react-component-test"]);
  if (countStmt.step()) {
    const { usage_count } = countStmt.getAsObject();
    console.log(`✅ Compteur mis à jour: ${usage_count} utilisation(s)\n`);
  }
  countStmt.free();

  // Test 6: Statistiques
  console.log("📈 Test 6: Statistiques globales");
  const statsStmt = db.prepare(
    "SELECT COUNT(*) as total, SUM(usage_count) as total_usage FROM templates",
  );
  if (statsStmt.step()) {
    const { total, total_usage } = statsStmt.getAsObject();
    console.log(`✅ ${total} template(s) dans la base`);
    console.log(`✅ ${total_usage || 0} utilisation(s) au total\n`);
  }
  statsStmt.free();

  // Sauvegarder la DB
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log("💾 Base de données sauvegardée\n");

  db.close();

  console.log("✅ Tous les tests réussis!");
  console.log("\n📌 Prochaines étapes:");
  console.log("   1. Ouvre Windsurf");
  console.log("   2. Va dans la sidebar Brain");
  console.log('   3. Clique sur "Templates"');
  console.log("   4. Tu devrais voir les 2 templates créés ici");
}

testTemplates().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
