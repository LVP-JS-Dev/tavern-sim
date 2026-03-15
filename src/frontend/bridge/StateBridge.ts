import type { GameState, DomainEvent, Action } from '../../types';
import type { StateBridge, BridgeConfig, StorageAdapter } from './types';
import { reduce } from '../../reducer';
import { tick } from '../../types/actions';

/**
 * Creates a StateBridge that connects Phaser to the game simulation.
 *
 * The bridge manages:
 * - Game state and state updates
 * - Subscription system for UI updates
 * - Event system for toasts and VFX
 * - Auto-save at configured intervals
 * - Action dispatch and tick processing
 *
 * @param config - Bridge configuration
 * @returns StateBridge instance
 */
export function createStateBridge(config: BridgeConfig): StateBridge {
  const { initialState, storage, autoSaveInterval = 5000 } = config;

  // Current game state
  let state: GameState = initialState;

  // Subscribers for state changes
  const stateSubscribers: Set<(state: GameState) => void> = new Set();

  // Subscribers for domain events
  const eventSubscribers: Set<(event: DomainEvent) => void> = new Set();

  // Auto-save interval reference
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Notify all state subscribers of a state change.
   */
  function notifyStateSubscribers(): void {
    stateSubscribers.forEach((fn) => {
      try {
        fn(state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  /**
   * Notify all event subscribers of domain events.
   */
  function notifyEventSubscribers(events: readonly DomainEvent[]): void {
    events.forEach((event) => {
      eventSubscribers.forEach((fn) => {
        try {
          fn(event);
        } catch (error) {
          console.error('Error in event subscriber:', error);
        }
      });
    });
  }

  /**
   * Start auto-save timer.
   */
  function startAutoSave(): void {
    if (autoSaveTimer !== null) {
      clearInterval(autoSaveTimer);
    }

    autoSaveTimer = setInterval(() => {
      try {
        storage.save(state);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, autoSaveInterval);
  }

  // Start auto-save on bridge creation
  startAutoSave();

  // Return the StateBridge implementation
  return {
    subscribe(fn: (state: GameState) => void): () => void {
      stateSubscribers.add(fn);
      return () => {
        stateSubscribers.delete(fn);
      };
    },

    subscribeToEvents(fn: (event: DomainEvent) => void): () => void {
      eventSubscribers.add(fn);
      return () => {
        eventSubscribers.delete(fn);
      };
    },

    dispatch(action: Action): void {
      const now = Date.now();
      const result = reduce(state, action, now);

      // Update state
      state = result.state;

      // Notify subscribers
      notifyStateSubscribers();

      // Emit events
      notifyEventSubscribers(result.events);
    },

    getState(): GameState {
      return state;
    },

    tick(): void {
      const now = Date.now();
      const result = reduce(state, tick(), now);

      // Update state
      state = result.state;

      // Notify subscribers
      notifyStateSubscribers();

      // Emit events
      notifyEventSubscribers(result.events);
    },
  };
}
