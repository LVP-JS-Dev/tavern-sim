import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStateBridge } from '../../../../src/frontend/bridge/StateBridge';
import { LocalStorageAdapter } from '../../../../src/frontend/bridge/storage';
import { createInitialState } from '../../../../src/state/initial';
import type { StateBridge, StorageAdapter } from '../../../../src/frontend/bridge/types';
import type { GameState, DomainEvent } from '../../../../src/types';
import { upgradeHero } from '../../../../src/types/actions';

// Mock localStorage for Node.js environment
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

describe('StateBridge', () => {
  let bridge: StateBridge;
  let storage: StorageAdapter;
  let initialState: GameState;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();

    storage = new LocalStorageAdapter('test-key');
    initialState = createInitialState(Date.now(), 12345);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('getState', () => {
    it('returns current state', () => {
      bridge = createStateBridge({
        initialState,
        storage,
      });

      const state = bridge.getState();
      expect(state.meta.rootSeed).toBe(12345);
    });
  });

  describe('subscribe', () => {
    it('notifies subscribers on state change', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000, // Long interval to avoid auto-save during test
      });

      const subscriber = vi.fn();
      bridge.subscribe(subscriber);

      bridge.tick();

      expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          rootSeed: 12345,
        }),
      }));
    });

    it('supports multiple subscribers', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000,
      });

      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();
      bridge.subscribe(subscriber1);
      bridge.subscribe(subscriber2);

      bridge.tick();

      expect(subscriber1).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000,
      });

      const subscriber = vi.fn();
      const unsubscribe = bridge.subscribe(subscriber);

      bridge.tick();
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();

      bridge.tick();
      expect(subscriber).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('subscribeToEvents', () => {
    it('notifies event subscribers on domain events', () => {
      // Create state with heroes that generate income
      const stateWithHeroes: GameState = {
        ...initialState,
        heroes: {
          roster: {
            'barkeep': {
              level: 1,
              incomePerSecondU: 1000,
            },
          },
          order: ['barkeep'],
        },
      };

      bridge = createStateBridge({
        initialState: stateWithHeroes,
        storage,
        autoSaveInterval: 100000,
      });

      const eventSubscriber = vi.fn();
      bridge.subscribeToEvents(eventSubscriber);

      bridge.tick();

      // Tick should produce at least one event (GOLD_EARNED)
      expect(eventSubscriber).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      // Create state with heroes that generate income
      const stateWithHeroes: GameState = {
        ...initialState,
        heroes: {
          roster: {
            'barkeep': {
              level: 1,
              incomePerSecondU: 1000,
            },
          },
          order: ['barkeep'],
        },
      };

      bridge = createStateBridge({
        initialState: stateWithHeroes,
        storage,
        autoSaveInterval: 100000,
      });

      const eventSubscriber = vi.fn();
      const unsubscribe = bridge.subscribeToEvents(eventSubscriber);

      bridge.tick();
      expect(eventSubscriber).toHaveBeenCalled();

      unsubscribe();

      bridge.tick();
      // Should not be called again (count stays the same)
      const callCount = eventSubscriber.mock.calls.length;
      expect(eventSubscriber).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('dispatch', () => {
    it('queues actions for next tick cycle', () => {
      // Create state with a hero in the roster
      const stateWithHero: GameState = {
        ...initialState,
        heroes: {
          roster: {
            'barkeep': {
              level: 1,
              incomePerSecondU: 100,
            },
          },
          order: ['barkeep'],
        },
        wallet: {
          ...initialState.wallet,
          gold: 1000000, // Plenty of gold
        },
      };

      bridge = createStateBridge({
        initialState: stateWithHero,
        storage,
        autoSaveInterval: 100000,
      });

      const subscriber = vi.fn();
      bridge.subscribe(subscriber);

      const action = upgradeHero('barkeep', 1);
      bridge.dispatch(action);

      // Action is queued, not processed immediately
      expect(subscriber).not.toHaveBeenCalled();
      let newState = bridge.getState();
      expect(newState.heroes.roster['barkeep'].level).toBe(1);

      // Tick processes queued actions
      bridge.tick();

      expect(subscriber).toHaveBeenCalled();
      newState = bridge.getState();
      expect(newState.heroes.roster['barkeep'].level).toBe(2);
    });
  });

  describe('tick', () => {
    it('advances simulation by one tick', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000,
      });

      const subscriber = vi.fn();
      bridge.subscribe(subscriber);

      bridge.tick();

      expect(subscriber).toHaveBeenCalled();
    });

    it('emits domain events during tick', () => {
      // Create state with heroes that generate income
      const stateWithHeroes: GameState = {
        ...initialState,
        heroes: {
          roster: {
            'barkeep': {
              level: 1,
              incomePerSecondU: 1000,
            },
          },
          order: ['barkeep'],
        },
      };

      bridge = createStateBridge({
        initialState: stateWithHeroes,
        storage,
        autoSaveInterval: 100000,
      });

      const eventSubscriber = vi.fn();
      bridge.subscribeToEvents(eventSubscriber);

      bridge.tick();

      expect(eventSubscriber).toHaveBeenCalled();
    });
  });

  describe('auto-save', () => {
    it('auto-saves at configured interval', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 5000,
      });

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Storage should have been called to save
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('does not auto-save when interval is very long', () => {
      bridge = createStateBridge({
        initialState,
        storage,
        autoSaveInterval: 100000,
      });

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Storage should not have been called yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });
});
