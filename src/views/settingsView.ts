import * as vscode from "vscode";
import { z } from "zod";

type McpEnvironment = "auto" | "cursor" | "windsurf";
type UiLanguage = "auto" | "en" | "fr";
type DocsSort = "titleAsc" | "createdDesc" | "createdAsc";
type DocClickAction = "view" | "sendToChat";

type InstructionTargets = {
  agentsMd: boolean;
  copilotInstructions: boolean;
  cursorRules: boolean;
  windsurfRules: boolean;
};

type McpStatus = {
  environment: string;
  supported: boolean;
  configured: boolean;
  configPath: string | null;
  dbPath: string;
};

type SettingsState = {
  uiLanguage: UiLanguage;
  resolvedLanguage: "en" | "fr";
  autoInstallInstructionFiles: boolean;
  targets: InstructionTargets;
  autoEnableAgentsMdFile: boolean;
  autoEnableCopilotInstructionFiles: boolean;
  mcpEnvironment: McpEnvironment;
  mcpConfigPathOverride: string;
  mcpDbPathOverride: string;
  mcpStatus: McpStatus;
  docsSort: DocsSort;
  docClickAction: DocClickAction;
};

const instructionTargetsSchema = z
  .object({
    agentsMd: z.boolean(),
    copilotInstructions: z.boolean(),
    cursorRules: z.boolean(),
    windsurfRules: z.boolean(),
  })
  .strict();

