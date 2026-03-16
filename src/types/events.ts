/**
 * Domain Event Type Definitions v0.1.0
 *
 * Event types for the Tavern Tycoon Alpha economy simulator.
 * Events represent facts about state changes that have already occurred.
 * All events are JSON-serializable for logging and replay verification.
 *
 * Design principle: Actions are intentions, Events are results/facts.
 *
 * @module types/events
 */

import type { GoldU } from "./state";

// ============================================================================
// HERO UPGRADE APPLIED EVENT
// ============================================================================

/**
 * Emitted when a hero upgrade is successfully applied.
 * May contain partial levels if insufficient gold for full upgrade.
 */
export interface HeroUpgradeAppliedEvent {
  readonly type: "HERO_UPGRADE_APPLIED";

  /** ID of the hero that was upgraded */
  readonly heroId: string;

  /** Number of levels actually applied (may be less than requested) */
  readonly appliedLevels: number;

  /** Gold cost that was deducted from wallet */
  readonly goldCost: GoldU;

  /** Hero's new level after upgrade */
  readonly newLevel: number;
}

// ============================================================================
// HERO UPGRADE REJECTED EVENT
// ============================================================================

/**
 * Emitted when a hero upgrade cannot be applied at all.
 * This occurs when the hero doesn't exist or player has zero gold.
 */
export interface HeroUpgradeRejectedEvent {
  readonly type: "HERO_UPGRADE_REJECTED";

  /** ID of the hero that couldn't be upgraded */
  readonly heroId: string;

  /** Number of levels that were requested */
  readonly requestedLevels: number;

  /** Reason the upgrade was rejected */
  readonly reason: "HERO_NOT_FOUND" | "INSUFFICIENT_GOLD" | "MAX_LEVEL_REACHED";
}

// ============================================================================
// GOLD EARNED EVENT
// ============================================================================

/**
 * Emitted when gold is earned through income calculation.
 * Generated during tick processing based on hero income.
 */
export interface GoldEarnedEvent {
  readonly type: "GOLD_EARNED";

  /** Amount of gold earned in fixed-point units */
  readonly amount: GoldU;

  /** Source of the gold income */
  readonly source: "TICK" | "OFFLINE" | "ADVENTURE" | "BONUS";

  /** Timestamp when the gold was earned */
  readonly timestampMs: number;
}

// ============================================================================
// OFFLINE PROGRESS APPLIED EVENT
// ============================================================================

/**
 * Emitted when offline progress is calculated and applied.
 * Contains details about time passed and resources earned.
 */
export interface OfflineProgressAppliedEvent {
  readonly type: "OFFLINE_PROGRESS_APPLIED";

  /** Gold earned during offline period in fixed-point units */
  readonly goldEarned: GoldU;

  /** Number of ticks that were simulated */
  readonly ticksSimulated: number;

  /** Actual time passed in milliseconds */
  readonly deltaMs: number;

  /** Timestamp when offline progress was calculated */
  readonly calculatedAtMs: number;
}

// ============================================================================
// SECURITY OFFLINE CLAMPED EVENT
// ============================================================================

/**
 * Emitted when offline time exceeds the maximum allowed cap.
 * This is a security event to track potential exploitation attempts.
 *
 * The 8-hour cap prevents players from manipulating system clocks
 * to gain excessive offline progress.
 */
export interface SecurityOfflineClampedEvent {
  readonly type: "SECURITY_OFFLINE_CLAMPED";

  /** Actual time delta that was reported in milliseconds */
  readonly requestedDeltaMs: number;

  /** Maximum allowed delta that was applied in milliseconds */
  readonly cappedDeltaMs: number;

  /** Amount of time that was cut off due to capping in milliseconds */
  readonly excessMs: number;

  /** Timestamp when the clamping occurred */
  readonly timestampMs: number;
}

// ============================================================================
// WEATHER CHANGED EVENT
// ============================================================================

/**
 * Emitted when the weather changes.
 * Contains the previous and new weather states.
 */
export interface WeatherChangedEvent {
  readonly type: "WEATHER_CHANGED";

  /** Previous weather state */
  readonly from: import("../systems/world/types").Weather;

  /** New weather state */
  readonly to: import("../systems/world/types").Weather;

  /** Timestamp when the weather changed */
  readonly timestamp: number;
}

// ============================================================================
// TAVERN UPGRADE APPLIED EVENT
// ============================================================================

/**
 * Emitted when a tavern upgrade is successfully applied.
 * Contains the branch that was upgraded and the new level.
 */
export interface TavernUpgradeAppliedEvent {
  readonly type: "TAVERN_UPGRADE_APPLIED";

  /** ID of the branch that was upgraded */
  readonly branchId: string;

  /** New level of the branch after upgrade */
  readonly newLevel: number;

