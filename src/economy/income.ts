/**
 * Income Calculation Module
 *
 * Provides functions for calculating gold income from heroes.
 *
 * @module economy/income
 */

import type { GoldU, HeroState } from "../types/state";
import type { GameState } from "../types";
import { getUpgradeEffects } from "../tavern";

// ============================================================================
// INCOME CALCULATION
// ============================================================================

/**
 * Calculates the total income per second from all heroes in the roster.
 *
 * Formula: income = Σ(hero.incomePerSecondU * hero.level)
 *
 * @param roster - Map of hero ID to hero state
 * @returns Total income per second in fixed-point units (GoldU)
 *
 * @example
 * // Empty roster returns 0
 * const emptyRoster = {};
 * calculateTotalIncome(emptyRoster); // 0
 *
 * @example
 * // Roster with heroes calculates total income
 * const roster = {
 *   barkeep: { level: 5, incomePerSecondU: 1000 },
 *   bard: { level: 3, incomePerSecondU: 2500 }
 * };
 * // barkeep: 1000 * 5 = 5000, bard: 2500 * 3 = 7500, total = 12500
 * calculateTotalIncome(roster); // 12500
 */
export function calculateTotalIncome(roster: Record<string, HeroState>): GoldU {
  let total: GoldU = 0;

  for (const hero of Object.values(roster)) {
    total += hero.incomePerSecondU * hero.level;
  }

  return total;
}

// ============================================================================
// INCOME WITH MULTIPLIER
// ============================================================================

/**
 * Calculates the total income per second from all heroes, applying the goldMultiplier
 * from tavern upgrades.
 *
 * Formula: income = floor(baseIncome * goldMultiplier)
 *
 * The goldMultiplier comes from the "bar" upgrade branch:
 * - Level 0: 1x multiplier
 * - Level 1: 1.2x
 * - Level 2: 1.5x
 * - Level 3: 2x
 * - Level 4: 2.5x
 * - Level 5: 3x
 *
 * @param state - The full game state (to access tavern upgrades and heroes)
 * @returns Total income per second in fixed-point units (GoldU), with multiplier applied
 *
 * @example
 * // State with bar level 0 (multiplier 1)
 * const income = calculateTotalIncomeWithMultiplier(state);
 * // income = 1000 (no multiplier effect)
 *
 * @example
 * // State with bar level 2 (multiplier 1.5)
 * const income = calculateTotalIncomeWithMultiplier(stateWithBar2);
 * // income = floor(1000 * 1.5) = 1500
 */
export function calculateTotalIncomeWithMultiplier(state: GameState): GoldU {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const baseIncome = calculateTotalIncome(state.heroes.roster);
  return Math.floor(baseIncome * effects.goldMultiplier) as GoldU;
}
