// tests/unit/systems/event-log.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EventLogServiceImpl } from '../../../src/systems/event-log/service';
import type { EventLogService, EventLogState, LogEntry, Notification, EventFilter } from '../../../src/systems/event-log/types';
import { emptyEventLogState } from '../../../src/systems/event-log';

describe('EventLogSystem', () => {
  let service: EventLogService;
  let state: EventLogState;

  beforeEach(() => {
    service = new EventLogServiceImpl();
    state = emptyEventLogState();
  });

  describe('append', () => {
    it('adds entry to log', () => {
      const entry: LogEntry = {
        id: 'log-1',
        timestamp: Date.now(),
        type: 'hero_hired',
        data: { heroId: 'bard-1' },
      };

      const newState = service.append(entry, state);

      expect(newState.entries).toHaveLength(1);
      expect(newState.entries[0]).toEqual(entry);
    });

    it('truncates old entries when max exceeded', () => {
      state = { ...state, maxEntries: 3 };

      for (let i = 0; i < 5; i++) {
        state = service.append({
          id: `log-${i}`,
          timestamp: Date.now() + i,
          type: 'hero_hired',
          data: {},
        }, state);
      }

      expect(state.entries.length).toBeLessThanOrEqual(3);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      const entries: LogEntry[] = [
        { id: '1', timestamp: 1000, type: 'hero_hired', data: {} },
        { id: '2', timestamp: 2000, type: 'visitor_arrived', data: {} },
        { id: '3', timestamp: 3000, type: 'hero_hired', data: {} },
        { id: '4', timestamp: 4000, type: 'adventure_started', data: {} },
      ];
      state = { ...state, entries };
    });

    it('filters by type', () => {
      const filter: EventFilter = { types: ['hero_hired'] };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
      expect(result.every(e => e.type === 'hero_hired')).toBe(true);
    });

    it('filters by time range', () => {
      const filter: EventFilter = { since: 1500, until: 3500 };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
    });

    it('limits results', () => {
      const filter: EventFilter = { limit: 2 };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
    });
  });

  describe('notifications', () => {
    it('creates notification', () => {
      const newState = service.createNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        isRead: false,
      }, state);

      expect(newState.notifications).toHaveLength(1);
      expect(newState.notifications[0].title).toBe('Test');
    });

    it('gets unread notifications', () => {
      state = {
        ...state,
        notifications: [
          { id: 'n1', timestamp: 1000, type: 'info', title: 'A', message: 'a', isRead: true },
          { id: 'n2', timestamp: 2000, type: 'success', title: 'B', message: 'b', isRead: false },
        ],
      };

      const unread = service.getUnread(state);

      expect(unread).toHaveLength(1);
      expect(unread[0].id).toBe('n2');
    });

    it('marks notifications as read', () => {
      state = {
        ...state,
        notifications: [
          { id: 'n1', timestamp: 1000, type: 'info', title: 'A', message: 'a', isRead: false },
          { id: 'n2', timestamp: 2000, type: 'success', title: 'B', message: 'b', isRead: false },
        ],
      };

      const newState = service.markRead(['n1'], state);

      expect(newState.notifications[0].isRead).toBe(true);
      expect(newState.notifications[1].isRead).toBe(false);
    });
  });
});
