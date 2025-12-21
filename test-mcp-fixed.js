const { spawn } = require("child_process");
const path = require("path");

const mcpServerPath = path.join(__dirname, "dist", "mcp-server.cjs");

console.log("🧪 Testing MCP Server Integration...\n");

const server = spawn("node", [mcpServerPath], {
  env: {
    ...process.env,
    BRAIN_DB_PATH:
      "C:/Users/jerome/AppData/Roaming/Windsurf - Next/User/globalStorage/whytcard.whytcard-brain/brain.db",
    BRAIN_STRICT_MODE: "0",
    BRAIN_REQUIRE_CONSULT: "0",
  },
});

let buffer = "";
let testsPassed = 0;
const totalTests = 3;

function parseMessages(data) {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();

  lines.forEach((line) => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        handleMessage(msg);
      } catch (e) {
        // Ignore parse errors
      }
    }
  });
}

function handleMessage(msg) {
  console.log("📥 Received:", JSON.stringify(msg, null, 2).substring(0, 300));

  if (msg.id === 1 && msg.result) {
    console.log("\n✅ TEST 1/3: Server initialized successfully!");
    testsPassed++;

    // Request tools list
    console.log("\n📤 Requesting tools list...");
    sendRequest(2, "tools/list", {});
  }

  if (msg.id === 2 && msg.result?.tools) {
    console.log("\n✅ TEST 2/3: Tools list received!");
    const toolNames = msg.result.tools.map((t) => t.name);
    console.log("Available tools:", toolNames.join(", "));

    const expectedTools = [
      "brainConsult",
      "brainSave",
      "brainSearch",
      "brainBug",
      "brainSession",
      "brainValidate",
    ];
    const hasAllTools = expectedTools.every((t) => toolNames.includes(t));

    if (hasAllTools) {
      console.log("✅ All expected tools present!");
      testsPassed++;

      // Test brainConsult
      console.log("\n📤 Testing brainConsult...");
      sendRequest(3, "tools/call", {
        name: "brainConsult",
        arguments: {
          query: "test query",
          includeInstructions: false,
          includeContext: false,
          maxDocs: 2,
        },
      });
    } else {
      console.error("❌ Missing expected tools!");
      cleanup(1);
    }
  }

  if (msg.id === 3) {
    if (msg.result?.content) {
      console.log("\n✅ TEST 3/3: brainConsult executed successfully!");
      testsPassed++;

      const content = msg.result.content[0]?.text || "";
      console.log("Response preview:", content.substring(0, 150) + "...");

      // All tests passed
      console.log(`\n${"=".repeat(50)}`);
      console.log(`✅ ALL TESTS PASSED (${testsPassed}/${totalTests})`);
      console.log(`${"=".repeat(50)}\n`);
      cleanup(0);
    } else if (msg.error) {
      console.error("\n❌ TEST 3/3 FAILED:", msg.error.message);
      cleanup(1);
    }
  }
}

function sendRequest(id, method, params) {
  const request = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
  server.stdin.write(JSON.stringify(request) + "\n");
}

function cleanup(exitCode) {
  server.kill();
  setTimeout(() => process.exit(exitCode), 200);
}

server.stdout.on("data", parseMessages);

server.stderr.on("data", (data) => {
  const str = data.toString();
  if (!str.includes("[BrainMCP]")) {
    console.error("❌ Error:", str);
  }
});

server.on("close", (code) => {
  if (testsPassed < totalTests) {
    console.log(`\n❌ Tests incomplete (${testsPassed}/${totalTests} passed)`);
    process.exit(1);
  }
});

// Send initialize
console.log("📤 Initializing server...\n");
sendRequest(1, "initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: {
    name: "test-client",
    version: "1.0.0",
  },
});

// Timeout
setTimeout(() => {
  console.error(
    `\n❌ Test timeout! Only ${testsPassed}/${totalTests} tests passed.`,
  );
  cleanup(1);
}, 15000);
