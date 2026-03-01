/**
 * CLI Command Parsing
 *
 * Parses user input strings into structured command objects.
 * Commands are mapped to domain actions or CLI-specific operations.
 *
 * @module cli/commands
 */

import type { Action } from "../types/actions";

// ============================================================================
// PARSED COMMAND TYPES
// ============================================================================

/**
 * Base interface for all parsed commands.
 */
interface ParsedCommandBase {
  /** Original raw input string */
  readonly raw: string;
}

/**
 * Status command - display current game state.
 */
export interface StatusCommand extends ParsedCommandBase {
  readonly type: "STATUS";
}

/**
 * Tick command - advance game time.
 */
export interface TickCommand extends ParsedCommandBase {
  readonly type: "TICK";
  /** Number of ticks to advance (default: 1) */
  readonly count: number;
}

/**
 * Upgrade command - upgrade a hero.
 */
export interface UpgradeCommand extends ParsedCommandBase {
  readonly type: "UPGRADE";
  /** ID of the hero to upgrade */
  readonly heroId: string;
  /** Number of levels to attempt (default: 1) */
  readonly levels: number;
}

/**
 * Heroes command - list all heroes.
 */
export interface HeroesCommand extends ParsedCommandBase {
  readonly type: "HEROES";
}

/**
 * Income command - show income breakdown.
 */
export interface IncomeCommand extends ParsedCommandBase {
  readonly type: "INCOME";
}

/**
 * Save command - save game state.
 */
export interface SaveCommand extends ParsedCommandBase {
  readonly type: "SAVE";
  /** Optional filename (uses default if not specified) */
  readonly filename?: string;
}

/**
 * Load command - load game state.
 */
export interface LoadCommand extends ParsedCommandBase {
  readonly type: "LOAD";
  /** Optional filename (uses default if not specified) */
  readonly filename?: string;
}

/**
 * Offline command - calculate and apply offline progress.
 */
export interface OfflineCommand extends ParsedCommandBase {
  readonly type: "OFFLINE";
}

/**
 * Reset command - reset game to initial state.
 */
export interface ResetCommand extends ParsedCommandBase {
  readonly type: "RESET";
}

/**
 * Help command - show help text.
 */
export interface HelpCommand extends ParsedCommandBase {
  readonly type: "HELP";
  /** Optional specific command to get help for */
  readonly command?: string;
}

/**
 * Exit command - exit the CLI.
 */
export interface ExitCommand extends ParsedCommandBase {
  readonly type: "EXIT";
}

/**
 * Unknown command - parsing failed.
 */
export interface UnknownCommand extends ParsedCommandBase {
  readonly type: "UNKNOWN";
  /** Error message explaining why parsing failed */
  readonly error: string;
}

/**
 * Empty command - blank input (whitespace only).
 */
export interface EmptyCommand extends ParsedCommandBase {
  readonly type: "EMPTY";
}

/**
 * Union type of all parsed command types.
 */
export type ParsedCommand =
  | StatusCommand
  | TickCommand
  | UpgradeCommand
  | HeroesCommand
  | IncomeCommand
  | SaveCommand
  | LoadCommand
  | OfflineCommand
  | ResetCommand
  | HelpCommand
  | ExitCommand
  | UnknownCommand
  | EmptyCommand;

// ============================================================================
// COMMAND PARSING
// ============================================================================

/**
 * Tokenizes a command string into parts.
 * Handles quoted strings for arguments with spaces.
 *
 * @param input - Raw input string
 * @returns Array of tokens
 */
function tokenize(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed === "") {
    return [];
  }

  // Simple tokenization by whitespace
  // For now, we don't need quoted string support
  return trimmed.split(/\s+/);
}

/**
 * Parses a positive integer from a string.
 * Returns null if not a valid positive integer.
 *
 * @param value - String to parse
 * @returns Parsed number or null
 */
