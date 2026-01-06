import { events } from "../../core/Events";
import { GameObject } from "../../core/GameObject";
import { resources } from "../../core/Resource";
import { Sprite } from "../../core/Sprite";
import { Vector2 } from "../../core/Vector2";

//rod is an interactive object which on collision with hero destroys itself, and emits another event that runs onPickuptime in hero class for UI update
export class Rod extends GameObject {
  constructor(x:number, y:number) {
    super(
    new Vector2(x, y),
    );

    const sprite = new Sprite({
      resource: resources.images.rod,
      position: new Vector2(0, -5),
    });
    this.addChild(sprite);
  }

  ready() {
    events.on("HERO_POSITION", this, (pos) => {
      const { x, y } = pos as Vector2;
      const roundedHeroX = Math.round(x);
      const roundedHeroY = Math.round(y);

      if (
        roundedHeroX === this.position.x &&
        roundedHeroY === this.position.y
      ) {
        this.onCollideWithHero();
      }
    });
  }

  onCollideWithHero() {
    this.destroy();

    events.emit("HERO_PICKS_UP_ITEM", {
      image: resources.images.rod,
      position: this.position,
    });
  }
}
