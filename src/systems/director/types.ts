/**
 * Director System Types (Stub)
 *
 * Will be expanded in Chunk 3
 */
export type VisitorType = 'patron' | 'adventurer' | 'merchant' | 'noble';

export interface Visitor {
  readonly id: string;
  readonly type: VisitorType;
  readonly arrivedAt: number;
}

export interface DirectorState {
  readonly visitors: readonly Visitor[];
  readonly spawnTimer: number;
  readonly nextVisitorId: number;
}

export const emptyDirectorState = (): DirectorState => ({
  visitors: [],
  spawnTimer: 0,
  nextVisitorId: 1,
});
