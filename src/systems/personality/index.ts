// src/systems/personality/index.ts
export type {
  PersonalityService,
  PersonalityState,
  PersonalitySlice,
  Trait,
  TraitEffect,
  TraitType,
  TraitEffectsResult,
} from './types';
export { emptyPersonalityState, emptyPersonalitySlice } from './types';
export { PersonalityServiceImpl } from './service';
export { ALL_TRAITS, MAX_TRAITS_PER_HERO } from './traits';
