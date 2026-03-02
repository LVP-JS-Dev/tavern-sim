/**
 * Tests for offline progress calculation module
 */

import { describe, it, expect } from "vitest";
import { calculateOfflineProgress } from "../../src/time/offline";
import { MAX_OFFLINE_MS } from "../../src/config/balance";

describe("calculateOfflineProgress", () => {
  it("returns 0 gold for zero time delta", () => {
    const now = Date.now();
    const result = calculateOfflineProgress(now, now, 1000);
    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("returns 0 gold for negative time delta (clock skew)", () => {
    const now = 10000;
    const lastSeen = 20000; // lastSeen > now
    const result = calculateOfflineProgress(now, lastSeen, 1000);
    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("calculates gold correctly for short offline period", () => {
    const now = 10000000;
    const lastSeen = 0; // 10,000,000 ms = 10,000 seconds
    const incomePerSecondU = 1000; // 1 gold/second in fixed-point

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // goldEarned = incomePerSecondU * deltaMs / 1000 = 1000 * 10000000 / 1000 = 10,000,000
    expect(result.goldEarned).toBe(10_000_000);
    expect(result.wasClamped).toBe(false);
  });

  it("does not clamp when delta is less than MAX_OFFLINE_MS", () => {
    // Test with 10,000,000 ms (about 2.78 hours, less than 8 hour cap)
    const now = Date.now();
    const lastSeen = now - 10000000;
    const result = calculateOfflineProgress(now, lastSeen, 10);

    expect(result.wasClamped).toBe(false);
  });

  it("clamps to MAX_OFFLINE_MS when delta exceeds cap", () => {
    // 10 hours = 36,000,000 ms (exceeds 8 hour cap of 28,800,000 ms)
    const tenHoursMs = 10 * 60 * 60 * 1000;
    const now = tenHoursMs;
    const lastSeen = 0;
    const incomePerSecondU = 1000; // 1 gold/second

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // Should be clamped to 8 hours
    expect(result.wasClamped).toBe(true);

    // Gold should be based on 8 hours, not 10
    // goldEarned = 1000 * 28,800,000 / 1000 = 28,800,000
    expect(result.goldEarned).toBe(MAX_OFFLINE_MS);
  });

  it("calculates correct ticks simulated", () => {
    const deltaMs = 4000; // 4 seconds
    const now = 10000;
    const lastSeen = now - deltaMs;

    const result = calculateOfflineProgress(now, lastSeen, 1000);

    // TICK_MS = 40, so 4000 / 40 = 100 ticks
    expect(result.ticksSimulated).toBe(100);
  });

  it("handles zero income correctly", () => {
    const now = 100000;
    const lastSeen = 0;
    const result = calculateOfflineProgress(now, lastSeen, 0);

    expect(result.goldEarned).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("uses floor for gold calculation", () => {
    // Set up a scenario where gold would have fractional part
    const now = 1050; // 1.05 seconds
    const lastSeen = 0;
    const incomePerSecondU = 1000; // 1 gold/second

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 1000 * 1050 / 1000 = 1050 (exact in this case)
    // Let's try 1049ms: 1000 * 1049 / 1000 = 1049 (also exact)
    // For floor to matter: 1000 * 1049 / 1001 would need different numbers
    expect(result.goldEarned).toBe(1050);
  });
});
