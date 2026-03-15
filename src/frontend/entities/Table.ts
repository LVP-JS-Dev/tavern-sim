import Phaser from 'phaser';
import { LAYERS, TILE_SIZE } from '../config';

export class Table extends Phaser.GameObjects.Container {
  public readonly index: number;
  private tableSprite: Phaser.GameObjects.Sprite;
  private chairs: Phaser.GameObjects.Sprite[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, index: number) {
    super(scene, x, y);
    this.index = index;

    // Add table sprite (placeholder rectangle until assets)
    this.tableSprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.tableSprite.setOrigin(0.5, 0.5);
    this.tableSprite.setTint(0x8b4513); // Brown color as placeholder
    this.tableSprite.setScale(2, 1.5);
    this.add(this.tableSprite);

    // Add chairs around table (2 on each side)
    this.createChairs();

    // Set depth
    this.setDepth(LAYERS.TABLES);

    // Add to scene
    scene.add.existing(this);
  }

  private createChairs(): void {
    const chairOffsets = [
      { x: -TILE_SIZE, y: 0 },   // Left
      { x: TILE_SIZE, y: 0 },    // Right
      { x: 0, y: -TILE_SIZE },   // Top
      { x: 0, y: TILE_SIZE },    // Bottom
    ];

    chairOffsets.forEach((offset) => {
      const chair = this.scene.add.sprite(offset.x, offset.y, '__DEFAULT');
      chair.setOrigin(0.5, 0.5);
      chair.setTint(0x654321); // Darker brown for chairs
      chair.setScale(0.8);
      this.chairs.push(chair);
      this.add(chair);
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
