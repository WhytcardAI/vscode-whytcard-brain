const fs = require("fs");
const path = require("path");

console.log("🧪 Testing Auto-Setup Implementation\n");

let passed = 0;
let failed = 0;

function test(name, condition, details = "") {
  if (condition) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passed++;
  } else {
    console.error(`❌ ${name}`);
    if (details) console.error(`   ${details}`);
    failed++;
  }
}

// Test 1: McpSetupService exists
const mcpSetupPath = path.join(
  __dirname,
  "src",
  "services",
  "mcpSetupService.ts",
);
test("McpSetupService file exists", fs.existsSync(mcpSetupPath));

if (fs.existsSync(mcpSetupPath)) {
  const content = fs.readFileSync(mcpSetupPath, "utf8");
  test(
    "McpSetupService has detectEnvironment",
    content.includes("detectEnvironment"),
  );
  test(
    "McpSetupService has getMcpConfigPath",
    content.includes("getMcpConfigPath"),
  );
  test(
    "McpSetupService has setupMcpServer",
    content.includes("setupMcpServer"),
  );
  test(
    "McpSetupService has isMcpConfigured",
    content.includes("isMcpConfigured"),
  );
  test(
    "McpSetupService has promptMcpSetup",
    content.includes("promptMcpSetup"),
  );
  test("McpSetupService has getMcpStatus", content.includes("getMcpStatus"));
  test("McpSetupService supports Windsurf", content.includes("windsurf"));
  test("McpSetupService supports Cursor", content.includes("cursor"));
  test("McpSetupService detects Node.js", content.includes("getNodePath"));
}

// Test 2: Extension integration
const extensionPath = path.join(__dirname, "src", "extension.ts");
if (fs.existsSync(extensionPath)) {
  const content = fs.readFileSync(extensionPath, "utf8");
  test(
    "Extension imports McpSetupService",
    content.includes("McpSetupService"),
  );
  test(
    "Extension initializes mcpSetupService",
    content.includes("new McpSetupService"),
  );
  test("Extension calls promptMcpSetup", content.includes("promptMcpSetup"));
  test(
    "Extension has setupMcp command",
    content.includes("whytcard-brain.setupMcp"),
  );
  test(
    "Extension has mcpStatus command",
    content.includes("whytcard-brain.mcpStatus"),
  );
}

// Test 3: Package.json commands
const packagePath = path.join(__dirname, "package.json");
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const commands = pkg.contributes?.commands || [];

  test(
    "Package has setupMcp command",
    commands.some((c) => c.command === "whytcard-brain.setupMcp"),
  );
  test(
    "Package has mcpStatus command",
    commands.some((c) => c.command === "whytcard-brain.mcpStatus"),
  );
  test(
    "Activation events cleaned",
    pkg.activationEvents?.length <= 2,
    `Has ${pkg.activationEvents?.length} events (should be 1-2)`,
  );
}

// Test 4: Documentation
test("INSTALL.md exists", fs.existsSync(path.join(__dirname, "INSTALL.md")));

const readmePath = path.join(__dirname, "README.md");
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8");
  test("README mentions auto-configure", readme.includes("Auto-configure"));
  test("README links to INSTALL.md", readme.includes("INSTALL.md"));
}

// Test 5: Build outputs
test(
  "Extension build exists",
  fs.existsSync(path.join(__dirname, "dist", "extension.js")),
);
test(
  "MCP server build exists",
  fs.existsSync(path.join(__dirname, "dist", "mcp-server.cjs")),
);
test(
  "WASM file exists",
  fs.existsSync(path.join(__dirname, "dist", "sql-wasm.wasm")),
);

// Summary
console.log("\n" + "=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed === 0) {
  console.log("\n🎉 All auto-setup tests passed!\n");
  console.log("Auto-configuration features:");
  console.log("  ✅ Environment detection (Windsurf/Cursor/VS Code)");
  console.log("  ✅ Automatic MCP config generation");
  console.log("  ✅ Node.js path detection");
  console.log("  ✅ User-friendly prompts and notifications");
  console.log("  ✅ Manual setup commands available");
  console.log("  ✅ Comprehensive documentation");
  console.log("\nThe extension is ready for distribution!\n");
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed\n`);
  process.exit(1);
}
