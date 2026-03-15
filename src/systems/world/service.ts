// src/systems/world/service.ts
import type { WorldService, WorldContext, WorldState, WorldModifiers, WorldUpdateResult, Weather } from './types';
import { TICKS_PER_TOD, WEATHER_CHANGE_CHANCE, WEATHER_MODIFIERS, EVENT_MODIFIERS, TOD_ORDER, WEATHER_POOL } from './constants';

export class WorldServiceImpl implements WorldService {
  update(ctx: WorldContext): WorldUpdateResult {
    let state = ctx.state.world;
    const events: import('../../types/events').DomainEvent[] = [];
    const stream = ctx.rng.createStream('world');

    // Advance time
    const newTickInDay = state.tickInDay + 1;
    const todIndex = TOD_ORDER.indexOf(state.timeOfDay);
    const newTodIndex = Math.floor(newTickInDay / TICKS_PER_TOD) % TOD_ORDER.length;
    const newTimeOfDay = TOD_ORDER[newTodIndex];
    const newDayNumber = state.dayNumber + Math.floor(newTickInDay / (TICKS_PER_TOD * TOD_ORDER.length));

    // Weather change
    let newWeather = state.weather;
    if (stream.chance(WEATHER_CHANGE_CHANCE)) {
      newWeather = this.rollWeather(stream);
      if (newWeather !== state.weather) {
        events.push({
          type: 'WEATHER_CHANGED',
          from: state.weather,
          to: newWeather,
          timestamp: ctx.now,
        });
      }
    }

    state = {
      ...state,
      timeOfDay: newTimeOfDay,
      dayNumber: newDayNumber,
      tickInDay: newTickInDay % (TICKS_PER_TOD * TOD_ORDER.length),
      weather: newWeather,
    };

    return { state, events };
  }

  getModifiers(state: WorldState): WorldModifiers {
    const weatherMod = WEATHER_MODIFIERS[state.weather];

    let incomeMultiplier = weatherMod.income;
    let visitorSpawnRate = weatherMod.visitors;
    let adventureSuccessBonus = weatherMod.adventure;

    for (const event of state.activeEvents) {
      const eventMod = EVENT_MODIFIERS[event.type];
      if (eventMod) {
        incomeMultiplier *= eventMod.income;
        visitorSpawnRate *= eventMod.visitors;
        adventureSuccessBonus += eventMod.adventure;
      }
    }

    return { incomeMultiplier, visitorSpawnRate, adventureSuccessBonus };
  }

  isEventActive(eventId: string, state: WorldState): boolean {
    return state.activeEvents.some(e => e.id === eventId);
  }

  private rollWeather(stream: import('../../core/rng').RngStream): Weather {
    return stream.pick(WEATHER_POOL);
  }
}
