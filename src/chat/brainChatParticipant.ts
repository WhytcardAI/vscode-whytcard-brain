/**
 * WhytCard Brain - Chat Participant
 * @brain participant - AUTOMATIQUE
 *
 * Comportement:
 * 1. L'utilisateur pose une question
 * 2. On cherche d'abord dans la base locale
 * 3. Si trouvé → on répond avec la doc locale
 * 4. Si pas trouvé → on propose d'utiliser les outils MCP web
 * 5. Quand on trouve → on enregistre automatiquement
 */

import * as vscode from "vscode";
import { getBrainService, type Doc, type Pitfall } from "../services/brainService";

interface ChatResult extends vscode.ChatResult {
  metadata?: {
    localFound: boolean;
    docsCount: number;
    pitfallsCount: number;
  };
}

/**
 * Register the @brain chat participant
 */
export function registerBrainChatParticipant(_context: vscode.ExtensionContext): vscode.Disposable {
  const chat = (vscode as any).chat as
    | { createChatParticipant?: (...args: any[]) => any }
    | undefined;
  if (!chat || typeof chat.createChatParticipant !== "function") {
    console.log(
      "Brain chat participant not available in this host. Skipping chat participant registration.",
    );
    return new vscode.Disposable(() => {});
  }

  const participant = chat.createChatParticipant(
    "whytcard-brain.brain",
    handleRequest,
  ) as vscode.ChatParticipant;

  // Follow-up suggestions
  participant.followupProvider = {
    provideFollowups(result: ChatResult): vscode.ChatFollowup[] {
      const followups: vscode.ChatFollowup[] = [];

      // Si rien trouvé localement, proposer la recherche web
      if (!result.metadata?.localFound) {
        followups.push({
          prompt: "Cherche sur le web et enregistre la doc",
          label: "🌐 Chercher sur le web",
        });
      }

      return followups;
    },
  };

  return participant;
}

/**
 * Main handler - comportement automatique
 */
async function handleRequest(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  _token: vscode.CancellationToken,
): Promise<ChatResult> {
  const service = getBrainService();
  const query = request.prompt.trim();

  if (!query) {
    stream.markdown(`## 🧠 WhytCard Brain\n\n`);
    stream.markdown(`Pose-moi une question technique et je cherche dans ma base.\n\n`);
    stream.markdown(`**Exemples:**\n`);
    stream.markdown(`- \`@brain next.js async params\`\n`);
    stream.markdown(`- \`@brain tailwind dark mode\`\n`);
    stream.markdown(`- \`@brain react useEffect cleanup\`\n`);

    const stats = service.getStats();
    stream.markdown(`\n---\n📚 **${stats.docs}** docs | ⚠️ **${stats.pitfalls}** bugs connus\n`);

    return { metadata: { localFound: true, docsCount: 0, pitfallsCount: 0 } };
  }

  // Détecter la librairie automatiquement
  const library = detectLibrary(query);

  // Chercher dans la base locale
  stream.progress("Recherche dans la base locale...");
  const docs = service.searchDocs(query, library);
  const pitfalls = service.searchPitfalls(query);

  // TROUVÉ LOCALEMENT
  if (docs.length > 0 || pitfalls.length > 0) {
    return showLocalResults(stream, docs, pitfalls, query);
  }

  // PAS TROUVÉ → proposer la recherche web
  return showNotFound(stream, query, library, service);
}

/**
 * Afficher les résultats locaux
 */
