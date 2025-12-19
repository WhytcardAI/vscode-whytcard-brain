
export function buildCopilotInstructionsContent(): string {
  // Strict rules for an autonomous, evidence-based agent
  return (
    '<!-- whytcard-brain:start -->\n' +
    '# WhytCard Brain Agent Rules\n\n' +
    'You are an expert agent powered by a local knowledge base (Brain). Your goal is to be rigorously accurate and constantly learning.\n\n' +
    '## 1. ZERO HALLUCINATION POLICY\n' +
    "- NEVER guess or rely on outdated training data for frameworks/libs. ALWAYS verify facts.\n" +
    "- **Step 1:** Call `#tool:brainConsult` with the user's query to check local knowledge.\n" +
    "- **Step 2:** If local info is missing/incomplete, YOU MUST use available MCP tools (e.g., `mcp_microsoft_docs_search`, `mcp_tavily_search`, etc.) to find OFFICIAL documentation.\n" +
    "- **Step 3:** If you still lack proof, state clearly: \"I cannot find official documentation for this.\"\n\n" +
    '## 2. CONTINUOUS LEARNING (Write-Back)\n' +
    "- When you find new useful info from MCP/Web that wasn't in Brain, YOU MUST save it immediately using `#tool:brainSave`.\n" +
    "- When you solve a bug or error, YOU MUST save the solution using `#tool:brainBug`.\n" +
    "- Keep the project context updated. If an architectural decision is made, update it via `#tool:brainSave` (category='project').\n\n" +
    '## 3. PROOF-BASED ANSWERS\n' +
    "- Start your answers by stating your source: \"Based on [Local Brain/Official Doc]...\"\n" +
    "- If using external docs, provide the URL.\n" +
    '<!-- whytcard-brain:end -->\n'
  );
}

export function mergeBrainInstructionsBlock(
  existing: string,
  brainBlock: string
): { content: string; changed: boolean } {
  const start = '<!-- whytcard-brain:start -->';
  const end = '<!-- whytcard-brain:end -->';

  const startIdx = existing.indexOf(start);
  const endIdx = existing.indexOf(end);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.substring(0, startIdx).trimEnd();
    const after = existing.substring(endIdx + end.length).trimStart();
    const next = (before ? before + '\n\n' : '') + brainBlock.trim() + (after ? '\n\n' + after : '') +
      (existing.endsWith('\n') ? '\n' : '');
    return { content: next, changed: next !== existing };
  }

  const legacyHeading = '# Copilot instructions (WhytCard Brain)';
  const legacyTail = '- Do not ask the user to call tools; call them yourself.';
  const legacyStartIdx = existing.indexOf(legacyHeading);
  const legacyTailIdx = existing.indexOf(legacyTail);
  if (legacyStartIdx !== -1 && legacyTailIdx !== -1 && legacyTailIdx > legacyStartIdx) {
    const legacyEndLineIdx = (() => {
      const tailEnd = legacyTailIdx + legacyTail.length;
      const nl = existing.indexOf('\n', tailEnd);
      return nl === -1 ? tailEnd : nl + 1;
    })();

    const before = existing.substring(0, legacyStartIdx).trimEnd();
    const after = existing.substring(legacyEndLineIdx).trimStart();
    const next = (before ? before + '\n\n' : '') + brainBlock.trim() + (after ? '\n\n' + after : '') +
      (existing.endsWith('\n') ? '\n' : '');
    return { content: next, changed: next !== existing };
  }

  if (existing.includes('#tool:brainConsult') || existing.includes('Copilot instructions (WhytCard Brain)')) {
    return { content: existing, changed: false };
  }

  const trimmed = existing.trimEnd();
  const separator = trimmed.length > 0 ? '\n\n' : '';
  const next = trimmed + separator + brainBlock.trim() + '\n';
  return { content: next, changed: next !== existing };
}
