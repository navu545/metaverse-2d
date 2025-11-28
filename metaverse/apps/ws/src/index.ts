import { WebSocketServer } from "ws";
import { User } from "./User";
import { RoomManager } from "./RoomManager";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", function connection(ws) {

  console.log("user connected")

  let user = new User(ws);
  
  ws.on("error", console.error);

  ws.on('close', () => {

    if (!user) return;
    user.cleanup();
    console.log('user left')

  })
  
});
