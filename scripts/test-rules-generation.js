/**
 * Test script for rules generation
 * Run with: node scripts/test-rules-generation.js
 */

const fs = require("fs");
const path = require("path");

// Read and eval the copilotUtils module (simplified test)
const utilsPath = path.join(__dirname, "../src/utils/copilotUtils.ts");
const utilsContent = fs.readFileSync(utilsPath, "utf8");

console.log("=== WhytCard Brain Rules Generation Test ===\n");

// Test 1: Check file exists
console.log("✅ TEST 1: copilotUtils.ts exists");

// Test 2: Check for key exports
const hasExports = [
  "buildCopilotInstructionsContent",
  "buildCursorRulesContent",
  "buildWindsurfRulesContent",
  "BrainInstructionConfig",
  "DEFAULT_CONFIG",
  "getConfigFromSettings",
].every((exp) => utilsContent.includes(exp));

console.log(hasExports ? "✅ TEST 2: All exports present" : "❌ TEST 2: Missing exports");

// Test 3: Check Cursor MDC format
const hasMdcFormat =
  utilsContent.includes("alwaysApply: true") &&
  utilsContent.includes("description:") &&
  utilsContent.includes(".cursor/rules/brain.mdc");
console.log(
  hasMdcFormat ? "✅ TEST 3: Cursor MDC format correct" : "❌ TEST 3: Cursor MDC format issue",
);

// Test 4: Check Windsurf format
const hasWindsurfFormat =
  utilsContent.includes("trigger: always_on") && utilsContent.includes(".windsurf/rules/");
console.log(
  hasWindsurfFormat ? "✅ TEST 4: Windsurf format correct" : "❌ TEST 4: Windsurf format issue",
);

// Test 5: Check multi-language support
const hasMultiLang =
  utilsContent.includes("language: 'fr'") ||
  utilsContent.includes('language: "fr"') ||
  (utilsContent.includes("TOUJOURS CONSULTER") && utilsContent.includes("ALWAYS CONSULT"));
console.log(hasMultiLang ? "✅ TEST 5: Multi-language support" : "❌ TEST 5: Multi-language issue");

// Test 6: Check config options
const hasConfigOptions =
  utilsContent.includes("strictMode") &&
  utilsContent.includes("autoSave") &&
  utilsContent.includes("instructionStyle") &&
  utilsContent.includes("enabledTools");
console.log(
  hasConfigOptions ? "✅ TEST 6: Config options present" : "❌ TEST 6: Config options issue",
);

// Test 7: Check extension.ts for correct paths
const extPath = path.join(__dirname, "../src/extension.ts");
const extContent = fs.readFileSync(extPath, "utf8");

const hasCorrectPaths =
  extContent.includes(".cursor/rules/brain.mdc") &&
  extContent.includes(".windsurf/rules/brain.md") &&
  extContent.includes(".github/copilot-instructions.md");
console.log(
  hasCorrectPaths ? "✅ TEST 7: Extension paths correct" : "❌ TEST 7: Extension paths issue",
);

// Test 8: Check package.json settings
const pkgPath = path.join(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const hasSettings =
  pkg.contributes?.configuration?.properties?.["whytcard-brain.strictMode"] &&
  pkg.contributes?.configuration?.properties?.["whytcard-brain.autoSave"] &&
  pkg.contributes?.configuration?.properties?.["whytcard-brain.instructionStyle"];
console.log(
  hasSettings
    ? "✅ TEST 8: Package.json settings correct"
    : "❌ TEST 8: Package.json settings issue",
);

// Test 9: Check walkthrough updated
const hasUpdatedWalkthrough = JSON.stringify(pkg).includes(".cursor/rules/brain.mdc");
console.log(
  hasUpdatedWalkthrough ? "✅ TEST 9: Walkthrough updated" : "❌ TEST 9: Walkthrough not updated",
);

// Test 10: Check VSIX exists
const vsixPath = path.join(__dirname, "../whytcard-brain-1.1.2.vsix");
const vsixExists = fs.existsSync(vsixPath);
console.log(vsixExists ? "✅ TEST 10: VSIX package exists" : "❌ TEST 10: VSIX not found");

console.log("\n=== Summary ===");
const allPassed =
  hasExports &&
  hasMdcFormat &&
  hasWindsurfFormat &&
  hasMultiLang &&
  hasConfigOptions &&
  hasCorrectPaths &&
  hasSettings &&
  hasUpdatedWalkthrough &&
  vsixExists;
console.log(allPassed ? "✅ All tests passed!" : "⚠️ Some tests failed");

// Show sample generated content
console.log("\n=== Sample Cursor MDC Content ===");
const mdcStart = utilsContent.indexOf("return `---");
const mdcEnd = utilsContent.indexOf("`}", mdcStart);
if (mdcStart > 0) {
  // Extract the template
  console.log("Template found in source. Frontmatter structure:");
  console.log("---");
  console.log("description: WhytCard Brain - Local knowledge base rules...");
  console.log("globs: ");
  console.log("alwaysApply: true");
  console.log("---");
  console.log("");
  console.log("# WhytCard Brain Agent Rules");
  console.log("...(dynamic content based on config)...");
}
