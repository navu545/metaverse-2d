type frameObject = {
    time: number;
    frame: number;
}

type animationConfigType =  {
    duration: number;
    frames: frameObject[]
}

//the constants we are exporting from the heroAnimations are the animation configs

/*FrameIndexPattern acts as a track player for the frame track that is given to it, like walking animations track etc.,
it spits out a frame based on the time it is given. */

export class FrameIndexPattern {

    currentTime: number;
    animationConfig: animationConfigType;
    duration: number;

  constructor(animationConfig: animationConfigType) {
    this.currentTime = 0;
    this.animationConfig = animationConfig;
    this.duration = animationConfig.duration ?? 500;
  }

  //we run the loop in reverse to extarct the latest keyFrame, currentTime will keep getting updated in step and then reset

  get frame() {
    const { frames } = this.animationConfig;

    for (let i = frames.length - 1; i >= 0; i--) {
      if (this.currentTime >= frames[i].time) {
        return frames[i].frame;
      }
    }
    throw "Time is before the first keyframe";
  }


  step(delta: number) {
    this.currentTime += delta;
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
  }
}
