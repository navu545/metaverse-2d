import client from "@repo/db/client";

interface playerType {
  userId: string;
  spaceId: string;
  x: number;
  y: number;
}

//the following service class helps us with methods that we use to interact with the db, mainly spaceUsers table to change positions

export class SpaceUserService {

  findPlayer({ userId, spaceId }: { userId: string; spaceId: string }) {
    return client.spaceUsers.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
    });
  }

  createPlayer({ userId, spaceId, x, y }: playerType) {
    return client.spaceUsers.create({
      data: { userId, spaceId, x, y },
    });
  }

  updatePosition({ userId, spaceId, x, y }: playerType) {
    return client.spaceUsers.update({
      where: { userId_spaceId: { userId, spaceId } },
      data: { x, y },
    });
  }
}
