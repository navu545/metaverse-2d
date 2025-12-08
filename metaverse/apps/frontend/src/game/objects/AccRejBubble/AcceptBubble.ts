import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

export class AcceptBubble extends GameObject {
  hero: Hero;
  bubbleSprite: GameObject;
  eventId?: number;

  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(0, -50);
    this.bubbleSprite = new Sprite({
      resource: resources.images.accept,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });
  }

  enable() {
    if (!this.bubbleSprite.parent) {
      this.addChild(this.bubbleSprite);
    }
    if (this.eventId != null) return;

    this.eventId = events.on("CLICK", this, (value: unknown) => {
      

      const { x, y } = value as { x: number; y: number };

  

      if (this.containsPoint(x, y)) {
        

        this.onClick();
      }
    });
  }

  disable() {
    if (this.bubbleSprite.parent) {
      this.removeChild(this.bubbleSprite);
    }
    if (this.eventId != null) {
      events.off(this.eventId!);
      this.eventId = undefined;
    }
  }

  containsPoint(worldX: number, worldY: number) {
    const { x: objX, y: objY } = this.getWorldPosition();

    return (
      worldX >= objX &&
      worldX <= objX + this.width &&
      worldY >= objY &&
      worldY <= objY + this.height
    );
  }

  onClick() {
    console.log("Accept chatbubble clicked");
  }
}
