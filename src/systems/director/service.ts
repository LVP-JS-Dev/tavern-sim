/**
 * Director Service Implementation
 *
 * Manages visitor spawning and lifecycle for the tavern.
 */
import type { RngService } from '../../core/rng';
import type { DirectorState, DirectorContext, DirectorResult, Visitor } from './types';
import { MAX_VISITORS, MAX_VISITOR_STAY_MS } from './constants';
import { spawnVisitor, shouldDepart } from './spawn';

export class DirectorServiceImpl {
  /**
   * Check if a new visitor can spawn.
   */
  canSpawn(state: DirectorState, rosterSize: number): boolean {
    return state.visitors.length < MAX_VISITORS;
  }

  /**
   * Process tick update for director system.
   */
  update(ctx: DirectorContext): DirectorResult {
    const { state, rng, now } = ctx;
    const directorState = state.director;

    const visitorsSpawned: Visitor[] = [];
    const visitorsDeparted: string[] = [];

    // Check for departing visitors
    for (const visitor of directorState.visitors) {
      if (shouldDepart(visitor, now, MAX_VISITOR_STAY_MS)) {
        visitorsDeparted.push(visitor.id);
      }
    }

    // Try to spawn new visitor
    const rosterSize = Object.keys(state.heroes.roster).length;
    if (this.canSpawn(directorState, rosterSize)) {
      const newVisitor = spawnVisitor(
        rng.createStream('director'),
        directorState,
        now,
        rosterSize
      );

      if (newVisitor) {
        visitorsSpawned.push(newVisitor);
      }
    }

    return {
      visitorsSpawned,
      visitorsDeparted,
      events: [],
    };
  }

  /**
   * Process visitor departure.
   */
  processDeparture(visitorId: string, state: DirectorState): DirectorResult {
    const visitor = state.visitors.find(v => v.id === visitorId);
    if (!visitor) {
      return {
        visitorsSpawned: [],
        visitorsDeparted: [],
        events: [],
      };
    }

    return {
      visitorsSpawned: [],
      visitorsDeparted: [visitorId],
      events: [],
    };
  }
}
