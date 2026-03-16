/**
 * Domain Error Type Definitions v0.1.0
 *
 * Error types for the Tavern Tycoon Alpha economy simulator.
 * DomainError represents recoverable errors that can occur during action processing.
 * All errors are JSON-serializable for logging and debugging.
 *
 * Design principle: Errors are returned from the reducer, not thrown.
 * This enables deterministic replay and easier testing.
 *
 * @module types/errors
 */

import type { GoldU } from "./state";

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Enumeration of all possible error codes in the domain.
 * Used for programmatic error handling and localization.
 */
export type ErrorCode =
  // Hero-related errors
  | "HERO_NOT_FOUND"
  | "INSUFFICIENT_GOLD"
  | "MAX_LEVEL_REACHED"
  | "INVALID_HERO_ID"
  // Time-related errors
  | "NEGATIVE_TIME_DELTA"
  | "OFFLINE_CAP_EXCEEDED"
  // State-related errors
  | "STATE_VERSION_MISMATCH"
  | "STATE_CORRUPTED"
  | "STATE_MIGRATION_FAILED"
  // Persistence-related errors
  | "SAVE_FAILED"
  | "LOAD_FAILED"
  | "FILE_NOT_FOUND"
  // Validation errors
  | "INVALID_ACTION"
  | "INVALID_LEVELS"
  // Tavern-related errors
  | "INVALID_BRANCH"
  | "INSUFFICIENT_GOLD_FOR_UPGRADE"
  | "CORRUPTED_STATE";

// ============================================================================
// HERO ERROR
// ============================================================================

/**
 * Error occurring during hero-related operations.
 * Covers upgrade failures and hero lookup issues.
 */
export interface HeroError {
  readonly type: "HERO_ERROR";
  readonly code:
    | "HERO_NOT_FOUND"
    | "INSUFFICIENT_GOLD"
    | "MAX_LEVEL_REACHED"
    | "INVALID_HERO_ID";

  /** ID of the hero involved in the error */
  readonly heroId: string;

  /** Human-readable description of what went wrong */
  readonly message: string;

  /** Additional context for debugging (optional) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// TIME ERROR
// ============================================================================

/**
 * Error occurring during time-related operations.
 * Covers offline calculation issues and time manipulation.
 */
export interface TimeError {
  readonly type: "TIME_ERROR";
  readonly code: "NEGATIVE_TIME_DELTA" | "OFFLINE_CAP_EXCEEDED";

  /** Human-readable description of what went wrong */
  readonly message: string;

  /** The time delta that caused the error (in ms) */
  readonly deltaMs?: number;

  /** Additional context for debugging (optional) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// STATE ERROR
// ============================================================================

/**
 * Error occurring during state operations.
 * Covers serialization, deserialization, and migration failures.
 */
export interface StateError {
  readonly type: "STATE_ERROR";
  readonly code:
    | "STATE_VERSION_MISMATCH"
    | "STATE_CORRUPTED"
    | "STATE_MIGRATION_FAILED";

  /** Human-readable description of what went wrong */
  readonly message: string;

  /** Expected version (for version mismatch) */
  readonly expectedVersion?: string;

  /** Actual version found (for version mismatch) */
  readonly actualVersion?: string;

  /** Additional context for debugging (optional) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// PERSISTENCE ERROR
// ============================================================================

/**
 * Error occurring during persistence operations.
 * Covers save/load failures and file system issues.
 */
export interface PersistenceError {
  readonly type: "PERSISTENCE_ERROR";
  readonly code: "SAVE_FAILED" | "LOAD_FAILED" | "FILE_NOT_FOUND";

  /** Human-readable description of what went wrong */
  readonly message: string;

  /** File path involved in the error (if applicable) */
  readonly filePath?: string;

