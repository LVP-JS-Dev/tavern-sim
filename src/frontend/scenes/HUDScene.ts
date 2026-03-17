import Phaser from 'phaser';
import { getBridge, consumeOfflineProgress } from '@/frontend/index';
import { GoldDisplay } from '@/frontend/ui/GoldDisplay';
import { TavernUpgradePanel } from '@/frontend/ui/TavernUpgradePanel';
import type { StateBridge } from '@/frontend/bridge/types';
import type { GameState, GoldU } from '@/types';

export class HUDScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;

  private goldDisplay!: GoldDisplay;
  private toastContainer?: Phaser.GameObjects.Container;
  private upgradePanel!: TavernUpgradePanel;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Register shutdown handler for cleanup
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Create gold display
    this.goldDisplay = new GoldDisplay(this, 10, 10);

    // Create upgrade panel
    this.upgradePanel = new TavernUpgradePanel(this);

    // Subscribe to state
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.updateUI(state);
    });

    // Create menu button
    this.createMenuButton();

    // Create upgrade button
    this.createUpgradeButton();

    // Initial update
    this.updateUI(this.bridge.getState());

    // Show offline progress toast if available
    this.showOfflineProgressToast();
  }

  private showOfflineProgressToast(): void {
    const progress = consumeOfflineProgress();
    if (!progress) return;

    const width = this.cameras.main.width;

    // Create toast container at top center
    this.toastContainer = this.add.container(width / 2, 100);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-150, -30, 300, 60, 10);
    this.toastContainer.add(bg);

    // Gold icon
    const goldIcon = this.add.text(-130, 0, '🪙', { fontSize: '24px' });
    goldIcon.setOrigin(0, 0.5);
    this.toastContainer.add(goldIcon);

    // Text
    const text = this.add.text(-100, 0, `While away: +${progress.goldEarned.toFixed(1)} gold`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffd700',
      fontStyle: 'bold',
    });
    text.setOrigin(0, 0.5);
    this.toastContainer.add(text);

    // Animate in
    this.toastContainer.setAlpha(0);
    this.toastContainer.setY(80);

    this.tweens.add({
      targets: this.toastContainer,
      alpha: 1,
      y: 100,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Auto-dismiss after 3 seconds
    this.time.delayedCall(3000, () => {
      this.dismissToast();
    });
  }

  private dismissToast(): void {
    if (!this.toastContainer) return;

    this.tweens.add({
      targets: this.toastContainer,
      alpha: 0,
      y: 80,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.toastContainer?.destroy();
        delete this.toastContainer;
      },
    });
  }

  private createMenuButton(): void {
    const button = this.add.text(325, 10, '⚙️', {
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

  private createUpgradeButton(): void {
    const button = this.add.container(340, 40);

    const bg = this.add.graphics();
    bg.fillStyle(0x4a4a6a, 1);
    bg.fillRoundedRect(-25, -15, 50, 30, 8);
    button.add(bg);

    const text = this.add.text(0, 0, '🔨', {
      fontSize: '18px',
    });
    text.setOrigin(0.5, 0.5);
    button.add(text);

    const hitArea = this.add.rectangle(0, 0, 50, 30, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    button.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.upgradePanel.toggle();
    });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x5a5a7a, 1);
      bg.fillRoundedRect(-25, -15, 50, 30, 8);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x4a4a6a, 1);
      bg.fillRoundedRect(-25, -15, 50, 30, 8);
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
    this.upgradePanel.destroy();
  }
}
