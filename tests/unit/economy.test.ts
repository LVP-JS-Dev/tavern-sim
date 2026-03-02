/**
 * Tests for Economy Module
 *
 * Verifies income calculation formulas, upgrade costs, and multipliers.
 * Core formula: income = Σ(hero.incomePerSecondU * hero.level)
 *
 * @module tests/unit/economy.test
 */

import { describe, it, expect } from "vitest";
import { calculateTotalIncome } from "../../src/economy/income";
import { calculateUpgradeCost } from "../../src/economy/upgrade";
import {
  applyMultiplier,
  applyMultipliers,
  combineMultipliers,
  percentToMultiplier,
  multiplierToPercent,
  calculateTavernIncomeMultiplier,
  applyDiminishingReturns,
  type MultiplierSource,
} from "../../src/economy/multipliers";
import {
  calculateIncomePerTick,
  calculateAffordableUpgrades,
  calculateTotalUpgradeCost,
  TICK_MS,
  GOLD_MULTIPLIER,
  DEFAULT_COST_MULTIPLIER,
  MAX_OFFLINE_MS,
} from "../../src/config/balance";
import type { HeroState } from "../../src/types/state";

// ============================================================================
// INCOME CALCULATION TESTS
// ============================================================================

describe("calculateTotalIncome", () => {
  describe("empty roster", () => {
    it("returns 0 for empty roster", () => {
      const roster: Record<string, HeroState> = {};
      expect(calculateTotalIncome(roster)).toBe(0);
    });
  });

  describe("single hero", () => {
    it("calculates income for level 1 hero", () => {
      const roster: Record<string, HeroState> = {
        barkeep: { level: 1, incomePerSecondU: 1000 },
      };
      // 1000 * 1 = 1000
      expect(calculateTotalIncome(roster)).toBe(1000);
    });

    it("calculates income for level 10 hero", () => {
      const roster: Record<string, HeroState> = {
        barkeep: { level: 10, incomePerSecondU: 500 },
      };
      // 500 * 10 = 5000
      expect(calculateTotalIncome(roster)).toBe(5000);
    });

    it("calculates income for level 0 hero (unlocked but not leveled)", () => {
      const roster: Record<string, HeroState> = {
        barkeep: { level: 0, incomePerSecondU: 1000 },
      };
      // 1000 * 0 = 0
      expect(calculateTotalIncome(roster)).toBe(0);
    });
  });

  describe("multiple heroes", () => {
    it("calculates total income from multiple heroes", () => {
      const roster: Record<string, HeroState> = {
        barkeep: { level: 5, incomePerSecondU: 1000 },  // 5000
        bard: { level: 3, incomePerSecondU: 2500 },     // 7500
        chef: { level: 2, incomePerSecondU: 4000 },     // 8000
      };
      // Total: 5000 + 7500 + 8000 = 20500
      expect(calculateTotalIncome(roster)).toBe(20500);
    });

    it("handles mixed level 0 heroes", () => {
      const roster: Record<string, HeroState> = {
        barkeep: { level: 5, incomePerSecondU: 1000 },  // 5000
        bard: { level: 0, incomePerSecondU: 2500 },     // 0
        chef: { level: 2, incomePerSecondU: 4000 },     // 8000
      };
      // Total: 5000 + 0 + 8000 = 13000
      expect(calculateTotalIncome(roster)).toBe(13000);
    });

    it("sums income correctly per formula", () => {
      // Formula: income = Σ(hero.incomePerSecondU * hero.level)
      const roster: Record<string, HeroState> = {
        hero1: { level: 1, incomePerSecondU: 100 },
        hero2: { level: 2, incomePerSecondU: 200 },
        hero3: { level: 3, incomePerSecondU: 300 },
      };
      // Expected: (100 * 1) + (200 * 2) + (300 * 3) = 100 + 400 + 900 = 1400
      expect(calculateTotalIncome(roster)).toBe(1400);
    });
  });

  describe("large values", () => {
    it("handles large income values", () => {
      const roster: Record<string, HeroState> = {
        hero: { level: 1000, incomePerSecondU: 1000000 },
      };
      // 1000000 * 1000 = 1000000000
      expect(calculateTotalIncome(roster)).toBe(1000000000);
    });

    it("handles many heroes", () => {
      const roster: Record<string, HeroState> = {};
      for (let i = 0; i < 100; i++) {
        roster[`hero${i}`] = { level: 10, incomePerSecondU: 1000 };
      }
      // 100 heroes * 10 level * 1000 income = 1000000
      expect(calculateTotalIncome(roster)).toBe(1000000);
    });
  });
});

