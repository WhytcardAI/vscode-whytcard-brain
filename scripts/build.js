/**
 * Build script pour WhytCard Brain
 * Copie sql.js wasm et dépendances
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("Building WhytCard Brain (WASM version)...");

// 1. Build avec esbuild
// On bundle sql.js (JS) mais on doit copier le WASM à côté
console.log("1. Running esbuild...");
execSync(
  "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node --minify",
  {
    stdio: "inherit",
  },
);

// 2. Build MCP server (CommonJS format for Node compatibility)
console.log("2. Building MCP server...");
execSync(
  "esbuild src/mcp-server.ts --bundle --outfile=dist/mcp-server.cjs --format=cjs --platform=node --target=node18",
  {
    stdio: "inherit",
  },
);

// 3. Copier le fichier WASM de sql.js vers dist/
console.log("3. Copying sql-wasm.wasm...");
const distDir = path.join(__dirname, "..", "dist");
const nodeModulesDir = path.join(__dirname, "..", "node_modules");
const mcpServerDir = path.join(__dirname, "..", "mcp-server", "dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const wasmSrc = path.join(nodeModulesDir, "sql.js", "dist", "sql-wasm.wasm");
const wasmDest = path.join(distDir, "sql-wasm.wasm");

if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, wasmDest);
  console.log(`  - Copied ${wasmSrc} to ${wasmDest}`);
} else {
  console.error(`  ! Error: WASM file not found at ${wasmSrc}`);
  process.exit(1);
}

// 4. Copy MCP server to mcp-server/dist for npm package
console.log("4. Preparing MCP npm package...");
if (!fs.existsSync(mcpServerDir)) {
  fs.mkdirSync(mcpServerDir, { recursive: true });
}
fs.copyFileSync(
  path.join(distDir, "mcp-server.cjs"),
  path.join(mcpServerDir, "mcp-server.cjs"),
);
fs.copyFileSync(wasmDest, path.join(mcpServerDir, "sql-wasm.wasm"));
console.log("  - Copied mcp-server.cjs to mcp-server/dist/");
console.log("  - Copied sql-wasm.wasm to mcp-server/dist/");

console.log("✓ Build completed!");
console.log("  - dist/extension.js");
console.log("  - dist/mcp-server.cjs");
console.log("  - dist/sql-wasm.wasm");
console.log("  - mcp-server/dist/mcp-server.cjs (npm package)");
