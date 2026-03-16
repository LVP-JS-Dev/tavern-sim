/**
 * State Version Migrations
 *
 * Provides migration logic to upgrade older state versions to the current schema.
 * This enables backward compatibility when loading save files from older versions.
 *
 * Migration principles:
 * - Migrations are one-way (old version → new version)
 * - Each migration is a pure function (deterministic)
 * - Migrations preserve as much data as possible
 * - Failed migrations return error, not throw
 *
 * @module state/migrations
 */

import {
  type GameState,
  type DomainEvent,
  SCHEMA_VERSION,
  isGameState,
} from "../types";

// ============================================================================
// MIGRATION TYPES
// ============================================================================

/**
 * Represents a version string in semver-like format.
 * Used for comparing state versions during migration.
 */
type VersionString = string;

/**
 * Result of a state migration operation.
 */
export interface MigrationResult {
  /** The migrated game state (upgraded to current version) */
  readonly state: GameState;

  /** Events emitted during migration (e.g., STATE_MIGRATED) */
  readonly events: readonly DomainEvent[];

  /** Optional error if migration failed */
  readonly error?: MigrationError;
}

/**
 * Error thrown when a migration fails.
 */
export class MigrationError extends Error {
  override readonly name = "MigrationError";
  constructor(
    message: string,
    public readonly fromVersion: string,
    public readonly toVersion: string,
    public override readonly cause?: unknown
  ) {
    super(message);
  }
}

/**
 * Function type for a single migration step.
 * Transforms state from one version to the next.
 */
type MigrationFn = (state: Record<string, unknown>) => Record<string, unknown>;

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

/**
 * Registry of all available migrations.
 * Key: from version, Value: { toVersion, migrate function }
 *
 * As new versions are added, add migration entries here.
 * Example:
 * - "0.1.0" → "0.2.0"
 * - "0.2.0" → "0.3.0"
 *
 * The migrateState function will chain migrations if needed.
 */
const MIGRATIONS: Record<VersionString, { toVersion: VersionString; migrate: MigrationFn }> = {
  // Migration from v0.1.0 to v0.2.0 - adds new game systems
  "0.1.0": {
    toVersion: "0.2.0",
    migrate: migrateV010ToV020,
  },
};

// ============================================================================
// MIGRATION IMPLEMENTATIONS
// ============================================================================

/**
 * Migrates state from v0.1.0 to v0.2.0.
 *
 * Adds the following new slices:
 * - director: Visitor spawning system
 * - adventures: Adventure tracking system
 * - world: World state (time, weather)
 * - eventLog: Event history and notifications
 * - personality: Hero personality traits
 */
function migrateV010ToV020(state: Record<string, unknown>): Record<string, unknown> {
  return {
    ...state,
    meta: {
      ...(state['meta'] as Record<string, unknown>),
      version: "0.2.0",
    },
    // Add new system slices with empty initial states
    director: {
      visitors: [],
      spawnTimer: 0,
      nextVisitorId: 1,
    },
    adventures: {
      adventures: [],
      nextAdventureId: 1,
    },
    world: {
      timeOfDay: "dawn",
      weather: "clear",
      dayNumber: 1,
      activeEvents: [],
    },
    eventLog: {
      entries: [],
      notifications: [],
      lastReadAt: 0,
      maxEntries: 100,
    },
    personality: {
      heroPersonalities: {},
    },
  };
}

// ============================================================================
// VERSION UTILITIES
// ============================================================================

/**
 * Parses a version string into its components.
 *
 * @param version - Version string in semver format (e.g., "0.1.0")
 * @returns Object with major, minor, patch numbers, or null if invalid
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const parts = version.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

/**
 * Compares two version strings.
 *
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, zero if a === b, positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (!versionA || !versionB) {
    // Invalid versions sort to the end
    return versionA ? -1 : versionB ? 1 : 0;
  }

  if (versionA.major !== versionB.major) {
    return versionA.major - versionB.major;
  }
  if (versionA.minor !== versionB.minor) {
    return versionA.minor - versionB.minor;
  }
  return versionA.patch - versionB.patch;
}

/**
 * Extracts the version from a potentially unvalidated state object.
 *
 * @param state - Unknown state object
 * @returns Version string or undefined if not found
 */
