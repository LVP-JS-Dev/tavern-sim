/**
 * Action Type Definitions v0.1.0
 *
 * Action types for the Tavern Tycoon Alpha economy simulator.
 * Actions represent intentions to change state, processed by the reducer.
 * All actions are JSON-serializable for replay and debugging.
 *
 * @module types/actions
 */

// ============================================================================
// TICK ACTION
// ============================================================================

/**
 * Advances game time by one tick.
 * Triggers income calculation and state updates.
 */
export interface TickAction {
  readonly type: "TICK";
}

// ============================================================================
// UPGRADE HERO ACTION
// ============================================================================

/**
 * Requests an upgrade for a specific hero.
 * Supports partial upgrades when gold is insufficient.
 */
export interface UpgradeHeroAction {
  readonly type: "UPGRADE_HERO";

  /** ID of the hero to upgrade (must exist in hero definitions) */
  readonly heroId: string;

  /** Number of levels to attempt (defaults to 1 if not specified) */
  readonly levels?: number;
}

// ============================================================================
// CALCULATE OFFLINE ACTION
// ============================================================================

/**
 * Calculates and applies progress earned while away.
 * Respects the 8-hour offline cap.
 */
export interface CalculateOfflineAction {
  readonly type: "CALCULATE_OFFLINE";

  /** Current timestamp in milliseconds (usually Date.now()) */
  readonly now: number;
}

// ============================================================================
// SAVE ACTION
// ============================================================================

/**
 * Requests state persistence.
 * Triggers serialization and storage write.
 */
export interface SaveAction {
  readonly type: "SAVE";
}

// ============================================================================
// LOAD ACTION
// ============================================================================

/**
 * Requests state restoration from storage.
 * Triggers storage read and deserialization.
 */
export interface LoadAction {
  readonly type: "LOAD";
}

// ============================================================================
// ACTION UNION
// ============================================================================

/**
 * Union type of all possible game actions.
 *
 * Design principles:
 * - Actions are intentions (what the player wants to do)
 * - Actions are validated by the reducer before state changes
 * - Actions are JSON-serializable for replay verification
 * - Actions don't contain computed values (only inputs)
 *
 * @example
 * // Advance time by one tick
 * const tickAction: Action = { type: "TICK" };
 *
 * // Upgrade a hero by 5 levels
 * const upgradeAction: Action = {
 *   type: "UPGRADE_HERO",
 *   heroId: "bard-1",
 *   levels: 5
 * };
 *
 * // Calculate offline progress
 * const offlineAction: Action = {
 *   type: "CALCULATE_OFFLINE",
 *   now: Date.now()
 * };
 *
 * // Save the game
 * const saveAction: Action = { type: "SAVE" };
 *
 * // Load the game
 * const loadAction: Action = { type: "LOAD" };
 */
export type Action =
  | TickAction
  | UpgradeHeroAction
  | CalculateOfflineAction
  | SaveAction
  | LoadAction;

// ============================================================================
// ACTION TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an action is a TickAction.
 */
export function isTickAction(action: Action): action is TickAction {
  return action.type === "TICK";
}

/**
 * Type guard to check if an action is an UpgradeHeroAction.
 */
export function isUpgradeHeroAction(
  action: Action
): action is UpgradeHeroAction {
  return action.type === "UPGRADE_HERO";
}

/**
 * Type guard to check if an action is a CalculateOfflineAction.
 */
export function isCalculateOfflineAction(
  action: Action
): action is CalculateOfflineAction {
  return action.type === "CALCULATE_OFFLINE";
}

/**
 * Type guard to check if an action is a SaveAction.
 */
export function isSaveAction(action: Action): action is SaveAction {
  return action.type === "SAVE";
}

/**
 * Type guard to check if an action is a LoadAction.
 */
export function isLoadAction(action: Action): action is LoadAction {
  return action.type === "LOAD";
}

// ============================================================================
// ACTION FACTORIES
// ============================================================================

/**
 * Creates a TICK action.
 */
export function tick(): TickAction {
  return { type: "TICK" };
}

/**
 * Creates an UPGRADE_HERO action.
 * @param heroId - The ID of the hero to upgrade
 * @param levels - Number of levels to attempt (defaults to 1)
 */
export function upgradeHero(heroId: string, levels?: number): UpgradeHeroAction {
  return { type: "UPGRADE_HERO", heroId, levels };
}

/**
 * Creates a CALCULATE_OFFLINE action.
 * @param now - Current timestamp in milliseconds
 */
export function calculateOffline(now: number): CalculateOfflineAction {
  return { type: "CALCULATE_OFFLINE", now };
}

/**
 * Creates a SAVE action.
 */
export function save(): SaveAction {
  return { type: "SAVE" };
}

/**
 * Creates a LOAD action.
 */
export function load(): LoadAction {
  return { type: "LOAD" };
}
