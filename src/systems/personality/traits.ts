// src/systems/personality/traits.ts
import type { Trait } from './types';

export const ALL_TRAITS: readonly Trait[] = [
  {
    id: 'brave',
    name: 'Brave',
    description: 'Increases adventure success chance',
    type: 'brave',
    effects: [{ type: 'adventure_bonus', value: 0.1 }],
    corruptionWeight: 0,
  },
  {
    id: 'cautious',
    name: 'Cautious',
    description: 'Resists corruption better',
    type: 'cautious',
    effects: [{ type: 'corruption_resistance', value: 0.2 }],
    corruptionWeight: 0,
  },
  {
    id: 'greedy',
    name: 'Greedy',
    description: 'Increases income but prone to corruption',
    type: 'greedy',
    effects: [{ type: 'income_modifier', value: 0.15 }],
    corruptionWeight: 0.3,
  },
  {
    id: 'generous',
    name: 'Generous',
    description: 'Slightly less income but corruption resistant',
    type: 'generous',
    effects: [
      { type: 'income_modifier', value: -0.05 },
      { type: 'corruption_resistance', value: 0.15 },
    ],
    corruptionWeight: 0,
  },
  {
    id: 'curious',
    name: 'Curious',
    description: 'Better adventure rewards',
    type: 'curious',
    effects: [{ type: 'adventure_bonus', value: 0.05 }],
    corruptionWeight: 0.1,
  },
  {
    id: 'suspicious',
    name: 'Suspicious',
    description: 'Very corruption resistant but less income',
    type: 'suspicious',
    effects: [
      { type: 'corruption_resistance', value: 0.3 },
      { type: 'income_modifier', value: -0.1 },
    ],
    corruptionWeight: 0,
  },
];

export const MAX_TRAITS_PER_HERO = 4;
