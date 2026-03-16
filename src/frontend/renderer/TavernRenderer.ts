import Phaser from 'phaser';
import { LAYERS, TAVERN_AREA } from '../config';

export class TavernRenderer {
  private scene: Phaser.Scene;
  private floorGraphics: Phaser.GameObjects.Graphics | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(): void {
    this.renderFloor();
  }

  private renderFloor(): void {
    this.floorGraphics = this.scene.add.graphics();
    this.floorGraphics.fillStyle(0x4a3728, 1);
    this.floorGraphics.fillRect(TAVERN_AREA.x, TAVERN_AREA.y, TAVERN_AREA.width, TAVERN_AREA.height);
    this.floorGraphics.setDepth(LAYERS.FLOOR);
  }

  update(_time: number, _delta: number): void {
    // Floor animation if needed
  }

  destroy(): void {
    this.floorGraphics?.destroy();
    this.floorGraphics = undefined;
  }
}
