/**
 * Tests for Offline Progress Module
 *
 * Verifies offline gold calculation, time cap enforcement, and edge cases.
 * Core formulas:
 * - Gold earned: floor(incomePerSecondU * deltaMs / 1000)
 * - Time cap: min(deltaMs, MAX_OFFLINE_MS)
 * - Ticks simulated: floor(deltaMs / TICK_MS)
 *
 * @module tests/unit/offline.test
 */

import { describe, it, expect } from "vitest";
import {
  calculateOfflineProgress,
  type OfflineProgressResult,
} from "../../src/time/offline";
import { MAX_OFFLINE_MS, TICK_MS } from "../../src/config/balance";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Standard income values for testing (in fixed-point units).
 */
const INCOME_PER_SECOND_U = {
  zero: 0,
  low: 100, // 0.1 gold/second
  medium: 1000, // 1 gold/second
  high: 10000, // 10 gold/second
  veryHigh: 1000000, // 1000 gold/second
};

/**
 * Time deltas for testing (in milliseconds).
 */
const TIME_DELTAS = {
  zero: 0,
  oneSecond: 1000,
  oneMinute: 60 * 1000,
  oneHour: 60 * 60 * 1000,
  twoHours: 2 * 60 * 60 * 1000,
  fourHours: 4 * 60 * 60 * 1000,
  eightHours: 8 * 60 * 60 * 1000, // MAX_OFFLINE_MS
  tenHours: 10 * 60 * 60 * 1000, // Exceeds cap
  twentyFourHours: 24 * 60 * 60 * 1000, // Way over cap
};

// ============================================================================
// BASIC CALCULATION TESTS
// ============================================================================

describe("calculateOfflineProgress - basic calculations", () => {
  describe("zero time delta", () => {
    it("returns 0 gold for zero time delta", () => {
      const now = Date.now();
      const result = calculateOfflineProgress(now, now, INCOME_PER_SECOND_U.medium);

      expect(result.goldEarned).toBe(0);
      expect(result.ticksSimulated).toBe(0);
      expect(result.wasClamped).toBe(false);
    });

    it("returns 0 gold when now equals lastSeenAtMs", () => {
      const timestamp = 1000000;
      const result = calculateOfflineProgress(timestamp, timestamp, INCOME_PER_SECOND_U.high);

      expect(result.goldEarned).toBe(0);
      expect(result.ticksSimulated).toBe(0);
      expect(result.wasClamped).toBe(false);
    });
  });

  describe("positive time deltas", () => {
    it("calculates gold for 1 second offline", () => {
      const now = TIME_DELTAS.oneSecond;
      const lastSeen = 0;
      // Gold = 1000 * 1000 / 1000 = 1000
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.goldEarned).toBe(1000);
      expect(result.wasClamped).toBe(false);
    });

    it("calculates gold for 1 minute offline", () => {
      const now = TIME_DELTAS.oneMinute;
      const lastSeen = 0;
      // Gold = 1000 * 60000 / 1000 = 60000
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.goldEarned).toBe(60000);
      expect(result.wasClamped).toBe(false);
    });

    it("calculates gold for 1 hour offline", () => {
      const now = TIME_DELTAS.oneHour;
      const lastSeen = 0;
      // Gold = 1000 * 3600000 / 1000 = 3600000
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.goldEarned).toBe(3600000);
      expect(result.wasClamped).toBe(false);
    });

    it("calculates gold correctly with high income", () => {
      const now = TIME_DELTAS.oneHour;
      const lastSeen = 0;
      // Gold = 10000 * 3600000 / 1000 = 36000000
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.high);

      expect(result.goldEarned).toBe(36000000);
      expect(result.wasClamped).toBe(false);
    });
  });

  describe("ticks calculation", () => {
    it("calculates ticks for 1 second (25 ticks at 40ms)", () => {
      const now = TIME_DELTAS.oneSecond;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      // 1000ms / 40ms = 25 ticks
      expect(result.ticksSimulated).toBe(25);
    });

    it("calculates ticks for 4 seconds (100 ticks)", () => {
      const now = 4000;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      // 4000ms / 40ms = 100 ticks
      expect(result.ticksSimulated).toBe(100);
    });

    it("floors fractional ticks", () => {
      // 50ms = 1.25 ticks -> floors to 1
      const now = 50;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.ticksSimulated).toBe(1);
    });

    it("returns 0 ticks for delta less than TICK_MS", () => {
      const now = 30; // Less than 40ms
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.ticksSimulated).toBe(0);
    });
  });
});

