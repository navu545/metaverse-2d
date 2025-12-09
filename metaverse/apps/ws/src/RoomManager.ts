import { User } from "./User";
import { OutgoingMessage } from "./types";

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

  public findUser(userId: string, spaceId: string) {
    const room = this.rooms.get(spaceId);

    if (!room) return null;

    return room.find((u) => u.userId == userId) || null;
  }

  public findUserById(id:string, spaceId:string) {
    const room = this.rooms.get(spaceId);

    if(!room) return null;

    return room.find((u)=> u.id == id) ?? null;
  }

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