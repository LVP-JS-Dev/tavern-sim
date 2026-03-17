/**
 * State Serialization/Deserialization
 *
 * Provides canonical JSON serialization for GameState.
 * All state is designed to be JSON-serializable for:
 * - Save/load persistence
 * - Replay verification
 * - State snapshots
 *
 * @module state/serialize
 */

import {
  type GameState,
  isGameState,
} from "../types";

// ============================================================================
// SERIALIZATION ERROR
// ============================================================================

/**
 * Error thrown when serialization or deserialization fails.
 */
export class SerializationError extends Error {
  override readonly name = "SerializationError";
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
  }
}

// ============================================================================
// SERIALIZATION FUNCTIONS
// ============================================================================

/**
 * Serializes a GameState to a canonical JSON string.
 *
 * Uses deterministic JSON formatting:
 * - 2-space indentation for readability
 * - Sorted keys for consistency (enables diffing)
 * - No undefined values (cleaner output)
 *
 * @param state - The GameState to serialize
 * @returns Canonical JSON string representation
 * @throws SerializationError if serialization fails
 *
 * @example
 * const state = createInitialState(Date.now(), 12345);
 * const json = serializeState(state);
 * console.log(json); // '{"meta":{"version":"0.1.0",...},...}'
 */
/**
 * Recursively sort object keys for canonical JSON output.
 */
function sortKeys<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys) as T;
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted as T;
}

export function serializeState(state: GameState): string {
  try {
    // Recursively sort keys for canonical output, then stringify
    return JSON.stringify(sortKeys(state), null, 2);
  } catch (error) {
    throw new SerializationError(
      "Failed to serialize game state",
      error
    );
  }
}

/**
 * Deserializes a JSON string back to a GameState.
 *
 * Validates the parsed object against the GameState schema using type guards.
 * This ensures only valid state objects are returned.
 *
 * @param json - JSON string to deserialize
 * @returns Validated GameState object
 * @throws SerializationError if parsing fails or validation fails
 *
 * @example
 * const json = '{"meta":{"version":"0.1.0",...},...}';
 * const state = deserializeState(json);
 * console.log(state.meta.version); // "0.1.0"
 *
 * @example
 * // Round-trip serialization preserves all data
 * const original = createInitialState(Date.now(), 12345);
 * const json = serializeState(original);
 * const restored = deserializeState(json);
 * // restored is deeply equal to original
 */
export function deserializeState(json: string): GameState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new SerializationError(
      "Failed to parse JSON: invalid JSON format",
      error
    );
  }

  if (!isGameState(parsed)) {
    throw new SerializationError(
      "Invalid game state: parsed object does not match GameState schema"
    );
  }

  return parsed;
}

/**
 * Performs a deep clone of a GameState using serialization.
 *
 * This is a convenient way to create an independent copy of state
 * for immutable updates or testing.
 *
 * @param state - The GameState to clone
 * @returns A deep copy of the state
 * @throws SerializationError if cloning fails
 *
 * @example
 * const original = createInitialState(Date.now(), 12345);
 * const clone = cloneState(original);
 * // clone is deeply equal but not the same reference
 */
export function cloneState(state: GameState): GameState {
  return deserializeState(serializeState(state));
}
