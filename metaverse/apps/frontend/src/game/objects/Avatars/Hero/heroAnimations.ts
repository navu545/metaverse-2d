
/*The two functions here return the duration for which the animation should repeat, and the time stamps of when they should 
appear. eg. Our sprite image of hero avatar contains frames in 3*8 orientation, frame 0 is the frame in 0th row and 0th column,
frame 1 is frame in 0th row, and 1st column and so on. The way we have designed this makeWalkingFrames is that at 
time 0, the middle frame will occur, then at time 1, the frame before that, then the middle again and then the last one,
and this whole cycle repeats giving an illusion of our character walking. */


const makeWalkingFrames = (rootFrame = 0) => {
  return {
    duration: 400,
    frames: [
      {
        time: 0,
        frame: rootFrame + 1,
      },
      {
        time: 100,
        frame: rootFrame,
      },
      {
        time: 200,
        frame: rootFrame + 1,
      },
      {
        time: 300,
        frame: rootFrame + 2,
      },
    ],
  };
};

const makeStandingFrames = (rootFrame = 0) => {
  return {
    duration: 400,
    frames: [
      {
        time: 0,
        frame: rootFrame,
      },
    ],
  };
};

//we export these returned objects {duration:total time, frames:[{time:when should this frame appear, frame:which frame}]}

export const WALK_DOWN = makeWalkingFrames(0);
export const WALK_UP = makeWalkingFrames(6);
export const WALK_LEFT = makeWalkingFrames(9);
export const WALK_RIGHT = makeWalkingFrames(3);

export const STAND_DOWN = makeStandingFrames(1);
export const STAND_RIGHT = makeStandingFrames(4);
export const STAND_UP = makeStandingFrames(7);
export const STAND_LEFT = makeStandingFrames(10);

export const PICK_UP_DOWN = {
  duration: 400,
  frames: [
    {
      time: 0,
      frame: 12,
    },
  ],
};
