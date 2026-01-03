export const LEFT = "LEFT";
export const RIGHT = "RIGHT";
export const UP = "UP";
export const DOWN = "DOWN";

/*Input class saves the order in which the latest pressed key takes priority, we attach two event listeners in the constructor,
one listens to key pressed and the other to key left and passes them to the function which save them accordingly*/

export class Input {
  heldDirections: string[];

  constructor() {
    this.heldDirections = [];

    document.addEventListener("keydown", (e) => {
      if (e.code === "ArrowUp" ) {
        this.onArrowPressed(UP);
      }
      if (e.code === "ArrowDown" ) {
        this.onArrowPressed(DOWN);
      }
      if (e.code === "ArrowLeft" ) {
        this.onArrowPressed(LEFT);
      }
      if (e.code === "ArrowRight" ) {
        this.onArrowPressed(RIGHT);
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.code === "ArrowUp" ) {
        this.onArrowReleased(UP);
      }
      if (e.code === "ArrowDown" ) {
        this.onArrowReleased(DOWN);
      }
      if (e.code === "ArrowLeft" ) {
        this.onArrowReleased(LEFT);
      }
      if (e.code === "ArrowRight" ) {
        this.onArrowReleased(RIGHT);
      }
    });
  }

  //spits the latest pressed key
  get direction() {
    return this.heldDirections[0];
  }

  //this function checks if the latest pressed key was already present in the array, if not, it puts it at index 0
  onArrowPressed(direction: string) {
    if (this.heldDirections.indexOf(direction) === -1) {
      this.heldDirections.unshift(direction);
    }
  }

  //this function check if the key released is present, if yes, it removes it, so the previous latest to it can come to index 0
  onArrowReleased(direction: string) {
    const index = this.heldDirections.indexOf(direction);
    if (index === -1) {
      return;
    }
    this.heldDirections.splice(index, 1);
  }
}
