import { Router } from "express";
import { AddElementSchema, CreateSpaceSchema, DeleteElementSchema } from "../../types";
import client from "@repo/db/client"
import { userMiddleware } from "../../middleware/user";
export const spaceRouter = Router();

//the following endpoint is to create a space with or without map
spaceRouter.post("/", userMiddleware, async(req,res)=> {
    const parsedData = CreateSpaceSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({message: "Validation failed"})
        return
    }

    //if map id isn't present in request body, just create a fresh space with no elements
    if(!parsedData.data.mapId) {
        const space = await client.space.create({
            data: {
                name: parsedData.data.name,
                width: parseInt(parsedData.data.dimensions.split("x")[0]),
                height: parseInt(parsedData.data.dimensions.split("x")[1]),
                creatorId: req.userId!
            }
        })
        res.json({spaceId: space.id})
        return
    }

    //if map, find the map and get all the elements associated with it
    const map = await client.map.findFirst({
        where: {
            id: parsedData.data.mapId
        }, select: {
           mapElements: true, 
           width: true,
           height: true

        }
    })
    if (!map) {
        res.status(400).json({message: "Map not found"})
        return 
    }

    //we are creating a transaction here to avoid partial db writes
    let space = await client.$transaction(async ()=> {
        const space = await client.space.create({
        data:{
            name: parsedData.data.name,
            width: map.width,
            height: map.height,
            creatorId: req.userId!,
        }})

        await client.spaceElements.createMany({
            data: map.mapElements.map(e=> ({
                spaceId: space.id,
                elementId: e.elementId,
                x: e.x!,
                y: e.y!
            }))
        })

        return space;

    })
    res.json({spaceId: space.id})
})

//the following endpoint is to delete a placed element in a space
spaceRouter.delete("/element", userMiddleware, async (req, res) => {
  const parsedData = DeleteElementSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  const spaceElement = await client.spaceElements.findFirst({
    where: {
      id: parsedData.data.id,
    },
    include: {
      space: true,
    },
  });
  //user id was attached to the req object by the middleware
  if (
    !spaceElement?.space.creatorId ||
    spaceElement.space.creatorId !== req.userId
  ) {
    res.status(403).json({ message: "Unauthorized" });
    return;
  }
  await client.spaceElements.delete({
    where: {
      id: parsedData.data.id,
    },
  });
  res.json({ message: "Element deleted" });
});

//the following endpoint is to delete a space
spaceRouter.delete("/:spaceId",userMiddleware, async(req, res) => {
    const space = await client.space.findUnique({
        where: {
            id: req.params.spaceId
        }, select: {
            creatorId: true
        }
    })

    if (!space) {
        res.status(400).json({message: "Space not found"})
        return 
    }

    if (space.creatorId !== req.userId) {
        res.status(403).json({message: "Unauthorized"})
        return 
    }
    await client.space.delete({
        where:{
            id: req.params.spaceId
        }
    })
    res.json({message: "Space deleted"})
});

//following endpoint is to return all spaces created by user, would be used for space selector page, before entering arena
spaceRouter.get("/all", userMiddleware, async (req, res) => {
  const spaces = await client.space.findMany({
    where: {
      creatorId: req.userId!,
    },
  });

  res.json({
    spaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail,
      dimensions: `${s.width}x${s.height}`,
    })),
  });
});

//following endpoint is to add an element in a space
spaceRouter.post("/element", userMiddleware, async (req, res) => {
  const parsedData = AddElementSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  const space = await client.space.findUnique({
    where: {
      id: req.body.spaceId,
      creatorId: req.userId!,
    },
    select: {
      width: true,
      height: true,
    },
  });

  /*if the given position of the element is invalid, the static object position verification responsibility lies on the http server
  while the hero's position responsibility and updation lies on the websocket server
  and we used positions saved from both servers to inculcate collision features */

  if(req.body.x < 0 || req.body.y < 0 || req.body.x > space?.width! || req.body.y > space?.height!) {
    res.status(400).json({message: "Point is outside of the boundary"})
    return
  }


  if (!space) {
    res.status(400).json({ message: "Space not found" });
    return;
  }
  await client.spaceElements.create({
    data: {
      spaceId: req.body.spaceId,
      elementId: req.body.elementId,
      x: req.body.x,
      y: req.body.y,
    },
  });
  res.json({ message: "Element added" });
});

//following endpoint would be required to get all the elements within the space in order to render them in the arena
//the structure is Space --> SpaceElements(contains x,y positions of the placed Element)--> Element (Actual element with specificities)
spaceRouter.get("/:spaceId", async(req, res) => {
    const space = await client.space.findUnique({
        where: {
            id: req.params.spaceId
        },
        include: {
            elements:{
                include:{
                    element:true
                }
            }
        }
    })
    if (!space){
        res.status(400).json({message: "Space not found"})
        return 
    }

    //e.id below is spaceElements id, x and y are spaceElements position, and within the element object is the raw element
    res.json({
        "dimensions": `${space.width}x${space.height}`,
        elements: space.elements.map(e => ({
            id:e.id,
            element:{
                id: e.element.id,
                imageUrl: e.element.imageUrl,
                width: e.element.width,
                height: e.element.height,
                static: e.element.static
            },
            x: e.x,
            y: e.y
        }))
    })
});






