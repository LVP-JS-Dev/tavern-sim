/**
 * Tests for Simulation Determinism
 *
 * Verifies the core guarantee: same seed + same actions = same final state
 *
 * This is critical for:
 * - Replay verification (debugging recorded gameplay)
 * - Multiplayer sync (all clients see same results)
 * - Testing (predictable outcomes)
 * - Offline progress calculation (consistent results)
 *
 * @module tests/unit/determinism.test
 */

import { describe, it, expect } from "vitest";
import { reduce } from "../../src/reducer";
import { createInitialState } from "../../src/state/initial";
import { tick, upgradeHero, calculateOffline } from "../../src/types/actions";
import type { GameState, Action, ReduceResult } from "../../src/types";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Replays a sequence of actions from an initial state and returns the final result.
 *
 * @param initialState - The starting game state
 * @param actions - Array of actions to apply sequentially
 * @param baseTime - Base timestamp for actions (increments by 40ms per action)
 * @returns The final ReduceResult after all actions are applied
 */
function replayActions(
  initialState: GameState,
  actions: Action[],
  baseTime: number
): ReduceResult {
  let result: ReduceResult = { state: initialState, events: [] };

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const now = baseTime + i * 40; // 40ms per tick
    result = reduce(result.state, action, now);
  }

  return result;
}

/**
 * Creates a state with a hero in the roster for testing.
 */
function createStateWithHero(
  heroId: string,
  level: number,
  incomePerSecondU: number,
  gold: number = 1000000, // 1000 gold in fixed-point
  seed: number = 12345
): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, seed);

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
 * Creates a complex state with multiple heroes for testing.
 */
function createComplexState(seed: number): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, seed);

  return {
    ...state,
    wallet: {
      gold: 10000000, // 10000 gold
      lifetimeEarnedGold: 20000000,
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
        "chef": { level: 3, incomePerSecondU: 4000 },
      },
      order: ["barkeep", "bard", "chef"],
    },
  };
}

// ============================================================================
// BASIC DETERMINISM TESTS
// ============================================================================

describe("Basic determinism", () => {
  describe("single action determinism", () => {
    it("produces identical results for TICK with same seed and time", () => {
      const seed = 54321;
      const now = 1700000000000;

      const state1 = createInitialState(now, seed);
      const state2 = createInitialState(now, seed);

      const result1 = reduce(state1, tick(), now + 40);
      const result2 = reduce(state2, tick(), now + 40);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
      expect(result1.error).toEqual(result2.error);
    });

    it("produces identical results for UPGRADE_HERO with same inputs", () => {
      const seed = 11111;
      const now = 1700000000000;

      const state1 = createStateWithHero("barkeep", 5, 1000, 10000000, seed);
      const state2 = createStateWithHero("barkeep", 5, 1000, 10000000, seed);

      const result1 = reduce(state1, upgradeHero("barkeep", 3), now);
      const result2 = reduce(state2, upgradeHero("barkeep", 3), now);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });

    it("produces identical results for CALCULATE_OFFLINE with same inputs", () => {
      const seed = 22222;
      const baseTime = 1700000000000;

      const state1 = createStateWithHero("bard", 10, 2000, 500000, seed);
      const state2 = createStateWithHero("bard", 10, 2000, 500000, seed);

      const offlineTime = baseTime + 3600000; // 1 hour later

      const result1 = reduce(state1, calculateOffline(offlineTime), offlineTime);
      const result2 = reduce(state2, calculateOffline(offlineTime), offlineTime);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });
  });

  describe("multiple runs produce identical results", () => {
    it("running same action 10 times produces identical results each time", () => {
      const seed = 99999;
      const now = 1700000000000;

      const results: ReduceResult[] = [];

      for (let i = 0; i < 10; i++) {
        const state = createStateWithHero("chef", 5, 3000, 5000000, seed);
        results.push(reduce(state, tick(), now + 40));
      }

      // All results should be identical
      const firstResult = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].state).toEqual(firstResult?.state);
        expect(results[i].events).toEqual(firstResult?.events);
      }
    });
  });
});

// ============================================================================
// SEQUENCE DETERMINISM TESTS
// ============================================================================

