/**
 * CLI Display Formatting Functions
 *
 * Provides functions for formatting game state and help text
 * for display in the terminal-based CLI interface.
 *
 * @module cli/display
 */

import type { GameState, GoldU } from "../types/state";
import { GOLD_MULTIPLIER } from "../config/balance";
import { calculateTotalIncome } from "../economy/income";
import { getHeroConfig, getAllHeroes } from "../config/heroes";

// ============================================================================
// GOLD FORMATTING
// ============================================================================

/**
 * Convert fixed-point gold to display string.
 * Handles the conversion from internal representation (GoldU) to human-readable format.
 *
 * @param goldU - Gold amount in fixed-point units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted gold string
 *
 * @example
 * formatGold(1500); // "1.50"
 * formatGold(10000); // "10.00"
 * formatGold(1234567, 1); // "1234.6"
 */
export function formatGold(goldU: GoldU, decimals: number = 2): string {
  const gold = goldU / GOLD_MULTIPLIER;
  return gold.toFixed(decimals);
}

/**
 * Format gold with currency suffix.
 *
 * @param goldU - Gold amount in fixed-point units
 * @returns Formatted string with "g" suffix
 *
 * @example
 * formatGoldWithSuffix(1500); // "1.50g"
 */
export function formatGoldWithSuffix(goldU: GoldU): string {
  return `${formatGold(goldU)}g`;
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format a duration in milliseconds to human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(5000); // "5s"
 * formatDuration(90000); // "1m 30s"
 * formatDuration(3723000); // "1h 2m 3s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format a timestamp to localized date-time string.
 *
 * @param timestampMs - Unix timestamp in milliseconds
 * @returns Formatted date-time string
 *
 * @example
 * formatTimestamp(1709304000000); // "2024-03-01 12:00:00"
 */
export function formatTimestamp(timestampMs: number): string {
  const date = new Date(timestampMs);
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace("T", " ");
}

// ============================================================================
// STATE FORMATTING
// ============================================================================

/**
 * Format the complete game state for CLI display.
 * Produces a multi-line string with all relevant state information.
 *
 * @param state - The game state to format
 * @returns Formatted state string for display
 *
 * @example
 * const displayText = formatState(gameState);
 * console.log(displayText);
 * // ═══════════════════════════════════════
 * // 🏰 TAVERN TYCOON - Status
 * // ═══════════════════════════════════════
 * // 💰 Gold: 1,234.56g (Lifetime: 5,000.00g)
 * // 📊 Income: 10.50g/s
 * // ...
 */
export function formatState(state: GameState): string {
  const lines: string[] = [];
  const separator = "═".repeat(40);

  // Header
  lines.push(separator);
  lines.push("🏰 TAVERN TYCOON - Status");
  lines.push(separator);
  lines.push("");

  // Wallet section
  const goldDisplay = formatGold(state.wallet.gold);
  const lifetimeDisplay = formatGold(state.wallet.lifetimeEarnedGold);
  lines.push(`💰 Gold: ${goldDisplay}g (Lifetime: ${lifetimeDisplay}g)`);

  // Income calculation
  const totalIncomePerSecond = calculateTotalIncome(state.heroes.roster);
  const incomeDisplay = formatGold(totalIncomePerSecond);
  lines.push(`📊 Income: ${incomeDisplay}g/s`);
  lines.push("");

  // Tavern section
  lines.push(`🏗️  Tavern Level: ${state.tavern.level}`);
  lines.push("");

  // Heroes section
  lines.push("👥 Heroes:");
  lines.push("─".repeat(40));

  // Check if there are any heroes in the roster
  const hasHeroes = Object.keys(state.heroes.roster).length > 0 &&
    state.heroes.order.some(id => state.heroes.roster[id]);

  if (!hasHeroes) {
    lines.push("   No heroes hired yet.");
  } else {
    // Display heroes in order
    for (const heroId of state.heroes.order) {
      const heroState = state.heroes.roster[heroId];
      const heroConfig = getHeroConfig(heroId);

      if (heroState && heroConfig) {
        const level = heroState.level;
        const income = formatGold(heroState.incomePerSecondU * level);
        const incomePerSec = formatGold(heroState.incomePerSecondU);
        lines.push(`   ${heroConfig.name} (Lv.${level})`);
        lines.push(`      Income: ${income}g/s (${incomePerSec}g/s per level)`);
      }
    }
  }

  lines.push("");

  // Time section
  lines.push("⏱️  Time:");
  lines.push("─".repeat(40));
  lines.push(`   Last tick: ${formatTimestamp(state.time.lastTickAtMs)}`);
  lines.push(`   Created: ${formatTimestamp(state.meta.createdAtMs)}`);

  const timeSinceLastTick = Date.now() - state.time.lastTickAtMs;
  if (timeSinceLastTick > 0) {
    lines.push(`   Time since last tick: ${formatDuration(timeSinceLastTick)}`);
  }

  lines.push("");
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Format a brief one-line status summary.
 * Useful for prompts or compact displays.
 *
 * @param state - The game state to format
 * @returns Single-line status string
 *
 * @example
 * const brief = formatBriefStatus(state);
 * // "💰 1,234.56g | 📊 10.50g/s | 👥 3 heroes"
 */
export function formatBriefStatus(state: GameState): string {
  const gold = formatGold(state.wallet.gold);
  const income = formatGold(calculateTotalIncome(state.heroes.roster));
  const heroCount = state.heroes.order.length;

  return `💰 ${gold}g | 📊 ${income}g/s | 👥 ${heroCount} heroes`;
}

// ============================================================================
// HERO FORMATTING
// ============================================================================

/**
 * Format the hero roster for display, including heroes not yet hired.
 * Shows all available heroes with their stats and upgrade costs.
 *
 * @param state - The game state to format
 * @returns Formatted hero list string
 *
 * @example
 * const heroList = formatHeroList(gameState);
 * console.log(heroList);
 * // ═══════════════════════════════════════
 * // 👥 HEROES
 * // ═══════════════════════════════════════
 * // ✅ Barkeep (Lv.5)
 * //    Income: 5.00g/s
 * //    Next upgrade: 15.00g
 * // ...
 */
export function formatHeroList(state: GameState): string {
  const lines: string[] = [];
  const separator = "═".repeat(40);

  lines.push(separator);
  lines.push("👥 HEROES");
  lines.push(separator);
  lines.push("");

  const allHeroes = getAllHeroes();

  for (const heroConfig of allHeroes) {
    const ownedHero = state.heroes.roster[heroConfig.id];
    const isOwned = ownedHero !== undefined;

    if (isOwned) {
      // Owned hero
      const level = ownedHero.level;
      const income = formatGold(ownedHero.incomePerSecondU * level);
      const nextCost = formatGold(
        Math.floor(heroConfig.baseUpgradeCost * Math.pow(heroConfig.upgradeMultiplier, level))
      );

      lines.push(`✅ ${heroConfig.name} (Lv.${level})`);
      lines.push(`   Income: ${income}g/s`);
      lines.push(`   Next upgrade: ${nextCost}g`);
    } else {
      // Not yet hired
      const baseCost = formatGold(heroConfig.baseUpgradeCost);
      const baseIncome = formatGold(heroConfig.baseIncomePerSecond);

      lines.push(`⬜ ${heroConfig.name} (Not hired)`);
      lines.push(`   Base income: ${baseIncome}g/s at Lv.1`);
      lines.push(`   Cost to hire: ${baseCost}g`);
    }
    lines.push("");
  }

  lines.push(separator);

  return lines.join("\n");
}

// ============================================================================
// INCOME FORMATTING
// ============================================================================

/**
 * Format income breakdown by hero for display.
 * Shows each hero's contribution to total income.
 *
 * @param state - The game state to format
 * @returns Formatted income breakdown string
 *
 * @example
 * const incomeText = formatIncomeBreakdown(gameState);
 * console.log(incomeText);
 * // ═══════════════════════════════════════
 * // 📊 INCOME BREAKDOWN
 * // ═══════════════════════════════════════
 * // Barkeep: 5.00g/s (Lv.5 @ 1.00g/s per level)
 * // Bard: 7.50g/s (Lv.3 @ 2.50g/s per level)
 * // ─────────────────────────────────────────
 * // TOTAL: 12.50g/s
 */
export function formatIncomeBreakdown(state: GameState): string {
  const lines: string[] = [];
  const separator = "═".repeat(40);

  lines.push(separator);
  lines.push("📊 INCOME BREAKdown");
  lines.push(separator);
  lines.push("");

  // Check actual roster, not just order
  const rosterKeys = Object.keys(state.heroes.roster);
  if (rosterKeys.length === 0) {
    lines.push("No heroes hired yet. No income generated.");
    lines.push("");
    lines.push(separator);
    return lines.join("\n");
  }

  let totalIncome = 0;

  for (const heroId of state.heroes.order) {
    const heroState = state.heroes.roster[heroId];
    const heroConfig = getHeroConfig(heroId);

    if (heroState && heroConfig) {
      const level = heroState.level;
      const incomeFromHero = heroState.incomePerSecondU * level;
      totalIncome += incomeFromHero;

      const incomeDisplay = formatGold(incomeFromHero);
      const perLevelDisplay = formatGold(heroState.incomePerSecondU);

      lines.push(`${heroConfig.name}:`);
      lines.push(`   Income: ${incomeDisplay}g/s (Lv.${level} @ ${perLevelDisplay}g/s per level)`);
    }
  }

  lines.push("");
  lines.push("─".repeat(40));
  lines.push(`TOTAL: ${formatGold(totalIncome)}g/s`);
  lines.push("");
  lines.push(separator);

  return lines.join("\n");
}

// ============================================================================
// HELP FORMATTING
// ============================================================================

/**
 * Available CLI commands with descriptions.
 */
interface CommandInfo {
  /** Command name */
  name: string;
  /** Command syntax/usage */
  usage: string;
  /** Short description */
  description: string;
  /** Extended help text */
  help?: string;
}

/**
 * List of available CLI commands.
 */
const COMMANDS: CommandInfo[] = [
  {
    name: "status",
    usage: "status",
    description: "Display current game state",
  },
  {
    name: "tick",
    usage: "tick [count]",
    description: "Advance game time by one or more ticks",
    help: "Without count, advances by 1 tick. With count, advances that many ticks.",
  },
  {
    name: "upgrade",
    usage: "upgrade <heroId> [levels]",
    description: "Upgrade a hero by specified levels (default: 1)",
    help: "If you don't have enough gold for all levels, partial upgrades will be applied.",
  },
  {
    name: "heroes",
    usage: "heroes",
    description: "List all heroes with their stats and costs",
  },
  {
    name: "income",
    usage: "income",
    description: "Show income breakdown by hero",
  },
  {
    name: "save",
    usage: "save [filename]",
    description: "Save game state to file",
    help: "Without filename, saves to default location.",
  },
  {
    name: "load",
    usage: "load [filename]",
    description: "Load game state from file",
    help: "Without filename, loads from default location.",
  },
  {
    name: "offline",
    usage: "offline",
    description: "Calculate and apply offline progress",
    help: "Calculates gold earned since last tick and applies it to your wallet.",
  },
  {
    name: "reset",
    usage: "reset",
    description: "Reset game to initial state",
    help: "WARNING: This will erase all progress!",
  },
  {
    name: "help",
    usage: "help [command]",
    description: "Show help for all commands or a specific command",
  },
  {
    name: "exit",
    usage: "exit",
    description: "Exit the game (prompts to save if there are unsaved changes)",
  },
];

/**
 * Format help text for all CLI commands.
 *
 * @returns Formatted help string
 *
 * @example
 * console.log(formatHelp());
 * // ═══════════════════════════════════════
 * // 📖 TAVERN TYCOON - Commands
 * // ═══════════════════════════════════════
 * // ...
 */
export function formatHelp(): string {
  const lines: string[] = [];
  const separator = "═".repeat(40);

  lines.push(separator);
  lines.push("📖 TAVERN TYCOON - Commands");
  lines.push(separator);
  lines.push("");

  for (const cmd of COMMANDS) {
    lines.push(`▸ ${cmd.usage}`);
    lines.push(`  ${cmd.description}`);
    if (cmd.help) {
      lines.push(`  ${cmd.help}`);
    }
    lines.push("");
  }

  lines.push(separator);
  lines.push("💡 Tip: Type 'help <command>' for detailed help on a specific command.");
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Format help text for a specific command.
 *
 * @param commandName - Name of the command to show help for
 * @returns Formatted help string for the command, or error message if not found
 *
 * @example
 * console.log(formatCommandHelp("upgrade"));
 * // ═══════════════════════════════════════
 * // UPGRADE COMMAND
 * // ═══════════════════════════════════════
 * // Usage: upgrade <heroId> [levels]
 * // ...
 */
export function formatCommandHelp(commandName: string): string {
  const cmd = COMMANDS.find(
    (c) => c.name === commandName.toLowerCase()
  );

  if (!cmd) {
    return `Unknown command: ${commandName}\nType 'help' to see available commands.`;
  }

  const lines: string[] = [];
  const separator = "═".repeat(40);

  lines.push(separator);
  lines.push(`${cmd.name.toUpperCase()} COMMAND`);
  lines.push(separator);
  lines.push("");
  lines.push(`Usage: ${cmd.usage}`);
  lines.push("");
  lines.push(`Description:`);
  lines.push(`  ${cmd.description}`);
  lines.push("");

  if (cmd.help) {
    lines.push(`Details:`);
    lines.push(`  ${cmd.help}`);
    lines.push("");
  }

  lines.push(separator);

  return lines.join("\n");
}

// ============================================================================
// EVENT FORMATTING
// ============================================================================

import type { DomainEvent } from "../types/events";

/**
 * Format a domain event for CLI display.
 *
 * @param event - The domain event to format
 * @returns Formatted event string
 *
 * @example
 * const eventText = formatEvent({ type: "GOLD_EARNED", amount: 1000, ... });
 * // "💰 Earned 1.00g from TICK"
 */
export function formatEvent(event: DomainEvent): string {
  switch (event.type) {
    case "GOLD_EARNED":
      return `💰 Earned ${formatGoldWithSuffix(event.amount)} from ${event.source}`;

    case "HERO_UPGRADE_APPLIED":
      return `✅ Upgraded ${event.heroId} by ${event.appliedLevels} level(s) (cost: ${formatGoldWithSuffix(event.goldCost)})`;

    case "HERO_UPGRADE_REJECTED":
      return `❌ Upgrade rejected for ${event.heroId}: ${event.reason}`;

    case "OFFLINE_PROGRESS_APPLIED":
      return `⏰ Applied offline progress: ${formatGoldWithSuffix(event.goldEarned)} over ${formatDuration(event.deltaMs)}`;

    case "SECURITY_OFFLINE_CLAMPED":
      return `⚠️ Offline time capped at ${formatDuration(event.clampedToMs)} (was ${formatDuration(event.originalDeltaMs)})`;

    default:
      return `Event: ${JSON.stringify(event)}`;
  }
}

/**
 * Format multiple events for display.
 *
 * @param events - Array of domain events
 * @returns Formatted events string
 */
export function formatEvents(events: readonly DomainEvent[]): string {
  if (events.length === 0) {
    return "No events.";
  }

  const lines = events.map(formatEvent);
  return lines.join("\n");
}

// ============================================================================
// EVENT LOG FORMATTING
// ============================================================================

import type { LogEntry } from "../systems/event-log/types";

/**
 * Format log entries for CLI display.
 *
 * @param entries - Array of log entries
 * @returns Formatted log entries string
 */
export function formatLogEntries(entries: readonly LogEntry[]): string {
  if (entries.length === 0) {
    return "No events found.";
  }

  const lines: string[] = [];
  lines.push(`\n📜 Event Log (${entries.length} entries)\n`);

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    lines.push(`  [${time}] ${entry.type}: ${JSON.stringify(entry.data)}`);
  }

  return lines.join("\n");
}

// ============================================================================
// NOTIFICATION FORMATTING
// ============================================================================

import type { Notification } from "../systems/event-log/types";

/**
 * Format notifications for CLI display.
 *
 * @param notifications - Array of notifications
 * @returns Formatted notifications string
 */
export function formatNotifications(notifications: readonly Notification[]): string {
  if (notifications.length === 0) {
    return "No notifications.";
  }

  const lines: string[] = [];
  lines.push(`\n🔔 Notifications (${notifications.length})\n`);

  for (const n of notifications) {
    const icon = n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️';
    const read = n.isRead ? '' : ' (unread)';
    lines.push(`  ${icon} ${n.title}${read}`);
    lines.push(`     ${n.message}`);
  }

  return lines.join("\n");
}

// ============================================================================
// WORLD STATE FORMATTING
// ============================================================================

import type { WorldState } from "../systems/world/types";

/**
 * Format world state for CLI display.
 *
 * @param world - World state
 * @returns Formatted world state string
 */
export function formatWorldState(world: WorldState): string {
  const lines: string[] = [];

  lines.push(`\n🌍 World State`);
  lines.push(`  Day ${world.dayNumber} - ${world.timeOfDay}`);
  lines.push(`  Weather: ${world.weather}`);

  if (world.activeEvents.length > 0) {
    lines.push(`  Active Events: ${world.activeEvents.map(e => e.type).join(', ')}`);
  }

  return lines.join("\n");
}
