import { GameLoop } from "./core/GameLoop.js";
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
import { events } from "./core/Events.ts";
import type React from "react";
import type { UserAvailability } from "../pages/Arena.tsx";

export function startGame(
  canvas: HTMLCanvasElement | null,
  ws: WebSocket,
  spawn: React.RefObject<{ id: string; x: number; y: number } | null>,
  remotePlayers: React.RefObject<
    Map<string, { x: number; y: number; animation?: string }>
  >,
  positionKey: React.RefObject<string>,
  proximityRef: React.RefObject<Set<string>>,
  availabilityRef: React.RefObject<Map<string, UserAvailability>>,
  ourUserAvailabilityRef: React.RefObject<UserAvailability>,
  requesterRef: React.RefObject<string|null>
) {
  canvas?.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();

    let canvasX = e.clientX - rect.left;
    let canvasY = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    canvasX *= scaleX;
    canvasY *= scaleY;

    const worldX = canvasX - camera.position.x;
    const worldY = canvasY - camera.position.y;

    events.emit("CLICK", { x: worldX, y: worldY });
  });

  const remoteHeroObjects = new Map<string, Hero>();

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

  const hero = new Hero(
    gridCells(spawn.current!.x),
    gridCells(spawn.current!.y),
    spawn.current!.id,
    {
      positionKey: positionKey,
      remoteHero: false,
      ws: ws,
    }
  );
  mainScene.addChild(hero);

  function updateRemotePlayer() {
    for (const [playerId, props] of remotePlayers.current) {
      //if remote player doesnt exist
      if (!remoteHeroObjects.has(playerId)) {
        const x = props.x;
        const y = props.y;
        const remoteAnimation = props.animation;

        const remoteHero = new Hero(gridCells(x), gridCells(y), playerId, {
          remoteHero: true,
          animation: remoteAnimation,
          ws: ws,
        });

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
          hero.remoteHero = true;
          hero.webSocketConnection = ws;
          hero.remoteAnimation = remoteAnimation;
          const ui = computeHeroUI(playerId);
          hero.setUI(ui);
        }
      }
    }

    //if the latest list doesnt have an existing id, get rid of it
    for (const id of Array.from(remoteHeroObjects.keys())) {
      if (!remotePlayers.current.has(id)) {
        const hero = remoteHeroObjects.get(id)!;
        mainScene.removeChild(hero);
        remoteHeroObjects.delete(id);
      }
    }
  }

  function computeHeroUI(heroId: string) {
    const inProximity = proximityRef.current.has(heroId);
    
    const availability = availabilityRef.current.get(heroId) ?? "FREE";
   
    const sentRequestPending = ourUserAvailabilityRef.current === "PENDING_OUT";

    const pendingRequests =
      ourUserAvailabilityRef.current === "PENDING_OUT" ||
      ourUserAvailabilityRef.current === "PENDING_IN";

    const weWereRequested = requesterRef.current === heroId   

    const weAreInSession =
      ourUserAvailabilityRef.current === "IN_SESSION_ADMIN" ||
      ourUserAvailabilityRef.current === "IN_SESSION_MEMBER"; 
  
    

    if (!availability) {
      return {
        chatEnabled: false,
        loaderEnabled: false,
        showAccept: false,
        showReject: false,
      };
    }


    return {
      chatEnabled: inProximity && (availability === "FREE" || availability === "IN_SESSION_ADMIN") && !pendingRequests && !weAreInSession,

      loaderEnabled:
        inProximity && sentRequestPending && availability === "PENDING_IN",

      showAccept:
        inProximity && availability === "PENDING_OUT" && weWereRequested,

      showReject:
        inProximity && availability === "PENDING_OUT" && weWereRequested,
    };
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
