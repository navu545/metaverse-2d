import { events } from "./Events";
import { Input } from "./Input";
import { Vector2 } from "./Vector2";

/*GameObject class provides every element placed in the game to have such a structure which allows them to have their own
behavior if desired. Nesting helps pass down functions and parameters that can be overridden in a children class and if not
the parent class runs the default methods allowing rendering and other functionalities for that game object. */

export class GameObject {
  position: Vector2; //every game object will have a position relative to the parent, topmost parent's position is relative to canvas
  children: Array<GameObject>; //every gameObject can store other gameObject as children
  parent: GameObject | null; //the parent of the current gameObject
  hasReadyBeenCalled: boolean; //boolean allowing all the children first being ready and then the parent
  input: Input | null; //allows input for every gameObject

  constructor(position?: Vector2) {
    this.position = position ?? new Vector2(0, 0);
    this.children = [];
    this.parent = null;
    this.hasReadyBeenCalled = false;
    this.input = null;
  }

  //this function inherits the delta from the update function which gets it from gameLoop, and the root is the topmost parent
  stepEntry(delta: number, root: GameObject) {
    this.children.forEach((child) => child.stepEntry(delta, root));

    /*all the children are setup recursively until we arrive at the leaf where the boolean is switched and ready function is called
    this goes up the chain getting all the children ready first and then the parent */

    if (!this.hasReadyBeenCalled) {
      this.hasReadyBeenCalled = true;
      this.ready();
    }

    //this step function is particular to every different gameObject
    this.step(delta, root);
  }

  //this function will allow children to subscribe to events or attach listeners, without prematurely assigning them in constructor
  ready() {}

  //this function is customizable for every gameObject to utilize delta/root for its own purpose, eg. movement in hero in step
  step(_delta: number, _root: GameObject) {}

  //this function traverses parent to child, calculating draw position relative to the parent and passing it down to children
  draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const drawPosX = x + this.position.x;
    const drawPosY = y + this.position.y;

    this.drawImage(ctx, drawPosX, drawPosY);

    this.children.forEach((child) => child.draw(ctx, drawPosX, drawPosY));
  }

  //this drawImage function further resides in the sprite class which utilises the ctx drawImage function to render the element
  drawImage(
    _ctx: CanvasRenderingContext2D,
    _drawPosX: number,
    _drawPosY: number
  ) {}

  //this function destroys this gameObject and all its children, removes this from its parents children list as well
  destroy() {
    this.children.forEach((child) => {
      child.destroy();
    });

    this.parent?.removeChild(this);
  }

  //this function adds the child gameObject to the parent
  addChild(gameObject: GameObject) {
    gameObject.parent = this;
    this.children.push(gameObject);
  }

  //the following function first removes the event listeners of the child, then removes it from it's parents children list
  removeChild(gameObject: GameObject) {
    events.unsubscribe(gameObject);
    this.children = this.children.filter((g) => {
      return gameObject !== g;
    });

    if (gameObject.parent === this) {
      gameObject.parent = null;
    }
  }

  //This returns position of any nested object in world terms,every nested object's position is relative to its parent
  getWorldPosition() {
    let node = this as GameObject | null;
    let x = 0;
    let y = 0;

    while (node) {
      x += node.position.x;
      y += node.position.y;
      node = node.parent;
    }

    return { x, y };
  }
}

/*The ready function avoids ghost behaviour, for eg. if an object hasnt been added to the scene yet but event listener was assigned
to it in the constructor itself, that might cause things to happen which werent desired since the object is not even there. Ready
will allow for eg. event listener to be attached only when the object would be added*/

/*The updation is done from children ==> parent since in a lot of cases the children objects dictate state of whether the parent
should be enabled to do further things. eg. All the form fields should be validated first for the submit button to be activated.
another example could be, if we wanted to add a feature, that without accept or reject bubble being clicked, our hero shouldnt be 
able to move, we would need the state from accept or reject, and then allow our hero to move. Children objects are closer to state 
data which might derive overall game behaviour up the chain
 */
