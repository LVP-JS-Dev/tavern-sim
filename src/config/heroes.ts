/**
 * Hero Configuration
 *
 * Static hero definitions for the Tavern Tycoon Alpha economy.
 * Each hero has unique income generation and upgrade cost properties.
 *
 * @module config/heroes
 */

import type { GoldU } from "../types/state";

// ============================================================================
// HERO CONFIG TYPE
// ============================================================================

/**
 * Static configuration for a hero type.
 * Defines the economic properties of a hero for income and upgrade calculations.
 *
 * These values are constant per hero type and used to calculate:
 * - Income: baseIncomePerSecond * level
 * - Upgrade Cost: baseUpgradeCost * (upgradeMultiplier ^ currentLevel)
 */
export interface HeroConfig {
  /** Unique identifier for this hero type (e.g., "barkeep", "bard") */
  readonly id: string;

  /** Display name shown to players */
  readonly name: string;

  /**
   * Base gold income per second at level 1.
   * Stored in fixed-point units (gold * GOLD_MULTIPLIER).
   *
   * Actual income at level L: baseIncomePerSecond * L
   *
   * @example
   * // baseIncomePerSecond = 1000 (1.0 gold/sec at GOLD_MULTIPLIER = 1000)
   * // At level 5: income = 1000 * 5 = 5000 (5.0 gold/sec)
   */
  readonly baseIncomePerSecond: GoldU;

  /**
   * Base cost for the first upgrade (level 0 → 1).
   * Stored in fixed-point units (gold * GOLD_MULTIPLIER).
   *
   * Upgrade costs scale exponentially using the upgradeMultiplier.
   *
   * @example
   * // baseUpgradeCost = 10000 (10 gold at GOLD_MULTIPLIER = 1000)
   * // First upgrade costs 10 gold
   */
  readonly baseUpgradeCost: GoldU;

  /**
   * Cost multiplier for exponential upgrade scaling.
   * Each level costs more than the previous one.
   *
   * Formula: cost = baseUpgradeCost * (upgradeMultiplier ^ currentLevel)
   *
   * Common values:
   * - 1.15: Standard scaling (15% increase per level)
   * - 1.20: Aggressive scaling (20% increase per level)
   * - 1.10: Gentle scaling (10% increase per level)
   */
  readonly upgradeMultiplier: number;
}

// ============================================================================
// HERO DEFINITIONS
// ============================================================================

/**
 * The Barkeep is the first hero players start with.
 * Low income but cheap upgrades - good for early game.
 */
const BARKEEP: HeroConfig = {
  id: "barkeep",
  name: "Barkeep",
  baseIncomePerSecond: 1000, // 1.0 gold/sec
  baseUpgradeCost: 10000, // 10 gold
  upgradeMultiplier: 1.15,
} as const;

/**
 * The Bard provides entertainment, attracting more patrons.
 * Moderate income with moderate upgrade costs.
 */
const BARD: HeroConfig = {
  id: "bard",
  name: "Bard",
  baseIncomePerSecond: 2500, // 2.5 gold/sec
  baseUpgradeCost: 50000, // 50 gold
  upgradeMultiplier: 1.18,
} as const;

/**
 * The Chef prepares food, increasing customer satisfaction.
 * Higher income potential but steeper upgrade curve.
 */
const CHEF: HeroConfig = {
  id: "chef",
  name: "Chef",
  baseIncomePerSecond: 5000, // 5.0 gold/sec
  baseUpgradeCost: 150000, // 150 gold
  upgradeMultiplier: 1.20,
} as const;

/**
 * The Guard provides security, allowing premium pricing.
 * High income but expensive upgrades.
 */
const GUARD: HeroConfig = {
  id: "guard",
  name: "Guard",
  baseIncomePerSecond: 10000, // 10.0 gold/sec
  baseUpgradeCost: 500000, // 500 gold
  upgradeMultiplier: 1.22,
} as const;

/**
 * The Innkeeper manages rooms for rent.
 * Very high income but very expensive upgrades.
 */
const INNKEEPER: HeroConfig = {
  id: "innkeeper",
  name: "Innkeeper",
  baseIncomePerSecond: 25000, // 25.0 gold/sec
  baseUpgradeCost: 2000000, // 2000 gold
  upgradeMultiplier: 1.25,
} as const;

// ============================================================================
// HERO REGISTRY
// ============================================================================

/**
 * Registry of all available heroes keyed by their ID.
 * Use this to look up hero configuration for income and upgrade calculations.
 *
 * @example
 * // Get hero configuration
 * const heroConfig = HEROES["barkeep"];
 * console.log(heroConfig.name); // "Barkeep"
 *
 * // Calculate income at level 5
 * const incomeAtLevel5 = heroConfig.baseIncomePerSecond * 5;
 *
 * // Check if hero exists
 * if (heroId in HEROES) {
 *   const config = HEROES[heroId];
 * }
 */
export const HEROES: Record<string, HeroConfig> = {
  barkeep: BARKEEP,
  bard: BARD,
  chef: CHEF,
  guard: GUARD,
  innkeeper: INNKEEPER,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get hero configuration by ID.
 * Returns undefined if hero ID doesn't exist.
 *
 * @param heroId - The hero's unique identifier
 * @returns HeroConfig if found, undefined otherwise
 *
 * @example
 * const config = getHeroConfig("barkeep");
 * if (config) {
 *   console.log(config.name); // "Barkeep"
 * }
 */
export function getHeroConfig(heroId: string): HeroConfig | undefined {
  return HEROES[heroId];
}

/**
 * Check if a hero ID exists in the registry.
 *
 * @param heroId - The hero's unique identifier
 * @returns true if hero exists, false otherwise
 *
 * @example
 * if (isValidHeroId("barkeep")) {
 *   // Safe to access HEROES["barkeep"]
 * }
 */
export function isValidHeroId(heroId: string): heroId is keyof typeof HEROES {
  return heroId in HEROES;
}

/**
 * Get all hero IDs in the registry.
 * Returns them in a consistent order.
 *
 * @returns Array of hero IDs
 *
 * @example
 * const allHeroIds = getAllHeroIds();
 * // ["barkeep", "bard", "chef", "guard", "innkeeper"]
 */
export function getAllHeroIds(): readonly string[] {
  return Object.keys(HEROES);
}

/**
 * Get all hero configurations as an array.
 * Useful for iterating over all heroes.
 *
 * @returns Array of HeroConfig objects
 *
 * @example
 * const allHeroes = getAllHeroes();
 * allHeroes.forEach(hero => {
 *   console.log(`${hero.name}: ${hero.baseIncomePerSecond} gold/sec`);
 * });
 */
export function getAllHeroes(): readonly HeroConfig[] {
  return Object.values(HEROES);
}