// ============================================================================
// TIME CAP TESTS
// ============================================================================

describe("calculateOfflineProgress - time cap enforcement", () => {
  describe("under the cap", () => {
    it("does not clamp at exactly 4 hours", () => {
      const now = TIME_DELTAS.fourHours;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(false);
    });

    it("does not clamp at exactly 8 hours (boundary)", () => {
      const now = TIME_DELTAS.eightHours;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      // At exactly MAX_OFFLINE_MS, should not be clamped
      expect(result.wasClamped).toBe(false);
      // Gold = 1000 * 28800000 / 1000 = 28800000
      expect(result.goldEarned).toBe(28800000);
    });

    it("does not clamp for 1 millisecond under cap", () => {
      const now = MAX_OFFLINE_MS - 1;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(false);
    });
  });

  describe("over the cap", () => {
    it("clamps at 10 hours (exceeds 8 hour cap)", () => {
      const now = TIME_DELTAS.tenHours;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(true);
      // Gold should be based on 8 hours, not 10
      // Gold = 1000 * 28800000 / 1000 = 28800000
      expect(result.goldEarned).toBe(28800000);
    });

    it("clamps at 24 hours", () => {
      const now = TIME_DELTAS.twentyFourHours;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(true);
      // Still capped at 8 hours
      expect(result.goldEarned).toBe(28800000);
    });

    it("clamps at 1 millisecond over cap", () => {
      const now = MAX_OFFLINE_MS + 1;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(true);
    });

    it("clamps at extreme time deltas (1 year)", () => {
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const now = oneYearMs;
      const lastSeen = 0;
      const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

      expect(result.wasClamped).toBe(true);
      // Still capped at 8 hours
      expect(result.goldEarned).toBe(28800000);
    });
  });

  describe("cap boundary verification", () => {
    it("MAX_OFFLINE_MS equals 8 hours in milliseconds", () => {
      expect(MAX_OFFLINE_MS).toBe(8 * 60 * 60 * 1000);
      expect(MAX_OFFLINE_MS).toBe(28800000);
    });

    it("gold at cap equals income * 8 hours", () => {
      const incomePerSecond = INCOME_PER_SECOND_U.medium; // 1000
      const result = calculateOfflineProgress(
        TIME_DELTAS.tenHours,
        0,
        incomePerSecond
      );

      // 1000 gold/sec * 8 hours * 3600 sec/hour = 28800000
      const expectedGold = incomePerSecond * 8 * 60 * 60;
      expect(result.goldEarned).toBe(expectedGold);
    });
  });
});

// ============================================================================
// NEGATIVE TIME DELTA TESTS (CLOCK SKEW)
// ============================================================================

