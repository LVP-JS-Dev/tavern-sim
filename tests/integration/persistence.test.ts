/**
 * Persistence Integration Tests
 *
 * Tests the complete save/load cycle for game state:
 * - State survives save/load roundtrip
 * - Serialization preserves all data
 * - File storage handles errors correctly
 * - Migration integration with persistence
 *
 * These tests verify that the persistence layer (FileStorage + serialize)
 * works correctly as an integrated system.
 *
 * @module tests/integration/persistence
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { createInitialState } from "../../src/state/initial";
import { serializeState, deserializeState, cloneState, SerializationError } from "../../src/state/serialize";
import { FileStorage, createFileStorage } from "../../src/persistence/file";
import { StorageError, isStorage } from "../../src/persistence/storage";
import { migrateState, needsMigration, MigrationError } from "../../src/state/migrations";
import { reduce } from "../../src/reducer";
import { tick, upgradeHero } from "../../src/types/actions";
import { SCHEMA_VERSION } from "../../src/types";
import type { GameState } from "../../src/types";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Creates a complex state with all slices populated for thorough testing.
 */
function createComplexState(): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 54321);

  return {
    meta: {
      version: SCHEMA_VERSION,
      createdAtMs: now,
      lastSeenAtMs: now + 3600000, // 1 hour later
      rootSeed: 54321,
    },
    wallet: {
      gold: 1234567, // 1234.567 gold
      lifetimeEarnedGold: 5000000, // 5000 gold lifetime
    },
    tavern: {
      level: 5,
      upgrades: {
        furniture: 3,
        lighting: 2,
        kitchen: 1,
      },
    },
    heroes: {
      roster: {
        barkeep: { level: 10, incomePerSecondU: 5000 },
        bard: { level: 7, incomePerSecondU: 12500 },
        chef: { level: 4, incomePerSecondU: 8000 },
      },
      order: ["barkeep", "bard", "chef"],
    },
    time: {
      lastTickAtMs: now + 3600000,
    },
  };
}

/**
 * Helper to apply multiple ticks and return the final state.
 */
function applyTicks(state: GameState, count: number): GameState {
  let currentState = state;
  let currentTime = state.time.lastTickAtMs;

  for (let i = 0; i < count; i++) {
    currentTime += 40;
    const result = reduce(currentState, tick(), currentTime);
    currentState = result.state;
  }

  return currentState;
}

// ============================================================================
// SERIALIZATION ROUNDTRIP TESTS
// ============================================================================

describe("Serialization Roundtrip", () => {
  describe("basic serialization", () => {
    it("preserves initial state through serialize/deserialize cycle", () => {
      const original = createInitialState(Date.now(), 12345);
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored).toEqual(original);
    });

    it("preserves complex state through serialize/deserialize cycle", () => {
      const original = createComplexState();
      const json = serializeState(original);
      const restored = deserializeState(json);

      expect(restored).toEqual(original);
    });

    it("produces valid JSON string", () => {
      const state = createComplexState();
      const json = serializeState(state);

      // Should be parseable
      expect(() => JSON.parse(json)).not.toThrow();

      // Should be properly formatted
      const parsed = JSON.parse(json);
      expect(parsed.meta.version).toBe(SCHEMA_VERSION);
    });
  });

  describe("data type preservation", () => {
    it("preserves all numeric values exactly", () => {
      const state = createComplexState();
      const json = serializeState(state);
      const restored = deserializeState(json);

      // Check all numeric fields
      expect(restored.meta.createdAtMs).toBe(state.meta.createdAtMs);
      expect(restored.meta.lastSeenAtMs).toBe(state.meta.lastSeenAtMs);
      expect(restored.meta.rootSeed).toBe(state.meta.rootSeed);
      expect(restored.wallet.gold).toBe(state.wallet.gold);
      expect(restored.wallet.lifetimeEarnedGold).toBe(state.wallet.lifetimeEarnedGold);
      expect(restored.tavern.level).toBe(state.tavern.level);
      expect(restored.time.lastTickAtMs).toBe(state.time.lastTickAtMs);
    });

    it("preserves string values exactly", () => {
      const state = createComplexState();
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.meta.version).toBe(state.meta.version);
      expect(restored.heroes.order).toEqual(state.heroes.order);
    });

    it("preserves nested objects and arrays", () => {
      const state = createComplexState();
      const json = serializeState(state);
      const restored = deserializeState(json);

      // Check tavern upgrades object
      expect(restored.tavern.upgrades).toEqual(state.tavern.upgrades);

      // Check heroes roster
      expect(restored.heroes.roster).toEqual(state.heroes.roster);
      expect(restored.heroes.order).toEqual(state.heroes.order);
    });

    it("preserves empty collections", () => {
      const state = createInitialState(Date.now(), 12345);
      const json = serializeState(state);
      const restored = deserializeState(json);

      expect(restored.heroes.roster).toEqual({});
      expect(restored.heroes.order).toEqual([]);
      expect(restored.tavern.upgrades).toEqual({});
    });
  });

  describe("clone function", () => {
    it("creates independent copy of state", () => {
      const original = createComplexState();
      const cloned = cloneState(original);

      // Should be equal but not same reference
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it("creates deep copy (nested objects are independent)", () => {
      const original = createComplexState();
      const cloned = cloneState(original);

      // Modify clone should not affect original
      const clonedMutable = cloned as GameState;
      clonedMutable.wallet.gold = 999;
      clonedMutable.heroes.roster = {};

      expect(original.wallet.gold).toBe(1234567);
      expect(original.heroes.roster["barkeep"]).toBeDefined();
    });
  });
});

