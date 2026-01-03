/**
 * WhytCard Brain - Extension principale
 * Les outils sont appeles AUTOMATIQUEMENT par Copilot (pas de commande manuelle)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { z } from "zod";
import { registerBrainChatParticipant } from "./chat/brainChatParticipant";
import { BrainDocumentProvider } from "./providers/brainDocumentProvider";
import {
  DocsDragAndDropController,
  TemplatesDragAndDropController,
} from "./providers/dragAndDropControllers";
import { TemplatesTreeProvider, TemplateTreeItem } from "./providers/templatesTreeProvider";
import {
  BrainTreeItem,
  ContextTreeProvider,
  DocumentationTreeProvider,
  InstructionsTreeProvider,
  StatsTreeProvider,
} from "./providers/treeProviders";
import {
  disposeBrainService,
  getBrainService,
  inferDomain,
  setStoragePath,
  type Doc,
} from "./services/brainService";
import { McpSetupService } from "./services/mcpSetupService";
import { registerBrainTools } from "./tools/brainTools";
import {
  buildCopilotInstructionsContent,
  buildCursorRulesContent,
  buildWindsurfRulesContent,
  getConfigFromSettings,
  mergeBrainInstructionsBlock,
  type BrainInstructionConfig,
} from "./utils/copilotUtils";
import { buildDeduplicateDocsPlan } from "./utils/deduplicateDocs";
import { BrainSettingsViewProvider } from "./views/settingsView";
import { BrainWebviewPanel } from "./views/webviewPanel";

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
    const agentsPattern = new vscode.RelativePattern(folder, "AGENTS.md");

    const watchers = [
      vscode.workspace.createFileSystemWatcher(windsurfPattern),
      vscode.workspace.createFileSystemWatcher(cursorPattern),
      vscode.workspace.createFileSystemWatcher(copilotPattern),
      vscode.workspace.createFileSystemWatcher(agentsPattern),
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

  // If user configured an explicit MCP config path, use it first.
  try {
    const override = vscode.workspace
      .getConfiguration("whytcard-brain")
      .get<string>("mcpConfigPathOverride", "")
      .trim();
    if (override) {
      const config = tryReadJsonFile<Record<string, unknown>>(override);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const servers = (config as any)?.mcpServers;
      const dbPath =
        servers?.["whytcard-brain"]?.env?.BRAIN_DB_PATH ??
        servers?.whytcardBrain?.env?.BRAIN_DB_PATH;
      if (typeof dbPath === "string" && dbPath.trim().endsWith(".db")) {
        return dbPath.trim();
      }
    }
  } catch {
    // ignore
  }

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

  // ====== MCP SETUP SERVICE ======
  // Available for Settings UI even before DB connection.
  mcpSetupService = new McpSetupService(context);

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

  const instructionsDnD = new DocsDragAndDropController({
    category: "instruction",
    refresh: () => refreshAll(true),
  });

  const documentationDnD = new DocsDragAndDropController({
    category: "documentation",
    refresh: () => refreshAll(true),
  });

  const contextDnD = new DocsDragAndDropController({
    category: "project",
    refresh: () => refreshAll(true),
  });

  const templatesDnD = new TemplatesDragAndDropController({
    refresh: () => refreshAll(true),
  });

  const instructionsView = vscode.window.createTreeView("whytcard-brain.instructions", {
    treeDataProvider: instructionsProvider,
    showCollapseAll: true,
    dragAndDropController: instructionsDnD,
  });

  const documentationView = vscode.window.createTreeView("whytcard-brain.documentation", {
    treeDataProvider: documentationProvider,
    showCollapseAll: true,
    dragAndDropController: documentationDnD,
  });

  const contextView = vscode.window.createTreeView("whytcard-brain.context", {
    treeDataProvider: contextProvider,
    showCollapseAll: true,
    dragAndDropController: contextDnD,
  });

  const templatesView = vscode.window.createTreeView("whytcard-brain.templates", {
    treeDataProvider: templatesProvider,
    showCollapseAll: true,
    dragAndDropController: templatesDnD,
  });

  const statsView = vscode.window.createTreeView("whytcard-brain.stats", {
    treeDataProvider: statsProvider,
    showCollapseAll: false,
  });

  // ====== SETTINGS (SIDEBAR UI) ======
  const settingsViewProvider = new BrainSettingsViewProvider(context.extensionUri, {
    applyInstructionFiles: async () => {
      await autoSetupAllEditorInstructions();
    },
    setupMcp: async () => {
      return mcpSetupService.setupMcpServer();
    },
    getMcpStatus: async () => {
      return mcpSetupService.getMcpStatus();
    },
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BrainSettingsViewProvider.viewType,
      settingsViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

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

    // Sort docs (sidebar views)
    vscode.commands.registerCommand("whytcard-brain.setDocsSort", async () => {
      const config = vscode.workspace.getConfiguration("whytcard-brain");
      const current = config.get<string>("docsSort", "titleAsc");

      const picked = await vscode.window.showQuickPick(
        [
          {
            label: "Title (A → Z)",
            description: "titleAsc",
            value: "titleAsc" as const,
          },
          {
            label: "Created (new → old)",
            description: "createdDesc",
            value: "createdDesc" as const,
          },
          {
            label: "Created (old → new)",
            description: "createdAsc",
            value: "createdAsc" as const,
          },
        ],
        {
          placeHolder: `Current: ${current}`,
        },
      );

      if (!picked) {
        return;
      }

      const target =
        (vscode.workspace.workspaceFolders?.length ?? 0) > 0
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;

      await config.update("docsSort", picked.value, target);
      refreshAll(false);
    }),

    // What happens when clicking a doc in the sidebar
    vscode.commands.registerCommand("whytcard-brain.setDocClickAction", async () => {
      const config = vscode.workspace.getConfiguration("whytcard-brain");
      const current = config.get<string>("docClickAction", "view");

      const picked = await vscode.window.showQuickPick(
        [
          { label: "View entry", description: "view", value: "view" as const },
          { label: "Send to chat", description: "sendToChat", value: "sendToChat" as const },
        ],
        {
          placeHolder: `Current: ${current}`,
        },
      );

      if (!picked) {
        return;
      }

      const target =
        (vscode.workspace.workspaceFolders?.length ?? 0) > 0
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;
      await config.update("docClickAction", picked.value, target);
      refreshAll(false);
    }),

    // Send a doc to chat (best effort)
    vscode.commands.registerCommand(
      "whytcard-brain.sendEntryToChat",
      async (item: BrainTreeItem) => {
        if (!item?.entryId) {
          vscode.window.showErrorMessage("Aucune entrée sélectionnée.");
          return;
        }

        const service = getBrainService();
        const doc = item.entryData ?? service.getDocById(item.entryId);
        if (!doc) {
          vscode.window.showErrorMessage("Document introuvable dans la base.");
          return;
        }

        const payload =
          `# Brain Doc: ${doc.title}\n\n` +
          `Library: ${doc.library}\n` +
          `Topic: ${doc.topic}\n` +
          (doc.category ? `Category: ${doc.category}\n` : "") +
          (doc.domain ? `Domain: ${doc.domain}\n` : "") +
          (doc.url ? `Source: ${doc.url}\n` : "") +
          `\n---\n\n` +
          `${doc.content}`;

        await vscode.env.clipboard.writeText(payload);

        // Best-effort open chat UI. No stable API exists across all hosts to auto-submit.
        const tryOpen = async (commandId: string): Promise<boolean> => {
          try {
            await vscode.commands.executeCommand(commandId);
            return true;
          } catch {
            return false;
          }
        };

        const opened =
          (await tryOpen("workbench.action.chat.open")) ||
          (await tryOpen("vscode.editorChat.start"));

        if (opened) {
          vscode.window.showInformationMessage(
            "Contenu copié. Colle-le dans le chat pour l'envoyer.",
          );
        } else {
          vscode.window.showInformationMessage(
            "Contenu copié dans le presse-papier. Ouvre Copilot Chat et colle pour l'envoyer.",
          );
        }
      },
    ),

    // Rename a doc entry (title)
    vscode.commands.registerCommand("whytcard-brain.renameEntry", async (item: BrainTreeItem) => {
      // Bulk rename on group nodes
      if (item?.contextValue === "topic") {
        if (!item.libraryName || !item.topicName) {
          vscode.window.showErrorMessage("Topic invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;

        const nextTopic = await vscode.window.showInputBox({
          prompt: "Nouveau nom de topic",
          value: item.topicName,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Topic requis").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });

        if (nextTopic === undefined) {
          return;
        }

        const parsed = z.string().trim().min(1).safeParse(nextTopic);
        if (!parsed.success) {
          vscode.window.showErrorMessage("Topic invalide.");
          return;
        }

        const docs = service
          .getAllDocs()
          .filter(
            (d) =>
              (d.category || "documentation") === category &&
              d.library === item.libraryName &&
              d.topic === item.topicName,
          );

        let updated = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }
          const ok = service.updateDoc(d.id, { topic: parsed.data });
          if (ok) updated += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(`Renommage topic: ${updated} ok, ${failed} échec(s).`);
        } else {
          vscode.window.showInformationMessage(`Topic renommé (${updated} doc(s)).`);
        }
        return;
      }

      if (item?.contextValue === "library") {
        if (!item.libraryName) {
          vscode.window.showErrorMessage("Library invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;

        const nextLibrary = await vscode.window.showInputBox({
          prompt: "Nouveau nom de library",
          value: item.libraryName,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Library requise").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });

        if (nextLibrary === undefined) {
          return;
        }

        const parsed = z.string().trim().min(1).safeParse(nextLibrary);
        if (!parsed.success) {
          vscode.window.showErrorMessage("Library invalide.");
          return;
        }

        const docs = service
          .getAllDocs()
          .filter(
            (d) => (d.category || "documentation") === category && d.library === item.libraryName,
          );

        let updated = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }

          // Preserve where it appears in the tree by freezing the current effective domain
          // when domain is not explicitly set.
          const currentEffectiveDomain = inferDomain(d.library);
          const shouldFreezeDomain = !d.domain || d.domain === "general";

          const ok = service.updateDoc(d.id, {
            library: parsed.data,
            domain: shouldFreezeDomain ? currentEffectiveDomain : d.domain,
          });

          if (ok) updated += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(`Renommage library: ${updated} ok, ${failed} échec(s).`);
        } else {
          vscode.window.showInformationMessage(`Library renommée (${updated} doc(s)).`);
        }
        return;
      }

      if (!item?.entryId) {
        vscode.window.showErrorMessage("Aucune entrée sélectionnée.");
        return;
      }

      const service = getBrainService();
      const doc = item.entryData ?? service.getDocById(item.entryId);
      if (!doc) {
        vscode.window.showErrorMessage("Document introuvable dans la base.");
        return;
      }

      const nextTitle = await vscode.window.showInputBox({
        prompt: "Nouveau titre",
        value: doc.title,
        validateInput: (value) => {
          const res = z.string().trim().min(1, "Titre requis").safeParse(value);
          return res.success ? undefined : res.error.issues[0]?.message;
        },
      });

      if (nextTitle === undefined) {
        return;
      }

      const parsed = z.string().trim().min(1).safeParse(nextTitle);
      if (!parsed.success) {
        vscode.window.showErrorMessage("Titre invalide.");
        return;
      }

      const ok = service.updateDoc(item.entryId, { title: parsed.data });
      if (!ok) {
        vscode.window.showErrorMessage("Échec du renommage.");
        return;
      }

      refreshAll(true);
    }),

    // Move a doc entry (category/domain/library/topic)
    vscode.commands.registerCommand("whytcard-brain.moveEntry", async (item: BrainTreeItem) => {
      // Bulk move on group nodes
      if (item?.contextValue === "topic") {
        if (!item.libraryName || !item.topicName) {
          vscode.window.showErrorMessage("Topic invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;

        const nextLibrary = await vscode.window.showInputBox({
          prompt: "Library de destination",
          value: item.libraryName,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Library requise").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });
        if (nextLibrary === undefined) return;

        const nextTopic = await vscode.window.showInputBox({
          prompt: "Topic de destination",
          value: item.topicName,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Topic requis").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });
        if (nextTopic === undefined) return;

        const domainPick = await vscode.window.showQuickPick(
          [
            { label: "Auto (infer from library)", value: "__auto__" as const },
            { label: "website", value: "website" as const },
            { label: "mobile", value: "mobile" as const },
            { label: "backend", value: "backend" as const },
            { label: "devops", value: "devops" as const },
            { label: "general", value: "general" as const },
          ],
          { placeHolder: "Domain de destination" },
        );
        if (!domainPick) return;

        const libParsed = z.string().trim().min(1).safeParse(nextLibrary);
        const topicParsed = z.string().trim().min(1).safeParse(nextTopic);
        if (!libParsed.success || !topicParsed.success) {
          vscode.window.showErrorMessage("Library/Topic invalides.");
          return;
        }

        const nextDomain =
          domainPick.value === "__auto__" ? inferDomain(libParsed.data) : domainPick.value;

        const docs = service
          .getAllDocs()
          .filter(
            (d) =>
              (d.category || "documentation") === category &&
              d.library === item.libraryName &&
              d.topic === item.topicName,
          );

        let updated = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }
          const ok = service.updateDoc(d.id, {
            library: libParsed.data,
            topic: topicParsed.data,
            domain: nextDomain,
          });
          if (ok) updated += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(`Déplacement topic: ${updated} ok, ${failed} échec(s).`);
        } else {
          vscode.window.showInformationMessage(`Topic déplacé (${updated} doc(s)).`);
        }
        return;
      }

      if (item?.contextValue === "library") {
        if (!item.libraryName) {
          vscode.window.showErrorMessage("Library invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;

        const nextLibrary = await vscode.window.showInputBox({
          prompt: "Library de destination (renomme si différent)",
          value: item.libraryName,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Library requise").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });
        if (nextLibrary === undefined) return;

        const domainPick = await vscode.window.showQuickPick(
          [
            { label: "Auto (infer from library)", value: "__auto__" as const },
            { label: "website", value: "website" as const },
            { label: "mobile", value: "mobile" as const },
            { label: "backend", value: "backend" as const },
            { label: "devops", value: "devops" as const },
            { label: "general", value: "general" as const },
          ],
          { placeHolder: "Domain de destination" },
        );
        if (!domainPick) return;

        const libParsed = z.string().trim().min(1).safeParse(nextLibrary);
        if (!libParsed.success) {
          vscode.window.showErrorMessage("Library invalide.");
          return;
        }

        const nextDomain =
          domainPick.value === "__auto__" ? inferDomain(libParsed.data) : domainPick.value;

        const docs = service
          .getAllDocs()
          .filter(
            (d) => (d.category || "documentation") === category && d.library === item.libraryName,
          );

        let updated = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }
          const ok = service.updateDoc(d.id, {
            library: libParsed.data,
            domain: nextDomain,
          });
          if (ok) updated += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(
            `Déplacement library: ${updated} ok, ${failed} échec(s).`,
          );
        } else {
          vscode.window.showInformationMessage(`Library déplacée (${updated} doc(s)).`);
        }
        return;
      }

      if (!item?.entryId) {
        vscode.window.showErrorMessage("Aucune entrée sélectionnée.");
        return;
      }

      const service = getBrainService();
      const doc = item.entryData ?? service.getDocById(item.entryId);
      if (!doc) {
        vscode.window.showErrorMessage("Document introuvable dans la base.");
        return;
      }

      const categoryPick = await vscode.window.showQuickPick(
        [
          { label: "Instructions", value: "instruction" as const },
          { label: "Documentation", value: "documentation" as const },
          { label: "Context", value: "project" as const },
        ],
        { placeHolder: `Catégorie (actuel: ${doc.category || "documentation"})` },
      );

      if (!categoryPick) {
        return;
      }

      const nextLibrary = await vscode.window.showInputBox({
        prompt: "Library",
        value: doc.library,
        validateInput: (value) => {
          const res = z.string().trim().min(1, "Library requise").safeParse(value);
          return res.success ? undefined : res.error.issues[0]?.message;
        },
      });
      if (nextLibrary === undefined) return;

      const nextTopic = await vscode.window.showInputBox({
        prompt: "Topic",
        value: doc.topic,
        validateInput: (value) => {
          const res = z.string().trim().min(1, "Topic requis").safeParse(value);
          return res.success ? undefined : res.error.issues[0]?.message;
        },
      });
      if (nextTopic === undefined) return;

      const domainPick = await vscode.window.showQuickPick(
        [
          { label: "Auto (infer from library)", value: "__auto__" as const },
          { label: "website", value: "website" as const },
          { label: "mobile", value: "mobile" as const },
          { label: "backend", value: "backend" as const },
          { label: "devops", value: "devops" as const },
          { label: "general", value: "general" as const },
        ],
        { placeHolder: `Domain (actuel: ${doc.domain || inferDomain(doc.library)})` },
      );
      if (!domainPick) return;

      const libParsed = z.string().trim().min(1).safeParse(nextLibrary);
      const topicParsed = z.string().trim().min(1).safeParse(nextTopic);
      if (!libParsed.success || !topicParsed.success) {
        vscode.window.showErrorMessage("Library/Topic invalides.");
        return;
      }

      const nextDomain =
        domainPick.value === "__auto__" ? inferDomain(libParsed.data) : domainPick.value;

      const ok = service.updateDoc(item.entryId, {
        category: categoryPick.value,
        library: libParsed.data,
        topic: topicParsed.data,
        domain: nextDomain,
      });

      if (!ok) {
        vscode.window.showErrorMessage("Échec du déplacement.");
        return;
      }

      refreshAll(true);
    }),

    // Delete a doc entry
    vscode.commands.registerCommand("whytcard-brain.deleteEntry", async (item: BrainTreeItem) => {
      // Bulk delete on group nodes
      if (item?.contextValue === "topic") {
        if (!item.libraryName || !item.topicName) {
          vscode.window.showErrorMessage("Topic invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;
        const docs = service
          .getAllDocs()
          .filter(
            (d) =>
              (d.category || "documentation") === category &&
              d.library === item.libraryName &&
              d.topic === item.topicName,
          );

        const confirm = await vscode.window.showWarningMessage(
          `Supprimer définitivement ${docs.length} doc(s) du topic "${item.topicName}" ?`,
          { modal: true },
          "Delete",
          "Cancel",
        );
        if (confirm !== "Delete") {
          return;
        }

        let deleted = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }
          const ok = service.deleteDoc(d.id);
          if (ok) deleted += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(`Suppression topic: ${deleted} ok, ${failed} échec(s).`);
        } else {
          vscode.window.showInformationMessage(`Topic supprimé (${deleted} doc(s)).`);
        }
        return;
      }

      if (item?.contextValue === "library") {
        if (!item.libraryName) {
          vscode.window.showErrorMessage("Library invalide.");
          return;
        }

        const service = getBrainService();
        const category = (item.docCategory || "documentation") as string;
        const docs = service
          .getAllDocs()
          .filter(
            (d) => (d.category || "documentation") === category && d.library === item.libraryName,
          );

        const confirm = await vscode.window.showWarningMessage(
          `Supprimer définitivement ${docs.length} doc(s) de la library "${item.libraryName}" ?`,
          { modal: true },
          "Delete",
          "Cancel",
        );
        if (confirm !== "Delete") {
          return;
        }

        let deleted = 0;
        let failed = 0;
        for (const d of docs) {
          if (typeof d.id !== "number") {
            failed += 1;
            continue;
          }
          const ok = service.deleteDoc(d.id);
          if (ok) deleted += 1;
          else failed += 1;
        }

        refreshAll(true);
        if (failed > 0) {
          vscode.window.showWarningMessage(
            `Suppression library: ${deleted} ok, ${failed} échec(s).`,
          );
        } else {
          vscode.window.showInformationMessage(`Library supprimée (${deleted} doc(s)).`);
        }
        return;
      }

      if (!item?.entryId) {
        vscode.window.showErrorMessage("Aucune entrée sélectionnée.");
        return;
      }

      const service = getBrainService();
      const doc = item.entryData ?? service.getDocById(item.entryId);
      const title = doc?.title || item.label;

      const confirm = await vscode.window.showWarningMessage(
        `Supprimer définitivement: "${title}" ?`,
        { modal: true },
        "Delete",
        "Cancel",
      );

      if (confirm !== "Delete") {
        return;
      }

      const ok = service.deleteDoc(item.entryId);
      if (!ok) {
        vscode.window.showErrorMessage("Échec de la suppression.");
        return;
      }

      refreshAll(true);
    }),

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

    // View Template
    vscode.commands.registerCommand("whytcard-brain.viewTemplate", (item: TemplateTreeItem) => {
      if (item.templateData) {
        BrainWebviewPanel.showTemplate(context.extensionUri, item.templateData);
      }
    }),

    // Rename Template
    vscode.commands.registerCommand(
      "whytcard-brain.renameTemplate",
      async (item: TemplateTreeItem) => {
        if (!item?.templateId) {
          vscode.window.showErrorMessage("Aucun template sélectionné.");
          return;
        }

        const service = getBrainService();
        const template = item.templateData ?? service.getTemplateById(item.templateId);
        if (!template) {
          vscode.window.showErrorMessage("Template introuvable.");
          return;
        }

        const nextName = await vscode.window.showInputBox({
          prompt: "Nouveau nom du template",
          value: template.name,
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Nom requis").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });

        if (nextName === undefined) return;

        const parsed = z.string().trim().min(1).safeParse(nextName);
        if (!parsed.success) {
          vscode.window.showErrorMessage("Nom invalide.");
          return;
        }

        const ok = service.updateTemplate(item.templateId, { name: parsed.data });
        if (!ok) {
          vscode.window.showErrorMessage("Échec du renommage (nom déjà pris ?).");
          return;
        }

        refreshAll(true);
      },
    ),

    // Move Template (framework/type)
    vscode.commands.registerCommand(
      "whytcard-brain.moveTemplate",
      async (item: TemplateTreeItem) => {
        if (!item?.templateId) {
          vscode.window.showErrorMessage("Aucun template sélectionné.");
          return;
        }

        const service = getBrainService();
        const template = item.templateData ?? service.getTemplateById(item.templateId);
        if (!template) {
          vscode.window.showErrorMessage("Template introuvable.");
          return;
        }

        const nextFramework = await vscode.window.showInputBox({
          prompt: "Framework",
          value: template.framework || "general",
          validateInput: (value) => {
            const res = z.string().trim().min(1, "Framework requis").safeParse(value);
            return res.success ? undefined : res.error.issues[0]?.message;
          },
        });
        if (nextFramework === undefined) return;

        const nextType = await vscode.window.showQuickPick(
          [
            { label: "snippet", value: "snippet" as const },
            { label: "file", value: "file" as const },
            { label: "multifile", value: "multifile" as const },
          ],
          { placeHolder: `Type (actuel: ${template.type})` },
        );
        if (!nextType) return;

        const fwParsed = z.string().trim().min(1).safeParse(nextFramework);
        if (!fwParsed.success) {
          vscode.window.showErrorMessage("Framework invalide.");
          return;
        }

        const ok = service.updateTemplate(item.templateId, {
          framework: fwParsed.data,
          type: nextType.value,
        });
        if (!ok) {
          vscode.window.showErrorMessage("Échec du déplacement.");
          return;
        }

        refreshAll(true);
      },
    ),

    // Delete Template
    vscode.commands.registerCommand(
      "whytcard-brain.deleteTemplate",
      async (item: TemplateTreeItem) => {
        if (!item?.templateId) {
          vscode.window.showErrorMessage("Aucun template sélectionné.");
          return;
        }

        const service = getBrainService();
        const template = item.templateData ?? service.getTemplateById(item.templateId);
        const name = template?.name || item.label;

        const confirm = await vscode.window.showWarningMessage(
          `Supprimer définitivement le template: "${name}" ?`,
          { modal: true },
          "Delete",
          "Cancel",
        );
        if (confirm !== "Delete") {
          return;
        }

        const ok = service.deleteTemplate(item.templateId);
        if (!ok) {
          vscode.window.showErrorMessage("Échec de la suppression du template.");
          return;
        }

        refreshAll(true);
      },
    ),

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
        // Check Agents
        const agentsUri = vscode.Uri.joinPath(folder.uri, "AGENTS.md");
        if (await uriExists(agentsUri)) {
          rulesFound.push(`✅ VS Code Agents: ${folder.name}/AGENTS.md`);
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

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Auto-setup instructions for ALL editors (VS Code/Copilot, Cursor, Windsurf)
 */
