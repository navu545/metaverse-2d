import type { Animations } from "./Animations";
import { GameObject } from "./GameObject";
import { Vector2 } from "./Vector2";

type TypeResources = { image: HTMLImageElement; isLoaded: boolean };

interface SpriteConfig {
  resource: TypeResources;
  frameSize?: Vector2;
  hFrames?: number;
  vFrames?: number;
  frame?: number;
  scale?: number;
  position?: Vector2;
  animations?: Animations;
  visible?: boolean;
}

//Sprite class allows gameObjects to store sprite (images/frames), have animations, and render them with ctx draw function

export class Sprite extends GameObject {
  resource: TypeResources; //the location of the sprite
  frameSize: Vector2; //dimensions of the frame
  hFrames: number; //horizontal frames number
  vFrames: number; //vertical frames number
  frame: number; //active frame
  scale: number; //zoom on the frame
  position: Vector2; //position relative to the gameobject containing it
  animations?: Animations | null; //
  visible: boolean;
  frameMap: Map<number, Vector2>;

  constructor({
    resource,
    frameSize,
    hFrames,
    vFrames,
    frame,
    scale,
    position,
    animations,
  }: SpriteConfig) {
    super();
    this.resource = resource;
    this.frameSize = frameSize ?? new Vector2(16, 16);
    this.hFrames = hFrames ?? 1;
    this.vFrames = vFrames ?? 1;
    this.frame = frame ?? 0;
    this.frameMap = new Map();
    this.scale = scale ?? 1;
    this.position = position ?? new Vector2(0, 0);
    this.animations = animations ?? null;
    this.visible = true;
    this.buildFrameMap();
  }

  /*this function is provided the number of vertical and horizontal frames, it iterates over every frame, saving it in a map
  which saves the count as the key and the value being the top left corner of the frame (mark's the frame's location on the
  resource sprite image given) */

  buildFrameMap() {
    let frameCount = 0;

    for (let v = 0; v < this.vFrames; v++) {
      for (let h = 0; h < this.hFrames; h++) {
        this.frameMap.set(
          frameCount,
          new Vector2(this.frameSize.x * h, this.frameSize.y * v)
        );
        frameCount++;
      }
    }
  }

  /*sprite gameObject is passing the delta to animations class, & setting the current frame number by running the animations getter
  function which further runs the frameIndexPatterns getter function which actually returns the frame*/

  step(delta: number) {
    if (!this.animations) {
      return;
    }

    this.animations.step(delta);
    this.frame = this.animations.frame;
  }

  /*drawImage is responsible for actually using the ctx drawImage to render the chosen frame, which is being returned all the way
  from animation track ==> frameindexpattern ==> animations ==> here*/

  drawImage(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!this.visible) return;

    if (!this.resource.isLoaded) {
      return;
    }

    let frameCoordX = 0;
    let frameCoordY = 0;

    //we get the location of the frame on the sprite image e.g. [0,0] for frame 0; [16,0] for frame 1 and so on..

    const frame = this.frameMap.get(this.frame);
    if (frame) {
      frameCoordX = frame.x;
      frameCoordY = frame.y;
    }

    //we get the size of the frame (e.g. 16*16)
    const frameSizeX = this.frameSize.x;
    const frameSizeY = this.frameSize.y;

    //we feed everything to ctx draw image, which actually renders it
    ctx.drawImage(
      this.resource.image,
      frameCoordX,
      frameCoordY,
      frameSizeX,
      frameSizeY,
      x,
      y,
      frameSizeX * this.scale,
      frameSizeY * this.scale
    );
  }
}
