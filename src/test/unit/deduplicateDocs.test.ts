import * as assert from "assert";
import { buildDeduplicateDocsPlan } from "../../utils/deduplicateDocs";

describe("Deduplicate Docs Test Suite", () => {
  it("Should delete only strict duplicates (same metadata + same content)", () => {
    const plan = buildDeduplicateDocsPlan([
      {
        id: 1,
        library: "nextjs",
        topic: "routing",
        title: "App Router Params",
        content: "SAME",
        url: "https://nextjs.org/docs/app",
        category: "documentation",
        created_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        library: "Next.js",
        topic: "routing",
        title: "App Router Params",
        content: "SAME",
        url: "https://nextjs.org/docs/app",
        category: "documentation",
        created_at: "2025-02-01T00:00:00.000Z",
      },
    ]);

    assert.strictEqual(plan.stats.candidateGroups, 1);
    assert.strictEqual(plan.stats.safeGroups, 1);
    assert.strictEqual(plan.stats.conflictGroups, 0);
    assert.strictEqual(plan.stats.totalSafeDeletions, 1);
    assert.deepStrictEqual(plan.deleteIds, [1]);
  });

  it("Should not delete when there is a conflict (same group but different content)", () => {
    const plan = buildDeduplicateDocsPlan([
      {
        id: 1,
        library: "nextjs",
        topic: "routing",
        title: "App Router Params",
        content: "A",
        category: "documentation",
        created_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        library: "nextjs",
        topic: "routing",
        title: "App Router Params",
        content: "B",
        category: "documentation",
        created_at: "2025-02-01T00:00:00.000Z",
      },
    ]);

    assert.strictEqual(plan.stats.candidateGroups, 1);
    assert.strictEqual(plan.stats.safeGroups, 0);
    assert.strictEqual(plan.stats.conflictGroups, 1);
    assert.strictEqual(plan.stats.totalSafeDeletions, 0);
    assert.deepStrictEqual(plan.deleteIds, []);
  });

  it("Should group by URL first (even when metadata differs)", () => {
    const plan = buildDeduplicateDocsPlan([
      {
        id: 1,
        library: "nextjs",
        topic: "routing",
        title: "Title A",
        content: "SAME",
        url: "https://nextjs.org/docs/app",
        category: "documentation",
        created_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        library: "nextjs",
        topic: "routing",
        title: "Title B",
        content: "SAME",
        url: "https://nextjs.org/docs/app",
        category: "documentation",
        created_at: "2025-02-01T00:00:00.000Z",
      },
    ]);

    assert.strictEqual(plan.stats.candidateGroups, 1);
    assert.strictEqual(plan.stats.safeGroups, 0);
    assert.strictEqual(plan.stats.conflictGroups, 1);
    assert.ok(plan.report.includes("URL:"));
  });
});
