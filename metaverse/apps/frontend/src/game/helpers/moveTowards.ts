import type { Vector2 } from "../core/Vector2";
import type { Hero } from "../objects/Avatars/Hero/Hero";

//this function calculates the remaining distance contrasting the destination position with the current position
export function moveTowards(
  person: Hero,
  destinationPosition: Vector2,
  speed: number,
) {
  let distanceToTravelX = destinationPosition.x - person.position.x; //distance to travel in x
  let distanceToTravelY = destinationPosition.y - person.position.y; //distance to travel in y

  let distance = Math.sqrt(distanceToTravelX ** 2 + distanceToTravelY ** 2); //hypotenuse (shortest path)

  if (distance <= speed) {
    //if distance remaining is less than the speed, snap the user to that grid location 
    person.position.x = destinationPosition.x;
    person.position.y = destinationPosition.y;
  } else {
    //calculate the unit vectors so that the diagonal speed is consistent with the set speed
    const normalizedX = distanceToTravelX / distance;
    const normalizedY = distanceToTravelY / distance;

    //normalized distance that should be covered every update, update the current position
    person.position.x += normalizedX * speed;
    person.position.y += normalizedY * speed;

    //what is the further distance left after updating the current position
    distanceToTravelX = destinationPosition.x - person.position.x;
    distanceToTravelY = destinationPosition.y - person.position.y;
    
    distance = Math.sqrt(distanceToTravelX ** 2 + distanceToTravelY ** 2);
  }

  return distance;
}
