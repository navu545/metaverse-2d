import { events } from "./Events";
import { Input } from "./Input";
import { Vector2 } from "./Vector2";

export class GameObject {
  position: Vector2;
  children: Array<GameObject>;
  parent: GameObject | null;
  hasReadyBeenCalled: boolean;
  input: Input | null

  constructor( position? : Vector2) {
    this.position = position ?? new Vector2(0, 0);
    this.children = [];
    this.parent = null;
    this.hasReadyBeenCalled = false;
    this.input = null

  }

  stepEntry(delta: number, root: GameObject) {
    this.children.forEach((child) => child.stepEntry(delta, root));

    if (!this.hasReadyBeenCalled) {
      this.hasReadyBeenCalled = true;
      this.ready();
    }

    this.step(delta, root);
  }

  ready() {}

  step(_delta: number, _root:GameObject) {}

  draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const drawPosX = x + this.position.x;
    const drawPosY = y + this.position.y;

    this.drawImage(ctx, drawPosX, drawPosY);

    this.children.forEach((child) => child.draw(ctx, drawPosX, drawPosY));
  }

  drawImage(
    _ctx: CanvasRenderingContext2D,
    _drawPosX: number,
    _drawPosY: number
  ) {}

  destroy() {
    this.children.forEach((child) => {
      child.destroy();
    });

    this.parent?.removeChild(this);
  }

  addChild(gameObject: GameObject) {
    gameObject.parent = this;
    this.children.push(gameObject);
  }

  removeChild(gameObject: GameObject) {

    events.unsubscribe(gameObject);
    this.children = this.children.filter((g) => {
      return gameObject !== g;
    });
  }
}
