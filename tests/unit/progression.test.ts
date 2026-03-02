/**
 * Tests for Progression Module
 *
 * Verifies hero upgrade validation, cost calculations, and partial upgrade logic.
 * Core formulas:
 * - Upgrade cost: baseCost * (multiplier ^ level)
 * - Applied levels: floor(availableGold / costPerLevel) for flat model
 *
 * @module tests/unit/progression.test
 */

import { describe, it, expect } from "vitest";
import {
  canUpgradeHero,
  getSingleUpgradeCost,
  getTotalUpgradeCost,
  UPGRADE_REASONS,
  type CanUpgradeResult,
} from "../../src/progression/canUpgrade";
import {
  validateHeroUpgrade,
  calculateAppliedLevels,
  calculateAppliedLevelsDetailed,
  canAffordUpgrade,
  getNextLevelCost,
  calculateMaxAffordableLevels,
  VALIDATION_REASONS,
  type UpgradeValidationResult,
  type AppliedLevelsResult,
} from "../../src/progression/rules";
import type { HeroState } from "../../src/types/state";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a hero state for testing.
 */
function createHeroState(level: number, incomePerSecondU: number = 1000): HeroState {
  return { level, incomePerSecondU };
}

/**
 * Standard roster for testing with multiple heroes.
 */
const standardRoster: Record<string, HeroState> = {
  barkeep: createHeroState(5, 1000),
  bard: createHeroState(3, 2500),
  chef: createHeroState(0, 5000),
};

// ============================================================================
// CAN UPGRADE HERO TESTS
// ============================================================================

