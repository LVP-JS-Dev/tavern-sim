/**
 * World Pipeline Plugin
 *
 * Processes global world state changes like time of day and weather.
 * Integrates with the World system.
 *
 * @module domain/pipeline/plugins/world
 */

import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import type { WorldState, TimeOfDay } from '../../../systems/world/types';

/** Time of day progression order */
const TIME_ORDER: TimeOfDay[] = [
  'dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'midnight'
];

/** Ticks per time phase (roughly 4 minutes per phase at 40ms/tick = 6000 ticks) */
const TICKS_PER_PHASE = 6000;

/**
 * World plugin - handles time progression and weather changes.
 *
 * This plugin:
 * 1. Updates time of day based on tick count
 * 2. Potentially changes weather (rare)
 * 3. Processes active world events
 */
export const worldPlugin: TickPlugin = {
  name: 'world',
  order: PLUGIN_ORDER.WORLD,

  process(ctx: TickContext): TickResult {
    const { state, rng, now } = ctx;

    // Skip if world system not initialized
    if (!state.world) {
      return { state, events: [] };
    }

    const stream = rng.createStream('world');

    // Calculate current time phase based on creation time
    const elapsedMs = now - state.meta.createdAtMs;
    const totalTicks = Math.floor(elapsedMs / 40); // TICK_MS = 40
    const phaseIndex = Math.floor(totalTicks / TICKS_PER_PHASE) % TIME_ORDER.length;
    const newTimeOfDay = TIME_ORDER[phaseIndex] || 'dawn';

    // Check for weather change (very rare - 0.1% chance per tick)
    let newWeather = state.world.weather;
    if (stream.chance(0.001)) {
      const weathers: WorldState['weather'][] = ['clear', 'cloudy', 'rain'];
      newWeather = stream.pick(weathers);
    }

    // If no changes, return unchanged state
    if (newTimeOfDay === state.world.timeOfDay && newWeather === state.world.weather) {
      return { state, events: [] };
    }

    const newWorldState: WorldState = {
      ...state.world,
      timeOfDay: newTimeOfDay,
      weather: newWeather,
    };

    const newState = {
      ...state,
      world: newWorldState,
    };

    return { state: newState, events: [] };
  },
};
