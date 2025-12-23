/**
 * Full generation test - simulates what the extension does
 */

// Simulate the DEFAULT_CONFIG
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
  language: "auto",
};

// Replicate the buildInstructionsFromConfig function
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

  lines.push(`# ${t.title}`);
  lines.push("");
  lines.push(isMinimal ? t.introMinimal : t.intro);
  lines.push("");

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

  if (config.autoSaveTemplates && config.enabledTools.brainTemplateSave) {
    lines.push(`## 4. ${t.templateTitle}`);
    lines.push(`- ${replace(t.templateRule)}`);
    lines.push("");
  }

  lines.push(`## 5. ${t.proofTitle}`);
  lines.push(`- ${t.proofRule}`);
  if (config.strictMode === "strict") {
    lines.push(`- ${t.proofRuleStrict}`);
  }
  lines.push("");

  return lines.join("\n");
}

function buildCursorRulesContent(config = DEFAULT_CONFIG) {
  const content = buildInstructionsFromConfig(config, "cursor");
  return `---
description: WhytCard Brain - Local knowledge base rules for accurate AI responses
globs: 
alwaysApply: true
---

${content}`;
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

function buildCopilotInstructionsContent(config = DEFAULT_CONFIG) {
  const content = buildInstructionsFromConfig(config, "copilot");
  return `<!-- whytcard-brain:start -->
${content}<!-- whytcard-brain:end -->
`;
}

// ============ TESTS ============

console.log("=== FULL GENERATION TEST ===\n");

// Test 1: Default config - Cursor MDC
console.log("📄 CURSOR (.cursor/rules/brain.mdc) - Default Config:");
console.log("─".repeat(60));
const cursorDefault = buildCursorRulesContent();
console.log(cursorDefault);
console.log("─".repeat(60));
console.log(`Length: ${cursorDefault.length} chars\n`);

// Test 2: Strict mode - French
console.log("📄 COPILOT - Strict Mode + French:");
console.log("─".repeat(60));
const copilotStrict = buildCopilotInstructionsContent({
  ...DEFAULT_CONFIG,
  strictMode: "strict",
  language: "fr",
});
console.log(copilotStrict);
console.log("─".repeat(60));
console.log(`Length: ${copilotStrict.length} chars\n`);

// Test 3: Minimal style
console.log("📄 WINDSURF - Minimal Style:");
console.log("─".repeat(60));
const windsurfMinimal = buildWindsurfRulesContent({
  ...DEFAULT_CONFIG,
  instructionStyle: "minimal",
});
console.log(windsurfMinimal);
console.log("─".repeat(60));
console.log(`Length: ${windsurfMinimal.length} chars\n`);

// Test 4: Disabled tools
console.log("📄 CURSOR - Some tools disabled:");
console.log("─".repeat(60));
const cursorLimited = buildCursorRulesContent({
  ...DEFAULT_CONFIG,
  autoSaveTemplates: false,
  enabledTools: {
    ...DEFAULT_CONFIG.enabledTools,
    brainSession: false,
    brainTemplateSave: false,
  },
});
console.log(cursorLimited);
console.log("─".repeat(60));
console.log(`Length: ${cursorLimited.length} chars\n`);

console.log("✅ All generation tests completed!");
