import { Animations } from "../../../core/Animations";
import { FrameIndexPattern } from "../../../core/FrameIndexPattern";
import { GameObject } from "../../../core/GameObject";
import { isSpaceFree } from "../../../helpers/grid";
import { moveTowards } from "../../../helpers/moveTowards";
import { DOWN, LEFT, RIGHT, UP } from "../../../core/Input";
import { resources } from "../../../core/Resource";
import { Sprite } from "../../../core/Sprite";
import { Vector2 } from "../../../core/Vector2";
import { ChatBubble } from "../../ChatBubble/Chatbubble";
import {
  PICK_UP_DOWN,
  STAND_DOWN,
  STAND_LEFT,
  STAND_RIGHT,
  STAND_UP,
  WALK_DOWN,
  WALK_LEFT,
  WALK_RIGHT,
  WALK_UP,
} from "./heroAnimations";
import { walls } from "../../../collisions/walls";
import { events } from "../../../core/Events";
import type React from "react";
import { AcceptBubble } from "../../AccRejBubble/AcceptBubble";
import { RejectBubble } from "../../AccRejBubble/RejectBubble";
import { LoaderBubble } from "../../ChatBubble/LoaderBubble";

/*this class defines the Hero object (our moving avatar). It manages the movement and input, relays the position info to websocket and also manages the chatbubbles UI */
export class Hero extends GameObject {
  id: string; //socket id
  body: Sprite; //sprite image of the avatar
  facingDirection: string; //up-down-left-right, for animations
  destinationPosition: Vector2; //where the avatar is headed
  itemPickupTime: number; //timer for the pickup animation and created rod object to exist
  itemPickupShell: GameObject | null; //the temporarily created rod object
  lastX!: number; //last x coordinate of the position
  lastY!: number; //last y coordinate of the position
  webSocketConnection?: WebSocket; //the ws connection object
  wsEmitPos?: { moving: boolean; animation: string }; //object indicating this movement is to be sent to the server
  remoteHero?: boolean; //hero object is some other user
  remoteAnimation?: string; //remote hero's animation

  //chat UI objects
  chatBubble?: ChatBubble; //indicates you can send a request
  loaderBubble?: LoaderBubble; //indicates request pending
  acceptBubble?: AcceptBubble; //allows you to accept
  rejectBubble?: RejectBubble; //allows you to reject

