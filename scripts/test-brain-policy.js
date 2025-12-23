/* eslint-disable no-console */
/**
 * Tests WhytCard Brain MCP policy enforcement.
 *
 * What it checks:
 * - With BRAIN_REQUIRE_CONSULT=1, brainSearch is blocked until brainConsult is called.
 * - With strict mode enabled, brainSearch is blocked until a consult finds at least one doc with a URL.
 *
 * This script uses a TEMP database by default to avoid modifying your real Brain DB.
 *
 * Usage:
 *   node scripts/test-brain-policy.js
 *   node scripts/test-brain-policy.js --db "C:\\path\\to\\brain.db"   # (optional)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function safeSnippet(text, maxLen = 400) {
  const t = String(text || "");
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "...";
}

function rpc(id, method, params) {
  return { jsonrpc: "2.0", id, method, params };
}

function initRequest(id = 1) {
  return rpc(id, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "brain-policy-test", version: "0.1.0" },
  });
}

function toolsCall(id, name, args) {
  return rpc(id, "tools/call", { name, arguments: args });
}

async function runScenario({ strictMode, dbPath }) {
  const serverPath = path.join(__dirname, "..", "dist", "mcp-server.cjs");
  const env = {
    ...process.env,
    BRAIN_DB_PATH: dbPath,
    BRAIN_REQUIRE_CONSULT: "1",
    BRAIN_REQUIRE_CONSULT_EVERY_TOOL: "0",
    BRAIN_STRICT_MODE: strictMode ? "1" : "0",
    BRAIN_STRICT_REQUIRE_SOURCES: "1",
  };

  const child = spawn("node", [serverPath], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let buf = "";
  let jsonBuf = "";

  const pending = new Map();
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      // exit is expected, we kill after tests
      if (code !== 0 && pending.size > 0) {
        reject(new Error(`Server exited early with code ${code}`));
      }
      resolve();
    });
  });

  function send(msg) {
    child.stdin.write(JSON.stringify(msg) + "\n");
  }

  function waitFor(id, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timeout waiting for response id=${id}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, t });
    });
  }

  child.stderr.on("data", (d) => {
    buf += d.toString();
  });

  child.stdout.on("data", (d) => {
    const s = d.toString();
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
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        clearTimeout(p.t);
        pending.delete(msg.id);
        p.resolve(msg);
      }
    }
  });

  // Initialize
  send(initRequest(1));
  await waitFor(1);

  // 1) brainSearch BEFORE consult should be blocked
  send(toolsCall(2, "brainSearch", { query: "test" }));
  const before = await waitFor(2);

  const beforeText = before?.result?.content?.[0]?.text || "";
  const blockedBefore = Boolean(before?.result?.isError) || beforeText.includes("call brainConsult");

  // 2) brainConsult (may be unsatisfied in strict mode if no docs with URL)
  send(
    toolsCall(3, "brainConsult", {
      query: "child_process spawn windows",
      includeInstructions: false,
      includeContext: false,
      maxDocs: 5,
      maxPitfalls: 0,
    }),
  );
  const consult = await waitFor(3);
  const consultText = consult?.result?.content?.[0]?.text || "";

  // 3) brainSearch AFTER consult
  send(toolsCall(4, "brainSearch", { query: "child_process" }));
  const after = await waitFor(4);
  const afterText = after?.result?.content?.[0]?.text || "";
  const allowedAfter = !after?.result?.isError;

  // 4) If strict mode: add one doc with URL, then re-consult and re-try brainSearch
  let strictRecovered = null;
  if (strictMode) {
    send(
      toolsCall(5, "brainSave", {
        library: "nodejs",
        topic: "child-process",
        title: "Node.js child_process docs",
        content: "Official Node.js docs for child_process spawn on Windows.",
        url: "https://nodejs.org/api/child_process.html",
        category: "documentation",
      }),
    );
    await waitFor(5);

    send(
      toolsCall(6, "brainConsult", {
        query: "child_process",
        includeInstructions: false,
        includeContext: false,
        maxDocs: 5,
        maxPitfalls: 0,
      }),
    );
    await waitFor(6);

    send(toolsCall(7, "brainSearch", { query: "child_process" }));
    const recovered = await waitFor(7);
    strictRecovered = !recovered?.result?.isError;
  }

  try {
    child.kill();
  } catch {}
  await done.catch(() => {});

  return {
    strictMode,
    dbPath,
    blockedBefore,
    allowedAfter,
    strictRecovered,
    preview: {
      before: safeSnippet(beforeText),
      consult: safeSnippet(consultText),
      after: safeSnippet(afterText),
      stderr: safeSnippet(buf),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);

  // Use temp DB by default to avoid touching real Brain data
  const dbPath =
    args.db ||
    path.join(os.tmpdir(), "whytcard-brain-policy-test", "brain.db");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  console.log("🧪 WhytCard Brain MCP policy tests");
  console.log(`DB: ${dbPath}\n`);

  const nonStrict = await runScenario({ strictMode: false, dbPath });
  console.log("=== Scenario A: require consult (strict=0) ===");
  console.log(`blocked_before_consult: ${nonStrict.blockedBefore}`);
  console.log(`allowed_after_consult: ${nonStrict.allowedAfter}\n`);

  const strict = await runScenario({ strictMode: true, dbPath });
  console.log("=== Scenario B: strict mode (require URL) ===");
  console.log(`blocked_before_consult: ${strict.blockedBefore}`);
  console.log(`allowed_after_consult: ${strict.allowedAfter}`);
  console.log(`recovered_after_brainSave: ${strict.strictRecovered}\n`);

  if (!nonStrict.blockedBefore || !nonStrict.allowedAfter) {
    console.error("❌ Scenario A failed.");
    process.exit(1);
  }
  if (!strict.blockedBefore || strict.strictRecovered !== true) {
    console.error("❌ Scenario B failed.");
    process.exit(1);
  }

  console.log("✅ Policy enforcement looks correct.");
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});


