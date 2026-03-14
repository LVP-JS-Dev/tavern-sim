/**
 * Visitor Spawning Logic
 *
 * Pure functions for visitor spawning logic.
 * Separated from service.ts for testability.
 */
import type { RngStream } from '../../core/rng';
import type { Visitor, VisitorType, DirectorState } from './types';
import { VISITOR_SPAWN_CHANCE, VISITOR_TYPE_WEIGHTS } from './constants';

/**
 * Attempts to spawn a visitor. Returns null if spawn chance fails.
 * Pure function - no side effects.
 */
export function spawnVisitor(
  rng: RngStream,
  state: DirectorState,
  now: number,
  rosterSize: number
): Visitor | null {
  if (!rng.chance(VISITOR_SPAWN_CHANCE)) return null;

  const type = pickVisitorType(rng, rosterSize);

  return {
    id: `visitor-${state.nextVisitorId}`,
    type,
    arrivedAt: now,
  };
}

/**
 * Picks visitor type based on roster size and RNG.
 * Pure function - deterministic for same RNG state.
 */
function pickVisitorType(rng: RngStream, rosterSize: number): VisitorType {
  // Build weighted list based on roster size
  const types: VisitorType[] = [];

  // Always add basic types
  types.push('patron');
  types.push('adventurer');

  // Merchants more likely with small roster
  if (rosterSize < 3 && rng.chance(0.3)) {
    types.push('merchant');
  }

  // Nobles appear with established roster
  if (rosterSize >= 5 && rng.chance(0.1)) {
    types.push('noble');
  }

  return rng.pick(types);
}

/**
 * Checks if a visitor should depart based on time.
 */
export function shouldDepart(visitor: Visitor, now: number, maxStayMs: number): boolean {
  return now - visitor.arrivedAt > maxStayMs;
}
