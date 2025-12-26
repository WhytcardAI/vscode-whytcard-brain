/**
 * WhytCard Brain - Extension principale
 * Les outils sont appeles AUTOMATIQUEMENT par Copilot (pas de commande manuelle)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { registerBrainChatParticipant } from "./chat/brainChatParticipant";
import { BrainDocumentProvider } from "./providers/brainDocumentProvider";
import {
  BrainTreeItem,
  ContextTreeProvider,
  DocumentationTreeProvider,
  InstructionsTreeProvider,
  StatsTreeProvider,
} from "./providers/treeProviders";
import { TemplatesTreeProvider, TemplateTreeItem } from "./providers/templatesTreeProvider";
import {
  disposeBrainService,
  getBrainService,
  setStoragePath,
  type Doc,
} from "./services/brainService";
import { registerBrainTools } from "./tools/brainTools";
import { buildDeduplicateDocsPlan } from "./utils/deduplicateDocs";
import {
  buildCopilotInstructionsContent,
  buildCursorRulesContent,
  buildWindsurfRulesContent,
  mergeBrainInstructionsBlock,
  getConfigFromSettings,
  type BrainInstructionConfig,
} from "./utils/copilotUtils";
import { BrainWebviewPanel } from "./views/webviewPanel";
import { McpSetupService } from "./services/mcpSetupService";

let statusBarItem: vscode.StatusBarItem;
let dbWatcher: fs.FSWatcher | undefined;
let refreshInterval: NodeJS.Timeout | undefined;
let mcpSetupService: McpSetupService;

let rulesWatchers: vscode.FileSystemWatcher[] = [];

let autoSetupRunning = false;
let autoSetupPending = false;
let autoSetupDebounceTimer: NodeJS.Timeout | undefined;

function disposeRulesWatchers(): void {
  for (const w of rulesWatchers) {
    try {
      w.dispose();
    } catch {
      // ignore
    }
  }
  rulesWatchers = [];
}

function scheduleAutoSetupAllEditorInstructions(): void {
  if (autoSetupDebounceTimer) {
    clearTimeout(autoSetupDebounceTimer);
  }

  autoSetupDebounceTimer = setTimeout(() => {
    runAutoSetupAllEditorInstructions();
  }, 300);
}

async function runAutoSetupAllEditorInstructions(): Promise<void> {
  if (autoSetupRunning) {
    autoSetupPending = true;
    return;
  }

  autoSetupRunning = true;
  try {
    await autoSetupAllEditorInstructions();
  } catch (e) {
    console.warn("WhytCard Brain: auto-setup editor instructions failed:", e);
  } finally {
    autoSetupRunning = false;
    if (autoSetupPending) {
      autoSetupPending = false;
      scheduleAutoSetupAllEditorInstructions();
    }
  }
}

function setupRulesWatchers(context: vscode.ExtensionContext): void {
  disposeRulesWatchers();

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  for (const folder of folders) {
    const windsurfPattern = new vscode.RelativePattern(folder, ".windsurf/rules/brain.md");
    const cursorPattern = new vscode.RelativePattern(folder, ".cursor/rules/brain.mdc");
    const copilotPattern = new vscode.RelativePattern(folder, ".github/copilot-instructions.md");

    const watchers = [
      vscode.workspace.createFileSystemWatcher(windsurfPattern),
      vscode.workspace.createFileSystemWatcher(cursorPattern),
      vscode.workspace.createFileSystemWatcher(copilotPattern),
    ];

    for (const watcher of watchers) {
      watcher.onDidCreate(() => scheduleAutoSetupAllEditorInstructions());
      watcher.onDidChange(() => scheduleAutoSetupAllEditorInstructions());
      watcher.onDidDelete(() => scheduleAutoSetupAllEditorInstructions());

      rulesWatchers.push(watcher);
      context.subscriptions.push(watcher);
    }
  }
}

function tryReadJsonFile<T = unknown>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveDbPathFromMcpConfig(): string | null {
  // Prefer reading the same DB path used by the MCP server so the UI reflects
  // what the agent writes via brainSave/brainBug/etc.
  const home = os.homedir();

  const candidates = [
    // Cursor (observed in the wild)
    path.join(home, ".cursor", "mcp.json"),
    path.join(home, ".cursor", "mcp_config.json"),
    // Windsurf
    path.join(home, ".codeium", "mcp_config.json"),
    path.join(home, ".codeium", "windsurf-next", "mcp_config.json"),
    path.join(home, ".codeium", "windsurf", "mcp_config.json"),
  ];

  for (const configPath of candidates) {
    const config = tryReadJsonFile<Record<string, unknown>>(configPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const servers = (config as any)?.mcpServers;
    const dbPath =
      servers?.["whytcard-brain"]?.env?.BRAIN_DB_PATH ?? servers?.whytcardBrain?.env?.BRAIN_DB_PATH;
    if (typeof dbPath === "string" && dbPath.trim().endsWith(".db")) {
      return dbPath.trim();
    }
  }

  return null;
}

function resolveStoragePath(context: vscode.ExtensionContext): string {
  const dbPath = resolveDbPathFromMcpConfig();
  if (dbPath) {
    return path.dirname(dbPath);
  }
  return context.globalStorageUri.fsPath;
}

function isCopilotAvailable(): boolean {
  return (
    vscode.extensions.getExtension("github.copilot") !== undefined ||
    vscode.extensions.getExtension("github.copilot-chat") !== undefined
  );
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("WhytCard Brain activating...");
  console.log("Extension path:", context.extensionPath);
  console.log("Global storage path:", context.globalStorageUri.fsPath);

  // DB storage path (prefer MCP DB when configured so UI matches agent writes)
  const storagePath = resolveStoragePath(context);
  setStoragePath(storagePath);
  console.log("Brain storage path:", storagePath);

  const service = getBrainService();

  // Document Provider for brain:// URIs
  const brainDocProvider = new BrainDocumentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("brain", brainDocProvider),
  );

  // ====== SIDEBAR VIEWS (5 categories) ======
  const instructionsProvider = new InstructionsTreeProvider();
  const documentationProvider = new DocumentationTreeProvider();
  const contextProvider = new ContextTreeProvider();
  const templatesProvider = new TemplatesTreeProvider();
  const statsProvider = new StatsTreeProvider();

  const instructionsView = vscode.window.createTreeView("whytcard-brain.instructions", {
    treeDataProvider: instructionsProvider,
    showCollapseAll: true,
  });

  const documentationView = vscode.window.createTreeView("whytcard-brain.documentation", {
    treeDataProvider: documentationProvider,
    showCollapseAll: true,
  });

  const contextView = vscode.window.createTreeView("whytcard-brain.context", {
    treeDataProvider: contextProvider,
    showCollapseAll: true,
  });

  const templatesView = vscode.window.createTreeView("whytcard-brain.templates", {
    treeDataProvider: templatesProvider,
    showCollapseAll: true,
  });

  const statsView = vscode.window.createTreeView("whytcard-brain.stats", {
    treeDataProvider: statsProvider,
    showCollapseAll: false,
  });

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "whytcard-brain.search";
  updateStatusBar();
  statusBarItem.show();

  // Auto-setup instructions for all editors
  scheduleAutoSetupAllEditorInstructions();

  // Auto-heal rules if they are edited/deleted
  setupRulesWatchers(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      setupRulesWatchers(context);
      scheduleAutoSetupAllEditorInstructions();
    }),

    vscode.commands.registerCommand("whytcard-brain.deduplicateDocs", async () => {
      const docs = service.getAllDocs();
      if (docs.length === 0) {
        vscode.window.showInformationMessage("Aucun document dans la base.");
        return;
      }

      const plan = buildDeduplicateDocsPlan(docs);
      if (plan.stats.candidateGroups === 0) {
        vscode.window.showInformationMessage("Aucun doublon detecte.");
        return;
      }

      const report = plan.report;
      const reportDoc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: report,
      });
      await vscode.window.showTextDocument(reportDoc, { preview: false });

      // Show report in modal (copyable) as well
      const selection = await vscode.window.showWarningMessage(
        `Groupes candidats: ${plan.stats.candidateGroups} - Suppression sure proposee: ${plan.stats.totalSafeDeletions} doc(s).`,
        { modal: true, detail: report },
        "Apply",
        "Cancel",
      );

      if (selection !== "Apply") {
        return;
      }

      let deleted = 0;
      for (const id of plan.deleteIds) {
        const ok = service.deleteDoc(id);
        if (ok) deleted += 1;
      }

      refreshAll(true);
      vscode.window.showInformationMessage(`Dedup termine: ${deleted} doc(s) supprimee(s).`);
    }),
  );

  if (!isCopilotAvailable()) {
    console.log(
      "WhytCard Brain: GitHub Copilot not detected, skipping auto-setup of Copilot instructions.",
    );
  }

  const refreshAll = (reloadDb = false) => {
    // Reload DB from disk to catch external changes (MCP tools, other windows)
    if (reloadDb) {
      service.reloadFromDisk();
    }
    instructionsProvider.refresh();
    documentationProvider.refresh();
    contextProvider.refresh();
    templatesProvider.refresh();
    statsProvider.refresh();
    updateStatusBar();
  };

  console.log("Attempting to connect to database...");
  // Connect is now async - MUST wait before registering tools
  const success = await service.connect();
  if (!success) {
    const errorMsg = "WhytCard Brain: Impossible de creer la base de donnees";
    console.error(errorMsg);
    console.error("Storage path was:", context.globalStorageUri.fsPath);
    vscode.window.showErrorMessage(errorMsg + " - Vérifiez la console développeur");
    return;
  }

  console.log("Database connected successfully!");

  // ====== MCP SETUP SERVICE ======
  // Initialize MCP setup service
  mcpSetupService = new McpSetupService(context);

  // Check and prompt for MCP configuration if needed
  setTimeout(() => {
    if (mcpSetupService.shouldShowMcpPrompt()) {
      mcpSetupService.promptMcpSetup().catch(console.error);
    }
  }, 3000); // Wait 3s after activation

  // ====== LANGUAGE MODEL TOOLS ======
  // Register tools AFTER DB is connected
  registerBrainTools(context);
  console.log("Brain LM tools registered after DB connection");

  // ====== CHAT PARTICIPANT (@brain) ======
  // Optional interactive participant (in addition to LM tools)
  context.subscriptions.push(registerBrainChatParticipant(context));

  // ====== AUTO-INGEST USER PROMPTS (instructions) ======
  // Keeps Brain in sync with VS Code user prompt instructions without running scripts.
  try {
    const userDir = path.dirname(path.dirname(context.globalStorageUri.fsPath));
    const promptsDir = path.join(userDir, "prompts");
    autoIngestPromptInstructions(service, promptsDir);
  } catch (e) {
    console.warn("WhytCard Brain: auto-ingest prompts failed:", e);
  }

  // Refresh UI once connected
  refreshAll();

  // ====== AUTO-REFRESH ======
  // Watch DB file for external changes (other VS Code windows)
  setupDbWatcher(service.getDbPath(), () => refreshAll(true));

  // Periodic refresh every 30 seconds as fallback (reload from disk)
  refreshInterval = setInterval(() => {
    refreshAll(true);
  }, 30000);

  // Commandes
  context.subscriptions.push(
    // Refresh (reload DB from disk)
    vscode.commands.registerCommand("whytcard-brain.refresh", () => refreshAll(true)),

    // Voir une entrée
    vscode.commands.registerCommand("whytcard-brain.viewEntry", (item: BrainTreeItem) => {
      if (item.entryType && item.entryData) {
        BrainWebviewPanel.show(context.extensionUri, item.entryData);
      }
    }),

    // Recherche
    vscode.commands.registerCommand("whytcard-brain.search", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Rechercher dans la base",
        placeHolder: "async params, routing, hooks...",
      });
      if (!query) {
        return;
      }

      const docs = service.searchDocs(query);

      if (docs.length === 0) {
        vscode.window.showInformationMessage("Aucun resultat");
        return;
      }

      interface DocItem extends vscode.QuickPickItem {
        doc: Doc;
      }

      const items: DocItem[] = docs.map(
        (d) =>
          ({
            label: d.title,
            description: `${d.library} - ${d.topic}`,
            detail: d.content.substring(0, 100) + "...",
            doc: d,
          }) as DocItem,
      );

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `${docs.length} document(s) trouve(s)`,
      });

      if (selected) {
        BrainWebviewPanel.show(context.extensionUri, selected.doc);
      }
    }),

    // Installer les instructions Copilot (sans @brain) dans le workspace
    vscode.commands.registerCommand("whytcard-brain.installCopilotInstructions", async () => {
      const folder = await pickWorkspaceFolder();
      if (!folder) {
        return;
      }

      const res = await ensureCopilotInstructionsForFolder(folder);
      await tryEnableCopilotInstructionFiles(folder);
      if (res.instructionsUri) {
        await openFile(res.instructionsUri);
      }

      if (res.updated) {
        vscode.window.showInformationMessage(
          "Copilot instructions mises à jour. Copilot Chat devrait consulter Brain automatiquement.",
        );
      } else {
        vscode.window.showInformationMessage(
          "Copilot instructions déjà présentes. Copilot Chat devrait consulter Brain automatiquement.",
        );
      }
    }),

    // Configure MCP Server
    vscode.commands.registerCommand("whytcard-brain.setupMcp", async () => {
      const result = await mcpSetupService.setupMcpServer();

      if (result.success) {
        vscode.window.showInformationMessage(result.message, "Restart Now").then((selection) => {
          if (selection === "Restart Now") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }),

    // Show MCP Status
    vscode.commands.registerCommand("whytcard-brain.mcpStatus", async () => {
      const status = await mcpSetupService.getMcpStatus();

      const message = [
        `Environment: ${status.environment}`,
        `MCP Supported: ${status.supported ? "Yes" : "No"}`,
        `Configured: ${status.configured ? "Yes" : "No"}`,
        status.configPath ? `Config: ${status.configPath}` : "",
        `Database: ${status.dbPath}`,
      ]
        .filter(Boolean)
        .join("\n");

      if (status.supported && !status.configured) {
        vscode.window.showInformationMessage(message, "Configure Now").then((selection) => {
          if (selection === "Configure Now") {
            vscode.commands.executeCommand("whytcard-brain.setupMcp");
          }
        });
      } else {
        vscode.window.showInformationMessage(message);
      }
    }),

    // View Template
    vscode.commands.registerCommand("whytcard-brain.viewTemplate", (item: TemplateTreeItem) => {
      if (item.templateData) {
        BrainWebviewPanel.showTemplate(context.extensionUri, item.templateData);
      }
    }),

    // Open Getting Started Walkthrough
    vscode.commands.registerCommand("whytcard-brain.openWalkthrough", () => {
      vscode.commands.executeCommand(
        "workbench.action.openWalkthrough",
        "whytcard.whytcard-brain#whytcard-brain.gettingStarted",
        false,
      );
    }),

    // Show Installed AI Rules
    vscode.commands.registerCommand("whytcard-brain.showInstalledRules", async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showInformationMessage("No workspace folder open.");
        return;
      }

      const rulesFound: string[] = [];
      for (const folder of folders) {
        // Check Copilot
        const copilotUri = vscode.Uri.joinPath(folder.uri, ".github", "copilot-instructions.md");
        if (await uriExists(copilotUri)) {
          rulesFound.push(`✅ VS Code/Copilot: ${folder.name}/.github/copilot-instructions.md`);
        }
        // Check Cursor (new format v0.45+)
        const cursorNewUri = vscode.Uri.joinPath(folder.uri, ".cursor", "rules", "brain.mdc");
        if (await uriExists(cursorNewUri)) {
          rulesFound.push(`✅ Cursor: ${folder.name}/.cursor/rules/brain.mdc`);
        } else {
          // Check legacy .cursorrules
          const cursorLegacyUri = vscode.Uri.joinPath(folder.uri, ".cursorrules");
          if (await uriExists(cursorLegacyUri)) {
            rulesFound.push(`⚠️ Cursor (legacy): ${folder.name}/.cursorrules`);
          }
        }
        // Check Windsurf
        const windsurfUri = vscode.Uri.joinPath(folder.uri, ".windsurf", "rules", "brain.md");
        if (await uriExists(windsurfUri)) {
          rulesFound.push(`✅ Windsurf: ${folder.name}/.windsurf/rules/brain.md`);
        }
      }

      if (rulesFound.length === 0) {
        vscode.window
          .showInformationMessage("No AI rules installed yet.", "Install Now")
          .then((selection) => {
            if (selection === "Install Now") {
              autoSetupAllEditorInstructions();
            }
          });
      } else {
        vscode.window
          .showInformationMessage(`Installed AI Rules:\n${rulesFound.join("\n")}`, "View Files")
          .then((selection) => {
            if (selection === "View Files") {
              // Open the first rules file found
              const folder = folders[0];
              const copilotUri = vscode.Uri.joinPath(
                folder.uri,
                ".github",
                "copilot-instructions.md",
              );
              uriExists(copilotUri).then((exists) => {
                if (exists) {
                  vscode.workspace.openTextDocument(copilotUri).then((doc) => {
                    vscode.window.showTextDocument(doc);
                  });
                }
              });
            }
          });
      }
    }),
  );

  // Views
  context.subscriptions.push(
    instructionsView,
    documentationView,
    contextView,
    templatesView,
    statsView,
    statusBarItem,
  );

  console.log("WhytCard Brain active - Copilot utilise automatiquement les outils Brain");
  console.log("DB:", service.getDbPath());

  // First-run welcome notification
  showWelcomeNotificationIfNeeded(context);
}

async function showWelcomeNotificationIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  const hasSeenWelcome = context.globalState.get<boolean>("whytcard-brain.hasSeenWelcome", false);
  if (hasSeenWelcome) {
    return;
  }

  // Mark as seen immediately to avoid showing twice
  await context.globalState.update("whytcard-brain.hasSeenWelcome", true);

  const selection = await vscode.window.showInformationMessage(
    "🧠 WhytCard Brain installed! Your AI assistant will now consult your local knowledge base automatically.",
    "Get Started",
    "View Rules",
    "Dismiss",
  );

  if (selection === "Get Started") {
    vscode.commands.executeCommand("whytcard-brain.openWalkthrough");
  } else if (selection === "View Rules") {
    vscode.commands.executeCommand("whytcard-brain.showInstalledRules");
  }
}

function autoIngestPromptInstructions(
  service: ReturnType<typeof getBrainService>,
  promptsDir: string,
): void {
  if (!fs.existsSync(promptsDir)) {
    return;
  }

  const files = fs.readdirSync(promptsDir).filter((f) => f.endsWith(".instructions.md"));
  if (files.length === 0) {
    return;
  }

  for (const file of files) {
    const filePath = path.join(promptsDir, file);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const { library, topic, title } = parseInstructionFilename(file);

      service.upsertDoc({
        library,
        topic,
        title,
        content,
        category: "instruction",
        source: "auto-ingest",
        url: vscode.Uri.file(filePath).toString(),
      });
    } catch (e) {
      console.warn("WhytCard Brain: failed to ingest", filePath, e);
    }
  }
}

function parseInstructionFilename(filename: string): {
  library: string;
  topic: string;
  title: string;
} {
  const base = filename.replace(".instructions.md", "");
  const parts = base.split(".").filter(Boolean);

  let library = "General";
  let topic = "Instructions";

  if (parts.length >= 2) {
    library = capitalize(parts[0]);
    topic = capitalize(parts[1]);
  } else if (parts.length === 1) {
    topic = capitalize(parts[0]);
  }

  return { library, topic, title: `${library} • ${topic}` };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function updateStatusBar() {
  const stats = getBrainService().getStats();
  statusBarItem.text = `$(brain) ${stats.docs} docs`;
  statusBarItem.tooltip = `WhytCard Brain\n${stats.docs} documents indexes\n\nCopilot utilise automatiquement les outils`;
}

function setupDbWatcher(dbPath: string, onChangeCallback: () => void): void {
  // Debounce to avoid multiple rapid refreshes
  let debounceTimer: NodeJS.Timeout | undefined;

  const debouncedRefresh = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      console.log("WhytCard Brain: DB file changed, refreshing views...");
      onChangeCallback();
    }, 500);
  };

  try {
    // Watch the DB directory (file watch on Windows can be unreliable)
    const dbDir = path.dirname(dbPath);
    const dbFileName = path.basename(dbPath);

    if (fs.existsSync(dbDir)) {
      dbWatcher = fs.watch(dbDir, (eventType, filename) => {
        if (filename === dbFileName) {
          debouncedRefresh();
        }
      });
      console.log("WhytCard Brain: DB watcher active on", dbDir);
    }
  } catch (error) {
    console.warn("WhytCard Brain: Could not setup DB watcher:", error);
  }
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage(
      "Aucun workspace ouvert. Ouvrez un dossier/projet pour installer .github/copilot-instructions.md",
    );
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const picked = await vscode.window.showQuickPick(
    folders.map((f) => ({
      label: f.name,
      description: f.uri.fsPath,
      folder: f,
    })),
    {
      placeHolder: "Choisir le dossier du workspace où installer les instructions Copilot",
    },
  );

  return picked?.folder;
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function openFile(uri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

/**
 * Auto-setup instructions for ALL editors (VS Code/Copilot, Cursor, Windsurf)
 */
