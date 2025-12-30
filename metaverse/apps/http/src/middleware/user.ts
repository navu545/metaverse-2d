import jwt from "jsonwebtoken";
import { JWT_PASSWORD } from "../config";
import { NextFunction, Request, Response } from "express";

//this middleware is being used to extract user id from the token which would be required for an authenticated endpoint
export const userMiddleware = (req: Request, res:Response, next: NextFunction) => {
    const header = req.headers["authorization"]
    const token = header?.split(" ")[1]

    if (!token) {
        res.status(403).json({message: "Unauthorized"})
        return 
    }
    try{
        const decoded = jwt.verify(token, JWT_PASSWORD) as {role: string, userId: string}
        //attach the userid to the request object
        req.userId = decoded.userId
        next()
    } catch(e) {
        res.status(401).json({message: "Unauthorized"})
        return 
    }
}