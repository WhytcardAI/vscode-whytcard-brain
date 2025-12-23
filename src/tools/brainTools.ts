/**
 * WhytCard Brain - Language Model Tools
 * Ces outils sont appeles AUTOMATIQUEMENT par Copilot
 */

import * as vscode from "vscode";
import { getBrainService, trackError, trackUsage } from "../services/brainService";
import { ProjectInitService } from "../services/projectInitService";
import { DiagnosticsService } from "../services/diagnosticsService";

// Interfaces pour les inputs des outils
interface SearchDocsInput {
  query: string;
  library?: string;
  category?: string;
}

interface StoreDocInput {
  library: string;
  topic: string;
  title: string;
  content: string;
  url?: string;
  category?: string;
}

interface StorePitfallInput {
  symptom: string;
  solution: string;
  error?: string;
  library?: string;
  code?: string;
}

interface TemplateSearchInput {
  query: string;
  framework?: string;
  type?: "snippet" | "file" | "multifile";
}

interface TemplateSaveInput {
  name: string;
  description: string;
  type: "snippet" | "file" | "multifile";
  content: string;
  framework?: string;
  language?: string;
  tags?: string[];
}

interface TemplateApplyInput {
  name: string;
}

// Pas d'input requis pour getInstructions et getContext
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GetInstructionsInput {
  // vide - retourne toutes les instructions
}

interface GetContextInput {
  projectPath?: string;
}

interface ConsultInput {
  query: string;
  library?: string;
  category?: "instruction" | "documentation" | "project";
  projectPath?: string;
  includeInstructions?: boolean;
  includeContext?: boolean;
  maxDocs?: number;
  maxPitfalls?: number;
}

/**
 * Outil pour recuperer TOUTES les instructions
 */
class GetInstructionsTool implements vscode.LanguageModelTool<GetInstructionsInput> {
  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<GetInstructionsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("getInstructionsCount");
      const service = getBrainService();
      const instructions = service.getAllInstructions();

      if (instructions.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Aucune instruction trouvee dans le Brain.\n` +
              `Utilise whytcard-brain_storeDoc avec category='instruction' pour en ajouter.`,
          ),
        ]);
      }

      let result = `## Instructions a suivre (${instructions.length})\n\n`;
      result += `> Ces regles sont OBLIGATOIRES. Tu dois les respecter.\n\n`;

      for (const doc of instructions) {
        result += `### ${doc.title}\n`;
        result += `**Librairie:** ${doc.library} | **Sujet:** ${doc.topic}\n\n`;
        result += doc.content + "\n\n";
        result += "---\n\n";
      }

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`getInstructions: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Erreur lors de la recuperation des instructions: ${errMsg}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<GetInstructionsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Chargement des instructions obligatoires...`,
    };
  }
}

/**
 * Outil pour recuperer le contexte projet
 */
class GetContextTool implements vscode.LanguageModelTool<GetContextInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetContextInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("getContextCount");
      const service = getBrainService();
      const contextDocs = service.getProjectContext(options.input.projectPath);

      if (contextDocs.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Aucun contexte projet trouve dans le Brain.\n` +
              `Utilise whytcard-brain_storeDoc avec category='project' pour documenter l'architecture.`,
          ),
        ]);
      }

      let result = `## Contexte projet (${contextDocs.length})\n\n`;

      for (const doc of contextDocs) {
        result += `### ${doc.title}\n`;
        result += `**Scope:** ${doc.library} | **Sujet:** ${doc.topic}\n\n`;
        result += doc.content + "\n\n";
        result += "---\n\n";
      }

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`getContext: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de la recuperation du contexte: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<GetContextInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Chargement du contexte projet...`,
    };
  }
}

/**
 * Outil de recherche - appele automatiquement par Copilot
 */
