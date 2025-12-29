/**
 * WhytCard Brain - Templates Tree Provider
 * Hierarchie: Framework > Type > Template
 */

import * as vscode from "vscode";
import { getBrainService, type Template } from "../services/brainService";

export class TemplateTreeItem extends vscode.TreeItem {
  public framework?: string;
  public templateType?: Template["type"];
  public templateId?: number;
  public templateData?: Template;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}

export class TemplatesTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TemplateTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TemplateTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TemplateTreeItem): Thenable<TemplateTreeItem[]> {
    const service = getBrainService();
    const allTemplates = service.getAllTemplates();

    // Root level: Frameworks
    if (!element) {
      const frameworks = [
        ...new Set(allTemplates.map((t) => t.framework || "general")),
      ].sort();

      if (frameworks.length === 0) {
        return Promise.resolve([]);
      }

      return Promise.resolve(
        frameworks.map((framework) => {
          const frameworkTemplates = allTemplates.filter(
            (t) => (t.framework || "general") === framework,
          );

          const item = new TemplateTreeItem(
            `${this.getFrameworkIcon(framework)} ${framework}`,
            vscode.TreeItemCollapsibleState.Collapsed,
          );

          item.framework = framework;
          item.description = `${frameworkTemplates.length} template${frameworkTemplates.length > 1 ? "s" : ""}`;
          item.contextValue = "framework";

          return item;
        }),
      );
    }

    // Second level: Types (within a framework)
    if (element.framework && !element.templateType) {
      const frameworkTemplates = allTemplates.filter(
        (t) => (t.framework || "general") === element.framework,
      );

      const types = [...new Set(frameworkTemplates.map((t) => t.type))].sort();

      return Promise.resolve(
        types.map((type) => {
          const typeTemplates = frameworkTemplates.filter(
            (t) => t.type === type,
          );

          const item = new TemplateTreeItem(
            `${this.getTypeIcon(type)} ${this.formatType(type)}`,
            vscode.TreeItemCollapsibleState.Collapsed,
          );

          item.framework = element.framework;
          item.templateType = type;
          item.description = `${typeTemplates.length} template${typeTemplates.length > 1 ? "s" : ""}`;
          item.contextValue = "type";

          return item;
        }),
      );
    }

    // Third level: Templates
    if (element.framework && element.templateType) {
      const templates = allTemplates.filter(
        (t) =>
          (t.framework || "general") === element.framework &&
          t.type === element.templateType,
      );

      return Promise.resolve(
        templates.map((template) => {
          const item = new TemplateTreeItem(
            template.name,
            vscode.TreeItemCollapsibleState.None,
          );

          item.description = template.description;
          item.tooltip = this.buildTooltip(template);
          item.framework = element.framework;
          item.templateType = element.templateType;
          item.templateId = template.id;
          item.templateData = template;
          item.contextValue = "template";
          item.iconPath = new vscode.ThemeIcon("file-code");

          // Add command to view template
          item.command = {
            command: "whytcard-brain.viewTemplate",
            title: "View Template",
            arguments: [item],
          };

          return item;
        }),
      );
    }

    return Promise.resolve([]);
  }

  private getFrameworkIcon(framework: string): string {
    const icons: Record<string, string> = {
      nextjs: "⚡",
      react: "⚛️",
      vue: "🟢",
      angular: "🅰️",
      express: "🚂",
      nestjs: "🐱",
      typescript: "💙",
      javascript: "💛",
      python: "🐍",
      general: "📦",
    };
    return icons[framework.toLowerCase()] || "📦";
  }

  private getTypeIcon(type: Template["type"]): string {
    const icons: Record<Template["type"], string> = {
      snippet: "📝",
      file: "📄",
      multifile: "📁",
    };
    return icons[type] || "📝";
  }

  private formatType(type: Template["type"]): string {
    const labels: Record<Template["type"], string> = {
      snippet: "Snippets",
      file: "Single Files",
      multifile: "Multi-File Templates",
    };
    return labels[type] || type;
  }

  private buildTooltip(template: Template): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;

    tooltip.appendMarkdown(`### ${template.name}\n\n`);
    tooltip.appendMarkdown(`**Description:** ${template.description}\n\n`);

    if (template.language) {
      tooltip.appendMarkdown(`**Language:** ${template.language}\n\n`);
    }

    if (template.framework) {
      tooltip.appendMarkdown(`**Framework:** ${template.framework}\n\n`);
    }

    if (template.tags) {
      try {
        const tags = JSON.parse(template.tags);
        if (Array.isArray(tags) && tags.length > 0) {
          tooltip.appendMarkdown(`**Tags:** ${tags.join(", ")}\n\n`);
        }
      } catch {
        // Ignore parse errors
      }
    }

    tooltip.appendMarkdown(`**Type:** ${template.type}\n\n`);
    tooltip.appendMarkdown(`**Used:** ${template.usage_count || 0} times\n\n`);

    return tooltip;
  }
}
