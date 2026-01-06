import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

//this class represent the accept button which appears on receiving of a request, it manages sending approval details to the ws server
export class AcceptBubble extends GameObject {
  hero: Hero;
  sprite: Sprite;
  eventId?: number;
  enabled = false;
  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(-10, -26);

    this.sprite = new Sprite({
      resource: resources.images.accept,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });

    this.addChild(this.sprite);
    this.sprite.visible  = false
  }

  //gets enabled by the setUI in hero class after we detect that a request has been received
  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.sprite.visible = true;

    if (this.eventId == null) {
      this.eventId = events.on("CLICK", this, (value: unknown) => {
        const { x, y } = value as { x: number; y: number };
        if (this.containsPoint(x, y)) {
          this.onClick();
        }
      });
    }
  }

  //gets disabled by setUI when either the request is accepted or rejected
  disable() {
    if (!this.enabled) return;

    this.enabled = false;
    this.sprite.visible = false

    if (this.eventId != null) {
      events.off(this.eventId);
      this.eventId = undefined;
    }
  }

  //detects whether it was clicked
  containsPoint(worldX: number, worldY: number) {
    const { x: objX, y: objY } = this.getWorldPosition();

    return (
      worldX >= objX &&
      worldX <= objX + this.width &&
      worldY >= objY &&
      worldY <= objY + this.height
    );
  }

  //sends the acceptance message event to ws server with the accepted user's details
  onClick() {
    console.log("Accept chatbubble clicked");

    this.hero.webSocketConnection?.send(
      JSON.stringify({
        type: "message-request-accept",
        payload: {
          user: this.hero.id,
        },
      })
    );

    
  }
}
