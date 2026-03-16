import Phaser from 'phaser';
import { LAYERS, TILE_SIZE } from '../config';
import { SPRITE_KEYS } from '../scenes/BootScene';

export class Table extends Phaser.GameObjects.Container {
  public readonly index: number;
  private tableSprite: Phaser.GameObjects.Sprite;
  private chairs: Phaser.GameObjects.Sprite[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, index: number) {
    super(scene, x, y);
    this.index = index;

    // Add table sprite
    this.tableSprite = scene.add.sprite(0, 0, SPRITE_KEYS.TABLE);
    this.tableSprite.setOrigin(0.5, 0.5);
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
      const chair = this.scene.add.sprite(offset.x, offset.y, SPRITE_KEYS.CHAIR);
      chair.setOrigin(0.5, 0.5);
      chair.setScale(0.8);
      this.chairs.push(chair);
      this.add(chair);
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
