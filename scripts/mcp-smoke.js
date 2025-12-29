/* eslint-disable no-console */
/**
 * Generic MCP smoke test runner.
 *
 * - Reads a Cursor/Windsurf-style mcp.json
 * - For command-based servers: spawn -> initialize -> tools/list
 * - For URL-based servers: basic reachability check via fetch
 *
 * Usage:
 *   node scripts/mcp-smoke.js --config "C:\\Users\\me\\.cursor\\mcp.json"
 *   node scripts/mcp-smoke.js --only "whytcard-brain,context7"
 *   node scripts/mcp-smoke.js --skip "mcp-playwright"
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

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

function toNameSet(value) {
  if (!value || typeof value !== "string") return null;
  const set = new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.size > 0 ? set : null;
}

function safeSnippet(text, maxLen = 800) {
  const t = String(text || "");
  if (t.length <= maxLen) return t;
  return t.slice(-maxLen);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkUrl(name, url) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { method: "GET" });
    return {
      name,
      kind: "url",
      ok: true,
      details: `reachable (GET ${res.status})`,
      ms: Date.now() - startedAt,
    };
  } catch (e) {
    return {
      name,
      kind: "url",
      ok: false,
      details: `fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      ms: Date.now() - startedAt,
    };
  }
}

function buildInitRequest(id = 1) {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-smoke", version: "0.1.0" },
    },
  };
}

function buildToolsListRequest(id = 2) {
  return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
}

async function checkCommandServer(name, cfg, { timeoutMs }) {
  const startedAt = Date.now();

  const command = cfg.command;
  const args = Array.isArray(cfg.args) ? cfg.args : [];
  const env = { ...process.env, ...(cfg.env || {}) };

  return new Promise((resolve) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let jsonBuf = "";
    let initialized = false;

    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const finalize = (ok, details, extra = {}) => {
      clearTimeout(timeout);
      try {
        child.kill();
      } catch {}
      resolve({
        name,
        kind: "command",
        ok,
        details,
        ms: Date.now() - startedAt,
        stdoutTail: safeSnippet(stdoutBuf),
        stderrTail: safeSnippet(stderrBuf),
        ...extra,
      });
    };

    const timeout = setTimeout(() => {
      finalize(
        false,
        `timeout after ${timeoutMs}ms` + (initialized ? " (after init)" : ""),
      );
    }, timeoutMs);

    child.on("error", (err) => {
      finalize(false, `spawn error: ${err.message}`);
    });

    child.on("exit", (code, signal) => {
      // If it exits before we complete init + tools/list, treat as failure.
      if (!initialized) {
        finalize(
          false,
          `exited early (code=${code}, signal=${signal || "n/a"})`,
        );
      }
    });

    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderrBuf += s;
    });

    child.stdout.on("data", (d) => {
      const s = d.toString();
      stdoutBuf += s;

      jsonBuf += s;
      const lines = jsonBuf.split(/\r?\n/);
      jsonBuf = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (msg.id === 1 && msg.result) {
          initialized = true;
          try {
            child.stdin.write(JSON.stringify(buildToolsListRequest(2)) + "\n");
          } catch {}
        }

        if (msg.id === 2 && msg.result && Array.isArray(msg.result.tools)) {
          const toolNames = msg.result.tools.map((t) => t?.name).filter(Boolean);
          finalize(true, `ok (${toolNames.length} tools)`, {
            tools: toolNames.slice(0, 20),
          });
          return;
        }

        if (msg.id === 2 && msg.error) {
          finalize(false, `tools/list error: ${msg.error.message || "unknown"}`);
          return;
        }

        if (msg.id === 1 && msg.error) {
          finalize(false, `initialize error: ${msg.error.message || "unknown"}`);
          return;
        }
      }
    });

    // Kickstart
    try {
      child.stdin.write(JSON.stringify(buildInitRequest(1)) + "\n");
    } catch (e) {
      finalize(false, `failed to write initialize: ${e.message}`);
    }
  });
}

async function main() {
  const args = parseArgs(process.argv);

  const only = toNameSet(args.only);
  const skip = toNameSet(args.skip);

  const defaultConfigPath = path.join(os.homedir(), ".cursor", "mcp.json");
  const configPath = args.config || defaultConfigPath;

  const timeoutBaseMs = (() => {
    if (!args.timeoutMs) return 45_000;
    const n = Number(args.timeoutMs);
    return Number.isFinite(n) && n > 0 ? n : 45_000;
  })();

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Missing config: ${configPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw);
  const servers = cfg?.mcpServers || {};
  const entries = Object.entries(servers);

  console.log(`🧪 MCP smoke test`);
  console.log(`Config: ${configPath}`);
  console.log(`Servers: ${entries.length}\n`);

  const results = [];

  for (const [name, serverCfg] of entries) {
    if (only && !only.has(name)) continue;
    if (skip && skip.has(name)) {
      results.push({
        name,
        kind: "skip",
        ok: true,
        details: "skipped",
        ms: 0,
      });
      continue;
    }

    if (serverCfg?.disabled) {
      results.push({
        name,
        kind: "skip",
        ok: true,
        details: "disabled=true",
        ms: 0,
      });
      continue;
    }

    console.log(`=== ${name} ===`);

    if (serverCfg?.url) {
      const r = await checkUrl(name, serverCfg.url);
      results.push(r);
      console.log(`${r.ok ? "✅" : "❌"} ${r.details} (${r.ms}ms)\n`);
      continue;
    }

    // Some servers can take longer to install on first run.
    const timeoutMs =
      name.includes("playwright") ? Math.max(timeoutBaseMs, 120_000) : timeoutBaseMs;

    const r = await checkCommandServer(name, serverCfg, { timeoutMs });
    results.push(r);
    console.log(`${r.ok ? "✅" : "❌"} ${r.details} (${r.ms}ms)`);
    if (r.ok && Array.isArray(r.tools) && r.tools.length > 0) {
      console.log(`tools: ${r.tools.join(", ")}`);
    }
    if (!r.ok) {
      const stderrTail = (r.stderrTail || "").trim();
      const stdoutTail = (r.stdoutTail || "").trim();
      if (stderrTail) console.log(`stderr (tail):\n${stderrTail}\n`);
      if (stdoutTail) console.log(`stdout (tail):\n${stdoutTail}\n`);
    }
    console.log("");

    // Small spacing to avoid hammering npx installs
    await sleep(250);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("=".repeat(60));
  console.log(
    `Summary: ${results.length - failed.length} ok, ${failed.length} failed`,
  );
  console.log("=".repeat(60));

  if (failed.length > 0) {
    console.log("\nFailed servers:");
    for (const f of failed) {
      console.log(`- ${f.name}: ${f.details}`);
    }
    process.exit(1);
  }

  console.log("\n✅ All MCP smoke checks passed.");
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});


