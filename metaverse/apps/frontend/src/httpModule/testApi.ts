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

    const signUpResponse = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
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


    const spaceResponse: AxiosResponse<{ spaceId: string }> = await axios.post(
      `${BACKEND_URL}/api/v1/space`,
      {
        name: "Test",
        dimensions: "320x180",
        mapId: mapId,
      },
      authHeader
    );

    const spaceId = spaceResponse.data.spaceId;

    return { spaceId, adminToken };
  } catch  {
    throw new Error("Failed to create space, see logs for details");
  }
}
