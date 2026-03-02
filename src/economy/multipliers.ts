/**
 * Multiplier Calculation Module
 *
 * Provides functions for applying various multipliers in the game economy.
 * Used for income bonuses, cost reductions, and other percentage-based effects.
 *
 * @module economy/multipliers
 */

import type { GoldU } from "../types/state";

// ============================================================================
// MULTIPLIER TYPES
// ============================================================================

/**
 * Represents a game multiplier that can be applied to various values.
 * Multipliers are stored as integers representing the percentage (e.g., 150 = 1.5x).
 */
export type MultiplierValue = number;

/**
 * Configuration for a multiplier with source tracking.
 * Used for displaying where bonuses come from (upgrades, achievements, etc.).
 */
export interface MultiplierSource {
  /** The multiplier value (e.g., 1.5 means 150%) */
  value: number;
  /** Source identifier (e.g., "tavern_upgrade", "achievement") */
  source: string;
}

// ============================================================================
// BASIC MULTIPLIER FUNCTIONS
// ============================================================================

/**
 * Applies a multiplier to a base value.
 *
 * Formula: result = floor(baseValue * multiplier)
 *
 * @param baseValue - The base value to multiply (in fixed-point units)
 * @param multiplier - The multiplier to apply (e.g., 2 for 2x, 1.5 for 50% bonus)
 * @returns The multiplied value in fixed-point units (GoldU)
 *
 * @example
 * // Double a value
 * applyMultiplier(1000, 2); // 2000
 *
 * @example
 * // Apply 50% bonus (1.5x multiplier)
 * applyMultiplier(1000, 1.5); // 1500
 *
 * @example
 * // Apply 10% penalty (0.9x multiplier)
 * applyMultiplier(1000, 0.9); // 900
 */
export function applyMultiplier(baseValue: GoldU, multiplier: number): GoldU {
  return Math.floor(baseValue * multiplier);
}

/**
 * Applies multiple multipliers sequentially (stacking multiplicatively).
 *
 * Formula: result = baseValue * multiplier1 * multiplier2 * ... * multiplierN
 *
 * Note: Multipliers are applied multiplicatively, not additively.
 * Two 2x multipliers result in 4x total, not 3x.
 *
 * @param baseValue - The base value to multiply (in fixed-point units)
 * @param multipliers - Array of multipliers to apply in sequence
 * @returns The final value after all multipliers (in fixed-point units)
 *
 * @example
 * // Apply two 2x multipliers (results in 4x)
 * applyMultipliers(1000, [2, 2]); // 4000
 *
 * @example
 * // Apply 2x and 1.5x (results in 3x)
 * applyMultipliers(1000, [2, 1.5]); // 3000
 */
export function applyMultipliers(baseValue: GoldU, multipliers: readonly number[]): GoldU {
  let result = baseValue;
  for (const multiplier of multipliers) {
    result = Math.floor(result * multiplier);
  }
  return result;
}

/**
 * Combines multiple multiplier sources into a single effective multiplier.
 *
 * Multipliers are combined multiplicatively by default.
 *
 * @param sources - Array of multiplier sources with their values
 * @returns The combined multiplier value
 *
 * @example
 * // Combine two 1.5x multipliers
 * combineMultipliers([
 *   { value: 1.5, source: "upgrade" },
 *   { value: 1.5, source: "achievement" }
 * ]); // 2.25
 */
export function combineMultipliers(sources: readonly MultiplierSource[]): number {
  let combined = 1;
  for (const source of sources) {
    combined *= source.value;
  }
  return combined;
}

// ============================================================================
// PERCENTAGE HELPERS
// ============================================================================

/**
 * Converts a percentage bonus to a multiplier value.
 *
 * @param percentBonus - The percentage bonus (e.g., 50 for +50%)
 * @returns The multiplier value (e.g., 1.5 for +50%)
 *
 * @example
 * percentToMultiplier(50);  // 1.5 (+50%)
 * percentToMultiplier(100); // 2.0 (+100%, i.e., double)
 * percentToMultiplier(-20); // 0.8 (-20%)
 */
export function percentToMultiplier(percentBonus: number): number {
  return 1 + percentBonus / 100;
}

/**
 * Converts a multiplier value to a percentage bonus.
 *
 * @param multiplier - The multiplier value (e.g., 1.5)
 * @returns The percentage bonus (e.g., 50 for +50%)
 *
 * @example
 * multiplierToPercent(1.5);  // 50 (+50%)
 * multiplierToPercent(2.0);  // 100 (+100%)
 * multiplierToPercent(0.8);  // -20 (-20%)
 */
export function multiplierToPercent(multiplier: number): number {
  return (multiplier - 1) * 100;
}

// ============================================================================
// SPECIALIZED MULTIPLIERS
// ============================================================================

/**
 * Calculates income multiplier based on tavern level.
 *
 * Higher tavern levels provide income bonuses to all heroes.
 *
 * @param tavernLevel - Current tavern level
 * @param bonusPerLevel - Income bonus percentage per level (default: 5%)
 * @returns The income multiplier
 *
 * @example
 * // Tavern level 5 with 5% bonus per level = 25% total bonus
 * calculateTavernIncomeMultiplier(5); // 1.25
 *
 * @example
 * // Tavern level 10 with 10% bonus per level
 * calculateTavernIncomeMultiplier(10, 10); // 2.0
 */
export function calculateTavernIncomeMultiplier(
  tavernLevel: number,
  bonusPerLevel: number = 5
): number {
  if (tavernLevel <= 0) {
    return 1;
  }
  return 1 + (tavernLevel * bonusPerLevel) / 100;
}

/**
 * Applies diminishing returns to a multiplier.
 *
 * Used for mechanics where stacking bonuses become less effective.
 * Formula: effectiveMultiplier = 1 + (rawMultiplier - 1) * efficiency
 *
 * @param rawMultiplier - The raw multiplier value
 * @param efficiency - Efficiency factor (0-1, where 1 = full, 0.5 = half)
 * @returns The adjusted multiplier
 *
 * @example
 * // 50% diminishing returns on a 2x multiplier
 * applyDiminishingReturns(2, 0.5); // 1.5 (only 50% of the bonus applies)
 */
export function applyDiminishingReturns(rawMultiplier: number, efficiency: number): number {
  const bonus = rawMultiplier - 1;
  return 1 + bonus * efficiency;
}
