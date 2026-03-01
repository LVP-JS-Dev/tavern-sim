/**
 * Tick Processing Module
 *
 * Provides the core simulation tick function that advances game state.
 * Follows a strict pipeline order for deterministic simulation.
 *
 * Pipeline order: timers → commands → director → heroes → adventures → world → flush → tickIndex++
 *
 * @module time/tick
 */

import { type GameState, type ReduceResult, type DomainEvent, success } from "../types";
import { TICK_MS, calculateIncomePerTick } from "../config/balance";
import { calculateTotalIncome } from "../economy/income";
import { goldEarned } from "../types/events";

// ============================================================================
// TICK PROCESSING RESULT TYPE
// ============================================================================

/**
 * Internal context for tick processing.
 * Tracks accumulated state changes and events during the pipeline.
 */
interface TickContext {
  /** Current state being mutated during pipeline */
  state: GameState;
  /** Accumulated events to emit */
  events: DomainEvent[];
  /** Current timestamp for the tick */
  now: number;
}

// ============================================================================
// PIPELINE STAGES
// ============================================================================

/**
 * Stage 1: Process timers.
 * Handles scheduled timers and time-based triggers.
 *
 * Note: For Alpha, this is a placeholder for future timer functionality.
 */
function processTimers(ctx: TickContext): void {
  // Placeholder for future timer processing
  // In future versions, this will handle:
  // - Scheduled events
  // - Delayed actions
  // - Periodic bonuses
}

/**
 * Stage 2: Process command queue.
 * Handles queued commands that need processing during tick.
 *
 * Note: For Alpha, this is a placeholder for future command queue functionality.
 */
function processCommands(ctx: TickContext): void {
  // Placeholder for future command queue processing
  // In future versions, this will handle:
  // - Queued player actions
  // - Deferred commands
  // - Action replay
}

/**
 * Stage 3: Director update.
 * Handles visitor spawns and director-controlled events.
 *
 * Note: For Alpha, this is optional - visitor system not implemented.
 */
function processDirector(ctx: TickContext): void {
  // Placeholder for future director system
  // In future versions, this will handle:
  // - Visitor spawning
  // - Special events
  // - Narrative triggers
}

/**
 * Stage 4: Heroes update.
 * Processes hero-related state changes including income generation.
 *
 * This is the core income generation step:
 * 1. Calculate total income per second from all heroes
 * 2. Convert to income per tick
 * 3. Add gold to wallet and lifetime earnings
 * 4. Emit GOLD_EARNED event
 */
function processHeroes(ctx: TickContext): void {
  const { state, events, now } = ctx;

  // Calculate total income from all heroes
  const incomePerSecondU = calculateTotalIncome(state.heroes.roster);

  // If no income (no heroes or all at level 0), skip
  if (incomePerSecondU <= 0) {
    return;
  }

  // Calculate income for this tick
  const incomeThisTick = calculateIncomePerTick(incomePerSecondU);

  // Update wallet with earned gold
  ctx.state = {
    ...state,
    wallet: {
      ...state.wallet,
      gold: state.wallet.gold + incomeThisTick,
      lifetimeEarnedGold: state.wallet.lifetimeEarnedGold + incomeThisTick,
    },
  };

  // Emit gold earned event
  events.push(goldEarned(incomeThisTick, "TICK", now));
}

/**
 * Stage 5: Adventures update.
 * Processes ongoing adventures and their outcomes.
 *
 * Note: For Alpha, this is optional - adventure system not implemented.
 */
function processAdventures(ctx: TickContext): void {
  // Placeholder for future adventure system
  // In future versions, this will handle:
  // - Adventure progress
  // - Random encounters
  // - Loot drops
}

/**
 * Stage 6: World update.
 * Processes global world state changes.
 *
 * Note: For Alpha, this is optional - world system not implemented.
 */
function processWorld(ctx: TickContext): void {
  // Placeholder for future world system
  // In future versions, this will handle:
  // - Weather changes
  // - Day/night cycle
  // - Global events
}

/**
 * Stage 7: Flush events.
 * Finalizes any pending events before tick completion.
 *
 * Note: Events are already accumulated in ctx.events, so this is a no-op for Alpha.
 */
