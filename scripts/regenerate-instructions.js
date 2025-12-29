#!/usr/bin/env node
/**
 * Script to regenerate Brain instruction files for all editors
 * Run: node scripts/regenerate-instructions.js
 */

const fs = require("fs");
const path = require("path");

// Default config matching extension defaults
const DEFAULT_CONFIG = {
  strictMode: "moderate",
  autoSave: "always",
  autoSaveTemplates: true,
  instructionStyle: "standard",
  enabledTools: {
    brainConsult: true,
    brainSave: true,
    brainBug: true,
    brainSession: true,
    brainSearch: true,
    brainValidate: true,
    brainTemplateSave: true,
    brainTemplateSearch: true,
    brainTemplateApply: true,
  },
  language: "en",
};

/**
 * Build instructions based on configuration
 */
function buildInstructionsFromConfig(config, format) {
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
  const replace = (s) => s.replace(/\{tool\}/g, toolPrefix);

  const lines = [];

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
  if (config.enabledTools.brainConsult) {
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
  if (config.enabledTools.brainSave || config.enabledTools.brainBug) {
    lines.push(`## 3. ${t.saveTitle}`);
    if (config.enabledTools.brainSave) {
      if (config.autoSave === "always") {
        lines.push(`- ${replace(t.saveRuleAlways)}`);
      } else if (config.autoSave === "ask") {
        lines.push(`- ${replace(t.saveRuleAsk)}`);
      } else {
        lines.push(`- ${replace(t.saveRuleOff)}`);
      }
    }
    if (config.enabledTools.brainBug) {
      lines.push(`- ${replace(t.bugRule)}`);
    }
    if (config.enabledTools.brainSession && !isMinimal) {
      lines.push(`- ${replace(t.sessionRule)}`);
    }
    lines.push("");
  }

  // 4. Templates
  if (config.autoSaveTemplates && config.enabledTools.brainTemplateSave) {
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

function buildWindsurfRulesContent(config = DEFAULT_CONFIG) {
  const content = buildInstructionsFromConfig(config, "windsurf");
  return `---
trigger: always_on
---

<!-- whytcard-brain:start -->

${content}
<!-- whytcard-brain:end -->
`;
}

function buildCursorRulesContent(config = DEFAULT_CONFIG) {
  const content = buildInstructionsFromConfig(config, "cursor");
  return `---
description: WhytCard Brain - Local knowledge base rules for accurate AI responses
globs: 
alwaysApply: true
---

<!-- whytcard-brain:start -->

${content}
<!-- whytcard-brain:end -->
`;
}

function buildCopilotInstructionsContent(config = DEFAULT_CONFIG) {
  const content = buildInstructionsFromConfig(config, "copilot");
  return `<!-- whytcard-brain:start -->
${content}<!-- whytcard-brain:end -->
`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  Created directory: ${dirPath}`);
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✓ Written: ${filePath}`);
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");

  console.log("Regenerating Brain instruction files...\n");

  // 1. Windsurf rules
  const windsurfDir = path.join(projectRoot, ".windsurf", "rules");
  ensureDir(windsurfDir);
  writeFile(path.join(windsurfDir, "brain.md"), buildWindsurfRulesContent());

  // 2. Cursor rules (new MDC format)
  const cursorDir = path.join(projectRoot, ".cursor", "rules");
  ensureDir(cursorDir);
  writeFile(path.join(cursorDir, "brain.mdc"), buildCursorRulesContent());

  // 3. GitHub Copilot instructions
  const githubDir = path.join(projectRoot, ".github");
  ensureDir(githubDir);
  writeFile(path.join(githubDir, "copilot-instructions.md"), buildCopilotInstructionsContent());

  console.log("\n✓ All instruction files regenerated!");
  console.log("\nFiles updated:");
  console.log("  - .windsurf/rules/brain.md");
  console.log("  - .cursor/rules/brain.mdc");
  console.log("  - .github/copilot-instructions.md");
}

main();
