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

//this is the main function which runs the game loop
export function startGame(
  canvas: HTMLCanvasElement | null,
  ws: WebSocket,
  spawn: React.RefObject<{ id: string; x: number; y: number } | null>,
  remotePlayers: React.RefObject<
    Map<string, { x: number; y: number; animation?: string }>
  >,
  proximityRef: React.RefObject<Set<string>>,
  availabilityRef: React.RefObject<Map<string, UserAvailability>>,
  ourUserAvailabilityRef: React.RefObject<UserAvailability>,
  requesterRef: React.RefObject<string | null>
) {
  //click detection event added to the canvas element which emits world position (in-game world)
  canvas?.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();

    //convert the click position in canvas terms, client/rect are positions of click/canvas in css relative to viewport
    let canvasX = e.clientX - rect.left;
    let canvasY = e.clientY - rect.top;

    //we scale the click position if the canvas was scaledup/down relative to viewport
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    canvasX *= scaleX;
    canvasY *= scaleY;

    //we get rid of the offset caused by camera to get the world position
    const worldX = canvasX - camera.position.x;
    const worldY = canvasY - camera.position.y;

    events.emit("CLICK", { x: worldX, y: worldY });
  });

  //map to store hero objects
  const remoteHeroObjects = new Map<string, Hero>();

  //context for canvas
  const ctx = canvas!.getContext("2d");

  //outermost gameObject which will inherit more or less every game object
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

  //this is our local hero, we pass in the spawn position received from the server and add it to the mainScene
  const hero = new Hero(
    gridCells(spawn.current!.x),
    gridCells(spawn.current!.y),
    spawn.current!.id,
    {
      remoteHero: false,
      ws: ws,
    }
  );
  mainScene.addChild(hero);

  /*this function runs updates for all the remote players being rendered by first creating them if they dont't exist, 
  and second if it does exist, it constantly runs in update function repeatedly checking on remoteplayers map and saves
  everything in its own remote hero objects map, including their positions and animations*/

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

          /*pass in the hero's id in computerHeroUI so we can scan through different refs like availability, proximity for 
          a potential match and thus passing the ui object returned by the function computeHeroUI into setUI which is 
          responsible for many differet UI changes of the remote hero */

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

  /*the following function takes care of scanning through different refs to check on the status of all the players and accordingly
  returns and object which contains boolean values allowing them to be used in the hero objects for UI changes, 
  like different message bubbles appearing and disappearing*/

  function computeHeroUI(heroId: string) {
    const inProximity = proximityRef.current.has(heroId);

    const availability = availabilityRef.current.get(heroId) ?? "FREE";

    const sentRequestPending = ourUserAvailabilityRef.current === "PENDING_OUT";

    const pendingRequests =
      ourUserAvailabilityRef.current === "PENDING_OUT" ||
      ourUserAvailabilityRef.current === "PENDING_IN";

    const weWereRequested = requesterRef.current === heroId;

    const weAreInSession =
      ourUserAvailabilityRef.current === "IN_SESSION_ADMIN" ||
      ourUserAvailabilityRef.current === "IN_SESSION_MEMBER" ||
      ourUserAvailabilityRef.current === "ADMIN_AND_PENDING_IN";

    if (!availability) {
      return {
        chatEnabled: false,
        loaderEnabled: false,
        showAccept: false,
        showReject: false,
      };
    }

    return {
      chatEnabled:
        inProximity &&
        (availability === "FREE" || availability === "IN_SESSION_ADMIN") &&
        !pendingRequests &&
        !weAreInSession,

      loaderEnabled:
        inProximity &&
        sentRequestPending &&
        (availability === "PENDING_IN" ||
          availability === "ADMIN_AND_PENDING_IN"),

      showAccept:
        inProximity && availability === "PENDING_OUT" && weWereRequested,

      showReject:
        inProximity && availability === "PENDING_OUT" && weWereRequested,
    };
  }

  //camera object instance to center our hero
  const camera = new Camera();
  mainScene.addChild(camera);

  //test inventory object
  const rod = new Rod(gridCells(7), gridCells(6));
  mainScene.addChild(rod);

  //test HUD for inventory
  const inventory = new Inventory();

  //we attach the input instance to the main scene which is later made use of in hero gameObject, input tells direction key
  mainScene.input = new Input();

  //this function takes in the delta (elapsed time) and passes it to the outmost gameObject which further passes it down to children
  const update = (delta: number) => {
    updateRemotePlayer();

    mainScene.stepEntry(delta, mainScene);
  };

  //this is drawing function which used ctx to render gameObjects
  const draw = () => {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

    skySprite.drawImage(ctx!, 0, 0);

    ctx!.save();

    ctx!.translate(camera.position.x, camera.position.y);

    mainScene.draw(ctx!, 0, 0);

    ctx!.restore();

    inventory.draw(ctx!, 0, 0);
  };

  //this is gameLoop which takes care of running game logic every 16ms (60fps), passes the delta down in update
  const gameLoop = new GameLoop(update, draw);

  gameLoop.start();

  //this stops the gameloop
  return () => {
    gameLoop.stop(); // stop requestAnimationFrame loop

    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.fillStyle = "blue";
    ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  };
}
