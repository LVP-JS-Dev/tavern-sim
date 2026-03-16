/**
 * CLI Entry Point
 *
 * Main entry point for the Tavern Tycoon Alpha text-based interface.
 * Provides a readline-based REPL (Read-Eval-Print Loop) for game interaction.
 *
 * @module cli
 */

import * as readline from "readline";
import { createInitialState } from "../state/initial";
import { reduce } from "../reducer";
import { createFileStorage } from "../persistence/file";
import type { Storage } from "../persistence/storage";
import { TICK_MS } from "../config/balance";
import type { GameState, DomainEvent } from "../types";
import {
  parseCommand,
  commandToAction,
  isStatusCommand,
  isTickCommand,
  isUpgradeCommand,
  isHeroesCommand,
  isIncomeCommand,
  isSaveCommand,
  isLoadCommand,
  isOfflineCommand,
  isResetCommand,
  isHelpCommand,
  isExitCommand,
  isEmptyCommand,
  isUnknownCommand,
  isAdventuresCommand,
  isVisitorsCommand,
  isStartAdventureCommand,
  isLogCommand,
  isEventsCommand,
  isNotificationsCommand,
  isMarkReadCommand,
  isWorldCommand,
  type ParsedCommand,
} from "./commands";
import {
  formatState,
  formatBriefStatus,
  formatHeroList,
  formatIncomeBreakdown,
  formatHelp,
  formatCommandHelp,
  formatEvents,
  formatGold,
  formatLogEntries,
  formatNotifications,
  formatWorldState,
} from "./display";

// ============================================================================
// CLI CONFIGURATION
// ============================================================================

/**
 * Default save file path.
 */
const DEFAULT_SAVE_PATH = "./savegame.json";

/**
 * CLI prompt string.
 */
const PROMPT = "> ";

// ============================================================================
// CLI STATE
// ============================================================================

/**
 * Internal state for the CLI session.
 */
interface CliState {
  /** Current game state */
  gameState: GameState;
  /** Storage backend for persistence */
  storage: Storage;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether the CLI should exit */
  shouldExit: boolean;
}

/**
 * Creates the initial CLI state.
 *
 * @param storage - Storage backend to use
 * @param gameState - Initial game state
 * @returns A new CliState
 */