class SearchDocsTool implements vscode.LanguageModelTool<SearchDocsInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SearchDocsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("searchCount");
      const { query, library, category } = options.input;
      const service = getBrainService();

      // Recherche docs avec filtre library et category optionnels
      const docs = service.searchDocs(query, library, category);
      const pitfalls = service.searchPitfalls(query);

      if (docs.length === 0 && pitfalls.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Aucune documentation locale trouvee pour "${query}". ` +
              `Utilise Context7 ou Tavily pour chercher sur le web, puis utilise whytcard-brain_storeDoc pour sauvegarder.`,
          ),
        ]);
      }

      let result = `## Documentation locale trouvee\n\n`;

      if (docs.length > 0) {
        result += `### Documentation (${docs.length} resultats)\n\n`;
        for (const doc of docs.slice(0, 5)) {
          result += `#### ${doc.title}\n`;
          result += `**Librairie:** ${doc.library} | **Sujet:** ${doc.topic}`;
          if (doc.category) {
            result += ` | **Categorie:** ${doc.category}`;
          }
          result += `\n\n`;
          result += doc.content + "\n\n";
          if (doc.url) {
            result += `Source: ${doc.url}\n\n`;
          }
          result += "---\n\n";
        }
      }

      if (pitfalls.length > 0) {
        result += `### Bugs connus (${pitfalls.length} resultats)\n\n`;
        for (const p of pitfalls.slice(0, 3)) {
          result += `#### ${p.symptom}\n\n`;
          if (p.error) {
            result += "```\n" + p.error + "\n```\n\n";
          }
          result += `**Solution:** ${p.solution}\n\n`;
          if (p.code) {
            result += "```typescript\n" + p.code + "\n```\n\n";
          }
          result += "---\n\n";
        }
      }

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`searchDocs: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de la recherche dans Brain: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SearchDocsInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Recherche "${options.input.query}" dans la base Brain...`,
    };
  }
}

/**
 * Outil composite: charge instructions + contexte + recherche locale.
 * Objectif: maximiser l'usage "natif" de Brain en une seule invocation.
 */
class ConsultTool implements vscode.LanguageModelTool<ConsultInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ConsultInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const service = getBrainService();
      const {
        query,
        library,
        category,
        projectPath,
        includeInstructions,
        includeContext,
        maxDocs,
        maxPitfalls,
      } = options.input;

      const includeInstr = includeInstructions !== false;
      const includeCtx = includeContext !== false;
      const docsLimit = typeof maxDocs === "number" ? Math.max(1, Math.min(10, maxDocs)) : 5;
      const pitfallsLimit =
        typeof maxPitfalls === "number" ? Math.max(0, Math.min(10, maxPitfalls)) : 3;

      let result = `## Brain consult\n\n`;
      result += `**Query:** ${query}\n`;
      if (library) {
        result += `**Library filter:** ${library}\n`;
      }
      if (category) {
        result += `**Category filter:** ${category}\n`;
      }
      result += `\n---\n\n`;

      // Instructions
      if (includeInstr) {
        trackUsage("getInstructionsCount");
        const instructions = service.getAllInstructions();
        result += `### Instructions (mandatory) (${instructions.length})\n\n`;
        if (instructions.length === 0) {
          result += `No instruction found in Brain.\n\n`;
        } else {
          for (const doc of instructions.slice(0, 3)) {
            result += `#### ${doc.title}\n`;
            result += `**Library:** ${doc.library} | **Topic:** ${doc.topic}\n\n`;
            // Keep it concise to avoid flooding the chat
            const content =
              doc.content.length > 1200
                ? doc.content.substring(0, 1200) + "\n\n... (truncated)"
                : doc.content;
            result += content + `\n\n---\n\n`;
          }

          if (instructions.length > 3) {
            result += `*(Showing 3/${instructions.length}. Use #brainInstructions to load all.)*\n\n`;
          }
        }
      }

      // Context
      if (includeCtx) {
        trackUsage("getContextCount");
        const contextDocs = service.getProjectContext(projectPath);
        result += `### Project context (${contextDocs.length})\n\n`;
        if (contextDocs.length === 0) {
          result += `No project context found in Brain.\n\n`;
        } else {
          for (const doc of contextDocs.slice(0, 2)) {
            result += `#### ${doc.title}\n`;
            result += `**Scope:** ${doc.library} | **Topic:** ${doc.topic}\n\n`;
            const content =
              doc.content.length > 1200
                ? doc.content.substring(0, 1200) + "\n\n... (truncated)"
                : doc.content;
            result += content + `\n\n---\n\n`;
          }

          if (contextDocs.length > 2) {
            result += `*(Showing 2/${contextDocs.length}. Use #brainContext to load all.)*\n\n`;
          }
        }
      }

      // Local search
      trackUsage("searchCount");
      const docsAll = service.searchDocs(query, library, category);
      const pitfallsAll = service.searchPitfalls(query);

      // If we already included instructions, avoid returning instruction docs again unless user explicitly asked.
      const docs =
        includeInstr && !category
          ? docsAll.filter((d) => (d.category || "documentation") !== "instruction")
          : docsAll;

      result += `### Local documentation (${docs.length})\n\n`;
      if (docs.length === 0) {
        result += `No local docs matched.\n\n`;
      } else {
        for (const doc of docs.slice(0, docsLimit)) {
          result += `#### ${doc.title}\n`;
          result += `**Library:** ${doc.library} | **Topic:** ${doc.topic}`;
          if (doc.category) {
            result += ` | **Category:** ${doc.category}`;
          }
          result += `\n\n`;
          const content =
            doc.content.length > 1500
              ? doc.content.substring(0, 1500) + "\n\n... (truncated)"
              : doc.content;
          result += content + `\n\n`;
          if (doc.url) {
            result += `Source: ${doc.url}\n\n`;
          }
          result += `---\n\n`;
        }
        if (docs.length > docsLimit) {
          result += `*(Showing ${docsLimit}/${docs.length}. Use #brain for more.)*\n\n`;
        }
      }

      result += `### Known pitfalls (${pitfallsAll.length})\n\n`;
      const pitfalls = pitfallsAll.slice(0, pitfallsLimit);
      if (pitfalls.length === 0) {
        result += `No known pitfall matched.\n\n`;
      } else {
        for (const p of pitfalls) {
          result += `#### ${p.symptom}\n\n`;
          if (p.error) {
            result += "```\n" + p.error + "\n```\n\n";
          }
          result += `**Solution:** ${p.solution}\n\n`;
          if (p.code) {
            result += "```typescript\n" + p.code + "\n```\n\n";
          }
          result += `---\n\n`;
        }
      }

      result += `> Hint: If nothing is found locally, use Context7/Tavily and then save via #brainSave.\n`;

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`consult: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors du consult Brain: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ConsultInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Consult Brain: instructions + context + search for "${options.input.query}"...`,
    };
  }
}

