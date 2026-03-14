/**
 * Adventure System Types (Stub)
 *
 * Will be expanded in Chunk 4-6
 */
export type AdventureType = 'hunt' | 'dungeon' | 'escort' | 'investigation';
export type AdventureStatus = 'preparing' | 'in_progress' | 'completed' | 'failed';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Adventure {
  readonly id: string;
  readonly type: AdventureType;
  readonly status: AdventureStatus;
  readonly heroIds: readonly string[];
  readonly startedAt: number;
  readonly duration: number;
  readonly progress: number;
  readonly difficulty: number;
  readonly rarity: Rarity;
}

export interface AdventureState {
  readonly adventures: readonly Adventure[];
  readonly nextAdventureId: number;
}

export const emptyAdventureState = (): AdventureState => ({
  adventures: [],
  nextAdventureId: 1,
});
