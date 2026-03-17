/**
 * Action Handlers Module
 *
 * Individual handler functions for each action type in the game.
 * Each handler is a pure function that takes the current state and action,
 * and returns a ReduceResult with the new state and any emitted events.
 *
 * Design principles:
 * - Handlers are pure functions (no side effects)
 * - State transitions are immutable
 * - Events represent facts about what happened
 * - Errors are returned, not thrown
 *
 * @module reducer/handlers
 */

import type {
  GameState,
  ReduceResult,
  TickAction,
  UpgradeHeroAction,
  CalculateOfflineAction,
  DomainEvent,
  GoldU,
  HeroState,
  UpgradeTavernAction,
} from "../types";
import { success, failure } from "../types";
import {
  heroUpgradeApplied,
  heroUpgradeRejected,
  goldEarned,
  offlineProgressApplied,
  securityOfflineClamped,
  tavernUpgradeApplied,
  tavernUpgradeRejected,
} from "../types/events";
import {
  heroNotFound,
  insufficientGold,
  invalidLevels,
  invalidBranch,
  tavernMaxLevelReached,
  insufficientGoldForUpgrade,
  corruptedState,
} from "../types/errors";
import { processTick } from "../time/tick";
import { calculateOfflineProgress } from "../time/offline";
import { calculateTotalIncome } from "../economy/income";
import {
  calculateTotalUpgradeCost,
  calculateAffordableUpgrades,
  TICK_MS,
} from "../config/balance";
import { getHeroConfig, isValidHeroId } from "../config/heroes";
import { UPGRADE_BRANCHES, getUpgradeCost } from "../config/upgradeBranches";
import type { UpgradeBranchId } from "../config/upgradeBranches";
import { getUpgradeEffects } from "../tavern";

// ============================================================================
// TICK HANDLER
// ============================================================================

/**
 * Handles a TICK action, advancing game time by one tick.
 *
 * The tick processing follows a strict pipeline order:
 * 1. timers - Process scheduled timers
 * 2. commands - Process command queue
 * 3. director - Director update (visitor spawns)
 * 4. heroes - Heroes update (income generation)
 * 5. adventures - Adventures update
 * 6. world - World update
 * 7. flush - Flush accumulated events
 * 8. tickIndex++ - Update lastTickAtMs timestamp
 *
 * For Alpha version, the primary functionality is:
 * - Hero income generation (Stage 4)
 * - Timestamp updates (Stage 8)
 *
 * @param state - Current game state (will not be mutated)
 * @param action - The TICK action to process
 * @param now - Current Unix timestamp in milliseconds
 * @returns ReduceResult with new state and any emitted events
 *
 * @example
 * const state = createInitialState(Date.now(), 12345);
 * const result = handleTick(state, { type: "TICK" }, Date.now());
 * // result.events may contain GOLD_EARNED events
 * // result.state.time.lastTickAtMs is updated
 */
export function handleTick(
  state: GameState,
  _action: TickAction,
  now: number,
): ReduceResult {
  // Delegate to the processTick function from time/tick module
  return processTick(state, now);
}

// ============================================================================
// UPGRADE HERO HANDLER
// ============================================================================

/**
 * Handles an UPGRADE_HERO action, attempting to upgrade a hero's level.
 *
 * This handler supports partial upgrades:
 * - If the player has enough gold for all requested levels, all are applied
 * - If the player has gold for only some levels, those are applied (partial)
 * - If the player has no gold or the hero doesn't exist, the upgrade is rejected
 *
 * Events emitted:
 * - HERO_UPGRADE_APPLIED: When upgrade succeeds (full or partial)
 * - HERO_UPGRADE_REJECTED: When upgrade fails completely
 *
 * @param state - Current game state (will not be mutated)
 * @param action - The UPGRADE_HERO action to process
 * @param now - Current Unix timestamp in milliseconds
 * @returns ReduceResult with new state and any emitted events
 *
 * @example
 * // Successful upgrade
 * const result = handleUpgradeHero(state, { type: "UPGRADE_HERO", heroId: "barkeep", levels: 5 }, Date.now());
 * // result.events contains HERO_UPGRADE_APPLIED
 *
 * @example
 * // Failed upgrade (hero not found)
 * const result = handleUpgradeHero(state, { type: "UPGRADE_HERO", heroId: "unknown" }, Date.now());
 * // result.events contains HERO_UPGRADE_REJECTED
 * // result.error contains HeroError
 */
