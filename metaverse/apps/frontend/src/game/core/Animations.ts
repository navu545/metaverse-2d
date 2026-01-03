import { FrameIndexPattern } from "./FrameIndexPattern";

/*Animation class is fed key:frameIndexPatterns from the sprite class, its job is to store all the animation track players 
which contain all the animation tracks themselves, eg. it stores key1:FrameIndexPattern(WALK_DOWN), key2:FrameIndexPattern(WALK_UP).
*/

export class Animations {

  activeKey: string;
  patterns: Record<string, FrameIndexPattern>;

  constructor(patterns: Record<string, FrameIndexPattern>) {
    this.patterns = patterns;
    this.activeKey = Object.keys(this.patterns)[0]; //active track player
  }

  /*this getter runs the frame getter function in the track player(frameIndexPattern) which returns a track based on time
  .This getter function is being called in the sprite class to assign the active frame*/

  get frame() {
    return this.patterns[this.activeKey].frame;
  }

  //the following function is called by the sprite, and then the activeKey (current active track) is changed, providing it fresh time
  play(key: string, startAtTime = 0) {

    //if already playing this key, return

    if (this.activeKey === key) {
      return;
    }
    this.activeKey = key;

    //choose the asked track => reset the frameIndexPattern[asked track] current time
    this.patterns[this.activeKey].currentTime = startAtTime;
  }

  //passing the delta to frameIndexPattern
  step(delta: number) {
    this.patterns[this.activeKey].step(delta);
  }
}