describe("canUpgradeHero", () => {
  describe("invalid inputs", () => {
    it("returns false for invalid hero ID", () => {
      const result = canUpgradeHero("nonexistent", standardRoster, 10000);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe(UPGRADE_REASONS.INVALID_HERO_ID);
      expect(result.maxLevels).toBe(0);
    });

    it("returns false for hero not in roster", () => {
      const result = canUpgradeHero("bard", { barkeep: createHeroState(5) }, 10000);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe(UPGRADE_REASONS.HERO_NOT_IN_ROSTER);
      expect(result.maxLevels).toBe(0);
    });

    it("returns false for empty roster", () => {
      const result = canUpgradeHero("barkeep", {}, 10000);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe(UPGRADE_REASONS.HERO_NOT_IN_ROSTER);
      expect(result.maxLevels).toBe(0);
    });
  });

  describe("gold validation", () => {
    it("returns false for zero gold", () => {
      const result = canUpgradeHero("barkeep", standardRoster, 0);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe(UPGRADE_REASONS.NO_GOLD);
      expect(result.maxLevels).toBe(0);
    });

    it("returns false for negative gold", () => {
      const result = canUpgradeHero("barkeep", standardRoster, -1000);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toBe(UPGRADE_REASONS.NO_GOLD);
      expect(result.maxLevels).toBe(0);
    });

    it("returns false for insufficient gold", () => {
      // Barkeep at level 5: next upgrade costs 10000 * 1.15^5 = ~20114
      const result = canUpgradeHero("barkeep", standardRoster, 100);
      expect(result.canUpgrade).toBe(false);
      expect(result.reason).toContain("Insufficient gold");
      expect(result.maxLevels).toBe(0);
    });
  });

  describe("successful upgrades", () => {
    it("returns true when gold is sufficient for one level", () => {
      // Barkeep at level 5: upgrade costs ~20114
      const result = canUpgradeHero("barkeep", standardRoster, 25000);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeGreaterThanOrEqual(1);
    });

    it("returns true for multiple affordable levels", () => {
      // Chef at level 0: first upgrade costs 150000
      const result = canUpgradeHero("chef", standardRoster, 500000);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeGreaterThanOrEqual(1);
    });

    it("respects requestedLevels parameter", () => {
      const result = canUpgradeHero("barkeep", standardRoster, 1000000, 2);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeLessThanOrEqual(2);
    });

    it("handles partial upgrades", () => {
      // Request more levels than gold can afford
      const result = canUpgradeHero("barkeep", standardRoster, 25000, 10);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeLessThan(10);
      expect(result.reason).toContain("Partial");
    });
  });

  describe("different heroes", () => {
    it("calculates correctly for bard (different multiplier)", () => {
      // Bard has 1.18 multiplier
      const result = canUpgradeHero("bard", standardRoster, 100000);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeGreaterThan(0);
    });

    it("calculates correctly for chef (level 0)", () => {
      // Chef at level 0, base cost 150000
      const result = canUpgradeHero("chef", standardRoster, 200000);
      expect(result.canUpgrade).toBe(true);
      expect(result.maxLevels).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// GET SINGLE UPGRADE COST TESTS
// ============================================================================

describe("getSingleUpgradeCost", () => {
  it("returns cost for barkeep at level 0", () => {
    // Barkeep base cost: 10000, multiplier: 1.15
    // Level 0 to 1: 10000 * 1.15^0 = 10000
    const cost = getSingleUpgradeCost("barkeep", 0);
    expect(cost).toBe(10000);
  });

  it("returns cost for barkeep at level 5", () => {
    // Level 5 to 6: 10000 * 1.15^5 = ~20113.57 -> 20113
    const cost = getSingleUpgradeCost("barkeep", 5);
    expect(cost).toBeGreaterThan(20000);
    expect(cost).toBeLessThan(21000);
  });

  it("returns 0 for invalid hero ID", () => {
    const cost = getSingleUpgradeCost("invalid", 5);
    expect(cost).toBe(0);
  });

  it("increases with level for all heroes", () => {
    const cost0 = getSingleUpgradeCost("bard", 0);
    const cost5 = getSingleUpgradeCost("bard", 5);
    const cost10 = getSingleUpgradeCost("bard", 10);

    expect(cost5).toBeGreaterThan(cost0);
    expect(cost10).toBeGreaterThan(cost5);
  });
});

// ============================================================================
// GET TOTAL UPGRADE COST TESTS
// ============================================================================

describe("getTotalUpgradeCost", () => {
  it("calculates cost for single level", () => {
    const singleCost = getSingleUpgradeCost("barkeep", 0);
    const totalCost = getTotalUpgradeCost("barkeep", 0, 1);
    expect(totalCost).toBe(singleCost);
  });

  it("calculates cost for multiple levels", () => {
    // 3 levels from level 0: costs for levels 0, 1, 2
    const totalCost = getTotalUpgradeCost("barkeep", 0, 3);
    const cost0 = getSingleUpgradeCost("barkeep", 0);
    const cost1 = getSingleUpgradeCost("barkeep", 1);
    const cost2 = getSingleUpgradeCost("barkeep", 2);

    expect(totalCost).toBe(cost0 + cost1 + cost2);
  });

  it("returns 0 for zero levels", () => {
    const cost = getTotalUpgradeCost("barkeep", 5, 0);
    expect(cost).toBe(0);
  });

  it("returns 0 for invalid hero ID", () => {
    const cost = getTotalUpgradeCost("invalid", 0, 5);
    expect(cost).toBe(0);
  });
});

// ============================================================================
// CALCULATE APPLIED LEVELS TESTS (Flat model)
// ============================================================================

describe("calculateAppliedLevels", () => {
  it("calculates applied levels correctly", () => {
    // 1000 gold, 100 cost per level = 10 levels
    expect(calculateAppliedLevels(1000, 100, 0)).toBe(10);
  });

  it("returns 0 when gold is insufficient", () => {
    expect(calculateAppliedLevels(50, 100, 0)).toBe(0);
  });

  it("returns 0 for zero gold", () => {
    expect(calculateAppliedLevels(0, 100, 0)).toBe(0);
  });

  it("returns 0 for negative gold", () => {
    expect(calculateAppliedLevels(-100, 100, 0)).toBe(0);
  });

  it("returns 0 for zero cost per level", () => {
    expect(calculateAppliedLevels(1000, 0, 0)).toBe(0);
  });

  it("returns 0 for negative cost per level", () => {
    expect(calculateAppliedLevels(1000, -100, 0)).toBe(0);
  });

  it("handles exact gold amount", () => {
    expect(calculateAppliedLevels(500, 100, 3)).toBe(5);
  });

  it("handles partial gold (floors result)", () => {
    // 550 / 100 = 5.5 -> 5
    expect(calculateAppliedLevels(550, 100, 0)).toBe(5);
  });

  it("currentLevel parameter is for context only", () => {
    // Current level doesn't affect flat-cost calculation
    const result1 = calculateAppliedLevels(1000, 100, 0);
    const result2 = calculateAppliedLevels(1000, 100, 100);
    expect(result1).toBe(result2);
  });
});

// ============================================================================
// CALCULATE APPLIED LEVELS DETAILED TESTS
// ============================================================================

describe("calculateAppliedLevelsDetailed", () => {
  it("returns detailed result with all fields", () => {
    const result = calculateAppliedLevelsDetailed(1000, 100, 0);

    expect(result.appliedLevels).toBe(10);
    expect(result.totalCost).toBe(1000);
    expect(result.remainingGold).toBe(0);
  });

  it("calculates remaining gold correctly", () => {
    const result = calculateAppliedLevelsDetailed(550, 100, 0);

    expect(result.appliedLevels).toBe(5);
    expect(result.totalCost).toBe(500);
    expect(result.remainingGold).toBe(50);
  });

  it("returns zeros for insufficient gold", () => {
    const result = calculateAppliedLevelsDetailed(50, 100, 0);

    expect(result.appliedLevels).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.remainingGold).toBe(50);
  });

  it("handles zero gold", () => {
    const result = calculateAppliedLevelsDetailed(0, 100, 0);

    expect(result.appliedLevels).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.remainingGold).toBe(0);
  });
});

// ============================================================================
// VALIDATE HERO UPGRADE TESTS (Exponential model)
// ============================================================================

describe("validateHeroUpgrade", () => {
  describe("input validation", () => {
    it("returns invalid for zero requested levels", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, 10000, 0, 1000, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.INVALID_LEVELS);
      expect(result.appliedLevels).toBe(0);
      expect(result.isPartial).toBe(false);
    });

    it("returns invalid for negative requested levels", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, 10000, -5, 1000, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.INVALID_LEVELS);
    });

    it("returns invalid for zero base cost", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, 10000, 1, 0, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.INVALID_COST);
    });

    it("returns invalid for negative base cost", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, 10000, 1, -100, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.INVALID_COST);
    });

    it("returns invalid for zero gold", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, 0, 1, 100, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.NO_GOLD);
    });

    it("returns invalid for negative gold", () => {
      const hero = createHeroState(5);
      const result = validateHeroUpgrade(hero, -100, 1, 100, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe(VALIDATION_REASONS.NO_GOLD);
    });
  });

  describe("insufficient gold", () => {
    it("returns invalid when gold is insufficient", () => {
      const hero = createHeroState(0);
      // Need 1000 for first upgrade, have 500
      const result = validateHeroUpgrade(hero, 500, 1, 1000, 1.15);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Insufficient gold");
      expect(result.appliedLevels).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe("successful validations", () => {
    it("validates single level upgrade", () => {
      const hero = createHeroState(0);
      const result = validateHeroUpgrade(hero, 5000, 1, 1000, 1.15);

      expect(result.isValid).toBe(true);
      expect(result.appliedLevels).toBe(1);
      expect(result.totalCost).toBe(1000);
      expect(result.isPartial).toBe(false);
    });

    it("validates multi-level upgrade", () => {
      const hero = createHeroState(0);
      // 5000 gold should buy 3-4 levels at base 1000, 1.15 multiplier
      const result = validateHeroUpgrade(hero, 5000, 3, 1000, 1.15);

      expect(result.isValid).toBe(true);
      expect(result.appliedLevels).toBe(3);
      expect(result.isPartial).toBe(false);
    });

    it("identifies partial upgrades", () => {
      const hero = createHeroState(0);
      // Request 10 levels but only afford a few
      const result = validateHeroUpgrade(hero, 3000, 10, 1000, 1.15);

      expect(result.isValid).toBe(true);
      expect(result.isPartial).toBe(true);
      expect(result.appliedLevels).toBeLessThan(10);
      expect(result.reason).toContain("Partial");
    });

    it("uses default multiplier when not specified", () => {
      const hero = createHeroState(0);
      const result1 = validateHeroUpgrade(hero, 5000, 1, 1000);
      const result2 = validateHeroUpgrade(hero, 5000, 1, 1000, 1.15);

      expect(result1.totalCost).toBe(result2.totalCost);
    });

    it("uses default requested levels of 1", () => {
      const hero = createHeroState(0);
      const result = validateHeroUpgrade(hero, 5000, undefined, 1000, 1.15);

      expect(result.isValid).toBe(true);
      expect(result.appliedLevels).toBe(1);
    });
  });

  describe("exponential cost scaling", () => {
    it("higher levels cost more", () => {
      const heroLevel0 = createHeroState(0);
      const heroLevel10 = createHeroState(10);

      const result0 = validateHeroUpgrade(heroLevel0, 100000, 1, 1000, 1.15);
      const result10 = validateHeroUpgrade(heroLevel10, 100000, 1, 1000, 1.15);

      // Both can upgrade, but level 10 costs more
      expect(result0.totalCost).toBeLessThan(result10.totalCost);
    });

    it("higher multiplier means faster cost growth", () => {
      const hero = createHeroState(5);

      const result1_15 = validateHeroUpgrade(hero, 100000, 1, 1000, 1.15);
      const result1_25 = validateHeroUpgrade(hero, 100000, 1, 1000, 1.25);

      expect(result1_25.totalCost).toBeGreaterThan(result1_15.totalCost);
    });
  });
});

// ============================================================================
// CAN AFFORD UPGRADE TESTS
// ============================================================================

describe("canAffordUpgrade", () => {
  it("returns true when gold is sufficient", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, 5000, 1000, 1.15)).toBe(true);
  });

  it("returns false when gold is insufficient", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, 500, 1000, 1.15)).toBe(false);
  });

  it("returns false for zero gold", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, 0, 1000, 1.15)).toBe(false);
  });

  it("returns false for negative gold", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, -100, 1000, 1.15)).toBe(false);
  });

  it("returns false for zero base cost", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, 5000, 0, 1.15)).toBe(false);
  });

  it("returns false for negative base cost", () => {
    const hero = createHeroState(0);
    expect(canAffordUpgrade(hero, 5000, -100, 1.15)).toBe(false);
  });

  it("uses default multiplier", () => {
    const hero = createHeroState(0);
    const result1 = canAffordUpgrade(hero, 5000, 1000);
    const result2 = canAffordUpgrade(hero, 5000, 1000, 1.15);
    expect(result1).toBe(result2);
  });

  it("higher level heroes need more gold", () => {
    const heroLevel0 = createHeroState(0);
    const heroLevel10 = createHeroState(10);

    // Same gold amount
    const gold = 5000;
    const baseCost = 1000;

    expect(canAffordUpgrade(heroLevel0, gold, baseCost, 1.15)).toBe(true);
    expect(canAffordUpgrade(heroLevel10, gold, baseCost, 1.15)).toBe(false);
  });
});