  /** Gold cost that was deducted from wallet */
  readonly goldCost: GoldU;
}

// ============================================================================
// TAVERN UPGRADE REJECTED EVENT
// ============================================================================

/**
 * Emitted when a tavern upgrade cannot be applied.
 * This occurs when the branch doesn't exist, is at max level, or player has insufficient gold.
 */
export interface TavernUpgradeRejectedEvent {
  readonly type: "TAVERN_UPGRADE_REJECTED";

  /** ID of the branch that couldn't be upgraded */
  readonly branchId: string;

  /** Current level of the branch */
  readonly currentLevel: number;

  /** Reason the upgrade was rejected */
  readonly reason: "INVALID_BRANCH" | "MAX_LEVEL_REACHED" | "INSUFFICIENT_GOLD" | "CORRUPTED_STATE";
}

// ============================================================================
// DOMAIN EVENT UNION
// ============================================================================

/**
 * Union type of all possible domain events.
 *
 * Design principles:
 * - Events are facts (something that happened, not something to do)
 * - Events are emitted after state changes are applied
 * - Events are JSON-serializable for logging and replay
 * - Events contain enough data to reconstruct what happened
 *
 * @example
 * // Hero upgrade succeeded
 * const upgradeEvent: DomainEvent = {
 *   type: "HERO_UPGRADE_APPLIED",
 *   heroId: "bard-1",
 *   appliedLevels: 3,
 *   goldCost: 1500,
 *   newLevel: 5
 * };
 *
 * // Gold earned from tick
 * const goldEvent: DomainEvent = {
 *   type: "GOLD_EARNED",
 *   amount: 250,
 *   source: "TICK",
 *   timestampMs: Date.now()
 * };
 *
 * // Offline progress applied
 * const offlineEvent: DomainEvent = {
 *   type: "OFFLINE_PROGRESS_APPLIED",
 *   goldEarned: 50000,
 *   ticksSimulated: 72000,
 *   deltaMs: 3600000,
 *   calculatedAtMs: Date.now()
 * };
 *
 * // Security: offline time was clamped
 * const securityEvent: DomainEvent = {
 *   type: "SECURITY_OFFLINE_CLAMPED",
 *   requestedDeltaMs: 43200000, // 12 hours
 *   cappedDeltaMs: 28800000,    // 8 hours (max)
 *   excessMs: 14400000,         // 4 hours cut off
 *   timestampMs: Date.now()
 * };
 */
export type DomainEvent =
  | HeroUpgradeAppliedEvent
  | HeroUpgradeRejectedEvent
  | GoldEarnedEvent
  | OfflineProgressAppliedEvent
  | SecurityOfflineClampedEvent
  | WeatherChangedEvent
  | TavernUpgradeAppliedEvent
  | TavernUpgradeRejectedEvent;

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an event is a HeroUpgradeAppliedEvent.
 */
export function isHeroUpgradeAppliedEvent(
  event: DomainEvent
): event is HeroUpgradeAppliedEvent {
  return event.type === "HERO_UPGRADE_APPLIED";
}

/**
 * Type guard to check if an event is a HeroUpgradeRejectedEvent.
 */
export function isHeroUpgradeRejectedEvent(
  event: DomainEvent
): event is HeroUpgradeRejectedEvent {
  return event.type === "HERO_UPGRADE_REJECTED";
}

/**
 * Type guard to check if an event is a GoldEarnedEvent.
 */
export function isGoldEarnedEvent(event: DomainEvent): event is GoldEarnedEvent {
  return event.type === "GOLD_EARNED";
}

/**
 * Type guard to check if an event is an OfflineProgressAppliedEvent.
 */
export function isOfflineProgressAppliedEvent(
  event: DomainEvent
): event is OfflineProgressAppliedEvent {
  return event.type === "OFFLINE_PROGRESS_APPLIED";
}

/**
 * Type guard to check if an event is a SecurityOfflineClampedEvent.
 */
export function isSecurityOfflineClampedEvent(
  event: DomainEvent
): event is SecurityOfflineClampedEvent {
  return event.type === "SECURITY_OFFLINE_CLAMPED";
}

/**
 * Type guard to check if an event is a WeatherChangedEvent.
 */
export function isWeatherChangedEvent(
  event: DomainEvent
): event is WeatherChangedEvent {
  return event.type === "WEATHER_CHANGED";
}

/**
 * Type guard to check if an event is a TavernUpgradeAppliedEvent.
 */
export function isTavernUpgradeAppliedEvent(
  event: DomainEvent
): event is TavernUpgradeAppliedEvent {
  return event.type === "TAVERN_UPGRADE_APPLIED";
}

/**
 * Type guard to check if an event is a TavernUpgradeRejectedEvent.
 */
