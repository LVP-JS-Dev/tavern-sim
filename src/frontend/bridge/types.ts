import type { GameState, DomainEvent } from '../../types';
import type { Action } from '../../types/actions';

/**
 * State Bridge interface for connecting Phaser to simulation.
 */
export interface StateBridge {
  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn: (state: GameState) => void): () => void;

  /** Subscribe to domain events (for toasts, VFX triggers). */
  subscribeToEvents(fn: (event: DomainEvent) => void): () => void;

  /** Dispatch user action to be processed immediately. */
  dispatch(action: Action): void;

  /** Get current state snapshot. */
  getState(): GameState;

  /** Force advance simulation by one tick. */
  tick(): void;
}

/**
 * Storage adapter interface for persistence.
 */
export interface StorageAdapter {
  /** Load saved state, returns null if not found */
  load(): GameState | null;

  /** Save current state */
  save(state: GameState): void;

  /** Clear saved state */
  clear(): void;
}

/**
 * Bridge configuration options.
 */
export interface BridgeConfig {
  /** Initial state (from storage or fresh) */
  initialState: GameState;

  /** Storage adapter for persistence */
  storage: StorageAdapter;

  /** Auto-save interval in ms (default: 5000) */
  autoSaveInterval?: number;
}
