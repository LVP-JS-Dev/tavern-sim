// src/systems/personality/service.ts
import type { PersonalityService, PersonalityState, PersonalitySlice, Trait, TraitEffectsResult } from './types';
import { ALL_TRAITS, MAX_TRAITS_PER_HERO } from './traits';

export class PersonalityServiceImpl implements PersonalityService {
  getTraits(): readonly Trait[] {
    return ALL_TRAITS;
  }

  getTrait(id: string): Trait | undefined {
    return ALL_TRAITS.find(t => t.id === id);
  }

  getPersonality(heroId: string, slice: PersonalitySlice): PersonalityState {
    return slice.heroPersonalities[heroId] ?? { traits: [], corruption: 0 };
  }

  calculateCorruption(personality: PersonalityState, traits: readonly Trait[]): number {
    let corruption = personality.corruption;

    for (const traitId of personality.traits) {
      const trait = traits.find(t => t.id === traitId);
      if (trait) {
        corruption += trait.corruptionWeight;
      }
    }

    return Math.min(1, Math.max(0, corruption));
  }

  applyTraitEffects(personality: PersonalityState, traits: readonly Trait[]): TraitEffectsResult {
    let incomeMultiplier = 1.0;
    let adventureBonus = 0;
    let corruptionResistance = 0;

    for (const traitId of personality.traits) {
      const trait = traits.find(t => t.id === traitId);
      if (!trait) continue;

      for (const effect of trait.effects) {
        switch (effect.type) {
          case 'income_modifier':
            incomeMultiplier += effect.value;
            break;
          case 'adventure_bonus':
            adventureBonus += effect.value;
            break;
          case 'corruption_resistance':
            corruptionResistance += effect.value;
            break;
        }
      }
    }

    return { incomeMultiplier, adventureBonus, corruptionResistance };
  }

  canGainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): boolean {
    if (personality.traits.includes(traitId)) return false;
    if (personality.traits.length >= MAX_TRAITS_PER_HERO) return false;
    if (!traits.find(t => t.id === traitId)) return false;
    return true;
  }

  gainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): PersonalityState {
    if (!this.canGainTrait(personality, traitId, traits)) {
      return personality;
    }

    const newTraits = [...personality.traits, traitId];
    const newCorruption = this.calculateCorruption({ ...personality, traits: newTraits }, traits);

    return {
      traits: newTraits,
      corruption: newCorruption,
    };
  }
}
