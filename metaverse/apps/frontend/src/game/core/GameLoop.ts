export class GameLoop {

    private lastFrameTime: number;
    private accumulatedTime: number;
    private readonly timeStep: number;
    private rafId: number | null;
    private isRunning: boolean;

    private update: (deltaTime:number) => void;
    private render: () => void;


  constructor(update: (deltaTime: number) => void, render: () => void) {
    this.lastFrameTime = 0;
    this.accumulatedTime = 0;
    this.timeStep = 1000 / 60;

    this.update = update;
    this.render = render;

    this.rafId = null;
    this.isRunning = false;
  }

  private mainLoop = (timestamp: number): void => {
    if (!this.isRunning) return;

    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    this.accumulatedTime += deltaTime;

    while (this.accumulatedTime >= this.timeStep) {
      this.update(this.timeStep);
      this.accumulatedTime -= this.timeStep;
    }

    this.render();

    this.rafId = requestAnimationFrame(this.mainLoop);
  };

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