/**
 * Outil pour sauvegarder de la doc - appele automatiquement par Copilot
 */
class StoreDocTool implements vscode.LanguageModelTool<StoreDocInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<StoreDocInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("storeDocCount");
      const { library, topic, title, content, url, category } = options.input;
      const service = getBrainService();

      const id = service.upsertDoc({
        library,
        topic,
        title,
        content,
        url,
        category: category || "documentation",
        source: "copilot",
      });

      if (id) {
        // Refresh les tree views
        vscode.commands.executeCommand("whytcard-brain.refresh");

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Documentation enregistree avec succes!\n` +
              `- **ID:** ${id}\n` +
              `- **Librairie:** ${library}\n` +
              `- **Sujet:** ${topic}\n` +
              `- **Titre:** ${title}\n` +
              `- **Categorie:** ${category || "documentation"}`,
          ),
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'enregistrement de la documentation.`),
      ]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`storeDoc: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'enregistrement: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<StoreDocInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Enregistrement de "${options.input.title}" dans Brain...`,
      confirmationMessages: {
        title: "Sauvegarder documentation",
        message: new vscode.MarkdownString(
          `Enregistrer cette documentation?\n\n` +
            `**Librairie:** ${options.input.library}\n` +
            `**Sujet:** ${options.input.topic}\n` +
            `**Titre:** ${options.input.title}`,
        ),
      },
    };
  }
}

/**
 * Outil pour sauvegarder un bug - appele automatiquement par Copilot
 */
class StorePitfallTool implements vscode.LanguageModelTool<StorePitfallInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<StorePitfallInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("storePitfallCount");
      const { symptom, solution, error, library, code } = options.input;
      const service = getBrainService();

      const id = service.addPitfall({
        symptom,
        solution,
        error,
        library,
        code,
      });

      if (id) {
        // Refresh les tree views
        vscode.commands.executeCommand("whytcard-brain.refresh");

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Bug enregistre avec succes!\n` +
              `- **ID:** ${id}\n` +
              `- **Symptome:** ${symptom.substring(0, 50)}...\n` +
              `- **Librairie:** ${library || "non specifiee"}`,
          ),
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'enregistrement du bug.`),
      ]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`storePitfall: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'enregistrement: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<StorePitfallInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Enregistrement du bug dans Brain...`,
      confirmationMessages: {
        title: "Sauvegarder bug",
        message: new vscode.MarkdownString(
          `Enregistrer ce bug?\n\n` +
            `**Symptome:** ${options.input.symptom.substring(0, 100)}...\n` +
            `**Solution:** ${options.input.solution.substring(0, 100)}...`,
        ),
      },
    };
  }
}

