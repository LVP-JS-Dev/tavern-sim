/**
 * File-based Storage Implementation
 *
 * Provides persistent storage for GameState using the filesystem.
 * Uses atomic writes (temp file → rename) to prevent corruption
 * from partial writes during crashes.
 *
 * @module persistence/file
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { GameState } from "../types";
import { StorageError, type Storage } from "./storage";

// Re-export Storage type for convenience
export type { Storage } from "./storage";
import { serializeState, deserializeState } from "../state/serialize";

// ============================================================================
// FILE STORAGE IMPLEMENTATION
// ============================================================================

/**
 * File-based storage backend for GameState persistence.
 *
 * Uses atomic write pattern:
 * 1. Write to temporary file
 * 2. Rename temp file to target (atomic on most filesystems)
 *
 * This prevents corruption if the process crashes during write.
 *
 * @example
 * // Basic usage
 * const storage = new FileStorage("./saves/game.json");
 *
 * if (await storage.exists()) {
 *   const state = await storage.load();
 *   console.log("Loaded state version:", state.meta.version);
 * }
 *
 * await storage.save(newState);
 *
 * @example
 * // With custom temp directory
 * const storage = new FileStorage("./saves/game.json", {
 *   tempDir: "./tmp"
 * });
 */
export class FileStorage implements Storage {
  private readonly filePath: string;
  private readonly tempDir: string;

  /**
   * Creates a new FileStorage instance.
   *
   * @param filePath - Absolute or relative path to the save file
   * @param options - Optional configuration
   * @param options.tempDir - Directory for temporary files (defaults to same directory as save file)
   */
  constructor(
    filePath: string,
    options?: { tempDir?: string }
  ) {
    this.filePath = filePath;
    this.tempDir = options?.tempDir ?? path.dirname(filePath);
  }

  /**
   * Loads the game state from the file.
   *
   * @returns The loaded GameState
   * @throws StorageError if file doesn't exist, can't be read, or contains invalid data
   */
  async load(): Promise<GameState> {
    let content: string;

    try {
      content = await fs.readFile(this.filePath, "utf-8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new StorageError(
          `Save file not found: ${this.filePath}`,
          "NOT_FOUND",
          error
        );
      }
      throw new StorageError(
        `Failed to read save file: ${this.filePath}`,
        "READ_ERROR",
        error
      );
    }

    try {
      return deserializeState(content);
    } catch (error) {
      throw new StorageError(
        `Save file contains invalid data: ${this.filePath}`,
        "INVALID_DATA",
        error
      );
    }
  }

  /**
   * Saves the game state to the file using atomic writes.
   *
   * Atomic write pattern:
   * 1. Write to a temporary file in the same directory
   * 2. Rename temp file to target file (atomic operation)
   *
   * This ensures the save file is never in a partially-written state.
   *
   * @param state - The GameState to save
   * @throws StorageError if write fails
   */
  async save(state: GameState): Promise<void> {
    const serialized = serializeState(state);
    const tempFileName = `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempFilePath = path.join(this.tempDir, tempFileName);

    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      // Write to temporary file first
      await fs.writeFile(tempFilePath, serialized, "utf-8");

      // Atomic rename (same filesystem guarantees atomicity)
      await fs.rename(tempFilePath, this.filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }

      throw new StorageError(
        `Failed to save game state to: ${this.filePath}`,
        "WRITE_ERROR",
        error
      );
    }
  }

  /**
   * Checks if a save file exists.
   *
   * @returns true if the save file exists and is accessible
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a FileStorage instance with the given file path.
 *
 * Convenience factory function for creating FileStorage instances.
 *
 * @param filePath - Path to the save file
 * @param options - Optional configuration
 * @returns A new FileStorage instance
 *
 * @example
 * const storage = createFileStorage("./saves/game.json");
 * await storage.save(state);
 */
export function createFileStorage(
  filePath: string,
  options?: { tempDir?: string }
): Storage {
  return new FileStorage(filePath, options);
}
