export function buildCopilotInstructionsContent(): string {
  // Strict rules for an autonomous, evidence-based agent
  return (
    "<!-- whytcard-brain:start -->\n" +
    "# WhytCard Brain Agent Rules\n\n" +
    "You are an expert agent powered by a local knowledge base (Brain). Your goal is to be rigorously accurate and constantly learning.\n\n" +
    "## 1. ALWAYS CONSULT BRAIN FIRST\n" +
    "- **Mandatory:** Call `#tool:brainConsult` before planning, coding, or answering.\n" +
    "- Use the user's request as the `query`.\n" +
    "- If Brain is missing/incomplete: fetch OFFICIAL documentation (Context7/Tavily/Microsoft docs, etc.), then store it using `#tool:brainSave` (include `url`), then re-run `#tool:brainConsult`.\n" +
    "- Never ask the user to call tools; call them yourself.\n\n" +
    "## 2. ZERO HALLUCINATION POLICY\n" +
    "- NEVER guess or rely on outdated training data for frameworks/libs. ALWAYS verify facts.\n" +
    '- If you still lack proof after official docs search, state clearly: "I cannot find official documentation for this."\n' +
    '- Do NOT use speculative language ("je crois", "maybe", "should work", etc.).\n\n' +
    "## 3. CONTINUOUS LEARNING (Write-Back)\n" +
    "- When you find new useful info from MCP/Web that wasn't in Brain, save it immediately using `#tool:brainSave` (include `url`).\n" +
    "- When you solve a bug or error, save it using `#tool:brainBug`.\n" +
    "- At the end of significant work, log the session with `#tool:brainSession`.\n" +
    "- Keep the project context updated. If an architectural decision is made, update it via `#tool:brainSave` (category='project').\n\n" +
    "## 4. PROOF-BASED ANSWERS\n" +
    '- Start your answers by stating your source: "Based on [Local Brain/Official Doc]..."\n' +
    "- If using external docs, provide the URL.\n" +
    "<!-- whytcard-brain:end -->\n"
  );
}

export function mergeBrainInstructionsBlock(
  existing: string,
  brainBlock: string,
): { content: string; changed: boolean } {
  const start = "<!-- whytcard-brain:start -->";
  const end = "<!-- whytcard-brain:end -->";

  const startIdx = existing.indexOf(start);
  const endIdx = existing.indexOf(end);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.substring(0, startIdx).trimEnd();
    const after = existing.substring(endIdx + end.length).trimStart();
    const next =
      (before ? before + "\n\n" : "") +
      brainBlock.trim() +
      (after ? "\n\n" + after : "") +
      (existing.endsWith("\n") ? "\n" : "");
    return { content: next, changed: next !== existing };
  }

  const legacyHeading = "# Copilot instructions (WhytCard Brain)";
  const legacyTail = "- Do not ask the user to call tools; call them yourself.";
  const legacyStartIdx = existing.indexOf(legacyHeading);
  const legacyTailIdx = existing.indexOf(legacyTail);
  if (
    legacyStartIdx !== -1 &&
    legacyTailIdx !== -1 &&
    legacyTailIdx > legacyStartIdx
  ) {
    const legacyEndLineIdx = (() => {
      const tailEnd = legacyTailIdx + legacyTail.length;
      const nl = existing.indexOf("\n", tailEnd);
      return nl === -1 ? tailEnd : nl + 1;
    })();

    const before = existing.substring(0, legacyStartIdx).trimEnd();
    const after = existing.substring(legacyEndLineIdx).trimStart();
    const next =
      (before ? before + "\n\n" : "") +
      brainBlock.trim() +
      (after ? "\n\n" + after : "") +
      (existing.endsWith("\n") ? "\n" : "");
    return { content: next, changed: next !== existing };
  }

  if (
    existing.includes("#tool:brainConsult") ||
    existing.includes("Copilot instructions (WhytCard Brain)")
  ) {
    return { content: existing, changed: false };
  }

  const trimmed = existing.trimEnd();
  const separator = trimmed.length > 0 ? "\n\n" : "";
  const next = trimmed + separator + brainBlock.trim() + "\n";
  return { content: next, changed: next !== existing };
}
