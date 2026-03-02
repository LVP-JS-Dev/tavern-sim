/**
 * Upgrade Validation Rules Module
 *
 * Provides functions for validating hero upgrades and calculating
 * partial upgrade logic when insufficient gold is available.
 *
 * This module implements the core progression rules:
 * - Upgrade validation (can a hero be upgraded?)
 * - Partial upgrade calculation (how many levels can be afforded?)
 * - Cost calculation for upgrades
 *
 * @module progression/rules
 */

import type { GoldU, HeroState } from "../types/state";
import { calculateTotalUpgradeCost, calculateAffordableUpgrades } from "../config/balance";

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result of validating a hero upgrade request.
 *
 * @property isValid - Whether the upgrade can be performed
 * @property reason - Human-readable explanation
 * @property appliedLevels - Number of levels that can be applied (0 if invalid)
 * @property totalCost - Total gold cost for applied levels
 * @property isPartial - Whether this is a partial upgrade (appliedLevels < requestedLevels)
 */
export interface UpgradeValidationResult {
  /** Whether the upgrade can be performed */
  readonly isValid: boolean;

  /** Human-readable explanation */
  readonly reason: string;

  /** Number of levels that can be applied (0 if invalid) */
  readonly appliedLevels: number;

  /** Total gold cost for applied levels */
  readonly totalCost: GoldU;

  /** Whether this is a partial upgrade (appliedLevels < requestedLevels) */
  readonly isPartial: boolean;
}

/**
 * Result of calculating applied levels for a partial upgrade.
 *
 * @property appliedLevels - Number of levels that can be afforded
 * @property totalCost - Total gold cost for those levels
 * @property remainingGold - Gold left after the upgrade
 */
export interface AppliedLevelsResult {
  /** Number of levels that can be afforded */
  readonly appliedLevels: number;

  /** Total gold cost for those levels */
  readonly totalCost: GoldU;

  /** Gold left after the upgrade */
  readonly remainingGold: GoldU;
}

// ============================================================================
// VALIDATION REASON CONSTANTS
// ============================================================================

/**
 * Possible reasons for upgrade validation results.
 * Used for consistent reason strings across the codebase.
 */
export const VALIDATION_REASONS = {
  /** Upgrade is valid and can be performed */
  VALID_UPGRADE: "Upgrade is valid",

  /** Upgrade is valid but only partial levels can be applied */
  PARTIAL_UPGRADE: "Partial upgrade possible",

  /** No gold available for upgrade */
  NO_GOLD: "No gold available for upgrade",

  /** Insufficient gold for even one level */
  INSUFFICIENT_GOLD: "Insufficient gold for upgrade",

  /** Requested levels is zero or negative */
  INVALID_LEVELS: "Requested levels must be positive",

  /** Base cost is zero or negative */
  INVALID_COST: "Base cost must be positive",
} as const;

// ============================================================================
// PARTIAL UPGRADE CALCULATION
// ============================================================================

/**
 * Calculate how many upgrade levels can be applied with available gold.
 *
 * This function uses a simple flat-cost model where each level costs the same.
 * For exponential cost scaling, use validateHeroUpgrade instead.
 *
 * Formula: appliedLevels = floor(availableGold / costPerLevel)
 *
 * @param availableGold - Gold available for the upgrade (in fixed-point units)
 * @param costPerLevel - Cost per level (in fixed-point units)
 * @param currentLevel - Current level of the hero (used for context, not calculation)
 * @returns Number of levels that can be afforded
 *
 * @example
 * // With 1000 gold and 100 cost per level
 * calculateAppliedLevels(1000, 100, 5); // Returns 10
 *
 * @example
 * // With insufficient gold
 * calculateAppliedLevels(50, 100, 0); // Returns 0
 *
 * @example
 * // With exact gold for 5 levels
 * calculateAppliedLevels(500, 100, 3); // Returns 5
 */
export function calculateAppliedLevels(
  availableGold: number,
  costPerLevel: number,
  currentLevel: number
): number {
  // Handle edge cases
  if (availableGold <= 0 || costPerLevel <= 0) {
    return 0;
  }

  // Simple flat-cost calculation: how many levels can we afford?
  return Math.floor(availableGold / costPerLevel);
}

/**
 * Calculate applied levels with detailed result information.
 *
 * This function returns not just the number of levels, but also
 * the total cost and remaining gold after the upgrade.
 *
 * @param availableGold - Gold available for the upgrade (in fixed-point units)
 * @param costPerLevel - Cost per level (in fixed-point units)
 * @param currentLevel - Current level of the hero
 * @returns AppliedLevelsResult with levels, cost, and remaining gold
 *
 * @example
 * const result = calculateAppliedLevelsDetailed(1000, 100, 5);
 * // result = { appliedLevels: 10, totalCost: 1000, remainingGold: 0 }
 */
export function calculateAppliedLevelsDetailed(
  availableGold: GoldU,
  costPerLevel: GoldU,
  currentLevel: number
): AppliedLevelsResult {
  const appliedLevels = calculateAppliedLevels(availableGold, costPerLevel, currentLevel);
  const totalCost = appliedLevels * costPerLevel;
  const remainingGold = availableGold - totalCost;

  return {
    appliedLevels,
    totalCost,
    remainingGold,
  };
}

// ============================================================================
// UPGRADE VALIDATION
// ============================================================================

