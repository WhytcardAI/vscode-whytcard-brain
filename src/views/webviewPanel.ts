/**
 * WhytCard Brain - Webview Panel
 * Affichage détaillé des documents avec UI moderne
 */

import * as vscode from "vscode";
import { getBrainService, type Doc } from "../services/brainService";

export class BrainWebviewPanel {
  public static currentPanel: BrainWebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentDoc: Doc | undefined;

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static show(extensionUri: vscode.Uri, doc: Doc) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (BrainWebviewPanel.currentPanel) {
      BrainWebviewPanel.currentPanel._panel.reveal(column);
      BrainWebviewPanel.currentPanel._update(doc);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "whytcardBrainView",
      "WhytCard Brain",
      column || vscode.ViewColumn.One,
      { enableScripts: true },
    );

    BrainWebviewPanel.currentPanel = new BrainWebviewPanel(panel);
    BrainWebviewPanel.currentPanel._update(doc);
  }

  public dispose() {
    BrainWebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private async _handleMessage(message: { command: string; data?: unknown }) {
    switch (message.command) {
      case "copy":
        if (message.data) {
          await vscode.env.clipboard.writeText(String(message.data));
          vscode.window.showInformationMessage("Copié dans le presse-papier");
        }
        break;
      case "copyAll":
        if (this._currentDoc) {
          const fullContent =
            `# ${this._currentDoc.title}\n\n` +
            `**Library:** ${this._currentDoc.library}\n` +
            `**Topic:** ${this._currentDoc.topic}\n` +
            (this._currentDoc.url ?
              `**Source:** ${this._currentDoc.url}\n`
            : "") +
            `\n---\n\n${this._currentDoc.content}`;
          await vscode.env.clipboard.writeText(fullContent);
          vscode.window.showInformationMessage("Document complet copié");
        }
        break;
      case "delete":
        if (this._currentDoc?.id) {
          const confirm = await vscode.window.showWarningMessage(
            `Supprimer "${this._currentDoc.title}" ?`,
            { modal: true },
            "Supprimer",
          );
          if (confirm === "Supprimer") {
            getBrainService().deleteDoc(this._currentDoc.id);
            vscode.commands.executeCommand("whytcard-brain.refresh");
            this._panel.dispose();
            vscode.window.showInformationMessage("Document supprimé");
          }
        }
        break;
      case "openUrl":
        if (message.data && typeof message.data === "string") {
          vscode.env.openExternal(vscode.Uri.parse(message.data));
        }
        break;
    }
  }

  private _update(doc: Doc) {
    this._currentDoc = doc;
    this._panel.title = doc.title;
    this._panel.webview.html = this._getHtml(doc);
  }

  private _getHtml(doc: Doc): string {
    const categoryLabel = this._getCategoryLabel(doc.category);
    const categoryColor = this._getCategoryColor(doc.category);

    return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.7;
    }
    .header {
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 16px 24px;
      z-index: 100;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .title-section { flex: 1; }
    h1 {
      color: var(--vscode-editor-foreground);
      font-size: 1.5em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s ease;
      background: transparent;
      color: var(--vscode-editor-foreground);
    }
    .action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .action-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .action-btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .action-btn.danger:hover {
      background: var(--vscode-inputValidation-errorBackground);
      border-color: var(--vscode-inputValidation-errorBorder);
    }
    .action-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 500;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.category {
      background: ${categoryColor};
      color: white;
    }
    .badge svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }
    .source-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 8px 12px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 6px;
      font-size: 12px;
    }
    .source-banner a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      word-break: break-all;
    }
    .source-banner a:hover { text-decoration: underline; }
    .source-banner svg {
      width: 14px;
      height: 14px;
      fill: var(--vscode-textLink-foreground);
      flex-shrink: 0;
    }
    .main-content {
      padding: 24px;
      max-width: 900px;
    }
    .content p { margin: 12px 0; }
    h2 { font-size: 1.3em; margin-top: 28px; margin-bottom: 12px; color: var(--vscode-textLink-foreground); }
    h3 { font-size: 1.1em; margin-top: 20px; margin-bottom: 8px; }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 10px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    pre:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    ul, ol { padding-left: 24px; margin: 12px 0; }
    li { margin: 6px 0; }
    blockquote {
      border-left: 3px solid var(--vscode-textLink-foreground);
      margin: 16px 0;
      padding: 8px 16px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 0 6px 6px 0;
    }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 8px 12px; text-align: left; }
    th { background: var(--vscode-textCodeBlock-background); font-weight: 600; }
    hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 24px 0; }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div class="title-section">
        <h1>${this._esc(doc.title)}</h1>
      </div>
      <div class="actions">
        <button class="action-btn primary" onclick="copyAll()" title="Copier tout">
          <svg viewBox="0 0 16 16"><path d="M4 4h8v8H4V4zm1 1v6h6V5H5zM2 2v8h1V3h7V2H2z"/></svg>
          Copier
        </button>
        <button class="action-btn danger" onclick="deleteDoc()" title="Supprimer">
          <svg viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      </div>
    </div>
    <div class="badges">
      <span class="badge category">
        <svg viewBox="0 0 16 16"><path d="M2 2h5l1 1h6v10H2V2zm1 1v9h10V4H7.5L6.5 3H3z"/></svg>
        ${categoryLabel}
      </span>
      <span class="badge">
        <svg viewBox="0 0 16 16"><path d="M8.5 1.5A1.5 1.5 0 0110 3v1h3.5a.5.5 0 010 1H13v8.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5V5h-.5a.5.5 0 010-1H6V3a1.5 1.5 0 011.5-1.5h1zM7 3v1h2V3a.5.5 0 00-.5-.5h-1A.5.5 0 007 3z"/></svg>
        ${this._esc(doc.library)}
      </span>
      <span class="badge">
        <svg viewBox="0 0 16 16"><path d="M2 5.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h8a.5.5 0 010 1h-8a.5.5 0 01-.5-.5z"/></svg>
        ${this._esc(doc.topic)}
      </span>
      ${
        doc.version ?
          `
      <span class="badge">
        <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 1a7 7 0 110 14A7 7 0 018 1z"/><path d="M8 4a.5.5 0 01.5.5v3.793l2.354 2.353a.5.5 0 01-.708.708L7.5 8.707V4.5A.5.5 0 018 4z"/></svg>
        v${this._esc(doc.version)}
      </span>`
        : ""
      }
    </div>
    ${
      doc.url ?
        `
    <div class="source-banner">
      <svg viewBox="0 0 16 16"><path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1.001 1.001 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 11-2.83-2.83l.793-.792a4.018 4.018 0 01-.128-1.287z"/><path d="M6.586 4.672A3 3 0 007.414 9.5l.775-.776a2 2 0 01-.896-3.346L9.12 3.55a2 2 0 012.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 00-4.243-4.243L6.586 4.672z"/></svg>
      <a href="#" onclick="openUrl('${this._esc(doc.url)}')">${this._esc(doc.url)}</a>
    </div>`
      : ""
    }
  </div>
  <div class="main-content">
    <div class="content">${this._markdown(doc.content)}</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function copyToClipboard(text) {
      vscode.postMessage({ command: 'copy', data: text });
    }
    function copyAll() {
      vscode.postMessage({ command: 'copyAll' });
    }
    function deleteDoc() {
      vscode.postMessage({ command: 'delete' });
    }
    function openUrl(url) {
      vscode.postMessage({ command: 'openUrl', data: url });
    }
    document.querySelectorAll('pre code').forEach(block => {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copier';
      btn.onclick = () => copyToClipboard(block.textContent);
      block.parentElement.appendChild(btn);
    });
  </script>
</body>
</html>`;
  }

  private _getCategoryLabel(category?: string): string {
    switch (category) {
      case "instruction":
        return "Instructions";
      case "documentation":
        return "Documentation";
      case "project":
        return "Context";
      case "other":
        return "Autre";
      default:
        return "Documentation";
    }
  }

  private _getCategoryColor(category?: string): string {
    switch (category) {
      case "instruction":
        return "#8b5cf6"; // purple
      case "documentation":
        return "#3b82f6"; // blue
      case "project":
        return "#10b981"; // green
      default:
        return "#6b7280"; // gray
    }
  }

  private _esc(text: string): string {
    return (text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private _markdown(content: string): string {
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^\* (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      .replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }
}
