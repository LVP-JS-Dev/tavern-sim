import Phaser from 'phaser';
import { LAYERS } from '../config';
import type { Table } from './Table';

export class Visitor extends Phaser.GameObjects.Container {
  public readonly visitorId: string;
  private sprite: Phaser.GameObjects.Sprite;
  private targetTable: Table;
  private visitorState: 'walking' | 'sitting' = 'walking';

  constructor(scene: Phaser.Scene, visitorId: string, table: Table, type: string) {
    super(scene, 0, 0);
    this.visitorId = visitorId;
    this.targetTable = table;

    // Create sprite (placeholder colored rectangle)
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setTint(this.getColorForType(type));
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

  private getColorForType(type: string): number {
    const typeMap: Record<string, number> = {
      adventurer: 0x4169e1, // Royal blue
      merchant: 0x228b22,   // Forest green
      noble: 0xffd700,      // Gold
      peasant: 0x8b4513,    // Brown
    };
    return typeMap[type] ?? 0x808080; // Default gray
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
