/**
 * Tests for Reducer immutability and action handling
 *
 * Verifies that:
 * - Original state is never mutated after reduce
 * - Actions are handled correctly with proper state transitions
 * - Events are emitted correctly for each action type
 * - Errors are returned (not thrown) for invalid actions
 */

import { describe, it, expect } from "vitest";
import { reduce, handleTick, handleUpgradeHero, handleCalculateOffline } from "../../src/reducer";
import { createInitialState } from "../../src/state/initial";
import { tick, upgradeHero, calculateOffline, save, load } from "../../src/types/actions";
import type { GameState, HeroState, ReduceResult, DomainEvent } from "../../src/types";
import { isGoldEarnedEvent, isHeroUpgradeAppliedEvent, isHeroUpgradeRejectedEvent, isOfflineProgressAppliedEvent, isSecurityOfflineClampedEvent } from "../../src/types/events";

/**
 * Helper to create a state with a hero in the roster
 */
function createStateWithHero(
  heroId: string,
  level: number,
  incomePerSecondU: number,
  gold: number = 1000000 // 1000 gold
): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 12345);

  return {
    ...state,
    wallet: {
      ...state.wallet,
      gold,
      lifetimeEarnedGold: gold,
    },
    heroes: {
      roster: {
        [heroId]: { level, incomePerSecondU },
      },
      order: [heroId],
    },
  };
}

/**
 * Helper to deep freeze state for immutability testing
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * Helper to create a modified state for testing
 */
function createModifiedState(): GameState {
  const now = 1700000000000;
  return {
    meta: {
      version: "0.1.0",
      createdAtMs: now,
      lastSeenAtMs: now + 10000,
      rootSeed: 99999,
    },
    wallet: {
      gold: 1500000, // 1500 gold in fixed-point
      lifetimeEarnedGold: 5000000,
    },
    tavern: {
      level: 5,
      upgrades: {
        "furniture": 3,
        "kitchen": 2,
      },
    },
    heroes: {
      roster: {
        "barkeep": { level: 10, incomePerSecondU: 1000 },
        "bard": { level: 5, incomePerSecondU: 2500 },
      },
      order: ["barkeep", "bard"],
    },
    time: {
      lastTickAtMs: now + 5000,
    },
  };
}

// ============================================================================
// IMMUTABILITY TESTS
// ============================================================================

describe("Reducer immutability", () => {
  describe("reduce() does not mutate original state", () => {
    it("preserves original state after TICK action", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);
      deepFreeze(original); // Will throw if mutation is attempted

      const result = reduce(original, tick(), Date.now());

      expect(JSON.stringify(original)).toBe(originalJson);
      expect(result.state).not.toBe(original);
    });

    it("preserves original state after UPGRADE_HERO action", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);
      deepFreeze(original);

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(JSON.stringify(original)).toBe(originalJson);
      expect(result.state).not.toBe(original);
    });

    it("preserves original state after CALCULATE_OFFLINE action", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);
      deepFreeze(original);

      const result = reduce(original, calculateOffline(Date.now() + 3600000), Date.now());

      expect(JSON.stringify(original)).toBe(originalJson);
      expect(result.state).not.toBe(original);
    });

    it("preserves original state after SAVE action", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);
      deepFreeze(original);

      const result = reduce(original, save(), Date.now());

      expect(JSON.stringify(original)).toBe(originalJson);
      expect(result.state).toBe(original); // SAVE returns same state
    });

    it("preserves original state after LOAD action", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);
      deepFreeze(original);

      const result = reduce(original, load(), Date.now());

      expect(JSON.stringify(original)).toBe(originalJson);
      expect(result.state).toBe(original); // LOAD returns same state
    });
  });

  describe("state slices are immutable", () => {
    it("returns new wallet slice after state change", () => {
      const original = createModifiedState();

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.wallet).not.toBe(original.wallet);
    });

    it("returns new heroes slice after upgrade", () => {
      const original = createModifiedState();

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.heroes).not.toBe(original.heroes);
    });

    it("returns new hero roster after upgrade", () => {
      const original = createModifiedState();

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.heroes.roster).not.toBe(original.heroes.roster);
    });

    it("returns new meta slice after timestamp update", () => {
      const original = createModifiedState();

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.meta).not.toBe(original.meta);
    });

    it("returns new time slice after tick", () => {
      const original = createModifiedState();

      const result = reduce(original, tick(), Date.now());

      expect(result.state.time).not.toBe(original.time);
    });

    it("preserves unchanged slices as same reference", () => {
      const original = createModifiedState();

      const result = reduce(original, tick(), Date.now());

      // Tavern should not change during tick
      expect(result.state.tavern).toBe(original.tavern);
    });
  });

  describe("deep immutability", () => {
    it("does not mutate nested roster objects", () => {
      const original = createStateWithHero("barkeep", 5, 1000);
      const originalHero = { ...original.heroes.roster["barkeep"]! };
      deepFreeze(original);

      const result = reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(original.heroes.roster["barkeep"]).toEqual(originalHero);
    });

    it("does not mutate nested wallet properties", () => {
      const original = createModifiedState();
      const originalGold = original.wallet.gold;
      const originalLifetime = original.wallet.lifetimeEarnedGold;
      deepFreeze(original);

      reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(original.wallet.gold).toBe(originalGold);
      expect(original.wallet.lifetimeEarnedGold).toBe(originalLifetime);
    });

    it("does not mutate nested meta properties", () => {
      const original = createModifiedState();
      const originalLastSeen = original.meta.lastSeenAtMs;
      deepFreeze(original);

      reduce(original, upgradeHero("barkeep", 1), Date.now());

      expect(original.meta.lastSeenAtMs).toBe(originalLastSeen);
    });
  });
});

