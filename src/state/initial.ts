/**
 * Initial State Factory
 *
 * Provides factory functions for creating the initial game state.
 * All initial states are versioned and JSON-serializable.
 *
 * @module state/initial
 */

import {
  type GameState,
  type MetaSlice,
  type WalletSlice,
  type TavernSlice,
  type HeroesSlice,
  type TimeSlice,
  SCHEMA_VERSION,
} from "../types";

// ============================================================================
// INITIAL STATE FACTORY
// ============================================================================

/**
 * Creates the initial MetaSlice for a new game.
 *
 * @param now - Current Unix timestamp in milliseconds
 * @param rootSeed - Seed for deterministic RNG (enables replay verification)
 * @returns A new MetaSlice with initial values
 */
function createInitialMeta(now: number, rootSeed: number): MetaSlice {
  return {
    version: SCHEMA_VERSION,
    createdAtMs: now,
    lastSeenAtMs: now,
    rootSeed,
  };
}

/**
 * Creates the initial WalletSlice for a new game.
 * Player starts with zero gold.
 *
 * @returns A new WalletSlice with initial values
 */
function createInitialWallet(): WalletSlice {
  return {
    gold: 0,
    lifetimeEarnedGold: 0,
  };
}

/**
 * Creates the initial TavernSlice for a new game.
 * Tavern starts at level 1 with no upgrades.
 *
 * @returns A new TavernSlice with initial values
 */
function createInitialTavern(): TavernSlice {
  return {
    level: 1,
    upgrades: {},
  };
}

/**
 * Creates the initial HeroesSlice for a new game.
 * Starts with an empty roster - heroes are added when unlocked.
 *
 * @returns A new HeroesSlice with initial values
 */
function createInitialHeroes(): HeroesSlice {
  return {
    roster: {},
    order: [],
  };
}

/**
 * Creates the initial TimeSlice for a new game.
 * Sets the last tick to the current time.
 *
 * @param now - Current Unix timestamp in milliseconds
 * @returns A new TimeSlice with initial values
 */
function createInitialTime(now: number): TimeSlice {
  return {
    lastTickAtMs: now,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Factory function to create the initial GameState for a new game.
 *
 * This function creates a fresh, valid game state with all slices initialized
 * to their starting values. The state is:
 * - JSON-serializable (no functions, no circular references)
 * - Versioned (schema version embedded for migrations)
 * - Seeded (rootSeed enables deterministic replay)
 * - Immutable (all slices use readonly properties)
 *
 * @param now - Current Unix timestamp in milliseconds (typically Date.now())
 * @param rootSeed - Seed for deterministic RNG. Use a random value for normal play,
 *                   or a fixed value for replay verification.
 * @returns A new GameState with all slices initialized to starting values
 *
 * @example
 * // Create a new game with current time and random seed
 * const state = createInitialState(Date.now(), Math.random() * 1000000);
 *
 * @example
 * // Create a deterministic game for replay verification
 * const state = createInitialState(1700000000000, 12345);
 * // Same seed + same actions = same final state
 *
 * @example
 * // Verify initial state structure
 * const state = createInitialState(Date.now(), 12345);
 * console.log(state.meta.version); // "0.1.0"
 * console.log(state.wallet.gold); // 0
 * console.log(state.tavern.level); // 1
 * console.log(Object.keys(state.heroes.roster).length); // 0
 */
export function createInitialState(now: number, rootSeed: number): GameState {
  return {
    meta: createInitialMeta(now, rootSeed),
    wallet: createInitialWallet(),
    tavern: createInitialTavern(),
    heroes: createInitialHeroes(),
    time: createInitialTime(now),
  };
}
