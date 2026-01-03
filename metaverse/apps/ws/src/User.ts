import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import { JWT_PASSWORD } from "./config";
import { SpaceUserService } from "./services/SpaceUserService";
import { SessionManager } from "./SessionManager";

//this function generates a random string that we use to generate id particular to a user class instance, and also the sessionId
function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

//These are different availability states a user can exist in, we use this to allow/disallow requests as well as frontend UI changes
type UserAvailability =
  | "FREE"
  | "PENDING_IN"
  | "PENDING_OUT"
  | "IN_SESSION_ADMIN"
  | "IN_SESSION_MEMBER"
  | "ADMIN_AND_PENDING_IN";

//User class acts as a placeholder to save a ws connection along with things specific to a single user
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
  public pendingInUser: string[] = [];

  constructor(private ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.animation = "DOWN";
    this.initHandlers();
  }

  //Following event handlers are initialised soon as the ws connection is connected
  initHandlers() {
    this.ws.on("message", async (data) => {
      const parsedData = JSON.parse(data.toString());
      switch (parsedData.type) {
        //A new user wanting to join a space will send a join event
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

            const user = await client.user.findFirst({
              where: {
                id: userId,
              },
            });
            if (!user) {
              this.ws.close();
              return;
            }
            this.name = user.username;

            /*if a user already exists in the same space, we first destroy its user instance and ws connection.
            We create a new User instance, copy the saved values from the database, and assign it to this new instance.
            This way only one connection per user per space can exist at one time, and two separate windows wont be
            allowed for the same user in the same space, also helps restore the saved position if connection gets lost*/

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

            //service class contains functions allowing us to make changes in the database regarding user's position (spaceUsers table)
            const existing = await this.service.findPlayer({ userId, spaceId });

            if (existing) {
              this.x = existing.x;
              this.y = existing.y;
            } else {
              const randomX = Math.floor((Math.random() * space.width) / 16);
              const randomY = Math.floor((Math.random() * space.height) / 16);

              //create a new spaceUsers entry
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

            //we send the new joining user its spawn position, User class (ws) id, userId, name, its spawn and other users position
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
              },
            });

            //we broadcast to other users who has joined with its position
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

            //the following will attach a setInterval to this user instance allowing it to save its position in db every 3 secs
            this.startSaveInterval();
          }

          break;

        //The following event would be sent by the user to server when it moves and get the move, verified and broadcasted
        case "move":
          {
            const moveX = parsedData.payload.x;
            const moveY = parsedData.payload.y;
            const xDisplacement = Math.abs(this.x - moveX);
            const yDisplacement = Math.abs(this.y - moveY);
            const animation = parsedData.payload.animation;

            //EPS - epsilon is basically margin of error
            const EPS = 0.001;

            const withinX =
              xDisplacement <= 1 + EPS && Math.abs(yDisplacement) <= EPS;

            const withinY =
              yDisplacement <= 1 + EPS && Math.abs(xDisplacement) <= EPS;

            //here we can do the verification if the made move was legal or not
            if (withinX || withinY) {
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
              //stationary represents whether if we were stationary or not, here we made the move, so its false
              const stationary = false;
              this.runProximity(stationary);

              return;
            }

            //if our move wasn't legal
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

        /*the following would be sent by the stationary user when it detects movement of other users so not just the moving,
        but even the stationary user can check if someone is in its proximity*/
        case "run-proximity":
          {
            const stationary = true;

            this.runProximity(stationary);
          }
          break;

        //the following event would be sent by the client to server when they want to send someone a chat request
        case "send-message-request":
          {
            const userId = parsedData.payload.user;

            const requestThisUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!requestThisUser) return;

            //user can only request someone if they're free and the user can only be requested if they're free or an admin

            if (this.availability !== "FREE") {
              return;
            }

            if (
              requestThisUser.availability !== "FREE" &&
              requestThisUser.availability !== "IN_SESSION_ADMIN"
            ) {
              this.send({
                type: "request-rejected",
                payload: { user: requestThisUser.id },
              });
              return;
            }

            /*after request is sent out status changes to pending out -> pending outgoing request for the one who sends the request
            and pending in --> pending incoming request, for the one receiving it */

            this.availability = "PENDING_OUT";

            if (requestThisUser.availability === "IN_SESSION_ADMIN") {
              requestThisUser.availability = "ADMIN_AND_PENDING_IN";
            } else {
              requestThisUser.availability = "PENDING_IN";
            }

            this.send({
              type: "request-sent",
              payload: {
                user: userId,
              },
            });

            requestThisUser.send({
              type: "message-request",
              payload: {
                id: this.id,
                userId: this.userId,
              },
            });

            //pendingInUser array is used to change availability status of users in case of lost proximity
            requestThisUser.pendingInUser = [
              ...requestThisUser.pendingInUser,
              this.id,
            ];

            //we broadcast the availability status of both requester and requestee
            this.broadcastAvailability();
            requestThisUser.broadcastAvailability();
          }
          break;

        //client sends this event to server when they want to accept someone's chat request
        case "message-request-accept":
          {
            const userId: string = parsedData.payload.user;

            const acceptedUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!acceptedUser) return;

            /*we check the validitiy of availability status of both the requester and acceptor.
            The requester should be pending out and the acceptor should either be pending in or an admin and pending in
            */

            if (
              (this.availability !== "PENDING_IN" &&
                this.availability !== "ADMIN_AND_PENDING_IN") ||
              acceptedUser?.availability !== "PENDING_OUT"
            )
              return;

            //we clear out the accepted user from the pending in array
            this.pendingInUser = this.pendingInUser.filter(
              (id) => id !== userId
            );

            //here we will create a new session and assign a session id (when session doesn't exist)
            if (!this.sessionId) {
              const sessionUsers = [acceptedUser, this];

              //session id is the identifier of the current session, similar to spaceId for the rooms
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
                    chatAdmin: this.name,
                  },
                });
              });
            } else {
              /*when a session already exists, we add the user, assign it the already existing sessionId and change the availibility
            status of both the acceptor and the requestor */
              SessionManager.getInstance().addUser(
                this.sessionId,
                acceptedUser
              );

              const sessionUsers = SessionManager.getInstance().sessions.get(
                this.sessionId
              );

              acceptedUser.sessionId = this.sessionId;
              acceptedUser.availability = "IN_SESSION_MEMBER";
              this.availability = "IN_SESSION_ADMIN";

              acceptedUser.send({
                type: "chat-session",
                payload: {
                  sessionId: this.sessionId,
                  numberUsers: sessionUsers!.length,
                  chatAdmin: this.name,
                },
              });

              SessionManager.getInstance().broadcast(
                {
                  type: "new-user-joined",
                  payload: {
                    userName: acceptedUser.name,
                  },
                },
                acceptedUser,
                this.sessionId
              );

              this.broadcastAvailability();
              acceptedUser.broadcastAvailability();
            }
          }
          break;

        //client sends this event upon cancelling someone's request
        case "message-request-reject":
          {
            const userId = parsedData.payload.user;

            const rejectedUser = RoomManager.getInstance().findUserById(
              userId,
              this.spaceId!
            );

            if (!rejectedUser) return;

            //after verification of availabilities, pendingInUser list is updated, status are updated and broadcasted
            if (
              (this.availability !== "PENDING_IN" &&
                this.availability !== "ADMIN_AND_PENDING_IN") ||
              rejectedUser.availability !== "PENDING_OUT"
            ) {
              return;
            }

            this.pendingInUser = this.pendingInUser.filter(
              (id) => id !== userId
            );

            if (this.availability === "ADMIN_AND_PENDING_IN") {
              this.availability = "IN_SESSION_ADMIN";
            }

            if (this.availability === "PENDING_IN") {
              this.availability = "FREE";
            }

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

        //After a successful session if formed, these events would sent by users to exchange chat messages
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

  //this helper function (to main proximity function) passes the prev nearby player list and cur nearby player list, indicating change
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

  //this function is responsible to save user's updated position every 3 seconds
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

  //this function helps clear out the setInterval attached to the user object and updating its position for the last time
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

  //this function removes the user from space
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

  //this function receives the updated proximity lists and sends them to client
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

  //this function receives the updated proximity lists and sends them to client
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

  /*this function takes care of updating proximity lists of both the moving and stationary users.
  Whichever user moves, its proximity function will run, and update the 'local' user first, meanwhile
  also alongside, the stationary user upon receiving movement event, will also run this same function 
  to update its proximity list like the first user who moved. This function also takes care of pending requests
  due to proximity changes. Also it passes the leaving user in session proximity function which allows us 
  to modify session behaviour on proximity changes as well*/
  proximity(a: Set<any>, b: Set<any>, stationary: boolean) {
    let usersLeft = [];
    let usersJoined = [];

    for (const user of a) {
      if (!b.has(user)) {
        usersLeft.push(user);
        this.sessionProximityFunction(user, stationary);
      }
    }

    usersLeft.forEach((id) => {
      const user = RoomManager.getInstance().findUserById(id, this.spaceId!);

      /*If the leaving user sent us a req or we were the sender, we have to free them both once they lose proximity to each other,
      here we also make use of the pendingInUser list to constraint changes, based on the leaving user's status and its
      relevancy with our status eg. If we got the request and the user leaves, we want to make sure, that our pendingList definitely
      had the leaving user so we can change our status*/

      if (!user) return;

      if (
        user.availability === "PENDING_IN" ||
        user.availability === "ADMIN_AND_PENDING_IN" ||
        this.availability === "ADMIN_AND_PENDING_IN" ||
        this.availability === "PENDING_IN"
      ) {
        if (
          user.pendingInUser.includes(this.id) ||
          this.pendingInUser.includes(user.id)
        ) {
          user.pendingInUser = user.pendingInUser.filter(
            (id) => id !== this.id
          );
          this.pendingInUser = this.pendingInUser.filter(
            (id) => id !== user.id
          );

          if (user.availability === "PENDING_IN") {
            user.availability = "FREE";
            this.availability = "FREE";
          }
          if (user.availability === "ADMIN_AND_PENDING_IN") {
            user.availability = "IN_SESSION_ADMIN";
            this.availability = "FREE";
          }

          if (this.availability === "PENDING_IN") {
            this.availability = "FREE";
            user.availability = "FREE";
          }
          if (this.availability === "ADMIN_AND_PENDING_IN") {
            this.availability = "IN_SESSION_ADMIN";
            user.availability = "FREE";
          }

          user.broadcastAvailability();
          this.broadcastAvailability();
        }
      }
    });

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

    //update the current nearby players list
    this.nearbyUsers = b;
  }

  /* the following function is responsible for ending of sessions on loss of proximity and updating the relevant statuses therefore,
  also sending events indicating a user has left the chat*/

  sessionProximityFunction(userId: string, stationary: boolean) {
    if (!this.sessionId) return;

    const otherUser = RoomManager.getInstance().findUserById(
      userId,
      this.spaceId!
    );

    if (!otherUser?.sessionId || otherUser.sessionId !== this.sessionId) return;

    const sessionId = this.sessionId;
    const sessionUsers = SessionManager.getInstance()
      .sessions.get(sessionId)
      ?.filter((user) => user.id !== this.id);

    if (!sessionUsers) return;

    const isAdmin =
      this.availability === "IN_SESSION_ADMIN" ||
      this.availability === "ADMIN_AND_PENDING_IN";

    const isMember = this.availability === "IN_SESSION_MEMBER";

    //we'll receive stationary from proximity function indicating whether we ran that function as a stationary member or a moving one
    if (!stationary) {
      //we moved as a member, some other chat admin will take care of our absence
      if (isMember) {
        return;
      }

      //we moved as an admin, we will end the session for everyone, reset their sessionIds and status, delete the session
      if (isAdmin) {
        console.log("moving Admin", this.id);
        sessionUsers.forEach((u) => {
          SessionManager.getInstance().removeUser(u, sessionId);
          u.sessionId = undefined;
          u.availability = "FREE";
          u.broadcastAvailability();

          u.send({
            type: "session-ended",
          });
        });

        SessionManager.getInstance().sessions.delete(sessionId);

        this.sessionId = undefined;

        if (this.availability === "ADMIN_AND_PENDING_IN") {
          this.availability = "PENDING_IN";
        } else {
          this.availability = "FREE";
        }

        this.send({
          type: "session-ended",
        });

        this.broadcastAvailability();

        return;
      }

      return;
    }

    //if we are a stationary member, do nothing as the chatadmin either moving or stationary takes care of us
    if (isMember) {
      return;
    }

    //if we are a stationary observing chatadmin
    if (isAdmin) {
      SessionManager.getInstance().removeUser(otherUser, sessionId);

      otherUser.sessionId = undefined;
      otherUser.availability = "FREE";
      otherUser.broadcastAvailability();

      //kick the user out
      otherUser.send({
        type: "session-ended",
      });

      // Inform everyone
      this.send({
        type: "user-left-chat",
        payload: {
          userId: otherUser.id,
          userName: otherUser.name,
          text: "left the chat",
        },
      });

      SessionManager.getInstance().broadcast(
        {
          type: "user-left-chat",
          payload: {
            userId: otherUser.id,
            userName: otherUser.name,
            text: "left the chat",
          },
        },
        this,
        sessionId
      );

      //remainingUsers just has us left
      const remainingUsers =
        SessionManager.getInstance().sessions.get(sessionId);

      // If admin is now alone, end entire session
      if (!remainingUsers || remainingUsers.length < 2) {
        SessionManager.getInstance().removeUser(this, sessionId);

        SessionManager.getInstance().sessions.delete(sessionId);

        this.sessionId = undefined;

        if (this.availability === "ADMIN_AND_PENDING_IN") {
          this.availability = "PENDING_IN";
        } else {
          this.availability = "FREE";
        }

        this.broadcastAvailability();

        this.send({
          type: "session-ended",
        });
      }
    }
  }

  //this function broadcasts availability of users
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
