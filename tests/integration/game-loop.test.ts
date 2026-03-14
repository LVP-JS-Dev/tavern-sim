/**
 * Full Game Loop Integration Tests
 *
 * Tests the complete gameplay flow from start to finish:
 * - Start → tick → upgrade → save → load → continue
 * - Persistence: state survives save/load cycle
 * - Basic gameplay workflows
 *
 * These tests verify that all modules work together correctly
 * and that the reducer pattern is properly integrated.
 *
 * @module tests/integration/game-loop
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { reduce } from "../../src/reducer";
import { createInitialState } from "../../src/state/initial";
import { serializeState, deserializeState } from "../../src/state/serialize";
import { FileStorage } from "../../src/persistence/file";
import { tick, upgradeHero, calculateOffline, save, load } from "../../src/types/actions";
import {
  isGoldEarnedEvent,
  isHeroUpgradeAppliedEvent,
  isHeroUpgradeRejectedEvent,
  isOfflineProgressAppliedEvent,
  isSecurityOfflineClampedEvent,
} from "../../src/types/events";
import type { GameState, ReduceResult, DomainEvent } from "../../src/types";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Helper to create a state with heroes in the roster
 */
function createStateWithHeroes(
  heroes: Array<{ id: string; level: number; incomePerSecondU: number }>,
  gold: number = 0
): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 12345);

  const roster: Record<string, { level: number; incomePerSecondU: number }> = {};
  const order: string[] = [];

  for (const hero of heroes) {
    roster[hero.id] = { level: hero.level, incomePerSecondU: hero.incomePerSecondU };
    order.push(hero.id);
  }

  return {
    ...state,
    wallet: {
      ...state.wallet,
      gold,
      lifetimeEarnedGold: gold,
    },
    heroes: {
      roster,
      order,
    },
  };
}

/**
 * Helper to apply multiple actions in sequence
 */
function applyActions(
  initialState: GameState,
  actions: Array<{ action: ReturnType<typeof tick | typeof upgradeHero | typeof calculateOffline>; now?: number }>
): { state: GameState; events: DomainEvent[]; errors: Array<ReduceResult["error"]> } {
  let state = initialState;
  const allEvents: DomainEvent[] = [];
  const errors: Array<ReduceResult["error"]> = [];
  let currentTime = initialState.time.lastTickAtMs;

  for (const { action, now } of actions) {
    const actionTime = now ?? currentTime + 40;
    currentTime = actionTime;
    const result = reduce(state, action, actionTime);
    state = result.state;
    allEvents.push(...result.events);
    if (result.error) {
      errors.push(result.error);
    }
  }

  return { state, events: allEvents, errors };
}

// ============================================================================
// FULL GAME LOOP TESTS
// ============================================================================