/**
 * Validate a hero upgrade request with exponential cost scaling.
 *
 * This function validates whether a hero can be upgraded and calculates
 * how many levels can be afforded. It supports partial upgrades when
 * insufficient gold is available for the full requested amount.
 *
 * Cost formula: cost = baseCost * (multiplier ^ level)
 *
 * @param heroState - Current state of the hero to upgrade
 * @param availableGold - Gold available for the upgrade
 * @param requestedLevels - Number of levels requested (default: 1)
 * @param baseCost - Base upgrade cost at level 0
 * @param multiplier - Cost multiplier per level (default: 1.15)
 * @returns UpgradeValidationResult with validation status and details
 *
 * @example
 * // Validate upgrade with enough gold
 * const hero = { level: 5, incomePerSecondU: 1000 };
 * const result = validateHeroUpgrade(hero, 10000, 3, 100, 1.15);
 * // result.isValid = true, result.appliedLevels = 3
 *
 * @example
 * // Validate partial upgrade
 * const result = validateHeroUpgrade(hero, 300, 5, 100, 1.15);
 * // result.isValid = true, result.isPartial = true, result.appliedLevels < 5
 */
export function validateHeroUpgrade(
  heroState: HeroState,
  availableGold: GoldU,
  requestedLevels: number = 1,
  baseCost: GoldU,
  multiplier: number = 1.15
): UpgradeValidationResult {
  // Validate inputs
  if (requestedLevels <= 0) {
    return {
      isValid: false,
      reason: VALIDATION_REASONS.INVALID_LEVELS,
      appliedLevels: 0,
      totalCost: 0,
      isPartial: false,
    };
  }

  if (baseCost <= 0) {
    return {
      isValid: false,
      reason: VALIDATION_REASONS.INVALID_COST,
      appliedLevels: 0,
      totalCost: 0,
      isPartial: false,
    };
  }

  if (availableGold <= 0) {
    return {
      isValid: false,
      reason: VALIDATION_REASONS.NO_GOLD,
      appliedLevels: 0,
      totalCost: 0,
      isPartial: false,
    };
  }

  // Calculate affordable levels using exponential cost formula
  const { affordableLevels, totalCost } = calculateAffordableUpgrades(
    baseCost,
    heroState.level,
    availableGold,
    requestedLevels,
    multiplier
  );

  // Check if we can afford at least one level
  if (affordableLevels === 0) {
    const singleCost = calculateTotalUpgradeCost(
      baseCost,
      heroState.level,
      1,
      multiplier
    );

    return {
      isValid: false,
      reason: `${VALIDATION_REASONS.INSUFFICIENT_GOLD} (need ${singleCost}, have ${availableGold})`,
      appliedLevels: 0,
      totalCost: 0,
      isPartial: false,
    };
  }

  // Determine if this is a partial upgrade
  const isPartial = affordableLevels < requestedLevels;

  return {
    isValid: true,
    reason: isPartial
      ? `${VALIDATION_REASONS.PARTIAL_UPGRADE} (${affordableLevels} of ${requestedLevels} levels)`
      : VALIDATION_REASONS.VALID_UPGRADE,
    appliedLevels: affordableLevels,
    totalCost,
    isPartial,
  };
}

// ============================================================================
// UPGRADE RULE CHECKS
// ============================================================================

/**
 * Check if a hero can be upgraded at all (at least one level).
 *
 * @param heroState - Current state of the hero
 * @param availableGold - Gold available for the upgrade
 * @param baseCost - Base upgrade cost
 * @param multiplier - Cost multiplier per level (default: 1.15)
 * @returns True if at least one level can be afforded
 *
 * @example
 * const canUpgrade = canAffordUpgrade(heroState, 1000, 100);
 * // Returns true if 1000 gold can buy at least one level
 */
export function canAffordUpgrade(
  heroState: HeroState,
  availableGold: GoldU,
  baseCost: GoldU,
  multiplier: number = 1.15
): boolean {
  if (availableGold <= 0 || baseCost <= 0) {
    return false;
  }

  const { affordableLevels } = calculateAffordableUpgrades(
    baseCost,
    heroState.level,
    availableGold,
    1,
    multiplier
  );

  return affordableLevels > 0;
}

/**
 * Calculate the cost for the next single level upgrade.
 *
 * @param currentLevel - Current hero level
 * @param baseCost - Base upgrade cost at level 0
 * @param multiplier - Cost multiplier per level (default: 1.15)
 * @returns Cost for the next level upgrade
 *
 * @example
 * const cost = getNextLevelCost(5, 100, 1.15);
 * // Returns cost to upgrade from level 5 to 6
 */
export function getNextLevelCost(
  currentLevel: number,
  baseCost: GoldU,
  multiplier: number = 1.15
): GoldU {
  return calculateTotalUpgradeCost(baseCost, currentLevel, 1, multiplier);
}

/**
 * Calculate maximum levels that can be afforded with available gold.
 *
 * This function finds the maximum number of levels that can be purchased
 * without a specific request limit.
 *
 * @param heroState - Current state of the hero
 * @param availableGold - Gold available for upgrades
 * @param baseCost - Base upgrade cost at level 0
 * @param multiplier - Cost multiplier per level (default: 1.15)
 * @param maxLevels - Maximum levels to consider (default: 1000)
 * @returns Number of levels that can be afforded
 *
 * @example
 * const maxLevels = calculateMaxAffordableLevels(heroState, 10000, 100);
 * // Returns the maximum levels purchasable with 10000 gold
 */
export function calculateMaxAffordableLevels(
  heroState: HeroState,
  availableGold: GoldU,
  baseCost: GoldU,
  multiplier: number = 1.15,
  maxLevels: number = 1000
): number {
  if (availableGold <= 0 || baseCost <= 0) {
    return 0;
  }

  const { affordableLevels } = calculateAffordableUpgrades(
    baseCost,
    heroState.level,
    availableGold,
    maxLevels,
    multiplier
  );

  return affordableLevels;
}
