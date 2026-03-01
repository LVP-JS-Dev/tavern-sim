/**
 * Upgrade Cost Calculation Module
 *
 * Provides functions for calculating hero upgrade costs using fixed-point arithmetic.
 *
 * @module economy/upgrade
 */

import type { GoldU } from "../types/state";

// ============================================================================
// FIXED-POINT CONSTANTS
// ============================================================================

/**
 * Multiplier for fixed-point arithmetic.
 * Gold values are stored as gold * GOLD_MULTIPLIER to avoid floating-point errors.
 */
const GOLD_MULTIPLIER = 1000;

// ============================================================================
// UPGRADE COST CALCULATION
// ============================================================================

/**
 * Calculates the cost to upgrade a hero by one or more levels.
 *
 * Formula: cost = Σ(baseCost * (multiplier ^ level)) for each level from currentLevel to currentLevel + levelsToBuy - 1
 *
 * Uses fixed-point arithmetic to avoid floating-point precision errors.
 * The multiplier is applied as a fixed-point value (e.g., 1.5 becomes 1500).
 *
 * @param baseCostU - Base upgrade cost in fixed-point units (GoldU)
 * @param multiplier - Cost multiplier per level (e.g., 1.5 means 50% increase per level)
 * @param currentLevel - Current hero level
 * @param levelsToBuy - Number of levels to purchase
 * @returns Total cost in fixed-point units (GoldU)
 *
 * @example
 * // Single level upgrade from level 0
 * calculateUpgradeCost(1000, 1.5, 0, 1); // 1000 (baseCost * 1.5^0 = 1000)
 *
 * @example
 * // Single level upgrade from level 1
 * calculateUpgradeCost(1000, 1.5, 1, 1); // 1500 (baseCost * 1.5^1 = 1500)
 *
 * @example
 * // Multiple level upgrade from level 0
 * calculateUpgradeCost(1000, 1.5, 0, 2); // 2500 (1000 + 1500)
 */
export function calculateUpgradeCost(
  baseCostU: GoldU,
  multiplier: number,
  currentLevel: number,
  levelsToBuy: number
): GoldU {
  // Handle edge cases
  if (levelsToBuy <= 0) {
    return 0;
  }

  if (currentLevel < 0) {
    currentLevel = 0;
  }

  let totalCost: GoldU = 0;

  // Convert multiplier to fixed-point for calculations
  // multiplier 1.5 becomes 1500
  const multiplierU = Math.round(multiplier * GOLD_MULTIPLIER);

  // Calculate cost for each level
  for (let i = 0; i < levelsToBuy; i++) {
    const targetLevel = currentLevel + i;

    // Calculate multiplier^targetLevel using fixed-point arithmetic
    // We need to track the scale factor since we're working with fixed-point
    let powerU = GOLD_MULTIPLIER; // Start with 1.0 in fixed-point
    for (let p = 0; p < targetLevel; p++) {
      powerU = Math.floor((powerU * multiplierU) / GOLD_MULTIPLIER);
    }

    // Cost for this level: baseCost * (multiplier ^ targetLevel)
    const levelCost = Math.floor((baseCostU * powerU) / GOLD_MULTIPLIER);
    totalCost += levelCost;
  }

  return totalCost;
}
