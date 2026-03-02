/**
 * Shared Type Contracts v0.1.0
 *
 * Central export point for all domain types in the Tavern Tycoon Alpha.
 * This module re-exports all types from individual type modules and defines
 * the core ReduceResult interface used by the reducer pattern.
 *
 * Design principle: All types are JSON-serializable for replay verification.
 *
 * @module types
 */

// ============================================================================
// STATE TYPES
// ============================================================================

export {
  // Schema version
  SCHEMA_VERSION,
  type SchemaVersion,
  // Gold type
  type GoldU,
  // State slices
  type MetaSlice,
  type WalletSlice,
  type TavernSlice,
  type HeroState,
  type HeroesSlice,
  type TimeSlice,
  // Root state
  type GameState,
  // Type guards
  isMetaSlice,
  isWalletSlice,
  isTavernSlice,
  isHeroState,
  isHeroesSlice,
  isTimeSlice,
  isGameState,
} from "./state";

// ============================================================================
// ACTION TYPES
// ============================================================================

export {
  // Action types
  type TickAction,
  type UpgradeHeroAction,
  type CalculateOfflineAction,
  type SaveAction,
  type LoadAction,
  // Action union
  type Action,
  // Type guards
  isTickAction,
  isUpgradeHeroAction,
  isCalculateOfflineAction,
  isSaveAction,
  isLoadAction,
  // Action factories
  tick,
  upgradeHero,
  calculateOffline,
  save,
  load,
} from "./actions";

// ============================================================================
// EVENT TYPES
// ============================================================================

export {
  // Event types
  type HeroUpgradeAppliedEvent,
  type HeroUpgradeRejectedEvent,
  type GoldEarnedEvent,
  type OfflineProgressAppliedEvent,
  type SecurityOfflineClampedEvent,
  // Event union
  type DomainEvent,
  // Type guards
  isHeroUpgradeAppliedEvent,
  isHeroUpgradeRejectedEvent,
  isGoldEarnedEvent,
  isOfflineProgressAppliedEvent,
  isSecurityOfflineClampedEvent,
  // Event factories
  heroUpgradeApplied,
  heroUpgradeRejected,
  goldEarned,
  offlineProgressApplied,
  securityOfflineClamped,
} from "./events";

// ============================================================================
// ERROR TYPES
// ============================================================================

export {
  // Error codes
  type ErrorCode,
  // Error types
  type HeroError,
  type TimeError,
  type StateError,
  type PersistenceError,
  type ValidationError,
  // Error union
  type DomainError,
  // Type guards
  isHeroError,
  isTimeError,
  isStateError,
  isPersistenceError,
  isValidationError,
  // Error factories
  heroNotFound,
  insufficientGold,
  maxLevelReached,
  invalidHeroId,
  negativeTimeDelta,
  offlineCapExceeded,
  stateVersionMismatch,
  stateCorrupted,
  stateMigrationFailed,
  saveFailed,
  loadFailed,
  fileNotFound,
  invalidAction,
  invalidLevels,
} from "./errors";

// ============================================================================
// REDUCER RESULT
// ============================================================================

import type { GameState } from "./state";
import type { DomainEvent } from "./events";
import type { DomainError } from "./errors";

/**
 * Result of processing an action through the reducer.
 *
 * This is the core contract of the Flux-like reducer pattern:
 * - state: The new immutable state after processing the action
 * - events: Domain events emitted during state transition (facts about what happened)
 * - error: Optional error if the action could not be fully processed
 *
 * Design principles:
 * - State transitions are immutable (new object returned)
 * - Events represent facts, not intentions (something happened, not something to do)
 * - Errors are returned, not thrown (enables deterministic replay)
 * - Same inputs always produce same outputs (deterministic)
 *
 * @example
 * // Successful tick processing
 * const result: ReduceResult = {
 *   state: newState,
 *   events: [
 *     { type: "GOLD_EARNED", amount: 100, source: "TICK", timestampMs: Date.now() }
 *   ]
 * };
 *
 * // Partial upgrade (not enough gold for all levels)
 * const partialResult: ReduceResult = {
 *   state: stateWithPartialUpgrade,
 *   events: [
 *     { type: "HERO_UPGRADE_APPLIED", heroId: "bard-1", appliedLevels: 2, goldCost: 200, newLevel: 3 }
 *   ]
 * };
 *
 * // Failed upgrade (hero not found)
 * const errorResult: ReduceResult = {
 *   state: originalState, // unchanged
 *   events: [
 *     { type: "HERO_UPGRADE_REJECTED", heroId: "unknown", requestedLevels: 1, reason: "HERO_NOT_FOUND" }
 *   ],
 *   error: {
 *     type: "HERO_ERROR",
 *     code: "HERO_NOT_FOUND",
 *     heroId: "unknown",
 *     message: "Hero 'unknown' does not exist in hero definitions"
 *   }
 * };
 */
export interface ReduceResult {
  /** The new game state after processing the action (always present, may be unchanged) */
  readonly state: GameState;

  /** Domain events emitted during processing (may be empty, never undefined) */
  readonly events: readonly DomainEvent[];

  /** Optional error if action could not be fully processed */
  readonly error?: DomainError;
}

/**
 * Creates a successful ReduceResult with no error.
 * @param state - The new game state
 * @param events - Events emitted during processing
 */
export function success(
  state: GameState,
  events: readonly DomainEvent[] = []
): ReduceResult {
  return { state, events };
}

/**
 * Creates a ReduceResult with an error.
 * @param state - The game state (may be unchanged from original)
 * @param events - Events emitted during processing
 * @param error - The error that occurred
 */
export function failure(
  state: GameState,
  events: readonly DomainEvent[],
  error: DomainError
): ReduceResult {
  return { state, events, error };
}
