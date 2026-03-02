/**
 * Hero Upgrade Possibility Check Module
 *
 * Provides functions for determining whether a hero can be upgraded
 * and calculating the maximum affordable upgrade levels.
 *
 * @module progression/canUpgrade
 */

import type { GoldU, HeroState } from "../types/state";
import { getHeroConfig, isValidHeroId } from "../config/heroes";
import { calculateTotalUpgradeCost, calculateAffordableUpgrades } from "../config/balance";

// ============================================================================
// RESULT TYPE
// ============================================================================

/**
 * Result of checking if a hero can be upgraded.
 *
 * @property canUpgrade - Whether any upgrade is possible
 * @property reason - Human-readable explanation for the result
 * @property maxLevels - Maximum number of levels that can be upgraded (0 if cannot upgrade)
 */
export interface CanUpgradeResult {
  /** Whether any upgrade is possible */
  readonly canUpgrade: boolean;

  /** Human-readable explanation for the result */
  readonly reason: string;

  /** Maximum number of levels that can be upgraded (0 if cannot upgrade) */
  readonly maxLevels: number;
}

// ============================================================================
// REASONS CONSTANTS
// ============================================================================

/**
 * Possible reasons for upgrade check results.
 * Used for consistent reason strings across the codebase.
 */
export const UPGRADE_REASONS = {
  /** Hero can be upgraded with available gold */
  CAN_UPGRADE: "Sufficient gold available for upgrade",

  /** Hero can be partially upgraded */
  PARTIAL_UPGRADE: "Partial upgrade possible with available gold",

  /** Hero ID does not exist in hero definitions */
  INVALID_HERO_ID: "Invalid hero ID: hero does not exist in definitions",

  /** Hero not found in player's roster */
  HERO_NOT_IN_ROSTER: "Hero not found in player's roster",

  /** Player has no gold available */
  NO_GOLD: "No gold available for upgrade",

  /** Single level upgrade cost exceeds available gold */
  INSUFFICIENT_GOLD: "Insufficient gold for even one upgrade level",

  /** Hero has no current state (edge case) */
  NO_HERO_STATE: "Hero has no current state",
} as const;

// ============================================================================
// UPGRADE CHECK FUNCTION
// ============================================================================

/**
 * Checks if a hero can be upgraded and returns the maximum affordable levels.
 *
 * This function validates:
 * 1. Hero ID exists in hero definitions
 * 2. Hero exists in player's roster
 * 3. Player has sufficient gold for at least one upgrade level
 *
 * @param heroId - The unique identifier of the hero to check
 * @param roster - Player's hero roster mapping hero IDs to their state
 * @param availableGold - Amount of gold available for upgrades (in fixed-point units)
 * @param requestedLevels - Maximum levels to consider (default: Infinity for unlimited)
 * @returns CanUpgradeResult with canUpgrade flag, reason, and maxLevels
 *
 * @example
 * // Check if barkeep can be upgraded with 5000 gold
 * const roster = {
 *   barkeep: { level: 5, incomePerSecondU: 1000 }
 * };
 * const result = canUpgradeHero("barkeep", roster, 5000);
 * // result.canUpgrade might be true if 5000 gold covers at least one level
 *
 * @example
 * // Check with invalid hero ID
 * const result = canUpgradeHero("invalid", roster, 10000);
 * // result = { canUpgrade: false, reason: "Invalid hero ID...", maxLevels: 0 }
 *
 * @example
 * // Check with hero not in roster
 * const result = canUpgradeHero("bard", {}, 10000);
 * // result = { canUpgrade: false, reason: "Hero not found in player's roster", maxLevels: 0 }
 */
