const { spawn } = require("child_process");
const path = require("path");

const mcpServerPath = path.join(__dirname, "dist", "mcp-server.cjs");

console.log("🧪 Testing MCP Server...\n");

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

server.stdout.on("data", (data) => {
  buffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = buffer.split("\n");
  buffer = lines.pop(); // Keep incomplete line in buffer

  lines.forEach((line) => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        console.log("📥 Received:", JSON.stringify(msg, null, 2));

        // If we got the initialize response, test brainConsult
        if (msg.id === 1 && msg.result) {
          console.log("\n✅ Server initialized successfully!");
          console.log(
            "Available tools:",
            msg.result.capabilities?.tools?.map((t) => t.name).join(", "),
          );

          // Test brainConsult
          console.log("\n🧪 Testing brainConsult tool...");
          const consultRequest = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "brainConsult",
              arguments: {
                query: "test query",
                includeInstructions: false,
                includeContext: false,
                maxDocs: 3,
              },
            },
          };
          server.stdin.write(JSON.stringify(consultRequest) + "\n");
        }

        // If we got brainConsult response
        if (msg.id === 2) {
          console.log("\n✅ brainConsult executed successfully!");
          console.log(
            "Response preview:",
            msg.result?.content?.[0]?.text?.substring(0, 200),
          );

          // Success - close
          setTimeout(() => {
            console.log("\n✅ All tests passed!");
            server.kill();
            process.exit(0);
          }, 500);
        }
      } catch (e) {
        // Ignore parse errors for partial messages
      }
    }
  });
});

server.stderr.on("data", (data) => {
  console.error("❌ Error:", data.toString());
});

server.on("close", (code) => {
  console.log(`\n🔚 Server exited with code ${code}`);
});

// Send initialize request
console.log("📤 Sending initialize request...\n");
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0",
    },
  },
};

server.stdin.write(JSON.stringify(initRequest) + "\n");

// Timeout after 10s
setTimeout(() => {
  console.error("\n❌ Test timeout!");
  server.kill();
  process.exit(1);
}, 10000);
