import Phaser from 'phaser';
import { LAYERS } from '../config';
import { SPRITE_KEYS } from '../scenes/BootScene';
import type { Table } from './Table';

// Map visitor types to sprite keys
const VISITOR_SPRITE_MAP: Record<string, string> = {
  adventurer: SPRITE_KEYS.VISITOR_02,
  merchant: SPRITE_KEYS.VISITOR_03,
  noble: SPRITE_KEYS.VISITOR_04,
  peasant: SPRITE_KEYS.VISITOR_02, // Default to 02
};

export class Visitor extends Phaser.GameObjects.Container {
  public readonly visitorId: string;
  private sprite: Phaser.GameObjects.Sprite;
  private targetTable: Table;
  private visitorState: 'walking' | 'sitting' = 'walking';

  constructor(scene: Phaser.Scene, visitorId: string, table: Table, type: string) {
    super(scene, 0, 0);
    this.visitorId = visitorId;
    this.targetTable = table;

    // Create sprite using loaded assets
    const spriteKey = VISITOR_SPRITE_MAP[type] ?? SPRITE_KEYS.VISITOR_02;
    this.sprite = scene.add.sprite(0, 0, spriteKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setScale(0.8, 1.2);
    this.add(this.sprite);

    // Set initial position (enter from left)
    this.x = -50;
    this.y = table.y;

    // Set depth
    this.setDepth(LAYERS.VISITORS);

    // Add to scene
    scene.add.existing(this);

    // Start walking animation
    this.walkToTable();
  }

  private walkToTable(): void {
    const targetPos = this.targetTable.getPosition();

    this.scene.tweens.add({
      targets: this,
      x: targetPos.x,
      y: targetPos.y,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.visitorState = 'sitting';
      },
    });
  }

  override update(time: number, _delta: number): void {
    // Add subtle bobbing when sitting
    if (this.visitorState === 'sitting') {
      const bob = Math.sin(time / 500) * 2;
      this.sprite.y = bob;
    }
  }

  override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