function createCliState(storage: Storage, gameState: GameState): CliState {
  return {
    gameState,
    storage,
    isDirty: false,
    shouldExit: false,
  };
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Handles the STATUS command - displays current game state.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleStatus(state: CliState): string {
  return formatState(state.gameState);
}

/**
 * Handles the TICK command - advances game time.
 *
 * @param state - CLI state (mutated)
 * @param command - Parsed tick command
 * @returns Formatted output string
 */
function handleTick(state: CliState, command: ParsedCommand): string {
  if (!isTickCommand(command)) {
    return "Error: Invalid tick command";
  }

  const count = command.count;
  const events: DomainEvent[] = [];
  let currentState = state.gameState;
  const startNow = Date.now();

  // Process each tick with incremented timestamp
  for (let i = 0; i < count; i++) {
    const tickTime = startNow + i * TICK_MS;
    const result = reduce(currentState, { type: "TICK" }, tickTime);
    currentState = result.state;
    events.push(...result.events);
  }

  state.gameState = currentState;
  state.isDirty = true;

  // Build output
  const lines: string[] = [];
  lines.push(`⏱️  Advanced ${count} tick(s)`);

  // Sum up gold earned
  const goldEarned = events
    .filter((e): e is DomainEvent & { type: "GOLD_EARNED" } => e.type === "GOLD_EARNED")
    .reduce((sum, e) => sum + e.amount, 0);

  if (goldEarned > 0) {
    lines.push(`💰 Gold earned: ${formatGold(goldEarned)}g`);
  }

  return lines.join("\n");
}

/**
 * Handles the UPGRADE command - upgrades a hero.
 *
 * @param state - CLI state (mutated)
 * @param command - Parsed upgrade command
 * @returns Formatted output string
 */
function handleUpgrade(state: CliState, command: ParsedCommand): string {
  if (!isUpgradeCommand(command)) {
    return "Error: Invalid upgrade command";
  }

  const action = commandToAction(command, Date.now());
  if (!action) {
    return "Error: Could not convert command to action";
  }

  const result = reduce(state.gameState, action, Date.now());
  state.gameState = result.state;
  state.isDirty = true;

  // Format events
  const lines: string[] = [];
  for (const event of result.events) {
    lines.push(formatEvents([event]));
  }

  if (result.error) {
    lines.push(`❌ Error: ${result.error.message}`);
  }

  return lines.join("\n");
}

/**
 * Handles the HEROES command - lists all heroes.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleHeroes(state: CliState): string {
  return formatHeroList(state.gameState);
}

/**
 * Handles the adventures command.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleAdventures(state: CliState): string {
  const adventures = state.gameState.adventures?.adventures ?? [];
  if (adventures.length === 0) {
    return "📋 No active adventures.";
  }

  const lines = ["📋 Active Adventures:", ""];
  for (const adv of adventures) {
    const progress = Math.round(adv.progress * 100);
    const status = adv.status === 'completed' ? '✅' : adv.status === 'active' ? '🔄' : '⏳';
    lines.push(`  ${status} ${adv.id}: ${adv.type} (${progress}%) - Heroes: ${adv.heroIds.join(', ')}`);
  }
  return lines.join("\n");
}

/**
 * Handles the visitors command.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleVisitors(state: CliState): string {
  const visitors = state.gameState.director?.visitors ?? [];
  if (visitors.length === 0) {
    return "👥 No visitors in the tavern.";
  }

  const lines = ["👥 Current Visitors:", ""];
  for (const visitor of visitors) {
    const typeEmoji = visitor.type === 'noble' ? '👑' : visitor.type === 'merchant' ? '💰' : visitor.type === 'adventurer' ? '⚔️' : '🍺';
    lines.push(`  ${typeEmoji} ${visitor.id}: ${visitor.type}`);
  }
  return lines.join("\n");
}

/**
 * Handles the start-adventure command.
 *
 * @param state - CLI state
 * @param command - Start adventure command
 * @returns Formatted output string
 */
function handleStartAdventure(_state: CliState, command: { adventureType: string; heroIds: readonly string[] }): string {
  // For now, just acknowledge the command
  // Full implementation would use the adventure service
  return `⚔️ Starting ${command.adventureType} adventure with heroes: ${command.heroIds.join(', ')}`;
}

/**
 * Handles the LOG command - queries event log with filters.
 *
 * @param state - CLI state
 * @param command - Log command
 * @returns Formatted output string
 */
function handleLog(state: CliState, command: { filter?: { since?: number; until?: number; types?: readonly string[]; limit?: number } }): string {
  const eventLog = state.gameState.eventLog;
  let entries = eventLog.entries;

  // Apply type filter
  if (command.filter?.types && command.filter.types.length > 0) {
    entries = entries.filter(e => command.filter!.types!.includes(e.type));
  }

  // Apply time filter
  if (command.filter?.since) {
    entries = entries.filter(e => e.timestamp >= command.filter!.since!);
  }

  if (command.filter?.until) {
    entries = entries.filter(e => e.timestamp <= command.filter!.until!);
  }

  // Apply limit (take most recent entries)
  if (command.filter?.limit) {
    entries = entries.slice(-command.filter.limit);
  }

  return formatLogEntries(entries);
}

/**
 * Handles the EVENTS command - shows recent domain events.
 *
 * @param state - CLI state
 * @param command - Events command
 * @returns Formatted output string
 */
function handleEvents(_state: CliState, _command: { limit?: number }): string {
  // For now, return a placeholder since we don't track recent domain events in state
  // In a full implementation, this would show events from the last tick
  return "📋 Recent domain events:\n(No recent events to display)";
}

/**
 * Handles the NOTIFICATIONS command - shows notifications.
 *
 * @param state - CLI state
 * @param command - Notifications command
 * @returns Formatted output string
 */
function handleNotifications(state: CliState, command: { showRead: boolean }): string {
  let notifications = state.gameState.eventLog.notifications;

  if (!command.showRead) {
    notifications = notifications.filter(n => !n.isRead);
  }

  return formatNotifications(notifications);
}

/**
 * Handles the MARK_READ command - marks notifications as read.
 *
 * @param state - CLI state (mutated)
 * @param command - Mark read command
 * @returns Formatted output string
 */
function handleMarkRead(state: CliState, command: { ids: readonly string[] }): string {
  const currentNotifications = state.gameState.eventLog.notifications;
  const idsToMark = new Set(command.ids);

  // Create updated notifications with specified IDs marked as read
  const updatedNotifications = currentNotifications.map(n =>
    idsToMark.has(n.id) ? { ...n, isRead: true } : n
  );

  // Update state with modified notifications
  state.gameState = {
    ...state.gameState,
    eventLog: {
      ...state.gameState.eventLog,
      notifications: updatedNotifications,
    },
  };
  state.isDirty = true;

  const markedCount = updatedNotifications.filter(n => idsToMark.has(n.id) && n.isRead).length;
  return `✅ Marked ${markedCount} notification(s) as read.`;
}

/**
 * Handles the WORLD command - displays world state.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleWorld(state: CliState): string {
  return formatWorldState(state.gameState.world);
}

/**
 * Handles the INCOME command - shows income breakdown.
 *
 * @param state - CLI state
 * @returns Formatted output string
 */
function handleIncome(state: CliState): string {
  return formatIncomeBreakdown(state.gameState);
}

/**
 * Handles the SAVE command - saves game state to file.
 *
 * @param state - CLI state (mutated)
 * @param command - Parsed save command
 * @returns Formatted output string
 */
async function handleSave(state: CliState, command: ParsedCommand): Promise<string> {
  if (!isSaveCommand(command)) {
    return "Error: Invalid save command";
  }

  try {
    await state.storage.save(state.gameState);
    state.isDirty = false;
    return `✅ Game saved to ${DEFAULT_SAVE_PATH}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `❌ Failed to save: ${message}`;
  }
}

/**
 * Handles the LOAD command - loads game state from file.
 *
 * @param state - CLI state (mutated)
 * @param command - Parsed load command
 * @returns Formatted output string
 */
async function handleLoad(state: CliState, command: ParsedCommand): Promise<string> {
  if (!isLoadCommand(command)) {
    return "Error: Invalid load command";
  }

  try {
    const loadedState = await state.storage.load();
    state.gameState = loadedState;
    state.isDirty = false;
    return `✅ Game loaded from ${DEFAULT_SAVE_PATH}\n${formatBriefStatus(state.gameState)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `❌ Failed to load: ${message}`;
  }
}

/**
 * Handles the OFFLINE command - calculates and applies offline progress.
 *
 * @param state - CLI state (mutated)
 * @returns Formatted output string
 */
function handleOffline(state: CliState): string {
  const now = Date.now();
  const result = reduce(
    state.gameState,
    { type: "CALCULATE_OFFLINE", now },
    now
  );

  state.gameState = result.state;
  state.isDirty = true;

  const lines: string[] = [];
  for (const event of result.events) {
    lines.push(formatEvents([event]));
  }

  return lines.join("\n") || "No offline progress to apply.";
}

/**
 * Handles the RESET command - resets game to initial state.
 *
 * @param state - CLI state (mutated)
 * @returns Formatted output string
 */
function handleReset(state: CliState): string {
  state.gameState = createInitialState(Date.now(), Math.floor(Math.random() * 1000000));
  state.isDirty = true;
  return "🔄 Game reset to initial state.\nUse 'save' to persist the reset.";
}

/**
 * Handles the HELP command - shows help text.
 *
 * @param command - Parsed help command
 * @returns Formatted output string
 */
function handleHelp(command: ParsedCommand): string {
  if (!isHelpCommand(command)) {
    return "Error: Invalid help command";
  }

  if (command.command) {
    return formatCommandHelp(command.command);
  }

  return formatHelp();
}

/**
 * Handles the EXIT command - exits the CLI.
 *
 * @param state - CLI state (mutated)
 * @returns Formatted output string or null to exit immediately
 */
function handleExit(state: CliState): string | null {
  if (state.isDirty) {
    state.shouldExit = true;
    return "⚠️  You have unsaved changes. Use 'save' to persist, or 'exit' again to quit without saving.";
  }

  state.shouldExit = true;
  return null; // Exit immediately
}

// ============================================================================
// COMMAND PROCESSING
// ============================================================================

/**
 * Processes a single command and returns the output.
 *
 * @param state - CLI state
 * @param input - Raw user input
 * @returns Output string or null to exit
 */
async function processCommand(state: CliState, input: string): Promise<string | null> {
  const command = parseCommand(input);

  // Empty command - just show prompt again
  if (isEmptyCommand(command)) {
    return "";
  }

  // Unknown command
  if (isUnknownCommand(command)) {
    return `❌ ${command.error}`;
  }

  // Status
  if (isStatusCommand(command)) {
    return handleStatus(state);
  }

  // Tick
  if (isTickCommand(command)) {
    return handleTick(state, command);
  }

  // Upgrade
  if (isUpgradeCommand(command)) {
    return handleUpgrade(state, command);
  }

  // Heroes
  if (isHeroesCommand(command)) {
    return handleHeroes(state);
  }

  // Income
  if (isIncomeCommand(command)) {
    return handleIncome(state);
  }

  // Save
  if (isSaveCommand(command)) {
    return handleSave(state, command);
  }

  // Load
  if (isLoadCommand(command)) {
    return handleLoad(state, command);
  }

  // Offline
  if (isOfflineCommand(command)) {
    return handleOffline(state);
  }

  // Reset
  if (isResetCommand(command)) {
    return handleReset(state);
  }

  // Help
  if (isHelpCommand(command)) {
    return handleHelp(command);
  }

  // Exit
  if (isExitCommand(command)) {
    return handleExit(state);
  }

  // Adventures - list active adventures
  if (isAdventuresCommand(command)) {
    return handleAdventures(state);
  }

  // Visitors - list current visitors
  if (isVisitorsCommand(command)) {
    return handleVisitors(state);
  }

  // Start Adventure - begin a new adventure
  if (isStartAdventureCommand(command)) {
    return handleStartAdventure(state, command);
  }

  // Log - query event log
  if (isLogCommand(command)) {
    return handleLog(state, command);
  }

  // Events - show recent events
  if (isEventsCommand(command)) {
    return handleEvents(state, command);
  }

  // Notifications - show notifications
  if (isNotificationsCommand(command)) {
    return handleNotifications(state, command);
  }

  // Mark Read - mark notifications as read
  if (isMarkReadCommand(command)) {
    return handleMarkRead(state, command);
  }

  // World - display world state
  if (isWorldCommand(command)) {
    return handleWorld(state);
  }

  // This should never happen with TypeScript exhaustiveness checking
  const _exhaustive: never = command;
  return `Error: Unhandled command type: ${JSON.stringify(_exhaustive)}`;
}

// ============================================================================
// REPL LOOP
// ============================================================================

/**
 * Runs the main REPL loop.
 *
 * @param state - CLI state
 * @param rl - Readline interface
 */
async function runLoop(state: CliState, rl: readline.Interface): Promise<void> {
  const promptLoop = (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question(PROMPT, async (input) => {
        const output = await processCommand(state, input);

        // Check for exit
        if (output === null || state.shouldExit) {
          // Check if we're in dirty state and this is the second exit attempt
          if (state.isDirty && state.shouldExit) {
            // Allow exit without saving on second attempt
            rl.close();
            resolve();
            return;
          }

          // Clean exit
          rl.close();
          resolve();
          return;
        }

        // Display output
        if (output) {
          console.log(output);
        }

        // Continue loop
        resolve(promptLoop());
      });
    });
  };

  await promptLoop();
}