async function autoSetupAllEditorInstructions(): Promise<void> {
  const autoInstallCopilot = vscode.workspace
    .getConfiguration()
    .get<boolean>("whytcard-brain.autoInstallCopilotInstructions", true);

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  for (const folder of folders) {
    // VS Code / GitHub Copilot (.github/copilot-instructions.md)
    if (autoInstallCopilot && isCopilotAvailable()) {
      try {
        await ensureCopilotInstructionsForFolder(folder);
      } catch (err) {
        console.warn("WhytCard Brain: failed Copilot setup for", folder.uri.fsPath, err);
      }
    }

    // Cursor (.cursorrules)
    try {
      await ensureCursorRulesForFolder(folder);
    } catch (err) {
      console.warn("WhytCard Brain: failed Cursor setup for", folder.uri.fsPath, err);
    }

    // Windsurf (.windsurf/rules/brain.md)
    try {
      await ensureWindsurfRulesForFolder(folder);
    } catch (err) {
      console.warn("WhytCard Brain: failed Windsurf setup for", folder.uri.fsPath, err);
    }
  }

  // Enable Copilot instruction files setting
  const autoEnable = vscode.workspace
    .getConfiguration()
    .get<boolean>("whytcard-brain.autoEnableCopilotInstructionFiles", true);

  if (autoInstallCopilot && autoEnable && isCopilotAvailable()) {
    for (const folder of folders) {
      try {
        await tryEnableCopilotInstructionFiles(folder);
      } catch {
        // Ignore errors for individual folders
      }
    }
  }
}

