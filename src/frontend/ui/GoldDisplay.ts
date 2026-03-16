import Phaser from 'phaser';
import { GOLD_MULTIPLIER } from '../../config/balance';

export class GoldDisplay extends Phaser.GameObjects.Container {
  private goldText: Phaser.GameObjects.Text;
  private incomeText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Gold icon (placeholder - using emoji for now)
    const goldIcon = scene.add.text(0, 0, '🪙', {
      fontSize: '24px',
    });
    goldIcon.setOrigin(0, 0.5);
    this.add(goldIcon);

    // Gold amount
    this.goldText = scene.add.text(35, 0, '0', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold',
    });
    this.goldText.setOrigin(0, 0.5);
    this.add(this.goldText);

    // Income rate
    this.incomeText = scene.add.text(35, 28, '+0/s', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#88ff88',
    });
    this.incomeText.setOrigin(0, 0.5);
    this.add(this.incomeText);

    scene.add.existing(this);
  }

  override update(gold: number, incomePerSecond: number): void {
    const displayGold = Math.floor(gold / GOLD_MULTIPLIER);
    const displayIncome = (incomePerSecond / GOLD_MULTIPLIER).toFixed(1);

    this.goldText.setText(this.formatNumber(displayGold));
    this.incomeText.setText(`+${displayIncome}/sec`);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}
