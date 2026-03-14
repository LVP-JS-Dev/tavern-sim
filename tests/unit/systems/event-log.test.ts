import { describe, it, expect } from 'vitest';
import type { EventLogState, LogEntry, Notification, LogEventType } from '../../../src/systems/event-log/types';

describe('Event Log System Types', () => {
  describe('EventLogState interface', () => {
    it('should have required fields', () => {
      const log: EventLogState = {
        entries: [],
        notifications: [],
        lastReadAt: 0,
        maxEntries: 100,
      };

      expect(log.entries).toEqual([]);
      expect(log.notifications).toEqual([]);
      expect(log.lastReadAt).toBe(0);
      expect(log.maxEntries).toBe(100);
    });
  });

  describe('LogEntry interface', () => {
    it('should have required fields', () => {
      const entry: LogEntry = {
        id: 'entry-1',
        timestamp: Date.now(),
        type: 'hero_hired',
        data: { heroId: 'hero-1', name: 'Alice' },
      };

      expect(entry.id).toBe('entry-1');
      expect(entry.type).toBe('hero_hired');
      expect(entry.data.heroId).toBe('hero-1');
    });
  });

  describe('Notification interface', () => {
    it('should have required fields', () => {
      const notification: Notification = {
        id: 'notif-1',
        timestamp: Date.now(),
        type: 'success',
        title: 'Adventure Complete',
        message: 'Heroes returned with loot!',
        isRead: false,
      };

      expect(notification.id).toBe('notif-1');
      expect(notification.type).toBe('success');
      expect(notification.title).toBe('Adventure Complete');
      expect(notification.isRead).toBe(false);
    });
  });

  describe('LogEventType type', () => {
    it('should include all event types', () => {
      const eventTypes: LogEventType[] = [
        'hero_hired',
        'hero_upgraded',
        'visitor_arrived',
        'visitor_departed',
        'adventure_started',
        'adventure_completed',
        'adventure_failed',
        'loot_obtained',
        'gold_earned',
        'world_event',
      ];

      expect(eventTypes).toHaveLength(10);
    });
  });
});
