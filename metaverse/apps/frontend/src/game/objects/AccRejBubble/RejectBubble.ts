import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

export class RejectBubble extends GameObject {
  hero: Hero;
  bubbleSprite: GameObject;
  eventId?: number;
  messageRequesterRef?: React.RefObject<string[]>;
  messageRequester: string[] | undefined;

  width = 16;
  height = 16;

  constructor(hero: Hero, messageRequesterRef: React.RefObject<string[]>) {
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(10, -26);
    this.bubbleSprite = new Sprite({
      resource: resources.images.decline,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });
    // this.messageRequester = messageRequesterRef.current;
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
    console.log("reject chatbubble clicked");

    events.emit("ACCEPT_DECLINE_BUBBLES_OFF", false);

    // this.hero.webSocketConnection?.send(
    //   JSON.stringify({
    //     type: "message-request-reject",
    //     payload: {
    //       users: this.messageRequester,
    //     },
    //   })
    // );


  }
}
