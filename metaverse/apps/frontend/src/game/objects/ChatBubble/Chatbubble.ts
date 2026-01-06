import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";
import type { Hero } from "../Avatars/Hero/Hero";

//chatbubble represents the message logo which appears when there's a user availaible to receive requests, manages sending the request intent with details to ws server
export class ChatBubble extends GameObject {
  hero: Hero; //which remote hero this object belongs to
  messageSprite: Sprite; //logo

  eventId?: number; //required to delete the detection event linked to it
  enabled = false; //does it exist

  width = 16;
  height = 16;

  constructor(hero: Hero) {
    super(new Vector2(0, 0));

    this.hero = hero;
    this.position = new Vector2(0, -26);

    this.messageSprite = new Sprite({
      resource: resources.images.message,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });

    //we add the sprite but initially we keep it invisible
    this.addChild(this.messageSprite);
    this.messageSprite.visible = false;
  }

  //setUI in hero class enables it, making it visible, and attaching a click event to it, the listener for which we added to the canvas
  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.messageSprite.visible = true;

    if (this.eventId == null) {
      this.eventId = events.on("CLICK", this, (value: unknown) => {
        const { x, y } = value as { x: number; y: number };
        if (this.containsPoint(x, y)) {
          this.onClick();
        }
      });
    }
  }

  //would be disabled by setUI, when we cancel the request or lose proximity, we delete the event and make it invisible
  disable() {
    if (!this.enabled) return;

    this.enabled = false;
    this.messageSprite.visible = false;

    if (this.eventId != null) {
      events.off(this.eventId);
      this.eventId = undefined;
    }
  }

  //we get the world position of the click from the event listener on the canvas, we compare that with this chat bubble's world position, if the click was made on it
  containsPoint(worldX: number, worldY: number) {
    const { x: objX, y: objY } = this.getWorldPosition();

    return (
      worldX >= objX &&
      worldX <= objX + this.width &&
      worldY >= objY &&
      worldY <= objY + this.height
    );
  }

  //when chat bubble is clicked, we indicate the ws server, that this user wants to talk to the clicked user
  onClick() {
    console.log("request sent");

    this.hero.webSocketConnection?.send(
      JSON.stringify({
        type: "send-message-request",
        payload: {
          user: this.hero.id,
        },
      })
    );
  }
}
