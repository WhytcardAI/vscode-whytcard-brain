/**
 * WhytCard Brain - Tree Data Providers
 * Structure: 4 vues separees (Instructions, Documentation, Context, Stats)
 * Hierarchie: Domain > Library > Topic > Doc (sauf Stats qui affiche les metriques)
 */

import * as vscode from "vscode";
import {
  getBrainService,
  inferDomain,
  type Doc,
} from "../services/brainService";

export type DocCategory = "instruction" | "documentation" | "project";

// =====================
// TREE ITEM
// =====================

export class BrainTreeItem extends vscode.TreeItem {
  public docCategory?: DocCategory;
  public domainName?: string;
  public libraryName?: string;
  public topicName?: string;
  public entryType?: "doc" | "stat";
  public entryId?: number;
  public entryData?: Doc;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}

// =====================
// CATEGORY TREE PROVIDER (base class)
// =====================

export class CategoryTreeProvider implements vscode.TreeDataProvider<BrainTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    BrainTreeItem | undefined | null | void
  >();
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
      .filter((d) => (d.category || "documentation") === this.category);

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

          const item = new BrainTreeItem(
            domain,
            vscode.TreeItemCollapsibleState.Collapsed,
          );
          item.iconPath = new vscode.ThemeIcon(this.getDomainIcon(domain));
          item.contextValue = "domain";
          item.description = `${libraries.length} libraries`;
          item.domainName = domain;
          item.docCategory = this.category;
          item.tooltip = `${domain} - ${libraries.length} librairie(s), ${domainDocs.length} doc(s)`;
          return item;
        }),
      );
    }

    // Domain level: Libraries
    if (element.contextValue === "domain" && element.domainName) {
      const docsWithDomain = allDocs.map((d) => ({
        ...d,
        domain: d.domain || inferDomain(d.library),
      }));
      const domainDocs = docsWithDomain.filter(
        (d) => d.domain === element.domainName,
      );
      const libraries = [...new Set(domainDocs.map((d) => d.library))].sort();

      return Promise.resolve(
        libraries.map((lib) => {
          const libDocs = domainDocs.filter((d) => d.library === lib);
          const topics = [...new Set(libDocs.map((d) => d.topic))];

          const item = new BrainTreeItem(
            lib,
            vscode.TreeItemCollapsibleState.Collapsed,
          );
          item.iconPath = new vscode.ThemeIcon("package");
          item.contextValue = "library";
          item.description = `${libDocs.length} docs`;
          item.domainName = element.domainName;
          item.libraryName = lib;
          item.docCategory = this.category;
          item.tooltip = `${lib} - ${topics.length} sujet(s), ${libDocs.length} doc(s)`;
          return item;
        }),
      );
    }

    // Library level: Topics
    if (element.contextValue === "library" && element.libraryName) {
      const libDocs = allDocs.filter((d) => d.library === element.libraryName);
      const topics = [...new Set(libDocs.map((d) => d.topic))].sort();

      return Promise.resolve(
        topics.map((topic) => {
          const topicDocs = libDocs.filter((d) => d.topic === topic);

          const item = new BrainTreeItem(
            topic,
            vscode.TreeItemCollapsibleState.Collapsed,
          );
          item.iconPath = new vscode.ThemeIcon("tag");
          item.contextValue = "topic";
          item.description = `${topicDocs.length} docs`;
          item.domainName = element.domainName;
          item.libraryName = element.libraryName;
          item.topicName = topic;
          item.docCategory = this.category;
          item.tooltip = `${topic} - ${topicDocs.length} doc(s)`;
          return item;
        }),
      );
    }

    // Topic level: Docs
    if (
      element.contextValue === "topic" &&
      element.libraryName &&
      element.topicName
    ) {
      const docs = allDocs.filter(
        (d) =>
          d.library === element.libraryName && d.topic === element.topicName,
      );

      return Promise.resolve(
        docs.map((doc) => {
          const item = new BrainTreeItem(
            doc.title,
            vscode.TreeItemCollapsibleState.None,
          );
          item.iconPath = new vscode.ThemeIcon("note");
          item.contextValue = "doc";
          item.entryType = "doc";
          item.entryId = doc.id;
          item.entryData = doc;
          item.docCategory = this.category;
          item.tooltip = new vscode.MarkdownString(
            `**${doc.title}**\n\n` +
              `${doc.content.substring(0, 200)}${doc.content.length > 200 ? "..." : ""}`,
          );
          item.command = {
            command: "whytcard-brain.viewEntry",
            title: "Voir",
            arguments: [item],
          };
          return item;
        }),
      );
    }

    return Promise.resolve([]);
  }

  private getDomainIcon(domain: string): string {
    const icons: Record<string, string> = {
      website: "browser",
      mobile: "device-mobile",
      backend: "server-process",
      devops: "cloud-upload",
      general: "library",
    };
    return icons[domain] || "folder";
  }
}

// =====================
// SPECIFIC PROVIDERS
// =====================

export class InstructionsTreeProvider extends CategoryTreeProvider {
  constructor() {
    super("instruction");
  }
}

export class DocumentationTreeProvider extends CategoryTreeProvider {
  constructor() {
    super("documentation");
  }
}

export class ContextTreeProvider extends CategoryTreeProvider {
  constructor() {
    super("project");
  }
}

// =====================
// STATS PROVIDER (special - not doc-based)
// =====================

export class StatsTreeProvider implements vscode.TreeDataProvider<BrainTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    BrainTreeItem | undefined | null | void
  >();
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
    const items: BrainTreeItem[] = [];

    // Database stats
    const dbItem = new BrainTreeItem(
      "Base de donnees",
      vscode.TreeItemCollapsibleState.None,
    );
    dbItem.iconPath = new vscode.ThemeIcon("database");
    dbItem.description = `${stats.docs} docs, ${stats.pitfalls} bugs, ${stats.templates} templates, ${stats.dbSizeKb} KB`;
    dbItem.contextValue = "stat";
    dbItem.entryType = "stat";
    items.push(dbItem);

    // Database path (useful when MCP points to a shared DB)
    const dbPathItem = new BrainTreeItem(
      "Chemin DB",
      vscode.TreeItemCollapsibleState.None,
    );
    dbPathItem.iconPath = new vscode.ThemeIcon("file-directory");
    dbPathItem.description = service.getDbPath();
    dbPathItem.contextValue = "stat";
    dbPathItem.entryType = "stat";
    items.push(dbPathItem);

    // Last activity (derived from DB content, not from in-memory tool usage)
    const toMs = (value?: string | null): number => {
      if (!value) return 0;
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : 0;
    };

    const lastDocMs = Math.max(
      0,
      ...service.getAllDocs().map((d) => toMs(d.created_at)),
    );
    const lastPitfallMs = Math.max(
      0,
      ...service.getAllPitfalls().map((p) => toMs(p.created_at)),
    );
    const lastTemplateMs = Math.max(
      0,
      ...service.getAllTemplates().map((t) => toMs(t.updated_at || t.created_at)),
    );

    const lastMs = Math.max(lastDocMs, lastPitfallMs, lastTemplateMs);

    const lastActivityItem = new BrainTreeItem(
      "Derniere activite",
      vscode.TreeItemCollapsibleState.None,
    );
    lastActivityItem.iconPath = new vscode.ThemeIcon("clock");
    lastActivityItem.description =
      lastMs > 0 ? new Date(lastMs).toLocaleString("fr-FR") : "Jamais";
    lastActivityItem.contextValue = "stat";
    lastActivityItem.entryType = "stat";
    items.push(lastActivityItem);

    return Promise.resolve(items);
  }
}
