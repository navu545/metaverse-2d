/* Just an example of how elements, map and space could be created, we're not really using the elements created here 
but can integrate them in the future by actually fetching the map-elements details and using them in the main index.ts
file in the frontend. instead of using the hardcoded resources that we are using currently
the things here that are actively being used in the frontend --> 
1: SpaceId : we use it in the ws backend to fetch all the users details associated with that spaceId and send it to frontend
for them to be rendered at their respective positions
2: Space dimensions: Being used in the ws backend again where it allocated the hero a spawn point according to that,
updates the hero's position in the database as well */


import axios from "axios";
import type { AxiosResponse } from "axios";

export interface makeASpaceResult {
  spaceId: string;
  adminToken: string;
}

export async function makeASpace(): Promise<makeASpaceResult> {
  try {
    const BACKEND_URL = "http://localhost:3000";
    const username = "nav" + Math.random();
    const password = "123456";

    //signup-signin
    await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin",
    });


    const response: AxiosResponse<{ token: string }> = await axios.post(
      `${BACKEND_URL}/api/v1/signin`,
      {
        username,
        password,
      }
    );

    const adminToken = response.data.token;
    const authHeader = { headers: { authorization: `Bearer ${adminToken}` } };

    //these are just dummies, not really being used
    const elementPayloads = [
      {
        imageUrl:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/ground.png?updatedAt=1761723065338",
        width: 320,
        height: 180,
        static: true,
      },
      {
        imageUrl:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/hero-sheet.png?updatedAt=1761723065347",
        width: 96,
        height: 256,
        static: true,
      },
      {
        imageUrl:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/rod.png?updatedAt=1761723065273",
        width: 16,
        height: 16,
        static: true,
      },
      {
        imageUrl:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/shadow.png?updatedAt=1761723065385",
        width: 32,
        height: 32,
        static: true,
      },
      {
        imageUrl:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/sky.png?updatedAt=1761723065308",
        width: 320,
        height: 180,
        static: true,
      },
    ];

    //waiting on every elementId to be returned
    const elementResponses = await Promise.all(
      elementPayloads.map((payload) =>
        axios.post<{ id: string }>(
          `${BACKEND_URL}/api/v1/admin/element`,
          payload,
          authHeader
        )
      )
    );

    const elementIds = elementResponses.map((res) => res.data.id);
    

    //created a test map
    const mapResponse: AxiosResponse<{ id: string }> = await axios.post(
      `${BACKEND_URL}/api/v1/admin/map`,
      {
        thumbnail:
          "https://ik.imagekit.io/h8nyjqxh8/Metaverse/spritesheet.png?updatedAt=1761723065255",
        dimensions: "320x180",
        name: "Test space",
        defaultElements: [
          { elementId: elementIds[0], x: 0, y: 0 },
          { elementId: elementIds[1], x: 6, y: 5 },
          { elementId: elementIds[2], x: 7, y: 6 },
          { elementId: elementIds[3], x: 6, y: 5 },
          { elementId: elementIds[4], x: 0, y: 0 },
        ],
      },
      authHeader
    );

    const mapId = mapResponse.data.id;

    //the saved space dimensions here would be the one used in the backend to allocate a spawn point for hero 
    const spaceResponse: AxiosResponse<{ spaceId: string }> = await axios.post(
      `${BACKEND_URL}/api/v1/space`,
      {
        name: "Test",
        dimensions: "320x180",
        mapId: mapId,
      },
      authHeader
    );

    //spaceId would be used by the ws backend to allocate users and save their positions respectively while also updating the database
    const spaceId = spaceResponse.data.spaceId;

    return { spaceId, adminToken };
  } catch  {
    throw new Error("Failed to create space, see logs for details");
  }
}
