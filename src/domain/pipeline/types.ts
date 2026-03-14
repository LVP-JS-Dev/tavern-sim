/**
 * Tick Pipeline Types
 *
 * Defines the plugin architecture for game tick processing.
 * Each plugin is a pure function that transforms state and emits events.
 */
import type { GameState, DomainEvent } from '../../types';
import type { RngService } from '../../core/rng';

/** Immutable tick context passed through pipeline */
export interface TickContext {
  readonly state: GameState;
  readonly rng: RngService;
  readonly now: number;
  readonly accumulatedEvents: readonly DomainEvent[];
}

/** Result returned by each plugin (immutable pattern) */
export interface TickResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
}

/** Plugin order constants (pipeline stages) */
export const PLUGIN_ORDER = {
  TIMERS: 100,
  COMMANDS: 200,
  DIRECTOR: 300,
  HEROES: 400,
  ADVENTURES: 500,
  WORLD: 600,
  FLUSH: 700,
  TICK_INDEX: 800,
} as const;

/** A single plugin in the tick pipeline */
export interface TickPlugin {
  readonly name: string;
  readonly order: number;
  /** Returns updated state and new events (immutable pattern) */
  process(ctx: TickContext): TickResult;
}

/** The tick pipeline that processes all plugins in order */
export interface TickPipeline {
  readonly plugins: readonly TickPlugin[];
  /** Process all plugins in order, returns final state and all events */
  process(ctx: TickContext): TickResult;
}
