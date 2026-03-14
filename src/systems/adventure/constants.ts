/**
 * Adventure System Constants
 *
 * Tuning parameters for adventure mechanics.
 */

/** Base duration for each adventure type (ms) */
export const ADVENTURE_BASE_DURATION_MS: Record<string, number> = {
  hunt: 30000, // 30 seconds
  dungeon: 60000, // 60 seconds
  escort: 45000, // 45 seconds
  investigation: 20000, // 20 seconds
};

/** Maximum concurrent adventures */
export const MAX_ADVENTURES_ACTIVE = 3;

/** Loot drops per adventure type */
export const LOOT_DROP_RATES: Record<string, number> = {
  hunt: 2,
  dungeon: 4,
  escort: 1,
  investigation: 3,
};

/** Rarity weights for loot generation */
export const RARITY_WEIGHTS: Record<string, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

/** Adventure difficulty range */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/** Progress increment per tick (ms) */
export const PROGRESS_PER_TICK_MS = 1000;