describe("Action sequence determinism", () => {
  describe("short sequences", () => {
    it("produces identical results for same action sequence (ticks only)", () => {
      const seed = 33333;
      const baseTime = 1700000000000;
      const actions: Action[] = [
        tick(),
        tick(),
        tick(),
        tick(),
        tick(),
      ];

      const state1 = createComplexState(seed);
      const state2 = createComplexState(seed);

      const result1 = replayActions(state1, actions, baseTime);
      const result2 = replayActions(state2, actions, baseTime);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });

    it("produces identical results for mixed action sequence", () => {
      const seed = 44444;
      const baseTime = 1700000000000;
      const actions: Action[] = [
        tick(),
        upgradeHero("barkeep", 1),
        tick(),
        tick(),
        upgradeHero("bard", 2),
        tick(),
      ];

      const state1 = createComplexState(seed);
      const state2 = createComplexState(seed);

      const result1 = replayActions(state1, actions, baseTime);
      const result2 = replayActions(state2, actions, baseTime);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });
  });

  describe("long sequences", () => {
    it("produces identical results for 100 tick sequence", () => {
      const seed = 55555;
      const baseTime = 1700000000000;

      // Create 100 tick actions
      const actions: Action[] = Array(100).fill(null).map(() => tick());

      const state1 = createComplexState(seed);
      const state2 = createComplexState(seed);

      const result1 = replayActions(state1, actions, baseTime);
      const result2 = replayActions(state2, actions, baseTime);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });

    it("produces identical results for complex 50-action sequence", () => {
      const seed = 66666;
      const baseTime = 1700000000000;

      // Create a complex sequence
      const actions: Action[] = [
        // Initial ticks
        ...Array(10).fill(null).map(() => tick()),
        // Upgrade heroes
        upgradeHero("barkeep", 1),
        upgradeHero("bard", 1),
        // More ticks
        ...Array(10).fill(null).map(() => tick()),
        // More upgrades
        upgradeHero("chef", 2),
        upgradeHero("barkeep", 1),
        // More ticks
        ...Array(10).fill(null).map(() => tick()),
        // Offline calculation
        calculateOffline(baseTime + 1000000),
        // Final ticks
        ...Array(14).fill(null).map(() => tick()),
      ];

      const state1 = createComplexState(seed);
      const state2 = createComplexState(seed);

      const result1 = replayActions(state1, actions, baseTime);
      const result2 = replayActions(state2, actions, baseTime);

      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });
  });
});

// ============================================================================
// SEED VARIATION TESTS
// ============================================================================

describe("Seed variation", () => {
  it("different seeds produce different states (when RNG is used)", () => {
    // Note: In current implementation, most actions are deterministic
    // without RNG. This test documents expected behavior when RNG
    // is introduced (e.g., for adventures, random events).
    const seed1 = 11111;
    const seed2 = 22222;
    const now = 1700000000000;

    const state1 = createInitialState(now, seed1);
    const state2 = createInitialState(now, seed2);

    // States should have different seeds
    expect(state1.meta.rootSeed).not.toBe(state2.meta.rootSeed);
  });

  it("same seed always produces same initial state", () => {
    const seed = 77777;
    const now = 1700000000000;

    const state1 = createInitialState(now, seed);
    const state2 = createInitialState(now, seed);
    const state3 = createInitialState(now, seed);

    expect(state1).toEqual(state2);
    expect(state2).toEqual(state3);
  });
});

// ============================================================================
// TIMESTAMP DETERMINISM TESTS
// ============================================================================

describe("Timestamp determinism", () => {
  it("same timestamps produce identical results", () => {
    const seed = 88888;
    const now1 = 1700000001000;
    const now2 = 1700000001000;

    const state1 = createStateWithHero("barkeep", 5, 1000, 1000000, seed);
    const state2 = createStateWithHero("barkeep", 5, 1000, 1000000, seed);

    const result1 = reduce(state1, tick(), now1);
    const result2 = reduce(state2, tick(), now2);

    expect(result1.state).toEqual(result2.state);
  });

  it("different timestamps produce different results (for time-dependent actions)", () => {
    const seed = 99999;
    const now1 = 1700000000000;
    const now2 = 1700001000000; // Much later

    const state1 = createStateWithHero("barkeep", 5, 1000, 1000000, seed);
    const state2 = createStateWithHero("barkeep", 5, 1000, 1000000, seed);

    const result1 = reduce(state1, tick(), now1);
    const result2 = reduce(state2, tick(), now2);

    // Timestamps in state should differ
    expect(result1.state.time.lastTickAtMs).toBe(now1);
    expect(result2.state.time.lastTickAtMs).toBe(now2);
    expect(result1.state.time.lastTickAtMs).not.toBe(result2.state.time.lastTickAtMs);
  });
});

// ============================================================================
// STATE SHAPE DETERMINISM TESTS
// ============================================================================

describe("State shape determinism", () => {
  it("preserves key order in roster across runs", () => {
    const seed = 12345;
    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const keys1 = Object.keys(state1.heroes.roster);
    const keys2 = Object.keys(state2.heroes.roster);

    expect(keys1).toEqual(keys2);
  });

  it("preserves order array across runs", () => {
    const seed = 12345;
    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    expect(state1.heroes.order).toEqual(state2.heroes.order);
  });

  it("produces JSON-identical states", () => {
    const seed = 12345;
    const baseTime = 1700000000000;
    const actions: Action[] = [
      tick(),
      upgradeHero("barkeep", 1),
      tick(),
    ];

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    // JSON stringification should produce identical results
    expect(JSON.stringify(result1.state)).toBe(JSON.stringify(result2.state));
    expect(JSON.stringify(result1.events)).toBe(JSON.stringify(result2.events));
  });
});

