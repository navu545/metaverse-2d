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
import { AcceptBubble} from "../../AccRejBubble/AcceptBubble";
import {RejectBubble} from "../../AccRejBubble/RejectBubble";


export class Hero extends GameObject {

  id: string;
  body: Sprite;
  facingDirection: string;
  destinationPosition: Vector2;
  itemPickupTime: number;
  itemPickupShell: GameObject | null;
  lastX!: number;
  lastY!: number;
  webSocketConnection?: WebSocket;
  wsEmitPos?: { moving: boolean; animation: string };
  remoteHero?: boolean;
  remoteAnimation?: string;
  positionKey?: React.RefObject<string>;

  enableMsg: boolean;
  chatBubble?: ChatBubble;
  hasMessage: boolean;
  proximityUserIdsRef?: React.RefObject<string[]>;
  acceptRef?: React.RefObject<boolean>;
  rejectRef?: React.RefObject<boolean>;
  accept: boolean;
  hasAccept: boolean;
  reject: boolean;
  hasReject: boolean;

  acceptBubble?: AcceptBubble;
  rejectBubble?: RejectBubble;

  messageRequesterRef?: React.RefObject<string[]>;
  acceptedRequestsRef?: React.RefObject<string[]>;

  constructor(
    x: number,
    y: number,
    id: string,
    options: {
      positionKey?: React.RefObject<string>;
      remoteHero?: boolean;
      ws?: WebSocket;
      animation?: string;
      proximityUserIdsRef?: React.RefObject<string[]>;
      acceptRef?: React.RefObject<boolean>;
      rejectRef?: React.RefObject<boolean>;
      messageRequesterRef?: React.RefObject<string[]>;
      acceptedRequestsRef?: React.RefObject<string[]>;
    } = {}
  ) {
    super(new Vector2(x, y));

    this.id = id

    this.webSocketConnection = options.ws;
    this.remoteHero = options.remoteHero;
    this.remoteAnimation = options.animation;
    this.positionKey = options.positionKey;
    

    this.enableMsg = false;
    this.hasMessage = false;

    this.acceptRef = options.acceptRef;
    this.rejectRef = options.rejectRef;
    this.hasAccept = false;
    this.hasReject = false;
    this.accept = false;
    this.reject = false;

    this.proximityUserIdsRef = options.proximityUserIdsRef;
    this.messageRequesterRef = options.messageRequesterRef;
    this.acceptedRequestsRef = options.acceptedRequestsRef;

    if (this.remoteHero) {
      const chatBubble = new ChatBubble(this);
      this.chatBubble = chatBubble;
      this.addChild(this.chatBubble);

      const acceptBubble = new AcceptBubble(this, this.messageRequesterRef!);
      const rejectBubble = new RejectBubble(this, this.messageRequesterRef!);
      this.acceptBubble = acceptBubble;
      this.rejectBubble = rejectBubble;
      this.addChild(acceptBubble);
      this.addChild(rejectBubble);
    }

    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-8, -19),
    });

    this.addChild(shadow);

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

    this.facingDirection = DOWN;
    this.destinationPosition = this.position.duplicate();
    this.itemPickupTime = 0;
    this.itemPickupShell = null;

    events.on("HERO_PICKS_UP_ITEM", this, (data) => {
      this.onPickUpItem(
        data as {
          image: { image: HTMLImageElement; isLoaded: boolean };
          position: Vector2;
        }
      );
    });

    events.on("ACCEPT_DECLINE_BUBBLES_OFF", this, (data) => {
      this.acceptBubble?.disable();
     
      this.rejectBubble?.disable();
      
    });
  }

  step(delta: number, root: GameObject) {
    this.heroBubbles();

    if (this.itemPickupTime > 0) {
      this.workOnItemPickup(delta);
      return;
    }

    const distance = moveTowards(this, this.destinationPosition, 1);

    const hasArrived = distance <= 1;
    if (hasArrived) {
      this.wsEmitPos = this.tryMove(root);
    }

    if (this.remoteHero) {
      return;
    }

    this.tryEmitPosition();
  }

  tryEmitPosition() {
    if (this.lastX === this.position.x && this.lastY === this.position.y) {
      return;
    }

    if (this.lastX == null || this.lastY == null) {
      this.wsEmitPos!.moving = false;
    } else {
      this.wsEmitPos!.moving = true;
    }

    this.lastX = this.position.x;
    this.lastY = this.position.y;

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

  tryMove(root: GameObject) {
    const { input } = root;

    if (!this.remoteHero) {
      if (!input?.direction) {
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

        return { moving: false, animation: this.facingDirection };
      } else {
        let nextX = this.destinationPosition.x;
        let nextY = this.destinationPosition.y;
        const gridSize = 16;

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

        this.facingDirection = input.direction ?? this.facingDirection;

        if (isSpaceFree(walls, nextX, nextY)) {
          this.destinationPosition.x = nextX;
          this.destinationPosition.y = nextY;
        }

        return { moving: true, animation: input.direction };
      }
    }
    if (this.remoteHero) {
      if (this.facingDirection === DOWN) {
        this.body.animations?.play("standDown");
      }

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

  workOnItemPickup(delta: number) {
    this.itemPickupTime -= delta;
    this.body.animations?.play("pickUpDown");

    if (this.itemPickupTime <= 0) {
      this.itemPickupShell!.destroy();
    }
  }

  heroBubbles() {

    

    if (this.acceptedRequestsRef?.current.includes(this.id)){
    this.enableMsg = false;
    this.hasMessage = false;
    this.chatBubble?.disable();
    }
    

    

    //before sending requests
    if (this.enableMsg && !this.hasMessage) {
      this.hasMessage = true;
      this.chatBubble?.enable();
    }

    if (!this.enableMsg && this.hasMessage) {
      this.hasMessage = false;
      this.chatBubble?.disable();
    }
    //on receving requests
    const latestAccept = this.acceptRef?.current ?? false;

    if (latestAccept !== this.accept) {
      this.accept = latestAccept;

      if (this.accept && !this.hasAccept) {
        this.hasAccept = true;
        this.acceptBubble?.enable();

        this.enableMsg = false;
        this.hasMessage = false;
        this.chatBubble?.disable();
      }

      if (!this.accept && this.hasAccept) {
        this.hasAccept = false;
        this.acceptBubble?.disable();
      }
    }

    const latestReject = this.rejectRef?.current ?? false;

    if (latestReject !== this.reject) {
      this.reject = latestReject;

      if (this.reject && !this.hasReject) {
        this.hasReject = true;
        this.rejectBubble?.enable();
      }

      if (!this.reject && this.hasReject) {
        this.hasReject = false;
        this.rejectBubble?.disable();
      }
    }
  }
}