  /** Additional context for debugging (optional) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// VALIDATION ERROR
// ============================================================================

/**
 * Error occurring during action validation.
 * Covers invalid action payloads and constraint violations.
 */
export interface ValidationError {
  readonly type: "VALIDATION_ERROR";
  readonly code: "INVALID_ACTION" | "INVALID_LEVELS";

  /** Human-readable description of what went wrong */
  readonly message: string;

  /** The action type that failed validation (if applicable) */
  readonly actionType?: string;

  /** The field that failed validation (if applicable) */
  readonly field?: string;

  /** Additional context for debugging (optional) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// TAVERN ERROR
// ============================================================================

/**
 * Error occurring during tavern upgrade operations.
 * Covers upgrade validation failures and state corruption issues.
 */
export interface TavernError {
  readonly type: "TAVERN_ERROR";
  readonly code:
    | "INVALID_BRANCH"
    | "MAX_LEVEL_REACHED"
    | "INSUFFICIENT_GOLD_FOR_UPGRADE"
    | "CORRUPTED_STATE";

  /** ID of the upgrade branch involved in the error */
  readonly branchId: string;

  /** Human-readable description of what went wrong */
  readonly message: string;
}

// ============================================================================
// DOMAIN ERROR UNION
// ============================================================================

/**
 * Union type of all possible domain errors.
 *
 * Design principles:
 * - Errors are returned, not thrown (enables deterministic replay)
 * - Errors are JSON-serializable for logging
 * - Errors contain enough context for debugging
 * - Errors have codes for programmatic handling
 *
 * @example
 * // Hero not found error
 * const heroError: DomainError = {
 *   type: "HERO_ERROR",
 *   code: "HERO_NOT_FOUND",
 *   heroId: "unknown-hero",
 *   message: "Hero 'unknown-hero' does not exist in definitions"
 * };
 *
 * // Insufficient gold error
 * const goldError: DomainError = {
 *   type: "HERO_ERROR",
 *   code: "INSUFFICIENT_GOLD",
 *   heroId: "bard-1",
 *   message: "Need 500 gold but only have 100",
 *   context: { required: 500, available: 100 }
 * };
 *
 * // State version mismatch error
 * const stateError: DomainError = {
 *   type: "STATE_ERROR",
 *   code: "STATE_VERSION_MISMATCH",
 *   message: "Cannot load save from incompatible version",
 *   expectedVersion: "0.1.0",
 *   actualVersion: "0.0.9"
 * };
 *
 * // Persistence error
 * const persistenceError: DomainError = {
 *   type: "PERSISTENCE_ERROR",
 *   code: "SAVE_FAILED",
 *   message: "Failed to write save file: disk full",
 *   filePath: "/saves/game.json"
 * };
 */
export type DomainError =
  | HeroError
  | TimeError
  | StateError
  | PersistenceError
  | ValidationError
  | TavernError;

// ============================================================================
// ERROR TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an error is a HeroError.
 */
export function isHeroError(error: DomainError): error is HeroError {
  return error.type === "HERO_ERROR";
}

/**
 * Type guard to check if an error is a TimeError.
 */
export function isTimeError(error: DomainError): error is TimeError {
  return error.type === "TIME_ERROR";
}

/**
 * Type guard to check if an error is a StateError.
 */
export function isStateError(error: DomainError): error is StateError {
  return error.type === "STATE_ERROR";
}

/**
 * Type guard to check if an error is a PersistenceError.
 */
export function isPersistenceError(
  error: DomainError
): error is PersistenceError {
  return error.type === "PERSISTENCE_ERROR";
}

/**
 * Type guard to check if an error is a ValidationError.
 */
export function isValidationError(error: DomainError): error is ValidationError {
  return error.type === "VALIDATION_ERROR";
}

/**
 * Type guard to check if an error is a TavernError.
 */
export function isTavernError(error: DomainError): error is TavernError {
  return error.type === "TAVERN_ERROR";
}

// ============================================================================
// ERROR FACTORIES
// ============================================================================

/**
 * Creates a HERO_NOT_FOUND error.
 * @param heroId - The ID of the hero that wasn't found
 */
export function heroNotFound(heroId: string): HeroError {
  return {
    type: "HERO_ERROR",
    code: "HERO_NOT_FOUND",
    heroId,
    message: `Hero '${heroId}' does not exist in hero definitions`,
  };
}

/**
 * Creates an INSUFFICIENT_GOLD error.
 * @param heroId - The ID of the hero being upgraded
 * @param required - Amount of gold required
 * @param available - Amount of gold available
 */
export function insufficientGold(
  heroId: string,
  required: number,
  available: number
): HeroError {
  return {
    type: "HERO_ERROR",
    code: "INSUFFICIENT_GOLD",
    heroId,
    message: `Need ${required} gold but only have ${available}`,
    context: { required, available },
  };
}

/**
 * Creates a MAX_LEVEL_REACHED error.
 * @param heroId - The ID of the hero at max level
 * @param currentLevel - Current level of the hero
 */
export function maxLevelReached(heroId: string, currentLevel: number): HeroError {
  return {
    type: "HERO_ERROR",
    code: "MAX_LEVEL_REACHED",
    heroId,
    message: `Hero '${heroId}' is already at maximum level (${currentLevel})`,
    context: { currentLevel },
  };
}

/**
 * Creates an INVALID_HERO_ID error.
 * @param heroId - The invalid hero ID
 */
export function invalidHeroId(heroId: string): HeroError {
  return {
    type: "HERO_ERROR",
    code: "INVALID_HERO_ID",
    heroId,
    message: `Invalid hero ID: '${heroId}'`,
  };
}

/**
 * Creates a NEGATIVE_TIME_DELTA error.
 * @param deltaMs - The negative time delta
 */
export function negativeTimeDelta(deltaMs: number): TimeError {
  return {
    type: "TIME_ERROR",
    code: "NEGATIVE_TIME_DELTA",
    message: `Time delta cannot be negative: ${deltaMs}ms`,
    deltaMs,
  };
}

/**
 * Creates an OFFLINE_CAP_EXCEEDED error.
 * @param deltaMs - The requested time delta
 * @param cappedMs - The capped time delta
 */
export function offlineCapExceeded(
  deltaMs: number,
  cappedMs: number
): TimeError {
  return {
    type: "TIME_ERROR",
    code: "OFFLINE_CAP_EXCEEDED",
    message: `Offline time ${deltaMs}ms exceeded cap, limited to ${cappedMs}ms`,
    deltaMs,
    context: { cappedMs },
  };
}

/**
 * Creates a STATE_VERSION_MISMATCH error.
 * @param expected - Expected version
 * @param actual - Actual version found
 */
export function stateVersionMismatch(
  expected: string,
  actual: string
): StateError {
  return {
    type: "STATE_ERROR",
    code: "STATE_VERSION_MISMATCH",
    message: `State version mismatch: expected ${expected}, got ${actual}`,
    expectedVersion: expected,
    actualVersion: actual,
  };
}

/**
 * Creates a STATE_CORRUPTED error.
 * @param reason - Description of the corruption
 */
export function stateCorrupted(reason: string): StateError {
  return {
    type: "STATE_ERROR",
    code: "STATE_CORRUPTED",
    message: `State data is corrupted: ${reason}`,
  };
}

/**
 * Creates a STATE_MIGRATION_FAILED error.
 * @param fromVersion - Version migrating from
 * @param toVersion - Version migrating to
 * @param reason - Reason for failure
 */
export function stateMigrationFailed(
  fromVersion: string,
  toVersion: string,
  reason: string
): StateError {
  return {
    type: "STATE_ERROR",
    code: "STATE_MIGRATION_FAILED",
    message: `Migration from ${fromVersion} to ${toVersion} failed: ${reason}`,
    expectedVersion: toVersion,
    actualVersion: fromVersion,
  };
}

/**
 * Creates a SAVE_FAILED error.
 * @param filePath - Path where save was attempted
 * @param reason - Reason for failure
 */
export function saveFailed(filePath: string, reason: string): PersistenceError {
  return {
    type: "PERSISTENCE_ERROR",
    code: "SAVE_FAILED",
    message: `Failed to save to '${filePath}': ${reason}`,
    filePath,
  };
}

/**
 * Creates a LOAD_FAILED error.
 * @param filePath - Path where load was attempted
 * @param reason - Reason for failure
 */
export function loadFailed(filePath: string, reason: string): PersistenceError {
  return {
    type: "PERSISTENCE_ERROR",
    code: "LOAD_FAILED",
    message: `Failed to load from '${filePath}': ${reason}`,
    filePath,
  };
}

/**
 * Creates a FILE_NOT_FOUND error.
 * @param filePath - Path that was not found
 */
export function fileNotFound(filePath: string): PersistenceError {
  return {
    type: "PERSISTENCE_ERROR",
    code: "FILE_NOT_FOUND",
    message: `File not found: '${filePath}'`,
    filePath,
  };
}

/**
 * Creates an INVALID_ACTION error.
 * @param actionType - The action type that is invalid
 * @param reason - Reason the action is invalid
 */
export function invalidAction(actionType: string, reason: string): ValidationError {
  return {
    type: "VALIDATION_ERROR",
    code: "INVALID_ACTION",
    message: `Invalid action '${actionType}': ${reason}`,
    actionType,
  };
}

/**
 * Creates an INVALID_LEVELS error.
 * @param levels - The invalid levels value
 * @param reason - Reason the value is invalid
 */
export function invalidLevels(levels: unknown, reason: string): ValidationError {
  return {
    type: "VALIDATION_ERROR",
    code: "INVALID_LEVELS",
    message: `Invalid levels value: ${reason}`,
    field: "levels",
    context: { levels },
  };
}

// ============================================================================
// TAVERN ERROR FACTORIES
// ============================================================================

/**
 * Creates an INVALID_BRANCH error for tavern upgrades.
 * @param branchId - The ID of the branch that doesn't exist
 */
export function invalidBranch(branchId: string): TavernError {
  return {
    type: "TAVERN_ERROR",
    code: "INVALID_BRANCH",
    branchId,
    message: `Invalid upgrade branch: ${branchId}`,
  };
}

/**
 * Creates a MAX_LEVEL_REACHED error for tavern upgrades.
 * Note: This is different from the hero version which takes a second parameter.
 * @param branchId - The ID of the branch at max level
 */
export function tavernMaxLevelReached(branchId: string): TavernError {
  return {
    type: "TAVERN_ERROR",
    code: "MAX_LEVEL_REACHED",
    branchId,
    message: `Branch ${branchId} is already at max level`,
  };
}

/**
 * Creates an INSUFFICIENT_GOLD_FOR_UPGRADE error.
 * @param branchId - The ID of the branch being upgraded
 * @param cost - Amount of gold required for the upgrade
 * @param available - Amount of gold available
 */
export function insufficientGoldForUpgrade(
  branchId: string,
  cost: GoldU,
  available: GoldU
): TavernError {
  return {
    type: "TAVERN_ERROR",
    code: "INSUFFICIENT_GOLD_FOR_UPGRADE",
    branchId,
    message: `Insufficient gold: need ${cost} to upgrade ${branchId}, have ${available}`,
  };
}

/**
 * Creates a CORRUPTED_STATE error for tavern upgrades.
 * @param branchId - The ID of the branch with corrupted state
 * @param level - The level that exceeds maxLevel
 */
export function corruptedState(branchId: string, level: number): TavernError {
  return {
    type: "TAVERN_ERROR",
    code: "CORRUPTED_STATE",
    branchId,
    message: `Corrupted state: branch ${branchId} has level ${level} which exceeds max`,
  };
}
