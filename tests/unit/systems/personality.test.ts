import { describe, it, expect } from 'vitest';
import type { PersonalityState, PersonalitySlice, Trait, TraitType } from '../../../src/systems/personality/types';

describe('Personality System Types', () => {
  describe('PersonalityState interface', () => {
    it('should have required fields', () => {
      const personality: PersonalityState = {
        traitIds: ['trait-1', 'trait-2'],
        corruption: 25,
      };

      expect(personality.traitIds).toEqual(['trait-1', 'trait-2']);
      expect(personality.corruption).toBe(25);
    });
  });

  describe('PersonalitySlice interface', () => {
    it('should have required fields', () => {
      const slice: PersonalitySlice = {
        heroes: {
          'hero-1': {
            traitIds: ['brave'],
            corruption: 0,
          },
        },
      };

      expect(slice.heroes['hero-1'].traitIds).toEqual(['brave']);
      expect(slice.heroes['hero-1'].corruption).toBe(0);
    });
  });

  describe('Trait interface', () => {
    it('should have required fields', () => {
      const trait: Trait = {
        id: 'brave',
        name: 'Brave',
        description: 'Never backs down from a challenge',
        type: 'brave',
      };

      expect(trait.id).toBe('brave');
      expect(trait.name).toBe('Brave');
      expect(trait.description).toBe('Never backs down from a challenge');
      expect(trait.type).toBe('brave');
    });
  });

  describe('TraitType type', () => {
    it('should include all trait types', () => {
      const traitTypes: TraitType[] = [
        'brave',
        'cautious',
        'greedy',
        'generous',
        'curious',
        'suspicious',
      ];

      expect(traitTypes).toHaveLength(6);
    });
  });
});
