/**
 * Tests for Brain Tools Strict Policy Enforcement
 * Note: These tests run outside VS Code context, so vscode API calls will fail.
 * We test exported helper functions that don't require VS Code.
 */

import * as assert from "assert";

// Note: brainTools.ts requires vscode module which isn't available in mocha.
// We test the core logic patterns here instead.

describe("Brain Tools Policy Enforcement (Pattern Tests)", () => {
  // Simulated session state for testing enforcement logic patterns
  const createSessionState = () => ({
    consultedAtMs: null as number | null,
    lastConsultQuery: null as string | null,
    lastConsultDocsCount: 0,
    lastConsultDocsWithUrlCount: 0,
  });

  const DEFAULT_TTL_MS = 20 * 60 * 1000; // 20 minutes

  const hasFreshConsult = (
    state: ReturnType<typeof createSessionState>,
    nowMs: number,
    ttlMs: number = DEFAULT_TTL_MS,
  ): boolean => {
    if (state.consultedAtMs === null) return false;
    return nowMs - state.consultedAtMs <= ttlMs;
  };

  const hasSatisfiedConsult = (
    state: ReturnType<typeof createSessionState>,
    nowMs: number,
    strictMode: "off" | "moderate" | "strict",
  ): boolean => {
    if (!hasFreshConsult(state, nowMs)) return false;
    if (strictMode === "off") return true;
    if (state.lastConsultDocsCount <= 0) return false;
    if (strictMode === "strict" && state.lastConsultDocsWithUrlCount <= 0) return false;
    return true;
  };

  describe("Fresh Consult Logic", () => {
    it("Should return false when no consult has been made", () => {
      const state = createSessionState();
      assert.strictEqual(hasFreshConsult(state, Date.now()), false);
    });

    it("Should return true when consult is within TTL", () => {
      const state = createSessionState();
      state.consultedAtMs = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      assert.strictEqual(hasFreshConsult(state, Date.now()), true);
    });

    it("Should return false when consult is expired (beyond TTL)", () => {
      const state = createSessionState();
      state.consultedAtMs = Date.now() - 25 * 60 * 1000; // 25 minutes ago
      assert.strictEqual(hasFreshConsult(state, Date.now()), false);
    });
  });

  describe("Satisfied Consult Logic", () => {
    it("Should return false when no consult has been made", () => {
      const state = createSessionState();
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "moderate"), false);
    });

    it("Should return true in off mode even without docs", () => {
      const state = createSessionState();
      state.consultedAtMs = Date.now();
      state.lastConsultDocsCount = 0;
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "off"), true);
    });

    it("Should require docs in moderate mode", () => {
      const state = createSessionState();
      state.consultedAtMs = Date.now();
      state.lastConsultDocsCount = 0;
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "moderate"), false);

      state.lastConsultDocsCount = 1;
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "moderate"), true);
    });

    it("Should require docs with URL in strict mode", () => {
      const state = createSessionState();
      state.consultedAtMs = Date.now();
      state.lastConsultDocsCount = 1;
      state.lastConsultDocsWithUrlCount = 0;
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "strict"), false);

      state.lastConsultDocsWithUrlCount = 1;
      assert.strictEqual(hasSatisfiedConsult(state, Date.now(), "strict"), true);
    });
  });
});