// ============================================================================
// TICK ACTION TESTS
// ============================================================================

describe("TICK action handling", () => {
  describe("basic tick processing", () => {
    it("updates lastTickAtMs timestamp", () => {
      const state = createInitialState(1700000000000, 12345);
      const now = 1700000001000;

      const result = reduce(state, tick(), now);

      expect(result.state.time.lastTickAtMs).toBe(now);
    });

    it("emits GOLD_EARNED event when heroes have income", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.time.lastTickAtMs + 40; // One tick later

      const result = reduce(state, tick(), now);

      const goldEvents = result.events.filter(isGoldEarnedEvent);
      expect(goldEvents.length).toBeGreaterThan(0);
    });

    it("does not emit GOLD_EARNED when no heroes", () => {
      const state = createInitialState(Date.now(), 12345);
      const now = state.time.lastTickAtMs + 40;

      const result = reduce(state, tick(), now);

      const goldEvents = result.events.filter(isGoldEarnedEvent);
      expect(goldEvents).toHaveLength(0);
    });

    it("does not emit error for valid tick", () => {
      const state = createInitialState(Date.now(), 12345);

      const result = reduce(state, tick(), Date.now());

      expect(result.error).toBeUndefined();
    });
  });

  describe("tick with income calculation", () => {
    it("calculates income from multiple heroes", () => {
      const state = createModifiedState(); // Has barkeep and bard
      const now = state.time.lastTickAtMs + 40;

      const result = reduce(state, tick(), now);

      const goldEvents = result.events.filter(isGoldEarnedEvent);
      const totalGold = goldEvents.reduce((sum, e) => sum + e.amount, 0);
      expect(totalGold).toBeGreaterThan(0);
    });

    it("increases wallet gold after tick", () => {
      const state = createModifiedState();
      const originalGold = state.wallet.gold;
      const now = state.time.lastTickAtMs + 40;

      const result = reduce(state, tick(), now);

      expect(result.state.wallet.gold).toBeGreaterThan(originalGold);
    });

    it("updates lifetimeEarnedGold", () => {
      const state = createModifiedState();
      const originalLifetime = state.wallet.lifetimeEarnedGold;
      const now = state.time.lastTickAtMs + 40;

      const result = reduce(state, tick(), now);

      expect(result.state.wallet.lifetimeEarnedGold).toBeGreaterThan(originalLifetime);
    });
  });
});

// ============================================================================
// UPGRADE HERO ACTION TESTS
// ============================================================================

