// src/systems/world/constants.ts
import type { TimeOfDay, Weather, WorldEventType } from './types';

/** Ticks per time-of-day transition */
export const TICKS_PER_TOD = 10;

/** Weather change chance per tick */
export const WEATHER_CHANGE_CHANCE = 0.05;

/** Weather modifiers */
export const WEATHER_MODIFIERS: Record<Weather, { income: number; visitors: number; adventure: number }> = {
  clear: { income: 1.0, visitors: 1.0, adventure: 0 },
  cloudy: { income: 1.0, visitors: 0.95, adventure: 0 },
  rain: { income: 0.9, visitors: 0.8, adventure: -0.1 },
  storm: { income: 0.7, visitors: 0.5, adventure: -0.2 },
  snow: { income: 0.8, visitors: 0.7, adventure: -0.15 },
};

/** Event modifiers */
export const EVENT_MODIFIERS: Record<WorldEventType, { income: number; visitors: number; adventure: number }> = {
  festival: { income: 1.5, visitors: 2.0, adventure: 0 },
  plague: { income: 0.7, visitors: 0.3, adventure: -0.1 },
  drought: { income: 0.8, visitors: 0.9, adventure: 0 },
  war: { income: 1.2, visitors: 0.6, adventure: 0.2 },
  trade_route: { income: 1.3, visitors: 1.2, adventure: 0 },
};

/** Time of day progression */
export const TOD_ORDER: TimeOfDay[] = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'midnight'];

/** Weighted weather pool for random selection */
export const WEATHER_POOL: Weather[] = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'storm', 'snow'];
