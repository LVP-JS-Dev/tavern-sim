import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  isAdventuresCommand,
  isStartAdventureCommand,
  isVisitorsCommand,
} from '../../../src/cli/commands';

describe('CLI Adventure Commands', () => {
  describe('adventures command', () => {
    it('should parse "adventures" command', () => {
      const result = parseCommand('adventures');
      expect(isAdventuresCommand(result)).toBe(true);
      if (isAdventuresCommand(result)) {
        expect(result.type).toBe('ADVENTURES');
      }
    });

    it('should parse "adv" alias', () => {
      const result = parseCommand('adv');
      expect(isAdventuresCommand(result)).toBe(true);
    });

    it('should reject adventures command with arguments', () => {
      const result = parseCommand('adventures extra');
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('start-adventure command', () => {
    it('should parse "start-adventure" with type and hero', () => {
      const result = parseCommand('start-adventure dungeon hero-1');
      expect(isStartAdventureCommand(result)).toBe(true);
      if (isStartAdventureCommand(result)) {
        expect(result.type).toBe('START_ADVENTURE');
        expect(result.adventureType).toBe('dungeon');
        expect(result.heroIds).toEqual(['hero-1']);
      }
    });

    it('should parse "sa" alias', () => {
      const result = parseCommand('sa hunt hero-1 hero-2');
      expect(isStartAdventureCommand(result)).toBe(true);
      if (isStartAdventureCommand(result)) {
        expect(result.adventureType).toBe('hunt');
        expect(result.heroIds).toEqual(['hero-1', 'hero-2']);
      }
    });

    it('should reject without adventure type', () => {
      const result = parseCommand('start-adventure');
      expect(result.type).toBe('UNKNOWN');
    });

    it('should reject without heroes', () => {
      const result = parseCommand('start-adventure dungeon');
      expect(result.type).toBe('UNKNOWN');
    });

    it('should validate adventure type', () => {
      const result = parseCommand('start-adventure invalid hero-1');
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('visitors command', () => {
    it('should parse "visitors" command', () => {
      const result = parseCommand('visitors');
      expect(isVisitorsCommand(result)).toBe(true);
      if (isVisitorsCommand(result)) {
        expect(result.type).toBe('VISITORS');
      }
    });

    it('should parse "v" alias', () => {
      const result = parseCommand('v');
      expect(isVisitorsCommand(result)).toBe(true);
    });

    it('should reject visitors command with arguments', () => {
      const result = parseCommand('visitors extra');
      expect(result.type).toBe('UNKNOWN');
    });
  });
});
