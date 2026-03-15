import Phaser from 'phaser';
import { LAYERS } from '../config';

const HERO_COLORS: Record<string, number> = {
  'bard-1': 0x9932cc,    // Purple
  'warrior-1': 0xdc143c, // Crimson
  'mage-1': 0x4169e1,    // Royal blue
  'rogue-1': 0x2f4f4f,   // Dark slate gray
  'cleric-1': 0xffd700,  // Gold
};

export class Hero extends Phaser.GameObjects.Container {
  public readonly heroId: string;
  private sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: string) {
    super(scene, x, y);
    this.heroId = heroId;

    // Get color for hero type
    const color = HERO_COLORS[heroId] ?? 0x808080;

    // Create sprite (placeholder colored rectangle)
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.sprite.setOrigin(0.5, 1); // Bottom-center anchor
    this.sprite.setTint(color);
    this.sprite.setScale(1, 1.5);
    this.add(this.sprite);

    // Set depth
    this.setDepth(LAYERS.HEROES);

    // Add to scene
    scene.add.existing(this);

    // Add idle bobbing
    this.startIdleAnimation();
  }

  private startIdleAnimation(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: -3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this.sprite);
    super.destroy(fromScene);
  }
}
