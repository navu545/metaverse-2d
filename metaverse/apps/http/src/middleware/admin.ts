import jwt from "jsonwebtoken";
import { JWT_PASSWORD } from "../config";
import { NextFunction, Request, Response } from "express";

//same as the user middleware, this verifies if the id attached to the token present belongs to an admin 
export const adminMiddleware = (req: Request, res:Response, next: NextFunction) => {
    const header = req.headers["authorization"]
    const token = header?.split(" ")[1]

    if (!token) {
        res.status(403).json({message: "Unauthorized"})
        return 
    }
    try{
        const decoded = jwt.verify(token, JWT_PASSWORD) as {role: string, userId: string}
        //this is the extra admin check here
        if (decoded.role != "Admin") {
            res.status(403).json({message: "Unauthorized"})
            return 
        }
        req.userId = decoded.userId
        next()
    } catch(e) {
        res.status(401).json({message: "Unauthorized"})
        return 
    }
}