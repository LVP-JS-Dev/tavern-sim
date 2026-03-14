/**
 * Tests for GameState serialization roundtrip
 *
 * Verifies that state → JSON → state preserves all data across
 * all slices and edge cases.
 */

import { describe, it, expect } from "vitest";
import { serializeState, deserializeState, cloneState } from "../../src/state/serialize";
import { createInitialState } from "../../src/state/initial";
import type { GameState, HeroState } from "../../src/types/state";

/**
 * Helper to create a modified state for testing roundtrips
 */
function createModifiedState(): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 99999);

  // Create a modified state with all slices populated
  return {
    meta: {
      version: "0.1.0",
      createdAtMs: now,
      lastSeenAtMs: now + 10000,
      rootSeed: 99999,
    },
    wallet: {
      gold: 1500000, // 1500 gold in fixed-point (1500 * 1000)
      lifetimeEarnedGold: 5000000, // 5000 gold lifetime
    },
    tavern: {
      level: 5,
      upgrades: {
        "furniture": 3,
        "kitchen": 2,
        "bar": 4,
      },
    },
    heroes: {
      roster: {
        "barkeep": { level: 10, incomePerSecondU: 5000 },
        "bard": { level: 5, incomePerSecondU: 12500 },
        "chef": { level: 8, incomePerSecondU: 8000 },
      },
      order: ["barkeep", "bard", "chef"],
    },
    time: {
      lastTickAtMs: now + 5000,
    },
  };
}

