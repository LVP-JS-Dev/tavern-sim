/**
 * Tests for income calculation module
 */

import { describe, it, expect } from "vitest";
import { calculateTotalIncome } from "../../src/economy/income";
import { createInitialState } from "../../src/state/initial";
import type { HeroState } from "../../src/types/state";

describe("calculateTotalIncome", () => {
  it("returns 0 for empty roster", () => {
    const state = createInitialState(Date.now(), 1);
    expect(calculateTotalIncome(state.heroes.roster)).toBe(0);
  });

  it("returns 0 for empty object", () => {
    expect(calculateTotalIncome({})).toBe(0);
  });

  it("calculates income for single hero", () => {
    const roster: Record<string, HeroState> = {
      barkeep: { level: 5, incomePerSecondU: 1000 },
    };
    // 1000 * 5 = 5000
    expect(calculateTotalIncome(roster)).toBe(5000);
  });

  it("calculates income for multiple heroes", () => {
    const roster: Record<string, HeroState> = {
      barkeep: { level: 5, incomePerSecondU: 1000 },
      bard: { level: 3, incomePerSecondU: 2500 },
    };
    // barkeep: 1000 * 5 = 5000
    // bard: 2500 * 3 = 7500
    // total: 12500
    expect(calculateTotalIncome(roster)).toBe(12500);
  });

  it("handles level 0 heroes", () => {
    const roster: Record<string, HeroState> = {
      barkeep: { level: 0, incomePerSecondU: 1000 },
    };
    // 1000 * 0 = 0
    expect(calculateTotalIncome(roster)).toBe(0);
  });

  it("handles zero income heroes", () => {
    const roster: Record<string, HeroState> = {
      barkeep: { level: 5, incomePerSecondU: 0 },
    };
    // 0 * 5 = 0
    expect(calculateTotalIncome(roster)).toBe(0);
  });
});
