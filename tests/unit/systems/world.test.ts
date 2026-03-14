import { describe, it, expect } from 'vitest';
import type { WorldState, WorldEvent, TimeOfDay, Weather, WorldEventType } from '../../../src/systems/world/types';

describe('World System Types', () => {
  describe('WorldState interface', () => {
    it('should have required fields', () => {
      const world: WorldState = {
        timeOfDay: 'morning',
        weather: 'clear',
        dayNumber: 5,
        activeEvents: [],
      };

      expect(world.timeOfDay).toBe('morning');
      expect(world.weather).toBe('clear');
      expect(world.dayNumber).toBe(5);
      expect(world.activeEvents).toEqual([]);
    });
  });

  describe('WorldEvent interface', () => {
    it('should have required fields', () => {
      const event: WorldEvent = {
        id: 'event-1',
        type: 'festival',
        startedAt: Date.now(),
        duration: 3600000,
        data: { bonus: 2.0 },
      };

      expect(event.id).toBe('event-1');
      expect(event.type).toBe('festival');
      expect(event.duration).toBe(3600000);
      expect(event.data.bonus).toBe(2.0);
    });
  });

  describe('TimeOfDay type', () => {
    it('should include all times', () => {
      const times: TimeOfDay[] = [
        'dawn',
        'morning',
        'noon',
        'afternoon',
        'evening',
        'night',
        'midnight',
      ];

      expect(times).toHaveLength(7);
    });
  });

  describe('Weather type', () => {
    it('should include all weather types', () => {
      const weathers: Weather[] = [
        'clear',
        'cloudy',
        'rain',
        'storm',
        'snow',
      ];

      expect(weathers).toHaveLength(5);
    });
  });

  describe('WorldEventType type', () => {
    it('should include all event types', () => {
      const eventTypes: WorldEventType[] = [
        'festival',
        'plague',
        'drought',
        'war',
        'trade_route',
      ];

      expect(eventTypes).toHaveLength(5);
    });
  });
});