// Interface pour logSession
interface LogSessionInput {
  project: string;
  summary: string;
  nextSteps?: string;
  decisions?: string;
}

/**
 * Outil pour logger une session de travail - append au contexte existant
 */
class LogSessionTool implements vscode.LanguageModelTool<LogSessionInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LogSessionInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("storeDocCount"); // Compte comme un store
      const { project, summary, nextSteps, decisions } = options.input;
      const service = getBrainService();

      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeStr = now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let sessionContent = `## Session du ${dateStr} a ${timeStr}\n\n`;
      sessionContent += `### Resume\n${summary}\n\n`;

      if (decisions) {
        sessionContent += `### Decisions prises\n${decisions}\n\n`;
      }

      if (nextSteps) {
        sessionContent += `### Prochaines etapes\n${nextSteps}\n`;
      }

      const id = service.appendToDoc(
        project,
        "sessions",
        `Journal de sessions - ${project}`,
        sessionContent,
      );

      if (id) {
        vscode.commands.executeCommand("whytcard-brain.refresh");

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Session enregistree pour ${project}!\n` +
              `- **Date:** ${dateStr} ${timeStr}\n` +
              `- **ID doc:** ${id}\n\n` +
              `Le contexte projet a ete mis a jour.`,
          ),
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'enregistrement de la session.`),
      ]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`logSession: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<LogSessionInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Enregistrement de la session pour ${options.input.project}...`,
    };
  }
}

// Interface pour initProject
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InitProjectInput {
  // pas d'input nécessaire
}

/**
 * Outil pour initialiser le projet (scan stack + plan d'action)
 */
class InitProjectTool implements vscode.LanguageModelTool<InitProjectInput> {
  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<InitProjectInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("searchCount"); // Use search count as proxy for now or add new metric
      const initService = new ProjectInitService();
      const plan = await initService.generateInitPlan();

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(plan)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`initProject: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur lors de l'initialisation: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<InitProjectInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Analyse du projet et génération du plan d'initialisation...`,
    };
  }
}

// Interface pour analyzeError
interface AnalyzeErrorInput {
  error: string;
}

/**
 * Outil pour analyser une erreur (connu vs inconnu)
 */
class AnalyzeErrorTool implements vscode.LanguageModelTool<AnalyzeErrorInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AnalyzeErrorInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("searchCount");
      const diagnostics = new DiagnosticsService();
      const result = await diagnostics.analyzeError(options.input.error);

      if (result.known && result.pitfall) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `✅ Bug CONNU dans Brain !\n\n` +
              `**Symptôme:** ${result.pitfall.symptom}\n` +
              `**Solution:** ${result.pitfall.solution}\n\n` +
              `Tu peux répondre immédiatement avec cette solution.`,
          ),
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `❌ Bug INCONNU dans Brain.\n\n` +
            `**Action requise:**\n` +
            `1. Cherche la solution sur le web (via MCP/Tavily/Context7).\n` +
            `2. Une fois la solution trouvée et vérifiée, SAUVEGARDE-LA avec \`whytcard-brain_storePitfall\`.\n\n` +
            `Suggestion de symptôme pour la sauvegarde: "${result.suggestion?.symptom}"`,
        ),
      ]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`analyzeError: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur d'analyse: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<AnalyzeErrorInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Analyse de l'erreur dans Brain...`,
    };
  }
}

/**
 * Outil pour rechercher des templates de code
 */
class TemplateSearchTool implements vscode.LanguageModelTool<TemplateSearchInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<TemplateSearchInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("searchCount");
      const { query, framework, type } = options.input;
      const service = getBrainService();

      const templates = service.searchTemplates(query, framework, type);

      if (templates.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Aucun template trouvé pour "${query}". Tu peux en créer un avec whytcard-brain_templateSave.`,
          ),
        ]);
      }

      let result = `## 📄 Templates trouvés (${templates.length})\n\n`;

      for (const t of templates.slice(0, 5)) {
        result += `### ${t.name} (${t.type})\n`;
        result += `**Description:** ${t.description}\n`;
        if (t.framework) result += `**Framework:** ${t.framework}\n`;
        if (t.language) result += `**Language:** ${t.language}\n`;
        result += `**Utilisé:** ${t.usage_count || 0} fois\n`;
        result += `**Aperçu:**\n\`\`\`\n${t.content.substring(0, 150)}${t.content.length > 150 ? "..." : ""}\n\`\`\`\n\n`;
        result += `Utilise whytcard-brain_templateApply avec name="${t.name}" pour l'appliquer.\n\n`;
      }

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`templateSearch: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur de recherche: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<TemplateSearchInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Recherche de templates pour "${options.input.query}"...`,
    };
  }
}

