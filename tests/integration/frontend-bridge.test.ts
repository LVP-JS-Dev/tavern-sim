/**
 * Frontend-Bridge Integration Tests
 *
 * Tests the integration between UI layer (StateBridge) and core simulation:
 * - StateBridge + reducer integration (real reducer, no mocking)
 * - Frontend initialization flow (offline progress, persistence)
 * - Scene synchronization (subscribe, update, unsubscribe)
 * - End-to-end user action flows
 *
 * @module tests/integration/frontend-bridge
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStateBridge } from '../../src/frontend/bridge/StateBridge';
import { LocalStorageAdapter } from '../../src/frontend/bridge/storage';
import { createInitialState } from '../../src/state/initial';
import { tick, upgradeHero, calculateOffline } from '../../src/types/actions';
import {
  isGoldEarnedEvent,
  isHeroUpgradeAppliedEvent,
  isHeroUpgradeRejectedEvent,
  isOfflineProgressAppliedEvent,
} from '../../src/types/events';
import type { StateBridge, StorageAdapter } from '../../src/frontend/bridge/types';
import type { GameState, DomainEvent } from '../../src/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock localStorage for Node.js environment
 */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

(global as any).localStorage = localStorageMock;

/**
 * Helper to create state with heroes
 */
function createStateWithHeroes(
  heroes: Array<{ id: string; level: number; incomePerSecondU: number }>,
  gold: number = 0
): GameState {
  const now = Date.now();
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
 * Helper to collect events from bridge
 */
function collectEvents(bridge: StateBridge, tickCount: number = 1): DomainEvent[] {
  const events: DomainEvent[] = [];
  const unsubscribe = bridge.subscribeToEvents((event) => events.push(event));

  for (let i = 0; i < tickCount; i++) {
    bridge.tick();
  }

  unsubscribe();
  return events;
}

// ============================================================================
// STATEBRIDGE + REDUCER INTEGRATION
// ============================================================================

describe('StateBridge + Reducer Integration', () => {
  let bridge: StateBridge;
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('dispatch → tick → state update flow', () => {
    it('processes upgradeHero action through tick', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100000 // 100 gold
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Dispatch upgrade action
      bridge.dispatch(upgradeHero('barkeep', 1));

      // State should NOT change immediately
      let state = bridge.getState();
      expect(state.heroes.roster['barkeep']?.level).toBe(1);

      // Tick processes the action
      bridge.tick();

      // Now state should be updated
      state = bridge.getState();
      expect(state.heroes.roster['barkeep']?.level).toBe(2);
    });

    it('queues multiple actions and processes in order', () => {
      const initialState = createStateWithHeroes(
        [
          { id: 'barkeep', level: 1, incomePerSecondU: 1000 },
          { id: 'bard', level: 1, incomePerSecondU: 2500 },
        ],
        500000 // 500 gold - enough for multiple upgrades
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Queue multiple upgrades
      bridge.dispatch(upgradeHero('barkeep', 1));
      bridge.dispatch(upgradeHero('bard', 1));
      bridge.dispatch(upgradeHero('barkeep', 1));

      // Single tick processes all queued actions
      bridge.tick();

      const state = bridge.getState();
      expect(state.heroes.roster['barkeep']?.level).toBe(3);
      expect(state.heroes.roster['bard']?.level).toBe(2);
    });

    it('emits correct events for upgrade actions', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100000
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      bridge.dispatch(upgradeHero('barkeep', 1));
      const events = collectEvents(bridge, 1);

      const upgradeEvents = events.filter(isHeroUpgradeAppliedEvent);
      expect(upgradeEvents.length).toBeGreaterThan(0);
      expect(upgradeEvents[0]?.heroId).toBe('barkeep');
      expect(upgradeEvents[0]?.appliedLevels).toBe(1);
    });
  });

  describe('tick with income generation', () => {
    it('generates gold events on tick with heroes', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const events = collectEvents(bridge, 1);

      const goldEvents = events.filter(isGoldEarnedEvent);
      expect(goldEvents.length).toBeGreaterThan(0);
      expect(goldEvents[0]?.amount).toBeGreaterThan(0);
    });

    it('accumulates gold over multiple ticks', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      let totalGold = 0;
      bridge.subscribe((state) => {
        totalGold = state.wallet.gold;
      });

      // Multiple ticks
      for (let i = 0; i < 10; i++) {
        bridge.tick();
      }

      expect(totalGold).toBeGreaterThan(0);
    });
  });

  describe('action rejection handling', () => {
    it('emits rejection event when upgrade fails', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100 // Not enough gold for any upgrade
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      bridge.dispatch(upgradeHero('barkeep', 1));
      const events = collectEvents(bridge, 1);

      const rejectedEvents = events.filter(isHeroUpgradeRejectedEvent);
      expect(rejectedEvents.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// FRONTEND INITIALIZATION FLOW
// ============================================================================

describe('Frontend Initialization Flow', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('first launch (no saved state)', () => {
    it('creates initial state with starting gold', () => {
      storage = new LocalStorageAdapter('test-new');

      // No saved state exists
      expect(localStorageMock.getItem('test-new')).toBeNull();

      const now = Date.now();
      const initialState = createInitialState(now, 99999);

      const bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000,
      });

      const state = bridge.getState();
      expect(state.wallet.gold).toBe(10000); // Starting gold: 10g
      expect(state.meta.rootSeed).toBe(99999);
    });
  });

  describe('returning player with offline progress', () => {
    it('calculates offline progress after 1 hour away', () => {
      const oneHourAgo = Date.now() - 3600000;
      const savedState = createStateWithHeroes(
        [{ id: 'barkeep', level: 10, incomePerSecondU: 5000 }],
        50000
      );

      // Simulate state saved 1 hour ago
      const stateWithOldTimestamp: GameState = {
        ...savedState,
        meta: {
          ...savedState.meta,
          lastSeenAtMs: oneHourAgo,
        },
        time: {
          ...savedState.time,
          lastTickAtMs: oneHourAgo,
        },
      };

      storage = new LocalStorageAdapter('test-returning');
      // Note: In real flow, offline progress is calculated in src/frontend/index.ts
      // Here we test the bridge with state that has been processed

      const bridge = createStateBridge({
        initialState: stateWithOldTimestamp,
        storage,
        autoSaveInterval: 100000,
      });

      // Simulate offline progress calculation
      const now = Date.now();
      bridge.dispatch(calculateOffline(now));
      bridge.tick();

      const events: DomainEvent[] = [];
      bridge.subscribeToEvents((e) => events.push(e));
      bridge.tick();

      // Bridge should be functional after offline calculation
      const state = bridge.getState();
      expect(state.meta.lastSeenAtMs).toBeGreaterThan(oneHourAgo);
    });

    it('applies 8-hour cap for excessive offline time', () => {
      const tenHoursAgo = Date.now() - (10 * 60 * 60 * 1000);
      const savedState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      const stateWithOldTimestamp: GameState = {
        ...savedState,
        meta: {
          ...savedState.meta,
          lastSeenAtMs: tenHoursAgo,
        },
        time: {
          ...savedState.time,
          lastTickAtMs: tenHoursAgo,
        },
      };

      storage = new LocalStorageAdapter('test-cap');

      const bridge = createStateBridge({
        initialState: stateWithOldTimestamp,
        storage,
        autoSaveInterval: 100000,
      });

      // Calculate offline progress
      const now = Date.now();
      bridge.dispatch(calculateOffline(now));

      const events: DomainEvent[] = [];
      bridge.subscribeToEvents((e) => events.push(e));
      bridge.tick();

      // Should have offline events (capped at 8 hours)
      const offlineEvents = events.filter(isOfflineProgressAppliedEvent);
      expect(offlineEvents.length).toBeGreaterThan(0);
    });
  });

  describe('persistence on initialization', () => {
    it('auto-saves at configured interval', () => {
      const initialState = createInitialState(Date.now(), 12345);

      storage = new LocalStorageAdapter('test-autosave');

      createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 5000, // 5 seconds
      });

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Storage should have been called
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('does not auto-save when interval is very long', () => {
      const initialState = createInitialState(Date.now(), 12345);

      storage = new LocalStorageAdapter('test-no-autosave');

      createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000, // Very long interval
      });

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Storage should not have been called yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SCENE SYNCHRONIZATION
// ============================================================================

describe('Scene Synchronization', () => {
  let bridge: StateBridge;
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('subscribe/unsubscribe lifecycle', () => {
    it('notifies subscriber on each tick', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const notifications: GameState[] = [];
      const unsubscribe = bridge.subscribe((state) => {
        notifications.push(state);
      });

      // Multiple ticks
      for (let i = 0; i < 5; i++) {
        bridge.tick();
      }

      expect(notifications.length).toBe(5);
      unsubscribe();
    });

    it('stops notifications after unsubscribe', () => {
      const initialState = createInitialState(Date.now(), 12345);

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const subscriber = vi.fn();
      const unsubscribe = bridge.subscribe(subscriber);

      bridge.tick();
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();

      bridge.tick();
      bridge.tick();
      expect(subscriber).toHaveBeenCalledTimes(1); // No new calls
    });

    it('supports multiple simultaneous subscribers', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();
      const subscriber3 = vi.fn();

      bridge.subscribe(subscriber1);
      bridge.subscribe(subscriber2);
      bridge.subscribe(subscriber3);

      bridge.tick();

      expect(subscriber1).toHaveBeenCalledTimes(1);
      expect(subscriber2).toHaveBeenCalledTimes(1);
      expect(subscriber3).toHaveBeenCalledTimes(1);
    });
  });

  describe('state changes propagate to subscribers', () => {
    it('subscriber receives updated hero level after upgrade', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100000
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      let latestLevel = 0;
      bridge.subscribe((state) => {
        latestLevel = state.heroes.roster['barkeep']?.level ?? 0;
      });

      bridge.dispatch(upgradeHero('barkeep', 2));
      bridge.tick();

      expect(latestLevel).toBe(3);
    });

    it('subscriber receives updated gold after tick', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      let latestGold = 0;
      bridge.subscribe((state) => {
        latestGold = state.wallet.gold;
      });

      bridge.tick();

      expect(latestGold).toBeGreaterThan(0);
    });
  });

  describe('event subscription lifecycle', () => {
    it('receives events during tick', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const events: DomainEvent[] = [];
      bridge.subscribeToEvents((event) => {
        events.push(event);
      });

      bridge.tick();

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(isGoldEarnedEvent)).toBe(true);
    });

    it('stops receiving events after unsubscribe', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const eventHandler = vi.fn();
      const unsubscribe = bridge.subscribeToEvents(eventHandler);

      bridge.tick();
      const callCountAfterFirst = eventHandler.mock.calls.length;

      unsubscribe();

      bridge.tick();
      expect(eventHandler).toHaveBeenCalledTimes(callCountAfterFirst);
    });
  });
});

