import express from "express";
import cors from "cors";

import { router } from "./routes/v1";


const app = express()

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}))

app.get("/api/ping", (req, res) => {
  res.send("Pong");
});

app.use(express.json())


app.use("/api/v1", router)

app.listen(process.env.PORT || 3000)


  