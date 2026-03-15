// src/systems/personality/types.ts
export type TraitType = 'brave' | 'cautious' | 'greedy' | 'generous' | 'curious' | 'suspicious';

export interface TraitEffect {
  readonly type: 'income_modifier' | 'adventure_bonus' | 'corruption_resistance';
  readonly value: number;
}

export interface Trait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TraitType;
  readonly effects: readonly TraitEffect[];
  readonly corruptionWeight: number;
}

export interface PersonalityState {
  readonly traits: readonly string[];
  readonly corruption: number;
}

export const emptyPersonalityState = (): PersonalityState => ({
  traits: [],
  corruption: 0,
});

export interface PersonalitySlice {
  readonly heroPersonalities: Record<string, PersonalityState>;
}

export const emptyPersonalitySlice = (): PersonalitySlice => ({
  heroPersonalities: {},
});

export interface TraitEffectsResult {
  readonly incomeMultiplier: number;
  readonly adventureBonus: number;
  readonly corruptionResistance: number;
}

export interface PersonalityService {
  getTraits(): readonly Trait[];
  getTrait(id: string): Trait | undefined;
  getPersonality(heroId: string, slice: PersonalitySlice): PersonalityState;
  calculateCorruption(personality: PersonalityState, traits: readonly Trait[]): number;
  applyTraitEffects(personality: PersonalityState, traits: readonly Trait[]): TraitEffectsResult;
  canGainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): boolean;
  gainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): PersonalityState;
}
