/**
 * RNG Stream Interface
 *
 * A deterministic random number generator stream.
 * Each stream maintains its own position for reproducibility.
 */
export interface RngStream {
  /** Returns a random number in [0, 1) */
  next(): number;
  /** Returns a random integer in [min, max] (inclusive) */
  nextInt(min: number, max: number): number;
  /** Picks a random element from array (throws if empty) */
  pick<T>(array: readonly T[]): T;
  /** Samples n unique elements from array */
  sample<T>(array: readonly T[], count: number): T[];
  /** Returns true with given probability [0, 1] */
  chance(probability: number): boolean;
}

/** Snapshot of a single RNG stream */
export interface StreamSnapshot {
  readonly streamId: string;
  readonly partitionKey?: string;
  readonly position: number;
}

/** Snapshot of entire RNG state for persistence */
export interface RngSnapshot {
  readonly rootSeed: number;
  readonly streams: readonly StreamSnapshot[];
}

/**
 * RNG Service Interface
 *
 * Factory for creating deterministic RNG streams.
 * Supports snapshot/restore for save/load functionality.
 */
export interface RngService {
  /** Create a deterministic stream for a specific system/partition */
  createStream(streamId: string, partitionKey?: string): RngStream;
  /** Get snapshot of all streams for persistence */
  snapshot(): RngSnapshot;
  /** Restore all streams from snapshot */
  restore(snapshot: RngSnapshot): void;
}
