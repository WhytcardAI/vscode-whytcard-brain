/**
 * WhytCard Brain - Extension principale
 * Les outils sont appeles AUTOMATIQUEMENT par Copilot (pas de commande manuelle)
 */

import * as fs from "fs";
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
import {
  disposeBrainService,
  getBrainService,
  setStoragePath,
  type Doc,
} from "./services/brainService";
import { registerBrainTools } from "./tools/brainTools";
import {
  buildCopilotInstructionsContent,
  mergeBrainInstructionsBlock,
} from "./utils/copilotUtils";
import { BrainWebviewPanel } from "./views/webviewPanel";

let statusBarItem: vscode.StatusBarItem;
let dbWatcher: fs.FSWatcher | undefined;
let refreshInterval: NodeJS.Timeout | undefined;

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

  // DB dans le globalStorage de l'extension
  setStoragePath(context.globalStorageUri.fsPath);

  const service = getBrainService();

  // Document Provider for brain:// URIs
  const brainDocProvider = new BrainDocumentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "brain",
      brainDocProvider,
    ),
  );

  // ====== SIDEBAR VIEWS (4 categories) ======
  const instructionsProvider = new InstructionsTreeProvider();
  const documentationProvider = new DocumentationTreeProvider();
  const contextProvider = new ContextTreeProvider();
  const statsProvider = new StatsTreeProvider();

  const instructionsView = vscode.window.createTreeView(
    "whytcard-brain.instructions",
    {
      treeDataProvider: instructionsProvider,
      showCollapseAll: true,
    },
  );

  const documentationView = vscode.window.createTreeView(
    "whytcard-brain.documentation",
    {
      treeDataProvider: documentationProvider,
      showCollapseAll: true,
    },
  );

  const contextView = vscode.window.createTreeView("whytcard-brain.context", {
    treeDataProvider: contextProvider,
    showCollapseAll: true,
  });

  const statsView = vscode.window.createTreeView("whytcard-brain.stats", {
    treeDataProvider: statsProvider,
    showCollapseAll: false,
  });

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "whytcard-brain.search";
  updateStatusBar();
  statusBarItem.show();

  if (isCopilotAvailable()) {
    autoSetupCopilotInstructions().catch((e) => {
      console.warn(
        "WhytCard Brain: auto-setup Copilot instructions failed:",
        e,
      );
    });

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        autoSetupCopilotInstructions().catch((e) => {
          console.warn(
            "WhytCard Brain: auto-setup Copilot instructions failed:",
            e,
          );
        });
      }),
    );
  } else {
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
    vscode.window.showErrorMessage(
      errorMsg + " - Vérifiez la console développeur",
    );
    return;
  }

  console.log("Database connected successfully!");

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
    vscode.commands.registerCommand("whytcard-brain.refresh", () =>
      refreshAll(true),
    ),

    // Voir une entrée
    vscode.commands.registerCommand(
      "whytcard-brain.viewEntry",
      (item: BrainTreeItem) => {
        if (item.entryType && item.entryData) {
          BrainWebviewPanel.show(context.extensionUri, item.entryData);
        }
      },
    ),

    // Copier le contenu
    vscode.commands.registerCommand(
      "whytcard-brain.copyContent",
      async (item: BrainTreeItem) => {
        if (item.entryData) {
          const doc = item.entryData as Doc;
          await vscode.env.clipboard.writeText(doc.content);
          vscode.window.showInformationMessage("Copie dans le presse-papier");
        }
      },
    ),

    // Envoyer au Chat Copilot
    vscode.commands.registerCommand(
      "whytcard-brain.sendToChat",
      async (item: BrainTreeItem) => {
        if (!item.entryData) {
          return;
        }

        const doc = item.entryData as Doc;
        const title = doc.title;
        const content =
          `# ${doc.title}\n\n` +
          `**Librairie:** ${doc.library} | **Sujet:** ${doc.topic}\n\n` +
          doc.content;

        // Open chat with content as context
        try {
          // Use the chat API to send content
          await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: `Voici une information de ma base Brain à prendre en compte:\n\n${content}`,
          });
          vscode.window.showInformationMessage(`"${title}" envoyé au Chat`);
        } catch {
          // Fallback: copy to clipboard
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage(
            "Contenu copie - collez-le dans le chat",
          );
        }
      },
    ),

    // Modifier une entree
    vscode.commands.registerCommand(
      "whytcard-brain.editEntry",
      async (item: BrainTreeItem) => {
        if (!item.entryData || item.entryId === undefined) {
          return;
        }

        const doc = item.entryData as Doc;

        // Quick edit via input boxes
        const newTitle = await vscode.window.showInputBox({
          prompt: "Titre",
          value: doc.title,
        });
        if (newTitle === undefined) return;

        const newContent = await vscode.window.showInputBox({
          prompt: "Contenu (ou laissez vide pour garder)",
          value: doc.content.substring(0, 500),
        });
        if (newContent === undefined) return;

        // Delete old and add new
        service.deleteDoc(item.entryId);
        service.addDoc({
          ...doc,
          title: newTitle || doc.title,
          content: newContent || doc.content,
        });
        vscode.window.showInformationMessage("Documentation mise a jour");
        refreshAll();
      },
    ),

    // Supprimer
    vscode.commands.registerCommand(
      "whytcard-brain.deleteEntry",
      async (item: BrainTreeItem) => {
        if (item.entryId === undefined) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Supprimer cette entree ?`,
          { modal: true },
          "Supprimer",
        );
        if (confirm !== "Supprimer") {
          return;
        }

        const success = service.deleteDoc(item.entryId);

        if (success) {
          vscode.window.showInformationMessage("Supprime");
          refreshAll();
        }
      },
    ),

    // Ajouter une doc
    vscode.commands.registerCommand("whytcard-brain.addDoc", async () => {
      // First select category
      const categoryPick = await vscode.window.showQuickPick(
        [
          {
            label: "📋 Instructions",
            description: "Règles et conventions",
            value: "instruction",
          },
          {
            label: "📚 Documentation",
            description: "Docs techniques",
            value: "documentation",
          },
          {
            label: "🎯 Context",
            description: "Contexte projet",
            value: "project",
          },
          {
            label: "📁 Autre",
            description: "Autres ressources",
            value: "other",
          },
        ],
        { placeHolder: "Choisir une catégorie" },
      );
      if (!categoryPick) {
        return;
      }

      const library = await vscode.window.showInputBox({
        prompt: "Librairie (ex: nextjs, react, tailwind)",
        placeHolder: "nextjs",
      });
      if (!library) {
        return;
      }

      const topic = await vscode.window.showInputBox({
        prompt: "Sujet (ex: routing, hooks)",
        placeHolder: "routing",
      });
      if (!topic) {
        return;
      }

      const title = await vscode.window.showInputBox({
        prompt: "Titre",
        placeHolder: "App Router async params",
      });
      if (!title) {
        return;
      }

      const content = await vscode.window.showInputBox({
        prompt: "Contenu (ou coller depuis le clipboard)",
        placeHolder: "Documentation...",
      });
      if (!content) {
        return;
      }

      const id = service.addDoc({
        library,
        topic,
        title,
        content,
        category: categoryPick.value,
      });

      if (id) {
        vscode.window.showInformationMessage(
          `${categoryPick.label} ajoutée (ID: ${id})`,
        );
        refreshAll();
      }
    }),

    // Ajouter un bug
    vscode.commands.registerCommand("whytcard-brain.addPitfall", async () => {
      const symptom = await vscode.window.showInputBox({
        prompt: "Symptôme (qu'est-ce qui ne marche pas ?)",
        placeHolder: "Error: Cannot read property...",
      });
      if (!symptom) {
        return;
      }

      const solution = await vscode.window.showInputBox({
        prompt: "Solution (comment corriger)",
        placeHolder: "Ajouter await devant params...",
      });
      if (!solution) {
        return;
      }

      const library = await vscode.window.showInputBox({
        prompt: "Librairie concernée (optionnel)",
        placeHolder: "nextjs",
      });

      const id = service.addPitfall({
        symptom,
        solution,
        library: library || undefined,
      });

      if (id) {
        vscode.window.showInformationMessage(`Bug ajouté (ID: ${id})`);
        refreshAll();
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

    // Export
    vscode.commands.registerCommand("whytcard-brain.exportDb", async () => {
      const stats = service.getStats();
      const docs = service.getAllDocs();
      const pitfalls = service.getAllPitfalls();

      const exportData = {
        exportedAt: new Date().toISOString(),
        stats,
        docs,
        pitfalls,
      };

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file("brain-export.json"),
        filters: { JSON: ["json"] },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(JSON.stringify(exportData, null, 2), "utf8"),
        );
        vscode.window.showInformationMessage(`Exporte vers ${uri.fsPath}`);
      }
    }),

    // Installer les instructions Copilot (sans @brain) dans le workspace
    vscode.commands.registerCommand(
      "whytcard-brain.installCopilotInstructions",
      async () => {
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
      },
    ),
  );

  // Views
  context.subscriptions.push(
    instructionsView,
    documentationView,
    contextView,
    statsView,
    statusBarItem,
  );

  console.log(
    "WhytCard Brain active - Copilot utilise automatiquement les outils Brain",
  );
  console.log("DB:", service.getDbPath());
}

function autoIngestPromptInstructions(
  service: ReturnType<typeof getBrainService>,
  promptsDir: string,
): void {
  if (!fs.existsSync(promptsDir)) {
    return;
  }

  const files = fs
    .readdirSync(promptsDir)
    .filter((f) => f.endsWith(".instructions.md"));
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

async function pickWorkspaceFolder(): Promise<
  vscode.WorkspaceFolder | undefined
> {
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
      placeHolder:
        "Choisir le dossier du workspace où installer les instructions Copilot",
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

async function autoSetupCopilotInstructions(): Promise<void> {
  const autoInstall = vscode.workspace
    .getConfiguration()
    .get<boolean>("whytcard-brain.autoInstallCopilotInstructions", true);

  if (!autoInstall) {
    return;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  for (const folder of folders) {
    try {
      await ensureCopilotInstructionsForFolder(folder);
    } catch (e) {
      console.warn(
        "WhytCard Brain: failed auto-setup for folder",
        folder.uri.fsPath,
        e,
      );
    }
  }

  const autoEnable = vscode.workspace
    .getConfiguration()
    .get<boolean>("whytcard-brain.autoEnableCopilotInstructionFiles", true);

  if (!autoEnable) {
    return;
  }

  for (const folder of folders) {
    try {
      await tryEnableCopilotInstructionFiles(folder);
    } catch {}
  }
}

async function tryEnableCopilotInstructionFiles(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(
      "github.copilot.chat.codeGeneration",
      folder.uri,
    );
    const target =
      (vscode.workspace.workspaceFolders?.length ?? 0) > 1 ?
        vscode.ConfigurationTarget.WorkspaceFolder
      : vscode.ConfigurationTarget.Workspace;
    await config.update("useInstructionFiles", true, target);
  } catch {}
}

async function ensureCopilotInstructionsForFolder(
  folder: vscode.WorkspaceFolder,
): Promise<{
  updated: boolean;
  instructionsUri?: vscode.Uri;
}> {
  const githubDirUri = vscode.Uri.joinPath(folder.uri, ".github");
  const instructionsUri = vscode.Uri.joinPath(
    githubDirUri,
    "copilot-instructions.md",
  );

  await vscode.workspace.fs.createDirectory(githubDirUri);

  const exists = await uriExists(instructionsUri);
  const brainBlock = buildCopilotInstructionsContent();

  if (!exists) {
    await vscode.workspace.fs.writeFile(
      instructionsUri,
      Buffer.from(brainBlock, "utf8"),
    );
    return { updated: true, instructionsUri };
  }

  const current = await readTextFile(instructionsUri);
  const merged = mergeBrainInstructionsBlock(current, brainBlock);

  if (!merged.changed) {
    return { updated: false, instructionsUri };
  }

  await vscode.workspace.fs.writeFile(
    instructionsUri,
    Buffer.from(merged.content, "utf8"),
  );
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

  // Cleanup interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  disposeBrainService();
}
