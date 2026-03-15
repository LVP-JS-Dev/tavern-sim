import Phaser from 'phaser';
import { LAYERS, TAVERN_AREA } from '../config';

export class TavernRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(): void {
    this.renderFloor();
  }

  private renderFloor(): void {
    // Use a solid color as placeholder until floor texture is available
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x4a3728, 1);
    graphics.fillRect(TAVERN_AREA.x, TAVERN_AREA.y, TAVERN_AREA.width, TAVERN_AREA.height);
    graphics.setDepth(LAYERS.FLOOR);
  }

  update(_time: number, _delta: number): void {
    // Floor animation if needed
  }

  destroy(): void {
    // Cleanup
  }
}
