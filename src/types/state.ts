/**
 * GameState v0.1.0 Type Definitions
 *
 * Core state types for the Tavern Tycoon Alpha economy simulator.
 * All state slices are designed to be JSON-serializable and independently
 * versioned for migration support.
 *
 * @module types/state
 */

// ============================================================================
// SCHEMA VERSION
// ============================================================================

/**
 * Current schema version for GameState.
 * Used for state migrations when loading older saves.
 */
export const SCHEMA_VERSION = "0.1.0" as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

// ============================================================================
// GOLD TYPE (Fixed-Point Arithmetic)
// ============================================================================

/**
 * Gold amount in fixed-point representation (gold * GOLD_MULTIPLIER).
 * Using fixed-point arithmetic avoids floating-point precision errors.
 *
 * For display, divide by GOLD_MULTIPLIER.
 * For storage, multiply by GOLD_MULTIPLIER.
 *
 * @example
 * // 1.5 gold stored as 1500 (with GOLD_MULTIPLIER = 1000)
 * const goldAmount: GoldU = 1500;
 * const displayGold = goldAmount / 1000; // 1.5
 */
export type GoldU = number;

// ============================================================================
// META SLICE
// ============================================================================

/**
 * Metadata about the game state.
 * Contains version info, timestamps, and RNG seed.
 */
export interface MetaSlice {
  /** Schema version for migration purposes (e.g., "0.1.0") */
  readonly version: SchemaVersion;

  /** Unix timestamp (ms) when this game was created */
  readonly createdAtMs: number;

  /** Unix timestamp (ms) of last user activity */
  readonly lastSeenAtMs: number;

  /** Root seed for deterministic RNG (enables replay verification) */
  readonly rootSeed: number;
}

// ============================================================================
// WALLET SLICE
// ============================================================================

/**
 * Player's currency wallet.
 * Uses fixed-point arithmetic (GoldU) for precision.
 */
export interface WalletSlice {
  /** Current gold balance in fixed-point units (gold * GOLD_MULTIPLIER) */
  readonly gold: GoldU;

  /** Total gold earned over lifetime (for progression tracking) */
  readonly lifetimeEarnedGold: GoldU;
}

// ============================================================================
// TAVERN SLICE
// ============================================================================

/**
 * Tavern building state.
 * Tracks tavern level and purchased upgrades.
 */
export interface TavernSlice {
  /** Current tavern level (unlocks heroes and features) */
  readonly level: number;

  /**
   * Map of upgrade ID to upgrade level.
   * Keys are upgrade identifiers, values are current levels.
   */
  readonly upgrades: Record<string, number>;
}

// ============================================================================
// HERO STATE
// ============================================================================

/**
 * Individual hero's state within the roster.
 * Contains level and computed income information.
 */
export interface HeroState {
  /** Current hero level (affects income calculation) */
  readonly level: number;

  /**
   * Income per second in fixed-point units.
   * This is the computed value based on hero definition and level.
   * Formula: baseIncomePerSecond * level * multipliers
   */
  readonly incomePerSecondU: GoldU;
}

// ============================================================================
// HEROES SLICE
// ============================================================================

/**
 * Hero roster state.
 * Contains all owned heroes and their display order.
 */
export interface HeroesSlice {
  /**
   * Map of hero ID to hero state.
   * Heroes are added to roster when unlocked/purchased.
   */
  readonly roster: Record<string, HeroState>;

  /**
   * Ordered list of hero IDs for display purposes.
   * Determines the order heroes appear in UI.
   */
  readonly order: readonly string[];
}

// ============================================================================
// TIME SLICE
// ============================================================================

/**
 * Time tracking state.
 * Used for tick processing and offline progress calculation.
 */
export interface TimeSlice {
  /** Unix timestamp (ms) of the last processed tick */
  readonly lastTickAtMs: number;
}

// ============================================================================
// GAME STATE (ROOT)
// ============================================================================

