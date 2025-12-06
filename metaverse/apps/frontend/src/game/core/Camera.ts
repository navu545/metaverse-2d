import { events } from "./Events";
import { GameObject } from "./GameObject";
import { Vector2 } from "./Vector2";

export class Camera extends GameObject {
  constructor() {
    super();

    events.on("HERO_POSITION", this, (value) => {
      const heroPosition = value as Vector2;
      const personHalf = 0;
      const canvasWidth = 320;
      const canvasHeight = 180;
      const halfWidth = -personHalf + canvasWidth / 2;
      const halfHeight = -personHalf + canvasHeight / 2;

      this.position = new Vector2(
        -heroPosition.x + halfWidth,
        -heroPosition.y + halfHeight
      );

    });
  }
}
