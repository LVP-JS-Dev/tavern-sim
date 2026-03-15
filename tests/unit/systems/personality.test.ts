// tests/unit/systems/personality.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalityServiceImpl } from '../../../src/systems/personality/service';
import type { PersonalityService, PersonalityState, TraitEffectsResult } from '../../../src/systems/personality/types';
import { emptyPersonalityState, ALL_TRAITS } from '../../../src/systems/personality';

describe('PersonalitySystem', () => {
  let service: PersonalityService;

  beforeEach(() => {
    service = new PersonalityServiceImpl();
  });

  describe('getTraits', () => {
    it('returns all available traits', () => {
      const traits = service.getTraits();

      expect(traits.length).toBeGreaterThan(0);
      expect(traits[0]).toHaveProperty('id');
      expect(traits[0]).toHaveProperty('name');
      expect(traits[0]).toHaveProperty('effects');
    });
  });

  describe('getTrait', () => {
    it('returns trait by id', () => {
      const trait = service.getTrait('brave');

      expect(trait).toBeDefined();
      expect(trait?.name).toBe('Brave');
    });

    it('returns undefined for unknown trait', () => {
      const trait = service.getTrait('unknown');

      expect(trait).toBeUndefined();
    });
  });

  describe('getPersonality', () => {
    it('returns empty state for unknown hero', () => {
      const slice = { heroPersonalities: {} };

      const personality = service.getPersonality('unknown-hero', slice);

      expect(personality.traits).toEqual([]);
      expect(personality.corruption).toBe(0);
    });

    it('returns existing personality', () => {
      const existing: PersonalityState = { traits: ['brave'], corruption: 0.2 };
      const slice = { heroPersonalities: { 'hero-1': existing } };

      const personality = service.getPersonality('hero-1', slice);

      expect(personality).toEqual(existing);
    });
  });

  describe('calculateCorruption', () => {
    it('returns 0 for empty traits', () => {
      const personality = emptyPersonalityState();

      const corruption = service.calculateCorruption(personality, ALL_TRAITS);

      expect(corruption).toBe(0);
    });

    it('increases corruption based on trait weights', () => {
      const personality: PersonalityState = { traits: ['greedy', 'suspicious'], corruption: 0 };

      const corruption = service.calculateCorruption(personality, ALL_TRAITS);

      expect(corruption).toBeGreaterThan(0);
    });
  });

  describe('applyTraitEffects', () => {
    it('combines effects from multiple traits', () => {
      const personality: PersonalityState = { traits: ['brave', 'generous'], corruption: 0 };

      const effects = service.applyTraitEffects(personality, ALL_TRAITS);

      expect(effects.incomeMultiplier).toBeDefined();
      expect(effects.adventureBonus).toBeDefined();
      expect(effects.corruptionResistance).toBeDefined();
    });
  });

  describe('canGainTrait', () => {
    it('returns false if already has trait', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const canGain = service.canGainTrait(personality, 'brave', ALL_TRAITS);

      expect(canGain).toBe(false);
    });

    it('returns false if at max traits', () => {
      const personality: PersonalityState = {
        traits: ['brave', 'cautious', 'generous', 'curious'],
        corruption: 0,
      };

      const canGain = service.canGainTrait(personality, 'suspicious', ALL_TRAITS);

      expect(canGain).toBe(false);
    });

    it('returns true for valid new trait', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const canGain = service.canGainTrait(personality, 'cautious', ALL_TRAITS);

      expect(canGain).toBe(true);
    });
  });

  describe('gainTrait', () => {
    it('adds trait to personality', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const newPersonality = service.gainTrait(personality, 'generous', ALL_TRAITS);

      expect(newPersonality.traits).toContain('generous');
      expect(newPersonality.traits).toContain('brave');
    });

    it('does not mutate original', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      service.gainTrait(personality, 'generous', ALL_TRAITS);

      expect(personality.traits).not.toContain('generous');
    });
  });
});