/**
 * Root game state containing all state slices.
 *
 * Design principles:
 * - All slices are independently serializable
 * - No computed values stored as truth (use cache if needed)
 * - References between slices use IDs (e.g., order ⟂ roster)
 * - Immutable: state transitions return new objects
 *
 * @example
 * const state: GameState = {
 *   meta: {
 *     version: "0.1.0",
 *     createdAtMs: Date.now(),
 *     lastSeenAtMs: Date.now(),
 *     rootSeed: 12345
 *   },
 *   wallet: {
 *     gold: 0,
 *     lifetimeEarnedGold: 0
 *   },
 *   tavern: {
 *     level: 1,
 *     upgrades: {}
 *   },
 *   heroes: {
 *     roster: {},
 *     order: []
 *   },
 *   time: {
 *     lastTickAtMs: Date.now()
 *   }
 * };
 */
export interface GameState {
  /** Metadata: version, timestamps, RNG seed */
  readonly meta: MetaSlice;

  /** Player wallet: gold and lifetime earnings */
  readonly wallet: WalletSlice;

  /** Tavern state: level and upgrades */
  readonly tavern: TavernSlice;

  /** Hero roster: owned heroes and display order */
  readonly heroes: HeroesSlice;

  /** Time tracking: last tick timestamp */
  readonly time: TimeSlice;
}

// ============================================================================
// SLICE EXTRACTORS (Type Guards)
// ============================================================================

/**
 * Type guard to check if a value is a valid MetaSlice.
 */
export function isMetaSlice(value: unknown): value is MetaSlice {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as MetaSlice;
  return (
    typeof meta.version === "string" &&
    typeof meta.createdAtMs === "number" &&
    typeof meta.lastSeenAtMs === "number" &&
    typeof meta.rootSeed === "number"
  );
}

/**
 * Type guard to check if a value is a valid WalletSlice.
 */
export function isWalletSlice(value: unknown): value is WalletSlice {
  if (typeof value !== "object" || value === null) return false;
  const wallet = value as WalletSlice;
  return (
    typeof wallet.gold === "number" &&
    typeof wallet.lifetimeEarnedGold === "number"
  );
}

/**
 * Type guard to check if a value is a valid TavernSlice.
 */
export function isTavernSlice(value: unknown): value is TavernSlice {
  if (typeof value !== "object" || value === null) return false;
  const tavern = value as TavernSlice;
  return (
    typeof tavern.level === "number" &&
    typeof tavern.upgrades === "object" &&
    tavern.upgrades !== null
  );
}

/**
 * Type guard to check if a value is a valid HeroState.
 */
export function isHeroState(value: unknown): value is HeroState {
  if (typeof value !== "object" || value === null) return false;
  const hero = value as HeroState;
  return (
    typeof hero.level === "number" &&
    typeof hero.incomePerSecondU === "number"
  );
}

/**
 * Type guard to check if a value is a valid HeroesSlice.
 */
export function isHeroesSlice(value: unknown): value is HeroesSlice {
  if (typeof value !== "object" || value === null) return false;
  const heroes = value as HeroesSlice;
  if (typeof heroes.roster !== "object" || heroes.roster === null) return false;
  if (!Array.isArray(heroes.order)) return false;
  // Validate all entries in roster are HeroState
  return Object.values(heroes.roster).every(isHeroState);
}

/**
 * Type guard to check if a value is a valid TimeSlice.
 */
export function isTimeSlice(value: unknown): value is TimeSlice {
  if (typeof value !== "object" || value === null) return false;
  const time = value as TimeSlice;
  return typeof time.lastTickAtMs === "number";
}

/**
 * Type guard to check if a value is a valid GameState.
 */
export function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as GameState;
  return (
    isMetaSlice(state.meta) &&
    isWalletSlice(state.wallet) &&
    isTavernSlice(state.tavern) &&
    isHeroesSlice(state.heroes) &&
    isTimeSlice(state.time)
  );
}