/**
 * Outil pour sauvegarder un template de code
 */
class TemplateSaveTool implements vscode.LanguageModelTool<TemplateSaveInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<TemplateSaveInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("storeDocCount");
      const { name, description, type, content, framework, language, tags } = options.input;
      const service = getBrainService();

      const existing = service.getTemplateByName(name);
      if (existing) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `❌ Template "${name}" existe déjà. Utilise un nom différent.`,
          ),
        ]);
      }

      const tagsJson = tags ? JSON.stringify(tags) : undefined;

      const template = service.addTemplate({
        name,
        description,
        type,
        content,
        framework,
        language,
        tags: tagsJson,
      });

      if (template) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `✅ Template "${name}" sauvegardé !\n` +
              `Type: ${type}\n` +
              `Framework: ${framework || "N/A"}\n\n` +
              `Tu peux maintenant le réutiliser avec whytcard-brain_templateSearch.`,
          ),
        ]);
      } else {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("❌ Échec de la sauvegarde du template."),
        ]);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`templateSave: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<TemplateSaveInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Sauvegarde du template "${options.input.name}"...`,
    };
  }
}

/**
 * Outil pour appliquer un template
 */
class TemplateApplyTool implements vscode.LanguageModelTool<TemplateApplyInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<TemplateApplyInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      trackUsage("searchCount");
      const { name } = options.input;
      const service = getBrainService();

      const template = service.getTemplateByName(name);

      if (!template) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `❌ Template "${name}" introuvable. Utilise whytcard-brain_templateSearch pour trouver les templates disponibles.`,
          ),
        ]);
      }

      if (template.id) {
        service.incrementTemplateUsage(template.id);
      }

      let result = `## ✅ Template: ${template.name}\n\n`;
      result += `**Type:** ${template.type}\n`;
      result += `**Description:** ${template.description}\n`;
      if (template.framework) result += `**Framework:** ${template.framework}\n`;
      if (template.language) result += `**Language:** ${template.language}\n`;
      result += `\n### Contenu\n\n`;

      if (template.type === "multifile") {
        result += `Structure multi-fichiers:\n\`\`\`json\n${template.content}\n\`\`\`\n\n`;
        result += `Parse ce JSON et crée les fichiers correspondants.`;
      } else {
        result += `\`\`\`\n${template.content}\n\`\`\``;
      }

      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      trackError(`templateApply: ${errMsg}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Erreur: ${errMsg}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<TemplateApplyInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Application du template "${options.input.name}"...`,
    };
  }
}

/**
 * Enregistre tous les outils LM
 */
export function registerBrainTools(context: vscode.ExtensionContext): void {
  const lm = (vscode as any).lm as
    | { registerTool?: (...args: any[]) => vscode.Disposable }
    | undefined;
  if (!lm || typeof lm.registerTool !== "function") {
    console.log("Brain LM tools not available in this host. Skipping LM tool registration.");
    return;
  }

  context.subscriptions.push(
    lm.registerTool("whytcard-brain_getInstructions", new GetInstructionsTool()),
    lm.registerTool("whytcard-brain_getContext", new GetContextTool()),
    lm.registerTool("whytcard-brain_searchDocs", new SearchDocsTool()),
    lm.registerTool("whytcard-brain_consult", new ConsultTool()),
    lm.registerTool("whytcard-brain_storeDoc", new StoreDocTool()),
    lm.registerTool("whytcard-brain_storePitfall", new StorePitfallTool()),
    lm.registerTool("whytcard-brain_logSession", new LogSessionTool()),
    lm.registerTool("whytcard-brain_initProject", new InitProjectTool()),
    lm.registerTool("whytcard-brain_analyzeError", new AnalyzeErrorTool()),
    lm.registerTool("whytcard-brain_templateSearch", new TemplateSearchTool()),
    lm.registerTool("whytcard-brain_templateSave", new TemplateSaveTool()),
    lm.registerTool("whytcard-brain_templateApply", new TemplateApplyTool()),
  );

  console.log(
    "Brain LM tools registered (12 tools) - Copilot peut maintenant les utiliser automatiquement",
  );
}

// ... reste du code ...
