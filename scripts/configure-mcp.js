/* eslint-disable no-console */
/**
 * Configure WhytCard Brain MCP server for Cursor or Windsurf.
 *
 * This is meant for end-users who want a one-command setup.
 *
 * Usage:
 *   node scripts/configure-mcp.js --editor cursor
 *   node scripts/configure-mcp.js --editor windsurf
 *
 * Optional:
 *   --config <path>   Override MCP config file path
 *   --db <path>       Override BRAIN_DB_PATH
 *   --server <path>   Override MCP server path (mcp-server.cjs)
 *   --strict 0|1      Enable strict mode (default 1)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function toBool(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  const s = String(value).trim().toLowerCase();
  return !(s === "0" || s === "false" || s === "no");
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function defaultDbPath(editor) {
  const home = os.homedir();
  const platform = process.platform;
  const appData =
    process.env.APPDATA || path.join(home, "AppData", "Roaming");

  if (platform === "win32") {
    const base =
      editor === "windsurf" ? "Windsurf - Next"
      : editor === "cursor" ? "Cursor"
      : "Code";
    return path.join(
      appData,
      base,
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    );
  }

  if (platform === "darwin") {
    const base =
      editor === "windsurf" ? "Windsurf - Next"
      : editor === "cursor" ? "Cursor"
      : "Code";
    return path.join(
      home,
      "Library",
      "Application Support",
      base,
      "User",
      "globalStorage",
      "whytcard.whytcard-brain",
      "brain.db",
    );
  }

  // linux
  const base =
    editor === "windsurf" ? "Windsurf - Next"
    : editor === "cursor" ? "Cursor"
    : "Code";
  return path.join(
    home,
    ".config",
    base,
    "User",
    "globalStorage",
    "whytcard.whytcard-brain",
    "brain.db",
  );
}

function detectCursorConfigPath() {
  const home = os.homedir();
  const dir = path.join(home, ".cursor");
  const primary = path.join(dir, "mcp.json");
  const fallback = path.join(dir, "mcp_config.json");
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return primary;
}

function detectWindsurfConfigPath() {
  const home = os.homedir();
  const primary = path.join(home, ".codeium", "windsurf-next", "mcp_config.json");
  const fallback = path.join(home, ".codeium", "windsurf", "mcp_config.json");
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return primary;
}

function resolveInstalledCursorExtensionServerPath() {
  const home = os.homedir();
  const extensionsDir = path.join(home, ".cursor", "extensions");
  const extensionsJson = path.join(extensionsDir, "extensions.json");
  const parsed = readJson(extensionsJson);
  if (!Array.isArray(parsed)) return null;

  const entry = parsed.find(
    (e) => e?.identifier?.id === "whytcard.whytcard-brain",
  );
  const fsPath =
    (typeof entry?.location?.fsPath === "string" && entry.location.fsPath) ||
    (typeof entry?.relativeLocation === "string" ?
      path.join(extensionsDir, entry.relativeLocation)
    : null);
  if (!fsPath) return null;

  const serverPath = path.join(fsPath, "dist", "mcp-server.cjs");
  return fs.existsSync(serverPath) ? serverPath : null;
}

function resolveRepoServerPath() {
  const serverPath = path.join(__dirname, "..", "dist", "mcp-server.cjs");
  return fs.existsSync(serverPath) ? serverPath : null;
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv);
  const editor = String(args.editor || "cursor").toLowerCase();
  if (editor !== "cursor" && editor !== "windsurf") {
    console.error('❌ Invalid --editor. Use "cursor" or "windsurf".');
    process.exit(1);
  }

  const strict = toBool(args.strict, true);

  const configPath =
    typeof args.config === "string" ? args.config
    : editor === "cursor" ? detectCursorConfigPath()
    : detectWindsurfConfigPath();

  const serverPath =
    typeof args.server === "string" ? args.server
    : editor === "cursor" ? resolveInstalledCursorExtensionServerPath() || resolveRepoServerPath()
    : resolveRepoServerPath();

  if (!serverPath) {
    console.error(
      "❌ Cannot find MCP server file (dist/mcp-server.cjs).\n" +
        "Run `npm run build` first or install the extension in Cursor.",
    );
    process.exit(1);
  }

  const dbPath = typeof args.db === "string" ? args.db : defaultDbPath(editor);
  ensureDirForFile(dbPath);

  const alwaysAllow = [
    "brainConsult",
    "brainSearch",
    "brainSave",
    "brainBug",
    "brainSession",
    "brainValidate",
    "brainTemplateSave",
    "brainTemplateSearch",
    "brainTemplateApply",
  ];

  const next = readJson(configPath) || {};
  next.mcpServers = next.mcpServers && typeof next.mcpServers === "object" ? next.mcpServers : {};

  next.mcpServers["whytcard-brain"] = {
    command: process.execPath,
    args: [serverPath],
    disabled: false,
    alwaysAllow,
    env: {
      BRAIN_DB_PATH: dbPath,
      BRAIN_REQUIRE_CONSULT: "1",
      BRAIN_REQUIRE_CONSULT_EVERY_TOOL: "0",
      BRAIN_CONSULT_TTL_MS: "1200000",
      BRAIN_STRICT_MODE: strict ? "1" : "0",
      BRAIN_STRICT_REQUIRE_SOURCES: "1",
    },
  };

  writeJson(configPath, next);

  console.log("✅ MCP configured");
  console.log(`- editor: ${editor}`);
  console.log(`- config: ${configPath}`);
  console.log(`- server: ${serverPath}`);
  console.log(`- db: ${dbPath}`);
  console.log(`- strict: ${strict ? "on" : "off"}`);
  console.log("\nNext: restart Cursor/Windsurf to apply changes.");
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});