/**
 * Starts the CLI and runs until exit.
 *
 * @param state - CLI state
 */
async function startCli(state: CliState): Promise<void> {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
  });

  // Handle Ctrl+C gracefully
  rl.on("close", () => {
    if (state.isDirty) {
      console.log("\n⚠️  Unsaved changes discarded.");
    }
  });

  // Welcome message
  console.log("═══════════════════════════════════════");
  console.log("🏰 TAVERN TYCOON - Alpha v0.1.0");
  console.log("═══════════════════════════════════════");
  console.log("");
  console.log("Type 'help' to see available commands.");
  console.log("");

  // Show brief status
  console.log(formatBriefStatus(state.gameState));
  console.log("");

  // Run the main loop
  await runLoop(state, rl);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Main entry point for the CLI.
 *
 * Attempts to load an existing save, or creates a new game if none exists.
 */
async function main(): Promise<void> {
  // Initialize storage
  const storage = createFileStorage(DEFAULT_SAVE_PATH);

  // Try to load existing save
  let gameState: GameState;

  try {
    gameState = await storage.load();
    console.log(`✅ Loaded save from ${DEFAULT_SAVE_PATH}\n`);
  } catch {
    // No save file or corrupted - create new game
    gameState = createInitialState(Date.now(), Math.floor(Math.random() * 1000000));
    console.log(`🆕 Starting new game\n`);
  }

  // Create CLI state
  const state = createCliState(storage, gameState);

  // Start the CLI
  await startCli(state);
}

// Run main if this is the entry point
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main, startCli, processCommand };
