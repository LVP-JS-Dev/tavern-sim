/**
 * Main Reducer Module
 *
 * Provides the core reduce() function that implements the Flux-like reducer pattern.
 * This is the main entry point for all state transitions in the game.
 *
 * Contract: reduce(state, action, now) -> { state, events, error? }
 *
 * Design principles:
 * - Actions are intentions (what the player wants to do)
 * - Events are facts (something that happened, not something to do)
 * - State transitions are immutable (new object returned)
 * - Errors are returned, not thrown (enables deterministic replay)
 * - Same inputs always produce same outputs (deterministic)
 *
 * @module reducer
 */

import type { GameState, ReduceResult, Action, DomainEvent } from "../types";
import { success, failure, invalidAction } from "../types";
import {
  isTickAction,
  isUpgradeHeroAction,
  isCalculateOfflineAction,
  isSaveAction,
  isLoadAction,
} from "../types/actions";
import {
  handleTick,
  handleUpgradeHero,
  handleCalculateOffline,
} from "./handlers";

// ============================================================================
// MAIN REDUCER FUNCTION
// ============================================================================

/**
 * Main reducer function that processes actions and returns new state.
 *
 * This is the core of the Flux-like architecture:
 * - Takes current state and an action
 * - Validates and processes the action
 * - Returns new immutable state with any emitted events and optional error
 *
 * The reducer is a pure function:
 * - No side effects
 * - Does not mutate input state
 * - Deterministic: same inputs always produce same outputs
 *
 * @param state - Current game state (will not be mutated)
 * @param action - The action to process
 * @param now - Current Unix timestamp in milliseconds
 * @returns ReduceResult with new state, events, and optional error
 *
 * @example
 * // Process a tick action
 * import { reduce } from './reducer';
 * import { createInitialState } from './state/initial';
 *
 * const state = createInitialState(Date.now(), 12345);
 * const result = reduce(state, { type: 'TICK' }, Date.now());
 *
 * console.log(result.state.time.lastTickAtMs); // Updated timestamp
 * console.log(result.events); // May contain GOLD_EARNED events
 *
 * @example
 * // Upgrade a hero
 * const result = reduce(
 *   state,
 *   { type: 'UPGRADE_HERO', heroId: 'barkeep', levels: 5 },
 *   Date.now()
 * );
 *
 * if (result.error) {
 *   console.error('Upgrade failed:', result.error.message);
 * } else {
 *   console.log('Upgrade succeeded:', result.events);
 * }
 *
 * @example
 * // Calculate offline progress
 * const result = reduce(
 *   state,
 *   { type: 'CALCULATE_OFFLINE', now: Date.now() },
 *   Date.now()
 * );
 *
 * // Check for offline cap warning
 * const clampedEvent = result.events.find(e => e.type === 'SECURITY_OFFLINE_CLAMPED');
 * if (clampedEvent) {
 *   console.warn('Offline time was capped at 8 hours');
 * }
 */
export function reduce(
  state: GameState,
  action: Action,
  now: number
): ReduceResult {
  // Route action to appropriate handler based on type

  // TICK - Advance game time by one tick
  if (isTickAction(action)) {
    return handleTick(state, action, now);
  }

  // UPGRADE_HERO - Upgrade a hero's level
  if (isUpgradeHeroAction(action)) {
    return handleUpgradeHero(state, action, now);
  }

  // CALCULATE_OFFLINE - Calculate and apply offline progress
  if (isCalculateOfflineAction(action)) {
    return handleCalculateOffline(state, action);
  }

  // SAVE - Request state persistence
  // Note: SAVE is handled by the persistence layer, not the reducer.
  // The reducer just returns the state unchanged.
  // The CLI/persistence layer will handle the actual save operation.
  if (isSaveAction(action)) {
    // Return state unchanged - persistence layer handles the actual save
    return success(state, []);
  }

  // LOAD - Request state restoration
  // Note: LOAD is handled by the persistence layer, not the reducer.
  // The reducer just returns the state unchanged.
  // The CLI/persistence layer will handle the actual load operation.
  if (isLoadAction(action)) {
    // Return state unchanged - persistence layer handles the actual load
    return success(state, []);
  }

  // Unknown action type - this should never happen with TypeScript
  // but we handle it for runtime safety
  return failure(
    state,
    [],
    invalidAction((action as { type: string }).type, "Unknown action type")
  );
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export handlers for direct access if needed
export {
  handleTick,
  handleUpgradeHero,
  handleCalculateOffline,
  applyMultipleTicks,
} from "./handlers";
