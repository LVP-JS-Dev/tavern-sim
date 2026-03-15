/**
 * Director Pipeline Plugin
 *
 * Processes visitor spawning and lifecycle for the tavern.
 * Integrates with the Director system.
 *
 * @module domain/pipeline/plugins/director
 */

import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { DirectorServiceImpl } from '../../../systems/director/service';
import type { DirectorState } from '../../../systems/director/types';

/**
 * Director plugin - handles visitor spawning and departures.
 *
 * This plugin:
 * 1. Checks for departing visitors (stayed too long)
 * 2. Attempts to spawn new visitors
 * 3. Updates director state with changes
 */
export const directorPlugin: TickPlugin = {
  name: 'director',
  order: PLUGIN_ORDER.DIRECTOR,

  process(ctx: TickContext): TickResult {
    const { state, rng, now } = ctx;

    // Skip if director system not initialized
    if (!state.director) {
      return { state, events: [] };
    }

    const service = new DirectorServiceImpl();

    // Process director update
    const result = service.update({
      state,
      rng,
      now,
    });

    // If no changes, return unchanged state
    if (result.visitorsSpawned.length === 0 && result.visitorsDeparted.length === 0) {
      return { state, events: [] };
    }

    // Update director state
    let newVisitors = [...state.director.visitors];

    // Remove departed visitors
    if (result.visitorsDeparted.length > 0) {
      newVisitors = newVisitors.filter(
        v => !result.visitorsDeparted.includes(v.id)
      );
    }

    // Add spawned visitors
    if (result.visitorsSpawned.length > 0) {
      newVisitors.push(...result.visitorsSpawned);
    }

    // Update next visitor ID
    const maxId = newVisitors.reduce(
      (max, v) => {
        const idNum = parseInt(v.id.split('-')[1] || '0', 10);
        return idNum > max ? idNum : max;
      },
      state.director.nextVisitorId - 1
    );

    const newDirectorState: DirectorState = {
      visitors: newVisitors,
      spawnTimer: Math.max(0, state.director.spawnTimer - 1),
      nextVisitorId: maxId + 1,
    };

    const newState = {
      ...state,
      director: newDirectorState,
    };

    return { state: newState, events: result.events };
  },
};
