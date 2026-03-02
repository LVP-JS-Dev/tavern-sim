/**
 * Income Calculation Module
 *
 * Provides functions for calculating gold income from heroes.
 *
 * @module economy/income
 */

import type { GoldU, HeroState } from "../types/state";

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
