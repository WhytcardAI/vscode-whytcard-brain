/**
 * WhytCard Brain - Tree Data Providers
 * Structure: 4 vues separees (Instructions, Documentation, Context, Stats)
 * Hierarchie: Domain > Library > Topic > Doc (sauf Stats qui affiche les metriques)
 */

import * as vscode from 'vscode';
import { getBrainService, getUsageStats, inferDomain, type Doc } from '../services/brainService';

export type DocCategory = 'instruction' | 'documentation' | 'project';

// =====================
// TREE ITEM
// =====================

export class BrainTreeItem extends vscode.TreeItem {
  public docCategory?: DocCategory;
  public domainName?: string;
  public libraryName?: string;
  public topicName?: string;
  public entryType?: 'doc' | 'stat';
  public entryId?: number;
  public entryData?: Doc;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

// =====================
// CATEGORY TREE PROVIDER (base class)
// =====================

export class CategoryTreeProvider implements vscode.TreeDataProvider<BrainTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BrainTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(protected readonly category: DocCategory) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BrainTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BrainTreeItem): Thenable<BrainTreeItem[]> {
    const service = getBrainService();
    const allDocs = service
      .getAllDocs()
      .filter((d) => (d.category || 'documentation') === this.category);

    // Root level: Domains
    if (!element) {
      // Group docs by domain (infer if not set)
      const docsWithDomain = allDocs.map((d) => ({
        ...d,
        domain: d.domain || inferDomain(d.library),
      }));
      const domains = [...new Set(docsWithDomain.map((d) => d.domain))].sort();

      if (domains.length === 0) {
        return Promise.resolve([]);
      }

      return Promise.resolve(
        domains.map((domain) => {
          const domainDocs = docsWithDomain.filter((d) => d.domain === domain);
          const libraries = [...new Set(domainDocs.map((d) => d.library))];

          const item = new BrainTreeItem(domain, vscode.TreeItemCollapsibleState.Collapsed);
          item.iconPath = new vscode.ThemeIcon(this.getDomainIcon(domain));
          item.contextValue = 'domain';
          item.description = `${libraries.length} lib(s)`;
          item.domainName = domain;
          item.docCategory = this.category;
          item.tooltip = `${domain} - ${libraries.length} librairie(s), ${domainDocs.length} doc(s)`;
          return item;
        })
      );
    }

    // Domain level: Libraries
    if (element.contextValue === 'domain' && element.domainName) {
      const docsWithDomain = allDocs.map((d) => ({
        ...d,
        domain: d.domain || inferDomain(d.library),
      }));
      const domainDocs = docsWithDomain.filter((d) => d.domain === element.domainName);
      const libraries = [...new Set(domainDocs.map((d) => d.library))].sort();

      return Promise.resolve(
        libraries.map((lib) => {
          const libDocs = domainDocs.filter((d) => d.library === lib);
          const topics = [...new Set(libDocs.map((d) => d.topic))];

          const item = new BrainTreeItem(lib, vscode.TreeItemCollapsibleState.Collapsed);
          item.iconPath = new vscode.ThemeIcon('folder-library');
          item.contextValue = 'library';
          item.description = `${libDocs.length}`;
          item.domainName = element.domainName;
          item.libraryName = lib;
          item.docCategory = this.category;
          item.tooltip = `${lib} - ${topics.length} sujet(s), ${libDocs.length} doc(s)`;
          return item;
        })
      );
    }

    // Library level: Topics
    if (element.contextValue === 'library' && element.libraryName) {
      const libDocs = allDocs.filter((d) => d.library === element.libraryName);
      const topics = [...new Set(libDocs.map((d) => d.topic))].sort();

      return Promise.resolve(
        topics.map((topic) => {
          const topicDocs = libDocs.filter((d) => d.topic === topic);

          const item = new BrainTreeItem(topic, vscode.TreeItemCollapsibleState.Collapsed);
          item.iconPath = new vscode.ThemeIcon('symbol-folder');
          item.contextValue = 'topic';
          item.description = `${topicDocs.length}`;
          item.domainName = element.domainName;
          item.libraryName = element.libraryName;
          item.topicName = topic;
          item.docCategory = this.category;
          item.tooltip = `${topic} - ${topicDocs.length} doc(s)`;
          return item;
        })
      );
    }

