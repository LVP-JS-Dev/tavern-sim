/**
 * Seeded RNG implementation using Linear Congruential Generator.
 * Provides deterministic random sequences for game replay.
 *
 * IMPORTANT: All methods (nextInt, pick, chance, sample) internally call next()
 * to ensure consistent state advancement and determinism.
 */
import type { RngService, RngStream, RngSnapshot, StreamSnapshot } from './types';

/**
 * Internal state for a single RNG stream
 */
interface StreamState {
  position: number;
  state: number;
}

export class SeededRng implements RngService {
  private streams: Map<string, StreamState> = new Map();
  private static readonly M = 0x80000000;
  private static readonly A = 1103515245;
  private static readonly C = 12345;

  constructor(
    private readonly rootSeed: number,
    snapshot?: RngSnapshot
  ) {
    if (snapshot) {
      (this as any).rootSeed = snapshot.rootSeed;
      for (const s of snapshot.streams) {
        this.streams.set(s.streamId, {
          position: s.position,
          state: this.computeState(s.position, s.streamId),
        });
      }
    }
  }

  createStream(streamId: string, partitionKey?: string): RngStream {
    const key = partitionKey ? `${streamId}:${partitionKey}` : streamId;

    if (!this.streams.has(key)) {
      this.streams.set(key, {
        position: 0,
        state: this.computeState(0, key),
      });
    }

    const streamState = this.streams.get(key)!;

    // Helper to advance state and return value
    const advance = (): number => {
      streamState.position++;
      streamState.state = this.computeState(streamState.position, key);
      return streamState.state / SeededRng.M;
    };

    return {
      next: () => advance(),

      nextInt: (min: number, max: number) => {
        const val = advance();
        return Math.floor(val * (max - min + 1)) + min;
      },

      pick: <T>(array: readonly T[]): T => {
        if (array.length === 0) throw new Error('Cannot pick from empty array');
        const val = advance();
        const idx = Math.floor(val * array.length);
        return array[idx]!;
      },

      sample: <T>(array: readonly T[], count: number): T[] => {
        const maxCount = Math.min(count, array.length);
        const result: T[] = [];
        const available = [...array];

        for (let i = 0; i < maxCount; i++) {
          const val = advance();
          const idx = Math.floor(val * available.length);
          result.push(available[idx]!);
          available.splice(idx, 1);
        }

        return result;
      },

      chance: (probability: number) => {
        return advance() < probability;
      },
    };
  }

  snapshot(): RngSnapshot {
    const streams: StreamSnapshot[] = [];
    for (const [streamId, state] of this.streams) {
      streams.push({
        streamId,
        position: state.position,
      });
    }
    return { rootSeed: this.rootSeed, streams };
  }

  restore(snapshot: RngSnapshot): void {
    this.streams.clear();
    for (const s of snapshot.streams) {
      this.streams.set(s.streamId, {
        position: s.position,
        state: this.computeState(s.position, s.streamId),
      });
    }
  }

  private computeState(position: number, key: string): number {
    // Combine seed, position, and key hash for unique state per stream
    const keyHash = this.hashString(key);
    const z = (this.rootSeed + position + keyHash) | 0;
    return ((SeededRng.A * z + SeededRng.C) >>> 0) % SeededRng.M;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
