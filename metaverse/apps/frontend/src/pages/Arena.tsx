import { useEffect, useRef } from "react";
import { startGame } from "../game";
import { makeASpace } from "../httpModule/testApi";
import { connectWS } from "../wsModule/wsConnect";


export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const localPlayerRef = useRef<{
    id:string;
    x:number;
    y:number
  } | null>(null);

  const positionKeyRef = useRef<string>("")

  const userIdRef = useRef<string>("")

  const remotePlayersRef = useRef<Map<string, {x:number, y:number, animation?:string}>>(new Map());

  const isMounted = useRef(false)

  const stopGameRef = useRef<(() => void) | null>(null);


  useEffect(() => {


    const init = async () => {

      try {

        //save the canvas in a ref
        const canvas = canvasRef.current;

        //connect to http
        const {spaceId, adminToken } = await makeASpace();

        console.log(spaceId)
        console.log(adminToken);
  
          //connect to ws
        const ws = await connectWS(
          "cmifpn9rz0521vbbcevoc6mde",
          adminToken
        );

        //save the ws in useRef
        wsRef.current = ws;

        //attaching listeners
        ws.onmessage = (event) => {

          const msg = JSON.parse(event.data);

          switch (msg.type) {

            case "space-joined": {

              const { id, spawn, userId, users } = msg.payload;

              userIdRef.current = userId

              localPlayerRef.current = {
                id: id,
                x: spawn.x,
                y: spawn.y,
              };

              //create a map to save the other users recieved info
              const remoteMap = new Map();

              users.forEach((u: { id: string; x: number; y: number }) => {
                remoteMap.set(u.id, { x: u.x, y: u.y });
              });

              //save it
              remotePlayersRef.current = remoteMap;

              stopGameRef.current = startGame(
                canvas,
                wsRef.current!,
                localPlayerRef,
                remotePlayersRef,
                positionKeyRef
              );

              break;
            }

            case "movement": {
              
              const { id, x, y, animation } = msg.payload;

              console.log(x,y)

              if (id !== localPlayerRef.current?.id) {
                remotePlayersRef.current.set(id, { x, y,animation });
              }

              break;

            }

            case "movement-rejected":{

              const {id,x,y} = msg.payload
              
              if (id === localPlayerRef.current?.id) {
                  localPlayerRef.current!.x = x;
                  localPlayerRef.current!.y = y;
              }
              break
            }


            case "user-joined": {
              const { id, x, y } = msg.payload;
              remotePlayersRef.current.set(id, { x, y });
              break;
            }

            case "user-left": {
              console.log('user left received')
              const { id } = msg.payload;
              remotePlayersRef.current.delete(id);
              console.log('player deleted')
              break;
            }

            case "new-tab": {

              if(!stopGameRef.current){
                return
              }
              const stopGame = stopGameRef.current
              stopGame()
              break;
            }

          }
        }


      } 
      
      catch (err) {
        console.error("Setup failed:", err);
      }

    };

    if(!isMounted.current){ 
      isMounted.current = true
      init()

    }

    
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={180}
      style={{ border: "1px solid black" }}
    />
  );
}
