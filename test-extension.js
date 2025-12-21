const path = require("path");

console.log("🧪 Testing WhytCard Brain Extension Components...\n");

// Test 1: Verify build outputs
console.log("📦 TEST 1/4: Checking build outputs...");
const fs = require("fs");

const requiredFiles = [
  "dist/extension.js",
  "dist/mcp-server.cjs",
  "dist/sql-wasm.wasm",
  "mcp-server/dist/mcp-server.cjs",
  "mcp-server/dist/sql-wasm.wasm",
];

let allFilesExist = true;
requiredFiles.forEach((file) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  const size = exists ? fs.statSync(path.join(__dirname, file)).size : 0;
  console.log(
    `  ${exists ? "✅" : "❌"} ${file} ${exists ? `(${Math.round(size / 1024)}kb)` : ""}`,
  );
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.error("\n❌ TEST 1/4 FAILED: Missing build outputs");
  process.exit(1);
}
console.log("✅ TEST 1/4 PASSED: All build outputs present\n");

// Test 2: Check package.json configuration
console.log("📦 TEST 2/4: Checking package.json configuration...");
const packageJson = require("./package.json");

const requiredFields = {
  name: "whytcard-brain",
  publisher: "whytcard",
  "engines.vscode": "^1.89.0",
  main: "./dist/extension.js",
};

let configValid = true;
Object.entries(requiredFields).forEach(([key, expected]) => {
  const keys = key.split(".");
  let actual = packageJson;
  keys.forEach((k) => (actual = actual?.[k]));

  const matches = actual === expected;
  console.log(`  ${matches ? "✅" : "❌"} ${key}: ${actual}`);
  if (!matches) configValid = false;
});

// Check contributions
const hasTools = packageJson.contributes?.languageModelTools?.length > 0;
const hasViews = packageJson.contributes?.views?.["whytcard-brain"]?.length > 0;
const hasCommands = packageJson.contributes?.commands?.length > 0;

console.log(
  `  ${hasTools ? "✅" : "❌"} Language Model Tools: ${packageJson.contributes?.languageModelTools?.length || 0}`,
);
console.log(
  `  ${hasViews ? "✅" : "❌"} Views: ${packageJson.contributes?.views?.["whytcard-brain"]?.length || 0}`,
);
console.log(
  `  ${hasCommands ? "✅" : "❌"} Commands: ${packageJson.contributes?.commands?.length || 0}`,
);

if (!configValid || !hasTools || !hasViews || !hasCommands) {
  console.error("\n❌ TEST 2/4 FAILED: Invalid package.json configuration");
  process.exit(1);
}
console.log("✅ TEST 2/4 PASSED: Package.json properly configured\n");

// Test 3: Verify MCP config
console.log("📦 TEST 3/4: Checking Windsurf MCP configuration...");
const mcpConfigPath =
  "c:\\Users\\jerome\\.codeium\\windsurf-next\\mcp_config.json";

if (!fs.existsSync(mcpConfigPath)) {
  console.error("❌ MCP config not found");
  process.exit(1);
}

const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
const brainConfig = mcpConfig.mcpServers?.["whytcard-brain"];

if (!brainConfig) {
  console.error("❌ whytcard-brain not configured in MCP");
  process.exit(1);
}

console.log(`  ✅ Command: ${brainConfig.command}`);
console.log(`  ✅ Server path: ${brainConfig.args?.[0]}`);
console.log(`  ✅ DB path: ${brainConfig.env?.BRAIN_DB_PATH}`);
console.log(`  ✅ Strict mode: ${brainConfig.env?.BRAIN_STRICT_MODE}`);
console.log(`  ✅ Always allow tools: ${brainConfig.alwaysAllow?.length || 0}`);

const serverExists = fs.existsSync(brainConfig.args[0]);
const dbExists = fs.existsSync(brainConfig.env.BRAIN_DB_PATH);

console.log(`  ${serverExists ? "✅" : "❌"} Server file exists`);
console.log(`  ${dbExists ? "✅" : "❌"} Database file exists`);

if (!serverExists || !dbExists) {
  console.error("\n❌ TEST 3/4 FAILED: MCP configuration issues");
  process.exit(1);
}
console.log("✅ TEST 3/4 PASSED: MCP configuration valid\n");

// Test 4: Simple DB schema test
console.log("📦 TEST 4/4: Testing database schema...");

const initSqlJs = require("sql.js");
const dbPath = brainConfig.env.BRAIN_DB_PATH;

initSqlJs({
  locateFile: (file) => path.join(__dirname, "dist", file),
})
  .then((SQL) => {
    const dbBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(dbBuffer);

    // Check tables exist
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values.map((v) => v[0]) || [];

    const requiredTables = ["docs", "pitfalls", "cache"];
    const missingTables = requiredTables.filter((t) => !tableNames.includes(t));

    console.log(
      `  ✅ Found ${tableNames.length} tables: ${tableNames.join(", ")}`,
    );

    if (missingTables.length > 0) {
      console.error(`  ❌ Missing tables: ${missingTables.join(", ")}`);
      process.exit(1);
    }

    // Check docs count
    const docsCount = db.exec("SELECT COUNT(*) FROM docs")[0].values[0][0];
    const pitfallsCount = db.exec("SELECT COUNT(*) FROM pitfalls")[0]
      .values[0][0];

    console.log(`  ✅ Docs count: ${docsCount}`);
    console.log(`  ✅ Pitfalls count: ${pitfallsCount}`);

    // Check categories
    const categories = db.exec(
      "SELECT DISTINCT category FROM docs WHERE category IS NOT NULL",
    );
    if (categories[0]?.values.length > 0) {
      const cats = categories[0].values.map((v) => v[0]);
      console.log(`  ✅ Categories: ${cats.join(", ")}`);
    }

    db.close();

    console.log("✅ TEST 4/4 PASSED: Database schema valid\n");

    // All tests passed
    console.log("=".repeat(60));
    console.log("✅ ALL EXTENSION TESTS PASSED (4/4)");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    console.log("  ✅ Build outputs verified");
    console.log("  ✅ Package.json configuration valid");
    console.log("  ✅ MCP configuration correct");
    console.log("  ✅ Database schema valid");
    console.log("\n🎉 WhytCard Brain extension is ready to use!\n");
  })
  .catch((err) => {
    console.error("❌ TEST 4/4 FAILED:", err.message);
    process.exit(1);
  });
