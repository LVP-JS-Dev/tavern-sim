import Phaser from 'phaser';
import { LAYERS } from '../config';
import { SPRITE_KEYS } from '../scenes/BootScene';

// Map hero IDs to sprite keys
const HERO_SPRITE_MAP: Record<string, string> = {
  'bard-1': SPRITE_KEYS.BARD,
  'warrior-1': SPRITE_KEYS.WARRIOR,
  'mage-1': SPRITE_KEYS.MAGE,
  'rogue-1': SPRITE_KEYS.ROGUE,
};

export class Hero extends Phaser.GameObjects.Container {
  public readonly heroId: string;
  private sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: string) {
    super(scene, x, y);
    this.heroId = heroId;

    // Get sprite key for hero type
    const spriteKey = HERO_SPRITE_MAP[heroId] ?? SPRITE_KEYS.BARD;

    // Create sprite using loaded assets
    this.sprite = scene.add.sprite(0, 0, spriteKey);
    this.sprite.setOrigin(0.5, 1); // Bottom-center anchor
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
