/**
 * Offline Progress Simulation Module
 *
 * Provides functions for calculating gold income earned while the player
 * was away from the game, with security caps to prevent exploitation.
 *
 * @module time/offline
 */

import { MAX_OFFLINE_MS, TICK_MS } from "../config/balance";
import type { GoldU } from "../types/state";

// ============================================================================
// OFFLINE PROGRESS RESULT TYPE
// ============================================================================

/**
 * Result of offline progress calculation.
 *
 * Contains the gold earned, number of ticks simulated, and whether the
 * time delta was clamped to the maximum allowed offline time.
 */
export interface OfflineProgressResult {
  /** Gold earned during offline period in fixed-point units (GoldU) */
  readonly goldEarned: GoldU;

  /** Number of game ticks that would have occurred during offline period */
  readonly ticksSimulated: number;

  /** True if the offline time exceeded MAX_OFFLINE_MS and was clamped */
  readonly wasClamped: boolean;
}

// ============================================================================
// OFFLINE PROGRESS CALCULATION
// ============================================================================

/**
 * Calculates the gold income earned during an offline period.
 *
 * This function is called when the game is resumed after being closed or
 * in the background. It calculates how much gold the player should receive
 * based on their income rate and time away, with an 8-hour cap for security.
 *
 * **Security Note:** The 8-hour cap (MAX_OFFLINE_MS) prevents players from
 * exploiting offline progress by manipulating their device clock or waiting
 * excessively long periods.
 *
 * @param now - Current Unix timestamp in milliseconds
 * @param lastSeenAtMs - Unix timestamp (ms) when the game was last active
 * @param incomePerSecondU - Current income per second in fixed-point units (GoldU)
 * @returns Offline progress result with gold earned, ticks simulated, and clamped status
 *
 * @example
 * // Player returns after 1 hour with 10 gold/second income
 * const now = Date.now();
 * const lastSeen = now - (1 * 60 * 60 * 1000); // 1 hour ago
 * const result = calculateOfflineProgress(now, lastSeen, 10000);
 * // result.goldEarned ≈ 36000 (36 gold)
 * // result.wasClamped = false
 *
 * @example
 * // Player returns after 10 hours (exceeds 8-hour cap)
 * const now = Date.now();
 * const lastSeen = now - (10 * 60 * 60 * 1000); // 10 hours ago
 * const result = calculateOfflineProgress(now, lastSeen, 10000);
 * // result.goldEarned ≈ 288000 (only 8 hours worth)
 * // result.wasClamped = true
 *
 * @example
 * // Negative time delta (clock skew) returns zero income
 * const result = calculateOfflineProgress(1000, 2000, 10000);
 * // result.goldEarned = 0
 * // result.ticksSimulated = 0
 * // result.wasClamped = false
 */
export function calculateOfflineProgress(
  now: number,
  lastSeenAtMs: number,
  incomePerSecondU: GoldU
): OfflineProgressResult {
  // Calculate raw time delta
  const rawDeltaMs = now - lastSeenAtMs;

  // Handle edge cases: negative time (clock skew) or zero delta
  if (rawDeltaMs <= 0) {
    return {
      goldEarned: 0,
      ticksSimulated: 0,
      wasClamped: false,
    };
  }

  // Apply the 8-hour security cap
  const wasClamped = rawDeltaMs > MAX_OFFLINE_MS;
  const deltaMs = wasClamped ? MAX_OFFLINE_MS : rawDeltaMs;

  // Calculate ticks that would have occurred (for logging/debugging)
  const ticksSimulated = Math.floor(deltaMs / TICK_MS);

  // Calculate gold earned: incomePerSecond * (deltaMs / 1000)
  // Using fixed-point arithmetic for precision
  const goldEarned = Math.floor((incomePerSecondU * deltaMs) / 1000);

  return {
    goldEarned,
    ticksSimulated,
    wasClamped,
  };
}
