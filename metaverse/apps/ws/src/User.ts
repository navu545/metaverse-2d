import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import { JWT_PASSWORD } from "./config";
import { SpaceUserService } from "./services/SpaceUserService";
import { SessionManager } from "./SessionManager";

function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}


type UserAvailability = "FREE" | "PENDING_IN" | "PENDING_OUT" | "IN_SESSION_ADMIN" | "IN_SESSION_MEMBER"


export class User {
  public id: string;
  public userId?: string;
  public name?: string;
  public spaceId?: string;
  public x: number;
  public y: number;
  private animation?: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private service = new SpaceUserService();
  private nearbyUsers: Set<string> = new Set();
  public sessionId?: string;
  public availability: UserAvailability = "FREE";

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
        case "join":
          {
            const spaceId = parsedData.payload.spaceId;
            const token = parsedData.payload.token;

            const userId = (jwt.verify(token, JWT_PASSWORD) as JwtPayload)
              .userId;
            if (!userId) {
              this.ws.close();
              return;
            }

            this.userId = userId;

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

            const name = await client.user.findFirst({
              where: {
                id: userId,
              },
            });
            if (!name) {
              this.ws.close();
              return;
            }
            this.name = name.username;

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

            RoomManager.getInstance().addUser(spaceId, this);

            this.send({
              type: "space-joined",
              payload: {
                id: this.id,
                userId: this.userId,
                userName: this.name,
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
        case "move":
          {
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
              const stationary = false;
              this.runProximity(stationary);

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

        case "run-proximity":
          {
            const stationary = true;
            this.runProximity(stationary);
          }
          break;

        case "send-message-request":
          {
            const userId = parsedData.payload.user;

            const messageReqUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!messageReqUser) return;

            if (this.availability !== "FREE") {
              return;
            }

            if (
              messageReqUser.availability !== "FREE" &&
              messageReqUser.availability !== "IN_SESSION_ADMIN"
            ) {
              this.send({
                type: "request-rejected",
                payload: { user: messageReqUser.id },
              });
              return;
            }

            this.availability = "PENDING_OUT";
            messageReqUser.availability = "PENDING_IN";

            this.send({
              type: "request-sent",
              payload: {
                user: userId,
              },
            });

            messageReqUser.send({
              type: "message-request",
              payload: {
                id: this.id,
                userId: this.userId,
              },
            });

            this.broadcastAvailability()
            messageReqUser.broadcastAvailability()

            
          }
          break;

        case "message-request-accept":
          {
            const userId: string = parsedData.payload.user;

            const acceptedUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!acceptedUser) return;

            if (
              this.availability !== "PENDING_IN" ||
              acceptedUser?.availability !== "PENDING_OUT"
            )
              return;

            //here we will create a new session and assign a session id

            if (!this.sessionId) {
              

              const sessionUsers = [acceptedUser, this];

              const sessionId = getRandomString(10);

              sessionUsers.forEach((u) => {
                SessionManager.getInstance().addUser(sessionId, u);
                u.sessionId = sessionId;
              });

              this.availability = "IN_SESSION_ADMIN";
              acceptedUser.availability = "IN_SESSION_MEMBER";

              acceptedUser.send({
                type: "request-accepted",
                payload: {
                  users: [this.id],
                },
              });

              this.send({
                type: "you-accepted-request",
                payload: {
                  user: userId,
                },
              });

              this.broadcastAvailability();
              acceptedUser.broadcastAvailability();

              sessionUsers.forEach((u) => {
                u.send({
                  type: "chat-session",
                  payload: {
                    sessionId: sessionId,
                    numberUsers: sessionUsers.length,
                    chatAdmin: this.id,
                  },
                });
              });
            } else {

              SessionManager.getInstance().addUser(
                this.sessionId,
                acceptedUser
              );

              const sessionUsers = SessionManager.getInstance().sessions.get(
                this.sessionId
              );

              acceptedUser.sessionId = this.sessionId;
              acceptedUser.availability = "IN_SESSION_MEMBER";

              acceptedUser.send({
                type: "chat-session",
                payload: {
                  sessionId: this.sessionId,
                  numberUsers: sessionUsers!.length,
                  chatAdmin: this.id,
                },
              });

              this.broadcastAvailability();
              acceptedUser.broadcastAvailability();

              
            }
          }
          break;

        case "message-request-reject":
          {
            const userId = parsedData.payload.user;

            const rejectedUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!rejectedUser) return;

            if (
              this.availability !== "PENDING_IN" ||
              rejectedUser.availability !== "PENDING_OUT"
            ) {
              return;
            }

            this.availability = "FREE";
            rejectedUser.availability = "FREE";

            rejectedUser.send({
              type: "request-rejected",
              payload: {
                user: this.id,
              },
            });

            this.send({
              type: "you-rejected-request",
              payload: {
                user: userId,
              },
            });

            this.broadcastAvailability();
            rejectedUser.broadcastAvailability();

            
          }
          break;

        case "chat-message":
          { 
            
            const { sessionId, message, userName } = parsedData.payload;

            if (!this.sessionId || this.sessionId !== sessionId) return;

            SessionManager.getInstance().broadcast(
              {
                type: "inbox-message",
                payload: {
                  userName: userName,
                  text: message,
                },
              },
              this,
              sessionId
            );
          }
          break;
      }
    });
  }

  private runProximity(stationary: boolean) {
    const nearbyPlayers = RoomManager.getInstance().findNearbyPlayers(
      this,
      this.spaceId!,
      1
    );

    const currentSet = new Set<string>(nearbyPlayers.map((u) => u.id!));

    const previousSet = this.nearbyUsers;

    this.proximity(previousSet, currentSet, stationary);
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

  sendProximityEnter(usersJoined: string[], stationary: boolean) {
    if (stationary) {
      this.send({
        type: "proximity-enter",
        payload: {
          users: usersJoined,
          stationary: true,
          message: "they-moved",
        },
      });
    } else {
      this.send({
        type: "proximity-enter",
        payload: {
          users: usersJoined,
          stationary: false,
          message: "you-moved",
        },
      });
    }
  }

  sendProximityLeave(usersLeft: string[], stationary: boolean) {
    if (stationary) {
      this.send({
        type: "proximity-leave",
        payload: {
          users: usersLeft,
          stationary: true,
          message: "they-moved",
        },
      });
    } else {
      this.send({
        type: "proximity-leave",
        payload: {
          users: usersLeft,
          stationary: false,
          message: "you-moved",
        },
      });
    }
  }

  proximity(a: Set<any>, b: Set<any>, stationary: boolean) {
    //when we leave our own proximity function will run first, so the usersleft and joined are a result of our own movement

    let usersLeft = [];
    let usersJoined = [];

    for (const user of a) {
      if (!b.has(user)) {
        usersLeft.push(user);
        this.sessionProximityFunction(user, stationary);
      }
    }

    if (usersLeft.length > 0) {
      this.sendProximityLeave(usersLeft, stationary);
    }

    for (const user of b) {
      if (!a.has(user)) {
        usersJoined.push(user);
      }
    }

    if (usersJoined.length > 0) {
      this.sendProximityEnter(usersJoined, stationary);
    }

    this.nearbyUsers = b;
  }

  sessionProximityFunction(userId: string, stationary: boolean) {
    if (!this.sessionId) return;

    const user = RoomManager.getInstance().findUserById(userId, this.spaceId!);

    if (!user?.sessionId || user.sessionId !== this.sessionId) return;

    if (!stationary) {
      //you left session or not

      const ourSessionList = SessionManager.getInstance().sessions.get(
        this.sessionId
      );

      if (this.availability === "IN_SESSION_MEMBER") {
        SessionManager.getInstance().removeUser(this, this.sessionId);
        this.sessionId = undefined;
        this.availability = "FREE";
        this.broadcastAvailability();
      }

      if (
        this.availability === "IN_SESSION_ADMIN" ||
        ourSessionList?.length! < 2
      ) {
        if (!this.sessionId) return;

        ourSessionList?.forEach((u) => {
          if (!this.sessionId) return;
          SessionManager.getInstance().removeUser(u, this.sessionId);
          u.sessionId = undefined;
          u.availability = "FREE";
          u.broadcastAvailability();

          u.send({
            type: "session-ended",
          });
        });

        

        SessionManager.getInstance().sessions.delete(this.sessionId);
        this.sessionId = undefined;
        this.availability = "FREE";
        this.broadcastAvailability()
      }
    }

    if (!this.sessionId) return;

    if (stationary) {
      //someone else left session or not

      const ourSessionList = SessionManager.getInstance().sessions.get(
        this.sessionId
      );

      if (!ourSessionList) return;

      const user = RoomManager.getInstance().findUserById(
        userId,
        this.spaceId!
      );

      if (user?.sessionId !== this.sessionId) return;

      if (ourSessionList.length < 2) return;

      if (user.availability === "IN_SESSION_MEMBER") {
        this.send({
          type: "user-left-chat",
          payload: {
            userId: user.id,
            userName: user.name,
            text: "left the chat",
          },
        });
      }
    }
  }

  broadcastAvailability() {
    RoomManager.getInstance().broadcast(
      {
        type: "availability-update",
        payload: {
          userId: this.id,
          availability: this.availability,
        },
      },
      this,
      this.spaceId!
    );

    this.send({
      type: "availability-update",
      payload: {
        userId: this.id,
        availability: this.availability,
      },
    });
  }
}
