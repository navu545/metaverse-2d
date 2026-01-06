/*gridCells helps in allowing input in grid terms which it converts into pixel terms, this allows us to be constrained 
within predictable integer maths, imporoves readibility. */

export const gridCells = (n: number) => {
  return n * 16;
};

/*this function allows us to give a set of strings where we want the static objects to be, so we dont go through them and 
instead collide, we give the x and y as the current grid cell we wanna go to. */

export const isSpaceFree = (walls: Set<string>, x: number, y: number) => {
  const str = `${x},${y}`;
  const isWallPresent = walls.has(str);

  return !isWallPresent;
};
