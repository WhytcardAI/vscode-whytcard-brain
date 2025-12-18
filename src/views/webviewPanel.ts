/**
 * WhytCard Brain - Webview Panel
 * Affichage détaillé des documents
 */

import * as vscode from 'vscode';
import type { Doc } from '../services/brainService';

export class BrainWebviewPanel {
  public static currentPanel: BrainWebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
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
      'whytcardBrainView',
      'WhytCard Brain',
      column || vscode.ViewColumn.One,
      { enableScripts: true }
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

  private _handleMessage(message: { command: string; data?: unknown }) {
    if (message.command === 'copy' && message.data) {
      vscode.env.clipboard.writeText(String(message.data));
      vscode.window.showInformationMessage('Copie dans le presse-papier');
    }
  }

  private _update(doc: Doc) {
    this._panel.title = doc.title;
    this._panel.webview.html = this._getHtml(doc);
  }

  private _getHtml(doc: Doc): string {
    const categoryLabel = this._getCategoryLabel(doc.category);

    return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.7;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      font-size: 1.8em;
      margin-bottom: 16px;
      border-bottom: 2px solid var(--vscode-textLink-foreground);
      padding-bottom: 8px;
    }
    h2 { font-size: 1.4em; margin-top: 32px; color: var(--vscode-textLink-activeForeground); }
    h3 { font-size: 1.2em; margin-top: 24px; }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 4px solid var(--vscode-textLink-foreground);
    }
    .meta-item {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .meta-label {
      opacity: 0.7;
      font-size: 0.9em;
    }
    .meta-value {
      font-weight: 600;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.85em;
    }
    .source-link {
      margin-bottom: 24px;
    }
    .source-link a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .source-link a:hover {
      text-decoration: underline;
    }
    .content {
      margin-top: 24px;
    }
    .content p {
      margin: 12px 0;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      position: relative;
      margin: 16px 0;
      border: 1px solid var(--vscode-panel-border);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }
    p code, li code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    .copy-btn:hover {
      opacity: 1;
    }
    ul, ol {
      padding-left: 24px;
      margin: 12px 0;
    }
    li {
      margin: 6px 0;
    }
    blockquote {
      border-left: 4px solid var(--vscode-textLink-foreground);
      margin: 16px 0;
      padding: 8px 16px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 0 8px 8px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: var(--vscode-textCodeBlock-background);
    }
  </style>
</head>
<body>
  <h1>${this._esc(doc.title)}</h1>
  <div class="meta">
    <div class="meta-item">
      <span class="meta-label">Categorie:</span>
      <span class="meta-value">${categoryLabel}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Librairie:</span>
      <span class="meta-value">${this._esc(doc.library)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Sujet:</span>
      <span class="meta-value">${this._esc(doc.topic)}</span>
    </div>
    ${
      doc.version
        ? `
    <div class="meta-item">
      <span class="meta-label">Version:</span>
      <span class="meta-value">${this._esc(doc.version)}</span>
    </div>`
        : ''
    }
  </div>
  ${
    doc.url
      ? `<div class="source-link"><a href="${this._esc(
          doc.url
        )}">Voir la source originale</a></div>`
      : ''
  }
  <div class="content">${this._markdown(doc.content)}</div>
  <script>
    const vscode = acquireVsCodeApi();
    function copyToClipboard(text) {
      vscode.postMessage({ command: 'copy', data: text });
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
      case 'instruction':
        return 'Instructions';
      case 'documentation':
        return 'Documentation';
      case 'project':
        return 'Context';
      case 'other':
        return 'Autre';
      default:
        return 'Documentation';
    }
  }

  private _esc(text: string): string {
    return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private _markdown(content: string): string {
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
}