function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Parses a command string into a structured ParsedCommand object.
 *
 * Supported commands:
 * - status: Display current game state
 * - tick [count]: Advance time by one or more ticks
 * - upgrade <heroId> [levels]: Upgrade a hero
 * - heroes: List all heroes
 * - income: Show income breakdown
 * - save [filename]: Save game state
 * - load [filename]: Load game state
 * - offline: Calculate and apply offline progress
 * - reset: Reset game to initial state
 * - help [command]: Show help
 * - exit: Exit the CLI
 *
 * @param input - Raw command string from user
 * @returns Parsed command object
 *
 * @example
 * parseCommand("tick 5");
 * // { type: "TICK", count: 5, raw: "tick 5" }
 *
 * parseCommand("upgrade bard-1 3");
 * // { type: "UPGRADE", heroId: "bard-1", levels: 3, raw: "upgrade bard-1 3" }
 *
 * parseCommand("help");
 * // { type: "HELP", raw: "help" }
 */
export function parseCommand(input: string): ParsedCommand {
  const tokens = tokenize(input);

  // Empty input
  if (tokens.length === 0) {
    return { type: "EMPTY", raw: input };
  }

  const [command, ...args] = tokens;
  const normalizedCommand = command.toLowerCase();

  switch (normalizedCommand) {
    case "status":
    case "s":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'status' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "STATUS", raw: input };

    case "tick":
    case "t":
      return parseTickCommand(input, args);

    case "upgrade":
    case "u":
      return parseUpgradeCommand(input, args);

    case "heroes":
    case "h":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'heroes' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "HEROES", raw: input };

    case "income":
    case "i":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'income' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "INCOME", raw: input };

    case "save":
      return parseSaveCommand(input, args);

    case "load":
      return parseLoadCommand(input, args);

    case "offline":
    case "o":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'offline' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "OFFLINE", raw: input };

    case "reset":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'reset' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "RESET", raw: input };

    case "help":
    case "?":
      return parseHelpCommand(input, args);

    case "exit":
    case "quit":
    case "q":
      if (args.length > 0) {
        return {
          type: "UNKNOWN",
          raw: input,
          error: `Command 'exit' takes no arguments. Got: ${args.join(" ")}`,
        };
      }
      return { type: "EXIT", raw: input };

    default:
      return {
        type: "UNKNOWN",
        raw: input,
        error: `Unknown command: '${command}'. Type 'help' to see available commands.`,
      };
  }
}

/**
 * Parse tick command arguments.
 */
function parseTickCommand(input: string, args: string[]): TickCommand | UnknownCommand {
  if (args.length === 0) {
    return { type: "TICK", count: 1, raw: input };
  }

  if (args.length > 1) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Command 'tick' takes at most one argument. Got: ${args.join(" ")}`,
    };
  }

  const count = parsePositiveInt(args[0]);
  if (count === null) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Invalid tick count: '${args[0]}'. Must be a positive integer.`,
    };
  }

  return { type: "TICK", count, raw: input };
}

/**
 * Parse upgrade command arguments.
 */
function parseUpgradeCommand(input: string, args: string[]): UpgradeCommand | UnknownCommand {
  if (args.length === 0) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: "Command 'upgrade' requires a hero ID. Usage: upgrade <heroId> [levels]",
    };
  }

  const heroId = args[0];

  if (args.length === 1) {
    return { type: "UPGRADE", heroId, levels: 1, raw: input };
  }

  if (args.length > 2) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Command 'upgrade' takes at most two arguments. Got: ${args.join(" ")}`,
    };
  }

  const levels = parsePositiveInt(args[1]);
  if (levels === null) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Invalid level count: '${args[1]}'. Must be a positive integer.`,
    };
  }

  return { type: "UPGRADE", heroId, levels, raw: input };
}

/**
 * Parse save command arguments.
 */