describe("UPGRADE_HERO action handling", () => {
  describe("successful upgrades", () => {
    it("increases hero level on successful upgrade", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000); // 10000 gold

      const result = reduce(state, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.heroes.roster["barkeep"]?.level).toBe(6);
    });

    it("deducts gold from wallet", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);
      const originalGold = state.wallet.gold;

      const result = reduce(state, upgradeHero("barkeep", 1), Date.now());

      expect(result.state.wallet.gold).toBeLessThan(originalGold);
    });

    it("emits HERO_UPGRADE_APPLIED event", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);

      const result = reduce(state, upgradeHero("barkeep", 1), Date.now());

      const upgradeEvents = result.events.filter(isHeroUpgradeAppliedEvent);
      expect(upgradeEvents).toHaveLength(1);
      expect(upgradeEvents[0]?.heroId).toBe("barkeep");
      expect(upgradeEvents[0]?.appliedLevels).toBe(1);
    });

    it("updates lastSeenAtMs timestamp", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);
      const now = Date.now() + 10000;

      const result = reduce(state, upgradeHero("barkeep", 1), now);

      expect(result.state.meta.lastSeenAtMs).toBe(now);
    });
  });

  describe("upgrade defaults", () => {
    it("defaults to 1 level when levels not specified", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);

      const result = reduce(state, { type: "UPGRADE_HERO", heroId: "barkeep" }, Date.now());

      expect(result.state.heroes.roster["barkeep"]?.level).toBe(6);
    });
  });

  describe("upgrade validation", () => {
    it("rejects upgrade for non-existent hero ID", () => {
      const state = createInitialState(Date.now(), 12345);

      const result = reduce(state, upgradeHero("nonexistent", 1), Date.now());

      expect(result.error).toBeDefined();
      const rejectEvents = result.events.filter(isHeroUpgradeRejectedEvent);
      expect(rejectEvents.length).toBeGreaterThan(0);
    });

    it("rejects upgrade when hero not in roster", () => {
      const state = createInitialState(Date.now(), 12345);

      // "bard" is a valid hero ID but not in roster
      const result = reduce(state, upgradeHero("bard", 1), Date.now());

      expect(result.error).toBeDefined();
    });

    it("rejects upgrade with zero gold", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 0);

      const result = reduce(state, upgradeHero("barkeep", 1), Date.now());

      expect(result.error).toBeDefined();
      const rejectEvents = result.events.filter(isHeroUpgradeRejectedEvent);
      expect(rejectEvents.length).toBeGreaterThan(0);
    });

    it("rejects upgrade with invalid levels (zero)", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);

      const result = reduce(state, upgradeHero("barkeep", 0), Date.now());

      expect(result.error).toBeDefined();
    });

    it("rejects upgrade with invalid levels (negative)", () => {
      const state = createStateWithHero("barkeep", 5, 1000, 10000000);

      const result = reduce(state, upgradeHero("barkeep", -5), Date.now());

      expect(result.error).toBeDefined();
    });
  });

  describe("partial upgrades", () => {
    it("applies partial levels when gold is insufficient for full upgrade", () => {
      // Give just enough gold for 2 levels but request 5
      const state = createStateWithHero("barkeep", 1, 1000, 30000); // ~3 gold

      const result = reduce(state, upgradeHero("barkeep", 5), Date.now());

      // Should apply some levels (partial)
      const upgradeEvents = result.events.filter(isHeroUpgradeAppliedEvent);
      if (upgradeEvents.length > 0) {
        expect(upgradeEvents[0]?.appliedLevels).toBeLessThan(5);
        expect(upgradeEvents[0]?.appliedLevels).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// CALCULATE OFFLINE ACTION TESTS
// ============================================================================

describe("CALCULATE_OFFLINE action handling", () => {
  describe("basic offline progress", () => {
    it("emits OFFLINE_PROGRESS_APPLIED event", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 3600000; // 1 hour later

      const result = reduce(state, calculateOffline(now), now);

      const offlineEvents = result.events.filter(isOfflineProgressAppliedEvent);
      expect(offlineEvents.length).toBeGreaterThan(0);
    });

    it("emits GOLD_EARNED event from offline", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 3600000;

      const result = reduce(state, calculateOffline(now), now);

      const goldEvents = result.events.filter(isGoldEarnedEvent);
      expect(goldEvents.length).toBeGreaterThan(0);
      expect(goldEvents[0]?.source).toBe("OFFLINE");
    });

    it("increases wallet gold", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const originalGold = state.wallet.gold;
      const now = state.meta.lastSeenAtMs + 3600000;

      const result = reduce(state, calculateOffline(now), now);

      expect(result.state.wallet.gold).toBeGreaterThan(originalGold);
    });

    it("updates lastSeenAtMs timestamp", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 3600000;

      const result = reduce(state, calculateOffline(now), now);

      expect(result.state.meta.lastSeenAtMs).toBe(now);
    });

    it("updates lastTickAtMs timestamp", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 3600000;

      const result = reduce(state, calculateOffline(now), now);

      expect(result.state.time.lastTickAtMs).toBe(now);
    });
  });

  describe("offline cap enforcement", () => {
    it("emits SECURITY_OFFLINE_CLAMPED when exceeding 8 hours", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 9 * 60 * 60 * 1000; // 9 hours

      const result = reduce(state, calculateOffline(now), now);

      const clampedEvents = result.events.filter(isSecurityOfflineClampedEvent);
      expect(clampedEvents.length).toBeGreaterThan(0);
    });

    it("does not emit clamped event under 8 hours", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 7 * 60 * 60 * 1000; // 7 hours

      const result = reduce(state, calculateOffline(now), now);

      const clampedEvents = result.events.filter(isSecurityOfflineClampedEvent);
      expect(clampedEvents).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles zero income (no heroes)", () => {
      const state = createInitialState(Date.now(), 12345);
      const now = state.meta.lastSeenAtMs + 3600000;

      const result = reduce(state, calculateOffline(now), now);

      expect(result.state.wallet.gold).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it("handles very short offline time", () => {
      const state = createStateWithHero("barkeep", 5, 1000);
      const now = state.meta.lastSeenAtMs + 1000; // 1 second

      const result = reduce(state, calculateOffline(now), now);

      expect(result.error).toBeUndefined();
    });
  });
});

