/**
 * Director System Types
 *
 * Manages visitor spawning and lifecycle for the tavern.
 */

/** Visitor types with different behaviors */
export type VisitorType = 'patron' | 'adventurer' | 'merchant' | 'noble';

/** A single visitor in the tavern */
export interface Visitor {
  readonly id: string;
  readonly type: VisitorType;
  readonly arrivedAt: number;
  readonly personality?: string;
  readonly order?: string;
}

/** Director system state */
export interface DirectorState {
  readonly visitors: readonly Visitor[];
  readonly spawnTimer: number;
  readonly nextVisitorId: number;
}

/** Empty state factory */
export const emptyDirectorState = (): DirectorState => ({
  visitors: [],
  spawnTimer: 0,
  nextVisitorId: 1,
});

/** Director context for service calls */
export interface DirectorContext {
  readonly state: import('../../types').GameState;
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}

/** Director update result */
export interface DirectorResult {
  readonly visitorsSpawned: readonly Visitor[];
  readonly visitorsDeparted: readonly string[];
  readonly events: readonly import('../../types').DomainEvent[];
}

/** Director service interface */
export interface DirectorService {
  /** Check if a new visitor can spawn */
  canSpawn(state: DirectorState, rosterSize: number): boolean;
  /** Process tick update for director system */
  update(ctx: DirectorContext): DirectorResult;
  /** Process visitor departure */
  processDeparture(visitorId: string, state: DirectorState): DirectorResult;
}
