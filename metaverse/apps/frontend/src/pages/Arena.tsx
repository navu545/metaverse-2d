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
//the following is the type describing availaibility status for the users
export type UserAvailability =
  | "FREE"
  | "PENDING_IN"
  | "PENDING_OUT"
  | "IN_SESSION_ADMIN"
  | "IN_SESSION_MEMBER"
  | "ADMIN_AND_PENDING_IN";

export default function Arena() {
  // UI state and engine refs for HTTP + WebSocket data

  const [ws, setWs] = useState<WebSocket | null>(null); //to store the ws connection, used for chatbox UI

  const [sessionId, setSessionId] = useState<string | null>(null); //to store the chat session id, used for chatbox UI

  const [userName, setUserName] = useState<string>(""); //to store the hero's name, used in chatbox UI

  const [chatAdmin, setChatAdmin] = useState<string>(""); //to store the chatadmin's name

  const canvasRef = useRef<HTMLCanvasElement | null>(null); //to store the html canvas element

  const wsRef = useRef<WebSocket | null>(null); //to store the ws connection without triggering re-renders

  const localPlayerRef = useRef<{
    id: string;
    x: number;
    y: number;
  } | null>(null); //local player's descriptives, ws-id and position

  const userIdRef = useRef<string>(""); //to store the db userid

  const userNameRef = useRef<string>(""); //to store the db username

  const chatAdminRef = useRef<string>(""); //to store the chatAdmin's name (unused currently)

  const remotePlayersRef = useRef<
    Map<string, { x: number; y: number; animation?: string }>
  >(new Map()); //to store the remote player's descriptives, their positions and ws-id

  const isMounted = useRef(false); // Prevents init from running twice due to React 18 StrictMode double-mount in development

  const stopGameRef = useRef<(() => void) | null>(null); //store the returned stopGame function from startGame

  const ourUserAvailabilityRef = useRef<UserAvailability>("FREE"); //hero's availaibility status

  const proximityRef = useRef<Set<string>>(new Set()); //set containing all the users in proximity

  const availabilityRef = useRef<Map<string, UserAvailability>>(new Map()); //set containing all the users and their availaibility

  const requesterRef = useRef<string | null>(null); //id of the user who sent the request (required for UI change)

  const sessionIdRef = useRef<string | null>(null); //store the session id and operate on it without triggering re-renders (unused)

  useEffect(() => {
    const init = async () => {
      try {
        //save the canvas in a ref
        const canvas = canvasRef.current;

        //connect to http, makeASpace is a sample module which returns us a spaceId and token after creating both
        const { spaceId, adminToken } = await makeASpace();

        //connect to ws, currently we are using the same spaceId for testing multiple users in same space
        const ws = await connectWS("cmifpn9rz0521vbbcevoc6mde", adminToken);

        /*we save the connection in a state so that if the connection itself changes, we do re-render. Also react
        doesnt detect wsRef for chatbox loading on initial render since it is null at the start so we need a 
        re render when ws finally arrives */
        setWs(ws);

        //save the ws in a useRef so we can use it in game logic
        wsRef.current = ws;

        window.ws = ws;

        //attaching listeners to the websocket connection
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            //this would be returned by the ws server upon sending the join event, contains all the relevant info about space
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

                remotePlayersRef.current = remoteMap;

                //set the starting status for all the users to be free, ours too
                users.forEach((u: { id: string; x: number; y: number }) => {
                  availabilityRef.current.set(u.id, "FREE");
                });

                availabilityRef.current.set(id, "FREE");

                //pass the refs into the startGame function so it can make use of it in the actual game
                stopGameRef.current = startGame(
                  canvas,
                  wsRef.current!,
                  localPlayerRef,
                  remotePlayersRef,
                  proximityRef,
                  availabilityRef,
                  ourUserAvailabilityRef,
                  requesterRef
                );
              }
              break;

            //we receive this event from the server when some other user moves
            case "movement":
              {
                const { id, x, y, animation } = msg.payload;

                if (id !== localPlayerRef.current?.id) {
                  remotePlayersRef.current.set(id, { x, y, animation });
                }

                //to update our proximity list while stationary, we send this event to server so it can trigger that
                wsRef.current!.send(
                  JSON.stringify({
                    type: "run-proximity",
                  })
                );
              }
              break;

            //we receive this event when our movement is invalidated and instead a new location is provided by the server
            case "movement-rejected":
              {
                const { id, x, y } = msg.payload;

                if (id === localPlayerRef.current?.id) {
                  localPlayerRef.current!.x = x;
                  localPlayerRef.current!.y = y;
                }
              }
              break;

            //we receive this event when another user joins, we update the remote player map
            case "user-joined":
              {
                const { id, x, y } = msg.payload;
                remotePlayersRef.current.set(id, { x, y });
              }
              break;

            //we receive this event when another user leaves, we update the remote player map
            case "user-left":
              {
                console.log("user left fired");
                const { id } = msg.payload;
                remotePlayersRef.current.delete(id);
              }
              break;

            //we receive this if we try to have multiple instances of game running, the old game instance is killed
            case "new-tab":
              {
                if (!stopGameRef.current) {
                  return;
                }
                const stopGame = stopGameRef.current;
                stopGame();
              }
              break;

            //we receive this from server updating our proximity map
            case "proximity-enter":
              {
                console.log("proximity-entered");
                const { users, stationary } = msg.payload;

                const s = proximityRef.current;
                users.forEach((id: string) => s.add(id));
              }

              break;

            //we receive this from server updating our proximity map and clearing who requested (since proximity is left)
            case "proximity-leave":
              {
                const { users, stationary } = msg.payload;

                const s = proximityRef.current;

                users.forEach((id: string) => {
                  s.delete(id);

                  if (requesterRef.current === id) {
                    requesterRef.current = null;
                    console.log("requester ref deleted");
                  }
                });
              }
              break;

            //we receive this from server when there's requests or session changes, we use this to update our local status map
            case "availability-update":
              {
                const { userId, availability } = msg.payload;
                availabilityRef.current.set(userId, availability);

                const ourId = localPlayerRef.current?.id;

                if (!ourId) return;

                console.log(
                  availabilityRef.current.get(ourId),
                  "availability update at client"
                );

                ourUserAvailabilityRef.current =
                  availabilityRef.current.get(ourId) ?? "FREE";
              }
              break;

            case "request-sent":
              {
                console.log("you sent request");
              }
              break;

            // we receive this from server when we reject a req, clear the requester ref for UI change
            case "you-rejected-request":
              {
                console.log("you rejected request");

                requesterRef.current = null;
              }
              break;

            // we receive this from server when we accept a req, clear the requester ref for UI change
            case "you-accepted-request":
              {
                const id = msg.payload.user;

                requesterRef.current = null;
              }
              break;

            //we receive this when we receive a request, we use it to update requesterRef for UI change for our remote heroes
            case "message-request":
              {
                console.log("message request received");

                const { id, userId } = msg.payload;

                requesterRef.current = id;

                console.log(requesterRef.current, "requester ref saved");
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

            //we receive this when a chat session is formed, we get relevant info about the session which we use for UI
            case "chat-session":
              {
                const { sessionId, numberUsers, chatAdmin } = msg.payload;

                sessionIdRef.current = sessionId;

                chatAdminRef.current = chatAdmin;

                setChatAdmin(chatAdmin);

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

            //we receive this from server when for any reason our chat session ends, we nullify the state of sessionid for UI change
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
        <ChatBox
          ws={ws}
          sessionId={sessionId}
          userName={userName}
          chatAdmin={chatAdmin}
        ></ChatBox>
      )}
      <div>
        <DebugOverlay />
      </div>
    </div>
  );
}