export function handleUpgradeHero(
  state: GameState,
  action: UpgradeHeroAction,
  now: number,
): ReduceResult {
  const { heroId, levels = 1 } = action;
  const events: DomainEvent[] = [];

  // 1. Validate requested levels
  if (levels <= 0) {
    events.push(heroUpgradeRejected(heroId, levels, "INSUFFICIENT_GOLD"));
    return failure(
      state,
      events,
      invalidLevels(levels, "Levels must be a positive number"),
    );
  }

  // 2. Validate hero ID exists in definitions
  if (!isValidHeroId(heroId)) {
    events.push(heroUpgradeRejected(heroId, levels, "HERO_NOT_FOUND"));
    return failure(state, events, heroNotFound(heroId));
  }

  // 3. Check if hero exists in roster - if not, auto-hire at level 0
  let heroState = state.heroes.roster[heroId];
  let currentState = state;
  if (!heroState) {
    // Auto-hire: initialize hero at level 0 with zero income
    // This allows players to upgrade any hero directly without a separate hire step
    const newHeroState: HeroState = {
      level: 0,
      incomePerSecondU: 0,
    };
    const newRoster = {
      ...state.heroes.roster,
      [heroId]: newHeroState,
    };
    // Use currentState which may already have the updated order
    const newOrder = currentState.heroes.order.includes(heroId)
      ? currentState.heroes.order
      : [...currentState.heroes.order, heroId];
    currentState = {
      ...currentState,
      heroes: {
        roster: newRoster,
        order: newOrder,
      },
    };
    heroState = newHeroState;
  }

  // 4. Get hero configuration
  const heroConfig = getHeroConfig(heroId);
  if (!heroConfig) {
    // This should never happen since we validated heroId, but TypeScript needs it
    events.push(heroUpgradeRejected(heroId, levels, "HERO_NOT_FOUND"));
    return failure(state, events, heroNotFound(heroId));
  }

  // 5. Check if player has any gold
  const availableGold = currentState.wallet.gold;
  if (availableGold <= 0) {
    const singleLevelCost = calculateTotalUpgradeCost(
      heroConfig.baseUpgradeCost,
      heroState.level,
      1,
      heroConfig.upgradeMultiplier,
    );
    events.push(heroUpgradeRejected(heroId, levels, "INSUFFICIENT_GOLD"));
    return failure(state, events, insufficientGold(heroId, singleLevelCost, 0));
  }

  // 6. Calculate how many levels can be afforded
  const { affordableLevels, totalCost } = calculateAffordableUpgrades(
    heroConfig.baseUpgradeCost,
    heroState.level,
    availableGold,
    levels,
    heroConfig.upgradeMultiplier,
  );

  // 7. If no levels can be afforded, reject the upgrade
  if (affordableLevels === 0) {
    const singleUpgradeCost = calculateTotalUpgradeCost(
      heroConfig.baseUpgradeCost,
      heroState.level,
      1,
      heroConfig.upgradeMultiplier,
    );

    events.push(heroUpgradeRejected(heroId, levels, "INSUFFICIENT_GOLD"));
    return failure(
      state,
      events,
      insufficientGold(heroId, singleUpgradeCost, availableGold),
    );
  }

  // 8. Apply the upgrade
  const newLevel = heroState.level + affordableLevels;
  const newGold = state.wallet.gold - totalCost;

  // Create updated hero state with new level and income
  const newHeroState: HeroState = {
    ...heroState,
    level: newLevel,
    incomePerSecondU: heroConfig.baseIncomePerSecond, // Base income remains constant
  };

  // Create new state immutably - use currentState which has updated heroes
  const newState: GameState = {
    ...currentState,
    wallet: {
      ...currentState.wallet,
      gold: newGold,
    },
    heroes: {
      ...currentState.heroes,
      roster: {
        ...currentState.heroes.roster,
        [heroId]: newHeroState,
      },
    },
    meta: {
      ...currentState.meta,
      lastSeenAtMs: now,
    },
  };

  // Emit upgrade applied event
  events.push(
    heroUpgradeApplied(heroId, affordableLevels, totalCost, newLevel),
  );

  return success(newState, events);
}

// ============================================================================
// CALCULATE OFFLINE HANDLER
// ============================================================================