export function canUpgradeHero(
  heroId: string,
  roster: Record<string, HeroState>,
  availableGold: GoldU,
  requestedLevels: number = Infinity
): CanUpgradeResult {
  // 1. Validate hero ID exists in definitions
  if (!isValidHeroId(heroId)) {
    return {
      canUpgrade: false,
      reason: UPGRADE_REASONS.INVALID_HERO_ID,
      maxLevels: 0,
    };
  }

  // 2. Check if hero exists in roster
  const heroState = roster[heroId];
  if (!heroState) {
    return {
      canUpgrade: false,
      reason: UPGRADE_REASONS.HERO_NOT_IN_ROSTER,
      maxLevels: 0,
    };
  }

  // 3. Check if player has any gold
  if (availableGold <= 0) {
    return {
      canUpgrade: false,
      reason: UPGRADE_REASONS.NO_GOLD,
      maxLevels: 0,
    };
  }

  // 4. Get hero configuration
  const heroConfig = getHeroConfig(heroId);
  if (!heroConfig) {
    // This should never happen since we validated heroId, but TypeScript needs it
    return {
      canUpgrade: false,
      reason: UPGRADE_REASONS.INVALID_HERO_ID,
      maxLevels: 0,
    };
  }

  // 5. Calculate how many levels can be afforded
  const currentLevel = heroState.level;
  const { affordableLevels, totalCost } = calculateAffordableUpgrades(
    heroConfig.baseUpgradeCost,
    currentLevel,
    availableGold,
    requestedLevels,
    heroConfig.upgradeMultiplier
  );

  // 6. Return result based on affordable levels
  if (affordableLevels === 0) {
    // Cost of single upgrade
    const singleUpgradeCost = calculateTotalUpgradeCost(
      heroConfig.baseUpgradeCost,
      currentLevel,
      1,
      heroConfig.upgradeMultiplier
    );

    return {
      canUpgrade: false,
      reason: `${UPGRADE_REASONS.INSUFFICIENT_GOLD} (need ${singleUpgradeCost}, have ${availableGold})`,
      maxLevels: 0,
    };
  }

  // Determine if full or partial upgrade
  const isPartialUpgrade = affordableLevels < requestedLevels;

  return {
    canUpgrade: true,
    reason: isPartialUpgrade
      ? `${UPGRADE_REASONS.PARTIAL_UPGRADE} (${affordableLevels} of ${requestedLevels} levels, cost: ${totalCost})`
      : `${UPGRADE_REASONS.CAN_UPGRADE} (${affordableLevels} level${affordableLevels > 1 ? "s" : ""}, cost: ${totalCost})`,
    maxLevels: affordableLevels,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the cost for a single level upgrade for a hero.
 *
 * @param heroId - The hero's unique identifier
 * @param currentLevel - The hero's current level
 * @returns Cost in fixed-point units, or 0 if hero ID is invalid
 *
 * @example
 * const cost = getSingleUpgradeCost("barkeep", 5);
 * // Returns the cost to upgrade barkeep from level 5 to 6
 */
export function getSingleUpgradeCost(heroId: string, currentLevel: number): GoldU {
  const heroConfig = getHeroConfig(heroId);
  if (!heroConfig) {
    return 0;
  }

  return calculateTotalUpgradeCost(
    heroConfig.baseUpgradeCost,
    currentLevel,
    1,
    heroConfig.upgradeMultiplier
  );
}

/**
 * Calculate the total cost to upgrade a hero by multiple levels.
 *
 * @param heroId - The hero's unique identifier
 * @param currentLevel - The hero's current level
 * @param levels - Number of levels to upgrade
 * @returns Total cost in fixed-point units, or 0 if hero ID is invalid
 *
 * @example
 * const cost = getTotalUpgradeCost("barkeep", 5, 3);
 * // Returns the cost to upgrade barkeep from level 5 to 8 (3 levels)
 */
export function getTotalUpgradeCost(
  heroId: string,
  currentLevel: number,
  levels: number
): GoldU {
  const heroConfig = getHeroConfig(heroId);
  if (!heroConfig) {
    return 0;
  }

  return calculateTotalUpgradeCost(
    heroConfig.baseUpgradeCost,
    currentLevel,
    levels,
    heroConfig.upgradeMultiplier
  );
}