/**
 * Get Brain instruction config from VS Code settings
 */
function getBrainConfig(): BrainInstructionConfig {
  const config = vscode.workspace.getConfiguration("whytcard-brain");
  return getConfigFromSettings(config);
}

/**
 * Ensure .cursor/rules/brain.mdc file exists with Brain rules
 * Cursor v0.45+ uses .cursor/rules/*.mdc format (legacy .cursorrules is deprecated)
 */
async function ensureCursorRulesForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
  const cursorDir = vscode.Uri.joinPath(folder.uri, ".cursor", "rules");
  const brainRulesUri = vscode.Uri.joinPath(cursorDir, "brain.mdc");
  const brainContent = buildCursorRulesContent(getBrainConfig());

  // Check if new format exists
  const newFormatExists = await uriExists(brainRulesUri);

  if (newFormatExists) {
    const current = await readTextFile(brainRulesUri);
    const merged = mergeBrainInstructionsBlock(current, brainContent);
    if (merged.changed) {
      await vscode.workspace.fs.writeFile(brainRulesUri, Buffer.from(merged.content, "utf8"));
      console.log("WhytCard Brain: updated .cursor/rules/brain.mdc for", folder.name);
    }
    return;
  }

  // Create directory and file
  await vscode.workspace.fs.createDirectory(cursorDir);
  await vscode.workspace.fs.writeFile(brainRulesUri, Buffer.from(brainContent, "utf8"));
  console.log("WhytCard Brain: created .cursor/rules/brain.mdc for", folder.name);

  // Also check for legacy .cursorrules and notify user
  const legacyCursorRulesUri = vscode.Uri.joinPath(folder.uri, ".cursorrules");
  const legacyExists = await uriExists(legacyCursorRulesUri);
  if (legacyExists) {
    console.log(
      "WhytCard Brain: Note - legacy .cursorrules found. Consider migrating to .cursor/rules/",
    );
  }
}