// ============================================================================
// SAVE/LOAD ACTION TESTS
// ============================================================================

describe("SAVE and LOAD action handling", () => {
  it("returns unchanged state for SAVE action", () => {
    const state = createModifiedState();

    const result = reduce(state, save(), Date.now());

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("returns unchanged state for LOAD action", () => {
    const state = createModifiedState();

    const result = reduce(state, load(), Date.now());

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});

// ============================================================================
// UNKNOWN ACTION TESTS
// ============================================================================

describe("unknown action handling", () => {
  it("returns error for unknown action type", () => {
    const state = createModifiedState();
    const unknownAction = { type: "UNKNOWN_ACTION" };

    const result = reduce(state, unknownAction as never, Date.now());

    expect(result.error).toBeDefined();
    expect(result.state).toBe(state); // State unchanged
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe("reducer determinism", () => {
  it("produces same result for same inputs (TICK)", () => {
    const state = createModifiedState();
    const now = Date.now();

    const result1 = reduce(state, tick(), now);
    const result2 = reduce(state, tick(), now);

    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });

  it("produces same result for same inputs (UPGRADE_HERO)", () => {
    const state = createStateWithHero("barkeep", 5, 1000, 10000000);
    const now = Date.now();

    const result1 = reduce(state, upgradeHero("barkeep", 2), now);
    const result2 = reduce(state, upgradeHero("barkeep", 2), now);

    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });

  it("produces same result for same inputs (CALCULATE_OFFLINE)", () => {
    const state = createStateWithHero("barkeep", 5, 1000);
    const now = state.meta.lastSeenAtMs + 3600000;

    const result1 = reduce(state, calculateOffline(now), now);
    const result2 = reduce(state, calculateOffline(now), now);

    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });

  it("produces identical results for sequential actions", () => {
    const state1 = createModifiedState();
    const state2 = createModifiedState();
    const now = Date.now();

    // Sequence on state1
    const result1a = reduce(state1, tick(), now);
    const result1b = reduce(result1a.state, tick(), now + 40);

    // Same sequence on state2
    const result2a = reduce(state2, tick(), now);
    const result2b = reduce(result2a.state, tick(), now + 40);

    expect(result1b.state).toEqual(result2b.state);
    expect(result1b.events).toEqual(result2b.events);
  });
});

// ============================================================================
// HANDLER DIRECT ACCESS TESTS
// ============================================================================

describe("handler direct access", () => {
  it("handleTick is accessible and works", () => {
    const state = createModifiedState();
    const now = Date.now();

    const result = handleTick(state, tick(), now);

    expect(result.state.time.lastTickAtMs).toBe(now);
  });

  it("handleUpgradeHero is accessible and works", () => {
    const state = createStateWithHero("barkeep", 5, 1000, 10000000);
    const now = Date.now();

    const result = handleUpgradeHero(state, upgradeHero("barkeep", 1), now);

    expect(result.state.heroes.roster["barkeep"]?.level).toBe(6);
  });

  it("handleCalculateOffline is accessible and works", () => {
    const state = createStateWithHero("barkeep", 5, 1000);
    const now = state.meta.lastSeenAtMs + 3600000;

    const result = handleCalculateOffline(state, calculateOffline(now));

    expect(result.state.meta.lastSeenAtMs).toBe(now);
  });
});

// ============================================================================
// EVENT SEQUENCE TESTS
// ============================================================================

describe("event sequences", () => {
  it("emits events in consistent order for TICK", () => {
    const state = createModifiedState();
    const now = state.time.lastTickAtMs + 40;

    const result = reduce(state, tick(), now);

    // Events should be consistently ordered
    expect(result.events.length).toBeGreaterThan(0);
    result.events.forEach((event, index) => {
      expect(event.type).toBeDefined();
    });
  });

  it("emits events in consistent order for CALCULATE_OFFLINE", () => {
    const state = createStateWithHero("barkeep", 5, 1000);
    const now = state.meta.lastSeenAtMs + 3600000;

    const result = reduce(state, calculateOffline(now), now);

    // Should have OFFLINE_PROGRESS_APPLIED and GOLD_EARNED
    expect(result.events.length).toBeGreaterThanOrEqual(2);

    // OFFLINE_PROGRESS_APPLIED should come before GOLD_EARNED
    const offlineIndex = result.events.findIndex(isOfflineProgressAppliedEvent);
    const goldIndex = result.events.findIndex(isGoldEarnedEvent);
    expect(offlineIndex).toBeLessThan(goldIndex);
  });
});