// ============================================================================
// GET NEXT LEVEL COST TESTS
// ============================================================================

describe("getNextLevelCost", () => {
  it("calculates cost for level 0", () => {
    // 1000 * 1.15^0 = 1000
    expect(getNextLevelCost(0, 1000, 1.15)).toBe(1000);
  });

  it("calculates cost for level 5", () => {
    // 1000 * 1.15^5 = ~2011.35 -> 2011
    const cost = getNextLevelCost(5, 1000, 1.15);
    expect(cost).toBeGreaterThan(2000);
    expect(cost).toBeLessThan(2100);
  });

  it("uses default multiplier", () => {
    const cost1 = getNextLevelCost(5, 1000);
    const cost2 = getNextLevelCost(5, 1000, 1.15);
    expect(cost1).toBe(cost2);
  });

  it("costs increase exponentially", () => {
    const cost0 = getNextLevelCost(0, 1000, 1.15);
    const cost1 = getNextLevelCost(1, 1000, 1.15);
    const cost2 = getNextLevelCost(2, 1000, 1.15);

    expect(cost1).toBeGreaterThan(cost0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  it("handles multiplier of 1 (no scaling)", () => {
    // With multiplier 1, all levels cost the same
    const cost0 = getNextLevelCost(0, 1000, 1.0);
    const cost10 = getNextLevelCost(10, 1000, 1.0);

    expect(cost0).toBe(1000);
    expect(cost10).toBe(1000);
  });
});

// ============================================================================
// CALCULATE MAX AFFORDABLE LEVELS TESTS
// ============================================================================

describe("calculateMaxAffordableLevels", () => {
  it("calculates maximum levels with sufficient gold", () => {
    const hero = createHeroState(0);
    // With 5000 gold and base cost 1000, 1.15 multiplier:
    // Level 0: 1000, Level 1: 1150, Level 2: 1322, Level 3: 1520 = 4992
    const levels = calculateMaxAffordableLevels(hero, 5000, 1000, 1.15);
    expect(levels).toBeGreaterThanOrEqual(3);
    expect(levels).toBeLessThanOrEqual(5);
  });

  it("returns 0 for insufficient gold", () => {
    const hero = createHeroState(0);
    expect(calculateMaxAffordableLevels(hero, 500, 1000, 1.15)).toBe(0);
  });

  it("returns 0 for zero gold", () => {
    const hero = createHeroState(0);
    expect(calculateMaxAffordableLevels(hero, 0, 1000, 1.15)).toBe(0);
  });

  it("returns 0 for negative gold", () => {
    const hero = createHeroState(0);
    expect(calculateMaxAffordableLevels(hero, -100, 1000, 1.15)).toBe(0);
  });

  it("returns 0 for zero base cost", () => {
    const hero = createHeroState(0);
    expect(calculateMaxAffordableLevels(hero, 5000, 0, 1.15)).toBe(0);
  });

  it("respects maxLevels parameter", () => {
    const hero = createHeroState(0);
    // With lots of gold but max 3 levels
    const levels = calculateMaxAffordableLevels(hero, 1000000, 100, 1.15, 3);
    expect(levels).toBeLessThanOrEqual(3);
  });

  it("uses default maxLevels of 1000", () => {
    const hero = createHeroState(0);
    const levels1 = calculateMaxAffordableLevels(hero, 1000000, 100, 1.15);
    const levels2 = calculateMaxAffordableLevels(hero, 1000000, 100, 1.15, 1000);
    expect(levels1).toBe(levels2);
  });

  it("higher level heroes can afford fewer levels with same gold", () => {
    const heroLevel0 = createHeroState(0);
    const heroLevel10 = createHeroState(10);
    const gold = 100000;

    const levels0 = calculateMaxAffordableLevels(heroLevel0, gold, 1000, 1.15);
    const levels10 = calculateMaxAffordableLevels(heroLevel10, gold, 1000, 1.15);

    expect(levels0).toBeGreaterThan(levels10);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("progression integration", () => {
  it("canUpgradeHero integrates with hero configs", () => {
    const roster: Record<string, HeroState> = {
      barkeep: createHeroState(0),
    };

    // Barkeep: baseCost 10000, multiplier 1.15
    // Level 0 upgrade: 10000
    const result = canUpgradeHero("barkeep", roster, 15000);

    expect(result.canUpgrade).toBe(true);
    expect(result.maxLevels).toBe(1);
  });

  it("validateHeroUpgrade matches calculateAffordableUpgrades", () => {
    const hero = createHeroState(5);
    const availableGold = 50000;
    const baseCost = 1000;
    const multiplier = 1.15;

    const validation = validateHeroUpgrade(hero, availableGold, 100, baseCost, multiplier);
    const maxLevels = calculateMaxAffordableLevels(hero, availableGold, baseCost, multiplier);

    expect(validation.appliedLevels).toBe(maxLevels);
  });

  it("full upgrade workflow", () => {
    // Simulate a full upgrade decision workflow
    const roster: Record<string, HeroState> = {
      barkeep: createHeroState(5, 1000),
    };
    const availableGold = 50000;

    // 1. Check if upgrade is possible
    const checkResult = canUpgradeHero("barkeep", roster, availableGold);
    expect(checkResult.canUpgrade).toBe(true);

    // 2. Get cost for the upgrade
    const cost = getTotalUpgradeCost("barkeep", 5, checkResult.maxLevels);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(availableGold);

    // 3. Validate the upgrade
    const hero = roster["barkeep"];
    const validation = validateHeroUpgrade(
      hero,
      availableGold,
      checkResult.maxLevels,
      10000, // barkeep base cost
      1.15 // barkeep multiplier
    );

    expect(validation.isValid).toBe(true);
    expect(validation.appliedLevels).toBe(checkResult.maxLevels);
    expect(validation.totalCost).toBe(cost);
  });
});
