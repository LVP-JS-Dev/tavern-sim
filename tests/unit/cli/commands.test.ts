// tests/unit/cli/commands.test.ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../../src/cli/commands';

describe('CLI Commands - New Commands', () => {
  describe('log command', () => {
    it('parses basic log command', () => {
      const result = parseCommand('log');

      expect(result.type).toBe('LOG');
    });

    it('parses log with type filter', () => {
      const result = parseCommand('log --type hero_hired');

      expect(result.type).toBe('LOG');
      expect(result.filter?.types).toContain('hero_hired');
    });

    it('parses log with limit', () => {
      const result = parseCommand('log --limit 10');

      expect(result.type).toBe('LOG');
      expect(result.filter?.limit).toBe(10);
    });
  });

  describe('events command', () => {
    it('parses events command', () => {
      const result = parseCommand('events');

      expect(result.type).toBe('EVENTS');
    });

    it('parses events with limit', () => {
      const result = parseCommand('events 20');

      expect(result.type).toBe('EVENTS');
      expect(result.limit).toBe(20);
    });
  });

  describe('notifications command', () => {
    it('parses notifications command', () => {
      const result = parseCommand('notifications');

      expect(result.type).toBe('NOTIFICATIONS');
    });

    it('parses notifications --all flag', () => {
      const result = parseCommand('notifications --all');

      expect(result.type).toBe('NOTIFICATIONS');
      expect(result.showRead).toBe(true);
    });
  });

  describe('mark-read command', () => {
    it('parses mark-read with ids', () => {
      const result = parseCommand('mark-read notif-1 notif-2');

      expect(result.type).toBe('MARK_READ');
      expect(result.ids).toEqual(['notif-1', 'notif-2']);
    });
  });

  describe('world command', () => {
    it('parses world status command', () => {
      const result = parseCommand('world');

      expect(result.type).toBe('WORLD');
    });
  });
});
