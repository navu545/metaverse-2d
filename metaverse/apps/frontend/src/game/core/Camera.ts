import { events } from "./Events";
import { GameObject } from "./GameObject";
import { Vector2 } from "./Vector2";

//the camera class ensures that our hero is centered always
export class Camera extends GameObject {
  constructor() {
    super();

    /*It works by detecting the hero position event that is emitted every time the step function in hero class runs,
    first we find the center of the canvas taking account for the hero's dimensions (halfWidth and halfHeight), then we 
    figure out what should be the camera's position. Larger magnitude values passed in translate move the world right/down
    while smaller ones move it left/up. e.g. If a hero moves rightwards, bigger magnitude of x, which means less magnitude of 
    width being passed to translate, meaning the world will move left to give an illusion that hero moved right*/

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

/*   screenX = worldX - cameraX where cameraX = heroX - halfWidth | screenX ==> worldX - heroX + halfWidth
  OR screenX = worldX + offsetX where offsetX = -cameraX = -(heroX - halfWidth) | screenX = worldX + halfWidth - heroX <== one
  that we're doing using translate, so instead of storing cameraX, we're passing in -cameraX */