function parseSaveCommand(input: string, args: string[]): SaveCommand | UnknownCommand {
  if (args.length === 0) {
    return { type: "SAVE", raw: input };
  }

  if (args.length > 1) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Command 'save' takes at most one argument (filename). Got: ${args.join(" ")}`,
    };
  }

  return { type: "SAVE", filename: args[0], raw: input };
}

/**
 * Parse load command arguments.
 */
function parseLoadCommand(input: string, args: string[]): LoadCommand | UnknownCommand {
  if (args.length === 0) {
    return { type: "LOAD", raw: input };
  }

  if (args.length > 1) {
    return {
      type: "UNKNOWN",
      raw: input,
      error: `Command 'load' takes at most one argument (filename). Got: ${args.join(" ")}`,
    };
  }

  return { type: "LOAD", filename: args[0], raw: input };
}

/**
 * Parse help command arguments.
 */
function parseHelpCommand(input: string, args: string[]): HelpCommand {
  if (args.length === 0) {
    return { type: "HELP", raw: input };
  }

  // Help takes an optional command name
  return { type: "HELP", command: args[0].toLowerCase(), raw: input };
}

// ============================================================================
// COMMAND TO ACTION CONVERSION
// ============================================================================

/**
 * Converts a parsed command to a domain action, if applicable.
 * Some commands (like 'status', 'help', 'exit') don't map to actions.
 *
 * @param command - Parsed command
 * @param now - Current timestamp (for time-dependent commands)
 * @returns Domain action or null if command doesn't map to an action
 *
 * @example
 * const cmd = parseCommand("tick 5");
 * const action = commandToAction(cmd, Date.now());
 * // { type: "TICK" } (note: tick count is handled by repeated dispatch)
 */
export function commandToAction(
  command: ParsedCommand,
  now: number
): Action | null {
  switch (command.type) {
    case "TICK":
      // Single tick action (caller handles count by dispatching multiple times)
      return { type: "TICK" };

    case "UPGRADE":
      if (command.levels === 1) {
        return { type: "UPGRADE_HERO", heroId: command.heroId };
      }
      return { type: "UPGRADE_HERO", heroId: command.heroId, levels: command.levels };

    case "OFFLINE":
      return { type: "CALCULATE_OFFLINE", now };

    case "SAVE":
      return { type: "SAVE" };

    case "LOAD":
      return { type: "LOAD" };

    // Commands that don't map to domain actions
    case "STATUS":
    case "HEROES":
    case "INCOME":
    case "RESET":
    case "HELP":
    case "EXIT":
    case "EMPTY":
    case "UNKNOWN":
      return null;
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a command is a StatusCommand.
 */
export function isStatusCommand(cmd: ParsedCommand): cmd is StatusCommand {
  return cmd.type === "STATUS";
}

/**
 * Type guard to check if a command is a TickCommand.
 */
export function isTickCommand(cmd: ParsedCommand): cmd is TickCommand {
  return cmd.type === "TICK";
}

/**
 * Type guard to check if a command is an UpgradeCommand.
 */
export function isUpgradeCommand(cmd: ParsedCommand): cmd is UpgradeCommand {
  return cmd.type === "UPGRADE";
}

/**
 * Type guard to check if a command is a HeroesCommand.
 */
export function isHeroesCommand(cmd: ParsedCommand): cmd is HeroesCommand {
  return cmd.type === "HEROES";
}

/**
 * Type guard to check if a command is an IncomeCommand.
 */
export function isIncomeCommand(cmd: ParsedCommand): cmd is IncomeCommand {
  return cmd.type === "INCOME";
}

/**
 * Type guard to check if a command is a SaveCommand.
 */
export function isSaveCommand(cmd: ParsedCommand): cmd is SaveCommand {
  return cmd.type === "SAVE";
}

/**
 * Type guard to check if a command is a LoadCommand.
 */
export function isLoadCommand(cmd: ParsedCommand): cmd is LoadCommand {
  return cmd.type === "LOAD";
}

/**
 * Type guard to check if a command is an OfflineCommand.
 */
export function isOfflineCommand(cmd: ParsedCommand): cmd is OfflineCommand {
  return cmd.type === "OFFLINE";
}

/**
 * Type guard to check if a command is a ResetCommand.
 */
export function isResetCommand(cmd: ParsedCommand): cmd is ResetCommand {
  return cmd.type === "RESET";
}

/**
 * Type guard to check if a command is a HelpCommand.
 */
export function isHelpCommand(cmd: ParsedCommand): cmd is HelpCommand {
  return cmd.type === "HELP";
}

/**
 * Type guard to check if a command is an ExitCommand.
 */
export function isExitCommand(cmd: ParsedCommand): cmd is ExitCommand {
  return cmd.type === "EXIT";
}

/**
 * Type guard to check if a command is an UnknownCommand.
 */
export function isUnknownCommand(cmd: ParsedCommand): cmd is UnknownCommand {
  return cmd.type === "UNKNOWN";
}

/**
 * Type guard to check if a command is an EmptyCommand.
 */
export function isEmptyCommand(cmd: ParsedCommand): cmd is EmptyCommand {
  return cmd.type === "EMPTY";
}
