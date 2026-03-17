import Phaser from 'phaser';
import { getBridge } from '../index';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { UPGRADE_BRANCHES, getUpgradeCost, type UpgradeBranchId, type UpgradeBranchConfig } from '../../config/upgradeBranches';
import { upgradeTavern } from '../../types/actions';
import { isTavernUpgradeAppliedEvent } from '../../types/events';
import type { StateBridge } from '../bridge/types';
import type { GameState, GoldU } from '../../types';

/** Panel position when hidden (off-screen bottom) */
const PANEL_HIDDEN_Y = CANVAS_HEIGHT + 300;
/** Panel position when visible */
const PANEL_VISIBLE_Y = CANVAS_HEIGHT - 280;
/** Panel dimensions */
const PANEL_WIDTH = CANVAS_WIDTH - 20;
const PANEL_HEIGHT = 270;
/** Upgrade card dimensions */
const CARD_WIDTH = (PANEL_WIDTH - 50) / 2;
const CARD_HEIGHT = 90;
const CARD_PADDING = 10;

interface UpgradeCard {
  container: Phaser.GameObjects.Container;
  branchId: UpgradeBranchId;
  config: UpgradeBranchConfig;
  levelText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  effectText: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Container;
}

/**
 * Tavern Upgrade Panel - slide-up panel with 4 upgrade branches.
 * Shows current level, cost, and effect for each branch.
 */
export class TavernUpgradePanel {
  private scene: Phaser.Scene;
  private bridge: StateBridge;
  private panel: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private cards: Map<UpgradeBranchId, UpgradeCard> = new Map();
  private isOpen = false;
  private unsubscribe?: () => void;
  private unsubscribeEvents?: () => void;
  private lastState?: GameState;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bridge = getBridge();

    // Create backdrop (darkens game when panel is open)
    this.backdrop = scene.add.rectangle(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      0x000000,
      0
    );
    this.backdrop.setInteractive();
    this.backdrop.setDepth(150);
    this.backdrop.on('pointerdown', () => this.close());

    // Create main panel container
    this.panel = scene.add.container(CANVAS_WIDTH / 2, PANEL_HIDDEN_Y);
    this.panel.setDepth(160);

    // Panel background
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(-PANEL_WIDTH / 2, 0, PANEL_WIDTH, PANEL_HEIGHT, 16);
    bg.lineStyle(2, 0x4a4a6a);
    bg.strokeRoundedRect(-PANEL_WIDTH / 2, 0, PANEL_WIDTH, PANEL_HEIGHT, 16);
    this.panel.add(bg);

    // Title
    const title = scene.add.text(0, 15, 'Улучшения таверны', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffd700',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.panel.add(title);

    // Close button
    const closeBtn = scene.add.text(PANEL_WIDTH / 2 - 30, 15, '✕', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#888',
    });
    closeBtn.setOrigin(0.5, 0);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    closeBtn.on('pointerover', () => closeBtn.setColor('#fff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888'));
    this.panel.add(closeBtn);

    // Create upgrade cards
    this.createUpgradeCards();

