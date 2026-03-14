/**
 * Personality System Types (Stub)
 *
 * Will be expanded in Chunk 9
 */
export type TraitType = 'brave' | 'cautious' | 'greedy' | 'generous' | 'curious' | 'suspicious';

export interface Trait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TraitType;
}

export interface PersonalityState {
  readonly traitIds: readonly string[];
  readonly corruption: number; // 0-100
}

export const emptyPersonalityState = (): PersonalityState => ({
  traitIds: [],
  corruption: 0,
});

export interface PersonalitySlice {
  readonly heroes: Record<string, PersonalityState>;
}

export const emptyPersonalitySlice = (): PersonalitySlice => ({
  heroes: {},
});
