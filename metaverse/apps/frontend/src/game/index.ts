import { GameLoop } from "./core/GameLoop.js"
import { Input } from "./core/Input.js";
import { resources } from "./core/Resource.js";
import { Sprite } from "./core/Sprite";
import { Vector2 } from "./core/Vector2";
import "../index.css";
import { gridCells } from "./helpers/grid";
import { GameObject } from "./core/GameObject";
import { Hero } from "./objects/Avatars/Hero/Hero.js";
import { Camera } from "./core/Camera";
import { Rod } from "./objects/Rod/Rod.ts";
import { Inventory } from "./objects/Inventory/Inventory.ts";


export function startGame(
  canvas: HTMLCanvasElement | null,
  ws: WebSocket,
  spawn: React.RefObject<{ id: string; x: number; y: number } | null>,
  remotePlayers: React.RefObject<Map<string, { x: number; y: number, animation?:string }>>,
  positionKey: React.RefObject<string>

) {

  const remoteHeroObjects = new Map<string, Hero>()

  const ctx = canvas!.getContext("2d");

  const mainScene = new GameObject(new Vector2(0, 0));

  const skySprite = new Sprite({
    resource: resources.images.sky,
    frameSize: new Vector2(320, 180),
  });

  const groundSprite = new Sprite({
    resource: resources.images.ground,
    frameSize: new Vector2(320, 180),
  });
  mainScene.addChild(groundSprite);

  const hero = new Hero(gridCells(spawn.current!.x), gridCells(spawn.current!.y),{positionKey:positionKey, remoteHero:false, ws:ws});
  mainScene.addChild(hero);

  function updateRemotePlayer() {  

    for (const [playerId, props] of remotePlayers.current){ 
    //if remote player doesnt exist  
      if (!remoteHeroObjects.has(playerId))
      {
        const x = props.x;
        const y = props.y;
        const remoteAnimation = props.animation;
        const remoteHero = new Hero(
          gridCells(x),
          gridCells(y),
          {remoteHero:true,
          animation:remoteAnimation}
        );
        mainScene.addChild(remoteHero);

        remoteHeroObjects.set(playerId, remoteHero);



      } else {
        //if it already exists just update its position
        const x = props.x;
        const y = props.y;
        const remoteAnimation = props.animation;
        const hero = remoteHeroObjects.get(playerId);
        if (hero) {
          hero.destinationPosition = new Vector2(gridCells(x), gridCells(y));
          hero.remoteHero = true
          hero.webSocketConnection = ws
          hero.remoteAnimation = remoteAnimation
        }
        
      }
      //if the latest list doesnt have an existing id, get rid of it
      for (const id of Array.from(remoteHeroObjects.keys())) {
        
        if (!remotePlayers.current.has(id)) {
          const hero = remoteHeroObjects.get(id)!;
          mainScene.removeChild(hero)
          remoteHeroObjects.delete(id)
        }
      }
    }
  }

  const camera = new Camera();
  mainScene.addChild(camera);

  const rod = new Rod(gridCells(7), gridCells(6));
  mainScene.addChild(rod);

  const inventory = new Inventory();

  mainScene.input = new Input();

  const update = (delta: number) => {
    updateRemotePlayer();
    mainScene.stepEntry(delta, mainScene);
  };

  const draw = () => {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

    skySprite.drawImage(ctx!, 0, 0);

    ctx!.save();

    ctx!.translate(camera.position.x, camera.position.y);

    mainScene.draw(ctx!, 0, 0);

    ctx!.restore();

    inventory.draw(ctx!, 0, 0);
  };

  const gameLoop = new GameLoop(update, draw);

  gameLoop.start();

  return () => {
    gameLoop.stop(); // stop requestAnimationFrame loop
    
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.fillStyle = "blue";
    ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  };
}
