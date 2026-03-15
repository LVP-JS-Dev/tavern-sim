import Phaser from 'phaser';
import { getBridge } from '../index';
import { CANVAS_WIDTH } from '../config';
import { GoldDisplay } from '../ui/GoldDisplay';
import type { StateBridge } from '../bridge/types';
import type { GameState, GoldU } from '../../types';

export class HUDScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;

  private goldDisplay!: GoldDisplay;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Create gold display
    this.goldDisplay = new GoldDisplay(this, 15, 30);

    // Subscribe to state
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.updateUI(state);
    });

    // Create menu button
    this.createMenuButton();

    // Initial update
    this.updateUI(this.bridge.getState());
  }

  private createMenuButton(): void {
    const button = this.add.text(CANVAS_WIDTH - 50, 30, '⚙️', {
      fontSize: '28px',
    });
    button.setOrigin(0.5, 0.5);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      console.log('[HUD] Menu button clicked');
      // TODO: Open menu scene
    });

    button.on('pointerover', () => {
      button.setScale(1.1);
    });

    button.on('pointerout', () => {
      button.setScale(1);
    });
  }

  private updateUI(state: GameState): void {
    const gold = state.wallet.gold;
    const incomePerSecond = this.calculateIncomePerSecond(state);

    this.goldDisplay.update(gold, incomePerSecond);
  }

  private calculateIncomePerSecond(state: GameState): GoldU {
    const roster = state.heroes.roster;
    return Object.values(roster).reduce(
      (sum, hero) => sum + (hero.incomePerSecondU ?? 0),
      0
    ) as GoldU;
  }

  shutdown(): void {
    this.unsubscribe?.();
  }
}
