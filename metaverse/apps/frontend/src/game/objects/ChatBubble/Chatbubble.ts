import { GameObject } from "../../core/GameObject";
import { Vector2 } from "../../core/Vector2";
import { Sprite } from "../../core/Sprite";
import { resources } from "../../core/Resource";
import { events } from "../../core/Events";


export class ChatBubble extends GameObject {
  hero: GameObject;
  bubbleSprite:GameObject
  eventId?:number

  width = 16;
  height = 16;

  constructor(hero: GameObject) {
    
    super(new Vector2(0, 0));
    this.hero = hero;
    this.position = new Vector2(0, -26);
    this.bubbleSprite = new Sprite({
      resource: resources.images.message,
      frameSize: new Vector2(16, 16),
      position: new Vector2(0, 0),
    });

  }

    enable(){

      if(!this.bubbleSprite.parent){
      this.addChild(this.bubbleSprite);
    } 
      if( this.eventId!= null) return   

      this.eventId = events.on("CLICK", this, (value: unknown) => {
        console.log("click reaching subscription");

        const { x, y } = value as { x: number; y: number };

        console.log("clicks world value is also here");

        if (this.containsPoint(x, y)) {
          console.log("containsPoint is being reached");

          this.onClick();
        }
      });
    }

    disable() {

      if(this.bubbleSprite.parent){
      this.removeChild(this.bubbleSprite)
    } 
      if(this.eventId != null){
      events.off(this.eventId!)
      this.eventId = undefined
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
    console.log("chatbubble clicked");
  }
}