// ============================================================================
// UPGRADE COST TESTS
// ============================================================================

describe("calculateUpgradeCost (from economy/upgrade)", () => {
  describe("single level upgrades", () => {
    it("calculates cost for first upgrade (level 0 to 1)", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 0, 1);
      // baseCost * 1.5^0 = 1000 * 1 = 1000
      expect(cost).toBe(1000);
    });

    it("calculates cost for second upgrade (level 1 to 2)", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 1, 1);
      // baseCost * 1.5^1 = 1000 * 1.5 = 1500
      expect(cost).toBe(1500);
    });

    it("calculates cost for higher level upgrade", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 5, 1);
      // baseCost * 1.5^5 = 1000 * 7.59375 = ~7593
      expect(cost).toBeGreaterThan(7500);
      expect(cost).toBeLessThan(7700);
    });
  });

  describe("multi-level upgrades", () => {
    it("calculates cost for multiple levels", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 0, 2);
      // 1000 * 1.5^0 + 1000 * 1.5^1 = 1000 + 1500 = 2500
      expect(cost).toBe(2500);
    });

    it("calculates cost for 5 levels", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 0, 5);
      // Sum of levels 0-4 with 1.5x multiplier
      expect(cost).toBeGreaterThan(0);
      // Verify it's more than 5 * base cost (due to exponential growth)
      expect(cost).toBeGreaterThan(5000);
    });
  });

  describe("edge cases", () => {
    it("returns 0 for zero levels to buy", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 5, 0);
      expect(cost).toBe(0);
    });

    it("returns 0 for negative levels to buy", () => {
      const cost = calculateUpgradeCost(1000, 1.5, 5, -1);
      expect(cost).toBe(0);
    });

    it("handles negative current level as level 0", () => {
      const cost = calculateUpgradeCost(1000, 1.5, -5, 1);
      // Should treat as level 0
      expect(cost).toBe(1000);
    });

    it("handles multiplier of 1 (no scaling)", () => {
      const cost = calculateUpgradeCost(1000, 1.0, 10, 1);
      // With multiplier 1, cost is always baseCost
      expect(cost).toBe(1000);
    });
  });
});

// ============================================================================
// MULTIPLIER TESTS
// ============================================================================

describe("applyMultiplier", () => {
  it("applies 2x multiplier correctly", () => {
    expect(applyMultiplier(1000, 2)).toBe(2000);
  });

  it("applies 1.5x multiplier correctly", () => {
    expect(applyMultiplier(1000, 1.5)).toBe(1500);
  });

  it("applies 0.9x multiplier (10% penalty) correctly", () => {
    expect(applyMultiplier(1000, 0.9)).toBe(900);
  });

  it("applies 1x multiplier (no change) correctly", () => {
    expect(applyMultiplier(1000, 1)).toBe(1000);
  });

  it("floors fractional results", () => {
    // 1001 * 1.5 = 1501.5 -> 1501
    expect(applyMultiplier(1001, 1.5)).toBe(1501);
  });

  it("handles zero base value", () => {
    expect(applyMultiplier(0, 2)).toBe(0);
  });
});

describe("applyMultipliers", () => {
  it("applies multiple multipliers sequentially", () => {
    // 1000 * 2 * 1.5 = 3000
    expect(applyMultipliers(1000, [2, 1.5])).toBe(3000);
  });

  it("two 2x multipliers result in 4x", () => {
    // 1000 * 2 * 2 = 4000
    expect(applyMultipliers(1000, [2, 2])).toBe(4000);
  });

  it("empty array returns original value", () => {
    expect(applyMultipliers(1000, [])).toBe(1000);
  });

  it("single multiplier works same as applyMultiplier", () => {
    expect(applyMultipliers(1000, [2])).toBe(applyMultiplier(1000, 2));
  });

  it("applies three multipliers correctly", () => {
    // 1000 * 2 * 1.5 * 0.5 = 1500
    expect(applyMultipliers(1000, [2, 1.5, 0.5])).toBe(1500);
  });
});

