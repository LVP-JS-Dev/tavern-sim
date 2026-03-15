/**
 * Heroes Pipeline Plugin
 *
 * Processes hero-related state changes including income generation.
 * This is the core income generation step of the tick pipeline.
 *
 * @module domain/pipeline/plugins/heroes
 */

import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { calculateTotalIncome } from '../../../economy/income';
import { calculateIncomePerTick } from '../../../config/balance';
import { goldEarned } from '../../../types/events';

/**
 * Heroes plugin - processes hero income generation.
 *
 * This plugin:
 * 1. Calculates total income per second from all heroes
 * 2. Converts to income per tick
 * 3. Adds gold to wallet and lifetime earnings
 * 4. Emits GOLD_EARNED event
 */
export const heroesPlugin: TickPlugin = {
  name: 'heroes',
  order: PLUGIN_ORDER.HEROES,

  process(ctx: TickContext): TickResult {
    const { state, now } = ctx;

    // Calculate total income from all heroes
    const incomePerSecondU = calculateTotalIncome(state.heroes.roster);

    // If no income (no heroes or all at level 0), return unchanged
    if (incomePerSecondU <= 0) {
      return { state, events: [] };
    }

    // Calculate income for this tick
    const incomeThisTick = calculateIncomePerTick(incomePerSecondU);

    // Create new state with updated wallet
    const newState = {
      ...state,
      wallet: {
        ...state.wallet,
        gold: state.wallet.gold + incomeThisTick,
        lifetimeEarnedGold: state.wallet.lifetimeEarnedGold + incomeThisTick,
      },
    };

    // Emit gold earned event
    const events = [goldEarned(incomeThisTick, 'TICK', now)];

    return { state: newState, events };
  },
};