  constructor(
    x: number,
    y: number,
    id: string,
    options: {
      remoteHero?: boolean;
      ws?: WebSocket;
      animation?: string;
      pendingTargetRef?: React.RefObject<string | null>;
    } = {}
  ) {
    super(new Vector2(x, y));

    this.id = id;
    this.webSocketConnection = options.ws;
    this.remoteHero = options.remoteHero;
    this.remoteAnimation = options.animation;

    //all the chat UI objects appear above the remote players, storing them as properties come in handy to manage them
    if (this.remoteHero) {
      const chatBubble = new ChatBubble(this);
      this.chatBubble = chatBubble;
      this.addChild(this.chatBubble);

      const loaderBubble = new LoaderBubble(this);
      this.loaderBubble = loaderBubble;
      this.addChild(this.loaderBubble);

      const acceptBubble = new AcceptBubble(this);
      const rejectBubble = new RejectBubble(this);
      this.acceptBubble = acceptBubble;
      this.rejectBubble = rejectBubble;
      this.addChild(this.acceptBubble);
      this.addChild(this.rejectBubble);
    }

    //this appears just below the hero
    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-8, -19),
    });

    this.addChild(shadow);

    //this is the main avatar sprite which defines what our hero looks like, different frames for it, and different animations along that
    this.body = new Sprite({
      resource: resources.images.hero,
      frameSize: new Vector2(32, 32),
      hFrames: 3,
      vFrames: 8,
      frame: 1,
      position: new Vector2(-8, -20),
      animations: new Animations({
        walkDown: new FrameIndexPattern(WALK_DOWN),
        walkUp: new FrameIndexPattern(WALK_UP),
        walkLeft: new FrameIndexPattern(WALK_LEFT),
        walkRight: new FrameIndexPattern(WALK_RIGHT),
        standDown: new FrameIndexPattern(STAND_DOWN),
        standUp: new FrameIndexPattern(STAND_UP),
        standLeft: new FrameIndexPattern(STAND_LEFT),
        standRight: new FrameIndexPattern(STAND_RIGHT),
        pickUpDown: new FrameIndexPattern(PICK_UP_DOWN),
      }),
    });

    this.addChild(this.body);

    this.facingDirection = DOWN; //starting animation
    this.destinationPosition = this.position.duplicate(); //default starting position the same as spawn
    this.itemPickupTime = 0;
    this.itemPickupShell = null;

    //event which detects that rod was picked up, and runs the pickup item to add new rod as a child
    events.on("HERO_PICKS_UP_ITEM", this, (data) => {
      const { image, position } = data as {
        image: { image: HTMLImageElement; isLoaded: boolean };
        position: Vector2;
      };
      this.onPickUpItem({ image, position });
    });
  }

  //local step function allowing us to make movement calculations every gameLoop and acts as a helper to update users positions
  step(delta: number, root: GameObject) {
    if (this.itemPickupTime > 0) {
      this.workOnItemPickup(delta);
      return;
    }

    const distance = moveTowards(this, this.destinationPosition, 1); //sends current and future position coordinates to a function which calculates and returns distance

    /*if the hero is about to reach or has reached, tryMove function is run (next input is taken), which sets the next destination position and updates wsEmitPos indicating
    whether the destination is to be sent to server (only for hero and not remotehero) */

    const hasArrived = distance <= 1;
    if (hasArrived) {
      this.tryMove(root);
    }

    if (this.remoteHero) {
      return;
    }

    this.tryEmitPosition();
  }

  //this function relays the updated position and animation to the ws server, while updating the lastX and lastY by copying the position updated by moveTowards
  tryEmitPosition() {
    if (this.lastX === this.position.x && this.lastY === this.position.y) {
      return;
    }
    //set the lastX and lastY as the current updated position by moveTowards function
    this.lastX = this.position.x;
    this.lastY = this.position.y;

    //relay to server
    if (this.wsEmitPos!.moving) {
      this.webSocketConnection?.send(
        JSON.stringify({
          type: "move",
          payload: {
            x: Math.round(this.lastX / 16),
            y: Math.round(this.lastY / 16),
            animation: this.wsEmitPos!.animation,
          },
        })
      );
    }

    events.emit("HERO_POSITION", this.position);
  }

  //this function takes in the latest input key, sets the next destination position while updating the animation to be played as well
  tryMove(root: GameObject) {
    const { input } = root;

    //if this is local hero
    if (!this.remoteHero) {
      //if no input
      if (!input?.direction) {
        //set the animation to whatever the last standing animation was
        if (this.facingDirection === LEFT) {
          this.body.animations?.play("standLeft");
        }

        if (this.facingDirection === RIGHT) {
          this.body.animations?.play("standRight");
        }

        if (this.facingDirection === UP) {
          this.body.animations?.play("standUp");
        }

        if (this.facingDirection === DOWN) {
          this.body.animations?.play("standDown");
        }

        //this event is not to be emitted
        this.wsEmitPos = { moving: false, animation: this.facingDirection };
      } else {
        let nextX = this.destinationPosition.x;
        let nextY = this.destinationPosition.y;
        const gridSize = 16; //increment by one grid unit

        if (input.direction === DOWN) {
          nextY += gridSize;
          this.body.animations?.play("walkDown");
        }

        if (input.direction === UP) {
          nextY -= gridSize;
          this.body.animations?.play("walkUp");
        }

        if (input.direction === LEFT) {
          nextX -= gridSize;
          this.body.animations?.play("walkLeft");
        }

        if (input.direction === RIGHT) {
          nextX += gridSize;
          this.body.animations?.play("walkRight");
        }

        //change the facing direction for the hero next update
        this.facingDirection = input.direction ?? this.facingDirection;

        //check if the space is free, and then update the destination position
        if (isSpaceFree(walls, nextX, nextY)) {
          this.destinationPosition.x = nextX;
          this.destinationPosition.y = nextY;
        }

        //this event is to be emitted
        this.wsEmitPos = { moving: true, animation: input.direction };
      }
    }
    //if other user
    if (this.remoteHero) {
      //default
      if (this.facingDirection === DOWN) {
        this.body.animations?.play("standDown");
      }

      //default for standing remote (wsEmitPos would be undefined)
      if (!this.wsEmitPos?.moving) {
        if (this.remoteAnimation === "LEFT") {
          this.body.animations?.play("standLeft");
        }

        if (this.remoteAnimation === "RIGHT") {
          this.body.animations?.play("standRight");
        }

        if (this.remoteAnimation === "UP") {
          this.body.animations?.play("standUp");
        }

        if (this.remoteAnimation === "DOWN") {
          this.body.animations?.play("standDown");
        }
      }

      //this remoteAnimation is updated by the server events for the remote user
      if (this.remoteAnimation === "DOWN") {
        this.body.animations?.play("walkDown");
      }

      if (this.remoteAnimation === "UP") {
        this.body.animations?.play("walkUp");
      }

      if (this.remoteAnimation === "LEFT") {
        this.body.animations?.play("walkLeft");
      }

      if (this.remoteAnimation === "RIGHT") {
        this.body.animations?.play("walkRight");
      }

      this.facingDirection = this.remoteAnimation ?? this.facingDirection;
    }
  }
  //this function runs when pickup event is detected, so a timer is set and a new rod gameObject is created
  onPickUpItem({
    image,
    position,
  }: {
    image: { image: HTMLImageElement; isLoaded: boolean };
    position: Vector2;
  }) {
    this.destinationPosition = position.duplicate();

    this.itemPickupTime = 500;

    this.itemPickupShell = new GameObject();

    this.itemPickupShell.addChild(
      new Sprite({
        resource: image,
        position: new Vector2(0, -18),
      })
    );

    this.addChild(this.itemPickupShell);
  }

  //this function runs every step to decrement the item pickup time and run the animation up until that timer exists and then destroys the rod gameobject
  workOnItemPickup(delta: number) {
    this.itemPickupTime -= delta;
    this.body.animations?.play("pickUpDown");

    if (this.itemPickupTime <= 0) {
      this.itemPickupShell!.destroy();
    }
  }

  //this function is passed the boolean state from computeHeroUI which enables or disables different chat UI states
  setUI(state: {
    chatEnabled: boolean;
    loaderEnabled: boolean;
    showAccept: boolean;
    showReject: boolean;
  }) {
    if (this.chatBubble) {
      if (state.chatEnabled && !this.chatBubble.enabled) {
        this.chatBubble.enable();
      }
      if (!state.chatEnabled && this.chatBubble.enabled) {
        this.chatBubble.disable();
      }
    }

    if (this.loaderBubble) {
      if (state.loaderEnabled && !this.loaderBubble.enabled) {
        this.loaderBubble.enable();
      }
      if (!state.loaderEnabled && this.loaderBubble.enabled) {
        this.loaderBubble.disable();
      }
    }

    if (this.acceptBubble) {
      if (state.showAccept && !this.acceptBubble.enabled) {
        this.acceptBubble.enable();
      }
      if (!state.showAccept && this.acceptBubble.enabled) {
        this.acceptBubble.disable();
      }
    }

    if (this.rejectBubble) {
      if (state.showReject && !this.rejectBubble.enabled) {
        this.rejectBubble.enable();
      }
      if (!state.showReject && this.rejectBubble.enabled) {
        this.rejectBubble.disable();
      }
    }
  }
}
