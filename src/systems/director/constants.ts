/**
 * Director System Constants
 *
 * Tuning parameters for visitor spawning and behavior.
 */

/** Base probability of visitor spawn per tick */
export const VISITOR_SPAWN_CHANCE = 0.1;

/** Maximum time a visitor can stay in tavern (ms) - 5 minutes */
export const MAX_VISITOR_STAY_MS = 5 * 60 * 1000;

/** Maximum concurrent visitors in tavern */
export const MAX_VISITORS = 10;

/** Base spawn timer cooldown (ticks) */
export const SPAWN_TIMER_COOLDOWN = 3;

/** Visitor type spawn weights */
export const VISITOR_TYPE_WEIGHTS: Record<string, number> = {
  patron: 50,
  adventurer: 30,
  merchant: 15,
  noble: 5,
};

/** Spawn chance multiplier based on tavern level */
export const TAVERN_LEVEL_SPAWN_MULTIPLIER = 0.1; // +10% per level

/** Personality traits for random generation */
export const PERSONALITY_TRAITS = [
  'friendly',
  'grumpy',
  'mysterious',
  'boisterous',
  'cautious',
  'greedy',
  'generous',
] as const;
