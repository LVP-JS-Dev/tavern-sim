/**
 * Tick Pipeline Implementation
 *
 * Creates a pipeline that processes plugins in deterministic order.
 * Each plugin receives the state from the previous plugin.
 */
import type { DomainEvent } from '../../types';
import type { TickContext, TickPlugin, TickPipeline, TickResult } from './types';

/**
 * Creates a tick pipeline that processes plugins in order.
 * Each plugin receives the state from the previous plugin.
 */
export function createTickPipeline(plugins: TickPlugin[]): TickPipeline {
  // Sort plugins by order (ascending)
  const sorted = [...plugins].sort((a, b) => a.order - b.order);

  return {
    plugins: sorted,

    process: (ctx: TickContext): TickResult => {
      let currentState = ctx.state;
      let allEvents: DomainEvent[] = [...ctx.accumulatedEvents];

      for (const plugin of sorted) {
        const result = plugin.process({
          ...ctx,
          state: currentState,
          accumulatedEvents: allEvents,
        });
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }

      return { state: currentState, events: allEvents };
    },
  };
}