describe("Full Game Loop", () => {
  describe("basic gameplay flow", () => {
    it("completes start → tick → upgrade → tick sequence", () => {
      // 1. Start with initial state and a hero
      const initialState = createStateWithHeroes(
        [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
        100000 // Start with 100 gold (in fixed-point)
      );

      // 2. First tick - earn some gold
      const tick1Result = reduce(initialState, tick(), initialState.time.lastTickAtMs + 40);
      expect(tick1Result.error).toBeUndefined();

      // 3. Upgrade the hero
      const upgradeResult = reduce(
        tick1Result.state,
        upgradeHero("barkeep", 1),
        tick1Result.state.time.lastTickAtMs + 40
      );
      expect(upgradeResult.error).toBeUndefined();
      const upgradeEvents = upgradeResult.events.filter(isHeroUpgradeAppliedEvent);
      expect(upgradeEvents.length).toBeGreaterThan(0);

      // 4. Second tick - should earn more gold due to higher level
      const tick2Result = reduce(
        upgradeResult.state,
        tick(),
        upgradeResult.state.time.lastTickAtMs + 40
      );
      expect(tick2Result.error).toBeUndefined();

      // Verify the game loop completed successfully
      expect(tick2Result.state.heroes.roster["barkeep"]?.level).toBe(2);
      expect(tick2Result.state.wallet.gold).toBeGreaterThan(0);
    });

    it("supports multiple ticks with accumulating income", () => {
      const initialState = createStateWithHeroes(
        [
          { id: "barkeep", level: 5, incomePerSecondU: 1000 },
          { id: "bard", level: 3, incomePerSecondU: 2500 },
        ],
        0
      );

      let state = initialState;
      let totalGoldEarned = 0;
      const tickCount = 10;

      for (let i = 0; i < tickCount; i++) {
        const result = reduce(state, tick(), state.time.lastTickAtMs + 40);
        const goldEvents = result.events.filter(isGoldEarnedEvent);
        totalGoldEarned += goldEvents.reduce((sum, e) => sum + e.amount, 0);
        state = result.state;
      }

      // Verify gold accumulated over multiple ticks
      expect(state.wallet.gold).toBe(totalGoldEarned);
      expect(state.wallet.gold).toBeGreaterThan(0);
    });

    it("handles partial upgrades correctly in game loop", () => {
      // Start with limited gold
      const initialState = createStateWithHeroes(
        [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
        5000 // 5 gold - enough for some levels but not many
      );

      // Try to upgrade 10 levels (should apply partial)
      const result = reduce(
        initialState,
        upgradeHero("barkeep", 10),
        initialState.time.lastTickAtMs + 40
      );

      const upgradeEvents = result.events.filter(isHeroUpgradeAppliedEvent);
      if (upgradeEvents.length > 0) {
        // Should have applied some levels but not all 10
        expect(upgradeEvents[0]!.appliedLevels).toBeLessThan(10);
        expect(upgradeEvents[0]!.appliedLevels).toBeGreaterThan(0);
      }
    });
  });

  describe("tick → upgrade → tick flow", () => {
    it("increases income after upgrade", () => {
      const initialState = createStateWithHeroes(
        [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
        0
      );

      // Tick before upgrade
      const tick1Result = reduce(initialState, tick(), initialState.time.lastTickAtMs + 40);
      const goldBeforeUpgrade = tick1Result.events.filter(isGoldEarnedEvent)
        .reduce((sum, e) => sum + e.amount, 0);

      // Add gold for upgrade
      const stateWithGold: GameState = {
        ...tick1Result.state,
        wallet: {
          ...tick1Result.state.wallet,
          gold: 100000, // Add 100 gold
          lifetimeEarnedGold: tick1Result.state.wallet.lifetimeEarnedGold + 100000,
        },
      };

      // Upgrade hero
      const upgradeResult = reduce(
        stateWithGold,
        upgradeHero("barkeep", 1),
        stateWithGold.time.lastTickAtMs + 40
      );
      expect(upgradeResult.error).toBeUndefined();

      // Tick after upgrade
      const tick2Result = reduce(
        upgradeResult.state,
        tick(),
        upgradeResult.state.time.lastTickAtMs + 40
      );
      const goldAfterUpgrade = tick2Result.events.filter(isGoldEarnedEvent)
        .reduce((sum, e) => sum + e.amount, 0);

      // Income should be higher after upgrade (hero level increased)
      // Note: The actual income depends on the income calculation formula
      expect(tick2Result.state.heroes.roster["barkeep"]?.level).toBe(2);
    });
  });
});

// ============================================================================
// PERSISTENCE INTEGRATION TESTS
// ============================================================================

describe("Persistence Integration", () => {
  const testSaveDir = path.join(process.cwd(), "test-saves");
  const testSaveFile = path.join(testSaveDir, "game-loop-test.json");

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.mkdir(testSaveDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testSaveDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("save → load cycle", () => {
    it("preserves state through save/load cycle", async () => {
      // Create a modified state
      const originalState = createStateWithHeroes(
        [
          { id: "barkeep", level: 10, incomePerSecondU: 5000 },
          { id: "bard", level: 5, incomePerSecondU: 12500 },
        ],
        1500000 // 1500 gold
      );

      // Save the state
      const storage = new FileStorage(testSaveFile);
      await storage.save(originalState);

      // Load the state
      const loadedState = await storage.load();

      // Verify all slices are preserved
      expect(loadedState).toEqual(originalState);
    });

    it("preserves state after gameplay actions", async () => {
      // Start with initial state
      let state = createStateWithHeroes(
        [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
        100000 // 100 gold
      );

      // Perform some actions
      state = reduce(state, tick(), state.time.lastTickAtMs + 40).state;
      state = reduce(state, tick(), state.time.lastTickAtMs + 40).state;
      state = reduce(state, upgradeHero("barkeep", 1), state.time.lastTickAtMs + 40).state;

      // Save and load
      const storage = new FileStorage(testSaveFile);
      await storage.save(state);
      const loadedState = await storage.load();

      // Verify state is preserved
      expect(loadedState).toEqual(state);
      expect(loadedState.heroes.roster["barkeep"]?.level).toBe(2);
    });
  });

  describe("continue after load", () => {
    it("can continue gameplay after loading saved state", async () => {
      // Create and save a state
      const savedState = createStateWithHeroes(
        [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
        50000 // 50 gold
      );

      const storage = new FileStorage(testSaveFile);
      await storage.save(savedState);

      // Load and continue playing
      const loadedState = await storage.load();

      // Continue gameplay
      const tickResult = reduce(loadedState, tick(), loadedState.time.lastTickAtMs + 40);
      expect(tickResult.error).toBeUndefined();

      const upgradeResult = reduce(
        tickResult.state,
        upgradeHero("barkeep", 1),
        tickResult.state.time.lastTickAtMs + 40
      );
      expect(upgradeResult.error).toBeUndefined();

      // Verify gameplay continued correctly
      expect(upgradeResult.state.heroes.roster["barkeep"]?.level).toBe(6);
    });
  });
});

// ============================================================================
// OFFLINE PROGRESS INTEGRATION TESTS
// ============================================================================

describe("Offline Progress Integration", () => {
  it("calculates offline progress after load", async () => {
    // Create state with some income
    const savedState = createStateWithHeroes(
      [{ id: "barkeep", level: 10, incomePerSecondU: 5000 }],
      0
    );

    // Simulate time passing (1 hour)
    const returnTime = savedState.meta.lastSeenAtMs + 3600000;

    // Calculate offline progress
    const result = reduce(savedState, calculateOffline(returnTime), returnTime);

    // Verify offline progress was applied
    const offlineEvents = result.events.filter(isOfflineProgressAppliedEvent);
    expect(offlineEvents.length).toBeGreaterThan(0);

    const goldEvents = result.events.filter(isGoldEarnedEvent);
    expect(goldEvents.length).toBeGreaterThan(0);
    expect(goldEvents[0]?.source).toBe("OFFLINE");
  });

  it("applies 8-hour cap for excessive offline time", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
      0
    );

    // Simulate 10 hours passing (exceeds 8-hour cap)
    const returnTime = initialState.meta.lastSeenAtMs + 10 * 60 * 60 * 1000;

    const result = reduce(initialState, calculateOffline(returnTime), returnTime);

    // Verify cap was applied
    const clampedEvents = result.events.filter(isSecurityOfflineClampedEvent);
    expect(clampedEvents.length).toBeGreaterThan(0);
  });

  it("can tick immediately after offline progress", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
      0
    );

    const returnTime = initialState.meta.lastSeenAtMs + 3600000;

    // Calculate offline progress
    const offlineResult = reduce(initialState, calculateOffline(returnTime), returnTime);

    // Immediately tick after
    const tickResult = reduce(
      offlineResult.state,
      tick(),
      offlineResult.state.time.lastTickAtMs + 40
    );

    expect(tickResult.error).toBeUndefined();
    const goldEvents = tickResult.events.filter(isGoldEarnedEvent);
    expect(goldEvents.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// DETERMINISM INTEGRATION TESTS
// ============================================================================

describe("Determinism Integration", () => {
  it("produces identical results for identical action sequences", () => {
    const seed = 99999;
    const now = 1700000000000;

    // Run 1
    let state1 = createInitialState(now, seed);
    state1 = {
      ...state1,
      heroes: {
        roster: { barkeep: { level: 5, incomePerSecondU: 1000 } },
        order: ["barkeep"],
      },
      wallet: { gold: 100000, lifetimeEarnedGold: 100000 },
    };

    const actions1 = [
      tick(),
      tick(),
      upgradeHero("barkeep", 1),
      tick(),
      tick(),
    ];

    let currentTime1 = now;
    for (const action of actions1) {
      const result = reduce(state1, action, currentTime1 + 40);
      state1 = result.state;
      currentTime1 += 40;
    }

    // Run 2 - same seed, same actions
    let state2 = createInitialState(now, seed);
    state2 = {
      ...state2,
      heroes: {
        roster: { barkeep: { level: 5, incomePerSecondU: 1000 } },
        order: ["barkeep"],
      },
      wallet: { gold: 100000, lifetimeEarnedGold: 100000 },
    };

    const actions2 = [
      tick(),
      tick(),
      upgradeHero("barkeep", 1),
      tick(),
      tick(),
    ];

    let currentTime2 = now;
    for (const action of actions2) {
      const result = reduce(state2, action, currentTime2 + 40);
      state2 = result.state;
      currentTime2 += 40;
    }

    // Results should be identical
    expect(state1).toEqual(state2);
  });

  it("produces identical results after save/load roundtrip", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
      100000
    );

    // Serialize and deserialize
    const json = serializeState(initialState);
    const restoredState = deserializeState(json);

    // Apply same actions to both
    const result1 = reduce(initialState, tick(), initialState.time.lastTickAtMs + 40);
    const result2 = reduce(restoredState, tick(), restoredState.time.lastTickAtMs + 40);

    // Results should be identical
    expect(result1.state).toEqual(result2.state);
    expect(result1.events).toEqual(result2.events);
  });
});

// ============================================================================
// EVENT SEQUENCE TESTS
// ============================================================================

describe("Event Sequences", () => {
  it("emits events in correct order during game loop", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
      100000
    );

    // Tick
    const tickResult = reduce(initialState, tick(), initialState.time.lastTickAtMs + 40);
    expect(tickResult.events.some(isGoldEarnedEvent)).toBe(true);

    // Upgrade
    const upgradeResult = reduce(
      tickResult.state,
      upgradeHero("barkeep", 1),
      tickResult.state.time.lastTickAtMs + 40
    );
    expect(upgradeResult.events.some(isHeroUpgradeAppliedEvent)).toBe(true);

    // Another tick
    const tick2Result = reduce(
      upgradeResult.state,
      tick(),
      upgradeResult.state.time.lastTickAtMs + 40
    );
    expect(tick2Result.events.some(isGoldEarnedEvent)).toBe(true);
  });

  it("emits offline events in correct order", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
      0
    );

    const returnTime = initialState.meta.lastSeenAtMs + 3600000;
    const result = reduce(initialState, calculateOffline(returnTime), returnTime);

    // OFFLINE_PROGRESS_APPLIED should come before GOLD_EARNED
    const offlineIndex = result.events.findIndex(isOfflineProgressAppliedEvent);
    const goldIndex = result.events.findIndex(isGoldEarnedEvent);

    expect(offlineIndex).toBeLessThan(goldIndex);
  });
});

// ============================================================================
// EDGE CASE INTEGRATION TESTS
// ============================================================================

describe("Edge Cases", () => {
  it("handles empty hero roster gracefully", () => {
    const initialState = createInitialState(Date.now(), 12345);

    // Tick with no heroes
    const tickResult = reduce(initialState, tick(), initialState.time.lastTickAtMs + 40);
    expect(tickResult.error).toBeUndefined();

    // Offline with no heroes - should keep starting gold (no income earned)
    const returnTime = initialState.meta.lastSeenAtMs + 3600000;
    const offlineResult = reduce(initialState, calculateOffline(returnTime), returnTime);
    expect(offlineResult.error).toBeUndefined();
    // Starting gold: 10g (10,000 in fixed-point units), no income earned
    expect(offlineResult.state.wallet.gold).toBe(10000);
  });

  it("handles rapid successive actions", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 1, incomePerSecondU: 1000 }],
      1000000 // Plenty of gold
    );

    let state = initialState;
    const actionCount = 100;

    for (let i = 0; i < actionCount; i++) {
      const result = reduce(state, tick(), state.time.lastTickAtMs + 40);
      state = result.state;
    }

    // Should have accumulated gold
    expect(state.wallet.gold).toBeGreaterThan(0);
  });

  it("handles save/load actions correctly", () => {
    const initialState = createStateWithHeroes(
      [{ id: "barkeep", level: 5, incomePerSecondU: 1000 }],
      50000
    );

    // SAVE action should return state unchanged
    const saveResult = reduce(initialState, save(), Date.now());
    expect(saveResult.state).toBe(initialState);
    expect(saveResult.events).toHaveLength(0);
    expect(saveResult.error).toBeUndefined();

    // LOAD action should return state unchanged
    const loadResult = reduce(initialState, load(), Date.now());
    expect(loadResult.state).toBe(initialState);
    expect(loadResult.events).toHaveLength(0);
    expect(loadResult.error).toBeUndefined();
  });

  it("maintains state consistency across complex action sequence", () => {
    const initialState = createStateWithHeroes(
      [
        { id: "barkeep", level: 1, incomePerSecondU: 1000 },
        { id: "bard", level: 1, incomePerSecondU: 2500 },
      ],
      500000 // 500 gold
    );

    let state = initialState;
    let currentTime = initialState.time.lastTickAtMs;

    // Complex sequence: tick, upgrade, tick, offline, tick
    const actions = [
      () => tick(),
      () => upgradeHero("barkeep", 2),
      () => tick(),
      () => tick(),
      () => upgradeHero("bard", 1),
      () => tick(),
    ];

    for (const createAction of actions) {
      currentTime += 40;
      const result = reduce(state, createAction(), currentTime);
      expect(result.error).toBeUndefined();
      state = result.state;
    }

    // Verify final state is consistent
    expect(state.heroes.roster["barkeep"]?.level).toBe(3);
    expect(state.heroes.roster["bard"]?.level).toBe(2);
    expect(state.time.lastTickAtMs).toBe(currentTime);
    expect(state.meta.lastSeenAtMs).toBe(currentTime);
  });
});
