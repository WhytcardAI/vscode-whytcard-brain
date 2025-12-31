/**
 * Configuration options for Brain instructions
 */
export interface BrainInstructionConfig {
  strictMode: "off" | "moderate" | "strict";
  autoSave: "off" | "ask" | "always";
  autoSaveTemplates: boolean;
  instructionStyle: "minimal" | "standard" | "verbose";
  enabledTools: {
    consult: boolean;
    getInstructions: boolean;
    getContext: boolean;
    searchDocs: boolean;
    storeDoc: boolean;
    storePitfall: boolean;
    logSession: boolean;
    initProject: boolean;
    analyzeError: boolean;
    validate: boolean;
    templateSearch: boolean;
    templateSave: boolean;
    templateApply: boolean;
  };
  language: "auto" | "en" | "fr";
}

const DEFAULT_CONFIG: BrainInstructionConfig = {
  strictMode: "moderate",
  autoSave: "always",
  autoSaveTemplates: true,
  instructionStyle: "standard",
  enabledTools: {
    consult: true,
    getInstructions: true,
    getContext: true,
    searchDocs: true,
    storeDoc: true,
    storePitfall: true,
    logSession: true,
    initProject: true,
    analyzeError: true,
    validate: true,
    templateSearch: true,
    templateSave: true,
    templateApply: true,
  },
  language: "auto",
};

/**
 * Build instructions based on configuration
 */
