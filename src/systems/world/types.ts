/**
 * World System Types (Stub)
 *
 * Will be expanded in Chunk 7
 */
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';
export type WorldEventType = 'festival' | 'plague' | 'drought' | 'war' | 'trade_route';

export interface WorldEvent {
  readonly id: string;
  readonly type: WorldEventType;
  readonly startedAt: number;
  readonly duration: number;
  readonly data: Record<string, unknown>;
}

export interface WorldState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: Weather;
  readonly dayNumber: number;
  readonly activeEvents: readonly WorldEvent[];
}

export const emptyWorldState = (): WorldState => ({
  timeOfDay: 'dawn',
  weather: 'clear',
  dayNumber: 1,
  activeEvents: [],
});
