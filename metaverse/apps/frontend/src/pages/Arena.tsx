import { useEffect, useRef, useState } from "react";
import { startGame } from "../game";
import { makeASpace } from "../httpModule/testApi";
import { connectWS } from "../wsModule/wsConnect";
import ChatBox from "../components/Chatbox";
import { DebugOverlay } from "../components/DebugOverlay";

declare global {
  interface Window {
    ws?: WebSocket;
  }
}

export type InteractionState = {
  proximity: Set<string>;
  pendingIncoming: Set<string>;
  pendingOutgoing: Set<string>;
  accepted: Set<string>;
  rejected: Set<string>;
}

export default function Arena() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [sessionUsersNumber, setSessionUsersNumber] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const localPlayerRef = useRef<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const positionKeyRef = useRef<string>("");

  const userIdRef = useRef<string>("");

  const userNameRef = useRef<string>("");

  const remotePlayersRef = useRef<
    Map<string, { x: number; y: number; animation?: string }>
  >(new Map());

  const isMounted = useRef(false);

  const stopGameRef = useRef<(() => void) | null>(null);

  const interactionRef = useRef<InteractionState>({
    proximity: new Set(),
    pendingIncoming: new Set(),
    pendingOutgoing: new Set(),
    accepted: new Set(),
    rejected: new Set(),
  });

  const sessionIdRef = useRef<string>(null)


  useEffect(() => {
    const init = async () => {
      try {
        //save the canvas in a ref
        const canvas = canvasRef.current;

        //connect to http
        const { spaceId, adminToken } = await makeASpace();

        //connect to ws
        const ws = await connectWS("cmifpn9rz0521vbbcevoc6mde", adminToken);

        setWs(ws);

        //save the ws in useRef
        wsRef.current = ws;

        window.ws = ws;

        //attaching listeners
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "space-joined":
              {
                const { id, spawn, userId, users, userName } = msg.payload;

                userIdRef.current = userId;

                userNameRef.current = userName;
                setUserName(userName);

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
                  positionKeyRef,
                  interactionRef
                );
              }
              break;

            case "movement":
              {
                const { id, x, y, animation } = msg.payload;

                if (id !== localPlayerRef.current?.id) {
                  remotePlayersRef.current.set(id, { x, y, animation });
                }

                //trigger move here to run proximity check when we are stationary

                wsRef.current!.send(
                  JSON.stringify({
                    type: "run-proximity",
                  })
                );
              }
              break;

            case "movement-rejected":
              {
                const { id, x, y } = msg.payload;

                if (id === localPlayerRef.current?.id) {
                  localPlayerRef.current!.x = x;
                  localPlayerRef.current!.y = y;
                }
              }
              break;

            case "user-joined":
              {
                const { id, x, y } = msg.payload;
                remotePlayersRef.current.set(id, { x, y });
              }
              break;

            case "user-left":
              {
                console.log("user left fired");
                const { id } = msg.payload;
                remotePlayersRef.current.delete(id);
              }
              break;

            case "new-tab":
              {
                if (!stopGameRef.current) {
                  return;
                }
                const stopGame = stopGameRef.current;
                stopGame();
              }
              break;

            case "proximity-enter":
              {
                console.log("proximity-entered");
                const { users, stationary } = msg.payload;

                const s = interactionRef.current;
                users.forEach((id:string) => s.proximity.add(id))

              }
              break;

            case "proximity-leave":
              {
                console.log("proximity-leave");
                const { users, stationary } = msg.payload;

                const s = interactionRef.current;

                users.forEach((id:string)=> {
                  s.proximity.delete(id);
                  s.pendingIncoming.delete(id);
                  s.pendingOutgoing.delete(id);
                  s.accepted.delete(id);
                  s.rejected.delete(id);
                } )
              }
              break;

            case "request-sent":
              {

                const user: string = msg.payload.user;

                const s = interactionRef.current

                s.pendingOutgoing.add(user);

              }
              break;

            case "you-rejected-request":
              {
                console.log('you rejected request')

                const id = msg.payload.user;

                const s = interactionRef.current;

                s.rejected.add(id)
                s.pendingIncoming.delete(id)
                s.pendingOutgoing.delete(id)
                
              }
              break;

            case "you-accepted-request": {

              const id = msg.payload.user;

              const s = interactionRef.current;

              s.accepted.add(id)
              s.pendingIncoming.delete(id);
              s.pendingOutgoing.delete(id)
              
            } 
            break; 

            case "message-request":
              {
                console.log("message request received");

                const { id, userId } = msg.payload;


                const s = interactionRef.current;

                s.pendingIncoming.add(id)

                
              }
              break;

            case "request-accepted":
              {
                const { users } = msg.payload;

                console.log("your request was accepted");

                const s = interactionRef.current;

                users.forEach((id:string) => {
                  s.accepted.add(id)
                  s.pendingIncoming.delete(id)
                  s.pendingOutgoing.delete(id)
                })

                
              }
              break;

            case "request-rejected":
              {
                console.log("your request was rejected");

                const id = msg.payload.user;

                const s = interactionRef.current;
               
                  s.rejected.add(id);
                  s.pendingIncoming.delete(id);
                  s.pendingOutgoing.delete(id);
              

                
              }
              break;

            case "chat-session":
              {
                const { sessionId, numberUsers } = msg.payload;

                setSessionUsersNumber(numberUsers);

                sessionIdRef.current = sessionId;

                setSessionId(sessionId);

                console.log("sessionId received", sessionId);
              }
              break;

            case "inbox-message":
              {
                const { text } = msg.payload;

                console.log("message received", text);
              }
              break;

            case "session-ended":
              { 
                const s = interactionRef.current;
                s.pendingIncoming.clear();
                s.pendingOutgoing.clear();
                s.accepted.clear();
                s.rejected.clear();

                console.log("session ended");
                setSessionId(null);
                setSessionUsersNumber(0);
              }
              break;


            case "user-left-chat": {
              const { userId, userName } = msg.payload;

              console.log(userName, "left the chat");

              setSessionUsersNumber((prev) => prev - 1);
            }
          }
        };
      } catch (err) {
        console.error("Setup failed:", err);
      }
    };

    if (!isMounted.current) {
      isMounted.current = true;
      init();
    }
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        style={{ border: "1px solid black" }}
      />
      {ws && sessionId && (
        <ChatBox ws={ws} sessionId={sessionId} userName={userName}></ChatBox>
      )}
      <div>
        <DebugOverlay />
      </div>
    </div>
  );
}