describe("combineMultipliers", () => {
  it("combines two 1.5x multipliers to 2.25x", () => {
    const sources: MultiplierSource[] = [
      { value: 1.5, source: "upgrade" },
      { value: 1.5, source: "achievement" },
    ];
    expect(combineMultipliers(sources)).toBe(2.25);
  });

  it("returns 1 for empty array", () => {
    expect(combineMultipliers([])).toBe(1);
  });

  it("returns the value for single multiplier", () => {
    const sources: MultiplierSource[] = [
      { value: 2.5, source: "test" },
    ];
    expect(combineMultipliers(sources)).toBe(2.5);
  });
});

describe("percentToMultiplier", () => {
  it("converts +50% to 1.5x", () => {
    expect(percentToMultiplier(50)).toBe(1.5);
  });

  it("converts +100% to 2.0x", () => {
    expect(percentToMultiplier(100)).toBe(2.0);
  });

  it("converts -20% to 0.8x", () => {
    expect(percentToMultiplier(-20)).toBe(0.8);
  });

  it("converts 0% to 1.0x", () => {
    expect(percentToMultiplier(0)).toBe(1.0);
  });
});

describe("multiplierToPercent", () => {
  it("converts 1.5x to +50%", () => {
    expect(multiplierToPercent(1.5)).toBe(50);
  });

  it("converts 2.0x to +100%", () => {
    expect(multiplierToPercent(2.0)).toBe(100);
  });

  it("converts 0.8x to -20%", () => {
    expect(multiplierToPercent(0.8)).toBe(-20);
  });

  it("is inverse of percentToMultiplier", () => {
    expect(multiplierToPercent(percentToMultiplier(50))).toBe(50);
    expect(multiplierToPercent(percentToMultiplier(-30))).toBe(-30);
  });
});

describe("calculateTavernIncomeMultiplier", () => {
  it("returns 1 for tavern level 0", () => {
    expect(calculateTavernIncomeMultiplier(0)).toBe(1);
  });

  it("returns 1 for negative tavern level", () => {
    expect(calculateTavernIncomeMultiplier(-5)).toBe(1);
  });

  it("calculates multiplier for level 5 (default 5% per level)", () => {
    // 5 * 5% = 25% bonus = 1.25x
    expect(calculateTavernIncomeMultiplier(5)).toBe(1.25);
  });

  it("calculates multiplier for level 10 (default 5% per level)", () => {
    // 10 * 5% = 50% bonus = 1.5x
    expect(calculateTavernIncomeMultiplier(10)).toBe(1.5);
  });

  it("calculates multiplier with custom bonus per level", () => {
    // 10 * 10% = 100% bonus = 2.0x
    expect(calculateTavernIncomeMultiplier(10, 10)).toBe(2.0);
  });
});

describe("applyDiminishingReturns", () => {
  it("applies 50% efficiency to 2x multiplier", () => {
    // (2 - 1) * 0.5 + 1 = 1.5
    expect(applyDiminishingReturns(2, 0.5)).toBe(1.5);
  });

  it("full efficiency (1.0) returns original multiplier", () => {
    expect(applyDiminishingReturns(2, 1.0)).toBe(2);
  });

  it("zero efficiency (0.0) returns 1x", () => {
    expect(applyDiminishingReturns(2, 0)).toBe(1);
  });

  it("works with sub-1x multipliers", () => {
    // (0.8 - 1) * 0.5 + 1 = -0.1 + 1 = 0.9
    expect(applyDiminishingReturns(0.8, 0.5)).toBe(0.9);
  });
});

// ============================================================================
// BALANCE CONFIG TESTS
// ============================================================================

describe("calculateIncomePerTick", () => {
  it("calculates income per tick correctly", () => {
    // Formula: floor(incomePerSecondU * TICK_MS / 1000)
    // 10000 * 40 / 1000 = 400
    expect(calculateIncomePerTick(10000)).toBe(400);
  });

  it("returns 0 for zero income", () => {
    expect(calculateIncomePerTick(0)).toBe(0);
  });

  it("handles small income values", () => {
    // 100 * 40 / 1000 = 4
    expect(calculateIncomePerTick(100)).toBe(4);
  });

  it("handles large income values", () => {
    // 1000000 * 40 / 1000 = 40000
    expect(calculateIncomePerTick(1000000)).toBe(40000);
  });

  it("floors fractional results", () => {
    // 99 * 40 / 1000 = 3.96 -> 3
    expect(calculateIncomePerTick(99)).toBe(3);
  });
});

