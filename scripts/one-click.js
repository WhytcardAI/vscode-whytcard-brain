/* eslint-disable no-console */
/**
 * One-command setup for end-users:
 * - installs deps (npm ci)
 * - runs quality checks (npm run check)
 * - packages VSIX (vsce)
 * - installs VSIX into Cursor / VS Code (optional)
 * - configures MCP (Cursor/Windsurf) (optional)
 *
 * Usage:
 *   node scripts/one-click.js --editor cursor
 *
 * Options:
 *   --editor cursor|vscode|windsurf   (default: cursor)
 *   --skip-install                    Skip npm ci
 *   --skip-check                      Skip npm run check
 *   --skip-package                    Skip vsce packaging
 *   --skip-editor-install             Skip installing VSIX into the editor
 *   --skip-mcp                        Skip MCP config step
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

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

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    cwd: opts.cwd,
    shell: opts.shell || false,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (res.status !== 0) {
    throw new Error(`Command failed (${cmd} ${cmdArgs.join(" ")}), exit=${res.status}`);
  }
}

function findLatestVsix(repoRoot) {
  const entries = fs
    .readdirSync(repoRoot)
    .filter((f) => /^whytcard-brain-.*\.vsix$/i.test(f))
    .map((f) => ({
      name: f,
      full: path.join(repoRoot, f),
      mtimeMs: fs.statSync(path.join(repoRoot, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.full || null;
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findEditorCli(editor) {
  const platform = process.platform;

  const candidates = [];
  if (editor === "cursor") {
    if (platform === "win32") {
      candidates.push(
        path.join(process.env.ProgramFiles || "C:\\Program Files", "cursor", "resources", "app", "bin", "cursor.cmd"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "Cursor", "resources", "app", "bin", "cursor.cmd"),
      );
    } else if (platform === "darwin") {
      candidates.push("/Applications/Cursor.app/Contents/Resources/app/bin/cursor");
    }
    candidates.push("cursor"); // PATH fallback
  }

  if (editor === "vscode") {
    candidates.push("code"); // PATH
  }

  if (editor === "windsurf") {
    candidates.push("windsurf"); // PATH (if provided)
  }

  for (const c of candidates) {
    if (c.includes(path.sep) || c.includes("/")) {
      if (exists(c)) return c;
      continue;
    }
    // bare command: best effort (assume in PATH)
    return c;
  }

  return null;
}

function installVsix(editor, editorCli, vsixPath) {
  console.log(`\n📦 Installing VSIX into ${editor}...`);

  if (process.platform === "win32" && /\\.cmd$|\\.bat$/i.test(editorCli)) {
    // .cmd needs cmd.exe
    const cmdExe = process.env.COMSPEC || "cmd.exe";
    const line =
      `"${editorCli}" --install-extension "${vsixPath}" --force`;
    run(cmdExe, ["/d", "/s", "/c", line], { shell: false });
    return;
  }

  run(editorCli, ["--install-extension", vsixPath, "--force"], {
    shell: false,
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const editor = String(args.editor || "cursor").toLowerCase();
  if (!["cursor", "vscode", "windsurf"].includes(editor)) {
    console.error('❌ Invalid --editor. Use "cursor", "vscode", or "windsurf".');
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, "..");

  console.log("🧠 WhytCard Brain - one-click setup");
  console.log(`- repo: ${repoRoot}`);
  console.log(`- editor: ${editor}`);
  console.log("");

  if (!args["skip-install"]) {
    console.log("📥 Installing dependencies (npm ci)...");
    run("npm", ["ci"], { cwd: repoRoot, shell: process.platform === "win32" });
  }

  if (!args["skip-check"]) {
    console.log("\n✅ Running quality checks (npm run check)...");
    run("npm", ["run", "check"], { cwd: repoRoot, shell: process.platform === "win32" });
  }

  if (!args["skip-package"]) {
    console.log("\n📦 Packaging VSIX (vsce)...");
    run("npx", ["--yes", "@vscode/vsce", "package"], {
      cwd: repoRoot,
      shell: process.platform === "win32",
    });
  }

  const vsixPath = findLatestVsix(repoRoot);
  if (!vsixPath) {
    throw new Error("No VSIX found. Run packaging first (npx @vscode/vsce package).");
  }
  console.log(`\nVSIX: ${vsixPath}`);

  if (!args["skip-editor-install"]) {
    const cli = findEditorCli(editor);
    if (!cli) {
      console.warn(`⚠️ Could not find ${editor} CLI. Skipping editor installation.`);
    } else {
      installVsix(editor, cli, vsixPath);
    }
  }

  if (!args["skip-mcp"] && (editor === "cursor" || editor === "windsurf")) {
    console.log("\n🔧 Configuring MCP (strict mode on)...");
    run(process.execPath, [path.join(__dirname, "configure-mcp.js"), "--editor", editor], {
      cwd: repoRoot,
      shell: false,
    });
  }

  console.log("\n🎉 Done.");
  console.log(`Next: restart ${editor} (or 'Developer: Reload Window').`);
}

main().catch((e) => {
  console.error("\n❌ Failed:", e.message || e);
  process.exit(1);
});


