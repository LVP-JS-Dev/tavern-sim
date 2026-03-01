/**
 * Balance Configuration
 *
 * Core balance constants and formulas for the Tavern Tycoon Alpha economy.
 * All game balance values are externalized to this file for easy tuning.
 *
 * @module config/balance
 */

// ============================================================================
// TIME CONSTANTS
// ============================================================================

/**
 * Tick interval in milliseconds.
 * At 40ms per tick, the game runs at 25 FPS (frames per second).
 *
 * This determines the granularity of game simulation:
 * - Lower values = more precise simulation but higher CPU usage
 * - Higher values = less precise but more efficient
 *
 * RFC-0001 specifies 40ms for smooth income accumulation.
 */
export const TICK_MS = 40;

/**
 * Maximum offline time in milliseconds.
 * Caps offline progress to prevent exploitation and server load.
 *
 * Set to 8 hours (8 * 60 * 60 * 1000 = 28,800,000 ms).
 * Players who return after longer periods only receive 8 hours worth of progress.
 *
 * This is a security/anti-exploit measure per RFC-0001.
 */
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000; // 28,800,000 ms (8 hours)

// ============================================================================
// CURRENCY CONSTANTS
// ============================================================================

/**
 * Multiplier for fixed-point gold arithmetic.
 *
 * Gold is stored internally as integers (gold * GOLD_MULTIPLIER) to avoid
 * floating-point precision errors that accumulate over time.
 *
 * @example
 * // 1.5 gold is stored as 1500
 * const internalGold = 1.5 * GOLD_MULTIPLIER; // 1500
 * const displayGold = internalGold / GOLD_MULTIPLIER; // 1.5
 *
 * @see GoldU type in src/types/state.ts
 */
export const GOLD_MULTIPLIER = 1000;

// ============================================================================
// UPGRADE COST FORMULAS
// ============================================================================

/**
 * Default cost multiplier for exponential upgrade scaling.
 * Each upgrade level costs more than the previous one.
 *
 * Formula: cost = baseCost * (COST_MULTIPLIER ^ currentLevel)
 *
 * A value of 1.15 means each level costs 15% more than the previous.
 */
export const DEFAULT_COST_MULTIPLIER = 1.15;

/**
 * Calculate the cost to upgrade a hero from currentLevel to currentLevel + 1.
 *
 * Uses exponential scaling: cost = baseCost * (multiplier ^ currentLevel)
 *
 * @param baseCost - The base cost at level 0 (first upgrade)
 * @param currentLevel - The current level (before upgrade)
 * @param multiplier - Cost scaling factor (default: 1.15)
 * @returns Cost in fixed-point gold units (GoldU)
 *
 * @example
 * // First upgrade (level 0 → 1) with baseCost 100
 * const cost1 = calculateUpgradeCost(100, 0); // 100
 *
 * // Second upgrade (level 1 → 2)
 * const cost2 = calculateUpgradeCost(100, 1); // 115
 *
 * // Tenth upgrade (level 9 → 10)
 * const cost10 = calculateUpgradeCost(100, 9); // ~351.79
 */
export function calculateUpgradeCost(
  baseCost: number,
  currentLevel: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): number {
  return Math.floor(baseCost * Math.pow(multiplier, currentLevel));
}

/**
 * Calculate the total cost to upgrade multiple levels at once.
 *
 * Sums individual upgrade costs from currentLevel to currentLevel + levels.
 *
 * @param baseCost - The base cost at level 0
 * @param currentLevel - The current level (before upgrades)
 * @param levels - Number of levels to upgrade
 * @param multiplier - Cost scaling factor (default: 1.15)
 * @returns Total cost in fixed-point gold units (GoldU)
 *
 * @example
 * // Cost to upgrade 5 levels starting at level 0
 * const totalCost = calculateTotalUpgradeCost(100, 0, 5);
 * // = 100 + 115 + 132.25 + 152.09 + 174.90 ≈ 674
 */
export function calculateTotalUpgradeCost(
  baseCost: number,
  currentLevel: number,
  levels: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): number {
  let totalCost = 0;
  for (let i = 0; i < levels; i++) {
    totalCost += calculateUpgradeCost(baseCost, currentLevel + i, multiplier);
  }
  return Math.floor(totalCost);
}

/**
 * Calculate how many upgrade levels can be afforded with current gold.
 *
 * Used for partial upgrades when player doesn't have enough gold for all
 * requested levels.
 *
 * @param baseCost - The base cost at level 0
 * @param currentLevel - The current level (before upgrades)
 * @param availableGold - Gold available to spend (in fixed-point units)
 * @param maxLevels - Maximum levels to consider (default: Infinity)
 * @param multiplier - Cost scaling factor (default: 1.15)
 * @returns Object with affordableLevels and totalCost
 *
 * @example
 * // How many levels can we afford with 500 gold?
 * const result = calculateAffordableUpgrades(100, 0, 500);
 * // result.affordableLevels = 3 (costs 100 + 115 + 132 = 347)
 * // result.totalCost = 347
 */
export function calculateAffordableUpgrades(
  baseCost: number,
  currentLevel: number,
  availableGold: number,
  maxLevels: number = Infinity,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): { affordableLevels: number; totalCost: number } {
  let totalCost = 0;
  let affordableLevels = 0;

  for (let i = 0; i < maxLevels; i++) {
    const nextCost = calculateUpgradeCost(baseCost, currentLevel + i, multiplier);
    if (totalCost + nextCost > availableGold) {
      break;
    }
    totalCost += nextCost;
    affordableLevels++;
  }

  return { affordableLevels, totalCost };
}

// ============================================================================
// INCOME CONSTANTS
// ============================================================================

/**
 * Base income per second for the first hero at level 1.
 * Used as a reference point for hero income balancing.
 */
export const BASE_HERO_INCOME_PER_SECOND = 1;

/**
 * Calculate income per tick from income per second.
 *
 * Formula: incomePerTick = floor(incomePerSecondU * TICK_MS / 1000)
 *
 * @param incomePerSecondU - Income per second in fixed-point units
 * @returns Income per tick in fixed-point units
 *
 * @example
 * // 10 gold per second at TICK_MS = 40
 * const incomePerTick = calculateIncomePerTick(10000); // 400 (0.4 gold)
 */
export function calculateIncomePerTick(incomePerSecondU: number): number {
  return Math.floor((incomePerSecondU * TICK_MS) / 1000);
}
