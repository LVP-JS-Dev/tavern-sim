/**
 * Storage Interface
 *
 * Defines the abstract storage interface for game state persistence.
 * This interface allows different storage backends (file-based, LocalStorage, etc.)
 * to be used interchangeably with the same API.
 *
 * Design principle: Storage operations are async to support both synchronous
 * (LocalStorage) and asynchronous (file system, network) backends.
 *
 * @module persistence/storage
 */

import type { GameState } from "../types";

// ============================================================================
// STORAGE ERROR
// ============================================================================

/**
 * Error thrown when storage operations fail.
 */
export class StorageError extends Error {
  override readonly name = "StorageError";
  constructor(
    message: string,
    public readonly code: "READ_ERROR" | "WRITE_ERROR" | "NOT_FOUND" | "INVALID_DATA",
    public override readonly cause?: unknown
  ) {
    super(message);
  }
}

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

/**
 * Abstract storage interface for game state persistence.
 *
 * Implementations can use different backends:
 * - FileStorage: File system-based persistence (Node.js)
 * - LocalStorageAdapter: Browser LocalStorage
 * - MemoryStorage: In-memory storage for testing
 *
 * All methods are async to support both sync and async backends uniformly.
 *
 * @example
 * // Using a storage implementation
 * const storage = new FileStorage("./save/game.json");
 *
 * // Check if save exists
 * if (await storage.exists()) {
 *   const state = await storage.load();
 *   console.log("Loaded state:", state.meta.version);
 * }
 *
 * // Save state
 * await storage.save(newState);
 */
export interface Storage {
  /**
   * Loads the game state from storage.
   *
   * @returns The loaded GameState
   * @throws StorageError if load fails or data is invalid
   *
   * @example
   * const state = await storage.load();
   */
  load(): Promise<GameState>;

  /**
   * Saves the game state to storage.
   *
   * Should perform atomic writes where possible to prevent
   * corruption from partial writes during crashes.
   *
   * @param state - The GameState to save
   * @throws StorageError if save fails
   *
   * @example
   * await storage.save(currentState);
   */
  save(state: GameState): Promise<void>;

  /**
   * Checks if a saved state exists in storage.
   *
   * Use this before load() to handle the "new game" case gracefully.
   *
   * @returns true if a valid save exists, false otherwise
   *
   * @example
   * if (await storage.exists()) {
   *   state = await storage.load();
   * } else {
   *   state = createInitialState(Date.now(), seed);
   * }
   */
  exists(): Promise<boolean>;
}

// ============================================================================
// STORAGE TYPE GUARD
// ============================================================================

/**
 * Type guard to check if an object implements the Storage interface.
 *
 * @param value - The value to check
 * @returns true if value is a valid Storage implementation
 *
 * @example
 * const maybeStorage: unknown = getStorage();
 * if (isStorage(maybeStorage)) {
 *   const state = await maybeStorage.load();
 * }
 */
export function isStorage(value: unknown): value is Storage {
  if (typeof value !== "object" || value === null) return false;
  const storage = value as Storage;
  return (
    typeof storage.load === "function" &&
    typeof storage.save === "function" &&
    typeof storage.exists === "function"
  );
}
