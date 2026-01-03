
/*vector class allows to save positions and duplicate them, saving positions in class avoids duplication of math logic
e.g. defining positions everywhere like {x:number, y:number}, avoids accidentally mutating values and provides, 
methods relating to position which can be used anywhere, centralises the logic*/

export class Vector2 {

    x: number
    y: number

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  duplicate() {
    return new Vector2(this.x, this.y);
  }
}