const incomingMessageSchema = z.discriminatedUnion("command", [
  z
    .object({
      command: z.literal("save"),
      data: z
        .object({
          uiLanguage: z.enum(["auto", "en", "fr"]),
          autoInstallInstructionFiles: z.boolean(),
          instructionTargets: instructionTargetsSchema,
          autoEnableAgentsMdFile: z.boolean(),
          autoEnableCopilotInstructionFiles: z.boolean(),
          mcpEnvironment: z.enum(["auto", "cursor", "windsurf"]),
          mcpConfigPathOverride: z.string(),
          mcpDbPathOverride: z.string(),
          docsSort: z.enum(["titleAsc", "createdDesc", "createdAsc"]),
          docClickAction: z.enum(["view", "sendToChat"]),
          applyNow: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      command: z.literal("action"),
      data: z
        .object({
          action: z.enum(["applyInstructions", "setupMcp", "refresh"]),
        })
        .strict(),
    })
    .strict(),
]);

type IncomingMessage = z.infer<typeof incomingMessageSchema>;

export type BrainSettingsActions = {
  applyInstructionFiles: () => Promise<void>;
  setupMcp: () => Promise<{ success: boolean; message: string }>;
  getMcpStatus: () => Promise<McpStatus>;
};

export class BrainSettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "whytcard-brain.settings";

  private view: vscode.WebviewView | undefined;
  private readonly uiRootUri: vscode.Uri;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: BrainSettingsActions,
  ) {
    this.uiRootUri = vscode.Uri.joinPath(this.extensionUri, "media", "settings-ui");
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.uiRootUri],
    };

    webviewView.webview.onDidReceiveMessage((raw: unknown) => {
      void this.handleMessage(raw);
    });

    void this.refresh();
  }

  private async handleMessage(raw: unknown): Promise<void> {
    const parsed = incomingMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return;
    }

    const message: IncomingMessage = parsed.data;

    if (message.command === "save") {
      const cfg = vscode.workspace.getConfiguration("whytcard-brain");

      await cfg.update("language", message.data.uiLanguage, vscode.ConfigurationTarget.Workspace);
      await cfg.update(
        "autoInstallCopilotInstructions",
        message.data.autoInstallInstructionFiles,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "instructionTargets",
        message.data.instructionTargets,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "autoEnableAgentsMdFile",
        message.data.autoEnableAgentsMdFile,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "autoEnableCopilotInstructionFiles",
        message.data.autoEnableCopilotInstructionFiles,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "mcpEnvironment",
        message.data.mcpEnvironment,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "mcpConfigPathOverride",
        message.data.mcpConfigPathOverride.trim(),
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update(
        "mcpDbPathOverride",
        message.data.mcpDbPathOverride.trim(),
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update("docsSort", message.data.docsSort, vscode.ConfigurationTarget.Workspace);
      await cfg.update(
        "docClickAction",
        message.data.docClickAction,
        vscode.ConfigurationTarget.Workspace,
      );

      if (message.data.applyNow) {
        await this.actions.applyInstructionFiles();
      }

      vscode.window.showInformationMessage("WhytCard Brain settings saved.");
      await this.refresh();
      return;
    }

    if (message.command === "action") {
      if (message.data.action === "applyInstructions") {
        await this.actions.applyInstructionFiles();
        vscode.window.showInformationMessage("Instruction files synchronized.");
        await this.refresh();
        return;
      }

      if (message.data.action === "setupMcp") {
        const result = await this.actions.setupMcp();
        if (result.success) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
        await this.refresh();
        return;
      }

      if (message.data.action === "refresh") {
        await this.refresh();
      }
    }
  }

  private async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    const cfg = vscode.workspace.getConfiguration("whytcard-brain");

    const uiLanguage = cfg.get<UiLanguage>("language", "auto");
    const resolvedLanguage: Exclude<UiLanguage, "auto"> =
      uiLanguage === "en" || uiLanguage === "fr"
        ? uiLanguage
        : vscode.env.language.toLowerCase().startsWith("fr")
          ? "fr"
          : "en";

    const autoInstallInstructionFiles = cfg.get<boolean>("autoInstallCopilotInstructions", true);

    const targetsRaw = cfg.get<Partial<InstructionTargets>>("instructionTargets", {
      agentsMd: true,
      copilotInstructions: true,
      cursorRules: true,
      windsurfRules: true,
    });

    const targets: InstructionTargets = {
      agentsMd: targetsRaw.agentsMd ?? true,
      copilotInstructions: targetsRaw.copilotInstructions ?? true,
      cursorRules: targetsRaw.cursorRules ?? true,
      windsurfRules: targetsRaw.windsurfRules ?? true,
    };

    const autoEnableAgentsMdFile = cfg.get<boolean>("autoEnableAgentsMdFile", true);
    const autoEnableCopilotInstructionFiles = cfg.get<boolean>(
      "autoEnableCopilotInstructionFiles",
      true,
    );

    const mcpEnvironment = cfg.get<McpEnvironment>("mcpEnvironment", "auto");
    const mcpConfigPathOverride = cfg.get<string>("mcpConfigPathOverride", "");
    const mcpDbPathOverride = cfg.get<string>("mcpDbPathOverride", "");
    const docsSort = cfg.get<DocsSort>("docsSort", "titleAsc");
    const docClickAction = cfg.get<DocClickAction>("docClickAction", "view");

    const mcpStatus = await this.actions.getMcpStatus();

    const state: SettingsState = {
      uiLanguage,
      resolvedLanguage,
      autoInstallInstructionFiles,
      targets,
      autoEnableAgentsMdFile,
      autoEnableCopilotInstructionFiles,
      mcpEnvironment,
      mcpConfigPathOverride,
      mcpDbPathOverride,
      mcpStatus,
      docsSort,
      docClickAction,
    };

    this.view.webview.html = await this.renderReactWebview(this.view.webview, state);
  }

  private async renderReactWebview(webview: vscode.Webview, state: SettingsState): Promise<string> {
    const indexUri = vscode.Uri.joinPath(this.uiRootUri, "index.html");

    let html: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(indexUri);
      html = Buffer.from(bytes).toString("utf8");
    } catch {
      return this.getFallbackHtml(
        "Settings UI assets are missing. Run `npm install` then `npm run build` to generate media/settings-ui/.",
      );
    }

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
    ].join("; ");

    html = html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
    html = html.replace(
      /<head>/i,
      `<head>\n<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`,
    );

    const initialState = escapeHtmlAttribute(JSON.stringify(state));
    html = html.replace(
      /<div\s+id="root"\s*><\/div>/i,
      `<div id="root" data-initial-state="${initialState}"></div>`,
    );

    // Rewrite Vite asset URLs to webview-safe URIs
    html = html.replace(
      /(src|href)=("|')([^"']+)(\2)/g,
      (_match: string, attr: string, quote: string, value: string) => {
        const normalized = value.replace(/^\.\//, "").replace(/^\//, "");
        if (!normalized.startsWith("assets/")) {
          return `${attr}=${quote}${value}${quote}`;
        }

        const resourceUri = webview.asWebviewUri(vscode.Uri.joinPath(this.uiRootUri, normalized));
        return `${attr}=${quote}${resourceUri.toString()}${quote}`;
      },
    );

    return html;
  }

  private getFallbackHtml(message: string): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhytCard Brain Settings</title>
  </head>
  <body style="font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 12px;">
    <h3 style="margin: 0 0 8px;">Settings UI not built</h3>
    <div style="color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.5;">
      ${escapeHtml(message)}
    </div>
  </body>
</html>`;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(input: string): string {
  // attribute-context: also escape newlines
  return escapeHtml(input).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}
