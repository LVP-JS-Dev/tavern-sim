/**
 * Tavern Tycoon Alpha - Public API
 *
 * This is the main entry point for the game engine.
 * All public types, functions, and utilities are exported from this module.
 *
 * Design principle: The public API is stable and semantically versioned.
 * Internal modules (those not re-exported here) may change without notice.
 *
 * @module tavern-tycoon
 */

// ============================================================================
// TYPES
// ============================================================================

// State types
export {
  SCHEMA_VERSION,
  type SchemaVersion,
  type GoldU,
  type MetaSlice,
  type WalletSlice,
  type TavernSlice,
  type HeroState,
  type HeroesSlice,
  type TimeSlice,
  type GameState,
  isMetaSlice,
  isWalletSlice,
  isTavernSlice,
  isHeroState,
  isHeroesSlice,
  isTimeSlice,
  isGameState,
} from "./types/state";

// Action types
export {
  type TickAction,
  type UpgradeHeroAction,
  type CalculateOfflineAction,
  type SaveAction,
  type LoadAction,
  type Action,
  isTickAction,
  isUpgradeHeroAction,
  isCalculateOfflineAction,
  isSaveAction,
  isLoadAction,
  tick,
  upgradeHero,
  calculateOffline,
  save,
  load,
} from "./types/actions";

// Event types
export {
  type HeroUpgradeAppliedEvent,
  type HeroUpgradeRejectedEvent,
  type GoldEarnedEvent,
  type OfflineProgressAppliedEvent,
  type SecurityOfflineClampedEvent,
  type DomainEvent,
  isHeroUpgradeAppliedEvent,
  isHeroUpgradeRejectedEvent,
  isGoldEarnedEvent,
  isOfflineProgressAppliedEvent,
  isSecurityOfflineClampedEvent,
  heroUpgradeApplied,
  heroUpgradeRejected,
  goldEarned,
  offlineProgressApplied,
  securityOfflineClamped,
} from "./types/events";

// Error types
export {
  type ErrorCode,
  type HeroError,
  type TimeError,
  type StateError,
  type PersistenceError,
  type ValidationError,
  type DomainError,
  isHeroError,
  isTimeError,
  isStateError,
  isPersistenceError,
  isValidationError,
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
} from "./types/errors";

// Reducer result type
export {
  type ReduceResult,
  success,
  failure,
} from "./types";

// ============================================================================
// REDUCER
// ============================================================================

export { reduce } from "./reducer";

// ============================================================================
// STATE FACTORY
// ============================================================================

export { createInitialState } from "./state/initial";

// ============================================================================
// STORAGE
// ============================================================================

export {
  StorageError,
  type Storage,
  isStorage,
} from "./persistence/storage";