async function autoSetupAllEditorInstructions(): Promise<void> {
  const config = vscode.workspace.getConfiguration("whytcard-brain");
  const autoInstallInstructionFiles = config.get<boolean>("autoInstallCopilotInstructions", true);
  const targets = config.get<{
    agentsMd?: boolean;
    copilotInstructions?: boolean;
    cursorRules?: boolean;
    windsurfRules?: boolean;
  }>("instructionTargets", {
    agentsMd: true,
    copilotInstructions: true,
    cursorRules: true,
    windsurfRules: true,
  });

  const resolvedTargets = {
    agentsMd: targets.agentsMd ?? true,
    copilotInstructions: targets.copilotInstructions ?? true,
    cursorRules: targets.cursorRules ?? true,
    windsurfRules: targets.windsurfRules ?? true,
  };

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  for (const folder of folders) {
    if (!autoInstallInstructionFiles) {
      continue;
    }

    // VS Code Agents (AGENTS.md)
    if (resolvedTargets.agentsMd) {
      try {
        await ensureAgentsMdForFolder(folder);
      } catch (err) {
        console.warn("WhytCard Brain: failed Agents setup for", folder.uri.fsPath, err);
      }
    }

    // VS Code / GitHub Copilot (.github/copilot-instructions.md)
    if (resolvedTargets.copilotInstructions && isCopilotAvailable()) {
      try {
        await ensureCopilotInstructionsForFolder(folder);
      } catch (err) {
        console.warn("WhytCard Brain: failed Copilot setup for", folder.uri.fsPath, err);
      }
    }

    // Cursor (.cursorrules)
    if (resolvedTargets.cursorRules) {
      try {
        await ensureCursorRulesForFolder(folder);
      } catch (err) {
        console.warn("WhytCard Brain: failed Cursor setup for", folder.uri.fsPath, err);
      }
    }

    // Windsurf (.windsurf/rules/brain.md)
    if (resolvedTargets.windsurfRules) {
      try {
        await ensureWindsurfRulesForFolder(folder);
      } catch (err) {
        console.warn("WhytCard Brain: failed Windsurf setup for", folder.uri.fsPath, err);
      }
    }
  }

  // Enable Copilot instruction files setting
  if (!autoInstallInstructionFiles) {
    return;
  }

  const autoEnableAgents = config.get<boolean>("autoEnableAgentsMdFile", true);
  if (resolvedTargets.agentsMd && autoEnableAgents) {
    for (const folder of folders) {
      try {
        await tryEnableAgentsMdFile(folder);
      } catch {
        // ignore
      }
    }
  }

  const autoEnableCopilot = config.get<boolean>("autoEnableCopilotInstructionFiles", true);
  if (resolvedTargets.copilotInstructions && autoEnableCopilot && isCopilotAvailable()) {
    for (const folder of folders) {
      try {
        await tryEnableCopilotInstructionFiles(folder);
      } catch {
        // Ignore config update errors for individual folders
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

async function tryEnableAgentsMdFile(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration("chat", folder.uri);
    const target =
      (vscode.workspace.workspaceFolders?.length ?? 0) > 1
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;
    await config.update("useAgentsMdFile", true, target);
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

async function ensureAgentsMdForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
  const agentsUri = vscode.Uri.joinPath(folder.uri, "AGENTS.md");
  const exists = await uriExists(agentsUri);
  const brainBlock = buildCopilotInstructionsContent(getBrainConfig());

  if (!exists) {
    await vscode.workspace.fs.writeFile(agentsUri, Buffer.from(brainBlock, "utf8"));
    console.log("WhytCard Brain: created AGENTS.md for", folder.name);
    return;
  }

  const current = await readTextFile(agentsUri);
  const merged = mergeBrainInstructionsBlock(current, brainBlock);

  if (merged.changed) {
    await vscode.workspace.fs.writeFile(agentsUri, Buffer.from(merged.content, "utf8"));
    console.log("WhytCard Brain: updated AGENTS.md for", folder.name);
  }
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
