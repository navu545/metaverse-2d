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
};

export type UserAvailability =
  | "FREE"
  | "PENDING_IN"
  | "PENDING_OUT"
  | "IN_SESSION_ADMIN"
  | "IN_SESSION_MEMBER"
  | "ADMIN_AND_PENDING_IN";

export default function Arena() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [chatAdmin, setChatAdmin] = useState<string>("");

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

  const chatAdminRef = useRef<string>("");

  const remotePlayersRef = useRef<
    Map<string, { x: number; y: number; animation?: string }>
  >(new Map());

  const isMounted = useRef(false);

  const stopGameRef = useRef<(() => void) | null>(null);

  const ourUserAvailabilityRef = useRef<UserAvailability>('FREE')

  const proximityRef = useRef<Set<string>>(new Set())

  const availabilityRef = useRef<Map<string, UserAvailability>>(new Map());

  const requesterRef = useRef<string|null> (null); //one who requested

  const sessionIdRef = useRef<string>(null);

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
                console.log(id);

                //create a map to save the other users recieved info
                const remoteMap = new Map();

                users.forEach((u: { id: string; x: number; y: number }) => {
                  remoteMap.set(u.id, { x: u.x, y: u.y });
                });

                //save it
                remotePlayersRef.current = remoteMap;

                users.forEach((u: { id: string; x: number; y: number }) => {
                  availabilityRef.current.set(u.id, "FREE");
                });

                availabilityRef.current.set(id, "FREE");

                stopGameRef.current = startGame(
                  canvas,
                  wsRef.current!,
                  localPlayerRef,
                  remotePlayersRef,
                  positionKeyRef,
                  proximityRef,
                  availabilityRef,
                  ourUserAvailabilityRef,
                  requesterRef
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

                const s = proximityRef.current;
                users.forEach((id: string) => s.add(id));
              }

              break;

            case "proximity-leave":
              {
                
                const { users, stationary } = msg.payload;

                const s = proximityRef.current;

                users.forEach((id: string) => {

                  s.delete(id);

                  if (requesterRef.current === id){
                    requesterRef.current = null;
                    console.log('requester ref deleted')
                  }

                });

                

                
              }
              break;

            case "availability-update":
              {
                const { userId, availability } = msg.payload;
                availabilityRef.current.set(userId, availability);

                const ourId = localPlayerRef.current?.id;

                if(!ourId) return;

                console.log(availabilityRef.current.get(ourId), 'availability update at client');
          

                ourUserAvailabilityRef.current = availabilityRef.current.get(ourId) ?? 'FREE'

              }
              break;

            case "request-sent":
              {
                console.log("you sent request");
              }
              break;

            case "you-rejected-request":
              {
                console.log("you rejected request");

                requesterRef.current = null;


              }
              break;

            case "you-accepted-request":
              {
                const id = msg.payload.user;

                requesterRef.current = null;

              }
              break;

            case "message-request":
              {
                console.log("message request received");

                const { id, userId  } = msg.payload

                requesterRef.current = id

                console.log(requesterRef.current, 'requester ref saved')

              }
              break;

            case "request-accepted":
              {
                const { users } = msg.payload;

                console.log("your request was accepted");

                // pendingTargetRef.current = null;
              }
              break;

            case "request-rejected":
              {
                console.log("your request was rejected");

                const id = msg.payload.user;

                // pendingTargetRef.current = null;
              }
              break;

            case "chat-session":
              {
                const { sessionId, numberUsers, chatAdmin } = msg.payload;

                sessionIdRef.current = sessionId;

                chatAdminRef.current = chatAdmin;

                setChatAdmin(chatAdmin)

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
                console.log("session ended");
                setSessionId(null);
          
              }
              break;

            case "user-left-chat": {
              const { userId, userName } = msg.payload;

              console.log(userName, "left the chat");
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
      {ws && sessionId && chatAdmin && (
        <ChatBox ws={ws} sessionId={sessionId} userName={userName} chatAdmin={chatAdmin}></ChatBox>
      )}
      <div>
        <DebugOverlay />
      </div>
    </div>
  );
}
