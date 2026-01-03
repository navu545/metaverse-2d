/*GameLoop is responsible for calculating delta, which is basically the time elapsed between two frames, allowing us to 
keep the updates and rendering consistent (60fps) */

export class GameLoop {
  private lastFrameTime: number;
  private accumulatedTime: number;
  private readonly timeStep: number;
  private rafId: number | null;
  private isRunning: boolean;

  private update: (deltaTime: number) => void;
  private render: () => void;

  constructor(update: (deltaTime: number) => void, render: () => void) {
    this.lastFrameTime = 0;
    this.accumulatedTime = 0;
    this.timeStep = 1000 / 60; //1000ms/60frames = 16.6ms/frame

    //function imported from outside that'd be run every loop cycle
    this.update = update;
    this.render = render;

    this.rafId = null;
    this.isRunning = false;
  }

  //timestamp would be passed by the browser (requetsAnimationFrame) to the mainLoop
  private mainLoop = (timestamp: number): void => {
    if (!this.isRunning) return;

    const deltaTime = timestamp - this.lastFrameTime; //time between two frames

    this.lastFrameTime = timestamp; //new timestamp for the next delta calculation

    this.accumulatedTime +=
      deltaTime; /*this acts like a reservoir for the fluctuations in times elapsed between frames, if two frames
    passed by quicker, and are less than the minimum time for update (timeStep), its gonna hold updates, if it is more than 
    the minimum time, it might run multiple updates, this ensures game logic consistency across all devices */

    //fixed time step update
    while (this.accumulatedTime >= this.timeStep) {
      this.update(this.timeStep);
      this.accumulatedTime -= this.timeStep;
    }

    this.render();

    //requestAnimationFrame is a scheduling function, whatever you pass into it, browser runs it before the next screen paint
    this.rafId = requestAnimationFrame(this.mainLoop);
  };

  //this starts off the loop for the first time
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.rafId = requestAnimationFrame(this.mainLoop);
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.isRunning = false;
  }
}
