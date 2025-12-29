import * as assert from "assert";
import { mergeBrainInstructionsBlock } from "../../utils/copilotUtils";

describe("Copilot Utils Test Suite", () => {
  it("Should insert Brain block when file is empty", () => {
    const existing = "";
    const block = "<!-- whytcard-brain:start -->\nCONTENT\n<!-- whytcard-brain:end -->";
    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.content.trim(), block.trim());
  });

  it("Should append Brain block when file has content but no Brain block", () => {
    const existing = "# User Instructions\n\n- Do X";
    const block = "<!-- whytcard-brain:start -->\nCONTENT\n<!-- whytcard-brain:end -->";
    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, true);
    assert.ok(result.content.includes("# User Instructions"));
    assert.ok(result.content.includes(block.trim()));
  });

  it("Should update existing Brain block", () => {
    const existing =
      "# Intro\n\n<!-- whytcard-brain:start -->\nOLD CONTENT\n<!-- whytcard-brain:end -->\n\n# Outro";
    const block = "<!-- whytcard-brain:start -->\nNEW CONTENT\n<!-- whytcard-brain:end -->\n";
    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, true);
    assert.ok(result.content.includes("# Intro"));
    assert.ok(result.content.includes("# Outro"));
    assert.ok(result.content.includes("NEW CONTENT"));
    assert.ok(!result.content.includes("OLD CONTENT"));
  });

  it("Should not change if Brain block is identical", () => {
    const block = "<!-- whytcard-brain:start -->\nCONTENT\n<!-- whytcard-brain:end -->\n";
    const existing = `# Intro\n\n${block}\n# Outro`;
    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.content, existing);
  });

  it("Should migrate legacy block correctly", () => {
    const legacyHeading = "# Copilot instructions (WhytCard Brain)";
    const legacyTail = "- Do not ask the user to call tools; call them yourself.";
    const existing = `# User Rules\n\n${legacyHeading}\n\n- Old rule 1\n${legacyTail}\n\n# More User Rules`;

    const block = "<!-- whytcard-brain:start -->\nNEW CONTENT\n<!-- whytcard-brain:end -->\n";
    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, true);
    assert.ok(result.content.includes("# User Rules"));
    assert.ok(result.content.includes("# More User Rules"));
    assert.ok(result.content.includes("NEW CONTENT"));
    assert.ok(!result.content.includes(legacyHeading));
    assert.ok(!result.content.includes(legacyTail));
  });

  it("Should preserve spacing around block", () => {
    const existing =
      "# Top\n\n<!-- whytcard-brain:start -->\nOLD\n<!-- whytcard-brain:end -->\n\n# Bottom";
    const block = "<!-- whytcard-brain:start -->\nNEW\n<!-- whytcard-brain:end -->\n";

    const result = mergeBrainInstructionsBlock(existing, block);

    // Check that we don't accumulate excessive newlines
    assert.ok(!result.content.includes("\n\n\n\n"));
    assert.ok(result.content.includes("# Top\n\n<!-- whytcard-brain:start -->"));
    assert.ok(result.content.includes("<!-- whytcard-brain:end -->\n\n# Bottom"));
  });

  it("Should not duplicate YAML frontmatter (Windsurf/Cursor rules) and be idempotent", () => {
    const block = `---\ntrigger: always_on\n---\n\n<!-- whytcard-brain:start -->\nNEW\n<!-- whytcard-brain:end -->\n`;
    const existing = `---\ntrigger: always_on\n---\n\n---\ntrigger: always_on\n---\n\n<!-- whytcard-brain:start -->\nOLD\n<!-- whytcard-brain:end -->\n\n# User Tail\n`;

    const result = mergeBrainInstructionsBlock(existing, block);

    assert.strictEqual(result.changed, true);
    assert.strictEqual((result.content.match(/trigger: always_on/g) || []).length, 1);
    assert.ok(result.content.includes("NEW"));
    assert.ok(!result.content.includes("OLD"));
    assert.ok(result.content.includes("# User Tail"));

    const second = mergeBrainInstructionsBlock(result.content, block);
    assert.strictEqual(second.changed, false);
    assert.strictEqual(second.content, result.content);
  });
});
