import { Router } from "express";
import { spaceRouter } from "./space";
import { userRouter } from "./user";
import { adminRouter } from "./admin";
import { SignupSchema, SigninSchema } from "../../types";
import { hash, compare } from "../../scrypt";
import client from "@repo/db/client";
import jwt from "jsonwebtoken";
import { JWT_PASSWORD } from "../../config";

export const router = Router();

router.post("/signup", async (req, res) => {
  //using zod validation
  const parsedData = SignupSchema.safeParse(req.body);

  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  //the hash function lies in scrypt.ts and helps encrypting it
  const hashedPassword = await hash(parsedData.data.password);

  try {
    const user = await client.user.create({
      data: {
        username: parsedData.data.username,
        password: hashedPassword,
        role: parsedData.data.type === "admin" ? "Admin" : "User",
      },
    });

    //return the id allocated in the database
    res.json({
      userId: user.id,
    });
  } catch (e) {
    res.status(400).json({ message: "User already exists" });
  }
});

router.post("/signin", async (req, res) => {
  const parsedData = SigninSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(403).json({ message: "Validation failed" });
    return;
  }
  try {
    const user = await client.user.findUnique({
      where: {
        username: parsedData.data.username,
      },
    });
    if (!user) {
      res.status(403).json({ message: "User not found" });
      return;
    }
    //the compare function lies in scrypt.ts which helps comparing plain password to the saved encrypted one
    const isValid = await compare(parsedData.data.password, user.password);
    if (!isValid) {
      res.status(403).json({ message: "Invalid password" });
    }

    //we return a token after verification using jsonwebtoken and our set jwtpassword
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_PASSWORD
    );

    res.json({
      token,
    });
  } catch (e) {
    res.status(400).json({ message: "Internal server error" });
  }
});


//lists the available elements
router.get("/elements", async (req, res) => {
  const elements = await client.element.findMany();
  res.json({
    elements: elements.map((e) => ({
      id: e.id,
      imageUrl: e.imageUrl,
      width: e.width,
      height: e.height,
      static: e.static,
    })),
  });
});

//lists the available avatars
router.get("/avatars", async (req, res) => {
  const avatars = await client.avatar.findMany();
  res.json({
    avatars: avatars.map(x => ({
      id: x.id,
      imageUrl: x.imageUrl,
      name: x.name,
    })),
  });
});

//in the main express file we used /api/v1/ and now we extend it so we can use /api/v1/user/... etc.
router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