function showLocalResults(
  stream: vscode.ChatResponseStream,
  docs: Doc[],
  pitfalls: Pitfall[],
  _query: string,
): ChatResult {
  stream.markdown(`## ✅ Trouvé dans la base\n\n`);

  // Documentation
  if (docs.length > 0) {
    stream.markdown(`### 📚 Documentation (${docs.length})\n\n`);

    for (const doc of docs.slice(0, 3)) {
      // Add reference to "Used references"
      const safeTitle = doc.title.replace(/[^a-zA-Z0-9-_ ]/g, "");
      const uri = vscode.Uri.parse(`brain://doc/${doc.id}/${safeTitle}`);
      stream.reference(uri);

      stream.markdown(`#### ${doc.title}\n`);
      stream.markdown(`*${doc.library}* • ${doc.topic}\n\n`);

      // Contenu (tronqué si trop long)
      const content =
        doc.content.length > 1500
          ? doc.content.substring(0, 1500) + "\n\n*... (tronqué)*"
          : doc.content;
      stream.markdown(content + "\n\n");

      if (doc.url) {
        stream.markdown(`🔗 [Source](${doc.url})\n\n`);
      }
      stream.markdown("---\n\n");
    }
  }

  // Pitfalls/Bugs
  if (pitfalls.length > 0) {
    stream.markdown(`### ⚠️ Bugs connus (${pitfalls.length})\n\n`);

    for (const p of pitfalls.slice(0, 2)) {
      // Add reference to "Used references"
      const safeSymptom = p.symptom.replace(/[^a-zA-Z0-9-_ ]/g, "").substring(0, 30);
      const uri = vscode.Uri.parse(`brain://pitfall/${p.id}/${safeSymptom}`);
      stream.reference(uri);

      stream.markdown(`#### 🔴 ${p.symptom}\n\n`);

      if (p.error) {
        stream.markdown("```\n" + p.error + "\n```\n\n");
      }

      stream.markdown(`**✅ Solution:** ${p.solution}\n\n`);

      if (p.code) {
        stream.markdown("```typescript\n" + p.code + "\n```\n\n");
      }
      stream.markdown("---\n\n");
    }
  }

  return {
    metadata: {
      localFound: true,
      docsCount: docs.length,
      pitfallsCount: pitfalls.length,
    },
  };
}

/**
 * Afficher "pas trouvé" et proposer la recherche web
 */
function showNotFound(
  stream: vscode.ChatResponseStream,
  query: string,
  library: string | undefined,
  _service: ReturnType<typeof getBrainService>,
): ChatResult {
  stream.markdown(`## ❌ Pas trouvé dans la base\n\n`);
  stream.markdown(`Recherche: **${query}**\n\n`);

  stream.markdown(`### 🌐 Pour chercher sur le web:\n\n`);
  stream.markdown(`Utilise ces outils MCP dans ta prochaine requête:\n\n`);

  // Context7 pour les docs officielles
  const ctx7Lib = getContext7Library(library || query);
  if (ctx7Lib) {
    stream.markdown(`**Documentation officielle** (Context7):\n`);
    stream.markdown("```\n");
    stream.markdown(`mcp_context7_get-library-docs\n`);
    stream.markdown(`  context7CompatibleLibraryID: "${ctx7Lib}"\n`);
    stream.markdown(`  topic: "${query}"\n`);
    stream.markdown("```\n\n");
  }

  // Tavily pour recherche web
  stream.markdown(`**Recherche web** (Tavily):\n`);
  stream.markdown("```\n");
  stream.markdown(`mcp_tavily_tavily-search\n`);
  stream.markdown(`  query: "${query}"\n`);
  stream.markdown("```\n\n");

  stream.markdown(`---\n`);
  stream.markdown(`*💡 Quand tu trouves la doc, dis-moi et je l'enregistre automatiquement.*\n`);

  return {
    metadata: {
      localFound: false,
      docsCount: 0,
      pitfallsCount: 0,
    },
  };
}

/**
 * Détecter la librairie depuis la query
 */
function detectLibrary(query: string): string | undefined {
  const q = query.toLowerCase();

  if (q.includes("next") || q.includes("app router") || q.includes("nextjs")) {
    return "next.js";
  }
  if (q.includes("react") || q.includes("hook")) {
    return "react";
  }
  if (q.includes("tailwind")) {
    return "tailwind";
  }
  if (q.includes("typescript") || q.includes("ts ")) {
    return "typescript";
  }
  if (q.includes("zod")) {
    return "zod";
  }
  if (q.includes("prisma")) {
    return "prisma";
  }
  if (q.includes("shadcn")) {
    return "shadcn";
  }

  return undefined;
}

/**
 * Obtenir l'ID Context7 pour une librairie
 */
function getContext7Library(query: string): string | null {
  const q = query.toLowerCase();

  if (q.includes("next") || q.includes("nextjs")) {
    return "/vercel/next.js";
  }
  if (q.includes("react")) {
    return "/facebook/react";
  }
  if (q.includes("tailwind")) {
    return "/tailwindlabs/tailwindcss";
  }
  if (q.includes("typescript")) {
    return "/microsoft/TypeScript";
  }
  if (q.includes("zod")) {
    return "/colinhacks/zod";
  }
  if (q.includes("prisma")) {
    return "/prisma/prisma";
  }

  return null;
}