describe("calculateTotalUpgradeCost (from balance)", () => {
  it("calculates total cost for multiple levels", () => {
    const cost = calculateTotalUpgradeCost(100, 0, 3);
    // Sum of levels 0, 1, 2 with default 1.15 multiplier
    expect(cost).toBeGreaterThan(300); // More than 3 * base
  });

  it("returns 0 for zero levels", () => {
    expect(calculateTotalUpgradeCost(100, 5, 0)).toBe(0);
  });
});

describe("calculateAffordableUpgrades", () => {
  it("calculates affordable levels with sufficient gold", () => {
    const result = calculateAffordableUpgrades(100, 0, 1000, 10);
    // Can afford several levels with 1000 gold
    expect(result.affordableLevels).toBeGreaterThan(0);
    expect(result.affordableLevels).toBeLessThanOrEqual(10);
    expect(result.totalCost).toBeLessThanOrEqual(1000);
  });

  it("returns 0 levels when gold is insufficient", () => {
    const result = calculateAffordableUpgrades(1000, 0, 50, 10);
    expect(result.affordableLevels).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("respects maxLevels parameter", () => {
    const result = calculateAffordableUpgrades(10, 0, 10000, 3);
    // Even with lots of gold, can only buy max 3 levels
    expect(result.affordableLevels).toBeLessThanOrEqual(3);
  });

  it("handles exact gold amount", () => {
    // First upgrade costs 100 at level 0
    const result = calculateAffordableUpgrades(100, 0, 100, 1);
    expect(result.affordableLevels).toBe(1);
    expect(result.totalCost).toBe(100);
  });
});

describe("balance constants", () => {
  it("TICK_MS is 40 (25 FPS)", () => {
    expect(TICK_MS).toBe(40);
  });

  it("GOLD_MULTIPLIER is 1000", () => {
    expect(GOLD_MULTIPLIER).toBe(1000);
  });

  it("DEFAULT_COST_MULTIPLIER is 1.15", () => {
    expect(DEFAULT_COST_MULTIPLIER).toBe(1.15);
  });

  it("MAX_OFFLINE_MS is 8 hours", () => {
    // 8 hours = 8 * 60 * 60 * 1000 = 28,800,000 ms
    expect(MAX_OFFLINE_MS).toBe(8 * 60 * 60 * 1000);
    expect(MAX_OFFLINE_MS).toBe(28800000);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("economy integration", () => {
  it("calculates total income and applies to tick", () => {
    const roster: Record<string, HeroState> = {
      barkeep: { level: 10, incomePerSecondU: 1000 },  // 10000/s
      bard: { level: 5, incomePerSecondU: 2000 },      // 10000/s
    };

    const totalIncomePerSecond = calculateTotalIncome(roster);
    expect(totalIncomePerSecond).toBe(20000);

    const incomePerTick = calculateIncomePerTick(totalIncomePerSecond);
    // 20000 * 40 / 1000 = 800
    expect(incomePerTick).toBe(800);
  });

  it("applies tavern multiplier to hero income", () => {
    const roster: Record<string, HeroState> = {
      hero: { level: 10, incomePerSecondU: 1000 },
    };

    const baseIncome = calculateTotalIncome(roster);
    const tavernMultiplier = calculateTavernIncomeMultiplier(5); // 1.25x
    const boostedIncome = applyMultiplier(baseIncome, tavernMultiplier);

    expect(baseIncome).toBe(10000);
    expect(boostedIncome).toBe(12500);
  });

  it("upgrade cost increases exponentially", () => {
    const baseCost = 1000;
    const multiplier = 1.5;

    const cost1 = calculateUpgradeCost(baseCost, multiplier, 0, 1);
    const cost5 = calculateUpgradeCost(baseCost, multiplier, 4, 1);
    const cost10 = calculateUpgradeCost(baseCost, multiplier, 9, 1);

    // Each higher level costs more
    expect(cost5).toBeGreaterThan(cost1);
    expect(cost10).toBeGreaterThan(cost5);
  });
});
