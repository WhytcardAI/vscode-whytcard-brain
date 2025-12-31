import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  alwaysAllow?: string[];
  disabled?: boolean;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export class McpSetupService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Détecte l'environnement (VS Code, Windsurf, Cursor, etc.)
   */
  private detectEnvironment(): "vscode" | "windsurf" | "cursor" | "unknown" {
    const appName = vscode.env.appName.toLowerCase();

    if (appName.includes("windsurf")) {
      return "windsurf";
    } else if (appName.includes("cursor")) {
      return "cursor";
    } else if (appName.includes("code")) {
      return "vscode";
    }

    return "unknown";
  }

  private getSelectedMcpEnvironment(): "auto" | "windsurf" | "cursor" {
    const cfg = vscode.workspace.getConfiguration("whytcard-brain");
    const value = cfg.get<string>("mcpEnvironment", "auto");
    if (value === "cursor" || value === "windsurf" || value === "auto") {
      return value;
    }
    return "auto";
  }

  private resolveMcpEnvironment(): "vscode" | "windsurf" | "cursor" | "unknown" {
    const selected = this.getSelectedMcpEnvironment();
    if (selected === "cursor" || selected === "windsurf") {
      return selected;
    }
    return this.detectEnvironment();
  }

  /**
   * Retourne le chemin du fichier mcp_config.json selon l'environnement
   */
  private getMcpConfigPath(): string | null {
    const cfg = vscode.workspace.getConfiguration("whytcard-brain");
    const override = cfg.get<string>("mcpConfigPathOverride", "").trim();
    if (override) {
      const dir = path.dirname(override);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return override;
    }

    const env = this.resolveMcpEnvironment();
    const homeDir = os.homedir();

    switch (env) {
      case "windsurf": {
        // Windsurf Next ou stable
        const windsurfNextPath = path.join(homeDir, ".codeium", "windsurf-next", "mcp_config.json");
        const windsurfPath = path.join(homeDir, ".codeium", "windsurf", "mcp_config.json");
        const codeiumPath = path.join(homeDir, ".codeium", "mcp_config.json");

        if (fs.existsSync(codeiumPath)) {
          return codeiumPath;
        } else if (fs.existsSync(windsurfNextPath)) {
          return windsurfNextPath;
        } else if (fs.existsSync(windsurfPath)) {
          return windsurfPath;
        }

        // Créer le dossier si nécessaire
        const codeiumDir = path.dirname(codeiumPath);
        if (!fs.existsSync(codeiumDir)) {
          fs.mkdirSync(codeiumDir, { recursive: true });
        }
        return codeiumPath;
      }

      case "cursor": {
        // Cursor MCP config path can differ depending on versions/setups.
        // Prefer the existing file if present.
        const cursorMcpJson = path.join(homeDir, ".cursor", "mcp.json");
        const cursorMcpConfigJson = path.join(homeDir, ".cursor", "mcp_config.json");
        const cursorPath = fs.existsSync(cursorMcpJson)
          ? cursorMcpJson
          : fs.existsSync(cursorMcpConfigJson)
            ? cursorMcpConfigJson
            : cursorMcpJson; // default we create
        const cursorDir = path.dirname(cursorPath);
        if (!fs.existsSync(cursorDir)) {
          fs.mkdirSync(cursorDir, { recursive: true });
        }
        return cursorPath;
      }

      case "vscode":
        // VS Code n'a pas de support MCP natif pour l'instant
        return null;

      default:
        return null;
    }
  }

  /**
   * Retourne le chemin de la base de données selon l'environnement
   */
  private getDbPath(): string {
    const cfg = vscode.workspace.getConfiguration("whytcard-brain");
    const override = cfg.get<string>("mcpDbPathOverride", "").trim();
    if (override) {
      return override;
    }

    const env = this.resolveMcpEnvironment();
    const home = os.homedir();
    const platform = process.platform;

    const baseCandidates =
      env === "windsurf"
        ? ["Windsurf - Next", "Windsurf"]
        : env === "cursor"
          ? ["Cursor"]
          : ["Code"];

    const pickBaseDir = (root: string): string => {
      for (const name of baseCandidates) {
        const candidate = path.join(root, name);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      return path.join(root, baseCandidates[0]);
    };

    if (platform === "win32") {
      const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
      const baseDir = pickBaseDir(appData);
      return path.join(baseDir, "User", "globalStorage", "whytcard.whytcard-brain", "brain.db");
    }

    if (platform === "darwin") {
      const appSupport = path.join(home, "Library", "Application Support");
      const baseDir = pickBaseDir(appSupport);
      return path.join(baseDir, "User", "globalStorage", "whytcard.whytcard-brain", "brain.db");
    }

    const configDir = path.join(home, ".config");
    const baseDir = pickBaseDir(configDir);
    return path.join(baseDir, "User", "globalStorage", "whytcard.whytcard-brain", "brain.db");
  }

  /**
   * Vérifie si le MCP server est déjà configuré
   */
  async isMcpConfigured(): Promise<boolean> {
    const mcpConfigPath = this.getMcpConfigPath();
    if (!mcpConfigPath) {
      return false;
    }

    if (!fs.existsSync(mcpConfigPath)) {
      return false;
    }

    try {
      const configContent = fs.readFileSync(mcpConfigPath, "utf8");
      const config: McpConfig = JSON.parse(configContent);
      return config.mcpServers && "whytcard-brain" in config.mcpServers;
    } catch {
      return false;
    }
  }

  /**
   * Configure automatiquement le MCP server
   */
  async setupMcpServer(): Promise<{ success: boolean; message: string }> {
    const env = this.resolveMcpEnvironment();

    if (env === "vscode") {
      return {
        success: false,
        message:
          "VS Code does not support MCP natively. WhytCard Brain will work via Language Model Tools.",
      };
    }

    if (env === "unknown") {
      return {
        success: false,
        message: "Unknown environment. Cannot auto-configure MCP server.",
      };
    }

    const mcpConfigPath = this.getMcpConfigPath();
    if (!mcpConfigPath) {
      return {
        success: false,
        message: "Could not determine MCP config path.",
      };
    }

    try {
      // Lire ou créer la config
      let config: McpConfig;
      if (fs.existsSync(mcpConfigPath)) {
        const configContent = fs.readFileSync(mcpConfigPath, "utf8");
        config = JSON.parse(configContent);
      } else {
        config = { mcpServers: {} };
      }

      // Chemin vers le serveur MCP
      const mcpServerPath = path.join(this.context.extensionPath, "dist", "mcp-server.cjs");

      // Vérifier que le serveur existe
      if (!fs.existsSync(mcpServerPath)) {
        return {
          success: false,
          message: `MCP server not found at ${mcpServerPath}. Please rebuild the extension.`,
        };
      }

      // Détecter le chemin de Node.js
      const nodePath = await this.getNodePath();
      if (!nodePath) {
        return {
          success: false,
          message: "Node.js not found. Please install Node.js and restart the editor.",
        };
      }

      // Ajouter la configuration WhytCard Brain
      config.mcpServers["whytcard-brain"] = {
        command: nodePath,
        args: [mcpServerPath],
        env: {
          BRAIN_DB_PATH: this.getDbPath(),
          BRAIN_REQUIRE_CONSULT: "1",
          BRAIN_CONSULT_TTL_MS: "1200000",
          BRAIN_STRICT_MODE: "1",
          BRAIN_STRICT_REQUIRE_SOURCES: "1",
        },
        alwaysAllow: [
          "brainConsult",
          "brainSearch",
          "brainSave",
          "brainBug",
          "brainSession",
          "brainValidate",
          "brainTemplateSave",
          "brainTemplateSearch",
          "brainTemplateApply",
        ],
        disabled: false,
      };

      // Sauvegarder la configuration
      fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2), "utf8");

      return {
        success: true,
        message: `MCP server configured successfully for ${env}. Please restart ${env === "windsurf" ? "Windsurf" : "Cursor"} to apply changes.`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: `Failed to configure MCP server: ${errorMsg}`,
      };
    }
  }

  /**
   * Détecte le chemin de Node.js
   */
  private async getNodePath(): Promise<string | null> {
    // Essayer les chemins courants
    const commonPaths = [
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Program Files (x86)\\nodejs\\node.exe",
      "/usr/local/bin/node",
      "/usr/bin/node",
      path.join(os.homedir(), ".nvm", "versions", "node"),
    ];

    for (const nodePath of commonPaths) {
      if (fs.existsSync(nodePath)) {
        return nodePath;
      }
    }

    // Essayer via PATH
    try {
      const result =
        process.platform === "win32"
          ? execSync("where node", { encoding: "utf8" }).trim()
          : execSync("which node", { encoding: "utf8" }).trim();

      if (result) {
        return result.split("\n")[0]; // Prendre la première ligne
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Affiche une notification pour configurer le MCP
   */
  async promptMcpSetup(): Promise<void> {
    const env = this.resolveMcpEnvironment();

    if (env === "vscode") {
      // VS Code n'a pas besoin de MCP
      return;
    }

    const configured = await this.isMcpConfigured();
    if (configured) {
      return;
    }

    const action = await vscode.window.showInformationMessage(
      `WhytCard Brain can integrate with ${env === "windsurf" ? "Windsurf Cascade" : "Cursor"} via MCP for enhanced AI capabilities. Would you like to configure it now?`,
      "Configure Now",
      "Later",
      "Don't Show Again",
    );

    if (action === "Configure Now") {
      // UI-only: guide user to the Brain Settings view (no Command Palette flow)
      await vscode.commands.executeCommand("workbench.view.extension.whytcard-brain");
      vscode.window.showInformationMessage(
        "Open Brain → Settings and click 'Run MCP setup' to configure MCP.",
      );
    } else if (action === "Don't Show Again") {
      await this.context.globalState.update("mcpSetupDismissed", true);
    }
  }

  /**
   * Vérifie si la notification a été masquée
   */
  shouldShowMcpPrompt(): boolean {
    return !this.context.globalState.get<boolean>("mcpSetupDismissed", false);
  }

  /**
   * Obtient le statut de la configuration MCP
   */
  async getMcpStatus(): Promise<{
    environment: string;
    supported: boolean;
    configured: boolean;
    configPath: string | null;
    dbPath: string;
  }> {
    const env = this.resolveMcpEnvironment();
    const mcpConfigPath = this.getMcpConfigPath();
    const configured = await this.isMcpConfigured();

    return {
      environment: env,
      supported: env !== "vscode" && env !== "unknown",
      configured,
      configPath: mcpConfigPath,
      dbPath: this.getDbPath(),
    };
  }
}