// ============================================================================
// FILE STORAGE TESTS
// ============================================================================

describe("FileStorage", () => {
  const testDir = path.join(process.cwd(), "test-persistence");
  const testFile = path.join(testDir, "save.json");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("save and load", () => {
    it("saves and loads state correctly", async () => {
      const state = createComplexState();
      const storage = new FileStorage(testFile);

      await storage.save(state);
      const loaded = await storage.load();

      expect(loaded).toEqual(state);
    });

    it("creates file if it does not exist", async () => {
      const state = createInitialState(Date.now(), 12345);
      const storage = new FileStorage(testFile);

      expect(await storage.exists()).toBe(false);

      await storage.save(state);

      expect(await storage.exists()).toBe(true);
    });

    it("overwrites existing file", async () => {
      const storage = new FileStorage(testFile);

      // Save first state
      const state1 = createInitialState(Date.now(), 11111);
      await storage.save(state1);

      // Save second state
      const state2 = createInitialState(Date.now(), 22222);
      state2.wallet.gold = 999999;
      await storage.save(state2);

      // Load and verify second state
      const loaded = await storage.load();
      expect(loaded.meta.rootSeed).toBe(22222);
      expect(loaded.wallet.gold).toBe(999999);
    });

    it("preserves state after multiple save/load cycles", async () => {
      const state = createComplexState();
      const storage = new FileStorage(testFile);

      // Multiple cycles
      for (let i = 0; i < 3; i++) {
        await storage.save(state);
        const loaded = await storage.load();
        expect(loaded).toEqual(state);
      }
    });
  });

  describe("exists method", () => {
    it("returns false when file does not exist", async () => {
      const storage = new FileStorage(testFile);
      expect(await storage.exists()).toBe(false);
    });

    it("returns true when file exists", async () => {
      const state = createInitialState(Date.now(), 12345);
      const storage = new FileStorage(testFile);

      await storage.save(state);

      expect(await storage.exists()).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws StorageError with NOT_FOUND when loading non-existent file", async () => {
      const storage = new FileStorage(testFile);

      await expect(storage.load()).rejects.toThrow(StorageError);

      try {
        await storage.load();
      } catch (error) {
        expect((error as StorageError).code).toBe("NOT_FOUND");
      }
    });

    it("throws StorageError with INVALID_DATA for corrupted JSON", async () => {
      // Write invalid JSON
      await fs.writeFile(testFile, "not valid json {{{", "utf-8");

      const storage = new FileStorage(testFile);

      await expect(storage.load()).rejects.toThrow(StorageError);

      try {
        await storage.load();
      } catch (error) {
        expect((error as StorageError).code).toBe("INVALID_DATA");
      }
    });

    it("throws StorageError with INVALID_DATA for valid JSON but invalid state", async () => {
      // Write valid JSON but not a valid GameState
      await fs.writeFile(testFile, JSON.stringify({ foo: "bar" }), "utf-8");

      const storage = new FileStorage(testFile);

      await expect(storage.load()).rejects.toThrow(StorageError);

      try {
        await storage.load();
      } catch (error) {
        expect((error as StorageError).code).toBe("INVALID_DATA");
      }
    });
  });

  describe("atomic writes", () => {
    it("uses atomic write pattern (temp file → rename)", async () => {
      const state = createComplexState();
      const storage = new FileStorage(testFile);

      await storage.save(state);

      // Verify file exists and contains valid state
      const content = await fs.readFile(testFile, "utf-8");
      const loaded = deserializeState(content);
      expect(loaded).toEqual(state);

      // Verify no temp files left behind
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(f => f.startsWith(".tmp-"));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe("factory function", () => {
    it("creates storage instance via factory", async () => {
      const state = createInitialState(Date.now(), 12345);
      const storage = createFileStorage(testFile);

      await storage.save(state);
      const loaded = await storage.load();

      expect(loaded).toEqual(state);
    });
  });
});

// ============================================================================
// STORAGE INTERFACE TESTS
// ============================================================================

describe("Storage Interface", () => {
  it("FileStorage implements Storage interface", () => {
    const storage = new FileStorage("/tmp/test.json");
    expect(isStorage(storage)).toBe(true);
  });

  it("isStorage returns false for non-storage objects", () => {
    expect(isStorage(null)).toBe(false);
    expect(isStorage(undefined)).toBe(false);
    expect(isStorage({})).toBe(false);
    expect(isStorage({ load: "not a function" })).toBe(false);
  });
});

// ============================================================================
// MIGRATION INTEGRATION TESTS
// ============================================================================

describe("Migration Integration", () => {
  describe("needsMigration", () => {
    it("returns false for current version", () => {
      const state = createInitialState(Date.now(), 12345);
      expect(needsMigration(state as Record<string, unknown>)).toBe(false);
    });

    it("returns true for state without version", () => {
      const stateWithoutVersion = { wallet: { gold: 100 } };
      expect(needsMigration(stateWithoutVersion)).toBe(true);
    });
  });

  describe("migrateState", () => {
    it("returns state unchanged when already at current version", () => {
      const state = createInitialState(Date.now(), 12345);
      const result = migrateState(state as Record<string, unknown>);

      expect(result.error).toBeUndefined();
      expect(result.state).toEqual(state);
    });

    it("returns error for state without version", () => {
      const stateWithoutVersion = { wallet: { gold: 100 } };
      const result = migrateState(stateWithoutVersion);

      expect(result.error).toBeInstanceOf(MigrationError);
      expect(result.error?.fromVersion).toBe("unknown");
    });

    it("returns error for future version (cannot downgrade)", () => {
      const futureState = {
        meta: { version: "99.0.0", createdAtMs: Date.now(), lastSeenAtMs: Date.now(), rootSeed: 1 },
        wallet: { gold: 0, lifetimeEarnedGold: 0 },
        tavern: { level: 1, upgrades: {} },
        heroes: { roster: {}, order: [] },
        time: { lastTickAtMs: Date.now() },
      };

      const result = migrateState(futureState);

      expect(result.error).toBeInstanceOf(MigrationError);
      expect(result.error?.fromVersion).toBe("99.0.0");
    });
  });
});

// ============================================================================
// SAVE/LOAD WITH GAMEPLAY TESTS
// ============================================================================

describe("Save/Load with Gameplay", () => {
  const testDir = path.join(process.cwd(), "test-persistence-gameplay");
  const testFile = path.join(testDir, "save.json");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("can save, load, and continue gameplay", async () => {
    // Create initial state with a hero
    let state = createInitialState(Date.now(), 12345);
    state = {
      ...state,
      wallet: { gold: 100000, lifetimeEarnedGold: 100000 },
      heroes: {
        roster: { barkeep: { level: 5, incomePerSecondU: 1000 } },
        order: ["barkeep"],
      },
    };

    // Apply some ticks
    state = applyTicks(state, 10);

    // Save
    const storage = new FileStorage(testFile);
    await storage.save(state);

    // Load
    const loadedState = await storage.load();

    // Continue gameplay
    const tickResult = reduce(loadedState, tick(), loadedState.time.lastTickAtMs + 40);
    expect(tickResult.error).toBeUndefined();

    // Save again
    await storage.save(tickResult.state);

    // Load and verify final state
    const finalState = await storage.load();
    expect(finalState.time.lastTickAtMs).toBe(tickResult.state.time.lastTickAtMs);
  });

  it("preserves hero levels after save/load", async () => {
    let state = createInitialState(Date.now(), 12345);
    state = {
      ...state,
      wallet: { gold: 1000000, lifetimeEarnedGold: 1000000 },
      heroes: {
        roster: {
          barkeep: { level: 1, incomePerSecondU: 1000 },
          bard: { level: 1, incomePerSecondU: 2500 },
        },
        order: ["barkeep", "bard"],
      },
    };

    // Upgrade heroes
    const upgrade1 = reduce(state, upgradeHero("barkeep", 5), state.time.lastTickAtMs + 40);
    const upgrade2 = reduce(upgrade1.state, upgradeHero("bard", 3), upgrade1.state.time.lastTickAtMs + 40);

    // Save and load
    const storage = new FileStorage(testFile);
    await storage.save(upgrade2.state);
    const loaded = await storage.load();

    // Verify levels preserved
    expect(loaded.heroes.roster["barkeep"]?.level).toBe(6); // 1 + 5
    expect(loaded.heroes.roster["bard"]?.level).toBe(4); // 1 + 3
  });

  it("preserves tavern upgrades after save/load", async () => {
    const state: GameState = {
      meta: {
        version: SCHEMA_VERSION,
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
        rootSeed: 12345,
      },
      wallet: { gold: 500000, lifetimeEarnedGold: 500000 },
      tavern: {
        level: 10,
        upgrades: {
          furniture: 5,
          lighting: 3,
          kitchen: 7,
          bar: 2,
        },
      },
      heroes: { roster: {}, order: [] },
      time: { lastTickAtMs: Date.now() },
    };

    const storage = new FileStorage(testFile);
    await storage.save(state);
    const loaded = await storage.load();

    expect(loaded.tavern.level).toBe(10);
    expect(loaded.tavern.upgrades.furniture).toBe(5);
    expect(loaded.tavern.upgrades.lighting).toBe(3);
    expect(loaded.tavern.upgrades.kitchen).toBe(7);
    expect(loaded.tavern.upgrades.bar).toBe(2);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Persistence Edge Cases", () => {
  const testDir = path.join(process.cwd(), "test-persistence-edge");
  const testFile = path.join(testDir, "save.json");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("handles state with starting gold", async () => {
    const state = createInitialState(Date.now(), 12345);
    // Starting gold: 10g (10,000 in fixed-point units)
    expect(state.wallet.gold).toBe(10000);

    const storage = new FileStorage(testFile);
    await storage.save(state);
    const loaded = await storage.load();

    expect(loaded.wallet.gold).toBe(10000);
    expect(loaded.wallet.lifetimeEarnedGold).toBe(10000);
  });

  it("handles state with large gold values", async () => {
    const state: GameState = {
      meta: {
        version: SCHEMA_VERSION,
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
        rootSeed: 12345,
      },
      wallet: {
        gold: Number.MAX_SAFE_INTEGER,
        lifetimeEarnedGold: Number.MAX_SAFE_INTEGER,
      },
      tavern: { level: 1, upgrades: {} },
      heroes: { roster: {}, order: [] },
      time: { lastTickAtMs: Date.now() },
    };

    const storage = new FileStorage(testFile);
    await storage.save(state);
    const loaded = await storage.load();

    expect(loaded.wallet.gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(loaded.wallet.lifetimeEarnedGold).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("handles state with many heroes", async () => {
    const state = createInitialState(Date.now(), 12345);
    const roster: Record<string, { level: number; incomePerSecondU: number }> = {};
    const order: string[] = [];

    // Create 50 heroes
    for (let i = 0; i < 50; i++) {
      const heroId = `hero_${i}`;
      roster[heroId] = { level: i + 1, incomePerSecondU: (i + 1) * 1000 };
      order.push(heroId);
    }

    const stateWithHeroes: GameState = {
      ...state,
      heroes: { roster, order },
    };

    const storage = new FileStorage(testFile);
    await storage.save(stateWithHeroes);
    const loaded = await storage.load();

    expect(Object.keys(loaded.heroes.roster)).toHaveLength(50);
    expect(loaded.heroes.order).toHaveLength(50);
    expect(loaded.heroes.order[0]).toBe("hero_0");
    expect(loaded.heroes.order[49]).toBe("hero_49");
  });

  it("handles concurrent save operations", async () => {
    const state1 = createInitialState(Date.now(), 11111);
    const state2 = createInitialState(Date.now(), 22222);

    const storage = new FileStorage(testFile);

    // Save both concurrently (one should win)
    await Promise.all([
      storage.save(state1),
      storage.save(state2),
    ]);

    // Load and verify one of them was saved
    const loaded = await storage.load();
    expect([11111, 22222]).toContain(loaded.meta.rootSeed);
  });

  it("handles special characters in state data", async () => {
    const state: GameState = {
      meta: {
        version: SCHEMA_VERSION,
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
        rootSeed: 12345,
      },
      wallet: { gold: 100, lifetimeEarnedGold: 100 },
      tavern: {
        level: 1,
        upgrades: {
          "upgrade-with-dash": 1,
          "upgrade_with_underscore": 2,
          "upgrade.with.dot": 3,
        },
      },
      heroes: {
        roster: {
          "hero-with-dash": { level: 1, incomePerSecondU: 1000 },
        },
        order: ["hero-with-dash"],
      },
      time: { lastTickAtMs: Date.now() },
    };

    const storage = new FileStorage(testFile);
    await storage.save(state);
    const loaded = await storage.load();

    expect(loaded.tavern.upgrades["upgrade-with-dash"]).toBe(1);
    expect(loaded.tavern.upgrades["upgrade_with_underscore"]).toBe(2);
    expect(loaded.tavern.upgrades["upgrade.with.dot"]).toBe(3);
    expect(loaded.heroes.roster["hero-with-dash"]).toBeDefined();
  });
});

// ============================================================================
// DETERMINISM AFTER SAVE/LOAD
// ============================================================================

describe("Determinism After Save/Load", () => {
  const testDir = path.join(process.cwd(), "test-persistence-determinism");
  const testFile = path.join(testDir, "save.json");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("produces same results after save/load", () => {
    const state: GameState = {
      meta: {
        version: SCHEMA_VERSION,
        createdAtMs: 1700000000000,
        lastSeenAtMs: 1700000000000,
        rootSeed: 12345,
      },
      wallet: { gold: 100000, lifetimeEarnedGold: 100000 },
      tavern: { level: 1, upgrades: {} },
      heroes: {
        roster: { barkeep: { level: 5, incomePerSecondU: 1000 } },
        order: ["barkeep"],
      },
      time: { lastTickAtMs: 1700000000000 },
    };

    // Apply tick to original
    const result1 = reduce(state, tick(), state.time.lastTickAtMs + 40);

    // Serialize and deserialize
    const json = serializeState(state);
    const restored = deserializeState(json);

    // Apply tick to restored
    const result2 = reduce(restored, tick(), restored.time.lastTickAtMs + 40);

    // Results should be identical
    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });

  it("maintains determinism across multiple save/load cycles", async () => {
    let state: GameState = {
      meta: {
        version: SCHEMA_VERSION,
        createdAtMs: 1700000000000,
        lastSeenAtMs: 1700000000000,
        rootSeed: 99999,
      },
      wallet: { gold: 100000, lifetimeEarnedGold: 100000 },
      tavern: { level: 1, upgrades: {} },
      heroes: {
        roster: { barkeep: { level: 5, incomePerSecondU: 1000 } },
        order: ["barkeep"],
      },
      time: { lastTickAtMs: 1700000000000 },
    };

    const storage = new FileStorage(testFile);

    // First cycle
    await storage.save(state);
    state = await storage.load();

    // Apply tick
    let result = reduce(state, tick(), state.time.lastTickAtMs + 40);
    state = result.state;

    // Second cycle
    await storage.save(state);
    state = await storage.load();

    // Apply another tick
    result = reduce(state, tick(), state.time.lastTickAtMs + 40);
    state = result.state;

    // Third cycle
    await storage.save(state);
    const finalState = await storage.load();

    // Verify state is consistent
    expect(finalState.meta.rootSeed).toBe(99999);
    expect(finalState.wallet.gold).toBeGreaterThan(0);
  });
});
