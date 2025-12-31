import React, { useMemo, useState } from "react";
import { translations } from "./i18n";
import type { DocClickAction, DocsSort, McpEnvironment, SettingsState, UiLanguage } from "./types";
import { postMessage } from "./vscodeApi";

type Page = "overview" | "instructions" | "mcp" | "advanced";

function getInitialPage(): Page {
  const hash = String(window.location.hash || "").replace("#", "");
  if (hash === "instructions" || hash === "mcp" || hash === "advanced" || hash === "overview") {
    return hash;
  }
  return "overview";
}

function setHash(page: Page): void {
  window.location.hash = `#${page}`;
}

export function App(props: { initialState: SettingsState }): React.JSX.Element {
  const [page, setPage] = useState<Page>(getInitialPage());
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(props.initialState.uiLanguage);

  const [autoInstallInstructionFiles, setAutoInstallInstructionFiles] = useState<boolean>(
    props.initialState.autoInstallInstructionFiles,
  );
  const [targets, setTargets] = useState(props.initialState.targets);
  const [autoEnableAgentsMdFile, setAutoEnableAgentsMdFile] = useState<boolean>(
    props.initialState.autoEnableAgentsMdFile,
  );
  const [autoEnableCopilotInstructionFiles, setAutoEnableCopilotInstructionFiles] =
    useState<boolean>(props.initialState.autoEnableCopilotInstructionFiles);

  const [mcpEnvironment, setMcpEnvironment] = useState<McpEnvironment>(
    props.initialState.mcpEnvironment,
  );
  const [mcpConfigPathOverride, setMcpConfigPathOverride] = useState<string>(
    props.initialState.mcpConfigPathOverride,
  );
  const [mcpDbPathOverride, setMcpDbPathOverride] = useState<string>(
    props.initialState.mcpDbPathOverride,
  );
  const [docsSort, setDocsSort] = useState<DocsSort>(props.initialState.docsSort);
  const [docClickAction, setDocClickAction] = useState<DocClickAction>(
    props.initialState.docClickAction,
  );

  const t = useMemo(() => {
    const resolved = props.initialState.resolvedLanguage;
    if (uiLanguage === "en" || uiLanguage === "fr") {
      return translations[uiLanguage];
    }
    return translations[resolved];
  }, [uiLanguage, props.initialState.resolvedLanguage]);

  React.useEffect(() => {
    const onHashChange = () => {
      setPage(getInitialPage());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const mcpSummary = `${props.initialState.mcpStatus.environment} • ${props.initialState.mcpStatus.supported ? "supported" : "not supported"} • ${props.initialState.mcpStatus.configured ? "configured" : "not configured"}`;

  const save = (applyNow: boolean) => {
    postMessage({
      command: "save",
      data: {
        uiLanguage,
        autoInstallInstructionFiles,
        instructionTargets: targets,
        autoEnableAgentsMdFile,
        autoEnableCopilotInstructionFiles,
        mcpEnvironment,
        mcpConfigPathOverride,
        mcpDbPathOverride,
        docsSort,
        docClickAction,
        applyNow,
      },
    });
  };

  const action = (name: "applyInstructions" | "setupMcp" | "refresh") => {
    postMessage({ command: "action", data: { action: name } });
  };

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h1>{t.settings}</h1>
          <div className="muted subtitle">{t.subtitle}</div>
        </div>
        <div style={{ minWidth: 120 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            {t.language}
          </div>
          <select value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}>
            <option value="auto">{t.languageAuto}</option>
            <option value="en">{t.languageEn}</option>
            <option value="fr">{t.languageFr}</option>
          </select>
        </div>
      </div>

      <div className="nav">
        <button
          className={`tab ${page === "overview" ? "active" : ""}`}
          onClick={() => setHash("overview")}
        >
          {t.navOverview}
        </button>
        <button
          className={`tab ${page === "instructions" ? "active" : ""}`}
          onClick={() => setHash("instructions")}
        >
          {t.navInstructions}
        </button>
        <button className={`tab ${page === "mcp" ? "active" : ""}`} onClick={() => setHash("mcp")}>
          {t.navMcp}
        </button>
        <button
          className={`tab ${page === "advanced" ? "active" : ""}`}
          onClick={() => setHash("advanced")}
        >
          {t.navAdvanced}
        </button>
      </div>

      {page === "overview" && (
        <div className="card">
          <h2>{t.overviewTitle}</h2>
          <div className="muted">{t.overviewHint}</div>

          <h2>{t.brainReminderTitle}</h2>
          <div className="muted">{t.brainReminder}</div>

          <h2>{t.quickActions}</h2>
          <div className="actions">
            <button className="secondary" onClick={() => action("applyInstructions")}>
              {t.applyNow}
            </button>
            <button className="secondary" onClick={() => action("refresh")}>
              {t.refresh}
            </button>
          </div>
        </div>
      )}

      {page === "instructions" && (
        <div className="card">
          <h2>{t.instructionFilesTitle}</h2>
          <div className="muted">{t.instructionFilesHint}</div>

          <div className="check">
            <input
              id="autoInstall"
              type="checkbox"
              checked={autoInstallInstructionFiles}
              onChange={(e) => setAutoInstallInstructionFiles(e.target.checked)}
            />
            <label htmlFor="autoInstall">{t.autoGenerate}</label>
          </div>

          <div className="check">
            <input
              id="agentsMd"
              type="checkbox"
              checked={targets.agentsMd}
              onChange={(e) => setTargets({ ...targets, agentsMd: e.target.checked })}
            />
            <label htmlFor="agentsMd">
              <code>AGENTS.md</code> (VS Code Agents)
            </label>
          </div>

          <div className="check">
            <input
              id="copilotInstructions"
              type="checkbox"
              checked={targets.copilotInstructions}
              onChange={(e) => setTargets({ ...targets, copilotInstructions: e.target.checked })}
            />
            <label htmlFor="copilotInstructions">
              <code>.github/copilot-instructions.md</code> (Copilot)
            </label>
          </div>

          <div className="check">
            <input
              id="cursorRules"
              type="checkbox"
              checked={targets.cursorRules}
              onChange={(e) => setTargets({ ...targets, cursorRules: e.target.checked })}
            />
            <label htmlFor="cursorRules">
              <code>.cursor/rules/brain.mdc</code> (Cursor)
            </label>
          </div>

          <div className="check">
            <input
              id="windsurfRules"
              type="checkbox"
              checked={targets.windsurfRules}
              onChange={(e) => setTargets({ ...targets, windsurfRules: e.target.checked })}
            />
            <label htmlFor="windsurfRules">
              <code>.windsurf/rules/brain.md</code> (Windsurf)
            </label>
          </div>

          <div className="check">
            <input
              id="autoEnableAgents"
              type="checkbox"
              checked={autoEnableAgentsMdFile}
              onChange={(e) => setAutoEnableAgentsMdFile(e.target.checked)}
            />
            <label htmlFor="autoEnableAgents">{t.enableAgents}</label>
          </div>

          <div className="check">
            <input
              id="autoEnableCopilot"
              type="checkbox"
              checked={autoEnableCopilotInstructionFiles}
              onChange={(e) => setAutoEnableCopilotInstructionFiles(e.target.checked)}
            />
            <label htmlFor="autoEnableCopilot">{t.enableCopilot}</label>
          </div>
        </div>
      )}

      {page === "mcp" && (
        <div className="card">
          <h2>{t.mcpTitle}</h2>
          <div className="muted">{t.mcpHint}</div>

          <div className="row">
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t.mcpEnv}
              </div>
              <select
                value={mcpEnvironment}
                onChange={(e) => setMcpEnvironment(e.target.value as McpEnvironment)}
              >
                <option value="auto">Auto-detect</option>
                <option value="cursor">Cursor</option>
                <option value="windsurf">Windsurf</option>
              </select>
            </div>

            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t.mcpConfigOverride}
              </div>
              <input
                type="text"
                placeholder="C:\\Users\\...\\.cursor\\mcp.json"
                value={mcpConfigPathOverride}
                onChange={(e) => setMcpConfigPathOverride(e.target.value)}
              />
            </div>

            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t.mcpDbOverride}
              </div>
              <input
                type="text"
                placeholder="C:\\Users\\...\\brain.db"
                value={mcpDbPathOverride}
                onChange={(e) => setMcpDbPathOverride(e.target.value)}
              />
            </div>
          </div>

          <div className="kv">
            <div>
              <strong>{t.status}:</strong> {mcpSummary}
            </div>
            <div>
              <strong>{t.resolvedConfig}:</strong>{" "}
              <code>{props.initialState.mcpStatus.configPath ?? "(none)"}</code>
            </div>
            <div>
              <strong>{t.resolvedDb}:</strong> <code>{props.initialState.mcpStatus.dbPath}</code>
            </div>
          </div>

          <div className="actions">
            <button className="secondary" onClick={() => action("setupMcp")}>
              {t.mcpRun}
            </button>
          </div>
        </div>
      )}

      {page === "advanced" && (
        <div className="card">
          <h2>{t.advancedTitle}</h2>
          <div className="muted">{t.advancedHint}</div>

          <h3>{t.sidebarBehavior}</h3>
          <div className="row">
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t.docsSortLabel}
              </div>
              <select value={docsSort} onChange={(e) => setDocsSort(e.target.value as DocsSort)}>
                <option value="titleAsc">{t.docsSortTitleAsc}</option>
                <option value="createdDesc">{t.docsSortCreatedDesc}</option>
                <option value="createdAsc">{t.docsSortCreatedAsc}</option>
              </select>
            </div>

            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {t.docClickActionLabel}
              </div>
              <select
                value={docClickAction}
                onChange={(e) => setDocClickAction(e.target.value as DocClickAction)}
              >
                <option value="view">{t.docClickActionView}</option>
                <option value="sendToChat">{t.docClickActionSendToChat}</option>
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Workspace settings</h3>
          <div className="kv">
            <div>
              <strong>Workspace setting:</strong> <code>whytcard-brain.language</code>
            </div>
            <div>
              <strong>Workspace setting:</strong> <code>whytcard-brain.instructionTargets</code>
            </div>
            <div>
              <strong>Workspace setting:</strong> <code>whytcard-brain.mcpEnvironment</code>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>{t.save}</h2>
        <div className="actions">
          <button onClick={() => save(true)}>{t.saveApply}</button>
          <button className="secondary" onClick={() => save(false)}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