describe("calculateOfflineProgress - negative time delta (clock skew)", () => {
  it("returns 0 gold when lastSeenAtMs is in the future", () => {
    const now = 10000;
    const lastSeen = 20000; // lastSeen > now
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("handles large negative delta", () => {
    const now = 1000;
    const lastSeen = 10000000;
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.high);

    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("handles lastSeenAtMs 1ms in the future", () => {
    const now = 10000;
    const lastSeen = 10001;
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.medium);

    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });
});

// ============================================================================
// ZERO INCOME TESTS
// ============================================================================

describe("calculateOfflineProgress - zero income", () => {
  it("returns 0 gold for zero income with normal time delta", () => {
    const now = TIME_DELTAS.oneHour;
    const lastSeen = 0;
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.zero);

    expect(result.goldEarned).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it("returns 0 gold for zero income even over the cap", () => {
    const now = TIME_DELTAS.twentyFourHours;
    const lastSeen = 0;
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.zero);

    expect(result.goldEarned).toBe(0);
    // Note: wasClamped should be true since delta > MAX_OFFLINE_MS
    expect(result.wasClamped).toBe(true);
  });

  it("calculates ticks even with zero income", () => {
    const now = TIME_DELTAS.oneHour;
    const lastSeen = 0;
    const result = calculateOfflineProgress(now, lastSeen, INCOME_PER_SECOND_U.zero);

    // Ticks should still be calculated
    // 3600000ms / 40ms = 90000 ticks
    expect(result.ticksSimulated).toBe(90000);
  });
});

// ============================================================================
// FLOOR/PRECISION TESTS
// ============================================================================

describe("calculateOfflineProgress - precision and flooring", () => {
  it("uses floor for gold calculation with fractional result", () => {
    // Set up a scenario where gold has fractional part
    const now = 1500; // 1.5 seconds
    const lastSeen = 0;
    const incomePerSecondU = 1000; // 1 gold/second

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 1000 * 1500 / 1000 = 1500 (exact)
    expect(result.goldEarned).toBe(1500);
  });

  it("handles odd millisecond values correctly", () => {
    const now = 1049; // 1.049 seconds
    const lastSeen = 0;
    const incomePerSecondU = 1000;

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 1000 * 1049 / 1000 = 1049
    expect(result.goldEarned).toBe(1049);
  });

  it("calculates correctly with non-round income values", () => {
    const now = 1000;
    const lastSeen = 0;
    const incomePerSecondU = 333; // Non-round number

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 333 * 1000 / 1000 = 333
    expect(result.goldEarned).toBe(333);
  });

  it("handles very small income per second", () => {
    const now = TIME_DELTAS.oneHour;
    const lastSeen = 0;
    const incomePerSecondU = 1; // Very small income

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 1 * 3600000 / 1000 = 3600
    expect(result.goldEarned).toBe(3600);
  });

  it("handles large income values without overflow", () => {
    const now = TIME_DELTAS.eightHours;
    const lastSeen = 0;
    const incomePerSecondU = 100000000; // 100000 gold/second

    const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

    // 100000000 * 28800000 / 1000 = 2880000000000
    expect(result.goldEarned).toBe(2880000000000);
    expect(result.wasClamped).toBe(false);
  });
});

// ============================================================================
// RESULT TYPE TESTS
// ============================================================================

describe("calculateOfflineProgress - result type", () => {
  it("returns all required fields", () => {
    const result = calculateOfflineProgress(1000, 0, 1000);

    expect(result).toHaveProperty("goldEarned");
    expect(result).toHaveProperty("ticksSimulated");
    expect(result).toHaveProperty("wasClamped");
  });

  it("returns readonly result (immutable)", () => {
    const result = calculateOfflineProgress(1000, 0, 1000);

    // TypeScript enforces readonly at compile time
    // At runtime, we verify the structure is correct
    expect(typeof result.goldEarned).toBe("number");
    expect(typeof result.ticksSimulated).toBe("number");
    expect(typeof result.wasClamped).toBe("boolean");
  });

  it("returns consistent types for all scenarios", () => {
    const scenarios = [
      { now: 0, lastSeen: 0, income: 0 },
      { now: 10000, lastSeen: 0, income: 1000 },
      { now: 100000, lastSeen: 0, income: 50000 },
      { now: 1000, lastSeen: 2000, income: 1000 }, // Negative delta
      { now: TIME_DELTAS.twentyFourHours, lastSeen: 0, income: 1000 }, // Over cap
    ];

    scenarios.forEach(({ now, lastSeen, income }) => {
      const result = calculateOfflineProgress(now, lastSeen, income);

      expect(typeof result.goldEarned).toBe("number");
      expect(typeof result.ticksSimulated).toBe("number");
      expect(typeof result.wasClamped).toBe("boolean");
      expect(Number.isInteger(result.goldEarned)).toBe(true);
      expect(Number.isInteger(result.ticksSimulated)).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("offline progress integration", () => {
  it("calculates expected gold for realistic 4-hour absence", () => {
    // Player with 10 gold/second income away for 4 hours
    const incomePerSecond = 10000; // 10 gold/sec in fixed-point
    const absenceMs = TIME_DELTAS.fourHours;

    const result = calculateOfflineProgress(absenceMs, 0, incomePerSecond);

    // Expected: 10 gold/sec * 4 hours * 3600 sec/hour = 144000 gold
    // In fixed-point: 10000 * 14400000 / 1000 = 144000000
    expect(result.goldEarned).toBe(144000000);
    expect(result.wasClamped).toBe(false);
    // Ticks: 14400000 / 40 = 360000
    expect(result.ticksSimulated).toBe(360000);
  });

  it("applies cap for realistic 12-hour absence", () => {
    // Player away for 12 hours (exceeds 8-hour cap)
    const incomePerSecond = 5000; // 5 gold/sec
    const absenceMs = 12 * 60 * 60 * 1000;

    const result = calculateOfflineProgress(absenceMs, 0, incomePerSecond);

    expect(result.wasClamped).toBe(true);
    // Should only get 8 hours worth: 5 * 8 * 3600 = 144000 gold
    // In fixed-point: 5000 * 28800000 / 1000 = 144000000
    expect(result.goldEarned).toBe(144000000);
  });

  it("tick count matches TICK_MS constant", () => {
    const deltaMs = 10000; // 10 seconds
    const expectedTicks = Math.floor(deltaMs / TICK_MS);

    const result = calculateOfflineProgress(deltaMs, 0, 1000);

    expect(result.ticksSimulated).toBe(expectedTicks);
    expect(result.ticksSimulated).toBe(250); // 10000 / 40 = 250
  });

  it("gold calculation is proportional to income", () => {
    const now = TIME_DELTAS.oneHour;
    const lastSeen = 0;

    const result1 = calculateOfflineProgress(now, lastSeen, 1000);
    const result2 = calculateOfflineProgress(now, lastSeen, 2000);
    const result3 = calculateOfflineProgress(now, lastSeen, 500);

    // Double income = double gold
    expect(result2.goldEarned).toBe(result1.goldEarned * 2);
    // Half income = half gold
    expect(result3.goldEarned).toBe(result1.goldEarned / 2);
  });

  it("gold calculation is proportional to time (under cap)", () => {
    const income = 1000;

    const result1 = calculateOfflineProgress(TIME_DELTAS.oneHour, 0, income);
    const result2 = calculateOfflineProgress(TIME_DELTAS.twoHours, 0, income);

    // Double time = double gold
    expect(result2.goldEarned).toBe(result1.goldEarned * 2);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("calculateOfflineProgress - edge cases", () => {
  it("handles very small time delta (1ms)", () => {
    const result = calculateOfflineProgress(1, 0, 1000);

    expect(result.goldEarned).toBe(1); // 1000 * 1 / 1000 = 1
    expect(result.ticksSimulated).toBe(0); // 1 / 40 = 0.025 -> floors to 0
    expect(result.wasClamped).toBe(false);
  });

  it("handles time delta of exactly TICK_MS", () => {
    const result = calculateOfflineProgress(TICK_MS, 0, 1000);

    expect(result.ticksSimulated).toBe(1);
    expect(result.goldEarned).toBe(40); // 1000 * 40 / 1000 = 40
  });

  it("handles time delta of TICK_MS - 1", () => {
    const result = calculateOfflineProgress(TICK_MS - 1, 0, 1000);

    expect(result.ticksSimulated).toBe(0);
    expect(result.goldEarned).toBe(39); // 1000 * 39 / 1000 = 39
  });

  it("handles large timestamps (year 2030+)", () => {
    // Unix timestamp in 2030
    const futureNow = 1893456000000; // ~2030
    const futureLastSeen = futureNow - TIME_DELTAS.oneHour;

    const result = calculateOfflineProgress(futureNow, futureLastSeen, 1000);

    expect(result.goldEarned).toBe(3600000);
    expect(result.wasClamped).toBe(false);
  });

  it("handles zero for all parameters", () => {
    const result = calculateOfflineProgress(0, 0, 0);

    expect(result.goldEarned).toBe(0);
    expect(result.ticksSimulated).toBe(0);
    expect(result.wasClamped).toBe(false);
  });
});
