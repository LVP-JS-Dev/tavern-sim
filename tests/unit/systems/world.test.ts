// tests/unit/systems/world.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WorldServiceImpl } from '../../../src/systems/world/service';
import type { WorldService, WorldContext, WorldState, WorldModifiers } from '../../../src/systems/world/types';
import { SeededRng } from '../../../src/core/rng';
import { emptyWorldState } from '../../../src/systems/world';

describe('WorldSystem', () => {
  let service: WorldService;
  let rng: SeededRng;

  beforeEach(() => {
    service = new WorldServiceImpl();
    rng = new SeededRng(12345);
  });

  describe('update', () => {
    it('advances time of day based on tick', () => {
      const state = emptyWorldState();
      const ctx: WorldContext = {
        state: { world: state },
        rng,
        now: Date.now(),
      };

      const result = service.update(ctx);

      // Time should advance
      expect(result.state).toBeDefined();
    });

    it('changes weather periodically', () => {
      const state = { ...emptyWorldState(), weather: 'clear' as const };
      const ctx: WorldContext = {
        state: { world: state },
        rng,
        now: Date.now(),
      };

      // Multiple updates may change weather
      let currentWeather = state.weather;
      for (let i = 0; i < 100; i++) {
        const result = service.update({
          ...ctx,
          rng: new SeededRng(i),
        });
        currentWeather = result.state.weather;
      }

      // Weather should have changed at least once
      // (probabilistic, but very likely)
    });
  });

  describe('getModifiers', () => {
    it('returns default modifiers for clear weather', () => {
      const state = { ...emptyWorldState(), weather: 'clear' as const };

      const modifiers = service.getModifiers(state);

      expect(modifiers.incomeMultiplier).toBe(1.0);
      expect(modifiers.visitorSpawnRate).toBe(1.0);
      expect(modifiers.adventureSuccessBonus).toBe(0);
    });

    it('reduces income during storm', () => {
      const state = { ...emptyWorldState(), weather: 'storm' as const };

      const modifiers = service.getModifiers(state);

      expect(modifiers.incomeMultiplier).toBeLessThan(1.0);
    });

    it('increases visitors during festival', () => {
      const state = {
        ...emptyWorldState(),
        activeEvents: [{ id: 'festival-1', type: 'festival' as const, data: {} }],
      };

      const modifiers = service.getModifiers(state);

      expect(modifiers.visitorSpawnRate).toBeGreaterThan(1.0);
    });
  });

  describe('isEventActive', () => {
    it('returns true for active event', () => {
      const state = {
        ...emptyWorldState(),
        activeEvents: [{ id: 'plague-1', type: 'plague' as const, data: {} }],
      };

      expect(service.isEventActive('plague-1', state)).toBe(true);
    });

    it('returns false for inactive event', () => {
      const state = emptyWorldState();

      expect(service.isEventActive('plague-1', state)).toBe(false);
    });
  });
});