export function isTavernUpgradeRejectedEvent(
  event: DomainEvent
): event is TavernUpgradeRejectedEvent {
  return event.type === "TAVERN_UPGRADE_REJECTED";
}

// ============================================================================
// EVENT FACTORIES
// ============================================================================

/**
 * Creates a HERO_UPGRADE_APPLIED event.
 * @param heroId - The ID of the upgraded hero
 * @param appliedLevels - Number of levels actually applied
 * @param goldCost - Gold cost deducted from wallet
 * @param newLevel - Hero's new level after upgrade
 */
export function heroUpgradeApplied(
  heroId: string,
  appliedLevels: number,
  goldCost: GoldU,
  newLevel: number
): HeroUpgradeAppliedEvent {
  return {
    type: "HERO_UPGRADE_APPLIED",
    heroId,
    appliedLevels,
    goldCost,
    newLevel,
  };
}

/**
 * Creates a HERO_UPGRADE_REJECTED event.
 * @param heroId - The ID of the hero that couldn't be upgraded
 * @param requestedLevels - Number of levels that were requested
 * @param reason - Reason the upgrade was rejected
 */
export function heroUpgradeRejected(
  heroId: string,
  requestedLevels: number,
  reason: HeroUpgradeRejectedEvent["reason"]
): HeroUpgradeRejectedEvent {
  return {
    type: "HERO_UPGRADE_REJECTED",
    heroId,
    requestedLevels,
    reason,
  };
}

/**
 * Creates a GOLD_EARNED event.
 * @param amount - Amount of gold earned
 * @param source - Source of the gold income
 * @param timestampMs - Timestamp when gold was earned
 */
export function goldEarned(
  amount: GoldU,
  source: GoldEarnedEvent["source"],
  timestampMs: number
): GoldEarnedEvent {
  return {
    type: "GOLD_EARNED",
    amount,
    source,
    timestampMs,
  };
}

/**
 * Creates an OFFLINE_PROGRESS_APPLIED event.
 * @param goldEarned - Gold earned during offline period
 * @param ticksSimulated - Number of ticks simulated
 * @param deltaMs - Actual time passed in milliseconds
 * @param calculatedAtMs - Timestamp when calculated
 */
export function offlineProgressApplied(
  goldEarned: GoldU,
  ticksSimulated: number,
  deltaMs: number,
  calculatedAtMs: number
): OfflineProgressAppliedEvent {
  return {
    type: "OFFLINE_PROGRESS_APPLIED",
    goldEarned,
    ticksSimulated,
    deltaMs,
    calculatedAtMs,
  };
}

/**
 * Creates a SECURITY_OFFLINE_CLAMPED event.
 * @param requestedDeltaMs - Actual time delta reported
 * @param cappedDeltaMs - Maximum allowed delta applied
 * @param excessMs - Amount of time cut off
 * @param timestampMs - Timestamp when clamping occurred
 */
export function securityOfflineClamped(
  requestedDeltaMs: number,
  cappedDeltaMs: number,
  excessMs: number,
  timestampMs: number
): SecurityOfflineClampedEvent {
  return {
    type: "SECURITY_OFFLINE_CLAMPED",
    requestedDeltaMs,
    cappedDeltaMs,
    excessMs,
    timestampMs,
  };
}

/**
 * Creates a WEATHER_CHANGED event.
 * @param from - Previous weather state
 * @param to - New weather state
 * @param timestamp - Timestamp when weather changed
 */
export function weatherChanged(
  from: import("../systems/world/types").Weather,
  to: import("../systems/world/types").Weather,
  timestamp: number
): WeatherChangedEvent {
  return {
    type: "WEATHER_CHANGED",
    from,
    to,
    timestamp,
  };
}

/**
 * Creates a TAVERN_UPGRADE_APPLIED event.
 * @param branchId - The ID of the upgraded branch
 * @param newLevel - New level of the branch after upgrade
 * @param goldCost - Gold cost deducted from wallet
 */
export function tavernUpgradeApplied(
  branchId: string,
  newLevel: number,
  goldCost: GoldU
): TavernUpgradeAppliedEvent {
  return {
    type: "TAVERN_UPGRADE_APPLIED",
    branchId,
    newLevel,
    goldCost,
  };
}

/**
 * Creates a TAVERN_UPGRADE_REJECTED event.
 * @param branchId - The ID of the branch that couldn't be upgraded
 * @param currentLevel - Current level of the branch
 * @param reason - Reason the upgrade was rejected
 */
export function tavernUpgradeRejected(
  branchId: string,
  currentLevel: number,
  reason: TavernUpgradeRejectedEvent["reason"]
): TavernUpgradeRejectedEvent {
  return {
    type: "TAVERN_UPGRADE_REJECTED",
    branchId,
    currentLevel,
    reason,
  };
}
