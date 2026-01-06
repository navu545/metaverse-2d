/*these are the current positions which are occupied by static objects. Later on we can add a function here, that'll track
the positions of the heroes and dynamically update this list
*/

export const walls = new Set<string>();

walls.add('64,48');

walls.add("64,64");
walls.add("64,80");
walls.add("80,64");
walls.add("80,80");

walls.add("112,80");
walls.add("128,80");
walls.add("144,80");
walls.add("160,80");