// ============================================================================
// EVENT ORDER DETERMINISM TESTS
// ============================================================================

describe("Event order determinism", () => {
  it("emits events in same order for same inputs", () => {
    const seed = 12345;
    const baseTime = 1700000000000;

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    // Multiple ticks will generate multiple events
    const actions: Action[] = [
      tick(),
      tick(),
      tick(),
    ];

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    // Event order should be identical
    expect(result1.events.map(e => e.type)).toEqual(result2.events.map(e => e.type));
  });

  it("emits same event types in same order for upgrade sequence", () => {
    const seed = 12345;
    const baseTime = 1700000000000;

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const actions: Action[] = [
      upgradeHero("barkeep", 1),
      upgradeHero("bard", 2),
      tick(),
    ];

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    expect(result1.events.map(e => e.type)).toEqual(result2.events.map(e => e.type));
  });
});

// ============================================================================
// REPLAY VERIFICATION TESTS
// ============================================================================

describe("Replay verification", () => {
  it("can replay recorded actions and reach same state", () => {
    // Simulate recording a gameplay session
    const seed = 13579;
    const baseTime = 1700000000000;

    // Original gameplay
    const originalState = createComplexState(seed);
    const recordedActions: Action[] = [
      tick(),
      tick(),
      upgradeHero("barkeep", 2),
      tick(),
      upgradeHero("bard", 1),
      tick(),
      tick(),
      tick(),
    ];

    const originalResult = replayActions(originalState, recordedActions, baseTime);

    // Replay the recorded actions
    const replayState = createComplexState(seed);
    const replayResult = replayActions(replayState, recordedActions, baseTime);

    // Results should be identical
    expect(replayResult.state).toEqual(originalResult.state);
    expect(replayResult.events).toEqual(originalResult.events);
  });

  it("replay produces same final gold amount", () => {
    const seed = 24680;
    const baseTime = 1700000000000;

    const actions: Action[] = [
      ...Array(20).fill(null).map(() => tick()),
      upgradeHero("barkeep", 3),
      ...Array(10).fill(null).map(() => tick()),
    ];

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    expect(result1.state.wallet.gold).toBe(result2.state.wallet.gold);
    expect(result1.state.wallet.lifetimeEarnedGold).toBe(result2.state.wallet.lifetimeEarnedGold);
  });

  it("replay produces same hero levels", () => {
    const seed = 97531;
    const baseTime = 1700000000000;

    const actions: Action[] = [
      upgradeHero("barkeep", 5),
      upgradeHero("bard", 3),
      upgradeHero("chef", 2),
    ];

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    // Compare each hero's level
    for (const heroId of Object.keys(result1.state.heroes.roster)) {
      expect(result1.state.heroes.roster[heroId]?.level).toBe(
        result2.state.heroes.roster[heroId]?.level
      );
    }
  });
});

// ============================================================================
// EDGE CASE DETERMINISM TESTS
// ============================================================================

describe("Edge case determinism", () => {
  it("empty action sequence produces same state", () => {
    const seed = 11223;
    const baseTime = 1700000000000;
    const actions: Action[] = [];

    const state1 = createComplexState(seed);
    const state2 = createComplexState(seed);

    const result1 = replayActions(state1, actions, baseTime);
    const result2 = replayActions(state2, actions, baseTime);

    expect(result1.state).toEqual(result2.state);
    expect(result1.state).toEqual(createComplexState(seed));
  });

  it("zero income hero produces deterministic results", () => {
    const seed = 44556;
    const now = 1700000000000;

    const state1 = createStateWithHero("barkeep", 0, 1000, 1000000, seed);
    const state2 = createStateWithHero("barkeep", 0, 1000, 1000000, seed);

    const result1 = reduce(state1, tick(), now + 40);
    const result2 = reduce(state2, tick(), now + 40);

    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });

  it("failed upgrade produces deterministic error", () => {
    const seed = 77889;
    const now = 1700000000000;

    // Create state with zero gold - upgrade will fail
    const state1 = createStateWithHero("barkeep", 5, 1000, 0, seed);
    const state2 = createStateWithHero("barkeep", 5, 1000, 0, seed);

    const result1 = reduce(state1, upgradeHero("barkeep", 1), now);
    const result2 = reduce(state2, upgradeHero("barkeep", 1), now);

    expect(result1.error).toEqual(result2.error);
    expect(result1.events).toEqual(result2.events);
    expect(result1.state).toEqual(result2.state);
  });
});
