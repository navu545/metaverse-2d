import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import { JWT_PASSWORD } from "./config";
import { SpaceUserService } from "./services/SpaceUserService";

function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
export class User {
  public id: string;
  public userId?: string;
  public spaceId?: string;
  public x: number;
  public y: number;
  private animation?: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private service = new SpaceUserService();
  private nearbyUsers: Set<string> = new Set();

  constructor(private ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.animation = "DOWN";
    this.initHandlers();
  }

  initHandlers() {
    this.ws.on("message", async (data) => {
      const parsedData = JSON.parse(data.toString());
      switch (parsedData.type) {
        case "join":{
          const spaceId = parsedData.payload.spaceId;
          const token = parsedData.payload.token;

          const userId = (jwt.verify(token, JWT_PASSWORD) as JwtPayload).userId;
          if (!userId) {
            this.ws.close();
            return;
          }

          this.userId = userId;

          console.log(userId);

          const space = await client.space.findFirst({
            where: {
              id: spaceId,
            },
          });
          if (!space) {
            this.ws.close();
            return;
          }
          this.spaceId = spaceId;

          const existingUser = RoomManager.getInstance().findUser(
            userId,
            spaceId
          );

          if (existingUser) {
            existingUser.send({
              type: "new-tab",
            });
            existingUser.cleanup();
          }

          const existing = await this.service.findPlayer({ userId, spaceId });

          if (existing) {
            this.x = existing.x;
            this.y = existing.y;
          } else {
            const randomX = Math.floor((Math.random() * space.width) / 16);
            const randomY = Math.floor((Math.random() * space.height) / 16);
            const created = await this.service.createPlayer({
              userId,
              spaceId,
              x: randomX,
              y: randomY,
            });
            this.x = created.x;
            this.y = created.y;
          }

          console.log(this.x, this.y);

          RoomManager.getInstance().addUser(spaceId, this);

          this.send({
            type: "space-joined",
            payload: {
              id: this.id,
              userId: this.userId,
              spawn: {
                x: this.x,
                y: this.y,
              },
              users:
                RoomManager.getInstance()
                  .rooms.get(spaceId)
                  ?.filter((x) => x.id !== this.id)
                  ?.map((u) => ({ id: u.id, x: u.x, y: u.y })) ?? [],
            }, //we made a change here to include the coordinates of other users on spawning
          });

          RoomManager.getInstance().broadcast(
            {
              type: "user-joined",
              payload: {
                id: this.id,
                x: this.x,
                y: this.y,
              },
            },
            this,
            this.spaceId!
          );

          this.startSaveInterval();
          }

          break;
        case "move": {
          const moveX = parsedData.payload.x;
          const moveY = parsedData.payload.y;
          const xDisplacement = Math.abs(this.x - moveX);
          const yDisplacement = Math.abs(this.y - moveY);
          const animation = parsedData.payload.animation;

          const EPS = 0.001;

          const withinX =
            xDisplacement <= 1 + EPS && Math.abs(yDisplacement) <= EPS;

          const withinY =
            yDisplacement <= 1 + EPS && Math.abs(xDisplacement) <= EPS;

          if (
            withinX ||
            withinY
            //here we can do the verification if the made move was legal or not
          ) {
            this.x = moveX;
            this.y = moveY;
            this.animation = animation;

            RoomManager.getInstance().broadcast(
              {
                type: "movement",
                payload: {
                  id: this.id,
                  x: this.x,
                  y: this.y,
                  animation: this.animation,
                },
              },
              this,
              this.spaceId!
            );

            this.runProximity();

            return;
          }

          this.send({
            type: "movement-rejected",
            payload: {
              id: this.id,
              x: this.x,
              y: this.y,
            },
          });
        }
          break;

        case "run-proximity": {
          this.runProximity();
        }
        break;

        case "send-message-request": {
          
          const userIds:string[] = parsedData.payload.users
       
          const messageReqUsers = userIds
            .map((id) =>
              RoomManager.getInstance().findUserById(id, this.spaceId!)
            )
            .filter((u):u is User=> u !== null);
      
          messageReqUsers?.forEach((u) => {
            u.send({
              type:"message-request",
              payload:{
                id: this.id,
                userId: this.userId,
                
              }
            })
          })

        }
        break;



        case "message-request-accept": {

          const users: string[] = parsedData.payload.users

          const acceptedUsers = users.map((id) => RoomManager.getInstance().findUserById(id, this.spaceId!)).filter((u): u is User => u!== null)

          acceptedUsers.forEach((u) => {
            u.send({
              type:'request-accepted',
              payload: {
                users: [this.id]
              }
            })
          })
        }
        break;
      }
    });
  }

  private runProximity() {
    const nearbyPlayers = RoomManager.getInstance().findNearbyPlayers(
      this,
      this.spaceId!,
      1
    );

    const currentSet = new Set<string>(nearbyPlayers.map((u) => u.id!));

    const previousSet = this.nearbyUsers;

    this.proximity(previousSet, currentSet);
  }

  private startSaveInterval() {
    if (this.saveInterval) return;

    this.saveInterval = setInterval(() => {
      if (!this.userId || !this.spaceId) return;

      this.service
        .updatePosition({
          userId: this.userId,
          spaceId: this.spaceId,
          x: this.x,
          y: this.y,
        })
        .catch(() => {});
    }, 3000);
  }

  public cleanup() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    if (this.userId && this.spaceId) {
      this.service
        .updatePosition({
          userId: this.userId,
          spaceId: this.spaceId,
          x: this.x,
          y: this.y,
        })
        .catch(() => {});
    }

    this.destroy();
  }

  destroy() {
    RoomManager.getInstance().broadcast(
      {
        type: "user-left",
        payload: {
          id: this.id,
        },
      },
      this,
      this.spaceId!
    );

    RoomManager.getInstance().broadcast(
      {
      type: "proximity-leave",
      payload: {
        users: [this.id],
      },
    },
      this,
      this.spaceId!
    );

    RoomManager.getInstance().removeUser(this, this.spaceId!);
  }
  send(payload: OutgoingMessage) {
    this.ws.send(JSON.stringify(payload));
  }

  sendProximityEnter(usersJoined: string[]) {
    this.send({
      type: "proximity-enter",
      payload: {
        users: usersJoined,
      },
    });
  }

  sendProximityLeave(usersLeft: string[]) {
    this.send({
      type: "proximity-leave",
      payload: {
        users: usersLeft,
      },
    });
  }

  proximity(a: Set<any>, b: Set<any>) {
    let usersLeft = [];
    let usersJoined = [];

    for (const user of a) {
      if (!b.has(user)) {
        usersLeft.push(user);
      }
    }

    if (usersLeft.length > 0) {
      this.sendProximityLeave(usersLeft);
    }

    for (const user of b) {
      if (!a.has(user)) {
        usersJoined.push(user);
      }
    }

    if (usersJoined.length > 0) {
      this.sendProximityEnter(usersJoined);
    }

    this.nearbyUsers = b;
  }
}