/**
 * Handles a CALCULATE_OFFLINE action, calculating and applying progress earned while away.
 *
 * This handler:
 * 1. Calculates the time delta since last seen
 * 2. Applies the 8-hour cap if necessary
 * 3. Calculates gold earned based on current income rate
 * 4. Updates the wallet and timestamps
 *
 * Events emitted:
 * - OFFLINE_PROGRESS_APPLIED: Always emitted when offline progress is calculated
 * - SECURITY_OFFLINE_CLAMPED: Emitted if the time delta exceeded the 8-hour cap
 * - GOLD_EARNED: Emitted for the gold earned during offline period
 *
 * @param state - Current game state (will not be mutated)
 * @param action - The CALCULATE_OFFLINE action to process
 * @returns ReduceResult with new state and any emitted events
 *
 * @example
 * // Player returns after 1 hour
 * const result = handleCalculateOffline(state, { type: "CALCULATE_OFFLINE", now: Date.now() });
 * // result.events contains OFFLINE_PROGRESS_APPLIED and GOLD_EARNED
 *
 * @example
 * // Player returns after 10 hours (exceeds 8-hour cap)
 * const result = handleCalculateOffline(state, { type: "CALCULATE_OFFLINE", now: Date.now() });
 * // result.events contains SECURITY_OFFLINE_CLAMPED, OFFLINE_PROGRESS_APPLIED, and GOLD_EARNED
 */