function flushEvents(ctx: TickContext): void {
  // Events are already accumulated in the events array
  // This stage exists for future event batching/optimization
}

/**
 * Stage 8: Increment tick index.
 * Updates the lastTickAtMs timestamp to mark tick completion.
 */
function incrementTickIndex(ctx: TickContext): void {
  ctx.state = {
    ...ctx.state,
    time: {
      ...ctx.state.time,
      lastTickAtMs: ctx.now,
    },
    meta: {
      ...ctx.state.meta,
      lastSeenAtMs: ctx.now,
    },
  };
}

// ============================================================================
// MAIN TICK PROCESSING FUNCTION
// ============================================================================

/**
 * Processes a single simulation tick, advancing the game state.
 *
 * The tick follows a strict pipeline order for deterministic simulation:
 * 1. timers - Process scheduled timers
 * 2. commands - Process command queue
 * 3. director - Director update (visitor spawns)
 * 4. heroes - Heroes update (income generation)
 * 5. adventures - Adventures update
 * 6. world - World update
 * 7. flush - Flush accumulated events
 * 8. tickIndex++ - Update lastTickAtMs timestamp
 *
 * For Alpha version, the primary functionality is:
 * - Hero income generation (Stage 4)
 * - Timestamp updates (Stage 8)
 *
 * @param state - Current game state (will not be mutated)
 * @param now - Current Unix timestamp in milliseconds
 * @returns ReduceResult with new state and any emitted events
 *
 * @example
 * // Process a tick with current timestamp
 * const state = createInitialState(Date.now(), 12345);
 * const result = processTick(state, Date.now());
 * // result.events may contain GOLD_EARNED events
 * // result.state.time.lastTickAtMs is updated
 *
 * @example
 * // Multiple ticks accumulate income
 * const state = createInitialState(Date.now(), 12345);
 * // Add a hero with income
 * const stateWithHero = {
 *   ...state,
 *   heroes: {
 *     roster: {
 *       barkeep: { level: 1, incomePerSecondU: 1000 }
 *     },
 *     order: ['barkeep']
 *   }
 * };
 *
 * let result = processTick(stateWithHero, Date.now());
 * // Each tick earns: floor(1000 * 40 / 1000) = 40 gold (0.04 gold display)
 *
 * // Process multiple ticks
 * for (let i = 0; i < 25; i++) {
 *   result = processTick(result.state, Date.now() + (i + 1) * TICK_MS);
 * }
 * // After 25 ticks (1 second), total earned: 25 * 40 = 1000 gold (1 gold display)
 */
export function processTick(state: GameState, now: number): ReduceResult {
  // Initialize tick context
  const ctx: TickContext = {
    state,
    events: [],
    now,
  };

  // Execute pipeline stages in strict order
  // 1. Process timers
  processTimers(ctx);

  // 2. Process command queue
  processCommands(ctx);

  // 3. Director update (visitor spawns - optional for alpha)
  processDirector(ctx);

  // 4. Heroes update (income generation)
  processHeroes(ctx);

  // 5. Adventures update (optional for alpha)
  processAdventures(ctx);

  // 6. World update (optional for alpha)
  processWorld(ctx);

  // 7. Flush events
  flushEvents(ctx);

  // 8. Increment tick index (update timestamps)
  incrementTickIndex(ctx);

  // Return result with new state and accumulated events
  return success(ctx.state, ctx.events);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates how many ticks would occur in a given time delta.
 *
 * @param deltaMs - Time delta in milliseconds
 * @returns Number of ticks that would occur
 *
 * @example
 * // 1 second at 40ms per tick
 * calculateTickCount(1000); // 25 ticks
 *
 * // 1 minute
 * calculateTickCount(60000); // 1500 ticks
 */
export function calculateTickCount(deltaMs: number): number {
  return Math.floor(deltaMs / TICK_MS);
}

/**
 * Calculates the total time for a given number of ticks.
 *
 * @param ticks - Number of ticks
 * @returns Total time in milliseconds
 *
 * @example
 * // 25 ticks at 40ms per tick
 * calculateTotalTime(25); // 1000ms (1 second)
 */
export function calculateTotalTime(ticks: number): number {
  return ticks * TICK_MS;
}