function extractVersion(state: Record<string, unknown>): string | undefined {
  const meta = state['meta'] as Record<string, unknown> | undefined;
  if (meta && typeof meta['version'] === "string") {
    return meta['version'];
  }
  return undefined;
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Checks if a state needs migration by comparing its version to the current schema.
 *
 * @param state - State to check (may be from older version)
 * @returns true if migration is needed, false if already current
 */
export function needsMigration(state: Record<string, unknown>): boolean {
  const version = extractVersion(state);
  if (!version) {
    return true; // No version means very old or corrupted state
  }
  return version !== SCHEMA_VERSION;
}

/**
 * Gets the migration path from one version to another.
 *
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns Array of migration steps, or empty if no path exists
 */
function getMigrationPath(
  fromVersion: string,
  toVersion: string
): Array<{ from: string; to: string; migrate: MigrationFn }> {
  const path: Array<{ from: string; to: string; migrate: MigrationFn }> = [];
  let currentVersion = fromVersion;

  // Chain migrations until we reach the target version
  while (currentVersion !== toVersion) {
    const migration = MIGRATIONS[currentVersion];
    if (!migration) {
      // No migration path exists
      return [];
    }
    path.push({
      from: currentVersion,
      to: migration.toVersion,
      migrate: migration.migrate,
    });
    currentVersion = migration.toVersion;
  }

  return path;
}

/**
 * Migrates a state object to the current schema version.
 *
 * This function handles:
 * - States with no version (assumes very old, resets to initial)
 * - States with older versions (applies migration chain)
 * - States already at current version (returns as-is)
 *
 * @param state - State object to migrate (may be from older version)
 * @returns MigrationResult with migrated state and any events/errors
 *
 * @example
 * // Migrate an old save file
 * const oldState = JSON.parse(savedJson);
 * const result = migrateState(oldState);
 *
 * if (result.error) {
 *   console.error("Migration failed:", result.error.message);
 * } else {
 *   console.log("Migrated to version:", result.state['meta'].version);
 * }
 *
 * @example
 * // Check if migration is needed before migrating
 * if (needsMigration(loadedState)) {
 *   const result = migrateState(loadedState);
 *   // Handle migration result
 * }
 */
export function migrateState(state: Record<string, unknown>): MigrationResult {
  const events: DomainEvent[] = [];
  const currentVersion = extractVersion(state);

  // Case 1: No version found - state is too old or corrupted
  if (!currentVersion) {
    const error = new MigrationError(
      "State has no version information - cannot migrate",
      "unknown",
      SCHEMA_VERSION
    );
    return {
      state: state as unknown as GameState, // Return as-is, let caller handle
      events,
      error,
    };
  }

  // Case 2: Already at current version - no migration needed
  if (currentVersion === SCHEMA_VERSION) {
    if (!isGameState(state)) {
      const error = new MigrationError(
        "State version matches but validation failed - state may be corrupted",
        currentVersion,
        SCHEMA_VERSION
      );
      return { state: state as unknown as GameState, events, error };
    }
    return { state, events };
  }

  // Case 3: State is newer than current version - cannot downgrade
  if (compareVersions(currentVersion, SCHEMA_VERSION) > 0) {
    const error = new MigrationError(
      `State version ${currentVersion} is newer than current version ${SCHEMA_VERSION} - cannot downgrade`,
      currentVersion,
      SCHEMA_VERSION
    );
    return { state: state as unknown as GameState, events, error };
  }

  // Case 4: State is older - find and apply migration path
  const migrationPath = getMigrationPath(currentVersion, SCHEMA_VERSION);

  if (migrationPath.length === 0) {
    const error = new MigrationError(
      `No migration path found from version ${currentVersion} to ${SCHEMA_VERSION}`,
      currentVersion,
      SCHEMA_VERSION
    );
    return { state: state as unknown as GameState, events, error };
  }

  // Apply migrations in sequence
  let currentState = state;
  try {
    for (const step of migrationPath) {
      currentState = step.migrate(currentState);
    }

    // Validate final state
    if (!isGameState(currentState)) {
      const error = new MigrationError(
        "Migration completed but final state failed validation",
        currentVersion,
        SCHEMA_VERSION
      );
      return { state: currentState as unknown as GameState, events, error };
    }

    return { state: currentState, events };
  } catch (err) {
    const error = new MigrationError(
      `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
      currentVersion,
      SCHEMA_VERSION,
      err
    );
    return { state: currentState as unknown as GameState, events, error };
  }
}

// ============================================================================
// FUTURE MIGRATION TEMPLATES
// ============================================================================

/**
 * Template for future migrations.
 * When adding a new version, copy this template and modify as needed.
 *
 * @example
 * // When migrating from 0.1.0 to 0.2.0:
 * function migrateV010ToV020(state: Record<string, unknown>): Record<string, unknown> {
 *   // 1. Update version number
 *   const newState = {
 *     ...state,
 *     meta: {
 *       ...(state['meta'] as Record<string, unknown>),
 *       version: "0.2.0",
 *     },
 *   };
 *
 *   // 2. Apply schema changes
 *   // Example: Add new field with default value
 *   // newState.newSlice = { newField: defaultValue };
 *
 *   // 3. Transform existing data if needed
 *   // Example: Rename a field
 *   // newState.renamedSlice = state.oldSliceName;
 *   // delete newState.oldSliceName;
 *
 *   return newState;
 * }
 *
 * // Register the migration
 * MIGRATIONS["0.1.0"] = { toVersion: "0.2.0", migrate: migrateV010ToV020 };
 */