export function handleCalculateOffline(
  state: GameState,
  action: CalculateOfflineAction,
): ReduceResult {
  const { now } = action;
  const events: DomainEvent[] = [];
  const lastSeenAtMs = state.meta.lastSeenAtMs;

  // Calculate current income per second with tavern gold multiplier
  const baseIncomePerSecondU = calculateTotalIncome(state.heroes.roster);
  const { goldMultiplier } = getUpgradeEffects(state.tavern.upgrades);
  // Use fixed-point arithmetic: multiply by 1000, then divide
  const goldMultiplierU = Math.round(goldMultiplier * 1000);
  const incomePerSecondU = Math.floor(
    (baseIncomePerSecondU * goldMultiplierU) / 1000,
  ) as GoldU;

  // Calculate offline progress with cap enforcement
  const offlineResult = calculateOfflineProgress(
    now,
    lastSeenAtMs,
    incomePerSecondU,
  );

  // If no progress (zero income or negative time), return unchanged state
  if (offlineResult.goldEarned <= 0) {
    // Still emit an offline progress applied event for logging purposes
    events.push(
      offlineProgressApplied(0, offlineResult.ticksSimulated, 0, now),
    );
    return success(state, events);
  }

  // Emit security event if time was clamped
  if (offlineResult.wasClamped) {
    const rawDeltaMs = now - lastSeenAtMs;
    const excessMs = rawDeltaMs - offlineResult.ticksSimulated * TICK_MS; // Approximate

    events.push(
      securityOfflineClamped(
        rawDeltaMs,
        offlineResult.ticksSimulated * TICK_MS,
        excessMs,
        now,
      ),
    );
  }

  // Calculate actual delta (clamped if necessary)
  const actualDeltaMs = offlineResult.wasClamped
    ? offlineResult.ticksSimulated * TICK_MS // Approximate from ticks
    : now - lastSeenAtMs;

  // Emit offline progress applied event
  events.push(
    offlineProgressApplied(
      offlineResult.goldEarned,
      offlineResult.ticksSimulated,
      actualDeltaMs,
      now,
    ),
  );

  // Emit gold earned event
  events.push(goldEarned(offlineResult.goldEarned, "OFFLINE", now));

  // Create new state with updated wallet and timestamps
  const newState: GameState = {
    ...state,
    wallet: {
      ...state.wallet,
      gold: state.wallet.gold + offlineResult.goldEarned,
      lifetimeEarnedGold:
        state.wallet.lifetimeEarnedGold + offlineResult.goldEarned,
    },
    time: {
      ...state.time,
      lastTickAtMs: now,
    },
    meta: {
      ...state.meta,
      lastSeenAtMs: now,
    },
  };

  return success(newState, events);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Apply multiple ticks in sequence.
 * Useful for simulating multiple ticks at once.
 *
 * @param state - Current game state
 * @param tickCount - Number of ticks to apply
 * @param startNow - Starting timestamp
 * @returns ReduceResult with final state and all accumulated events
 *
 * @example
 * // Apply 10 ticks starting from current time
 * const result = applyMultipleTicks(state, 10, Date.now());
 * // result.state has income for 10 ticks applied
 */
export function applyMultipleTicks(
  state: GameState,
  tickCount: number,
  startNow: number,
): ReduceResult {
  let currentState = state;
  const allEvents: DomainEvent[] = [];

  for (let i = 0; i < tickCount; i++) {
    const tickTime = startNow + i * TICK_MS;
    const result = handleTick(currentState, { type: "TICK" }, tickTime);
    currentState = result.state;
    allEvents.push(...result.events);
  }

  return success(currentState, allEvents);
}

// ============================================================================
// UPGRADE TAVERN HANDLER
// ============================================================================

/**
 * Handles an UPGRADE_TAVERN action, attempting to upgrade a tavern branch.
 *
 * This handler:
 * 1. Validates the branch exists
 * 2. Checks current level (handles corrupted state)
 * 3. Validates not at max level
 * 4. Calculates cost using getUpgradeCost
 * 5. Validates gold sufficiency
 * 6. Applies upgrade (updates wallet.gold, tavern.level, tavern.upgrades)
 * 7. Emits appropriate event
 *
 * Events emitted:
 * - TAVERN_UPGRADE_APPLIED: When upgrade succeeds
 * - TAVERN_UPGRADE_REJECTED: When upgrade fails
 *
 * @param state - Current game state (will not be mutated)
 * @param action - The UPGRADE_TAVERN action to process
 * @param now - Current Unix timestamp in milliseconds
 * @returns ReduceResult with new state and any emitted events
 *
 * @example
 * // Successful upgrade
 * const result = handleUpgradeTavern(state, { type: "UPGRADE_TAVERN", branchId: "bar" }, Date.now());
 * // result.events contains TAVERN_UPGRADE_APPLIED
 *
 * @example
 * // Failed upgrade (at max level)
 * const result = handleUpgradeTavern(state, { type: "UPGRADE_TAVERN", branchId: "bar" }, Date.now());
 * // result.events contains TAVERN_UPGRADE_REJECTED
 * // result.error contains TavernError
 */
export function handleUpgradeTavern(
  state: GameState,
  action: UpgradeTavernAction,
  now: number,
): ReduceResult {
  const { branchId } = action;
  const events: DomainEvent[] = [];

  // 1. Validate branch exists
  const branch = UPGRADE_BRANCHES[branchId as UpgradeBranchId];
  if (!branch) {
    events.push(tavernUpgradeRejected(branchId, 0, "INVALID_BRANCH"));
    return failure(state, events, invalidBranch(branchId));
  }

  // 2. Get current level (default 0)
  const currentLevel = state.tavern.upgrades[branchId] ?? 0;

  // 3. Handle corrupted state (level > maxLevel)
  if (currentLevel > branch.maxLevel) {
    events.push(
      tavernUpgradeRejected(branchId, currentLevel, "CORRUPTED_STATE"),
    );
    return failure(state, events, corruptedState(branchId, currentLevel));
  }

  // 4. Check: already max level?
  if (currentLevel >= branch.maxLevel) {
    events.push(
      tavernUpgradeRejected(branchId, currentLevel, "MAX_LEVEL_REACHED"),
    );
    return failure(state, events, tavernMaxLevelReached(branchId));
  }

  // 5. Calculate cost
  const cost = getUpgradeCost(branchId as UpgradeBranchId, currentLevel);

  // 6. Check: enough gold?
  const availableGold = state.wallet.gold;
  if (availableGold < cost) {
    events.push(
      tavernUpgradeRejected(branchId, currentLevel, "INSUFFICIENT_GOLD"),
    );
    return failure(
      state,
      events,
      insufficientGoldForUpgrade(branchId, cost, availableGold),
    );
  }

  // 7. Apply upgrade
  const newLevel = currentLevel + 1;
  const newGold = state.wallet.gold - cost;

  const newState: GameState = {
    ...state,
    wallet: {
      ...state.wallet,
      gold: newGold,
    },
    tavern: {
      ...state.tavern,
      level: state.tavern.level + 1,
      upgrades: {
        ...state.tavern.upgrades,
        [branchId]: newLevel,
      },
    },
    meta: {
      ...state.meta,
      lastSeenAtMs: now,
    },
  };

  // 8. Emit event
  events.push(tavernUpgradeApplied(branchId, newLevel, cost));

  return success(newState, events);
}
