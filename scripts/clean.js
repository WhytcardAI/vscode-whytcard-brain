/* eslint-disable no-console */
/**
 * Clean generated artifacts from the repo working tree.
 *
 * Safe to run anytime. Does NOT delete source files.
 *
 * Usage:
 *   node scripts/clean.js
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

function rmrf(targetPath) {
  try {
    if (!fs.existsSync(targetPath)) return false;
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.warn(`⚠️ Failed to remove ${targetPath}:`, e);
    return false;
  }
}

function removeGlobLike(dir, predicate) {
  if (!fs.existsSync(dir)) return 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let removed = 0;
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!predicate(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (rmrf(full)) removed++;
  }
  return removed;
}

console.log("🧹 Cleaning repo artifacts...");

const removedDirs = [];
const removedFiles = [];

for (const dir of ["dist", path.join("mcp-server", "dist")]) {
  const p = path.join(repoRoot, dir);
  if (rmrf(p)) removedDirs.push(dir);
}

for (const file of ["Release.zip", "mcp-smoke-stdout.txt", "mcp-smoke-stderr.txt"]) {
  const p = path.join(repoRoot, file);
  if (rmrf(p)) removedFiles.push(file);
}

const removedVsix = removeGlobLike(repoRoot, (name) => name.endsWith(".vsix"));
const removedReleaseVsix = removeGlobLike(
  path.join(repoRoot, "Release"),
  (name) => name.endsWith(".vsix") || name.endsWith(".zip"),
);

console.log("");
console.log("Removed:");
console.log(`- dirs: ${removedDirs.length ? removedDirs.join(", ") : "(none)"}`);
console.log(
  `- files: ${removedFiles.length ? removedFiles.join(", ") : "(none)"}`,
);
console.log(`- vsix (root): ${removedVsix}`);
console.log(`- release artifacts (Release/*): ${removedReleaseVsix}`);
console.log("");
console.log("✅ Clean complete.");