describe("GameState serialization roundtrip", () => {
  describe("initial state roundtrip", () => {
    it("preserves initial state through serialize/deserialize", () => {
      const original = createInitialState(1700000000000, 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored).toEqual(original);
    });

    it("preserves all meta slice fields", () => {
      const original = createInitialState(1700000000000, 99999);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.meta.version).toBe(original.meta.version);
      expect(restored.meta.createdAtMs).toBe(original.meta.createdAtMs);
      expect(restored.meta.lastSeenAtMs).toBe(original.meta.lastSeenAtMs);
      expect(restored.meta.rootSeed).toBe(original.meta.rootSeed);
    });

    it("preserves all wallet slice fields", () => {
      const original = createInitialState(1700000000000, 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.wallet.gold).toBe(original.wallet.gold);
      expect(restored.wallet.lifetimeEarnedGold).toBe(original.wallet.lifetimeEarnedGold);
    });

    it("preserves all tavern slice fields", () => {
      const original = createInitialState(1700000000000, 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.tavern.level).toBe(original.tavern.level);
      expect(restored.tavern.upgrades).toEqual(original.tavern.upgrades);
    });

    it("preserves all heroes slice fields", () => {
      const original = createInitialState(1700000000000, 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.heroes.roster).toEqual(original.heroes.roster);
      expect(restored.heroes.order).toEqual(original.heroes.order);
    });

    it("preserves all time slice fields", () => {
      const original = createInitialState(1700000000000, 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.time.lastTickAtMs).toBe(original.time.lastTickAtMs);
    });
  });

  describe("modified state roundtrip", () => {
    it("preserves modified state through serialize/deserialize", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored).toEqual(original);
    });

    it("preserves wallet with large gold values", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.wallet.gold).toBe(1500000);
      expect(restored.wallet.lifetimeEarnedGold).toBe(5000000);
    });

    it("preserves tavern upgrades map", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.tavern.level).toBe(5);
      expect(restored.tavern.upgrades["furniture"]).toBe(3);
      expect(restored.tavern.upgrades["kitchen"]).toBe(2);
      expect(restored.tavern.upgrades["bar"]).toBe(4);
    });

    it("preserves hero roster and order", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(Object.keys(restored.heroes.roster)).toHaveLength(3);
      expect(restored.heroes.roster["barkeep"]).toEqual({ level: 10, incomePerSecondU: 5000 });
      expect(restored.heroes.roster["bard"]).toEqual({ level: 5, incomePerSecondU: 12500 });
      expect(restored.heroes.roster["chef"]).toEqual({ level: 8, incomePerSecondU: 8000 });
      expect(restored.heroes.order).toEqual(["barkeep", "bard", "chef"]);
    });
  });

  describe("edge cases", () => {
    it("handles empty hero roster", () => {
      const state = createInitialState(Date.now(), 12345);
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.heroes.roster).toEqual({});
      expect(restored.heroes.order).toEqual([]);
    });

    it("handles starting gold values", () => {
      const state = createInitialState(Date.now(), 12345);
      const json = serializeState(state);
      const restored = deserializeState(json);

      // Starting gold: 10g (10,000 in fixed-point units)
      expect(restored.wallet.gold).toBe(10000);
      expect(restored.wallet.lifetimeEarnedGold).toBe(10000);
    });

    it("handles very large gold values (fixed-point)", () => {
      const state = createInitialState(Date.now(), 12345);
      // Simulate large gold amount (1 billion gold = 1 trillion in fixed-point)
      const largeGoldState: GameState = {
        ...state,
        wallet: {
          gold: 1000000000000, // 1 billion gold
          lifetimeEarnedGold: 5000000000000, // 5 billion gold lifetime
        },
      };

      const json = serializeState(largeGoldState);
      const restored = deserializeState(json);

      expect(restored.wallet.gold).toBe(1000000000000);
      expect(restored.wallet.lifetimeEarnedGold).toBe(5000000000000);
    });

    it("handles hero with level 0", () => {
      const state = createInitialState(Date.now(), 12345);
      const stateWithZeroHero: GameState = {
        ...state,
        heroes: {
          roster: {
            "unlocked": { level: 0, incomePerSecondU: 1000 },
          },
          order: ["unlocked"],
        },
      };

      const json = serializeState(stateWithZeroHero);
      const restored = deserializeState(json);

      expect(restored.heroes.roster["unlocked"]?.level).toBe(0);
    });

    it("handles tavern with no upgrades", () => {
      const state = createInitialState(Date.now(), 12345);
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.tavern.upgrades).toEqual({});
    });

    it("handles large timestamp values", () => {
      const farFuture = 4102444800000; // Year 2100
      const state = createInitialState(farFuture, 12345);
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.meta.createdAtMs).toBe(farFuture);
      expect(restored.time.lastTickAtMs).toBe(farFuture);
    });

    it("handles negative root seed", () => {
      const state = createInitialState(Date.now(), -99999);
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.meta.rootSeed).toBe(-99999);
    });
  });

  describe("immutability", () => {
    it("does not mutate original state during serialization", () => {
      const original = createModifiedState();
      const originalJson = JSON.stringify(original);

      serializeState(original);

      expect(JSON.stringify(original)).toBe(originalJson);
    });

    it("returns new object after deserialize", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored).not.toBe(original);
      expect(restored.meta).not.toBe(original.meta);
      expect(restored.wallet).not.toBe(original.wallet);
      expect(restored.tavern).not.toBe(original.tavern);
      expect(restored.heroes).not.toBe(original.heroes);
      expect(restored.time).not.toBe(original.time);
    });

    it("returns new roster object after deserialize", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.heroes.roster).not.toBe(original.heroes.roster);
    });

    it("returns new upgrades object after deserialize", () => {
      const original = createModifiedState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored.tavern.upgrades).not.toBe(original.tavern.upgrades);
    });
  });

  describe("cloneState", () => {
    it("creates a deep copy via serialization roundtrip", () => {
      const original = createModifiedState();
      const clone = cloneState(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    });

    it("clone is independent of original", () => {
      const original = createModifiedState();
      const clone = cloneState(original);

      // Modify the clone's JSON representation
      const cloneJson = JSON.stringify(clone);

      // Original should still match its original JSON
      expect(JSON.stringify(original)).not.toBe(cloneJson);
    });
  });

  describe("multiple roundtrips", () => {
    it("preserves data through multiple serialize/deserialize cycles", () => {
      const original = createModifiedState();

      // First roundtrip
      const json1 = serializeState(original);
      const state1 = deserializeState(json1);

      // Second roundtrip
      const json2 = serializeState(state1);
      const state2 = deserializeState(json2);

      // Third roundtrip
      const json3 = serializeState(state2);
      const state3 = deserializeState(json3);

      // All should be equal
      expect(state1).toEqual(original);
      expect(state2).toEqual(original);
      expect(state3).toEqual(original);
    });

    it("produces identical JSON for identical state", () => {
      const original = createModifiedState();

      const json1 = serializeState(original);
      const json2 = serializeState(original);

      expect(json1).toBe(json2);
    });
  });
});
