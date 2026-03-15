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
  readonly data: Record<string, unknown>;
}

export interface WorldState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: Weather;
  readonly dayNumber: number;
  readonly activeEvents: readonly WorldEvent[];
  readonly tickInDay: number;
}

export const emptyWorldState = (): WorldState => ({
  timeOfDay: 'dawn',
  weather: 'clear',
  dayNumber: 1,
  activeEvents: [],
  tickInDay: 0,
});

export interface WorldSlice {
  readonly world: WorldState;
}

export interface WorldContext {
  readonly state: WorldSlice;
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}

export interface WorldModifiers {
  readonly incomeMultiplier: number;
  readonly visitorSpawnRate: number;
  readonly adventureSuccessBonus: number;
}

export interface WorldUpdateResult {
  readonly state: WorldState;
  readonly events: readonly import('../../types/events').DomainEvent[];
}

export interface WorldService {
  update(ctx: WorldContext): WorldUpdateResult;
  getModifiers(state: WorldState): WorldModifiers;
  isEventActive(eventId: string, state: WorldState): boolean;
}
