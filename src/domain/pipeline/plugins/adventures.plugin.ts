/**
 * Adventures Pipeline Plugin
 *
 * Processes ongoing adventures and their progress.
 * Integrates with the Adventure system.
 *
 * @module domain/pipeline/plugins/adventures
 */

import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { AdventureServiceImpl } from '../../../systems/adventure/service';
import type { Adventure, AdventureState } from '../../../systems/adventure/types';

/**
 * Adventures plugin - handles adventure progress and completion.
 *
 * This plugin:
 * 1. Updates progress for all active adventures
 * 2. Completes adventures that have finished
 * 3. Generates loot for completed adventures
 */
export const adventuresPlugin: TickPlugin = {
  name: 'adventures',
  order: PLUGIN_ORDER.ADVENTURES,

  process(ctx: TickContext): TickResult {
    const { state, rng, now } = ctx;

    // Skip if adventure system not initialized
    if (!state.adventures) {
      return { state, events: [] };
    }

    const service = new AdventureServiceImpl();

    // Update progress for all adventures
    const updatedAdventures = service.updateProgress({
      state,
      rng,
      now,
    });

    // Find adventures that should complete
    const completedAdventures: Adventure[] = [];
    const activeAdventures: Adventure[] = [];

    for (const adventure of updatedAdventures) {
      if (adventure.status === 'in_progress' && adventure.progress >= 1.0) {
        completedAdventures.push(adventure);
      } else {
        activeAdventures.push(adventure);
      }
    }

    // If no changes, return unchanged state
    if (completedAdventures.length === 0) {
      return { state, events: [] };
    }

    // Complete adventures and collect loot
    const events: import('../../../types').DomainEvent[] = [];
    const finalAdventures = [...activeAdventures];

    for (const adventure of completedAdventures) {
      const result = service.completeAdventure(
        { state, rng, now },
        adventure.id
      );

      if (result) {
        finalAdventures.push(result.adventure);
        // Could emit adventure completed events here
      }
    }

    const newAdventureState: AdventureState = {
      adventures: finalAdventures,
      nextAdventureId: state.adventures.nextAdventureId,
    };

    const newState = {
      ...state,
      adventures: newAdventureState,
    };

    return { state: newState, events };
  },
};
