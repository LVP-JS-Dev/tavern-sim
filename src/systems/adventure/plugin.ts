/**
 * Adventure Plugin Implementation
 *
 * Integrates the Adventure System with the Tick Pipeline.
 */
import type { TickPlugin, TickContext, TickResult } from '../../domain/pipeline/types';
import { PLUGIN_ORDER } from '../../domain/pipeline/types';
import { AdventureServiceImpl } from './service';
import type { AdventureState } from './types';

export class AdventurePluginImpl implements TickPlugin {
  readonly name = 'adventure';
  readonly order = PLUGIN_ORDER.ADVENTURES;

  private service = new AdventureServiceImpl();

  process(ctx: TickContext): TickResult {
    const { state } = ctx;
    let adventures = [...state.adventures.adventures];
    const events: import('../../types').DomainEvent[] = [];

    // Update progress for all adventures
    const updatedAdventures = this.service.updateProgress(ctx);

    // Check for completed adventures
    for (const adventure of updatedAdventures) {
      if (adventure.status === 'active' && adventure.progress >= 1.0) {
        const result = this.service.completeAdventure(
          { ...ctx, state: { ...state, adventures: { ...state.adventures, adventures: updatedAdventures } } },
          adventure.id
        );

        if (result) {
          const idx = adventures.findIndex(a => a.id === adventure.id);
          if (idx >= 0) {
            adventures[idx] = result.adventure;

            // Note: Adventure completion is tracked via status change
            // Domain events would be emitted by the reducer in a full implementation
          }
        }
      } else {
        const idx = adventures.findIndex(a => a.id === adventure.id);
        if (idx >= 0) {
          adventures[idx] = adventure;
        }
      }
    }

    const newAdventureState: AdventureState = {
      ...state.adventures,
      adventures,
    };

    return {
      state: {
        ...state,
        adventures: newAdventureState,
      },
      events,
    };
  }
}
