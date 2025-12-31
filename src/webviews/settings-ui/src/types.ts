export type UiLanguage = "auto" | "en" | "fr";
export type McpEnvironment = "auto" | "cursor" | "windsurf";
export type DocsSort = "titleAsc" | "createdDesc" | "createdAsc";
export type DocClickAction = "view" | "sendToChat";

export type InstructionTargets = {
  agentsMd: boolean;
  copilotInstructions: boolean;
  cursorRules: boolean;
  windsurfRules: boolean;
};

export type McpStatus = {
  environment: string;
  supported: boolean;
  configured: boolean;
  configPath: string | null;
  dbPath: string;
};

export type SettingsState = {
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

export type SaveMessage = {
  command: "save";
  data: {
    uiLanguage: UiLanguage;
    autoInstallInstructionFiles: boolean;
    instructionTargets: InstructionTargets;
    autoEnableAgentsMdFile: boolean;
    autoEnableCopilotInstructionFiles: boolean;
    mcpEnvironment: McpEnvironment;
    mcpConfigPathOverride: string;
    mcpDbPathOverride: string;
    docsSort: DocsSort;
    docClickAction: DocClickAction;
    applyNow: boolean;
  };
};

export type ActionMessage = {
  command: "action";
  data: {
    action: "applyInstructions" | "setupMcp" | "refresh";
  };
};

export type OutgoingMessage = SaveMessage | ActionMessage;