/**
 * Ensure .windsurf/rules/brain.md file exists with Brain rules
 */
async function ensureWindsurfRulesForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
  const windsurfDir = vscode.Uri.joinPath(folder.uri, ".windsurf", "rules");
  const brainRulesUri = vscode.Uri.joinPath(windsurfDir, "brain.md");
  const exists = await uriExists(brainRulesUri);
  const brainConfig = getBrainConfig();

  if (exists) {
    // Check if needs update
    const current = await readTextFile(brainRulesUri);
    const brainContent = buildWindsurfRulesContent(brainConfig);
    const merged = mergeBrainInstructionsBlock(current, brainContent);
    if (merged.changed) {
      await vscode.workspace.fs.writeFile(brainRulesUri, Buffer.from(merged.content, "utf8"));
      console.log("WhytCard Brain: updated .windsurf/rules/brain.md for", folder.name);
    }
    return;
  }

  // Create directory and file
  await vscode.workspace.fs.createDirectory(windsurfDir);
  const brainContent = buildWindsurfRulesContent(brainConfig);
  await vscode.workspace.fs.writeFile(brainRulesUri, Buffer.from(brainContent, "utf8"));
  console.log("WhytCard Brain: created .windsurf/rules/brain.md for", folder.name);
}

async function tryEnableCopilotInstructionFiles(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(
      "github.copilot.chat.codeGeneration",
      folder.uri,
    );
    const target =
      (vscode.workspace.workspaceFolders?.length ?? 0) > 1
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;
    await config.update("useInstructionFiles", true, target);
  } catch {
    // Ignore config update errors
  }
}

