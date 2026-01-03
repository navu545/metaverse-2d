import { User } from "./User";
import { OutgoingMessage } from "./types";

/*RoomManager class is responsible for maintaining Users in a specific room based on the spaceId allocated to that user,
it's a singleton because we want one single source of authoritative truth*/

export class RoomManager {
  rooms: Map<string, User[]> = new Map();
  static instance: RoomManager;

  private constructor() {
    this.rooms = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  public removeUser(user: User, spaceId: string) {
    if (!this.rooms.has(spaceId)) {
      return;
    }
    this.rooms.set(
      spaceId,
      this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? []
    );
  }

  public addUser(spaceId: string, user: User) {
    if (!this.rooms.has(spaceId)) {
      this.rooms.set(spaceId, [user]);
      return;
    }

    this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
  }

  //broadcasts the messaqge to every other user except the User thats passed in
  public broadcast(message: OutgoingMessage, user: User, roomId: string) {
    if (!this.rooms.has(roomId)) {
      return;
    }

    this.rooms.get(roomId)?.forEach((u) => {
      if (u.id !== user.id) {
        u.send(message);
      }
    });
  }

  //to find user by the db userid
  public findUser(userId: string, spaceId: string) {
    const room = this.rooms.get(spaceId);

    if (!room) return null;

    return room.find((u) => u.userId == userId) || null;
  }

  //to find user by the user class id
  public findUserById(id: string, spaceId: string) {
    const room = this.rooms.get(spaceId);

    if (!room) return null;

    return room.find((u) => u.id === id) ?? null;
  }

  //to find users in proximity based on the radius entered, usually 1 (1 block distance)
  public findNearbyPlayers(user: User, spaceId: string, radius: number) {
    const room = this.rooms.get(spaceId);

    if (!room) return [];

    return room.filter(
      (u) =>
        u.userId !== user.userId &&
        Math.abs(u.x - user.x) <= radius &&
        Math.abs(u.y - user.y) <= radius
    );
  }

  
}