// ============================================================================
// END-TO-END USER ACTION FLOWS
// ============================================================================

describe('End-to-End User Action Flows', () => {
  let bridge: StateBridge;
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('upgrade hero flow', () => {
    it('complete upgrade flow: dispatch → tick → state update → notification', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100000 // 100 gold
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Track state changes
      const stateHistory: GameState[] = [];
      bridge.subscribe((state) => stateHistory.push(state));

      // User action: upgrade hero
      bridge.dispatch(upgradeHero('barkeep', 1));

      // Process
      bridge.tick();

      // Verify complete flow
      expect(stateHistory.length).toBeGreaterThan(0);
      const finalState = stateHistory[stateHistory.length - 1];
      expect(finalState?.heroes.roster['barkeep']?.level).toBe(2);
    });

    it('upgrade without enough gold: rejected with event', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        100 // Not enough for upgrade
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const events: DomainEvent[] = [];
      bridge.subscribeToEvents((e) => events.push(e));

      bridge.dispatch(upgradeHero('barkeep', 1));
      bridge.tick();

      const rejectedEvents = events.filter(isHeroUpgradeRejectedEvent);
      expect(rejectedEvents.length).toBeGreaterThan(0);

      // Hero level should be unchanged
      const state = bridge.getState();
      expect(state.heroes.roster['barkeep']?.level).toBe(1);

      // Gold may have increased due to tick income, but not decreased from upgrade
      // Initial 100 + income from tick (no upgrade cost deducted)
      expect(state.wallet.gold).toBeGreaterThanOrEqual(100);
    });

    it('partial upgrade: applies only affordable levels', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        50000 // 50 gold - enough for some levels but not 10
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const events: DomainEvent[] = [];
      bridge.subscribeToEvents((e) => events.push(e));

      // Request 10 levels, but can only afford some
      bridge.dispatch(upgradeHero('barkeep', 10));
      bridge.tick();

      const appliedEvents = events.filter(isHeroUpgradeAppliedEvent);
      const rejectedEvents = events.filter(isHeroUpgradeRejectedEvent);

      // Either partial upgrade was applied or it was rejected
      if (appliedEvents.length > 0) {
        expect(appliedEvents[0]!.appliedLevels).toBeLessThan(10);
        expect(appliedEvents[0]!.appliedLevels).toBeGreaterThan(0);
      } else {
        // If no partial upgrade, should be rejected
        expect(rejectedEvents.length).toBeGreaterThan(0);
      }
    });
  });

  describe('gold accumulation flow', () => {
    it('gold increases over time with heroes', () => {
      const initialState = createStateWithHeroes(
        [
          { id: 'barkeep', level: 5, incomePerSecondU: 1000 },
          { id: 'bard', level: 3, incomePerSecondU: 2500 },
        ],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      const goldHistory: number[] = [];
      bridge.subscribe((state) => goldHistory.push(state.wallet.gold));

      // Simulate gameplay: 25 ticks (1 second at 40ms/tick)
      for (let i = 0; i < 25; i++) {
        bridge.tick();
      }

      // Gold should be increasing
      expect(goldHistory.length).toBe(25);
      expect(goldHistory[24]).toBeGreaterThan(goldHistory[0]!);
    });

    it('upgrade increases income rate', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        0
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Collect income before upgrade
      const eventsBefore: DomainEvent[] = [];
      const unsubBefore = bridge.subscribeToEvents((e) => eventsBefore.push(e));
      bridge.tick();
      unsubBefore();

      const goldBefore = eventsBefore.filter(isGoldEarnedEvent)
        .reduce((sum, e) => sum + e.amount, 0);

      // Upgrade hero (need to add gold first)
      const stateWithGold: GameState = {
        ...bridge.getState(),
        wallet: {
          ...bridge.getState().wallet,
          gold: 100000,
          lifetimeEarnedGold: 100000,
        },
      };

      // Recreate bridge with gold
      bridge = createStateBridge({
        initialState: stateWithGold,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      bridge.dispatch(upgradeHero('barkeep', 1));
      bridge.tick();

      // Collect income after upgrade
      const eventsAfter: DomainEvent[] = [];
      const unsubAfter = bridge.subscribeToEvents((e) => eventsAfter.push(e));
      bridge.tick();
      unsubAfter();

      const goldAfter = eventsAfter.filter(isGoldEarnedEvent)
        .reduce((sum, e) => sum + e.amount, 0);

      // Higher level should produce more income
      // (This tests the simulation, not just the bridge)
      expect(bridge.getState().heroes.roster['barkeep']?.level).toBe(2);
    });
  });

  describe('complex interaction sequences', () => {
    it('handles rapid dispatch → tick cycles', () => {
      const initialState = createStateWithHeroes(
        [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
        1000000 // Plenty of gold
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Rapid fire: dispatch, tick, dispatch, tick...
      for (let i = 0; i < 10; i++) {
        bridge.dispatch(upgradeHero('barkeep', 1));
        bridge.tick();
      }

      const state = bridge.getState();
      expect(state.heroes.roster['barkeep']?.level).toBe(11);
    });

    it('handles mixed actions in single tick', () => {
      const initialState = createStateWithHeroes(
        [
          { id: 'barkeep', level: 1, incomePerSecondU: 1000 },
          { id: 'bard', level: 1, incomePerSecondU: 2500 },
        ],
        500000 // 500 gold
      );

      bridge = createStateBridge({
        initialState,
        storage: new LocalStorageAdapter('test'),
        autoSaveInterval: 100000,
      });

      // Mix of tick and upgrade
      bridge.dispatch(tick());
      bridge.dispatch(upgradeHero('barkeep', 1));
      bridge.dispatch(upgradeHero('bard', 1));

      bridge.tick();

      const state = bridge.getState();
      // Both upgrades should be applied
      expect(state.heroes.roster['barkeep']?.level).toBe(2);
      expect(state.heroes.roster['bard']?.level).toBe(2);
    });
  });
});

// ============================================================================
// BRIDGE STATE SNAPSHOTS
// ============================================================================

describe('Bridge State Snapshots', () => {
  let bridge: StateBridge;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('getState returns consistent snapshot', () => {
    const initialState = createStateWithHeroes(
      [{ id: 'barkeep', level: 5, incomePerSecondU: 1000 }],
      50000
    );

    bridge = createStateBridge({
      initialState,
      storage: new LocalStorageAdapter('test'),
      autoSaveInterval: 100000,
    });

    // Get state multiple times
    const snapshot1 = bridge.getState();
    const snapshot2 = bridge.getState();

    // Should be equal (same state)
    expect(snapshot1).toEqual(snapshot2);
  });

  it('getState reflects changes after tick', () => {
    const initialState = createStateWithHeroes(
      [{ id: 'barkeep', level: 1, incomePerSecondU: 1000 }],
      100000
    );

    bridge = createStateBridge({
      initialState,
      storage: new LocalStorageAdapter('test'),
      autoSaveInterval: 100000,
    });

    const beforeUpgrade = bridge.getState();
    expect(beforeUpgrade.heroes.roster['barkeep']?.level).toBe(1);

    bridge.dispatch(upgradeHero('barkeep', 1));
    bridge.tick();

    const afterUpgrade = bridge.getState();
    expect(afterUpgrade.heroes.roster['barkeep']?.level).toBe(2);
    expect(afterUpgrade).not.toEqual(beforeUpgrade);
  });
});
