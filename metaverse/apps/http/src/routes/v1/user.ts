import { Router } from "express";
import { UpdateMetadataSchema } from "../../types";
import client from "@repo/db/client"
import { userMiddleware } from "../../middleware/user";

export const userRouter = Router();

//we use the following endpoint when we need to update our avatar
userRouter.post("/metadata", userMiddleware, async(req, res)=> {
    const parsedData = UpdateMetadataSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({message: "Validation failed"})
        return 
    }
    try {
        await client.user.update({
        where: {
            id: req.userId
        },
        data: {
            avatarId: parsedData.data.avatarId
        }
    })
    res.json({ message: "Metadata updated" });
    } catch(e) {
        
        res.status(400).json({ message: "Internal server error" });
    }
    
    
})

//we need the following endpoint so we can get details about all users in a space to render them 
userRouter.get("/metadata/bulk", async(req, res) => {
  const userIdString = (req.query.ids ?? "[]") as string;
  const userIds = userIdString.slice(1, userIdString?.length - 1).split(","); //ids = [1,2,3], we'd need to remove the '[' ']'

  
  const metadata = await client.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      avatar: true,
      id: true,
    },
  });
  res.json({
    avatars: metadata.map(m => ({
      userId: m.id,
      avatarId: m.avatar?.imageUrl,
    })),
  });
});