    // Topic level: Docs
    if (element.contextValue === 'topic' && element.libraryName && element.topicName) {
      const docs = allDocs.filter(
        (d) => d.library === element.libraryName && d.topic === element.topicName
      );

      return Promise.resolve(
        docs.map((doc) => {
          const item = new BrainTreeItem(doc.title, vscode.TreeItemCollapsibleState.None);
          item.iconPath = new vscode.ThemeIcon('file-text');
          item.contextValue = 'doc';
          item.entryType = 'doc';
          item.entryId = doc.id;
          item.entryData = doc;
          item.docCategory = this.category;
          item.tooltip = new vscode.MarkdownString(
            `**${doc.title}**\n\n` +
              `${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`
          );
          item.command = {
            command: 'whytcard-brain.viewEntry',
            title: 'Voir',
            arguments: [item],
          };
          return item;
        })
      );
    }

    return Promise.resolve([]);
  }

  private getDomainIcon(domain: string): string {
    const icons: Record<string, string> = {
      website: 'globe',
      mobile: 'device-mobile',
      backend: 'server',
      devops: 'cloud',
      general: 'symbol-misc',
    };
    return icons[domain] || 'folder';
  }
}

// =====================
// SPECIFIC PROVIDERS
// =====================

export class InstructionsTreeProvider extends CategoryTreeProvider {
  constructor() {
    super('instruction');
  }
}

export class DocumentationTreeProvider extends CategoryTreeProvider {
  constructor() {
    super('documentation');
  }
}

export class ContextTreeProvider extends CategoryTreeProvider {
  constructor() {
    super('project');
  }
}

// =====================
// STATS PROVIDER (special - not doc-based)
// =====================

export class StatsTreeProvider implements vscode.TreeDataProvider<BrainTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BrainTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BrainTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BrainTreeItem): Thenable<BrainTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const service = getBrainService();
    const stats = service.getStats();
    const usage = getUsageStats();
    const items: BrainTreeItem[] = [];

    // Database stats
    const dbItem = new BrainTreeItem('Base de donnees', vscode.TreeItemCollapsibleState.None);
    dbItem.iconPath = new vscode.ThemeIcon('database');
    dbItem.description = `${stats.docs} docs, ${stats.pitfalls} bugs, ${stats.dbSizeKb} KB`;
    dbItem.contextValue = 'stat';
    dbItem.entryType = 'stat';
    items.push(dbItem);

    // Usage stats - Tool calls
    const toolsItem = new BrainTreeItem('Appels outils', vscode.TreeItemCollapsibleState.None);
    toolsItem.iconPath = new vscode.ThemeIcon('tools');
    toolsItem.description = `search: ${usage.searchCount}, store: ${usage.storeDocCount}, pitfall: ${usage.storePitfallCount}`;
    toolsItem.contextValue = 'stat';
    toolsItem.entryType = 'stat';
    items.push(toolsItem);

    // New tools
    const newToolsItem = new BrainTreeItem('Nouveaux outils', vscode.TreeItemCollapsibleState.None);
    newToolsItem.iconPath = new vscode.ThemeIcon('rocket');
    newToolsItem.description = `instructions: ${usage.getInstructionsCount}, context: ${usage.getContextCount}`;
    newToolsItem.contextValue = 'stat';
    newToolsItem.entryType = 'stat';
    items.push(newToolsItem);

    // Last used
    const lastUsedItem = new BrainTreeItem(
      'Derniere utilisation',
      vscode.TreeItemCollapsibleState.None
    );
    lastUsedItem.iconPath = new vscode.ThemeIcon('clock');
    lastUsedItem.description = usage.lastUsed
      ? new Date(usage.lastUsed).toLocaleString('fr-FR')
      : 'Jamais';
    lastUsedItem.contextValue = 'stat';
    lastUsedItem.entryType = 'stat';
    items.push(lastUsedItem);

    // Errors
    if (usage.errors.length > 0) {
      const errorsItem = new BrainTreeItem('Erreurs', vscode.TreeItemCollapsibleState.None);
      errorsItem.iconPath = new vscode.ThemeIcon('error');
      errorsItem.description = `${usage.errors.length} erreur(s)`;
      errorsItem.tooltip = new vscode.MarkdownString(
        `**Dernieres erreurs:**\n\n` +
          usage.errors
            .slice(-5)
            .map((e) => `- ${e}`)
            .join('\n')
      );
      errorsItem.contextValue = 'stat';
      errorsItem.entryType = 'stat';
      items.push(errorsItem);
    }

    return Promise.resolve(items);
  }
}
