import type { GameState, DomainEvent, Action } from '../../types';
import type { StateBridge, BridgeConfig } from './types';
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

  // Action queue for next tick cycle
  let actionQueue: Action[] = [];

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
      actionQueue.push(action);
    },

    getState(): GameState {
      return state;
    },

    tick(): void {
      const now = Date.now();
      let currentState = state;
      const allEvents: DomainEvent[] = [];

      // Process queued actions first
      while (actionQueue.length > 0) {
        const action = actionQueue.shift()!;
        const result = reduce(currentState, action, now);
        currentState = result.state;
        allEvents.push(...result.events);
      }

      // Then process TICK
      const tickResult = reduce(currentState, tick(), now);
      state = tickResult.state;
      allEvents.push(...tickResult.events);

      // Notify subscribers
      notifyStateSubscribers();
      notifyEventSubscribers(allEvents);
    },

    destroy(): void {
      if (autoSaveTimer !== null) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
      }
      stateSubscribers.clear();
      eventSubscribers.clear();
      actionQueue = [];
    },
  };
}