    // Subscribe to state changes
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.lastState = state;
      this.updateCards(state);
    });

    // Subscribe to events for upgrade feedback
    this.unsubscribeEvents = this.bridge.subscribeToEvents((event) => {
      if (isTavernUpgradeAppliedEvent(event)) {
        // Play visual feedback only when upgrade is actually applied
        this.scene.cameras.main.flash(100, 255, 215, 0, false);
      }
    });

    // Initial update
    this.lastState = this.bridge.getState();
    this.updateCards(this.lastState);
  }

  private createUpgradeCards(): void {
    const branches: UpgradeBranchId[] = ['bar', 'kitchen', 'rooms', 'decor'];
    const startY = 50;

    branches.forEach((branchId, index) => {
      const config = UPGRADE_BRANCHES[branchId];
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = -PANEL_WIDTH / 2 + 15 + col * (CARD_WIDTH + CARD_PADDING) + CARD_WIDTH / 2;
      const y = startY + row * (CARD_HEIGHT + CARD_PADDING) + CARD_HEIGHT / 2;

      const card = this.createCard(branchId, config, x, y);
      this.cards.set(branchId, card);
      this.panel.add(card.container);
    });
  }

  private createCard(
    branchId: UpgradeBranchId,
    config: UpgradeBranchConfig,
    x: number,
    y: number
  ): UpgradeCard {
    const container = this.scene.add.container(x, y);

    // Card background
    const cardBg = this.scene.add.graphics();
    cardBg.fillStyle(0x2a2a4e, 1);
    cardBg.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 8);
    container.add(cardBg);

    // Branch name
    const nameText = this.scene.add.text(-CARD_WIDTH / 2 + 10, -CARD_HEIGHT / 2 + 8, config.name, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#fff',
      fontStyle: 'bold',
    });
    container.add(nameText);

    // Level text
    const levelText = this.scene.add.text(CARD_WIDTH / 2 - 10, -CARD_HEIGHT / 2 + 8, '0/5', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#888',
    });
    levelText.setOrigin(1, 0);
    container.add(levelText);

    // Effect text
    const effectText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#6a6',
    });
    effectText.setOrigin(0.5, 0.5);
    container.add(effectText);

    // Upgrade button container
    const button = this.scene.add.container(0, CARD_HEIGHT / 2 - 22);
    container.add(button);

    // Button background
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x4a4a6a, 1);
    btnBg.fillRoundedRect(-50, -12, 100, 24, 6);
    button.add(btnBg);

    // Button cost text
    const costText = this.scene.add.text(0, 0, '0.1g', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffd700',
    });
    costText.setOrigin(0.5, 0.5);
    button.add(costText);

    // Make button interactive
    const hitArea = this.scene.add.rectangle(0, 0, 100, 24, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    button.add(hitArea);

    hitArea.on('pointerdown', () => this.onUpgradeClick(branchId));
    hitArea.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x5a5a7a, 1);
      btnBg.fillRoundedRect(-50, -12, 100, 24, 6);
    });
    hitArea.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x4a4a6a, 1);
      btnBg.fillRoundedRect(-50, -12, 100, 24, 6);
    });

    return {
      container,
      branchId,
      config,
      levelText,
      costText,
      effectText,
      button,
    };
  }

  private updateCards(state: GameState): void {
    const gold = state.wallet.gold;

    this.cards.forEach((card, branchId) => {
      const currentLevel = state.tavern.upgrades[branchId] ?? 0;
      const maxLevel = card.config.maxLevel;
      const isMaxed = currentLevel >= maxLevel;

      // Update level text
      card.levelText.setText(`${currentLevel}/${maxLevel}`);
      card.levelText.setColor(isMaxed ? '#ffd700' : '#888');

      // Update effect text
      const effectDesc = this.getEffectDescription(card.config, currentLevel);
      card.effectText.setText(effectDesc);

      if (isMaxed) {
        // Max level - show completed
        card.costText.setText('MAX');
        card.costText.setColor('#6a6');
        card.button.setAlpha(0.6);
        card.button.setVisible(true);
      } else {
        // Calculate cost
        const cost = getUpgradeCost(branchId, currentLevel);
        const costDisplay = this.formatGold(cost);
        const canAfford = gold >= cost;

        card.costText.setText(costDisplay);
        card.costText.setColor(canAfford ? '#ffd700' : '#f66');
        card.button.setAlpha(canAfford ? 1 : 0.5);
        card.button.setVisible(true);
      }
    });
  }

  private getEffectDescription(config: UpgradeBranchConfig, level: number): string {
    const { effects } = config;

    if (effects.goldMultiplier && effects.goldMultiplier[level] !== undefined) {
      const mult = effects.goldMultiplier[level];
      return `Доход: x${mult}`;
    }
    if (effects.visitorTiers && effects.visitorTiers[level] !== undefined) {
      const tiers = effects.visitorTiers[level];
      return `Посетители: Tier ${tiers}`;
    }
    if (effects.capacity && effects.capacity[level] !== undefined) {
      const cap = effects.capacity[level];
      return `Вместимость: ${cap}`;
    }
    if (effects.qualityBonus && effects.qualityBonus[level] !== undefined) {
      const bonus = effects.qualityBonus[level];
      return `Качество: +${Math.round(bonus * 100)}%`;
    }
    return '';
  }

  private formatGold(goldU: GoldU): string {
    const gold = goldU / 1000;
    if (gold >= 1000000) {
      return `${(gold / 1000000).toFixed(1)}M`;
    }
    if (gold >= 1000) {
      return `${(gold / 1000).toFixed(1)}K`;
    }
    return `${gold.toFixed(1)}`;
  }

  private onUpgradeClick(branchId: UpgradeBranchId): void {
    if (!this.lastState) return;

    const currentLevel = this.lastState.tavern.upgrades[branchId] ?? 0;
    const config = UPGRADE_BRANCHES[branchId];

    if (currentLevel >= config.maxLevel) return;

    const cost = getUpgradeCost(branchId, currentLevel);
    if (this.lastState.wallet.gold < cost) return;

    // Dispatch upgrade action - flash will be triggered by TAVERN_UPGRADE_APPLIED event
    this.bridge.dispatch(upgradeTavern(branchId));
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    // Animate backdrop
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0.6,
      duration: 200,
    });

    // Animate panel slide up
    this.scene.tweens.add({
      targets: this.panel,
      y: PANEL_VISIBLE_Y,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Animate backdrop
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0,
      duration: 200,
    });

    // Animate panel slide down
    this.scene.tweens.add({
      targets: this.panel,
      y: PANEL_HIDDEN_Y,
      duration: 250,
      ease: 'Power2',
    });
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribeEvents?.();
    this.panel.destroy();
    this.backdrop.destroy();
  }
}
