
export function buildCopilotInstructionsContent(): string {
  // Keep it short and explicit: this is applied to Copilot Chat requests.
  return (
    '<!-- whytcard-brain:start -->\n' +
    '# Copilot instructions (WhytCard Brain)\n\n' +
    "- Before answering, ALWAYS consult the local Brain database with #tool:brainConsult using the user's query.\n" +
    '- Use the returned instructions/context/docs/pitfalls to shape the response.\n' +
    '- If Brain has no relevant info, do web/docs research, then persist new knowledge with #tool:brainSave or #tool:brainBug.\n' +
    '- When Brain was used, explicitly mention: "D\'après le Brain..." and cite the stored source URL if available.\n' +
    '- Do not ask the user to call tools; call them yourself.\n' +
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