async function ensureCopilotInstructionsForFolder(folder: vscode.WorkspaceFolder): Promise<{
  updated: boolean;
  instructionsUri?: vscode.Uri;
}> {
  const githubDirUri = vscode.Uri.joinPath(folder.uri, ".github");
  const instructionsUri = vscode.Uri.joinPath(githubDirUri, "copilot-instructions.md");

  await vscode.workspace.fs.createDirectory(githubDirUri);

  const exists = await uriExists(instructionsUri);
  const brainBlock = buildCopilotInstructionsContent(getBrainConfig());

  if (!exists) {
    await vscode.workspace.fs.writeFile(instructionsUri, Buffer.from(brainBlock, "utf8"));
    return { updated: true, instructionsUri };
  }

  const current = await readTextFile(instructionsUri);
  const merged = mergeBrainInstructionsBlock(current, brainBlock);

  if (!merged.changed) {
    return { updated: false, instructionsUri };
  }

  await vscode.workspace.fs.writeFile(instructionsUri, Buffer.from(merged.content, "utf8"));
  return { updated: true, instructionsUri };
}

async function readTextFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}

export function deactivate() {
  // Cleanup watcher
  if (dbWatcher) {
    dbWatcher.close();
    dbWatcher = undefined;
  }

  disposeRulesWatchers();

  // Cleanup interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  disposeBrainService();
}
