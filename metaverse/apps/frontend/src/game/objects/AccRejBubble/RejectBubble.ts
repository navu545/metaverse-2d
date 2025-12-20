import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

export class RejectBubble extends GameObject {
  hero: Hero;
  sprite: Sprite;
  eventId?: number;

  enabled = false;
  isVisible = false;

  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(10, -26);

    this.sprite = new Sprite({
      resource: resources.images.decline,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });

    this.addChild(this.sprite);
  }

  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.isVisible = true;

    if (this.eventId == null) {
      this.eventId = events.on("CLICK", this, (value: unknown) => {
        const { x, y } = value as { x: number; y: number };
        if (this.containsPoint(x, y)) {
          this.onClick();
        }
      });
    }
  }

  disable() {
    if (!this.enabled) return;

    this.enabled = false;
    this.isVisible = false;

    if (this.eventId != null) {
      events.off(this.eventId);
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

  draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!this.isVisible) return;
    super.draw(ctx, x, y);
  }

  onClick() {
    console.log("reject chatbubble clicked");

    this.hero.webSocketConnection?.send(
      JSON.stringify({
        type: "message-request-reject",
        payload: {
          user: this.hero.id,
        },
      })
    );

    events.emit("ACCEPT_DECLINE_BUBBLES_OFF", this.hero.id);
  }
}
