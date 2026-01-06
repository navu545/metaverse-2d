import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import type { Hero } from "../Avatars/Hero/Hero";

//while our request is pending, this gameObject will activate, it is activate by setUI function in hero class
export class LoaderBubble extends GameObject {
  hero: Hero;
  loaderSprite: Sprite;
  enabled = false;

  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));

    this.hero = hero;
    this.position = new Vector2(0, -26);

    this.loaderSprite = new Sprite({
      resource: resources.images.loading,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });

    this.addChild(this.loaderSprite)

    this.loaderSprite.visible = false;

  }

  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.loaderSprite.visible = true;

  }

  disable() {
    if (!this.enabled) return;

    this.enabled = false;
    this.loaderSprite.visible = false;
  }

}
