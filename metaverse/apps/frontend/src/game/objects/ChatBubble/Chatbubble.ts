import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

export class ChatBubble extends GameObject {
  hero: Hero;
  bubbleSprite: GameObject;
  eventId?: number;

  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(0, -26);
    this.bubbleSprite = new Sprite({
      resource: resources.images.message,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });
 
  }

  enable() {

    this.bubbleSprite = new Sprite({
      resource: resources.images.message,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });


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

    this.hero.webSocketConnection?.send(
      JSON.stringify({
        type: "send-message-request",
        payload: {
          users: this.hero.proximityUserIdsRef?.current,
        },
      })
    );

    //loader
    this.removeChild(this.bubbleSprite)
    this.bubbleSprite = new Sprite({
      resource: resources.images.loading,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    }); 
    this.addChild(this.bubbleSprite)
    if (this.eventId != null) {
      events.off(this.eventId!);
      this.eventId = undefined;
    }


    



  }
}