function buildInstructionsFromConfig(
  config: BrainInstructionConfig,
  format: "copilot" | "cursor" | "windsurf",
): string {
  const lang = config.language === "auto" ? "en" : config.language;
  const isMinimal = config.instructionStyle === "minimal";
  const isVerbose = config.instructionStyle === "verbose";

  const texts = {
    en: {
      title: "WhytCard Brain Agent Rules",
      intro:
        "You are an expert agent powered by a local knowledge base (Brain). Your goal is to be rigorously accurate and constantly learning.",
      introMinimal: "Use Brain tools for accurate, grounded answers.",
      consultTitle: "ALWAYS CONSULT BRAIN FIRST",
      consultRule: "Call `{tool}brainConsult` before planning, coding, or answering.",
      consultRuleOff: "Consider calling `{tool}brainConsult` to check local knowledge.",
      consultFallback:
        "If Brain is missing/incomplete: fetch OFFICIAL documentation, then store it using `{tool}brainSave`.",
      zeroHallucinationTitle: "ZERO HALLUCINATION POLICY",
      zeroHallucinationRule: "NEVER guess or rely on outdated training data. ALWAYS verify facts.",
      zeroHallucinationStrict:
        'If you cannot find official documentation, state clearly: "I cannot find official documentation for this."',
      zeroHallucinationModerate:
        "If local docs are missing, you may use training data but clearly indicate uncertainty.",
      saveTitle: "CONTINUOUS LEARNING",
      saveRuleAlways: "When you find new useful info, save it immediately using `{tool}brainSave`.",
      saveRuleAsk:
        "When you find new useful info, ask the user before saving with `{tool}brainSave`.",
      saveRuleOff: "Do not auto-save documentation.",
      bugRule: "When you solve a bug or error, save it using `{tool}brainBug`.",
      sessionRule: "At the end of significant work, log the session with `{tool}brainSession`.",
      templateTitle: "SAVE REUSABLE CODE",
      templateRule: "When you generate a reusable block, save it with `{tool}brainTemplateSave`.",
      proofTitle: "PROOF-BASED ANSWERS",
      proofRule: 'Start answers with your source: "Based on [Local Brain/Official Doc]..."',
      proofRuleStrict: "Always provide source URLs for claims.",
    },
    fr: {
      title: "Règles de l'Agent WhytCard Brain",
      intro:
        "Tu es un agent expert alimenté par une base de connaissances locale (Brain). Ton objectif est d'être rigoureusement précis et d'apprendre continuellement.",
      introMinimal: "Utilise les outils Brain pour des réponses précises et fondées.",
      consultTitle: "TOUJOURS CONSULTER BRAIN D'ABORD",
      consultRule: "Appelle `{tool}brainConsult` avant de planifier, coder ou répondre.",
      consultRuleOff:
        "Considère appeler `{tool}brainConsult` pour vérifier les connaissances locales.",
      consultFallback:
        "Si Brain est incomplet : cherche la documentation OFFICIELLE, puis stocke-la avec `{tool}brainSave`.",
      zeroHallucinationTitle: "POLITIQUE ZÉRO HALLUCINATION",
      zeroHallucinationRule:
        "Ne JAMAIS deviner ou utiliser des données d'entraînement obsolètes. TOUJOURS vérifier les faits.",
      zeroHallucinationStrict:
        'Si tu ne trouves pas de documentation officielle, dis clairement : "Je ne trouve pas de documentation officielle pour cela."',
      zeroHallucinationModerate:
        "Si les docs locales manquent, tu peux utiliser tes connaissances mais indique clairement l'incertitude.",
      saveTitle: "APPRENTISSAGE CONTINU",
      saveRuleAlways:
        "Quand tu trouves une info utile, sauvegarde-la immédiatement avec `{tool}brainSave`.",
      saveRuleAsk:
        "Quand tu trouves une info utile, demande à l'utilisateur avant de sauvegarder avec `{tool}brainSave`.",
      saveRuleOff: "Ne pas sauvegarder automatiquement la documentation.",
      bugRule: "Quand tu résous un bug, sauvegarde-le avec `{tool}brainBug`.",
      sessionRule:
        "À la fin d'un travail significatif, enregistre la session avec `{tool}brainSession`.",
      templateTitle: "SAUVEGARDER LE CODE RÉUTILISABLE",
      templateRule:
        "Quand tu génères un bloc réutilisable, sauvegarde-le avec `{tool}brainTemplateSave`.",
      proofTitle: "RÉPONSES BASÉES SUR DES PREUVES",
      proofRule: 'Commence tes réponses par ta source : "Basé sur [Brain Local/Doc Officielle]..."',
      proofRuleStrict: "Fournis toujours les URLs sources pour tes affirmations.",
    },
  };

  const t = texts[lang];
  const toolPrefix = format === "copilot" ? "#tool:" : "";
  const replace = (s: string) => s.replace(/\{tool\}/g, toolPrefix);

  const lines: string[] = [];

  // Title
  lines.push(`# ${t.title}`);
  lines.push("");
  lines.push(isMinimal ? t.introMinimal : t.intro);
  lines.push("");

  // MCP Tools Section for Windsurf/Cursor
  if (format === "windsurf" || format === "cursor") {
    lines.push(`## HOW TO USE BRAIN TOOLS`);
    lines.push("");
    lines.push(
      `Brain tools are exposed via MCP (Model Context Protocol) server \`whytcard-brain\`.`,
    );
    lines.push(
      `**You MUST call these tools using your MCP tool calling capability.** Do NOT say "I cannot access Brain" - you have the tools available.`,
    );
    lines.push("");
    lines.push(`| Tool Name | Description |`);
    lines.push(`|-----------|-------------|`);
    lines.push(`| \`brainConsult\` | **CALL FIRST** - Load instructions + search docs |`);
    lines.push(`| \`brainSave\` | Store new documentation (requires URL) |`);
    lines.push(`| \`brainBug\` | Record a bug/error and its solution |`);
    lines.push(`| \`brainSession\` | Log a work session summary |`);
    lines.push(`| \`brainSearch\` | Search the knowledge base |`);
    lines.push("");
    lines.push(
      `**How to call:** Use your tool calling capability with the tool name and parameters.`,
    );
    lines.push("");
    lines.push(`Example parameters for brainConsult:`);
    lines.push("```json");
    lines.push(`{ "query": "nextjs app router params" }`);
    lines.push("```");
    lines.push("");
  }

  // LM Tools Section for Copilot
  if (format === "copilot") {
    lines.push(`## HOW TO USE BRAIN TOOLS`);
    lines.push("");
    lines.push(
      `Brain tools are registered as VS Code Language Model tools with prefix \`whytcard-brain_\`.`,
    );
    lines.push(
      `**You MUST call these tools using your tool calling capability.** Do NOT say "I cannot access Brain" - you have the tools available.`,
    );
    lines.push("");
    lines.push(`| Tool Name | Description |`);
    lines.push(`|-----------|-------------|`);
    lines.push(`| \`#tool:brainConsult\` | **CALL FIRST** - Load instructions + search docs |`);
    lines.push(`| \`#tool:brainSave\` | Store new documentation (requires URL) |`);
    lines.push(`| \`#tool:brainBug\` | Record a bug/error and its solution |`);
    lines.push(`| \`#tool:brainSession\` | Log a work session summary |`);
    lines.push(`| \`#tool:brainSearch\` | Search the knowledge base |`);
    lines.push("");
  }

  // 1. Consult Brain
  if (config.enabledTools.consult) {
    lines.push(`## 1. ${t.consultTitle}`);
    if (config.strictMode === "off") {
      lines.push(`- ${replace(t.consultRuleOff)}`);
    } else {
      lines.push(`- **Mandatory:** ${replace(t.consultRule)}`);
      if (!isMinimal) {
        lines.push(`- ${replace(t.consultFallback)}`);
      }
    }
    lines.push("");
  }

  // 2. Zero Hallucination
  if (config.strictMode !== "off") {
    lines.push(`## 2. ${t.zeroHallucinationTitle}`);
    lines.push(`- ${t.zeroHallucinationRule}`);
    if (config.strictMode === "strict") {
      lines.push(`- ${t.zeroHallucinationStrict}`);
    } else if (isVerbose) {
      lines.push(`- ${t.zeroHallucinationModerate}`);
    }
    lines.push("");
  }

  // 3. Continuous Learning
  if (config.enabledTools.storeDoc || config.enabledTools.storePitfall) {
    lines.push(`## 3. ${t.saveTitle}`);
    if (config.enabledTools.storeDoc) {
      if (config.autoSave === "always") {
        lines.push(`- ${replace(t.saveRuleAlways)}`);
      } else if (config.autoSave === "ask") {
        lines.push(`- ${replace(t.saveRuleAsk)}`);
      } else {
        lines.push(`- ${replace(t.saveRuleOff)}`);
      }
    }
    if (config.enabledTools.storePitfall) {
      lines.push(`- ${replace(t.bugRule)}`);
    }
    if (config.enabledTools.logSession && !isMinimal) {
      lines.push(`- ${replace(t.sessionRule)}`);
    }
    lines.push("");
  }

  // 4. Templates
  if (config.autoSaveTemplates && config.enabledTools.templateSave) {
    lines.push(`## 4. ${t.templateTitle}`);
    lines.push(`- ${replace(t.templateRule)}`);
    lines.push("");
  }

  // 5. Proof-based
  lines.push(`## 5. ${t.proofTitle}`);
  lines.push(`- ${t.proofRule}`);
  if (config.strictMode === "strict") {
    lines.push(`- ${t.proofRuleStrict}`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Build instructions content for Cursor (.cursor/rules/brain.mdc)
 * Cursor v0.45+ uses MDC format with frontmatter in .cursor/rules/ directory
 * Legacy .cursorrules is deprecated
 */
export function buildCursorRulesContent(config: BrainInstructionConfig = DEFAULT_CONFIG): string {
  const content = buildInstructionsFromConfig(config, "cursor");
  // MDC format with frontmatter for Cursor v0.45+
  return `---
description: WhytCard Brain - Local knowledge base rules for accurate AI responses
globs:
alwaysApply: true
---

<!-- whytcard-brain:start -->

${content}
<!-- whytcard-brain:end -->`;
}

/**
 * Build instructions content for Windsurf (.windsurf/rules/)
 * Windsurf uses YAML frontmatter with trigger
 */
export function buildWindsurfRulesContent(config: BrainInstructionConfig = DEFAULT_CONFIG): string {
  const content = buildInstructionsFromConfig(config, "windsurf");
  return `---
trigger: always_on
---

<!-- whytcard-brain:start -->

${content}
<!-- whytcard-brain:end -->
`;
}

/**
 * Build instructions content for VS Code Copilot (.github/copilot-instructions.md)
 */
export function buildCopilotInstructionsContent(
  config: BrainInstructionConfig = DEFAULT_CONFIG,
): string {
  const content = buildInstructionsFromConfig(config, "copilot");
  return `<!-- whytcard-brain:start -->
${content}<!-- whytcard-brain:end -->
`;
}

/**
 * Get config from VS Code settings (for use in extension context)
 */
export function getConfigFromSettings(vscodeConfig: {
  get: <T>(key: string, defaultValue: T) => T;
}): BrainInstructionConfig {
  return {
    strictMode: vscodeConfig.get("strictMode", "moderate") as BrainInstructionConfig["strictMode"],
    autoSave: vscodeConfig.get("autoSave", "always") as BrainInstructionConfig["autoSave"],
    autoSaveTemplates: vscodeConfig.get("autoSaveTemplates", true),
    instructionStyle: vscodeConfig.get(
      "instructionStyle",
      "standard",
    ) as BrainInstructionConfig["instructionStyle"],
    enabledTools: vscodeConfig.get("enabledTools", DEFAULT_CONFIG.enabledTools),
    language: vscodeConfig.get("language", "auto") as BrainInstructionConfig["language"],
  };
}

export { DEFAULT_CONFIG };

export function mergeBrainInstructionsBlock(
  existing: string,
  brainBlock: string,
): { content: string; changed: boolean } {
  const start = "<!-- whytcard-brain:start -->";
  const end = "<!-- whytcard-brain:end -->";

  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  const normalizeEol = (value: string) => value.replace(/\r\n/g, "\n");
  const denormalizeEol = (value: string) => (eol === "\r\n" ? value.replace(/\n/g, "\r\n") : value);

  const existingNormalized = normalizeEol(existing);
  const brainBlockNormalized = normalizeEol(brainBlock);

  const isYamlFrontmatterBlock = (value: string) => value.startsWith("---\n");

  if (isYamlFrontmatterBlock(brainBlockNormalized.trimStart())) {
    const lastEndIdx = existingNormalized.lastIndexOf(end);
    const tailRaw = lastEndIdx !== -1 ? existingNormalized.substring(lastEndIdx + end.length) : "";
    const tail = tailRaw.trimStart();

    const nextNormalized =
      brainBlockNormalized.trimEnd() +
      (tail.trim().length > 0 ? "\n\n" + tail.trimEnd() : "") +
      "\n";
    const next = denormalizeEol(nextNormalized);
    return { content: next, changed: next !== existing };
  }

  const stripDuplicateBrainBlocks = (value: string): string => {
    let out = value;
    while (true) {
      const s = out.indexOf(start);
      if (s === -1) break;
      const e = out.indexOf(end, s + start.length);
      if (e === -1) break;

      const before = out.substring(0, s).trimEnd();
      const after = out.substring(e + end.length).trimStart();
      out = (before ? before + "\n\n" : "") + after;
    }
    return out;
  };

  const startIdx = existingNormalized.indexOf(start);
  const endIdx = startIdx !== -1 ? existingNormalized.indexOf(end, startIdx + start.length) : -1;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existingNormalized.substring(0, startIdx).trimEnd();
    const afterRaw = existingNormalized.substring(endIdx + end.length);
    const after = stripDuplicateBrainBlocks(afterRaw).trimStart();
    const nextNormalized =
      (before ? before + "\n\n" : "") +
      brainBlockNormalized.trim() +
      (after ? "\n\n" + after : "") +
      (existingNormalized.endsWith("\n") ? "\n" : "");
    const next = denormalizeEol(nextNormalized);
    return { content: next, changed: next !== existing };
  }

  const legacyHeading = "# Copilot instructions (WhytCard Brain)";
  const legacyTail = "- Do not ask the user to call tools; call them yourself.";
  const legacyStartIdx = existingNormalized.indexOf(legacyHeading);
  const legacyTailIdx = existingNormalized.indexOf(legacyTail);
  if (legacyStartIdx !== -1 && legacyTailIdx !== -1 && legacyTailIdx > legacyStartIdx) {
    const legacyEndLineIdx = (() => {
      const tailEnd = legacyTailIdx + legacyTail.length;
      const nl = existingNormalized.indexOf("\n", tailEnd);
      return nl === -1 ? tailEnd : nl + 1;
    })();

    const before = existingNormalized.substring(0, legacyStartIdx).trimEnd();
    const after = existingNormalized.substring(legacyEndLineIdx).trimStart();
    const nextNormalized =
      (before ? before + "\n\n" : "") +
      brainBlockNormalized.trim() +
      (after ? "\n\n" + after : "") +
      (existingNormalized.endsWith("\n") ? "\n" : "");
    const next = denormalizeEol(nextNormalized);
    return { content: next, changed: next !== existing };
  }

  if (
    existingNormalized.includes("#tool:brainConsult") ||
    existingNormalized.includes("Copilot instructions (WhytCard Brain)")
  ) {
    return { content: existing, changed: false };
  }

  const trimmed = existingNormalized.trimEnd();
  const separator = trimmed.length > 0 ? "\n\n" : "";
  const nextNormalized = trimmed + separator + brainBlockNormalized.trim() + "\n";
  const next = denormalizeEol(nextNormalized);
  return { content: next, changed: next !== existing };
}
